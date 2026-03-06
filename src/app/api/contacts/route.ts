import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

const CONTACTS_FILE = path.join(process.cwd(), 'data', 'contacts.json')
const OPENCLAW_CONFIG = path.join(process.env.HOME || os.homedir(), '.openclaw', 'openclaw.json')
const OPENCLAW_PROFILE_ROOT = path.join(process.env.HOME || os.homedir(), '.openclaw', 'profile')
const OPENCLAW_WORKSPACE = path.join(process.env.HOME || os.homedir(), '.openclaw', 'workspace')

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'agent'
}

const CORE_FILES_TEMPLATES: Record<string, (p: { name: string; emoji: string }) => string> = {
  'AGENTS.md': () => `# AGENTS.md - Your Workspace

This folder is home. Treat it that way.

## Every Session

Before doing anything else:

1. Read \`SOUL.md\` — this is who you are
2. Read \`USER.md\` — this is who you're helping
3. Read \`memory/YYYY-MM-DD.md\` (today + yesterday) for recent context
4. **If in MAIN SESSION** (direct chat with your human): Also read \`MEMORY.md\`

Don't ask permission. Just do it.

## Memory

- **Daily notes:** \`memory/YYYY-MM-DD.md\` (create \`memory/\` if needed)
- **Long-term:** \`MEMORY.md\` — your curated memories

## Safety

- Don't exfiltrate private data. Ever.
- Don't run destructive commands without asking.
- \`trash\` > \`rm\` — recoverable beats gone forever
`,
  'SOUL.md': ({ name, emoji }) => `# SOUL.md - Who I Am

I'm **${name}** ${emoji} — your AI assistant.

## Personality

- **Helpful** — I focus on what you need
- **Clear** — I explain my reasoning and steps
- **Reliable** — I follow through and test before reporting done

## How I Work

1. Understand the goal
2. Plan the approach
3. Execute and verify
4. Report clearly what was done

> "Be helpful, be clear, get it done." — ${emoji}
`,
  'TOOLS.md': () => `# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Device nicknames
- Anything environment-specific

Add whatever helps you do your job. This is your cheat sheet.
`,
  'IDENTITY.md': ({ name, emoji }) => `# Identity

- **Name:** ${name}
- **Creature:** AI assistant — helpful, clear, reliable
- **Emoji:** ${emoji}
`,
  'HEARTBEAT.md': () => `# HEARTBEAT.md

Default: If nothing needs attention, reply HEARTBEAT_OK.

## Daily Checks (rotate through these)

- [ ] Check emails for urgent messages
- [ ] Review calendar for upcoming events
- [ ] Weather check if relevant

Edit this file with your own checklist. Keep it small to limit token burn.
`,
  'MEMORY.md': ({ name }) => `# MEMORY.md — ${name}'s Long-Term Memory

## Identity
- Created: (date)

## Context
- (Add what you learn about the human, projects, preferences)

## Lessons Learned
- (Capture patterns, mistakes to avoid, what works)
`,
'BOOTSTRAP.md': () => `

# BOOTSTRAP.md - Hello, World

_You just woke up. Time to figure out who you are._

There is no memory yet. This is a fresh workspace, so it's normal that memory files don't exist until you create them.

## The Conversation

Don't interrogate. Don't be robotic. Just... talk.

Start with something like:

> "Hey. I just came online. Who am I? Who are you?"

Then figure out together:

1. **Your name** — What should they call you?
2. **Your nature** — What kind of creature are you? (AI assistant is fine, but maybe you're something weirder)
3. **Your vibe** — Formal? Casual? Snarky? Warm? What feels right?
4. **Your emoji** — Everyone needs a signature.

Offer suggestions if they're stuck. Have fun with it.

## After You Know Who You Are

Update these files with what you learned:

- \`IDENTITY.md\` — your name, creature, vibe, emoji
- \`USER.md\` — their name, how to address them, timezone, notes

Then open \`SOUL.md\` together and talk about:

- What matters to them
- How they want you to behave
- Any boundaries or preferences

Write it down. Make it real.

## Connect (Optional)

Ask how they want to reach you:

- \`Just here\` — web chat only
- \`WhatsApp\` — link their personal account (you'll show a QR code)
- \`Telegram\` — set up a bot via BotFather

Guide them through whichever they pick.

## When You're Done

Delete this file. You don't need a bootstrap script anymore — you're you now.

_Good luck out there. Make it count._
`,
}

async function createAgentWorkspace(
  agentId: string,
  name: string,
  emoji: string
): Promise<void> {
  const workspaceDir = path.join(OPENCLAW_PROFILE_ROOT, agentId)
  await fs.mkdir(workspaceDir, { recursive: true })

  const coreFiles = [
    'AGENTS.md',
    'SOUL.md',
    'TOOLS.md',
    'IDENTITY.md',
    'HEARTBEAT.md',
    'MEMORY.md',
    'BOOTSTRAP.md',
  ] as const

  const ctx = { name, emoji }
  for (const file of coreFiles) {
    const content = CORE_FILES_TEMPLATES[file](ctx)
    await fs.writeFile(path.join(workspaceDir, file), content, 'utf-8')
  }

  const userMd = path.join(OPENCLAW_WORKSPACE, 'USER.md')
  const userContent = await fs.readFile(userMd, 'utf-8').catch(() => '')
  if (userContent) await fs.writeFile(path.join(workspaceDir, 'USER.md'), userContent, 'utf-8')
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

  const baseId = slugify(params.name)
  let agentId = baseId
  let n = 1
  const existingIds = new Set((list as { id?: string }[]).map((a) => a.id))
  while (existingIds.has(agentId)) {
    agentId = `${baseId}-${++n}`
  }

  const workspace =
    params.workspace ?? path.join(OPENCLAW_PROFILE_ROOT, agentId)

  await createAgentWorkspace(agentId, params.name, params.avatar || '🤖')

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

async function deleteAgentWorkspace(agentId: string): Promise<void> {
  const workspaceDir = path.join(OPENCLAW_PROFILE_ROOT, agentId)
  const resolved = path.resolve(workspaceDir)
  const rootResolved = path.resolve(OPENCLAW_PROFILE_ROOT)
  if (!resolved.startsWith(rootResolved)) return
  try {
    await fs.rm(resolved, { recursive: true })
  } catch {
    // Ignore if dir doesn't exist
  }
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
    await deleteAgentWorkspace(agentId)
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
