import * as THREE from 'three';
import { VirtualKeyboard, FloatingScreen } from './keyboard3d.js';
import { TypingGame, buildRefSheet } from './game.js';
import { loadDictionary, SAMPLE_TEXTS, codeMap, dictSource } from './dictLoader.js';
import { registerServiceWorker, setupInstallPrompt } from './pwa.js';
import { bgm } from './bgm.js';
import { themeManager } from './themeManager.js';
import { MobileUi, isMobileViewport } from './mobileUi.js';

registerServiceWorker();
setupInstallPrompt();
themeManager.init();

const canvas = document.getElementById('game-canvas');

// —— Scene ——
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05080f);
scene.fog = new THREE.FogExp2(0x05080f, 0.035);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);

/** Desktop / landscape defaults */
const CAM_DESKTOP_HOME = { pos: new THREE.Vector3(0, 6.8, 9.5), look: new THREE.Vector3(0, 1.2, 0), fov: 42 };
const CAM_DESKTOP_FOCUS = { pos: new THREE.Vector3(0, 4.2, 7.2), look: new THREE.Vector3(0, 2.2, 0), fov: 38 };

/**
 * Mobile camera: pull back / widen FOV on narrow stages so the floating
 * character panel fits entirely between header and action toolbar.
 * @param {number} aspect canvas width / height
 */
function computeMobileCam(aspect = 1) {
  const a = Math.max(0.35, Math.min(aspect || 1, 2.5));
  // Upper-zone canvas is often wide-short; pull back / widen FOV so the panel fits
  let fov = 42;
  let z = 8.6;
  if (a < 0.9) {
    fov = 48;
    z = 9.4;
  }
  if (a < 0.7) {
    fov = 52;
    z = 10.2;
  }
  if (a < 0.55) {
    fov = 56;
    z = 11.0;
  }
  // Look straight at the floating panel origin (centered in the clipped stage)
  const lookY = 3.2;
  return {
    pos: new THREE.Vector3(0, lookY, z),
    look: new THREE.Vector3(0, lookY, 0),
    fov,
  };
}

function activeCamHome(aspect) {
  if (isMobileViewport()) return computeMobileCam(aspect ?? camera.aspect);
  return CAM_DESKTOP_HOME;
}
function activeCamFocus(aspect) {
  if (isMobileViewport()) return computeMobileCam(aspect ?? camera.aspect);
  return CAM_DESKTOP_FOCUS;
}

const camHome = {
  pos: activeCamHome().pos.clone(),
  look: activeCamHome().look.clone(),
  fov: activeCamHome().fov,
};
const camFocus = {
  pos: activeCamFocus().pos.clone(),
  look: activeCamFocus().look.clone(),
  fov: activeCamFocus().fov,
};
const camTarget = {
  pos: camHome.pos.clone(),
  look: camHome.look.clone(),
  fov: camHome.fov,
};
const lookCurrent = camHome.look.clone();
camera.position.copy(camHome.pos);
camera.lookAt(camHome.look);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const ambient = new THREE.AmbientLight(0x1a2840, 0.55);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xa8d8ff, 1.1);
keyLight.position.set(4, 10, 6);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
scene.add(keyLight);

const accentA = new THREE.PointLight(0x00e5ff, 2.2, 28);
accentA.position.set(-4, 4, 3);
scene.add(accentA);

const accentB = new THREE.PointLight(0xff2d6a, 1.4, 22);
accentB.position.set(5, 3, 2);
scene.add(accentB);

const fill = new THREE.PointLight(0x4d7cff, 0.8, 30);
fill.position.set(0, 5, -4);
scene.add(fill);

// Solid dark floor only — no GridHelper / ground grid lines
const floorGeo = new THREE.PlaneGeometry(40, 40);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x070c16,
  metalness: 0.55,
  roughness: 0.9,
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.55;
floor.receiveShadow = true;
scene.add(floor);

const keyboard = new VirtualKeyboard(scene);
keyboard.group.position.set(0, 0, 0.5);
keyboard.homeY = 0;

const screen = new FloatingScreen(scene);

themeManager.bindScene({
  scene,
  ambient,
  keyLight,
  accentA,
  accentB,
  fill,
  floorMat,
  keyboard,
  screen,
});
themeManager.applyThree(themeManager.current);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

/** Filled after MobileUi boots; resize() may run from visualViewport early. */
let mobileUiRef = null;

function applyViewportCamera(preserveKeyboardState = true, aspect) {
  const a = aspect ?? camera.aspect;
  const home = activeCamHome(a);
  const focus = activeCamFocus(a);
  camHome.pos.copy(home.pos);
  camHome.look.copy(home.look);
  camHome.fov = home.fov;
  camFocus.pos.copy(focus.pos);
  camFocus.look.copy(focus.look);
  camFocus.fov = focus.fov;

  const mobile = isMobileViewport();
  const showKb = mobile ? false : preserveKeyboardState ? keyboard.visible : true;
  const target = showKb ? camHome : camFocus;
  camTarget.pos.copy(target.pos);
  camTarget.look.copy(target.look);
  camTarget.fov = target.fov;
}

/** Publish app height; flex zones size the canvas — no absolute offset math. */
function syncMobileLayoutMetrics() {
  const vv = window.visualViewport;
  const appH = Math.round(vv?.height || window.innerHeight);
  document.documentElement.style.setProperty('--app-height', `${appH}px`);
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const vv = window.visualViewport;
  syncMobileLayoutMetrics();

  if (mobileUiRef?.refresh) {
    mobileUiRef.refresh();
  }

  // Force flex reflow then read the clipped stage (upper zone), not the window
  const stage = document.getElementById('stage-3d');
  void stage?.offsetHeight;
  const box = stage?.getBoundingClientRect?.();
  const cw = Math.max(1, Math.floor(box?.width || canvas.clientWidth || (vv ? vv.width : w)));
  const ch = Math.max(1, Math.floor(box?.height || canvas.clientHeight || (vv ? vv.height : h)));
  const aspect = cw / ch;

  camera.aspect = aspect;
  applyViewportCamera(true, aspect);
  if (isMobileViewport()) {
    screen.fitMobileStage(aspect);
    // Keep the floating panel centered in the upper-zone canvas
    floor.visible = false;
  } else {
    floor.visible = true;
  }
  camera.fov = camTarget.fov;
  camera.updateProjectionMatrix();

  const pr = Math.min(window.devicePixelRatio || 1, isMobileViewport() ? 1.5 : 2);
  renderer.setPixelRatio(pr);
  renderer.setSize(cw, ch, false);
  renderer.setViewport(0, 0, cw, ch);

  // Snap camera toward target on orientation changes (avoid long lerp behind UI)
  if (isMobileViewport() && lookCurrent) {
    camera.position.copy(camTarget.pos);
    lookCurrent.copy(camTarget.look);
    camera.lookAt(lookCurrent);
  }
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => {
  setTimeout(resize, 60);
  setTimeout(resize, 220);
});
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', resize);
  window.visualViewport.addEventListener('scroll', resize);
}

// —— HUD ——
function updateHud(data) {
  document.getElementById('stat-wpm').textContent = String(data.wpm);
  document.getElementById('stat-accuracy').textContent = `${data.accuracy}%`;
  document.getElementById('stat-streak').textContent = String(data.streak);
  document.getElementById('stat-timer').textContent = data.timer;
  const soundLabel = document.getElementById('sound-label');
  if (soundLabel) soundLabel.textContent = data.sound ? '音效 ON' : '音效 OFF';
  const settingsSound = document.getElementById('settings-sound-label');
  if (settingsSound) {
    settingsSound.textContent = data.sound ? '音效 ON' : '音效 OFF';
  }
}

function updateRaceHud(data) {
  const track = document.getElementById('race-track');
  if (!track) return;
  if (game.playMode !== 'race') {
    track.classList.add('hidden');
    return;
  }
  track.classList.remove('hidden');

  const pct = Math.round((data.progress || 0) * 100);
  document.getElementById('race-progress-label').textContent = `${pct}%`;
  document.getElementById('race-count-label').textContent = `${data.done} / ${data.total}`;
  document.getElementById('race-cpm-label').textContent = `${data.cpm} CPM`;
  document.getElementById('race-bar-fill').style.width = `${pct}%`;

  const m = data.metrics;
  const titleEl = document.getElementById('race-metrics');
  if (titleEl) {
    let title = m?.title || '文章';
    if (data.finished) title += data.completed ? ' · 完成' : ' · 時間到';
    titleEl.textContent = title;
    titleEl.title = m
      ? `${m.title || '文章'} · ${m.totalChars} 字 · 平均碼長 ${m.avgKeyLen} · ${m.difficulty}`
      : title;
  }
}

const game = new TypingGame({
  keyboard,
  screen,
  onHudUpdate: updateHud,
  onRaceUpdate: updateRaceHud,
});

function applyMobileScene(mobile) {
  keyboard.setForceHidden(mobile);
  screen.setMobileLayout(mobile);
  syncMobileLayoutMetrics();
  const aspect =
    Math.max(1, canvas.clientWidth) / Math.max(1, canvas.clientHeight || 1);
  applyViewportCamera(true, aspect);
  if (mobile) screen.fitMobileStage(aspect);
  const kbBtn = document.getElementById('btn-keyboard');
  if (kbBtn) kbBtn.classList.toggle('hidden-on-mobile', mobile);
  const label = document.getElementById('keyboard-label');
  if (label && mobile) label.textContent = '2D 鍵盤';
}

const mobileUi = new MobileUi({
  game,
  onMobileChange: applyMobileScene,
});
mobileUiRef = mobileUi;
game.mobileUi = mobileUi;
applyMobileScene(mobileUi.mobile);
resize();

// —— BGM + first-gesture autoplay unlock ——
function unlockAudio() {
  game.audio.ensureCtx();
  bgm.unlock();
}

['pointerdown', 'keydown', 'touchstart'].forEach((evt) => {
  window.addEventListener(evt, unlockAudio, { capture: true, passive: true });
});

bgm.onTrackChange(({ name, enabled, playing }) => {
  const el = document.getElementById('track-info');
  if (!el) return;
  if (!enabled) {
    el.textContent = `♪ BGM 已關閉 · ${name}`;
  } else if (playing) {
    el.textContent = `♪ Playing: ${name}`;
  } else {
    el.textContent = `♪ Ready: ${name}（點擊或按鍵後播放）`;
  }
});

(async () => {
  try {
    await bgm.loadPlaylist();
  } catch (err) {
    console.warn('[bgm] init failed — muted fallback', err);
    bgm.tracks = [];
    bgm.setEnabled(false);
  } finally {
    try {
      if (bgm.enabled && bgm.tracks.length) bgm.start();
      else bgm._emitTrack();
    } catch (err) {
      console.warn('[bgm] start failed', err);
    }
  }
})();

buildRefSheet();

// —— Settings / difficulty ——
const settingsPanel = document.getElementById('settings-panel');
const btnSettings = document.getElementById('btn-settings');

function setSettingsOpen(open) {
  settingsPanel.classList.toggle('hidden', !open);
  btnSettings.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function toggleSettings() {
  setSettingsOpen(settingsPanel.classList.contains('hidden'));
}

btnSettings.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleSettings();
});

document.addEventListener('click', (e) => {
  if (!settingsPanel.classList.contains('hidden')) {
    if (!e.target.closest('.settings-wrap')) setSettingsOpen(false);
  }
});

function applyDifficulty(diff, syncButtons = true) {
  game.setDifficulty(diff);
  if (syncButtons) {
    document.querySelectorAll('.diff-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.diff === String(diff));
    });
  }
}

document.querySelectorAll('.diff-btn').forEach((btn) => {
  btn.addEventListener('click', () => applyDifficulty(btn.dataset.diff));
});

document.querySelectorAll('.mode-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    game.setMode(btn.dataset.mode);
  });
});

// —— Keyboard visibility (desktop 3D only; mobile uses 2D keypad) ——
function setKeyboardVisible(show) {
  if (isMobileViewport()) {
    applyMobileScene(true);
    return;
  }
  keyboard.setVisible(show);
  screen.setKeyboardVisible(show);
  applyViewportCamera(true);
  const target = show ? camHome : camFocus;
  camTarget.pos.copy(target.pos);
  camTarget.look.copy(target.look);
  camTarget.fov = target.fov;
  const label = document.getElementById('keyboard-label');
  if (label) label.textContent = show ? '隱藏鍵盤' : '顯示鍵盤';
}

function toggleKeyboard() {
  if (isMobileViewport()) return;
  setKeyboardVisible(!keyboard.visible);
}

document.getElementById('btn-keyboard').addEventListener('click', toggleKeyboard);

// —— 字根表 inside options panel ——
const refGrid = document.getElementById('ref-grid');
const refToggle = document.getElementById('ref-toggle');
function setRefOpen(open) {
  refGrid.classList.toggle('collapsed-grid', !open);
  refToggle.textContent = open ? '收合' : '展開';
  refToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
}
refToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  setRefOpen(refGrid.classList.contains('collapsed-grid'));
});
function doHint() {
  game.showReveal(true);
}
function doNext() {
  if (game.isRevealVisible()) game.skipRevealToNext();
  else game.nextCharacter();
}
function doToggleSound() {
  game.toggleSound();
  game._tickHud();
}

document.getElementById('btn-hint').addEventListener('click', doHint);
document.getElementById('btn-next').addEventListener('click', doNext);
document.getElementById('btn-sound').addEventListener('click', doToggleSound);

// Mobile 選項 panel: consolidated quick actions (closes for gameplay / menu)
document.getElementById('settings-quick')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-quick]');
  if (!btn) return;
  e.stopPropagation();
  const action = btn.dataset.quick;
  const shouldClose = btn.dataset.close === '1';

  if (action === 'hint') doHint();
  else if (action === 'next') doNext();
  else if (action === 'restart') restartSession();
  else if (action === 'sound') doToggleSound();
  else if (action === 'ime') {
    // Handled by MobileUi click on #btn-ime-toggle — avoid double-toggle
  } else if (action === 'menu') showMenu();

  if (shouldClose) setSettingsOpen(false);
});
document.getElementById('reveal-close').addEventListener('click', () => game.hideReveal());
document.getElementById('reveal-modal').addEventListener('click', (e) => {
  if (e.target.id === 'reveal-modal') game.hideReveal();
});

const delaySelect = document.getElementById('reveal-delay-select');
if (delaySelect) {
  game.setRevealDelay(delaySelect.value);
  delaySelect.addEventListener('change', () => {
    game.setRevealDelay(delaySelect.value);
  });
}

const fastToggle = document.getElementById('fast-practice-toggle');
if (fastToggle) {
  game.setFastPractice(fastToggle.checked);
  fastToggle.addEventListener('change', () => {
    game.setFastPractice(fastToggle.checked);
  });
}

// —— Theme swatches ——
function buildThemeSwatches() {
  const host = document.getElementById('theme-swatches');
  if (!host) return;
  host.innerHTML = '';
  themeManager.list().forEach((theme) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-swatch';
    btn.dataset.theme = theme.id;
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-label', `${theme.nameZh} ${theme.name}`);
    btn.title = `${theme.nameZh} · ${theme.name}`;
    btn.innerHTML = `
      <span class="theme-swatch-colors" aria-hidden="true">
        <i style="background:${theme.swatch[0]}"></i>
        <i style="background:${theme.swatch[1]}"></i>
        <i style="background:${theme.swatch[2]}"></i>
      </span>
      <span class="theme-swatch-label">${theme.nameZh}</span>
    `;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      themeManager.setTheme(theme.id);
      syncThemeSwatches();
    });
    host.appendChild(btn);
  });
  syncThemeSwatches();
}

function syncThemeSwatches() {
  const id = themeManager.currentId;
  document.querySelectorAll('.theme-swatch').forEach((btn) => {
    const on = btn.dataset.theme === id;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });
}

buildThemeSwatches();

// —— Audio settings (BGM / SFX) ——
const bgmToggle = document.getElementById('bgm-toggle');
const bgmVolume = document.getElementById('bgm-volume');
const bgmVolumeLabel = document.getElementById('bgm-volume-label');
const sfxVolume = document.getElementById('sfx-volume');
const sfxVolumeLabel = document.getElementById('sfx-volume-label');

if (bgmToggle) {
  bgmToggle.checked = bgm.enabled;
  bgmToggle.addEventListener('change', () => {
    unlockAudio();
    bgm.setEnabled(bgmToggle.checked);
  });
}

if (bgmVolume && bgmVolumeLabel) {
  const pct = Math.round(bgm.volume * 100);
  bgmVolume.value = String(pct);
  bgmVolumeLabel.textContent = `${pct}%`;
  bgmVolume.addEventListener('input', () => {
    const v = Number(bgmVolume.value) / 100;
    bgmVolumeLabel.textContent = `${bgmVolume.value}%`;
    bgm.setVolume(v);
    unlockAudio();
  });
}

if (sfxVolume && sfxVolumeLabel) {
  const pct = Math.round(game.audio.volume * 100);
  sfxVolume.value = String(pct);
  sfxVolumeLabel.textContent = `${pct}%`;
  sfxVolume.addEventListener('input', () => {
    const v = Number(sfxVolume.value) / 100;
    sfxVolumeLabel.textContent = `${sfxVolume.value}%`;
    game.audio.setVolume(v);
    unlockAudio();
  });
}

function showMenu() {
  game.running = false;
  game.stopTimer();
  game.hideReveal();
  game.hideCandidates();
  document.getElementById('race-track').classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
  setSettingsOpen(false);
  mobileUi.syncPlayVisibility();
  resize();
}

function restartSession() {
  if (!document.getElementById('start-screen').classList.contains('hidden')) return;
  game.audio.ensureCtx();
  game.restartSession();
  setSettingsOpen(false);
}

document.getElementById('btn-restart').addEventListener('click', restartSession);
document.getElementById('btn-menu').addEventListener('click', showMenu);

// —— Race setup ——
let raceLoaded = false;

function showAnalytics(metrics, seqLen) {
  const box = document.getElementById('text-analytics');
  box.classList.remove('hidden');
  document.getElementById('an-total').textContent = String(metrics.totalChars);
  document.getElementById('an-unique').textContent = String(metrics.uniqueCount);
  document.getElementById('an-avg').textContent = String(metrics.avgKeyLen);
  document.getElementById('an-diff').textContent = metrics.difficulty;
  const note = document.getElementById('race-ready-note');
  note.textContent = seqLen
    ? `可競速 ${seqLen} 字（字典可編碼）· ${metrics.title || ''}`
    : '文章中沒有可編碼的漢字';
  raceLoaded = seqLen > 0;
  document.getElementById('btn-start-race').disabled = !raceLoaded || !dictReady;
}

async function loadSample(sample) {
  document.querySelectorAll('.sample-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.id === sample.id);
  });
  const res = await fetch(sample.path);
  const text = await res.text();
  const { sequenceLength, metrics } = game.loadRaceText(text, sample.title);
  showAnalytics(metrics, sequenceLength);
}

function buildSampleList() {
  const list = document.getElementById('sample-list');
  list.innerHTML = '';
  SAMPLE_TEXTS.forEach((sample) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sample-btn';
    btn.dataset.id = sample.id;
    btn.textContent = sample.title;
    btn.addEventListener('click', () => loadSample(sample));
    list.appendChild(btn);
  });
}

document.getElementById('txt-upload').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  document.querySelectorAll('.sample-btn').forEach((b) => b.classList.remove('active'));
  const text = await file.text();
  const { sequenceLength, metrics } = game.loadRaceText(text, file.name);
  showAnalytics(metrics, sequenceLength);
});

document.getElementById('race-time-limit').addEventListener('change', (e) => {
  game.setRaceLimit(Number(e.target.value));
});

function beginDrill() {
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('race-track').classList.add('hidden');
  setSettingsOpen(false);
  unlockAudio();
  game.setRaceLimit(0);
  game.start('drill');
  mobileUi.syncPlayVisibility();
  resize();
  mobileUi.focusNativeIfNeeded();
}

function beginRace() {
  if (!raceLoaded) return;
  document.getElementById('start-screen').classList.add('hidden');
  setSettingsOpen(false);
  unlockAudio();
  game.setRaceLimit(Number(document.getElementById('race-time-limit').value));
  game.start('race');
  mobileUi.syncPlayVisibility();
  resize();
  mobileUi.focusNativeIfNeeded();
}

document.getElementById('btn-start-drill').addEventListener('click', beginDrill);
document.getElementById('btn-start-race').addEventListener('click', beginRace);

// —— Hotkeys ——
// Letter keys always type. UI shortcuts: Esc, Tab, Ctrl+H/N/S/R
// Reveal modal: Space/F freeze, N/Enter next
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;

  const revealOpen = game.isRevealVisible();

  if (e.key === 'Escape') {
    e.preventDefault();
    if (revealOpen) {
      game.hideReveal();
      return;
    }
    if (document.getElementById('start-screen').classList.contains('hidden')) {
      toggleSettings();
    }
    return;
  }

  if (e.key === 'Tab') {
    e.preventDefault();
    toggleKeyboard();
    return;
  }

  // Reveal-window controls (before letter typing)
  if (revealOpen) {
    if (e.key === ' ' || e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      game.toggleFreeze();
      return;
    }
    if (e.key === 'n' || e.key === 'N' || e.key === 'Enter') {
      e.preventDefault();
      game.skipRevealToNext();
      return;
    }
  }

  // Space: 倉頡 = submit buffer · 速成 = confirm candidate #1
  if (game.running && !revealOpen && e.key === ' ') {
    e.preventDefault();
    game.handleSpaceSubmit();
    return;
  }

  // 速成: 1–9 immediately submits that candidate
  if (game.running && !revealOpen && /^[1-9]$/.test(e.key)) {
    e.preventDefault();
    if (game.quickPicking) game.commitPageCandidate(Number(e.key) - 1);
    return;
  }

  // 速成: page navigation (PageDown / ↓ / -  next · PageUp / ↑ / =  prev)
  if (game.running && !revealOpen && game.quickPicking) {
    if (
      e.key === 'PageDown' ||
      e.key === 'ArrowDown' ||
      e.key === '-' ||
      e.key === '_'
    ) {
      e.preventDefault();
      game.nextCandidatePage();
      return;
    }
    if (
      e.key === 'PageUp' ||
      e.key === 'ArrowUp' ||
      e.key === '=' ||
      e.key === '+'
    ) {
      e.preventDefault();
      game.prevCandidatePage();
      return;
    }
  }

  const withCtrl = e.ctrlKey || e.metaKey;
  if (withCtrl && game.running) {
    const k = e.key.toLowerCase();
    if (k === 'h') {
      e.preventDefault();
      game.showReveal(true);
      return;
    }
    if (k === 'n') {
      e.preventDefault();
      if (revealOpen) game.skipRevealToNext();
      else game.nextCharacter();
      return;
    }
    if (k === 's') {
      e.preventDefault();
      game.toggleSound();
      game._tickHud();
      return;
    }
    if (k === 'r') {
      e.preventDefault();
      // 字根表 lives in 選項 panel
      setSettingsOpen(true);
      setRefOpen(true);
      return;
    }
  }

  if (!game.running) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (revealOpen) return;

  if (e.key === 'Backspace') {
    e.preventDefault();
    game.backspace();
    return;
  }

  if (/^[a-zA-Z]$/.test(e.key)) {
    e.preventDefault();
    game.handleLetter(e.key);
  }
});

function onPointer(clientX, clientY) {
  if (!keyboard.visible) return false;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(keyboard.getIntersectable(), false);
  if (hits.length) {
    const letter = hits[0].object.userData.letter;
    if (letter && game.running) {
      game.handleLetter(letter);
      return true;
    }
  }
  return false;
}

// Pointer Events cover mouse + touch; prevent scroll/zoom jumps on key taps
canvas.style.touchAction = 'none';
canvas.addEventListener(
  'pointerdown',
  (e) => {
    const hit = onPointer(e.clientX, e.clientY);
    if (hit) {
      e.preventDefault();
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  },
  { passive: false }
);
canvas.addEventListener(
  'touchstart',
  (e) => {
    if (!e.touches?.length) return;
    const t = e.touches[0];
    if (onPointer(t.clientX, t.clientY)) e.preventDefault();
  },
  { passive: false }
);

// —— Animate ——
let t0 = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  try {
    const t = now - t0;

    keyboard.update(now);
    screen.update(t);

    // Pulsing accent lights (renamed from cyanPoint / magentaPoint for themes)
    if (accentA) accentA.intensity = 2.0 + Math.sin(t * 0.002) * 0.35;
    if (accentB) accentB.intensity = 1.2 + Math.cos(t * 0.0017) * 0.3;

    const drift = Math.sin(t * 0.00015) * 0.25;
    camera.position.x += (camTarget.pos.x + drift - camera.position.x) * 0.06;
    camera.position.y += (camTarget.pos.y - camera.position.y) * 0.06;
    camera.position.z += (camTarget.pos.z - camera.position.z) * 0.06;
    lookCurrent.lerp(camTarget.look, 0.06);
    camera.lookAt(lookCurrent);
    camera.fov += (camTarget.fov - camera.fov) * 0.06;
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);
  } catch (err) {
    console.error('[animate] frame error', err);
  }
}
animate(performance.now());

screen.setContent({
  char: '倉',
  buffer: '_',
  modeLabel: '速成',
  status: 'idle',
});

// —— Boot dictionary ——
let dictReady = false;
const dictStatus = document.getElementById('dict-status');
buildSampleList();
game.setRaceLimit(120);

function setDictStatusReady() {
  const n = codeMap.size.toLocaleString();
  const note = dictSource === 'fallback' ? ' · 精簡模式' : '';
  if (dictStatus) {
    dictStatus.textContent = `已載入字典 (${n} 字)${note}。選擇模式開始練習。`;
  }
}

function enableStartButtons() {
  dictReady = true;
  const drill = document.getElementById('btn-start-drill');
  const race = document.getElementById('btn-start-race');
  if (drill) drill.disabled = false;
  if (race) race.disabled = !raceLoaded;
}

function resolveLoadingScreen() {
  setDictStatusReady();
  enableStartButtons();
}

window.addEventListener('dict-upgraded', () => {
  setDictStatusReady();
  try {
    game.initPool();
  } catch (err) {
    console.warn('[boot] pool refresh after upgrade failed', err);
  }
});

(async () => {
  try {
    if (dictStatus) dictStatus.textContent = '正在載入字典…';
    await loadDictionary();
    try {
      await game.initPool();
    } catch (poolErr) {
      console.error('[boot] initPool failed', poolErr);
    }
  } catch (err) {
    console.error('[boot] dictionary init error', err);
    if (dictStatus) {
      dictStatus.textContent = '字典載入異常，已切換至內建字表。';
    }
  } finally {
    // Always unlock UI — never leave the user on "正在載入字典…"
    resolveLoadingScreen();
    try {
      await loadSample(SAMPLE_TEXTS[0]);
    } catch (sampleErr) {
      console.warn('[boot] sample preload skipped', sampleErr);
    }
  }
})();
