'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Brain,
  FileText,
  FolderOpen,
  Heart,
  Laugh,
  GraduationCap,
  BookOpen,
  Users,
  Search,
  RefreshCw,
  ChevronRight,
  Calendar,
  Sparkles,
  Star,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = 'overview' | 'projects' | 'timeline' | 'skills' | 'growth' | 'personality' | 'relationship' | 'team' | 'files'

interface BrainData {
  brainFiles: string[]
  dailyFiles: string[]
  masterIndex: string
  projectsContent: string
  personalityContent: string
  usContent: string
  skillsContent: string
  growthContent: string
  mainMemory: string
  stats: {
    brainFileCount: number
    dailyFileCount: number
    projectCount: number
    jokeCount: number
    milestoneCount: number
    skillsTaught: number
    growthLessons: number
  }
}

const TABS: { id: Tab; label: string; icon: typeof Brain }[] = [
  { id: 'overview', label: 'Overview', icon: Brain },
  { id: 'projects', label: 'Projects', icon: FolderOpen },
  { id: 'timeline', label: 'Timeline', icon: Calendar },
  { id: 'skills', label: 'Skills Taught', icon: GraduationCap },
  { id: 'growth', label: 'Self-Study', icon: BookOpen },
  { id: 'personality', label: 'Personality', icon: Sparkles },
  { id: 'relationship', label: 'Us', icon: Heart },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'files', label: 'All Files', icon: FileText },
]

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Brain; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', color)}>
          <Icon className="w-4.5 h-4.5 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-xs text-[var(--text-secondary)]">{label}</p>
        </div>
      </div>
    </div>
  )
}

function MarkdownBlock({ content, className }: { content: string; className?: string }) {
  // Simple markdown renderer for headings, bold, lists, code
  const lines = content.split('\n')
  return (
    <div className={cn('space-y-1', className)}>
      {lines.map((line, i) => {
        if (line.startsWith('# ')) return <h1 key={i} className="text-xl font-bold text-white mt-4 mb-2">{line.slice(2)}</h1>
        if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-semibold text-white mt-4 mb-1.5 border-b border-[var(--border)]/50 pb-1">{line.slice(3)}</h2>
        if (line.startsWith('### ')) return <h3 key={i} className="text-base font-medium text-[var(--accent)] mt-3 mb-1">{line.slice(4)}</h3>
        if (line.startsWith('#### ')) return <h4 key={i} className="text-sm font-medium text-white/80 mt-2">{line.slice(5)}</h4>
        if (line.startsWith('- ✅') || line.startsWith('- [x]')) return <p key={i} className="text-sm text-green-400 pl-3">✅ {line.replace(/^- (\[x\]|✅)\s*/, '')}</p>
        if (line.startsWith('- ❌') || line.startsWith('- [ ]')) return <p key={i} className="text-sm text-[var(--text-secondary)] pl-3">⬜ {line.replace(/^- (\[ \]|❌)\s*/, '')}</p>
        if (line.startsWith('- ')) return <p key={i} className="text-sm text-[var(--text-primary)] pl-3">• {line.slice(2)}</p>
        if (line.startsWith('```')) return <div key={i} className="border-t border-[var(--border)]/30 my-1" />
        if (line.startsWith('|')) return <p key={i} className="text-xs text-[var(--text-secondary)] font-mono">{line}</p>
        if (line.startsWith('>')) return <p key={i} className="text-sm text-[var(--text-secondary)] italic border-l-2 border-[var(--accent)]/30 pl-3">{line.slice(2)}</p>
        if (line.trim() === '---') return <hr key={i} className="border-[var(--border)]/30 my-3" />
        if (line.trim() === '') return <div key={i} className="h-1" />
        // Bold text
        const boldLine = line.replace(/\*\*(.*?)\*\*/g, '<b class="text-white font-semibold">$1</b>')
        return <p key={i} className="text-sm text-[var(--text-primary)]" dangerouslySetInnerHTML={{ __html: boldLine }} />
      })}
    </div>
  )
}

function parseProjects(content: string) {
  const projects: { name: string; date: string; status: string; stack: string; memorable: string }[] = []
  const sections = content.split(/^## \d+\./gm).slice(1)
  for (const section of sections) {
    const lines = section.trim().split('\n')
    const name = lines[0]?.replace(/[*#]/g, '').trim() || 'Unknown'
    const date = lines.find(l => l.includes('**Date**'))?.replace(/.*\*\*Date\*\*:\s*/, '').trim() || ''
    const status = lines.find(l => l.includes('**Status**'))?.replace(/.*\*\*Status\*\*:\s*/, '').trim() || ''
    const stack = lines.find(l => l.includes('**Stack'))?.replace(/.*\*\*Stack.*?\*\*:\s*/, '').trim() || ''
    const memorable = lines.find(l => l.includes('**Memorable**'))?.replace(/.*\*\*Memorable\*\*:\s*/, '').trim() || ''
    projects.push({ name, date, status, stack, memorable })
  }
  return projects
}

function parseJokes(content: string) {
  const jokes: { joke: string; context: string; date: string }[] = []
  const jokeSection = content.split('## Our Inside Jokes')[1]?.split('\n## ')[0] || ''
  const lines = jokeSection.split('\n').filter(l => l.startsWith('- **'))
  for (const line of lines) {
    const match = line.match(/- \*\*"(.*?)"\*\*\s*—\s*(.*?)\s*\(([^)]+)\)/)
    if (match) jokes.push({ joke: match[1], context: match[2], date: match[3] })
  }
  return jokes
}

function parseMilestones(content: string) {
  const milestones: { title: string; description: string }[] = []
  const lines = content.split('\n')
  let current: { title: string; description: string } | null = null
  for (const line of lines) {
    if (line.startsWith('### ')) {
      if (current) milestones.push(current)
      current = { title: line.slice(4), description: '' }
    } else if (current && line.startsWith('-') || (current && line.trim().length > 0 && !line.startsWith('#'))) {
      current.description += (current.description ? '\n' : '') + line
    }
  }
  if (current) milestones.push(current)
  return milestones
}

function parseSkills(content: string) {
  const skills: { date: string; topic: string; category: string }[] = []
  const sections = content.split(/^## /gm).slice(1)
  for (const section of sections) {
    const lines = section.trim().split('\n')
    const header = lines[0] || ''
    const dateMatch = header.match(/(March \d+, 2026|February \d+, 2026)/)
    const topicMatch = header.match(/- (.+)/)
    const date = dateMatch?.[1] || ''
    const topic = topicMatch?.[1] || header.replace(dateMatch?.[0] || '', '').replace(/^[\s-]+/, '').trim()
    const focusLine = lines.find(l => l.includes('**Focus**'))
    const category = focusLine?.includes('frontend') ? 'Frontend' :
      focusLine?.includes('security') ? 'Security' :
      focusLine?.includes('pricing') ? 'Business' :
      focusLine?.includes('database') ? 'Backend' :
      focusLine?.includes('testing') ? 'QA' :
      focusLine?.includes('automation') ? 'Business' : 'Dev'
    if (topic) skills.push({ date, topic, category })
  }
  return skills
}

export default function BrainPage() {
  const [data, setData] = useState<BrainData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState('')
  const [fileLoading, setFileLoading] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/gateway/brain')
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  async function loadFile(path: string) {
    setSelectedFile(path)
    setFileLoading(true)
    try {
      const res = await fetch(`/api/gateway/brain?file=${encodeURIComponent(path)}`)
      const d = await res.json()
      setFileContent(d.content || 'Failed to load')
    } catch {
      setFileContent('Error loading file')
    } finally {
      setFileLoading(false)
    }
  }

  const projects = useMemo(() => data?.projectsContent ? parseProjects(data.projectsContent) : [], [data])
  const jokes = useMemo(() => data?.personalityContent ? parseJokes(data.personalityContent) : [], [data])
  const milestones = useMemo(() => data?.usContent ? parseMilestones(data.usContent) : [], [data])
  const skills = useMemo(() => data?.skillsContent ? parseSkills(data.skillsContent) : [], [data])

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-6 h-6 animate-spin text-[var(--accent)]" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6 text-center">
        <Brain className="w-10 h-10 text-[var(--text-secondary)] mx-auto mb-3 opacity-30" />
        <p className="text-sm text-[var(--text-secondary)]">Failed to load brain data</p>
      </div>
    )
  }

  return (
    <div className="p-3 md:p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Brain className="w-6 h-6 text-purple-400" />
          Patrick&apos;s Brain
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Master index of everything I know — {data.stats.brainFileCount + data.stats.dailyFileCount} files indexed
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setSelectedFile(null) }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition',
                tab === t.id
                  ? 'bg-purple-500/15 text-purple-400 ring-1 ring-purple-500/30'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="space-y-5">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={FolderOpen} label="Projects Built" value={`${projects.length}+`} color="bg-blue-500/20" />
            <StatCard icon={Calendar} label="Days Active" value={data.stats.dailyFileCount} color="bg-green-500/20" />
            <StatCard icon={GraduationCap} label="Skills Taught" value={skills.length} color="bg-amber-500/20" />
            <StatCard icon={BookOpen} label="Self-Study Lessons" value={data.stats.growthLessons} color="bg-purple-500/20" />
          </div>

          {/* Quick sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Recent Timeline */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-purple-400" />
                Recent Memory Files
              </h3>
              <div className="space-y-1.5">
                {data.dailyFiles.slice(0, 8).map(f => (
                  <button
                    key={f}
                    onClick={() => { setTab('files'); loadFile(`memory/${f}`) }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white transition text-left"
                  >
                    <FileText className="w-3 h-3 shrink-0" />
                    {f.replace('.md', '')}
                    <ChevronRight className="w-3 h-3 ml-auto opacity-40" />
                  </button>
                ))}
              </div>
            </div>

            {/* Inside Jokes */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                <Laugh className="w-4 h-4 text-amber-400" />
                Inside Jokes
              </h3>
              <div className="space-y-2">
                {jokes.slice(0, 6).map((j, i) => (
                  <div key={i} className="text-xs">
                    <span className="text-amber-400 font-medium">&ldquo;{j.joke}&rdquo;</span>
                    <span className="text-[var(--text-secondary)]"> — {j.context}</span>
                  </div>
                ))}
                {jokes.length === 0 && (
                  <p className="text-xs text-[var(--text-secondary)]">Parsing jokes from personality.md...</p>
                )}
              </div>
            </div>

            {/* Milestones */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                <Heart className="w-4 h-4 text-pink-400" />
                Relationship Milestones
              </h3>
              <div className="space-y-2">
                {milestones.slice(0, 6).map((m, i) => (
                  <div key={i} className="text-xs">
                    <span className="text-pink-400 font-medium">{m.title}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Brain Files */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                <Brain className="w-4 h-4 text-purple-400" />
                Brain Files
              </h3>
              <div className="space-y-1.5">
                {data.brainFiles.map(f => (
                  <button
                    key={f}
                    onClick={() => { setTab('files'); loadFile(`patrick-brain/${f}`) }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white transition text-left"
                  >
                    <FileText className="w-3 h-3 shrink-0" />
                    {f.replace('.md', '')}
                    <ChevronRight className="w-3 h-3 ml-auto opacity-40" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Projects Tab */}
      {tab === 'projects' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="w-full pl-9 pr-3 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg text-sm text-white outline-none focus:ring-1 focus:ring-purple-500/50 placeholder:text-[var(--text-secondary)]"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {projects
              .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.stack.toLowerCase().includes(search.toLowerCase()))
              .map((p, i) => (
              <div key={i} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 hover:border-purple-500/30 transition">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white">{p.name}</h3>
                  <span className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0',
                    p.status.includes('Active') ? 'bg-amber-500/15 text-amber-400' :
                    p.status.includes('Complete') ? 'bg-green-500/15 text-green-400' :
                    p.status.includes('Running') ? 'bg-blue-500/15 text-blue-400' :
                    'bg-[var(--bg-hover)] text-[var(--text-secondary)]'
                  )}>
                    {p.status.replace(/[🟡✅🟢🔴]/g, '').trim().slice(0, 12)}
                  </span>
                </div>
                {p.date && <p className="text-[10px] text-[var(--text-secondary)] mt-1">{p.date}</p>}
                {p.stack && <p className="text-xs text-purple-400/70 mt-1.5 font-mono">{p.stack.slice(0, 60)}</p>}
                {p.memorable && <p className="text-xs text-[var(--text-secondary)] mt-2 italic">{p.memorable.slice(0, 100)}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline Tab */}
      {tab === 'timeline' && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 max-h-[700px] overflow-y-auto">
          <MarkdownBlock content={data.masterIndex.split('## 📅 TIMELINE')[1]?.split('\n---')[0] || 'No timeline data'} />
        </div>
      )}

      {/* Skills Taught Tab */}
      {tab === 'skills' && (
        <div className="space-y-3">
          {skills.map((s, i) => (
            <div key={i} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 flex items-center gap-3">
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                s.category === 'Frontend' ? 'bg-blue-500/15' :
                s.category === 'Backend' ? 'bg-green-500/15' :
                s.category === 'Security' ? 'bg-red-500/15' :
                s.category === 'Business' ? 'bg-amber-500/15' :
                s.category === 'QA' ? 'bg-purple-500/15' :
                'bg-cyan-500/15'
              )}>
                <GraduationCap className={cn(
                  'w-4 h-4',
                  s.category === 'Frontend' ? 'text-blue-400' :
                  s.category === 'Backend' ? 'text-green-400' :
                  s.category === 'Security' ? 'text-red-400' :
                  s.category === 'Business' ? 'text-amber-400' :
                  s.category === 'QA' ? 'text-purple-400' :
                  'text-cyan-400'
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{s.topic}</p>
                <p className="text-[10px] text-[var(--text-secondary)]">{s.date}</p>
              </div>
              <span className={cn(
                'text-[10px] px-2 py-0.5 rounded-full font-medium',
                s.category === 'Frontend' ? 'bg-blue-500/15 text-blue-400' :
                s.category === 'Backend' ? 'bg-green-500/15 text-green-400' :
                s.category === 'Security' ? 'bg-red-500/15 text-red-400' :
                s.category === 'Business' ? 'bg-amber-500/15 text-amber-400' :
                'bg-cyan-500/15 text-cyan-400'
              )}>
                {s.category}
              </span>
            </div>
          ))}
          {skills.length === 0 && <p className="text-sm text-[var(--text-secondary)] text-center py-8">No skills parsed</p>}
        </div>
      )}

      {/* Growth / Self-Study Tab */}
      {tab === 'growth' && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 max-h-[700px] overflow-y-auto">
          <MarkdownBlock content={data.masterIndex.split('## 📚 PATRICK\'S SELF-STUDY')[1]?.split('\n---')[0] || 'No growth data'} />
        </div>
      )}

      {/* Personality Tab */}
      {tab === 'personality' && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 max-h-[700px] overflow-y-auto">
          <MarkdownBlock content={data.personalityContent} />
        </div>
      )}

      {/* Relationship Tab */}
      {tab === 'relationship' && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 max-h-[700px] overflow-y-auto">
          <MarkdownBlock content={data.usContent} />
        </div>
      )}

      {/* Team Tab */}
      {tab === 'team' && (
        <div className="space-y-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5">
            <MarkdownBlock content={data.masterIndex.split('## 🤝 TEAM')[1]?.split('\n---')[0] || 'No team data'} />
          </div>
        </div>
      )}

      {/* Files Tab */}
      {tab === 'files' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[600px]">
          {/* File list */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl flex flex-col max-h-[700px]">
            <div className="px-3 py-2.5 border-b border-[var(--border)]">
              <p className="text-xs font-semibold text-purple-400 mb-2">Patrick Brain</p>
              <div className="space-y-0.5">
                {data.brainFiles.map(f => (
                  <button
                    key={f}
                    onClick={() => loadFile(`patrick-brain/${f}`)}
                    className={cn(
                      'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition text-left',
                      selectedFile === `patrick-brain/${f}`
                        ? 'bg-purple-500/15 text-purple-400'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white'
                    )}
                  >
                    <Brain className="w-3 h-3 shrink-0" />
                    {f.replace('.md', '')}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2.5">
              <p className="text-xs font-semibold text-blue-400 mb-2">Daily Memory</p>
              <div className="space-y-0.5">
                <button
                  onClick={() => loadFile('MEMORY.md')}
                  className={cn(
                    'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition text-left',
                    selectedFile === 'MEMORY.md'
                      ? 'bg-blue-500/15 text-blue-400'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white'
                  )}
                >
                  <Star className="w-3 h-3 shrink-0" />
                  MEMORY.md
                </button>
                {data.dailyFiles.map(f => (
                  <button
                    key={f}
                    onClick={() => loadFile(`memory/${f}`)}
                    className={cn(
                      'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition text-left',
                      selectedFile === `memory/${f}`
                        ? 'bg-blue-500/15 text-blue-400'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white'
                    )}
                  >
                    <FileText className="w-3 h-3 shrink-0" />
                    {f.replace('.md', '')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Content viewer */}
          <div className="lg:col-span-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl flex flex-col max-h-[700px]">
            <div className="px-5 py-3 border-b border-[var(--border)] flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-white">
                {selectedFile || 'Select a file'}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {fileLoading && (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-5 h-5 animate-spin text-[var(--text-secondary)]" />
                </div>
              )}
              {!selectedFile && !fileLoading && (
                <div className="text-center py-16">
                  <Brain className="w-10 h-10 text-[var(--text-secondary)] mx-auto mb-3 opacity-20" />
                  <p className="text-sm text-[var(--text-secondary)]">Select a file to view</p>
                </div>
              )}
              {selectedFile && !fileLoading && (
                <MarkdownBlock content={fileContent} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
