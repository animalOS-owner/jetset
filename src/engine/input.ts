import type { InputState } from '../game/types.ts'

const KEYMAP: Record<string, keyof Held> = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', KeyZ: 'jump',
  Enter: 'confirm',
  Escape: 'pause', KeyP: 'pause',
  Tab: 'map', KeyM: 'map',
  KeyN: 'mute',
}

interface Held {
  left: boolean; right: boolean; up: boolean; down: boolean
  jump: boolean; confirm: boolean; pause: boolean; map: boolean; mute: boolean
}

export class Input {
  private held: Held = {
    left: false, right: false, up: false, down: false,
    jump: false, confirm: false, pause: false, map: false, mute: false,
  }
  private prev: Held = { ...this.held }
  /** held state as of the last poll(), merged with gamepad */
  private cur: Held = { ...this.held }

  constructor() {
    addEventListener('keydown', (e) => {
      const k = KEYMAP[e.code]
      if (k) {
        this.held[k] = true
        e.preventDefault()
      }
    })
    addEventListener('keyup', (e) => {
      const k = KEYMAP[e.code]
      if (k) {
        this.held[k] = false
        e.preventDefault()
      }
    })
    addEventListener('blur', () => {
      for (const k of Object.keys(this.held) as (keyof Held)[]) this.held[k] = false
    })
  }

  /** Call once per logic frame. */
  poll(): void {
    this.prev = this.cur
    const h = { ...this.held }
    // getGamepads() throws a SecurityError in embedded/cross-origin frames
    // (the 'gamepad' permissions policy blocks it). A throw here must never
    // kill input, so swallow it — keyboard still works.
    let pads: (Gamepad | null)[] = []
    try {
      pads = navigator.getGamepads?.() ?? []
    } catch {
      pads = []
    }
    for (const gp of pads) {
      if (!gp) continue
      const ax = gp.axes[0] ?? 0
      const ay = gp.axes[1] ?? 0
      h.left ||= ax < -0.4 || !!gp.buttons[14]?.pressed
      h.right ||= ax > 0.4 || !!gp.buttons[15]?.pressed
      h.up ||= ay < -0.4 || !!gp.buttons[12]?.pressed
      h.down ||= ay > 0.4 || !!gp.buttons[13]?.pressed
      h.jump ||= !!gp.buttons[0]?.pressed
      h.confirm ||= !!gp.buttons[9]?.pressed
      h.pause ||= !!gp.buttons[8]?.pressed
    }
    this.cur = h
  }

  state(): InputState {
    return {
      left: this.cur.left,
      right: this.cur.right,
      up: this.cur.up,
      down: this.cur.down,
      jump: this.cur.jump,
      jumpHit: this.cur.jump && !this.prev.jump,
    }
  }

  hit(k: 'confirm' | 'pause' | 'map' | 'mute' | 'jump' | 'left' | 'right' | 'up' | 'down'): boolean {
    return this.cur[k] && !this.prev[k]
  }
}
