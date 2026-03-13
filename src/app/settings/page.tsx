'use client'

import { useGatewayData } from '@/hooks/use-gateway'
import { Settings, Server, Shield, Cpu, Globe, RefreshCw, Radio, Bot, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GatewayConfig {
  gateway?: {
    port?: number
    mode?: string
    bind?: string
    auth?: { mode?: string }
    controlUi?: { allowInsecureAuth?: boolean }
  }
  agents?: {
    defaults?: {
      model?: { primary?: string }
      maxConcurrent?: number
      subagents?: { maxConcurrent?: number }
      heartbeat?: { every?: string; model?: string }
      compaction?: { mode?: string }
    }
    list?: Array<{
      id: string
      name: string
      model?: { primary?: string }
      identity?: { name?: string; emoji?: string }
    }>
  }
  channels?: Record<string, {
    enabled?: boolean
    dmPolicy?: string
    groupPolicy?: string
    streamMode?: string
  }>
  models?: {
    providers?: Record<string, {
      api?: string
      baseUrl?: string
      models?: Array<{ id: string; name: string }>
    }>
  }
  tools?: Record<string, unknown>
  hooks?: Record<string, unknown>
  error?: string
}

export default function SettingsPage() {
  const { data, loading, error, refetch } = useGatewayData<GatewayConfig>('/api/gateway/config', 60000)

  const gw = data?.gateway
  const agents = data?.agents
  const channels = data?.channels
  const models = data?.models

  return (
    <div className="p-3 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Settings className="w-6 h-6 text-[var(--accent)]" />
            Settings
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Live gateway configuration — read from openclaw.json
          </p>
        </div>
        <button
          onClick={refetch}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] hover:bg-[var(--bg-hover)] transition text-sm text-[var(--text-secondary)]"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded-lg p-4">
          <p className="text-sm text-[var(--danger)]">⚠️ {error}</p>
        </div>
      )}

      {loading && !data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 animate-pulse">
              <div className="h-4 bg-[var(--bg-hover)] rounded w-1/3 mb-4" />
              <div className="space-y-3">
                <div className="h-3 bg-[var(--bg-hover)] rounded w-full" />
                <div className="h-3 bg-[var(--bg-hover)] rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gateway */}
        {gw && (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
              <Server className="w-4 h-4 text-[var(--accent)]" />
              <h2 className="text-sm font-semibold text-white">Gateway</h2>
            </div>
            <div className="p-5 space-y-3">
              {[
                { label: 'Port', value: gw.port, icon: Globe },
                { label: 'Mode', value: gw.mode, icon: Server },
                { label: 'Bind', value: gw.bind, icon: Globe },
                { label: 'Auth Mode', value: gw.auth?.mode, icon: Shield },
                { label: 'Control UI Insecure', value: gw.controlUi?.allowInsecureAuth ? 'Yes' : 'No', icon: Shield },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-[var(--text-secondary)]" />
                      <span className="text-sm text-[var(--text-secondary)]">{item.label}</span>
                    </div>
                    <span className="text-sm font-mono text-white">{String(item.value)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Agent Defaults */}
        {agents?.defaults && (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
              <Bot className="w-4 h-4 text-[var(--accent)]" />
              <h2 className="text-sm font-semibold text-white">Agent Defaults</h2>
            </div>
            <div className="p-5 space-y-3">
              {[
                { label: 'Default Model', value: agents.defaults.model?.primary?.split('/').pop() },
                { label: 'Max Concurrent', value: agents.defaults.maxConcurrent },
                { label: 'Max Sub-agents', value: agents.defaults.subagents?.maxConcurrent },
                { label: 'Heartbeat', value: agents.defaults.heartbeat ? `${agents.defaults.heartbeat.every} (${agents.defaults.heartbeat.model?.split('/').pop()})` : '—' },
                { label: 'Compaction', value: agents.defaults.compaction?.mode },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-secondary)]">{item.label}</span>
                  <span className="text-sm font-mono text-white">{String(item.value || '—')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Agents List */}
        {agents?.list && (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[var(--accent)]" />
              <h2 className="text-sm font-semibold text-white">Agents ({agents.list.length})</h2>
            </div>
            <div className="p-5 space-y-3">
              {agents.list.map((agent) => (
                <div key={agent.id} className="p-3 rounded-lg bg-[var(--bg-hover)]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{agent.identity?.emoji || '🤖'}</span>
                    <span className="text-sm font-semibold text-white">{agent.identity?.name || agent.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent-hover)]">
                      {agent.id}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] font-mono">
                    {agent.model?.primary || agents.defaults?.model?.primary || '—'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Channels */}
        {channels && (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
              <Radio className="w-4 h-4 text-[var(--accent)]" />
              <h2 className="text-sm font-semibold text-white">Channels</h2>
            </div>
            <div className="p-5 space-y-3">
              {Object.entries(channels).map(([name, ch]) => (
                <div key={name} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-hover)]">
                  <span className="text-lg">{name === 'telegram' ? '📱' : name === 'discord' ? '💬' : '🔗'}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white capitalize">{name}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {[
                        ch.enabled ? 'Enabled' : 'Disabled',
                        ch.dmPolicy && `DM: ${ch.dmPolicy}`,
                        ch.groupPolicy && `Group: ${ch.groupPolicy}`,
                        ch.streamMode && `Stream: ${ch.streamMode}`,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${ch.enabled ? 'bg-[var(--success)]' : 'bg-[var(--text-secondary)]'}`} />
                    <span className={`text-xs ${ch.enabled ? 'text-[var(--success)]' : 'text-[var(--text-secondary)]'}`}>
                      {ch.enabled ? 'Active' : 'Off'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Models */}
        {models?.providers && (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--accent)]" />
              <h2 className="text-sm font-semibold text-white">Model Providers</h2>
            </div>
            <div className="p-5 space-y-3">
              {Object.entries(models.providers).map(([name, provider]) => (
                <div key={name} className="p-3 rounded-lg bg-[var(--bg-hover)]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white capitalize">{name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent-hover)]">
                      {provider.api || name}
                    </span>
                  </div>
                  {provider.baseUrl && (
                    <p className="text-xs text-[var(--text-secondary)] font-mono">{provider.baseUrl}</p>
                  )}
                  {provider.models && provider.models.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {provider.models.map((m) => (
                        <span key={m.id} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                          {m.name || m.id}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
