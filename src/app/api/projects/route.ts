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
}

const WORKSPACE_PATH = '/Users/david/.openclaw/workspace'
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
          techStack
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