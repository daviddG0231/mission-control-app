/**
 * Office layout templates — preset maps users can choose from.
 * Each template is an OfficeLayout compatible with the pixel-agents engine.
 */

interface FloorColor {
  h: number; s: number; b: number; c: number
}

interface PlacedFurniture {
  uid: string
  type: string
  col: number
  row: number
  color?: FloorColor
}

interface OfficeLayout {
  version: 1
  cols: number
  rows: number
  tiles: number[]
  tileColors: (FloorColor | null)[]
  furniture: PlacedFurniture[]
}

export interface OfficeTemplate {
  id: string
  name: string
  description: string
  preview: string // emoji
  layout: OfficeLayout
}

// Tile types
const W = 0  // wall
const F1 = 1 // floor 1
const F2 = 2 // floor 2
const F3 = 3 // floor 3 (carpet)
const F4 = 4 // floor 4 (doorway)

// Colors
const WARM_BEIGE: FloorColor = { h: 35, s: 30, b: 15, c: 0 }
const WARM_BROWN: FloorColor = { h: 25, s: 45, b: 5, c: 10 }
const PURPLE_CARPET: FloorColor = { h: 280, s: 40, b: -5, c: 0 }
const TAN_DOORWAY: FloorColor = { h: 35, s: 25, b: 10, c: 0 }
const COOL_BLUE: FloorColor = { h: 210, s: 30, b: 10, c: 0 }
const DARK_GREEN: FloorColor = { h: 150, s: 35, b: -5, c: 0 }
const SLATE_GRAY: FloorColor = { h: 220, s: 15, b: 5, c: 0 }
const WARM_RED: FloorColor = { h: 10, s: 40, b: 5, c: 0 }

function makeTiles(grid: number[][]): number[] {
  return grid.flat()
}

function makeTileColors(grid: number[][], colorMap: Record<number, FloorColor | null>): (FloorColor | null)[] {
  return grid.flat().map(t => colorMap[t] ?? null)
}

const officeGrid = Array.from({ length: 11 }, (_, r) =>
  Array.from({ length: 20 }, (_, c) => {
    if (r === 0 || r === 10 || c === 0 || c === 19) return W
    if (c === 10) return (r >= 4 && r <= 6) ? F4 : W
    if (c >= 15 && c <= 18 && r >= 7 && r <= 9) return F3
    return c < 10 ? F1 : F2
  })
)

// ─── Template: Office (main workspace) ───
const officeTemplate: OfficeTemplate = {
  id: 'office',
  name: 'Office',
  description: 'Two rooms with desks, plants, and a meeting corner',
  preview: '🏢',
  layout: {
    version: 1,
    cols: 20,
    rows: 11,
    tiles: makeTiles(officeGrid),
    tileColors: makeTileColors(officeGrid, { [W]: null, [F1]: WARM_BEIGE, [F2]: WARM_BROWN, [F3]: PURPLE_CARPET, [F4]: TAN_DOORWAY }),
    furniture: [
      { uid: 'desk-left', type: 'desk', col: 4, row: 3 },
      { uid: 'desk-right', type: 'desk', col: 13, row: 3 },
      { uid: 'bookshelf-1', type: 'bookshelf', col: 1, row: 5 },
      { uid: 'plant-left', type: 'plant', col: 1, row: 1 },
      { uid: 'cooler-1', type: 'cooler', col: 17, row: 7 },
      { uid: 'plant-right', type: 'plant', col: 18, row: 1 },
      { uid: 'whiteboard-1', type: 'whiteboard', col: 15, row: 0 },
      { uid: 'chair-l-top', type: 'chair', col: 4, row: 2 },
      { uid: 'chair-l-bottom', type: 'chair', col: 5, row: 5 },
      { uid: 'chair-l-left', type: 'chair', col: 3, row: 4 },
      { uid: 'chair-l-right', type: 'chair', col: 6, row: 3 },
      { uid: 'chair-r-top', type: 'chair', col: 13, row: 2 },
      { uid: 'chair-r-bottom', type: 'chair', col: 14, row: 5 },
      { uid: 'chair-r-left', type: 'chair', col: 12, row: 4 },
      { uid: 'chair-r-right', type: 'chair', col: 15, row: 3 },
    ],
  },
}

// ─── Template 2: Open Plan ───
const openGrid = Array.from({ length: 14 }, (_, r) =>
  Array.from({ length: 24 }, (_, c) => {
    if (r === 0 || r === 13 || c === 0 || c === 23) return W
    if (r >= 9 && r <= 12 && c >= 16 && c <= 22) return F3 // lounge carpet
    return F1
  })
)

const openPlanTemplate: OfficeTemplate = {
  id: 'open-plan',
  name: 'Open Plan',
  description: 'Large open workspace with lounge area',
  preview: '🏗️',
  layout: {
    version: 1,
    cols: 24,
    rows: 14,
    tiles: makeTiles(openGrid),
    tileColors: makeTileColors(openGrid, { [W]: null, [F1]: COOL_BLUE, [F3]: PURPLE_CARPET }),
    furniture: [
      // Row of desks
      { uid: 'desk-1', type: 'desk', col: 2, row: 2 },
      { uid: 'desk-2', type: 'desk', col: 6, row: 2 },
      { uid: 'desk-3', type: 'desk', col: 10, row: 2 },
      { uid: 'desk-4', type: 'desk', col: 2, row: 7 },
      { uid: 'desk-5', type: 'desk', col: 6, row: 7 },
      { uid: 'desk-6', type: 'desk', col: 10, row: 7 },
      // Chairs for each desk
      { uid: 'ch-1', type: 'chair', col: 2, row: 4 },
      { uid: 'ch-2', type: 'chair', col: 6, row: 4 },
      { uid: 'ch-3', type: 'chair', col: 10, row: 4 },
      { uid: 'ch-4', type: 'chair', col: 3, row: 6 },
      { uid: 'ch-5', type: 'chair', col: 7, row: 6 },
      { uid: 'ch-6', type: 'chair', col: 11, row: 6 },
      // PCs
      { uid: 'pc-1', type: 'pc', col: 3, row: 2 },
      { uid: 'pc-2', type: 'pc', col: 7, row: 2 },
      { uid: 'pc-3', type: 'pc', col: 11, row: 2 },
      // Lounge
      { uid: 'plant-1', type: 'plant', col: 22, row: 1 },
      { uid: 'plant-2', type: 'plant', col: 1, row: 12 },
      { uid: 'cooler-1', type: 'cooler', col: 22, row: 9 },
      { uid: 'bookshelf-1', type: 'bookshelf', col: 15, row: 1 },
      { uid: 'whiteboard-1', type: 'whiteboard', col: 17, row: 0 },
    ],
  },
}

// ─── Template 3: Cozy Studio ───
const cozyGrid = Array.from({ length: 9 }, (_, r) =>
  Array.from({ length: 12 }, (_, c) => {
    if (r === 0 || r === 8 || c === 0 || c === 11) return W
    if (r >= 5 && r <= 7 && c >= 7 && c <= 10) return F3
    return F2
  })
)

// ─── Template: Home ───
const homeTemplate: OfficeTemplate = {
  id: 'home',
  name: 'Home',
  description: 'Cozy home office for solo or duo work',
  preview: '🏠',
  layout: {
    version: 1,
    cols: 12,
    rows: 9,
    tiles: makeTiles(cozyGrid),
    tileColors: makeTileColors(cozyGrid, { [W]: null, [F2]: WARM_BROWN, [F3]: WARM_RED }),
    furniture: [
      { uid: 'desk-1', type: 'desk', col: 2, row: 2 },
      { uid: 'chair-1', type: 'chair', col: 2, row: 4 },
      { uid: 'chair-2', type: 'chair', col: 4, row: 2 },
      { uid: 'pc-1', type: 'pc', col: 3, row: 2 },
      { uid: 'lamp-1', type: 'lamp', col: 2, row: 2 },
      { uid: 'bookshelf-1', type: 'bookshelf', col: 1, row: 1 },
      { uid: 'plant-1', type: 'plant', col: 10, row: 1 },
      { uid: 'plant-2', type: 'plant', col: 1, row: 7 },
      { uid: 'cooler-1', type: 'cooler', col: 10, row: 7 },
    ],
  },
}

// ─── Template: Living Room ───
const livingRoomGrid = Array.from({ length: 10 }, (_, r) =>
  Array.from({ length: 14 }, (_, c) => {
    if (r === 0 || r === 9 || c === 0 || c === 13) return W
    if (r >= 5 && r <= 8 && c >= 4 && c <= 9) return F3  // carpet area
    return c < 7 ? F1 : F2
  })
)

const livingRoomTemplate: OfficeTemplate = {
  id: 'living-room',
  name: 'Living Room',
  description: 'Comfy lounge with sofa area and workspace corner',
  preview: '🛋️',
  layout: {
    version: 1,
    cols: 14,
    rows: 10,
    tiles: makeTiles(livingRoomGrid),
    tileColors: makeTileColors(livingRoomGrid, { [W]: null, [F1]: WARM_BEIGE, [F2]: WARM_BROWN, [F3]: WARM_RED }),
    furniture: [
      { uid: 'plant-1', type: 'plant', col: 1, row: 1 },
      { uid: 'plant-2', type: 'plant', col: 12, row: 1 },
      { uid: 'bookshelf-1', type: 'bookshelf', col: 1, row: 4 },
      { uid: 'lamp-1', type: 'lamp', col: 6, row: 6 },
      { uid: 'cooler-1', type: 'cooler', col: 12, row: 7 },
      { uid: 'desk-1', type: 'desk', col: 2, row: 2 },
      { uid: 'chair-1', type: 'chair', col: 2, row: 4 },
      { uid: 'chair-2', type: 'chair', col: 4, row: 2 },
      { uid: 'pc-1', type: 'pc', col: 3, row: 2 },
    ],
  },
}

// ─── Template: Dev Lab ───
const labGrid = Array.from({ length: 12 }, (_, r) =>
  Array.from({ length: 18 }, (_, c) => {
    if (r === 0 || r === 11 || c === 0 || c === 17) return W
    if (c === 9) return (r >= 3 && r <= 5) ? F4 : W  // divider wall with door
    return c < 9 ? F1 : F2
  })
)

const devLabTemplate: OfficeTemplate = {
  id: 'dev-lab',
  name: 'Dev Lab',
  description: 'Coding room + server room with divider wall',
  preview: '🧪',
  layout: {
    version: 1,
    cols: 18,
    rows: 12,
    tiles: makeTiles(labGrid),
    tileColors: makeTileColors(labGrid, { [W]: null, [F1]: SLATE_GRAY, [F2]: DARK_GREEN, [F4]: TAN_DOORWAY }),
    furniture: [
      // Dev side
      { uid: 'desk-1', type: 'desk', col: 2, row: 2 },
      { uid: 'desk-2', type: 'desk', col: 2, row: 6 },
      { uid: 'chair-1', type: 'chair', col: 4, row: 2 },
      { uid: 'chair-2', type: 'chair', col: 2, row: 4 },
      { uid: 'chair-3', type: 'chair', col: 4, row: 6 },
      { uid: 'chair-4', type: 'chair', col: 2, row: 8 },
      { uid: 'pc-1', type: 'pc', col: 3, row: 2 },
      { uid: 'pc-2', type: 'pc', col: 3, row: 6 },
      { uid: 'whiteboard-1', type: 'whiteboard', col: 5, row: 0 },
      // Server side
      { uid: 'desk-3', type: 'desk', col: 12, row: 3 },
      { uid: 'chair-5', type: 'chair', col: 12, row: 5 },
      { uid: 'chair-6', type: 'chair', col: 14, row: 3 },
      { uid: 'bookshelf-1', type: 'bookshelf', col: 10, row: 7 },
      { uid: 'bookshelf-2', type: 'bookshelf', col: 16, row: 1 },
      { uid: 'plant-1', type: 'plant', col: 1, row: 10 },
      { uid: 'cooler-1', type: 'cooler', col: 16, row: 10 },
      { uid: 'lamp-1', type: 'lamp', col: 10, row: 1 },
    ],
  },
}

// ─── Template 5: Empty Room ───
const emptyGrid = Array.from({ length: 11 }, (_, r) =>
  Array.from({ length: 16 }, (_, c) => {
    if (r === 0 || r === 10 || c === 0 || c === 15) return W
    return F1
  })
)

// ─── Template: Custom (blank canvas) ───
const customTemplate: OfficeTemplate = {
  id: 'custom',
  name: 'Custom',
  description: 'Blank canvas — add your own layout and furniture!',
  preview: '📐',
  layout: {
    version: 1,
    cols: 16,
    rows: 11,
    tiles: makeTiles(emptyGrid),
    tileColors: makeTileColors(emptyGrid, { [W]: null, [F1]: WARM_BEIGE }),
    furniture: [
      // Just two chairs so agents have somewhere to sit
      { uid: 'chair-1', type: 'chair', col: 4, row: 5 },
      { uid: 'chair-2', type: 'chair', col: 11, row: 5 },
    ],
  },
}

export const OFFICE_TEMPLATES: OfficeTemplate[] = [
  officeTemplate,
  homeTemplate,
  livingRoomTemplate,
  openPlanTemplate,
  devLabTemplate,
  customTemplate,
]

export function getTemplateById(id: string): OfficeTemplate | undefined {
  return OFFICE_TEMPLATES.find(t => t.id === id)
}
