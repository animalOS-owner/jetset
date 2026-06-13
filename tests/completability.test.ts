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

  it('every room is reachable under real physics', () => {
    // The service shaft + cluster connectors (src/content/shaft.ts) bring the
    // whole mansion into reach. Lock that in: a new room with no honest route
    // fails here. If it ever does, give it a connector or a real climb.
    const unreached = ROOM_DEFS.filter((d) => !rep.reachedRooms.has(d.id)).map((d) => d.id)
    console.log(
      `real-physics reach: ${rep.reachedRooms.size}/${ROOM_DEFS.length} rooms, ` +
        `${rep.collectableItems.size}/${rep.totalItems} items`,
    )
    expect(unreached).toEqual([])
  })
})
