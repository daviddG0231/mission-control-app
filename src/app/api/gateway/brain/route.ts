import { NextResponse } from 'next/server'
import { readFile, readdir } from 'fs/promises'
import { join } from 'path'

const WORKSPACE = process.env.WORKSPACE_PATH || join(process.env.HOME || '/root', '.openclaw/workspace')

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const file = searchParams.get('file')
    if (file) {
      const safePath = file.replace(/\.\./g, '')
      const fullPath = join(WORKSPACE, safePath)
      const content = await readFile(fullPath, 'utf-8')
      return NextResponse.json({ file: safePath, content })
    }

    // List all brain files
    const brainDir = join(WORKSPACE, 'patrick-brain')
    const brainFiles = await readdir(brainDir).catch(() => [])
    const mdFiles = (brainFiles as string[])
      .filter((f: string) => f.endsWith('.md'))
      .sort()

    // List memory files
    const memoryDir = join(WORKSPACE, 'memory')
    const memFiles = await readdir(memoryDir).catch(() => [])
    const dailyFiles = (memFiles as string[])
      .filter((f: string) => f.endsWith('.md'))
      .sort()
      .reverse()

    // Read MASTER-INDEX for parsed data
    let masterIndex = ''
    try {
      masterIndex = await readFile(join(brainDir, 'MASTER-INDEX.md'), 'utf-8')
    } catch { /* noop */ }

    // Read key files for dashboard stats
    let projectsContent = ''
    try {
      projectsContent = await readFile(join(brainDir, 'projects.md'), 'utf-8')
    } catch { /* noop */ }

    let personalityContent = ''
    try {
      personalityContent = await readFile(join(brainDir, 'personality.md'), 'utf-8')
    } catch { /* noop */ }

    let usContent = ''
    try {
      usContent = await readFile(join(brainDir, 'us.md'), 'utf-8')
    } catch { /* noop */ }

    let skillsContent = ''
    try {
      skillsContent = await readFile(join(WORKSPACE, 'memory/daily-skills-taught.md'), 'utf-8')
    } catch { /* noop */ }

    let growthContent = ''
    try {
      growthContent = await readFile(join(brainDir, 'growth.md'), 'utf-8')
    } catch { /* noop */ }

    // Check MEMORY.md
    let mainMemory = ''
    try {
      mainMemory = await readFile(join(WORKSPACE, 'MEMORY.md'), 'utf-8')
    } catch { /* noop */ }

    return NextResponse.json({
      brainFiles: mdFiles,
      dailyFiles,
      masterIndex,
      projectsContent,
      personalityContent,
      usContent,
      skillsContent,
      growthContent,
      mainMemory,
      stats: {
        brainFileCount: mdFiles.length,
        dailyFileCount: dailyFiles.length,
        projectCount: (projectsContent.match(/^## \d+\./gm) || []).length,
        jokeCount: (personalityContent.match(/\*\*".*?"\*\*/g) || []).length,
        milestoneCount: (usContent.match(/^### /gm) || []).length,
        skillsTaught: (skillsContent.match(/^## /gm) || []).length,
        growthLessons: (growthContent.match(/^### March/gm) || []).length,
      }
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
