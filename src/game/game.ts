import {
  CELL, COLS, ROWS, ROOM_W, ROOM_H, HUD_H, VIEW_W, VIEW_H,
  P_W, P_H, SPRITE_OX, SPRITE_OY, START_LIVES, SPAWN_GRACE, ENTRY_GRACE,
  DEATH_ANIM, RESCUE_DEATHS,
} from './constants.ts'
import { T, type Dir, type Player, type Room } from './types.ts'
import { newPlayer, stepPlayer, settleOnGround } from './physics.ts'
import { guardianPos, arrowPos, ropePoint } from './guardians.ts'
import { getRoom, neighborOf, START, TOTAL_ITEMS } from '../content/world.ts'
import { ZONES } from '../content/palettes.ts'
import { MOONLIGHT, MOUNTAIN_KING, GYMNOPEDIE, OUTDOOR_ZONES } from '../content/music/tunes.ts'
import type { Renderer } from '../engine/renderer.ts'
import type { Input } from '../engine/input.ts'
import type { Chip, Tune } from '../engine/audio.ts'
import type { Bank } from './gfx.ts'

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

    // items
    for (let i = 0; i < room.items.length; i++) {
      const it = room.items[i]
      if (this.collected.has(it.id)) continue
      const pulse = Math.sin(this.t / 9 + i * 1.7)
      const hue = (this.t * 3 + i * 47) % 360
      const cx = it.col * CELL + 8
      const cy = it.row * CELL + 8 + pulse
      ctx.save()
      ctx.shadowColor = `hsl(${hue} 90% 65%)`
      ctx.shadowBlur = 6
      ctx.fillStyle = `hsl(${hue} 85% 62%)`
      ctx.beginPath()
      ctx.moveTo(cx, cy - 5)
      ctx.lineTo(cx + 4, cy)
      ctx.lineTo(cx, cy + 5)
      ctx.lineTo(cx - 4, cy)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.fillRect(cx - 1, cy - 2, 1, 1)
      ctx.restore()
    }

    // ropes
    for (const def of room.def.ropes ?? []) {
      ctx.fillStyle = '#e8dcc0'
      const len = def.len * CELL
      for (let s = 0; s <= len; s += 4) {
        const pt = ropePoint(def, this.t, s)
        ctx.fillRect(pt.x - 1, pt.y, 2, 2)
      }
    }

    // guardians
    for (const def of room.def.guardians ?? []) {
      const g = guardianPos(def, this.t)
      const sprites = this.bank.guard[def.type]
      if (!sprites) continue
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

    // particles
    for (const pt of this.particles) {
      ctx.fillStyle = pt.color
      ctx.globalAlpha = Math.min(1, pt.life / 20)
      ctx.fillRect(pt.x, pt.y, 2, 2)
    }
    ctx.globalAlpha = 1

    ctx.drawImage(this.bank.vignette, 0, 0)
    this.renderHud(r)
  }

  private renderHud(r: Renderer): void {
    const ctx = r.ctx
    const zone = ZONES[this.room.def.zone]
    ctx.fillStyle = '#0c0c14'
    ctx.fillRect(0, ROOM_H, VIEW_W, HUD_H)
    ctx.fillStyle = zone.banner
    ctx.fillRect(0, ROOM_H, VIEW_W, 1)

    const name = this.rescued > 0 ? 'A HELPING HAND...' : this.room.def.name
    r.textCentered(name.toUpperCase(), VIEW_W / 2, ROOM_H + 8, zone.banner, 2)

    // items
    const pct = Math.floor((this.collected.size / Math.max(1, TOTAL_ITEMS)) * 100)
    r.text(`ITEMS ${this.collected.size}/${TOTAL_ITEMS}`, 8, ROOM_H + 34, '#ffe084', 1)
    r.text(`${pct}% TIDY`, 8, ROOM_H + 46, '#a8a8b8', 1)

    // lives as marching willys
    const willy = this.bank.willyR[Math.floor(this.globalT / 10) % 2 === 0 ? 0 : 1]
    const shown = Math.min(this.lives, 8)
    for (let i = 0; i < shown; i++)
      ctx.drawImage(willy, 150 + i * 14, ROOM_H + 34, 8, 16)
    if (this.practice) r.text('PRACTICE', 150, ROOM_H + 52, '#6a8aa8', 1)

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
    grad.addColorStop(0, '#10101e')
    grad.addColorStop(1, '#2a1a3a')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)

    // moonlit mansion silhouette
    ctx.fillStyle = '#e8e8d8'
    ctx.beginPath()
    ctx.arc(440, 50, 22, 0, 7)
    ctx.fill()
    ctx.fillStyle = '#08080e'
    for (const [bx, bw, bh] of [[40, 90, 90], [130, 120, 130], [250, 80, 100], [330, 110, 80]]) {
      ctx.fillRect(bx, 240 - bh, bw, bh)
    }
    ctx.fillStyle = '#ffe084'
    for (const [wx, wy] of [[60, 180], [160, 140], [200, 170], [270, 165], [350, 185]])
      if (Math.floor(this.globalT / 40 + wx) % 5 !== 0) ctx.fillRect(wx, wy, 6, 8)

    r.textCentered('JETSET', VIEW_W / 2, 38, '#ffe084', 6)
    r.textCentered('MANOR', VIEW_W / 2, 86, '#ffffff', 6)
    r.textCentered('A TRIBUTE TO JET SET WILLY', VIEW_W / 2, 136, '#a08ab8', 1)

    const opts = this.hasSave() ? ['CONTINUE', 'NEW GAME'] : ['NEW GAME']
    opts.forEach((o, i) => {
      const sel = i === this.menuIdx
      const blink = sel && Math.floor(this.globalT / 20) % 2 === 0
      r.textCentered(
        `${sel ? '> ' : '  '}${o}${sel ? ' <' : '  '}`,
        VIEW_W / 2, 170 + i * 16,
        blink ? '#ffffff' : sel ? '#ffe084' : '#8888a0', 1,
      )
    })

    // a little Willy marching across the bottom
    const wx = (this.globalT * 0.8) % (VIEW_W + 40) - 20
    const wf = this.bank.willyR[Math.floor(this.globalT / 8) % 2 === 0 ? 1 : 2]
    ctx.drawImage(wf, wx, 222)
    ctx.fillStyle = '#08080e'
    ctx.fillRect(0, 254, VIEW_W, 2)

    r.textCentered('ARROWS/WASD MOVE   Z/SPACE JUMP', VIEW_W / 2, 268, '#7a7a8e', 1)
    r.textCentered('DOWN + JUMP DROPS THROUGH PLATFORMS', VIEW_W / 2, 280, '#9a9ab0', 1)
    r.textCentered('ESC PAUSE   TAB MAP   N MUSIC', VIEW_W / 2, 292, '#7a7a8e', 1)
    r.textCentered(
      `M: PRACTICE MODE ${this.practice ? 'ON' : 'OFF'}`,
      VIEW_W / 2, 298, this.practice ? '#8ae08a' : '#55556a', 1,
    )
  }

  private renderGameOver(r: Renderer): void {
    r.clear('#08080c')
    r.textCentered('GAME OVER', VIEW_W / 2, 90, '#c0303a', 4)
    r.textCentered(
      `${this.collected.size} ITEMS   ${this.visited.size} ROOMS   ${this.deaths} DEATHS`,
      VIEW_W / 2, 150, '#a8a8b8', 1,
    )
    if (this.endTimer > 90)
      r.textCentered('PRESS ENTER', VIEW_W / 2, 200, '#ffffff', 1)
  }

  private renderEnding(r: Renderer): void {
    const ctx = r.ctx
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H)
    grad.addColorStop(0, '#1a1028')
    grad.addColorStop(1, '#3a2448')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)

    const pct = Math.floor((this.collected.size / Math.max(1, TOTAL_ITEMS)) * 100)
    r.textCentered('AT LAST...', VIEW_W / 2, 40, '#ffe084', 2)
    r.textCentered('WILLY MADE IT TO BED', VIEW_W / 2, 64, '#ffffff', 2)

    ctx.drawImage(this.bank.bed, 192, 110, 128, 64)
    // Willy lying on the bed
    ctx.save()
    ctx.translate(256, 122)
    ctx.rotate(-Math.PI / 2)
    ctx.drawImage(this.bank.willyR[0], -16, -8, 16, 32)
    ctx.restore()

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
