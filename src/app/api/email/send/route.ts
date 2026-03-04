import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'

/**
 * Sends email via gog CLI (gog gmail send).
 * Requires gog to be installed and authenticated.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { to, subject, body: emailBody } = body

    if (!to || typeof to !== 'string' || !to.includes('@')) {
      return NextResponse.json({ error: 'Valid recipient email required' }, { status: 400 })
    }

    const args = [
      'gmail', 'send',
      '--to', to,
      '--subject', subject || '(no subject)',
      '--body', emailBody || '',
      '--force',
    ]

    const result = await new Promise<{ ok: boolean; stdout: string; stderr: string }>((resolve) => {
      const proc = spawn('gog', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30000,
      })

      let stdout = ''
      let stderr = ''
      proc.stdout?.on('data', (chunk) => { stdout += chunk.toString() })
      proc.stderr?.on('data', (chunk) => { stderr += chunk.toString() })

      proc.on('close', (code) => {
        resolve({
          ok: code === 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        })
      })

      proc.on('error', (err) => {
        resolve({
          ok: false,
          stdout: '',
          stderr: err.message || 'Failed to run gog',
        })
      })
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: result.stderr || result.stdout || 'Failed to send email' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, message: 'Email sent' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to send email: ${message}` }, { status: 500 })
  }
}
