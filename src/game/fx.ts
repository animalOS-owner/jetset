// Atmosphere layer for the graphic overhaul: drifting ambient "weather"
// particles per zone, and a dynamic lighting pass (darkness with light pools)
// for the underground / candlelit rooms.

import { ROOM_W, ROOM_H } from './constants.ts'
import type { AmbientKind, ZoneStyle } from '../content/palettes.ts'

const W = ROOM_W
const H = ROOM_H

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

interface AP {
  x: number; y: number; vx: number; vy: number
  life: number; max: number; size: number; seed: number
}

const COUNT: Record<AmbientKind, number> = {
  none: 0, dust: 46, embers: 26, snow: 70, drip: 10,
  spray: 34, pollen: 40, rain: 90,
}

/** Per-zone drifting particle field. Cosmetic, so plain Math.random is fine. */
export class Ambient {
  private kind: AmbientKind = 'none'
  private ps: AP[] = []

  setKind(kind: AmbientKind): void {
    if (kind === this.kind) return
    this.kind = kind
    this.ps = []
    const n = COUNT[kind]
    for (let i = 0; i < n; i++) this.ps.push(this.spawn(true))
  }

  private spawn(seedAnywhere: boolean): AP {
    const seed = Math.random()
    switch (this.kind) {
      case 'dust':
        return { x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.12,
          vy: 0.05 + Math.random() * 0.12, life: 0, max: 0, size: Math.random() < 0.3 ? 2 : 1, seed }
      case 'embers':
        return { x: Math.random() * W, y: seedAnywhere ? Math.random() * H : H + 4, vx: (Math.random() - 0.5) * 0.3,
          vy: -(0.3 + Math.random() * 0.5), life: 0, max: 60 + Math.random() * 60, size: Math.random() < 0.3 ? 2 : 1, seed }
      case 'snow':
        return { x: Math.random() * W, y: seedAnywhere ? Math.random() * H : -4, vx: (Math.random() - 0.5) * 0.3,
          vy: 0.35 + Math.random() * 0.5, life: 0, max: 0, size: Math.random() < 0.4 ? 2 : 1, seed }
      case 'rain':
        return { x: Math.random() * (W + 60) - 30, y: seedAnywhere ? Math.random() * H : -8, vx: 1.1,
          vy: 6 + Math.random() * 2, life: 0, max: 0, size: 1, seed }
      case 'drip':
        return { x: Math.random() * W, y: -4, vx: 0, vy: 2.4 + Math.random() * 1.5,
          life: 0, max: 0, size: 1, seed }
      case 'spray':
        return { x: Math.random() * W, y: H - Math.random() * 40, vx: (Math.random() - 0.3) * 0.6,
          vy: -(0.2 + Math.random() * 0.5), life: 0, max: 40 + Math.random() * 50, size: 1, seed }
      case 'pollen':
        return { x: Math.random() * W, y: seedAnywhere ? Math.random() * H : H + 4, vx: (Math.random() - 0.5) * 0.25,
          vy: -(0.1 + Math.random() * 0.2), life: 0, max: 120 + Math.random() * 80, size: Math.random() < 0.25 ? 2 : 1, seed }
      default:
        return { x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, seed }
    }
  }

  update(t: number): void {
    if (this.kind === 'none') return
    for (let i = 0; i < this.ps.length; i++) {
      const p = this.ps[i]
      p.x += p.vx
      p.y += p.vy
      p.life++
      // gentle sway for slow drifters
      if (this.kind === 'dust' || this.kind === 'pollen' || this.kind === 'snow')
        p.x += Math.sin(t * 0.04 + p.seed * 9) * 0.18
      const dead =
        p.y > H + 6 || p.y < -8 || p.x < -34 || p.x > W + 34 ||
        (p.max > 0 && p.life > p.max)
      if (dead) this.ps[i] = this.spawn(false)
    }
  }

  draw(ctx: CanvasRenderingContext2D, z: ZoneStyle, t: number): void {
    if (this.kind === 'none') return
    ctx.save()
    switch (this.kind) {
      case 'dust':
        for (const p of this.ps) {
          ctx.fillStyle = rgba(z.light, 0.18 + 0.14 * Math.sin(t * 0.05 + p.seed * 7))
          ctx.fillRect(p.x | 0, p.y | 0, p.size, p.size)
        }
        break
      case 'pollen':
        ctx.globalCompositeOperation = 'lighter'
        for (const p of this.ps) {
          ctx.fillStyle = rgba('#eaffc0', 0.5)
          ctx.fillRect(p.x | 0, p.y | 0, p.size, p.size)
        }
        break
      case 'embers':
        ctx.globalCompositeOperation = 'lighter'
        for (const p of this.ps) {
          const f = p.max ? 1 - p.life / p.max : 1
          ctx.fillStyle = rgba(Math.sin(t * 0.3 + p.seed * 5) > 0 ? '#ffb24a' : '#ff7a2a', 0.7 * f)
          ctx.fillRect(p.x | 0, p.y | 0, p.size, p.size)
        }
        break
      case 'snow':
        for (const p of this.ps) {
          ctx.fillStyle = rgba('#f4f8ff', 0.8)
          ctx.fillRect(p.x | 0, p.y | 0, p.size, p.size)
        }
        break
      case 'rain':
        ctx.strokeStyle = 'rgba(180,200,235,0.4)'
        ctx.lineWidth = 1
        ctx.beginPath()
        for (const p of this.ps) {
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(p.x - 2, p.y - 7)
        }
        ctx.stroke()
        break
      case 'drip':
        ctx.fillStyle = rgba(z.water, 0.7)
        for (const p of this.ps) ctx.fillRect(p.x | 0, p.y | 0, 1, 3)
        break
      case 'spray':
        for (const p of this.ps) {
          const f = p.max ? 1 - p.life / p.max : 1
          ctx.fillStyle = rgba('#eaf6ff', 0.5 * f)
          ctx.fillRect(p.x | 0, p.y | 0, p.size, p.size)
        }
        break
    }
    ctx.restore()
  }
}

export interface LightSource {
  x: number
  y: number
  r: number
  color: string
  /** 0..1 strength of the hole punched in the darkness. */
  cut?: number
  /** 0..1 strength of the additive colored glow. */
  glow?: number
}

/** Darkness overlay with light pools, plus additive colored glow. */
export class Lighting {
  private buf: HTMLCanvasElement
  private g: CanvasRenderingContext2D

  constructor() {
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    this.buf = c
    this.g = c.getContext('2d')!
  }

  render(ctx: CanvasRenderingContext2D, z: ZoneStyle, lights: LightSource[]): void {
    if (z.dark < 0.08) return
    const g = this.g
    g.globalCompositeOperation = 'source-over'
    g.clearRect(0, 0, W, H)
    g.fillStyle = rgba(z.shadow, z.dark)
    g.fillRect(0, 0, W, H)

    // punch light holes
    g.globalCompositeOperation = 'destination-out'
    for (const l of lights) {
      const cut = l.cut ?? 1
      const grad = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r)
      grad.addColorStop(0, `rgba(255,255,255,${cut})`)
      grad.addColorStop(0.6, `rgba(255,255,255,${cut * 0.5})`)
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = grad
      g.beginPath()
      g.arc(l.x, l.y, l.r, 0, 7)
      g.fill()
    }
    g.globalCompositeOperation = 'source-over'
    ctx.drawImage(this.buf, 0, 0)

    // warm/cool colored glow on top of the lit scene
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (const l of lights) {
      const glow = l.glow
      if (!glow) continue
      const grad = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r * 0.85)
      grad.addColorStop(0, rgba(l.color, glow))
      grad.addColorStop(1, rgba(l.color, 0))
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(l.x, l.y, l.r * 0.85, 0, 7)
      ctx.fill()
    }
    ctx.restore()
  }
}
