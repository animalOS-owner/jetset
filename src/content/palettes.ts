// Visual identity of each zone: colors, wall texture, hazard style, and
// what the A/B/C decoration glyphs mean there.

export type WallStyle =
  | 'brick' | 'stone' | 'planks' | 'panel' | 'rock' | 'slate' | 'timber' | 'tile'
export type HazardStyle = 'spikes' | 'fire' | 'plant' | 'shard' | 'sludge'
export type DecoKind =
  | 'barrel' | 'portrait' | 'bookshelf' | 'torch' | 'window' | 'clock'
  | 'fern' | 'anchor' | 'shell' | 'chimney' | 'lamp' | 'cobweb' | 'crate'
  | 'armour' | 'pipe' | 'candle'

export interface ZoneStyle {
  title: string
  sky: [string, string]
  wall: string
  wallStyle: WallStyle
  platform: string
  hazard: HazardStyle
  hazardColor: string
  water: string
  deco: [DecoKind, DecoKind, DecoKind]
  banner: string
}

export const ZONES: Record<string, ZoneStyle> = {
  beach: {
    title: 'The Beach',
    sky: ['#3fa7d6', '#a8e0ef'],
    wall: '#c2974f', wallStyle: 'rock',
    platform: '#e3c478',
    hazard: 'shard', hazardColor: '#e8e4d8',
    water: '#1f6fb2',
    deco: ['anchor', 'shell', 'crate'],
    banner: '#ffe9a8',
  },
  gardens: {
    title: 'The Gardens',
    sky: ['#2c8c5e', '#9fd98a'],
    wall: '#7a8a4a', wallStyle: 'stone',
    platform: '#4e9e44',
    hazard: 'plant', hazardColor: '#3fae37',
    water: '#2f7fae',
    deco: ['fern', 'lamp', 'crate'],
    banner: '#d2f5b0',
  },
  cellars: {
    title: 'The Cellars',
    sky: ['#17141f', '#2b2436'],
    wall: '#5a4a3a', wallStyle: 'brick',
    platform: '#8a6a48',
    hazard: 'spikes', hazardColor: '#b8c0cc',
    water: '#3a5a4a',
    deco: ['barrel', 'torch', 'cobweb'],
    banner: '#e8b86a',
  },
  sewers: {
    title: 'The Sewers',
    sky: ['#101a16', '#1d3328'],
    wall: '#3c5a50', wallStyle: 'tile',
    platform: '#5d8a78',
    hazard: 'sludge', hazardColor: '#7ab83a',
    water: '#4a7a2a',
    deco: ['pipe', 'torch', 'cobweb'],
    banner: '#a8e088',
  },
  westwing: {
    title: 'The West Wing',
    sky: ['#2a2030', '#473a52'],
    wall: '#8a5a3a', wallStyle: 'timber',
    platform: '#b8824a',
    hazard: 'fire', hazardColor: '#f0883a',
    water: '#355a8a',
    deco: ['barrel', 'window', 'crate'],
    banner: '#ffd9a0',
  },
  halls: {
    title: 'The Grand Halls',
    sky: ['#33203a', '#5a3a64'],
    wall: '#7a4a6a', wallStyle: 'panel',
    platform: '#b08a58',
    hazard: 'fire', hazardColor: '#f0a03a',
    water: '#355a8a',
    deco: ['portrait', 'candle', 'clock'],
    banner: '#f5d2ee',
  },
  eastwing: {
    title: 'The East Wing',
    sky: ['#1d2a42', '#3a527a'],
    wall: '#4a5a8a', wallStyle: 'panel',
    platform: '#8a9ac2',
    hazard: 'spikes', hazardColor: '#cdd6e4',
    water: '#355a8a',
    deco: ['bookshelf', 'window', 'clock'],
    banner: '#cfe0ff',
  },
  attics: {
    title: 'The Attics',
    sky: ['#241a14', '#42332a'],
    wall: '#6a5238', wallStyle: 'planks',
    platform: '#9a7a52',
    hazard: 'spikes', hazardColor: '#a8a8b0',
    water: '#355a8a',
    deco: ['crate', 'cobweb', 'lamp'],
    banner: '#e8cf9a',
  },
  rooftops: {
    title: 'The Rooftops',
    sky: ['#1a2238', '#4a3a6a'],
    wall: '#4f4658', wallStyle: 'slate',
    platform: '#7a7090',
    hazard: 'shard', hazardColor: '#b8c8d8',
    water: '#355a8a',
    deco: ['chimney', 'window', 'lamp'],
    banner: '#d8d2f0',
  },
  tower: {
    title: 'The Tower',
    sky: ['#140f1e', '#33203f'],
    wall: '#5a5a72', wallStyle: 'stone',
    platform: '#8a8ab0',
    hazard: 'shard', hazardColor: '#a8e0e8',
    water: '#355a8a',
    deco: ['armour', 'torch', 'window'],
    banner: '#b8e8f0',
  },
  finale: {
    title: 'The Master Bedroom',
    sky: ['#2a1a30', '#52385c'],
    wall: '#7a5a8a', wallStyle: 'panel',
    platform: '#b89a68',
    hazard: 'spikes', hazardColor: '#cdd6e4',
    water: '#355a8a',
    deco: ['portrait', 'candle', 'window'],
    banner: '#ffd2f0',
  },
}
