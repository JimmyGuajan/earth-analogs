/* Earth Analogs – mission sounds, synthesised with Web Audio (no audio files).
 * Off by default; every call is a no-op until the viewer turns sound on. */
(function (global) {
  let ctx = null, on = false, hum = null;
  const ac = () => (ctx ||= new (global.AudioContext || global.webkitAudioContext)());

  function tone(freq, dur, { type = "sine", gain = 0.08, at = 0, slide = null } = {}) {
    if (!on) return;
    const c = ac(), t0 = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function noise(dur, { gain = 0.12, from = 400, to = 120, at = 0, type = "lowpass" } = {}) {
    if (!on) return;
    const c = ac(), t0 = c.currentTime + at;
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; f.type = type;
    f.frequency.setValueAtTime(from, t0); f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.4, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t0);
  }

  const SFX = {
    get on() { return on; },
    set(v) {
      on = !!v;
      if (on) ac().resume();
      else SFX.humStop();
    },
    /** short mission-control blip */
    beep(freq = 880) { tone(freq, 0.12, { type: "square", gain: 0.035 }); },
    /** a system reports GO */
    go() { tone(660, 0.08, { gain: 0.05 }); tone(990, 0.12, { gain: 0.05, at: 0.08 }); },
    /** countdown tick, higher on zero */
    tick(last = false) { tone(last ? 1320 : 880, last ? 0.5 : 0.18, { type: "triangle", gain: 0.08 }); },
    /** engines at lift-off */
    liftoff() { noise(3.2, { gain: 0.25, from: 900, to: 90 }); tone(55, 3, { type: "sawtooth", gain: 0.05, slide: 38 }); },
    /** low cabin hum while cruising */
    humStart() {
      if (!on || hum) return;
      const c = ac(), o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain();
      o.type = "sine"; o.frequency.value = 62; o2.type = "sine"; o2.frequency.value = 93;
      g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(0.03, c.currentTime + 1);
      o.connect(g); o2.connect(g); g.connect(c.destination); o.start(); o2.start();
      hum = { o, o2, g };
    },
    humStop() {
      if (!hum || !ctx) { hum = null; return; }
      const { o, o2, g } = hum, t = ctx.currentTime;
      g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.stop(t + 0.7); o2.stop(t + 0.7); hum = null;
    },
    /** plasma roar during re-entry */
    reentry(dur = 3) { noise(dur, { gain: 0.18, from: 2400, to: 300, type: "bandpass" }); },
    /** touchdown thump and arrival chime */
    touchdown() {
      tone(70, 0.5, { type: "sine", gain: 0.25, slide: 40 });
      noise(0.4, { gain: 0.15, from: 500, to: 80 });
      [523, 659, 784].forEach((f, i) => tone(f, 0.5, { gain: 0.05, at: 0.35 + i * 0.12 }));
    },
  };
  global.SFX = SFX;
})(window);
