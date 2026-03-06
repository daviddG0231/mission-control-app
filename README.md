# Mission Control 🎛️

A real-time dashboard for managing [OpenClaw](https://github.com/openclaw/openclaw) AI agents. Monitor agent activity, manage sessions, review tasks, and control your agent team from a single interface.

![Next.js](https://img.shields.io/badge/Next.js-14-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4)

## Features

- **Agent Office** — Pixel-art visualization of your AI agents working in real-time
- **Sessions** — Monitor active agent sessions, view transcripts, and manage sub-agents
- **Tasks Board** — Kanban-style task tracking populated from agent sessions
- **Council** — Overview of your agent team with roles, strengths, and status
- **Terminal** — Built-in terminal for running commands
- **Settings** — Live gateway configuration editor
- **Secrets Vault** — Secure viewer for environment variables across projects
- **Activity Timeline** — Chronological feed of agent actions

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [OpenClaw](https://github.com/openclaw/openclaw) installed and running (`openclaw gateway start`)
- A configured OpenClaw agent (the dashboard reads from `~/.openclaw/`)

## Setup

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/mission-control-app.git
cd mission-control-app
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

```env
GATEWAY_TOKEN=your_openclaw_gateway_token
NEXT_PUBLIC_GATEWAY_URL=http://localhost:18789
USER_NAME=Your Name
USER_EMAIL=you@example.com
```

**Finding your gateway token:**
```bash
grep "gateway.token" ~/.openclaw/openclaw.json
```

### 3. Set up the Agent Office (optional)

The Agent Office uses [pixel-agents](https://github.com/nicholasgriffintn/pixel-agents) for the pixel-art visualization.

```bash
# Clone pixel-agents into the project root
git clone https://github.com/nicholasgriffintn/pixel-agents.git
```

The office also needs character sprites in `public/office-view/assets/characters/`. The default sprites (`char_0.png` through `char_5.png`) come from pixel-agents. You can add custom sprites as `char_6.png`, `char_7.png`, etc.

**Sprite format:** 112×96 PNG, 7 frames × 3 directions (down, up, right), each frame 16×32px.

### 4. Initialize data directory

```bash
mkdir -p data
echo '[]' > data/tasks.json
echo '[]' > data/approvals.json
echo '[]' > data/activity-log.json
echo '{}' > data/contacts.json
echo '[]' > data/user-templates.json
```

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
mission-control-app/
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── api/          # API routes (gateway proxy, office, etc.)
│   │   ├── office/       # Agent Office pixel-art view
│   │   ├── sessions/     # Session management
│   │   ├── council/      # Agent team overview
│   │   └── ...
│   ├── components/       # Shared UI components
│   └── lib/              # Utilities (gateway client, paths, etc.)
├── public/
│   └── office-view/      # Iframe assets for pixel-art office
├── data/                 # Runtime data (gitignored)
├── pixel-agents/         # Pixel-agents extension (gitignored, optional)
└── .env.local            # Your config (gitignored)
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GATEWAY_TOKEN` | ✅ | OpenClaw gateway auth token |
| `NEXT_PUBLIC_GATEWAY_URL` | ✅ | Gateway URL (default: `http://localhost:18789`) |
| `SECRETS_PASSWORD` | ❌ | Password to unlock the Secrets vault page |
| `USER_NAME` | ❌ | Display name in the dashboard |
| `USER_EMAIL` | ❌ | Your email for the profile section |
| `USER_TIMEZONE` | ❌ | Timezone display string |
| `USER_AVATAR` | ❌ | Emoji avatar |

## How It Works

Mission Control connects to your local OpenClaw gateway to:
- Read agent configurations from `~/.openclaw/openclaw.json`
- Scan agent session files from `~/.openclaw/agents/*/sessions/*.jsonl`
- Proxy gateway API calls for session management
- Parse JSONL session files to detect active/idle/offline agents

The Agent Office iframe renders pixel-art characters using sprite sheets, with real-time status updates based on session file modification times.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + CSS variables for theming
- **Agent Visualization:** Canvas-based pixel-art renderer (pixel-agents)
- **State:** Server-side API routes + client-side polling

## License

MIT
