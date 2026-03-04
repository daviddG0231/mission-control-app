import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const CONTACTS_FILE = path.join(process.cwd(), 'data', 'contacts.json')
const OPENCLAW_CONFIG = '/Users/david/.openclaw/openclaw.json'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'agent'
}

async function addAgentToOpenClaw(params: {
  name: string
  model: string
  avatar: string
  workspace?: string
}): Promise<string> {
  const raw = await fs.readFile(OPENCLAW_CONFIG, 'utf-8')
  const config = JSON.parse(raw)
  const list = config.agents?.list ?? []
  const workspace =
    params.workspace ?? config.agents?.defaults?.workspace ?? '/Users/david/.openclaw/workspace'

  let baseId = slugify(params.name)
  let agentId = baseId
  let n = 1
  const existingIds = new Set((list as { id?: string }[]).map((a) => a.id))
  while (existingIds.has(agentId)) {
    agentId = `${baseId}-${++n}`
  }

  const newAgent = {
    id: agentId,
    name: params.name,
    workspace,
    model: { primary: params.model },
    identity: { name: params.name, emoji: params.avatar || '🤖' },
  }
  list.push(newAgent)
  config.agents.list = list
  await fs.writeFile(OPENCLAW_CONFIG, JSON.stringify(config, null, 2))
  return agentId
}

async function readContacts() {
  try {
    const content = await fs.readFile(CONTACTS_FILE, 'utf-8')
    return JSON.parse(content)
  } catch {
    return []
  }
}

async function writeContacts(contacts: unknown[]) {
  await fs.writeFile(CONTACTS_FILE, JSON.stringify(contacts, null, 2))
}

export async function GET() {
  const contacts = await readContacts()
  return NextResponse.json({ contacts })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const contacts = await readContacts()
    const isAi = body.type === 'ai'

    let contactId: string
    if (isAi) {
      try {
        contactId = await addAgentToOpenClaw({
          name: body.name,
          model: body.model || 'anthropic/claude-sonnet-4-6',
          avatar: body.avatar || '🤖',
        })
      } catch (err) {
        console.error('Failed to add agent to OpenClaw:', err)
        return NextResponse.json(
          { error: `Failed to create OpenClaw agent: ${err instanceof Error ? err.message : String(err)}` },
          { status: 500 }
        )
      }
    } else {
      contactId = `contact-${Date.now()}`
    }

    const newContact = {
      id: contactId,
      name: body.name,
      role: body.role || '',
      email: body.email || undefined,
      timezone: body.timezone || 'GMT+0 (Global)',
      avatar: body.avatar || (isAi ? '🤖' : '👤'),
      type: body.type || 'ai',
      model: body.model || undefined,
      status: isAi ? 'active' : 'offline',
    }

    contacts.push(newContact)
    await writeContacts(contacts)

    return NextResponse.json({ contact: newContact })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    const contacts = await readContacts()
    const filtered = contacts.filter((c: { id: string }) => c.id !== id)
    await writeContacts(filtered)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 400 })
  }
}
