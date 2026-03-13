'use client'

import React, { useState, useMemo } from 'react'
import { useGatewayData } from '@/hooks/use-gateway'
import { 
  Search, 
  FolderOpen, 
  GitBranch, 
  FileText, 
  Clock, 
  Layers,
  Folder,
  Play,
  Square,
  ExternalLink,
  ChevronRight,
  X,
  Loader2,
  Radio,
  Terminal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProjectData {
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

interface RunningProject {
  pid: number
  port: number
  cwd: string
  command: string
  projectName: string
}

interface ProjectsResponse {
  projects: ProjectData[]
}

const techStackColors: Record<string, { bg: string; text: string; icon?: string }> = {
  'Next.js': { bg: 'bg-blue-500/20', text: 'text-blue-300', icon: '⚡' },
  'React': { bg: 'bg-cyan-500/20', text: 'text-cyan-300', icon: '⚛️' },
  'TypeScript': { bg: 'bg-blue-400/20', text: 'text-blue-400', icon: 'TS' },
  'Node.js': { bg: 'bg-green-500/20', text: 'text-green-300', icon: '🟢' },
  'Python': { bg: 'bg-yellow-500/20', text: 'text-yellow-300', icon: '🐍' },
  'Tailwind': { bg: 'bg-teal-500/20', text: 'text-teal-300', icon: '🎨' }
}

function ProjectCard({
  project,
  onBrowse,
  onAction,
  actionLoading,
  runningInfo,
  onStop,
}: {
  project: ProjectData
  onBrowse: () => void
  onAction: (action: string) => void
  actionLoading: string | null
  runningInfo?: RunningProject
  onStop?: (pid: number, projectPath: string) => void
}) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  const [showLog, setShowLog] = useState(false)
  const [logContent, setLogContent] = useState('')
  const logRef = React.useRef<HTMLPreElement>(null)

  // Poll log file when expanded and running
  React.useEffect(() => {
    if (!showLog || !runningInfo) {
      setLogContent('')
      return
    }
    const fetchLog = async () => {
      try {
        const res = await fetch(`/api/projects/logs?path=${encodeURIComponent(project.path)}&lines=30`)
        const json = await res.json()
        if (json.log) {
          setLogContent(json.log)
          // Auto-scroll to bottom
          if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight
          }
        }
      } catch { /* ignore */ }
    }
    fetchLog()
    const interval = setInterval(fetchLog, 2000)
    return () => clearInterval(interval)
  }, [showLog, runningInfo, project.path])

  // Auto-show log when server starts
  React.useEffect(() => {
    if (runningInfo) setShowLog(true)
  }, [runningInfo])

  return (
    <div className="group bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 hover:border-[var(--accent)]/30 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition" />
          <h3 className="text-sm font-semibold text-white">{project.name}</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {project.port && (
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border',
              runningInfo
                ? 'bg-[var(--success)]/15 text-[var(--success)] border-[var(--success)]/30'
                : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] border-[var(--border)]'
            )}>
              {runningInfo && <Radio className="w-2.5 h-2.5 animate-pulse" />}
              :{runningInfo?.port || project.port}
            </span>
          )}
          {project.hasGit && <GitBranch className="w-3 h-3 text-[var(--text-secondary)]" />}
          {project.hasReadme && <FileText className="w-3 h-3 text-[var(--text-secondary)]" />}
        </div>
      </div>

      {project.packageDescription && (
        <p className="text-xs text-[var(--text-secondary)] mb-3 line-clamp-2">
          {project.packageDescription}
        </p>
      )}

      <div className="flex flex-wrap gap-1 mb-3">
        {project.techStack.map((tech) => {
          const style = techStackColors[tech] || { bg: 'bg-gray-500/20', text: 'text-gray-300' }
          return (
            <span
              key={tech}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium',
                style.bg,
                style.text
              )}
            >
              {style.icon && <span className="text-[8px]">{style.icon}</span>}
              {tech}
            </span>
          )
        })}
      </div>

      <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatDate(project.lastModified)}
        </div>
        {project.packageName && (
          <span className="font-mono">{project.packageName}</span>
        )}
      </div>

      {/* Actions */}
      <div className="mt-3 pt-3 border-t border-[var(--border)] flex flex-wrap gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onBrowse() }}
          disabled={!!actionLoading}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--accent)]/20 text-xs text-[var(--text-secondary)] hover:text-white transition disabled:opacity-50"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          Browse
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onAction('open-cursor') }}
          disabled={!!actionLoading}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--accent)]/20 text-xs text-[var(--text-secondary)] hover:text-white transition disabled:opacity-50"
        >
          {actionLoading === 'open-cursor' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
          Open
        </button>
        {(project.hasPackageJson || project.hasPyprojectToml) && !runningInfo && (
          <button
            onClick={(e) => { e.stopPropagation(); onAction('run-dev') }}
            disabled={!!actionLoading}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[var(--accent)]/20 hover:bg-[var(--accent)]/30 text-xs text-[var(--accent)] hover:text-white transition disabled:opacity-50"
          >
            {actionLoading === 'run-dev' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Run
          </button>
        )}
        {runningInfo && (
          <button
            onClick={(e) => { e.stopPropagation(); onStop?.(runningInfo.pid, project.path) }}
            disabled={!!actionLoading}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-xs text-red-400 hover:text-red-300 transition disabled:opacity-50"
          >
            {actionLoading === 'stop' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
            Stop :{runningInfo.port}
          </button>
        )}
        {runningInfo && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowLog(!showLog) }}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--accent)]/20 text-xs text-[var(--text-secondary)] hover:text-white transition"
          >
            <Terminal className="w-3.5 h-3.5" />
            {showLog ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>

      {/* Inline Terminal Output */}
      {showLog && runningInfo && (
        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          <div className="flex items-center gap-2 mb-2">
            <Terminal className="w-3.5 h-3.5 text-[var(--success)]" />
            <span className="text-[10px] font-mono text-[var(--success)]">
              Running on :{runningInfo.port}
            </span>
            <span className="text-[10px] text-[var(--text-secondary)] ml-auto font-mono">
              PID {runningInfo.pid}
            </span>
          </div>
          {/* QR Code for Expo apps */}
          {(() => {
            const expoMatch = logContent.match(/exp:\/\/[\d.]+:\d+/)
            const metroMatch = logContent.match(/Waiting on (http:\/\/localhost:\d+)/)
            if (expoMatch || metroMatch) {
              const expoUrl = expoMatch?.[0] || `exp://100.117.80.95:${runningInfo.port}`
              return (
                <div className="flex flex-col items-center gap-2 mb-3 p-3 bg-white rounded-lg">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(expoUrl)}`}
                    alt="Expo QR Code"
                    className="w-[180px] h-[180px]"
                  />
                  <span className="text-[10px] font-mono text-black/70 text-center break-all">
                    {expoUrl}
                  </span>
                </div>
              )
            }
            return null
          })()}
          <pre
            ref={logRef}
            className="bg-black/60 rounded-lg p-3 text-[10px] font-mono text-green-400/90 max-h-[200px] overflow-auto whitespace-pre-wrap break-all scrollbar-thin scrollbar-thumb-white/10"
          >
            {logContent || 'Loading...'}
          </pre>
        </div>
      )}
    </div>
  )
}

function StatsCard({ title, value, icon: Icon, color }: {
  title: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  color: string
}) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[var(--text-secondary)] mb-1">{title}</p>
          <p className="text-xl font-bold text-white">{value}</p>
        </div>
        <Icon className={cn('w-5 h-5', color)} />
      </div>
    </div>
  )
}

interface BrowseItem {
  name: string
  isDirectory: boolean
}

export default function ProjectsPage() {
  const { data, loading, error } = useGatewayData<ProjectsResponse>('/api/projects', 30000)
  const [runningProjects, setRunningProjects] = useState<RunningProject[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTech, setSelectedTech] = useState<string | null>(null)
  const [browseProject, setBrowseProject] = useState<ProjectData | null>(null)
  const [browsePath, setBrowsePath] = useState<string>('')
  const [browseItems, setBrowseItems] = useState<BrowseItem[]>([])
  const [browseLoading, setBrowseLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Fetch running dev servers every 5 seconds
  React.useEffect(() => {
    const fetchRunning = async () => {
      try {
        const res = await fetch('/api/projects/running')
        const json = await res.json()
        setRunningProjects(json.running || [])
      } catch { /* ignore */ }
    }
    fetchRunning()
    const interval = setInterval(fetchRunning, 5000)
    return () => clearInterval(interval)
  }, [])

  const getRunningInfo = (project: ProjectData): RunningProject | undefined => {
    return runningProjects.find(
      (r) => r.cwd.includes(project.name) || r.projectName === project.name
    )
  }

  const handleStop = async (pid: number, projectPath: string) => {
    setActionLoading('stop')
    try {
      await fetch('/api/projects/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath, action: 'stop', pid }),
      })
      // Refresh running list immediately
      const res = await fetch('/api/projects/running')
      const json = await res.json()
      setRunningProjects(json.running || [])
    } catch { /* ignore */ }
    finally { setActionLoading(null) }
  }

  const fetchBrowseContents = async (targetPath: string) => {
    setBrowseLoading(true)
    try {
      const res = await fetch(`/api/projects/contents?path=${encodeURIComponent(targetPath)}`)
      const json = await res.json()
      if (res.ok) {
        setBrowseItems(json.items || [])
        setBrowsePath(targetPath)
      }
    } catch { /* ignore */ }
    finally { setBrowseLoading(false) }
  }

  const openBrowse = (project: ProjectData) => {
    setBrowseProject(project)
    fetchBrowseContents(project.path)
  }

  const handleBrowseNav = (item: BrowseItem) => {
    if (!item.isDirectory || !browseProject) return
    const nextPath = `${browsePath}/${item.name}`.replace(/\/+/g, '/')
    fetchBrowseContents(nextPath)
  }

  const handleProjectAction = async (project: ProjectData, action: string) => {
    setActionLoading(action)
    try {
      const res = await fetch('/api/projects/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: project.path, action }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Action failed')

      // After starting a dev server, refresh running list quickly
      if (action === 'run-dev') {
        // Give the server a moment to start listening, then refresh
        setTimeout(async () => {
          try {
            const runRes = await fetch('/api/projects/running')
            const runJson = await runRes.json()
            setRunningProjects(runJson.running || [])
          } catch {}
        }, 2000)
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setActionLoading(null)
    }
  }

  const stats = useMemo(() => {
    if (!data?.projects) return { total: 0, node: 0, python: 0, git: 0 }
    
    return {
      total: data.projects.length,
      node: data.projects.filter(p => p.hasPackageJson).length,
      python: data.projects.filter(p => p.hasPyprojectToml || p.techStack.includes('Python')).length,
      git: data.projects.filter(p => p.hasGit).length
    }
  }, [data?.projects])

  const filteredProjects = useMemo(() => {
    if (!data?.projects) return []
    
    return data.projects.filter(project => {
      const matchesSearch = !searchQuery || 
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.packageName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.packageDescription?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.techStack.some(tech => tech.toLowerCase().includes(searchQuery.toLowerCase()))
      
      const matchesTech = !selectedTech || project.techStack.includes(selectedTech)
      
      return matchesSearch && matchesTech
    })
  }, [data?.projects, searchQuery, selectedTech])

  const allTechStacks = useMemo(() => {
    if (!data?.projects) return []
    const techSet = new Set<string>()
    data.projects.forEach(project => {
      project.techStack.forEach(tech => techSet.add(tech))
    })
    return Array.from(techSet).sort()
  }, [data?.projects])

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[var(--bg-card)] rounded w-48" />
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-[var(--bg-card)] rounded" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-40 bg-[var(--bg-card)] rounded" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-300 text-sm">Error loading projects: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Projects</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Workspace project overview and repository management
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Projects"
          value={stats.total}
          icon={Folder}
          color="text-[var(--accent)]"
        />
        <StatsCard
          title="Node.js Projects"
          value={stats.node}
          icon={Layers}
          color="text-green-400"
        />
        <StatsCard
          title="Python Projects"
          value={stats.python}
          icon={Layers}
          color="text-yellow-400"
        />
        <StatsCard
          title="Git Repositories"
          value={stats.git}
          icon={GitBranch}
          color="text-orange-400"
        />
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg text-sm text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        
        <select
          value={selectedTech || ''}
          onChange={(e) => setSelectedTech(e.target.value || null)}
          className="px-4 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg text-sm text-white focus:outline-none focus:border-[var(--accent)] min-w-[140px]"
        >
          <option value="">All Tech</option>
          {allTechStacks.map((tech) => (
            <option key={tech} value={tech}>{tech}</option>
          ))}
        </select>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredProjects.map((project) => (
          <ProjectCard
            key={project.name}
            project={project}
            onBrowse={() => openBrowse(project)}
            onAction={(action) => handleProjectAction(project, action)}
            actionLoading={actionLoading}
            runningInfo={getRunningInfo(project)}
            onStop={(pid, projectPath) => handleStop(pid, projectPath)}
          />
        ))}
      </div>

      {/* Browse Modal */}
      {browseProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl w-full max-w-lg mx-4 shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-[var(--accent)]" />
                {browseProject.name}
              </h3>
              <button
                onClick={() => setBrowseProject(null)}
                className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg transition"
              >
                <X className="w-5 h-5 text-[var(--text-secondary)]" />
              </button>
            </div>
            <div className="p-2 text-xs text-[var(--text-secondary)] font-mono truncate border-b border-[var(--border)]">
              {browsePath}
            </div>
            <div className="flex-1 overflow-auto p-4">
              {browseLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
                </div>
              ) : (
                <div className="space-y-0.5">
                  {browsePath !== browseProject.path && (
                    <button
                      onClick={() => {
                        const sep = browsePath.lastIndexOf('/')
                        const parent = sep > 0 ? browsePath.slice(0, sep) : browseProject.path
                        fetchBrowseContents(parent)
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] text-left text-sm"
                    >
                      <ChevronRight className="w-4 h-4 rotate-[-90deg]" />
                      ..
                    </button>
                  )}
                  {browseItems.map((item) => (
                    <button
                      key={item.name}
                      onClick={() => handleBrowseNav(item)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--bg-hover)] text-left text-sm transition',
                        item.isDirectory ? 'text-white' : 'text-[var(--text-secondary)]'
                      )}
                    >
                      {item.isDirectory ? (
                        <FolderOpen className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-[var(--text-secondary)] flex-shrink-0" />
                      )}
                      <span className="truncate">{item.name}</span>
                      {item.isDirectory && <ChevronRight className="w-4 h-4 ml-auto text-[var(--text-secondary)]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-[var(--border)] flex gap-2">
              <button
                onClick={() => handleProjectAction(browseProject, 'open-finder')}
                disabled={!!actionLoading}
                className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--accent)]/20 text-sm text-white disabled:opacity-50"
              >
                {actionLoading === 'open-finder' ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Open in Finder'}
              </button>
              <button
                onClick={() => handleProjectAction(browseProject, 'open-cursor')}
                disabled={!!actionLoading}
                className="flex-1 px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-sm hover:bg-[var(--accent)]/90 disabled:opacity-50"
              >
                {actionLoading === 'open-cursor' ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Open in Cursor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredProjects.length === 0 && !loading && (
        <div className="text-center py-12">
          <FolderOpen className="w-12 h-12 text-[var(--text-secondary)] mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No projects found</h3>
          <p className="text-[var(--text-secondary)]">
            {searchQuery || selectedTech 
              ? 'Try adjusting your search or filter criteria.'
              : 'No projects detected in the workspace.'
            }
          </p>
        </div>
      )}
    </div>
  )
}