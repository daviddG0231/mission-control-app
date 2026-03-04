'use client'

import { useState, useEffect } from 'react'
import { Bug, RefreshCw, CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'

interface DebugCheck {
  name: string
  status: 'ok' | 'error' | 'warning'
  message: string
  details?: string
}

interface DebugData {
  checks: DebugCheck[]
  env: Record<string, string>
  paths: Record<string, { exists: boolean; path: string }>
  versions: Record<string, string>
}

export default function DebugPage() {
  const [data, setData] = useState<DebugData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedChecks, setExpandedChecks] = useState<Set<string>>(new Set())
  const [copiedItem, setCopiedItem] = useState<string | null>(null)

  const fetchDebugData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/debug')
      if (res.ok) {
        const d = await res.json()
        setData(d)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDebugData()
  }, [])

  const toggleExpand = (name: string) => {
    setExpandedChecks(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const copyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedItem(key)
    setTimeout(() => setCopiedItem(null), 2000)
  }

  const statusIcon = (status: string) => {
    if (status === 'ok') return <CheckCircle className="w-4 h-4 text-[var(--success)]" />
    if (status === 'error') return <XCircle className="w-4 h-4 text-[var(--danger)]" />
    return <AlertTriangle className="w-4 h-4 text-[var(--warning)]" />
  }

  const statusColor = (status: string) => {
    if (status === 'ok') return 'text-[var(--success)]'
    if (status === 'error') return 'text-[var(--danger)]'
    return 'text-[var(--warning)]'
  }

  const okCount = data?.checks.filter(c => c.status === 'ok').length ?? 0
  const warnCount = data?.checks.filter(c => c.status === 'warning').length ?? 0
  const errCount = data?.checks.filter(c => c.status === 'error').length ?? 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bug className="w-6 h-6 text-[var(--accent)]" />
          <h1 className="text-2xl font-bold text-white">Debug</h1>
          {data && (
            <div className="flex items-center gap-2 ml-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--success)]/15 text-[var(--success)]">{okCount} OK</span>
              {warnCount > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--warning)]/15 text-[var(--warning)]">{warnCount} Warn</span>}
              {errCount > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--danger)]/15 text-[var(--danger)]">{errCount} Error</span>}
            </div>
          )}
        </div>
        <button
          onClick={fetchDebugData}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] hover:bg-[var(--bg-hover)] transition text-sm text-[var(--text-secondary)]"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Run Diagnostics
        </button>
      </div>

      {loading && !data ? (
        <div className="text-center py-12 text-[var(--text-secondary)]">Running diagnostics...</div>
      ) : data ? (
        <>
          {/* Health Checks */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
            <div className="px-5 py-3 border-b border-[var(--border)]">
              <h2 className="text-sm font-semibold text-white">Health Checks</h2>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {data.checks.map((check) => (
                <div key={check.name}>
                  <button
                    onClick={() => check.details ? toggleExpand(check.name) : undefined}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[var(--bg-hover)] transition text-left"
                  >
                    {statusIcon(check.status)}
                    <span className="text-sm font-medium text-[var(--text-primary)] flex-1">{check.name}</span>
                    <span className={`text-xs ${statusColor(check.status)}`}>{check.message}</span>
                    {check.details && (
                      expandedChecks.has(check.name)
                        ? <ChevronDown className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                        : <ChevronRight className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                    )}
                  </button>
                  {check.details && expandedChecks.has(check.name) && (
                    <div className="px-5 pb-3 pl-12">
                      <pre className="text-xs text-[var(--text-secondary)] bg-[var(--bg-primary)] rounded p-3 overflow-x-auto whitespace-pre-wrap">
                        {check.details}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Versions */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
            <div className="px-5 py-3 border-b border-[var(--border)]">
              <h2 className="text-sm font-semibold text-white">Versions</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--border)]">
              {Object.entries(data.versions).map(([key, value]) => (
                <div key={key} className="bg-[var(--bg-card)] p-4">
                  <p className="text-xs text-[var(--text-secondary)] mb-1">{key}</p>
                  <p className="text-sm font-mono text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Paths */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
            <div className="px-5 py-3 border-b border-[var(--border)]">
              <h2 className="text-sm font-semibold text-white">File Paths</h2>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {Object.entries(data.paths).map(([key, info]) => (
                <div key={key} className="flex items-center justify-between px-5 py-2.5 group">
                  <div className="flex items-center gap-3">
                    {info.exists
                      ? <CheckCircle className="w-3.5 h-3.5 text-[var(--success)]" />
                      : <XCircle className="w-3.5 h-3.5 text-[var(--danger)]" />
                    }
                    <span className="text-sm text-[var(--text-primary)]">{key}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-[var(--text-secondary)] font-mono">{info.path}</code>
                    <button
                      onClick={() => copyText(key, info.path)}
                      className="opacity-0 group-hover:opacity-100 transition p-1"
                    >
                      {copiedItem === key
                        ? <Check className="w-3 h-3 text-[var(--success)]" />
                        : <Copy className="w-3 h-3 text-[var(--text-secondary)]" />
                      }
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Environment */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
            <div className="px-5 py-3 border-b border-[var(--border)]">
              <h2 className="text-sm font-semibold text-white">Environment</h2>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {Object.entries(data.env).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between px-5 py-2.5">
                  <span className="text-xs font-mono text-[var(--accent)]">{key}</span>
                  <span className="text-xs font-mono text-[var(--text-secondary)]">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-[var(--danger)]">Failed to load debug data</div>
      )}
    </div>
  )
}
