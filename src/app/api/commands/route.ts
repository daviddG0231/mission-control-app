import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    const { command } = await request.json()
    
    if (!command || typeof command !== 'string') {
      return NextResponse.json(
        { error: 'Invalid command' },
        { status: 400 }
      )
    }

    let shellCommand: string
    const options: { timeout?: number } = { timeout: 30000 } // 30 second timeout

    switch (command) {
      case 'restart-gateway':
        shellCommand = 'openclaw gateway restart'
        break
      
      case 'stop-gateway':
        shellCommand = 'openclaw gateway stop'
        break
      
      case 'start-gateway':
        shellCommand = 'openclaw gateway start'
        break
      
      case 'gateway-status':
        shellCommand = 'openclaw gateway status'
        break
      
      case 'clear-sessions':
        // Placeholder - implement actual session clearing logic
        return NextResponse.json({ 
          output: 'Clear sessions functionality not yet implemented' 
        })
      
      case 'update-openclaw':
        shellCommand = 'npm update -g openclaw'
        options.timeout = 120000 // 2 minute timeout for updates
        break
      
      case 'openclaw-version':
        shellCommand = 'openclaw --version'
        break
      
      case 'clear-next-cache':
        shellCommand = 'rm -rf /Users/david/.openclaw/workspace/mission-control-app/.next'
        break
      
      default:
        return NextResponse.json(
          { error: `Unknown command: ${command}` },
          { status: 400 }
        )
    }

    try {
      const { stdout, stderr } = await execAsync(shellCommand, options)
      let output = stdout.trim()
      
      if (stderr.trim()) {
        output += stderr.trim() ? `\nErrors:\n${stderr.trim()}` : ''
      }
      
      if (!output) {
        output = 'Command executed successfully (no output)'
      }
      
      return NextResponse.json({ output })
    } catch (execError: unknown) {
      // Handle execution errors
      const error = execError as { stdout?: string; stderr?: string; message?: string }
      let errorOutput = 'Command failed'
      
      if (error.stdout) errorOutput += `\nOutput: ${error.stdout}`
      if (error.stderr) errorOutput += `\nError: ${error.stderr}`
      if (error.message && !error.stderr) errorOutput += `\nError: ${error.message}`
      
      return NextResponse.json(
        { error: errorOutput },
        { status: 500 }
      )
    }
  } catch (err: unknown) {
    console.error('Failed to execute command:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to execute command: ${message}` },
      { status: 500 }
    )
  }
}