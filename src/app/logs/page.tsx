'use client'

import { useGatewayData } from '@/hooks/use-gateway'
import { FileText, RefreshCw, Search, Pause, Play, ArrowDown, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useEffect, useRef } from 'react'

interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  source: 'gateway' | 'agent' | 'status'
}

interface LogsResponse {
  logs: LogEntry[]
  error?: string
}

export default function LogsPage() {
  const [isPaused, setIsPaused] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [isScrolledUp, setIsScrolledUp] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  const { data, loading, error, refetch } = useGatewayData<LogsResponse>(
    '/api/logs',
    isPaused ? 0 : 5000
  )

  const logs = data?.logs || []

  // Filter logs based on search and level
  const filteredLogs = logs.filter(log => {
    const msg = typeof log.message === 'string' ? log.message : String(log.message || '')
    const matchesSearch = msg.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesLevel = levelFilter === 'all' || log.level === levelFilter
    return matchesSearch && matchesLevel
  }).slice(0, 500)

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [filteredLogs, autoScroll])

  // Handle scroll detection
  useEffect(() => {
    const handleScroll = () => {
      if (scrollRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
        setIsScrolledUp(!isAtBottom)
        if (isAtBottom) {
          setAutoScroll(true)
        }
      }
    }

    const scrollElement = scrollRef.current
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll)
      return () => scrollElement.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const jumpToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      setAutoScroll(true)
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-[var(--danger)] bg-[var(--danger)]/10'
      case 'warn': return 'text-[var(--warning)] bg-[var(--warning)]/10'
      case 'debug': return 'text-[var(--text-secondary)] bg-[var(--bg-hover)]'
      default: return 'text-[var(--text-primary)] bg-[var(--bg-card)]'
    }
  }

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'gateway': return 'bg-[var(--accent)]/15 text-[var(--accent)]'
      case 'agent': return 'bg-[var(--success)]/15 text-[var(--success)]'
      case 'status': return 'bg-[var(--warning)]/15 text-[var(--warning)]'
      default: return 'bg-[var(--bg-hover)] text-[var(--text-secondary)]'
    }
  }

  return (
    <div className="p-3 md:p-6 space-y-6 h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <FileText className="w-6 h-6 text-[var(--accent)]" />
            Gateway Logs
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Live OpenClaw gateway and agent logs
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg border transition text-sm',
              isPaused 
                ? 'bg-[var(--success)]/10 border-[var(--success)]/30 text-[var(--success)]'
                : 'bg-[var(--warning)]/10 border-[var(--warning)]/30 text-[var(--warning)]'
            )}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          
          <button
            onClick={refetch}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] hover:bg-[var(--bg-hover)] transition text-sm text-[var(--text-secondary)]"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
          />
        </div>
        
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="px-3 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          <option value="all">All Levels</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
          <option value="debug">Debug</option>
        </select>
        
        <div className="text-xs text-[var(--text-secondary)]">
          {filteredLogs.length} entries
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded-lg p-4 flex-shrink-0">
          <p className="text-sm text-[var(--danger)]">⚠️ Error: {error}</p>
        </div>
      )}

      {/* Logs Container */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl p-4 font-mono text-xs leading-relaxed"
          onScroll={() => setAutoScroll(false)}
        >
          {loading && filteredLogs.length === 0 && (
            <div className="text-center text-[var(--text-secondary)] py-8">
              <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
              Loading logs...
            </div>
          )}

          {!loading && filteredLogs.length === 0 && (
            <div className="text-center text-[var(--text-secondary)] py-8">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No logs found
            </div>
          )}

          <div className="space-y-1">
            {filteredLogs.map((log, index) => (
              <div
                key={`${log.timestamp}-${index}`}
                className="flex items-start gap-3 hover:bg-[var(--bg-hover)]/30 px-2 py-1 rounded group"
              >
                <div className="flex items-center gap-2 text-[var(--text-secondary)] flex-shrink-0">
                  <Clock className="w-3 h-3" />
                  <span className="w-16">{formatTimestamp(log.timestamp)}</span>
                </div>
                
                <span className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide flex-shrink-0 w-12 text-center',
                  getLevelColor(log.level)
                )}>
                  {typeof log.level === 'string' ? log.level : String(log.level || '')}
                </span>
                
                <span className={cn(
                  'px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wide flex-shrink-0',
                  getSourceBadge(log.source)
                )}>
                  {typeof log.source === 'string' ? log.source : String(log.source || '')}
                </span>
                
                <span className="text-[var(--text-primary)] flex-1 break-words">
                  {typeof log.message === 'string' ? log.message : JSON.stringify(log.message)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Jump to Bottom Button */}
        {isScrolledUp && (
          <button
            onClick={jumpToBottom}
            className="absolute bottom-4 right-4 bg-[var(--accent)] text-white p-2 rounded-full shadow-lg hover:bg-[var(--accent)]/80 transition"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}