# Jetset Manor

A loving homage to *Jet Set Willy* (1984) — a flip-screen, room-based platformer
with upgraded HD pixel-art graphics and an all-new mansion of **100+ connected
rooms**. Built with TypeScript and HTML5 Canvas; no game engine, no runtime
dependencies.

Willy is home from the party of the century. All he wants is his bed — which
would be simpler if his bed weren't at the very top of the tower, past the
cellars, the kitchens, the attics, the rooftops, and everything that patrols
them. The glowing items scattered through the mansion are optional: tidy up
for the 100% ending, or just survive the journey.

## Run it

```bash
npm install
npm run dev      # dev server -> http://localhost:5173
npm run build    # static production build in dist/
npm test         # physics tests + full world validation
node tools/render-map.ts   # draws the whole mansion to map.svg
```

## Controls

| Key | Action |
| --- | ------ |
| ← → / A D | walk |
| Z / Space | jump (the arc is committed — choose wisely) |
| ↑ ↓ / W S | climb ropes |
| Tab / M | map of discovered rooms |
| Esc / P | pause |
| N | sound on/off |
| M (title screen) | practice mode (infinite lives) |

A gamepad works too. Progress autosaves on every room change.

## The rules of the house

- One screen per room; walking off an edge flips to the neighbouring room.
- The jump arc is fixed at takeoff, exactly like 1984. Walking off a ledge
  drops you straight down.
- Falling more than six rows is fatal — and fall distance carries across rooms.
- Guardians patrol fixed deterministic paths. Learn them.
- Death returns you to where you entered the room. Unlike the original,
  three quick deaths in one room rewinds you to the previous room instead of
  eating your whole stock of lives, and respawns can never kill you instantly.
- Maria guards the shortcut to the tower. The long way round is the real way.

## How the world stays consistent

Rooms live on a single lattice (`docs/ROOMSPEC.md`): each room occupies a grid
coordinate and exits derive from adjacency, so a door on one side is always a
door on the other, at the same rows. A build-time validator
(`src/tools/validate.ts`, run as part of `npm test`) simulates every possible
edge crossing in both directions, rejects spawn-into-death placements, BFS-
checks that every room and the ending are reachable, and lints every room for
dead-trap entrances and unreachable items.

## Tech notes

- 60 Hz fixed-timestep logic, tile-quantised collision for the rigid JSW feel.
- All art is generated at boot from palette-indexed pixel maps and procedural
  painters (`src/game/gfx.ts`) — there are no binary assets in the repo.
- Music is a 3-voice WebAudio chiptune playing the same public-domain pieces
  the original used: Moonlight Sonata on the title, In the Hall of the
  Mountain King indoors, with Satie's Gymnopédie No. 1 outdoors.
- Rooms are authored as 32x16 ASCII grids (`src/content/rooms/`), one file
  per zone. See `docs/ROOMSPEC.md` for the authoring spec.
