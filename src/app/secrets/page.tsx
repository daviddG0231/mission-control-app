'use client'

import { useState, useEffect } from 'react'
import { Lock, Eye, EyeOff, Copy, Check, RefreshCw, ShieldCheck, KeyRound } from 'lucide-react'

interface EnvVar {
  key: string
  value: string
  source: string
}

export default function SecretsPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [envVars, setEnvVars] = useState<EnvVar[]>([])
  const [loading, setLoading] = useState(false)
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [shakeError, setShakeError] = useState(false)

  const handleLogin = async () => {
    setError('')
    try {
      const res = await fetch('/api/secrets', {
        headers: { 'X-Secrets-Password': password }
      })
      if (res.ok) {
        const data = await res.json()
        setEnvVars(data.vars)
        setAuthenticated(true)
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Wrong password')
        setShakeError(true)
        setTimeout(() => setShakeError(false), 500)
      }
    } catch {
      setError('Failed to connect')
    }
  }

  const refresh = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/secrets', {
        headers: { 'X-Secrets-Password': password }
      })
      if (res.ok) {
        const data = await res.json()
        setEnvVars(data.vars)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  const toggleVisibility = (key: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const copyValue = (key: string, value: string) => {
    navigator.clipboard.writeText(value)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const maskValue = (value: string) => {
    if (value.length <= 8) return '•'.repeat(value.length)
    return value.slice(0, 4) + '•'.repeat(Math.min(value.length - 8, 20)) + value.slice(-4)
  }

  // Auto-lock after 5 minutes of inactivity
  useEffect(() => {
    if (!authenticated) return
    const timer = setTimeout(() => {
      setAuthenticated(false)
      setEnvVars([])
      setVisibleKeys(new Set())
      setPassword('')
    }, 5 * 60 * 1000)
    return () => clearTimeout(timer)
  }, [authenticated])

  // Group by source
  const grouped = envVars.reduce<Record<string, EnvVar[]>>((acc, v) => {
    if (!acc[v.source]) acc[v.source] = []
    acc[v.source].push(v)
    return acc
  }, {})

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-8 max-w-sm w-full">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 rounded-full bg-[var(--accent)]/15 flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-[var(--accent)]" />
            </div>
            <h1 className="text-xl font-bold text-white">Secrets Vault</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">Enter password to access environment variables</p>
          </div>

          <div className={`space-y-4 ${shakeError ? 'animate-shake' : ''}`}>
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="Password"
                className="w-full px-4 py-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] text-sm"
                autoFocus
              />
              {error && (
                <p className="text-xs text-[var(--danger)] mt-2 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> {error}
                </p>
              )}
            </div>
            <button
              onClick={handleLogin}
              className="w-full py-3 rounded-lg bg-[var(--accent)] text-white font-medium text-sm hover:bg-[var(--accent)]/80 transition"
            >
              Unlock
            </button>
          </div>

          <p className="text-xs text-[var(--text-secondary)] text-center mt-4">
            🔒 Auto-locks after 5 minutes
          </p>
        </div>

        <style jsx>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-8px); }
            50% { transform: translateX(8px); }
            75% { transform: translateX(-4px); }
          }
          .animate-shake { animation: shake 0.4s ease-in-out; }
        `}</style>
      </div>
    )
  }

  return (
    <div className="p-3 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <KeyRound className="w-6 h-6 text-[var(--accent)]" />
          <h1 className="text-2xl font-bold text-white">Secrets & Environment</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--success)]/15 text-[var(--success)]">
            {envVars.length} variables
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] hover:bg-[var(--bg-hover)] transition text-sm text-[var(--text-secondary)]"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => { setAuthenticated(false); setEnvVars([]); setVisibleKeys(new Set()); setPassword('') }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--danger)]/15 border border-[var(--danger)]/20 hover:bg-[var(--danger)]/25 transition text-sm text-[var(--danger)]"
          >
            <Lock className="w-4 h-4" />
            Lock
          </button>
        </div>
      </div>

      {/* Grouped env vars */}
      {Object.entries(grouped).map(([source, vars]) => (
        <div key={source} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
          <div className="px-5 py-3 border-b border-[var(--border)]">
            <h2 className="text-sm font-semibold text-white">{source}</h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {vars.map((v) => (
              <div key={v.key} className="flex items-center justify-between px-5 py-3 group hover:bg-[var(--bg-hover)] transition">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-[var(--accent)]">{v.key}</p>
                  <p className="text-xs font-mono text-[var(--text-secondary)] mt-0.5 truncate">
                    {visibleKeys.has(v.key) ? v.value : maskValue(v.value)}
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-4">
                  <button
                    onClick={() => toggleVisibility(v.key)}
                    className="p-1.5 rounded hover:bg-[var(--bg-hover)] transition"
                    title={visibleKeys.has(v.key) ? 'Hide' : 'Show'}
                  >
                    {visibleKeys.has(v.key)
                      ? <EyeOff className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                      : <Eye className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                    }
                  </button>
                  <button
                    onClick={() => copyValue(v.key, v.value)}
                    className="p-1.5 rounded hover:bg-[var(--bg-hover)] transition"
                    title="Copy"
                  >
                    {copiedKey === v.key
                      ? <Check className="w-3.5 h-3.5 text-[var(--success)]" />
                      : <Copy className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
