import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import fs from 'fs/promises'
import path from 'path'

interface EnvVar {
  key: string
  value: string
  source: string
}

async function parseEnvFile(filePath: string, source: string): Promise<EnvVar[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const vars: EnvVar[] = []
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex === -1) continue
      const key = trimmed.slice(0, eqIndex).trim()
      let value = trimmed.slice(eqIndex + 1).trim()
      // Remove surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      vars.push({ key, value, source })
    }
    return vars
  } catch {
    return []
  }
}

async function parseJsonConfig(filePath: string, source: string): Promise<EnvVar[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const config = JSON.parse(content)
    const vars: EnvVar[] = []
    
    // Extract known secret-like fields
    const extract = (obj: Record<string, unknown>, prefix: string) => {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string' && (
          key.toLowerCase().includes('key') ||
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('password') ||
          key.toLowerCase().includes('url') ||
          key.toLowerCase().includes('api')
        )) {
          vars.push({ key: prefix ? `${prefix}.${key}` : key, value, source })
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          extract(value as Record<string, unknown>, prefix ? `${prefix}.${key}` : key)
        }
      }
    }
    extract(config, '')
    return vars
  } catch {
    return []
  }
}

export async function GET(request: NextRequest) {
  const pw = (request.headers.get('X-Secrets-Password') || '').trim()
  const expected = (process.env.SECRETS_PASSWORD || '').trim()
  if (!expected) {
    return NextResponse.json(
      { error: 'Not configured. Add SECRETS_PASSWORD to .env.local to enable the Secrets vault.' },
      { status: 503 }
    )
  }
  if (pw !== expected) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
  }

  const home = process.env.HOME || process.env.USERPROFILE || '/root'
  const allVars: EnvVar[] = []

  // TutorFlow env
  allVars.push(...await parseEnvFile(
    path.join(home, '.openclaw/workspace/tutorflow-2/.env'),
    'TutorFlow (.env)'
  ))
  allVars.push(...await parseEnvFile(
    path.join(home, '.openclaw/workspace/tutorflow-2/.env.local'),
    'TutorFlow (.env.local)'
  ))

  // Bartera env
  allVars.push(...await parseEnvFile(
    path.join(home, '.openclaw/workspace/bartera/.env'),
    'Bartera (.env)'
  ))
  allVars.push(...await parseEnvFile(
    path.join(home, '.openclaw/workspace/bartera/.env.local'),
    'Bartera (.env.local)'
  ))

  // Mission Control env
  allVars.push(...await parseEnvFile(
    path.join(home, '.openclaw/workspace/mission-control-app/.env.local'),
    'Mission Control (.env.local)'
  ))

  // OpenClaw config secrets
  allVars.push(...await parseJsonConfig(
    path.join(home, '.openclaw/openclaw.json'),
    'OpenClaw Config'
  ))

  // Deduplicate by key+source
  const seen = new Set<string>()
  const unique = allVars.filter(v => {
    const id = `${v.source}:${v.key}`
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })

  return NextResponse.json({ vars: unique })
}
