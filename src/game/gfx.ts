import { CELL, ROOM_W, ROOM_H } from './constants.ts'
import { makeSprite, shade, type Palette, type PixelMap } from '../engine/sprites.ts'
import { ZONES, type DecoKind, type ZoneStyle } from '../content/palettes.ts'
import {
  WILLY_FRAMES, WILLY_PAL, SUIT_FRAMES, DRESS_FRAMES, HUMANOID_PALETTES,
  GHOST_FRAMES, GHOST_PAL, SMALL_FRAMES, SMALL_PALETTES,
} from '../content/art/pixelmaps.ts'

type CV = HTMLCanvasElement

function cv(w: number, h: number): [CV, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!]
}

/** Deterministic 2D hash for texture variation. */
const hash = (x: number, y: number) => {
  let n = x * 374761393 + y * 668265263
  n = (n ^ (n >> 13)) * 1274126177
  return ((n ^ (n >> 16)) >>> 0) / 4294967295
}

// ------------------------------------------------------------ wall tiles ---
function paintWall(z: ZoneStyle): CV {
  const [c, g] = cv(CELL, CELL)
  const base = z.wall
  const lite = shade(base, 0.25)
  const dark = shade(base, -0.35)
  g.fillStyle = base
  g.fillRect(0, 0, CELL, CELL)
  switch (z.wallStyle) {
    case 'brick': {
      g.fillStyle = dark
      for (let y = 3; y < CELL; y += 4) g.fillRect(0, y, CELL, 1)
      for (let row = 0; row < 4; row++) {
        const off = row % 2 ? 4 : 0
        for (let x = off; x < CELL; x += 8) g.fillRect(x, row * 4, 1, 3)
      }
      g.fillStyle = lite
      for (let row = 0; row < 4; row++)
        for (let x = (row % 2 ? 5 : 1); x < CELL; x += 8)
          g.fillRect(x, row * 4, 3, 1)
      break
    }
    case 'stone': {
      for (let y = 0; y < CELL; y += 8)
        for (let x = 0; x < CELL; x += 8) {
          const f = hash(x * 7, y * 11)
          g.fillStyle = shade(base, (f - 0.5) * 0.3)
          g.fillRect(x, y, 8, 8)
          g.fillStyle = dark
          g.fillRect(x, y + 7, 8, 1)
          g.fillRect(x + 7, y, 1, 8)
          g.fillStyle = lite
          g.fillRect(x, y, 8, 1)
        }
      break
    }
    case 'planks': {
      for (let y = 0; y < CELL; y += 5) {
        g.fillStyle = shade(base, (hash(3, y) - 0.5) * 0.25)
        g.fillRect(0, y, CELL, 5)
        g.fillStyle = dark
        g.fillRect(0, y + 4, CELL, 1)
        g.fillRect(Math.floor(hash(y, 9) * CELL), y, 1, 4)
      }
      break
    }
    case 'panel': {
      g.fillStyle = lite
      g.fillRect(0, 0, CELL, 1)
      g.fillRect(0, 0, 1, CELL)
      g.fillStyle = dark
      g.fillRect(0, 15, CELL, 1)
      g.fillRect(15, 0, 1, CELL)
      g.fillStyle = shade(base, -0.12)
      g.fillRect(3, 3, 10, 10)
      g.fillStyle = lite
      g.fillRect(3, 3, 10, 1)
      break
    }
    case 'rock': {
      for (let y = 0; y < CELL; y++)
        for (let x = 0; x < CELL; x++) {
          const f = hash(x, y)
          if (f > 0.82) {
            g.fillStyle = lite
            g.fillRect(x, y, 1, 1)
          } else if (f < 0.18) {
            g.fillStyle = dark
            g.fillRect(x, y, 1, 1)
          }
        }
      break
    }
    case 'slate': {
      for (let y = 0; y < CELL; y += 4) {
        const off = (y / 4) % 2 ? 5 : 0
        g.fillStyle = shade(base, (hash(1, y) - 0.5) * 0.2)
        g.fillRect(0, y, CELL, 4)
        g.fillStyle = dark
        g.fillRect(0, y + 3, CELL, 1)
        for (let x = off; x < CELL; x += 10) g.fillRect(x, y, 1, 3)
      }
      break
    }
    case 'timber': {
      g.fillStyle = shade('#e8dcc8', -0.05)
      g.fillRect(0, 0, CELL, CELL)
      g.fillStyle = base
      g.fillRect(0, 0, 3, CELL)
      g.fillRect(13, 0, 3, CELL)
      g.fillRect(0, 0, CELL, 2)
      for (let i = 0; i < CELL; i++) g.fillRect(3 + Math.floor(i * 0.6), i, 2, 1)
      break
    }
    case 'tile': {
      for (let y = 0; y < CELL; y += 8)
        for (let x = 0; x < CELL; x += 8) {
          g.fillStyle = (x + y) % 16 === 0 ? base : shade(base, -0.15)
          g.fillRect(x, y, 8, 8)
          g.fillStyle = lite
          g.fillRect(x, y, 8, 1)
          g.fillStyle = dark
          g.fillRect(x, y + 7, 8, 1)
        }
      break
    }
  }
  return c
}

function paintRamp(z: ZoneStyle, up: boolean): CV {
  const [c, g] = cv(CELL, CELL)
  const wall = paintWall(z)
  g.save()
  g.beginPath()
  if (up) {
    g.moveTo(0, CELL)
    g.lineTo(CELL, 0)
    g.lineTo(CELL, CELL)
  } else {
    g.moveTo(0, 0)
    g.lineTo(CELL, CELL)
    g.lineTo(0, CELL)
  }
  g.closePath()
  g.clip()
  g.drawImage(wall, 0, 0)
  g.restore()
  g.strokeStyle = shade(z.wall, 0.35)
  g.beginPath()
  if (up) {
    g.moveTo(0, CELL - 0.5)
    g.lineTo(CELL, -0.5)
  } else {
    g.moveTo(0, 0.5)
    g.lineTo(CELL, CELL + 0.5)
  }
  g.stroke()
  return c
}

function paintPlatform(z: ZoneStyle): CV {
  const [c, g] = cv(CELL, CELL)
  g.fillStyle = z.platform
  g.fillRect(0, 0, CELL, 6)
  g.fillStyle = shade(z.platform, 0.35)
  g.fillRect(0, 0, CELL, 1)
  g.fillStyle = shade(z.platform, -0.35)
  g.fillRect(0, 5, CELL, 1)
  g.fillRect(3, 1, 1, 4)
  g.fillRect(11, 1, 1, 4)
  return c
}

function paintConveyor(z: ZoneStyle, dir: -1 | 1, frame: number): CV {
  const [c, g] = cv(CELL, CELL)
  const base = shade(z.platform, -0.2)
  g.fillStyle = base
  g.fillRect(0, 0, CELL, 6)
  g.fillStyle = shade(base, 0.4)
  const off = dir > 0 ? frame : 3 - frame
  for (let x = -4 + off; x < CELL; x += 4) {
    g.fillRect(x + (dir > 0 ? 0 : 1), 1, 2, 1)
    g.fillRect(x + 1, 2, 2, 2)
    g.fillRect(x + (dir > 0 ? 2 : 0), 4, 2, 1)
  }
  g.fillStyle = shade(base, -0.4)
  g.fillRect(0, 5, CELL, 1)
  g.fillRect(0, 0, CELL, 1)
  return c
}

function paintHazard(z: ZoneStyle, frame: number): CV {
  const [c, g] = cv(CELL, CELL)
  const col = z.hazardColor
  switch (z.hazard) {
    case 'spikes': {
      g.fillStyle = shade(col, -0.3)
      for (const bx of [0, 5, 10]) {
        g.beginPath()
        g.moveTo(bx + 0.5, CELL)
        g.lineTo(bx + 3, frame ? 4 : 3)
        g.lineTo(bx + 5.5, CELL)
        g.closePath()
        g.fill()
      }
      g.fillStyle = col
      for (const bx of [1, 6, 11]) g.fillRect(bx + 1, 7 - frame, 1, 8)
      break
    }
    case 'fire': {
      g.fillStyle = '#7a2a10'
      g.fillRect(2, 13, 12, 3)
      g.fillStyle = shade(col, -0.15)
      g.beginPath()
      g.moveTo(3, 13)
      g.quadraticCurveTo(frame ? 2 : 6, 6, 8, frame ? 1 : 3)
      g.quadraticCurveTo(frame ? 13 : 10, 7, 13, 13)
      g.closePath()
      g.fill()
      g.fillStyle = '#ffe084'
      g.beginPath()
      g.moveTo(6, 13)
      g.quadraticCurveTo(8, frame ? 6 : 8, frame ? 10 : 7, 13)
      g.closePath()
      g.fill()
      break
    }
    case 'plant': {
      g.fillStyle = '#2a5a20'
      g.fillRect(7, 6, 2, 10)
      g.fillStyle = col
      g.beginPath()
      g.ellipse(4, 10 + frame, 4, 2, -0.5, 0, 7)
      g.fill()
      g.beginPath()
      g.ellipse(12, 9 - frame, 4, 2, 0.5, 0, 7)
      g.fill()
      g.fillStyle = '#d8385a'
      g.beginPath()
      g.ellipse(8, 4 - frame, 3, 4, 0, 0, 7)
      g.fill()
      g.fillStyle = '#fff0a0'
      g.fillRect(7, 3 - frame, 2, 2)
      break
    }
    case 'shard': {
      g.fillStyle = shade(col, -0.25)
      for (const [bx, h] of [[1, 9], [6, 13], [11, 7]] as const) {
        g.beginPath()
        g.moveTo(bx, CELL)
        g.lineTo(bx + 2, CELL - h)
        g.lineTo(bx + 4, CELL)
        g.closePath()
        g.fill()
      }
      g.fillStyle = frame ? '#ffffff' : shade(col, 0.3)
      g.fillRect(7, 4, 1, 4)
      break
    }
    case 'sludge': {
      g.fillStyle = shade(col, -0.4)
      g.fillRect(0, 6, CELL, 10)
      g.fillStyle = col
      g.fillRect(0, 5, CELL, 3)
      g.fillStyle = shade(col, 0.3)
      for (const bx of frame ? [3, 12] : [7]) {
        g.beginPath()
        g.arc(bx, 6, 1.5, 0, 7)
        g.fill()
      }
      break
    }
  }
  return c
}

function paintWater(z: ZoneStyle, frame: number): CV {
  const [c, g] = cv(CELL, CELL)
  g.fillStyle = z.water
  g.fillRect(0, 3, CELL, 13)
  g.fillStyle = shade(z.water, 0.35)
  for (let x = 0; x < CELL; x += 8) {
    g.fillRect(x + (frame ? 4 : 0), 3, 4, 1)
    g.fillRect(x + (frame ? 0 : 4), 4, 4, 1)
  }
  return c
}

// ------------------------------------------------------------ decorations ---
function paintDeco(kind: DecoKind, frame: number): CV {
  const [c, g] = cv(CELL, CELL)
  const F = frame
  switch (kind) {
    case 'barrel':
      g.fillStyle = '#7a5228'
      g.fillRect(3, 2, 10, 14)
      g.fillStyle = '#8f6534'
      g.fillRect(4, 2, 8, 14)
      g.fillStyle = '#4a3018'
      g.fillRect(3, 4, 10, 1)
      g.fillRect(3, 12, 10, 1)
      g.fillStyle = '#a87a44'
      g.fillRect(5, 3, 1, 13)
      break
    case 'portrait':
      g.fillStyle = '#caa030'
      g.fillRect(2, 1, 12, 15)
      g.fillStyle = '#3a3048'
      g.fillRect(4, 3, 8, 11)
      g.fillStyle = '#e0ae84'
      g.fillRect(6, 5, 4, 4)
      g.fillStyle = '#2a2438'
      g.fillRect(6, 9, 4, 3)
      g.fillStyle = '#16141c'
      g.fillRect(7, 6, 1, 1)
      g.fillRect(9, 6, 1, 1)
      break
    case 'bookshelf':
      g.fillStyle = '#5a3a20'
      g.fillRect(1, 0, 14, 16)
      for (let s = 0; s < 3; s++) {
        let x = 2
        while (x < 13) {
          const w = 1 + Math.floor(hash(x, s) * 2)
          g.fillStyle = ['#a83a3a', '#3a6a9a', '#3a8a4a', '#caa030'][
            Math.floor(hash(s, x) * 4)
          ]
          g.fillRect(x, s * 5 + 1, w, 4)
          x += w + 1
        }
        g.fillStyle = '#3a2412'
        g.fillRect(1, s * 5 + 5, 14, 1)
      }
      break
    case 'torch':
      g.fillStyle = '#5a4a3a'
      g.fillRect(7, 8, 2, 6)
      g.fillRect(5, 13, 6, 2)
      g.fillStyle = F ? '#f0a03a' : '#e8762a'
      g.beginPath()
      g.moveTo(5, 8)
      g.quadraticCurveTo(8, F ? -1 : 2, 11, 8)
      g.closePath()
      g.fill()
      g.fillStyle = '#ffe084'
      g.fillRect(7, F ? 4 : 5, 2, 3)
      break
    case 'window':
      g.fillStyle = '#202838'
      g.fillRect(3, 1, 10, 14)
      g.fillStyle = '#9ab8e8'
      g.fillRect(4, 2, 8, 12)
      g.fillStyle = '#c8dcf8'
      g.fillRect(5, 3, 2, 4)
      g.fillStyle = '#202838'
      g.fillRect(7, 2, 1, 12)
      g.fillRect(4, 8, 8, 1)
      break
    case 'clock':
      g.fillStyle = '#6a4a28'
      g.fillRect(4, 0, 8, 16)
      g.fillStyle = '#e8dcc0'
      g.beginPath()
      g.arc(8, 4, 3, 0, 7)
      g.fill()
      g.strokeStyle = '#202020'
      g.beginPath()
      g.moveTo(8, 4)
      g.lineTo(8 + (F ? 2 : 0), 4 - (F ? 0 : 2))
      g.stroke()
      g.fillStyle = '#caa030'
      g.beginPath()
      g.arc(8, 11 + (F ? 1 : -1), 2, 0, 7)
      g.fill()
      g.fillStyle = '#4a3018'
      g.fillRect(7, 8, 2, 3)
      break
    case 'fern':
      g.fillStyle = '#a8542a'
      g.fillRect(5, 12, 6, 4)
      g.fillStyle = '#3a8a3a'
      for (const [dx, dy] of [[-3, -4], [0, -6], [3, -4], [-2, -1], [2, -1]]) {
        g.beginPath()
        g.ellipse(8 + dx, 10 + dy, 2, 4, dx * 0.2, 0, 7)
        g.fill()
      }
      break
    case 'anchor':
      g.fillStyle = '#46505e'
      g.fillRect(7, 1, 2, 12)
      g.fillRect(4, 3, 8, 2)
      g.beginPath()
      g.arc(8, 11, 5, 0.3, Math.PI - 0.3)
      g.lineWidth = 2
      g.strokeStyle = '#46505e'
      g.stroke()
      break
    case 'shell':
      g.fillStyle = '#e8c8b0'
      g.beginPath()
      g.arc(8, 12, 6, Math.PI, 0)
      g.fill()
      g.strokeStyle = '#c89878'
      for (const a of [-0.6, -0.2, 0.2, 0.6]) {
        g.beginPath()
        g.moveTo(8, 12)
        g.lineTo(8 + Math.sin(a) * 6, 12 - Math.cos(a) * 6)
        g.stroke()
      }
      break
    case 'chimney':
      g.fillStyle = '#8a4a3a'
      g.fillRect(3, 4, 10, 12)
      g.fillStyle = '#a85a46'
      for (let y = 5; y < 16; y += 3) g.fillRect(3, y, 10, 1)
      g.fillStyle = '#5a3a30'
      g.fillRect(2, 2, 12, 3)
      g.fillStyle = '#888894'
      if (F) {
        g.beginPath()
        g.arc(8, 0, 2, 0, 7)
        g.fill()
      }
      break
    case 'lamp':
      g.fillStyle = '#2a2a32'
      g.fillRect(7, 6, 2, 10)
      g.fillRect(5, 15, 6, 1)
      g.fillStyle = F ? '#ffe8a0' : '#f0d080'
      g.fillRect(5, 1, 6, 5)
      g.fillStyle = '#2a2a32'
      g.fillRect(5, 0, 6, 1)
      g.fillRect(5, 6, 6, 1)
      break
    case 'cobweb':
      g.strokeStyle = 'rgba(220,228,240,0.5)'
      for (const [x2, y2] of [[16, 6], [12, 12], [6, 16]]) {
        g.beginPath()
        g.moveTo(0, 0)
        g.lineTo(x2, y2)
        g.stroke()
      }
      g.beginPath()
      g.arc(0, 0, 8, 0, Math.PI / 2)
      g.stroke()
      g.beginPath()
      g.arc(0, 0, 13, 0, Math.PI / 2)
      g.stroke()
      break
    case 'crate':
      g.fillStyle = '#9a7a4a'
      g.fillRect(2, 4, 12, 12)
      g.strokeStyle = '#6a4a24'
      g.strokeRect(2.5, 4.5, 11, 11)
      g.beginPath()
      g.moveTo(2, 4)
      g.lineTo(14, 16)
      g.moveTo(14, 4)
      g.lineTo(2, 16)
      g.stroke()
      break
    case 'armour':
      g.fillStyle = '#8a94a8'
      g.fillRect(5, 1, 6, 5)
      g.fillStyle = '#6a7488'
      g.fillRect(4, 6, 8, 6)
      g.fillRect(5, 12, 2, 4)
      g.fillRect(9, 12, 2, 4)
      g.fillStyle = '#2a2a34'
      g.fillRect(6, 3, 4, 1)
      g.fillStyle = '#c8323a'
      g.fillRect(7, 0, 2, 1)
      break
    case 'pipe':
      g.fillStyle = '#3a7a4a'
      g.fillRect(0, 5, 16, 6)
      g.fillStyle = '#5aa46a'
      g.fillRect(0, 6, 16, 2)
      g.fillStyle = '#2a5a36'
      g.fillRect(0, 10, 16, 1)
      g.fillRect(11, 4, 3, 8)
      g.fillStyle = '#caa030'
      g.fillRect(12, 2 - (F ? 1 : 0), 1, 3)
      break
    case 'candle':
      g.fillStyle = '#caa030'
      g.fillRect(3, 12, 10, 2)
      g.fillRect(7, 8, 2, 5)
      for (const bx of [3, 7, 11]) {
        g.fillStyle = '#e8e0d0'
        g.fillRect(bx, 6, 2, 6)
        g.fillStyle = F ? '#ffd860' : '#f0a03a'
        g.fillRect(bx, 3 + (F ? 0 : 1), 2, 3)
      }
      break
  }
  return c
}

// ------------------------------------------------------ procedural sprites ---
function paintSmallProc(type: string, frame: number): CV {
  const [c, g] = cv(16, 16)
  switch (type) {
    case 'slime': {
      g.fillStyle = '#5aa83a'
      const h = frame ? 7 : 9
      g.beginPath()
      g.ellipse(8, 16 - h / 2, frame ? 7 : 5.5, h / 2, 0, 0, 7)
      g.fill()
      g.fillStyle = '#1a1a20'
      g.fillRect(5, 16 - h + 2, 2, 2)
      g.fillRect(9, 16 - h + 2, 2, 2)
      break
    }
    case 'knife': {
      g.translate(8, 8)
      g.rotate(frame ? Math.PI / 2 : 0)
      g.fillStyle = '#d8dee8'
      g.beginPath()
      g.moveTo(0, -7)
      g.lineTo(2, 1)
      g.lineTo(-2, 1)
      g.closePath()
      g.fill()
      g.fillStyle = '#8a5a2a'
      g.fillRect(-1, 1, 2, 5)
      break
    }
    case 'flame': {
      g.fillStyle = frame ? '#f0a03a' : '#e8762a'
      g.beginPath()
      g.moveTo(4, 14)
      g.quadraticCurveTo(frame ? 2 : 6, 4, 8, frame ? 1 : 3)
      g.quadraticCurveTo(frame ? 14 : 10, 5, 12, 14)
      g.closePath()
      g.fill()
      g.fillStyle = '#ffe084'
      g.beginPath()
      g.ellipse(8, 12, 2, 3, 0, 0, 7)
      g.fill()
      g.fillStyle = '#1a1a20'
      g.fillRect(6, 8, 1, 2)
      g.fillRect(9, 8, 1, 2)
      break
    }
    case 'orb': {
      const r = frame ? 6 : 5
      const grad = g.createRadialGradient(8, 8, 1, 8, 8, r)
      grad.addColorStop(0, '#ffffff')
      grad.addColorStop(0.5, '#7ae0f0')
      grad.addColorStop(1, 'rgba(60,120,200,0.15)')
      g.fillStyle = grad
      g.beginPath()
      g.arc(8, 8, r, 0, 7)
      g.fill()
      break
    }
  }
  return c
}

function paintBed(): CV {
  const [c, g] = cv(32, 16)
  g.fillStyle = '#6a4a28'
  g.fillRect(0, 0, 3, 16)
  g.fillRect(29, 6, 3, 10)
  g.fillStyle = '#e8e4da'
  g.fillRect(3, 7, 26, 4)
  g.fillStyle = '#ffffff'
  g.fillRect(4, 5, 7, 4)
  g.fillStyle = '#a8323a'
  g.fillRect(12, 7, 17, 4)
  g.fillStyle = '#7a2028'
  g.fillRect(12, 10, 17, 1)
  g.fillStyle = '#4a3018'
  g.fillRect(3, 11, 26, 2)
  g.fillRect(4, 13, 2, 3)
  g.fillRect(26, 13, 2, 3)
  return c
}

// ------------------------------------------------------------ sprite bank ---
export interface ZoneTiles {
  wall: CV
  rampUp: CV
  rampDown: CV
  platform: CV
  convL: CV[]
  convR: CV[]
  hazard: CV[]
  water: CV[]
  deco: CV[][] // [A,B,C][frame]
  bg: CV
}

export interface Bank {
  willyR: CV[]
  willyL: CV[]
  guard: Record<string, { R: CV[]; L: CV[] }>
  zones: Record<string, ZoneTiles>
  bed: CV
  vignette: CV
}

function paintBg(z: ZoneStyle): CV {
  const [c, g] = cv(ROOM_W, ROOM_H)
  const grad = g.createLinearGradient(0, 0, 0, ROOM_H)
  grad.addColorStop(0, z.sky[0])
  grad.addColorStop(1, z.sky[1])
  g.fillStyle = grad
  g.fillRect(0, 0, ROOM_W, ROOM_H)
  return c
}

function paintVignette(): CV {
  const [c, g] = cv(ROOM_W, ROOM_H)
  const grad = g.createRadialGradient(
    ROOM_W / 2, ROOM_H / 2, ROOM_H * 0.55,
    ROOM_W / 2, ROOM_H / 2, ROOM_W * 0.75,
  )
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(1, 'rgba(0,0,0,0.35)')
  g.fillStyle = grad
  g.fillRect(0, 0, ROOM_W, ROOM_H)
  return c
}

function frames(maps: PixelMap[], pal: Palette): { R: CV[]; L: CV[] } {
  return {
    R: maps.map((m) => makeSprite(m, pal)),
    L: maps.map((m) => makeSprite(m, pal, true)),
  }
}

export function buildBank(): Bank {
  const guard: Bank['guard'] = {}
  for (const type of ['butler', 'chef', 'gardener', 'sweep', 'knight'])
    guard[type] = frames(SUIT_FRAMES, HUMANOID_PALETTES[type])
  for (const type of ['maid', 'maria'])
    guard[type] = frames(DRESS_FRAMES, HUMANOID_PALETTES[type])
  guard.ghost = frames(GHOST_FRAMES, GHOST_PAL)
  for (const [type, maps] of Object.entries(SMALL_FRAMES))
    guard[type] = frames(maps, SMALL_PALETTES[type])
  for (const type of ['slime', 'knife', 'flame', 'orb'])
    guard[type] = {
      R: [paintSmallProc(type, 0), paintSmallProc(type, 1)],
      L: [paintSmallProc(type, 0), paintSmallProc(type, 1)],
    }

  const zones: Bank['zones'] = {}
  for (const [name, z] of Object.entries(ZONES)) {
    zones[name] = {
      wall: paintWall(z),
      rampUp: paintRamp(z, true),
      rampDown: paintRamp(z, false),
      platform: paintPlatform(z),
      convL: [0, 1, 2, 3].map((f) => paintConveyor(z, -1, f)),
      convR: [0, 1, 2, 3].map((f) => paintConveyor(z, 1, f)),
      hazard: [paintHazard(z, 0), paintHazard(z, 1)],
      water: [paintWater(z, 0), paintWater(z, 1)],
      deco: z.deco.map((k) => [paintDeco(k, 0), paintDeco(k, 1)]),
      bg: paintBg(z),
    }
  }

  return {
    willyR: WILLY_FRAMES.map((m) => makeSprite(m, WILLY_PAL)),
    willyL: WILLY_FRAMES.map((m) => makeSprite(m, WILLY_PAL, true)),
    guard,
    zones,
    bed: paintBed(),
    vignette: paintVignette(),
  }
}
