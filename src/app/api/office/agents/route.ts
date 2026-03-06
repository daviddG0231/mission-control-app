/**
 * Agent Office API — OpenClaw agents + tool activity for pixel-style office view.
 * Reads config for agent list, sessions from gateway, and parses JSONL for tool state.
 */
import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'
import { invokeGatewayTool } from '@/lib/gateway'

const OPENCLAW_CONFIG = path.join(process.env.HOME || os.homedir(), '.openclaw', 'openclaw.json')

const SESSIONS_DIRS = [
  path.join(process.env.HOME || '/Users/david', '.openclaw/agents/builder/sessions'),
  path.join(process.env.HOME || '/Users/david', '.openclaw/agents/main/sessions'),
]

// Map tool names to animation type (typing vs reading)
const TYPING_TOOLS = new Set(['Write', 'Edit', 'exec', 'Bash', 'browser', 'sessions_spawn', 'message', 'tts'])
const READING_TOOLS = new Set(['Read', 'Grep', 'Glob', 'web_fetch', 'web_search', 'memory_search'])

function formatToolStatus(name: string, input: Record<string, unknown>): string {
  const base = (p: unknown) => (typeof p === 'string' ? path.basename(p) : '')
  switch (name) {
    case 'Read': return `Reading ${base(input.file_path || input.path)}`
    case 'Edit': return `Editing ${base(input.file_path || input.path)}`
    case 'Write': return `Writing ${base(input.file_path || input.path)}`
    case 'exec': return `Running: ${String(input.command || '').slice(0, 40)}…`
    case 'Bash': return `Running: ${String(input.command || '').slice(0, 40)}…`
    case 'browser': return 'Using browser'
    case 'web_search': return 'Searching web'
    case 'web_fetch': return 'Fetching web'
    case 'sessions_spawn': return `Spawning agent: ${String(input.task || '').slice(0, 30)}…`
    case 'memory_search': return 'Searching memory'
    case 'tts': return 'Speaking'
    case 'message': return 'Sending message'
    default: return `Using ${name}`
  }
}

function getAnimationType(toolName: string): 'typing' | 'reading' {
  if (TYPING_TOOLS.has(toolName)) return 'typing'
  if (READING_TOOLS.has(toolName)) return 'reading'
  return 'typing'
}

interface AgentWithTools {
  id: string
  name: string
  emoji: string
  status: 'typing' | 'reading' | 'waiting' | 'idle'
  currentTool?: string
  currentToolName?: string
  animation?: 'typing' | 'reading'
  isSubagent?: boolean
  parentId?: string
}

async function parseTranscriptToolState(jsonlPath: string): Promise<{
  activeTools: Array<{ name: string; status: string; animation: 'typing' | 'reading' }>
  isGenerating: boolean
}> {
  try {
    const content = await fs.readFile(jsonlPath, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)
    const activeToolIds = new Set<string>()
    const toolStatuses = new Map<string, { name: string; status: string; animation: 'typing' | 'reading' }>()
    let isGenerating = false

    for (let i = lines.length - 1; i >= 0 && i >= lines.length - 200; i--) {
      try {
        const record = JSON.parse(lines[i])
        if (record.type === 'system' && record.subtype === 'turn_duration') {
          isGenerating = true
          break
        }
        const content = record.message?.content ?? record.content
        const isAssistant = record.type === 'assistant' || (record.type === 'message' && record.message?.role === 'assistant')
        if (isAssistant && Array.isArray(content)) {
          const blocks = content as Array<{
            type: string
            id?: string
            name?: string
            input?: Record<string, unknown>
            arguments?: Record<string, unknown>
          }>
          for (const b of blocks) {
            if ((b.type === 'tool_use' || b.type === 'toolCall') && b.id && b.name) {
              if (!activeToolIds.has(b.id)) {
                activeToolIds.add(b.id)
                const status = formatToolStatus(b.name, b.input || b.arguments || {})
                toolStatuses.set(b.id, {
                  name: b.name,
                  status,
                  animation: getAnimationType(b.name),
                })
              }
            }
          }
        }
        // Handle tool results (old format: user message with tool_result blocks)
        const userContent = record.type === 'user' ? (record.message?.content ?? record.content) : null
        if (Array.isArray(userContent)) {
          for (const b of userContent as Array<{ type?: string; tool_use_id?: string }>) {
            if ((b.type === 'tool_result' || b.type === 'toolResult') && b.tool_use_id) {
              activeToolIds.delete(b.tool_use_id)
              toolStatuses.delete(b.tool_use_id)
            }
          }
        }
        // Handle new format tool results (standalone toolResult message)
        if (record.type === 'message' && record.message?.role === 'toolResult') {
          const toolCallId = record.message.toolCallId ?? record.message.tool_use_id
          if (toolCallId) {
            activeToolIds.delete(toolCallId)
            toolStatuses.delete(toolCallId)
          }
        }
      } catch {
        /* skip malformed */
      }
    }

    const activeTools = Array.from(toolStatuses.values())
    return { activeTools, isGenerating: isGenerating && activeTools.length === 0 }
  } catch {
    return { activeTools: [], isWaiting: false }
  }
}

async function findJsonlForSession(sessionId: string): Promise<string | null> {
  for (const dir of SESSIONS_DIRS) {
    try {
      const p = path.join(dir, `${sessionId}.jsonl`)
      await fs.access(p)
      return p
    } catch {
      continue
    }
  }
  return null
}

export async function GET() {
  try {
    // Load configured agents from OpenClaw config (same source as Agents page)
    let agentList: Array<{ id?: string; identity?: { name?: string; emoji?: string } }> = []
    try {
      const configBuf = await fs.readFile(OPENCLAW_CONFIG, 'utf-8')
      const openclawConfig = JSON.parse(configBuf)
      agentList = openclawConfig?.agents?.list ?? (Array.isArray(openclawConfig?.agents) ? openclawConfig.agents : [])
    } catch {
      /* config not found or invalid */
    }

    const [subRes, sessionsRes] = await Promise.allSettled([
      invokeGatewayTool({ tool: 'subagents', args: { action: 'list' } }),
      invokeGatewayTool({ tool: 'sessions_list', args: { limit: 20, messageLimit: 0 } }),
    ])

    const agents: AgentWithTools[] = []
    const subagents = subRes.status === 'fulfilled'
      ? (subRes.value?.sessions || subRes.value?.result?.sessions || [])
      : []
    const rawSessions = sessionsRes.status === 'fulfilled' ? sessionsRes.value : null
    const sessions = Array.isArray(rawSessions)
      ? rawSessions
      : (rawSessions?.sessions || rawSessions?.details?.sessions || [])

    const emojiMap: Record<string, string> = { builder: '🪼', advisor: '💭', main: '🦑' }
    const nameMap: Record<string, string> = { builder: 'Patrick', advisor: 'Dave', main: 'OpenClaw' }

    // Track which configured agents have active sessions
    const seenAgentIds = new Set<string>()
    // Track sessions for collaboration detection
    const agentSessions = new Map<string, string[]>() // agentId → sessionIds

    // Main sessions (builder:main etc.) → agents
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i] as { key?: string; sessionId?: string; label?: string; model?: string; agentId?: string }
      const key = s.key || ''
      const sessionId = s.sessionId
      const agentId = s.agentId || (key.includes('builder') ? 'builder' : key.includes('main') ? 'main' : 'advisor')
      const emoji = emojiMap[agentId] || '🤖'
      const name = s.label || nameMap[agentId] || agentId
      const isSubagent = key.includes('subagent')

      // Skip subagent sessions for main agent tracking
      if (!isSubagent) seenAgentIds.add(agentId)

      let status: AgentWithTools['status'] = 'idle'
      let currentTool: string | undefined
      let currentToolName: string | undefined
      let animation: 'typing' | 'reading' | undefined

      if (sessionId) {
        const jsonlPath = await findJsonlForSession(sessionId)
        if (jsonlPath) {
          const { activeTools, isGenerating } = await parseTranscriptToolState(jsonlPath)

          // Working only when actually typing (generating) or using tools; idle when connection exists but no outgoing work
          if (activeTools.length > 0) {
            const last = activeTools[activeTools.length - 1]
            status = last.animation
            currentTool = last.status
            currentToolName = last.name
            animation = last.animation
          } else if (isGenerating) {
            status = 'typing'
            animation = 'typing'
          }
        }
      }

      agents.push({
        id: `session-${sessionId || i}`,
        name,
        emoji,
        status,
        currentTool,
        currentToolName,
        animation,
        isSubagent,
      })
    }

    // Always ensure configured agents appear (even if no active session)
    for (const a of agentList) {
      const aid = a.id || 'unknown'
      if (!seenAgentIds.has(aid)) {
        agents.push({
          id: `config-${aid}`,
          name: a.identity?.name || aid,
          emoji: a.identity?.emoji || emojiMap[aid] || '🤖',
          status: 'idle',
        })
      }
    }

    // Build sessionKey → main agent id map for parent lookup
    const keyToAgentId = new Map<string, string>()
    for (let j = 0; j < sessions.length; j++) {
      const s = sessions[j] as { sessionId?: string; key?: string }
      if (!s.key || s.key.includes('subagent')) continue
      keyToAgentId.set(s.key, `session-${s.sessionId || j}`)
    }
    // Subagents from subagents API — infer parent from sessionKey (e.g. builder:main:subagent:uuid → builder:main)
    for (let i = 0; i < subagents.length; i++) {
      const sub = subagents[i] as { sessionKey?: string; label?: string; task?: string; status?: string; parentSessionKey?: string }
      const label = sub.label || sub.sessionKey || `Sub-agent ${i + 1}`
      const subStatus = sub.status === 'running' ? 'typing' : 'idle'
      let parentId: string | undefined
      const sk = sub.sessionKey || sub.parentSessionKey
      if (sk) {
        const beforeSub = sk.split(':subagent')[0]
        if (beforeSub) {
          parentId = keyToAgentId.get(beforeSub)
          if (!parentId && beforeSub.includes(':')) {
            parentId = keyToAgentId.get(beforeSub)
          }
          if (!parentId) {
            const prefix = beforeSub.split(':')[0]
            parentId = Array.from(keyToAgentId.entries()).find(([k]) => k.startsWith(prefix || ''))?.[1]
          }
        }
      }
      agents.push({
        id: `sub-${sub.sessionKey || i}`,
        name: label,
        emoji: '⚡',
        status: subStatus,
        currentTool: sub.task,
        isSubagent: true,
        parentId,
        animation: subStatus === 'typing' ? 'typing' : undefined,
      })
    }

    return NextResponse.json({ agents })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg, agents: [] }, { status: 502 })
  }
}
