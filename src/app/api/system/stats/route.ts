import { NextResponse } from 'next/server'
import os from 'os'
import { execSync } from 'child_process'

export const dynamic = 'force-dynamic'

export async function GET() {
  // CPU usage — sample over 1 second
  const cpus1 = os.cpus()

  // CPU usage
  let cpuPercent = 0
  try {
    const topOutput = execSync("ps -A -o %cpu | awk '{s+=$1} END {print s}'", { timeout: 3000 }).toString().trim()
    cpuPercent = Math.round(parseFloat(topOutput) / cpus1.length)
  } catch {
    const idle = cpus1.reduce((a, c) => a + c.times.idle, 0)
    const total = cpus1.reduce((a, c) => a + c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq, 0)
    cpuPercent = Math.round(100 - (idle / total) * 100)
  }

  // Memory
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem
  const memPercent = Math.round((usedMem / totalMem) * 100)

  // Disk usage
  let diskPercent = 0
  try {
    const df = execSync("df -h / | tail -1 | awk '{print $5}'", { timeout: 3000 }).toString().trim()
    diskPercent = parseInt(df.replace('%', '')) || 0
  } catch {
    diskPercent = 0
  }

  // Uptime
  const uptimeSeconds = os.uptime()
  const days = Math.floor(uptimeSeconds / 86400)
  const hours = Math.floor((uptimeSeconds % 86400) / 3600)
  const uptime = days > 0 ? `${days}d ${hours}h` : `${hours}h`

  return NextResponse.json({
    cpu: Math.min(cpuPercent, 100),
    memory: memPercent,
    diskUsage: diskPercent,
    totalMemGB: (totalMem / 1073741824).toFixed(1),
    usedMemGB: (usedMem / 1073741824).toFixed(1),
    uptime,
    hostname: os.hostname(),
    platform: `${os.type()} ${os.arch()}`,
    cpuModel: cpus1[0]?.model || 'Unknown',
    cpuCores: cpus1.length,
  })
}
