'use client';

let _ctx: AudioContext | null = null;
let _ambientNodes: AudioNode[] = [];
let _ambientGain: GainNode | null = null;

function ctx(): AudioContext {
  if (!_ctx) _ctx = new AudioContext();
  return _ctx;
}

function stopAmbient() {
  _ambientNodes.forEach(n => { try { (n as OscillatorNode).stop?.(); } catch { /* already stopped */ } });
  _ambientNodes = [];
  _ambientGain = null;
}

export function playNightAmbience() {
  try {
    stopAmbient();
    const c = ctx();
    if (c.state === 'suspended') c.resume();

    const master = c.createGain();
    master.gain.value = 0;
    master.connect(c.destination);
    _ambientGain = master;

    const freqs = [55, 82.4, 110, 146.8];
    freqs.forEach((freq, i) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      g.gain.value = i === 0 ? 0.35 : 0.12;
      osc.connect(g);
      g.connect(master);
      osc.start();
      _ambientNodes.push(osc);
    });

    const lfo = c.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 0.08;
    lfo.connect(lfoGain);
    lfoGain.connect(master.gain);
    lfo.start();
    _ambientNodes.push(lfo);

    master.gain.linearRampToValueAtTime(0.22, c.currentTime + 3);
  } catch { /* no audio */ }
}

export function playDayAmbience() {
  try {
    stopAmbient();
    const c = ctx();
    if (c.state === 'suspended') c.resume();

    const master = c.createGain();
    master.gain.value = 0;
    master.connect(c.destination);
    _ambientGain = master;

    const warmFreqs = [261.6, 329.6, 392, 523.2];
    warmFreqs.forEach((freq, i) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq + (i * 0.3);
      g.gain.value = 0.05;
      osc.connect(g);
      g.connect(master);
      osc.start();
      _ambientNodes.push(osc);
    });

    scheduleBirdChirp(c, master);

    master.gain.linearRampToValueAtTime(0.18, c.currentTime + 2.5);
  } catch { /* no audio */ }
}

function scheduleBirdChirp(c: AudioContext, dest: AudioNode) {
  const delay = 3000 + Math.random() * 7000;
  const timer = setTimeout(() => {
    try {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'sine';
      const baseFreq = 1200 + Math.random() * 800;
      osc.frequency.setValueAtTime(baseFreq, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, c.currentTime + 0.12);
      osc.frequency.exponentialRampToValueAtTime(baseFreq, c.currentTime + 0.25);
      g.gain.setValueAtTime(0, c.currentTime);
      g.gain.linearRampToValueAtTime(0.06, c.currentTime + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);
      osc.connect(g);
      g.connect(dest);
      osc.start();
      osc.stop(c.currentTime + 0.35);
      if (_ambientGain) scheduleBirdChirp(c, dest);
    } catch { /* stopped */ }
  }, delay);
  _ambientNodes.push({ stop: () => clearTimeout(timer) } as unknown as AudioNode);
}

export function stopAllAmbience() {
  try {
    if (_ambientGain) {
      _ambientGain.gain.linearRampToValueAtTime(0, ctx().currentTime + 1.5);
    }
    setTimeout(stopAmbient, 1600);
  } catch { stopAmbient(); }
}

export function playDeathSting() {
  try {
    const c = ctx();
    if (c.state === 'suspended') c.resume();

    const master = c.createGain();
    master.connect(c.destination);

    [[220, 0, 0.15], [185, 0.05, 0.3], [155, 0.12, 0.5], [110, 0.2, 0.9]].forEach(([freq, start, end]) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.18, c.currentTime + start);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + end);
      osc.connect(g);
      g.connect(master);
      osc.start(c.currentTime + start);
      osc.stop(c.currentTime + end + 0.1);
    });

    const noise = c.createOscillator();
    noise.type = 'sawtooth';
    noise.frequency.value = 60;
    const noiseGain = c.createGain();
    noiseGain.gain.setValueAtTime(0.3, c.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.6);
    noise.connect(noiseGain);
    noiseGain.connect(master);
    noise.start();
    noise.stop(c.currentTime + 0.65);
  } catch { /* no audio */ }
}

export function playVoteAlarm() {
  try {
    const c = ctx();
    if (c.state === 'suspended') c.resume();

    [0, 0.3, 0.6].forEach(t => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'square';
      osc.frequency.value = t === 0 ? 440 : t === 0.3 ? 550 : 660;
      g.gain.setValueAtTime(0.15, c.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + t + 0.2);
      osc.connect(g);
      g.connect(c.destination);
      osc.start(c.currentTime + t);
      osc.stop(c.currentTime + t + 0.25);
    });
  } catch { /* no audio */ }
}

export function playGameStart() {
  try {
    const c = ctx();
    if (c.state === 'suspended') c.resume();
    [[261.6, 0], [329.6, 0.2], [392, 0.4], [523.2, 0.6]].forEach(([freq, t]) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.2, c.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + t + 0.4);
      osc.connect(g);
      g.connect(c.destination);
      osc.start(c.currentTime + t);
      osc.stop(c.currentTime + t + 0.5);
    });
  } catch { /* no audio */ }
}

export function playVictory() {
  try {
    const c = ctx();
    if (c.state === 'suspended') c.resume();
    [[523.2, 0], [659.3, 0.15], [783.9, 0.3], [1046.5, 0.5]].forEach(([freq, t]) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.22, c.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + t + 0.8);
      osc.connect(g);
      g.connect(c.destination);
      osc.start(c.currentTime + t);
      osc.stop(c.currentTime + t + 0.9);
    });
  } catch { /* no audio */ }
}

export function playDefeat() {
  try {
    const c = ctx();
    if (c.state === 'suspended') c.resume();
    [[392, 0], [349.2, 0.3], [311.1, 0.6], [261.6, 0.9]].forEach(([freq, t]) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.2, c.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + t + 0.5);
      osc.connect(g);
      g.connect(c.destination);
      osc.start(c.currentTime + t);
      osc.stop(c.currentTime + t + 0.6);
    });
  } catch { /* no audio */ }
}
