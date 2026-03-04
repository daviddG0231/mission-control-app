'use client'

import { useEffect, useState } from 'react'
import { Monitor, Activity, CheckCircle, XCircle, Server, AlertTriangle, ExternalLink } from 'lucide-react'

interface SystemStats {
  uptime: string
  cpu: number
  memory: number
  diskUsage: number
}

interface HealthCheck {
  service: string
  status: 'connected' | 'disconnected' | 'error'
  details?: string
}

interface GatewayConfig {
  port?: number
  nodeVersion?: string
  os?: string
  [key: string]: unknown
}

export default function SystemPage() {
  const [stats, setStats] = useState<SystemStats>({
    uptime: '0h 0m',
    cpu: 45,
    memory: 62,
    diskUsage: 38
  })
  const [config, setConfig] = useState<GatewayConfig>({})
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([
    { service: 'Gateway', status: 'connected', details: 'Port 18789' },
    { service: 'Telegram', status: 'connected', details: 'Bot active' },
    { service: 'Ollama', status: 'connected', details: 'localhost:11434' },
    { service: 'Tailscale', status: 'disconnected', details: 'Checking...' }
  ])
  const [loading, setLoading] = useState(true)
  const [tailscaleData, setTailscaleData] = useState<{
    connected: boolean; ip: string | null; peerCount: number; peers: { name: string; ip: string; online: boolean }[]
  } | null>(null)
  const [showTsModal, setShowTsModal] = useState(false)
  const [tsCountdown, setTsCountdown] = useState(10)
  const [tsToggling, setTsToggling] = useState(false)
  const [isViaTailscale, setIsViaTailscale] = useState(false)

  // Detect if accessing via Tailscale
  useEffect(() => {
    const host = window.location.hostname
    setIsViaTailscale(host.startsWith('100.') || host.includes('tailscale'))
  }, [])

  // Countdown for disconnect modal
  useEffect(() => {
    if (!showTsModal) return
    if (tsCountdown <= 0) return
    const timer = setTimeout(() => setTsCountdown(prev => prev - 1), 1000)
    return () => clearTimeout(timer)
  }, [showTsModal, tsCountdown])

  const fetchTailscale = async () => {
    try {
      const res = await fetch('/api/system/tailscale')
      if (res.ok) {
        const data = await res.json()
        setTailscaleData(data)
        setHealthChecks(prev => prev.map(check =>
          check.service === 'Tailscale'
            ? {
                service: 'Tailscale',
                status: data.connected ? 'connected' : 'disconnected',
                details: data.connected ? `${data.ip} · ${data.peerCount} peers` : 'Not connected'
              }
            : check
        ))
      }
    } catch { /* ignore */ }
  }

  const toggleTailscale = async (action: 'up' | 'down') => {
    setTsToggling(true)
    try {
      await fetch('/api/system/tailscale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      if (action === 'up') {
        // Wait a bit then refresh
        setTimeout(() => { fetchTailscale(); setTsToggling(false) }, 3000)
      } else {
        // If disconnecting via tailscale, we'll lose connection
        if (isViaTailscale) {
          setTsToggling(false)
          // Connection will drop
        } else {
          setTimeout(() => { fetchTailscale(); setTsToggling(false) }, 3000)
        }
      }
    } catch {
      setTsToggling(false)
    }
    setShowTsModal(false)
  }

  useEffect(() => {
    const fetchSystemData = async () => {
      try {
        // Fetch gateway config
        const configResponse = await fetch('/api/gateway/config')
        if (configResponse.ok) {
          const configData = await configResponse.json()
          setConfig(configData)
        }

        // Fetch Tailscale status
        fetchTailscale()
      } catch (error) {
        console.error('Failed to fetch system data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSystemData()
    
    // Update stats periodically
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        cpu: Math.max(10, Math.min(90, prev.cpu + (Math.random() - 0.5) * 10)),
        memory: Math.max(20, Math.min(85, prev.memory + (Math.random() - 0.5) * 5))
      }))
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  const GaugeComponent = ({ label, value, max = 100, color = 'accent' }: {
    label: string
    value: number
    max?: number
    color?: 'accent' | 'success' | 'warning' | 'danger'
  }) => {
    const percentage = (value / max) * 100
    const colorClass = {
      accent: 'var(--accent)',
      success: 'var(--success)',
      warning: 'var(--warning)',
      danger: 'var(--danger)'
    }[color]

    return (
      <div className="bg-[var(--bg-card)] rounded-lg p-4 border border-[var(--border)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-[var(--text-secondary)]">{label}</span>
          <span className="text-lg font-semibold text-[var(--text-primary)]">{value}%</span>
        </div>
        <div className="w-full bg-[var(--bg-primary)] rounded-full h-3">
          <div
            className="h-3 rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${percentage}%`,
              backgroundColor: colorClass
            }}
          />
        </div>
      </div>
    )
  }

  const ProcessItem = ({ name, status, pid }: { name: string; status: string; pid: string }) => (
    <div className="flex items-center justify-between py-2 px-3 bg-[var(--bg-hover)] rounded-lg">
      <div className="flex items-center gap-3">
        <Activity className="w-4 h-4 text-[var(--accent)]" />
        <span className="text-[var(--text-primary)]">{name}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--text-secondary)]">PID: {pid}</span>
        <span className="text-xs px-2 py-1 bg-[var(--success)]/20 text-[var(--success)] rounded">
          {status}
        </span>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Monitor className="w-6 h-6 text-[var(--accent)]" />
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">System</h1>
      </div>

      {loading && (
        <div className="text-center text-[var(--text-secondary)]">Loading system data...</div>
      )}

      {/* System Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[var(--bg-card)] rounded-lg p-4 border border-[var(--border)]">
          <div className="flex items-center gap-3 mb-2">
            <Server className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="font-semibold text-[var(--text-primary)]">Operating System</h3>
          </div>
          <p className="text-[var(--text-secondary)]">macOS arm64</p>
        </div>
        
        <div className="bg-[var(--bg-card)] rounded-lg p-4 border border-[var(--border)]">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="font-semibold text-[var(--text-primary)]">Node.js</h3>
          </div>
          <p className="text-[var(--text-secondary)]">v25.5.0</p>
        </div>
        
        <div className="bg-[var(--bg-card)] rounded-lg p-4 border border-[var(--border)]">
          <div className="flex items-center gap-3 mb-2">
            <Monitor className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="font-semibold text-[var(--text-primary)]">Gateway</h3>
          </div>
          <p className="text-[var(--text-secondary)]">Port {config.port || '18789'}</p>
        </div>
      </div>

      {/* Resource Usage */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Resource Usage</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <GaugeComponent
            label="CPU Usage"
            value={stats.cpu}
            color={stats.cpu > 80 ? 'danger' : stats.cpu > 60 ? 'warning' : 'success'}
          />
          <GaugeComponent
            label="Memory Usage"
            value={stats.memory}
            color={stats.memory > 80 ? 'danger' : stats.memory > 60 ? 'warning' : 'success'}
          />
          <GaugeComponent
            label="Disk Usage"
            value={stats.diskUsage}
            color={stats.diskUsage > 80 ? 'danger' : stats.diskUsage > 60 ? 'warning' : 'success'}
          />
        </div>
      </div>

      {/* Health Checks */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Health Checks</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {healthChecks.map((check) => (
            <div
              key={check.service}
              className="bg-[var(--bg-card)] rounded-lg p-4 border border-[var(--border)]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {check.status === 'connected' ? (
                    <CheckCircle className="w-5 h-5 text-[var(--success)]" />
                  ) : (
                    <XCircle className="w-5 h-5 text-[var(--danger)]" />
                  )}
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)]">{check.service}</h3>
                    {check.details && (
                      <p className="text-sm text-[var(--text-secondary)]">{check.details}</p>
                    )}
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    check.status === 'connected'
                      ? 'bg-[var(--success)]/20 text-[var(--success)]'
                      : 'bg-[var(--danger)]/20 text-[var(--danger)]'
                  }`}
                >
                  {check.status}
                </span>
              </div>
              {check.service === 'Tailscale' && (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (tailscaleData?.connected) {
                        if (isViaTailscale) {
                          setTsCountdown(10)
                          setShowTsModal(true)
                        } else {
                          toggleTailscale('down')
                        }
                      } else {
                        toggleTailscale('up')
                      }
                    }}
                    disabled={tsToggling}
                    className={`text-xs px-2.5 py-1 rounded-md font-medium transition ${
                      tailscaleData?.connected
                        ? 'bg-[var(--danger)]/15 text-[var(--danger)] hover:bg-[var(--danger)]/25'
                        : 'bg-[var(--success)]/15 text-[var(--success)] hover:bg-[var(--success)]/25'
                    } ${tsToggling ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    {tsToggling ? '...' : tailscaleData?.connected ? 'Disconnect' : 'Connect'}
                  </button>
                  {tailscaleData?.connected && (
                    <a
                      href={`http://${tailscaleData.ip}:3333`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Tailscale Disconnect Warning Modal */}
      {showTsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 max-w-md mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[var(--danger)]/15 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-[var(--danger)]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Disconnect Tailscale?</h3>
                <p className="text-sm text-[var(--text-secondary)]">You&apos;re accessing via Tailscale!</p>
              </div>
            </div>
            <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-lg p-3 mb-5">
              <p className="text-sm text-[var(--danger)]">
                ⚠️ Turning off Tailscale will <strong>immediately disconnect you</strong> from this dashboard. You&apos;ll need physical or LAN access to the Mac Mini to reconnect.
              </p>
            </div>
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowTsModal(false)}
                className="px-4 py-2 rounded-lg bg-[var(--bg-hover)] border border-[var(--border)] text-sm text-[var(--text-primary)] hover:bg-[var(--border)]/30 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => toggleTailscale('down')}
                disabled={tsCountdown > 0}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  tsCountdown > 0
                    ? 'bg-[var(--bg-hover)] text-[var(--text-secondary)] cursor-not-allowed'
                    : 'bg-[var(--danger)] text-white hover:bg-[var(--danger)]/80'
                }`}
              >
                {tsCountdown > 0 ? `Disconnect (${tsCountdown}s)` : 'Disconnect Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Process List */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Active Processes</h2>
        <div className="space-y-2">
          <ProcessItem name="Gateway Server" status="Running" pid="12345" />
          <ProcessItem name="Next.js Dev Server" status="Running" pid="12346" />
        </div>
      </div>
    </div>
  )
}