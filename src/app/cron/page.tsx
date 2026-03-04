'use client'

import { useState } from 'react'
import { useGatewayData } from '@/hooks/use-gateway'
import { Clock, RefreshCw, Play, Pause, Calendar, Zap, Loader2, Power } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CronJob {
  id?: string
  jobId?: string
  name?: string
  enabled?: boolean
  agentId?: string
  schedule?: {
    kind?: string
    expr?: string
    everyMs?: number
    at?: string
    tz?: string
  }
  payload?: {
    kind?: string
    text?: string
    message?: string
    model?: string
    timeoutSeconds?: number
  }
  sessionTarget?: string
  state?: {
    nextRunAtMs?: number
    lastRunAtMs?: number
    lastStatus?: string
    lastDurationMs?: number
    consecutiveErrors?: number
  }
}

interface CronResponse {
  jobs?: CronJob[]
  result?: { jobs?: CronJob[] }
}

function formatSchedule(schedule?: CronJob['schedule']): string {
  if (!schedule) return 'Unknown'
  if (schedule.kind === 'cron' && schedule.expr) {
    const tz = schedule.tz ? ` (${schedule.tz})` : ''
    return `${schedule.expr}${tz}`
  }
  if (schedule.kind === 'every' && schedule.everyMs) {
    const mins = Math.round(schedule.everyMs / 60000)
    if (mins < 60) return `Every ${mins}m`
    return `Every ${Math.round(mins / 60)}h`
  }
  if (schedule.kind === 'at' && schedule.at) {
    return new Date(schedule.at).toLocaleString()
  }
  return schedule.kind || 'Unknown'
}

function formatDuration(ms?: number): string {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

function formatTime(ms?: number): string {
  if (!ms) return '—'
  const d = new Date(ms)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function CronPage() {
  const { data, loading, error, refetch } = useGatewayData<CronResponse>(
    '/api/gateway/cron',
    30000
  )
  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set())
  const [togglingJobs, setTogglingJobs] = useState<Set<string>>(new Set())

  const jobs: CronJob[] = data?.jobs || data?.result?.jobs || []

  async function runJob(jobId: string) {
    setRunningJobs((prev) => new Set(prev).add(jobId))
    try {
      await fetch('/api/gateway/cron/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run', jobId }),
      })
      // Refresh after a short delay
      setTimeout(refetch, 2000)
    } catch (e) {
      console.error('Failed to run job:', e)
    } finally {
      setTimeout(() => {
        setRunningJobs((prev) => {
          const next = new Set(prev)
          next.delete(jobId)
          return next
        })
      }, 3000)
    }
  }

  async function toggleJob(jobId: string, currentEnabled: boolean) {
    setTogglingJobs((prev) => new Set(prev).add(jobId))
    try {
      await fetch('/api/gateway/cron/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', jobId, enabled: !currentEnabled }),
      })
      setTimeout(refetch, 1000)
    } catch (e) {
      console.error('Failed to toggle job:', e)
    } finally {
      setTimeout(() => {
        setTogglingJobs((prev) => {
          const next = new Set(prev)
          next.delete(jobId)
          return next
        })
      }, 1500)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Clock className="w-6 h-6 text-[var(--accent)]" />
            Cron Jobs
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Scheduled tasks and recurring jobs — live from gateway
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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
          <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-1">Total Jobs</div>
          <div className="text-2xl font-bold text-white">{jobs.length}</div>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
          <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-1">Active</div>
          <div className="text-2xl font-bold text-[var(--success)]">{jobs.filter((j) => j.enabled !== false).length}</div>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
          <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-1">Disabled</div>
          <div className="text-2xl font-bold text-[var(--text-secondary)]">{jobs.filter((j) => j.enabled === false).length}</div>
        </div>
      </div>

      {error && (
        <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded-lg p-4">
          <p className="text-sm text-[var(--danger)]">⚠️ {error}</p>
        </div>
      )}

      {loading && jobs.length === 0 && !error && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-[var(--bg-hover)] rounded w-1/3 mb-3" />
              <div className="h-3 bg-[var(--bg-hover)] rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {!loading && jobs.length === 0 && !error && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-12 text-center">
          <Clock className="w-10 h-10 text-[var(--text-secondary)] mx-auto mb-3 opacity-40" />
          <p className="text-sm text-[var(--text-secondary)]">No cron jobs configured</p>
        </div>
      )}

      {/* Jobs list */}
      <div className="space-y-3">
        {jobs.map((job) => {
          const jobId = job.id || job.jobId || ''
          const isEnabled = job.enabled !== false
          const isRunning = runningJobs.has(jobId)
          const isToggling = togglingJobs.has(jobId)

          return (
            <div
              key={jobId}
              className={cn(
                'bg-[var(--bg-card)] border rounded-xl p-5 transition',
                isEnabled ? 'border-[var(--border)] hover:border-[var(--accent)]/30' : 'border-[var(--border)] opacity-60'
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                    isEnabled ? 'bg-[var(--success)]/15' : 'bg-[var(--text-secondary)]/15'
                  )}>
                    {isEnabled ? (
                      <Play className="w-5 h-5 text-[var(--success)]" />
                    ) : (
                      <Pause className="w-5 h-5 text-[var(--text-secondary)]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white">
                      {job.name || jobId || 'Unnamed Job'}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                        <Calendar className="w-3 h-3" />
                        {formatSchedule(job.schedule)}
                      </div>
                      {job.sessionTarget && (
                        <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                          <Zap className="w-3 h-3" />
                          {job.sessionTarget}
                        </div>
                      )}
                      {job.agentId && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent-hover)]">
                          {job.agentId}
                        </span>
                      )}
                      {job.payload?.model && (
                        <span className="text-[10px] text-[var(--text-secondary)]">
                          {job.payload.model.split('/').pop()}
                        </span>
                      )}
                    </div>

                    {/* State info */}
                    {job.state && (
                      <div className="flex items-center gap-4 mt-2 text-[10px] text-[var(--text-secondary)]">
                        {job.state.lastStatus && (
                          <span className={cn(
                            'px-1.5 py-0.5 rounded-full',
                            job.state.lastStatus === 'ok' ? 'bg-[var(--success)]/15 text-[var(--success)]' : 'bg-[var(--danger)]/15 text-[var(--danger)]'
                          )}>
                            Last: {job.state.lastStatus}
                          </span>
                        )}
                        {job.state.lastDurationMs && (
                          <span>Duration: {formatDuration(job.state.lastDurationMs)}</span>
                        )}
                        {job.state.lastRunAtMs && (
                          <span>Last run: {formatTime(job.state.lastRunAtMs)}</span>
                        )}
                        {job.state.nextRunAtMs && (
                          <span>Next: {formatTime(job.state.nextRunAtMs)}</span>
                        )}
                      </div>
                    )}

                    {/* Payload preview */}
                    {(job.payload?.text || job.payload?.message) && (
                      <p className="text-[11px] text-[var(--text-secondary)] mt-2 line-clamp-2 leading-relaxed">
                        {(job.payload.text || job.payload.message || '').slice(0, 120)}...
                      </p>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Run Now */}
                  <button
                    onClick={() => runJob(jobId)}
                    disabled={isRunning}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition',
                      isRunning
                        ? 'bg-[var(--success)]/20 text-[var(--success)] cursor-wait'
                        : 'bg-[var(--success)]/10 text-[var(--success)] hover:bg-[var(--success)]/20 border border-[var(--success)]/20'
                    )}
                  >
                    {isRunning ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    {isRunning ? 'Running...' : 'Run Now'}
                  </button>

                  {/* Enable/Disable */}
                  <button
                    onClick={() => toggleJob(jobId, isEnabled)}
                    disabled={isToggling}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border',
                      isToggling
                        ? 'opacity-50 cursor-wait'
                        : isEnabled
                          ? 'bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/20 hover:bg-[var(--warning)]/20'
                          : 'bg-[var(--accent)]/10 text-[var(--accent-hover)] border-[var(--accent)]/20 hover:bg-[var(--accent)]/20'
                    )}
                  >
                    {isToggling ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Power className="w-3.5 h-3.5" />
                    )}
                    {isEnabled ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
