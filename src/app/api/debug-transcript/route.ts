import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const HOME = process.env.HOME || process.env.USERPROFILE || '/root'
const SESSIONS_DIRS = [
  path.join(HOME, '.openclaw/agents/builder/sessions'),
  path.join(HOME, '.openclaw/agents/main/sessions'),
]

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
    const sessionId = '514036b8-112d-458f-a3b9-8f7d6e0cf3cc'
    const jsonlPath = await findJsonlForSession(sessionId)
    
    if (!jsonlPath) {
      return NextResponse.json({ error: 'Transcript not found', sessionId, searchPaths: SESSIONS_DIRS })
    }

    const content = await fs.readFile(jsonlPath, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)
    const activeToolIds = new Set<string>()
    const toolStatuses = new Map<string, { name: string; status: string }>()

    // Parse last 10 lines
    const recentLines = lines.slice(-10)
    for (const line of recentLines) {
      try {
        const record = JSON.parse(line)
        
        // Look for tool calls
        if (record.type === 'message' && Array.isArray(record.message?.content)) {
          for (const block of record.message.content) {
            if ((block.type === 'tool_use' || block.type === 'toolCall') && block.id && block.name) {
              if (!activeToolIds.has(block.id)) {
                activeToolIds.add(block.id)
                toolStatuses.set(block.id, { name: block.name, status: `Running ${block.name}` })
              }
            }
          }
        }

        // Look for tool results
        if (record.type === 'message' && record.message?.role === 'toolResult') {
          const toolCallId = record.message.toolCallId
          if (toolCallId) {
            activeToolIds.delete(toolCallId)
            toolStatuses.delete(toolCallId)
          }
        }
      } catch {
        // Skip malformed
      }
    }

    return NextResponse.json({
      sessionId,
      transcriptPath: jsonlPath,
      totalLines: lines.length,
      activeToolCount: activeToolIds.size,
      activeTools: Array.from(toolStatuses.values()),
      lastLineType: lines.length > 0 ? JSON.parse(lines[lines.length - 1]).type : null
    })

  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}