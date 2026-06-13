import type { RoomDef } from '../../game/types.ts'
import { BEACH } from './beach.ts'
import { TOWER } from './tower.ts'
import { FINALE } from './finale.ts'
import { GARDENS } from './gardens.ts'
import { WESTWING } from './westwing.ts'
import { HALLS } from './halls.ts'
import { EASTWING } from './eastwing.ts'
import { ATTICS } from './attics.ts'
import { ROOFTOPS } from './rooftops.ts'
import { CELLARS } from './cellars.ts'
import { VAULTS } from './vaults.ts'
import { SEWERS } from './sewers.ts'

export const ALL_ROOMS: RoomDef[] = [
  ...BEACH, ...GARDENS, ...WESTWING, ...HALLS, ...EASTWING,
  ...ATTICS, ...ROOFTOPS, ...TOWER, ...FINALE,
  ...CELLARS, ...VAULTS, ...SEWERS,
]
