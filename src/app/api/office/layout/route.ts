/**
 * Office layout persistence — save and load user's custom layout.
 * Layout is stored in data/office-layout.json and survives restarts.
 */
import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import fs from 'fs'

const DATA_DIR = join(process.cwd(), 'data')
const LAYOUT_FILE = join(DATA_DIR, 'office-layout.json')

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function isValidLayout(obj: unknown): obj is Record<string, unknown> {
  if (!obj || typeof obj !== 'object') return false
  const o = obj as Record<string, unknown>
  return (
    typeof o.version === 'number' &&
    typeof o.cols === 'number' &&
    typeof o.rows === 'number' &&
    Array.isArray(o.tiles)
  )
}

/** GET: return saved layout if it exists */
export async function GET() {
  try {
    if (!fs.existsSync(LAYOUT_FILE)) {
      return NextResponse.json({ layout: null })
    }
    const raw = fs.readFileSync(LAYOUT_FILE, 'utf-8')
    const layout = JSON.parse(raw) as unknown
    if (!isValidLayout(layout)) {
      return NextResponse.json({ layout: null })
    }
    return NextResponse.json({ layout })
  } catch {
    return NextResponse.json({ layout: null })
  }
}

/** DELETE: clear saved layout (revert to default on next load) */
export async function DELETE() {
  try {
    if (fs.existsSync(LAYOUT_FILE)) {
      fs.unlinkSync(LAYOUT_FILE)
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/** POST: save layout to disk */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const layout = body?.layout ?? body
    if (!isValidLayout(layout)) {
      return NextResponse.json(
        { error: 'Invalid layout: must have version, cols, rows, tiles' },
        { status: 400 }
      )
    }
    ensureDataDir()
    fs.writeFileSync(LAYOUT_FILE, JSON.stringify(layout, null, 2), 'utf-8')
    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
