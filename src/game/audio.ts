import type { PlayerSettings } from "./settings";

export type SoundCue = "hit" | "swing" | "build" | "sale" | "wave" | "boss" | "towerAlarm" | "ui";

interface AudioDebugState {
  supported: boolean;
  unlocked: boolean;
  muted: boolean;
  effectiveVolume: number;
  lastCue: SoundCue | null;
  counts: Record<SoundCue, number>;
}

const EMPTY_COUNTS: Record<SoundCue, number> = {
  hit: 0,
  swing: 0,
  build: 0,
  sale: 0,
  wave: 0,
  boss: 0,
  towerAlarm: 0,
  ui: 0,
};

export class ProceduralAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private noiseBuffer?: AudioBuffer;
  private settings: PlayerSettings;
  private lastCue: SoundCue | null = null;
  private readonly counts = { ...EMPTY_COUNTS };

  constructor(settings: PlayerSettings) {
    this.settings = { ...settings };
    this.publishDebug();
  }

  async unlock(): Promise<void> {
    const context = this.ensureContext();
    if (!context) return;
    if (context.state === "suspended") {
      try {
        await context.resume();
      } catch {
        // 瀏覽器可能仍在等待使用者手勢；下次互動會重試。
      }
    }
    this.publishDebug();
  }

  updateSettings(settings: PlayerSettings): void {
    this.settings = { ...settings };
    if (this.context && this.master) {
      const now = this.context.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(this.effectiveVolume(), now, 0.012);
    }
    this.publishDebug();
  }

  play(cue: SoundCue): void {
    this.counts[cue] += 1;
    this.lastCue = cue;
    this.publishDebug();
    if (this.settings.muted || this.effectiveVolume() <= 0.0001) return;
    const context = this.ensureContext();
    if (!context || !this.master) return;
    if (context.state === "suspended") void context.resume().catch(() => undefined);
    const at = context.currentTime + 0.008;
    switch (cue) {
      case "ui":
        this.tone("sine", 510, 690, at, 0.055, 0.08);
        break;
      case "swing":
        this.noise(at, 0.13, 0.11, 1100, 0.8);
        this.tone("sawtooth", 210, 82, at, 0.14, 0.09);
        break;
      case "hit":
        this.tone("square", 118, 64, at, 0.11, 0.14);
        this.noise(at, 0.075, 0.15, 430, 1.25);
        break;
      case "build":
        this.tone("triangle", 220, 250, at, 0.09, 0.08);
        this.tone("triangle", 330, 370, at + 0.075, 0.1, 0.07);
        this.tone("triangle", 440, 510, at + 0.15, 0.14, 0.07);
        break;
      case "sale":
        this.tone("sine", 660, 760, at, 0.1, 0.08);
        this.tone("sine", 880, 1040, at + 0.075, 0.16, 0.07);
        break;
      case "wave":
        this.tone("sawtooth", 230, 180, at, 0.22, 0.09);
        this.tone("sawtooth", 190, 145, at + 0.2, 0.25, 0.1);
        break;
      case "boss":
        this.tone("sawtooth", 92, 43, at, 0.72, 0.18);
        this.noise(at + 0.04, 0.55, 0.11, 180, 1.6);
        break;
      case "towerAlarm":
        this.tone("square", 620, 560, at, 0.12, 0.08);
        this.tone("square", 460, 420, at + 0.16, 0.14, 0.09);
        break;
    }
  }

  private ensureContext(): AudioContext | undefined {
    if (this.context) return this.context;
    if (typeof AudioContext === "undefined") {
      this.publishDebug();
      return undefined;
    }
    try {
      this.context = new AudioContext({ latencyHint: "interactive" });
      this.master = this.context.createGain();
      this.master.gain.value = this.effectiveVolume();
      this.master.connect(this.context.destination);
      this.noiseBuffer = this.createNoiseBuffer(this.context);
      this.publishDebug();
      return this.context;
    } catch {
      return undefined;
    }
  }

  private effectiveVolume(): number {
    return this.settings.muted ? 0 : this.settings.masterVolume * this.settings.sfxVolume;
  }

  private tone(type: OscillatorType, startHz: number, endHz: number, at: number, duration: number, peak: number): void {
    if (!this.context || !this.master) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startHz, at);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endHz), at + duration);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + Math.min(0.018, duration * 0.3));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.025);
  }

  private noise(at: number, duration: number, peak: number, frequency: number, resonance: number): void {
    if (!this.context || !this.master || !this.noiseBuffer) return;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = resonance;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(at);
    source.stop(at + duration + 0.02);
  }

  private createNoiseBuffer(context: AudioContext): AudioBuffer {
    const length = Math.ceil(context.sampleRate * 0.8);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const channel = buffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < channel.length; index += 1) {
      const white = Math.random() * 2 - 1;
      previous = previous * 0.72 + white * 0.28;
      channel[index] = previous;
    }
    return buffer;
  }

  private publishDebug(): void {
    const debug: AudioDebugState = {
      supported: typeof AudioContext !== "undefined",
      unlocked: this.context?.state === "running",
      muted: this.settings.muted,
      effectiveVolume: Number(this.effectiveVolume().toFixed(3)),
      lastCue: this.lastCue,
      counts: { ...this.counts },
    };
    (window as Window & { __stormAudio?: AudioDebugState }).__stormAudio = debug;
  }
}
