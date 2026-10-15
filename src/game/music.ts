// R23 配樂導演：白晝／夜襲兩段循環，交叉淡入淡出。
// 優先載入 public/audio/bgm-day.ogg、bgm-night.ogg（本機 AI 派工器 music 產出後轉檔）；
// 檔案不存在或解碼失敗時，改用程序化 WebAudio 配樂，所以缺件時遊戲仍有配樂且架構可直接替換。

export type MusicMode = "off" | "day" | "night";

interface MusicLayer {
  gain: GainNode;
  source?: AudioBufferSourceNode;
  procedural: boolean;
}

const DAY_CHORDS = [
  [220, 261.63, 329.63],
  [174.61, 220, 261.63],
  [196, 246.94, 293.66],
  [164.81, 207.65, 246.94],
];
const NIGHT_CHORDS = [
  [146.83, 174.61, 220],
  [116.54, 146.83, 174.61],
  [130.81, 155.56, 196],
  [110, 138.59, 164.81],
];

export class MusicDirector {
  private readonly bus: GainNode;
  private readonly layers = new Map<Exclude<MusicMode, "off">, MusicLayer>();
  private readonly buffers = new Map<Exclude<MusicMode, "off">, AudioBuffer | null>();
  private mode: MusicMode = "off";
  private schedulerId?: number;
  private nextBeatAt = 0;
  private beatIndex = 0;
  private noise?: AudioBuffer;
  sourceKind: Record<Exclude<MusicMode, "off">, "file" | "procedural" | "pending"> = { day: "pending", night: "pending" };

  constructor(private readonly context: AudioContext, destination: AudioNode, private readonly baseUrl: string, private readonly onSourceChange: () => void = () => undefined) {
    this.bus = context.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(destination);
    for (const mode of ["day", "night"] as const) {
      const gain = context.createGain();
      gain.gain.value = 0;
      gain.connect(this.bus);
      this.layers.set(mode, { gain, procedural: false });
      void this.load(mode);
    }
  }

  get currentMode(): MusicMode {
    return this.mode;
  }

  setVolume(volume: number): void {
    const now = this.context.currentTime;
    this.bus.gain.cancelScheduledValues(now);
    this.bus.gain.setTargetAtTime(Math.max(0, volume), now, 0.25);
  }

  setMode(mode: MusicMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    const now = this.context.currentTime;
    for (const [layerMode, layer] of this.layers) {
      const target = layerMode === mode ? 1 : 0;
      layer.gain.gain.cancelScheduledValues(now);
      layer.gain.gain.setTargetAtTime(target, now, mode === "night" ? 0.6 : 1.4);
      if (target > 0) this.ensurePlaying(layerMode);
    }
    if (mode !== "off" && this.schedulerId === undefined) {
      this.nextBeatAt = this.context.currentTime + 0.1;
      this.schedulerId = window.setInterval(() => this.schedule(), 180);
    }
  }

  dispose(): void {
    if (this.schedulerId !== undefined) window.clearInterval(this.schedulerId);
    this.schedulerId = undefined;
  }

  private async load(mode: Exclude<MusicMode, "off">): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}audio/bgm-${mode}.ogg`);
      if (!response.ok || !(response.headers.get("content-type") ?? "").includes("audio")) throw new Error("missing");
      const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
      this.buffers.set(mode, buffer);
      this.sourceKind[mode] = "file";
    } catch {
      this.buffers.set(mode, null);
      this.sourceKind[mode] = "procedural";
    }
    if (this.mode === mode) this.ensurePlaying(mode);
    this.onSourceChange();
  }

  private ensurePlaying(mode: Exclude<MusicMode, "off">): void {
    const layer = this.layers.get(mode)!;
    const buffer = this.buffers.get(mode);
    if (buffer && !layer.source) {
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(layer.gain);
      source.start();
      layer.source = source;
      layer.procedural = false;
    } else if (buffer === null) {
      layer.procedural = true;
    }
  }

  // 程序化配樂：每 0.5 秒一拍，每 8 拍換和弦。白晝＝柔和弦樂墊＋風聲；夜襲＝暗色和弦＋低鼓脈動。
  private schedule(): void {
    const horizon = this.context.currentTime + 0.6;
    while (this.nextBeatAt < horizon) {
      this.playBeat(this.nextBeatAt, this.beatIndex);
      this.nextBeatAt += 0.5;
      this.beatIndex += 1;
    }
  }

  private playBeat(at: number, beat: number): void {
    const day = this.layers.get("day")!;
    const night = this.layers.get("night")!;
    const chordIndex = Math.floor(beat / 8) % 4;
    if (day.procedural && beat % 8 === 0) {
      for (const [index, frequency] of DAY_CHORDS[chordIndex].entries()) this.pad(day.gain, frequency, at, 4.2, 0.028, index * 3 - 3);
      this.wind(day.gain, at, 4, 0.03);
    }
    if (day.procedural && beat % 4 === 2) {
      const melody = DAY_CHORDS[chordIndex][(beat / 4) % 3 | 0] * 2;
      this.pluck(day.gain, melody, at, 1.6, 0.03);
    }
    if (night.procedural) {
      if (beat % 8 === 0) for (const [index, frequency] of NIGHT_CHORDS[chordIndex].entries()) this.pad(night.gain, frequency, at, 4.2, 0.03, index * 4 - 4);
      this.kick(night.gain, at, beat % 2 === 0 ? 0.22 : 0.12);
      if (beat % 2 === 1) this.hat(night.gain, at + 0.25, 0.035);
      if (beat % 8 === 6) this.pluck(night.gain, NIGHT_CHORDS[chordIndex][0] * 2, at, 0.5, 0.05);
    }
  }

  private pad(output: AudioNode, frequency: number, at: number, duration: number, peak: number, detune: number): void {
    const oscillator = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = frequency;
    oscillator.detune.value = detune;
    filter.type = "lowpass";
    filter.frequency.value = 900;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(peak, at + 1.2);
    gain.gain.linearRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(filter).connect(gain).connect(output);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.05);
  }

  private pluck(output: AudioNode, frequency: number, at: number, duration: number, peak: number): void {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(gain).connect(output);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.05);
  }

  private kick(output: AudioNode, at: number, peak: number): void {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(90, at);
    oscillator.frequency.exponentialRampToValueAtTime(38, at + 0.22);
    gain.gain.setValueAtTime(peak, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
    oscillator.connect(gain).connect(output);
    oscillator.start(at);
    oscillator.stop(at + 0.32);
  }

  private noiseBuffer(): AudioBuffer {
    if (this.noise) return this.noise;
    const length = Math.ceil(this.context.sampleRate * 2);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) channel[index] = Math.random() * 2 - 1;
    this.noise = buffer;
    return buffer;
  }

  private hat(output: AudioNode, at: number, peak: number): void {
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.noiseBuffer();
    filter.type = "highpass";
    filter.frequency.value = 6500;
    gain.gain.setValueAtTime(peak, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
    source.connect(filter).connect(gain).connect(output);
    source.start(at);
    source.stop(at + 0.08);
  }

  private wind(output: AudioNode, at: number, duration: number, peak: number): void {
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.noiseBuffer();
    source.loop = true;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(380, at);
    filter.frequency.linearRampToValueAtTime(620, at + duration / 2);
    filter.frequency.linearRampToValueAtTime(340, at + duration);
    filter.Q.value = 0.7;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(peak, at + duration / 2);
    gain.gain.linearRampToValueAtTime(0.0001, at + duration);
    source.connect(filter).connect(gain).connect(output);
    source.start(at);
    source.stop(at + duration + 0.05);
  }
}
