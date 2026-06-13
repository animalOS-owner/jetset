// All gameplay logic runs at a virtual resolution of 512x320:
// a 32x16 grid of 16px cells (the playfield) over a 64px HUD strip.
// The renderer integer-scales this to the window.

export const CELL = 16
export const COLS = 32
export const ROWS = 16
export const ROOM_W = COLS * CELL // 512
export const ROOM_H = ROWS * CELL // 256
export const HUD_H = 64
export const VIEW_W = ROOM_W
export const VIEW_H = ROOM_H + HUD_H

export const FPS = 60
export const STEP_MS = 1000 / FPS

// Willy's hitbox. The sprite is 16x32; the box is slightly inset for fairness.
export const P_W = 10
export const P_H = 30
export const SPRITE_OX = -3 // sprite x offset relative to hitbox x
export const SPRITE_OY = -2

// Physics (px per frame at 60fps). The jump arc is committed at takeoff:
// horizontal velocity is locked, exactly like the original.
export const WALK = 1.25
export const GRAVITY = 0.18
export const JUMP_VY = 3.65 // apex ~35px: lands on platforms 2 cells up, never 3
export const MAX_FALL = 4
export const FALL_DEATH = 96 // falling more than 6 cells is fatal

export const START_LIVES = 8
export const SPAWN_GRACE = 50 // frames of invulnerability after a respawn
export const ENTRY_GRACE = 24 // guardian-only grace when entering a room
export const DEATH_ANIM = 48 // frames of death animation
export const ROPE_REGRAB = 20 // frames before a released rope can re-grab

// Death-loop rescue: this many deaths in one room without leaving it
// rewinds Willy to the previous room (fixes the original's infamous bug).
export const RESCUE_DEATHS = 3
