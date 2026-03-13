import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { readdirSync, readFileSync, existsSync, unlinkSync } from 'fs'
import path from 'path'
import { WORKSPACE_PATH } from '@/lib/paths'

const execAsync = promisify(exec)

const TRACKING_DIR = path.join(WORKSPACE_PATH, '.mc-running')

export const dynamic = 'force-dynamic'

export interface RunningProject {
  pid: number
  port: number
  cwd: string
  command: string
  projectName: string
}

async function isProcessAlive(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0) // signal 0 = check existence
    return true
  } catch {
    return false
  }
}

export async function GET() {
  try {
    const running: RunningProject[] = []
    const seenPorts = new Set<number>()

    // 1. Check tracking files (reliable, written by run-dev)
    if (existsSync(TRACKING_DIR)) {
      const files = readdirSync(TRACKING_DIR).filter(f => f.endsWith('.json'))
      for (const file of files) {
        try {
          const data = JSON.parse(readFileSync(path.join(TRACKING_DIR, file), 'utf-8'))
          const alive = await isProcessAlive(data.pid)
          if (!alive) {
            // Process died — clean up tracking file and log
            try { unlinkSync(path.join(TRACKING_DIR, file)) } catch {}
            try {
              const logFile = path.join(data.projectPath, '.dev-server.log')
              if (existsSync(logFile)) unlinkSync(logFile)
            } catch {}
            continue
          }

          // Detect actual port: read from the dev server log first (most reliable),
          // then fall back to expected port from tracking file
          let actualPort = data.port || 0
          try {
            const logFile = path.join(data.projectPath, '.dev-server.log')
            if (existsSync(logFile)) {
              const logContent = readFileSync(logFile, 'utf-8')
              // Match common dev server port patterns
              const portPatterns = [
                /localhost:(\d+)/,           // Expo, Vite, Next.js
                /Network:.*:(\d+)/,          // Vite network URL
                /on port (\d+)/i,            // generic
                /http:\/\/[\d.]+:(\d+)/,     // any IP:port
              ]
              for (const pattern of portPatterns) {
                const match = logContent.match(pattern)
                if (match) {
                  actualPort = parseInt(match[1], 10)
                  break
                }
              }
            }
          } catch {}

          if (actualPort > 0 && !seenPorts.has(actualPort)) {
            seenPorts.add(actualPort)
            running.push({
              pid: data.pid,
              port: actualPort,
              cwd: data.projectPath || '',
              command: '',
              projectName: data.projectName || path.basename(data.projectPath || ''),
            })
          }
        } catch { /* corrupt tracking file */ }
      }
    }

    // 2. Fallback: lsof scan for dev servers we didn't start (or tracking lost)
    try {
      const { stdout } = await execAsync(
        `/usr/sbin/lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | grep -E "node|python" || true`,
        { timeout: 5000 }
      )

      for (const line of stdout.trim().split('\n').filter(Boolean)) {
        const parts = line.split(/\s+/)
        if (parts.length < 9) continue

        const pid = parseInt(parts[1], 10)
        const nameField = parts[8]
        const portMatch = nameField.match(/:(\d+)$/)
        if (!portMatch) continue

        const port = parseInt(portMatch[1], 10)
        if (seenPorts.has(port)) continue

        // Skip gateway, mission-control, and system processes
        let command = ''
        try {
          const { stdout: cmdOut } = await execAsync(`ps -p ${pid} -o args= 2>/dev/null`, { timeout: 2000 })
          command = cmdOut.trim()
        } catch {}

        if (command.includes('openclaw-gateway') || command.includes('mission-control-app') || command.includes('autoapply')) continue

        // Try to extract workspace project path from command args
        let cwd = ''
        let projectName = ''
        const wsMatch = command.match(/\/workspace\/([^/\s]+)/)
        if (wsMatch) {
          projectName = wsMatch[1]
          cwd = path.join(WORKSPACE_PATH, projectName)
        }

        // Fallback: lsof cwd
        if (!projectName) {
          try {
            const { stdout: cwdOut } = await execAsync(
              `/usr/sbin/lsof -p ${pid} -d cwd -Fn 2>/dev/null | grep "^n/" | head -1`,
              { timeout: 2000 }
            )
            const resolved = cwdOut.replace(/^n/, '').trim()
            if (resolved && resolved.startsWith(WORKSPACE_PATH)) {
              cwd = resolved
              projectName = path.basename(resolved)
            }
          } catch {}
        }

        if (projectName) {
          seenPorts.add(port)
          running.push({ pid, port, cwd, command, projectName })
        }
      }
    } catch {}

    return NextResponse.json({ running })
  } catch (error) {
    console.error('Error checking running projects:', error)
    return NextResponse.json({ running: [] })
  }
}
