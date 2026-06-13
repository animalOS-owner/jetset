# Room Authoring Spec — Jetset Manor

Every room is a TypeScript `RoomDef` in `src/content/rooms/<zone>.ts`.
The validator (`src/tools/validate.ts`) hard-gates structural mistakes.
Follow this spec **mechanically** — especially edge contracts.

## Grid format

- `grid` is a `String.raw` template literal: 16 lines of exactly 32 chars.
  **Always `String.raw`** — plain template literals eat the `\` ramp char.
- Chars: `#` wall · `=` platform (one-way) · `/` ramp up-to-the-right ·
  `\` ramp down-to-the-right · `<` `>` conveyor (drags left/right) ·
  `*` hazard (deadly) · `~` water (deadly) · `i` item · `.` empty ·
  `A` `B` `C` zone decorations (background, safe) · `Z` bed (finale only).
- No spaces, no trailing whitespace. Use `.` for empty.

```ts
import type { RoomDef } from '../../game/types.ts'
const R = String.raw
export const MYZONE: RoomDef[] = [
  {
    id: 'the-kitchen', name: 'The Kitchen', zone: 'westwing', gx: 4, gy: 6,
    guardians: [{ type: 'chef', axis: 'h', a: 8, b: 18, at: 12, speed: 0.7 }],
    grid: R`
################################
... 14 more lines ...
################################`,
  },
]
```

## Physics facts (design within these)

- Willy is 1 cell wide, 2 cells tall (10x30 px hitbox).
- Jump: fixed arc, apex ~2.2 cells; lands on platforms up to **2 rows up**
  (needs 3 rows of clearance above the takeoff surface), clears gaps up to
  **3 columns**. No air control.
- Walking up/down uses **ramps** (45°). A 1-row step cannot be walked up —
  use ramps for walkable slopes, or platforms 1-2 rows apart for jump-stairs.
  **Ramps must be BARE diagonals**: one `/` or `\` per column over open space,
  floor below. Do NOT fill under or beside ramps with `#` — solid fill in the
  cell a ramp climbs into (its high side) or stacked directly above a ramp
  wedges Willy and makes the slope unwalkable. For a solid-looking hill use
  `/` up → short `=` flat top → `\` down, all bare. The validator rejects
  blocking fill and stacked ramps.
- **Falls within a room are survivable** (only a plummet through several
  rooms is fatal). Willy descends a platform stack with **down + jump** to
  drop through one-way platforms. Still avoid forcing blind multi-room drops.
- Conveyors drag Willy; he can only escape by jumping.
- Guardians kill on touch; they patrol on fixed paths (`axis` h/v, cells
  `a`..`b` inclusive, fixed `at` = top row for h / column for v, `speed`
  px/frame 0.4-1.2, optional `phase` px offset).

## Standard conventions

- **Floors**: rows 14-15 are `#` wherever the room has ground.
- **Side doors**: at every lateral neighbour, cells (edge col, rows 12+13)
  are `.` and the floor continues to the edge. Indoor zones: edge columns
  rows 0-11 are `#`. Outdoor zones (beach/gardens/rooftops/tower tops) may
  leave upper edge rows open ONLY if the neighbour's matching rows are open
  too — when in doubt, wall everything except rows 12-13.
- **No neighbour ⇒ sealed**: outer edges with no adjacent room must be
  fully walled (side cols all `#`; floor rows 14-15 `#` across). An open
  ceiling with no room above is allowed only if no support exists in rows
  1-3 under it (nothing to jump from).
- **Hazards**: never place `*` or `~` in columns 0-1 or 30-31, or anywhere
  in the two cells a door/shaft delivers Willy into. Hazards sit ON floors
  (`*` at row 13 above a row-14 floor, etc.).
- **Guardian fairness**: horizontal patrols keep `a >= 3`, `b <= 28`. Max
  3 guardians + 2 arrows per room. Arrows: `period >= 200`.
- **Items**: 1-2 per room (`i`), placed where the solver can reach (within
  3 cols / 2 rows up of a standable surface). They float mid-air fine.

## Vertical shafts (follow EXACTLY)

**DOWN shaft at cols c,c+1** (travel: upper room → lower room)
- Upper room: rows 14 AND 15 at c,c+1 are `.` (hole in the floor).
- Lower room: row 0 at c,c+1 is `.`, and a landing (`#` or `=` support)
  spans c,c+1 at **row 4 or higher** (rows 1-4), with the cells above it
  open. Falling further than row 4 kills.

**UP shaft at cols c,c+1** (travel: lower room → upper room)
- Lower room: a launch platform `=` at **row 1** spanning c,c+1; row 0 at
  c,c+1 is `.`; build jump-stairs/ramps inside the room to reach it.
- Upper room: `=` at **row 15** spanning c,c+1 (the arrival platform) and
  `.` at row 14 there. Place escape steps so Willy can climb from that
  row-15 platform back to the room's main floor (platforms 2 rows apart).
- A shaft is one-way. Two-way access = one UP shaft + one DOWN shaft at
  the different column pairs given in the contracts.

## The world lattice

```
gy\gx  0   1   2   3   4   5   6   7   8   9   10  11  12  13
 0     .   .   .   .   .   .   .   .   .   .   F   T   .   .
 1     .   .   .   .   .   .   .   .   .   .   T   T   T   .
 2     .   .   R   R   R   R   R   R   R   R   T   T   T   .
 3     N   .   A   A   A   A   A   A   A   A   A   T   G   G
 4     N   N   W   W   W   W   H   H   E   E   E   T   G   G
 5     Y   P   W   W   W   W   H   H   E   E   E   E   G   G
 6     J   D   G   G   K   K   H   H   E   E   G   G   G   G
 7     .   .   C   C   C   C   C   C   C   C   C   C   .   .
 8     .   .   V   V   V   V   V   V   V   V   V   V   .   .
 9     .   .   S   S   S   S   S   S   S   S   S   S   .   .
```

J/D/Y/P/N = beach · G = gardens · K/W = westwing · H = halls · E = eastwing
A = attics · R = rooftops · T = tower · F = finale · C = cellars ·
V = vaults (zone 'cellars') · S = sewers

Horizontal doors exist between **every** laterally adjacent pair, always at
rows 12-13. Vertical connections exist ONLY where contracted below.

## Vertical contracts (UP = jump up through; DOWN = drop through)

| Lower room (gx,gy) | Upper room (gx,gy) | UP cols | DOWN cols |
|---|---|---|---|
| the-jetty (0,6) | the-yacht (0,5) | 26-27 | 4-5 |
| the-yacht (0,5) | crows-nest (0,4) | 8-9 | 20-21 |
| crows-nest (0,4) | mast-top (0,3) | 15-16 | 24-25 |
| the-dunes (1,6) | cliff-path (1,5) | 28-29 | 14-15 |
| cliff-path (1,5) | gull-colony (1,4) | 6-7 | 22-23 |
| the-kitchen (4,6) | servants-stairs (4,5) | 3-4 | 10-11 |
| grand-staircase (7,6) | portrait-gallery (7,5) | 24-25 | 6-7 |
| servants-stairs (4,5) | west-corridor (4,4) | 27-28 | 14-15 |
| guest-bedroom (10,5) | clockwork-room (10,4) | 5-6 | 18-19 |
| marias-landing (11,5) | tower-door (11,4) | 8-9 | 24-25 |
| west-corridor (4,4) | cobweb-suite (4,3) | 20-21 | 8-9 |
| reading-room (9,4) | crawlspace (9,3) | 12-13 | 26-27 |
| boxes-of-regret (3,3) | loose-slates (3,2) | 16-17 | 6-7 |
| taxidermy (8,3) | east-gable (8,2) | 10-11 | 22-23 |
| trapdoor-room (10,3) | battlements (10,2) | 16-17 | 4-5 |
| tower-door (11,4) | spiral-stair (11,3) | 16-17 | 26-27 |
| spiral-stair (11,3) | clock-face (11,2) | 6-7 | 20-21 |
| clock-face (11,2) | counterweights (11,1) | 24-25 | 10-11 |
| counterweights (11,1) | the-belfry (11,0) | 14-15 | 26-27 |
| battlements (10,2) | bell-ropes (10,1) | 26-27 | 8-9 |
| flagpole (12,2) | gargoyle-perch (12,1) | 14-15 | 22-23 |
| greenhouse (12,6) | greenhouse-roof (12,5) | 20-21 | 8-9 |
| greenhouse-roof (12,5) | dovecote (12,4) | 5-6 | 26-27 |
| dovecote (12,4) | aviary (12,3) | 24-25 | 10-11 |
| aviary (12,3) | flagpole (12,2) | 8-9 | 27-28 |
| the-orchard (13,6) | treehouse (13,5) | 12-13 | 24-25 |
| treehouse (13,5) | the-folly (13,4) | 26-27 | 6-7 |
| the-folly (13,4) | folly-top (13,3) | 8-9 | 20-21 |
| coal-hole (4,7) | the-kitchen (4,6) | 16-17 | 28-29 |
| echoing-vault (9,7) | the-library (9,6) | 26-27 | 16-17 |
| forgotten-stair (11,7) | topiary (11,6) | 6-7 | 20-21 |
| family-silver (3,8) | vintage-whines (3,7) | 24-25 | 10-11 |
| smugglers-rest (8,8) | a-dungeon (8,7) | 6-7 | 24-25 |
| flow-control (5,9) | the-ice-house (5,8) | 26-27 | 14-15 |
| the-outfall (10,9) | ossuary (10,8) | 18-19 | 6-7 |

A room's full contract = its side doors (rows 12-13, from the lattice) plus
every shaft above where it appears in either column. **Both rooms of every
pair must implement their half exactly.**

## Zone guardian types

beach: crab, gull · gardens: gardener, bee · westwing: chef, knife, flame ·
halls: butler, ghost, flame · eastwing: maid, book · attics: bat, spider ·
rooftops: crow, sweep · tower: knight, orb · cellars/vaults: rat, ghost, bat ·
sewers: slime, rat · maria: ONLY in marias-landing.

Ropes (sparingly, in `ropes: [{x, len, top?, amp?, period?, phase?}]`):
suggested in the-yacht, ballroom, water-tank, treehouse, bell-ropes,
underground-lake. Don't hang ropes through shafts or doors.

Tone for `name`s: dry British absurdism. Never reuse original JSW room names.
