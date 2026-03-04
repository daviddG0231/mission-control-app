import { NextResponse } from 'next/server'
import { listSubagents } from '@/lib/gateway'

export async function GET() {
  try {
    const data = await listSubagents()
    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
