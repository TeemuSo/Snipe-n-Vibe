class AudioManager {
  private ctx!: AudioContext;
  private masterGain!: GainNode;
  private noiseBuffer: AudioBuffer | null = null;
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.4;
    this.masterGain.connect(this.ctx.destination);
    this.initialized = true;
  }

  playGunshot(): void {
    if (!this.initialized) return;

    const now = this.ctx.currentTime;

    // Layer 1: Low frequency thump (body of the shot)
    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.6, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    oscGain.connect(this.masterGain);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.15);
    osc.connect(oscGain);
    osc.start(now);
    osc.stop(now + 0.15);
    osc.onended = () => {
      osc.disconnect();
      oscGain.disconnect();
    };

    // Layer 2: Noise burst (the "crack")
    const noiseBuffer = this.getNoiseBuffer(0.1);
    const crackGain = this.ctx.createGain();
    crackGain.gain.setValueAtTime(0.4, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    crackGain.connect(this.masterGain);

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 3000;
    bandpass.Q.value = 1;
    bandpass.connect(crackGain);

    const crackSource = this.ctx.createBufferSource();
    crackSource.buffer = noiseBuffer;
    crackSource.connect(bandpass);
    crackSource.start(now);
    crackSource.stop(now + 0.08);
    crackSource.onended = () => {
      crackSource.disconnect();
      bandpass.disconnect();
      crackGain.disconnect();
    };

    // Layer 3: Tail/echo (reverb-like)
    const tailGain = this.ctx.createGain();
    tailGain.gain.setValueAtTime(0.15, now);
    tailGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    tailGain.connect(this.masterGain);

    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 800;
    lowpass.connect(tailGain);

    const tailBuffer = this.getNoiseBuffer(0.35);
    const tailSource = this.ctx.createBufferSource();
    tailSource.buffer = tailBuffer;
    tailSource.connect(lowpass);
    tailSource.start(now);
    tailSource.stop(now + 0.3);
    tailSource.onended = () => {
      tailSource.disconnect();
      lowpass.disconnect();
      tailGain.disconnect();
    };
  }

  playImpact(): void {
    if (!this.initialized) return;

    const now = this.ctx.currentTime;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    gain.connect(this.masterGain);

    const highpass = this.ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 2000;
    highpass.connect(gain);

    const buffer = this.getNoiseBuffer(0.05);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(highpass);
    source.start(now);
    source.stop(now + 0.04);
    source.onended = () => {
      source.disconnect();
      highpass.disconnect();
      gain.disconnect();
    };
  }

  playHitMarker(): void {
    if (!this.initialized) return;

    const now = this.ctx.currentTime;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    gain.connect(this.masterGain);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1200;
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.1);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  playDeath(): void {
    if (!this.initialized) return;

    const now = this.ctx.currentTime;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    gain.connect(this.masterGain);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(50, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.4);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.4);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  private getNoiseBuffer(duration: number): AudioBuffer {
    // Reuse cached buffer if long enough, otherwise create new
    if (this.noiseBuffer && this.noiseBuffer.duration >= duration) {
      return this.noiseBuffer;
    }
    const buffer = this.createNoiseBuffer(duration);
    if (!this.noiseBuffer || duration > this.noiseBuffer.duration) {
      this.noiseBuffer = buffer;
    }
    return buffer;
  }

  private createNoiseBuffer(duration: number): AudioBuffer {
    const sampleRate = this.ctx.sampleRate;
    const length = Math.ceil(sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }
}

export { AudioManager };
