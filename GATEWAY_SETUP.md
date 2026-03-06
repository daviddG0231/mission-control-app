# Gateway Setup for Mission Control

Mission Control talks to the OpenClaw Gateway via `POST /tools/invoke`. Some tools (like `cron`) are filtered by policy and return 404 unless explicitly allowed.

## Enable Tools Over HTTP

Some tools are blocked by default over HTTP. Add them to `gateway.tools.allow` in `~/.openclaw/openclaw.json`:

- **cron** — list/manage cron jobs
- **sessions_send** — send messages to chat sessions (used by "Ping Patrick" to send `/status`)
- **sessions_spawn** — spawn new agent sessions (used by "New Session" in Sessions tab)

Example JSON (in `openclaw.json`):
```json
"gateway": {
  "tools": {
    "allow": ["cron", "sessions_send", "sessions_spawn"]
  }
}
```

## Environment Variables

- `NEXT_PUBLIC_GATEWAY_URL` — Gateway base URL (default: `http://localhost:18789`)
- `GATEWAY_TOKEN` — Bearer token for auth (from `gateway.auth.token` or `OPENCLAW_GATEWAY_TOKEN`)
- `SECRETS_PASSWORD` — Password to unlock the Secrets tab (add to `.env.local`)
