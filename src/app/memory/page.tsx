'use client'

import { useState, useEffect } from 'react'
import { Brain, FileText, ChevronRight, RefreshCw, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MemoryIndex {
  mainMemory: boolean
  files: string[]
}

export default function MemoryPage() {
  const [index, setIndex] = useState<MemoryIndex | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [contentLoading, setContentLoading] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/gateway/memory')
      .then((r) => r.json())
      .then(setIndex)
      .catch(() => setIndex({ mainMemory: false, files: [] }))
      .finally(() => setLoading(false))
  }, [])

  async function loadFile(path: string) {
    setSelectedFile(path)
    setContentLoading(true)
    try {
      const res = await fetch(`/api/gateway/memory?file=${encodeURIComponent(path)}`)
      const data = await res.json()
      setContent(data.content || 'Failed to load')
    } catch {
      setContent('Error loading file')
    } finally {
      setContentLoading(false)
    }
  }

  const filteredFiles = index?.files.filter((f) =>
    f.toLowerCase().includes(search.toLowerCase())
  ) || []

  return (
    <div className="p-3 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Brain className="w-6 h-6 text-[var(--accent)]" />
          Memory
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Browse MEMORY.md and daily memory files
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[600px]">
        {/* File list */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl flex flex-col">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search files..."
                className="w-full pl-9 pr-3 py-2 bg-[var(--bg-hover)] rounded-lg text-sm text-white outline-none focus:ring-1 focus:ring-[var(--accent)]/50 placeholder:text-[var(--text-secondary)]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {loading && (
              <div className="p-4 text-center">
                <RefreshCw className="w-4 h-4 animate-spin mx-auto text-[var(--text-secondary)]" />
              </div>
            )}

            {/* MEMORY.md */}
            {index?.mainMemory && (
              <button
                onClick={() => loadFile('MEMORY.md')}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm transition',
                  selectedFile === 'MEMORY.md'
                    ? 'bg-[var(--accent)]/15 text-[var(--accent-hover)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white'
                )}
              >
                <Brain className="w-4 h-4 shrink-0" />
                <span className="font-medium">MEMORY.md</span>
                <ChevronRight className="w-3 h-3 ml-auto" />
              </button>
            )}

            {/* Daily files */}
            {filteredFiles.map((file) => (
              <button
                key={file}
                onClick={() => loadFile(`memory/${file}`)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm transition',
                  selectedFile === `memory/${file}`
                    ? 'bg-[var(--accent)]/15 text-[var(--accent-hover)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white'
                )}
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span>{file.replace('.md', '')}</span>
                <ChevronRight className="w-3 h-3 ml-auto" />
              </button>
            ))}

            {!loading && filteredFiles.length === 0 && !index?.mainMemory && (
              <p className="text-xs text-[var(--text-secondary)] text-center py-4">No memory files found</p>
            )}
          </div>
        </div>

        {/* Content viewer */}
        <div className="lg:col-span-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl flex flex-col">
          <div className="px-5 py-3 border-b border-[var(--border)] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--accent)]" />
            <span className="text-sm font-medium text-white">
              {selectedFile || 'Select a file'}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            {contentLoading && (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-5 h-5 animate-spin text-[var(--text-secondary)]" />
              </div>
            )}

            {!selectedFile && !contentLoading && (
              <div className="text-center py-16">
                <Brain className="w-10 h-10 text-[var(--text-secondary)] mx-auto mb-3 opacity-30" />
                <p className="text-sm text-[var(--text-secondary)]">
                  Select a memory file to view its contents
                </p>
              </div>
            )}

            {selectedFile && !contentLoading && (
              <pre className="text-sm text-[var(--text-primary)] whitespace-pre-wrap font-mono leading-relaxed">
                {content}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
