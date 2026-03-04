'use client'

import { useState, useEffect, useCallback } from 'react'
import { Check, X, Clock, User, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/utils'

interface Approval {
  id: string
  title: string
  description: string
  agent: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  category: 'deploy' | 'send' | 'code' | 'config' | 'other'
}

const CATEGORY_COLORS = {
  deploy: { bg: '#1e40af20', text: '#3b82f6', border: '#1e40af40' },
  send: { bg: '#15803d20', text: '#22c55e', border: '#15803d40' },
  code: { bg: '#7c2d9220', text: '#a855f7', border: '#7c2d9240' },
  config: { bg: '#d9770020', text: '#f59e0b', border: '#d9770040' },
  other: { bg: '#37415120', text: '#6b7280', border: '#37415140' },
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const fetchApprovals = useCallback(async () => {
    try {
      const response = await fetch('/api/approvals')
      const data = await response.json()
      setApprovals(data.approvals || [])
    } catch (error) {
      console.error('Failed to fetch approvals:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchApprovals()
  }, [fetchApprovals])

  const updateApprovalStatus = async (id: string, status: 'approved' | 'rejected') => {
    setProcessingId(id)
    try {
      const response = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_status', id, status })
      })

      if (response.ok) {
        setApprovals(prev => 
          prev.map(approval => 
            approval.id === id ? { ...approval, status } : approval
          )
        )
      }
    } catch (error) {
      console.error('Failed to update approval:', error)
    } finally {
      setProcessingId(null)
    }
  }

  // Calculate stats
  const pending = approvals.filter(a => a.status === 'pending')
  const approved = approvals.filter(a => a.status === 'approved')
  const rejected = approvals.filter(a => a.status === 'rejected')
  
  const today = new Date().toDateString()
  const approvedToday = approved.filter(a => new Date(a.createdAt).toDateString() === today).length

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 animate-spin text-[var(--accent)]" />
          <span className="text-sm text-[var(--text-secondary)]">Loading approvals...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Approvals Queue</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Review and approve pending actions from AI agents
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--warning)]/20 flex items-center justify-center">
              <Clock className="w-4 h-4 text-[var(--warning)]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{pending.length}</p>
              <p className="text-xs text-[var(--text-secondary)]">Pending</p>
            </div>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--success)]/20 flex items-center justify-center">
              <Check className="w-4 h-4 text-[var(--success)]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{approvedToday}</p>
              <p className="text-xs text-[var(--text-secondary)]">Approved today</p>
            </div>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--danger)]/20 flex items-center justify-center">
              <X className="w-4 h-4 text-[var(--danger)]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{rejected.length}</p>
              <p className="text-xs text-[var(--text-secondary)]">Rejected</p>
            </div>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--accent)]/20 flex items-center justify-center">
              <User className="w-4 h-4 text-[var(--accent)]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{approvals.length}</p>
              <p className="text-xs text-[var(--text-secondary)]">Total</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Approvals */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-[var(--warning)]" />
            Pending Approvals
          </h2>
          <div className="space-y-3">
            {pending.map((approval) => (
              <div
                key={approval.id}
                className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4 hover:border-[var(--accent)]/30 transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-sm font-medium text-white">{approval.title}</h3>
                      <span
                        className="px-2 py-1 rounded-md text-xs font-medium"
                        style={{
                          backgroundColor: CATEGORY_COLORS[approval.category].bg,
                          color: CATEGORY_COLORS[approval.category].text,
                          border: `1px solid ${CATEGORY_COLORS[approval.category].border}`
                        }}
                      >
                        {approval.category}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] mb-3 leading-relaxed">
                      {approval.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {approval.agent}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {timeAgo(approval.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => updateApprovalStatus(approval.id, 'approved')}
                      disabled={processingId === approval.id}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition",
                        processingId === approval.id
                          ? "bg-[var(--bg-hover)] text-[var(--text-secondary)] cursor-not-allowed"
                          : "bg-[var(--success)]/20 text-[var(--success)] border border-[var(--success)]/30 hover:bg-[var(--success)]/30"
                      )}
                    >
                      <Check className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => updateApprovalStatus(approval.id, 'rejected')}
                      disabled={processingId === approval.id}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition",
                        processingId === approval.id
                          ? "bg-[var(--bg-hover)] text-[var(--text-secondary)] cursor-not-allowed"
                          : "bg-[var(--danger)]/20 text-[var(--danger)] border border-[var(--danger)]/30 hover:bg-[var(--danger)]/30"
                      )}
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {(approved.length > 0 || rejected.length > 0) && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white">History</h2>
          <div className="space-y-2">
            {[...approved, ...rejected]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((approval) => (
                <div
                  key={approval.id}
                  className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-3 opacity-75"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="text-sm font-medium text-white">{approval.title}</h4>
                        <span
                          className="px-2 py-1 rounded-md text-xs font-medium"
                          style={{
                            backgroundColor: CATEGORY_COLORS[approval.category].bg,
                            color: CATEGORY_COLORS[approval.category].text,
                            border: `1px solid ${CATEGORY_COLORS[approval.category].border}`
                          }}
                        >
                          {approval.category}
                        </span>
                        <span
                          className={cn(
                            "px-2 py-1 rounded-md text-xs font-medium",
                            approval.status === 'approved'
                              ? "bg-[var(--success)]/20 text-[var(--success)]"
                              : "bg-[var(--danger)]/20 text-[var(--danger)]"
                          )}
                        >
                          {approval.status === 'approved' ? '✅ Approved' : '❌ Rejected'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {approval.agent}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {timeAgo(approval.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {approvals.length === 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-8 text-center">
          <Clock className="w-12 h-12 text-[var(--text-secondary)]/50 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No approvals yet</h3>
          <p className="text-sm text-[var(--text-secondary)]">
            Approvals from AI agents will appear here for your review.
          </p>
        </div>
      )}
    </div>
  )
}