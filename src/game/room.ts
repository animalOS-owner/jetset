import { COLS, ROWS } from './constants.ts'
import { T, type Room, type RoomDef, type Tile, type ItemSpot } from './types.ts'

// The authoring legend: one character per cell in a room's grid.
export const LEGEND: Record<string, Tile> = {
  '.': T.EMPTY,
  ' ': T.EMPTY,
  '#': T.WALL,
  '=': T.PLATFORM,
  '/': T.RAMP_UP,
  '\\': T.RAMP_DOWN,
  '<': T.CONV_L,
  '>': T.CONV_R,
  '*': T.HAZARD,
  '~': T.WATER,
  A: T.DECO_A,
  B: T.DECO_B,
  C: T.DECO_C,
  Z: T.BED,
}

/** Characters that produce an entity instead of a tile. */
const ITEM_CH = 'i'

export class RoomFormatError extends Error {}

export function parseRoom(def: RoomDef): Room {
  const lines = def.grid.split('\n').filter((l) => l.trim().length > 0)
  if (lines.length !== ROWS)
    throw new RoomFormatError(`${def.id}: grid has ${lines.length} rows, want ${ROWS}`)

  const tiles = new Uint8Array(COLS * ROWS)
  const items: ItemSpot[] = []
  let itemN = 0

  for (let r = 0; r < ROWS; r++) {
    const line = lines[r]
    if (line.length !== COLS)
      throw new RoomFormatError(`${def.id}: row ${r} has ${line.length} cols, want ${COLS}`)
    for (let c = 0; c < COLS; c++) {
      const ch = line[c]
      if (ch === ITEM_CH) {
        items.push({ id: `${def.id}:${itemN++}`, col: c, row: r })
        tiles[r * COLS + c] = T.EMPTY
      } else {
        const t = LEGEND[ch]
        if (t === undefined)
          throw new RoomFormatError(`${def.id}: unknown char '${ch}' at ${c},${r}`)
        tiles[r * COLS + c] = t
      }
    }
  }
  return { def, tiles, items }
}

export function tileAt(room: Room, col: number, row: number): Tile {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return T.EMPTY
  return room.tiles[row * COLS + col] as Tile
}

export function isSolid(t: Tile): boolean {
  return t === T.WALL
}

/** Tiles whose top surface supports Willy. */
export function isSupport(t: Tile): boolean {
  return (
    t === T.WALL || t === T.PLATFORM || t === T.CONV_L || t === T.CONV_R
  )
}

export function isRamp(t: Tile): boolean {
  return t === T.RAMP_UP || t === T.RAMP_DOWN
}

export function isLethalTile(t: Tile): boolean {
  return t === T.HAZARD || t === T.WATER
}

/** Surface height (px from cell top) of a ramp at local x px within the cell. */
export function rampSurface(t: Tile, localX: number): number {
  // RAMP_UP '/': low on the left, high on the right.
  return t === T.RAMP_UP ? 15 - localX : localX
}
