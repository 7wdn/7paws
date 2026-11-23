class CatAudio {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private graphReady = false;
  private master: GainNode | null = null;
  private current = 0;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.setPurrIntensity(0);
  }

  private ensureGraph(): boolean {
    if (!this.enabled) return false;
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume().catch(() => {});
    }
    if (this.graphReady) return true;

    const ctx = this.ctx;
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, Math.floor(sampleRate * 3), sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const warm = ctx.createBiquadFilter();
    warm.type = "bandpass";
    warm.frequency.value = 190;
    warm.Q.value = 1.15;
    const warmGain = ctx.createGain();
    warmGain.gain.value = 1.45;

    const breath = ctx.createBiquadFilter();
    breath.type = "bandpass";
    breath.frequency.value = 520;
    breath.Q.value = 1.4;
    const breathGain = ctx.createGain();
    breathGain.gain.value = 0.34;

    const flutter = ctx.createGain();
    flutter.gain.value = 0.65;
    const flutterLfo = ctx.createOscillator();
    flutterLfo.type = "sine";
    flutterLfo.frequency.value = 24.5;
    const flutterDepth = ctx.createGain();
    flutterDepth.gain.value = 0.35;
    flutterLfo.connect(flutterDepth);
    flutterDepth.connect(flutter.gain);

    const cycle = ctx.createGain();
    cycle.gain.value = 0.76;
    const cycleLfo = ctx.createOscillator();
    cycleLfo.type = "sine";
    cycleLfo.frequency.value = 0.68;
    const cycleDepth = ctx.createGain();
    cycleDepth.gain.value = 0.24;
    cycleLfo.connect(cycleDepth);
    cycleDepth.connect(cycle.gain);

    const polish = ctx.createBiquadFilter();
    polish.type = "lowpass";
    polish.frequency.value = 1400;

    const master = ctx.createGain();
    master.gain.value = 0;

    noise.connect(warm);
    warm.connect(warmGain);
    warmGain.connect(flutter);
    noise.connect(breath);
    breath.connect(breathGain);
    breathGain.connect(flutter);
    flutter.connect(cycle);
    cycle.connect(polish);
    polish.connect(master);
    master.connect(ctx.destination);

    noise.start();
    flutterLfo.start();
    cycleLfo.start();

    this.master = master;
    this.graphReady = true;
    return true;
  }

  setPurrIntensity(intensity: number): void {
    const target = this.enabled ? Math.max(0, Math.min(1, intensity)) : 0;
    if (target <= 0.01 && !this.graphReady) return;
    if (Math.abs(target - this.current) < 0.005) return;
    this.current = target;

    if (target > 0.01 && !this.ensureGraph()) return;
    if (!this.ctx || !this.master) return;
    if (target > 0.01 && this.ctx.state === "suspended") {
      void this.ctx.resume().catch(() => {});
    }

    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(target * 0.26, now, target > 0.01 ? 0.14 : 0.22);
  }
}

export const catAudio = new CatAudio();