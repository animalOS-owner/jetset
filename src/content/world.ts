import { ALL_ROOMS } from './rooms/index.ts'
import { parseRoom } from '../game/room.ts'
import type { Dir, Room, RoomDef } from '../game/types.ts'

// The world lattice: every room occupies one (gx, gy) coordinate and exits
// are derived purely from adjacency — geometry cannot be miswired.

export const ROOM_DEFS: RoomDef[] = ALL_ROOMS

const byId = new Map<string, RoomDef>()
const byCoord = new Map<string, RoomDef>()
for (const def of ROOM_DEFS) {
  if (byId.has(def.id)) throw new Error(`duplicate room id ${def.id}`)
  const key = `${def.gx},${def.gy}`
  if (byCoord.has(key)) throw new Error(`rooms ${byCoord.get(key)!.id} and ${def.id} share cell ${key}`)
  byId.set(def.id, def)
  byCoord.set(key, def)
}

const DELTA: Record<Dir, [number, number]> = {
  left: [-1, 0],
  right: [1, 0],
  up: [0, -1],
  down: [0, 1],
}

export function roomDef(id: string): RoomDef {
  const def = byId.get(id)
  if (!def) throw new Error(`unknown room ${id}`)
  return def
}

export function roomAt(gx: number, gy: number): RoomDef | null {
  return byCoord.get(`${gx},${gy}`) ?? null
}

export function neighborOf(def: RoomDef, dir: Dir): RoomDef | null {
  const [dx, dy] = DELTA[dir]
  return roomAt(def.gx + dx, def.gy + dy)
}

const parsed = new Map<string, Room>()
export function getRoom(id: string): Room {
  let room = parsed.get(id)
  if (!room) {
    room = parseRoom(roomDef(id))
    parsed.set(id, room)
  }
  return room
}

export const TOTAL_ITEMS = ROOM_DEFS.reduce(
  (n, def) => n + (def.grid.match(/i/g)?.length ?? 0),
  0,
)

/** Where a new game begins: Willy washed up at the end of the jetty. */
export const START = { room: 'the-jetty', col: 3, row: 14 }
