'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Building2, RefreshCw, LayoutGrid, X, Save, RotateCcw, Plus, Trash2, Users } from 'lucide-react'

const CHARACTER_COUNT = 6
const CHAR_STORAGE_KEY = 'office-character-map'

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
  const [savingLayout, setSavingLayout] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [showCharacters, setShowCharacters] = useState(false)
  const [characterMap, setCharacterMap] = useState<Record<string, number>>({})

  // Load character map from localStorage on mount (avoid hydration mismatch)
  const hasLoadedCharacterMap = useRef(false)
  useEffect(() => {
    try {
      const s = localStorage.getItem(CHAR_STORAGE_KEY)
      if (s) setCharacterMap(JSON.parse(s) as Record<string, number>)
    } catch { /* ignore */ }
    hasLoadedCharacterMap.current = true
  }, [])
  const lastLayoutRef = useRef<Record<string, unknown> | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const prevAgentIdsRef = useRef<Set<string>>(new Set())
  const prevSubagentIdsRef = useRef<Set<string>>(new Set())
  const subagentParentMapRef = useRef<Map<string, string>>(new Map())
  const agentIdMapRef = useRef<Map<string, number>>(new Map())
  const agentsRef = useRef<OfficeAgent[]>([])
  const prevStatusRef = useRef<Map<string, string>>(new Map())

  // Keep agentsRef in sync
  useEffect(() => { agentsRef.current = agents }, [agents])

  useEffect(() => {
    if (!hasLoadedCharacterMap.current) return
    try {
      localStorage.setItem(CHAR_STORAGE_KEY, JSON.stringify(characterMap))
    } catch { /* ignore */ }
  }, [characterMap])

  const setAgentCharacter = useCallback((agentId: string, charIndex: number) => {
    setCharacterMap((m) => ({ ...m, [agentId]: charIndex }))
  }, [])

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

  // Load a template, send to iframe, and persist so it survives restart
  const loadTemplate = useCallback(async (templateId: string) => {
    setLoadingTemplate(templateId)
    try {
      const res = await fetch(`/api/office/templates?id=${templateId}`, { cache: 'no-store' })
      const data = await res.json()
      if (data.template?.layout) {
        const layout = data.template.layout as Record<string, unknown>
        lastLayoutRef.current = layout
        const win = iframeRef.current?.contentWindow
        if (win) {
          win.postMessage({ type: 'layoutLoaded', layout }, '*')
        }
        // Persist so layout survives restart
        await fetch('/api/office/layout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ layout }),
        })
      }
      setShowTemplates(false)
    } catch {
      setError('Failed to load template')
    } finally {
      setLoadingTemplate(null)
    }
  }, [])

  // Save current layout (from iframe response or last sent layout)
  const saveLayout = useCallback(async (layout: Record<string, unknown>) => {
    setSavingLayout(true)
    setSaveMessage(null)
    try {
      const res = await fetch('/api/office/layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setSaveMessage('Layout saved — it will persist on restart')
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSavingLayout(false)
    }
  }, [])

  // Reset saved layout and reload
  const handleResetLayout = useCallback(async () => {
    try {
      await fetch('/api/office/layout', { method: 'DELETE' })
      window.location.reload()
    } catch {
      setSaveMessage('Failed to reset layout')
      setTimeout(() => setSaveMessage(null), 3000)
    }
  }, [])

  // Create new template from scratch — load Custom blank canvas
  const handleCreateNewTemplate = useCallback(async () => {
    await loadTemplate('custom')
    setShowTemplates(false)
    setSaveMessage('Design your layout in Layout mode, then click "Save as template"')
    setTimeout(() => setSaveMessage(null), 5000)
  }, [loadTemplate])

  // Save current layout as a new user template
  const handleSaveAsTemplate = useCallback(async () => {
    const layout = lastLayoutRef.current
    if (!layout) {
      const res = await fetch('/api/office/layout', { cache: 'no-store' })
      const data = await res.json()
      if (data.layout) {
        lastLayoutRef.current = data.layout
        setShowSaveAsTemplate(true)
        return
      }
      setSaveMessage('No layout to save. Pick Custom and design first, or pick a template.')
      setTimeout(() => setSaveMessage(null), 3000)
      return
    }
    setShowSaveAsTemplate(true)
  }, [])

  const submitSaveAsTemplate = useCallback(async () => {
    const name = newTemplateName.trim()
    if (!name) {
      setSaveMessage('Enter a template name')
      setTimeout(() => setSaveMessage(null), 2000)
      return
    }
    const layout = lastLayoutRef.current
    if (!layout) {
      setSaveMessage('No layout to save')
      setShowSaveAsTemplate(false)
      return
    }
    setSavingLayout(true)
    try {
      const res = await fetch('/api/office/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, layout }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save template')
      setSaveMessage('Template saved! It will appear in Templates.')
      setShowSaveAsTemplate(false)
      setNewTemplateName('')
      fetchTemplates()
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Failed to save template')
    } finally {
      setSavingLayout(false)
    }
  }, [newTemplateName, fetchTemplates])

  const handleDeleteUserTemplate = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!id.startsWith('user-')) return
    try {
      await fetch(`/api/office/templates?id=${id}`, { method: 'DELETE' })
      fetchTemplates()
    } catch { /* ignore */ }
  }, [fetchTemplates])

  // Request layout from iframe and save (pixel-agents may respond with layout)
  const handleSaveLayout = useCallback(() => {
    const win = iframeRef.current?.contentWindow
    if (win) {
      win.postMessage({ type: 'requestLayout' }, '*')
    }
    // Fallback: save last layout we sent (e.g. from template) if iframe doesn't respond
    if (lastLayoutRef.current) {
      saveLayout(lastLayoutRef.current)
    } else {
      setSaveMessage('No layout to save. Pick a template first or edit in Layout mode.')
      setTimeout(() => setSaveMessage(null), 3000)
    }
  }, [saveLayout])

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
      lastLayoutRef.current = data.layout as Record<string, unknown>
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
            lastLayoutRef.current = data.layout as Record<string, unknown>
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

  // Listen for layout from iframe (when user saves in Layout mode)
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data = e.data
      if (!data || typeof data !== 'object') return
      if (data.type === 'layout' || data.type === 'layoutSaved') {
        const layout = data.layout as Record<string, unknown> | undefined
        if (layout && typeof layout.version === 'number' && Array.isArray(layout.tiles)) {
          lastLayoutRef.current = layout
          saveLayout(layout)
        }
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [saveLayout])

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
    for (const id of Array.from(prevIds)) {
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
        const raw = characterMap[a.id]
        const charIndex = (typeof raw === 'number' && raw >= 0 && raw < CHARACTER_COUNT)
          ? raw
          : (numId % CHARACTER_COUNT)
        win.postMessage({
          type: 'agentCreated',
          id: numId,
          folderName: a.name,
          characterIndex: charIndex,
        }, '*')
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
    for (const id of Array.from(prevSubIds)) {
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
      if (!prevSubIds.has(sub.id) && sub.parentId) {
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
  }, [agents, assetsLoaded, characterMap])

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
            onClick={() => setShowCharacters(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all rounded-none border-2 border-[var(--border)] hover:bg-[var(--bg-hover)]"
            style={{ background: 'var(--bg-card)', color: 'white' }}
            title="Choose character avatars"
          >
            <Users className="w-4 h-4" />
            Characters
          </button>
          <button
            onClick={() => { setShowTemplates(true); fetchTemplates() }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all rounded-none border-2 border-[var(--accent)] hover:bg-[var(--accent)]/20"
            style={{ background: 'var(--bg-card)', color: 'var(--accent)' }}
          >
            <LayoutGrid className="w-4 h-4" />
            Templates
          </button>
          <button
            onClick={handleSaveAsTemplate}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all rounded-none border-2 border-[var(--accent)]/60 hover:bg-[var(--accent)]/20"
            style={{ background: 'var(--bg-card)', color: 'var(--accent)' }}
            title="Save current layout as a new template"
          >
            <Plus className="w-4 h-4" />
            Save as template
          </button>
          <button
            onClick={handleSaveLayout}
            disabled={savingLayout}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all rounded-none border-2 border-[var(--accent)]/60 hover:bg-[var(--accent)]/20 disabled:opacity-50"
            style={{ background: 'var(--bg-card)', color: 'var(--accent)' }}
          >
            <Save className="w-4 h-4" />
            {savingLayout ? 'Saving…' : 'Save layout'}
          </button>
          <button
            onClick={handleResetLayout}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all rounded-none border-2 border-[var(--border)] hover:bg-[var(--bg-hover)]"
            style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }}
            title="Reset to default layout"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
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
      {saveMessage && (
        <div
          className="mb-4 p-3 rounded-none border-2 text-sm"
          style={{
            borderColor: saveMessage.includes('persist') ? 'var(--accent)' : 'var(--text-secondary)',
            color: saveMessage.includes('persist') ? 'var(--accent)' : 'var(--text-secondary)',
            background: 'var(--bg-card)',
          }}
        >
          {saveMessage}
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
              {/* Create new from scratch */}
              <button
                onClick={handleCreateNewTemplate}
                disabled={loadingTemplate !== null}
                className="text-left p-4 border-2 border-dashed border-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all group"
                style={{ background: 'var(--bg-main)' }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl">➕</span>
                  <div className="flex-1 min-w-0">
                    <h3
                      className="font-bold text-sm group-hover:text-[var(--accent)]"
                      style={{ color: 'var(--accent)', fontFamily: 'ui-monospace, monospace' }}
                    >
                      Create new template
                    </h3>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                      Start from a blank canvas and design your own
                    </p>
                  </div>
                </div>
              </button>
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => loadTemplate(t.id)}
                  disabled={loadingTemplate !== null}
                  className="text-left p-4 border-2 border-[var(--border)] hover:border-[var(--accent)] transition-all group relative"
                  style={{ background: 'var(--bg-main)' }}
                >
                  {t.id.startsWith('user-') && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteUserTemplate(e, t.id)}
                      className="absolute top-2 right-2 p-1 rounded hover:bg-[var(--danger)]/20"
                      style={{ color: 'var(--text-secondary)' }}
                      title="Delete template"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
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
            <div className="px-6 py-3 border-t-2 border-[var(--border)] space-y-1">
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                💡 <strong>Headquarters</strong> is the big office. Use <strong>Create new template</strong> to design from scratch, then <strong>Save as template</strong> to add it here.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Character picker modal */}
      {showCharacters && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div
            className="w-full max-w-md mx-4 border-2 border-[var(--border)] max-h-[80vh] overflow-hidden flex flex-col"
            style={{ background: 'var(--bg-card)' }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b-2 border-[var(--border)]">
              <h2
                className="text-lg font-bold flex items-center gap-2"
                style={{ fontFamily: 'ui-monospace, monospace', color: 'white' }}
              >
                <Users className="w-5 h-5 text-[var(--accent)]" />
                Choose Characters
              </h2>
              <button
                onClick={() => setShowCharacters(false)}
                className="p-1 hover:bg-[var(--bg-hover)]"
                style={{ color: 'var(--text-secondary)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              {agents.filter((a) => !a.isSubagent).length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  No agents in the office yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {agents.filter((a) => !a.isSubagent).map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between gap-4 p-3 border-2 border-[var(--border)]"
                      style={{ background: 'var(--bg-main)' }}
                    >
                      <span className="font-medium" style={{ color: 'white' }}>
                        {a.emoji} {a.name}
                      </span>
                      <select
                        value={characterMap[a.id] ?? -1}
                        onChange={(e) => setAgentCharacter(a.id, parseInt(e.target.value, 10))}
                        className="px-2 py-1 border-2 border-[var(--border)] text-sm"
                        style={{ background: 'var(--bg-card)', color: 'white' }}
                      >
                        <option value={-1}>Auto</option>
                        {Array.from({ length: CHARACTER_COUNT }, (_, i) => (
                          <option key={i} value={i}>
                            Character {i + 1}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Save as template modal */}
      {showSaveAsTemplate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div
            className="w-full max-w-md mx-4 p-6 border-2 border-[var(--border)]"
            style={{ background: 'var(--bg-card)' }}
          >
            <h3 className="text-lg font-bold mb-3" style={{ color: 'white', fontFamily: 'ui-monospace, monospace' }}>
              Save as new template
            </h3>
            <input
              type="text"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              placeholder="Template name"
              className="w-full px-3 py-2 mb-4 border-2 border-[var(--border)] outline-none focus:border-[var(--accent)]"
              style={{ background: 'var(--bg-main)', color: 'white' }}
              onKeyDown={(e) => e.key === 'Enter' && submitSaveAsTemplate()}
            />
            <div className="flex gap-2">
              <button
                onClick={submitSaveAsTemplate}
                disabled={savingLayout || !newTemplateName.trim()}
                className="flex-1 px-4 py-2 border-2 border-[var(--accent)] font-medium disabled:opacity-50"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                {savingLayout ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => { setShowSaveAsTemplate(false); setNewTemplateName('') }}
                className="px-4 py-2 border-2 border-[var(--border)]"
                style={{ background: 'var(--bg-main)', color: 'white' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
