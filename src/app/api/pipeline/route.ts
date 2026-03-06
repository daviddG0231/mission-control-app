import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'

const execAsync = promisify(exec)

interface GitRepository {
  name: string
  path: string
  branch: string
  lastCommit: string
  status: 'clean' | 'dirty'
  statusDetails: string[]
  commits: string[]
  ahead: number
  behind: number
}

async function findGitRepositories(dir: string): Promise<string[]> {
  const repositories: string[] = []
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = path.join(dir, entry.name)
        
        // Check if this directory is a git repository
        if (fs.existsSync(path.join(fullPath, '.git'))) {
          repositories.push(fullPath)
        } else if (entry.name !== 'node_modules' && entry.name !== '.git' && !entry.name.startsWith('.')) {
          // Recursively search subdirectories (but skip common build/cache dirs)
          const subRepos = await findGitRepositories(fullPath)
          repositories.push(...subRepos)
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error)
  }
  
  return repositories
}

async function getRepositoryInfo(repoPath: string): Promise<GitRepository> {
  const repoName = path.basename(repoPath)
  
  try {
    // Get current branch
    const { stdout: branch } = await execAsync('git branch --show-current', { cwd: repoPath })
    
    // Get last 5 commits
    const { stdout: commits } = await execAsync('git log --oneline -5', { cwd: repoPath })
    
    // Get git status
    const { stdout: status } = await execAsync('git status --short', { cwd: repoPath })
    
    // Get last commit message
    const { stdout: lastCommit } = await execAsync('git log -1 --pretty=format:"%s"', { cwd: repoPath })
    
    // Check if ahead/behind remote
    let ahead = 0
    let behind = 0
    try {
      const { stdout: aheadBehind } = await execAsync('git rev-list --left-right --count HEAD...@{u}', { cwd: repoPath })
      const [aheadStr, behindStr] = aheadBehind.trim().split('\t')
      ahead = parseInt(aheadStr) || 0
      behind = parseInt(behindStr) || 0
    } catch {
      // No upstream or other error - ignore
    }
    
    return {
      name: repoName,
      path: repoPath,
      branch: branch.trim() || 'main',
      lastCommit: lastCommit.trim(),
      status: status.trim() ? 'dirty' : 'clean',
      statusDetails: status.trim().split('\n').filter(line => line.trim()),
      commits: commits.trim().split('\n').filter(line => line.trim()),
      ahead,
      behind
    }
  } catch (error) {
    console.error(`Error getting repository info for ${repoPath}:`, error)
    return {
      name: repoName,
      path: repoPath,
      branch: 'unknown',
      lastCommit: 'Error reading git info',
      status: 'dirty',
      statusDetails: ['Error reading git status'],
      commits: ['Error reading git log'],
      ahead: 0,
      behind: 0
    }
  }
}

export async function GET() {
  try {
    const workspaceDir = process.env.WORKSPACE_DIR || path.join(process.env.HOME || '/root', '.openclaw/workspace')
    
    // Find all git repositories in the workspace
    const repoPaths = await findGitRepositories(workspaceDir)
    
    // Get detailed info for each repository
    const repositories = await Promise.all(
      repoPaths.map(repoPath => getRepositoryInfo(repoPath))
    )
    
    return NextResponse.json({
      success: true,
      repositories,
      totalRepositories: repositories.length,
      cleanRepositories: repositories.filter(repo => repo.status === 'clean').length,
      dirtyRepositories: repositories.filter(repo => repo.status === 'dirty').length
    })
  } catch (error) {
    console.error('Error in pipeline API:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch pipeline data',
        repositories: [],
        totalRepositories: 0,
        cleanRepositories: 0,
        dirtyRepositories: 0
      },
      { status: 500 }
    )
  }
}