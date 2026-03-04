import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'

export async function GET() {
  try {
    const raw = await readFile('/Users/david/.openclaw/openclaw.json', 'utf-8')
    const config = JSON.parse(raw)
    
    // Redact sensitive fields
    if (config.gateway?.auth?.token) config.gateway.auth.token = '••••••••'
    if (config.channels?.telegram?.botToken) config.channels.telegram.botToken = '••••••••'
    if (config.models?.providers?.ollama?.apiKey) config.models.providers.ollama.apiKey = '••••••••'

    return NextResponse.json(config)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
