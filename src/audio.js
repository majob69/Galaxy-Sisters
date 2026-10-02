// ==========================================
// AUDIO ENGINE: mixer with reverb, look-ahead music sequencer (day / night / boss),
// spatial-ish ambience (river, waterfall, wind, birds, crickets) and synthesized SFX
// ==========================================

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Chord progressions (MIDI notes) and bass roots per mode
const SONGS = {
  day: {
    bpm: 84,
    chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 64]], // Cmaj7 Am7 Fmaj7 G6
    bass: [36, 33, 29, 31],
    // 4-bar melody phrase: [bar, step, midi]
    melody: [
      [0, 0, 76], [0, 4, 79], [0, 6, 81], [0, 10, 79], [0, 12, 76],
      [1, 0, 74], [1, 4, 76], [1, 8, 72],
      [2, 0, 72], [2, 4, 74], [2, 6, 76], [2, 10, 79], [2, 12, 81],
      [3, 0, 79], [3, 6, 76], [3, 8, 74]
    ]
  },
  // Extra day songs the player can pick (🎵 button)
  waltz: {
    bpm: 96,
    style: 'waltz',
    chords: [[65, 69, 72], [60, 64, 67], [62, 65, 69], [58, 62, 65]], // F C Dm Bb
    bass: [29, 36, 26, 34],
    melody: [
      [0, 0, 77], [0, 4, 76], [0, 8, 74], [0, 12, 72],
      [1, 0, 72], [1, 6, 74], [1, 8, 76],
      [2, 0, 77], [2, 4, 81], [2, 8, 79], [2, 12, 77],
      [3, 0, 74], [3, 8, 70], [3, 12, 72]
    ]
  },
  market: {
    bpm: 108,
    style: 'bouncy',
    chords: [[67, 71, 74], [64, 67, 71], [60, 64, 67], [62, 66, 69]], // G Em C D
    bass: [31, 28, 36, 26],
    melody: [
      [0, 0, 79], [0, 2, 81], [0, 4, 83], [0, 8, 86], [0, 12, 83],
      [1, 0, 79], [1, 4, 76], [1, 8, 79], [1, 10, 81],
      [2, 0, 76], [2, 2, 79], [2, 4, 84], [2, 8, 83], [2, 12, 79],
      [3, 0, 81], [3, 4, 78], [3, 8, 74], [3, 12, 78]
    ]
  },
  clouds: {
    bpm: 74,
    style: 'lofi',
    chords: [[63, 67, 70, 74], [60, 63, 67, 70], [56, 60, 63, 67], [58, 62, 65, 69]], // Ebmaj7 Cm7 Abmaj7 Bb6
    bass: [39, 36, 32, 34],
    melody: [
      [0, 2, 79], [0, 8, 82], [0, 14, 79],
      [1, 4, 77], [1, 10, 75],
      [2, 2, 75], [2, 8, 79], [2, 12, 80],
      [3, 4, 77], [3, 10, 74]
    ]
  },
  forest: {
    bpm: 70,
    style: 'mystic',
    chords: [[62, 65, 69, 76], [58, 62, 65, 69], [55, 58, 62, 69], [57, 61, 64, 67]], // Dm9 Bbmaj7 Gm9 A7
    bass: [26, 34, 31, 33],
    melody: [
      [0, 0, 81], [0, 6, 84], [0, 12, 81],
      [1, 4, 77], [1, 10, 81],
      [2, 0, 79], [2, 8, 74],
      [3, 2, 76], [3, 8, 73], [3, 12, 76]
    ]
  },
  night: {
    bpm: 66,
    chords: [[57, 60, 64, 67, 71], [53, 57, 60, 64], [48, 55, 59, 64], [52, 55, 59, 62]], // Am9 Fmaj7 Cmaj7 Em7
    bass: [33, 29, 36, 28],
    melody: [
      [0, 0, 84], [0, 8, 81],
      [1, 4, 79], [1, 12, 76],
      [2, 0, 79], [2, 8, 83],
      [3, 4, 81], [3, 12, 76]
    ]
  },
  boss: {
    bpm: 138,
    chords: [[62, 65, 69], [58, 62, 65], [60, 64, 67], [57, 61, 64]], // Dm Bb C A
    bass: [38, 34, 36, 33],
    melody: [
      [0, 0, 74], [0, 3, 77], [0, 6, 81], [0, 10, 79], [0, 12, 77],
      [1, 0, 74], [1, 6, 70], [1, 8, 72],
      [2, 0, 76], [2, 3, 79], [2, 6, 84], [2, 10, 81], [2, 12, 79],
      [3, 0, 76], [3, 6, 73], [3, 8, 76], [3, 12, 81]
    ]
  }
};

// Day songs to choose from, in button order
export const DAY_SONGS = [
  { key: 'day', name: 'Morgentau' },
  { key: 'waltz', name: 'Wiesenwalzer' },
  { key: 'market', name: 'Sternenmarkt' },
  { key: 'clouds', name: 'Wolkenreise' }
];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this._enabled = true;
    this.bgmPlaying = false;
    this.bgmMode = 'peaceful'; // 'peaceful' or 'boss' (set by the game)
    this.night = 0;
    this.songKey = 'day';
    this.seqStep = 0;
    this.nextNoteTime = 0;
    this.nextBird = 0;
    this.nextCricket = 0;
    this.nextOwl = 0;
  }

  get enabled() {
    return this._enabled;
  }

  set enabled(v) {
    this._enabled = v;
    if (this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(v ? 0.9 : 0, this.ctx.currentTime, 0.08);
    }
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.buildGraph();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  buildGraph() {
    const ctx = this.ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.25;
    comp.connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.gain.value = this._enabled ? 0.9 : 0;
    this.master.connect(comp);

    // Procedural hall reverb
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(2.8, 3.2);
    const reverbReturn = ctx.createGain();
    reverbReturn.gain.value = 0.42;
    this.reverb.connect(reverbReturn);
    reverbReturn.connect(this.master);

    const bus = (level, send) => {
      const g = ctx.createGain();
      g.gain.value = level;
      g.connect(this.master);
      if (send > 0) {
        const s = ctx.createGain();
        s.gain.value = send;
        g.connect(s);
        s.connect(this.reverb);
      }
      return g;
    };
    this.musicBus = bus(0.5, 0.55);
    this.sfxBus = bus(0.85, 0.22);
    this.ambBus = bus(0.7, 0.15);

    // Dreamy echo for plucks & bells
    this.echo = ctx.createDelay(1.0);
    this.echo.delayTime.value = 0.36;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const echoTone = ctx.createBiquadFilter();
    echoTone.type = 'lowpass';
    echoTone.frequency.value = 2600;
    this.echo.connect(echoTone);
    echoTone.connect(fb);
    fb.connect(this.echo);
    const echoOut = ctx.createGain();
    echoOut.gain.value = 0.35;
    echoTone.connect(echoOut);
    echoOut.connect(this.musicBus);

    this.noiseBuffer = this.makeNoise(3);
    this.buildAmbience();
  }

  makeImpulse(seconds, decay) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const data = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  // Pink-ish noise (soft, natural for water & wind)
  makeNoise(seconds) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(1, len, rate);
    const data = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      data[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
    }
    return buf;
  }

  noiseSource(loop = true) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = loop;
    return src;
  }

  // ---------- Ambience beds ----------
  buildAmbience() {
    const ctx = this.ctx;
    const bed = (type, freq, q) => {
      const src = this.noiseSource();
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = freq;
      filter.Q.value = q;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.ambBus);
      src.start(0, Math.random() * 2);
      return { filter, gain };
    };
    this.riverBed = bed('lowpass', 520, 0.5);
    this.fallBed = bed('lowpass', 520, 0.4);
    this.fallHiss = bed('highpass', 2400, 0.3);
    this.windBed = bed('bandpass', 420, 1.1);
    this.rainBed = bed('highpass', 1600, 0.4);
    this.rainLow = bed('lowpass', 800, 0.4);

    // Slow gusts
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain);
    lfoGain.connect(this.windBed.filter.frequency);
    lfo.start();
  }

  // Called every frame by the game with the listener's surroundings
  updateAmbience({ waterDist, waterfallDist, altitude, night, swimming, rain = 0, storm = 0 }) {
    if (!this.ctx || !this.bgmPlaying) return;
    const t = this.ctx.currentTime;
    this.night = night;
    // Gentle babbling only right next to the water; the waterfall fades in within ~26 m
    const river = Math.pow(Math.max(0, 1 - Math.max(0, waterDist) / 5), 2) * 0.05 + (swimming ? 0.03 : 0);
    const fall = Math.pow(Math.max(0, 1 - waterfallDist / 26), 3);
    const wind = 0.02 + Math.min(1, Math.max(0, altitude - 6) / 35) * 0.45 + night * 0.02 + storm * 0.12;
    this.riverBed.gain.gain.setTargetAtTime(river, t, 0.35);
    this.fallBed.gain.gain.setTargetAtTime(fall * 1.0, t, 0.35);
    this.fallHiss.gain.gain.setTargetAtTime(fall * 0.18, t, 0.35);
    this.windBed.gain.gain.setTargetAtTime(wind, t, 0.8);
    this.rainBed.gain.gain.setTargetAtTime(rain * 0.1, t, 1.2);
    this.rainLow.gain.gain.setTargetAtTime(rain * 0.09 + storm * 0.05, t, 1.2);
    // the night is calm: music plays clearly quieter after dark
    this.musicBus.gain.setTargetAtTime(0.5 * (1 - 0.45 * night) * (1 - 0.35 * storm - 0.12 * rain), t, 1.5);
  }

  // ---------- Music sequencer ----------
  startBGM() {
    this.init();
    if (!this.ctx || this.bgmPlaying) return;
    this.bgmPlaying = true;
    this.seqStep = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.15;
    this.nextBird = this.ctx.currentTime + 2;
    this.nextCricket = this.ctx.currentTime + 1;
    this.nextOwl = this.ctx.currentTime + 12;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  setBGMMode(mode) {
    this.bgmMode = mode;
  }

  schedule() {
    const now = this.ctx.currentTime;
    // After a hidden tab the clock jumps; restart cleanly instead of flooding notes
    if (this.nextNoteTime < now - 0.25) this.nextNoteTime = now + 0.05;
    while (this.nextNoteTime < now + 0.12) {
      const wanted = this.bgmMode === 'boss' ? 'boss' : this.zone === 'forest' ? 'forest' : (this.night > 0.55 ? 'night' : (this.daySong || 'day'));
      if (wanted !== this.songKey && (wanted === 'boss' || this.songKey === 'boss')) {
        // Boss fights cut in immediately on a fresh bar
        this.seqStep = Math.ceil(this.seqStep / 16) * 16;
        this.songKey = wanted;
      } else if (this.seqStep % 16 === 0) {
        this.songKey = wanted;
      }
      if (this._enabled) this.playStep(this.songKey, this.seqStep, this.nextNoteTime);
      const song = SONGS[this.songKey];
      this.nextNoteTime += 60 / song.bpm / 4;
      this.seqStep++;
    }
    if (this._enabled) this.scheduleCritters(now);
  }

  playStep(key, step, t) {
    const song = SONGS[key];
    const s16 = 60 / song.bpm / 4;
    const barLen = s16 * 16;
    const s = step % 16;
    const bar = Math.floor(step / 16) % 4;
    const chord = song.chords[bar];
    const root = song.bass[bar];

    if (song.style === 'mystic') {
      // drifting pads and glassy bell arpeggios
      if (s === 0) this.pad(chord, t, barLen, 900, 0.04);
      if (s === 0) this.bass(mtof(root), t, barLen * 0.9, 0.12);
      if (s % 3 === 0) this.bell(mtof(chord[(s / 3 + bar) % chord.length] + 12), t, 0.03, 2.6);
      this.melodyAt(song, bar, s, t, (f, tt) => this.bell(f, tt, 0.035, 3.2));
    } else if (song.style === 'waltz') {
      // oom-pah-pah in groups of four 16ths, light and swaying
      if (s === 0) this.pad(chord, t, barLen, 1400, 0.025);
      if (s % 8 === 0) this.bass(mtof(s === 0 ? root : root + 7), t, s16 * 3, 0.15);
      if (s % 8 === 3 || s % 8 === 5) chord.forEach(n => this.pluck(mtof(n + 12), t, 0.025));
      if (s === 6 || s === 14) this.shaker(t, 0.014);
      this.melodyAt(song, bar, s, t, (f, tt) => this.bell(f, tt, 0.05, 1.3));
    } else if (song.style === 'bouncy') {
      if (s % 4 === 0) this.kick(t);
      if (s % 2 === 1) this.hat(t, false);
      if (s % 4 === 0 || s % 4 === 3) this.bass(mtof(s % 8 === 0 ? root : root + 12), t, s16 * 1.2, 0.13);
      if (s === 2 || s === 6 || s === 10 || s === 14) chord.forEach(n => this.pluck(mtof(n + 12), t, 0.022));
      this.melodyAt(song, bar, s, t, (f, tt) => this.pluck(f, tt, 0.06));
    } else if (song.style === 'lofi') {
      if (s === 0) this.pad(chord, t, barLen, 650, 0.04);
      if (s === 0 || s === 10) this.bass(mtof(root), t, s16 * 6, 0.14);
      if (s === 0 || s === 8) this.kick(t);
      if (s === 4 || s === 12) this.shaker(t, 0.02);
      if (s % 4 === 2) this.hat(t, false);
      this.melodyAt(song, bar, s, t, (f, tt) => this.bell(f, tt, 0.04, 2.2));
    } else if (key === 'day') {
      if (s === 0) this.pad(chord, t, barLen, 1200, 0.03);
      if (s === 0 || s === 8) this.bass(mtof(s === 0 ? root : root + 7), t, s16 * 7, 0.16);
      if ([0, 3, 6, 8, 11, 14].includes(s)) {
        const note = chord[(s + bar) % chord.length] + 12;
        this.pluck(mtof(note), t, 0.05);
      }
      if (s === 4 || s === 12) this.shaker(t, 0.018);
      this.melodyAt(song, bar, s, t, (f, tt) => this.bell(f, tt, 0.05, 1.6));
    } else if (key === 'night') {
      if (s === 0) this.pad(chord, t, barLen, 750, 0.034);
      if (s === 0) this.bass(mtof(root), t, barLen * 0.9, 0.13);
      if (s === 0 || s === 6 || s === 10) {
        const note = chord[(s / 2 + bar) % chord.length] + 24;
        this.bell(mtof(note), t, 0.035, 2.4);
      }
      this.melodyAt(song, bar, s, t, (f, tt) => this.bell(f, tt, 0.04, 3.0));
    } else {
      if (s % 4 === 0 || s === 14) this.kick(t);
      if (s === 4 || s === 12) this.snare(t);
      if (s % 2 === 0) this.hat(t, s % 8 === 6);
      if (s % 2 === 0) this.bossBass(mtof(root + (s % 4 === 2 ? 12 : 0)), t, s16 * 1.6);
      if (s === 0 || s === 3 || s === 6) this.stab(chord, t, s16 * 1.5);
      this.melodyAt(song, bar, s, t, (f, tt) => this.lead(f, tt, s16 * 2.5));
    }
  }

  melodyAt(song, bar, s, t, play) {
    for (let i = 0; i < song.melody.length; i++) {
      const [b, st, note] = song.melody[i];
      if (b === bar && st === s) play(mtof(note), t);
    }
  }

  // ---------- Instruments ----------
  env(gainNode, t, attack, peak, release) {
    gainNode.gain.setValueAtTime(0.0001, t);
    gainNode.gain.linearRampToValueAtTime(peak, t + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
  }

  osc(type, freq, t, stop, dest) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.connect(dest);
    o.start(t);
    o.stop(stop);
    return o;
  }

  pad(chord, t, dur, cutoff, level) {
    const ctx = this.ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(level, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(level * 0.7, t + dur * 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.25);
    filter.connect(g);
    g.connect(this.musicBus);
    chord.forEach(n => {
      const f = mtof(n);
      const a = this.osc('triangle', f, t, t + dur * 1.3, filter);
      a.detune.value = -7;
      const b = this.osc('sine', f, t, t + dur * 1.3, filter);
      b.detune.value = 7;
    });
  }

  pluck(freq, t, level) {
    const g = this.ctx.createGain();
    this.env(g, t, 0.006, level, 0.55);
    g.connect(this.musicBus);
    g.connect(this.echo);
    this.osc('sine', freq, t, t + 0.6, g);
    const h = this.ctx.createGain();
    h.gain.value = 0.3;
    h.connect(g);
    this.osc('triangle', freq * 2, t, t + 0.3, h);
  }

  // FM bell / celesta
  bell(freq, t, level, decay) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    this.env(g, t, 0.004, level, decay);
    g.connect(this.musicBus);
    g.connect(this.echo);
    const carrier = this.osc('sine', freq, t, t + decay + 0.1, g);
    const mod = ctx.createOscillator();
    mod.frequency.value = freq * 3.5;
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(freq * 1.6, t);
    modGain.gain.exponentialRampToValueAtTime(1, t + decay * 0.6);
    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    mod.start(t);
    mod.stop(t + decay + 0.1);
  }

  bass(freq, t, dur, level) {
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const g = this.ctx.createGain();
    this.env(g, t, 0.02, level, dur);
    filter.connect(g);
    g.connect(this.musicBus);
    this.osc('sine', freq, t, t + dur + 0.1, filter);
    this.osc('triangle', freq * 2, t, t + dur + 0.1, filter).detune.value = 3;
  }

  shaker(t, level) {
    const src = this.noiseSource(false);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    const g = this.ctx.createGain();
    this.env(g, t, 0.01, level, 0.09);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.musicBus);
    src.start(t, Math.random());
    src.stop(t + 0.15);
  }

  kick(t) {
    const g = this.ctx.createGain();
    this.env(g, t, 0.003, 0.5, 0.28);
    g.connect(this.musicBus);
    const o = this.osc('sine', 150, t, t + 0.32, g);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  }

  snare(t) {
    const src = this.noiseSource(false);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1900;
    filter.Q.value = 0.8;
    const g = this.ctx.createGain();
    this.env(g, t, 0.002, 0.32, 0.16);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.musicBus);
    src.start(t, Math.random());
    src.stop(t + 0.22);
    const tg = this.ctx.createGain();
    this.env(tg, t, 0.002, 0.14, 0.08);
    tg.connect(this.musicBus);
    this.osc('triangle', 190, t, t + 0.12, tg);
  }

  hat(t, open) {
    const src = this.noiseSource(false);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7500;
    const g = this.ctx.createGain();
    this.env(g, t, 0.001, 0.09, open ? 0.18 : 0.04);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.musicBus);
    src.start(t, Math.random());
    src.stop(t + 0.25);
  }

  bossBass(freq, t, dur) {
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 7;
    filter.frequency.setValueAtTime(220, t);
    filter.frequency.exponentialRampToValueAtTime(1500, t + 0.03);
    filter.frequency.exponentialRampToValueAtTime(260, t + dur);
    const g = this.ctx.createGain();
    this.env(g, t, 0.005, 0.13, dur);
    filter.connect(g);
    g.connect(this.musicBus);
    this.osc('sawtooth', freq, t, t + dur + 0.05, filter);
  }

  stab(chord, t, dur) {
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2200;
    const g = this.ctx.createGain();
    this.env(g, t, 0.004, 0.045, dur);
    filter.connect(g);
    g.connect(this.musicBus);
    chord.forEach(n => this.osc('sawtooth', mtof(n), t, t + dur + 0.05, filter).detune.value = Math.random() * 10 - 5);
  }

  lead(freq, t, dur) {
    const ctx = this.ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 3200;
    const g = ctx.createGain();
    this.env(g, t, 0.01, 0.06, dur);
    filter.connect(g);
    g.connect(this.musicBus);
    g.connect(this.echo);
    const o = this.osc('square', freq, t, t + dur + 0.1, filter);
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.5;
    const vibGain = ctx.createGain();
    vibGain.gain.value = freq * 0.012;
    vib.connect(vibGain);
    vibGain.connect(o.frequency);
    vib.start(t);
    vib.stop(t + dur + 0.1);
  }

  // ---------- Critters (birds by day, crickets & owl by night) ----------
  panned(level) {
    const g = this.ctx.createGain();
    g.gain.value = level;
    if (this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.random() * 1.6 - 0.8;
      g.connect(p);
      p.connect(this.ambBus);
    } else {
      g.connect(this.ambBus);
    }
    return g;
  }

  scheduleCritters(now) {
    const day = 1 - this.night;
    if (now > this.nextBird) {
      if (day > 0.4 && this.bgmMode !== 'boss') this.birdCall(now + 0.05, day);
      this.nextBird = now + 2 + Math.random() * 5;
    }
    if (now > this.nextCricket) {
      if (this.night > 0.35) this.cricket(now + 0.05, this.night);
      this.nextCricket = now + 0.35 + Math.random() * 0.8;
    }
    if (now > this.nextOwl) {
      if (this.night > 0.6) this.owl(now + 0.05);
      this.nextOwl = now + 14 + Math.random() * 18;
    }
  }

  birdCall(t, level) {
    const out = this.panned(0.05 * level);
    const base = 2300 + Math.random() * 1400;
    const chirps = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < chirps; i++) {
      const ct = t + i * (0.11 + Math.random() * 0.05);
      const g = this.ctx.createGain();
      this.env(g, ct, 0.01, 1, 0.09);
      g.connect(out);
      const o = this.osc('sine', base, ct, ct + 0.12, g);
      o.frequency.linearRampToValueAtTime(base * 1.45, ct + 0.04);
      o.frequency.linearRampToValueAtTime(base * 1.1, ct + 0.1);
    }
  }

  cricket(t, level) {
    const out = this.panned(0.018 * level);
    for (let i = 0; i < 3; i++) {
      const ct = t + i * 0.045;
      const g = this.ctx.createGain();
      this.env(g, ct, 0.004, 1, 0.025);
      g.connect(out);
      this.osc('sine', 4300 + Math.random() * 200, ct, ct + 0.04, g);
    }
  }

  owl(t) {
    const out = this.panned(0.06);
    [0, 0.45].forEach((off, i) => {
      const g = this.ctx.createGain();
      this.env(g, t + off, 0.06, 1, i ? 0.6 : 0.3);
      g.connect(out);
      const o = this.osc('sine', 390, t + off, t + off + 0.8, g);
      o.frequency.linearRampToValueAtTime(350, t + off + 0.4);
    });
  }

  // ---------- Sound effects (API used by the game) ----------
  // Effects connect to this.out: normally the SFX bus, or a temporary distance/pan stage (see spatial)
  get out() {
    return this._out || this.sfxBus;
  }

  // Play any effect as if it came from somewhere: `volume` (0..1) follows the distance, `pan` (-1..1) the side
  spatial(volume, pan, play) {
    this.init();
    if (!this.ctx) return;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    g.connect(p);
    p.connect(this.sfxBus);
    this._out = g;
    try { play(); } finally { this._out = null; }
    setTimeout(() => { g.disconnect(); p.disconnect(); }, 4000);
  }

  playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.1) {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const g = this.ctx.createGain();
    this.env(g, t, 0.005, gainVal, duration);
    g.connect(this.out);
    this.osc(type, freq, t, t + duration + 0.05, g);
  }

  sweep(type, f0, f1, dur, level, t = this.ctx.currentTime) {
    const g = this.ctx.createGain();
    this.env(g, t, 0.005, level, dur);
    g.connect(this.out);
    const o = this.osc(type, f0, t, t + dur + 0.05, g);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  }

  noiseBurst(type, freq, dur, level, t = this.ctx.currentTime, freqEnd) {
    const src = this.noiseSource(false);
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    if (freqEnd) filter.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = this.ctx.createGain();
    this.env(g, t, 0.004, level, dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.out);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  sparkle(notes, gap, level, decay = 0.7) {
    const t = this.ctx.currentTime;
    notes.forEach((m, i) => {
      const g = this.ctx.createGain();
      this.env(g, t + i * gap, 0.003, level, decay);
      g.connect(this.out);
      this.osc('sine', mtof(m), t + i * gap, t + i * gap + decay + 0.05, g);
      const h = this.ctx.createGain();
      h.gain.value = 0.25;
      h.connect(g);
      this.osc('sine', mtof(m) * 3, t + i * gap, t + i * gap + decay * 0.5, h);
    });
  }

  jump() {
    this.init();
    if (!this.ctx) return;
    this.sweep('triangle', 300, 640, 0.17, 0.11);
    this.noiseBurst('bandpass', 1200, 0.08, 0.05);
  }

  arrowShoot() {
    this.init();
    if (!this.ctx) return;
    this.sweep('sine', 1500, 480, 0.13, 0.12);
    this.sparkle([88, 93], 0.04, 0.05, 0.3);
  }

  heal() {
    this.init();
    if (!this.ctx) return;
    this.sparkle([72, 76, 79, 84, 88, 91], 0.06, 0.07, 0.9);
  }

  petrify() {
    this.init();
    if (!this.ctx) return;
    this.noiseBurst('lowpass', 500, 0.55, 0.4, undefined, 120);
    this.sweep('sine', 120, 45, 0.4, 0.3);
  }

  invisible() {
    this.init();
    if (!this.ctx) return;
    this.sparkle([86, 83, 79, 74, 71], 0.06, 0.06, 0.8);
    this.noiseBurst('highpass', 3000, 0.5, 0.05);
  }

  magicSkill(sisterIdx) {
    this.init();
    if (!this.ctx) return;
    if (sisterIdx === 0) {
      this.sparkle([79, 84, 88], 0.07, 0.07, 1.1); // Luna: moon chime
    } else if (sisterIdx === 1) {
      this.sparkle([84, 88, 91, 96], 0.035, 0.06, 0.5); // Stella: twinkle
    } else if (sisterIdx === 2) {
      this.noiseBurst('bandpass', 400, 0.45, 0.22, undefined, 2400); // Sol: solar whoosh
      this.sparkle([69, 76, 81], 0.05, 0.06, 0.6);
    } else {
      this.sweep('sine', 220, 660, 0.35, 0.1); // Planeta: warp
      this.sweep('triangle', 330, 990, 0.35, 0.05);
    }
  }

  hit() {
    this.init();
    if (!this.ctx) return;
    this.sweep('sine', 170, 55, 0.18, 0.35);
    this.noiseBurst('bandpass', 1400, 0.1, 0.18);
  }

  bossSpin() {
    this.init();
    if (!this.ctx) return;
    this.noiseBurst('bandpass', 300, 0.7, 0.3, undefined, 2200);
    this.sweep('sawtooth', 80, 140, 0.6, 0.06);
  }

  splash() {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noiseBurst('bandpass', 1800, 0.35, 0.3, t, 350);
    for (let i = 0; i < 4; i++) {
      this.sweep('sine', 500 + Math.random() * 300, 1100 + Math.random() * 500, 0.06, 0.04, t + 0.08 + i * 0.05 + Math.random() * 0.03);
    }
  }

  swim() {
    if (!this.ctx) return;
    this.noiseBurst('bandpass', 900, 0.28, 0.07, undefined, 450);
  }

  // Footsteps on different surfaces
  step(surface) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (surface === 'water') {
      this.noiseBurst('bandpass', 1300, 0.16, 0.09, t, 600);
    } else if (surface === 'wood') {
      this.sweep('triangle', 210, 150, 0.07, 0.07);
      this.noiseBurst('lowpass', 900, 0.05, 0.05);
    } else if (surface === 'stone') {
      this.noiseBurst('bandpass', 2600, 0.04, 0.07);
    } else if (surface === 'crystal') {
      this.sparkle([96 + Math.floor(Math.random() * 3)], 0, 0.02, 0.25);
    } else {
      this.noiseBurst('lowpass', 1600 + Math.random() * 600, 0.06, 0.035);
    }
  }

  collect() {
    this.init();
    if (!this.ctx) return;
    this.sparkle([84, 88, 91, 96], 0.05, 0.07, 0.6);
  }

  nightfall() {
    this.init();
    if (!this.ctx) return;
    this.sparkle([69, 72, 76, 79, 84], 0.12, 0.04, 1.8);
  }

  sunrise() {
    this.init();
    if (!this.ctx) return;
    this.sparkle([72, 76, 79, 84, 88], 0.09, 0.04, 1.4);
  }

  thunder() {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noiseBurst('lowpass', 420, 2.6, 0.5, t, 60);
    this.sweep('sine', 95, 32, 1.8, 0.35, t);
    this.noiseBurst('bandpass', 160, 1.2, 0.3, t + 0.35, 50);
  }

  victory() {
    this.init();
    if (!this.ctx) return;
    this.sparkle([72, 76, 79, 84], 0.11, 0.1, 0.8);
    setTimeout(() => this.sparkle([79, 84, 88, 91], 0.02, 0.08, 1.6), 480);
  }
}
