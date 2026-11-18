// All sound is synthesized with WebAudio — no audio files, no network.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicTimer = 0;
    this.musicStep = 0;
    this.station = 0;
    this.engineOsc = null;
    this.engineGain = null;
  }
  ensure() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
      } catch (e) { /* audio unavailable */ }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
  tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  noise(dur, vol = 0.2, freq = 1000, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
  }
  shoot() { this.noise(0.12, 0.5, 2600); this.tone(180, 0.09, 'square', 0.18, 60); }
  punch() { this.noise(0.08, 0.3, 500); this.tone(120, 0.08, 'triangle', 0.25, 70); }
  pickup() { this.tone(660, 0.1, 'sine', 0.22); this.tone(990, 0.14, 'sine', 0.22, null, 0.08); }
  cash() { this.tone(880, 0.09, 'sine', 0.2); this.tone(1174, 0.09, 'sine', 0.2, null, 0.07); this.tone(1568, 0.16, 'sine', 0.2, null, 0.14); }
  crash() { this.noise(0.3, 0.5, 700); this.tone(90, 0.25, 'sawtooth', 0.25, 40); }
  siren(dt, wanted) {
    if (!this.ctx || this.muted || wanted < 1) return;
    this._sirenT = (this._sirenT || 0) + dt;
    if (this._sirenT > 0.55) {
      this._sirenT = 0;
      this._sirenHi = !this._sirenHi;
      this.tone(this._sirenHi ? 950 : 700, 0.5, 'sine', 0.05);
    }
  }
  jingle() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.22, null, i * 0.11));
  }
  fail() { this.tone(220, 0.3, 'sawtooth', 0.18, 110); }
  // Simple bass/pad loop; station changes the root note pattern.
  music(dt) {
    if (!this.ctx || this.muted) return;
    this.musicTimer += dt;
    const stepDur = 0.24;
    if (this.musicTimer < stepDur) return;
    this.musicTimer -= stepDur;
    const roots = [55, 55, 65.4, 49][this.station] || 55;
    const bassNotes = [0, 0, 7, 5, 3, 5, 7, 10];
    const n = bassNotes[this.musicStep % bassNotes.length];
    const f = roots * Math.pow(2, n / 12);
    this.tone(f, 0.22, 'triangle', 0.07);
    if (this.musicStep % 4 === 0) this.tone(f * 4, 0.5, 'sine', 0.03);
    this.musicStep++;
  }
  engine(on, speedRatio) {
    if (!this.ctx) return;
    if (!on) {
      if (this.engineOsc) { try { this.engineOsc.stop(); } catch (e) {} this.engineOsc = null; }
      return;
    }
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      this.engineOsc.type = 'sawtooth';
      this.engineGain.gain.value = 0.0;
      this.engineOsc.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    const target = this.muted ? 0 : 0.03 + 0.05 * speedRatio;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(50 + 140 * speedRatio, this.ctx.currentTime, 0.1);
  }
}
