import { OPENCLAW_CONFIG } from '@/lib/paths'
import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'

/**
 * Returns the list of models from OpenClaw config for use in dropdowns (e.g. People > Add AI Agent).
 */
export async function GET() {
  try {
    const raw = await readFile(OPENCLAW_CONFIG, 'utf-8')
    const config = JSON.parse(raw)
    const models: { id: string; label: string }[] = []

    // From agents.defaults.models (provider/model format with optional alias)
    const agentModels = config.agents?.defaults?.models
    if (agentModels && typeof agentModels === 'object') {
      for (const [id, meta] of Object.entries(agentModels)) {
        const m = meta as { alias?: string }
        const label = m?.alias ? `${m.alias} (${id})` : id
        models.push({ id, label })
      }
    }

    // From models.providers (ollama, etc.)
    const providers = config.models?.providers
    if (providers && typeof providers === 'object') {
      for (const [providerName, provider] of Object.entries(providers)) {
        const p = provider as { models?: Array<{ id: string; name?: string }> }
        if (Array.isArray(p?.models)) {
          for (const m of p.models) {
            const id = `${providerName}/${m.id}`
            const label = m.name ? `${m.name} (${id})` : id
            models.push({ id, label })
          }
        }
      }
    }

    return NextResponse.json({ models })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
