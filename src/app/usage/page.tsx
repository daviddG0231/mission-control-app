'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import { Coins, Zap, MessageSquare, Brain, TrendingUp, RefreshCw, Calendar } from 'lucide-react'

interface Session {
  key: string
  label?: string
  model?: string
  totalTokens?: number
  contextTokens?: number
  updatedAt?: number
}

const MODEL_PRICING: Record<string, { input: number; output: number; label: string }> = {
  'claude-opus-4-6': { input: 15, output: 75, label: 'Claude Opus 4' },
  'claude-sonnet-4-20250514': { input: 3, output: 15, label: 'Claude Sonnet 4' },
  'claude-haiku-3-5-20241022': { input: 0.25, output: 1.25, label: 'Claude Haiku 3.5' },
}

function estimateCost(tokens: number, model: string): number {
  const shortModel = model?.split('/').pop() || ''
  const pricing = MODEL_PRICING[shortModel]
  if (!pricing) return (tokens / 1_000_000) * 10 // fallback $10/1M
  // Rough estimate: assume 30% input, 70% output
  const inputTokens = tokens * 0.3
  const outputTokens = tokens * 0.7
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}

function formatCost(cost: number): string {
  if (cost < 0.01) return '< $0.01'
  return '$' + cost.toFixed(2)
}

type RangePreset = 'today' | 'yesterday' | 'w2' | 'w3' | 'w4' | 'm1' | 'm2' | 'm3' | 'm6' | 'm12' | 'custom'

function getRangeForPreset(preset: RangePreset, customFrom?: string, customTo?: string): { start: number; end: number } {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const todayEnd = now.getTime()

  if (preset === 'today') {
    return { start: todayStart, end: todayEnd }
  }
  if (preset === 'yesterday') {
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000
    return { start: yesterdayStart, end: todayStart - 1 }
  }
  if (preset === 'w2') return { start: todayEnd - 14 * 24 * 60 * 60 * 1000, end: todayEnd }
  if (preset === 'w3') return { start: todayEnd - 21 * 24 * 60 * 60 * 1000, end: todayEnd }
  if (preset === 'w4') return { start: todayEnd - 28 * 24 * 60 * 60 * 1000, end: todayEnd }
  if (preset === 'm1') return { start: todayEnd - 30 * 24 * 60 * 60 * 1000, end: todayEnd }
  if (preset === 'm2') return { start: todayEnd - 60 * 24 * 60 * 60 * 1000, end: todayEnd }
  if (preset === 'm3') return { start: todayEnd - 90 * 24 * 60 * 60 * 1000, end: todayEnd }
  if (preset === 'm6') return { start: todayEnd - 180 * 24 * 60 * 60 * 1000, end: todayEnd }
  if (preset === 'm12') return { start: todayEnd - 365 * 24 * 60 * 60 * 1000, end: todayEnd }
  if (preset === 'custom' && customFrom && customTo) {
    const start = new Date(customFrom).setHours(0, 0, 0, 0)
    const end = new Date(customTo).setHours(23, 59, 59, 999)
    return { start, end }
  }
  return { start: 0, end: todayEnd }
}

function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export default function UsagePage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [rangePreset, setRangePreset] = useState<RangePreset>('m1')
  const [customFrom, setCustomFrom] = useState(() => toDateInputValue(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
  const [customTo, setCustomTo] = useState(() => toDateInputValue(new Date()))

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/gateway/sessions')
      if (res.ok) {
        const d = await res.json()
        setSessions(d.sessions || [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  // Fetch once on mount — no auto-refresh
  useEffect(() => { fetchSessions() }, [fetchSessions])

  const { start: rangeStart, end: rangeEnd } = getRangeForPreset(rangePreset, customFrom, customTo)

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const raw = s.updatedAt
      if (raw == null || String(raw) === '') return false
      const t = typeof raw === 'number' ? raw : new Date(raw).getTime()
      return t >= rangeStart && t <= rangeEnd
    })
  }, [sessions, rangeStart, rangeEnd])

  const stats = useMemo(() => {
    let totalTokens = 0
    let totalCost = 0
    const modelMap: Record<string, { tokens: number; count: number; cost: number }> = {}

    for (const s of filteredSessions) {
      const tokens = s.totalTokens || 0
      const model = (s.model || 'unknown').split('/').pop() || 'unknown'
      totalTokens += tokens

      if (!modelMap[model]) modelMap[model] = { tokens: 0, count: 0, cost: 0 }
      modelMap[model].tokens += tokens
      modelMap[model].count++

      const cost = estimateCost(tokens, s.model || '')
      totalCost += cost
      modelMap[model].cost += cost
    }

    const mostUsedModel = Object.entries(modelMap).sort((a, b) => b[1].tokens - a[1].tokens)[0]

    return {
      totalTokens,
      totalCost,
      sessionCount: filteredSessions.length,
      mostUsedModel: mostUsedModel ? mostUsedModel[0] : 'N/A',
      modelBreakdown: Object.entries(modelMap).sort((a, b) => b[1].tokens - a[1].tokens),
    }
  }, [filteredSessions])

  const maxTokens = Math.max(...filteredSessions.map(s => s.totalTokens || 0), 1)

  const sortedSessions = useMemo(() =>
    [...filteredSessions].sort((a, b) => (b.totalTokens || 0) - (a.totalTokens || 0)),
    [filteredSessions]
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Coins className="w-6 h-6 text-[var(--accent)]" />
          <h1 className="text-2xl font-bold text-white">Usage</h1>
        </div>
        <button
          onClick={fetchSessions}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] hover:bg-[var(--bg-hover)] transition text-sm text-[var(--text-secondary)]"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Date range */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-[var(--accent)]" />
          <span className="text-xs font-medium text-[var(--text-secondary)]">Time range</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'today' as const, label: 'Today' },
              { id: 'yesterday' as const, label: 'Yesterday' },
              { id: 'w2' as const, label: '2 weeks' },
              { id: 'w3' as const, label: '3 weeks' },
              { id: 'w4' as const, label: '4 weeks' },
              { id: 'm1' as const, label: '1 month' },
              { id: 'm2' as const, label: '2 months' },
              { id: 'm3' as const, label: '3 months' },
              { id: 'm6' as const, label: '6 months' },
              { id: 'm12' as const, label: '12 months' },
              { id: 'custom' as const, label: 'Custom' },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setRangePreset(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                rangePreset === id
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-white border border-[var(--border)]'
              }`}
            >
              {label}
            </button>
          ))}
          {rangePreset === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2 py-1.5 rounded-lg bg-[var(--bg-hover)] border border-[var(--border)] text-white text-xs focus:outline-none focus:border-[var(--accent)]"
              />
              <span className="text-xs text-[var(--text-secondary)]">→</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2 py-1.5 rounded-lg bg-[var(--bg-hover)] border border-[var(--border)] text-white text-xs focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--text-secondary)]">Total Tokens</p>
            <Zap className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <p className="text-2xl font-bold text-white mt-1">{formatTokens(stats.totalTokens)}</p>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--text-secondary)]">Est. Cost</p>
            <TrendingUp className="w-4 h-4 text-[var(--warning)]" />
          </div>
          <p className="text-2xl font-bold text-white mt-1">{formatCost(stats.totalCost)}</p>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--text-secondary)]">Active Sessions</p>
            <MessageSquare className="w-4 h-4 text-[var(--success)]" />
          </div>
          <p className="text-2xl font-bold text-white mt-1">{stats.sessionCount}</p>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--text-secondary)]">Top Model</p>
            <Brain className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <p className="text-lg font-bold text-white mt-1 truncate">{stats.mostUsedModel}</p>
        </div>
      </div>

      {/* Model Breakdown */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
        <div className="px-5 py-3 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-white">Model Breakdown</h2>
        </div>
        <div className="p-5 space-y-4">
          {stats.modelBreakdown.map(([model, info]) => {
            const pct = stats.totalTokens > 0 ? (info.tokens / stats.totalTokens) * 100 : 0
            const pricing = MODEL_PRICING[model]
            return (
              <div key={model}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {pricing?.label || model}
                    </span>
                    <span className="text-xs text-[var(--text-secondary)]">
                      {info.count} session{info.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--text-secondary)]">{formatTokens(info.tokens)}</span>
                    <span className="text-xs font-medium text-[var(--warning)]">{formatCost(info.cost)}</span>
                    <span className="text-xs text-[var(--text-secondary)]">{pct.toFixed(0)}%</span>
                  </div>
                </div>
                <div className="h-2 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
          {stats.modelBreakdown.length === 0 && (
            <p className="text-sm text-[var(--text-secondary)] text-center py-4">No usage data</p>
          )}
        </div>
      </div>

      {/* Pricing Reference */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
        <div className="px-5 py-3 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-white">Pricing Reference</h2>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div className="text-[var(--text-secondary)]">Model</div>
            <div className="text-[var(--text-secondary)] text-center">Input ($/1M)</div>
            <div className="text-[var(--text-secondary)] text-center">Output ($/1M)</div>
            {Object.entries(MODEL_PRICING).map(([key, p]) => (
              <div key={key} className="contents">
                <div className="text-[var(--text-primary)] font-medium">{p.label}</div>
                <div className="text-center text-[var(--text-primary)]">${p.input}</div>
                <div className="text-center text-[var(--text-primary)]">${p.output}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Session Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
        <div className="px-5 py-3 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-white">Tokens by Session</h2>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {sortedSessions.map((s) => {
            const tokens = s.totalTokens || 0
            const barWidth = maxTokens > 0 ? (tokens / maxTokens) * 100 : 0
            const model = (s.model || 'unknown').split('/').pop() || 'unknown'
            return (
              <div key={s.key} className="px-5 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-[var(--text-primary)] truncate max-w-[300px]">
                    {s.label || s.key.split(':').pop()}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--accent)]/15 text-[var(--accent)]">{model}</span>
                    <span className="text-xs text-[var(--text-secondary)] tabular-nums w-16 text-right">{formatTokens(tokens)}</span>
                    <span className="text-xs text-[var(--warning)] w-14 text-right">{formatCost(estimateCost(tokens, s.model || ''))}</span>
                  </div>
                </div>
                <div className="h-1.5 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)]/60 rounded-full"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
