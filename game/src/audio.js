// All sound is synthesized with WebAudio: no audio files, no network.
// Engine hum, sirens, gunshots, pickups, a mission jingle and a looping
// bass/pad radio station. The context is created lazily on first user
// interaction (browsers block audio before a gesture); shot mode never
// touches it, so headless renders stay silent and error-free.
import { STATIONS } from './config.js';

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let station = 0;
  let musicTimer = null;
  let beat = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 40;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      const t0 = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      g.gain.setValueAtTime(vol || 0.2, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g);
      g.connect(master);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    } catch { /* audio is decoration, never fatal */ }
  }

  function noise(dur, vol, low) {
    if (!ensure() || muted) return;
    try {
      const t0 = ctx.currentTime;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = vol || 0.25;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = low || 3000;
      src.connect(f);
      f.connect(g);
      g.connect(master);
      src.start(t0);
    } catch { /* ignore */ }
  }

  function startMusic() {
    if (!ensure() || musicTimer) return;
    const st = STATIONS[station];
    musicTimer = window.setInterval(() => {
      if (muted || !ctx) return;
      try {
        const bass = st.bass[beat % st.bass.length];
        tone(bass, 0.5, 'triangle', 0.5);
        tone(bass * 2, 0.22, 'sine', 0.12);
        if (beat % 2 === 0) {
          const pad = st.pad[beat % st.pad.length];
          tone(pad, 1.6, 'sine', 0.06);
          tone(pad * 1.5, 1.6, 'sine', 0.04);
        }
        if (beat % 4 === 3) noise(0.05, 0.05, 6000);
        beat += 1;
      } catch { /* ignore */ }
    }, 300);
  }

  return {
    unlock() { ensure(); startMusic(); },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    isMuted() { return muted; },
    setStation(i) { station = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length; beat = 0; },
    stationName() { return STATIONS[station].name; },
    stationTag() { return STATIONS[station].tag; },
    engine(speed01, on) {
      if (!ensure()) return;
      try {
        engineGain.gain.value = on ? 0.05 + speed01 * 0.06 : 0;
        engineOsc.frequency.value = 40 + speed01 * 140;
      } catch { /* ignore */ }
    },
    siren(on, t) {
      if (!ensure()) return;
      try {
        sirenGain.gain.value = on ? 0.045 : 0;
        if (on) sirenOsc.frequency.value = 660 + Math.sin(t * 6) * 220;
      } catch { /* ignore */ }
    },
    gunshot() { noise(0.12, 0.5, 2500); tone(160, 0.1, 'square', 0.25, 60); },
    melee() { noise(0.08, 0.2, 1200); },
    pickup() { tone(660, 0.12, 'sine', 0.2); tone(990, 0.18, 'sine', 0.2); },
    cash() { tone(880, 0.1, 'sine', 0.18); tone(1320, 0.16, 'sine', 0.18); },
    crash() { noise(0.25, 0.4, 900); tone(90, 0.2, 'sawtooth', 0.2, 40); },
    skid() { noise(0.15, 0.12, 4000); },
    jingle() {
      const seq = [523, 659, 784, 1047];
      seq.forEach((f, i) => window.setTimeout(() => tone(f, 0.35, 'triangle', 0.25), i * 130));
    },
    fail() { tone(220, 0.4, 'sawtooth', 0.2, 110); },
    busted() { tone(440, 0.3, 'square', 0.15, 330); tone(330, 0.5, 'square', 0.15, 220); },
  };
}
