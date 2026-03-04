'use client'

import { useEffect, useState } from 'react'
import { 
  Terminal, 
  RotateCcw, 
  Square, 
  Play, 
  BarChart3, 
  Trash2, 
  Download, 
  Info, 
  AlertTriangle,
  Clock
} from 'lucide-react'

interface Command {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  dangerous?: boolean
  confirmation?: string
  command: string
}

interface CommandResult {
  command: string
  output: string
  timestamp: number
  success: boolean
}

interface LastExecution {
  [key: string]: number
}

export default function CommandsPage() {
  const [executing, setExecuting] = useState<string | null>(null)
  const [output, setOutput] = useState<CommandResult[]>([])
  const [showModal, setShowModal] = useState<Command | null>(null)
  const [modalCountdown, setModalCountdown] = useState(5)
  const [lastExecutions, setLastExecutions] = useState<LastExecution>({})

  const commands: Command[] = [
    {
      id: 'restart-gateway',
      name: 'Restart Gateway',
      description: 'Restart the OpenClaw gateway service',
      icon: <RotateCcw className="w-5 h-5" />,
      command: 'restart-gateway'
    },
    {
      id: 'stop-gateway',
      name: 'Stop Gateway',
      description: 'Stop the OpenClaw gateway service',
      icon: <Square className="w-5 h-5" />,
      dangerous: true,
      confirmation: 'This will stop the OpenClaw gateway service. You will lose connection to this dashboard!',
      command: 'stop-gateway'
    },
    {
      id: 'start-gateway',
      name: 'Start Gateway',
      description: 'Start the OpenClaw gateway service',
      icon: <Play className="w-5 h-5" />,
      command: 'start-gateway'
    },
    {
      id: 'gateway-status',
      name: 'Gateway Status',
      description: 'Check the status of the OpenClaw gateway',
      icon: <BarChart3 className="w-5 h-5" />,
      command: 'gateway-status'
    },
    {
      id: 'clear-sessions',
      name: 'Clear Sessions',
      description: 'Clear all active sessions (placeholder)',
      icon: <Trash2 className="w-5 h-5" />,
      dangerous: true,
      confirmation: 'This will clear all active sessions and conversation history. This action cannot be undone!',
      command: 'clear-sessions'
    },
    {
      id: 'update-openclaw',
      name: 'Update OpenClaw',
      description: 'Update OpenClaw to the latest version',
      icon: <Download className="w-5 h-5" />,
      confirmation: 'This will update OpenClaw to the latest version. The process may take a few minutes.',
      command: 'update-openclaw'
    },
    {
      id: 'openclaw-version',
      name: 'OpenClaw Version',
      description: 'Show the current OpenClaw version',
      icon: <Info className="w-5 h-5" />,
      command: 'openclaw-version'
    },
    {
      id: 'clear-next-cache',
      name: 'Clear .next Cache',
      description: 'Clear Next.js build cache for this dashboard',
      icon: <Trash2 className="w-5 h-5" />,
      command: 'clear-next-cache'
    }
  ]

  // Countdown for dangerous command modal
  useEffect(() => {
    if (!showModal?.dangerous) return
    if (modalCountdown <= 0) return
    const timer = setTimeout(() => setModalCountdown(prev => prev - 1), 1000)
    return () => clearTimeout(timer)
  }, [showModal, modalCountdown])

  const executeCommand = async (cmd: Command) => {
    if (cmd.dangerous || cmd.confirmation) {
      setModalCountdown(5)
      setShowModal(cmd)
      return
    }

    await runCommand(cmd)
  }

  const runCommand = async (cmd: Command) => {
    try {
      setExecuting(cmd.id)
      setShowModal(null)
      
      const timestamp = Date.now()
      setLastExecutions(prev => ({ ...prev, [cmd.id]: timestamp }))
      
      const response = await fetch('/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd.command })
      })

      const result = await response.json()
      
      const commandResult: CommandResult = {
        command: cmd.name,
        output: result.output || result.error || 'Command executed',
        timestamp,
        success: response.ok
      }

      setOutput(prev => [commandResult, ...prev.slice(0, 9)]) // Keep last 10 results
    } catch (err) {
      const commandResult: CommandResult = {
        command: cmd.name,
        output: err instanceof Error ? err.message : 'Unknown error',
        timestamp: Date.now(),
        success: false
      }
      setOutput(prev => [commandResult, ...prev.slice(0, 9)])
    } finally {
      setExecuting(null)
    }
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  const getTimeSince = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Terminal className="w-6 h-6 text-[var(--accent)]" />
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Commands</h1>
      </div>

      {/* Command Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {commands.map((cmd) => (
          <div
            key={cmd.id}
            className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4 hover:bg-[var(--bg-hover)] transition"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className={`p-2 rounded-lg ${
                cmd.dangerous 
                  ? 'bg-[var(--danger)]/15 text-[var(--danger)]' 
                  : 'bg-[var(--accent)]/15 text-[var(--accent)]'
              }`}>
                {cmd.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-[var(--text-primary)] text-sm">{cmd.name}</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">{cmd.description}</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                {lastExecutions[cmd.id] && (
                  <>
                    <Clock className="w-3 h-3" />
                    <span>{getTimeSince(lastExecutions[cmd.id])}</span>
                  </>
                )}
              </div>
              <button
                onClick={() => executeCommand(cmd)}
                disabled={executing === cmd.id}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                  executing === cmd.id
                    ? 'bg-[var(--bg-hover)] text-[var(--text-secondary)] cursor-wait'
                    : cmd.dangerous
                    ? 'bg-[var(--danger)]/15 text-[var(--danger)] hover:bg-[var(--danger)]/25'
                    : 'bg-[var(--accent)]/15 text-[var(--accent)] hover:bg-[var(--accent)]/25'
                }`}
              >
                {executing === cmd.id ? 'Running...' : 'Run'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Command Output */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Command Output</h2>
        
        {output.length === 0 ? (
          <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-8 text-center">
            <Terminal className="w-12 h-12 text-[var(--text-secondary)] mx-auto mb-3" />
            <p className="text-[var(--text-secondary)]">No commands executed yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {output.map((result, index) => (
              <div
                key={index}
                className={`bg-[var(--bg-card)] rounded-lg border transition ${
                  result.success 
                    ? 'border-[var(--border)]' 
                    : 'border-[var(--danger)]/30 bg-[var(--danger)]/5'
                }`}
              >
                <div className="flex items-center justify-between p-3 border-b border-[var(--border)]">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      result.success ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'
                    }`} />
                    <span className="font-medium text-sm text-[var(--text-primary)]">{result.command}</span>
                  </div>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {formatTime(result.timestamp)}
                  </span>
                </div>
                <pre className="p-3 text-sm font-mono text-[var(--text-primary)] whitespace-pre-wrap overflow-x-auto bg-[var(--bg-primary)] rounded-b-lg">
                  {result.output}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 max-w-md mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                showModal.dangerous 
                  ? 'bg-[var(--danger)]/15' 
                  : 'bg-[var(--warning)]/15'
              }`}>
                {showModal.dangerous ? (
                  <AlertTriangle className="w-5 h-5 text-[var(--danger)]" />
                ) : (
                  showModal.icon
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{showModal.name}</h3>
                <p className="text-sm text-[var(--text-secondary)]">Confirm action</p>
              </div>
            </div>
            
            <div className={`rounded-lg p-3 mb-5 border ${
              showModal.dangerous 
                ? 'bg-[var(--danger)]/10 border-[var(--danger)]/20' 
                : 'bg-[var(--warning)]/10 border-[var(--warning)]/20'
            }`}>
              <p className={`text-sm ${
                showModal.dangerous ? 'text-[var(--danger)]' : 'text-[var(--warning)]'
              }`}>
                {showModal.confirmation || `Are you sure you want to execute "${showModal.name}"?`}
              </p>
            </div>
            
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowModal(null)}
                className="px-4 py-2 rounded-lg bg-[var(--bg-hover)] border border-[var(--border)] text-sm text-[var(--text-primary)] hover:bg-[var(--border)]/30 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => runCommand(showModal)}
                disabled={showModal.dangerous && modalCountdown > 0}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  showModal.dangerous && modalCountdown > 0
                    ? 'bg-[var(--bg-hover)] text-[var(--text-secondary)] cursor-not-allowed'
                    : showModal.dangerous
                    ? 'bg-[var(--danger)] text-white hover:bg-[var(--danger)]/80'
                    : 'bg-[var(--warning)] text-white hover:bg-[var(--warning)]/80'
                }`}
              >
                {showModal.dangerous && modalCountdown > 0 
                  ? `Execute (${modalCountdown}s)` 
                  : 'Execute'
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}