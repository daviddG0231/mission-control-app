/**
 * Load pixel-agents assets for the Agent Office iframe.
 * Mirrors pixel-agents extension assetLoader logic.
 */
import path from 'path'
import fs from 'fs'
import { PNG } from 'pngjs'

const PNG_ALPHA_THRESHOLD = 128
const WALL_PIECE_WIDTH = 16
const WALL_PIECE_HEIGHT = 32
const WALL_GRID_COLS = 4
const WALL_BITMASK_COUNT = 16
const CHAR_FRAME_W = 16
const CHAR_FRAME_H = 32
const CHAR_FRAMES_PER_ROW = 7
const CHAR_COUNT = 6
const CHARACTER_DIRECTIONS = ['down', 'up', 'right'] as const

function getAssetsRoot(): string {
  return path.join(process.cwd(), 'pixel-agents', 'webview-ui', 'public')
}

export function loadDefaultLayout(): Record<string, unknown> | null {
  try {
    const layoutPath = path.join(getAssetsRoot(), 'assets', 'default-layout.json')
    if (!fs.existsSync(layoutPath)) return null
    const content = fs.readFileSync(layoutPath, 'utf-8')
    return JSON.parse(content) as Record<string, unknown>
  } catch {
    return null
  }
}

export function loadWallTiles(): { sprites: string[][][] } | null {
  try {
    const wallPath = path.join(getAssetsRoot(), 'assets', 'walls.png')
    if (!fs.existsSync(wallPath)) return null
    const pngBuffer = fs.readFileSync(wallPath)
    const png = PNG.sync.read(pngBuffer)
    const sprites: string[][][] = []
    for (let mask = 0; mask < WALL_BITMASK_COUNT; mask++) {
      const ox = (mask % WALL_GRID_COLS) * WALL_PIECE_WIDTH
      const oy = Math.floor(mask / WALL_GRID_COLS) * WALL_PIECE_HEIGHT
      const sprite: string[][] = []
      for (let r = 0; r < WALL_PIECE_HEIGHT; r++) {
        const row: string[] = []
        for (let c = 0; c < WALL_PIECE_WIDTH; c++) {
          const idx = ((oy + r) * png.width + (ox + c)) * 4
          const rv = png.data[idx]
          const gv = png.data[idx + 1]
          const bv = png.data[idx + 2]
          const av = png.data[idx + 3]
          if (av < PNG_ALPHA_THRESHOLD) {
            row.push('')
          } else {
            row.push(
              `#${rv.toString(16).padStart(2, '0')}${gv.toString(16).padStart(2, '0')}${bv.toString(16).padStart(2, '0')}`.toUpperCase()
            )
          }
        }
        sprite.push(row)
      }
      sprites.push(sprite)
    }
    return { sprites }
  } catch {
    return null
  }
}

export function loadCharacterSprites(): { characters: Array<{ down: string[][][]; up: string[][][]; right: string[][][] }> } | null {
  try {
    const charDir = path.join(getAssetsRoot(), 'assets', 'characters')
    const characters: Array<{ down: string[][][]; up: string[][][]; right: string[][][] }> = []
    for (let ci = 0; ci < CHAR_COUNT; ci++) {
      const filePath = path.join(charDir, `char_${ci}.png`)
      if (!fs.existsSync(filePath)) return null
      const pngBuffer = fs.readFileSync(filePath)
      const png = PNG.sync.read(pngBuffer)
      const charData: { down: string[][][]; up: string[][][]; right: string[][][] } = {
        down: [],
        up: [],
        right: [],
      }
      for (let dirIdx = 0; dirIdx < CHARACTER_DIRECTIONS.length; dirIdx++) {
        const dir = CHARACTER_DIRECTIONS[dirIdx]
        const rowOffsetY = dirIdx * CHAR_FRAME_H
        const frames: string[][][] = []
        for (let f = 0; f < CHAR_FRAMES_PER_ROW; f++) {
          const frameOffsetX = f * CHAR_FRAME_W
          const sprite: string[][] = []
          for (let y = 0; y < CHAR_FRAME_H; y++) {
            const row: string[] = []
            for (let x = 0; x < CHAR_FRAME_W; x++) {
              const idx = ((rowOffsetY + y) * png.width + (frameOffsetX + x)) * 4
              const r = png.data[idx]
              const g = png.data[idx + 1]
              const b = png.data[idx + 2]
              const a = png.data[idx + 3]
              if (a < PNG_ALPHA_THRESHOLD) {
                row.push('')
              } else {
                row.push(
                  `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase()
                )
              }
            }
            sprite.push(row)
          }
          frames.push(sprite)
        }
        charData[dir] = frames
      }
      characters.push(charData)
    }
    return { characters }
  } catch {
    return null
  }
}

/** Create 7 simple gray floor tiles (fallback when floors.png not available) */
function createDefaultFloorSprites(): string[][][] {
  const FALLBACK_COLOR = '#606060'
  const sprites: string[][][] = []
  for (let t = 0; t < 7; t++) {
    const sprite: string[][] = []
    for (let y = 0; y < 16; y++) {
      const row: string[] = []
      for (let x = 0; x < 16; x++) {
        row.push(FALLBACK_COLOR)
      }
      sprite.push(row)
    }
    sprites.push(sprite)
  }
  return sprites
}

export function loadFloorTiles(): { sprites: string[][][] } {
  return { sprites: createDefaultFloorSprites() }
}
