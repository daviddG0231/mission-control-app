'use client'

import { useEffect, useState } from 'react'
import { Factory, Play, Pause, Clock, CheckCircle, XCircle, ArrowRight, BarChart3 } from 'lucide-react'

interface CronJob {
  name: string
  schedule: { kind: string; expr?: string; tz?: string } | string
  enabled: boolean
  state: {
    lastStatus?: 'success' | 'error' | 'running'
    lastRunTime?: number
    nextRunTime?: number
    consecutiveErrors?: number
    duration?: number
    totalRuns?: number
    successRate?: number
  }
  description?: string
}

interface ProductionStats {
  totalJobs: number
  activeJobs: number
  successfulRuns: number
  failedRuns: number
  averageDuration: number
}

export default function FactoryPage() {
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [stats, setStats] = useState<ProductionStats>({
    totalJobs: 0,
    activeJobs: 0,
    successfulRuns: 0,
    failedRuns: 0,
    averageDuration: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchFactoryData = async () => {
      try {
        const response = await fetch('/api/gateway/cron')
        if (response.ok) {
          const data = await response.json()
          const cronJobs = data.jobs || []
          setJobs(cronJobs)
          
          // Calculate production stats
          const totalJobs = cronJobs.length
          const activeJobs = cronJobs.filter((job: CronJob) => job.enabled).length
          const successfulRuns = cronJobs.reduce((sum: number, job: CronJob) => 
            sum + (job.state.totalRuns || 0) - (job.state.consecutiveErrors || 0), 0)
          const failedRuns = cronJobs.reduce((sum: number, job: CronJob) => 
            sum + (job.state.consecutiveErrors || 0), 0)
          const averageDuration = cronJobs.reduce((sum: number, job: CronJob) => 
            sum + (job.state.duration || 0), 0) / Math.max(totalJobs, 1)
          
          setStats({
            totalJobs,
            activeJobs,
            successfulRuns,
            failedRuns,
            averageDuration: Math.round(averageDuration)
          })
        }
      } catch (error) {
        console.error('Failed to fetch factory data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchFactoryData()
    const interval = setInterval(fetchFactoryData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const ProductionLine = ({ job, index }: { job: CronJob; index: number }) => {
    const isRunning = job.state.lastStatus === 'running'
    const hasError = job.state.lastStatus === 'error' || (job.state.consecutiveErrors || 0) > 0
    const isSuccessful = job.state.lastStatus === 'success'

    return (
      <div className="bg-[var(--bg-card)] rounded-lg p-6 border border-[var(--border)] space-y-4">
        {/* Production Line Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`
              w-3 h-3 rounded-full animate-pulse
              ${isRunning ? 'bg-[var(--accent)]' : 
                hasError ? 'bg-[var(--danger)]' : 
                isSuccessful ? 'bg-[var(--success)]' : 'bg-[var(--text-secondary)]'}
            `} />
            <h3 className="font-semibold text-[var(--text-primary)]">
              Production Line {index + 1}: {job.name}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {job.enabled ? (
              <Play className="w-4 h-4 text-[var(--success)]" />
            ) : (
              <Pause className="w-4 h-4 text-[var(--text-secondary)]" />
            )}
            <span className="text-xs text-[var(--text-secondary)]">
              {job.enabled ? 'Active' : 'Paused'}
            </span>
          </div>
        </div>

        {/* Pipeline Visualization */}
        <div className="flex items-center gap-4 py-4">
          {/* Input */}
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-[var(--bg-primary)] rounded-lg border border-[var(--border)] flex items-center justify-center">
              <span className="text-xs text-[var(--text-secondary)]">INPUT</span>
            </div>
            <span className="text-xs text-[var(--text-secondary)] mt-1">Schedule</span>
          </div>

          <ArrowRight className="w-4 h-4 text-[var(--text-secondary)]" />

          {/* Process */}
          <div className="flex flex-col items-center flex-1">
            <div className={`
              w-full h-12 rounded-lg border-2 border-dashed flex items-center justify-center
              ${isRunning ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 
                hasError ? 'border-[var(--danger)] bg-[var(--danger)]/10' : 
                'border-[var(--border)]'}
            `}>
              {isRunning && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[var(--accent)] rounded-full animate-bounce" />
                  <span className="text-xs text-[var(--accent)]">PROCESSING</span>
                </div>
              )}
              {!isRunning && (
                <span className="text-xs text-[var(--text-secondary)]">PROCESS</span>
              )}
            </div>
            <span className="text-xs text-[var(--text-secondary)] mt-1">
              {job.description || 'Automation Task'}
            </span>
          </div>

          <ArrowRight className="w-4 h-4 text-[var(--text-secondary)]" />

          {/* Output */}
          <div className="flex flex-col items-center">
            <div className={`
              w-12 h-12 rounded-lg border flex items-center justify-center
              ${hasError ? 'border-[var(--danger)] bg-[var(--danger)]/10' : 
                isSuccessful ? 'border-[var(--success)] bg-[var(--success)]/10' : 
                'border-[var(--border)]'}
            `}>
              {hasError ? (
                <XCircle className="w-4 h-4 text-[var(--danger)]" />
              ) : isSuccessful ? (
                <CheckCircle className="w-4 h-4 text-[var(--success)]" />
              ) : (
                <span className="text-xs text-[var(--text-secondary)]">OUT</span>
              )}
            </div>
            <span className="text-xs text-[var(--text-secondary)] mt-1">Result</span>
          </div>
        </div>

        {/* Production Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-[var(--border)]">
          <div className="text-center">
            <div className="text-sm font-semibold text-[var(--text-primary)]">
              {typeof job.schedule === 'string' ? job.schedule : job.schedule?.expr || 'N/A'}
            </div>
            <div className="text-xs text-[var(--text-secondary)]">Schedule</div>
          </div>
          
          <div className="text-center">
            <div className="text-sm font-semibold text-[var(--text-primary)]">
              {job.state.lastRunTime ? 
                new Date(job.state.lastRunTime).toLocaleTimeString() : 'Never'}
            </div>
            <div className="text-xs text-[var(--text-secondary)]">Last Run</div>
          </div>
          
          <div className="text-center">
            <div className="text-sm font-semibold text-[var(--text-primary)]">
              {job.state.duration ? `${job.state.duration}ms` : 'N/A'}
            </div>
            <div className="text-xs text-[var(--text-secondary)]">Duration</div>
          </div>
          
          <div className="text-center">
            <div className="text-sm font-semibold text-[var(--text-primary)]">
              {job.state.successRate ? `${job.state.successRate}%` : 
               job.state.totalRuns ? 
               `${Math.round(((job.state.totalRuns - (job.state.consecutiveErrors || 0)) / job.state.totalRuns) * 100)}%` : 
               'N/A'}
            </div>
            <div className="text-xs text-[var(--text-secondary)]">Success Rate</div>
          </div>
        </div>

        {/* Error Info */}
        {hasError && (
          <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-[var(--danger)]" />
              <span className="text-sm text-[var(--danger)]">
                Production Error: {job.state.consecutiveErrors || 1} consecutive failures
              </span>
            </div>
          </div>
        )}
      </div>
    )
  }

  const StatCard = ({ title, value, subtitle, icon: Icon, color = 'accent' }: {
    title: string
    value: string | number
    subtitle: string
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
    color?: 'accent' | 'success' | 'warning' | 'danger'
  }) => {
    const colorClass = {
      accent: 'text-[var(--accent)]',
      success: 'text-[var(--success)]',
      warning: 'text-[var(--warning)]',
      danger: 'text-[var(--danger)]'
    }[color]

    return (
      <div className="bg-[var(--bg-card)] rounded-lg p-4 border border-[var(--border)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-[var(--text-primary)]">{value}</div>
            <div className="text-sm text-[var(--text-secondary)]">{title}</div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">{subtitle}</div>
          </div>
          <Icon className={`w-8 h-8 ${colorClass}`} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Factory className="w-6 h-6 text-[var(--accent)]" />
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Factory</h1>
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <div className="w-2 h-2 bg-[var(--success)] rounded-full animate-pulse" />
          Factory Floor Active
        </div>
      </div>

      {loading && (
        <div className="text-center text-[var(--text-secondary)]">
          Initializing production lines...
        </div>
      )}

      {/* Factory Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Production Lines"
          value={stats.totalJobs}
          subtitle="Configured automation jobs"
          icon={Factory}
          color="accent"
        />
        <StatCard
          title="Active Lines"
          value={stats.activeJobs}
          subtitle="Currently running"
          icon={Play}
          color="success"
        />
        <StatCard
          title="Successful Runs"
          value={stats.successfulRuns}
          subtitle="Total successful executions"
          icon={CheckCircle}
          color="success"
        />
        <StatCard
          title="Average Duration"
          value={`${stats.averageDuration}ms`}
          subtitle="Per execution"
          icon={Clock}
          color="accent"
        />
      </div>

      {/* Production Lines */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Production Lines</h2>
          <span className="text-sm text-[var(--text-secondary)]">
            {jobs.length} Total • {jobs.filter(job => job.enabled).length} Active
          </span>
        </div>
        
        {jobs.length === 0 && !loading ? (
          <div className="bg-[var(--bg-card)] rounded-lg p-8 border border-[var(--border)] text-center">
            <Factory className="w-12 h-12 text-[var(--text-secondary)] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No Production Lines</h3>
            <p className="text-[var(--text-secondary)]">No automation jobs configured</p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job, index) => (
              <ProductionLine key={job.name} job={job} index={index} />
            ))}
          </div>
        )}
      </div>

      {/* Factory Performance */}
      {jobs.length > 0 && (
        <div className="bg-[var(--bg-card)] rounded-lg p-6 border border-[var(--border)]">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Factory Performance</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-[var(--success)]">
                {stats.successfulRuns + stats.failedRuns > 0 ? 
                  Math.round((stats.successfulRuns / (stats.successfulRuns + stats.failedRuns)) * 100) : 0}%
              </div>
              <div className="text-sm text-[var(--text-secondary)]">Overall Success Rate</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-[var(--warning)]">{stats.failedRuns}</div>
              <div className="text-sm text-[var(--text-secondary)]">Failed Productions</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-[var(--accent)]">
                {Math.round(stats.averageDuration / 1000 * 10) / 10}s
              </div>
              <div className="text-sm text-[var(--text-secondary)]">Avg Processing Time</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}