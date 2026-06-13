import { Renderer } from './engine/renderer.ts'
import { Input } from './engine/input.ts'
import { Chip } from './engine/audio.ts'
import { startLoop } from './engine/loop.ts'
import { buildBank } from './game/gfx.ts'
import { Game } from './game/game.ts'

const canvas = document.getElementById('game') as HTMLCanvasElement
const renderer = new Renderer(canvas)
const input = new Input()
const chip = new Chip()
const bank = buildBank()
const game = new Game(input, chip, bank)

// Browsers require a user gesture before audio can start.
const unlock = () => chip.unlock()
addEventListener('keydown', unlock, { once: false })
addEventListener('pointerdown', unlock, { once: false })

startLoop(
  () => game.update(),
  () => game.render(renderer),
)
