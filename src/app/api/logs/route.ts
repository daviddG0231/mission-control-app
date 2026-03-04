/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'
import { join } from 'path'
import { homedir } from 'os'

const execAsync = promisify(exec)

interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  source: 'gateway' | 'agent' | 'status'
}

async function getGatewayLogs(limit = 100): Promise<LogEntry[]> {
  const logs: LogEntry[] = []
  
  // Get today's log file
  const today = new Date().toISOString().split('T')[0]
  const logPath = `/tmp/openclaw/openclaw-${today}.log`
  
  if (existsSync(logPath)) {
    try {
      const content = readFileSync(logPath, 'utf-8')
      const lines = content.split('\n').filter(line => line.trim()).slice(-limit)
      
      for (const line of lines) {
        try {
          const entry = JSON.parse(line)
          logs.push({
            timestamp: entry.time || entry._meta?.date || new Date().toISOString(),
            level: entry._meta?.logLevelName?.toLowerCase() || 'info',
            message: entry[1] || entry.message || 'Unknown log entry',
            source: 'gateway'
          })
        } catch (parseError) {
          // Handle malformed JSON lines
          logs.push({
            timestamp: new Date().toISOString(),
            level: 'error',
            message: `Parse error: ${line}`,
            source: 'gateway'
          })
        }
      }
    } catch (error) {
      logs.push({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `Failed to read gateway log: ${error}`,
        source: 'gateway'
      })
    }
  }
  
  return logs
}

async function getAgentLogs(limit = 20): Promise<LogEntry[]> {
  const logs: LogEntry[] = []
  
  // Get recent session files
  const agentsPath = join(homedir(), '.openclaw', 'agents')
  const sessionPaths = [
    join(agentsPath, 'builder', 'sessions'),
    join(agentsPath, 'main', 'sessions')
  ]
  
  for (const sessionPath of sessionPaths) {
    if (existsSync(sessionPath)) {
      try {
        const { stdout } = await execAsync(`find "${sessionPath}" -name "*.jsonl" -type f | head -3`)
        const files = stdout.trim().split('\n').filter(f => f)
        
        for (const file of files) {
          try {
            const { stdout: tailOutput } = await execAsync(`tail -10 "${file}"`)
            const lines = tailOutput.split('\n').filter(line => line.trim())
            
            for (const line of lines.slice(-limit / files.length)) {
              try {
                const entry = JSON.parse(line)
                if (entry.type === 'message' && entry.message) {
                  const content = entry.message.content?.[0]?.text || 'Message'
                  logs.push({
                    timestamp: entry.timestamp,
                    level: 'info',
                    message: `Agent: ${content.slice(0, 100)}${content.length > 100 ? '...' : ''}`,
                    source: 'agent'
                  })
                }
              } catch (parseError) {
                // Skip malformed entries
              }
            }
          } catch (error) {
            // Skip files that can't be read
          }
        }
      } catch (error) {
        logs.push({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `Failed to read agent logs: ${error}`,
          source: 'agent'
        })
      }
    }
  }
  
  return logs
}

async function getGatewayStatus(): Promise<LogEntry[]> {
  const logs: LogEntry[] = []
  
  try {
    const { stdout } = await execAsync('openclaw gateway status', { timeout: 5000 })
    const lines = stdout.split('\n').filter(line => line.trim())
    
    for (const line of lines) {
      if (line.includes(':')) {
        logs.push({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `Status: ${line}`,
          source: 'status'
        })
      }
    }
  } catch (error) {
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'error',
      message: `Gateway status error: ${error}`,
      source: 'status'
    })
  }
  
  return logs
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '500')
    
    const [gatewayLogs, agentLogs, statusLogs] = await Promise.all([
      getGatewayLogs(Math.floor(limit * 0.7)),
      getAgentLogs(Math.floor(limit * 0.2)),
      getGatewayStatus()
    ])
    
    // Combine and sort by timestamp
    const allLogs = [...gatewayLogs, ...agentLogs, ...statusLogs]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
    
    return NextResponse.json({ logs: allLogs })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}