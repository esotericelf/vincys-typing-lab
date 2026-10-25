/**
 * SFX via Web Audio synth + shared volume / mute
 */

const STORAGE_KEY = 'vincys-typing-lab-audio';

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function savePrefs(partial) {
  const next = { ...loadPrefs(), ...partial };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export class GameAudio {
  constructor() {
    const prefs = loadPrefs();
    this.enabled = prefs.sfxEnabled !== false;
    this.volume = Number.isFinite(prefs.sfxVolume) ? prefs.sfxVolume : 0.7;
    this.ctx = null;
  }

  ensureCtx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  setEnabled(on) {
    this.enabled = !!on;
    savePrefs({ sfxEnabled: this.enabled });
  }

  toggle() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  setVolume(vol01) {
    this.volume = Math.max(0, Math.min(1, Number(vol01) || 0));
    savePrefs({ sfxVolume: this.volume });
  }

  playTone(freq, duration, type = 'sine', gain = 0.08) {
    if (!this.enabled || this.volume <= 0) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const level = gain * this.volume;
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(level, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  keypress() {
    this.playTone(520 + Math.random() * 80, 0.05, 'triangle', 0.05);
  }

  success() {
    if (!this.enabled) return;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 0.18, 'sine', 0.09), i * 70);
    });
  }

  /** Race / mission complete fanfare */
  finish() {
    if (!this.enabled) return;
    const chord = [
      [392.0, 0],
      [493.88, 80],
      [587.33, 160],
      [783.99, 280],
      [987.77, 420],
    ];
    chord.forEach(([f, delay]) => {
      setTimeout(() => this.playTone(f, 0.35, 'sine', 0.11), delay);
    });
    setTimeout(() => this.playTone(1174.66, 0.55, 'triangle', 0.08), 560);
  }

  error() {
    this.playTone(140, 0.18, 'sawtooth', 0.06);
  }
}
