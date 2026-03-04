import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const SESSIONS_DIR = path.join(process.env.HOME || '/Users/david', '.openclaw/agents/builder/sessions')
const LOG_FILE = path.join(process.cwd(), 'data', 'activity-log.json')

interface Activity {
  id: string
  summary: string
  user: string
  model: string
  timestamp: number
}

interface TranscriptEntry {
  type?: string
  timestamp?: string
  message?: {
    role?: string
    content?: string | { type?: string; text?: string }[]
  }
  role?: string
  content?: string | { type?: string; text?: string }[]
}

async function readLog(): Promise<Activity[]> {
  try {
    const content = await fs.readFile(LOG_FILE, 'utf-8')
    return JSON.parse(content)
  } catch {
    return []
  }
}

async function writeLog(activities: Activity[]) {
  await fs.writeFile(LOG_FILE, JSON.stringify(activities, null, 2))
}

function extractText(entry: TranscriptEntry): { text: string; timestamp: string } {
  const msg = entry.message || entry
  const ts = entry.timestamp || ''
  if (msg.role !== 'assistant') return { text: '', timestamp: ts }
  const content = msg.content
  if (typeof content === 'string' && content.length > 30) return { text: content.slice(0, 800), timestamp: ts }
  if (Array.isArray(content)) {
    for (const part of content) {
      if (part.type === 'text' && part.text && String(part.text).length > 30) {
        return { text: String(part.text).slice(0, 800), timestamp: ts }
      }
    }
  }
  return { text: '', timestamp: ts }
}

async function summarizeText(text: string): Promise<string> {
  if (!text || text.length < 30) return ''
  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemma3:1b',
        prompt: `Summarize in exactly ONE short sentence (max 15 words). No quotes, no preamble, no bullet points:\n\n${text.slice(0, 600)}`,
        stream: false,
        options: { temperature: 0.1, num_predict: 40 }
      }),
      signal: AbortSignal.timeout(15000)
    })
    if (!res.ok) return ''
    const data = await res.json()
    return (data.response || '').trim().replace(/^["']|["']$/g, '').split('\n')[0]
  } catch {
    return ''
  }
}

// GET: return persisted log
export async function GET() {
  const log = await readLog()
  return NextResponse.json({ activities: log })
}

// POST: scan for new messages and append
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    
    // Handle clear action
    if (body.action === 'clear') {
      const cutoff = body.cutoff as number || 0
      if (cutoff === 0) {
        await writeLog([])
        return NextResponse.json({ cleared: true, remaining: 0 })
      }
      const log = await readLog()
      const filtered = log.filter(a => a.timestamp < cutoff)
      await writeLog(filtered)
      return NextResponse.json({ cleared: true, remaining: filtered.length })
    }

    // Scan for new messages
    const gwUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:18789'
    const token = process.env.GATEWAY_TOKEN || ''

    const res = await fetch(`${gwUrl}/tools/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ tool: 'sessions_list', input: { messageLimit: 0 } })
    })

    if (!res.ok) return NextResponse.json({ error: 'Gateway error' }, { status: 502 })
    const raw = await res.json()
    const sessions = raw?.result?.details?.sessions || []
    const mainSession = sessions.find((s: { key?: string }) => s.key?.includes('builder:main'))
    if (!mainSession?.sessionId) return NextResponse.json({ activities: await readLog() })

    const filePath = path.join(SESSIONS_DIR, `${mainSession.sessionId}.jsonl`)
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.trim().split('\n')

    const existingLog = await readLog()
    const existingIds = new Set(existingLog.map(a => a.id))

    // Get last 15 assistant messages
    const newMessages: { text: string; timestamp: string; lineIdx: number }[] = []
    for (let i = lines.length - 1; i >= 0 && newMessages.length < 15; i--) {
      try {
        const entry: TranscriptEntry = JSON.parse(lines[i])
        const { text, timestamp } = extractText(entry)
        if (text) {
          newMessages.push({ text, timestamp, lineIdx: i })
        }
      } catch { /* skip */ }
    }

    // Filter out already logged ones (by creating a stable ID from line index)
    const toAdd: { text: string; timestamp: string; id: string }[] = []
    for (const msg of newMessages.reverse()) {
      const id = `main-${msg.lineIdx}`
      if (!existingIds.has(id)) {
        toAdd.push({ ...msg, id })
      }
    }

    // Summarize new ones
    const newActivities: Activity[] = []
    for (const msg of toAdd) {
      const summary = await summarizeText(msg.text)
      if (summary) {
        const ts = new Date(msg.timestamp).getTime()
        newActivities.push({
          id: msg.id,
          summary,
          user: 'Patrick 🪼',
          model: (mainSession.model || '').split('/').pop() || '',
          timestamp: isNaN(ts) ? Date.now() : ts,
        })
      }
    }

    // Append and save
    const updatedLog = [...existingLog, ...newActivities]
    await writeLog(updatedLog)

    return NextResponse.json({ activities: updatedLog, added: newActivities.length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
