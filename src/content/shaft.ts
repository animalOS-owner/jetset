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
