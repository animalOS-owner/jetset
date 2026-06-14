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

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
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
      g.fillStyle = shade(base, 0.12)
      g.fillRect(3, 3, 1, 10)
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
  // unifying depth: a faint top sheen and a grounded bottom shade on every wall
  g.fillStyle = rgba('#ffffff', 0.05)
  g.fillRect(0, 0, CELL, 1)
  g.fillStyle = rgba('#000000', 0.16)
  g.fillRect(0, CELL - 1, CELL, 1)
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
  // bright leading edge + a soft shadow just under it for a carved-step feel
  g.strokeStyle = shade(z.wall, 0.45)
  g.lineWidth = 1
  g.beginPath()
  if (up) {
    g.moveTo(0, CELL - 0.5)
    g.lineTo(CELL, -0.5)
  } else {
    g.moveTo(0, 0.5)
    g.lineTo(CELL, CELL + 0.5)
  }
  g.stroke()
  g.strokeStyle = rgba('#000000', 0.25)
  g.beginPath()
  if (up) {
    g.moveTo(0, CELL + 0.5)
    g.lineTo(CELL, 0.5)
  } else {
    g.moveTo(0, 1.5)
    g.lineTo(CELL, CELL + 1.5)
  }
  g.stroke()
  return c
}

function paintPlatform(z: ZoneStyle): CV {
  const [c, g] = cv(CELL, CELL)
  const base = z.platform
  // body
  g.fillStyle = base
  g.fillRect(0, 0, CELL, 6)
  // bright top, dark underside lip, end caps
  g.fillStyle = shade(base, 0.42)
  g.fillRect(0, 0, CELL, 1)
  g.fillStyle = shade(base, 0.18)
  g.fillRect(0, 1, CELL, 1)
  g.fillStyle = shade(base, -0.4)
  g.fillRect(0, 5, CELL, 1)
  g.fillStyle = shade(base, -0.55)
  g.fillRect(0, 6, CELL, 1)
  // grain / bolts
  g.fillStyle = shade(base, -0.3)
  g.fillRect(3, 2, 1, 3)
  g.fillRect(11, 2, 1, 3)
  g.fillStyle = shade(base, 0.25)
  g.fillRect(7, 2, 1, 2)
  return c
}

function paintConveyor(z: ZoneStyle, dir: -1 | 1, frame: number): CV {
  const [c, g] = cv(CELL, CELL)
  const base = shade(z.platform, -0.18)
  g.fillStyle = base
  g.fillRect(0, 0, CELL, 6)
  g.fillStyle = shade(base, -0.45)
  g.fillRect(0, 6, CELL, 1)
  // rollers at the ends
  g.fillStyle = shade(base, 0.3)
  g.fillRect(0, 1, 2, 4)
  g.fillRect(CELL - 2, 1, 2, 4)
  // moving chevrons
  g.fillStyle = shade(base, 0.5)
  const off = dir > 0 ? frame : 3 - frame
  for (let x = -4 + off; x < CELL; x += 4) {
    g.fillRect(x + (dir > 0 ? 0 : 1), 1, 2, 1)
    g.fillRect(x + 1, 2, 2, 2)
    g.fillRect(x + (dir > 0 ? 2 : 0), 4, 2, 1)
  }
  g.fillStyle = shade(base, 0.6)
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
      // metallic glint on each tip
      g.fillStyle = '#ffffff'
      for (const bx of [0, 5, 10]) g.fillRect(bx + 3, (frame ? 5 : 4), 1, 2)
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
      g.fillStyle = '#fffce0'
      g.fillRect(7, frame ? 9 : 10, 2, 3)
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
      // fang
      g.fillStyle = '#ffffff'
      g.fillRect(7, 6 - frame, 1, 1)
      g.fillRect(9, 6 - frame, 1, 1)
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
      g.fillStyle = shade(col, 0.35)
      for (const [bx, h] of [[1, 9], [6, 13], [11, 7]] as const) {
        g.fillRect(bx + 1, CELL - h + 1, 1, h - 1)
      }
      g.fillStyle = frame ? '#ffffff' : shade(col, 0.5)
      g.fillRect(7, 4, 1, 3)
      break
    }
    case 'sludge': {
      g.fillStyle = shade(col, -0.4)
      g.fillRect(0, 6, CELL, 10)
      g.fillStyle = col
      g.fillRect(0, 5, CELL, 3)
      g.fillStyle = shade(col, 0.35)
      g.fillRect(0, 5, CELL, 1)
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
  const grad = g.createLinearGradient(0, 3, 0, CELL)
  grad.addColorStop(0, shade(z.water, 0.18))
  grad.addColorStop(1, shade(z.water, -0.3))
  g.fillStyle = grad
  g.fillRect(0, 3, CELL, 13)
  g.fillStyle = shade(z.water, 0.45)
  for (let x = 0; x < CELL; x += 8) {
    g.fillRect(x + (frame ? 4 : 0), 3, 4, 1)
    g.fillRect(x + (frame ? 0 : 4), 4, 4, 1)
  }
  // glints
  g.fillStyle = rgba('#ffffff', 0.4)
  g.fillRect(frame ? 2 : 10, 6, 2, 1)
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
      g.fillStyle = rgba('#ffe0a0', 0.3)
      g.fillRect(7, 3, 1, 13)
      break
    case 'portrait':
      g.fillStyle = '#caa030'
      g.fillRect(2, 1, 12, 15)
      g.fillStyle = '#e0c050'
      g.fillRect(2, 1, 12, 1)
      g.fillRect(2, 1, 1, 15)
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
      g.fillStyle = '#3a2a1e'
      g.fillRect(5, 14, 6, 1)
      g.fillStyle = F ? '#f0a03a' : '#e8762a'
      g.beginPath()
      g.moveTo(5, 8)
      g.quadraticCurveTo(8, F ? -1 : 2, 11, 8)
      g.closePath()
      g.fill()
      g.fillStyle = '#ffe084'
      g.fillRect(7, F ? 4 : 5, 2, 3)
      g.fillStyle = '#fffce0'
      g.fillRect(7, F ? 5 : 6, 1, 1)
      break
    case 'window':
      g.fillStyle = '#202838'
      g.fillRect(3, 1, 10, 14)
      g.fillStyle = '#9ab8e8'
      g.fillRect(4, 2, 8, 12)
      g.fillStyle = '#c8dcf8'
      g.fillRect(5, 3, 2, 4)
      g.fillStyle = '#e8f2ff'
      g.fillRect(5, 3, 1, 2)
      g.fillStyle = '#202838'
      g.fillRect(7, 2, 1, 12)
      g.fillRect(4, 8, 8, 1)
      break
    case 'clock':
      g.fillStyle = '#6a4a28'
      g.fillRect(4, 0, 8, 16)
      g.fillStyle = '#3a2614'
      g.fillRect(4, 0, 8, 1)
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
      g.fillStyle = '#7a3a1e'
      g.fillRect(5, 12, 6, 1)
      g.fillStyle = '#3a8a3a'
      for (const [dx, dy] of [[-3, -4], [0, -6], [3, -4], [-2, -1], [2, -1]]) {
        g.beginPath()
        g.ellipse(8 + dx, 10 + dy, 2, 4, dx * 0.2, 0, 7)
        g.fill()
      }
      g.fillStyle = '#5aba5a'
      g.beginPath()
      g.ellipse(8, 4, 1.4, 3, 0, 0, 7)
      g.fill()
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
      g.fillStyle = '#6a7686'
      g.fillRect(7, 1, 1, 12)
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
      g.fillStyle = '#fff2e8'
      g.fillRect(6, 9, 1, 1)
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
      g.fillStyle = '#fffce0'
      g.fillRect(6, 2, 4, 2)
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
      g.fillStyle = '#b08a54'
      g.fillRect(2, 4, 12, 1)
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
      g.fillStyle = '#c8d0e0'
      g.fillRect(5, 6, 1, 6)
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
        g.fillStyle = '#fffce0'
        g.fillRect(bx, 4 + (F ? 0 : 1), 1, 1)
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
      g.fillStyle = '#7ed85a'
      g.beginPath()
      g.ellipse(6, 16 - h + 2, 2, 1.5, 0, 0, 7)
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
      g.fillStyle = '#ffffff'
      g.fillRect(-1, -6, 1, 6)
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
  // frame
  g.fillStyle = '#6a4a28'
  g.fillRect(0, 0, 3, 16)
  g.fillRect(29, 6, 3, 10)
  g.fillStyle = '#8a6438'
  g.fillRect(0, 0, 3, 2)
  // mattress + pillow + quilt
  g.fillStyle = '#e8e4da'
  g.fillRect(3, 7, 26, 4)
  g.fillStyle = '#ffffff'
  g.fillRect(4, 5, 7, 4)
  g.fillStyle = '#a8323a'
  g.fillRect(12, 7, 17, 4)
  g.fillStyle = '#c04450'
  g.fillRect(12, 7, 17, 1)
  g.fillStyle = '#7a2028'
  g.fillRect(12, 10, 17, 1)
  g.fillStyle = '#4a3018'
  g.fillRect(3, 11, 26, 2)
  g.fillRect(4, 13, 2, 3)
  g.fillRect(26, 13, 2, 3)
  return c
}

// ------------------------------------------------------------ backdrops ---
function stars(g: CanvasRenderingContext2D, n: number, w: number, h: number, seed: number) {
  for (let i = 0; i < n; i++) {
    const x = Math.floor(hash(i * 3 + seed, 7) * w)
    const y = Math.floor(hash(i * 5 + seed, 13) * h)
    const b = hash(i + seed, 99)
    g.fillStyle = rgba('#ffffff', 0.35 + b * 0.55)
    const s = b > 0.85 ? 2 : 1
    g.fillRect(x, y, s, s)
  }
}

function moon(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const glow = g.createRadialGradient(x, y, r * 0.4, x, y, r * 3)
  glow.addColorStop(0, 'rgba(230,236,255,0.5)')
  glow.addColorStop(1, 'rgba(230,236,255,0)')
  g.fillStyle = glow
  g.beginPath()
  g.arc(x, y, r * 3, 0, 7)
  g.fill()
  g.fillStyle = '#eef0fb'
  g.beginPath()
  g.arc(x, y, r, 0, 7)
  g.fill()
  g.fillStyle = 'rgba(180,190,220,0.35)'
  g.beginPath()
  g.arc(x + r * 0.4, y - r * 0.3, r * 0.25, 0, 7)
  g.arc(x - r * 0.3, y + r * 0.2, r * 0.18, 0, 7)
  g.fill()
}

function cloud(g: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  g.fillStyle = color
  for (const [dx, dy, r] of [[0, 0, 1], [0.7, 0.15, 0.8], [-0.7, 0.15, 0.75], [0.35, -0.25, 0.7], [-0.35, -0.2, 0.6]]) {
    g.beginPath()
    g.ellipse(x + dx * s, y + dy * s, r * s, r * s * 0.7, 0, 0, 7)
    g.fill()
  }
}

function skyGrad(g: CanvasRenderingContext2D, top: string, bot: string) {
  const grad = g.createLinearGradient(0, 0, 0, ROOM_H)
  grad.addColorStop(0, top)
  grad.addColorStop(1, bot)
  g.fillStyle = grad
  g.fillRect(0, 0, ROOM_W, ROOM_H)
}

function paintScene(z: ZoneStyle): CV {
  const [c, g] = cv(ROOM_W, ROOM_H)
  const W = ROOM_W, H = ROOM_H
  switch (z.scene) {
    case 'seaside': {
      skyGrad(g, z.sky[0], z.sky[1])
      // sun glow
      const sun = g.createRadialGradient(410, 54, 8, 410, 54, 120)
      sun.addColorStop(0, 'rgba(255,250,220,0.9)')
      sun.addColorStop(1, 'rgba(255,250,220,0)')
      g.fillStyle = sun
      g.fillRect(0, 0, W, H)
      g.fillStyle = '#fffbe6'
      g.beginPath(); g.arc(410, 54, 16, 0, 7); g.fill()
      cloud(g, 110, 60, 26, 'rgba(255,255,255,0.85)')
      cloud(g, 300, 40, 20, 'rgba(255,255,255,0.7)')
      cloud(g, 470, 110, 18, 'rgba(255,255,255,0.6)')
      // distant sea band
      const sea = g.createLinearGradient(0, 168, 0, H)
      sea.addColorStop(0, shade(z.water, 0.25))
      sea.addColorStop(1, shade(z.water, -0.1))
      g.fillStyle = sea
      g.fillRect(0, 176, W, H - 176)
      g.fillStyle = 'rgba(255,255,255,0.15)'
      for (let x = 0; x < W; x += 9) g.fillRect(x + (x % 18 ? 4 : 0), 182 + (x % 27 ? 0 : 3), 5, 1)
      // distant sailboat
      g.fillStyle = 'rgba(20,40,70,0.5)'
      g.fillRect(150, 168, 1, 10)
      g.beginPath(); g.moveTo(150, 168); g.lineTo(158, 178); g.lineTo(150, 178); g.closePath(); g.fill()
      break
    }
    case 'garden': {
      const grad = g.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, '#bfe6c8')
      grad.addColorStop(0.55, '#dff0c6')
      grad.addColorStop(1, z.sky[1])
      g.fillStyle = grad
      g.fillRect(0, 0, W, H)
      const sun = g.createRadialGradient(90, 50, 6, 90, 50, 110)
      sun.addColorStop(0, 'rgba(255,252,224,0.8)')
      sun.addColorStop(1, 'rgba(255,252,224,0)')
      g.fillStyle = sun
      g.fillRect(0, 0, W, H)
      cloud(g, 360, 50, 22, 'rgba(255,255,255,0.7)')
      cloud(g, 200, 80, 16, 'rgba(255,255,255,0.5)')
      // rolling hedge hills
      for (const [hy, col] of [[150, '#3f8a4e'], [180, '#357a44'], [206, '#2c6a3a']] as const) {
        g.fillStyle = col
        g.beginPath()
        g.moveTo(0, H)
        for (let x = 0; x <= W; x += 32) {
          g.quadraticCurveTo(x + 16, hy - 14 + hash(x, hy) * 18, x + 32, hy)
        }
        g.lineTo(W, H)
        g.closePath()
        g.fill()
      }
      break
    }
    case 'cellar': {
      const grad = g.createRadialGradient(W / 2, H * 0.42, 30, W / 2, H * 0.5, W * 0.7)
      grad.addColorStop(0, shade(z.wall, -0.55))
      grad.addColorStop(1, '#060409')
      g.fillStyle = grad
      g.fillRect(0, 0, W, H)
      // receding brick arches
      g.strokeStyle = rgba(z.wall, 0.35)
      g.lineWidth = 2
      for (const r of [150, 110, 72]) {
        g.beginPath()
        g.arc(W / 2, H, r, Math.PI, 0)
        g.stroke()
      }
      g.fillStyle = '#040306'
      g.beginPath(); g.arc(W / 2, H, 60, Math.PI, 0); g.fill()
      break
    }
    case 'sewer': {
      const grad = g.createRadialGradient(W / 2, H * 0.45, 20, W / 2, H * 0.5, W * 0.7)
      grad.addColorStop(0, shade(z.wall, -0.35))
      grad.addColorStop(1, '#03100a')
      g.fillStyle = grad
      g.fillRect(0, 0, W, H)
      // round tunnel rings
      g.strokeStyle = rgba(z.wall, 0.4)
      g.lineWidth = 3
      for (const r of [170, 130, 92, 58]) {
        g.beginPath()
        g.ellipse(W / 2, H * 0.5, r, r * 0.82, 0, 0, 7)
        g.stroke()
      }
      g.fillStyle = '#020c07'
      g.beginPath(); g.ellipse(W / 2, H * 0.5, 40, 33, 0, 0, 7); g.fill()
      // faint green murk glow at bottom
      g.fillStyle = 'rgba(90,180,60,0.07)'
      g.fillRect(0, H - 40, W, 40)
      break
    }
    case 'interior': {
      const grad = g.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, shade(z.sky[0], -0.1))
      grad.addColorStop(1, shade(z.sky[1], -0.05))
      g.fillStyle = grad
      g.fillRect(0, 0, W, H)
      // faint vertical wall panelling
      g.fillStyle = rgba(z.wall, 0.1)
      for (let x = 20; x < W; x += 64) g.fillRect(x, 0, 30, H)
      g.fillStyle = rgba('#000000', 0.12)
      for (let x = 0; x < W; x += 64) g.fillRect(x, 0, 2, H)
      // two tall arched windows onto a starry night
      for (const wx of [120, 360]) {
        g.fillStyle = '#0c1428'
        g.fillRect(wx, 36, 46, 120)
        g.beginPath(); g.arc(wx + 23, 36, 23, Math.PI, 0); g.fill()
        const ng = g.createLinearGradient(0, 36, 0, 156)
        ng.addColorStop(0, '#1a2545')
        ng.addColorStop(1, '#0c1426')
        g.save()
        g.beginPath()
        g.rect(wx + 3, 30, 40, 124)
        g.clip()
        g.fillStyle = ng
        g.fillRect(wx, 14, 46, 142)
        stars(g, 18, W, 150, wx)
        g.fillStyle = 'rgba(220,228,255,0.5)'
        g.beginPath(); g.arc(wx + 32, 70, 7, 0, 7); g.fill()
        g.restore()
        // mullions
        g.strokeStyle = rgba(z.wall, 0.7)
        g.lineWidth = 2
        g.strokeRect(wx + 3, 36, 40, 118)
        g.beginPath(); g.moveTo(wx + 23, 38); g.lineTo(wx + 23, 152); g.stroke()
        g.beginPath(); g.moveTo(wx + 5, 92); g.lineTo(wx + 41, 92); g.stroke()
      }
      // wainscot / floor shadow band
      g.fillStyle = rgba('#000000', 0.22)
      g.fillRect(0, H - 26, W, 26)
      break
    }
    case 'attic': {
      const grad = g.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, '#1a130d')
      grad.addColorStop(1, shade(z.sky[1], -0.2))
      g.fillStyle = grad
      g.fillRect(0, 0, W, H)
      // sloped rafters meeting at a ridge
      g.strokeStyle = rgba(z.wall, 0.5)
      g.lineWidth = 4
      g.beginPath(); g.moveTo(0, 120); g.lineTo(W / 2, 18); g.lineTo(W, 120); g.stroke()
      g.lineWidth = 2
      for (const x of [90, 180, 332, 422]) {
        g.beginPath(); g.moveTo(x, 130); g.lineTo(x < W / 2 ? x + 60 : x - 60, 60); g.stroke()
      }
      // round attic window with a moonbeam
      g.fillStyle = '#243250'
      g.beginPath(); g.arc(W / 2, 50, 18, 0, 7); g.fill()
      g.fillStyle = '#cdd8f0'
      g.beginPath(); g.arc(W / 2, 50, 13, 0, 7); g.fill()
      g.strokeStyle = '#2a2018'; g.lineWidth = 2
      g.beginPath(); g.moveTo(W / 2 - 13, 50); g.lineTo(W / 2 + 13, 50); g.moveTo(W / 2, 37); g.lineTo(W / 2, 63); g.stroke()
      const beam = g.createLinearGradient(W / 2, 60, W / 2, H)
      beam.addColorStop(0, 'rgba(220,228,255,0.12)')
      beam.addColorStop(1, 'rgba(220,228,255,0)')
      g.fillStyle = beam
      g.beginPath(); g.moveTo(W / 2 - 10, 62); g.lineTo(W / 2 + 10, 62); g.lineTo(W / 2 + 70, H); g.lineTo(W / 2 - 70, H); g.closePath(); g.fill()
      break
    }
    case 'rooftop': {
      skyGrad(g, z.sky[0], z.sky[1])
      stars(g, 70, W, 180, 3)
      moon(g, 430, 44, 20)
      cloud(g, 120, 70, 22, 'rgba(60,66,96,0.55)')
      cloud(g, 300, 100, 18, 'rgba(60,66,96,0.45)')
      // distant town skyline silhouette
      g.fillStyle = '#0b0f1e'
      for (let x = 0; x < W; x += 24) {
        const h = 24 + Math.floor(hash(x, 5) * 40)
        g.fillRect(x, H - h - 30, 22, h + 30)
        // lit windows
        g.fillStyle = 'rgba(255,210,120,0.5)'
        if (hash(x, 9) > 0.5) g.fillRect(x + 6, H - h - 22, 3, 4)
        if (hash(x, 11) > 0.6) g.fillRect(x + 13, H - h - 14, 3, 4)
        g.fillStyle = '#0b0f1e'
      }
      break
    }
    case 'tower': {
      const grad = g.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, '#0a0716')
      grad.addColorStop(1, z.sky[1])
      g.fillStyle = grad
      g.fillRect(0, 0, W, H)
      stars(g, 110, W, H, 17)
      moon(g, 90, 56, 24)
      // a sea of cloud far below
      g.fillStyle = 'rgba(120,130,180,0.18)'
      for (let i = 0; i < 5; i++) cloud(g, 60 + i * 110, H - 18 + (i % 2) * 8, 30, 'rgba(150,160,200,0.16)')
      break
    }
    case 'bedroom': {
      const grad = g.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, shade(z.sky[0], -0.05))
      grad.addColorStop(1, z.sky[1])
      g.fillStyle = grad
      g.fillRect(0, 0, W, H)
      // wallpaper stripes
      g.fillStyle = rgba(z.wall, 0.12)
      for (let x = 0; x < W; x += 24) g.fillRect(x, 0, 12, H)
      // big window, pre-dawn sky with a star
      g.fillStyle = '#1a1228'
      g.fillRect(360, 30, 90, 130)
      g.beginPath(); g.arc(405, 30, 45, Math.PI, 0); g.fill()
      const dg = g.createLinearGradient(0, 0, 0, 160)
      dg.addColorStop(0, '#3a2a52')
      dg.addColorStop(1, '#d89a6a')
      g.save()
      g.beginPath(); g.rect(364, 24, 82, 136); g.clip()
      g.fillStyle = dg
      g.fillRect(360, 0, 90, 160)
      g.fillStyle = '#ffe8c0'
      g.beginPath(); g.arc(420, 64, 5, 0, 7); g.fill()
      stars(g, 10, W, 90, 41)
      g.restore()
      g.strokeStyle = rgba(z.wall, 0.8); g.lineWidth = 2
      g.strokeRect(364, 30, 82, 130)
      g.beginPath(); g.moveTo(405, 32); g.lineTo(405, 158); g.moveTo(366, 96); g.lineTo(444, 96); g.stroke()
      break
    }
  }
  return c
}

function paintVignette(): CV {
  const [c, g] = cv(ROOM_W, ROOM_H)
  const grad = g.createRadialGradient(
    ROOM_W / 2, ROOM_H / 2, ROOM_H * 0.5,
    ROOM_W / 2, ROOM_H / 2, ROOM_W * 0.78,
  )
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(0.7, 'rgba(0,0,0,0.18)')
  grad.addColorStop(1, 'rgba(0,0,0,0.5)')
  g.fillStyle = grad
  g.fillRect(0, 0, ROOM_W, ROOM_H)
  return c
}

function paintScanlines(): CV {
  const [c, g] = cv(ROOM_W, ROOM_H)
  g.fillStyle = 'rgba(0,0,0,0.10)'
  for (let y = 0; y < ROOM_H; y += 2) g.fillRect(0, y, ROOM_W, 1)
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
  scanlines: CV
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
      bg: paintScene(z),
    }
  }

  return {
    willyR: WILLY_FRAMES.map((m) => makeSprite(m, WILLY_PAL)),
    willyL: WILLY_FRAMES.map((m) => makeSprite(m, WILLY_PAL, true)),
    guard,
    zones,
    bed: paintBed(),
    vignette: paintVignette(),
    scanlines: paintScanlines(),
  }
}
