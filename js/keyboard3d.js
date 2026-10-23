import * as THREE from 'three';
import { CANGJIE_RADICALS } from './cangjieData.js';
import { THEMES } from './themeManager.js';

const ROW_LAYOUT = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

const KEY_W = 0.9;
const KEY_H = 0.28;
const KEY_D = 0.9;
const GAP = 0.12;

const DEFAULT_KB = THEMES.cyberpunk.keyboard;
const DEFAULT_SCREEN = THEMES.cyberpunk.screen;

function createKeyTexture(letter, radical, palette = DEFAULT_KB) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = palette.texBg;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = palette.texBorder;
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, size - 8, size - 8);

  ctx.fillStyle = palette.texLetter;
  ctx.font = 'bold 36px Orbitron, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, size * 0.5, size * 0.32);

  ctx.fillStyle = palette.texRadical;
  ctx.font = 'bold 48px "Noto Sans TC", "Microsoft JhengHei", sans-serif';
  ctx.fillText(radical || '·', size * 0.5, size * 0.68);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export class VirtualKeyboard {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'keyboard';
    this.keys = new Map();
    this.hintLetters = new Set();
    this.visible = true;
    this.homeY = 0;
    this.hiddenY = -6.5;
    this.targetGroupY = 0;
    this.palette = { ...DEFAULT_KB };
    this.baseMat = null;
    this.rimMat = null;
    scene.add(this.group);

    this._buildKeys();
    this._buildBase();
  }

  setVisible(show) {
    this.visible = !!show;
    this.targetGroupY = this.visible ? this.homeY : this.hiddenY;
  }

  toggleVisible() {
    this.setVisible(!this.visible);
    return this.visible;
  }

  applyTheme(palette) {
    this.palette = { ...DEFAULT_KB, ...palette };
    const p = this.palette;

    if (this.baseMat) {
      this.baseMat.color.setHex(p.baseColor);
      this.baseMat.emissive.setHex(p.baseEmissive);
      this.baseMat.emissiveIntensity = p.baseEmissiveIntensity;
    }
    if (this.rimMat) {
      this.rimMat.color.setHex(p.rimColor);
      this.rimMat.emissive.setHex(p.rimEmissive);
      this.rimMat.emissiveIntensity = p.rimEmissiveIntensity;
    }

    this.keys.forEach((key, letter) => {
      const radical = CANGJIE_RADICALS[letter] || '';
      const oldMap = key.topMat.map;
      const texture = createKeyTexture(letter, radical, p);
      key.topMat.map = texture;
      key.topMat.needsUpdate = true;
      if (oldMap) oldMap.dispose();

      key.sideMat.color.setHex(p.sideColor);
      key.sideMat.metalness = p.metalness;
      key.sideMat.roughness = p.roughness;
      key.sideMat.emissive.setHex(p.sideEmissive);
      key.sideMat.emissiveIntensity = p.sideEmissiveIntensity;

      if (key.state === 'idle') {
        key.topMat.emissive.setHex(p.topEmissive);
        key.topMat.emissiveIntensity = p.topEmissiveIntensity;
      } else if (key.state === 'hint') {
        key.topMat.emissive.setHex(p.hintTop);
        key.topMat.emissiveIntensity = 0.55;
        key.sideMat.emissive.setHex(p.hintSide);
        key.sideMat.emissiveIntensity = 0.9;
      }
    });
  }

  _buildBase() {
    const p = this.palette;
    const geo = new THREE.BoxGeometry(12.5, 0.2, 5.2);
    this.baseMat = new THREE.MeshStandardMaterial({
      color: p.baseColor,
      metalness: 0.6,
      roughness: 0.35,
      emissive: p.baseEmissive,
      emissiveIntensity: p.baseEmissiveIntensity,
    });
    const base = new THREE.Mesh(geo, this.baseMat);
    base.position.set(0, -0.25, 0);
    base.receiveShadow = true;
    this.group.add(base);

    const rimGeo = new THREE.BoxGeometry(12.7, 0.05, 5.4);
    this.rimMat = new THREE.MeshStandardMaterial({
      color: p.rimColor,
      emissive: p.rimEmissive,
      emissiveIntensity: p.rimEmissiveIntensity,
      metalness: 0.2,
      roughness: 0.5,
    });
    const rim = new THREE.Mesh(rimGeo, this.rimMat);
    rim.position.set(0, -0.38, 0);
    this.group.add(rim);
  }

  _buildKeys() {
    const p = this.palette;
    ROW_LAYOUT.forEach((row, rowIndex) => {
      const rowWidth = row.length * (KEY_W + GAP) - GAP;
      const startX = -rowWidth / 2 + KEY_W / 2;
      const stagger = rowIndex === 1 ? 0.35 : rowIndex === 2 ? 0.9 : 0;
      const z = 1.4 - rowIndex * (KEY_D + GAP);

      row.forEach((letter, i) => {
        const radical = CANGJIE_RADICALS[letter] || '';
        const texture = createKeyTexture(letter, radical, p);
        const geo = new THREE.BoxGeometry(KEY_W, KEY_H, KEY_D);
        const sideMat = new THREE.MeshStandardMaterial({
          color: p.sideColor,
          metalness: p.metalness,
          roughness: p.roughness,
          emissive: p.sideEmissive,
          emissiveIntensity: p.sideEmissiveIntensity,
        });
        const topMat = new THREE.MeshStandardMaterial({
          map: texture,
          color: 0xffffff,
          metalness: 0.15,
          roughness: 0.55,
          emissive: p.topEmissive,
          emissiveIntensity: p.topEmissiveIntensity,
        });
        const materials = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];
        const mesh = new THREE.Mesh(geo, materials);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const x = startX + i * (KEY_W + GAP) + stagger;
        const y = 0;
        mesh.position.set(x, y, z);
        mesh.userData = { letter, isKey: true };
        this.group.add(mesh);

        this.keys.set(letter, {
          mesh,
          baseY: y,
          pressUntil: 0,
          state: 'idle',
          topMat,
          sideMat,
        });
      });
    });
  }

  getIntersectable() {
    return [...this.keys.values()].map((k) => k.mesh);
  }

  press(letter, durationMs = 120) {
    const key = this.keys.get(letter?.toUpperCase());
    if (!key) return;
    key.pressUntil = performance.now() + durationMs;
    if (key.state === 'idle' || key.state === 'hint') {
      this._applyEmissive(key, this.palette.press, 0.85);
    }
  }

  flashCorrect(letter) {
    const key = this.keys.get(letter?.toUpperCase());
    if (!key) return;
    key.state = 'correct';
    this._applyEmissive(key, this.palette.correct, 1.2);
    key.pressUntil = performance.now() + 280;
    setTimeout(() => this._restoreKey(key), 300);
  }

  flashError(letter) {
    const key = this.keys.get(letter?.toUpperCase());
    if (!key) return;
    key.state = 'error';
    this._applyEmissive(key, this.palette.error, 1.1);
    key.pressUntil = performance.now() + 280;
    setTimeout(() => this._restoreKey(key), 300);
  }

  pulseKey(letter, durationMs = 480) {
    const key = this.keys.get(letter?.toUpperCase());
    if (!key) return;
    const p = this.palette;
    key.state = 'hint';
    this.hintLetters.add(letter.toUpperCase());
    key.pressUntil = performance.now() + Math.min(durationMs, 420);
    this._applyEmissive(key, p.hintSide, 1.55);
    key.topMat.emissive.setHex(p.hintTop);
    key.topMat.emissiveIntensity = 1.2;
    key.sideMat.emissive.setHex(p.hintSide);
    key.sideMat.emissiveIntensity = 1.4;
    setTimeout(() => {
      if (!this.hintLetters.has(letter.toUpperCase())) return;
      key.topMat.emissive.setHex(p.hintTop);
      key.topMat.emissiveIntensity = 0.55;
      key.sideMat.emissive.setHex(p.hintSide);
      key.sideMat.emissiveIntensity = 0.9;
      key.state = 'hint';
    }, durationMs);
  }

  setHints(letters) {
    this.clearHints();
    const p = this.palette;
    (letters || []).forEach((l) => {
      const letter = l.toUpperCase();
      const key = this.keys.get(letter);
      if (!key) return;
      this.hintLetters.add(letter);
      key.state = 'hint';
      this._applyEmissive(key, p.hintSide, 1.0);
      key.topMat.emissive.setHex(p.hintTop);
      key.topMat.emissiveIntensity = 0.55;
      key.sideMat.emissive.setHex(p.hintSide);
      key.sideMat.emissiveIntensity = 0.9;
    });
  }

  clearHints() {
    this.hintLetters.forEach((letter) => {
      const key = this.keys.get(letter);
      if (key) this._restoreKey(key);
    });
    this.hintLetters.clear();
  }

  _restoreKey(key) {
    const p = this.palette;
    if (this.hintLetters.has(key.mesh.userData.letter) && key.state !== 'error' && key.state !== 'correct') {
      key.state = 'hint';
      key.topMat.emissive.setHex(p.hintTop);
      key.topMat.emissiveIntensity = 0.55;
      key.sideMat.emissive.setHex(p.hintSide);
      key.sideMat.emissiveIntensity = 0.9;
      return;
    }
    key.state = 'idle';
    key.topMat.emissive.setHex(p.topEmissive);
    key.topMat.emissiveIntensity = p.topEmissiveIntensity;
    key.sideMat.emissive.setHex(p.sideEmissive);
    key.sideMat.emissiveIntensity = p.sideEmissiveIntensity;
  }

  _applyEmissive(key, hex, intensity) {
    key.topMat.emissive.setHex(hex);
    key.topMat.emissiveIntensity = intensity;
    key.sideMat.emissive.setHex(hex);
    key.sideMat.emissiveIntensity = intensity * 0.7;
  }

  update(now = performance.now()) {
    this.group.position.y += (this.targetGroupY - this.group.position.y) * 0.12;

    this.keys.forEach((key) => {
      const pressed = now < key.pressUntil;
      const targetY = pressed ? key.baseY - 0.12 : key.baseY;
      key.mesh.position.y += (targetY - key.mesh.position.y) * 0.35;
    });
  }
}

export class FloatingScreen {
  constructor(scene) {
    this.group = new THREE.Group();
    this.homePos = new THREE.Vector3(0, 3.2, -1.2);
    this.focusPos = new THREE.Vector3(0, 2.4, 0.4);
    this.targetPos = this.homePos.clone();
    this.group.position.copy(this.homePos);
    this.homeScale = 1;
    this.focusScale = 1.35;
    this.targetScale = 1;
    this.palette = { ...DEFAULT_SCREEN };
    scene.add(this.group);

    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024;
    this.canvas.height = 512;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;

    const geo = new THREE.PlaneGeometry(6.5, 3.25);
    const mat = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      side: THREE.DoubleSide,
    });
    this.panel = new THREE.Mesh(geo, mat);
    this.group.add(this.panel);

    this.frameMat = new THREE.MeshBasicMaterial({
      color: DEFAULT_SCREEN.frame,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    });
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(6.7, 3.45), this.frameMat);
    frame.position.z = -0.02;
    this.group.add(frame);

    this.targetChar = '—';
    this.buffer = '';
    this.modeLabel = '速成';
    this.status = 'idle';
    this.context = '';
    this.keyboardVisible = true;
    this.redraw();
  }

  applyTheme(palette) {
    this.palette = { ...DEFAULT_SCREEN, ...palette };
    if (this.frameMat) this.frameMat.color.setHex(this.palette.frame);
    this.redraw();
  }

  setKeyboardVisible(show) {
    this.keyboardVisible = !!show;
    if (this.keyboardVisible) {
      this.targetPos.copy(this.homePos);
      this.targetScale = this.homeScale;
    } else {
      this.targetPos.copy(this.focusPos);
      this.targetScale = this.focusScale;
    }
  }

  setContent({ char, buffer, modeLabel, status, context }) {
    if (char !== undefined) this.targetChar = char;
    if (buffer !== undefined) this.buffer = buffer;
    if (modeLabel !== undefined) this.modeLabel = modeLabel;
    if (status !== undefined) this.status = status;
    if (context !== undefined) this.context = context || '';
    this.redraw();
  }

  redraw() {
    const { ctx, canvas } = this;
    const p = this.palette;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, p.bg0);
    grad.addColorStop(1, p.bg1);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = p.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    ctx.strokeStyle = p.border;
    ctx.lineWidth = 4;
    ctx.strokeRect(12, 12, w - 24, h - 24);

    ctx.fillStyle = p.modeBg;
    ctx.fillRect(40, 40, 160, 44);
    ctx.fillStyle = p.modeFg;
    ctx.font = '600 22px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.modeLabel, 120, 62);

    if (this.context) {
      ctx.fillStyle = p.contextBg;
      ctx.fillRect(w - 220, 40, 180, 44);
      ctx.fillStyle = p.contextFg;
      ctx.font = '600 20px Orbitron, sans-serif';
      ctx.fillText(this.context, w - 130, 62);
    }

    const fontSize = this.keyboardVisible ? 220 : 280;
    ctx.fillStyle = p.char;
    ctx.font = `bold ${fontSize}px "Noto Sans TC", "Microsoft JhengHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = p.charGlow;
    ctx.shadowBlur = 28;
    ctx.fillText(this.targetChar || '—', w / 2, h * 0.48);
    ctx.shadowBlur = 0;

    let bufColor = p.idle;
    if (this.status === 'ok') bufColor = p.ok;
    if (this.status === 'err') bufColor = p.err;
    ctx.fillStyle = bufColor;
    ctx.font = '600 48px Orbitron, sans-serif';
    ctx.fillText((this.buffer || '·').replace(/_/g, '·'), w / 2, h * 0.82);

    this.texture.needsUpdate = true;
  }

  update(t) {
    const bob = Math.sin(t * 0.0012) * 0.12;
    this.group.position.x += (this.targetPos.x - this.group.position.x) * 0.08;
    this.group.position.y += (this.targetPos.y + bob - this.group.position.y) * 0.08;
    this.group.position.z += (this.targetPos.z - this.group.position.z) * 0.08;
    const s = this.group.scale.x + (this.targetScale - this.group.scale.x) * 0.08;
    this.group.scale.setScalar(s);
    this.group.rotation.y = Math.sin(t * 0.0005) * 0.04;
  }
}
