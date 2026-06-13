import { afterEach, describe, expect, it, vi } from 'vitest'

// The Input class touches DOM/navigator globals at construction. Stub them so
// these tests can run in the default (node) environment without a DOM.
type Handler = (e: { code: string; preventDefault: () => void }) => void
const handlers: Record<string, Handler[]> = {}

vi.stubGlobal('addEventListener', (type: string, fn: Handler) => {
  ;(handlers[type] ??= []).push(fn)
})

function press(code: string) {
  for (const fn of handlers.keydown ?? []) fn({ code, preventDefault() {} })
}
function release(code: string) {
  for (const fn of handlers.keyup ?? []) fn({ code, preventDefault() {} })
}

afterEach(() => {
  for (const k of Object.keys(handlers)) handlers[k] = []
})

async function freshInput() {
  const mod = await import('../src/engine/input.ts')
  return new mod.Input()
}

describe('input', () => {
  it('reads held keyboard state after poll()', async () => {
    vi.stubGlobal('navigator', { getGamepads: () => [] })
    const input = await freshInput()
    press('ArrowRight')
    input.poll()
    expect(input.state().right).toBe(true)
    release('ArrowRight')
    input.poll()
    expect(input.state().right).toBe(false)
  })

  it('reports jumpHit only on the first frame of a press', async () => {
    vi.stubGlobal('navigator', { getGamepads: () => [] })
    const input = await freshInput()
    press('Space')
    input.poll()
    expect(input.state().jumpHit).toBe(true)
    input.poll() // still held, second frame
    expect(input.state().jump).toBe(true)
    expect(input.state().jumpHit).toBe(false)
  })

  it('survives getGamepads() throwing (embedded-frame SecurityError)', async () => {
    vi.stubGlobal('navigator', {
      getGamepads: () => {
        throw new Error('Access to the feature "gamepad" is disallowed')
      },
    })
    const input = await freshInput()
    press('ArrowLeft')
    expect(() => input.poll()).not.toThrow()
    expect(input.state().left).toBe(true) // keyboard still works
  })
})
