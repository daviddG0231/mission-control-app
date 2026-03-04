import { NextResponse } from 'next/server'
import { invokeGatewayTool } from '@/lib/gateway'

export async function GET() {
  try {
    const data = await invokeGatewayTool({
      tool: 'agents_list',
      args: {},
    })
    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
