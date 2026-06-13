import type { Tune } from '../../engine/audio.ts'

// Public-domain compositions, our own chiptune arrangements — the same
// pieces the 1984 original used.

// Beethoven, Moonlight Sonata (1st movement) — title screen.
// Slow C#-minor triplet arpeggios over a deep bass.
const ms = (...triples: number[][]): [number, number][] =>
  triples.flatMap(([a, b, c]) => [
    [a, 2], [b, 2], [c, 2], [a, 2], [b, 2], [c, 2],
  ] as [number, number][])

export const MOONLIGHT: Tune = {
  sixteenth: 0.11,
  voices: [
    {
      wave: 'triangle',
      gain: 0.22,
      notes: ms(
        [56, 61, 64], [56, 61, 64],
        [56, 61, 64], [56, 61, 64],
        [57, 61, 64], [57, 61, 66],
        [56, 60, 63], [56, 59, 63],
      ),
    },
    {
      wave: 'sine',
      gain: 0.25,
      notes: [
        [37, 12], [37, 12], [37, 12], [37, 12],
        [33, 12], [30, 12], [32, 12], [32, 12],
      ],
    },
  ],
}

// Grieg, In the Hall of the Mountain King — in-game loop, in E minor.
const E = 52
function riff(base: number): [number, number][] {
  const n = (s: number, l = 2): [number, number] => [base + s, l]
  return [
    n(12), n(14), n(15), n(17), n(19), n(15), n(19, 4),
    n(18), n(14), n(18, 4), n(17), n(13), n(17, 4),
    n(12), n(14), n(15), n(17), n(19), n(15), n(19), n(24),
    n(22), n(19), n(15), n(19), n(22, 6), [0, 2],
  ]
}

export const MOUNTAIN_KING: Tune = {
  sixteenth: 0.085,
  voices: [
    {
      wave: 'square',
      gain: 0.1,
      notes: [...riff(E), ...riff(E), ...riff(E + 12), ...riff(E + 12)],
    },
    {
      wave: 'triangle',
      gain: 0.2,
      notes: Array.from({ length: 4 }).flatMap(() => [
        [E - 12, 4], [E - 5, 4], [E - 12, 4], [E - 5, 4],
        [E - 12, 4], [E - 5, 4], [E - 12, 4], [E - 5, 4],
        [E - 12, 4], [E - 5, 4], [E - 12, 4], [E - 5, 4],
        [E - 10, 4], [E - 3, 4], [E - 11, 4], [E - 4, 4],
      ] as [number, number][]),
    },
  ],
}

// Satie, Gymnopédie No.1 — the gentle outdoor zones (beach, gardens).
export const GYMNOPEDIE: Tune = {
  sixteenth: 0.13,
  voices: [
    {
      wave: 'triangle',
      gain: 0.18,
      notes: [
        [0, 8], [78, 4], [76, 4], [78, 4], [73, 12],
        [0, 8], [78, 4], [76, 4], [78, 4], [73, 8], [74, 4],
        [76, 4], [74, 4], [73, 4], [69, 12], [0, 4],
        [66, 16], [0, 8],
      ],
    },
    {
      wave: 'sine',
      gain: 0.22,
      notes: [
        [43, 8], [50, 8], [43, 8], [50, 8],
        [43, 8], [50, 8], [43, 8], [50, 8],
        [40, 8], [47, 8], [42, 8], [50, 8],
        [43, 8], [50, 8],
      ],
    },
  ],
}

/** Zones that play the outdoor tune; everything else gets Mountain King. */
export const OUTDOOR_ZONES = new Set(['beach', 'gardens', 'rooftops'])
