import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

async function checkExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function getVersion(cmd: string): Promise<string> {
  try {
    const { stdout } = await execAsync(cmd, { timeout: 5000 })
    return stdout.trim().split('\n')[0]
  } catch {
    return 'not found'
  }
}

async function checkPort(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://localhost:${port}`, { signal: AbortSignal.timeout(3000) })
    return res.ok || res.status < 500
  } catch {
    return false
  }
}

export async function GET() {
  const home = process.env.HOME || '/Users/david'
  const ocDir = path.join(home, '.openclaw')

  // Versions
  const versions: Record<string, string> = {
    'Node.js': await getVersion('node --version'),
    'npm': await getVersion('npm --version'),
    'OpenClaw': await getVersion('openclaw --version 2>/dev/null || echo "not found"'),
    'Next.js': '14.2.35',
    'macOS': await getVersion('sw_vers -productVersion'),
    'Tailscale': await getVersion('tailscale version 2>/dev/null | head -1 || echo "not installed"'),
  }

  // Path checks
  const pathChecks: Record<string, { exists: boolean; path: string }> = {
    'OpenClaw Config': { path: path.join(ocDir, 'openclaw.json'), exists: await checkExists(path.join(ocDir, 'openclaw.json')) },
    'Workspace': { path: path.join(ocDir, 'workspace'), exists: await checkExists(path.join(ocDir, 'workspace')) },
    'Builder Agent': { path: path.join(ocDir, 'agents/builder'), exists: await checkExists(path.join(ocDir, 'agents/builder')) },
    'Memory': { path: path.join(ocDir, 'workspace/MEMORY.md'), exists: await checkExists(path.join(ocDir, 'workspace/MEMORY.md')) },
    'SOUL.md': { path: path.join(ocDir, 'workspace/SOUL.md'), exists: await checkExists(path.join(ocDir, 'workspace/SOUL.md')) },
    'Mission Control': { path: path.join(ocDir, 'workspace/mission-control-app'), exists: await checkExists(path.join(ocDir, 'workspace/mission-control-app')) },
    'Tasks JSON': { path: path.join(ocDir, 'workspace/mission-control-app/data/tasks.json'), exists: await checkExists(path.join(ocDir, 'workspace/mission-control-app/data/tasks.json')) },
  }

  // Health checks
  const checks = []

  // Gateway
  const gatewayUp = await checkPort(18789)
  checks.push({
    name: 'Gateway (port 18789)',
    status: gatewayUp ? 'ok' : 'error',
    message: gatewayUp ? 'Running' : 'Not responding',
    details: gatewayUp ? undefined : 'Gateway is not responding on port 18789. Try: openclaw gateway start'
  })

  // Tailscale
  try {
    const { stdout } = await execAsync('tailscale status --json 2>/dev/null', { timeout: 5000 })
    const ts = JSON.parse(stdout)
    const tsOnline = ts?.Self?.Online ?? false
    const tsIP = ts?.Self?.TailscaleIPs?.[0] || 'N/A'
    checks.push({
      name: 'Tailscale',
      status: tsOnline ? 'ok' : 'warning',
      message: tsOnline ? `Connected (${tsIP})` : 'Disconnected',
      details: tsOnline ? `IP: ${tsIP}\nPeers: ${Object.keys(ts?.Peer || {}).length}` : 'Run: tailscale up'
    })
  } catch {
    checks.push({ name: 'Tailscale', status: 'warning', message: 'Not installed or not running' })
  }

  // Ollama
  const ollamaUp = await checkPort(11434)
  checks.push({
    name: 'Ollama (port 11434)',
    status: ollamaUp ? 'ok' : 'warning',
    message: ollamaUp ? 'Running' : 'Not running',
  })

  // Config file
  const configExists = await checkExists(path.join(ocDir, 'openclaw.json'))
  let configValid = false
  if (configExists) {
    try {
      const content = await fs.readFile(path.join(ocDir, 'openclaw.json'), 'utf-8')
      JSON.parse(content)
      configValid = true
    } catch { /* invalid */ }
  }
  checks.push({
    name: 'OpenClaw Config',
    status: configExists && configValid ? 'ok' : configExists ? 'error' : 'error',
    message: configExists && configValid ? 'Valid JSON' : configExists ? 'Invalid JSON!' : 'File missing',
    details: !configExists ? `Expected at: ${path.join(ocDir, 'openclaw.json')}` : undefined
  })

  // Disk space
  try {
    const { stdout } = await execAsync("df -h / | tail -1 | awk '{print $5}'", { timeout: 3000 })
    const usage = parseInt(stdout.trim())
    checks.push({
      name: 'Disk Space',
      status: usage > 90 ? 'error' : usage > 75 ? 'warning' : 'ok',
      message: `${stdout.trim()} used`,
      details: usage > 75 ? 'Consider freeing up disk space' : undefined
    })
  } catch {
    checks.push({ name: 'Disk Space', status: 'warning', message: 'Could not check' })
  }

  // Memory
  try {
    const { stdout } = await execAsync("vm_stat | head -5", { timeout: 3000 })
    checks.push({
      name: 'Memory',
      status: 'ok',
      message: 'Available',
      details: stdout.trim()
    })
  } catch {
    checks.push({ name: 'Memory', status: 'warning', message: 'Could not check' })
  }

  // Env info
  const env: Record<string, string> = {
    'HOME': home,
    'SHELL': process.env.SHELL || 'unknown',
    'NODE_ENV': process.env.NODE_ENV || 'unknown',
    'HOSTNAME': process.env.HOSTNAME || (await getVersion('hostname')),
    'ARCH': process.arch,
    'PLATFORM': process.platform,
  }

  return NextResponse.json({
    checks,
    versions,
    paths: pathChecks,
    env,
    timestamp: Date.now()
  })
}
