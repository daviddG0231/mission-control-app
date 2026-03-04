'use client'

import { useState } from 'react'
import { Search, Pause, Play, Pin, Settings, Maximize2, Command, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Header() {
  const [paused, setPaused] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [pinging, setPinging] = useState(false)

  async function handlePingPatrick() {
    setPinging(true)
    try {
      const res = await fetch('/api/gateway/session/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionKey: 'builder:main', message: '/status' }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send')
      }
    } catch (e) {
      console.error('Ping Patrick failed:', e)
    } finally {
      setPinging(false)
    }
  }

  return (
    <>
      <header className="sticky top-0 z-40 h-[52px] bg-[var(--bg-secondary)]/80 backdrop-blur-xl border-b border-[var(--border)] flex items-center px-5 gap-3">
        {/* Title */}
        <div className="flex items-center gap-2.5 mr-4">
          <span className="text-base">🪼</span>
          <span className="text-sm font-bold text-white">Mission Control</span>
        </div>

        {/* Search */}
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-hover)] border border-[var(--border)] hover:border-[var(--text-secondary)] transition text-sm text-[var(--text-secondary)] min-w-[200px]"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search...</span>
          <div className="ml-auto flex items-center gap-0.5 text-[10px] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded border border-[var(--border)]">
            <Command className="w-2.5 h-2.5" />K
          </div>
        </button>

        <div className="flex-1" />

        {/* Controls */}
        <button
          onClick={() => setPaused(!paused)}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition',
            paused
              ? 'bg-[var(--warning)]/15 border-[var(--warning)]/30 text-[var(--warning)]'
              : 'bg-[var(--bg-hover)] border-[var(--border)] text-[var(--text-secondary)] hover:text-white'
          )}
        >
          {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          {paused ? 'Resume' : 'Pause'}
        </button>

        <button
          onClick={handlePingPatrick}
          disabled={pinging}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent-hover)] text-sm hover:bg-[var(--accent)]/25 transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pinging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pin className="w-3.5 h-3.5" />}
          Ping Patrick
        </button>

        <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--bg-hover)] transition text-[var(--text-secondary)]">
          <Settings className="w-4 h-4" />
        </button>
        <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--bg-hover)] transition text-[var(--text-secondary)]">
          <Maximize2 className="w-4 h-4" />
        </button>
      </header>

      {/* Search Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={() => setSearchOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-[560px] bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
              <Search className="w-4 h-4 text-[var(--text-secondary)]" />
              <input
                autoFocus
                placeholder="Search sessions, agents, tasks, memory..."
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[var(--text-secondary)]"
              />
              <kbd className="text-[10px] bg-[var(--bg-hover)] px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-secondary)]">ESC</kbd>
            </div>
            <div className="p-3 max-h-[300px] overflow-y-auto">
              <p className="text-xs text-[var(--text-secondary)] text-center py-6">Type to search across your workspace</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
