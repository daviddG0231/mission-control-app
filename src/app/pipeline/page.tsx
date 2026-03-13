'use client'

import { useEffect, useState } from 'react'
import { GitBranch, GitCommit, CheckCircle, XCircle, AlertCircle, ArrowRight, Rocket, Code, Hammer, Github, FolderOpen, ExternalLink } from 'lucide-react'

interface GhRepo {
  name: string
  url: string
  visibility: string
  updatedAt: string
  isPrivate: boolean
}

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

interface PipelineData {
  success: boolean
  repositories: GitRepository[]
  totalRepositories: number
  cleanRepositories: number
  dirtyRepositories: number
}

interface PipelineStage {
  name: string
  status: 'success' | 'error' | 'warning' | 'pending'
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

export default function PipelinePage() {
  const [pipelineData, setPipelineData] = useState<PipelineData>({
    success: false,
    repositories: [],
    totalRepositories: 0,
    cleanRepositories: 0,
    dirtyRepositories: 0
  })
  const [loading, setLoading] = useState(true)
  const [githubRepos, setGithubRepos] = useState<GhRepo[]>([])
  const [githubLoading, setGithubLoading] = useState(true)
  const [githubError, setGithubError] = useState<string | null>(null)
  const [githubNeedsAuth, setGithubNeedsAuth] = useState(false)

  useEffect(() => {
    const fetchPipelineData = async () => {
      try {
        const response = await fetch('/api/pipeline')
        if (response.ok) {
          const data = await response.json()
          setPipelineData(data)
        } else {
          throw new Error('Failed to fetch pipeline data')
        }
      } catch (error) {
        console.error('Failed to fetch pipeline data:', error)
        setPipelineData({
          success: false,
          repositories: [],
          totalRepositories: 0,
          cleanRepositories: 0,
          dirtyRepositories: 0
        })
      } finally {
        setLoading(false)
      }
    }

    fetchPipelineData()
    const interval = setInterval(fetchPipelineData, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const fetchGithubRepos = async () => {
      setGithubLoading(true)
      setGithubError(null)
      setGithubNeedsAuth(false)
      try {
        const res = await fetch('/api/github/repos')
        const data = await res.json()
        if (data.success) {
          setGithubRepos(data.repos || [])
        } else {
          setGithubError(data.error || 'Failed to load GitHub repos')
          setGithubNeedsAuth(data.needsAuth || false)
        }
      } catch {
        setGithubError('Failed to fetch GitHub repos')
      } finally {
        setGithubLoading(false)
      }
    }
    fetchGithubRepos()
    const interval = setInterval(fetchGithubRepos, 120000)
    return () => clearInterval(interval)
  }, [])

  const PipelineStages = ({ repository }: { repository: GitRepository }) => {
    const stages: PipelineStage[] = [
      {
        name: 'Code',
        status: repository.status === 'clean' ? 'success' : 'warning',
        icon: Code
      },
      {
        name: 'Build',
        status: repository.status === 'clean' ? 'success' : 'pending',
        icon: Hammer
      },
      {
        name: 'Deploy',
        status: repository.status === 'clean' && repository.ahead === 0 ? 'success' : 'pending',
        icon: Rocket
      }
    ]

    return (
      <div className="flex items-center gap-4">
        {stages.map((stage, index) => (
          <div key={stage.name} className="flex items-center gap-2">
            <div className={`
              flex items-center gap-2 px-3 py-2 rounded-lg text-sm
              ${stage.status === 'success' ? 'bg-[var(--success)]/20 text-[var(--success)]' :
                stage.status === 'warning' ? 'bg-[var(--warning)]/20 text-[var(--warning)]' :
                stage.status === 'error' ? 'bg-[var(--danger)]/20 text-[var(--danger)]' :
                'bg-[var(--text-secondary)]/20 text-[var(--text-secondary)]'}
            `}>
              <stage.icon className="w-4 h-4" />
              {stage.name}
            </div>
            {index < stages.length - 1 && (
              <ArrowRight className="w-4 h-4 text-[var(--text-secondary)]" />
            )}
          </div>
        ))}
      </div>
    )
  }

  const RepositoryCard = ({ repository }: { repository: GitRepository }) => {
    const isDirty = repository.status === 'dirty'
    const hasUnpushed = repository.ahead > 0
    const hasUnpulled = repository.behind > 0

    return (
      <div className="bg-[var(--bg-card)] rounded-lg p-6 border border-[var(--border)] space-y-4">
        {/* Repository Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitBranch className="w-5 h-5 text-[var(--accent)]" />
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">{repository.name}</h3>
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <span>Branch: {repository.branch}</span>
                {hasUnpushed && (
                  <span className="text-[var(--warning)]">↑{repository.ahead}</span>
                )}
                {hasUnpulled && (
                  <span className="text-[var(--danger)]">↓{repository.behind}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isDirty ? (
              <XCircle className="w-5 h-5 text-[var(--warning)]" />
            ) : (
              <CheckCircle className="w-5 h-5 text-[var(--success)]" />
            )}
            <span className={`text-sm ${isDirty ? 'text-[var(--warning)]' : 'text-[var(--success)]'}`}>
              {isDirty ? 'Dirty' : 'Clean'}
            </span>
          </div>
        </div>

        {/* Last Commit */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">Last Commit</h4>
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <GitCommit className="w-4 h-4" />
            <span>{repository.lastCommit || 'No commits'}</span>
          </div>
        </div>

        {/* Recent Commits */}
        {repository.commits.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">Recent Commits</h4>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {repository.commits.slice(0, 3).map((commit, index) => (
                <div key={index} className="text-xs text-[var(--text-secondary)] font-mono">
                  {commit}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status Details */}
        {isDirty && repository.statusDetails.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">Changes</h4>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {repository.statusDetails.slice(0, 5).map((detail, index) => (
                <div key={index} className="text-xs text-[var(--warning)] font-mono">
                  {detail}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pipeline Stages */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">Pipeline Status</h4>
          <PipelineStages repository={repository} />
        </div>

        {/* Sync Status */}
        {(hasUnpushed || hasUnpulled) && (
          <div className="bg-[var(--warning)]/10 border border-[var(--warning)]/30 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[var(--warning)]" />
              <span className="text-sm text-[var(--warning)]">
                {hasUnpushed && hasUnpulled 
                  ? `${repository.ahead} commits to push, ${repository.behind} commits to pull`
                  : hasUnpushed 
                  ? `${repository.ahead} commits ready to push`
                  : `${repository.behind} commits to pull`
                }
              </span>
            </div>
          </div>
        )}
      </div>
    )
  }

    const getLocalMatch = (ghRepo: GhRepo) => {
    const repoName = ghRepo.name.split('/').pop() || ghRepo.name
    return pipelineData.repositories.find(
      (r) => r.name === repoName || r.name === ghRepo.name
    )
  }

  const StatCard = ({ title, value, subtitle, icon: Icon, color = 'accent' }: {
    title: string
    value: string | number
    subtitle: string
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
    color?: 'accent' | 'success' | 'warning' | 'danger'
  }) => {
    const colorClass = {
      accent: 'text-[var(--accent)]',
      success: 'text-[var(--success)]',
      warning: 'text-[var(--warning)]',
      danger: 'text-[var(--danger)]'
    }[color]

    return (
      <div className="bg-[var(--bg-card)] rounded-lg p-4 border border-[var(--border)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-[var(--text-primary)]">{value}</div>
            <div className="text-sm text-[var(--text-secondary)]">{title}</div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">{subtitle}</div>
          </div>
          <Icon className={`w-8 h-8 ${colorClass}`} />
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 md:p-6 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <GitBranch className="w-6 h-6 text-[var(--accent)]" />
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Pipeline</h1>
        {!loading && pipelineData.success && (
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <div className="w-2 h-2 bg-[var(--success)] rounded-full animate-pulse" />
            {pipelineData.totalRepositories} local repos
          </div>
        )}
        {!githubLoading && githubRepos.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <Github className="w-4 h-4" />
            {githubRepos.length} GitHub repos
          </div>
        )}
      </div>

      {loading && (
        <div className="text-center text-[var(--text-secondary)]">
          Scanning repositories...
        </div>
      )}

      {!loading && !pipelineData.success && (
        <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-[var(--danger)]" />
            <span className="text-[var(--danger)]">Failed to load pipeline data</span>
          </div>
        </div>
      )}

      {!loading && pipelineData.success && (
        <>
          {/* Pipeline Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              title="Total Repositories"
              value={pipelineData.totalRepositories}
              subtitle="Git repositories found"
              icon={GitBranch}
              color="accent"
            />
            <StatCard
              title="Clean Repositories"
              value={pipelineData.cleanRepositories}
              subtitle="No uncommitted changes"
              icon={CheckCircle}
              color="success"
            />
            <StatCard
              title="Dirty Repositories"
              value={pipelineData.dirtyRepositories}
              subtitle="Have uncommitted changes"
              icon={AlertCircle}
              color={pipelineData.dirtyRepositories > 0 ? "warning" : "success"}
            />
          </div>

          {/* Local Repositories */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Local Repositories</h2>
            
            {pipelineData.repositories.length === 0 ? (
              <div className="bg-[var(--bg-card)] rounded-lg p-8 border border-[var(--border)] text-center">
                <GitBranch className="w-12 h-12 text-[var(--text-secondary)] mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No Repositories Found</h3>
                <p className="text-[var(--text-secondary)]">No Git repositories found in workspace</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {pipelineData.repositories.map((repository) => (
                  <RepositoryCard key={repository.path} repository={repository} />
                ))}
              </div>
            )}
          </div>

          {/* GitHub Repos */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Github className="w-5 h-5 text-[var(--text-secondary)]" />
              GitHub Repositories
            </h2>
            {githubLoading && (
              <div className="text-sm text-[var(--text-secondary)]">Loading GitHub repos…</div>
            )}
            {githubNeedsAuth && !githubLoading && (
              <div className="bg-[var(--warning)]/10 border border-[var(--warning)]/30 rounded-lg p-4">
                <p className="text-sm text-[var(--text-primary)] mb-2">
                  Sign in to GitHub CLI to view your repos:
                </p>
                <code className="block text-xs font-mono bg-[var(--bg-hover)] px-3 py-2 rounded text-[var(--accent)]">
                  gh auth login
                </code>
              </div>
            )}
            {githubError && !githubNeedsAuth && !githubLoading && (
              <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded-lg p-4">
                <p className="text-sm text-[var(--danger)]">{githubError}</p>
              </div>
            )}
            {!githubLoading && !githubError && githubRepos.length === 0 && !githubNeedsAuth && (
              <div className="bg-[var(--bg-card)] rounded-lg p-6 border border-[var(--border)] text-center">
                <Github className="w-10 h-10 text-[var(--text-secondary)] mx-auto mb-2" />
                <p className="text-sm text-[var(--text-secondary)]">No GitHub repositories found</p>
              </div>
            )}
            {!githubLoading && githubRepos.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {githubRepos.map((repo) => {
                  const local = getLocalMatch(repo)
                  return (
                    <div
                      key={repo.url}
                      className="bg-[var(--bg-card)] rounded-lg p-4 border border-[var(--border)] hover:border-[var(--accent)]/30 transition"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <a
                            href={repo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-[var(--accent)] hover:underline truncate block"
                          >
                            {repo.name}
                          </a>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-secondary)]">
                              {repo.visibility}
                            </span>
                            {local && (
                              <span className="flex items-center gap-0.5 text-[10px] text-[var(--success)]">
                                <FolderOpen className="w-3 h-3" />
                                Cloned locally
                              </span>
                            )}
                          </div>
                        </div>
                        <a
                          href={repo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
                          title="Open on GitHub"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                      {local && (
                        <p className="text-[10px] text-[var(--text-secondary)] mt-2 font-mono truncate" title={local.path}>
                          {local.path}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Pipeline Health */}
          {pipelineData.repositories.length > 0 && (
            <div className="bg-[var(--bg-card)] rounded-lg p-6 border border-[var(--border)]">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Pipeline Health</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-[var(--success)]">
                    {pipelineData.totalRepositories > 0 ? 
                      Math.round((pipelineData.cleanRepositories / pipelineData.totalRepositories) * 100) : 0}%
                  </div>
                  <div className="text-sm text-[var(--text-secondary)]">Clean Repositories</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-[var(--accent)]">
                    {pipelineData.repositories.filter(r => r.ahead === 0 && r.behind === 0).length}
                  </div>
                  <div className="text-sm text-[var(--text-secondary)]">Synced Repositories</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-[var(--warning)]">
                    {pipelineData.repositories.filter(r => r.ahead > 0 || r.behind > 0).length}
                  </div>
                  <div className="text-sm text-[var(--text-secondary)]">Need Sync</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}