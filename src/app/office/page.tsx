'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Building2, RefreshCw, LayoutGrid, X } from 'lucide-react'

interface OfficeAgent {
  id: string
  name: string
  emoji: string
  status: 'typing' | 'reading' | 'waiting' | 'idle'
  currentTool?: string
  currentToolName?: string
  animation?: 'typing' | 'reading'
  isSubagent?: boolean
  parentId?: string
}

interface AgentsResponse {
  agents: OfficeAgent[]
  error?: string
}

interface TemplateInfo {
  id: string
  name: string
  description: string
  preview: string
}

export default function OfficePage() {
  const [assetsLoaded, setAssetsLoaded] = useState(false)
  const [agents, setAgents] = useState<OfficeAgent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [templates, setTemplates] = useState<TemplateInfo[]>([])
  const [loadingTemplate, setLoadingTemplate] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const prevAgentIdsRef = useRef<Set<string>>(new Set())
  const prevSubagentIdsRef = useRef<Set<string>>(new Set())
  const subagentParentMapRef = useRef<Map<string, string>>(new Map())
  const agentIdMapRef = useRef<Map<string, number>>(new Map())
  const agentsRef = useRef<OfficeAgent[]>([])
  const prevStatusRef = useRef<Map<string, string>>(new Map())

  // Keep agentsRef in sync
  useEffect(() => { agentsRef.current = agents }, [agents])

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/office/agents', { cache: 'no-store' })
      const data: AgentsResponse = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch')
      setAgents(data.agents || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents')
      setAgents([])
    }
  }, [])

  // Fetch template list
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/office/templates', { cache: 'no-store' })
      const data = await res.json()
      if (data.templates) setTemplates(data.templates)
    } catch { /* ignore */ }
  }, [])

  // Load a template and send to iframe
  const loadTemplate = useCallback(async (templateId: string) => {
    setLoadingTemplate(templateId)
    try {
      const res = await fetch(`/api/office/templates?id=${templateId}`, { cache: 'no-store' })
      const data = await res.json()
      if (data.template?.layout) {
        const win = iframeRef.current?.contentWindow
        if (win) {
          win.postMessage({ type: 'layoutLoaded', layout: data.template.layout }, '*')
        }
      }
      setShowTemplates(false)
    } catch {
      setError('Failed to load template')
    } finally {
      setLoadingTemplate(null)
    }
  }, [])

  // Send assets + agents to iframe once both are ready
  const sendAssetsToIframe = useCallback((data: Record<string, unknown>) => {
    const win = iframeRef.current?.contentWindow
    if (!win) return

    if (data.floorTiles) {
      win.postMessage({ type: 'floorTilesLoaded', sprites: data.floorTiles }, '*')
    }
    if (data.wallTiles) {
      win.postMessage({ type: 'wallTilesLoaded', sprites: data.wallTiles }, '*')
    }
    if (data.characterSprites) {
      win.postMessage(
        { type: 'characterSpritesLoaded', characters: data.characterSprites },
        '*'
      )
    }

    if (data.layout) {
      win.postMessage({ type: 'layoutLoaded', layout: data.layout }, '*')
    }

    win.postMessage({ type: 'settingsLoaded', soundEnabled: false }, '*')

    // Load furniture assets (100 items from the pixel-agents extension pack)
    fetch('/api/office/furniture', { cache: 'no-store' })
      .then((res) => res.json())
      .then((furnitureData) => {
        if (furnitureData.catalog && furnitureData.sprites) {
          win.postMessage({
            type: 'furnitureAssetsLoaded',
            catalog: furnitureData.catalog,
            sprites: furnitureData.sprites,
          }, '*')
          console.log(`📦 Sent ${furnitureData.loaded} furniture assets to iframe`)
          // Resend layout so furniture renders with new catalog
          if (data.layout) {
            win.postMessage({ type: 'layoutLoaded', layout: data.layout }, '*')
          }
        }
      })
      .catch(() => console.warn('Failed to load furniture assets'))

    setAssetsLoaded(true)
  }, [])

  // Fetch assets, then wait for iframe load before posting
  useEffect(() => {
    let cancelled = false
    let assetsData: Record<string, unknown> | null = null
    let iframeLoaded = false

    function trySend() {
      if (cancelled || !assetsData || !iframeLoaded) return
      // Extra delay to ensure iframe JS has initialized
      setTimeout(() => {
        if (!cancelled && assetsData) sendAssetsToIframe(assetsData)
      }, 300)
    }

    async function fetchAssets() {
      try {
        const res = await fetch('/api/office/assets', { cache: 'no-store' })
        const data = await res.json()
        if (!res.ok || cancelled) return
        assetsData = data
        trySend()
      } catch {
        if (!cancelled) setError('Failed to load office assets')
      }
    }

    const iframe = iframeRef.current
    function onIframeLoad() {
      iframeLoaded = true
      trySend()
    }

    if (iframe) {
      iframe.addEventListener('load', onIframeLoad)
    }
    fetchAssets()

    // Fallback in case load event was missed
    const fallback = setTimeout(() => {
      if (!iframeLoaded) {
        iframeLoaded = true
        trySend()
      }
    }, 2000)

    return () => {
      cancelled = true
      if (iframe) iframe.removeEventListener('load', onIframeLoad)
      clearTimeout(fallback)
    }
  }, [sendAssetsToIframe])

  // Fetch agents immediately (before assets) so they're ready
  useEffect(() => {
    fetchAgents()
    const interval = setInterval(fetchAgents, 4000)
    return () => clearInterval(interval)
  }, [fetchAgents])

  // Sync agents to iframe — use agentCreated for reliability
  useEffect(() => {
    if (!assetsLoaded) return
    const win = iframeRef.current?.contentWindow
    if (!win) return

    const mainAgents = agents.filter((a) => !a.isSubagent)
    const currentIds = new Set(mainAgents.map((a) => a.id))
    const idMap = agentIdMapRef.current
    const prevIds = prevAgentIdsRef.current

    // Assign numeric IDs
    let nextId = idMap.size > 0 ? Math.max(...Array.from(idMap.values())) + 1 : 1
    for (const a of mainAgents) {
      if (!idMap.has(a.id)) idMap.set(a.id, nextId++)
    }

    // Remove agents that left
    for (const id of prevIds) {
      if (!currentIds.has(id)) {
        const numId = idMap.get(id)
        if (numId != null) {
          win.postMessage({ type: 'agentClosed', id: numId }, '*')
          idMap.delete(id)
        }
      }
    }

    // Add new agents via agentCreated (more reliable than existingAgents)
    for (const a of mainAgents) {
      if (!prevIds.has(a.id)) {
        const numId = idMap.get(a.id)!
        win.postMessage({ type: 'agentCreated', id: numId, folderName: a.name }, '*')
      }
    }

    // Update statuses — idle agents roam freely, working agents sit at desks
    const prevStatuses = prevStatusRef.current
    for (const a of mainAgents) {
      const numId = idMap.get(a.id)
      if (numId == null) continue
      const prev = prevStatuses.get(a.id)

      if (a.status === 'typing' || a.status === 'reading') {
        // Agent is actively working — sit at desk and type/read
        win.postMessage({ type: 'agentStatus', id: numId, status: 'active' }, '*')
        if (a.currentTool && a.currentToolName) {
          win.postMessage({
            type: 'agentToolStart',
            id: numId,
            toolId: `oc-${a.id}`,
            status: a.currentTool,
          }, '*')
        }
      } else if (a.status === 'waiting' && prev !== 'waiting') {
        // Just finished — show done bubble once, then they'll wander
        win.postMessage({ type: 'agentStatus', id: numId, status: 'waiting' }, '*')
        win.postMessage({ type: 'agentToolsClear', id: numId }, '*')
      } else if (a.status === 'idle') {
        // Only send inactive once (on transition from active → idle)
        if (prev === 'typing' || prev === 'reading' || !prev) {
          win.postMessage({ type: 'agentStatus', id: numId, status: 'waiting' }, '*')
          win.postMessage({ type: 'agentToolsClear', id: numId }, '*')
        }
        // Otherwise: don't resend — let them keep wandering freely
      }

      prevStatuses.set(a.id, a.status)
    }

    prevIds.clear()
    mainAgents.forEach((a) => prevIds.add(a.id))

    // Sync subagents — create character beside parent when agent is talking to another agent
    const subagents = agents.filter((a) => a.isSubagent && a.parentId)
    const currentSubIds = new Set(subagents.map((s) => s.id))
    const prevSubIds = prevSubagentIdsRef.current

    // Remove subagents that left
    const parentMap = subagentParentMapRef.current
    for (const id of prevSubIds) {
      if (!currentSubIds.has(id)) {
        const parentId = parentMap.get(id)
        if (parentId) {
          const parentNumId = idMap.get(parentId)
          if (parentNumId != null) {
            win.postMessage({ type: 'subagentClear', id: parentNumId, parentToolId: `oc-sub-${id}` }, '*')
          }
          parentMap.delete(id)
        }
        prevSubIds.delete(id)
      }
    }

    // Add new subagents — they appear beside parent (officeState prefers adjacent seats)
    for (const sub of subagents) {
      const parentNumId = sub.parentId ? idMap.get(sub.parentId) : undefined
      if (!parentNumId) continue
      if (!prevSubIds.has(sub.id)) {
        parentMap.set(sub.id, sub.parentId)
        win.postMessage({
          type: 'agentToolStart',
          id: parentNumId,
          toolId: `oc-sub-${sub.id}`,
          status: `Subtask: ${sub.name}`,
        }, '*')
        if (sub.status === 'typing') {
          win.postMessage({ type: 'agentStatus', id: parentNumId, status: 'active' }, '*')
        }
      }
    }
    prevSubIds.clear()
    subagents.forEach((s) => prevSubIds.add(s.id))
  }, [agents, assetsLoaded])

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1
            className="text-2xl font-bold flex items-center gap-2"
            style={{
              fontFamily: 'ui-monospace, monospace',
              color: 'white',
              textShadow: '2px 2px 0 var(--accent)',
            }}
          >
            <Building2 className="w-7 h-7 text-[var(--accent)]" />
            Agent Office
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            OpenClaw agents — pixel-agents office view
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowTemplates(true); fetchTemplates() }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all rounded-none border-2 border-[var(--accent)] hover:bg-[var(--accent)]/20"
            style={{ background: 'var(--bg-card)', color: 'var(--accent)' }}
          >
            <LayoutGrid className="w-4 h-4" />
            Templates
          </button>
          <button
            onClick={fetchAgents}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all rounded-none border-2 border-[var(--border)] hover:bg-[var(--bg-hover)]"
            style={{ background: 'var(--bg-card)', color: 'white' }}
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-none border-2 border-[var(--danger)] bg-[var(--danger)]/10 text-[var(--danger)] text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 rounded-none overflow-hidden border-2 border-[var(--border)] bg-[#1e1e2e] relative">
        <iframe
          ref={iframeRef}
          src="/office-view/index.html"
          className="w-full h-full border-0"
          title="Agent Office"
          sandbox="allow-scripts allow-same-origin"
        />
        {!assetsLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e2e] text-[var(--text-secondary)]">
            <p className="text-sm">Loading pixel office…</p>
          </div>
        )}
      </div>

      {/* Template Picker Modal */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div
            className="w-full max-w-2xl mx-4 border-2 border-[var(--border)] shadow-2xl"
            style={{ background: 'var(--bg-card)' }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b-2 border-[var(--border)]">
              <h2
                className="text-xl font-bold flex items-center gap-2"
                style={{ fontFamily: 'ui-monospace, monospace', color: 'white' }}
              >
                <LayoutGrid className="w-5 h-5 text-[var(--accent)]" />
                Choose a Template
              </h2>
              <button
                onClick={() => setShowTemplates(false)}
                className="p-1 hover:bg-[var(--bg-hover)] transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => loadTemplate(t.id)}
                  disabled={loadingTemplate !== null}
                  className="text-left p-4 border-2 border-[var(--border)] hover:border-[var(--accent)] transition-all group"
                  style={{ background: 'var(--bg-main)' }}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">{t.preview}</span>
                    <div className="flex-1 min-w-0">
                      <h3
                        className="font-bold text-sm group-hover:text-[var(--accent)] transition-colors"
                        style={{ color: 'white', fontFamily: 'ui-monospace, monospace' }}
                      >
                        {t.name}
                        {loadingTemplate === t.id && ' …'}
                      </h3>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {t.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="px-6 py-3 border-t-2 border-[var(--border)]">
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                💡 Tip: Click <strong>Layout</strong> in the office view to edit your map — add furniture, paint floors, resize rooms!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
