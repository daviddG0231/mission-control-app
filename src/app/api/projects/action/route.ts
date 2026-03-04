import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { existsSync } from 'fs'

const execAsync = promisify(exec)
const WORKSPACE_PATH = '/Users/david/.openclaw/workspace'

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
      case 'run-dev': {
        const hasPnpm = existsSync(path.join(projectPath, 'pnpm-lock.yaml'))
        const hasNpm = existsSync(path.join(projectPath, 'package.json'))
        const hasPython = existsSync(path.join(projectPath, 'pyproject.toml')) ||
          existsSync(path.join(projectPath, 'main.py')) ||
          existsSync(path.join(projectPath, 'app.py'))
        const escaped = projectPath.replace(/"/g, '\\"')
        let cmd: string
        if (hasPnpm) {
          cmd = `osascript -e 'tell application "Terminal" to do script "cd \\"${escaped}\\" && pnpm run dev"'`
        } else if (hasNpm) {
          cmd = `osascript -e 'tell application "Terminal" to do script "cd \\"${escaped}\\" && npm run dev"'`
        } else if (hasPython) {
          cmd = `osascript -e 'tell application "Terminal" to do script "cd \\"${escaped}\\" && python -m uvicorn main:app --reload 2>/dev/null || python main.py 2>/dev/null || python app.py"'`
        } else {
          return NextResponse.json({ error: 'No runnable project detected (no package.json or Python main)' }, { status: 400 })
        }
        await execAsync(cmd)
        return NextResponse.json({ success: true, message: 'Started dev server in Terminal' })
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
