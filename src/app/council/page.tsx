'use client'

import { useGatewayData } from '@/hooks/use-gateway'
import { Users, MessageSquare, Calendar, Zap, RefreshCw, Brain, Target, Handshake } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Session {
  key: string
  label: string
  model: string
  updatedAt: string
  totalTokens: number
}

interface SessionsResponse {
  sessions: Session[]
}

interface AgentInfo {
  id: string
  name: string
  model?: { primary?: string }
  identity?: { name?: string; emoji?: string }
  workspace?: string
}

interface ConfigResponse {
  agents?: {
    list?: AgentInfo[]
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

const ROLE_MAP: Record<string, string> = {
  builder:  'CEO & Orchestrator',
  cto:      'CTO — Architecture & Tech Strategy',
  coo:      'COO — Operations & Process',
  backend:  'Backend Developer',
  frontend: 'Frontend Developer',
  qa:       'QA Engineer',
}

const DEFAULT_DESCRIPTION: Record<string, string> = {
  builder:  'Leads the team, orchestrates work streams, and ensures mission success',
  cto:      'Owns architecture decisions, tech strategy, and engineering excellence',
  coo:      'Keeps operations running smoothly — process, planning, and execution',
  backend:  'Builds robust APIs, data pipelines, and server-side systems',
  frontend: 'Crafts beautiful, responsive UIs with pixel-perfect precision',
  qa:       'Ensures quality at every step — testing, review, and bug hunting',
}

const STRENGTHS_MAP: Record<string, string[]> = {
  builder:  ['Orchestration', 'Strategy', 'Coordination'],
  cto:      ['Architecture', 'Tech Strategy', 'Engineering'],
  coo:      ['Operations', 'Planning', 'Process'],
  backend:  ['APIs', 'Databases', 'Performance'],
  frontend: ['UI/UX', 'React', 'Animations'],
  qa:       ['Testing', 'Quality', 'Review'],
}

const EMOJI_MAP: Record<string, string> = {
  builder:  '🪼',
  cto:      '🖥️',
  coo:      '📋',
  backend:  '⚙️',
  frontend: '🎨',
  qa:       '🔍',
}

const COLOR_MAP: Record<string, string> = {
  builder:  'var(--accent)',
  cto:      '#3b82f6',
  coo:      '#8b5cf6',
  backend:  '#f59e0b',
  frontend: '#ec4899',
  qa:       'var(--success)',
}

const COUNCIL_PRINCIPLES = [
  {
    icon: Brain,
    title: 'Collective Intelligence',
    description: 'Multiple perspectives lead to better decisions and reduced blind spots'
  },
  {
    icon: Target,
    title: 'Aligned Goals',
    description: 'All council members work toward shared objectives and user success'
  },
  {
    icon: Handshake,
    title: 'Collaborative Debate',
    description: 'Healthy disagreement and discussion strengthen final outcomes'
  },
  {
    icon: Zap,
    title: 'Decisive Action',
    description: 'Council deliberation leads to clear decisions and swift implementation'
  }
]

export default function CouncilPage() {
  const { data: sessionsData, loading: sessionsLoading, refetch: refetchSessions } = useGatewayData<SessionsResponse>('/api/gateway/sessions', 30000)
  const { data: configData, loading: configLoading, refetch: refetchConfig } = useGatewayData<ConfigResponse>('/api/gateway/config', 60000)

  const agents: AgentInfo[] = configData?.agents?.list || []
  const councilMembers = agents.map((agent) => ({
    name: agent.identity?.name || agent.name || agent.id,
    emoji: agent.identity?.emoji || EMOJI_MAP[agent.id] || '🤖',
    role: ROLE_MAP[agent.id] || agent.id,
    description: DEFAULT_DESCRIPTION[agent.id] || `AI agent configured for ${agent.identity?.name || agent.id}`,
    color: COLOR_MAP[agent.id] || 'var(--accent)',
    strengths: STRENGTHS_MAP[agent.id] || ['Collaboration'],
  }))

  const allSessions = sessionsData?.sessions || []

  // Filter sessions for council-related activity
  const councilSessions = allSessions.filter(session => {
    const label = (session.label || '').toLowerCase()
    return label.includes('strategy') || label.includes('workshop') || label.includes('council')
  })

  const displaySessions = councilSessions.length > 0 ? councilSessions : allSessions.slice(0, 10)
  const sessionTitle = councilSessions.length > 0 ? 'Council Sessions' : 'Recent Sessions'

  function refetch() {
    refetchSessions()
    refetchConfig()
  }
  
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="w-6 h-6 text-[var(--accent)]" />
            Council
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Multi-agent deliberation and strategic decision-making
          </p>
        </div>
        <button
          onClick={refetch}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] hover:bg-[var(--bg-hover)] transition text-sm text-[var(--text-secondary)]"
        >
          <RefreshCw className={cn('w-4 h-4', (sessionsLoading || configLoading) && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Council Members */}
      {configLoading && councilMembers.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-[var(--bg-hover)] rounded" />
                <div className="flex-1">
                  <div className="h-5 bg-[var(--bg-hover)] rounded w-1/3 mb-2" />
                  <div className="h-4 bg-[var(--bg-hover)] rounded w-2/3 mb-3" />
                  <div className="h-3 bg-[var(--bg-hover)] rounded w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {councilMembers.length === 0 && !configLoading && (
          <div className="col-span-full p-8 text-center bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
            <Users className="w-8 h-8 text-[var(--text-secondary)] mx-auto mb-2 opacity-40" />
            <p className="text-sm text-[var(--text-secondary)]">No agents configured. Add agents in your OpenClaw config.</p>
          </div>
        )}
        {councilMembers.map((member) => (
          <div
            key={member.name}
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 hover:border-[var(--accent)]/30 transition"
          >
            <div className="flex items-start gap-4">
              <div className="text-4xl">{member.emoji}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-white">{member.name}</h3>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{ background: `${member.color}20`, color: member.color }}
                  >
                    {member.role}
                  </span>
                </div>
                <p className="text-sm text-[var(--text-secondary)] mb-3">
                  {member.description}
                </p>
                <div className="flex flex-wrap gap-1">
                  {member.strengths.map((strength) => (
                    <span
                      key={strength}
                      className="text-xs px-2 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-primary)]"
                    >
                      {strength}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Council Sessions */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[var(--accent)]" />
            <h2 className="text-sm font-semibold text-white">{sessionTitle}</h2>
            {displaySessions.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
                {displaySessions.length} sessions
              </span>
            )}
          </div>
          <button
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-hover)] border border-[var(--border)] text-xs text-[var(--text-secondary)] cursor-not-allowed opacity-50"
            disabled
          >
            <Zap className="w-3 h-3" />
            Start Council Session
          </button>
        </div>

        {sessionsLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-[var(--bg-hover)] rounded w-3/4 mb-2" />
                <div className="h-3 bg-[var(--bg-hover)] rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : displaySessions.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="w-8 h-8 text-[var(--text-secondary)] mx-auto mb-2 opacity-40" />
            <p className="text-sm text-[var(--text-secondary)]">No council sessions found</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {displaySessions
              .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
              .map((session) => (
                <div
                  key={session.key}
                  className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--border)]/30 transition"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {session.label || session.key || 'Unnamed Session'}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] mt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {session.updatedAt ? new Date(session.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Brain className="w-3 h-3" />
                        {(session.model || 'unknown').split('/').pop()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        {formatNumber(session.totalTokens || 0)} tokens
                      </span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Council Principles */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-[var(--success)]" />
          Council Principles
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {COUNCIL_PRINCIPLES.map((principle, index) => {
            const Icon = principle.icon
            return (
              <div
                key={index}
                className="p-4 rounded-lg bg-[var(--bg-hover)] border border-[var(--border)]/50"
              >
                <div className="flex items-start gap-3">
                  <Icon className="w-5 h-5 text-[var(--accent)] mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">
                      {principle.title}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {principle.description}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Council Status */}
      <div className="text-center p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
        <Users className="w-12 h-12 text-[var(--text-secondary)] mx-auto mb-3 opacity-60" />
        <h3 className="text-lg font-semibold text-white mb-2">Council Sessions Coming Soon</h3>
        <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
          Multi-agent deliberation features are in development. Soon you&apos;ll be able to initiate council sessions 
          where Patrick and Dave collaborate on complex decisions and strategic planning.
        </p>
      </div>
    </div>
  )
}