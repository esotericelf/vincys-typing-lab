/**
 * Multi-theme engine — CSS variables + Three.js lighting/material presets
 */

const STORAGE_KEY = 'vincys-typing-lab-theme';

export const THEMES = {
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    nameZh: '賽博霓虹',
    swatch: ['#05080f', '#00e5ff', '#ffc857'],
    css: {
      '--bg-deep': '#05080f',
      '--bg-panel': 'rgba(8, 14, 28, 0.88)',
      '--bg-panel-solid': '#080e1c',
      '--hud-fade': 'rgba(5, 8, 15, 0.92)',
      '--hud-fade-mid': 'rgba(5, 8, 15, 0.35)',
      '--cyan': '#00e5ff',
      '--magenta': '#ff2d6a',
      '--gold': '#ffc857',
      '--lime': '#3dff9a',
      '--accent-secondary': '#4d7cff',
      '--text': '#e8f4ff',
      '--muted': '#7a8fa8',
      '--border': 'rgba(0, 229, 255, 0.28)',
      '--glow-cyan': '0 0 18px rgba(0, 229, 255, 0.45)',
      '--glow-soft': '0 0 10px rgba(0, 229, 255, 0.35)',
      '--shadow-panel': '0 16px 48px rgba(0, 0, 0, 0.55)',
      '--candidate-bg': 'rgba(8, 14, 28, 0.92)',
      '--ok': '#3dff9a',
      '--err': '#ff2d6a',
      '--brand-grad-end': '#4d7cff',
      '--theme-color': '#05080f',
    },
    three: {
      sceneBg: 0x05080f,
      fog: 0x05080f,
      fogDensity: 0.035,
      ambient: { color: 0x1a2840, intensity: 0.55 },
      keyLight: { color: 0xa8d8ff, intensity: 1.1 },
      accentA: { color: 0x00e5ff, intensity: 2.2, distance: 28 },
      accentB: { color: 0xff2d6a, intensity: 1.4, distance: 22 },
      fill: { color: 0x4d7cff, intensity: 0.8, distance: 30 },
      floor: { color: 0x070c16, metalness: 0.55, roughness: 0.9 },
    },
    keyboard: {
      baseColor: 0x0a1220,
      baseEmissive: 0x001a28,
      baseEmissiveIntensity: 0.4,
      rimColor: 0x00e5ff,
      rimEmissive: 0x00e5ff,
      rimEmissiveIntensity: 0.8,
      sideColor: 0x121c30,
      sideEmissive: 0x001018,
      sideEmissiveIntensity: 0.25,
      topEmissive: 0x003344,
      topEmissiveIntensity: 0.2,
      metalness: 0.45,
      roughness: 0.4,
      texBg: '#0c1528',
      texBorder: 'rgba(0, 229, 255, 0.35)',
      texLetter: '#00e5ff',
      texRadical: '#e8f4ff',
      press: 0x00e5ff,
      correct: 0x3dff9a,
      error: 0xff2d6a,
      hintTop: 0x00e5ff,
      hintSide: 0xffc857,
    },
    screen: {
      bg0: 'rgba(8, 18, 36, 0.92)',
      bg1: 'rgba(4, 10, 22, 0.95)',
      grid: 'rgba(0, 229, 255, 0.08)',
      border: 'rgba(0, 229, 255, 0.55)',
      modeBg: 'rgba(0, 229, 255, 0.15)',
      modeFg: '#00e5ff',
      contextBg: 'rgba(255, 200, 87, 0.2)',
      contextFg: '#ffc857',
      char: '#e8f4ff',
      charGlow: 'rgba(0, 229, 255, 0.45)',
      idle: '#00e5ff',
      ok: '#3dff9a',
      err: '#ff2d6a',
      frame: 0x00e5ff,
    },
  },

  light: {
    id: 'light',
    name: 'Minimal Light',
    nameZh: '極簡白',
    swatch: ['#f4f6f8', '#334155', '#64748b'],
    css: {
      '--bg-deep': '#e8ecf1',
      '--bg-panel': 'rgba(255, 255, 255, 0.94)',
      '--bg-panel-solid': '#ffffff',
      '--hud-fade': 'rgba(232, 236, 241, 0.96)',
      '--hud-fade-mid': 'rgba(232, 236, 241, 0.45)',
      '--cyan': '#0f766e',
      '--magenta': '#b91c1c',
      '--gold': '#b45309',
      '--lime': '#15803d',
      '--accent-secondary': '#475569',
      '--text': '#0f172a',
      '--muted': '#475569',
      '--border': 'rgba(15, 23, 42, 0.22)',
      '--glow-cyan': '0 0 12px rgba(15, 118, 110, 0.25)',
      '--glow-soft': '0 0 8px rgba(15, 118, 110, 0.18)',
      '--shadow-panel': '0 12px 32px rgba(15, 23, 42, 0.18)',
      '--candidate-bg': 'rgba(255, 255, 255, 0.96)',
      '--ok': '#15803d',
      '--err': '#b91c1c',
      '--brand-grad-end': '#334155',
      '--theme-color': '#e8ecf1',
    },
    three: {
      sceneBg: 0xd8dee6,
      fog: 0xd8dee6,
      fogDensity: 0.022,
      ambient: { color: 0xffffff, intensity: 0.85 },
      keyLight: { color: 0xfff8f0, intensity: 1.05 },
      accentA: { color: 0x94a3b8, intensity: 0.9, distance: 28 },
      accentB: { color: 0xcbd5e1, intensity: 0.55, distance: 22 },
      fill: { color: 0xe2e8f0, intensity: 0.7, distance: 30 },
      floor: { color: 0xc5ced8, metalness: 0.15, roughness: 0.85 },
    },
    keyboard: {
      baseColor: 0xe2e8f0,
      baseEmissive: 0xb8c4d0,
      baseEmissiveIntensity: 0.15,
      rimColor: 0x64748b,
      rimEmissive: 0x475569,
      rimEmissiveIntensity: 0.35,
      sideColor: 0xcbd5e1,
      sideEmissive: 0x94a3b8,
      sideEmissiveIntensity: 0.12,
      topEmissive: 0xffffff,
      topEmissiveIntensity: 0.08,
      metalness: 0.12,
      roughness: 0.55,
      texBg: '#f1f5f9',
      texBorder: 'rgba(51, 65, 85, 0.45)',
      texLetter: '#0f172a',
      texRadical: '#334155',
      press: 0x0f766e,
      correct: 0x15803d,
      error: 0xb91c1c,
      hintTop: 0x0f766e,
      hintSide: 0xb45309,
    },
    screen: {
      bg0: 'rgba(255, 255, 255, 0.96)',
      bg1: 'rgba(241, 245, 249, 0.98)',
      grid: 'rgba(51, 65, 85, 0.06)',
      border: 'rgba(15, 23, 42, 0.35)',
      modeBg: 'rgba(15, 118, 110, 0.12)',
      modeFg: '#0f766e',
      contextBg: 'rgba(180, 83, 9, 0.12)',
      contextFg: '#b45309',
      char: '#0f172a',
      charGlow: 'rgba(15, 118, 110, 0.2)',
      idle: '#0f766e',
      ok: '#15803d',
      err: '#b91c1c',
      frame: 0x64748b,
    },
  },

  matrix: {
    id: 'matrix',
    name: 'Matrix',
    nameZh: '矩陣綠',
    swatch: ['#020804', '#00ff66', '#003b1a'],
    css: {
      '--bg-deep': '#020804',
      '--bg-panel': 'rgba(0, 18, 8, 0.92)',
      '--bg-panel-solid': '#001208',
      '--hud-fade': 'rgba(2, 8, 4, 0.95)',
      '--hud-fade-mid': 'rgba(2, 8, 4, 0.4)',
      '--cyan': '#00ff66',
      '--magenta': '#39ff14',
      '--gold': '#a8ff60',
      '--lime': '#66ff99',
      '--accent-secondary': '#00aa44',
      '--text': '#c8ffd8',
      '--muted': '#4a9a68',
      '--border': 'rgba(0, 255, 102, 0.35)',
      '--glow-cyan': '0 0 18px rgba(0, 255, 102, 0.4)',
      '--glow-soft': '0 0 10px rgba(0, 255, 102, 0.3)',
      '--shadow-panel': '0 16px 48px rgba(0, 0, 0, 0.7)',
      '--candidate-bg': 'rgba(0, 18, 8, 0.94)',
      '--ok': '#66ff99',
      '--err': '#ff3344',
      '--brand-grad-end': '#00aa44',
      '--theme-color': '#020804',
    },
    three: {
      sceneBg: 0x020804,
      fog: 0x020804,
      fogDensity: 0.04,
      ambient: { color: 0x0a2010, intensity: 0.5 },
      keyLight: { color: 0xa8ffc8, intensity: 0.95 },
      accentA: { color: 0x00ff66, intensity: 2.4, distance: 28 },
      accentB: { color: 0x39ff14, intensity: 1.1, distance: 22 },
      fill: { color: 0x00aa44, intensity: 0.75, distance: 30 },
      floor: { color: 0x041008, metalness: 0.4, roughness: 0.85 },
    },
    keyboard: {
      baseColor: 0x06140a,
      baseEmissive: 0x002210,
      baseEmissiveIntensity: 0.45,
      rimColor: 0x00ff66,
      rimEmissive: 0x00ff66,
      rimEmissiveIntensity: 0.9,
      sideColor: 0x0a1c10,
      sideEmissive: 0x003318,
      sideEmissiveIntensity: 0.3,
      topEmissive: 0x004422,
      topEmissiveIntensity: 0.25,
      metalness: 0.35,
      roughness: 0.45,
      texBg: '#041208',
      texBorder: 'rgba(0, 255, 102, 0.4)',
      texLetter: '#00ff66',
      texRadical: '#c8ffd8',
      press: 0x00ff66,
      correct: 0x66ff99,
      error: 0xff3344,
      hintTop: 0x00ff66,
      hintSide: 0xa8ff60,
    },
    screen: {
      bg0: 'rgba(0, 16, 8, 0.94)',
      bg1: 'rgba(0, 8, 4, 0.96)',
      grid: 'rgba(0, 255, 102, 0.1)',
      border: 'rgba(0, 255, 102, 0.55)',
      modeBg: 'rgba(0, 255, 102, 0.14)',
      modeFg: '#00ff66',
      contextBg: 'rgba(168, 255, 96, 0.15)',
      contextFg: '#a8ff60',
      char: '#c8ffd8',
      charGlow: 'rgba(0, 255, 102, 0.5)',
      idle: '#00ff66',
      ok: '#66ff99',
      err: '#ff3344',
      frame: 0x00ff66,
    },
  },

  sunset: {
    id: 'sunset',
    name: 'Sunset',
    nameZh: '暮色金',
    swatch: ['#1a0a1e', '#ff8c42', '#ff6b6b'],
    css: {
      '--bg-deep': '#16081c',
      '--bg-panel': 'rgba(36, 16, 42, 0.9)',
      '--bg-panel-solid': '#24102a',
      '--hud-fade': 'rgba(22, 8, 28, 0.94)',
      '--hud-fade-mid': 'rgba(22, 8, 28, 0.4)',
      '--cyan': '#ff8c42',
      '--magenta': '#ff6b6b',
      '--gold': '#ffc857',
      '--lime': '#f4a261',
      '--accent-secondary': '#c084fc',
      '--text': '#fff1e6',
      '--muted': '#c4a0b0',
      '--border': 'rgba(255, 140, 66, 0.35)',
      '--glow-cyan': '0 0 18px rgba(255, 140, 66, 0.4)',
      '--glow-soft': '0 0 10px rgba(255, 140, 66, 0.3)',
      '--shadow-panel': '0 16px 48px rgba(0, 0, 0, 0.6)',
      '--candidate-bg': 'rgba(36, 16, 42, 0.94)',
      '--ok': '#f4a261',
      '--err': '#ff6b6b',
      '--brand-grad-end': '#c084fc',
      '--theme-color': '#16081c',
    },
    three: {
      sceneBg: 0x16081c,
      fog: 0x16081c,
      fogDensity: 0.036,
      ambient: { color: 0x2a1430, intensity: 0.55 },
      keyLight: { color: 0xffd4a8, intensity: 1.05 },
      accentA: { color: 0xff8c42, intensity: 2.1, distance: 28 },
      accentB: { color: 0xff6b6b, intensity: 1.5, distance: 22 },
      fill: { color: 0xc084fc, intensity: 0.85, distance: 30 },
      floor: { color: 0x120614, metalness: 0.5, roughness: 0.88 },
    },
    keyboard: {
      baseColor: 0x1e0e24,
      baseEmissive: 0x2a1028,
      baseEmissiveIntensity: 0.4,
      rimColor: 0xff8c42,
      rimEmissive: 0xff8c42,
      rimEmissiveIntensity: 0.85,
      sideColor: 0x241430,
      sideEmissive: 0x301020,
      sideEmissiveIntensity: 0.28,
      topEmissive: 0x402018,
      topEmissiveIntensity: 0.22,
      metalness: 0.4,
      roughness: 0.42,
      texBg: '#1c0e22',
      texBorder: 'rgba(255, 140, 66, 0.4)',
      texLetter: '#ff8c42',
      texRadical: '#fff1e6',
      press: 0xff8c42,
      correct: 0xf4a261,
      error: 0xff6b6b,
      hintTop: 0xff8c42,
      hintSide: 0xffc857,
    },
    screen: {
      bg0: 'rgba(36, 14, 42, 0.94)',
      bg1: 'rgba(22, 8, 28, 0.96)',
      grid: 'rgba(255, 140, 66, 0.08)',
      border: 'rgba(255, 140, 66, 0.5)',
      modeBg: 'rgba(255, 140, 66, 0.15)',
      modeFg: '#ff8c42',
      contextBg: 'rgba(255, 200, 87, 0.18)',
      contextFg: '#ffc857',
      char: '#fff1e6',
      charGlow: 'rgba(255, 140, 66, 0.45)',
      idle: '#ff8c42',
      ok: '#f4a261',
      err: '#ff6b6b',
      frame: 0xff8c42,
    },
  },
};

export const THEME_ORDER = ['cyberpunk', 'light', 'matrix', 'sunset'];

function loadSavedId() {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    if (id && THEMES[id]) return id;
  } catch {
    /* ignore */
  }
  return 'cyberpunk';
}

export class ThemeManager {
  constructor() {
    this.currentId = loadSavedId();
    this._sceneApi = null;
    this._listeners = new Set();
  }

  get current() {
    return THEMES[this.currentId] || THEMES.cyberpunk;
  }

  list() {
    return THEME_ORDER.map((id) => THEMES[id]);
  }

  /** Bind Three.js scene objects once after creation */
  bindScene(api) {
    this._sceneApi = api;
  }

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _isMobileViewport() {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches;
  }

  /** High-contrast / cheaper effect tokens for small screens */
  _mobileCssOverrides(theme) {
    const base = {
      '--blur-panel': 'none',
      '--blur-soft': 'none',
      '--glow-cyan': 'none',
      '--glow-soft': 'none',
      '--shadow-panel': '0 8px 20px rgba(0, 0, 0, 0.4)',
    };
    if (theme.id === 'light') {
      return {
        ...base,
        '--text': '#0b1220',
        '--muted': '#334155',
        '--border': 'rgba(15, 23, 42, 0.38)',
        '--shadow-panel': '0 8px 18px rgba(15, 23, 42, 0.18)',
        '--bg-panel': 'rgba(255, 255, 255, 0.98)',
        '--candidate-bg': 'rgba(255, 255, 255, 0.98)',
      };
    }
    if (theme.id === 'matrix') {
      return {
        ...base,
        '--text': '#e0ffe8',
        '--muted': '#7ad99a',
        '--border': 'rgba(0, 255, 102, 0.55)',
      };
    }
    if (theme.id === 'sunset') {
      return {
        ...base,
        '--text': '#fff8f0',
        '--muted': '#e8c0cc',
        '--border': 'rgba(255, 140, 66, 0.55)',
      };
    }
    // cyberpunk default
    return {
      ...base,
      '--text': '#f0f8ff',
      '--muted': '#9eb4cc',
      '--border': 'rgba(0, 229, 255, 0.45)',
    };
  }

  applyCss(theme = this.current) {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme.id);
    Object.entries(theme.css).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    if (this._isMobileViewport()) {
      Object.entries(this._mobileCssOverrides(theme)).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });
    } else {
      // Restore desktop blur/glow tokens from theme (already set above)
      root.style.setProperty('--blur-panel', 'blur(10px)');
      root.style.setProperty('--blur-soft', 'blur(8px)');
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme.css['--theme-color'] || theme.css['--bg-deep']);
  }

  applyThree(theme = this.current) {
    const api = this._sceneApi;
    if (!api) return;
    const t = theme.three;

    if (api.scene) {
      api.scene.background.setHex(t.sceneBg);
      if (api.scene.fog) {
        api.scene.fog.color.setHex(t.fog);
        if ('density' in api.scene.fog) api.scene.fog.density = t.fogDensity;
      }
    }

    const setLight = (light, preset) => {
      if (!light || !preset) return;
      light.color.setHex(preset.color);
      light.intensity = preset.intensity;
      if (preset.distance != null && 'distance' in light) light.distance = preset.distance;
    };

    setLight(api.ambient, t.ambient);
    setLight(api.keyLight, t.keyLight);
    setLight(api.accentA, t.accentA);
    setLight(api.accentB, t.accentB);
    setLight(api.fill, t.fill);

    if (api.floorMat) {
      api.floorMat.color.setHex(t.floor.color);
      api.floorMat.metalness = t.floor.metalness;
      api.floorMat.roughness = t.floor.roughness;
    }

    if (api.keyboard?.applyTheme) api.keyboard.applyTheme(theme.keyboard);
    if (api.screen?.applyTheme) api.screen.applyTheme(theme.screen);
  }

  setTheme(id, { persist = true } = {}) {
    if (!THEMES[id]) return this.current;
    this.currentId = id;
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, id);
      } catch {
        /* ignore */
      }
    }
    const theme = this.current;
    this.applyCss(theme);
    this.applyThree(theme);
    this._listeners.forEach((fn) => {
      try {
        fn(theme);
      } catch {
        /* ignore */
      }
    });
    return theme;
  }

  init() {
    this.applyCss(this.current);
    if (typeof window !== 'undefined' && !this._resizeBound) {
      this._resizeBound = true;
      let timer = 0;
      window.addEventListener('resize', () => {
        clearTimeout(timer);
        timer = setTimeout(() => this.applyCss(this.current), 120);
      });
    }
    return this.current;
  }
}

export const themeManager = new ThemeManager();
