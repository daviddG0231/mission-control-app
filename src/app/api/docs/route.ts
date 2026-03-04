import { NextRequest, NextResponse } from 'next/server'
import { readdir, readFile, stat } from 'fs/promises'
import { join, normalize } from 'path'

const DOCS_PATH = '/opt/homebrew/lib/node_modules/openclaw/docs'
const MAX_DEPTH = 2

interface DocFile {
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

async function getDocsRecursively(dirPath: string, relativePath = '', depth = 0): Promise<DocFile[]> {
  if (depth >= MAX_DEPTH) return []
  
  const files: DocFile[] = []
  
  try {
    const entries = await readdir(dirPath, { withFileTypes: true })
    
    for (const entry of entries) {
      const entryPath = join(dirPath, entry.name)
      const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name
      
      if (entry.isDirectory()) {
        // Add directory entry
        files.push({
          name: entry.name,
          path: entryRelativePath,
          type: 'directory'
        })
        
        // Recursively get files from subdirectory
        const subFiles = await getDocsRecursively(entryPath, entryRelativePath, depth + 1)
        files.push(...subFiles)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        try {
          const stats = await stat(entryPath)
          files.push({
            name: entry.name,
            path: entryRelativePath,
            type: 'file',
            size: stats.size,
            modified: stats.mtime.toISOString()
          })
        } catch {
          // Skip files we can't stat
        }
      }
    }
  } catch {
    // Skip directories we can't read
  }
  
  return files
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
        const fullPath = join(DOCS_PATH, sanitizedPath)
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
        return NextResponse.json({ error: 'Documentation file not found' }, { status: 404 })
      }
    }
    
    // Otherwise, return file list
    try {
      const files = await getDocsRecursively(DOCS_PATH)
      return NextResponse.json({ files })
    } catch {
      return NextResponse.json({ error: 'Documentation directory not accessible' }, { status: 404 })
    }
    
  } catch {
    console.error('Docs API error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}