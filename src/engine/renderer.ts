import { VIEW_W, VIEW_H } from '../game/constants.ts'
import { FONT_H, FONT_W, GLYPHS } from './font.ts'

/**
 * Owns the canvas: integer-scales the 512x320 virtual screen to the window
 * and provides pixel-art drawing helpers (sprites, bitmap text).
 */
export class Renderer {
  readonly ctx: CanvasRenderingContext2D
  private glyphCache = new Map<string, HTMLCanvasElement>()

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    this.ctx = ctx
    const fit = () => this.fit()
    addEventListener('resize', fit)
    fit()
  }

  private fit(): void {
    const scale = Math.max(1, Math.min(
      Math.floor(innerWidth / VIEW_W),
      Math.floor(innerHeight / VIEW_H),
    ))
    this.canvas.width = VIEW_W
    this.canvas.height = VIEW_H
    this.canvas.style.width = `${VIEW_W * scale}px`
    this.canvas.style.height = `${VIEW_H * scale}px`
    this.ctx.imageSmoothingEnabled = false
  }

  clear(color: string): void {
    this.ctx.fillStyle = color
    this.ctx.fillRect(0, 0, VIEW_W, VIEW_H)
  }

  /** Draw bitmap text. scale is in virtual pixels per font pixel. */
  text(s: string, x: number, y: number, color: string, scale = 1): void {
    const ctx = this.ctx
    let cx = x
    for (const raw of s.toUpperCase()) {
      const glyph = GLYPHS[raw] ?? GLYPHS['?']
      const key = raw + color
      let img = this.glyphCache.get(key)
      if (!img) {
        img = document.createElement('canvas')
        img.width = FONT_W
        img.height = FONT_H
        const g = img.getContext('2d')!
        g.fillStyle = color
        for (let r = 0; r < FONT_H; r++)
          for (let c = 0; c < FONT_W; c++)
            if (glyph[r][c] === '#') g.fillRect(c, r, 1, 1)
        this.glyphCache.set(key, img)
      }
      ctx.drawImage(img, cx, y, FONT_W * scale, FONT_H * scale)
      cx += (FONT_W + 1) * scale
    }
  }

  textWidth(s: string, scale = 1): number {
    return s.length * (FONT_W + 1) * scale - scale
  }

  textCentered(s: string, cx: number, y: number, color: string, scale = 1): void {
    this.text(s, Math.round(cx - this.textWidth(s, scale) / 2), y, color, scale)
  }
}
