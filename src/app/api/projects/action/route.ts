import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs'

const execAsync = promisify(exec)
import { WORKSPACE_PATH } from '@/lib/paths'

// Tracking directory for running dev servers
const TRACKING_DIR = path.join(WORKSPACE_PATH, '.mc-running')
function ensureTrackingDir() {
  if (!existsSync(TRACKING_DIR)) mkdirSync(TRACKING_DIR, { recursive: true })
}

function isPathSafe(requestedPath: string): boolean {
  const resolved = path.resolve(requestedPath)
  return resolved.startsWith(WORKSPACE_PATH) && resolved.length >= WORKSPACE_PATH.length
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectPath, action } = body

    if (!projectPath || typeof projectPath !== 'string') {
      return NextResponse.json({ error: 'Missing projectPath' }, { status: 400 })
    }
    if (!isPathSafe(projectPath)) {
      return NextResponse.json({ error: 'Path outside workspace' }, { status: 403 })
    }
    if (!existsSync(projectPath)) {
      return NextResponse.json({ error: 'Path does not exist' }, { status: 404 })
    }

    switch (action) {
      case 'open-finder': {
        await execAsync(`open "${projectPath}"`)
        return NextResponse.json({ success: true, message: 'Opened in Finder' })
      }
      case 'open-cursor': {
        // Use macOS open to open folder as workspace (cursor CLI can open file instead of folder)
        const escaped = projectPath.replace(/"/g, '\\"')
        try {
          await execAsync(`open -a "Cursor" "${escaped}"`)
        } catch {
          await execAsync(`open -a "Visual Studio Code" "${escaped}"`)
        }
        return NextResponse.json({ success: true, message: 'Opened in Cursor' })
      }
      case 'open-terminal': {
        await execAsync(
          `osascript -e 'tell application "Terminal" to do script "cd \\"${projectPath.replace(/"/g, '\\"')}\\""'`
        )
        return NextResponse.json({ success: true, message: 'Opened Terminal' })
      }
      case 'stop': {
        const { pid } = body
        if (!pid || typeof pid !== 'number') {
          return NextResponse.json({ error: 'Missing pid' }, { status: 400 })
        }
        try {
          // Kill the process tree (parent + all children)
          await execAsync(`pkill -TERM -P ${pid} 2>/dev/null; kill -TERM ${pid} 2>/dev/null; sleep 0.5; pkill -9 -P ${pid} 2>/dev/null; kill -9 ${pid} 2>/dev/null || true`)
        } catch { /* process may already be dead */ }
        // Clean up tracking file
        try {
          ensureTrackingDir()
          const projectName = path.basename(projectPath)
          const trackFile = path.join(TRACKING_DIR, `${projectName}.json`)
          if (existsSync(trackFile)) unlinkSync(trackFile)
        } catch { /* ignore */ }
        // Clean up log file
        try {
          const logFile = path.join(projectPath, '.dev-server.log')
          if (existsSync(logFile)) unlinkSync(logFile)
        } catch { /* ignore */ }
        return NextResponse.json({ success: true, message: 'Process stopped' })
      }
      case 'run-dev': {
        const hasPnpm = existsSync(path.join(projectPath, 'pnpm-lock.yaml'))
        const hasNpm = existsSync(path.join(projectPath, 'package.json'))
        const hasPython = existsSync(path.join(projectPath, 'pyproject.toml')) ||
          existsSync(path.join(projectPath, 'main.py')) ||
          existsSync(path.join(projectPath, 'app.py'))

        // Detect framework to use correct host flag for LAN access
        let runCmd: string
        const pkgPath = path.join(projectPath, 'package.json')
        let pkgJson: Record<string, Record<string, string>> = {}
        try { pkgJson = JSON.parse(readFileSync(pkgPath, 'utf-8')) } catch {}
        const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies }

        if (hasPnpm) {
          runCmd = deps?.vite ? 'pnpm exec vite --host' : 'pnpm run dev'
        } else if (hasNpm) {
          if (deps?.vite && !deps?.next) {
            runCmd = 'npx vite --host'  // Vite: run directly, expose on LAN
          } else if (deps?.next) {
            runCmd = 'npx next dev --hostname 0.0.0.0'  // Next.js: expose on LAN
          } else if (deps?.expo) {
            runCmd = 'npx expo start --lan'  // Expo: LAN mode
          } else {
            runCmd = 'npm run dev'
          }
        } else if (hasPython) {
          runCmd = 'python -m uvicorn main:app --reload --host 0.0.0.0 2>/dev/null || python main.py 2>/dev/null || python app.py'
        } else {
          return NextResponse.json({ error: 'No runnable project detected (no package.json or Python main)' }, { status: 400 })
        }

        // Detect expected port so we can kill anything blocking it
        const expectedPort = (() => {
          try {
            const pkg = JSON.parse(readFileSync(path.join(projectPath, 'package.json'), 'utf-8'))
            const scripts = pkg.scripts || {}
            const devScript = scripts.dev || ''
            const portMatch = devScript.match(/--port\s+(\d+)|PORT=(\d+)/)
            if (portMatch) return parseInt(portMatch[1] || portMatch[2], 10)
            const d = { ...pkg.dependencies, ...pkg.devDependencies }
            if (d?.expo) return 8081
            if (d?.next) return 3000
            if (d?.vite) return 5173
          } catch {}
          return 0
        })()

        // Kill anything already on that port to avoid interactive "use another port?" prompts
        if (expectedPort > 0) {
          try {
            await execAsync(
              `/usr/sbin/lsof -ti TCP:${expectedPort} -sTCP:LISTEN | xargs kill -9 2>/dev/null || true`,
              { timeout: 5000 }
            )
            // Small delay to let the port free up
            await new Promise(r => setTimeout(r, 500))
          } catch { /* nothing on that port, all good */ }
        }

        // Run directly in background (no Terminal.app needed — works headless/remote)
        const shellPath = `/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`
        const logFile = path.join(projectPath, '.dev-server.log')
        // Write empty log file first so polling starts immediately
        writeFileSync(logFile, '')
        const bgCmd = `cd "${projectPath}" && PATH="${shellPath}" nohup ${runCmd} > "${logFile}" 2>&1 & echo $!`
        const { stdout: pidOut } = await execAsync(bgCmd, { shell: '/bin/zsh', timeout: 10000 })
        const pid = parseInt(pidOut.trim().split('\n').pop() || '0', 10)

        // Write tracking file so running detection is instant and reliable
        if (pid > 0) {
          ensureTrackingDir()
          const projectName = path.basename(projectPath)
          const port = expectedPort
          writeFileSync(
            path.join(TRACKING_DIR, `${projectName}.json`),
            JSON.stringify({ pid, port, projectPath, projectName, startedAt: new Date().toISOString() })
          )
        }

        return NextResponse.json({ success: true, message: `Started dev server`, pid, logFile })
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
