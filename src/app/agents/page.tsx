'use client'

import { useGatewayData } from '@/hooks/use-gateway'
import { Bot, Zap, RefreshCw, Activity, Cpu, Brain } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AgentInfo {
  id: string
  name: string
  model?: { primary?: string }
  identity?: { name?: string; emoji?: string }
  workspace?: string
}

interface ConfigResponse {
  agents?: {
    defaults?: { model?: { primary?: string }; maxConcurrent?: number; subagents?: { maxConcurrent?: number } }
    list?: AgentInfo[]
  }
  error?: string
}

interface Subagent {
  sessionKey?: string
  label?: string
  task?: string
  status?: string
  agentId?: string
  model?: string
  startedAt?: string
}

interface SubagentsResponse {
  sessions?: Subagent[]
  result?: { sessions?: Subagent[] }
  text?: string
}

const EMOJI_MAP: Record<string, string> = {
  builder: '🪼',
  advisor: '💭',
}

const ROLE_MAP: Record<string, string> = {
  builder: 'Builder & Orchestrator',
  advisor: 'Advisor',
}

const COLOR_MAP: Record<string, string> = {
  builder: 'var(--accent)',
  advisor: 'var(--success)',
}

export default function AgentsPage() {
  const { data: configData, loading: configLoading } = useGatewayData<ConfigResponse>('/api/gateway/config', 60000)
  const { data: subData, loading: subLoading, error, refetch } = useGatewayData<SubagentsResponse>('/api/gateway/subagents', 15000)

  const agents: AgentInfo[] = configData?.agents?.list || []
  const defaults = configData?.agents?.defaults
  const subagents: Subagent[] = subData?.sessions || subData?.result?.sessions || []

  return (
    <div className="p-3 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Bot className="w-6 h-6 text-[var(--accent)]" />
            Agents
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Your AI team and running sub-agents — live from gateway config
          </p>
        </div>
        <button
          onClick={refetch}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] hover:bg-[var(--bg-hover)] transition text-sm text-[var(--text-secondary)]"
        >
          <RefreshCw className={cn('w-4 h-4', subLoading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Config info */}
      {defaults && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
            <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-1">Default Model</div>
            <div className="text-sm font-mono text-white">{defaults.model?.primary?.split('/').pop()}</div>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
            <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-1">Max Concurrent</div>
            <div className="text-2xl font-bold text-white">{defaults.maxConcurrent || '—'}</div>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
            <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-1">Max Sub-agents</div>
            <div className="text-2xl font-bold text-white">{defaults.subagents?.maxConcurrent || '—'}</div>
          </div>
        </div>
      )}

      {/* Main Agents */}
      {configLoading && agents.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 animate-pulse">
              <div className="h-6 bg-[var(--bg-hover)] rounded w-1/3 mb-3" />
              <div className="h-4 bg-[var(--bg-hover)] rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map((agent) => {
          const emoji = agent.identity?.emoji || EMOJI_MAP[agent.id] || '🤖'
          const role = ROLE_MAP[agent.id] || agent.id
          const color = COLOR_MAP[agent.id] || 'var(--accent)'
          const model = agent.model?.primary?.split('/').pop() || defaults?.model?.primary?.split('/').pop() || '—'

          return (
            <div
              key={agent.id}
              className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 hover:border-[var(--accent)]/30 transition"
            >
              <div className="flex items-start gap-4">
                <div className="text-4xl">{emoji}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">{agent.identity?.name || agent.name}</h3>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: `${color}20`, color }}
                    >
                      {role}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                      <Cpu className="w-3.5 h-3.5" />
                      {model}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                      <Brain className="w-3.5 h-3.5" />
                      ID: {agent.id}
                    </div>
                  </div>
                  {agent.workspace && (
                    <p className="text-[10px] text-[var(--text-secondary)] font-mono mt-1 truncate">
                      {agent.workspace}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Sub-agents */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[var(--warning)]" />
            <h2 className="text-sm font-semibold text-white">Sub-agents</h2>
            {subagents.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--warning)]/15 text-[var(--warning)]">
                {subagents.length} running
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="p-4">
            <p className="text-sm text-[var(--danger)]">⚠️ {error}</p>
          </div>
        )}

        {subagents.length === 0 && !subLoading && !error && (
          <div className="p-8 text-center">
            <Zap className="w-8 h-8 text-[var(--text-secondary)] mx-auto mb-2 opacity-40" />
            <p className="text-sm text-[var(--text-secondary)]">No sub-agents running</p>
          </div>
        )}

        <div className="p-4 space-y-2">
          {subagents.map((sub, i) => (
            <div
              key={sub.sessionKey || i}
              className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--border)]/30 transition"
            >
              <Activity
                className={cn(
                  'w-4 h-4',
                  sub.status === 'running' ? 'text-[var(--success)] animate-pulse' :
                  sub.status === 'completed' ? 'text-[var(--accent)]' :
                  'text-[var(--text-secondary)]'
                )}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {sub.label || sub.sessionKey}
                </p>
                {sub.task && (
                  <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">{sub.task}</p>
                )}
              </div>
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full',
                  sub.status === 'running' ? 'bg-[var(--success)]/15 text-[var(--success)]' :
                  sub.status === 'completed' ? 'bg-[var(--accent)]/15 text-[var(--accent)]' :
                  'bg-[var(--text-secondary)]/15 text-[var(--text-secondary)]'
                )}
              >
                {sub.status || 'unknown'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
