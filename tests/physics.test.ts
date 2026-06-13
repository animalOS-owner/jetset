import { describe, expect, it } from 'vitest'
import { parseRoom } from '../src/game/room.ts'
import { newPlayer, stepPlayer, settleOnGround } from '../src/game/physics.ts'
import { CELL, P_H, WALK } from '../src/game/constants.ts'
import type { InputState, Player, Room, RoomDef, StepEvent } from '../src/game/types.ts'

const IDLE: InputState = {
  left: false, right: false, up: false, down: false, jump: false, jumpHit: false,
}
const inp = (over: Partial<InputState>): InputState => ({ ...IDLE, ...over })

/** A sealed 32x16 box with a solid floor at rows 14-15, customizable. */
function makeRoom(edit: (lines: string[]) => void = () => {}): Room {
  const lines = Array.from({ length: 16 }, (_, r) =>
    r >= 14 ? '#'.repeat(32) : '#' + '.'.repeat(30) + '#',
  )
  edit(lines)
  const def: RoomDef = {
    id: 'test', name: 'Test', zone: 'beach', gx: 0, gy: 0,
    grid: '\n' + lines.join('\n'),
  }
  return parseRoom(def)
}

const put = (lines: string[], row: number, col: number, s: string) => {
  lines[row] = lines[row].slice(0, col) + s + lines[row].slice(col + s.length)
}

/** Stand Willy with his feet on top of the given row. */
const standing = (x: number, feetRow: number): Player => {
  const p = newPlayer(x, feetRow * CELL - P_H)
  p.onGround = true
  return p
}

function run(room: Room, p: Player, frames: number, input: InputState): StepEvent[] {
  const all: StepEvent[] = []
  for (let t = 1; t <= frames; t++) {
    const first = t === 1
    all.push(...stepPlayer(
      p,
      input.jumpHit && !first ? { ...input, jumpHit: false } : input,
      room, t,
    ))
  }
  return all
}

describe('willy physics', () => {
  it('falls and lands on the floor', () => {
    const room = makeRoom()
    const p = newPlayer(100, 50)
    run(room, p, 120, IDLE)
    expect(p.onGround).toBe(true)
    expect(p.y + P_H).toBe(14 * CELL)
  })

  it('walks at constant speed and is stopped by walls', () => {
    const room = makeRoom()
    const p = standing(100, 14)
    run(room, p, 10, inp({ right: true }))
    expect(p.x).toBeCloseTo(100 + 10 * WALK, 5)
    run(room, p, 600, inp({ right: true }))
    // stopped against the right wall (col 31), not inside it
    expect(p.x + 10 - 1).toBeLessThan(31 * CELL)
    expect(p.x).toBeGreaterThan(29 * CELL)
  })

  it('jump apex is ~35px: clears 2 rows, never 3', () => {
    const room = makeRoom()
    const p = standing(100, 14)
    let minY = p.y
    for (let t = 1; t < 90; t++) {
      stepPlayer(p, t === 1 ? inp({ jumpHit: true, jump: true }) : IDLE, room, t)
      minY = Math.min(minY, p.y)
    }
    const rise = 14 * CELL - P_H - minY
    expect(rise).toBeGreaterThanOrEqual(33)
    expect(rise).toBeLessThan(48)
    expect(p.onGround).toBe(true)
  })

  it('lands on a platform 2 rows up', () => {
    const room = makeRoom((l) => put(l, 12, 8, '===='))
    const p = standing(6 * CELL, 14)
    run(room, p, 50, inp({ right: true, jump: true, jumpHit: true }))
    expect(p.onGround).toBe(true)
    expect(p.y + P_H).toBe(12 * CELL)
  })

  /** Walk right until Willy leaves the ground (steps off an edge). */
  function walkOff(room: Room, p: Player): StepEvent[] {
    const all: StepEvent[] = []
    for (let t = 1; t <= 200 && p.onGround; t++)
      all.push(...stepPlayer(p, inp({ right: true }), room, t))
    expect(p.onGround).toBe(false)
    return all
  }

  it('walking off an edge drops straight down', () => {
    const room = makeRoom((l) => put(l, 10, 4, '===='))
    const p = standing(5 * CELL, 10)
    walkOff(room, p)
    const xAtFall = p.x
    run(room, p, 90, IDLE)
    expect(p.onGround).toBe(true)
    expect(p.y + P_H).toBe(14 * CELL) // fell to the floor
    expect(p.x).toBe(xAtFall) // no horizontal drift while falling
  })

  it('a fall of more than 6 rows is fatal', () => {
    const room = makeRoom((l) => put(l, 4, 4, '===='))
    const p = standing(5 * CELL, 4)
    const events = walkOff(room, p)
    events.push(...run(room, p, 120, IDLE))
    expect(events.some((e) => e.kind === 'die' && e.cause === 'fall')).toBe(true)
  })

  it('a fall of 4 rows is survivable', () => {
    const room = makeRoom((l) => put(l, 10, 4, '===='))
    const p = standing(5 * CELL, 10)
    const events = walkOff(room, p)
    events.push(...run(room, p, 120, IDLE))
    expect(events.some((e) => e.kind === 'die')).toBe(false)
    expect(p.onGround).toBe(true)
  })

  it('conveyors drag even against held input', () => {
    const room = makeRoom((l) => put(l, 14, 8, '<<<<<<<<'))
    const p = standing(12 * CELL, 14)
    run(room, p, 20, inp({ right: true }))
    expect(p.x).toBeLessThan(12 * CELL) // dragged left regardless
  })

  it('hazards kill on contact', () => {
    const room = makeRoom((l) => put(l, 13, 12, '*'))
    const p = standing(9 * CELL, 14)
    const events = run(room, p, 60, inp({ right: true }))
    expect(events.some((e) => e.kind === 'die' && e.cause === 'hazard')).toBe(true)
  })

  it('items emit pickup events', () => {
    const room = makeRoom((l) => put(l, 13, 12, 'i'))
    const p = standing(9 * CELL, 14)
    const events = run(room, p, 80, inp({ right: true }))
    expect(events.some((e) => e.kind === 'item' && e.id === 'test:0')).toBe(true)
  })

  it('crossing a side edge emits an exit event', () => {
    const room = makeRoom((l) => {
      put(l, 12, 31, '.')
      put(l, 13, 31, '.')
      put(l, 12, 0, '.')
      put(l, 13, 0, '.')
    })
    const p = standing(29 * CELL, 14)
    const events = run(room, p, 60, inp({ right: true }))
    expect(events.some((e) => e.kind === 'exit' && e.dir === 'right')).toBe(true)
  })

  it('a fresh spawn with feet exactly on the floor stands, never sinks', () => {
    const room = makeRoom()
    // Spawn exactly like the start: feet at the top of the row-14 floor.
    const p = newPlayer(3 * CELL + 3, 14 * CELL - P_H)
    expect(p.onGround).toBe(false)
    settleOnGround(p, room)
    expect(p.onGround).toBe(true)
    expect(p.y + P_H).toBe(14 * CELL) // standing on the floor, not inside it
    // and a frame of idle physics keeps him put (does not sink through)
    run(room, p, 5, IDLE)
    expect(p.y + P_H).toBe(14 * CELL)
    expect(p.onGround).toBe(true)
  })

  it('a settled spawn jumps UP, not down', () => {
    const room = makeRoom()
    const p = newPlayer(8 * CELL, 14 * CELL - P_H)
    settleOnGround(p, room)
    const floorY = p.y
    stepPlayer(p, inp({ jumpHit: true, jump: true }), room, 1) // takeoff: sets upward velocity
    expect(p.onGround).toBe(false)
    for (let t = 2; t <= 6; t++) stepPlayer(p, IDLE, room, t)
    expect(p.y).toBeLessThan(floorY) // risen above the floor, not sunk below it
  })

  it('settleOnGround leaves a high spawn airborne (top of a shaft falls)', () => {
    const room = makeRoom()
    const p = newPlayer(8 * CELL, 1 * CELL) // far above the floor
    settleOnGround(p, room)
    expect(p.onGround).toBe(false)
  })

  it('grace frames protect after respawn', () => {
    const room = makeRoom((l) => put(l, 13, 12, '*'))
    const p = standing(11 * CELL, 14)
    p.grace = 9999
    const events = run(room, p, 30, IDLE)
    expect(events.some((e) => e.kind === 'die')).toBe(false)
  })
})
