'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Check,
  X,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  CheckCheck,
  XCircle,
  Filter,
  GitBranch,
  Pencil,
  FilePlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileChange {
  id: string
  timestamp: string
  agent: string
  tool: 'edit' | 'write'
  filePath: string
  fileName: string
  diff?: string
  oldString?: string
  newString?: string
  content?: string
  firstChangedLine?: number
  status: 'pending' | 'accepted' | 'rejected'
  sessionId: string
  bytesWritten?: number
}

interface ReviewResponse {
  changes: FileChange[]
  total: number
  pending: number
  accepted: number
  rejected: number
}

function DiffView({ diff, oldString, newString, content, tool }: {
  diff?: string
  oldString?: string
  newString?: string
  content?: string
  tool: 'edit' | 'write'
}) {
  // Use the pre-formatted diff from the API if available
  if (diff) {
    const lines = diff.split('\n')
    return (
      <div className="font-mono text-[11px] leading-[1.6] overflow-x-auto">
        {lines.map((line, i) => {
          const isAdd = line.startsWith('+')
          const isRemove = line.startsWith('-')
          const isContext = !isAdd && !isRemove
          return (
            <div
              key={i}
              className={cn(
                'px-3 py-0 whitespace-pre',
                isAdd && 'bg-green-500/15 text-green-300',
                isRemove && 'bg-red-500/15 text-red-300',
                isContext && 'text-[var(--text-secondary)]',
                line.trim() === '...' && 'text-[var(--text-secondary)]/50 italic'
              )}
            >
              {line}
            </div>
          )
        })}
      </div>
    )
  }

  // Fallback: show old → new for edits
  if (tool === 'edit' && oldString && newString) {
    return (
      <div className="font-mono text-[11px] leading-[1.6] overflow-x-auto">
        {oldString.split('\n').map((line, i) => (
          <div key={`old-${i}`} className="px-3 bg-red-500/15 text-red-300 whitespace-pre">
            - {line}
          </div>
        ))}
        {newString.split('\n').map((line, i) => (
          <div key={`new-${i}`} className="px-3 bg-green-500/15 text-green-300 whitespace-pre">
            + {line}
          </div>
        ))}
      </div>
    )
  }

  // For write: show content preview
  if (tool === 'write' && content) {
    const preview = content.length > 2000 ? content.slice(0, 2000) + '\n... (truncated)' : content
    return (
      <div className="font-mono text-[11px] leading-[1.6] overflow-x-auto">
        {preview.split('\n').map((line, i) => (
          <div key={i} className="px-3 bg-green-500/10 text-green-300/80 whitespace-pre">
            + {line}
          </div>
        ))}
      </div>
    )
  }

  return <div className="px-3 py-2 text-[var(--text-secondary)] text-xs italic">No diff available</div>
}

function ChangeCard({ change, onAction, loading }: {
  change: FileChange
  onAction: (id: string, action: 'accept' | 'reject') => void
  loading: string | null
}) {
  const [expanded, setExpanded] = useState(change.status === 'pending')

  const relPath = change.filePath.replace(/.*\/workspace\//, '')
  const timeAgo = (() => {
    const diff = Date.now() - new Date(change.timestamp).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  })()

  const hasDiff = change.diff || (change.oldString && change.newString) || change.content

  return (
    <div className={cn(
      'border rounded-lg overflow-hidden transition-all',
      change.status === 'pending' && 'border-[var(--accent)]/40 bg-[var(--bg-card)]',
      change.status === 'accepted' && 'border-green-500/20 bg-green-500/5',
      change.status === 'rejected' && 'border-red-500/20 bg-red-500/5 opacity-60',
    )}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--bg-hover)]/50 transition"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={cn(
          'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs',
          change.tool === 'edit' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'
        )}>
          {change.tool === 'edit' ? <Pencil className="w-3 h-3" /> : <FilePlus className="w-3 h-3" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">{change.fileName}</span>
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
              change.status === 'pending' && 'bg-[var(--accent)]/20 text-[var(--accent)]',
              change.status === 'accepted' && 'bg-green-500/20 text-green-400',
              change.status === 'rejected' && 'bg-red-500/20 text-red-400',
            )}>
              {change.status}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-[var(--text-secondary)] truncate">{relPath}</span>
            <span className="text-[10px] text-[var(--text-secondary)]">·</span>
            <span className="text-[10px] text-[var(--text-secondary)]">{change.agent}</span>
            <span className="text-[10px] text-[var(--text-secondary)]">·</span>
            <span className="text-[10px] text-[var(--text-secondary)]">{timeAgo}</span>
          </div>
        </div>

        {/* Actions */}
        {change.status === 'pending' && (
          <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => onAction(change.id, 'accept')}
              disabled={loading === change.id}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs font-medium transition disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              Accept
            </button>
            <button
              onClick={() => onAction(change.id, 'reject')}
              disabled={loading === change.id}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium transition disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" />
              Reject
            </button>
          </div>
        )}

        {hasDiff && (
          expanded ? <ChevronUp className="w-4 h-4 text-[var(--text-secondary)] flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-[var(--text-secondary)] flex-shrink-0" />
        )}
      </div>

      {/* Diff */}
      {expanded && hasDiff && (
        <div className="border-t border-[var(--border)] bg-[#0d1117] max-h-[400px] overflow-auto">
          <DiffView
            diff={change.diff}
            oldString={change.oldString}
            newString={change.newString}
            content={change.content}
            tool={change.tool}
          />
        </div>
      )}
    </div>
  )
}

export default function ReviewPage() {
  const [data, setData] = useState<ReviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('pending')
  const [hours, setHours] = useState(24)

  const fetchChanges = useCallback(async () => {
    try {
      const res = await fetch(`/api/review?hours=${hours}`, { cache: 'no-store' })
      const json = await res.json()
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [hours])

  useEffect(() => {
    fetchChanges()
    const interval = setInterval(fetchChanges, 15000)
    return () => clearInterval(interval)
  }, [fetchChanges])

  const handleAction = async (changeId: string, action: 'accept' | 'reject') => {
    setActionLoading(changeId)
    try {
      const change = data?.changes.find(c => c.id === changeId)
      const res = await fetch('/api/review/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changeId,
          action,
          filePath: change?.filePath,
          oldString: change?.oldString,
          newString: change?.newString,
        }),
      })
      const json = await res.json()
      if (json.warning) {
        alert(json.message)
      }
      await fetchChanges()
    } catch {}
    finally { setActionLoading(null) }
  }

  const handleBulkAction = async (action: 'accept-all' | 'reject-all') => {
    const pending = data?.changes.filter(c => c.status === 'pending') || []
    if (!pending.length) return
    if (!confirm(`${action === 'accept-all' ? 'Accept' : 'Reject'} all ${pending.length} pending changes?`)) return

    setActionLoading('bulk')
    try {
      await fetch('/api/review/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          changeIds: pending.map(c => c.id),
        }),
      })
      await fetchChanges()
    } catch {}
    finally { setActionLoading(null) }
  }

  const filteredChanges = useMemo(() => {
    if (!data?.changes) return []
    if (filter === 'all') return data.changes
    return data.changes.filter(c => c.status === filter)
  }, [data?.changes, filter])

  // Group by file
  const groupedChanges = useMemo(() => {
    const groups: Record<string, FileChange[]> = {}
    for (const c of filteredChanges) {
      const key = c.filePath
      if (!groups[key]) groups[key] = []
      groups[key].push(c)
    }
    return Object.entries(groups)
  }, [filteredChanges])

  return (
    <div className="p-3 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-[var(--accent)]" />
            Code Review
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Review and accept/reject agent code changes — Cursor-style
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleBulkAction('accept-all')}
            disabled={!data?.pending || actionLoading === 'bulk'}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs font-medium transition disabled:opacity-30"
          >
            <CheckCheck className="w-4 h-4" />
            Accept All ({data?.pending || 0})
          </button>
          <button
            onClick={() => handleBulkAction('reject-all')}
            disabled={!data?.pending || actionLoading === 'bulk'}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium transition disabled:opacity-30"
          >
            <XCircle className="w-4 h-4" />
            Reject All
          </button>
          <button
            onClick={() => { setLoading(true); fetchChanges() }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-xs text-white hover:bg-[var(--bg-hover)] transition"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: data?.total || 0, color: 'text-white', icon: FileText },
          { label: 'Pending', value: data?.pending || 0, color: 'text-[var(--accent)]', icon: Clock },
          { label: 'Accepted', value: data?.accepted || 0, color: 'text-green-400', icon: Check },
          { label: 'Rejected', value: data?.rejected || 0, color: 'text-red-400', icon: X },
        ].map(stat => (
          <div key={stat.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">{stat.label}</p>
                <p className={cn('text-xl font-bold', stat.color)}>{stat.value}</p>
              </div>
              <stat.icon className={cn('w-5 h-5', stat.color)} />
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-[var(--text-secondary)]" />
        {(['pending', 'all', 'accepted', 'rejected'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition',
              filter === f
                ? 'bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/40'
                : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--bg-hover)]'
            )}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <span className="text-[var(--text-secondary)] text-xs ml-2">·</span>
        <select
          value={hours}
          onChange={e => setHours(parseInt(e.target.value))}
          className="px-2 py-1.5 rounded-lg text-xs bg-[var(--bg-card)] text-white border border-[var(--border)]"
        >
          <option value={6}>Last 6h</option>
          <option value={24}>Last 24h</option>
          <option value={48}>Last 48h</option>
          <option value={168}>Last 7d</option>
        </select>
      </div>

      {/* Changes */}
      {loading && !data ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-[var(--bg-card)] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filteredChanges.length === 0 ? (
        <div className="text-center py-12">
          <CheckCheck className="w-12 h-12 text-green-400/50 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white mb-1">
            {filter === 'pending' ? 'All clear!' : 'No changes found'}
          </h3>
          <p className="text-sm text-[var(--text-secondary)]">
            {filter === 'pending'
              ? 'No pending code changes to review.'
              : `No ${filter} changes in the last ${hours}h.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {groupedChanges.map(([filePath, changes]) => (
            <div key={filePath}>
              {groupedChanges.length > 1 && (
                <div className="text-[10px] font-mono text-[var(--text-secondary)] mb-1 px-1">
                  {filePath.replace(/.*\/workspace\//, '')} ({changes.length})
                </div>
              )}
              <div className="space-y-2">
                {changes.map(change => (
                  <ChangeCard
                    key={change.id}
                    change={change}
                    onAction={handleAction}
                    loading={actionLoading}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
