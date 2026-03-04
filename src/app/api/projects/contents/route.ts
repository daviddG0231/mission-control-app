import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const WORKSPACE_PATH = '/Users/david/.openclaw/workspace'

function isPathSafe(requestedPath: string): boolean {
  const resolved = path.resolve(requestedPath)
  return resolved.startsWith(WORKSPACE_PATH) && resolved.length >= WORKSPACE_PATH.length
}

export async function GET(request: NextRequest) {
  try {
    const pathParam = request.nextUrl.searchParams.get('path')
    if (!pathParam) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 })
    }
    if (!isPathSafe(pathParam)) {
      return NextResponse.json({ error: 'Path outside workspace' }, { status: 403 })
    }

    const entries = await fs.readdir(pathParam, { withFileTypes: true })
    const items = entries.map((e) => ({
      name: e.name,
      isDirectory: e.isDirectory(),
    }))
    return NextResponse.json({ path: pathParam, items })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
