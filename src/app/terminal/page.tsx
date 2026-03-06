'use client'

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react'
import { Terminal as TerminalIcon, ChevronRight, Trash2, FolderOpen, Copy, Check } from 'lucide-react'

interface HistoryEntry {
  id: number
  command: string
  stdout: string
  stderr: string
  exitCode: number
  cwd: string
  timestamp: number
}

export default function TerminalPage() {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [cwd, setCwd] = useState(typeof window !== 'undefined' ? '~' : '~')
  const [running, setRunning] = useState(false)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const idCounter = useRef(0)

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [history, scrollToBottom])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const runCommand = async (cmd: string) => {
    if (!cmd.trim()) return

    setRunning(true)
    setCommandHistory(prev => [cmd, ...prev.slice(0, 99)])
    setHistoryIndex(-1)

    // Handle cd locally
    if (cmd.trim().startsWith('cd ')) {
      const dir = cmd.trim().slice(3).trim()
      try {
        const res = await fetch('/api/terminal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: `cd ${dir} && pwd`, cwd })
        })
        const data = await res.json()
        if (data.exitCode === 0 && data.stdout.trim()) {
          setCwd(data.stdout.trim())
          setHistory(prev => [...prev, {
            id: ++idCounter.current,
            command: cmd,
            stdout: '',
            stderr: '',
            exitCode: 0,
            cwd,
            timestamp: Date.now()
          }])
        } else {
          setHistory(prev => [...prev, {
            id: ++idCounter.current,
            command: cmd,
            stdout: '',
            stderr: data.stderr || `cd: no such directory: ${dir}`,
            exitCode: 1,
            cwd,
            timestamp: Date.now()
          }])
        }
      } catch {
        setHistory(prev => [...prev, {
          id: ++idCounter.current,
          command: cmd,
          stdout: '',
          stderr: 'Failed to execute command',
          exitCode: 1,
          cwd,
          timestamp: Date.now()
        }])
      }
      setRunning(false)
      setInput('')
      return
    }

    // Handle clear
    if (cmd.trim() === 'clear') {
      setHistory([])
      setRunning(false)
      setInput('')
      return
    }

    try {
      const res = await fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd, cwd })
      })
      const data = await res.json()
      
      setHistory(prev => [...prev, {
        id: ++idCounter.current,
        command: cmd,
        stdout: data.stdout || '',
        stderr: data.stderr || data.error || '',
        exitCode: data.exitCode ?? 1,
        cwd,
        timestamp: Date.now()
      }])
    } catch {
      setHistory(prev => [...prev, {
        id: ++idCounter.current,
        command: cmd,
        stdout: '',
        stderr: 'Network error — could not reach terminal API',
        exitCode: 1,
        cwd,
        timestamp: Date.now()
      }])
    }

    setRunning(false)
    setInput('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !running) {
      runCommand(input)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (commandHistory.length > 0) {
        const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1)
        setHistoryIndex(newIndex)
        setInput(commandHistory[newIndex])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setInput(commandHistory[newIndex])
      } else {
        setHistoryIndex(-1)
        setInput('')
      }
    } else if (e.key === 'c' && e.ctrlKey) {
      if (running) {
        setRunning(false)
        setHistory(prev => [...prev, {
          id: ++idCounter.current,
          command: input,
          stdout: '',
          stderr: '^C',
          exitCode: 130,
          cwd,
          timestamp: Date.now()
        }])
        setInput('')
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault()
      setHistory([])
    }
  }

  const copyOutput = (entry: HistoryEntry) => {
    const text = (entry.stdout + entry.stderr).trim()
    navigator.clipboard.writeText(text)
    setCopiedId(entry.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const shortCwd = cwd.replace(new RegExp('^' + (typeof window !== 'undefined' ? '' : '')), '~')

  return (
    <div className="flex flex-col h-[calc(100vh-52px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <TerminalIcon className="w-5 h-5 text-[var(--accent)]" />
          <h1 className="text-lg font-bold text-white">Terminal</h1>
          <span className="text-xs px-2 py-0.5 rounded bg-[var(--success)]/15 text-[var(--success)]">
            Mac Mini
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <FolderOpen className="w-3 h-3" />
            <span className="font-mono">{shortCwd}</span>
          </div>
          <button
            onClick={() => setHistory([])}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] hover:bg-[var(--bg-hover)] transition text-xs text-[var(--text-secondary)]"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-sm bg-[#0a0a0f]"
        onClick={() => inputRef.current?.focus()}
      >
        {/* Welcome */}
        {history.length === 0 && (
          <div className="text-[var(--text-secondary)] mb-4 space-y-1">
            <p className="text-[var(--accent)]">Welcome to Mission Control Terminal 🪼</p>
            <p className="text-xs">Connected to David&apos;s Mac Mini · zsh · {cwd}</p>
            <p className="text-xs text-[var(--text-secondary)]/60">
              Tips: ↑↓ history · Ctrl+L clear · Ctrl+C cancel · 30s timeout per command
            </p>
          </div>
        )}

        {/* History */}
        {history.map((entry) => (
          <div key={entry.id} className="mb-3 group">
            {/* Prompt + Command */}
            <div className="flex items-center gap-0">
              <span className="text-[var(--accent)] select-none">
                {entry.cwd.replace(new RegExp('^' + (typeof window !== 'undefined' ? '' : '')), '~')}
              </span>
              <span className="text-[var(--success)] select-none mx-1">
                <ChevronRight className="w-3 h-3 inline" />
              </span>
              <span className="text-white">{entry.command}</span>
            </div>

            {/* Output */}
            {(entry.stdout || entry.stderr) && (
              <div className="relative mt-0.5 pl-0">
                {entry.stdout && (
                  <pre className="text-[#c4c4d0] whitespace-pre-wrap break-all text-[13px] leading-5">
                    {entry.stdout}
                  </pre>
                )}
                {entry.stderr && (
                  <pre className={`whitespace-pre-wrap break-all text-[13px] leading-5 ${
                    entry.exitCode !== 0 ? 'text-[var(--danger)]' : 'text-[var(--warning)]'
                  }`}>
                    {entry.stderr}
                  </pre>
                )}
                {/* Copy button */}
                <button
                  onClick={() => copyOutput(entry)}
                  className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition p-1 rounded bg-[var(--bg-card)] border border-[var(--border)]"
                >
                  {copiedId === entry.id ? (
                    <Check className="w-3 h-3 text-[var(--success)]" />
                  ) : (
                    <Copy className="w-3 h-3 text-[var(--text-secondary)]" />
                  )}
                </button>
              </div>
            )}

            {/* Exit code indicator for errors */}
            {entry.exitCode !== 0 && entry.exitCode !== 130 && (
              <div className="text-[10px] text-[var(--danger)]/60 mt-0.5">
                exit code {entry.exitCode}
              </div>
            )}
          </div>
        ))}

        {/* Active Prompt */}
        <div className="flex items-center gap-0">
          <span className="text-[var(--accent)] select-none">{shortCwd}</span>
          <span className="text-[var(--success)] select-none mx-1">
            <ChevronRight className="w-3 h-3 inline" />
          </span>
          {running ? (
            <span className="text-[var(--text-secondary)] animate-pulse">Running...</span>
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent text-white outline-none caret-[var(--accent)] font-mono text-sm"
              placeholder=""
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-[var(--border)] bg-[var(--bg-secondary)] text-[10px] text-[var(--text-secondary)]">
        <div className="flex items-center gap-3">
          <span>zsh</span>
          <span>·</span>
          <span>{history.length} commands</span>
          <span>·</span>
          <span>{commandHistory.length} in history</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse" />
          <span>Connected</span>
        </div>
      </div>
    </div>
  )
}
