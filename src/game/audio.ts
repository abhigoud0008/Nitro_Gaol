export class ArenaAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private boostFilter: BiquadFilterNode | null = null;
  private boostGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private initialized = false;

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        muted ? 0 : 0.35,
        this.ctx.currentTime,
        0.04
      );
    }
  }

  public unlock(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    if (typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    try {
      const ctx = new AudioCtx();
      this.ctx = ctx;
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.35;
      master.connect(ctx.destination);
      this.masterGain = master;

      // Engine harmonic oscillator pair
      const engGain = ctx.createGain();
      engGain.gain.value = 0;
      const engFilter = ctx.createBiquadFilter();
      engFilter.type = 'lowpass';
      engFilter.frequency.value = 380;
      engFilter.connect(engGain);
      engGain.connect(master);

      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.value = 65;
      osc1.connect(engFilter);
      osc1.start();

      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.value = 130;
      osc2.connect(engFilter);
      osc2.start();

      this.engineOsc = osc1;
      this.engineSubOsc = osc2;
      this.engineGain = engGain;

      // Pre-allocate noise buffer for nitro jet & tire screech
      const buf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;

      // Continuous nitro jet loop
      const boostSrc = ctx.createBufferSource();
      boostSrc.buffer = buf;
      boostSrc.loop = true;
      const bFilter = ctx.createBiquadFilter();
      bFilter.type = 'bandpass';
      bFilter.frequency.value = 950;
      bFilter.Q.value = 1.6;
      const bGain = ctx.createGain();
      bGain.gain.value = 0;
      boostSrc.connect(bFilter);
      bFilter.connect(bGain);
      bGain.connect(master);
      boostSrc.start();

      this.boostFilter = bFilter;
      this.boostGain = bGain;
      this.initialized = true;
    } catch {
      // Ignore audio init errors in restricted environments
    }
  }

  public updateVehicleLoop(
    active: boolean,
    speedKmh: number,
    isBoosting: boolean
  ): void {
    if (!this.initialized || !this.ctx || !this.engineGain || !this.engineOsc || !this.engineSubOsc || !this.boostGain || !this.boostFilter) {
      return;
    }
    const t = this.ctx.currentTime;
    if (!active || this.muted) {
      this.engineGain.gain.setTargetAtTime(0, t, 0.08);
      this.boostGain.gain.setTargetAtTime(0, t, 0.08);
      return;
    }

    const rpmRatio = Math.min(1, speedKmh / 145);
    const baseFreq = 58 + rpmRatio * 125 + (isBoosting ? 24 : 0);
    this.engineOsc.frequency.setTargetAtTime(baseFreq, t, 0.05);
    this.engineSubOsc.frequency.setTargetAtTime(baseFreq * 2.02, t, 0.05);
    this.engineGain.gain.setTargetAtTime(0.055 + rpmRatio * 0.05, t, 0.06);

    this.boostFilter.frequency.setTargetAtTime(
      isBoosting ? 1350 : 600,
      t,
      0.05
    );
    this.boostGain.gain.setTargetAtTime(isBoosting ? 0.14 : 0, t, 0.04);
  }

  public playImpact(intensity: number, kind: 'ball' | 'car' | 'wall'): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const clamped = Math.max(0.15, Math.min(1, intensity));

    if (kind === 'ball') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160 + clamped * 90, t);
      osc.frequency.exponentialRampToValueAtTime(48, t + 0.16);
      gain.gain.setValueAtTime(0.28 * clamped, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(115 + clamped * 60, t);
      osc.frequency.exponentialRampToValueAtTime(36, t + 0.14);
      gain.gain.setValueAtTime(0.22 * clamped, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    }

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  public playJump(isDoubleJump: boolean): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const startFreq = isDoubleJump ? 260 : 180;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 2.1, t + 0.12);
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  public playBoostPickup(isLarge: boolean): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isLarge ? 520 : 440, t);
    osc.frequency.exponentialRampToValueAtTime(isLarge ? 980 : 720, t + 0.16);
    gain.gain.setValueAtTime(0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.19);
  }

  public playCountdownBeep(isGo: boolean): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isGo ? 880 : 520, t);
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (isGo ? 0.28 : 0.14));
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  public playGoalHorn(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const freqs = [146.83, 220, 293.66];
    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.15);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 1.2);
    }

    if (this.noiseBuffer) {
      const crowd = this.ctx.createBufferSource();
      crowd.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 650;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.01, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.25);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
      crowd.connect(filter);
      filter.connect(g);
      g.connect(this.masterGain);
      crowd.start(t);
      crowd.stop(t + 1.45);
    }
  }

  public playUiClick(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(640, t);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.05);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.065);
  }

  public dispose(): void {
    try {
      this.engineOsc?.stop();
      this.engineSubOsc?.stop();
      void this.ctx?.close();
    } catch {
      // ignore
    }
    this.initialized = false;
  }
}
