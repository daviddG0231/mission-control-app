'use client'

import { useState } from 'react'
import { useGatewayData } from '@/hooks/use-gateway'
import { clearGatewayCache } from '@/hooks/use-gateway'
import { MessageSquare, RefreshCw, Clock, Bot, User, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import { cn, timeAgo } from '@/lib/utils'

interface Session {
  key: string
  sessionKey?: string
  kind?: string
  agentId?: string
  label?: string
  displayName?: string
  channel?: string
  model?: string
  updatedAt?: number
  totalTokens?: number
  messages?: Array<{ role: string; content: Array<{ type: string; text?: string }> }>
}

interface SessionsResponse {
  count?: number
  sessions?: Session[]
  result?: Session[]
}

interface ConfigAgent {
  id: string
  name?: string
  identity?: { name?: string; emoji?: string }
}

interface ConfigResponse {
  agents?: { list?: ConfigAgent[] }
}

interface Subagent {
  sessionKey?: string
  label?: string
  task?: string
  status?: string
}

interface SubagentsResponse {
  sessions?: Subagent[]
  result?: { sessions?: Subagent[] }
}

const EMOJI_MAP: Record<string, string> = { builder: '🪼', advisor: '💭', main: '🦑' }

export default function SessionsPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [task, setTask] = useState('')
  const [runtime, setRuntime] = useState<'subagent' | 'acp'>('subagent')
  const [mode, setMode] = useState<'run' | 'session'>('session')
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([])
  const [spawnLoading, setSpawnLoading] = useState(false)
  const [spawnError, setSpawnError] = useState<string | null>(null)
  const [spawnSuccess, setSpawnSuccess] = useState(false)

  const { data, loading, error, refetch } = useGatewayData<SessionsResponse>(
    '/api/gateway/sessions',
    15000
  )
  const { data: subData, refetch: refetchSubagents } = useGatewayData<SubagentsResponse>(
    '/api/gateway/subagents',
    15000
  )
  const { data: configData } = useGatewayData<ConfigResponse>('/api/gateway/config', 60000)

  const mainSessions: Session[] = data?.sessions || data?.result || []
  const subagents: Subagent[] = subData?.sessions || subData?.result?.sessions || []

  // Merge main sessions + subagents (spawned sessions appear as subagents)
  const mainKeys = new Set(mainSessions.map((s) => s.key || s.sessionKey).filter(Boolean))
  const sessions: Session[] = [
    ...mainSessions,
    ...subagents
      .filter((s) => s.sessionKey && !mainKeys.has(s.sessionKey))
      .map((s) => ({
        key: s.sessionKey!,
        sessionKey: s.sessionKey,
        label: s.label || s.task || s.sessionKey,
        displayName: s.label || s.task || s.sessionKey,
        kind: 'subagent',
      })),
  ]
  const agents: ConfigAgent[] = configData?.agents?.list || []

  const toggleAgent = (id: string) => {
    setSelectedAgentIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    )
  }

  const handleSpawn = async () => {
    if (!task.trim()) return
    setSpawnLoading(true)
    setSpawnError(null)
    setSpawnSuccess(false)
    try {
      const res = await fetch('/api/gateway/sessions/spawn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: task.trim(),
          runtime,
          mode,
          agentIds: selectedAgentIds.length > 0 ? selectedAgentIds : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setTask('')
      setShowCreate(false)
      setSpawnSuccess(true)
      clearGatewayCache('/api/gateway/sessions')
      clearGatewayCache('/api/gateway/subagents')
      refetch()
      refetchSubagents()
      // Spawn is often async — refetch again after delay so the new session appears
      setTimeout(() => {
        clearGatewayCache('/api/gateway/sessions')
        clearGatewayCache('/api/gateway/subagents')
        refetch()
        refetchSubagents()
        setSpawnSuccess(false)
      }, 2500)
    } catch (err) {
      setSpawnError(err instanceof Error ? err.message : 'Failed to spawn session')
    } finally {
      setSpawnLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <MessageSquare className="w-6 h-6 text-[var(--accent)]" />
            Sessions
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            All active and recent OpenClaw sessions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Session
          </button>
          <button
            onClick={() => { refetch(); refetchSubagents() }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] hover:bg-[var(--bg-hover)] transition text-sm text-[var(--text-secondary)]"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Create New Session Form */}
      {showCreate && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Create New Session</h2>
            <button
              onClick={() => setShowCreate(false)}
              className="text-[var(--text-secondary)] hover:text-white transition"
            >
              {showCreate ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Task</label>
              <textarea
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="What should the agent do? e.g. Write a Python script for data analysis"
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-white placeholder:text-[var(--text-secondary)]/60 focus:outline-none focus:border-[var(--accent)] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Runtime</label>
              <select
                value={runtime}
                onChange={(e) => setRuntime(e.target.value as 'subagent' | 'acp')}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-white focus:outline-none focus:border-[var(--accent)] text-sm"
              >
                <option value="subagent">subagent — General-purpose</option>
                <option value="acp">acp — Coding / specialized</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Mode</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'run' | 'session')}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-white focus:outline-none focus:border-[var(--accent)] text-sm"
              >
                <option value="run">run — One-shot task</option>
                <option value="session">session — Persistent (thread)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-2">Agents in this session</label>
            <div className="flex flex-wrap gap-2">
              {agents.length === 0 ? (
                <p className="text-xs text-[var(--text-secondary)]">No agents in config</p>
              ) : (
                agents.map((agent) => {
                  const emoji = agent.identity?.emoji || EMOJI_MAP[agent.id] || '🤖'
                  const name = agent.identity?.name || agent.name || agent.id
                  const checked = selectedAgentIds.includes(agent.id)
                  return (
                    <label
                      key={agent.id}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition text-sm',
                        checked
                          ? 'bg-[var(--accent)]/15 border-[var(--accent)] text-white shadow-[0_0_12px_var(--accent)]'
                          : 'bg-[var(--bg)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border)]/80'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAgent(agent.id)}
                        className="sr-only"
                      />
                      <span>{emoji}</span>
                      <span>{name}</span>
                    </label>
                  )
                })
              )}
            </div>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1.5">
              Select which agents participate. Primary agent (first selected) runs the task.
            </p>
          </div>
          {spawnError && (
            <div className="text-sm text-[var(--danger)] bg-[var(--danger)]/10 px-3 py-2 rounded-lg">
              {spawnError}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowCreate(false)}
              className="px-3 py-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSpawn}
              disabled={spawnLoading || !task.trim()}
              className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 text-sm font-medium"
            >
              {spawnLoading ? 'Spawning…' : 'Create Session'}
            </button>
          </div>
        </div>
      )}

      {/* Spawn success */}
      {spawnSuccess && (
        <div className="flex items-center gap-2 rounded-lg bg-[var(--success)]/15 border border-[var(--success)]/40 px-4 py-3 text-sm text-[var(--success)]">
          <span>Session spawned. Refreshing list…</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded-lg p-4">
          <p className="text-sm text-[var(--danger)]">⚠️ Gateway Error: {error}</p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Make sure the gateway is running on port 18789 and the token is set in .env.local
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-[var(--bg-hover)] rounded w-1/3 mb-3" />
              <div className="h-3 bg-[var(--bg-hover)] rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {/* Sessions List */}
      {!loading && sessions.length === 0 && !error && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-12 text-center">
          <MessageSquare className="w-10 h-10 text-[var(--text-secondary)] mx-auto mb-3 opacity-40" />
          <p className="text-sm text-[var(--text-secondary)]">No sessions found</p>
        </div>
      )}

      <div className="space-y-3">
        {sessions.map((session) => {
          const isSubagent = session.key?.includes('subagent')
          const lastMsg = session.messages?.[0]
          const textContent = lastMsg?.content?.find((c: { type: string; text?: string }) => c.type === 'text')?.text
          return (
            <div
              key={session.key}
              className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--accent)]/30 transition group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--accent)]/15 flex items-center justify-center">
                    {isSubagent ? (
                      <Bot className="w-5 h-5 text-[var(--accent)]" />
                    ) : (
                      <User className="w-5 h-5 text-[var(--accent)]" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {session.label || session.displayName || session.key}
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                      {session.model && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--success)]/15 text-[var(--success)]">
                          {session.model}
                        </span>
                      )}
                      {session.channel && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--warning)]/15 text-[var(--warning)]">
                          {session.channel}
                        </span>
                      )}
                      {session.totalTokens && (
                        <span className="text-[10px] text-[var(--text-secondary)]">
                          {(session.totalTokens / 1000).toFixed(0)}k tokens
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {session.updatedAt && (
                  <div className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
                    <Clock className="w-3 h-3" />
                    {timeAgo(new Date(session.updatedAt))}
                  </div>
                )}
              </div>

              {textContent && (
                <div className="mt-3 pl-[52px]">
                  <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                    {textContent.slice(0, 200)}
                    {textContent.length > 200 ? '...' : ''}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
