import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function GET() {
  try {
    const { stdout } = await execAsync('tailscale status --json 2>/dev/null', { timeout: 5000 })
    const status = JSON.parse(stdout)
    
    const selfIP = status?.Self?.TailscaleIPs?.[0] || null
    const hostname = status?.Self?.HostName || null
    const online = status?.Self?.Online ?? false
    const peerCount = Object.keys(status?.Peer || {}).length
    const peers = Object.values(status?.Peer || {}).map((p: unknown) => {
      const peer = p as { HostName?: string; TailscaleIPs?: string[]; Online?: boolean }
      return {
        name: peer.HostName || 'unknown',
        ip: peer.TailscaleIPs?.[0] || '',
        online: peer.Online ?? false
      }
    })
    
    return NextResponse.json({
      connected: online,
      ip: selfIP,
      hostname,
      peerCount,
      peers,
      dashboardUrl: selfIP ? `http://${selfIP}:3333` : null
    })
  } catch {
    return NextResponse.json({
      connected: false,
      ip: null,
      hostname: null,
      peerCount: 0,
      peers: [],
      dashboardUrl: null
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json()
    
    if (action === 'up') {
      await execAsync('tailscale up', { timeout: 15000 })
      return NextResponse.json({ success: true, message: 'Tailscale connected' })
    } else if (action === 'down') {
      // Execute with a small delay so the response can be sent first
      setTimeout(() => {
        exec('tailscale down')
      }, 2000)
      return NextResponse.json({ success: true, message: 'Tailscale disconnecting in 2 seconds...' })
    } else {
      return NextResponse.json({ error: 'Invalid action. Use "up" or "down"' }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
