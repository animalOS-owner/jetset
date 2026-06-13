import { CELL, ROOM_W } from './constants.ts'
import type { ArrowDef, GuardianDef, RopeDef } from './types.ts'

// Guardian sprite footprints (px). Data only — safe to import in node tools.
export const GUARDIAN_SIZE: Record<string, [number, number]> = {
  crab: [16, 16],
  gull: [16, 16],
  bee: [16, 16],
  rat: [16, 16],
  slime: [16, 16],
  knife: [16, 16],
  flame: [16, 16],
  book: [16, 16],
  bat: [16, 16],
  spider: [16, 16],
  crow: [16, 16],
  orb: [16, 16],
  gardener: [16, 32],
  ghost: [16, 32],
  chef: [16, 32],
  butler: [16, 32],
  maid: [16, 32],
  sweep: [16, 32],
  knight: [16, 32],
  maria: [16, 32],
}

/** Triangle wave: 0..len..0, period 2*len. */
function tri(u: number, len: number): number {
  if (len <= 0) return 0
  const m = ((u % (2 * len)) + 2 * len) % (2 * len)
  return m < len ? m : 2 * len - m
}

export interface GuardianPos {
  x: number
  y: number
  w: number
  h: number
  /** -1 or 1: direction of current travel along the patrol */
  dir: number
  type: string
}

/** Deterministic guardian position as a pure function of room-time. */
export function guardianPos(def: GuardianDef, t: number): GuardianPos {
  const [w, h] = GUARDIAN_SIZE[def.type] ?? [16, 16]
  const len = (def.b - def.a) * CELL
  const u = def.speed * t + (def.phase ?? 0)
  const p = def.a * CELL + tri(u, len)
  const phase = len > 0 ? ((u % (2 * len)) + 2 * len) % (2 * len) : 0
  const dir = phase < len ? 1 : -1
  return def.axis === 'h'
    ? { x: p, y: def.at * CELL, w, h, dir, type: def.type }
    : { x: def.at * CELL, y: p, w, h, dir, type: def.type }
}

export function ropeAngle(def: RopeDef, t: number): number {
  const amp = def.amp ?? 0.55
  const period = def.period ?? 220
  return amp * Math.sin((2 * Math.PI * (t + (def.phase ?? 0))) / period)
}

export function ropeAnchor(def: RopeDef): { x: number; y: number } {
  return { x: def.x * CELL + CELL / 2, y: (def.top ?? 0) * CELL + 2 }
}

/** Point on the rope at distance s (px) from the anchor. */
export function ropePoint(def: RopeDef, t: number, s: number): { x: number; y: number } {
  const th = ropeAngle(def, t)
  const a = ropeAnchor(def)
  return { x: a.x + s * Math.sin(th), y: a.y + s * Math.cos(th) }
}

export interface ArrowPos {
  x: number
  y: number
  w: number
  h: number
  dir: 1 | -1
}

/** Position of a flying arrow, or null while it is between launches. */
export function arrowPos(def: ArrowDef, t: number): ArrowPos | null {
  const speed = def.speed ?? 4
  const u = (((t + (def.offset ?? 0)) % def.period) + def.period) % def.period
  const flight = (ROOM_W + 32) / speed
  if (u >= flight) return null
  const d = u * speed
  const x = def.dir > 0 ? -16 + d : ROOM_W - d
  return { x, y: def.y * CELL + 6, w: 16, h: 4, dir: def.dir }
}
