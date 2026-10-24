/**
 * Mobile-first adaptive UI: 2D radical keypad + native IME toggle.
 */
import { CANGJIE_RADICALS } from './cangjieData.js';

const ROW_LAYOUT = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

const STORAGE_IME = 'vincy-mobile-ime';

/** Mobile viewport: ≤768px, portrait phone/tablet, or coarse-pointer ≤900px. */
export function isMobileViewport() {
  if (typeof window === 'undefined') return false;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w <= 768) return true;
  const portrait = h > w;
  if (portrait && w <= 1024) return true;
  const touch =
    (navigator.maxTouchPoints || 0) > 0 ||
    window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  return touch && w <= 900;
}

export class MobileUi {
  /**
   * @param {{
   *   game: import('./game.js').TypingGame,
   *   onMobileChange?: (mobile: boolean) => void,
   *   onImeModeChange?: (native: boolean) => void,
   * }} opts
   */
  constructor({ game, onMobileChange, onImeModeChange }) {
    this.game = game;
    this.onMobileChange = onMobileChange;
    this.onImeModeChange = onImeModeChange;
    this.mobile = false;
    this.nativeIme = false;
    this._composing = false;

    this.root = document.getElementById('mobile-ui');
    this.keypad = document.getElementById('mobile-keypad');
    this.imeToggle = document.getElementById('btn-ime-toggle');
    this.nativeInput = document.getElementById('native-ime-input');
    this.candidateStrip = document.getElementById('mobile-candidate-strip');

    this._buildKeypad();
    this._bind();
    this._loadImePref();
    this.refresh();
  }

  _loadImePref() {
    try {
      this.nativeIme = localStorage.getItem(STORAGE_IME) === 'native';
    } catch {
      this.nativeIme = false;
    }
  }

  _saveImePref() {
    try {
      localStorage.setItem(STORAGE_IME, this.nativeIme ? 'native' : 'virtual');
    } catch {
      /* ignore */
    }
  }

  _buildKeypad() {
    if (!this.keypad) return;
    this.keypad.innerHTML = '';

    ROW_LAYOUT.forEach((row, rowIndex) => {
      const rowEl = document.createElement('div');
      rowEl.className = `mobile-key-row row-${rowIndex + 1}`;
      row.forEach((letter) => {
        rowEl.appendChild(this._makeKey(letter));
      });
      this.keypad.appendChild(rowEl);
    });

    const row4 = document.createElement('div');
    row4.className = 'mobile-key-row row-4';
    row4.appendChild(this._makeActionKey('backspace', '⌫', '退格'));
    const space = this._makeActionKey('space', '空白', 'Space');
    space.classList.add('mobile-key-space');
    row4.appendChild(space);
    row4.appendChild(this._makeActionKey('next-page', '下頁', '候選下頁'));
    this.keypad.appendChild(row4);
  }

  _makeKey(letter) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mobile-key';
    btn.dataset.letter = letter;
    const radical = CANGJIE_RADICALS[letter] || '';
    btn.innerHTML = `<span class="mobile-key-radical">${radical}</span><span class="mobile-key-letter">${letter}</span>`;
    btn.setAttribute('aria-label', `${radical} ${letter}`);
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._tapLetter(letter, btn);
    });
    return btn;
  }

  _makeActionKey(action, label, aria) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mobile-key mobile-key-action';
    btn.dataset.action = action;
    btn.textContent = label;
    btn.setAttribute('aria-label', aria);
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._tapAction(action, btn);
    });
    return btn;
  }

  _flashKey(btn) {
    if (!btn) return;
    btn.classList.add('is-pressed');
    setTimeout(() => btn.classList.remove('is-pressed'), 120);
  }

  _tapLetter(letter, btn) {
    this._flashKey(btn);
    if (!this.game.running) return;
    this.game.handleLetter(letter);
  }

  _tapAction(action, btn) {
    this._flashKey(btn);
    if (!this.game.running && action !== 'space') return;
    if (action === 'space') {
      this.game.handleSpaceSubmit();
      return;
    }
    if (action === 'backspace') {
      this.game.backspace();
      return;
    }
    if (action === 'next-page' && this.game.quickPicking) {
      this.game.nextCandidatePage();
    }
  }

  _bind() {
    if (this.imeToggle) {
      this.imeToggle.addEventListener('click', (e) => {
        e.preventDefault();
        this.setNativeIme(!this.nativeIme);
      });
    }

    const hint = document.getElementById('native-ime-hint');
    if (hint && this.nativeInput) {
      hint.addEventListener('click', () => this.focusNativeIfNeeded());
    }

    if (this.nativeInput) {
      this.nativeInput.addEventListener('compositionstart', () => {
        this._composing = true;
      });
      this.nativeInput.addEventListener('compositionend', (e) => {
        this._composing = false;
        this._consumeNativeText(e.data || this.nativeInput.value);
        this.nativeInput.value = '';
      });
      this.nativeInput.addEventListener('input', () => {
        if (this._composing) return;
        this._consumeNativeText(this.nativeInput.value);
        this.nativeInput.value = '';
      });
      this.nativeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
          e.preventDefault();
          this.game.backspace();
          return;
        }
        if (e.key === ' ') {
          e.preventDefault();
          this.game.handleSpaceSubmit();
          return;
        }
        if (/^[1-9]$/.test(e.key) && this.game.quickPicking) {
          e.preventDefault();
          this.game.commitPageCandidate(Number(e.key) - 1);
        }
      });
    }

    // Resize / orientation handled by main.js → refresh() so camera + CSS stay in sync
  }

  _consumeNativeText(text) {
    if (!text || !this.game.running) return;
    for (const ch of text) {
      if (/[a-zA-Z]/.test(ch)) {
        this.game.handleLetter(ch);
      } else if (/[\u4e00-\u9fff]/.test(ch)) {
        this.game.handleNativeChar(ch);
      }
    }
  }

  setNativeIme(native) {
    this.nativeIme = !!native;
    this._saveImePref();
    this._applyImeMode();
    this.onImeModeChange?.(this.nativeIme);
  }

  _applyImeMode() {
    const body = document.body;
    body.classList.toggle('mobile-native-ime', this.mobile && this.nativeIme);
    body.classList.toggle('mobile-virtual-kb', this.mobile && !this.nativeIme);

    if (this.imeToggle) {
      this.imeToggle.setAttribute('aria-pressed', this.nativeIme ? 'true' : 'false');
      this.imeToggle.textContent = this.nativeIme
        ? '切換 原生/虛擬鍵盤 · 原生'
        : '切換 原生/虛擬鍵盤 · 虛擬';
    }

    const playing = document.body.classList.contains('mobile-playing');
    if (!this.mobile || !playing) {
      this.nativeInput?.blur();
      return;
    }

    if (this.nativeIme && this.nativeInput) {
      // Keep IME ready; focus on user gesture when starting play
      requestAnimationFrame(() => {
        try {
          this.nativeInput.focus({ preventScroll: true });
        } catch {
          this.nativeInput.focus();
        }
      });
    } else {
      this.nativeInput?.blur();
    }
  }

  /** Call when practice starts so native IME can open from a gesture. */
  focusNativeIfNeeded() {
    if (this.mobile && this.nativeIme && this.nativeInput) {
      try {
        this.nativeInput.focus({ preventScroll: true });
      } catch {
        this.nativeInput.focus();
      }
    }
  }

  refresh() {
    const next = isMobileViewport();
    const changed = next !== this.mobile;
    this.mobile = next;

    const startEl = document.getElementById('start-screen');
    const inMenu = startEl && !startEl.classList.contains('hidden');
    const showUi = this.mobile && !inMenu;

    document.body.classList.toggle('is-mobile', this.mobile);
    document.body.classList.toggle('mobile-playing', showUi);
    if (this.root) {
      this.root.classList.toggle('hidden', !showUi);
      this.root.setAttribute('aria-hidden', showUi ? 'false' : 'true');
    }

    this._applyImeMode();

    if (changed) this.onMobileChange?.(this.mobile);
  }

  /** Call when entering/leaving the start menu so the keypad docks only while playing. */
  syncPlayVisibility() {
    this.refresh();
  }

  /**
   * Mirror desktop candidate panel into the mobile strip (1-tap cards).
   * @param {{ items: Array<{char:string}>, selectedIndex: number, code: string, pageLabel: string } | null} state
   */
  renderCandidates(state) {
    if (!this.candidateStrip) return;
    if (!this.mobile || !state || !state.items?.length) {
      this.candidateStrip.classList.add('hidden');
      this.candidateStrip.innerHTML = '';
      return;
    }

    this.candidateStrip.classList.remove('hidden');
    this.candidateStrip.innerHTML = '';

    const meta = document.createElement('div');
    meta.className = 'mobile-candidate-meta';
    meta.innerHTML = `<code>${state.code || '—'}</code><span>${state.pageLabel || ''}</span>`;
    this.candidateStrip.appendChild(meta);

    const track = document.createElement('div');
    track.className = 'mobile-candidate-track';
    state.items.forEach((entry, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mobile-candidate-card';
      if (i === state.selectedIndex) btn.classList.add('is-selected');
      if (this.game.target && entry.char === this.game.target.char) btn.classList.add('is-target');
      btn.innerHTML = `<span class="mobile-candidate-num">${i + 1}</span><span class="mobile-candidate-char">${entry.char}</span>`;
      btn.addEventListener('click', () => this.game.commitPageCandidate(i));
      track.appendChild(btn);
    });
    this.candidateStrip.appendChild(track);
  }

  hideCandidates() {
    if (!this.candidateStrip) return;
    this.candidateStrip.classList.add('hidden');
    this.candidateStrip.innerHTML = '';
  }
}
