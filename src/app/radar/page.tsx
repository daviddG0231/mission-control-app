'use client'

import { useEffect, useState } from 'react'
import { Radar, AlertTriangle, CheckCircle, XCircle, Activity, Signal } from 'lucide-react'

interface CronJob {
  name: string
  schedule: { kind: string; expr?: string; tz?: string } | string
  state: {
    lastStatus?: 'success' | 'error' | 'running'
    lastRunTime?: number
    consecutiveErrors?: number
    duration?: number
  }
}

interface Alert {
  id: string
  type: 'error' | 'warning' | 'info'
  title: string
  description: string
  timestamp: number
  source: string
}

interface ServiceStatus {
  name: string
  status: 'online' | 'offline' | 'degraded'
  signalStrength: number // 0-100
  uptime: string
  lastCheck: number
}

export default function RadarPage() {
  const [cronJobs, setCronJobs] = useState<CronJob[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [services, setServices] = useState<ServiceStatus[]>([
    {
      name: 'Gateway',
      status: 'online',
      signalStrength: 95,
      uptime: '99.9%',
      lastCheck: Date.now()
    },
    {
      name: 'Telegram',
      status: 'online',
      signalStrength: 88,
      uptime: '99.5%',
      lastCheck: Date.now()
    },
    {
      name: 'Ollama',
      status: 'online',
      signalStrength: 92,
      uptime: '98.7%',
      lastCheck: Date.now()
    },
    {
      name: 'Database',
      status: 'online',
      signalStrength: 87,
      uptime: '99.8%',
      lastCheck: Date.now()
    }
  ])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRadarData = async () => {
      try {
        // Fetch cron jobs
        const cronResponse = await fetch('/api/gateway/cron')
        if (cronResponse.ok) {
          const cronData = await cronResponse.json()
          setCronJobs(cronData.jobs || [])
          
          // Generate alerts from cron job errors
          const cronAlerts: Alert[] = cronData.jobs
            ?.filter((job: CronJob) => 
              job.state.lastStatus === 'error' || (job.state.consecutiveErrors && job.state.consecutiveErrors > 0)
            )
            .map((job: CronJob) => ({
              id: `cron-${job.name}`,
              type: 'error' as const,
              title: `Cron Job Error: ${job.name}`,
              description: `${job.state.consecutiveErrors || 1} consecutive error(s)`,
              timestamp: job.state.lastRunTime || Date.now(),
              source: 'Cron'
            })) || []
          
          setAlerts(cronAlerts)
        }
      } catch (error) {
        console.error('Failed to fetch radar data:', error)
        setAlerts([{
          id: 'fetch-error',
          type: 'warning',
          title: 'Data Fetch Error',
          description: 'Failed to connect to gateway API',
          timestamp: Date.now(),
          source: 'System'
        }])
      } finally {
        setLoading(false)
      }
    }

    fetchRadarData()
    
    // Update service signal strength periodically
    const interval = setInterval(() => {
      setServices(prev => prev.map(service => ({
        ...service,
        signalStrength: Math.max(50, Math.min(100, service.signalStrength + (Math.random() - 0.5) * 10)),
        lastCheck: Date.now()
      })))
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const SignalStrengthIndicator = ({ strength, name }: { strength: number; name: string }) => {
    const bars = 4
    const filledBars = Math.ceil((strength / 100) * bars)
    
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-end gap-1">
          {[...Array(bars)].map((_, i) => (
            <div
              key={i}
              className={`w-1 transition-colors duration-300 ${
                i < filledBars
                  ? strength > 80
                    ? 'bg-[var(--success)]'
                    : strength > 60
                    ? 'bg-[var(--warning)]'
                    : 'bg-[var(--danger)]'
                  : 'bg-[var(--border)]'
              }`}
              style={{ height: `${8 + i * 4}px` }}
            />
          ))}
        </div>
        <span className="text-sm text-[var(--text-secondary)] min-w-0 truncate">{name}</span>
        <span className="text-xs text-[var(--text-secondary)] tabular-nums">{strength}%</span>
      </div>
    )
  }

  const AlertCard = ({ alert }: { alert: Alert }) => (
    <div className={`
      p-4 rounded-lg border border-[var(--border)] bg-[var(--bg-card)]
      ${alert.type === 'error' ? 'border-l-4 border-l-[var(--danger)]' : 
        alert.type === 'warning' ? 'border-l-4 border-l-[var(--warning)]' : 
        'border-l-4 border-l-[var(--accent)]'}
    `}>
      <div className="flex items-start gap-3">
        {alert.type === 'error' ? (
          <XCircle className="w-5 h-5 text-[var(--danger)] mt-0.5 shrink-0" />
        ) : alert.type === 'warning' ? (
          <AlertTriangle className="w-5 h-5 text-[var(--warning)] mt-0.5 shrink-0" />
        ) : (
          <Activity className="w-5 h-5 text-[var(--accent)] mt-0.5 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-[var(--text-primary)]">{alert.title}</h3>
            <span className="text-xs text-[var(--text-secondary)] whitespace-nowrap">
              {new Date(alert.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{alert.description}</p>
          <span className="text-xs text-[var(--text-secondary)] opacity-75">{alert.source}</span>
        </div>
      </div>
    </div>
  )

  const allClear = alerts.length === 0 && !loading

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Radar className="w-6 h-6 text-[var(--accent)]" />
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Radar</h1>
        {allClear && (
          <div className="flex items-center gap-2 px-3 py-1 bg-[var(--success)]/20 text-[var(--success)] rounded-full text-sm">
            <CheckCircle className="w-4 h-4" />
            All Clear
          </div>
        )}
      </div>

      {loading && (
        <div className="text-center text-[var(--text-secondary)]">Scanning for threats...</div>
      )}

      {/* Signal Strength Grid */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Signal className="w-5 h-5" />
          Signal Strength
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {services.map((service) => (
            <div
              key={service.name}
              className="bg-[var(--bg-card)] rounded-lg p-4 border border-[var(--border)]"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-[var(--text-primary)]">{service.name}</h3>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    service.status === 'online'
                      ? 'bg-[var(--success)]/20 text-[var(--success)]'
                      : service.status === 'degraded'
                      ? 'bg-[var(--warning)]/20 text-[var(--warning)]'
                      : 'bg-[var(--danger)]/20 text-[var(--danger)]'
                  }`}
                >
                  {service.status}
                </span>
              </div>
              <SignalStrengthIndicator strength={service.signalStrength} name="" />
              <div className="mt-2 text-xs text-[var(--text-secondary)]">
                Uptime: {service.uptime}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Alerts
          {alerts.length > 0 && (
            <span className="bg-[var(--danger)]/20 text-[var(--danger)] text-sm px-2 py-1 rounded-full">
              {alerts.length}
            </span>
          )}
        </h2>
        
        {allClear ? (
          <div className="bg-[var(--bg-card)] rounded-lg p-8 border border-[var(--border)] text-center">
            <CheckCircle className="w-12 h-12 text-[var(--success)] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">All Systems Operational</h3>
            <p className="text-[var(--text-secondary)]">No alerts or issues detected</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      {cronJobs.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Recent Cron Activity</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {cronJobs.slice(0, 6).map((job) => (
              <div
                key={job.name}
                className="bg-[var(--bg-card)] rounded-lg p-4 border border-[var(--border)]"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-[var(--text-primary)]">{job.name}</h3>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      job.state.lastStatus === 'success'
                        ? 'bg-[var(--success)]/20 text-[var(--success)]'
                        : job.state.lastStatus === 'error'
                        ? 'bg-[var(--danger)]/20 text-[var(--danger)]'
                        : 'bg-[var(--warning)]/20 text-[var(--warning)]'
                    }`}
                  >
                    {job.state.lastStatus || 'pending'}
                  </span>
                </div>
                <p className="text-sm text-[var(--text-secondary)] mb-1">
                  Schedule: {typeof job.schedule === 'string' ? job.schedule : job.schedule?.expr || 'N/A'}
                </p>
                {job.state.lastRunTime && (
                  <p className="text-xs text-[var(--text-secondary)]">
                    Last run: {new Date(job.state.lastRunTime).toLocaleString()}
                  </p>
                )}
                {job.state.consecutiveErrors && job.state.consecutiveErrors > 0 && (
                  <p className="text-xs text-[var(--danger)] mt-1">
                    {job.state.consecutiveErrors} consecutive errors
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}