import { NextRequest, NextResponse } from 'next/server'
import { invokeGatewayTool } from '@/lib/gateway'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionKey = 'builder:main', message } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    await invokeGatewayTool({
      tool: 'sessions_send',
      args: { sessionKey, message: message.trim() },
    })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
