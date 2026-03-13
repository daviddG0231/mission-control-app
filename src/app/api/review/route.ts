import { NextRequest, NextResponse } from 'next/server'
import { readdirSync, readFileSync, existsSync, statSync } from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const AGENTS_DIR = path.join(process.env.HOME || '/Users/david', '.openclaw/agents')
const WORKSPACE = path.join(process.env.HOME || '/Users/david', '.openclaw/workspace')
const REVIEWS_FILE = path.join(WORKSPACE, 'mission-control-app/data/reviews.json')

interface FileChange {
  id: string
  timestamp: string
  agent: string
  tool: 'edit' | 'write'
  filePath: string
  fileName: string
  diff?: string
  oldString?: string
  newString?: string
  content?: string // for write
  firstChangedLine?: number
  status: 'pending' | 'accepted' | 'rejected'
  sessionId: string
  bytesWritten?: number
}

function getReviews(): Record<string, 'accepted' | 'rejected'> {
  try {
    if (existsSync(REVIEWS_FILE)) {
      return JSON.parse(readFileSync(REVIEWS_FILE, 'utf-8'))
    }
  } catch {}
  return {}
}

function getAgentInfo(agentDir: string): { name: string; emoji: string } {
  try {
    const configPath = path.join(agentDir, 'agent')
    const files = readdirSync(configPath).filter(f => f.endsWith('.json') || f.endsWith('.yaml') || f.endsWith('.yml'))
    for (const f of files) {
      const configContent = readFileSync(path.join(configPath, f), 'utf-8')
      // Try to extract name/emoji from config
      const nameMatch = configContent.match(/"name"\s*:\s*"([^"]+)"/)
      const emojiMatch = configContent.match(/"emoji"\s*:\s*"([^"]+)"/)
      if (nameMatch) {
        return { name: nameMatch[1], emoji: emojiMatch?.[1] || '🤖' }
      }
    }
  } catch {}
  return { name: path.basename(agentDir), emoji: '🤖' }
}

export async function GET(request: NextRequest) {
  const hoursParam = request.nextUrl.searchParams.get('hours') || '24'
  const hours = parseInt(hoursParam, 10)
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
  const reviews = getReviews()

  const changes: FileChange[] = []

  try {
    if (!existsSync(AGENTS_DIR)) {
      return NextResponse.json({ changes: [], total: 0 })
    }

    const agentDirs = readdirSync(AGENTS_DIR).filter(d => {
      const sessDir = path.join(AGENTS_DIR, d, 'sessions')
      return existsSync(sessDir)
    })

    for (const agentName of agentDirs) {
      const sessDir = path.join(AGENTS_DIR, agentName, 'sessions')
      const agentInfo = getAgentInfo(path.join(AGENTS_DIR, agentName))
      
      let sessionFiles: string[]
      try {
        sessionFiles = readdirSync(sessDir)
          .filter(f => f.endsWith('.jsonl'))
          .map(f => ({ name: f, mtime: statSync(path.join(sessDir, f)).mtime }))
          .filter(f => f.mtime >= cutoff)
          .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
          .map(f => f.name)
      } catch { continue }

      for (const sessionFile of sessionFiles) {
        const sessionId = sessionFile.replace('.jsonl', '')
        const filePath = path.join(sessDir, sessionFile)
        let lines: string[]
        try {
          lines = readFileSync(filePath, 'utf-8').split('\n').filter(Boolean)
        } catch { continue }

        // Collect toolCall blocks (edit/write) and their results
        const toolCalls: Map<string, { tool: string; input: Record<string, string>; msgId: string; timestamp: string }> = new Map()
        const toolResults: Map<string, { diff?: string; text?: string; firstChangedLine?: number; isError?: boolean }> = new Map()

        for (const line of lines) {
          try {
            const data = JSON.parse(line)
            const msg = data.message
            if (!msg) continue
            const ts = data.timestamp || msg.timestamp

            // Assistant toolCall blocks
            if (msg.role === 'assistant' && Array.isArray(msg.content)) {
              for (const block of msg.content) {
                if (block.type === 'toolCall' && block.name && ['edit', 'write'].includes(block.name)) {
                  const toolCallId = block.toolCallId || block.id || `${data.id}-${block.name}`
                  toolCalls.set(toolCallId, {
                    tool: block.name,
                    input: block.input || {},
                    msgId: data.id,
                    timestamp: ts,
                  })
                }
              }
            }

            // toolResult with diff details
            if (msg.role === 'toolResult' && msg.toolName && ['edit', 'write'].includes(msg.toolName)) {
              const tcId = msg.toolCallId || ''
              const details = msg.details || {}
              const text = Array.isArray(msg.content) ? msg.content.map((c: { text?: string }) => c.text || '').join('') : ''
              toolResults.set(tcId, {
                diff: details.diff,
                firstChangedLine: details.firstChangedLine,
                text,
                isError: msg.isError,
              })
            }
          } catch {}
        }

        // Match toolCalls with results
        for (const [tcId, call] of Array.from(toolCalls.entries())) {
          const result = toolResults.get(tcId)
          if (result?.isError) continue // skip failed edits

          const changeTs = new Date(call.timestamp)
          if (changeTs < cutoff) continue

          const fp = call.input.file_path || call.input.path || ''
          if (!fp || !fp.startsWith(WORKSPACE)) continue // only workspace files

          const changeId = `${sessionId}-${tcId}-${call.msgId}`.replace(/[^a-zA-Z0-9-]/g, '')
          const reviewStatus = reviews[changeId]

          const change: FileChange = {
            id: changeId,
            timestamp: call.timestamp,
            agent: `${agentInfo.emoji} ${agentInfo.name}`,
            tool: call.tool as 'edit' | 'write',
            filePath: fp,
            fileName: path.basename(fp),
            diff: result?.diff,
            firstChangedLine: result?.firstChangedLine,
            status: reviewStatus || 'pending',
            sessionId,
          }

          if (call.tool === 'edit') {
            change.oldString = call.input.old_string || call.input.oldText
            change.newString = call.input.new_string || call.input.newText
          } else if (call.tool === 'write') {
            change.content = call.input.content
            const bytesMatch = result?.text?.match(/wrote (\d+) bytes/)
            if (bytesMatch) change.bytesWritten = parseInt(bytesMatch[1], 10)
          }

          changes.push(change)
        }
      }
    }

    // Sort newest first
    changes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    const pending = changes.filter(c => c.status === 'pending').length
    const accepted = changes.filter(c => c.status === 'accepted').length
    const rejected = changes.filter(c => c.status === 'rejected').length

    return NextResponse.json({
      changes: changes.slice(0, 200),
      total: changes.length,
      pending,
      accepted,
      rejected,
    })
  } catch (error) {
    console.error('Review API error:', error)
    return NextResponse.json({ changes: [], total: 0, error: String(error) })
  }
}
