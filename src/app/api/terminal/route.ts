import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Dangerous commands that should be blocked
const BLOCKED_COMMANDS = ['rm -rf /', 'mkfs', 'dd if=', ':(){', 'fork bomb']

export async function POST(request: NextRequest) {
  try {
    const { command, cwd } = await request.json()

    if (!command || typeof command !== 'string') {
      return NextResponse.json({ error: 'No command provided' }, { status: 400 })
    }

    // Safety check
    const lowerCmd = command.toLowerCase()
    for (const blocked of BLOCKED_COMMANDS) {
      if (lowerCmd.includes(blocked)) {
        return NextResponse.json({ 
          error: `Blocked: dangerous command detected`,
          stdout: '',
          stderr: `⛔ Command blocked for safety: "${command}"`,
          exitCode: 1
        })
      }
    }

    const { stdout, stderr } = await execAsync(command, {
      timeout: 30000,
      maxBuffer: 1024 * 1024, // 1MB
      cwd: cwd || process.env.HOME || '/Users/david',
      env: { ...process.env, TERM: 'xterm-256color' },
      shell: '/bin/zsh'
    })

    return NextResponse.json({
      stdout: stdout || '',
      stderr: stderr || '',
      exitCode: 0,
      cwd: cwd || process.env.HOME
    })
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; code?: number; killed?: boolean }
    
    if (execError.killed) {
      return NextResponse.json({
        stdout: execError.stdout || '',
        stderr: 'Command timed out (30s limit)',
        exitCode: 124,
      })
    }

    return NextResponse.json({
      stdout: execError.stdout || '',
      stderr: execError.stderr || String(error),
      exitCode: execError.code || 1,
    })
  }
}
