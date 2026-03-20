import { NextRequest, NextResponse } from 'next/server'
import { readdirSync, readFileSync, existsSync, statSync } from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const HOME = process.env.HOME || '/Users/david'
const OPENCLAW_DIR = path.join(HOME, '.openclaw')
const AGENTS_DIR = path.join(OPENCLAW_DIR, 'agents')
const CRON_DIR = path.join(OPENCLAW_DIR, 'cron/runs')
const WORKSPACE = path.join(OPENCLAW_DIR, 'workspace')
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
  content?: string
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
    // Try IDENTITY.md first (most reliable)
    const identityPath = path.join(agentDir, 'agent', 'IDENTITY.md')
    if (existsSync(identityPath)) {
      const content = readFileSync(identityPath, 'utf-8')
      const nameMatch = content.match(/\*\*Name:\*\*\s*(.+)/i)
      const emojiMatch = content.match(/\*\*Emoji:\*\*\s*(.+)/i)
      if (nameMatch) {
        return {
          name: nameMatch[1].trim(),
          emoji: emojiMatch?.[1]?.trim() || '🤖',
        }
      }
    }
    // Fallback: try SOUL.md in workspace (for main agent)
    const soulPath = path.join(agentDir, 'agent', 'SOUL.md')
    if (existsSync(soulPath)) {
      const content = readFileSync(soulPath, 'utf-8')
      const nameMatch = content.match(/I'm \*\*(\w+)\*\*\s*(.)/i)
      if (nameMatch) {
        return { name: nameMatch[1], emoji: nameMatch[2] || '🤖' }
      }
    }
    // Fallback: JSON configs
    const configPath = path.join(agentDir, 'agent')
    if (existsSync(configPath)) {
      const files = readdirSync(configPath).filter(f => f.endsWith('.json') && f !== 'auth-profiles.json' && f !== 'models.json')
      for (const f of files) {
        const configContent = readFileSync(path.join(configPath, f), 'utf-8')
        const nameMatch = configContent.match(/"name"\s*:\s*"([^"]+)"/)
        const emojiMatch = configContent.match(/"emoji"\s*:\s*"([^"]+)"/)
        if (nameMatch) {
          return { name: nameMatch[1], emoji: emojiMatch?.[1] || '🤖' }
        }
      }
    }
  } catch {}
  // Final fallback: capitalize directory name
  const dirName = path.basename(agentDir)
  return { name: dirName.charAt(0).toUpperCase() + dirName.slice(1), emoji: '🤖' }
}

/** Extract file changes from a single JSONL session file */
function extractChangesFromSession(
  filePath: string,
  sessionId: string,
  agentLabel: string,
  cutoff: Date,
  reviews: Record<string, 'accepted' | 'rejected'>
): FileChange[] {
  const changes: FileChange[] = []

  let lines: string[]
  try {
    lines = readFileSync(filePath, 'utf-8').split('\n').filter(Boolean)
  } catch {
    return []
  }

  // Two-pass: collect toolCalls then match with toolResults
  const toolCalls: Map<string, { tool: string; input: Record<string, string>; msgId: string; timestamp: string }> = new Map()
  const toolResults: Map<string, { diff?: string; text?: string; firstChangedLine?: number; isError?: boolean }> = new Map()

  for (const line of lines) {
    try {
      const data = JSON.parse(line)
      const msg = data.message
      if (!msg) continue
      const ts = data.timestamp || msg.timestamp

      // Assistant messages with toolCall blocks
      if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'toolCall' && block.name && ['edit', 'write'].includes(block.name)) {
            // Try multiple ID fields - format varies
            const toolCallId = block.toolCallId || block.id || block.call_id || `${data.id}-${block.name}-${Math.random().toString(36).slice(2, 8)}`
            toolCalls.set(toolCallId, {
              tool: block.name,
              input: block.input || block.arguments || {},
              msgId: data.id || '',
              timestamp: ts,
            })
          }
        }
      }

      // Tool results
      if (msg.role === 'toolResult' || msg.role === 'tool') {
        const toolName = msg.toolName || msg.name || ''
        if (['edit', 'write'].includes(toolName)) {
          const tcId = msg.toolCallId || msg.tool_call_id || ''
          const details = msg.details || {}
          const text = Array.isArray(msg.content)
            ? msg.content.map((c: { text?: string }) => c.text || '').join('')
            : typeof msg.content === 'string' ? msg.content : ''
          toolResults.set(tcId, {
            diff: details.diff,
            firstChangedLine: details.firstChangedLine,
            text,
            isError: msg.isError || false,
          })
        }
      }
    } catch {}
  }

  // Match toolCalls with their results
  for (const [tcId, call] of Array.from(toolCalls.entries())) {
    const result = toolResults.get(tcId)
    if (result?.isError) continue

    const changeTs = new Date(call.timestamp)
    if (isNaN(changeTs.getTime()) || changeTs < cutoff) continue

    const fp = call.input.file_path || call.input.path || ''
    if (!fp) continue

    const changeId = `${sessionId}-${tcId}-${call.msgId}`.replace(/[^a-zA-Z0-9-]/g, '')
    const reviewStatus = reviews[changeId]

    const change: FileChange = {
      id: changeId,
      timestamp: call.timestamp,
      agent: agentLabel,
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
      const contentStr = call.input.content || ''
      // Truncate large writes for display
      change.content = contentStr.length > 2000 ? contentStr.slice(0, 2000) + '\n... (truncated)' : contentStr
      change.bytesWritten = contentStr.length
      if (result?.text) {
        const bytesMatch = result.text.match(/(\d+) bytes/)
        if (bytesMatch) change.bytesWritten = parseInt(bytesMatch[1], 10)
      }
    }

    changes.push(change)
  }

  return changes
}

/** Get JSONL files from a directory, filtered by cutoff */
function getRecentJsonlFiles(dir: string, cutoff: Date): { name: string; fullPath: string }[] {
  try {
    if (!existsSync(dir)) return []
    return readdirSync(dir)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => ({ name: f, fullPath: path.join(dir, f), mtime: statSync(path.join(dir, f)).mtime }))
      .filter(f => f.mtime >= cutoff)
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
      .map(f => ({ name: f.name, fullPath: f.fullPath }))
  } catch {
    return []
  }
}

export async function GET(request: NextRequest) {
  const hoursParam = request.nextUrl.searchParams.get('hours') || '24'
  const hours = parseInt(hoursParam, 10)
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
  const reviews = getReviews()

  const allChanges: FileChange[] = []

  try {
    // 1. Scan ALL agent session directories
    if (existsSync(AGENTS_DIR)) {
      const agentDirs = readdirSync(AGENTS_DIR).filter(d => {
        try {
          return statSync(path.join(AGENTS_DIR, d)).isDirectory()
        } catch { return false }
      })

      for (const agentName of agentDirs) {
        const sessDir = path.join(AGENTS_DIR, agentName, 'sessions')
        const agentInfo = getAgentInfo(path.join(AGENTS_DIR, agentName))
        const label = `${agentInfo.emoji} ${agentInfo.name}`

        const sessionFiles = getRecentJsonlFiles(sessDir, cutoff)
        for (const sf of sessionFiles) {
          const sessionId = sf.name.replace('.jsonl', '')
          const changes = extractChangesFromSession(sf.fullPath, sessionId, label, cutoff, reviews)
          allChanges.push(...changes)
        }
      }
    }

    // 2. Scan cron run logs
    if (existsSync(CRON_DIR)) {
      const cronFiles = getRecentJsonlFiles(CRON_DIR, cutoff)
      for (const cf of cronFiles) {
        const sessionId = `cron-${cf.name.replace('.jsonl', '')}`
        const changes = extractChangesFromSession(cf.fullPath, sessionId, '⏰ Cron Job', cutoff, reviews)
        allChanges.push(...changes)
      }
    }

    // Sort newest first
    allChanges.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    const pending = allChanges.filter(c => c.status === 'pending').length
    const accepted = allChanges.filter(c => c.status === 'accepted').length
    const rejected = allChanges.filter(c => c.status === 'rejected').length

    return NextResponse.json({
      changes: allChanges.slice(0, 500),
      total: allChanges.length,
      pending,
      accepted,
      rejected,
    })
  } catch (error) {
    console.error('Review API error:', error)
    return NextResponse.json({ changes: [], total: 0, error: String(error) })
  }
}
