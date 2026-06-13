import {
  CELL, COLS, ROWS, ROOM_W, ROOM_H,
  P_W, P_H, WALK, GRAVITY, JUMP_VY, MAX_FALL, FALL_DEATH, ROPE_REGRAB,
} from './constants.ts'
import { T, type InputState, type Player, type Room, type StepEvent } from './types.ts'
import { isRamp, isSupport, rampSurface, tileAt } from './room.ts'
import { ropePoint } from './guardians.ts'

export function newPlayer(x: number, y: number): Player {
  return {
    x, y, vy: 0, airVx: 0, onGround: false, jumping: false,
    facing: 1, frame: 0, apexY: y, rope: null, ropeCooldown: 0,
    grace: 0, entryGrace: 0,
  }
}

/**
 * Snap a freshly-spawned player onto the surface beneath their feet and mark
 * them grounded. Without this, a spawn whose feet sit exactly on a floor top
 * sinks one tile into it: findLanding's strict "below current feet" test skips
 * a support that is level with the feet. Only snaps when a surface is within a
 * tile below — a spawn high above the floor (top of a shaft) still falls.
 */
export function settleOnGround(p: Player, room: Room): void {
  const feetY = p.y + P_H
  const support = findSupport(room, p.x, feetY, CELL)
  if (support === null) return
  p.y = support - P_H
  p.vy = 0
  p.onGround = true
  p.jumping = false
  p.apexY = p.y
}

function collidesWall(room: Room, x: number, y: number): boolean {
  const c0 = Math.floor(x / CELL)
  const c1 = Math.floor((x + P_W - 1) / CELL)
  const r0 = Math.floor(y / CELL)
  const r1 = Math.floor((y + P_H - 1) / CELL)
  for (let r = Math.max(0, r0); r <= Math.min(ROWS - 1, r1); r++)
    for (let c = Math.max(0, c0); c <= Math.min(COLS - 1, c1); c++)
      if (tileAt(room, c, r) === T.WALL) return true
  return false
}

/**
 * Highest support surface within `snap` px of feetY at horizontal position x,
 * or null. Flat tops are sensed at both hitbox edges; ramps at the centre.
 */
function findSupport(room: Room, x: number, feetY: number, snap: number): number | null {
  let best: number | null = null
  const consider = (sy: number) => {
    if (Math.abs(sy - feetY) <= snap && (best === null || sy < best)) best = sy
  }
  const r0 = Math.floor((feetY - snap) / CELL)
  const r1 = Math.floor((feetY + snap) / CELL)
  const sensors = [x + 1, x + P_W - 2]
  for (let r = r0; r <= r1; r++) {
    if (r < 0 || r >= ROWS) continue
    for (const sx of sensors) {
      const t = tileAt(room, Math.floor(sx / CELL), r)
      if (isSupport(t)) consider(r * CELL)
    }
    const cx = x + P_W / 2
    const c = Math.floor(cx / CELL)
    const t = tileAt(room, c, r)
    if (isRamp(t)) consider(r * CELL + rampSurface(t, Math.floor(cx) - c * CELL))
  }
  return best
}

/**
 * Landing surface crossed while feet travel (fromFeet, toFeet], or null.
 * One-way platforms and walls land on their top edge; ramps on their surface.
 */
function findLanding(room: Room, x: number, fromFeet: number, toFeet: number): number | null {
  let best: number | null = null
  const consider = (sy: number) => {
    if (sy > fromFeet && sy <= toFeet && (best === null || sy < best)) best = sy
  }
  const r0 = Math.floor(fromFeet / CELL)
  const r1 = Math.floor(toFeet / CELL)
  const sensors = [x + 1, x + P_W - 2]
  for (let r = r0; r <= Math.min(ROWS - 1, r1 + 1); r++) {
    if (r < 0) continue
    for (const sx of sensors) {
      const t = tileAt(room, Math.floor(sx / CELL), r)
      if (isSupport(t)) consider(r * CELL)
    }
    const cx = x + P_W / 2
    const c = Math.floor(cx / CELL)
    const t = tileAt(room, c, r)
    if (isRamp(t)) consider(r * CELL + rampSurface(t, Math.floor(cx) - c * CELL))
  }
  return best
}

/** Conveyor tile currently under Willy's feet, if any. */
function conveyorUnder(room: Room, x: number, feetY: number): -1 | 0 | 1 {
  if (feetY % CELL !== 0) return 0
  const r = feetY / CELL
  for (const sx of [x + 1, x + P_W - 2]) {
    const t = tileAt(room, Math.floor(sx / CELL), r)
    if (t === T.CONV_L) return -1
    if (t === T.CONV_R) return 1
  }
  return 0
}

function tryGrabRope(p: Player, room: Room, t: number): boolean {
  const ropes = room.def.ropes
  if (!ropes || p.ropeCooldown > 0) return false
  const handX = p.x + P_W / 2
  const handY = p.y + 7
  for (let i = 0; i < ropes.length; i++) {
    const def = ropes[i]
    const maxS = def.len * CELL
    for (let s = 12; s <= maxS; s += 6) {
      const pt = ropePoint(def, t, s)
      if (Math.abs(pt.x - handX) < 7 && Math.abs(pt.y - handY) < 8) {
        p.rope = { index: i, s }
        p.vy = 0
        p.jumping = false
        p.onGround = false
        return true
      }
    }
  }
  return false
}

/**
 * Advance Willy one frame. Mutates `p`; returns events for the game layer
 * (item pickups, deaths, room exits, the win trigger). Guardian collisions
 * are handled by the game layer, which knows guardian positions.
 */
export function stepPlayer(p: Player, inp: InputState, room: Room, t: number): StepEvent[] {
  const ev: StepEvent[] = []
  if (p.grace > 0) p.grace--
  if (p.entryGrace > 0) p.entryGrace--
  if (p.ropeCooldown > 0) p.ropeCooldown--

  if (p.rope) {
    const def = room.def.ropes![p.rope.index]
    const maxS = def.len * CELL
    if (inp.up) p.rope.s = Math.max(12, p.rope.s - 1.1)
    if (inp.down) p.rope.s = Math.min(maxS, p.rope.s + 1.1)

    if (inp.jumpHit) {
      // Fling off: inherit the rope's instantaneous horizontal velocity.
      const a = ropePoint(def, t, p.rope.s)
      const b = ropePoint(def, t - 1, p.rope.s)
      const fling = Math.max(-2.2, Math.min(2.2, (a.x - b.x) * 1.5))
      p.rope = null
      p.ropeCooldown = ROPE_REGRAB
      p.vy = -JUMP_VY * 0.85
      p.airVx = fling + (inp.left ? -0.6 : inp.right ? 0.6 : 0)
      p.jumping = true
      p.apexY = p.y
      ev.push({ kind: 'jump' })
    } else {
      const pt = ropePoint(def, t, p.rope.s)
      p.x = pt.x - P_W / 2
      p.y = pt.y - 6
      p.facing = ropePoint(def, t, p.rope.s).x > ropePoint(def, t - 1, p.rope.s).x ? 1 : -1
    }
  } else if (p.onGround) {
    const feetY = p.y + P_H
    const belt = conveyorUnder(room, p.x, feetY)
    let dx = 0
    if (belt !== 0) {
      // The belt drags; input cannot oppose it (you jump off instead).
      dx = belt * WALK
      p.facing = belt as 1 | -1
    } else if (inp.left) {
      dx = -WALK
      p.facing = -1
    } else if (inp.right) {
      dx = WALK
      p.facing = 1
    }

    if (inp.jumpHit) {
      p.vy = -JUMP_VY
      p.airVx = dx
      p.jumping = true
      p.onGround = false
      p.apexY = p.y
      ev.push({ kind: 'jump' })
    } else if (dx !== 0) {
      const nx = p.x + dx
      if (!collidesWall(room, nx, p.y - 2)) {
        p.x = nx
        p.frame += Math.abs(dx)
        const snap = findSupport(room, p.x, p.y + P_H, 4)
        if (snap !== null) {
          p.y = snap - P_H
        } else {
          // Walked off an edge: the original drops you straight down.
          p.onGround = false
          p.jumping = false
          p.airVx = 0
          p.vy = 0
          p.apexY = p.y
        }
      }
    }
  } else {
    // Airborne: the arc is committed.
    if (p.airVx !== 0) {
      const nx = p.x + p.airVx
      if (!collidesWall(room, nx, p.y)) p.x = nx
      else p.airVx = 0
    }
    p.vy = Math.min(p.vy + GRAVITY, MAX_FALL)
    if (p.vy < 0) {
      const ny = p.y + p.vy
      if (collidesWall(room, p.x, ny)) {
        p.vy = 0 // head bump: ascent ends, fall begins
      } else {
        p.y = ny
      }
      if (p.y < p.apexY) p.apexY = p.y
    } else {
      const fromFeet = p.y + P_H
      const ny = p.y + p.vy
      const land = findLanding(room, p.x, fromFeet, ny + P_H)
      if (land !== null) {
        p.y = land - P_H
        p.onGround = true
        p.jumping = false
        p.vy = 0
        const fall = p.y - p.apexY
        p.apexY = p.y
        if (fall > FALL_DEATH) {
          ev.push({ kind: 'die', cause: 'fall' })
          return ev
        }
      } else {
        p.y = ny
      }
    }
    if (!p.onGround) tryGrabRope(p, room, t)
  }

  // --- overlap checks (hazards, items, the bed) ---
  const ix = p.x + 2
  const iy = p.y + 3
  const iw = P_W - 4
  const ih = P_H - 6
  const c0 = Math.max(0, Math.floor(ix / CELL))
  const c1 = Math.min(COLS - 1, Math.floor((ix + iw - 1) / CELL))
  const r0 = Math.max(0, Math.floor(iy / CELL))
  const r1 = Math.min(ROWS - 1, Math.floor((iy + ih - 1) / CELL))
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++) {
      const tl = tileAt(room, c, r)
      if ((tl === T.HAZARD || tl === T.WATER) && p.grace === 0) {
        // hazard cells hurt on a slightly smaller box for fairness
        const hx = c * CELL + 3
        const hy = r * CELL + 3
        if (ix < hx + 10 && ix + iw > hx && iy < hy + 10 && iy + ih > hy) {
          ev.push({ kind: 'die', cause: 'hazard' })
          return ev
        }
      }
      if (tl === T.BED) ev.push({ kind: 'win' })
    }

  for (const it of room.items) {
    const hx = it.col * CELL + 3
    const hy = it.row * CELL + 3
    if (ix < hx + 10 && ix + iw > hx && iy < hy + 10 && iy + ih > hy)
      ev.push({ kind: 'item', id: it.id })
  }

  // --- room exits ---
  const cx = p.x + P_W / 2
  const cy = p.y + P_H / 2
  if (cx < 0) ev.push({ kind: 'exit', dir: 'left' })
  else if (cx >= ROOM_W) ev.push({ kind: 'exit', dir: 'right' })
  else if (cy >= ROOM_H) ev.push({ kind: 'exit', dir: 'down' })
  else if (cy < 0) ev.push({ kind: 'exit', dir: 'up' })

  return ev
}
