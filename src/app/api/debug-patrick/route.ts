import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const SESSIONS_DIRS = [
  path.join(process.env.HOME || process.env.HOME || '/root', '.openclaw/agents/builder/sessions'),
  path.join(process.env.HOME || process.env.HOME || '/root', '.openclaw/agents/main/sessions'),
]

const TYPING_TOOLS = new Set(['Write', 'Edit', 'exec', 'Bash', 'browser', 'sessions_spawn', 'message', 'tts'])
// const READING_TOOLS = new Set(['Read', 'Grep', 'Glob', 'web_fetch', 'web_search', 'memory_search'])

function formatToolStatus(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case 'exec': return `Running: ${String(input.command || '').slice(0, 40)}…`
    case 'browser': return 'Using browser'
    case 'web_search': return 'Searching web'
    default: return `Using ${name}`
  }
}

function getAnimationType(toolName: string): 'typing' | 'reading' {
  return TYPING_TOOLS.has(toolName) ? 'typing' : 'reading'
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

async function parseTranscriptToolState(jsonlPath: string): Promise<{
  activeTools: Array<{ name: string; status: string; animation: 'typing' | 'reading' }>
  isWaiting: boolean
  debug: unknown[]
}> {
  try {
    const content = await fs.readFile(jsonlPath, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)
    const activeToolIds = new Set<string>()
    const toolStatuses = new Map<string, { name: string; status: string; animation: 'typing' | 'reading' }>()
    let isWaiting = false
    const debug: unknown[] = []

    for (let i = lines.length - 1; i >= 0 && i >= lines.length - 50; i--) {
      try {
        const record = JSON.parse(lines[i])
        
        if (record.type === 'system' && record.subtype === 'turn_duration') {
          isWaiting = true
          debug.push({ line: i, type: 'turn_duration', waiting: true })
          break
        }
        
        if (record.type === 'message' && Array.isArray(record.message?.content)) {
          const blocks = record.message.content as Array<{
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
                debug.push({ line: i, type: 'tool_start', toolId: b.id, toolName: b.name })
              }
            }
          }
        }
        
        // Handle new format tool results
        if (record.type === 'message' && record.message?.role === 'toolResult') {
          const toolCallId = record.message.toolCallId
          if (toolCallId) {
            activeToolIds.delete(toolCallId)
            toolStatuses.delete(toolCallId)
            debug.push({ line: i, type: 'tool_result', toolId: toolCallId })
          }
        }
      } catch (e) {
        debug.push({ line: i, type: 'parse_error', error: String(e) })
      }
    }

    const activeTools = Array.from(toolStatuses.values())
    return { activeTools, isWaiting: isWaiting && activeTools.length === 0, debug }
  } catch (e) {
    return { activeTools: [], isWaiting: false, debug: [{ type: 'file_error', error: String(e) }] }
  }
}

export async function GET() {
  try {
    const sessionId = '514036b8-112d-458f-a3b9-8f7d6e0cf3cc'
    const jsonlPath = await findJsonlForSession(sessionId)
    
    if (!jsonlPath) {
      return NextResponse.json({ error: 'No transcript found', sessionId })
    }

    const result = await parseTranscriptToolState(jsonlPath)
    
    return NextResponse.json({
      sessionId,
      transcriptPath: jsonlPath,
      ...result
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}