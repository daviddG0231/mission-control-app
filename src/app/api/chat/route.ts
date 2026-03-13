/**
 * Chat API — Spawn agent sessions and send messages.
 * 
 * GET ?agentId=X — get chat history for agent
 * GET (no params) — list available agents
 * POST { agentId, message } — spawn a one-shot task for the agent
 * POST { sessionKey, message } — send follow-up to existing session
 */
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import { AGENTS_DIR, OPENCLAW_CONFIG } from '@/lib/paths'

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:18789'
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || ''

interface AgentInfo {
  id: string
  name: string
  emoji: string
  role?: string
}

async function getAgentList(): Promise<AgentInfo[]> {
  try {
    const buf = await fs.readFile(OPENCLAW_CONFIG, 'utf-8')
    const config = JSON.parse(buf)
    const list = config?.agents?.list ?? []
    return list.map((a: Record<string, unknown>) => ({
      id: (a.id as string) || 'unknown',
      name: (a.identity as Record<string, string>)?.name || (a.name as string) || (a.id as string) || 'unknown',
      emoji: (a.identity as Record<string, string>)?.emoji || '🤖',
      role: (a.identity as Record<string, string>)?.role || '',
    }))
  } catch {
    return []
  }
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  hasToolCalls?: boolean
}

async function getSessionHistory(agentId: string, limit = 50): Promise<{ messages: ChatMessage[], isGenerating: boolean }> {
  const sessionsDir = path.join(AGENTS_DIR, agentId, 'sessions')
  const messages: ChatMessage[] = []
  let isGenerating = false
  
  try {
    const files = await fs.readdir(sessionsDir)
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl') && !f.includes('.deleted') && !f.includes('.reset'))
    
    // Get the most recent session file
    let latestFile = ''
    let latestMtime = 0
    for (const f of jsonlFiles) {
      const stat = await fs.stat(path.join(sessionsDir, f))
      if (stat.mtimeMs > latestMtime) {
        latestMtime = stat.mtimeMs
        latestFile = f
      }
    }
    
    if (!latestFile) return { messages: [], isGenerating: false }
    
    // Check if agent is currently generating (file modified < 30s ago)
    const stat = await fs.stat(path.join(sessionsDir, latestFile))
    const ageMs = Date.now() - stat.mtimeMs
    if (ageMs < 30000) {
      isGenerating = true
    }
    
    const content = await fs.readFile(path.join(sessionsDir, latestFile), 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)
    
    const startIdx = Math.max(0, lines.length - limit * 3)
    for (let i = startIdx; i < lines.length; i++) {
      try {
        const record = JSON.parse(lines[i])
        const msg = record.message || record
        const role = msg.role || record.type
        const msgContent = msg.content ?? record.content
        
        if (role === 'user' || (record.type === 'message' && msg.role === 'user')) {
          const text = typeof msgContent === 'string' 
            ? msgContent 
            : Array.isArray(msgContent) 
              ? msgContent.filter((b: Record<string, string>) => b.type === 'text').map((b: Record<string, string>) => b.text).join('\n')
              : ''
          if (text && !text.includes('[Internal task completion') && !text.includes('OpenClaw runtime context') && !text.includes('heartbeat')) {
            messages.push({ role: 'user', content: text.slice(0, 2000), timestamp: record.timestamp || latestMtime })
          }
        }
        
        if (role === 'assistant' || (record.type === 'message' && msg.role === 'assistant')) {
          const text = typeof msgContent === 'string'
            ? msgContent
            : Array.isArray(msgContent)
              ? msgContent.filter((b: Record<string, string>) => b.type === 'text').map((b: Record<string, string>) => b.text).join('\n')
              : ''
          if (text && text !== 'NO_REPLY' && text !== 'HEARTBEAT_OK') {
            messages.push({ role: 'assistant', content: text.slice(0, 2000), timestamp: record.timestamp || latestMtime })
          }
        }
      } catch { /* skip malformed */ }
    }
  } catch { /* no sessions */ }
  
  return { messages: messages.slice(-limit), isGenerating }
}

async function gatewayInvoke(tool: string, args: Record<string, unknown>, sessionKey?: string) {
  const res = await fetch(`${GATEWAY_URL}/tools/invoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GATEWAY_TOKEN}`,
    },
    body: JSON.stringify({
      tool,
      args,
      sessionKey: sessionKey || 'main',
    }),
    cache: 'no-store',
  })
  
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gateway ${res.status}: ${text}`)
  }
  
  const raw = await res.json()
  if (raw?.result?.details) return raw.result.details
  if (raw?.result?.content?.[0]?.text) {
    try { return JSON.parse(raw.result.content[0].text) } catch { return { text: raw.result.content[0].text } }
  }
  return raw
}

export async function GET(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get('agentId')
  
  if (agentId) {
    const { messages, isGenerating } = await getSessionHistory(agentId)
    return NextResponse.json({ messages, isGenerating })
  }
  
  const agents = await getAgentList()
  return NextResponse.json({ agents })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agentId, message } = body
    
    if (!agentId || !message) {
      return NextResponse.json({ error: 'agentId and message required' }, { status: 400 })
    }
    
    // Look up agent identity for the system context
    const agents = await getAgentList()
    const agent = agents.find(a => a.id === agentId)
    const identityLine = agent 
      ? `You are ${agent.name} ${agent.emoji}${agent.role ? ` (${agent.role})` : ''}. Stay in character. Respond to David's message:\n\n`
      : ''
    
    // Spawn a one-shot task for the agent
    const result = await gatewayInvoke('sessions_spawn', {
      task: `${identityLine}${message.trim()}`,
      runtime: 'subagent',
      mode: 'run',
      agentId,
      runTimeoutSeconds: 120,
    }, 'agent:builder:main')
    
    if (result?.error || result?.status === 'forbidden') {
      return NextResponse.json({ error: result?.error?.message || result?.error || 'Spawn failed' }, { status: 400 })
    }
    
    return NextResponse.json({ 
      ok: true, 
      sessionKey: result?.childSessionKey || null,
      runId: result?.runId || null,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
