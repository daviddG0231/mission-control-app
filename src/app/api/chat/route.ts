/**
 * Chat API — Create sessions, send messages, get history for agent chats.
 * 
 * GET: List active chat sessions or get history for one
 * POST: Send a message to an agent (creates session if needed)
 */
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import { AGENTS_DIR, OPENCLAW_CONFIG } from '@/lib/paths'

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
}

async function getSessionHistory(agentId: string, limit = 50): Promise<ChatMessage[]> {
  const sessionsDir = path.join(AGENTS_DIR, agentId, 'sessions')
  const messages: ChatMessage[] = []
  
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
    
    if (!latestFile) return []
    
    const content = await fs.readFile(path.join(sessionsDir, latestFile), 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)
    
    // Parse last N messages
    const startIdx = Math.max(0, lines.length - limit * 2)
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
          if (text && !text.includes('[Internal task completion') && !text.includes('OpenClaw runtime context')) {
            messages.push({ role: 'user', content: text.slice(0, 2000), timestamp: record.timestamp || latestMtime })
          }
        }
        
        if (role === 'assistant' || (record.type === 'message' && msg.role === 'assistant')) {
          const text = typeof msgContent === 'string'
            ? msgContent
            : Array.isArray(msgContent)
              ? msgContent.filter((b: Record<string, string>) => b.type === 'text').map((b: Record<string, string>) => b.text).join('\n')
              : ''
          if (text) {
            messages.push({ role: 'assistant', content: text.slice(0, 2000), timestamp: record.timestamp || latestMtime })
          }
        }
      } catch { /* skip malformed */ }
    }
  } catch { /* no sessions */ }
  
  return messages.slice(-limit)
}

export async function GET(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get('agentId')
  
  if (agentId) {
    // Get chat history for specific agent
    const history = await getSessionHistory(agentId)
    return NextResponse.json({ messages: history })
  }
  
  // List all agents available for chat
  const agents = await getAgentList()
  return NextResponse.json({ agents })
}

export async function POST(request: NextRequest) {
  try {
    const { agentId, message } = await request.json()
    
    if (!agentId || !message) {
      return NextResponse.json({ error: 'agentId and message required' }, { status: 400 })
    }
    
    const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:18789'
    const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || ''
    
    // Send message to the agent's session via gateway
    const res = await fetch(`${GATEWAY_URL}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GATEWAY_TOKEN}`,
      },
      body: JSON.stringify({
        tool: 'sessions_send',
        args: {
          sessionKey: `agent:${agentId}:main`,
          message: message.trim(),
        },
      }),
      cache: 'no-store',
    })
    
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `Gateway: ${text}` }, { status: 502 })
    }
    
    const result = await res.json()
    return NextResponse.json({ ok: true, result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
