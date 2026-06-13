import { describe, expect, it } from 'vitest'
import { ROOM_DEFS, START } from '../src/content/world.ts'
import { analyzeReachability } from '../src/tools/reach.ts'

// The build-time validator in src/tools/validate.ts proves reachability with a
// permissive movement model (it assumes Willy can jump "3 across and 2 up" and
// treats ropes as elevators). That model is far more generous than the engine,
// so it green-lit a mansion the real physics cannot climb. This test closes the
// gap: it drives the ACTUAL stepPlayer simulation room to room (guardians
// assumed dodgeable) and proves the bed can genuinely be reached.
describe('completability (real physics)', () => {
  const rep = analyzeReachability(ROOM_DEFS, START)

  it('Willy can reach the bed from the start', () => {
    expect(rep.bedReachable).toBe(true)
  })

  it('a substantial part of the mansion is reachable', () => {
    // Coverage is informational; the hard guarantee above is bed-reachability.
    console.log(
      `real-physics reach: ${rep.reachedRooms.size}/${ROOM_DEFS.length} rooms, ` +
        `${rep.collectableItems.size}/${rep.totalItems} items`,
    )
    expect(rep.reachedRooms.size).toBeGreaterThan(40)
  })
})
