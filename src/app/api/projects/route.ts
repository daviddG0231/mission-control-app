/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export interface ProjectData {
  name: string
  path: string
  hasPackageJson: boolean
  hasPyprojectToml: boolean
  hasGit: boolean
  hasReadme: boolean
  lastModified: string
  packageName?: string
  packageDescription?: string
  techStack: string[]
  port?: number
}

import { WORKSPACE_PATH } from '@/lib/paths'
const EXCLUDED_DIRS = new Set([
  'memory',
  'config', 
  'dave',
  'mission-control',
  'mission-control-app',
  'skills',
  'node_modules',
  '.next',
  '.git',
  '.vercel',
  '.openclaw',
  '.clawhub'
])

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readJsonSafely(filePath: string): Promise<any> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

async function detectPort(projectPath: string, hasPackageJson: boolean): Promise<number | undefined> {
  if (!hasPackageJson) return undefined
  const packageJson = await readJsonSafely(path.join(projectPath, 'package.json'))
  if (!packageJson?.scripts) return undefined

  // Check dev/start scripts for --port flags
  const scripts = [packageJson.scripts.dev, packageJson.scripts.start].filter(Boolean).join(' ')
  const portMatch = scripts.match(/--port\s+(\d+)|-p\s+(\d+)|PORT=(\d+)/)
  if (portMatch) return parseInt(portMatch[1] || portMatch[2] || portMatch[3], 10)

  // Check for common config files with port settings
  const configFiles = [
    { file: 'next.config.mjs', pattern: /port[:\s]+(\d+)/i },
    { file: 'next.config.js', pattern: /port[:\s]+(\d+)/i },
    { file: 'vite.config.ts', pattern: /port[:\s]+(\d+)/i },
    { file: 'vite.config.js', pattern: /port[:\s]+(\d+)/i },
    { file: 'app.json', pattern: /port[:\s]+(\d+)/i },
  ]

  for (const { file, pattern } of configFiles) {
    try {
      const content = await fs.readFile(path.join(projectPath, file), 'utf-8')
      const match = content.match(pattern)
      if (match) return parseInt(match[1], 10)
    } catch { /* file doesn't exist */ }
  }

  // Default ports by framework
  if (packageJson.dependencies?.next || packageJson.devDependencies?.next) return 3000
  if (packageJson.dependencies?.vite || packageJson.devDependencies?.vite) return 5173
  if (packageJson.dependencies?.expo) return 8081

  return undefined
}

async function detectTechStack(projectPath: string, hasPackageJson: boolean, hasPyprojectToml: boolean): Promise<string[]> {
  const techStack: string[] = []
  
  if (hasPackageJson) {
    const packageJson = await readJsonSafely(path.join(projectPath, 'package.json'))
    if (packageJson?.dependencies) {
      if (packageJson.dependencies.next || packageJson.devDependencies?.next) {
        techStack.push('Next.js')
      } else if (packageJson.dependencies.react || packageJson.devDependencies?.react) {
        techStack.push('React')
      }
      if (packageJson.dependencies.typescript || packageJson.devDependencies?.typescript) {
        techStack.push('TypeScript')
      }
      if (packageJson.dependencies.tailwindcss || packageJson.devDependencies?.tailwindcss) {
        techStack.push('Tailwind')
      }
    }
    if (techStack.length === 0) {
      techStack.push('Node.js')
    }
  }
  
  if (hasPyprojectToml) {
    techStack.push('Python')
  }
  
  // Check for other indicators
  const hasRequirementsTxt = await fileExists(path.join(projectPath, 'requirements.txt'))
  const hasPyFiles = await fileExists(path.join(projectPath, 'main.py')) || 
                     await fileExists(path.join(projectPath, 'app.py')) ||
                     await fileExists(path.join(projectPath, '__init__.py'))
  
  if (hasRequirementsTxt || hasPyFiles) {
    if (!techStack.includes('Python')) {
      techStack.push('Python')
    }
  }
  
  return techStack
}

export async function GET() {
  try {
    const entries = await fs.readdir(WORKSPACE_PATH, { withFileTypes: true })
    const projects: ProjectData[] = []
    
    for (const entry of entries) {
      if (!entry.isDirectory() || EXCLUDED_DIRS.has(entry.name)) {
        continue
      }
      
      const projectPath = path.join(WORKSPACE_PATH, entry.name)
      
      try {
        const stats = await fs.stat(projectPath)
        const hasPackageJson = await fileExists(path.join(projectPath, 'package.json'))
        const hasPyprojectToml = await fileExists(path.join(projectPath, 'pyproject.toml'))
        const hasGit = await fileExists(path.join(projectPath, '.git'))
        const hasReadme = await fileExists(path.join(projectPath, 'README.md')) ||
                         await fileExists(path.join(projectPath, 'readme.md')) ||
                         await fileExists(path.join(projectPath, 'README.txt'))
        
        let packageName: string | undefined
        let packageDescription: string | undefined
        
        if (hasPackageJson) {
          const packageJson = await readJsonSafely(path.join(projectPath, 'package.json'))
          if (packageJson) {
            packageName = packageJson.name
            packageDescription = packageJson.description
          }
        }
        
        const techStack = await detectTechStack(projectPath, hasPackageJson, hasPyprojectToml)
        const port = await detectPort(projectPath, hasPackageJson)
        
        projects.push({
          name: entry.name,
          path: projectPath,
          hasPackageJson,
          hasPyprojectToml,
          hasGit,
          hasReadme,
          lastModified: stats.mtime.toISOString(),
          packageName,
          packageDescription,
          techStack,
          port
        })
      } catch (error) {
        // Skip directories we can't read
        continue
      }
    }
    
    // Sort by last modified date (newest first)
    projects.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
    
    return NextResponse.json({ projects })
  } catch (error) {
    console.error('Error scanning projects:', error)
    return NextResponse.json(
      { error: 'Failed to scan projects' },
      { status: 500 }
    )
  }
}