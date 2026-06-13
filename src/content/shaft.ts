import type { RoomDef } from '../game/types.ts'

// ---------------------------------------------------------------------------
// The Service Shaft.
//
// The mansion's rooms were authored against a movement model far more generous
// than the engine actually delivers (see src/tools/reach.ts): the build-time
// validator assumed Willy could clear "3 across and 2 up" in a single jump and
// treated ropes as elevators, so it green-lit a world the physics cannot climb.
// In practice every route *upward* is impossible and only the ground floor is
// reachable — the bed can never be reached.
//
// Rather than rewrite a hundred hand-authored puzzle rooms, this overlay carves
// one honest, self-contained vertical shaft up the gx=10 column of the lattice
// — a mansion dumbwaiter — giving a guaranteed, physics-verified route from the
// ground floor to the Master Bedroom. It is deliberately easy to remove: delete
// the carveServiceShaft() call in world.ts and the game reverts exactly. The
// real-physics completability test (tests/completability.test.ts) will then
// keep whatever ascents you author honest.
//
// The shaft lives in column SHAFT_COL of seven stacked rooms (gx=10, gy 6→0).
// Each room gets a ladder of one-way platforms two rows apart, a clear ceiling
// hole into the room above and a clear floor hole from the room below, so Willy
// chimneys straight up with plain standing jumps — no fragile sideways arcs.
// ---------------------------------------------------------------------------

// Column the shaft runs up. Kept clear of the swinging bell-ropes (cols 14 & 20
// in that room) so the climber never accidentally grabs one, and near the bed.
export const SHAFT_COL = 5

// Bottom (ground floor) to top (bedroom).
const SHAFT_ROOMS = [
  'rose-garden',     // gy6 — entry: solid floor, climb in off the ground floor
  'guest-bedroom',   // gy5
  'clockwork-room',  // gy4
  'trapdoor-room',   // gy3
  'battlements',     // gy2
  'bell-ropes',      // gy1
  'master-bedroom',  // gy0 — top: arrive, step onto the floor, reach the bed
]

/** Overwrite one column of a room's grid, row -> single char. */
function setColumn(grid: string, col: number, rowChars: Record<number, string>): string {
  const lines = grid.split('\n').filter((l) => l.trim().length > 0)
  for (const [rStr, ch] of Object.entries(rowChars)) {
    const r = Number(rStr)
    lines[r] = lines[r].slice(0, col) + ch + lines[r].slice(col + 1)
  }
  return '\n' + lines.join('\n')
}

// One-way platforms on the ODD rows, two apart, so Willy chimneys up with plain
// standing jumps. The launch rung is row 1 (right under the ceiling hole): he
// leaves with almost his full jump velocity and so rises ~two cells into the
// room above — far enough to land on its row-15 catch rung instead of dropping
// straight back down the way he came.
function shaftColumn(kind: 'entry' | 'middle' | 'top'): Record<number, string> {
  const col: Record<number, string> = {}
  for (let r = 0; r <= 15; r++) col[r] = '.' // clear the whole column first

  if (kind === 'top') {
    // Willy rises in through the floor; bed tiles here register the win exactly
    // where he arrives (the room keeps its original bed too).
    col[14] = '.'
    col[15] = '.'
    col[11] = 'Z'
    col[12] = 'Z'
    col[13] = 'Z'
    return col
  }

  for (let r = 1; r <= 13; r += 2) col[r] = '=' // ladder rungs 1,3,5,7,9,11,13
  // row 0 stays open: the ceiling hole into the room above.
  if (kind === 'entry') {
    // Ground floor: keep the solid floor so Willy can stand and climb in.
    col[14] = '#'
    col[15] = '#'
  } else {
    col[15] = '=' // row-15 catch rung for an arrival rising from below
  }
  return col
}

/**
 * Return a copy of `defs` with the service shaft carved in. Pure: does not
 * mutate the input.
 */
export function carveServiceShaft(defs: RoomDef[]): RoomDef[] {
  const byId = new Map(defs.map((d) => [d.id, d]))
  const out = defs.map((d) => ({ ...d }))
  const replace = (id: string, grid: string) => {
    const i = out.findIndex((d) => d.id === id)
    if (i >= 0) out[i] = { ...out[i], grid }
  }

  SHAFT_ROOMS.forEach((id, idx) => {
    const def = byId.get(id)
    if (!def) return
    const kind = idx === 0 ? 'entry' : idx === SHAFT_ROOMS.length - 1 ? 'top' : 'middle'
    replace(id, setColumn(def.grid, SHAFT_COL, shaftColumn(kind)))
  })

  return out
}

// ---------------------------------------------------------------------------
// Cluster connectors.
//
// Beyond the main shaft, eight rooms at the mansion's extremities (the yacht
// mast-top, the left rooftops, the tower belfry, the left sewers) sit behind
// up-shafts the real physics can't climb or behind lethal floors. Each is
// carved a tiny one-column connector from its already-reachable neighbour:
// an up-chimney (rungs + ceiling hole + catch rung), or a drop-in (a floor
// hole above, a high catch rung below so the fall is survivable). Verified by
// tests/completability.test.ts. Like the shaft, deleting carveConnectors() in
// world.ts reverts the rooms exactly.
// ---------------------------------------------------------------------------

function clearCol(): Record<number, string> {
  const c: Record<number, string> = {}
  for (let r = 0; r <= 15; r++) c[r] = '.'
  return c
}

// Lower room of an up-chimney: ladder rungs to a launch under the ceiling hole.
function chimneyLower(): Record<number, string> {
  const c = clearCol()
  for (let r = 1; r <= 13; r += 2) c[r] = '='
  c[14] = '#'
  c[15] = '#' // keep the floor solid: Willy climbs in off it
  return c // row 0 stays open — the ceiling hole into the room above
}
// Upper (target) room of an up-chimney: catch rung on arrival, rungs to climb
// in, ceiling kept solid (nothing above these rooms).
function chimneyUpper(): Record<number, string> {
  const c = clearCol()
  for (let r = 1; r <= 13; r += 2) c[r] = '='
  c[0] = '#'
  c[14] = '.' // floor hole Willy rises through
  c[15] = '=' // catch rung
  return c
}
// One column of a drop-in's upper (reached) room: a floor hole to step into,
// ceiling kept solid, a rung to climb back out.
function dropUpper(): Record<number, string> {
  const c = clearCol()
  c[0] = '#'
  c[13] = '='
  c[14] = '.'
  c[15] = '.'
  return c
}
// One column of a drop-in's lower (target) room: open ceiling the drop comes
// through, a high catch rung so the fall is short, a solid landing floor.
function dropLower(): Record<number, string> {
  const c = clearCol()
  c[3] = '=' // high catch rung near the ceiling
  c[14] = '#'
  c[15] = '#' // solid landing floor (never water)
  return c
}

const cellAt = (grid: string, col: number, row: number): string => {
  const lines = grid.split('\n').filter((l) => l.trim().length > 0)
  return lines[row]?.[col] ?? '#'
}

/** Can Willy walk along the floor (row 14) from `col` to a side edge without
 *  crossing a hole or water? If so the landing column reaches a side door and
 *  isn't a dead-end pocket. */
function floorReachesSide(grid: string, col: number): boolean {
  let left = true
  for (let c = col; c >= 1; c--) if (cellAt(grid, c, 14) !== '#') { left = false; break }
  let right = true
  for (let c = col; c <= 30; c++) if (cellAt(grid, c, 14) !== '#') { right = false; break }
  return left || right
}

/** Leftmost column c (2..28) where a 2-wide drop fits: columns c and c+1 are
 *  fresh solid ceiling/floor in both rooms and the landing reaches a side door,
 *  so Willy falls cleanly through and isn't stranded in a pocket. */
function dropColumn(upper: string, lower: string): number {
  for (const c of [24, 25, 26, 23, 27, 12, 13, 11, 14, 8, 9, 2, 3, 4, 28]) {
    const ok = [c, c + 1].every(
      (x) =>
        cellAt(upper, x, 14) === '#' &&
        cellAt(lower, x, 0) === '#' &&
        cellAt(lower, x, 14) === '#' &&
        floorReachesSide(lower, x),
    )
    if (ok) return c
  }
  return -1
}

/** First mid column (2..29) where a connector can't collide with an existing
 *  shaft/door: the lower room (floor kept, ceiling opened) must be solid at
 *  both row 0 and row 14, and the upper room (floor opened) solid at row 14.
 *  The upper ceiling is set solid by the carve, so it needn't start solid.
 *  When `landRoom` is given, the chosen column's floor there must also reach a
 *  side door, so a drop-in never strands Willy in an isolated floor pocket. */
function safeColumn(lower: string, upper: string, landRoom?: string): number {
  for (const c of [13, 14, 12, 15, 11, 9, 8, 22, 23, 7, 2, 3, 4, 25, 26, 27, 28, 29]) {
    if (
      cellAt(lower, c, 0) === '#' && cellAt(lower, c, 14) === '#' &&
      cellAt(upper, c, 14) === '#' &&
      (!landRoom || floorReachesSide(landRoom, c))
    ) return c
  }
  return -1
}

// [reachedNeighbour, strandedRoom, 'up' | 'drop']
const CONNECTORS: [string, string, 'up' | 'drop'][] = [
  ['crows-nest', 'mast-top', 'up'],
  ['mind-your-head', 'west-gable', 'up'],
  ['boxes-of-regret', 'loose-slates', 'up'],
  ['cobweb-suite', 'sweeps-lament', 'up'],
  ['counterweights', 'the-belfry', 'up'],
  ['the-vaults', 'storm-drain', 'drop'],
  ['family-silver', 'ankle-deep', 'drop'],
  ['hundred-barrels', 'grate-escape', 'drop'],
]

export function carveConnectors(defs: RoomDef[]): RoomDef[] {
  const out = defs.map((d) => ({ ...d }))
  const find = (id: string) => out.find((d) => d.id === id)

  for (const [reachedId, strandedId, kind] of CONNECTORS) {
    const reached = find(reachedId)
    const stranded = find(strandedId)
    if (!reached || !stranded) continue
    // up: lower=reached, upper=stranded.  drop: upper=reached, lower=stranded.
    const lower = kind === 'up' ? reached : stranded
    const upper = kind === 'up' ? stranded : reached
    if (kind === 'up') {
      const col = safeColumn(lower.grid, upper.grid)
      if (col < 0) continue
      lower.grid = setColumn(lower.grid, col, chimneyLower())
      upper.grid = setColumn(upper.grid, col, chimneyUpper())
    } else {
      // Drop-in: a 2-wide hole (1-wide is narrower than Willy's hitbox, so he
      // strides over it without falling), landing in a door-connected pocket.
      const col = dropColumn(upper.grid, lower.grid)
      if (col < 0) continue
      for (const c of [col, col + 1]) {
        upper.grid = setColumn(upper.grid, c, dropUpper())
        lower.grid = setColumn(lower.grid, c, dropLower())
      }
    }
  }
  return out
}
