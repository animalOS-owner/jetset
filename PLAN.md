# Jetset Manor — Build Plan

A loving homage to *Jet Set Willy* (1984): a flip-screen, room-based platformer with
upgraded HD pixel-art graphics, an all-new 100+ room mansion, and the original's
rigid, committed jump-arc feel.

## Locked decisions

| Decision | Choice |
|---|---|
| Tech | TypeScript + HTML5 Canvas 2D, Vite, WebAudio. Zero runtime deps. |
| Camera | Flip-screen: every room is exactly one screen; exits flip instantly. |
| Graphics | HD pixel art: 32 px tiles, per-zone palettes, multi-frame animation. |
| World | All-new 100+ room mansion in the spirit of the original (zones, absurd room names) — no copied layouts or names. |
| Goal | Reach the end state (the Master Bedroom at the top of the final ascent). Collectibles are optional, tracked as completion %; 100% gives a special ending. |

## Core mechanics (true to the original)

- **Movement**: constant walk speed left/right; **fixed-arc jump** — once airborne the
  arc is committed (precomputed arc table, like the original), no air control.
- **Ramps/stairs**: walk into them to ascend; jump through them to pass.
- **Ropes**: swinging ropes you grab, climb, and dismount with a jump.
- **Conveyors**: push Willy while he stands on them.
- **Hazards**: static killers (spikes, fires, plants) and **guardians** — monsters on
  fixed, deterministic patrol paths (horizontal, vertical, arc), plus timed arrows
  that streak across certain rooms.
- **Fall damage**: falling beyond a threshold height is fatal.
- **Lives & death**: 8 lives; on death Willy respawns at the point he entered the room.
- **Maria**: blocks a key shortcut corridor; the long way round is the real route.
- **Modern fixes** (the original's infamous flaws, solved):
  - The build-time validator forbids any spawn-into-death placement.
  - Death-loop rescue: 3 deaths within ~2 s rewinds Willy to the previous room.
  - Autosave to localStorage (visited rooms, items, lives, position).

## Architecture

```
jetset/
  index.html
  src/
    main.ts
    engine/        # fixed-timestep loop, input (keyboard+gamepad), canvas renderer,
                   # sprite atlas builder, WebAudio chiptune synth
    game/          # player physics, guardians, room runtime, flip transitions,
                   # items, HUD, save, title/ending screens
    content/
      world.ts     # master lattice: room id -> (gx, gy) grid coordinate + zone
      rooms/       # one file per room, grouped by zone
      art/         # palette + pixel data for tiles/sprites (compiled to atlases)
      music/       # note-event tracks (public-domain classical arrangements)
  tools/           # validate-map.ts, render-map.ts (whole-mansion PNG/SVG)
  tests/           # vitest: physics, determinism, full map validation, walkthrough bot
```

- **Logic**: fixed 60 Hz timestep; tile-quantised collision for the rigid JSW feel.
- **Determinism**: guardian positions are pure functions of room-time → replayable,
  testable, no drift.
- **Virtual resolution**: room playfield is a 32×16 cell grid at 32 px/cell
  (1024×512) plus a HUD strip; integer-scaled to fit the window.
- **Art pipeline**: pixel art authored as palette-indexed data in `content/art/`,
  compiled to offscreen-canvas atlases at boot. Willy is 32×64 (1×2 cells).
- **Audio**: 3-channel chiptune synth (pulse/triangle/noise). Title: Moonlight
  Sonata; in-game: In the Hall of the Mountain King (public-domain compositions,
  our own arrangements) plus per-zone variations. SFX: jump, item, death, flip.

## Spatial correctness — the world lattice

This is the heart of the 100-room requirement. Rooms are **not** hand-wired to each
other; they are placed on a master grid in `world.ts`:

- Each room occupies one `(gx, gy)` coordinate on a ~14×9 lattice (~100–110 cells used).
- Exits are **derived from adjacency**: walking off the right edge of the room at
  `(3,5)` puts you in the room at `(4,5)`, entering at the **same row** on its left
  edge. Vertical exits go to `(gx, gy±1)` preserving the **column**. Geometry cannot
  be wired wrong, because there is no wiring.
- Rare deliberate quirks (a teleporting door, a one-way drop) need an explicit
  `override` flag — exceptional, visible, and validated.

**Build-time validator** (runs in CI/vitest over every room file):
1. Every edge cell Willy can walk or fall through leads to an existing room.
2. The arrival cell in the neighbour (same row/column) is non-solid and non-lethal —
   simulated for every transferable edge cell, both directions.
3. Entry points can never spawn into a kill.
4. BFS from the start room: all rooms reachable, end room reachable, dead ends flagged.
5. `tools/render-map.ts` outputs a picture of the whole mansion so layout problems
   are visible at a glance.

A scripted-input **walkthrough bot** replays a recorded route from the start room to
the Master Bedroom in a headless sim, proving the game is completable on every commit.

## Room file format

Each room is an ASCII grid (32×16) plus a small header — fast to author, easy to
review, and 100+ rooms stay manageable:

```
id: cold-store-of-doom
name: "The Cold Store of Doom"
zone: west-wing
palette: frost
guardians:
  - { type: penguin, path: h, x1: 6, x2: 18, y: 12, speed: 2, phase: 0 }
  - { type: icicle,  path: v, x: 24, y1: 2, y2: 10, speed: 3, phase: 8 }
grid: |
  ################################
  #..............................#
  #...i......===........i........#
  ...
legend: # wall, = platform, / \ ramps, < > conveyors, * hazard, i item,
        | rope, . empty, plus per-zone decoration glyphs
```

## The mansion (~10 zones × ~10 rooms ≈ 105 rooms)

West to east, bottom to top on the lattice:

1. **The Beach & Jetty** — outdoor start of the west map; the Yacht moored beyond.
2. **The Gardens & Drive** — hedges, fountains, a deadly gardener.
3. **The Cellars & Sewers** — running beneath the whole mansion; dark palette.
4. **The West Wing** — kitchens, cold store, pantries, scullery.
5. **The Grand Halls** — ballroom, chapel, dining hall, portrait gallery.
6. **The East Wing** — guest bedrooms, bathrooms, library, study.
7. **The Attics** — cramped, junk-filled, maze-like.
8. **The Rooftops** — chimneys, weathervanes, long exposed jumps.
9. **The Tower** — the final vertical ascent, hardest rooms in the game.
10. **The Master Bedroom** — the end state. Maria guards the shortcut from the Halls.

Room names follow the original's absurdist tradition (all-new, e.g. "We Apologise for
the Inconvenience", "Dr Jones Will Never Believe This" — to be written per room).
~150 optional glowing items scattered for completionists.

## HUD & QoL

Room-name banner (bottom, big type, per the original), item counter + %, lives shown
as marching Willys, ticking mantel clock for flavour. Pause, settings (volume,
optional infinite-lives toggle), in-game map of visited rooms, autosave/continue.

## Milestones

1. **M1 — Engine core**: loop, input, renderer, tile collision, Willy physics
   (walk/jump/fall-death), 3 test rooms with working flips. *Playable.*
2. **M2 — Full mechanics**: ramps, conveyors, ropes, guardians, arrows, hazards,
   items, lives/respawn, Maria, HUD.
3. **M3 — Content pipeline**: room format + parser, world lattice, validator,
   map renderer, autosave.
4. **M4 — Art & audio**: HD pixel tile/sprite sets per zone, animations, particles,
   chiptune engine + tracks.
5. **M5 — The Mansion**: author all 10 zones / 100+ rooms; validator green;
   walkthrough bot completes start → Master Bedroom.
6. **M6 — Polish**: title screen, two endings (any% / 100%), difficulty tuning,
   map screen, final static build.

## Defaults assumed (flag if wrong)

- Controls: arrow keys / WASD + Z or Space to jump; gamepad supported.
- Working title **“Jetset Manor”** (easily changed).
- Ships as a static site (`vite build`) — playable locally or hostable anywhere.
