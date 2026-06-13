import { ALL_ROOMS } from '../src/content/rooms/index.ts'
for (const def of ALL_ROOMS) {
  const lines = def.grid.split('\n').filter((l) => l.trim().length > 0)
  if (lines.length !== 16) console.log(`${def.id}: ${lines.length} rows`)
  lines.forEach((l, i) => {
    if (l.length !== 32) console.log(`${def.id} row ${i}: len ${l.length}  [${l}]`)
  })
}
console.log('done')
