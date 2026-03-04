import { NextResponse } from 'next/server'
import { spawn } from 'child_process'

/**
 * Lists GitHub repos via gh CLI.
 * Requires: gh auth login (or GITHUB_TOKEN)
 */
export async function GET() {
  try {
    const result = await new Promise<{ ok: boolean; stdout: string; stderr: string }>((resolve) => {
      const proc = spawn(
        'gh',
        ['repo', 'list', '--limit', '100', '--json', 'name,url,visibility,updatedAt,isPrivate'],
        { stdio: ['ignore', 'pipe', 'pipe'], timeout: 15000 }
      )
      let stdout = ''
      let stderr = ''
      proc.stdout?.on('data', (chunk) => { stdout += chunk.toString() })
      proc.stderr?.on('data', (chunk) => { stderr += chunk.toString() })
      proc.on('close', (code) => resolve({ ok: code === 0, stdout: stdout.trim(), stderr: stderr.trim() }))
      proc.on('error', (err) => resolve({ ok: false, stdout: '', stderr: err.message }))
    })

    if (!result.ok) {
      const msg = result.stderr || result.stdout || 'gh failed'
      const needsAuth = /not logged in|authentication required|gh auth login/i.test(msg)
      return NextResponse.json(
        { success: false, repos: [], error: msg, needsAuth },
        { status: 502 }
      )
    }

    const repos = JSON.parse(result.stdout || '[]')
    return NextResponse.json({ success: true, repos })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { success: false, repos: [], error: message, needsAuth: false },
      { status: 500 }
    )
  }
}
