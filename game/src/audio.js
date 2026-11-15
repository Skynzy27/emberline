// Procedural sound only: every effect is an oscillator or a filtered noise burst
// made by WebAudio at runtime. No audio files, no network, nothing to download.
export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let enabled = true;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function noise(dur, filterFreq, gain, type = 'lowpass') {
    if (!ensure() || !enabled) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur);
  }

  function tone(freq, dur, gain, type = 'sine', slideTo = 0) {
    if (!ensure() || !enabled) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur);
  }

  return {
    unlock() {
      ensure();
    },
    toggle() {
      enabled = !enabled;
      return enabled;
    },
    shot(kind) {
      if (kind === 'm7') {
        noise(0.22, 900, 0.5);
        tone(90, 0.18, 0.4, 'sine', 45);
      } else if (kind === 'p12') {
        noise(0.09, 2400, 0.3);
        tone(160, 0.08, 0.2, 'square', 90);
      } else {
        noise(0.12, 1800, 0.42);
        tone(140, 0.1, 0.28, 'sawtooth', 70);
      }
    },
    botShot(dist) {
      const g = Math.max(0.05, 0.32 - dist * 0.006);
      noise(0.1, 1200, g);
    },
    dry() {
      tone(900, 0.03, 0.12, 'square');
    },
    reload() {
      tone(500, 0.05, 0.14, 'square');
      setTimeout(() => tone(340, 0.05, 0.14, 'square'), 260);
    },
    hit(kill) {
      tone(kill ? 1320 : 880, 0.07, 0.2, 'sine');
      if (kill) setTimeout(() => tone(1760, 0.1, 0.2, 'sine'), 70);
    },
    hurt() {
      tone(220, 0.14, 0.3, 'sawtooth', 110);
      noise(0.1, 500, 0.2);
    },
    plantBeep() {
      tone(1200, 0.06, 0.18, 'sine');
    },
    explosion() {
      noise(1.1, 320, 0.8);
      tone(60, 0.9, 0.6, 'sine', 28);
    },
    buy() {
      tone(660, 0.06, 0.18, 'sine');
      setTimeout(() => tone(990, 0.08, 0.18, 'sine'), 60);
    },
    denied() {
      tone(180, 0.12, 0.2, 'square');
    },
    win() {
      [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.16, 0.2, 'sine'), i * 110));
    },
    lose() {
      [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.18, 0.2, 'sine'), i * 120));
    },
    flash() {
      tone(2400, 0.4, 0.12, 'sine', 300);
    },
    step() {
      noise(0.03, 400, 0.05);
    },
  };
}
