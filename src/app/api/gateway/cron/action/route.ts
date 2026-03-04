import { NextResponse } from 'next/server'
import { invokeGatewayTool } from '@/lib/gateway'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, jobId, enabled } = body

    if (action === 'run') {
      const data = await invokeGatewayTool({
        tool: 'cron',
        args: { action: 'run', jobId },
      })
      return NextResponse.json(data)
    }

    if (action === 'toggle') {
      const data = await invokeGatewayTool({
        tool: 'cron',
        args: { action: 'update', jobId, patch: { enabled } },
      })
      return NextResponse.json(data)
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
