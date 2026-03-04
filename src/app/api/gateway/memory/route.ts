import { NextResponse } from 'next/server'
import { readFile, readdir } from 'fs/promises'
import { join } from 'path'

const WORKSPACE = process.env.WORKSPACE_PATH || '/Users/david/.openclaw/workspace'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const file = searchParams.get('file')

    if (file) {
      // Read a specific file
      const safePath = file.replace(/\.\./g, '')
      const fullPath = join(WORKSPACE, safePath)
      const content = await readFile(fullPath, 'utf-8')
      return NextResponse.json({ file: safePath, content })
    }

    // List memory files
    const memoryDir = join(WORKSPACE, 'memory')
    const files = await readdir(memoryDir).catch(() => [])
    const memoryFiles = (files as string[])
      .filter((f: string) => f.endsWith('.md'))
      .sort()
      .reverse()

    // Also check for MEMORY.md
    let mainMemory = false
    try {
      await readFile(join(WORKSPACE, 'MEMORY.md'), 'utf-8')
      mainMemory = true
    } catch { /* noop */ }

    return NextResponse.json({
      mainMemory,
      files: memoryFiles,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
