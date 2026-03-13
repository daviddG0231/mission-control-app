import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { readFileSync, existsSync } from 'fs'
import { WORKSPACE_PATH } from '@/lib/paths'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const projectPath = request.nextUrl.searchParams.get('path')
  const lines = parseInt(request.nextUrl.searchParams.get('lines') || '50', 10)

  if (!projectPath) {
    return NextResponse.json({ error: 'Missing path param' }, { status: 400 })
  }

  const resolved = path.resolve(projectPath)
  if (!resolved.startsWith(WORKSPACE_PATH)) {
    return NextResponse.json({ error: 'Path outside workspace' }, { status: 403 })
  }

  const logFile = path.join(resolved, '.dev-server.log')
  if (!existsSync(logFile)) {
    return NextResponse.json({ log: '', exists: false })
  }

  try {
    const content = readFileSync(logFile, 'utf-8')
    // Return last N lines
    const allLines = content.split('\n')
    const lastLines = allLines.slice(-lines).join('\n')
    return NextResponse.json({ log: lastLines, exists: true, totalLines: allLines.length })
  } catch {
    return NextResponse.json({ error: 'Failed to read log', log: '' }, { status: 500 })
  }
}
