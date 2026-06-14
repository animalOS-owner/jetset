// Visual identity of each zone: colors, wall texture, hazard style, the A/B/C
// decoration glyphs, and — for the graphic overhaul — the backdrop scene,
// ambient weather, and lighting mood that drive the atmosphere systems.

export type WallStyle =
  | 'brick' | 'stone' | 'planks' | 'panel' | 'rock' | 'slate' | 'timber' | 'tile'
export type HazardStyle = 'spikes' | 'fire' | 'plant' | 'shard' | 'sludge'
export type DecoKind =
  | 'barrel' | 'portrait' | 'bookshelf' | 'torch' | 'window' | 'clock'
  | 'fern' | 'anchor' | 'shell' | 'chimney' | 'lamp' | 'cobweb' | 'crate'
  | 'armour' | 'pipe' | 'candle'

/** Backdrop painter used for a zone's room background. */
export type SceneKind =
  | 'seaside' | 'garden' | 'cellar' | 'sewer' | 'interior'
  | 'attic' | 'rooftop' | 'tower' | 'bedroom'

/** Drifting ambient particle weather layered over a room. */
export type AmbientKind =
  | 'none' | 'dust' | 'embers' | 'snow' | 'drip' | 'spray' | 'pollen' | 'rain'

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
  // --- overhaul: atmosphere ---
  scene: SceneKind
  /** 0 = full daylight, 1 = pitch black; drives the lighting pass. */
  dark: number
  /** tint of light pools cast by emitters in this zone (#rrggbb). */
  light: string
  /** tint of the darkness itself (#rrggbb), usually a deep version of the sky. */
  shadow: string
  ambient: AmbientKind
}

/** Deco kinds that cast warm light in a dark room. */
export const WARM_EMITTERS = new Set<DecoKind>(['torch', 'candle', 'lamp'])
/** Deco kinds that cast cool light (moonlight/glow from outside). */
export const COOL_EMITTERS = new Set<DecoKind>(['window'])

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
    scene: 'seaside', dark: 0, light: '#fff2c8', shadow: '#16344f', ambient: 'spray',
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
    scene: 'garden', dark: 0.04, light: '#fff0bc', shadow: '#123a26', ambient: 'pollen',
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
    scene: 'cellar', dark: 0.82, light: '#ffb24a', shadow: '#070509', ambient: 'dust',
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
    scene: 'sewer', dark: 0.74, light: '#ffac4a', shadow: '#04100a', ambient: 'drip',
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
    scene: 'interior', dark: 0.5, light: '#ffcf86', shadow: '#16101e', ambient: 'embers',
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
    scene: 'interior', dark: 0.46, light: '#ffdf9c', shadow: '#1a0f22', ambient: 'dust',
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
    scene: 'interior', dark: 0.42, light: '#cfe2ff', shadow: '#0c1426', ambient: 'dust',
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
    scene: 'attic', dark: 0.62, light: '#ffd58a', shadow: '#0d0a08', ambient: 'dust',
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
    scene: 'rooftop', dark: 0.34, light: '#dce6ff', shadow: '#0a0e1c', ambient: 'rain',
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
    scene: 'tower', dark: 0.46, light: '#cfeaff', shadow: '#07060f', ambient: 'snow',
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
    scene: 'bedroom', dark: 0.4, light: '#ffe0b0', shadow: '#160c1c', ambient: 'dust',
  },
}
