import { STEP_MS } from '../game/constants.ts'

/** Fixed 60Hz logic steps driven by requestAnimationFrame. */
export function startLoop(update: () => void, render: () => void): void {
  let last = performance.now()
  let acc = 0
  let loggedError = false
  const tick = (now: number) => {
    acc += Math.min(now - last, 250) // clamp away tab-switch spirals
    last = now
    // A thrown frame must never permanently freeze the game: log once and
    // keep scheduling, so the loop self-recovers from transient errors.
    try {
      while (acc >= STEP_MS) {
        update()
        acc -= STEP_MS
      }
      render()
    } catch (err) {
      if (!loggedError) {
        loggedError = true
        console.error('jetset: frame error (loop continues)', err)
      }
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}
