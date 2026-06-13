// Real-physics reachability analysis. Unlike validate.ts (which uses a
// permissive movement model), this drives the ACTUAL stepPlayer simulation to
// decide what Willy can really reach, room to room. Guardians are ignored
// (assumed dodgeable) — this answers the geometric question: can the mansion
// be traversed and completed at all? Node-safe: no canvas/DOM imports.

import { CELL, ROWS, COLS, P_H, P_W, ROOM_W, ROOM_H } from '../game/constants.ts'
import { parseRoom, tileAt, isSupport, isRamp } from '../game/room.ts'
import { newPlayer, stepPlayer, settleOnGround } from '../game/physics.ts'
import type { Dir, InputState, Player, Room, RoomDef } from '../game/types.ts'

const IDLE: InputState = { left: false, right: false, up: false, down: false, jump: false, jumpHit: false }

export type Move = 'L' | 'R' | 'jL' | 'j0' | 'jR'
export const MOVES: Move[] = ['L', 'R', 'jL', 'j0', 'jR']

const standX = (col: number) => col * CELL + (CELL - P_W) / 2
const cellCol = (p: Player) => Math.round((p.x + P_W / 2 - CELL / 2) / CELL)

export function standable(room: Room, c: number, r: number): boolean {
  if (r < 1 || r >= ROWS || c < 0 || c >= COLS) return false
  const t = tileAt(room, c, r)
  return isSupport(t) || isRamp(t)
}

/** Can Willy actually rest at (col,row)? A fresh spawn there must settle and
 *  stay grounded. Filters "phantom" cells where a walk is only momentarily
 *  edge-supported beside a hole — without this the analyser stops at a hole's
 *  lip and never registers the fall through it. */
function stableStand(room: Room, col: number, row: number): boolean {
  const q = newPlayer(standX(col), row * CELL - P_H)
  settleOnGround(q, room)
  return q.onGround
}

interface World {
  rooms: Map<string, Room>
  byCoord: Map<string, RoomDef>
}

function buildWorld(defs: RoomDef[]): World {
  const rooms = new Map<string, Room>()
  const byCoord = new Map<string, RoomDef>()
  for (const d of defs) {
    rooms.set(d.id, parseRoom(d))
    byCoord.set(`${d.gx},${d.gy}`, d)
  }
  return { rooms, byCoord }
}

const DELTA: Record<Dir, [number, number]> = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }
function neighbor(world: World, def: RoomDef, dir: Dir): RoomDef | null {
  const [dx, dy] = DELTA[dir]
  return world.byCoord.get(`${def.gx + dx},${def.gy + dy}`) ?? null
}

export interface MoveOutcome {
  kind: 'stand' | 'die' | 'win'
  roomId?: string
  col?: number
  row?: number
  items: string[]
}

/** Continue simulating (after a transfer) until the player settles, wins, dies
 * or leaves again. `hold` is the directional input carried across the edge. */
function settle(world: World, room: Room, p: Player, hold: InputState, depth: number): MoveOutcome {
  const items: string[] = []
  let t = 0
  for (let f = 0; f < 260; f++) {
    t++
    const evs = stepPlayer(p, hold, room, t)
    for (const e of evs) {
      if (e.kind === 'item') items.push(e.id)
      if (e.kind === 'win') return { kind: 'win', items }
      if (e.kind === 'die') return { kind: 'die', items }
      if (e.kind === 'exit') {
        if (depth >= 4) return { kind: 'die', items }
        const out = transfer(world, room, p, e.dir, hold, depth + 1)
        return { ...out, items: items.concat(out.items) }
      }
    }
    if (p.onGround && f > 0) {
      const c = cellCol(p), r = (p.y + P_H) / CELL
      if (stableStand(room, c, r))
        return { kind: 'stand', roomId: room.def.id, col: c, row: r, items }
    }
  }
  return { kind: 'die', items }
}

function transfer(world: World, room: Room, p: Player, dir: Dir, hold: InputState, depth: number): MoveOutcome {
  const nb = neighbor(world, room.def, dir)
  if (!nb) return { kind: 'die', items: [] }
  if (dir === 'left') p.x += ROOM_W
  if (dir === 'right') p.x -= ROOM_W
  if (dir === 'up') { p.y += ROOM_H; p.apexY += ROOM_H }
  if (dir === 'down') { p.y -= ROOM_H; p.apexY -= ROOM_H }
  return settle(world, world.rooms.get(nb.id)!, p, hold, depth)
}

/** Simulate one move from a grounded stand cell. */
export function doMove(world: World, roomId: string, col: number, row: number, m: Move): MoveOutcome {
  const room = world.rooms.get(roomId)!
  const p = newPlayer(standX(col), row * CELL - P_H)
  settleOnGround(p, room)
  if (!p.onGround) return { kind: 'die', items: [] }
  const startKey = `${col},${row}`
  const dirInput: InputState =
    m === 'L' ? { ...IDLE, left: true } :
    m === 'R' ? { ...IDLE, right: true } :
    m === 'jL' ? { ...IDLE, left: true } :
    m === 'jR' ? { ...IDLE, right: true } : IDLE
  const hold: InputState = m[0] === 'j' ? IDLE : dirInput // walks keep holding; jumps are committed
  const items: string[] = []
  let t = 0
  for (let f = 0; f < 260; f++) {
    t++
    const inp = f === 0 && m[0] === 'j' ? { ...dirInput, jump: true, jumpHit: true } : (m[0] === 'j' ? IDLE : dirInput)
    const evs = stepPlayer(p, inp, room, t)
    for (const e of evs) {
      if (e.kind === 'item') items.push(e.id)
      if (e.kind === 'win') return { kind: 'win', items }
      if (e.kind === 'die') return { kind: 'die', items }
      if (e.kind === 'exit') {
        const out = transfer(world, room, p, e.dir, hold, 1)
        return { ...out, items: items.concat(out.items) }
      }
    }
    if (p.onGround && f > 0) {
      const c = cellCol(p), r = (p.y + P_H) / CELL
      if (`${c},${r}` !== startKey && stableStand(room, c, r))
        return { kind: 'stand', roomId, col: c, row: r, items }
    }
  }
  return { kind: 'die', items }
}

export interface ReachReport {
  bedReachable: boolean
  reachedRooms: Set<string>
  reachedCells: Map<string, Set<string>> // roomId -> "col,row"
  collectableItems: Set<string>
  totalItems: number
}

export function analyzeReachability(defs: RoomDef[], start: { room: string; col: number; row: number }): ReachReport {
  const world = buildWorld(defs)
  const startKey = `${start.room}:${start.col},${start.row}`
  const visited = new Set<string>([startKey])
  const reachedRooms = new Set<string>([start.room])
  const reachedCells = new Map<string, Set<string>>()
  const collectableItems = new Set<string>()
  let bedReachable = false
  const queue: [string, number, number][] = [[start.room, start.col, start.row]]
  const note = (rid: string, c: number, r: number) => {
    if (!reachedCells.has(rid)) reachedCells.set(rid, new Set())
    reachedCells.get(rid)!.add(`${c},${r}`)
  }
  note(start.room, start.col, start.row)
  let guard = 0
  while (queue.length && guard++ < 500000) {
    const [rid, c, r] = queue.pop()!
    for (const m of MOVES) {
      const o = doMove(world, rid, c, r, m)
      for (const it of o.items) collectableItems.add(it)
      if (o.kind === 'win') bedReachable = true
      else if (o.kind === 'stand') {
        const key = `${o.roomId}:${o.col},${o.row}`
        if (!visited.has(key)) {
          visited.add(key)
          reachedRooms.add(o.roomId!)
          note(o.roomId!, o.col!, o.row!)
          queue.push([o.roomId!, o.col!, o.row!])
        }
      }
    }
  }
  let totalItems = 0
  for (const r of world.rooms.values()) totalItems += r.items.length
  return { bedReachable, reachedRooms, reachedCells, collectableItems, totalItems }
}
