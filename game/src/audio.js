// audio.js — tiny WebAudio sound kit for Archipelago Run.
// No audio files: engine hum, ring chime, touchdown fanfare and crash
// thud are all synthesized. Everything is guarded: if WebAudio is
// unavailable the game stays silent and keeps flying.

const AudioKit = (() => {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let master = null;

  function ensure() {
    try {
      if (ctx) {
        if (ctx.state === 'suspended') void ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.16;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
    } catch (_e) { /* silent */ }
  }

  function setEngine(throttle, flying) {
    try {
      if (!ctx || !engineOsc || !engineGain) return;
      const t = ctx.currentTime;
      engineOsc.frequency.setTargetAtTime(48 + throttle * 70, t, 0.2);
      engineGain.gain.setTargetAtTime(flying ? 0.05 + throttle * 0.10 : 0.0, t, 0.2);
    } catch (_e) { /* silent */ }
  }

  function blip(freq, dur, type, vol) {
    try {
      if (!ctx || !master) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.5, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g);
      g.connect(master);
      o.start();
      o.stop(ctx.currentTime + dur);
    } catch (_e) { /* silent */ }
  }

  function chime() {
    blip(880, 0.35, 'sine', 0.5);
    setTimeout(() => blip(1318, 0.4, 'sine', 0.4), 90);
  }

  function fanfare() {
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => blip(f, 0.5, 'triangle', 0.5), i * 130);
    });
  }

  function thud() {
    try {
      if (!ctx || !master) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(120, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.4);
      g.gain.setValueAtTime(0.9, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      o.connect(g);
      g.connect(master);
      o.start();
      o.stop(ctx.currentTime + 0.5);
    } catch (_e) { /* silent */ }
  }

  function warn() {
    blip(220, 0.25, 'square', 0.25);
  }

  return { ensure, setEngine, chime, fanfare, thud, warn };
})();
