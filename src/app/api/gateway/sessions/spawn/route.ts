import { NextRequest, NextResponse } from 'next/server'
import { invokeGatewayTool } from '@/lib/gateway'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      task,
      runtime = 'subagent',
      mode = 'session',
      agentIds = [],
      sessionKey = 'agent:builder:main', // Ensure 'builder' matches Patrick's current ID in openclaw.json
    } = body

    if (!task || typeof task !== 'string') {
      return NextResponse.json({ error: 'task is required' }, { status: 400 })
    }

    if (!Array.isArray(agentIds) || agentIds.length === 0) {
      return NextResponse.json({ error: 'At least one agent must be selected' }, { status: 400 })
    }

    const results = [];

    // 1. Loop through ALL selected agents instead of just taking the first one
    // Note: agentId is not allowed by gateway policy for sessions_spawn.
    // mode="session" requires thread=true, which needs a channel plugin (Discord/Slack).
    // Over HTTP we have no channel plugin, so use mode="run" (one-shot) instead.
    const effectiveMode = mode === 'session' ? 'run' : mode
    for (const agentId of agentIds) {
      const args: Record<string, unknown> = {
        task: task.trim(),
        runtime,
        mode: effectiveMode,
      }

      const result = await invokeGatewayTool({
        tool: 'sessions_spawn',
        args,
        sessionKey,
      });

      // Log the exact response from the Gateway to your Next.js terminal
      console.log(`[Gateway Response for ${agentId}]:`, JSON.stringify(result, null, 2));
      console.log(`\n--- SENDING TO GATEWAY ---`);
      console.log(`Spawning agent: ${agentId}`);
      console.log(`Using Session Key (The Manager): ${sessionKey}`);
      console.log(`Payload Arguments:`, JSON.stringify(args, null, 2));
      // 2. Catch actual Gateway errors so we don't return a fake 200 OK
      if (result && (result.error || result.status === 'forbidden')) {
        const errorMsg = result.error?.message || result.error || 'Gateway rejected the spawn request';
        return NextResponse.json({ error: errorMsg }, { status: 400 });
      }

      results.push(result);
    }

    // 3. Return a true success payload
    return NextResponse.json({ ok: true, spawned: results.length, details: results })
    
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}