'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Network, RefreshCw, Zap, ChevronDown, ChevronRight, Activity, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AgentNode {
  id: string
  name: string
  emoji: string
  role: string
  title: string
  model?: string
  status: 'active' | 'idle' | 'disabled'
  lastActive?: string
  children: AgentNode[]
}

// The org structure from SOUL.md
const ORG_TREE: AgentNode = {
  id: 'builder',
  name: 'Patrick',
  emoji: '🪼',
  role: 'CEO',
  title: 'Chief Executive Officer',
  children: [
    {
      id: 'cto',
      name: 'Dave',
      emoji: '🛠️',
      role: 'CTO',
      title: 'Chief Technology Officer',
      children: [
        { id: 'backend', name: 'Mark', emoji: '⚙️', role: 'Backend', title: 'Backend Developer', children: [], status: 'idle' },
        { id: 'frontend', name: 'Mickey', emoji: '🎨', role: 'Frontend', title: 'Frontend Developer', children: [], status: 'idle' },
        { id: 'mobile', name: 'Tommy', emoji: '📱', role: 'Mobile', title: 'Mobile Developer', children: [], status: 'idle' },
        { id: 'devops', name: 'Elliot', emoji: '🖥️', role: 'DevOps', title: 'DevOps Engineer', children: [], status: 'idle' },
      ],
      status: 'idle',
    },
    {
      id: 'cdo',
      name: 'Bob',
      emoji: '🏛️',
      role: 'CDO',
      title: 'Chief Design Officer',
      children: [
        { id: 'design', name: 'Stuart', emoji: '🎯', role: 'UI/UX', title: 'UI/UX Designer', children: [], status: 'idle' },
        { id: 'qa', name: 'Snoopy', emoji: '🔍', role: 'QA', title: 'QA & Testing', children: [], status: 'idle' },
        { id: 'research', name: 'Bobby', emoji: '🔬', role: 'Research', title: 'Research Analyst', children: [], status: 'idle' },
      ],
      status: 'idle',
    },
    {
      id: 'cbo',
      name: 'Bolt',
      emoji: '⚡',
      role: 'CBO',
      title: 'Chief Business Officer',
      children: [
        { id: 'biz', name: 'Rex', emoji: '💼', role: 'Business', title: 'Business & Freelancing', children: [], status: 'idle' },
        { id: 'data', name: 'Nova', emoji: '📈', role: 'Data', title: 'Data Analyst', children: [], status: 'idle' },
        { id: 'ml', name: 'Garfield', emoji: '🐱', role: 'ML/AI', title: 'ML/AI Engineer', children: [], status: 'idle' },
      ],
      status: 'idle',
    },
  ],
  status: 'active',
}

interface LiveSession {
  key: string
  label?: string
  model?: string
  updatedAt?: number
  kind?: string
}

function AgentCard({ node, live, depth = 0, expanded, onToggle }: {
  node: AgentNode
  live?: LiveSession
  depth?: number
  expanded: Set<string>
  onToggle: (id: string) => void
}) {
  const isActive = node.status === 'active' || !!live
  const hasChildren = node.children.length > 0
  const isExpanded = expanded.has(node.id)
  const isCEO = depth === 0
  const isCLevel = depth === 1

  const lastActiveText = live?.updatedAt
    ? (() => {
        const diff = Date.now() - live.updatedAt
        const mins = Math.floor(diff / 60000)
        if (mins < 1) return 'just now'
        if (mins < 60) return `${mins}m ago`
        return `${Math.floor(mins / 60)}h ago`
      })()
    : null

  return (
    <div className="flex flex-col items-center">
      {/* Card */}
      <div
        onClick={() => hasChildren && onToggle(node.id)}
        className={cn(
          'relative border-2 rounded-xl transition-all cursor-pointer group',
          'hover:scale-105 hover:shadow-lg hover:shadow-[var(--accent)]/10',
          isCEO && 'px-6 py-4 min-w-[200px]',
          isCLevel && 'px-5 py-3.5 min-w-[180px]',
          !isCEO && !isCLevel && 'px-4 py-3 min-w-[150px]',
          isActive
            ? 'border-[var(--accent)]/60 bg-[var(--accent)]/10'
            : 'border-[var(--border)] bg-[var(--bg-card)]',
        )}
      >
        {/* Status dot */}
        <div className={cn(
          'absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--bg-main)]',
          isActive ? 'bg-green-400' : 'bg-[var(--text-secondary)]/30',
        )} />

        {/* Emoji */}
        <div className={cn(
          'text-center mb-1',
          isCEO ? 'text-4xl' : isCLevel ? 'text-3xl' : 'text-2xl',
        )}>
          {node.emoji}
        </div>

        {/* Name */}
        <div className={cn(
          'text-center font-bold',
          isCEO ? 'text-lg' : isCLevel ? 'text-base' : 'text-sm',
          'text-white',
        )}>
          {node.name}
        </div>

        {/* Role badge */}
        <div className={cn(
          'text-center mt-1 px-2 py-0.5 rounded-full mx-auto w-fit',
          isCEO
            ? 'bg-[var(--accent)]/20 text-[var(--accent)] text-xs font-bold'
            : isCLevel
            ? 'bg-yellow-500/20 text-yellow-400 text-[10px] font-semibold'
            : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] text-[10px]',
        )}>
          {node.role}
        </div>

        {/* Model info */}
        {live?.model && (
          <div className="text-center mt-1.5 text-[9px] text-[var(--text-secondary)] font-mono truncate max-w-[140px]">
            {live.model.split('/').pop()}
          </div>
        )}

        {/* Last active */}
        {lastActiveText && (
          <div className="flex items-center justify-center gap-1 mt-1">
            <Activity className="w-2.5 h-2.5 text-green-400" />
            <span className="text-[9px] text-green-400">{lastActiveText}</span>
          </div>
        )}

        {/* Expand indicator */}
        {hasChildren && (
          <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-[var(--bg-card)] border border-[var(--border)] rounded-full p-0.5">
            {isExpanded
              ? <ChevronDown className="w-3 h-3 text-[var(--text-secondary)]" />
              : <ChevronRight className="w-3 h-3 text-[var(--text-secondary)]" />}
          </div>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="mt-6 relative">
          {/* Vertical line from parent */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-4 bg-[var(--border)]" style={{ top: '-24px' }} />

          {/* Horizontal connector line */}
          {node.children.length > 1 && (
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-[var(--border)]" style={{ top: '-4px' }} />
          )}

          <div className={cn(
            'flex gap-4 justify-center flex-wrap',
            depth === 0 ? 'gap-8' : 'gap-4',
          )}>
            {node.children.map((child) => (
              <div key={child.id} className="relative flex flex-col items-center">
                {/* Vertical line to child */}
                <div className="w-0.5 h-4 bg-[var(--border)] mb-2" style={{ marginTop: '-4px' }} />
                <AgentCard
                  node={child}
                  live={undefined}
                  depth={depth + 1}
                  expanded={expanded}
                  onToggle={onToggle}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function HierarchyPage() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['builder', 'cto', 'cdo', 'cbo']))
  const [sessions, setSessions] = useState<LiveSession[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions', { cache: 'no-store' })
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchSessions()
    const interval = setInterval(fetchSessions, 10000)
    return () => clearInterval(interval)
  }, [fetchSessions])

  const toggleNode = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandAll = () => {
    const all = new Set<string>()
    function walk(node: AgentNode) {
      all.add(node.id)
      node.children.forEach(walk)
    }
    walk(ORG_TREE)
    setExpanded(all)
  }

  const collapseAll = () => setExpanded(new Set(['builder']))

  // Merge live session data into tree
  const mergeStatus = useCallback((node: AgentNode): AgentNode => {
    const session = sessions.find(s =>
      s.label === node.id || s.key?.includes(node.id)
    )
    const isActive = session && session.updatedAt && (Date.now() - session.updatedAt < 300000)
    return {
      ...node,
      status: isActive ? 'active' : 'idle',
      model: session?.model,
      children: node.children.map(c => mergeStatus(c)),
    }
  }, [sessions])

  const liveTree = mergeStatus(ORG_TREE)

  // Count stats
  const countNodes = (node: AgentNode): { total: number; active: number } => {
    let total = 1, active = node.status === 'active' ? 1 : 0
    for (const c of node.children) {
      const r = countNodes(c)
      total += r.total
      active += r.active
    }
    return { total, active }
  }
  const stats = countNodes(liveTree)

  return (
    <div className="p-3 md:p-6 space-y-6 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
            <Network className="w-6 h-6 text-[var(--accent)]" />
            Team Hierarchy
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Organization structure — {stats.total} agents, {stats.active} active
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-xs text-white hover:bg-[var(--bg-hover)] transition"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-xs text-white hover:bg-[var(--bg-hover)] transition"
          >
            Collapse
          </button>
          <button
            onClick={() => { setLoading(true); fetchSessions() }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-xs text-white hover:bg-[var(--bg-hover)] transition"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
          Active
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--text-secondary)]/30" />
          Idle
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-[var(--accent)]" />
          CEO
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-yellow-400">●</span>
          C-Suite
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          Click to expand/collapse
        </div>
      </div>

      {/* Org Chart */}
      <div className="flex justify-center pt-4 pb-8 overflow-x-auto">
        <AgentCard
          node={liveTree}
          depth={0}
          expanded={expanded}
          onToggle={toggleNode}
        />
      </div>

      {/* Reporting Structure Text */}
      <div className="mt-8 border-t border-[var(--border)] pt-6">
        <h3 className="text-sm font-semibold text-white mb-3">Reporting Structure</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {liveTree.children.map(dept => (
            <div key={dept.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{dept.emoji}</span>
                <div>
                  <div className="font-bold text-white text-sm">{dept.name}</div>
                  <div className="text-[10px] text-yellow-400">{dept.title}</div>
                </div>
              </div>
              <div className="space-y-1.5">
                {dept.children.map(member => (
                  <div key={member.id} className="flex items-center gap-2 text-xs">
                    <span>{member.emoji}</span>
                    <span className="text-white">{member.name}</span>
                    <span className="text-[var(--text-secondary)]">— {member.title}</span>
                    {member.status === 'active' && (
                      <Activity className="w-3 h-3 text-green-400 ml-auto" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
