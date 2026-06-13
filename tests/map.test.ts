import { describe, expect, it } from 'vitest'
import { ROOM_DEFS, START } from '../src/content/world.ts'
import { validateWorld } from '../src/tools/validate.ts'

describe('the mansion', () => {
  const rep = validateWorld(ROOM_DEFS, START.room)

  it('has at least 100 rooms', () => {
    expect(rep.rooms).toBeGreaterThanOrEqual(100)
  })

  it('has plenty of optional items', () => {
    expect(rep.items).toBeGreaterThanOrEqual(100)
  })

  it('passes structural validation with zero errors', () => {
    if (rep.errors.length) console.error(rep.errors.join('\n'))
    expect(rep.errors).toEqual([])
  })

  it('has no solver warnings (fairness lints)', () => {
    if (rep.warnings.length) console.warn(rep.warnings.join('\n'))
    expect(rep.warnings).toEqual([])
  })
})
