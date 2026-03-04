'use client'

import { useGatewayData } from '@/hooks/use-gateway'
import { MessageSquare, RefreshCw, Clock, Bot, User } from 'lucide-react'
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

export default function SessionsPage() {
  const { data, loading, error, refetch } = useGatewayData<SessionsResponse>(
    '/api/gateway/sessions',
    15000
  )

  const sessions: Session[] = data?.sessions || data?.result || []

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
        <button
          onClick={refetch}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] hover:bg-[var(--bg-hover)] transition text-sm text-[var(--text-secondary)]"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

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
