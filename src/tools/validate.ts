// Build-time world validation. Errors are hard gates; warnings guide design.
// Node-safe: no canvas/DOM imports.

import { COLS, ROWS } from '../game/constants.ts'
import { T, type RoomDef, type Dir } from '../game/types.ts'
import { parseRoom, tileAt, isSupport, isRamp } from '../game/room.ts'
import { GUARDIAN_SIZE } from '../game/guardians.ts'
import type { Room } from '../game/types.ts'

export interface Report {
  errors: string[]
  warnings: string[]
  rooms: number
  items: number
}

const passable = (t: number) => t !== T.WALL
const lethal = (t: number) => t === T.HAZARD || t === T.WATER

/** Side openings: row pairs (r, r+1) Willy's body fits through at a column. */
function sideOpenings(room: Room, col: number): number[] {
  const out: number[] = []
  for (let r = 0; r < ROWS - 1; r++) {
    if (passable(tileAt(room, col, r)) && passable(tileAt(room, col, r + 1)))
      out.push(r)
  }
  return out
}

/** Columns open at the top or bottom edge. Lethal cells close the bottom
 * edge: Willy dies in them before he could ever fall through. */
function vertOpenings(room: Room, row: number): number[] {
  const out: number[] = []
  for (let c = 0; c < COLS; c++) {
    if (!passable(tileAt(room, c, row))) continue
    if (row > 0 && (lethal(tileAt(room, c, row)) || lethal(tileAt(room, c, row - 1))))
      continue
    out.push(c)
  }
  return out
}

// ----------------------------------------------------- in-room solver ---
// A permissive model of Willy's moves over "stand" cells, used to warn
// about rooms where an entrance can't plausibly reach any exit.

interface Solve {
  stands: Set<number> // r*COLS+c — feet on top of (c,r)
  reach: (from: Set<number>) => Set<number>
}

function standable(room: Room, c: number, r: number): boolean {
  if (r < 1 || r >= ROWS || c < 0 || c >= COLS) return false
  const t = tileAt(room, c, r)
  if (!(isSupport(t) || isRamp(t))) return false
  // body occupies the two cells above; they must be enterable and survivable
  for (const br of [r - 1, r - 2]) {
    if (br < 0) continue
    const bt = tileAt(room, c, br)
    if (!passable(bt) || lethal(bt)) return false
  }
  return true
}

function buildSolver(room: Room): Solve {
  const stands = new Set<number>()
  for (let r = 1; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) if (standable(room, c, r)) stands.add(r * COLS + c)

  // rope columns act as elevators: any stand near the rope connects to others
  const ropeCols = new Set<number>()
  for (const rp of room.def.ropes ?? [])
    for (let dc = -2; dc <= 2; dc++) ropeCols.add(rp.x + dc)

  const key = (c: number, r: number) => r * COLS + c

  const neighbors = (k: number): number[] => {
    const c = k % COLS
    const r = Math.floor(k / COLS)
    const out: number[] = []
    // walk & ramps: one column over, up to one row up/down
    for (const dc of [-1, 1])
      for (const dr of [-1, 0, 1])
        if (stands.has(key(c + dc, r + dr))) out.push(key(c + dc, r + dr))
    // jumps: generous fixed-arc envelope
    for (let dc = -3; dc <= 3; dc++)
      for (let dr = -2; dr <= 1; dr++) {
        if (dc === 0 && dr === 0) continue
        if (stands.has(key(c + dc, r + dr))) out.push(key(c + dc, r + dr))
      }
    // falls: step off either side, land on the first support within 5 rows
    for (const dc of [-1, 1]) {
      const fc = c + dc
      if (fc < 0 || fc >= COLS) continue
      for (let fr = r + 1; fr < Math.min(ROWS, r + 6); fr++) {
        if (stands.has(key(fc, fr))) {
          out.push(key(fc, fr))
          break
        }
        if (!passable(tileAt(room, fc, fr))) break
      }
    }
    // rope elevator: stands sharing a rope's columns are mutually reachable
    if (ropeCols.has(c))
      for (const k2 of stands) if (ropeCols.has(k2 % COLS)) out.push(k2)
    return out
  }

  const reach = (from: Set<number>): Set<number> => {
    const seen = new Set(from)
    const queue = [...from]
    while (queue.length) {
      const k = queue.pop()!
      for (const n of neighbors(k))
        if (!seen.has(n)) {
          seen.add(n)
          queue.push(n)
        }
    }
    return seen
  }

  return { stands, reach }
}

/** Stand cells an entry at a given edge/coordinate plausibly leads to. */
function entryStands(room: Room, solve: Solve, dir: Dir, at: number): Set<number> {
  const out = new Set<number>()
  const drop = (c: number, fromR: number) => {
    for (let r = Math.max(1, fromR); r < ROWS; r++) {
      if (solve.stands.has(r * COLS + c)) {
        out.add(r * COLS + c)
        return
      }
      if (!passable(tileAt(room, c, r))) return
    }
    // fell straight through the room: that's a bottom exit, not a stand
  }
  if (dir === 'left' || dir === 'right') {
    const edge = dir === 'left' ? 0 : COLS - 1
    // entering with body at rows (at, at+1): feet at row at+2
    for (const c of [edge, dir === 'left' ? 1 : COLS - 2])
      drop(c, at + 2)
  } else {
    drop(at, dir === 'up' ? ROWS - 2 : 0)
  }
  return out
}

/** Stand cells from which a given exit is usable. */
function exitStands(room: Room, solve: Solve, dir: Dir): Set<number> {
  const out = new Set<number>()
  if (dir === 'left' || dir === 'right') {
    const cols = dir === 'left' ? [0, 1] : [COLS - 1, COLS - 2]
    for (const c of cols)
      for (let r = 1; r < ROWS; r++)
        if (solve.stands.has(r * COLS + c)) out.add(r * COLS + c)
  } else if (dir === 'down') {
    // any stand adjacent to a column that drops clean out of the room
    for (const c of vertOpenings(room, ROWS - 1)) {
      for (const dc of [-1, 0, 1]) {
        for (let r = 1; r < ROWS; r++)
          if (solve.stands.has(r * COLS + (c + dc))) out.add(r * COLS + (c + dc))
      }
    }
  } else {
    // up: a stand high enough under an open ceiling column
    for (const c of vertOpenings(room, 0))
      for (let r = 1; r <= 4; r++)
        if (solve.stands.has(r * COLS + c)) out.add(r * COLS + c)
  }
  return out
}

// --------------------------------------------------------------- main ---

export function validateWorld(defs: RoomDef[], startId: string): Report {
  const errors: string[] = []
  const warnings: string[] = []
  const byCoord = new Map<string, RoomDef>()
  const rooms = new Map<string, Room>()
  let items = 0

  for (const def of defs) {
    try {
      const room = parseRoom(def)
      rooms.set(def.id, room)
      items += room.items.length
    } catch (e) {
      errors.push(String(e))
    }
    const key = `${def.gx},${def.gy}`
    if (byCoord.has(key))
      errors.push(`${def.id}: shares lattice cell ${key} with ${byCoord.get(key)!.id}`)
    byCoord.set(key, def)
  }

  const at = (gx: number, gy: number) => byCoord.get(`${gx},${gy}`)
  const graph = new Map<string, Set<string>>()
  const link = (a: string, b: string) => {
    if (!graph.has(a)) graph.set(a, new Set())
    graph.get(a)!.add(b)
  }

  for (const def of defs) {
    const room = rooms.get(def.id)
    if (!room) continue

    // ----- ramps must be bare walkable diagonals. Solid fill in the cell a
    // ramp climbs into (its high side) wedges Willy; a ramp stacked directly
    // above another breaks the diagonal. Both make a slope unwalkable.
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const t = tileAt(room, c, r)
        if (t !== T.RAMP_UP && t !== T.RAMP_DOWN) continue
        const high = t === T.RAMP_UP ? c + 1 : c - 1 // '/' high-right, '\' high-left
        if (tileAt(room, high, r) === T.WALL)
          errors.push(`${def.id}: ramp at ${c},${r} is blocked by fill at ${high},${r} (slopes must be bare diagonals)`)
        const above = tileAt(room, c, r - 1)
        if (above === T.RAMP_UP || above === T.RAMP_DOWN)
          errors.push(`${def.id}: stacked ramp at ${c},${r} (one ramp per column on a diagonal)`)
      }

    // ----- guardians sanity
    for (const g of def.guardians ?? []) {
      if (!(g.type in GUARDIAN_SIZE)) errors.push(`${def.id}: unknown guardian '${g.type}'`)
      if (g.a > g.b) errors.push(`${def.id}: guardian ${g.type} has a > b`)
      const h = (GUARDIAN_SIZE[g.type]?.[1] ?? 16) / 16
      if (g.axis === 'h') {
        if (g.a < 0 || g.b > COLS - 1 || g.at < 0 || g.at + h > ROWS)
          errors.push(`${def.id}: guardian ${g.type} out of bounds`)
      } else if (g.a < 0 || g.b + h > ROWS || g.at < 0 || g.at > COLS - 1) {
        errors.push(`${def.id}: guardian ${g.type} out of bounds`)
      }
    }
    for (const rp of def.ropes ?? []) {
      if (rp.x < 1 || rp.x > COLS - 2) errors.push(`${def.id}: rope anchor off grid`)
      if ((rp.top ?? 0) + rp.len > ROWS - 1)
        warnings.push(`${def.id}: rope reaches the floor`)
    }
    for (const a of def.arrows ?? [])
      if (a.y < 0 || a.y > ROWS - 1) errors.push(`${def.id}: arrow row off grid`)

    // ----- edges: neighbour existence + arrival safety
    const sides: [Dir, number, number][] = [
      ['left', -1, 0],
      ['right', 1, 0],
    ]
    for (const [dir, dx] of sides) {
      const nb = at(def.gx + dx, def.gy)
      const opens = sideOpenings(room, dir === 'left' ? 0 : COLS - 1)
      if (opens.length === 0) continue
      if (!nb) {
        errors.push(`${def.id}: open ${dir} edge (rows ${opens.join(',')}) but no room ${dir}`)
        continue
      }
      const nroom = rooms.get(nb.id)
      if (!nroom) continue
      const ncol = dir === 'left' ? COLS - 1 : 0
      let usable = 0
      for (const r of opens) {
        const a = tileAt(nroom, ncol, r)
        const b = tileAt(nroom, ncol, r + 1)
        if (!passable(a) || !passable(b)) {
          errors.push(
            `${def.id} -> ${nb.id} (${dir}): opening at rows ${r}/${r + 1} hits a wall on arrival`,
          )
        } else if (lethal(a) || lethal(b)) {
          errors.push(
            `${def.id} -> ${nb.id} (${dir}): opening at rows ${r}/${r + 1} arrives in a hazard`,
          )
        } else usable++
      }
      if (usable > 0) link(def.id, nb.id)
    }

    // top/bottom
    for (const [dir, row] of [['up', 0], ['down', ROWS - 1]] as [Dir, number][]) {
      const nb = at(def.gx, def.gy + (dir === 'up' ? -1 : 1))
      const opens = vertOpenings(room, row)
      if (opens.length === 0) continue
      if (!nb) {
        if (dir === 'down') {
          errors.push(`${def.id}: open floor (cols ${opens.join(',')}) but no room below`)
        } else {
          // Open sky is fine unless Willy can actually launch through it:
          // a launch tile in rows 0-2 under an open ceiling column.
          for (const c of opens) {
            for (let r = 1; r <= 3; r++) {
              const t = tileAt(room, c, r)
              if (isSupport(t) || isRamp(t)) {
                errors.push(`${def.id}: jumpable open ceiling at col ${c} but no room above`)
                r = 99
              }
            }
          }
        }
        continue
      }
      const nroom = rooms.get(nb.id)
      if (!nroom) continue
      const nrows = dir === 'down' ? [0, 1] : [ROWS - 2, ROWS - 1]
      let usable = 0
      for (const c of opens) {
        const ts = nrows.map((nr) => tileAt(nroom, c, nr))
        if (ts.some((t) => !passable(t))) {
          // blocked on the other side: harmless for 'up' (acts like a ceiling),
          // an error for 'down' (you'd fall into a wall)
          if (dir === 'down')
            errors.push(`${def.id} -> ${nb.id} (down): column ${c} falls into a wall`)
        } else if (ts.some(lethal)) {
          errors.push(`${def.id} -> ${nb.id} (${dir}): column ${c} arrives in a hazard`)
        } else usable++
      }
      if (usable > 0) link(def.id, nb.id)
    }

    // ----- solver warnings: every used entry should reach some exit
    const solve = buildSolver(room)
    if (solve.stands.size === 0) {
      warnings.push(`${def.id}: no standable cells at all`)
      continue
    }
    const exits: [Dir, Set<number>][] = (['left', 'right', 'up', 'down'] as Dir[])
      .filter((d) => {
        const nb = at(
          def.gx + (d === 'left' ? -1 : d === 'right' ? 1 : 0),
          def.gy + (d === 'up' ? -1 : d === 'down' ? 1 : 0),
        )
        return !!nb
      })
      .map((d) => [d, exitStands(room, solve, d)])
    const anyExit = new Set<number>()
    for (const [, s] of exits) for (const k of s) anyExit.add(k)
    if (anyExit.size === 0) {
      warnings.push(`${def.id}: no usable exits found by solver`)
    } else {
      for (const d of ['left', 'right', 'up', 'down'] as Dir[]) {
        const dx = d === 'left' ? -1 : d === 'right' ? 1 : 0
        const dy = d === 'up' ? -1 : d === 'down' ? 1 : 0
        if (!at(def.gx + dx, def.gy + dy)) continue
        const opens =
          d === 'left' || d === 'right'
            ? sideOpenings(room, d === 'left' ? 0 : COLS - 1)
            : vertOpenings(room, d === 'up' ? 0 : ROWS - 1)
        for (const o of opens) {
          const from = entryStands(room, solve, d, o)
          if (from.size === 0) continue // pure fall-through entry
          const reached = solve.reach(from)
          if (![...anyExit].some((k) => reached.has(k))) {
            warnings.push(`${def.id}: entry ${d}@${o} may be a dead trap`)
            break
          }
        }
      }
      // items plausibly collectable
      for (const it of room.items) {
        let ok = false
        for (let dr = -2; dr <= 4 && !ok; dr++)
          for (let dc = -3; dc <= 3 && !ok; dc++)
            if (solve.stands.has((it.row + dr) * COLS + (it.col + dc))) ok = true
        if (!ok) warnings.push(`${def.id}: item ${it.id} looks unreachable`)
      }
    }
  }

  // ----- bed & start
  const bedRooms = defs.filter((d) => d.grid.includes('Z'))
  if (bedRooms.length !== 1)
    errors.push(`expected exactly 1 room with the bed, found ${bedRooms.length}`)

  if (!rooms.has(startId)) errors.push(`start room ${startId} missing`)

  // ----- whole-world reachability
  if (rooms.has(startId)) {
    const seen = new Set<string>([startId])
    const queue = [startId]
    while (queue.length) {
      const id = queue.pop()!
      for (const nb of graph.get(id) ?? [])
        if (!seen.has(nb)) {
          seen.add(nb)
          queue.push(nb)
        }
    }
    const missing = defs.filter((d) => !seen.has(d.id)).map((d) => d.id)
    if (missing.length)
      errors.push(`unreachable from ${startId}: ${missing.join(', ')}`)
    if (bedRooms.length === 1 && !seen.has(bedRooms[0].id))
      errors.push(`the bed room ${bedRooms[0].id} is unreachable`)
  }

  return { errors, warnings, rooms: defs.length, items }
}
