import { NextRequest, NextResponse } from 'next/server'
import { readdir, readFile, stat } from 'fs/promises'
import { join, normalize } from 'path'

const WORKSPACE_PATH = '/Users/david/.openclaw/workspace'

// Key workspace files to display
const KEY_FILES = [
  'MEMORY.md',
  'SOUL.md', 
  'USER.md',
  'AGENTS.md',
  'TOOLS.md',
  'HEARTBEAT.md',
  'IDENTITY.md'
]

interface FileInfo {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  modified?: string
}

// Sanitize path to prevent directory traversal
function sanitizePath(inputPath: string): string | null {
  if (!inputPath || inputPath.includes('..')) {
    return null
  }
  
  const normalized = normalize(inputPath)
  if (normalized.startsWith('..') || normalized.includes('/../')) {
    return null
  }
  
  return normalized
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('file')
    
    // If file parameter is provided, return file content
    if (filePath) {
      const sanitizedPath = sanitizePath(filePath)
      if (!sanitizedPath) {
        return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
      }
      
      try {
        const fullPath = join(WORKSPACE_PATH, sanitizedPath)
        const content = await readFile(fullPath, 'utf-8')
        const stats = await stat(fullPath)
        
        return NextResponse.json({
          content,
          name: sanitizedPath.split('/').pop(),
          path: sanitizedPath,
          size: stats.size,
          modified: stats.mtime.toISOString()
        })
      } catch {
        return NextResponse.json({ error: 'File not found' }, { status: 404 })
      }
    }
    
    // Otherwise, return file list
    const files: FileInfo[] = []
    
    // Add key workspace files
    for (const fileName of KEY_FILES) {
      try {
        const filePath = join(WORKSPACE_PATH, fileName)
        const stats = await stat(filePath)
        files.push({
          name: fileName,
          path: fileName,
          type: 'file',
          size: stats.size,
          modified: stats.mtime.toISOString()
        })
      } catch {
        // File doesn't exist, skip it
      }
    }
    
    // Add memory files
    try {
      const memoryPath = join(WORKSPACE_PATH, 'memory')
      const memoryFiles = await readdir(memoryPath)
      
      for (const fileName of memoryFiles) {
        if (fileName.endsWith('.md')) {
          try {
            const filePath = join(memoryPath, fileName)
            const stats = await stat(filePath)
            files.push({
              name: fileName,
              path: `memory/${fileName}`,
              type: 'file',
              size: stats.size,
              modified: stats.mtime.toISOString()
            })
          } catch {
            // Skip files we can't read
          }
        }
      }
    } catch {
      // Memory directory doesn't exist, skip it
    }
    
    return NextResponse.json({ files })
    
  } catch {
    console.error('Content API error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}