'use client'

import { useState, useEffect, useRef } from 'react'
import { Activity } from 'lucide-react'
import { timeAgo } from '@/lib/utils'

interface ActivityEvent {
  id: string
  agent: { name: string; emoji: string; color: string }
  title: string
  description?: string
  timestamp: Date
}

const AGENT_COLORS: Record<string, string> = {
  builder: '#6366f1',
  advisor: '#22c55e',
  main: '#8b5cf6',
}

function getAgentFromConfig(agentId: string, config: { agents?: { list?: Array<{ id: string; identity?: { name?: string; emoji?: string } }> } }): { name: string; emoji: string; color: string } {
  const a = config?.agents?.list?.find(x => x.id === agentId)
  return {
    name: a?.identity?.name || agentId,
    emoji: a?.identity?.emoji || '🤖',
    color: AGENT_COLORS[agentId] || '#6366f1',
  }
}

function parseActivityUser(user: string): { name: string; emoji: string } {
  const s = user?.trim() || ''
  const lastSpace = s.lastIndexOf(' ')
  if (lastSpace > 0) {
    const name = s.slice(0, lastSpace).trim()
    const emoji = s.slice(lastSpace).trim()
    if (emoji.length <= 4) return { name, emoji }
  }
  return { name: s || 'Agent', emoji: '🤖' }
}

export default function LiveActivity() {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [connected, setConnected] = useState(false)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    async function pollActivity() {
      try {
        const [activityRes, sessionsRes, subagentsRes, configRes] = await Promise.allSettled([
          fetch('/api/activity'),
          fetch('/api/gateway/sessions'),
          fetch('/api/gateway/subagents'),
          fetch('/api/gateway/config'),
        ])

        const config = configRes.status === 'fulfilled' && configRes.value.ok
          ? await configRes.value.json()
          : {}
        const newEvents: ActivityEvent[] = []

        // Activity log (summaries from past messages)
        if (activityRes.status === 'fulfilled' && activityRes.value.ok) {
          const data = await activityRes.value.json()
          const activities = data?.activities || []
          activities.slice(0, 8).forEach((a: { id: string; summary: string; user?: string; timestamp: number }) => {
            const { name, emoji } = parseActivityUser(a.user || '')
            newEvents.push({
              id: a.id,
              agent: { name, emoji, color: AGENT_COLORS.builder },
              title: a.summary,
              timestamp: new Date(a.timestamp || Date.now()),
            })
          })
        }

        // Sessions (active session labels)
        if (sessionsRes.status === 'fulfilled' && sessionsRes.value.ok) {
          const data = await sessionsRes.value.json()
          const sessions = (data?.result || data?.sessions || []).filter((s: Record<string, unknown>) => !String(s.key || '').includes('subagent'))
          sessions.slice(0, 4).forEach((s: Record<string, unknown>, i: number) => {
            const agentId = (s.agentId as string) || 'builder'
            const agent = getAgentFromConfig(agentId, config)
            newEvents.push({
              id: `session-${s.sessionKey || i}`,
              agent,
              title: (s.label as string) || (s.sessionKey as string) || 'Session',
              description: s.kind ? `${s.kind} session` : undefined,
              timestamp: new Date((s.lastMessageAt as string) || (s.updatedAt as string) || Date.now()),
            })
          })
        }

        // Subagents (active sub-agent tasks)
        if (subagentsRes.status === 'fulfilled' && subagentsRes.value.ok) {
          const data = await subagentsRes.value.json()
          const subs = data?.result?.sessions || data?.sessions || []
          subs.slice(0, 5).forEach((s: Record<string, unknown>, i: number) => {
            newEvents.push({
              id: `sub-${s.sessionKey || i}`,
              agent: { name: 'Sub-agent', emoji: '⚡', color: '#f59e0b' },
              title: (s.label as string) || `Sub-agent ${i + 1}`,
              description: (s.task as string)?.slice(0, 60),
              timestamp: new Date((s.startedAt as string) || Date.now()),
            })
          })
        }

        const sorted = newEvents
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, 12)
        setEvents(sorted)
        setConnected(true)
      } catch {
        setConnected(false)
      }
    }

    pollActivity()
    pollingRef.current = setInterval(pollActivity, 10000)
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [])

  return (
    <div className="h-full flex flex-col bg-[var(--bg-secondary)]">
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[var(--danger)]" />
          <h2 className="text-xs font-semibold text-white uppercase tracking-wider">Live Activity</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-[var(--success)] animate-pulse' : 'bg-[var(--danger)]'}`} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {events.length === 0 && (
          <div className="text-center py-8">
            <Activity className="w-6 h-6 text-[var(--text-secondary)] mx-auto mb-2 opacity-30" />
            <p className="text-[11px] text-[var(--text-secondary)]">No recent activity</p>
          </div>
        )}

        {events.map((event) => (
          <div
            key={event.id}
            className="flex items-start gap-2.5 px-2 py-2 rounded-md hover:bg-white/[0.03] transition"
          >
            {/* Agent avatar */}
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs mt-0.5"
              style={{ background: `${event.agent.color}20`, border: `1.5px solid ${event.agent.color}40` }}
            >
              {event.agent.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold" style={{ color: event.agent.color }}>
                  {event.agent.name}
                </span>
                <span className="text-[10px] text-[var(--text-secondary)]">
                  {timeAgo(event.timestamp)}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-primary)] leading-snug mt-0.5">{event.title}</p>
              {event.description && (
                <p className="text-[10px] text-[var(--text-secondary)] leading-snug mt-0.5 truncate">{event.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
