'use client'

import { useGatewayData } from '@/hooks/use-gateway'
import { LayoutDashboard, Bot, MessageSquare, Clock, Zap } from 'lucide-react'
import LiveActivity from '@/components/live-activity'
import Link from 'next/link'

interface SessionsResponse {
  sessions?: unknown[]
  result?: unknown[]
}

interface SubagentsResponse {
  sessions?: unknown[]
  result?: { sessions?: unknown[] }
}

interface CronResponse {
  jobs?: unknown[]
  result?: { jobs?: unknown[] }
}

interface AgentInfo {
  id: string
  name?: string
  identity?: { name?: string; emoji?: string }
  model?: { primary?: string }
}

interface ConfigResponse {
  agents?: { list?: AgentInfo[] }
}

export default function DashboardPage() {
  const { data: sessionsData } = useGatewayData<SessionsResponse>('/api/gateway/sessions', 15000)
  const { data: subagentsData } = useGatewayData<SubagentsResponse>('/api/gateway/subagents', 15000)
  const { data: cronData } = useGatewayData<CronResponse>('/api/gateway/cron', 30000)
  const { data: configData } = useGatewayData<ConfigResponse>('/api/gateway/config', 60000)
  const { data: officeAgentsData } = useGatewayData<{ agents?: Array<{ id: string; name: string; emoji: string; status: string; isSubagent?: boolean }> }>('/api/office/agents', 15000)

  const sessionCount = (sessionsData?.sessions || sessionsData?.result || []).length
  const subagentCount = (subagentsData?.sessions || subagentsData?.result?.sessions || []).length
  const cronCount = (cronData?.jobs || cronData?.result?.jobs || []).length
  const agentCount = configData?.agents?.list?.length ?? 0
  const mainAgents = (officeAgentsData?.agents || []).filter(a => !a.isSubagent)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Real-time overview of your OpenClaw system
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
          <span className="text-sm text-[var(--text-secondary)]">Live</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Sessions', value: sessionCount, icon: MessageSquare, color: 'var(--accent)', href: '/sessions' },
          { label: 'Agents', value: agentCount, icon: Bot, color: 'var(--success)', href: '/agents' },
          { label: 'Sub-agents', value: subagentCount, icon: Zap, color: 'var(--warning)', href: '/agents' },
          { label: 'Cron Jobs', value: cronCount, icon: Clock, color: '#ec4899', href: '/cron' },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--accent)]/30 transition group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">{stat.label}</span>
                <Icon className="w-4 h-4" style={{ color: stat.color }} />
              </div>
              <div className="text-3xl font-bold text-white group-hover:text-[var(--accent-hover)] transition">{stat.value}</div>
            </Link>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Agents */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
              <Bot className="w-4 h-4 text-[var(--accent)]" />
              <h2 className="text-sm font-semibold text-white">Team</h2>
            </div>
            <div className="p-5 space-y-3">
              {(mainAgents.length > 0
                ? mainAgents.map(a => ({
                    name: a.name,
                    emoji: a.emoji,
                    model: '',
                    status: a.status === 'typing' || a.status === 'reading' ? 'active' : a.status === 'waiting' ? 'waiting' : 'idle',
                  }))
                : (configData?.agents?.list || []).map(a => ({
                    name: a.identity?.name || a.name || a.id,
                    emoji: a.identity?.emoji || '🤖',
                    model: (a.model?.primary || '').split('/').pop() || '',
                    status: 'idle' as const,
                  }))
              ).map((agent) => (
                <div key={agent.name} className="flex items-center gap-4 p-3 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--border)]/20 transition">
                  <span className="text-2xl">{agent.emoji}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{agent.name}</span>
                    </div>
                    {agent.model && <span className="text-xs text-[var(--text-secondary)]">{agent.model}</span>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${
                      agent.status === 'active' ? 'bg-[var(--success)] animate-pulse' :
                      agent.status === 'waiting' ? 'bg-[var(--warning)]' :
                      'bg-[var(--text-secondary)]'
                    }`} />
                    <span className="text-xs text-[var(--text-secondary)] capitalize">{agent.status}</span>
                  </div>
                </div>
              ))}
              {agentCount === 0 && (
                <p className="text-sm text-[var(--text-secondary)]">No agents configured</p>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
            <div className="px-5 py-4 border-b border-[var(--border)]">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4 text-[var(--accent)]" />
                Quick Navigation
              </h2>
            </div>
            <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Sessions', icon: '💬', href: '/sessions' },
                { label: 'Agents', icon: '🤖', href: '/agents' },
                { label: 'Tasks', icon: '📋', href: '/tasks' },
                { label: 'Memory', icon: '🧠', href: '/memory' },
              ].map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--border)]/30 transition text-center"
                >
                  <span className="text-2xl">{action.icon}</span>
                  <span className="text-xs text-[var(--text-secondary)]">{action.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Live Activity */}
        <LiveActivity />
      </div>
    </div>
  )
}
