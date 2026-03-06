/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'
import { OPENCLAW_CONFIG } from '@/lib/paths'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    const config = await request.json()
    
    // Validate that it's a valid JSON object
    if (typeof config !== 'object' || config === null) {
      return NextResponse.json(
        { error: 'Invalid configuration: must be a JSON object' },
        { status: 400 }
      )
    }

    // Write the configuration to the file
    const configPath = OPENCLAW_CONFIG
    const configJson = JSON.stringify(config, null, 2)
    
    await writeFile(configPath, configJson, 'utf-8')
    
    return NextResponse.json({ success: true, message: 'Configuration saved successfully' })
  } catch (err: unknown) {
    console.error('Failed to save config:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to save configuration: ${message}` }, { status: 500 })
  }
}