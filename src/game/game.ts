import {
  CELL, COLS, ROWS, ROOM_W, ROOM_H, HUD_H, VIEW_W, VIEW_H,
  P_W, P_H, SPRITE_OX, SPRITE_OY, START_LIVES, SPAWN_GRACE, ENTRY_GRACE,
  DEATH_ANIM, RESCUE_DEATHS,
} from './constants.ts'
import { T, type Dir, type Player, type Room } from './types.ts'
import { newPlayer, stepPlayer, settleOnGround } from './physics.ts'
import { guardianPos, arrowPos, ropePoint } from './guardians.ts'
import { getRoom, neighborOf, START, TOTAL_ITEMS } from '../content/world.ts'
import { ZONES, WARM_EMITTERS, COOL_EMITTERS } from '../content/palettes.ts'
import { MOONLIGHT, MOUNTAIN_KING, GYMNOPEDIE, OUTDOOR_ZONES } from '../content/music/tunes.ts'
import { Ambient, Lighting, type LightSource } from './fx.ts'
import type { Renderer } from '../engine/renderer.ts'
import type { Input } from '../engine/input.ts'
import type { Chip, Tune } from '../engine/audio.ts'
import type { Bank } from './gfx.ts'

/** Guardian sprite kinds that walk/crawl and so deserve a contact shadow. */
const GROUND_GUARD = new Set([
  'butler', 'chef', 'gardener', 'sweep', 'knight', 'maid', 'maria',
  'crab', 'rat', 'slime', 'spider',
])

const hexA = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

type Mode = 'title' | 'playing' | 'dying' | 'gameover' | 'ending' | 'paused' | 'map'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
}

interface SaveData {
  room: string
  entry: { x: number; y: number }
  lives: number
  collected: string[]
  visited: string[]
  clockMin: number
  deaths: number
}

const SAVE_KEY = 'jetset-manor-v1'

export class Game {
  mode: Mode = 'title'
  private menuIdx = 0
  private practice = false

  private room!: Room
  private player!: Player
  private t = 0 // room time, frames
  private globalT = 0
  private entry = { x: 0, y: 0 }
  private prevRoom: { id: string; entry: { x: number; y: number } } | null = null
  private deathsInRoom = 0
  private deathTimer = 0
  private endTimer = 0
  private rescued = 0 // frames left to show the rescue banner

  private lives = START_LIVES
  private collected = new Set<string>()
  private visited = new Set<string>()
  private clockMin = 0 // minutes since 7:00pm, cosmetic
  private deaths = 0

  private particles: Particle[] = []
  private currentTune: Tune | null = null
  private ambient = new Ambient()
  private lighting = new Lighting()

  constructor(
    private input: Input,
    private chip: Chip,
    private bank: Bank,
  ) {}

  // ------------------------------------------------------------- flow ---

  private hasSave(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null
  }

  private save(): void {
    const data: SaveData = {
      room: this.room.def.id,
      entry: this.entry,
      lives: this.lives,
      collected: [...this.collected],
      visited: [...this.visited],
      clockMin: this.clockMin,
      deaths: this.deaths,
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(data))
  }

  private newGame(): void {
    this.lives = START_LIVES
    this.collected = new Set()
    this.visited = new Set()
    this.clockMin = 0
    this.deaths = 0
    this.prevRoom = null
    this.enterRoom(START.room, { x: START.col * CELL + 3, y: START.row * CELL - P_H })
    this.mode = 'playing'
  }

  private continueGame(): void {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return this.newGame()
    try {
      const d = JSON.parse(raw) as SaveData
      this.lives = d.lives
      this.collected = new Set(d.collected)
      this.visited = new Set(d.visited)
      this.clockMin = d.clockMin
      this.deaths = d.deaths
      this.prevRoom = null
      this.enterRoom(d.room, d.entry)
      this.mode = 'playing'
    } catch {
      this.newGame()
    }
  }

  private enterRoom(id: string, at: { x: number; y: number }, keepMotion?: Player): void {
    this.room = getRoom(id)
    this.t = 0
    this.deathsInRoom = 0
    this.entry = { x: at.x, y: at.y }
    if (keepMotion) {
      this.player = keepMotion
      this.player.x = at.x
      this.player.y = at.y
    } else {
      this.player = newPlayer(at.x, at.y)
      // Fresh spawns (start, rescue) stand on the floor rather than sinking in.
      settleOnGround(this.player, this.room)
    }
    this.player.entryGrace = ENTRY_GRACE
    this.visited.add(id)
    this.ambient.setKind(ZONES[this.room.def.zone].ambient)
    this.music()
    this.save()
  }

  private music(): void {
    const tune =
      this.mode === 'title' || !this.room
        ? MOONLIGHT
        : OUTDOOR_ZONES.has(this.room.def.zone)
          ? GYMNOPEDIE
          : MOUNTAIN_KING
    if (tune !== this.currentTune) {
      this.currentTune = tune
      this.chip.play(tune)
    }
  }

  private transfer(dir: Dir): void {
    const next = neighborOf(this.room.def, dir)
    if (!next) {
      // Should be impossible in validated content; behave like a wall.
      const p = this.player
      if (dir === 'left') p.x = -P_W / 2 + 1
      if (dir === 'right') p.x = ROOM_W - P_W / 2 - 1
      if (dir === 'up') p.y = -P_H / 2 + 1
      if (dir === 'down') p.y = ROOM_H - P_H / 2 - 1
      return
    }
    const p = this.player
    if (dir === 'up') {
      // Jumping up into a solid ceiling in the room above acts as a head bump
      // rather than a transfer into a wall.
      const next2 = getRoom(next.id)
      const c0 = Math.floor((p.x + 1) / CELL)
      const c1 = Math.floor((p.x + P_W - 2) / CELL)
      let blocked = false
      for (let c = c0; c <= c1; c++) {
        const a = next2.tiles[14 * 32 + c]
        const b = next2.tiles[15 * 32 + c]
        if (a === T.WALL || b === T.WALL) blocked = true
      }
      if (blocked) {
        p.y = -P_H / 2 + 1
        p.vy = 0
        return
      }
    }
    const from = this.room.def.id
    const fromEntry = this.entry
    if (dir === 'left') p.x += ROOM_W
    if (dir === 'right') p.x -= ROOM_W
    if (dir === 'up') {
      p.y += ROOM_H
      p.apexY += ROOM_H
    }
    if (dir === 'down') {
      p.y -= ROOM_H
      p.apexY -= ROOM_H
    }
    this.chip.sfx('flip')
    this.enterRoom(next.id, { x: p.x, y: p.y }, p)
    this.prevRoom = { id: from, entry: fromEntry }
  }

  private die(): void {
    this.mode = 'dying'
    this.deathTimer = DEATH_ANIM
    this.deaths++
    this.chip.sfx('die')
    const p = this.player
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2
      this.particles.push({
        x: p.x + P_W / 2,
        y: p.y + P_H / 2,
        vx: Math.cos(a) * (1 + Math.random() * 1.5),
        vy: Math.sin(a) * (1 + Math.random() * 1.5) - 1,
        life: 40 + Math.random() * 20,
        color: ['#f0f0e8', '#c0303a', '#2a3a6a'][i % 3],
      })
    }
  }

  private respawn(): void {
    if (!this.practice) this.lives--
    if (this.lives < 0) {
      this.mode = 'gameover'
      this.endTimer = 0
      this.chip.stopMusic()
      this.chip.sfx('gameover')
      localStorage.removeItem(SAVE_KEY)
      return
    }
    this.deathsInRoom++
    if (this.deathsInRoom >= RESCUE_DEATHS && this.prevRoom) {
      // Death-loop rescue: back out the way Willy came in.
      const back = this.prevRoom
      this.prevRoom = null
      this.enterRoom(back.id, back.entry)
      this.player.grace = SPAWN_GRACE
      this.rescued = 150
    } else {
      const d = this.deathsInRoom
      this.player = newPlayer(this.entry.x, this.entry.y)
      settleOnGround(this.player, this.room)
      this.deathsInRoom = d
      this.player.grace = SPAWN_GRACE
      this.player.entryGrace = ENTRY_GRACE
    }
    this.mode = 'playing'
  }

  // ----------------------------------------------------------- update ---

  update(): void {
    this.input.poll()
    this.globalT++
    if (this.input.hit('mute')) this.chip.toggleMute()

    switch (this.mode) {
      case 'title':
        this.updateTitle()
        break
      case 'playing':
        this.updatePlaying()
        break
      case 'dying':
        this.updateParticles()
        if (--this.deathTimer <= 0) this.respawn()
        break
      case 'paused':
        if (this.input.hit('pause') || this.input.hit('confirm')) this.mode = 'playing'
        break
      case 'map':
        if (this.input.hit('map') || this.input.hit('pause')) this.mode = 'playing'
        break
      case 'gameover':
        this.endTimer++
        if (this.endTimer > 90 && (this.input.hit('confirm') || this.input.hit('jump'))) {
          this.mode = 'title'
          this.music()
        }
        break
      case 'ending':
        this.endTimer++
        this.updateParticles()
        if (this.endTimer > 180 && (this.input.hit('confirm') || this.input.hit('jump'))) {
          localStorage.removeItem(SAVE_KEY)
          this.mode = 'title'
          this.music()
        }
        break
    }
  }

  private updateTitle(): void {
    this.music()
    const n = this.hasSave() ? 2 : 1
    if (this.input.hit('up')) {
      this.menuIdx = (this.menuIdx + n - 1) % n
      this.chip.sfx('menu')
    }
    if (this.input.hit('down')) {
      this.menuIdx = (this.menuIdx + 1) % n
      this.chip.sfx('menu')
    }
    if (this.input.hit('map')) {
      this.practice = !this.practice
      this.chip.sfx('menu')
    }
    if (this.input.hit('confirm') || this.input.hit('jump')) {
      this.chip.sfx('menu')
      // menu order: CONTINUE (if a save exists) first, then NEW GAME
      if (this.hasSave() && this.menuIdx === 0) this.continueGame()
      else this.newGame()
    }
  }

  private updatePlaying(): void {
    if (this.input.hit('pause')) {
      this.mode = 'paused'
      return
    }
    if (this.input.hit('map')) {
      this.mode = 'map'
      return
    }
    this.t++
    if (this.rescued > 0) this.rescued--
    if (this.globalT % 120 === 0) this.clockMin++
    this.updateParticles()
    this.ambient.update(this.t)

    const p = this.player
    const events = stepPlayer(p, this.input.state(), this.room, this.t)

    for (const ev of events) {
      switch (ev.kind) {
        case 'jump':
          this.chip.sfx('jump')
          break
        case 'item':
          if (!this.collected.has(ev.id)) {
            this.collected.add(ev.id)
            this.chip.sfx('collect')
            const it = this.room.items.find((i) => i.id === ev.id)!
            for (let i = 0; i < 8; i++)
              this.particles.push({
                x: it.col * CELL + 8,
                y: it.row * CELL + 8,
                vx: (Math.random() - 0.5) * 2.5,
                vy: -Math.random() * 2.5,
                life: 30,
                color: '#ffe084',
              })
            this.save()
          }
          break
        case 'die':
          this.die()
          return
        case 'win':
          this.mode = 'ending'
          this.endTimer = 0
          this.chip.stopMusic()
          this.currentTune = null
          this.chip.sfx('win')
          localStorage.removeItem(SAVE_KEY)
          return
        case 'exit':
          this.transfer(ev.dir)
          return
      }
    }

    // Guardian & arrow collisions (game layer owns their positions).
    if (p.grace === 0 && p.entryGrace === 0) {
      const ix = p.x + 2
      const iy = p.y + 3
      const iw = P_W - 4
      const ih = P_H - 6
      const hits = (gx: number, gy: number, gw: number, gh: number) =>
        ix < gx + gw - 3 && ix + iw > gx + 3 && iy < gy + gh - 3 && iy + ih > gy + 3
      for (const def of this.room.def.guardians ?? []) {
        const g = guardianPos(def, this.t)
        if (hits(g.x, g.y, g.w, g.h)) {
          this.die()
          return
        }
      }
      for (const def of this.room.def.arrows ?? []) {
        const a = arrowPos(def, this.t)
        if (a && hits(a.x, a.y - 2, a.w, a.h + 4)) {
          this.die()
          return
        }
      }
    }
  }

  private updateParticles(): void {
    for (const pt of this.particles) {
      pt.x += pt.vx
      pt.y += pt.vy
      pt.vy += 0.08
      pt.life--
    }
    this.particles = this.particles.filter((pt) => pt.life > 0)
  }

  // ----------------------------------------------------------- render ---

  render(r: Renderer): void {
    switch (this.mode) {
      case 'title':
        this.renderTitle(r)
        break
      case 'gameover':
        this.renderGameOver(r)
        break
      case 'ending':
        this.renderEnding(r)
        break
      case 'map':
        this.renderRoomAndHud(r)
        this.renderMap(r)
        break
      case 'paused':
        this.renderRoomAndHud(r)
        r.ctx.fillStyle = 'rgba(0,0,0,0.55)'
        r.ctx.fillRect(0, 0, VIEW_W, ROOM_H)
        r.textCentered('PAUSED', VIEW_W / 2, 116, '#ffffff', 3)
        r.textCentered('ESC TO RESUME', VIEW_W / 2, 150, '#a0a0b0', 1)
        break
      default:
        this.renderRoomAndHud(r)
    }
  }

  private renderRoomAndHud(r: Renderer): void {
    const ctx = r.ctx
    const room = this.room
    const zone = ZONES[room.def.zone]
    const zt = this.bank.zones[room.def.zone]
    ctx.drawImage(zt.bg, 0, 0)

    const animF = Math.floor(this.t / 16) % 2
    const convF = Math.floor(this.t / 5) % 4

    // deco behind everything else
    for (let row = 0; row < ROWS; row++)
      for (let col = 0; col < COLS; col++) {
        const tl = room.tiles[row * COLS + col]
        const x = col * CELL
        const y = row * CELL
        switch (tl) {
          case T.DECO_A:
            ctx.drawImage(zt.deco[0][animF % zt.deco[0].length], x, y)
            break
          case T.DECO_B:
            ctx.drawImage(zt.deco[1][animF % zt.deco[1].length], x, y)
            break
          case T.DECO_C:
            ctx.drawImage(zt.deco[2][animF % zt.deco[2].length], x, y)
            break
        }
      }

    let bedDrawn = false
    for (let row = 0; row < ROWS; row++)
      for (let col = 0; col < COLS; col++) {
        const tl = room.tiles[row * COLS + col]
        const x = col * CELL
        const y = row * CELL
        switch (tl) {
          case T.WALL:
            ctx.drawImage(zt.wall, x, y)
            break
          case T.PLATFORM:
            ctx.drawImage(zt.platform, x, y)
            break
          case T.RAMP_UP:
            ctx.drawImage(zt.rampUp, x, y)
            break
          case T.RAMP_DOWN:
            ctx.drawImage(zt.rampDown, x, y)
            break
          case T.CONV_L:
            ctx.drawImage(zt.convL[convF], x, y)
            break
          case T.CONV_R:
            ctx.drawImage(zt.convR[convF], x, y)
            break
          case T.HAZARD:
            ctx.drawImage(zt.hazard[animF], x, y)
            break
          case T.WATER:
            ctx.drawImage(zt.water[animF], x, y)
            break
          case T.BED:
            if (!bedDrawn) {
              ctx.drawImage(this.bank.bed, x, y)
              bedDrawn = true
            }
            break
        }
      }

    this.renderDepth(ctx, room)

    // ropes
    for (const def of room.def.ropes ?? []) {
      ctx.fillStyle = '#3a2e1c'
      const len = def.len * CELL
      for (let s = 0; s <= len; s += 4) {
        const pt = ropePoint(def, this.t, s)
        ctx.fillRect(pt.x, pt.y, 2, 2)
      }
      ctx.fillStyle = '#e8dcc0'
      for (let s = 0; s <= len; s += 4) {
        const pt = ropePoint(def, this.t, s)
        ctx.fillRect(pt.x - 1, pt.y, 2, 2)
      }
    }

    // guardians (with contact shadows for ground walkers)
    for (const def of room.def.guardians ?? []) {
      const g = guardianPos(def, this.t)
      const sprites = this.bank.guard[def.type]
      if (!sprites) continue
      if (GROUND_GUARD.has(def.type)) this.blobShadow(ctx, g.x + g.w / 2, g.y + g.h, g.w * 0.4)
      const frames = g.dir >= 0 ? sprites.R : sprites.L
      const f = frames[Math.floor(this.t / 11) % frames.length]
      ctx.drawImage(f, Math.round(g.x), Math.round(g.y))
    }

    // arrows
    for (const def of room.def.arrows ?? []) {
      const a = arrowPos(def, this.t)
      if (!a) continue
      ctx.fillStyle = '#f0f0f4'
      ctx.fillRect(a.x + (a.dir > 0 ? 0 : 4), a.y + 1, 12, 1)
      ctx.beginPath()
      const tipX = a.dir > 0 ? a.x + 16 : a.x
      ctx.moveTo(tipX, a.y + 1.5)
      ctx.lineTo(tipX - a.dir * 4, a.y - 1.5)
      ctx.lineTo(tipX - a.dir * 4, a.y + 4.5)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = 'rgba(240,240,244,0.25)'
      ctx.fillRect(a.dir > 0 ? 0 : a.x + 16, a.y + 1, a.dir > 0 ? a.x : ROOM_W - a.x - 16, 1)
    }

    // Willy
    if (this.mode !== 'dying') {
      const p = this.player
      this.blobShadow(ctx, p.x + P_W / 2, p.y + P_H, 6)
      const blink = p.grace > 0 && Math.floor(this.t / 4) % 2 === 0
      if (!blink) {
        const frames = p.facing > 0 ? this.bank.willyR : this.bank.willyL
        let f = frames[0]
        if (p.rope) f = frames[2]
        else if (!p.onGround) f = frames[1]
        else if (p.frame > 0) f = frames[[0, 1, 0, 2][Math.floor(p.frame / 5) % 4]]
        ctx.drawImage(f, Math.round(p.x + SPRITE_OX), Math.round(p.y + SPRITE_OY))
      }
    } else {
      // death spin
      const p = this.player
      const ang = (DEATH_ANIM - this.deathTimer) * 0.25
      ctx.save()
      ctx.translate(p.x + P_W / 2, p.y + P_H / 2)
      ctx.rotate(ang)
      ctx.globalAlpha = Math.max(0, this.deathTimer / DEATH_ANIM)
      ctx.drawImage(this.bank.willyR[1], -8, -16)
      ctx.restore()
    }

    // dynamic lighting: darkness + light pools for the dim zones
    this.lighting.render(ctx, zone, this.collectLights())

    // items (drawn after lighting so they always read, with a bloom halo)
    for (let i = 0; i < room.items.length; i++) {
      const it = room.items[i]
      if (this.collected.has(it.id)) continue
      const pulse = Math.sin(this.t / 9 + i * 1.7)
      const hue = (this.t * 3 + i * 47) % 360
      const cx = it.col * CELL + 8
      const cy = it.row * CELL + 8 + pulse
      // bloom halo
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, 9)
      halo.addColorStop(0, `hsla(${hue}, 90%, 70%, 0.7)`)
      halo.addColorStop(1, `hsla(${hue}, 90%, 70%, 0)`)
      ctx.fillStyle = halo
      ctx.beginPath()
      ctx.arc(cx, cy, 9, 0, 7)
      ctx.fill()
      ctx.restore()
      // gem
      ctx.fillStyle = `hsl(${hue} 85% 60%)`
      ctx.beginPath()
      ctx.moveTo(cx, cy - 5)
      ctx.lineTo(cx + 4, cy)
      ctx.lineTo(cx, cy + 5)
      ctx.lineTo(cx - 4, cy)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = `hsl(${hue} 90% 78%)`
      ctx.beginPath()
      ctx.moveTo(cx, cy - 5)
      ctx.lineTo(cx + 4, cy)
      ctx.lineTo(cx, cy)
      ctx.closePath()
      ctx.fill()
      // twinkle
      const tw = (Math.sin(this.t / 6 + i) + 1) / 2
      ctx.fillStyle = `rgba(255,255,255,${0.5 + tw * 0.5})`
      ctx.fillRect(cx - 1, cy - 2, 1, 1)
      if (tw > 0.7) {
        ctx.fillStyle = 'rgba(255,255,255,0.8)'
        ctx.fillRect(cx, cy - 8, 1, 3)
        ctx.fillRect(cx - 1, cy - 7, 3, 1)
      }
    }

    // particles (after lighting so collect sparkles pop in dark rooms)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (const pt of this.particles) {
      ctx.fillStyle = pt.color
      ctx.globalAlpha = Math.min(1, pt.life / 20)
      ctx.fillRect(pt.x, pt.y, 2, 2)
    }
    ctx.restore()
    ctx.globalAlpha = 1

    // ambient weather
    this.ambient.draw(ctx, zone, this.t)

    ctx.drawImage(this.bank.vignette, 0, 0)
    ctx.globalAlpha = 0.5
    ctx.drawImage(this.bank.scanlines, 0, 0)
    ctx.globalAlpha = 1
    this.renderHud(r)
  }

  /** Soft floor shadow for a sprite standing/walking at (cx, footY). */
  private blobShadow(ctx: CanvasRenderingContext2D, cx: number, footY: number, rx: number): void {
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.28)'
    ctx.beginPath()
    ctx.ellipse(cx, footY, rx, Math.max(2, rx * 0.35), 0, 0, 7)
    ctx.fill()
    ctx.restore()
  }

  /** Depth pass: drop shadows under floating platforms, lit tops on exposed walls. */
  private renderDepth(ctx: CanvasRenderingContext2D, room: Room): void {
    for (let row = 0; row < ROWS; row++)
      for (let col = 0; col < COLS; col++) {
        const tl = room.tiles[row * COLS + col]
        const x = col * CELL
        const y = row * CELL
        if (tl === T.PLATFORM || tl === T.CONV_L || tl === T.CONV_R) {
          const below = row < ROWS - 1 ? room.tiles[(row + 1) * COLS + col] : T.WALL
          if (below === T.EMPTY || below >= T.DECO_A) {
            const grad = ctx.createLinearGradient(0, y + 6, 0, y + 14)
            grad.addColorStop(0, 'rgba(0,0,0,0.22)')
            grad.addColorStop(1, 'rgba(0,0,0,0)')
            ctx.fillStyle = grad
            ctx.fillRect(x, y + 6, CELL, 8)
          }
        } else if (tl === T.WALL) {
          const above = row > 0 ? room.tiles[(row - 1) * COLS + col] : T.WALL
          if (above === T.EMPTY || above >= T.DECO_A) {
            ctx.fillStyle = 'rgba(255,255,255,0.12)'
            ctx.fillRect(x, y, CELL, 1)
            ctx.fillStyle = 'rgba(255,255,255,0.05)'
            ctx.fillRect(x, y + 1, CELL, 1)
          }
        }
      }
  }

  /** Light sources for the current room, fed to the lighting pass. */
  private collectLights(): LightSource[] {
    const room = this.room
    const z = ZONES[room.def.zone]
    if (z.dark < 0.08) return []
    const lights: LightSource[] = []
    const flick = (ph: number) =>
      1 + 0.08 * Math.sin(this.t * 0.3 + ph) + 0.04 * Math.sin(this.t * 0.13 + ph * 2)
    for (let row = 0; row < ROWS; row++)
      for (let col = 0; col < COLS; col++) {
        const tl = room.tiles[row * COLS + col]
        const cx = col * CELL + 8
        if (tl === T.DECO_A || tl === T.DECO_B || tl === T.DECO_C) {
          const kind = z.deco[tl - T.DECO_A]
          if (WARM_EMITTERS.has(kind))
            lights.push({ x: cx, y: row * CELL + 6, r: 54 * flick(col * 7 + row * 13), color: z.light, cut: 0.95, glow: 0.3 })
          else if (COOL_EMITTERS.has(kind))
            lights.push({ x: cx, y: row * CELL + 8, r: 48, color: z.light, cut: 0.82, glow: 0.18 })
        } else if (tl === T.HAZARD && z.hazard === 'fire') {
          lights.push({ x: cx, y: row * CELL + 8, r: 46 * flick(col * 5 + row * 9), color: '#ff8a3a', cut: 0.9, glow: 0.32 })
        } else if (tl === T.BED) {
          lights.push({ x: cx + 8, y: row * CELL + 8, r: 64, color: z.light, cut: 0.9, glow: 0.22 })
        }
      }
    for (const it of room.items) {
      if (this.collected.has(it.id)) continue
      lights.push({ x: it.col * CELL + 8, y: it.row * CELL + 8, r: 26, color: '#fff0a0', cut: 0.6, glow: 0.12 })
    }
    // Willy carries his own glow so the player is always readable in the dark.
    const p = this.player
    lights.push({ x: p.x + P_W / 2, y: p.y + P_H / 2, r: 84, color: '#ffe8c0', cut: 0.86, glow: 0.05 })
    return lights
  }

  private renderHud(r: Renderer): void {
    const ctx = r.ctx
    const zone = ZONES[this.room.def.zone]
    // panelled background
    const bg = ctx.createLinearGradient(0, ROOM_H, 0, VIEW_H)
    bg.addColorStop(0, '#16131f')
    bg.addColorStop(1, '#08070d')
    ctx.fillStyle = bg
    ctx.fillRect(0, ROOM_H, VIEW_W, HUD_H)
    // glowing top rule in the zone colour
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const gl = ctx.createLinearGradient(0, ROOM_H - 5, 0, ROOM_H + 5)
    gl.addColorStop(0, 'rgba(0,0,0,0)')
    gl.addColorStop(0.5, hexA(zone.banner, 0.45))
    gl.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gl
    ctx.fillRect(0, ROOM_H - 5, VIEW_W, 10)
    ctx.restore()
    ctx.fillStyle = zone.banner
    ctx.fillRect(0, ROOM_H, VIEW_W, 1)

    // room-name banner with a drop shadow
    const name = (this.rescued > 0 ? 'A HELPING HAND...' : this.room.def.name).toUpperCase()
    r.textCentered(name, VIEW_W / 2 + 1, ROOM_H + 9, '#000000', 2)
    r.textCentered(name, VIEW_W / 2, ROOM_H + 8, zone.banner, 2)

    // items: glowing gem + count + tidy bar
    const pct = Math.floor((this.collected.size / Math.max(1, TOTAL_ITEMS)) * 100)
    const gx = 11, gy = ROOM_H + 37
    const hue = (this.globalT * 2) % 360
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const halo = ctx.createRadialGradient(gx, gy, 0, gx, gy, 7)
    halo.addColorStop(0, `hsla(${hue},90%,70%,0.8)`)
    halo.addColorStop(1, `hsla(${hue},90%,70%,0)`)
    ctx.fillStyle = halo
    ctx.beginPath(); ctx.arc(gx, gy, 7, 0, 7); ctx.fill()
    ctx.restore()
    ctx.fillStyle = `hsl(${hue} 85% 62%)`
    ctx.beginPath()
    ctx.moveTo(gx, gy - 4); ctx.lineTo(gx + 3, gy); ctx.lineTo(gx, gy + 4); ctx.lineTo(gx - 3, gy)
    ctx.closePath(); ctx.fill()
    r.text(`${this.collected.size}/${TOTAL_ITEMS}`, 20, ROOM_H + 33, '#ffe084', 1)
    ctx.fillStyle = '#26222e'
    ctx.fillRect(8, ROOM_H + 47, 72, 4)
    ctx.fillStyle = pct >= 100 ? '#8ae08a' : '#c8a84a'
    ctx.fillRect(8, ROOM_H + 47, Math.round((72 * pct) / 100), 4)
    ctx.fillStyle = hexA('#ffffff', 0.4)
    ctx.fillRect(8, ROOM_H + 47, 72, 1)
    r.text(`${pct}% TIDY`, 84, ROOM_H + 46, '#8a90a0', 1)

    // lives on a little shelf
    const willy = this.bank.willyR[Math.floor(this.globalT / 10) % 2 === 0 ? 0 : 1]
    const shown = Math.min(this.lives, 8)
    const lx = 178
    for (let i = 0; i < shown; i++)
      ctx.drawImage(willy, lx + i * 13, ROOM_H + 32, 8, 16)
    ctx.fillStyle = hexA(zone.banner, 0.5)
    ctx.fillRect(lx - 2, ROOM_H + 49, Math.max(1, shown) * 13, 1)
    if (this.practice) r.text('PRACTICE', lx, ROOM_H + 52, '#6a8aa8', 1)

    // clock
    const totalMin = 19 * 60 + this.clockMin
    const hh = Math.floor(totalMin / 60) % 24
    const mm = totalMin % 60
    const h12 = ((hh + 11) % 12) + 1
    const ampm = hh >= 12 ? 'PM' : 'AM'
    r.text(
      `${h12}:${mm.toString().padStart(2, '0')}${ampm}`,
      VIEW_W - 64, ROOM_H + 34, '#a8c8e8', 1,
    )
    r.text(
      this.chip.muted ? 'N: SOUND OFF' : 'N: SOUND ON',
      VIEW_W - 80, ROOM_H + 46,
      this.chip.muted ? '#b86a6a' : '#6a9a6a', 1,
    )
  }

  private renderMap(r: Renderer): void {
    const ctx = r.ctx
    ctx.fillStyle = 'rgba(4,4,10,0.92)'
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)
    r.textCentered('THE MANSION', VIEW_W / 2, 8, '#ffe084', 2)

    const cellW = 30
    const cellH = 18
    // lattice bounds from visited rooms
    let minX = 99, minY = 99, maxX = -99, maxY = -99
    for (const id of this.visited) {
      const d = getRoom(id).def
      minX = Math.min(minX, d.gx)
      maxX = Math.max(maxX, d.gx)
      minY = Math.min(minY, d.gy)
      maxY = Math.max(maxY, d.gy)
    }
    const ox = Math.round(VIEW_W / 2 - ((maxX + minX + 1) * cellW) / 2)
    const oy = Math.round(170 - ((maxY + minY + 1) * cellH) / 2)
    for (const id of this.visited) {
      const d = getRoom(id).def
      const zone = ZONES[d.zone]
      const x = ox + d.gx * cellW
      const y = oy + d.gy * cellH
      const here = d.id === this.room.def.id
      ctx.fillStyle = here && Math.floor(this.globalT / 15) % 2 === 0 ? '#ffffff' : zone.banner
      ctx.globalAlpha = here ? 1 : 0.6
      ctx.fillRect(x, y, cellW - 2, cellH - 2)
      ctx.globalAlpha = 1
    }
    r.textCentered(this.room.def.name.toUpperCase(), VIEW_W / 2, VIEW_H - 40, '#ffffff', 1)
    r.textCentered(
      `${this.visited.size} ROOMS DISCOVERED`,
      VIEW_W / 2, VIEW_H - 24, '#a8a8b8', 1,
    )
  }

  private renderTitle(r: Renderer): void {
    const ctx = r.ctx
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H)
    grad.addColorStop(0, '#0a0a18')
    grad.addColorStop(0.6, '#1a1230')
    grad.addColorStop(1, '#2c1a3e')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)

    // twinkling starfield
    for (let i = 0; i < 90; i++) {
      const x = (i * 97 + 13) % VIEW_W
      const y = (i * 53 + 7) % 210
      const tw = (Math.sin(this.globalT * 0.05 + i) + 1) / 2
      ctx.fillStyle = `rgba(255,255,255,${0.18 + tw * 0.5})`
      const s = i % 11 === 0 ? 2 : 1
      ctx.fillRect(x, y, s, s)
    }

    // glowing moon
    const mg = ctx.createRadialGradient(430, 60, 8, 430, 60, 90)
    mg.addColorStop(0, 'rgba(232,238,255,0.5)')
    mg.addColorStop(1, 'rgba(232,238,255,0)')
    ctx.fillStyle = mg
    ctx.fillRect(300, 0, 212, 200)
    ctx.fillStyle = '#eef0fb'
    ctx.beginPath(); ctx.arc(430, 60, 22, 0, 7); ctx.fill()
    ctx.fillStyle = 'rgba(180,190,220,0.35)'
    ctx.beginPath(); ctx.arc(438, 52, 6, 0, 7); ctx.arc(422, 68, 4, 0, 7); ctx.fill()

    // distant treeline
    ctx.fillStyle = '#0a0a16'
    ctx.beginPath(); ctx.moveTo(0, 240)
    for (let x = 0; x <= VIEW_W; x += 28)
      ctx.lineTo(x, 214 + ((x * 7) % 5 === 0 ? 6 : 0) - ((x % 56 === 0) ? 12 : 0))
    ctx.lineTo(VIEW_W, 240); ctx.closePath(); ctx.fill()

    // mansion silhouette
    ctx.fillStyle = '#06060e'
    ctx.fillRect(70, 184, 80, 56)
    ctx.fillRect(300, 178, 96, 62)
    ctx.fillRect(120, 150, 200, 90)
    ctx.beginPath(); ctx.moveTo(108, 152); ctx.lineTo(220, 108); ctx.lineTo(332, 152); ctx.closePath(); ctx.fill()
    ctx.fillRect(202, 96, 44, 144)
    ctx.beginPath(); ctx.moveTo(196, 98); ctx.lineTo(224, 62); ctx.lineTo(252, 98); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#06060e'
    ctx.fillRect(0, 238, VIEW_W, VIEW_H - 238)

    // lit windows (warm, flickering) + a bright glowing tower window
    for (const [wx, wy] of [[90, 198], [126, 198], [150, 172], [250, 170], [284, 196], [330, 196], [362, 192]] as const)
      if (Math.floor(this.globalT / 40 + wx) % 5 !== 0) {
        ctx.fillStyle = '#ffcf6a'
        ctx.fillRect(wx, wy, 6, 8)
      }
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const tw = ctx.createRadialGradient(224, 118, 2, 224, 118, 28)
    tw.addColorStop(0, 'rgba(255,200,110,0.7)')
    tw.addColorStop(1, 'rgba(255,200,110,0)')
    ctx.fillStyle = tw
    ctx.beginPath(); ctx.arc(224, 118, 28, 0, 7); ctx.fill()
    ctx.restore()
    ctx.fillStyle = '#ffe6a0'
    ctx.fillRect(220, 112, 8, 12)

    // drifting fog
    ctx.save()
    ctx.globalAlpha = 0.12
    for (let i = 0; i < 4; i++) {
      const fx = ((this.globalT * 0.2 + i * 160) % (VIEW_W + 160)) - 80
      ctx.fillStyle = '#b0b0d0'
      ctx.beginPath(); ctx.ellipse(fx, 224 - i * 6, 90, 14, 0, 0, 7); ctx.fill()
    }
    ctx.restore()

    // title with a warm bloom behind it
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const tg = ctx.createRadialGradient(VIEW_W / 2, 64, 10, VIEW_W / 2, 64, 170)
    tg.addColorStop(0, 'rgba(255,196,84,0.22)')
    tg.addColorStop(1, 'rgba(255,196,84,0)')
    ctx.fillStyle = tg
    ctx.fillRect(0, 0, VIEW_W, 150)
    ctx.restore()
    r.textCentered('JETSET', VIEW_W / 2 + 2, 40, '#3a2606', 6)
    r.textCentered('JETSET', VIEW_W / 2, 38, '#ffe084', 6)
    r.textCentered('MANOR', VIEW_W / 2 + 2, 88, '#181826', 6)
    r.textCentered('MANOR', VIEW_W / 2, 86, '#ffffff', 6)
    r.textCentered('A TRIBUTE TO JET SET WILLY', VIEW_W / 2, 136, '#a08ab8', 1)

    const opts = this.hasSave() ? ['CONTINUE', 'NEW GAME'] : ['NEW GAME']
    opts.forEach((o, i) => {
      const sel = i === this.menuIdx
      const blink = sel && Math.floor(this.globalT / 20) % 2 === 0
      if (sel) {
        ctx.fillStyle = hexA('#ffe084', 0.12)
        ctx.fillRect(VIEW_W / 2 - 70, 165 + i * 16, 140, 13)
      }
      r.textCentered(
        `${sel ? '> ' : '  '}${o}${sel ? ' <' : '  '}`,
        VIEW_W / 2, 168 + i * 16,
        blink ? '#ffffff' : sel ? '#ffe084' : '#8888a0', 1,
      )
    })

    // a little Willy marching across the bottom, with a shadow
    const wx = (this.globalT * 0.8) % (VIEW_W + 40) - 20
    const wf = this.bank.willyR[Math.floor(this.globalT / 8) % 2 === 0 ? 1 : 2]
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.beginPath(); ctx.ellipse(wx + 8, 254, 7, 2, 0, 0, 7); ctx.fill()
    ctx.drawImage(wf, wx, 222)
    ctx.fillStyle = '#06060e'
    ctx.fillRect(0, 255, VIEW_W, 2)

    r.textCentered('ARROWS/WASD MOVE   Z/SPACE JUMP', VIEW_W / 2, 268, '#7a7a8e', 1)
    r.textCentered('DOWN + JUMP DROPS THROUGH PLATFORMS', VIEW_W / 2, 280, '#9a9ab0', 1)
    r.textCentered('ESC PAUSE   TAB MAP   N MUSIC', VIEW_W / 2, 292, '#7a7a8e', 1)
    r.textCentered(
      `M: PRACTICE MODE ${this.practice ? 'ON' : 'OFF'}`,
      VIEW_W / 2, 304, this.practice ? '#8ae08a' : '#55556a', 1,
    )
  }

  private renderGameOver(r: Renderer): void {
    const ctx = r.ctx
    const grad = ctx.createRadialGradient(VIEW_W / 2, 120, 20, VIEW_W / 2, 120, 320)
    grad.addColorStop(0, '#1a0a10')
    grad.addColorStop(1, '#06040a')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)

    // a fallen, faded Willy
    ctx.save()
    ctx.globalAlpha = 0.4
    ctx.translate(VIEW_W / 2, 174)
    ctx.rotate(Math.PI / 2)
    ctx.drawImage(this.bank.willyR[0], -16, -8)
    ctx.restore()

    // red bloom behind the title
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const tg = ctx.createRadialGradient(VIEW_W / 2, 86, 8, VIEW_W / 2, 86, 150)
    tg.addColorStop(0, 'rgba(200,40,50,0.28)')
    tg.addColorStop(1, 'rgba(200,40,50,0)')
    ctx.fillStyle = tg
    ctx.fillRect(0, 10, VIEW_W, 150)
    ctx.restore()
    r.textCentered('GAME OVER', VIEW_W / 2 + 2, 92, '#2a0608', 4)
    r.textCentered('GAME OVER', VIEW_W / 2, 90, '#e0404a', 4)
    r.textCentered(
      `${this.collected.size} ITEMS   ${this.visited.size} ROOMS   ${this.deaths} DEATHS`,
      VIEW_W / 2, 210, '#a8a8b8', 1,
    )
    if (this.endTimer > 90 && Math.floor(this.globalT / 24) % 2 === 0)
      r.textCentered('PRESS ENTER', VIEW_W / 2, 244, '#ffffff', 1)
  }

  private renderEnding(r: Renderer): void {
    const ctx = r.ctx
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H)
    grad.addColorStop(0, '#160c24')
    grad.addColorStop(1, '#3a2448')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)

    const pct = Math.floor((this.collected.size / Math.max(1, TOTAL_ITEMS)) * 100)

    // moonlit window behind the bed
    ctx.fillStyle = '#0e1024'
    ctx.fillRect(96, 86, 64, 96)
    const wg = ctx.createLinearGradient(0, 86, 0, 182)
    wg.addColorStop(0, '#243056')
    wg.addColorStop(1, '#0e1024')
    ctx.save()
    ctx.beginPath(); ctx.rect(99, 89, 58, 90); ctx.clip()
    ctx.fillStyle = wg
    ctx.fillRect(96, 86, 64, 96)
    for (let i = 0; i < 16; i++) {
      const x = 99 + ((i * 41 + 5) % 56)
      const y = 90 + ((i * 23 + 3) % 78)
      ctx.fillStyle = `rgba(255,255,255,${0.3 + ((i * 7) % 5) * 0.12})`
      ctx.fillRect(x, y, 1, 1)
    }
    ctx.fillStyle = '#eef0fb'
    ctx.beginPath(); ctx.arc(140, 112, 9, 0, 7); ctx.fill()
    ctx.restore()
    ctx.strokeStyle = '#6a5a4a'; ctx.lineWidth = 2
    ctx.strokeRect(99, 89, 58, 90)
    ctx.beginPath(); ctx.moveTo(128, 90); ctx.lineTo(128, 178); ctx.moveTo(100, 134); ctx.lineTo(156, 134); ctx.stroke()

    // warm glow over the bed
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const bedGlow = ctx.createRadialGradient(256, 132, 6, 256, 132, 90)
    bedGlow.addColorStop(0, 'rgba(255,210,140,0.22)')
    bedGlow.addColorStop(1, 'rgba(255,210,140,0)')
    ctx.fillStyle = bedGlow
    ctx.beginPath(); ctx.arc(256, 132, 90, 0, 7); ctx.fill()
    ctx.restore()

    r.textCentered('AT LAST...', VIEW_W / 2, 40, '#ffe084', 2)
    r.textCentered('WILLY MADE IT TO BED', VIEW_W / 2, 64, '#ffffff', 2)

    ctx.drawImage(this.bank.bed, 192, 110, 128, 64)
    // Willy lying on the bed
    ctx.save()
    ctx.translate(256, 122)
    ctx.rotate(-Math.PI / 2)
    ctx.drawImage(this.bank.willyR[0], -16, -8, 16, 32)
    ctx.restore()

    // floating ZZZ
    for (let i = 0; i < 3; i++) {
      const ph = this.endTimer * 0.03 + i * 0.9
      const zx = 286 + i * 9 + Math.sin(ph) * 2
      const zy = 110 - i * 11 - ((this.endTimer * 0.4 + i * 30) % 40)
      r.text('Z', zx, zy, `rgba(220,228,255,${Math.max(0, 1 - ((this.endTimer * 0.4 + i * 30) % 40) / 40)})`, 1 + i * 0.5)
    }

    // gold celebration sparkles for a perfect tidy
    if (pct >= 100) {
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (let i = 0; i < 24; i++) {
        const x = (i * 89 + this.endTimer * (1 + (i % 3))) % VIEW_W
        const y = (i * 61 + this.endTimer * 0.6) % 240
        const tw = (Math.sin(this.endTimer * 0.1 + i) + 1) / 2
        ctx.fillStyle = `rgba(255,224,128,${0.3 + tw * 0.6})`
        ctx.fillRect(x, y, tw > 0.7 ? 2 : 1, tw > 0.7 ? 2 : 1)
      }
      ctx.restore()
    }

    if (pct >= 100) {
      r.textCentered('THE MANSION IS SPOTLESS!', VIEW_W / 2, 196, '#8ae08a', 1)
      r.textCentered('MARIA IS SPEECHLESS. 100% TIDY!', VIEW_W / 2, 210, '#8ae08a', 1)
    } else {
      r.textCentered(`${pct}% TIDY - MARIA EXPECTS BETTER`, VIEW_W / 2, 196, '#e0a858', 1)
      r.textCentered('BUT SLEEP COMES FIRST', VIEW_W / 2, 210, '#a8a8b8', 1)
    }
    r.textCentered(
      `${this.visited.size} ROOMS EXPLORED   ${this.deaths} DEATHS`,
      VIEW_W / 2, 232, '#a8a8b8', 1,
    )
    if (this.endTimer > 180)
      r.textCentered('PRESS ENTER', VIEW_W / 2, 270, '#ffffff', 1)
  }
}
