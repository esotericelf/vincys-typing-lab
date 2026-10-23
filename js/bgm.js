/**
 * Background music manager — loads tracks from /src via playlist.json
 * Random shuffle playback with volume + mute controls.
 */

const PLAYLIST_URL = './src/playlist.json';
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
  return next;
}

export class BgmManager {
  constructor() {
    const prefs = loadPrefs();
    this.tracks = []; // { name, url }
    this.enabled = prefs.bgmEnabled === true; // default off
    this.volume = Number.isFinite(prefs.bgmVolume) ? prefs.bgmVolume : 0.35;
    this.currentIndex = -1;
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.loop = false;
    this.unlocked = false;
    this._wantPlay = false;
    this._onTrackChange = null;

    this.audio.volume = this.enabled ? this.volume : 0;
    this.audio.addEventListener('ended', () => this.playNextRandom());
    this.audio.addEventListener('error', () => {
      // Skip broken track
      setTimeout(() => this.playNextRandom(true), 400);
    });
  }

  onTrackChange(cb) {
    this._onTrackChange = cb;
  }

  async loadPlaylist() {
    try {
      const res = await fetch(PLAYLIST_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const names = Array.isArray(data.tracks) ? data.tracks : [];
      this.tracks = names
        .filter((n) => /\.(mp3|wav|ogg|m4a)$/i.test(n))
        .map((name) => ({
          name,
          url: `./src/${encodeURIComponent(name).replace(/%2F/gi, '/')}`,
        }));
    } catch (err) {
      console.warn('[bgm] playlist load failed', err);
      this.tracks = [];
    }
    return this.tracks;
  }

  get currentTrackName() {
    if (this.currentIndex < 0 || !this.tracks[this.currentIndex]) return '—';
    return this.tracks[this.currentIndex].name;
  }

  _emitTrack() {
    if (typeof this._onTrackChange === 'function') {
      this._onTrackChange({
        name: this.currentTrackName,
        enabled: this.enabled,
        volume: this.volume,
        playing: !this.audio.paused && this.enabled,
      });
    }
  }

  /** Call on first user gesture to satisfy autoplay policy */
  unlock() {
    this.unlocked = true;
    if (this._wantPlay && this.enabled) this.start();
  }

  start() {
    this._wantPlay = true;
    if (!this.enabled || !this.tracks.length) {
      this._emitTrack();
      return;
    }
    if (!this.unlocked) {
      this._emitTrack();
      return;
    }
    if (this.currentIndex < 0 || this.audio.paused) {
      if (this.currentIndex < 0) this.playNextRandom();
      else this._safePlay();
    }
    this._emitTrack();
  }

  _safePlay() {
    this.audio.volume = this.enabled ? this.volume : 0;
    const p = this.audio.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        /* wait for unlock */
      });
    }
  }

  playNextRandom(forceDifferent = false) {
    if (!this.tracks.length) return;
    let next = Math.floor(Math.random() * this.tracks.length);
    if (forceDifferent && this.tracks.length > 1) {
      let guard = 0;
      while (next === this.currentIndex && guard++ < 12) {
        next = Math.floor(Math.random() * this.tracks.length);
      }
    }
    this.currentIndex = next;
    const track = this.tracks[next];
    this.audio.src = track.url;
    this.audio.load();
    this._emitTrack();
    if (this.enabled && this.unlocked && this._wantPlay) this._safePlay();
  }

  setEnabled(on) {
    this.enabled = !!on;
    savePrefs({ bgmEnabled: this.enabled });
    if (this.enabled) {
      this.audio.volume = this.volume;
      this.start();
    } else {
      this.audio.pause();
      this.audio.volume = 0;
    }
    this._emitTrack();
  }

  toggle() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  setVolume(vol01) {
    this.volume = Math.max(0, Math.min(1, Number(vol01) || 0));
    savePrefs({ bgmVolume: this.volume });
    if (this.enabled) this.audio.volume = this.volume;
    this._emitTrack();
  }
}

export const bgm = new BgmManager();
