// Tile kinds, stored per-cell in a Uint8Array.
export const T = {
  EMPTY: 0,
  WALL: 1, // fully solid
  PLATFORM: 2, // one-way: stand on top, jump through from below
  RAMP_UP: 3, // '/' surface rises left-to-right
  RAMP_DOWN: 4, // '\' surface falls left-to-right
  CONV_L: 5, // conveyor dragging left (one-way platform)
  CONV_R: 6, // conveyor dragging right
  HAZARD: 7, // static killer, zone-styled (spikes / fire / plants ...)
  WATER: 8, // deadly water/ooze surface
  DECO_A: 9, // background decoration, non-interactive, zone-styled
  DECO_B: 10,
  DECO_C: 11,
  BED: 12, // the end-state trigger (finale room only)
} as const
export type Tile = (typeof T)[keyof typeof T]

export type Dir = 'left' | 'right' | 'up' | 'down'

export interface GuardianDef {
  /** sprite key, e.g. 'crab', 'butler', 'maria' */
  type: string
  axis: 'h' | 'v'
  /** patrol range in cells (inclusive), along the axis */
  a: number
  b: number
  /** the fixed coordinate in cells: row for 'h', column for 'v' */
  at: number
  /** px per frame, typical 0.4 - 1.5 */
  speed: number
  /** starting offset along the patrol, in px */
  phase?: number
}

export interface RopeDef {
  /** anchor column (cells); anchor hangs from the top of that cell */
  x: number
  /** anchor row (cells), default 0 */
  top?: number
  /** length in cells */
  len: number
  /** max swing angle in radians (default 0.55) */
  amp?: number
  /** swing period in frames (default 220) */
  period?: number
  phase?: number
}

export interface ArrowDef {
  /** row the arrow flies along */
  y: number
  dir: 1 | -1
  /** frames between launches */
  period: number
  offset?: number
  /** px per frame (default 4) */
  speed?: number
}

export interface RoomDef {
  id: string
  name: string
  zone: string
  /** position on the world lattice; exits derive from adjacency */
  gx: number
  gy: number
  /** 16 rows x 32 cols of legend characters */
  grid: string
  guardians?: GuardianDef[]
  ropes?: RopeDef[]
  arrows?: ArrowDef[]
}

export interface ItemSpot {
  id: string // roomId:n — keys the global collected set
  col: number
  row: number
}

export interface Room {
  def: RoomDef
  tiles: Uint8Array // COLS*ROWS, values from T
  items: ItemSpot[]
}

export interface InputState {
  left: boolean
  right: boolean
  up: boolean
  down: boolean
  jump: boolean
  jumpHit: boolean // pressed this frame
}

export interface RopeRide {
  index: number
  /** distance along the rope, px from anchor */
  s: number
}

export interface Player {
  x: number // hitbox left, px
  y: number // hitbox top, px
  vy: number
  airVx: number // locked horizontal velocity while airborne
  onGround: boolean
  jumping: boolean // airborne due to a jump (walk-offs fall straight down)
  facing: 1 | -1
  frame: number // walk animation accumulator
  apexY: number // highest point of current airtime, for fall-death
  rope: RopeRide | null
  ropeCooldown: number
  grace: number // full invulnerability frames (respawn)
  entryGrace: number // guardian-only grace frames (room entry)
}

export type StepEvent =
  | { kind: 'die'; cause: string }
  | { kind: 'item'; id: string }
  | { kind: 'exit'; dir: Dir }
  | { kind: 'win' }
  | { kind: 'jump' }
