/**
 * Office templates API — list templates and get layout by ID.
 * Includes built-in templates, Headquarters (from asset file), and user-created templates.
 */
import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import fs from 'fs'
import { OFFICE_TEMPLATES } from '@/lib/office-templates'

const DATA_DIR = join(process.cwd(), 'data')
const USER_TEMPLATES_FILE = join(DATA_DIR, 'user-templates.json')
const HEADQUARTERS_PATH = join(process.cwd(), 'public', 'office-view', 'assets', 'headquarters-layout.json')

function loadUserTemplates(): Array<{ id: string; name: string; description: string; preview: string }> {
  try {
    if (!fs.existsSync(USER_TEMPLATES_FILE)) return []
    const raw = fs.readFileSync(USER_TEMPLATES_FILE, 'utf-8')
    const data = JSON.parse(raw) as { templates?: Array<{ id: string; name: string; description?: string; preview?: string }> }
    return (data.templates || []).map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description || 'Your custom layout',
      preview: t.preview || '✨',
    }))
  } catch {
    return []
  }
}

function loadUserTemplateLayout(id: string): Record<string, unknown> | null {
  try {
    if (!fs.existsSync(USER_TEMPLATES_FILE)) return null
    const raw = fs.readFileSync(USER_TEMPLATES_FILE, 'utf-8')
    const data = JSON.parse(raw) as { templates?: Array<{ id: string; layout: Record<string, unknown> }> }
    const t = (data.templates || []).find((x) => x.id === id)
    return t?.layout ?? null
  } catch {
    return null
  }
}

function loadHeadquartersLayout(): Record<string, unknown> | null {
  try {
    if (!fs.existsSync(HEADQUARTERS_PATH)) return null
    const raw = fs.readFileSync(HEADQUARTERS_PATH, 'utf-8')
    const layout = JSON.parse(raw) as unknown
    if (!layout || typeof layout !== 'object') return null
    const o = layout as Record<string, unknown>
    if (typeof o.version !== 'number' || typeof o.cols !== 'number' || typeof o.rows !== 'number' || !Array.isArray(o.tiles)) return null
    return o
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      // Headquarters — load from asset file
      if (id === 'headquarters') {
        const layout = loadHeadquartersLayout()
        if (!layout) return NextResponse.json({ error: 'Headquarters layout not found' }, { status: 404 })
        return NextResponse.json({
          template: {
            id: 'headquarters',
            name: 'Headquarters',
            description: 'The big office — large multi-room layout',
            preview: '🏛️',
            layout,
          },
        })
      }
      // User template
      const userLayout = loadUserTemplateLayout(id)
      if (userLayout) {
        const userList = loadUserTemplates()
        const meta = userList.find((t) => t.id === id)
        return NextResponse.json({
          template: {
            id,
            name: meta?.name ?? 'My template',
            description: meta?.description ?? '',
            preview: meta?.preview ?? '✨',
            layout: userLayout,
          },
        })
      }
      // Built-in template
      const template = OFFICE_TEMPLATES.find((t) => t.id === id)
      if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
      return NextResponse.json({ template })
    }

    // List all templates
    const builtIn = OFFICE_TEMPLATES.map((t) => ({ id: t.id, name: t.name, description: t.description, preview: t.preview }))
    const headquarters = fs.existsSync(HEADQUARTERS_PATH)
      ? [{ id: 'headquarters', name: 'Headquarters', description: 'The big office — large multi-room layout', preview: '🏛️' }]
      : []
    const userTemplates = loadUserTemplates()
    const templates = [...builtIn, ...headquarters, ...userTemplates]
    return NextResponse.json({ templates })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function isValidLayout(obj: unknown): obj is Record<string, unknown> {
  if (!obj || typeof obj !== 'object') return false
  const o = obj as Record<string, unknown>
  return typeof o.version === 'number' && typeof o.cols === 'number' && typeof o.rows === 'number' && Array.isArray(o.tiles)
}

/** POST: save a new user template from scratch */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, layout } = body ?? {}
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 })
    }
    if (!isValidLayout(layout)) {
      return NextResponse.json({ error: 'Invalid layout' }, { status: 400 })
    }
    ensureDataDir()
    const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const meta = { id, name: name.trim(), description: 'Your custom layout', preview: '✨' }
    let existing: { templates: Array<{ id: string; name: string; description?: string; preview?: string; layout: Record<string, unknown> }> } = { templates: [] }
    if (fs.existsSync(USER_TEMPLATES_FILE)) {
      existing = JSON.parse(fs.readFileSync(USER_TEMPLATES_FILE, 'utf-8'))
    }
    existing.templates.push({ ...meta, layout })
    fs.writeFileSync(USER_TEMPLATES_FILE, JSON.stringify(existing, null, 2), 'utf-8')
    return NextResponse.json({ success: true, template: { ...meta, layout } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/** DELETE: remove a user template */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id || !id.startsWith('user-')) {
      return NextResponse.json({ error: 'Invalid template id' }, { status: 400 })
    }
    if (!fs.existsSync(USER_TEMPLATES_FILE)) {
      return NextResponse.json({ success: true })
    }
    const data = JSON.parse(fs.readFileSync(USER_TEMPLATES_FILE, 'utf-8')) as { templates: Array<{ id: string }> }
    data.templates = data.templates.filter((t) => t.id !== id)
    fs.writeFileSync(USER_TEMPLATES_FILE, JSON.stringify(data, null, 2), 'utf-8')
    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
