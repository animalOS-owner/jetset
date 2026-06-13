// Renders the whole mansion to map.svg: one thumbnail per room, placed on
// the world lattice. Run: node tools/render-map.ts

import { writeFileSync } from 'node:fs'
import { ROOM_DEFS } from '../src/content/world.ts'
import { parseRoom } from '../src/game/room.ts'
import { T } from '../src/game/types.ts'
import { ZONES } from '../src/content/palettes.ts'

const PX = 2 // svg px per cell
const RW = 32 * PX
const RH = 16 * PX
const GAP = 8
const LABEL = 10

const TILE_COLOR: Record<number, string> = {
  [T.WALL]: '#444a58',
  [T.PLATFORM]: '#7a8a5a',
  [T.RAMP_UP]: '#6a7a52',
  [T.RAMP_DOWN]: '#6a7a52',
  [T.CONV_L]: '#8a6a3a',
  [T.CONV_R]: '#8a6a3a',
  [T.HAZARD]: '#c03a3a',
  [T.WATER]: '#2a6aaa',
  [T.BED]: '#e84a9a',
}

let minX = 99, minY = 99, maxX = -99, maxY = -99
for (const d of ROOM_DEFS) {
  minX = Math.min(minX, d.gx)
  maxX = Math.max(maxX, d.gx)
  minY = Math.min(minY, d.gy)
  maxY = Math.max(maxY, d.gy)
}
const W = (maxX - minX + 1) * (RW + GAP) + GAP
const H = (maxY - minY + 1) * (RH + GAP + LABEL) + GAP

const parts: string[] = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="monospace">`,
  `<rect width="${W}" height="${H}" fill="#0c0c14"/>`,
]

for (const def of ROOM_DEFS) {
  const room = parseRoom(def)
  const ox = GAP + (def.gx - minX) * (RW + GAP)
  const oy = GAP + (def.gy - minY) * (RH + GAP + LABEL)
  const zone = ZONES[def.zone]
  parts.push(`<rect x="${ox - 1}" y="${oy - 1}" width="${RW + 2}" height="${RH + 2}" fill="${zone?.sky[1] ?? '#222'}" opacity="0.5"/>`)
  for (let r = 0; r < 16; r++)
    for (let c = 0; c < 32; c++) {
      const color = TILE_COLOR[room.tiles[r * 32 + c]]
      if (color)
        parts.push(`<rect x="${ox + c * PX}" y="${oy + r * PX}" width="${PX}" height="${PX}" fill="${color}"/>`)
    }
  for (const it of room.items)
    parts.push(`<rect x="${ox + it.col * PX}" y="${oy + it.row * PX}" width="${PX}" height="${PX}" fill="#ffe04a"/>`)
  parts.push(`<text x="${ox}" y="${oy + RH + 8}" font-size="7" fill="${zone?.banner ?? '#aaa'}">${def.name.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`)
}
parts.push('</svg>')

writeFileSync('map.svg', parts.join('\n'))
console.log(`map.svg written: ${ROOM_DEFS.length} rooms`)
