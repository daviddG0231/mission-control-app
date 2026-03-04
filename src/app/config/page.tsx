'use client'

import { useEffect, useState } from 'react'
import { Settings, Edit, Save, RotateCcw, AlertTriangle } from 'lucide-react'

interface ConfigSection {
  name: string
  description: string
  data: unknown
}

export default function ConfigPage() {
  const [config, setConfig] = useState<Record<string, unknown>>({})
  const [editedConfig, setEditedConfig] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showRestartModal, setShowRestartModal] = useState(false)
  const [restartCountdown, setRestartCountdown] = useState(10)
  const [restarting, setRestarting] = useState(false)

  // Countdown for restart modal
  useEffect(() => {
    if (!showRestartModal) return
    if (restartCountdown <= 0) return
    const timer = setTimeout(() => setRestartCountdown(prev => prev - 1), 1000)
    return () => clearTimeout(timer)
  }, [showRestartModal, restartCountdown])

  const fetchConfig = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/gateway/config')
      if (!response.ok) throw new Error('Failed to fetch config')
      const data = await response.json()
      setConfig(data)
      setEditedConfig(JSON.stringify(data, null, 2))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveAndRestart = async () => {
    try {
      setSaving(true)
      
      // Validate JSON
      let parsedConfig
      try {
        parsedConfig = JSON.parse(editedConfig)
      } catch {
        throw new Error('Invalid JSON format')
      }

      // Save config
      const response = await fetch('/api/config/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedConfig)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save config')
      }

      setConfig(parsedConfig)
      setIsEditing(false)
      setRestartCountdown(10)
      setShowRestartModal(true)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleRestart = async () => {
    try {
      setRestarting(true)
      await fetch('/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'restart-gateway' })
      })
      setShowRestartModal(false)
      // Gateway will restart, connection may drop
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restart failed')
      setRestarting(false)
    }
  }

  const redactSensitiveData = (obj: unknown, path = ''): unknown => {
    if (typeof obj !== 'object' || obj === null) return obj
    
    const result: Record<string, unknown> = {}
    const objRecord = obj as Record<string, unknown>
    
    for (const [key, value] of Object.entries(objRecord)) {
      const currentPath = path ? `${path}.${key}` : key
      const isSecret = /token|key|secret|password|auth|credential/i.test(key)
      
      if (isSecret && typeof value === 'string' && value.length > 8) {
        result[key] = value.substring(0, 8) + '...'
      } else if (typeof value === 'object' && value !== null) {
        result[key] = redactSensitiveData(value, currentPath)
      } else {
        result[key] = value
      }
    }
    
    return result
  }

  const getConfigSections = (config: Record<string, unknown>): ConfigSection[] => {
    const sections: ConfigSection[] = []
    
    if (config.gateway) {
      sections.push({
        name: 'Gateway Settings',
        description: 'Core gateway configuration including port, auth, and network settings',
        data: config.gateway
      })
    }
    
    if (config.agents) {
      sections.push({
        name: 'Agent Configurations',
        description: 'AI agent settings and model configurations',
        data: config.agents
      })
    }
    
    if (config.channels) {
      sections.push({
        name: 'Channel Configurations',
        description: 'Communication channels like Telegram, Discord, etc.',
        data: config.channels
      })
    }
    
    if (config.models) {
      sections.push({
        name: 'Model Providers',
        description: 'AI model provider settings and API configurations',
        data: config.models
      })
    }
    
    // Add any other top-level keys
    const knownKeys = new Set(['gateway', 'agents', 'channels', 'models'])
    for (const [key, value] of Object.entries(config)) {
      if (!knownKeys.has(key) && typeof value === 'object' && value !== null) {
        sections.push({
          name: key.charAt(0).toUpperCase() + key.slice(1),
          description: `${key} configuration`,
          data: value
        })
      }
    }
    
    return sections
  }

  const formatJson = (obj: unknown) => {
    return JSON.stringify(redactSensitiveData(obj), null, 2)
  }

  useEffect(() => {
    fetchConfig()
  }, [])

  const sections = getConfigSections(config)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-[var(--accent)]" />
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Configuration</h1>
        </div>
        <div className="text-center text-[var(--text-secondary)] py-8">Loading configuration...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-[var(--accent)]" />
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Configuration</h1>
        </div>
        
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setIsEditing(false)
                  setEditedConfig(JSON.stringify(config, null, 2))
                  setError(null)
                }}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--border)]/30 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAndRestart}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--warning)] text-white rounded-lg hover:bg-[var(--warning)]/80 transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save & Restart'}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/20 text-[var(--danger)] p-4 rounded-lg">
          {error}
        </div>
      )}

      {isEditing ? (
        <div className="space-y-4">
          <div className="bg-[var(--warning)]/10 border border-[var(--warning)]/20 text-[var(--warning)] p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Configuration Editor</p>
                <p className="text-sm mt-1 opacity-90">
                  Editing the configuration directly can break the gateway. Make sure the JSON is valid before saving.
                  The gateway will restart after saving.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] overflow-hidden">
            <div className="bg-[var(--bg-hover)] px-4 py-2 border-b border-[var(--border)]">
              <span className="text-sm font-medium text-[var(--text-primary)]">openclaw.json</span>
            </div>
            <textarea
              value={editedConfig}
              onChange={(e) => setEditedConfig(e.target.value)}
              className="w-full h-[600px] p-4 bg-transparent text-[var(--text-primary)] font-mono text-sm resize-none focus:outline-none"
              spellCheck={false}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {sections.length === 0 ? (
            <div className="text-center text-[var(--text-secondary)] py-8">
              No configuration sections found
            </div>
          ) : (
            sections.map((section) => (
              <div key={section.name} className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)]">
                <div className="p-4 border-b border-[var(--border)]">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">{section.name}</h3>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">{section.description}</p>
                </div>
                <div className="p-0 overflow-hidden">
                  <pre className="text-sm p-4 overflow-x-auto bg-[var(--bg-primary)] text-[var(--text-primary)] whitespace-pre-wrap">
                    <code>{formatJson(section.data)}</code>
                  </pre>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Restart Confirmation Modal */}
      {showRestartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 max-w-md mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[var(--warning)]/15 flex items-center justify-center">
                <RotateCcw className="w-5 h-5 text-[var(--warning)]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Restart Gateway?</h3>
                <p className="text-sm text-[var(--text-secondary)]">Configuration saved successfully</p>
              </div>
            </div>
            <div className="bg-[var(--warning)]/10 border border-[var(--warning)]/20 rounded-lg p-3 mb-5">
              <p className="text-sm text-[var(--warning)]">
                The gateway will restart to apply the new configuration. This may briefly interrupt connections.
              </p>
            </div>
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowRestartModal(false)}
                className="px-4 py-2 rounded-lg bg-[var(--bg-hover)] border border-[var(--border)] text-sm text-[var(--text-primary)] hover:bg-[var(--border)]/30 transition"
              >
                Skip Restart
              </button>
              <button
                onClick={handleRestart}
                disabled={restarting || restartCountdown > 0}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  restartCountdown > 0 || restarting
                    ? 'bg-[var(--bg-hover)] text-[var(--text-secondary)] cursor-not-allowed'
                    : 'bg-[var(--warning)] text-white hover:bg-[var(--warning)]/80'
                }`}
              >
                {restarting ? 'Restarting...' : restartCountdown > 0 ? `Restart (${restartCountdown}s)` : 'Restart Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}