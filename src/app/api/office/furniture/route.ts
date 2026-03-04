import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { PNG } from 'pngjs'

const FURNITURE_DIR = path.join(process.cwd(), 'public', 'office-view', 'assets', 'furniture')
const ALPHA_THRESHOLD = 10

function pngToSpriteData(pngBuffer: Buffer, width: number, height: number): string[][] {
  const png = PNG.sync.read(pngBuffer)
  const sprite: string[][] = []
  for (let y = 0; y < height; y++) {
    const row: string[] = []
    for (let x = 0; x < width; x++) {
      const idx = (y * png.width + x) * 4
      const r = png.data[idx]
      const g = png.data[idx + 1]
      const b = png.data[idx + 2]
      const a = png.data[idx + 3]
      if (a < ALPHA_THRESHOLD) {
        row.push('')
      } else {
        row.push(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase())
      }
    }
    sprite.push(row)
  }
  return sprite
}

export async function GET() {
  try {
    const catalogPath = path.join(FURNITURE_DIR, 'furniture-catalog.json')
    const catalogBuf = await fs.readFile(catalogPath, 'utf-8')
    const catalogData = JSON.parse(catalogBuf)
    const assets = catalogData.assets || []

    const sprites: Record<string, string[][]> = {}
    let loaded = 0

    for (const asset of assets) {
      try {
        // file paths in catalog are like "furniture/decor/PAPER_SIDE.png"
        // Our furniture dir is already at .../furniture/, so strip "furniture/" prefix
        let filePath = asset.file as string
        if (filePath.startsWith('furniture/')) filePath = filePath.slice('furniture/'.length)
        const actualPath = path.join(FURNITURE_DIR, filePath)
        
        const buf = await fs.readFile(actualPath)
        sprites[asset.id] = pngToSpriteData(buf, asset.width, asset.height)
        loaded++
      } catch {
        // skip missing assets
      }
    }

    return NextResponse.json({ catalog: assets, sprites, loaded, total: assets.length })
  } catch (err) {
    return NextResponse.json({ error: String(err), catalog: [], sprites: {} }, { status: 500 })
  }
}
