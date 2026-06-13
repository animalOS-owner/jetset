// A tiny WebAudio chiptune: square/triangle voices with note sequences,
// plus procedural SFX. All lazily initialised on the first user gesture.

export interface Voice {
  wave: OscillatorType
  gain: number
  /** [midiNote, lengthInSixteenths]; note 0 is a rest */
  notes: [number, number][]
}

export interface Tune {
  /** seconds per sixteenth note */
  sixteenth: number
  voices: Voice[]
}

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

interface VoiceRun {
  voice: Voice
  pos: number
  time: number
  total: number
}

const SETTINGS_KEY = 'jetset-manor-audio'

export class Chip {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicBus: GainNode | null = null // music routes here; SFX go to master
  private runs: VoiceRun[] = []
  private timer: number | null = null
  private current: Tune | null = null
  /** when true the music is silenced; sound effects still play */
  muted = false
  /** overall loudness, 0..1; scales the master bus (music + SFX) */
  volume = 0.6

  constructor() {
    // Restore the player's audio preferences from a previous session.
    try {
      const raw = localStorage.getItem(SETTINGS_KEY)
      if (raw) {
        const s = JSON.parse(raw) as { muted?: boolean; volume?: number }
        if (typeof s.muted === 'boolean') this.muted = s.muted
        if (typeof s.volume === 'number') this.volume = Math.max(0, Math.min(1, s.volume))
      }
    } catch {
      /* corrupt settings — fall back to defaults */
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ muted: this.muted, volume: this.volume }))
    } catch {
      /* storage unavailable — settings just won't persist */
    }
  }

  /** Must be called from a user-gesture handler at least once. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    this.ctx = new AudioContext()
    this.master = this.ctx.createGain()
    this.master.gain.value = this.volume
    this.master.connect(this.ctx.destination)
    this.musicBus = this.ctx.createGain()
    this.musicBus.gain.value = this.muted ? 0 : 1
    this.musicBus.connect(this.master)
    if (this.current) this.play(this.current)
  }

  /** Toggle music on/off (sound effects are unaffected). Returns muted state. */
  toggleMute(): boolean {
    this.muted = !this.muted
    if (this.musicBus) this.musicBus.gain.value = this.muted ? 0 : 1
    this.saveSettings()
    return this.muted
  }

  /** Nudge overall loudness by `delta` (clamped to 0..1) and persist it. */
  adjustVolume(delta: number): number {
    this.volume = Math.max(0, Math.min(1, Math.round((this.volume + delta) * 10) / 10))
    if (this.master) this.master.gain.value = this.volume
    this.saveSettings()
    return this.volume
  }

  play(tune: Tune): void {
    this.current = tune
    if (!this.ctx || !this.master) return
    this.stopMusic(false)
    const now = this.ctx.currentTime + 0.05
    this.runs = tune.voices.map((voice) => ({
      voice,
      pos: 0,
      time: now,
      total: voice.notes.reduce((n, [, l]) => n + l, 0),
    }))
    this.timer = setInterval(() => this.pump(tune), 60) as unknown as number
  }

  stopMusic(clearCurrent = true): void {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
    this.runs = []
    if (clearCurrent) this.current = null
  }

  private pump(tune: Tune): void {
    const ctx = this.ctx!
    const ahead = ctx.currentTime + 0.18
    for (const run of this.runs) {
      while (run.time < ahead) {
        const [note, len] = run.voice.notes[run.pos]
        const dur = len * tune.sixteenth
        if (note > 0) this.note(run.voice, note, run.time, dur)
        run.time += dur
        run.pos = (run.pos + 1) % run.voice.notes.length
      }
    }
  }

  private note(voice: Voice, midi: number, at: number, dur: number): void {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = voice.wave
    osc.frequency.value = midiHz(midi)
    const peak = voice.gain
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(peak, at + 0.01)
    g.gain.setValueAtTime(peak, at + Math.max(0.01, dur - 0.04))
    g.gain.linearRampToValueAtTime(0.0001, at + dur)
    osc.connect(g)
    g.connect(this.musicBus ?? this.master!)
    osc.start(at)
    osc.stop(at + dur + 0.02)
  }

  /** A pitch sweep through `freqs` over `dur` seconds. */
  private sweep(freqs: number[], dur: number, wave: OscillatorType, gain: number): void {
    if (!this.ctx || !this.master) return
    const ctx = this.ctx
    const at = ctx.currentTime
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = wave
    osc.frequency.setValueAtTime(freqs[0], at)
    freqs.forEach((f, i) => {
      if (i > 0) osc.frequency.linearRampToValueAtTime(f, at + (dur * i) / (freqs.length - 1))
    })
    g.gain.setValueAtTime(gain, at)
    g.gain.exponentialRampToValueAtTime(0.001, at + dur)
    osc.connect(g)
    g.connect(this.master)
    osc.start(at)
    osc.stop(at + dur + 0.02)
  }

  private noise(dur: number, gain: number): void {
    if (!this.ctx || !this.master) return
    const ctx = this.ctx
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
    src.connect(g)
    g.connect(this.master)
    src.start()
  }

  sfx(name: 'jump' | 'collect' | 'die' | 'flip' | 'menu' | 'win' | 'gameover'): void {
    switch (name) {
      case 'jump':
        this.sweep([220, 520], 0.12, 'square', 0.12)
        break
      case 'collect':
        this.sweep([660, 880, 1320], 0.14, 'square', 0.14)
        break
      case 'die':
        this.sweep([600, 80], 0.5, 'sawtooth', 0.18)
        this.noise(0.3, 0.1)
        break
      case 'flip':
        this.sweep([330, 392], 0.05, 'square', 0.06)
        break
      case 'menu':
        this.sweep([523, 659], 0.08, 'square', 0.1)
        break
      case 'win':
        this.sweep([523, 659, 784, 1047], 0.6, 'square', 0.15)
        break
      case 'gameover':
        this.sweep([392, 311, 233, 98], 1.2, 'triangle', 0.2)
        break
    }
  }
}
