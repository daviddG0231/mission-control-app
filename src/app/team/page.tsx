/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useMemo } from 'react'
import { UsersRound, Activity, CheckCircle, Clock, RefreshCw, Zap, Brain } from 'lucide-react'

interface Session {
  key?: string
  label?: string
  model?: string
  totalTokens?: number
  contextTokens?: number
  updatedAt?: number
  kind?: string
}

interface CronJob {
  id?: string
  name?: string
  enabled?: boolean
  schedule?: { kind?: string; expr?: string; tz?: string }
  lastRunAt?: number
}

interface TaskItem {
  id: string
  title: string
  status: string
  assignee?: string
  updatedAt?: string
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function TeamPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [cronJobs, setCronJobs] = useState<CronJob[]>([])
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [sessRes, cronRes, taskRes] = await Promise.allSettled([
        fetch('/api/gateway/sessions'),
        fetch('/api/gateway/cron'),
        fetch('/api/tasks'),
      ])

      if (sessRes.status === 'fulfilled' && sessRes.value.ok) {
        const d = await sessRes.value.json()
        setSessions(d.sessions || d.details?.sessions || [])
      }
      if (cronRes.status === 'fulfilled' && cronRes.value.ok) {
        const d = await cronRes.value.json()
        setCronJobs(d.jobs || d.details?.jobs || [])
      }
      if (taskRes.status === 'fulfilled' && taskRes.value.ok) {
        const d = await taskRes.value.json()
        setTasks(d.tasks || [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  // Derive team members from real sessions
  const teamMembers = useMemo(() => {
    const members: { id: string; name: string; role: string; avatar: string; type: 'human' | 'ai'; model?: string; status: string; lastSeen: string; tokens: number; sessionCount: number }[] = []

    // David is always on the team
    members.push({
      id: 'david', name: 'David', role: 'Human Lead', avatar: '👨‍💻',
      type: 'human', status: 'online', lastSeen: 'now', tokens: 0, sessionCount: 0
    })

    // Group sessions by agent identity
    const agentMap: Record<string, { sessions: Session[]; latestUpdate: number; totalTokens: number }> = {}
    for (const s of sessions) {
      const key = s.key || ''
      let agentName = 'unknown'
      if (key.includes('builder')) agentName = 'patrick'
      else if (key.includes('advisor') || key.includes('dave')) agentName = 'dave'
      else if (key.includes('subagent')) agentName = 'subagent'
      else agentName = 'patrick' // main session = patrick

      if (!agentMap[agentName]) agentMap[agentName] = { sessions: [], latestUpdate: 0, totalTokens: 0 }
      agentMap[agentName].sessions.push(s)
      agentMap[agentName].totalTokens += s.totalTokens || 0
      const upd = Number(s.updatedAt) || 0
      if (upd > agentMap[agentName].latestUpdate) agentMap[agentName].latestUpdate = upd
    }

    if (agentMap['patrick'] || sessions.length > 0) {
      const p = agentMap['patrick'] || { sessions: [], latestUpdate: Date.now(), totalTokens: 0 }
      members.push({
        id: 'patrick', name: 'Patrick 🪼', role: 'AI Builder', avatar: '🪼',
        type: 'ai', model: 'claude-opus-4',
        status: p.latestUpdate > Date.now() - 300000 ? 'active' : 'idle',
        lastSeen: p.latestUpdate ? timeAgo(p.latestUpdate) : 'unknown',
        tokens: p.totalTokens,
        sessionCount: p.sessions.length
      })
    }

    if (agentMap['dave']) {
      const d = agentMap['dave']
      members.push({
        id: 'dave', name: 'Dave 💭', role: 'AI Advisor', avatar: '💭',
        type: 'ai', model: 'claude-sonnet-4',
        status: d.latestUpdate > Date.now() - 300000 ? 'active' : 'idle',
        lastSeen: d.latestUpdate ? timeAgo(d.latestUpdate) : 'unknown',
        tokens: d.totalTokens,
        sessionCount: d.sessions.length
      })
    }

    if (agentMap['subagent']) {
      const sa = agentMap['subagent']
      members.push({
        id: 'subagents', name: 'Sub-Agents', role: `${sa.sessions.length} worker(s)`, avatar: '⚡',
        type: 'ai', model: 'various',
        status: sa.latestUpdate > Date.now() - 300000 ? 'active' : 'idle',
        lastSeen: sa.latestUpdate ? timeAgo(sa.latestUpdate) : 'unknown',
        tokens: sa.totalTokens,
        sessionCount: sa.sessions.length
      })
    }

    return members
  }, [sessions])

  // Activity timeline — persistent log
  const [activities, setActivities] = useState<{
    id: string; summary: string; user: string; model: string; timestamp: number
  }[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [showClearMenu, setShowClearMenu] = useState(false)

  const fetchActivities = async () => {
    try {
      const res = await fetch('/api/activity')
      if (res.ok) {
        const d = await res.json()
        setActivities(d.activities || [])
      }
    } catch { /* ignore */ }
    setActivitiesLoading(false)
  }

  const scanForNew = async () => {
    setScanning(true)
    try {
      const res = await fetch('/api/activity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      if (res.ok) {
        const d = await res.json()
        setActivities(d.activities || [])
      }
    } catch { /* ignore */ }
    setScanning(false)
  }

  const clearHistory = async (period: string) => {
    let cutoff = 0
    const now = Date.now()
    if (period === 'hour') cutoff = now - 3600000
    else if (period === 'day') cutoff = now - 86400000
    else if (period === 'week') cutoff = now - 604800000
    else if (period === 'month') cutoff = now - 2592000000
    else if (period === 'all') cutoff = 0

    // For 'all', cutoff=0 means clear everything
    // For others, keep items BEFORE the cutoff (i.e. older than period)
    // Actually we want to DELETE items within the period, keep older ones
    // No — browser "clear last hour" deletes everything from the last hour
    // So we keep items older than cutoff
    await fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear', cutoff: period === 'all' ? 0 : cutoff })
    })
    setShowClearMenu(false)
    fetchActivities()
  }

  useEffect(() => { fetchActivities() }, [])

  // Real stats
  const stats = useMemo(() => {
    const totalTokens = sessions.reduce((sum, s) => sum + (s.totalTokens || 0), 0)
    const activeSessions = sessions.filter(s => {
      const upd = Number(s.updatedAt) || 0
      return upd > Date.now() - 3600000 // active in last hour
    }).length
    const enabledCrons = cronJobs.filter(j => j.enabled !== false).length
    const doneTasks = tasks.filter(t => t.status === 'done').length

    return { totalTokens, activeSessions, totalSessions: sessions.length, enabledCrons, doneTasks, totalTasks: tasks.length }
  }, [sessions, cronJobs, tasks])

  const formatTokens = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
    return String(n)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <UsersRound className="w-7 h-7" />
            Team
          </h1>
          <p className="text-[var(--text-secondary)] mt-1">Live team status & collaboration</p>
        </div>
        <button
          onClick={fetchAll}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] hover:bg-[var(--bg-hover)] transition text-sm text-[var(--text-secondary)]"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats — all real */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Active Sessions</p>
              <p className="text-2xl font-bold text-white">{stats.activeSessions}</p>
              <p className="text-xs text-[var(--text-secondary)]">{stats.totalSessions} total</p>
            </div>
            <Activity className="w-6 h-6 text-[var(--success)]" />
          </div>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Total Tokens</p>
              <p className="text-2xl font-bold text-white">{formatTokens(stats.totalTokens)}</p>
            </div>
            <Zap className="w-6 h-6 text-[var(--accent)]" />
          </div>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Cron Jobs</p>
              <p className="text-2xl font-bold text-white">{stats.enabledCrons}</p>
              <p className="text-xs text-[var(--text-secondary)]">enabled</p>
            </div>
            <Clock className="w-6 h-6 text-[var(--warning)]" />
          </div>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Tasks Done</p>
              <p className="text-2xl font-bold text-white">{stats.doneTasks}</p>
              <p className="text-xs text-[var(--text-secondary)]">of {stats.totalTasks}</p>
            </div>
            <CheckCircle className="w-6 h-6 text-[var(--success)]" />
          </div>
        </div>
      </div>

      {/* Team Members — dynamic */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Team Members</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teamMembers.map((m) => (
            <div key={m.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4 hover:bg-[var(--bg-hover)] transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{m.avatar}</div>
                  <div>
                    <h3 className="font-semibold text-white">{m.name}</h3>
                    <p className="text-sm text-[var(--text-secondary)]">{m.role}</p>
                    {m.model && <p className="text-xs text-[var(--accent)] mt-0.5">{m.model}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-1 rounded ${
                    m.status === 'online' ? 'bg-green-500/20 text-green-400' :
                    m.status === 'active' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {m.status}
                  </span>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">{m.lastSeen}</p>
                </div>
              </div>
              {m.type === 'ai' && (
                <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <span>{m.sessionCount} session{m.sessionCount !== 1 ? 's' : ''}</span>
                  <span>{formatTokens(m.tokens)} tokens</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Timeline — real sessions */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[var(--accent)]" />
              <h3 className="text-lg font-semibold text-white">Activity Timeline</h3>
              <span className="text-xs text-[var(--text-secondary)]">{activities.length} entries</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={scanForNew}
                disabled={scanning}
                className="text-xs px-2.5 py-1 rounded-md bg-[var(--accent)]/15 text-[var(--accent)] hover:bg-[var(--accent)]/25 transition"
              >
                {scanning ? '🧠 Scanning...' : '+ Scan New'}
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowClearMenu(!showClearMenu)}
                  className="text-xs px-2.5 py-1 rounded-md bg-[var(--danger)]/10 text-[var(--danger)] hover:bg-[var(--danger)]/20 transition"
                >
                  Clear
                </button>
                {showClearMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-xl z-10 py-1 w-40">
                    {[
                      { label: 'Last hour', key: 'hour' },
                      { label: 'Last 24 hours', key: 'day' },
                      { label: 'Last week', key: 'week' },
                      { label: 'Last month', key: 'month' },
                      { label: 'All history', key: 'all' },
                    ].map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => clearHistory(opt.key)}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--bg-hover)] transition ${
                          opt.key === 'all' ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          {activitiesLoading ? (
            <p className="text-sm text-[var(--text-secondary)] text-center py-8">Loading...</p>
          ) : activities.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-[var(--text-secondary)]">No activity yet</p>
              <button onClick={scanForNew} className="text-xs text-[var(--accent)] mt-2 hover:underline">
                Click &quot;Scan New&quot; to fetch recent messages
              </button>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto space-y-0 pr-1" style={{ scrollbarWidth: 'thin' }}>
              {[...activities].reverse().map((a) => (
                <div key={a.id} className="flex items-start gap-3 py-2.5 border-b border-[var(--border)] last:border-b-0">
                  <div className="w-2 h-2 bg-[var(--accent)] rounded-full mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--text-primary)]/80 italic">
                      &ldquo;{a.summary}&rdquo;
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--text-secondary)]">
                      <span>{a.user}</span>
                      <span>•</span>
                      <span>{timeAgo(a.timestamp)}</span>
                      {a.model && (
                        <>
                          <span>•</span>
                          <span className="text-[var(--accent)]">{a.model}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Team Performance — real data */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="text-lg font-semibold text-white">Team Performance</h3>
          </div>
          <div className="space-y-4">
            {/* Task completion rate */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-[var(--text-secondary)]">Task Completion</span>
                <span className="text-sm font-medium text-white">
                  {stats.totalTasks > 0 ? Math.round((stats.doneTasks / stats.totalTasks) * 100) : 0}%
                </span>
              </div>
              <div className="h-2 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--success)] rounded-full transition-all"
                  style={{ width: `${stats.totalTasks > 0 ? (stats.doneTasks / stats.totalTasks) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">{stats.doneTasks} of {stats.totalTasks} tasks</p>
            </div>

            {/* Session utilization */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-[var(--text-secondary)]">Session Utilization</span>
                <span className="text-sm font-medium text-white">
                  {stats.totalSessions > 0 ? Math.round((stats.activeSessions / stats.totalSessions) * 100) : 0}%
                </span>
              </div>
              <div className="h-2 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] rounded-full transition-all"
                  style={{ width: `${stats.totalSessions > 0 ? (stats.activeSessions / stats.totalSessions) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">{stats.activeSessions} active of {stats.totalSessions}</p>
            </div>

            {/* Cron health */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-[var(--text-secondary)]">Cron Jobs Healthy</span>
                <span className="text-sm font-medium text-white">
                  {stats.enabledCrons} / {cronJobs.length}
                </span>
              </div>
              <div className="h-2 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--warning)] rounded-full transition-all"
                  style={{ width: `${cronJobs.length > 0 ? (stats.enabledCrons / cronJobs.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Token distribution per member */}
            <div className="pt-3 border-t border-[var(--border)]">
              <p className="text-sm text-[var(--text-secondary)] mb-3">Token Distribution</p>
              {teamMembers.filter(m => m.type === 'ai' && m.tokens > 0).map(m => {
                const totalAi = teamMembers.filter(x => x.type === 'ai').reduce((s, x) => s + x.tokens, 0)
                const pct = totalAi > 0 ? (m.tokens / totalAi) * 100 : 0
                return (
                  <div key={m.id} className="mb-2">
                    <div className="flex items-center justify-between mb-1 text-xs">
                      <span className="text-[var(--text-primary)]">{m.name}</span>
                      <span className="text-[var(--text-secondary)]">{formatTokens(m.tokens)} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-1.5 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--accent)]/60 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Team Rules from AGENTS.md */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-5">
        <h3 className="text-lg font-semibold text-white mb-3">Working Agreements</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {[
            'Always communicate progress and blockers clearly',
            'Test thoroughly before reporting tasks as complete',
            'Suggest next steps when finishing current work',
            'Share knowledge and learnings with the team',
            'Respect human oversight and ask when uncertain',
            'No silent background work — tell David what you did',
          ].map((rule, i) => (
            <div key={i} className="flex items-start gap-2 py-1">
              <CheckCircle className="w-3.5 h-3.5 text-[var(--success)] mt-0.5 flex-shrink-0" />
              <p className="text-xs text-[var(--text-secondary)]">{rule}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
