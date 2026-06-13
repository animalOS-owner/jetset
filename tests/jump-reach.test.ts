import { describe, expect, it } from 'vitest'
import { parseRoom } from '../src/game/room.ts'
import { newPlayer, stepPlayer } from '../src/game/physics.ts'
import { CELL, P_H } from '../src/game/constants.ts'
import type { InputState, Player, Room, RoomDef, StepEvent } from '../src/game/types.ts'

const IDLE: InputState = {
  left: false, right: false, up: false, down: false, jump: false, jumpHit: false,
}
const inp = (over: Partial<InputState>): InputState => ({ ...IDLE, ...over })

function makeRoom(edit: (lines: string[]) => void): Room {
  const lines = Array.from({ length: 16 }, (_, r) =>
    r >= 14 ? '#'.repeat(32) : '#' + '.'.repeat(30) + '#',
  )
  edit(lines)
  const def: RoomDef = { id: 'test', name: 'Test', zone: 'beach', gx: 0, gy: 0, grid: '\n' + lines.join('\n') }
  return parseRoom(def)
}
const put = (lines: string[], row: number, col: number, s: string) =>
  (lines[row] = lines[row].slice(0, col) + s + lines[row].slice(col + s.length))

const standing = (x: number, feetRow: number): Player => {
  const p = newPlayer(x, feetRow * CELL - P_H)
  p.onGround = true
  return p
}
/** Press `takeoff` on frame 1 only, then release — the jump arc is committed. */
function jumpAndSettle(room: Room, p: Player, frames: number, takeoff: InputState): StepEvent[] {
  const all: StepEvent[] = []
  for (let t = 1; t <= frames; t++)
    all.push(...stepPlayer(p, t === 1 ? takeoff : IDLE, room, t))
  return all
}

describe('committed jump reach', () => {
  // The mansion's climbs are authored as a 2-rows-up, 3-columns-across zig-zag
  // (the envelope src/tools/validate.ts assumes). A directional jump must
  // actually deliver that, or those ladders are impossible and you get stuck on
  // the ground floor. JUMP_VX gives the committed arc the horizontal reach.
  it('a running jump lands on a platform 2 rows up and 3 columns across', () => {
    const room = makeRoom((l) => put(l, 12, 8, '==')) // platform at row 12, cols 8-9
    const p = standing(5 * CELL, 14) // start on the floor at col 5
    jumpAndSettle(room, p, 60, inp({ right: true, jump: true, jumpHit: true }))
    expect(p.onGround).toBe(true)
    expect(p.y + P_H).toBe(12 * CELL) // landed two rows up
    expect(p.x).toBeGreaterThanOrEqual(7 * CELL) // carried ~three columns across
  })

  it('a standing jump still rises straight up (no drift)', () => {
    const room = makeRoom(() => {})
    const p = standing(8 * CELL, 14)
    const x0 = p.x
    jumpAndSettle(room, p, 60, inp({ jump: true, jumpHit: true }))
    expect(p.onGround).toBe(true)
    expect(p.x).toBe(x0) // committed arc with no direction = vertical
  })
})
