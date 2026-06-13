/**
 * Pixel-art sprites are authored as arrays of strings; each character indexes
 * a small palette ('.' = transparent). Built once at boot into canvases.
 */
export type PixelMap = string[]
export type Palette = Record<string, string>

export function makeSprite(map: PixelMap, pal: Palette, flipX = false): HTMLCanvasElement {
  const h = map.length
  const w = map[0].length
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const g = cv.getContext('2d')!
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const ch = map[r][c]
      if (ch === '.' || ch === ' ') continue
      const color = pal[ch]
      if (!color) continue
      g.fillStyle = color
      g.fillRect(flipX ? w - 1 - c : c, r, 1, 1)
    }
  }
  return cv
}

/** Lighten/darken a #rrggbb color by f (-1..1). */
export function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) =>
    Math.max(0, Math.min(255, Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f))))
  const r = ch((n >> 16) & 255)
  const g = ch((n >> 8) & 255)
  const b = ch(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
