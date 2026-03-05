import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

const CONTACTS_FILE = path.join(process.cwd(), 'data', 'contacts.json')
const OPENCLAW_CONFIG = path.join(process.env.HOME || os.homedir(), '.openclaw', 'openclaw.json')

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

async function removeAgentFromOpenClaw(agentId: string): Promise<boolean> {
  try {
    const raw = await fs.readFile(OPENCLAW_CONFIG, 'utf-8')
    const config = JSON.parse(raw)
    const list = (config.agents?.list ?? []) as { id?: string }[]
    const filtered = list.filter((a) => a.id !== agentId)
    if (filtered.length === list.length) return false
    config.agents = config.agents ?? {}
    config.agents.list = filtered
    await fs.writeFile(OPENCLAW_CONFIG, JSON.stringify(config, null, 2))
    return true
  } catch {
    return false
  }
}

function getDefaultHumanContact(): { id: string; name: string; role: string; email?: string; timezone: string; avatar: string; type: 'human'; status: 'online' } {
  const name = process.env.USER_NAME || 'User'
  const id = process.env.USER_ID || slugify(name)
  return {
    id,
    name,
    role: 'Human Lead',
    email: process.env.USER_EMAIL || undefined,
    timezone: process.env.USER_TIMEZONE || 'GMT+0 (Global)',
    avatar: process.env.USER_AVATAR || '👨‍💻',
    type: 'human',
    status: 'online',
  }
}

interface OpenClawAgent {
  id?: string
  name?: string
  model?: { primary?: string }
  identity?: { name?: string; emoji?: string }
  workspace?: string
}

async function readAgentsFromConfig(): Promise<Array<{ id: string; name: string; role: string; timezone: string; avatar: string; type: 'ai'; model?: string; status: 'active' }>> {
  try {
    const content = await fs.readFile(OPENCLAW_CONFIG, 'utf-8')
    const config = JSON.parse(content)
    const list = config.agents?.list ?? (Array.isArray(config.agents) ? config.agents : []) as OpenClawAgent[]
    return list
      .filter((a: OpenClawAgent) => a.id)
      .map((a: OpenClawAgent) => ({
        id: a.id!,
        name: a.identity?.name || a.name || a.id!,
        role: a.id === 'builder' ? 'AI Builder' : a.id === 'advisor' ? 'AI Advisor' : 'AI Agent',
        timezone: 'GMT+0 (Global)',
        avatar: a.identity?.emoji || '🤖',
        type: 'ai' as const,
        model: a.model?.primary,
        status: 'active' as const,
      }))
  } catch {
    return []
  }
}

async function readHumanContacts(): Promise<unknown[]> {
  const defaultContact = getDefaultHumanContact()
  try {
    const content = await fs.readFile(CONTACTS_FILE, 'utf-8')
    const parsed = JSON.parse(content)
    const arr = Array.isArray(parsed) ? parsed : []
    const humans = arr.filter((c: { type?: string }) => c.type === 'human') as Array<{ id?: string; email?: string; name?: string; [k: string]: unknown }>
    const primaryId = process.env.USER_ID || slugify(process.env.USER_NAME || '')
    const primaryEmail = process.env.USER_EMAIL
    const primaryName = (process.env.USER_NAME || '').toLowerCase()
    return humans.map((c) => {
      const isPrimary =
        (primaryId && c.id === primaryId) ||
        (primaryEmail && c.email === primaryEmail) ||
        (primaryName && (c.name || '').toLowerCase() === primaryName)
      if (isPrimary) return { ...c, ...defaultContact, id: c.id ?? defaultContact.id, isPrimary: true }
      return c
    })
  } catch {
    return [{ ...defaultContact, isPrimary: true }]
  }
}

async function writeHumanContacts(contacts: unknown[]) {
  const dir = path.dirname(CONTACTS_FILE)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(CONTACTS_FILE, JSON.stringify(contacts, null, 2))
}

export async function GET() {
  const [agents, humans] = await Promise.all([readAgentsFromConfig(), readHumanContacts()])
  const contacts = [...humans, ...agents]
  return NextResponse.json({ contacts })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const isAi = body.type === 'ai'

    if (isAi) {
      try {
        const contactId = await addAgentToOpenClaw({
          name: body.name,
          model: body.model || 'anthropic/claude-sonnet-4-6',
          avatar: body.avatar || '🤖',
        })
        const newContact = {
          id: contactId,
          name: body.name,
          role: body.role || 'AI Agent',
          timezone: body.timezone || 'GMT+0 (Global)',
          avatar: body.avatar || '🤖',
          type: 'ai' as const,
          model: body.model || undefined,
          status: 'active' as const,
        }
        return NextResponse.json({ contact: newContact })
      } catch (err) {
        console.error('Failed to add agent to OpenClaw:', err)
        return NextResponse.json(
          { error: `Failed to create OpenClaw agent: ${err instanceof Error ? err.message : String(err)}` },
          { status: 500 }
        )
      }
    }

    // Human contact: store in contacts.json
    const humans = await readHumanContacts()
    const contactId = `contact-${Date.now()}`
    const newContact = {
      id: contactId,
      name: body.name,
      role: body.role || 'Team Member',
      email: body.email || undefined,
      timezone: body.timezone || 'GMT+0 (Global)',
      avatar: body.avatar || '👨‍💻',
      type: 'human' as const,
      status: 'online' as const,
    }
    humans.push(newContact)
    await writeHumanContacts(humans)
    return NextResponse.json({ contact: newContact })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 400 })
  }
}

function isPrimaryUser(c: { id?: string; email?: string; name?: string }): boolean {
  const primaryId = process.env.USER_ID || slugify(process.env.USER_NAME || '')
  const primaryEmail = process.env.USER_EMAIL
  const primaryName = (process.env.USER_NAME || '').toLowerCase()
  return (
    Boolean(primaryId && c.id === primaryId) ||
    Boolean(primaryEmail && c.email === primaryEmail) ||
    Boolean(primaryName && (c.name || '').toLowerCase() === primaryName)
  )
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    // Check if deleting primary human (from .env)
    const humans = await readHumanContacts()
    const target = (humans as Array<{ id?: string; email?: string; name?: string; type?: string }>).find((c) => c.id === id)
    if (target && target.type === 'human' && isPrimaryUser(target)) {
      return NextResponse.json({ error: 'Cannot delete primary user' }, { status: 403 })
    }
    // Try removing from OpenClaw config first (AI agents)
    const removedFromConfig = await removeAgentFromOpenClaw(id)
    if (removedFromConfig) return NextResponse.json({ success: true })

    // Otherwise remove from human contacts (reuse humans from above)
    const filtered = (humans as { id: string }[]).filter((c) => c.id !== id)
    if (filtered.length === humans.length) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }
    await writeHumanContacts(filtered)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 400 })
  }
}
