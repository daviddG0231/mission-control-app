// ============================================================
// lib/gateway.ts — OpenClaw Gateway API Client
// Connects to the local gateway via /tools/invoke HTTP API
// ============================================================

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:18789';
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || '';

export interface ToolInvokeRequest {
  tool: string;
  action?: string;
  args?: Record<string, unknown>;
  sessionKey?: string;
}

export async function invokeGatewayTool(request: ToolInvokeRequest) {
  const res = await fetch(`${GATEWAY_URL}/tools/invoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GATEWAY_TOKEN}`,
    },
    body: JSON.stringify({
      tool: request.tool,
      action: request.action,
      args: request.args || {},
      sessionKey: request.sessionKey || 'main',
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gateway error (${res.status}): ${text}`);
  }

  const raw = await res.json();

  // Gateway wraps results in { ok, result: { content: [{ type: "text", text: "..." }], details: {...} } }
  // Try to extract the parsed details first, then fall back to parsing the text content
  if (raw?.result?.details) {
    return raw.result.details;
  }

  // Fall back to parsing the text content
  if (raw?.result?.content?.[0]?.text) {
    try {
      return JSON.parse(raw.result.content[0].text);
    } catch {
      return { text: raw.result.content[0].text };
    }
  }

  return raw;
}

// Convenience wrappers
export async function listSessions(limit = 30) {
  return invokeGatewayTool({
    tool: 'sessions_list',
    args: { limit, messageLimit: 1 },
  });
}

export async function listSubagents() {
  return invokeGatewayTool({
    tool: 'subagents',
    args: { action: 'list' },
  });
}

export async function getSessionStatus(sessionKey?: string) {
  return invokeGatewayTool({
    tool: 'session_status',
    args: sessionKey ? { sessionKey } : {},
  });
}

export async function listCronJobs() {
  return invokeGatewayTool({
    tool: 'cron',
    args: { action: 'list', includeDisabled: true },
  });
}

export async function listAgents() {
  return invokeGatewayTool({
    tool: 'agents_list',
    args: {},
  });
}
