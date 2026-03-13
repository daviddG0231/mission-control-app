/**
 * Agent Office API — Shows CONFIGURED agents with real-time status.
 * Scans each agent's JSONL session files directly on disk
 * (gateway sessions_list is agent-scoped and can't see other agents).
 *
 * Status:
 * - "typing" — JSONL modified <15s ago OR has active tool calls OR generating
 * - "reading" — using read/search tools
 * - "waiting" — has sessions but nothing active recently
 * - "idle" — no sessions at all
 * - Cross-agent: if agent B is active and was spawned by A → A shows "Chatting with B"
 */
import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
// os import removed — using paths.ts

import { OPENCLAW_CONFIG, AGENTS_DIR } from '@/lib/paths'
const ACTIVE_THRESHOLD_MS = 30_000

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TYPING_TOOLS = new Set(['Write', 'Edit', 'exec', 'Bash', 'browser', 'sessions_spawn', 'message', 'tts', 'canvas', 'subagents'])
const READING_TOOLS = new Set(['Read', 'Grep', 'Glob', 'web_fetch', 'web_search', 'memory_search', 'memory_get', 'image', 'pdf'])

function formatToolStatus(name: string, input: Record<string, unknown>): string {
  const base = (p: unknown) => (typeof p === 'string' ? path.basename(p) : '')
  switch (name) {
    case 'Read': return `Reading ${base(input.file_path || input.path)}`
    case 'Edit': return `Editing ${base(input.file_path || input.path)}`
    case 'Write': return `Writing ${base(input.file_path || input.path)}`
    case 'exec': return `Running: ${String(input.command || '').slice(0, 40)}`
    case 'Bash': return `Running: ${String(input.command || '').slice(0, 40)}`
    case 'browser': return 'Using browser'
    case 'web_search': return 'Searching web'
    case 'web_fetch': return 'Fetching web'
    case 'sessions_spawn': return `Spawning: ${String(input.agentId || input.label || '').slice(0, 30)}`
    case 'memory_search': return 'Searching memory'
    case 'tts': return 'Speaking'
    case 'message': return 'Sending message'
    default: return `Using ${name}`
  }
}

function getAnimationType(toolName: string): 'typing' | 'reading' {
  if (READING_TOOLS.has(toolName)) return 'reading'
  return 'typing'
}

interface AgentStatus {
  id: string
  name: string
  emoji: string
  status: 'typing' | 'reading' | 'waiting' | 'idle'
  currentTool?: string
  currentToolName?: string
  animation?: 'typing' | 'reading'
  isSubagent?: boolean
  parentId?: string
  activeSessions?: number
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

    // Take last 200 lines then iterate FORWARD so toolResults clear their toolCalls
    const startIdx = Math.max(0, lines.length - 200)
    for (let i = startIdx; i < lines.length; i++) {
      try {
        const record = JSON.parse(lines[i])
        if (record.type === 'system' && record.subtype === 'turn_duration') {
          // Turn completed — clear everything
          activeToolIds.clear()
          toolStatuses.clear()
          isGenerating = false
          continue
        }
        const msgContent = record.message?.content ?? record.content
        const isAssistant = record.type === 'assistant' ||
          (record.type === 'message' && record.message?.role === 'assistant')

        if (isAssistant && Array.isArray(msgContent)) {
          for (const b of msgContent as Array<{
            type: string; id?: string; name?: string
            input?: Record<string, unknown>; arguments?: Record<string, unknown>
          }>) {
            if ((b.type === 'tool_use' || b.type === 'toolCall') && b.id && b.name) {
              activeToolIds.add(b.id)
              toolStatuses.set(b.id, {
                name: b.name,
                status: formatToolStatus(b.name, b.input || b.arguments || {}),
                animation: getAnimationType(b.name),
              })
              isGenerating = true
            }
          }
        }

        // Handle tool results in user content array (Anthropic format)
        const isUser = record.type === 'user' ||
          (record.type === 'message' && record.message?.role === 'user')
        if (isUser && Array.isArray(msgContent)) {
          for (const b of msgContent as Array<{ type?: string; tool_use_id?: string }>) {
            if ((b.type === 'tool_result' || b.type === 'toolResult') && b.tool_use_id) {
              activeToolIds.delete(b.tool_use_id)
              toolStatuses.delete(b.tool_use_id)
            }
          }
        }
        // Handle toolResult as separate message (OpenClaw format)
        if (record.type === 'message' && record.message?.role === 'toolResult') {
          const toolCallId = record.message.toolCallId ?? record.message.tool_use_id
          if (toolCallId) {
            activeToolIds.delete(toolCallId)
            toolStatuses.delete(toolCallId)
          }
        }
      } catch { /* skip malformed */ }
    }
    return {
      activeTools: Array.from(toolStatuses.values()),
      isGenerating: isGenerating && toolStatuses.size === 0,
    }
  } catch {
    return { activeTools: [], isGenerating: false }
  }
}

async function getAgentActivityFromDisk(agentId: string): Promise<{
  status: 'typing' | 'reading' | 'waiting' | 'idle'
  currentTool?: string
  currentToolName?: string
  animation?: 'typing' | 'reading'
  sessionCount: number
}> {
  const sessionsDir = path.join(AGENTS_DIR, agentId, 'sessions')
  try {
    const files = await fs.readdir(sessionsDir)
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'))
    if (jsonlFiles.length === 0) return { status: 'idle', sessionCount: 0 }

    const now = Date.now()
    let bestStatus: 'typing' | 'reading' | 'waiting' | 'idle' = 'idle'
    let bestTool: string | undefined
    let bestToolName: string | undefined
    let bestAnimation: 'typing' | 'reading' | undefined

    for (const file of jsonlFiles) {
      const filePath = path.join(sessionsDir, file)
      try {
        const stat = await fs.stat(filePath)
        const ageMs = now - stat.mtimeMs
        if (ageMs > 30 * 60 * 1000) continue

        if (ageMs < ACTIVE_THRESHOLD_MS) {
          const { activeTools, isGenerating } = await parseTranscriptToolState(filePath)
          if (activeTools.length > 0) {
            const last = activeTools[activeTools.length - 1]
            bestStatus = last.animation
            bestTool = last.status
            bestToolName = last.name
            bestAnimation = last.animation
            break
          } else if (isGenerating) {
            bestStatus = 'typing'
            bestTool = 'Thinking...'
            bestAnimation = 'typing'
            break
          } else {
            bestStatus = 'typing'
            bestTool = 'Thinking...'
            bestAnimation = 'typing'
            break
          }
        } else if (bestStatus === 'idle') {
          bestStatus = 'waiting'
        }
      } catch { /* skip */ }
    }
    return { status: bestStatus, currentTool: bestTool, currentToolName: bestToolName, animation: bestAnimation, sessionCount: jsonlFiles.length }
  } catch {
    return { status: 'idle', sessionCount: 0 }
  }
}

async function findActiveSpawns(agentId: string): Promise<string[]> {
  const sessionsDir = path.join(AGENTS_DIR, agentId, 'sessions')
  const spawns: string[] = []
  try {
    const files = await fs.readdir(sessionsDir)
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'))
    const now = Date.now()

    for (const file of jsonlFiles) {
      const filePath = path.join(sessionsDir, file)
      try {
        const stat = await fs.stat(filePath)
        if (now - stat.mtimeMs > 5 * 60 * 1000) continue

        const content = await fs.readFile(filePath, 'utf-8')
        const lines = content.trim().split('\n').filter(Boolean)
        const pendingSpawns = new Map<string, string>()

        for (let i = Math.max(0, lines.length - 100); i < lines.length; i++) {
          try {
            const record = JSON.parse(lines[i])
            const msgContent = record.message?.content ?? record.content
            const isAssistant = record.type === 'assistant' ||
              (record.type === 'message' && record.message?.role === 'assistant')

            if (isAssistant && Array.isArray(msgContent)) {
              for (const b of msgContent as Array<{
                type: string; id?: string; name?: string; input?: Record<string, unknown>; arguments?: Record<string, unknown>
              }>) {
                if ((b.type === 'tool_use' || b.type === 'toolCall') &&
                    b.name === 'sessions_spawn' && b.id && (b.input?.agentId || b.arguments?.agentId)) {
                  pendingSpawns.set(b.id, String(b.input?.agentId || b.arguments?.agentId))
                }
              }
            }

            const isUser = record.type === 'user' || (record.type === 'message' && record.message?.role === 'user')
            if (isUser && typeof msgContent === 'string') {
              if (msgContent.includes('completed successfully') || msgContent.includes('status: failed')) {
                const keysToDelete: string[] = []
                pendingSpawns.forEach((targetAgent, toolId) => {
                  if (msgContent.includes(targetAgent)) keysToDelete.push(toolId)
                })
                keysToDelete.forEach(k => pendingSpawns.delete(k))
              }
            }
          } catch { /* skip */ }
        }

        pendingSpawns.forEach((targetAgent) => {
          if (!spawns.includes(targetAgent)) spawns.push(targetAgent)
        })
      } catch { /* skip */ }
    }
  } catch { /* no sessions dir */ }
  return spawns
}

export async function GET() {
  try {
    let agentList: Array<{
      id?: string; name?: string
      identity?: { name?: string; emoji?: string }
    }> = []
    try {
      const configBuf = await fs.readFile(OPENCLAW_CONFIG, 'utf-8')
      const config = JSON.parse(configBuf)
      agentList = config?.agents?.list ?? []
    } catch { /* config not found */ }

    const agentInfo = new Map<string, { name: string; emoji: string }>()
    for (const a of agentList) {
      const id = a.id || 'unknown'
      agentInfo.set(id, { name: a.identity?.name || a.name || id, emoji: a.identity?.emoji || '🤖' })
    }

    const agentStatuses = new Map<string, AgentStatus>()
    for (const configAgent of agentList) {
      const aid = configAgent.id || 'unknown'
      const info = agentInfo.get(aid)!
      const activity = await getAgentActivityFromDisk(aid)
      agentStatuses.set(aid, {
        id: aid, name: info.name, emoji: info.emoji,
        status: activity.status, currentTool: activity.currentTool,
        currentToolName: activity.currentToolName, animation: activity.animation,
        activeSessions: activity.sessionCount,
      })
    }

    // Cross-reference: if agent B is active AND was spawned by agent A → mark A as chatting
    const agentIds = Array.from(agentStatuses.keys())
    for (const aid of agentIds) {
      const activeSpawns = await findActiveSpawns(aid)
      for (const targetId of activeSpawns) {
        const target = agentStatuses.get(targetId)
        if (target && (target.status === 'typing' || target.status === 'reading')) {
          const parent = agentStatuses.get(aid)!
          if (parent.status === 'idle' || parent.status === 'waiting') {
            const targetInfo = agentInfo.get(targetId)
            parent.status = 'typing'
            parent.animation = 'typing'
            parent.currentTool = `Chatting with ${targetInfo?.name || targetId} ${targetInfo?.emoji || ''}`
            target.isSubagent = true
            target.parentId = aid
          }
        }
      }
    }

    const agents = Array.from(agentStatuses.values())
    return NextResponse.json({ agents })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg, agents: [] }, { status: 502 })
  }
}
