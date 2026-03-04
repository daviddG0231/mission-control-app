import { NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

const DATA_DIR = join(process.cwd(), 'data')
const TASKS_FILE = join(DATA_DIR, 'tasks.json')

const COLUMN_ID_MAP: Record<string, string> = {
  inprogress: 'in-progress',
  'in-progress': 'in-progress',
}

function normalizeColumns(cols: unknown): unknown {
  if (!Array.isArray(cols)) return cols
  return cols.map((c: { id?: string }) =>
    c.id && COLUMN_ID_MAP[c.id] ? { ...c, id: COLUMN_ID_MAP[c.id] } : c
  )
}

async function ensureDir() {
  try { await mkdir(DATA_DIR, { recursive: true }) } catch { /* exists */ }
}

export async function GET() {
  try {
    await ensureDir()
    const raw = await readFile(TASKS_FILE, 'utf-8')
    const data = JSON.parse(raw)
    return NextResponse.json(normalizeColumns(data))
  } catch {
    return NextResponse.json(null)
  }
}

export async function POST(request: Request) {
  try {
    await ensureDir()
    const body = await request.json()
    const normalized = normalizeColumns(body)
    await writeFile(TASKS_FILE, JSON.stringify(normalized, null, 2))
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
