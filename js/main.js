import * as THREE from 'three';
import { VirtualKeyboard, FloatingScreen } from './keyboard3d.js';
import { TypingGame, buildRefSheet } from './game.js';
import { loadDictionary, SAMPLE_TEXTS, codeMap } from './dictLoader.js';

const canvas = document.getElementById('game-canvas');

// —— Scene ——
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05080f);
scene.fog = new THREE.FogExp2(0x05080f, 0.035);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
const camHome = { pos: new THREE.Vector3(0, 6.8, 9.5), look: new THREE.Vector3(0, 1.2, 0), fov: 42 };
const camFocus = { pos: new THREE.Vector3(0, 4.2, 7.2), look: new THREE.Vector3(0, 2.2, 0), fov: 38 };
const camTarget = {
  pos: camHome.pos.clone(),
  look: camHome.look.clone(),
  fov: camHome.fov,
};
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

const cyanPoint = new THREE.PointLight(0x00e5ff, 2.2, 28);
cyanPoint.position.set(-4, 4, 3);
scene.add(cyanPoint);

const magentaPoint = new THREE.PointLight(0xff2d6a, 1.4, 22);
magentaPoint.position.set(5, 3, 2);
scene.add(magentaPoint);

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

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', resize);
resize();

// —— HUD ——
function updateHud(data) {
  document.getElementById('stat-wpm').textContent = String(data.wpm);
  document.getElementById('stat-accuracy').textContent = `${data.accuracy}%`;
  document.getElementById('stat-streak').textContent = String(data.streak);
  document.getElementById('stat-timer').textContent = data.timer;
  const soundLabel = document.getElementById('sound-label');
  if (soundLabel) soundLabel.textContent = data.sound ? '音效 ON' : '音效 OFF';
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

// —— Keyboard visibility ——
function setKeyboardVisible(show) {
  keyboard.setVisible(show);
  screen.setKeyboardVisible(show);
  const target = show ? camHome : camFocus;
  camTarget.pos.copy(target.pos);
  camTarget.look.copy(target.look);
  camTarget.fov = target.fov;
  const label = document.getElementById('keyboard-label');
  if (label) label.textContent = show ? '隱藏鍵盤' : '顯示鍵盤';
}

function toggleKeyboard() {
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
document.getElementById('btn-hint').addEventListener('click', () => game.showReveal(true));
document.getElementById('btn-next').addEventListener('click', () => {
  if (game.isRevealVisible()) game.skipRevealToNext();
  else game.nextCharacter();
});
document.getElementById('btn-sound').addEventListener('click', () => {
  game.toggleSound();
  game._tickHud();
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

function showMenu() {
  game.running = false;
  game.stopTimer();
  game.hideReveal();
  game.hideCandidates();
  document.getElementById('race-track').classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
  setSettingsOpen(false);
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
  game.audio.ensureCtx();
  game.setRaceLimit(0);
  game.start('drill');
}

function beginRace() {
  if (!raceLoaded) return;
  document.getElementById('start-screen').classList.add('hidden');
  setSettingsOpen(false);
  game.audio.ensureCtx();
  game.setRaceLimit(Number(document.getElementById('race-time-limit').value));
  game.start('race');
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
  if (!keyboard.visible) return;
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(keyboard.getIntersectable(), false);
  if (hits.length) {
    const letter = hits[0].object.userData.letter;
    if (letter && game.running) game.handleLetter(letter);
  }
}

canvas.addEventListener('pointerdown', (e) => onPointer(e.clientX, e.clientY));

// —— Animate ——
const lookCurrent = camHome.look.clone();
let t0 = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const t = now - t0;

  keyboard.update(now);
  screen.update(t);

  cyanPoint.intensity = 2.0 + Math.sin(t * 0.002) * 0.35;
  magentaPoint.intensity = 1.2 + Math.cos(t * 0.0017) * 0.3;

  const drift = Math.sin(t * 0.00015) * 0.25;
  camera.position.x += (camTarget.pos.x + drift - camera.position.x) * 0.06;
  camera.position.y += (camTarget.pos.y - camera.position.y) * 0.06;
  camera.position.z += (camTarget.pos.z - camera.position.z) * 0.06;
  lookCurrent.lerp(camTarget.look, 0.06);
  camera.lookAt(lookCurrent);
  camera.fov += (camTarget.fov - camera.fov) * 0.06;
  camera.updateProjectionMatrix();

  renderer.render(scene, camera);
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

(async () => {
  try {
    await loadDictionary();
    await game.initPool();
    dictReady = true;
    dictStatus.textContent = `字典已就緒（${codeMap.size.toLocaleString()} 字）。選擇模式開始練習。`;
    document.getElementById('btn-start-drill').disabled = false;
    document.getElementById('btn-start-race').disabled = !raceLoaded;
    // preload first sample for convenience
    await loadSample(SAMPLE_TEXTS[0]);
  } catch (err) {
    dictStatus.textContent = '字典載入失敗，請重新整理頁面後再試。';
    console.error(err);
  }
})();
