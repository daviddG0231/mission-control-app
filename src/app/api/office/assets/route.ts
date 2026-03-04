/**
 * Serves pixel-agents assets for the Agent Office iframe.
 * Returns layout, character sprites, wall tiles, floor tiles.
 */
import { NextResponse } from 'next/server'
import {
  loadDefaultLayout,
  loadWallTiles,
  loadCharacterSprites,
  loadFloorTiles,
} from '@/lib/pixel-agents-assets'

export async function GET() {
  try {
    const [layout, wallTiles, charSprites, floorTiles] = await Promise.all([
      Promise.resolve(loadDefaultLayout()),
      Promise.resolve(loadWallTiles()),
      Promise.resolve(loadCharacterSprites()),
      Promise.resolve(loadFloorTiles()),
    ])
    return NextResponse.json({
      layout: layout || null,
      wallTiles: wallTiles?.sprites || null,
      characterSprites: charSprites?.characters || null,
      floorTiles: floorTiles.sprites,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
