import { ROOM_DEFS, START } from '../src/content/world.ts'
import { validateWorld } from '../src/tools/validate.ts'

const rep = validateWorld(ROOM_DEFS, START.room)
console.log(`rooms: ${rep.rooms}   items: ${rep.items}`)
if (rep.warnings.length) {
  console.log(`\n${rep.warnings.length} warnings:`)
  for (const w of rep.warnings) console.log(`  warn: ${w}`)
}
if (rep.errors.length) {
  console.log(`\n${rep.errors.length} errors:`)
  for (const e of rep.errors) console.log(`  ERROR: ${e}`)
  process.exit(1)
}
console.log('\nvalidation clean')
