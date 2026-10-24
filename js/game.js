import { CANGJIE_RADICALS, formatDecomposition, getRequiredCode } from './cangjieData.js';
import {
  charEntry,
  extractTypeableSequence,
  analyzeText,
  loadPracticeChars,
  frequencyFromCode,
  lookupQuickCandidates,
  QUICK_PAGE_SIZE,
} from './dictLoader.js';
import { playDecomposeAnimation } from './decompose.js';
import { GameAudio } from './audio.js';

const VALID_KEYS = new Set(Object.keys(CANGJIE_RADICALS));

export class TypingGame {
  constructor({ keyboard, screen, onHudUpdate, onRaceUpdate, mobileUi = null }) {
    this.keyboard = keyboard;
    this.screen = screen;
    this.onHudUpdate = onHudUpdate;
    this.onRaceUpdate = onRaceUpdate;
    this.mobileUi = mobileUi;
    this.audio = new GameAudio();

    this.mode = 'quick'; // quick | cangjie
    this.playMode = 'drill'; // drill | race
    this.maxFreq = 1;
    this.running = false;
    this.startedAt = 0;
    this.buffer = '';
    this.target = null;
    this.recentChars = [];
    this.practicePool = [];

    /** Race state */
    this.raceText = '';
    this.raceSeq = [];
    this.raceIndex = 0;
    this.raceMetrics = null;
    this.raceLimitSec = 0; // 0 = no hard limit
    this.raceEnded = false;

    this.stats = {
      correctKeys: 0,
      totalKeys: 0,
      completed: 0,
      streak: 0,
      bestStreak: 0,
      charTimes: [],
    };

    this._timerId = null;
    this._advanceTimer = null;
    this._decompAbort = null;

    /** Reveal auto-advance: base delay from settings; +200ms bump on non-manual */
    this.revealDelayMs = 1500;
    /** Skip breakdown popup after success (Fast Practice Mode) */
    this.fastPractice = false;
    this.revealOpen = false;
    this.revealFrozen = false;
    this._revealAuto = false;
    this._revealTotalMs = 0;
    this._revealRemainingMs = 0;
    this._revealStartedAt = 0;
    this._revealRaf = null;

    /** 速成 candidate picking (Windows IME: 1–9 page, Space = #1) */
    this.quickPicking = false;
    this.selectedCandidateIndex = 0; // index within current page (0–8)
    this.candidatePage = 0;
    this._candidateList = []; // full frequency-sorted list
  }

  _cancelDecompose() {
    if (this._decompAbort) {
      this._decompAbort.abort();
      this._decompAbort = null;
    }
  }

  setRevealDelay(ms) {
    const n = Number(ms);
    this.revealDelayMs = Number.isFinite(n) ? Math.max(0, n) : 1500;
  }

  setFastPractice(enabled) {
    this.fastPractice = !!enabled;
  }

  /** Reset stats and continue with a fresh character (same play mode). */
  restartSession() {
    if (!this.running && this.playMode !== 'race') {
      // Allow restart from idle mid-session UI by re-entering current mode
    }
    const mode = this.playMode || 'drill';
    this.hideReveal();
    this.hideCandidates();
    this.start(mode);
  }

  /** Effective dwell including +0.2s default bump for timed modes */
  getEffectiveRevealDelay() {
    if (!this.revealDelayMs) return 0;
    return this.revealDelayMs + 200;
  }

  isRevealVisible() {
    return this.revealOpen;
  }

  _clearRevealCountdown() {
    if (this._revealRaf) {
      cancelAnimationFrame(this._revealRaf);
      this._revealRaf = null;
    }
    if (this._advanceTimer) {
      clearTimeout(this._advanceTimer);
      this._advanceTimer = null;
    }
  }

  _updateCountdownBar() {
    const fill = document.getElementById('reveal-countdown-fill');
    const bar = document.getElementById('reveal-countdown');
    if (!fill || !bar) return;

    if (!this._revealAuto || !this._revealTotalMs) {
      bar.classList.add('is-manual');
      fill.style.transform = 'scaleX(0)';
      return;
    }

    bar.classList.remove('is-manual');
    const ratio = Math.max(0, Math.min(1, this._revealRemainingMs / this._revealTotalMs));
    fill.style.transform = `scaleX(${ratio})`;
    bar.classList.toggle('is-paused', this.revealFrozen);
  }

  _setFreezeUi(frozen) {
    const tag = document.getElementById('freeze-tag');
    const card = document.querySelector('.reveal-card');
    if (tag) tag.classList.toggle('hidden', !frozen);
    if (card) card.classList.toggle('is-frozen', frozen);
    const bar = document.getElementById('reveal-countdown');
    if (bar) bar.classList.toggle('is-paused', frozen);
  }

  _tickRevealCountdown = () => {
    if (!this.revealOpen || !this._revealAuto || this.revealFrozen) {
      this._revealRaf = null;
      return;
    }

    const elapsed = performance.now() - this._revealStartedAt;
    this._revealRemainingMs = Math.max(0, this._revealTotalMs - elapsed);
    this._updateCountdownBar();

    if (this._revealRemainingMs <= 0) {
      this._revealRaf = null;
      if (this.running) this.nextCharacter();
      return;
    }

    this._revealRaf = requestAnimationFrame(this._tickRevealCountdown);
  };

  startRevealCountdown(totalMs) {
    this._clearRevealCountdown();
    this._revealAuto = totalMs > 0;
    this._revealTotalMs = totalMs;
    this._revealRemainingMs = totalMs;
    this.revealFrozen = false;
    this._setFreezeUi(false);
    this._updateCountdownBar();

    if (!this._revealAuto) return;

    this._revealStartedAt = performance.now();
    this._revealRaf = requestAnimationFrame(this._tickRevealCountdown);
  }

  toggleFreeze() {
    if (!this.revealOpen) return false;

    if (!this.revealFrozen) {
      // Freeze: capture remaining time
      if (this._revealAuto && !this.revealFrozen) {
        const elapsed = performance.now() - this._revealStartedAt;
        this._revealRemainingMs = Math.max(0, this._revealTotalMs - elapsed);
      }
      this.revealFrozen = true;
      if (this._revealRaf) {
        cancelAnimationFrame(this._revealRaf);
        this._revealRaf = null;
      }
      this._setFreezeUi(true);
      this._updateCountdownBar();
      return true;
    }

    // Unfreeze: resume with remaining time (or stay manual)
    this.revealFrozen = false;
    this._setFreezeUi(false);
    if (this._revealAuto && this._revealRemainingMs > 0) {
      this._revealTotalMs = this._revealRemainingMs;
      this._revealStartedAt = performance.now();
      this._revealRaf = requestAnimationFrame(this._tickRevealCountdown);
    } else if (this._revealAuto && this._revealRemainingMs <= 0) {
      if (this.running) this.nextCharacter();
    }
    this._updateCountdownBar();
    return false;
  }

  skipRevealToNext() {
    if (!this.revealOpen) return;
    this.nextCharacter();
  }

  async initPool() {
    const chars = await loadPracticeChars();
    this.practicePool = chars
      .map((c) => charEntry(c))
      .filter(Boolean);
  }

  start(playMode = 'drill') {
    this.stopTimer();
    this._clearRevealCountdown();
    this.hideReveal();

    this.playMode = playMode === 'race' ? 'race' : 'drill';
    this.running = true;
    this.raceEnded = false;
    this.startedAt = performance.now();
    this.stats = {
      correctKeys: 0,
      totalKeys: 0,
      completed: 0,
      streak: 0,
      bestStreak: 0,
      charTimes: [],
    };
    this._charStartedAt = performance.now();

    if (this.playMode === 'race') {
      if (!this.raceSeq.length) {
        this.running = false;
        return false;
      }
      this.raceIndex = 0;
      this.target = this.raceSeq[0];
      this.buffer = '';
      this.keyboard.clearHints();
      this._syncScreen('idle');
      this._emitRace();
    } else {
      this.nextCharacter();
    }

    this._tickHud();
    this._timerId = setInterval(() => {
      this._tickHud();
      if (this.playMode === 'race') this._checkRaceTime();
    }, 200);
    return true;
  }

  stopTimer() {
    if (this._timerId) {
      clearInterval(this._timerId);
      this._timerId = null;
    }
  }

  setMode(mode) {
    this.mode = mode === 'cangjie' ? 'cangjie' : 'quick';
    this.buffer = '';
    this.keyboard.clearHints();
    this.hideCandidates();
    this._syncScreen('idle');
    this._tickHud();
  }

  setDifficulty(maxFreq) {
    this.maxFreq = Math.min(3, Math.max(1, Number(maxFreq) || 1));
    if (this.running && this.playMode === 'drill') this.nextCharacter();
  }

  setRaceLimit(sec) {
    this.raceLimitSec = Math.max(0, Number(sec) || 0);
  }

  loadRaceText(text, title = '自訂文章') {
    this.raceText = text || '';
    this.raceSeq = extractTypeableSequence(this.raceText);
    this.raceMetrics = analyzeText(this.raceText);
    this.raceMetrics.title = title;
    this.raceIndex = 0;
    this.raceEnded = false;
    return {
      sequenceLength: this.raceSeq.length,
      metrics: this.raceMetrics,
    };
  }

  getPool() {
    return this.practicePool.filter((c) => c.frequency <= this.maxFreq);
  }

  nextCharacter() {
    if (this.playMode === 'race') {
      this._advanceRace();
      return;
    }

    this._cancelDecompose();
    this.hideReveal();
    const pool = this.getPool().filter((c) => !this.recentChars.includes(c.char));
    const pickFrom = pool.length ? pool : this.getPool();
    if (!pickFrom.length) {
      this.target = charEntry('明') || { char: '明', cangjieCode: 'AB', quickCode: 'AB', roots: ['日', '月'], frequency: 1, pinyin: '', meaning: '' };
    } else {
      this.target = pickFrom[Math.floor(Math.random() * pickFrom.length)];
    }
    this.recentChars.push(this.target.char);
    if (this.recentChars.length > 8) this.recentChars.shift();

    this.buffer = '';
    this._charStartedAt = performance.now();
    this.keyboard.clearHints();
    this.hideCandidates();
    this._syncScreen('idle');
    this._tickHud();
  }

  _advanceRace() {
    this.hideReveal();
    this.hideCandidates();
    this.raceIndex += 1;
    if (this.raceIndex >= this.raceSeq.length) {
      this._finishRace(true);
      return;
    }
    this.target = this.raceSeq[this.raceIndex];
    this.buffer = '';
    this._charStartedAt = performance.now();
    this.keyboard.clearHints();
    this._syncScreen('idle');
    this._emitRace();
    this._tickHud();
  }

  _finishRace(completed) {
    this.raceEnded = true;
    this.running = false;
    this.stopTimer();
    this.audio.success();
    this._emitRace({ finished: true, completed });
    this._tickHud();
  }

  _checkRaceTime() {
    if (this.playMode !== 'race' || !this.raceLimitSec || this.raceEnded) return;
    const elapsed = (performance.now() - this.startedAt) / 1000;
    if (elapsed >= this.raceLimitSec) {
      this._finishRace(false);
    }
  }

  getRequired() {
    return getRequiredCode(this.target, this.mode);
  }

  /**
   * Native OS IME: user commits a Chinese character via system Cangjie/Quick.
   * Treat as a direct answer check against the target.
   */
  handleNativeChar(char) {
    if (!this.running || !this.target || this.raceEnded || this.revealOpen) return false;
    if (!char || !/[\u4e00-\u9fff]/.test(char)) return false;

    this.stats.totalKeys += 1;
    this.audio.keypress();

    if (char === this.target.char) {
      this.stats.correctKeys += 1;
      this.quickPicking = false;
      this.hideCandidates();
      this.buffer = '';
      this._onSuccess();
      this._tickHud();
      return true;
    }

    this.stats.streak = 0;
    this.audio.error();
    this._flashDom('bad');
    this._syncScreen('err');
    setTimeout(() => {
      if (this.revealOpen) return;
      this._syncScreen(this.buffer.length ? 'typing' : 'idle');
    }, 220);
    this._tickHud();
    return false;
  }

  handleLetter(letter) {
    if (!this.running || !this.target || this.raceEnded) return;
    if (this.revealOpen) return;
    // While picking candidates, use 1–9 to highlight · Space to submit
    if (this.quickPicking) return;

    const L = letter.toUpperCase();
    if (!VALID_KEYS.has(L)) return;

    const required = this.getRequired();
    // Don't accept more keys once sequence is complete — wait for Space
    if (this.buffer.length >= required.length) {
      this._syncScreen('await-space');
      return;
    }

    this.audio.keypress();
    this.keyboard.press(L);
    this.stats.totalKeys += 1;

    const nextExpected = required[this.buffer.length];

    if (L !== nextExpected) {
      this.stats.streak = 0;
      this.audio.error();
      this.keyboard.flashError(L);
      this.buffer += L;
      this._syncScreen('err');
      this._flashDom('bad');
      this.hideCandidates();
      setTimeout(() => {
        if (this.revealOpen || this.quickPicking) return;
        this.buffer = this.buffer.slice(0, -1);
        this._syncScreen(this.buffer.length ? 'typing' : 'idle');
        this._tickHud();
      }, 220);
      this._tickHud();
      return;
    }

    this.stats.correctKeys += 1;
    this.keyboard.flashCorrect(L);
    this.buffer += L;

    if (this.buffer === required) {
      if (this.mode === 'quick') {
        // 速成: show candidates — Space submits selected
        this.enterQuickPick();
      } else {
        // 倉頡: buffer complete — must press Space to submit
        this._syncScreen('await-space');
      }
    } else {
      this.hideCandidates();
      this._syncScreen('typing');
    }
    this._tickHud();
  }

  /**
   * Mandatory Spacebar confirmation for all modes.
   * 倉頡: evaluate buffered radical sequence.
   * 速成: submit currently highlighted candidate.
   */
  handleSpaceSubmit() {
    if (!this.running || !this.target || this.raceEnded || this.revealOpen) return false;

    if (this.mode === 'quick' && this.quickPicking) {
      return this.confirmQuickSelection();
    }

    // 倉頡 (or quick before pick — ignore empty)
    if (this.mode === 'cangjie' || (this.mode === 'quick' && !this.quickPicking)) {
      if (!this.buffer) return false;

      this.stats.totalKeys += 1;
      const required = this.getRequired();

      if (this.buffer === required) {
        this.stats.correctKeys += 1;
        this._onSuccess();
        this._tickHud();
        return true;
      }

      this.stats.streak = 0;
      this.audio.error();
      this._flashDom('bad');
      this._syncScreen('err');
      setTimeout(() => {
        if (this.revealOpen) return;
        this.buffer = '';
        this.hideCandidates();
        this._syncScreen('idle');
        this._tickHud();
      }, 280);
      this._tickHud();
      return false;
    }

    return false;
  }

  formatBufferDisplay(status) {
    const spaced = this.buffer ? [...this.buffer].join(' ') : '';
    const bracket = spaced ? `[ ${spaced} ]` : '[ ]';
    if (status === 'await-space' || (this.buffer && this.buffer === this.getRequired() && this.mode === 'cangjie')) {
      return `${bracket} → Press [Space] to submit`;
    }
    if (status === 'pick' || this.quickPicking) {
      const pageItems = this.getPageCandidates?.() || [];
      const entry = pageItems[this.selectedCandidateIndex];
      const sel = entry ? ` (${this.selectedCandidateIndex + 1}.${entry.char})` : '';
      return `${bracket} → Press [1-9] or [Space] to select${sel}`;
    }
    if (status === 'typing' && this.buffer) {
      return `${bracket} …`;
    }
    return this.buffer || '_';
  }

  /** After first+last keys: open Windows-IME style paginated candidates. */
  enterQuickPick() {
    const q = this.buffer.toUpperCase();
    this._candidateList = lookupQuickCandidates(q);
    // Ensure practice target exists in list (keep frequency order otherwise)
    if (this.target && !this._candidateList.some((e) => e.char === this.target.char)) {
      const tEntry = charEntry(this.target.char);
      if (tEntry && tEntry.quickCode === q) {
        this._candidateList = [...this._candidateList, tEntry];
      }
    }

    this.quickPicking = true;
    this.candidatePage = 0;
    this.selectedCandidateIndex = 0; // Windows default highlight = #1

    this.renderCandidatePage();
    this._syncScreen('pick');
  }

  getCandidatePageCount() {
    const n = this._candidateList?.length || 0;
    return Math.max(1, Math.ceil(n / QUICK_PAGE_SIZE));
  }

  getPageCandidates() {
    const start = this.candidatePage * QUICK_PAGE_SIZE;
    return (this._candidateList || []).slice(start, start + QUICK_PAGE_SIZE);
  }

  renderCandidatePage() {
    const pageItems = this.getPageCandidates();
    const pages = this.getCandidatePageCount();
    const panel = document.getElementById('candidate-panel');
    const listEl = document.getElementById('candidate-list');
    const codeLabel = document.getElementById('candidate-code-label');
    const pageLabel = document.getElementById('candidate-page-label');
    const pageText = `${this.candidatePage + 1} / ${pages}`;
    const codeText = this.buffer || '—';

    if (this.mobileUi) {
      this.mobileUi.renderCandidates({
        items: pageItems,
        selectedIndex: this.selectedCandidateIndex,
        code: codeText,
        pageLabel: pageText,
      });
    }

    if (codeLabel) codeLabel.textContent = this.buffer.toUpperCase() || '—';
    if (pageLabel) {
      pageLabel.textContent = `${this.candidatePage + 1} / ${pages}`;
    }

    if (listEl) {
      listEl.innerHTML = '';
      if (!pageItems.length) {
        listEl.innerHTML = '<span class="candidate-empty">無候選</span>';
      } else {
        pageItems.forEach((entry, i) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'candidate-item';
          btn.dataset.pageIndex = String(i);
          btn.setAttribute('role', 'option');
          if (this.target && entry.char === this.target.char) btn.classList.add('is-target');
          if (i === this.selectedCandidateIndex) btn.classList.add('is-selected');
          btn.innerHTML = `<span class="candidate-num">${i + 1}.</span><span class="candidate-char">${entry.char}</span>`;
          btn.title = `${i + 1}. ${entry.char} · 倉頡 ${entry.cangjieCode}`;
          btn.addEventListener('click', () => this.commitPageCandidate(i));
          listEl.appendChild(btn);
        });
      }
    }

    if (panel) panel.classList.remove('hidden');
    this._updatePickOverlay();
  }

  _updatePickOverlay() {
    const pages = this.getCandidatePageCount();
    const label = this.formatBufferDisplay('pick');
    const bufEl = document.getElementById('typed-buffer');
    if (bufEl) {
      bufEl.textContent = label;
      bufEl.classList.remove('error', 'success');
      bufEl.classList.add('picking');
    }
    this.screen.setContent({
      char: this.target?.char || '—',
      buffer: label,
      modeLabel: '速成',
      status: 'idle',
      context: `1–9 選字 · Space=#1 · ${this.candidatePage + 1}/${pages}頁`,
    });
  }

  /** Highlight slot 0–8 on current page (visual only). */
  setCandidateHighlight(pageIndex) {
    const pageItems = this.getPageCandidates();
    if (!pageItems.length) return;
    const i = Math.max(0, Math.min(pageIndex, pageItems.length - 1));
    this.selectedCandidateIndex = i;
    const listEl = document.getElementById('candidate-list');
    if (listEl) {
      listEl.querySelectorAll('.candidate-item').forEach((el) => {
        const idx = Number(el.dataset.pageIndex);
        el.classList.toggle('is-selected', idx === i);
      });
    }
    this.mobileUi?.renderCandidates({
      items: pageItems,
      selectedIndex: this.selectedCandidateIndex,
      code: this.buffer || '—',
      pageLabel: `${this.candidatePage + 1} / ${this.getCandidatePageCount()}`,
    });
    this._updatePickOverlay();
    this.audio.keypress();
  }

  nextCandidatePage() {
    if (!this.quickPicking) return;
    const pages = this.getCandidatePageCount();
    if (this.candidatePage >= pages - 1) return;
    this.candidatePage += 1;
    this.selectedCandidateIndex = 0;
    this.renderCandidatePage();
    this.audio.keypress();
  }

  prevCandidatePage() {
    if (!this.quickPicking) return;
    if (this.candidatePage <= 0) return;
    this.candidatePage -= 1;
    this.selectedCandidateIndex = 0;
    this.renderCandidatePage();
    this.audio.keypress();
  }

  /**
   * Number key 1–9: immediately select & submit that candidate (速成).
   */
  commitPageCandidate(pageIndex) {
    if (!this.quickPicking || this.revealOpen) return false;
    const pageItems = this.getPageCandidates();
    const entry = pageItems[pageIndex];
    if (!entry) return false;
    this.selectedCandidateIndex = pageIndex;
    this.setCandidateHighlight(pageIndex);
    return this._commitEntry(entry);
  }

  /** Space = fallback confirm Candidate #1 (or current highlight if changed by click). */
  confirmQuickSelection() {
    if (!this.quickPicking || this.revealOpen) return false;
    const pageItems = this.getPageCandidates();
    // Space defaults to #1 unless user clicked another slot (still prefer #1 per rule)
    const entry = pageItems[0] || pageItems[this.selectedCandidateIndex];
    if (!entry) return false;
    this.selectedCandidateIndex = 0;
    return this._commitEntry(entry);
  }

  _commitEntry(entry) {
    if (!this.running || !this.target || !entry) return false;
    this.stats.totalKeys += 1;

    if (entry.char === this.target.char) {
      this.stats.correctKeys += 1;
      this.quickPicking = false;
      this.hideCandidates();
      this._onSuccess();
      this._tickHud();
      return true;
    }

    this.stats.streak = 0;
    this.audio.error();
    this._flashDom('bad');
    this._tickHud();
    return false;
  }

  /** @deprecated use commitPageCandidate — kept for key handler name */
  selectCandidateByIndex(pageIndex) {
    return this.commitPageCandidate(pageIndex);
  }

  showCandidates(quickCode, { intoReveal = false } = {}) {
    const list = lookupQuickCandidates(quickCode, { limit: 27 });
    if (intoReveal) {
      const block = document.getElementById('reveal-candidates');
      const listEl = document.getElementById('reveal-candidate-list');
      if (block) block.classList.remove('hidden');
      if (listEl) {
        listEl.innerHTML = '';
        list.forEach((entry, i) => {
          const span = document.createElement('span');
          span.className = 'candidate-item';
          if (this.target && entry.char === this.target.char) span.classList.add('is-target');
          span.innerHTML = `<span class="candidate-num">${(i % QUICK_PAGE_SIZE) + 1}.</span><span class="candidate-char">${entry.char}</span>`;
          listEl.appendChild(span);
        });
      }
    }
    return list;
  }

  hideCandidates() {
    const panel = document.getElementById('candidate-panel');
    if (panel) panel.classList.add('hidden');
    this.mobileUi?.hideCandidates();
    this._candidateList = [];
    this.quickPicking = false;
    this.selectedCandidateIndex = 0;
    this.candidatePage = 0;
    const bufEl = document.getElementById('typed-buffer');
    if (bufEl) bufEl.classList.remove('picking');
  }

  _onSuccess() {
    const elapsed = performance.now() - this._charStartedAt;
    this.stats.charTimes.push(elapsed);
    this.stats.completed += 1;
    this.stats.streak += 1;
    this.stats.bestStreak = Math.max(this.stats.bestStreak, this.stats.streak);

    this.audio.success();
    this._syncScreen('ok');
    this._flashDom('ok');

    if (this.playMode === 'race') {
      this._emitRace();
      const code = [...(this.target?.cangjieCode || '')];
      code.forEach((letter, i) => {
        setTimeout(() => this.keyboard.pulseKey(letter, 320), i * 180);
      });
      if (this._advanceTimer) clearTimeout(this._advanceTimer);
      const wait = this.fastPractice
        ? 120
        : Math.max(320, code.length * 180 + 200);
      this._advanceTimer = setTimeout(() => {
        if (this.running) this._advanceRace();
      }, wait);
      return;
    }

    // Fast Practice: skip breakdown popup, keep flash/audio, go next
    if (this.fastPractice) {
      const code = [...(this.target?.cangjieCode || '')];
      code.forEach((letter, i) => {
        setTimeout(() => this.keyboard.pulseKey(letter, 220), i * 70);
      });
      if (this._advanceTimer) clearTimeout(this._advanceTimer);
      this._advanceTimer = setTimeout(() => {
        if (this.running) this.nextCharacter();
      }, 180);
      return;
    }

    const codeLen = this.target?.cangjieCode?.length || 2;
    const animMs = 120 + codeLen * 400 + 80;
    const delay = this.getEffectiveRevealDelay();
    this.showReveal(false, {
      autoAdvance: true,
      durationMs: delay > 0 ? Math.max(animMs, delay) : 0,
    });
  }

  backspace() {
    if (this.revealOpen) return;
    if (this.quickPicking) {
      this.hideCandidates();
      this.buffer = '';
      this._syncScreen('idle');
      this._tickHud();
      return;
    }
    if (!this.buffer) return;
    this.buffer = this.buffer.slice(0, -1);
    this._syncScreen('idle');
    this._tickHud();
  }

  showReveal(fromHint = true, { autoAdvance = false, durationMs = 0 } = {}) {
    if (!this.target) return;
    this._cancelDecompose();
    this._clearRevealCountdown();
    this.revealFrozen = false;
    this._setFreezeUi(false);

    const t = this.target;
    const modal = document.getElementById('reveal-modal');
    document.getElementById('reveal-char').textContent = t.char;
    document.getElementById('reveal-pinyin').textContent = fromHint ? '拆碼提示' : '輸入完成';
    document.getElementById('reveal-meaning').textContent =
      t.meaning || `碼長 ${t.cangjieCode.length} · 難度 ${frequencyFromCode(t.cangjieCode)}`;
    document.getElementById('reveal-decomp').textContent = formatDecomposition(t);
    document.getElementById('reveal-cangjie').textContent = t.cangjieCode;
    document.getElementById('reveal-quick').textContent = t.quickCode;
    modal.classList.remove('hidden');
    this.revealOpen = true;
    this.hideCandidates();

    // Always show same 速成-code neighbours on breakdown
    this.showCandidates(t.quickCode, { intoReveal: true });

    // Close options dropdown so it cannot overlap the modal
    const settings = document.getElementById('settings-panel');
    if (settings) settings.classList.add('hidden');
    const gear = document.getElementById('btn-settings');
    if (gear) gear.setAttribute('aria-expanded', 'false');

    if (autoAdvance) {
      this.startRevealCountdown(durationMs);
    } else {
      this.startRevealCountdown(0);
    }

    this._decompAbort = new AbortController();
    playDecomposeAnimation({
      charObj: t,
      keyboard: this.keyboard,
      stepsContainer: document.getElementById('decomp-steps'),
      structureEl: document.getElementById('structure-tag'),
      stepDelay: 400,
      signal: this._decompAbort.signal,
      onStep: (step) => {
        if (fromHint) this.audio.keypress();
        this.screen.setContent({
          char: t.char,
          buffer: `${step.radical} · ${step.letter}`,
          modeLabel: this.mode === 'quick' ? '速成' : '倉頡',
          status: 'idle',
          context: step.label,
        });
      },
    }).then(() => {
      if (!this._decompAbort?.signal.aborted) {
        this._syncScreen(fromHint ? 'idle' : 'ok');
      }
    });

    if (fromHint) this.audio.keypress();
  }

  hideReveal() {
    this._cancelDecompose();
    this._clearRevealCountdown();
    this.revealOpen = false;
    this.revealFrozen = false;
    this._revealAuto = false;
    this._setFreezeUi(false);
    const modal = document.getElementById('reveal-modal');
    if (modal) modal.classList.add('hidden');
  }

  toggleSound() {
    return this.audio.toggle();
  }

  _syncScreen(status) {
    const raceCtx =
      this.playMode === 'race' && this.raceSeq.length
        ? `${this.raceIndex + 1}/${this.raceSeq.length}`
        : null;

    const displayBuf = this.formatBufferDisplay(status);
    let context = raceCtx;
    if (status === 'await-space') context = 'Press [Space] to submit';
    if (status === 'pick' || this.quickPicking) context = 'Press [1-9] or [Space]';
    if (status === 'typing' && this.buffer) context = '繼續輸入…';

    this.screen.setContent({
      char: this.target?.char || '—',
      buffer: displayBuf,
      modeLabel: this.mode === 'quick' ? '速成' : '倉頡',
      status: status === 'err' ? 'err' : status === 'ok' ? 'ok' : 'idle',
      context,
    });

    const bufEl = document.getElementById('typed-buffer');
    if (bufEl) {
      bufEl.textContent = displayBuf;
      bufEl.classList.remove('error', 'success', 'picking', 'await-space');
      if (status === 'err') bufEl.classList.add('error');
      if (status === 'ok') bufEl.classList.add('success');
      if (status === 'pick' || this.quickPicking) bufEl.classList.add('picking');
      if (status === 'await-space') bufEl.classList.add('await-space');
    }
  }

  _flashDom(kind) {
    const el = document.getElementById('flash');
    if (!el) return;
    el.classList.remove('ok', 'bad');
    void el.offsetWidth;
    el.classList.add(kind === 'ok' ? 'ok' : 'bad');
    setTimeout(() => el.classList.remove('ok', 'bad'), 280);
  }

  getCpm() {
    const elapsedMin = Math.max((performance.now() - this.startedAt) / 60000, 1 / 60);
    return Math.round(this.stats.completed / elapsedMin);
  }

  getWpm() {
    return this.getCpm();
  }

  getAccuracy() {
    if (this.stats.totalKeys === 0) return 100;
    return Math.round((this.stats.correctKeys / this.stats.totalKeys) * 100);
  }

  getElapsedLabel() {
    let sec = Math.floor((performance.now() - this.startedAt) / 1000);
    if (this.playMode === 'race' && this.raceLimitSec > 0) {
      sec = Math.max(0, this.raceLimitSec - sec);
    }
    const m = Math.floor(sec / 60);
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  _emitRace(extra = {}) {
    if (typeof this.onRaceUpdate !== 'function') return;
    const total = this.raceSeq.length || 1;
    const done = Math.min(this.stats.completed, total);
    this.onRaceUpdate({
      progress: done / total,
      done,
      total: this.raceSeq.length,
      cpm: this.running || this.raceEnded ? this.getCpm() : 0,
      wpm: this.running || this.raceEnded ? this.getWpm() : 0,
      metrics: this.raceMetrics,
      ...extra,
    });
  }

  _tickHud() {
    if (typeof this.onHudUpdate === 'function') {
      this.onHudUpdate({
        wpm: this.running || this.raceEnded ? this.getWpm() : 0,
        cpm: this.running || this.raceEnded ? this.getCpm() : 0,
        accuracy: this.getAccuracy(),
        streak: this.stats.streak,
        timer: this.running || this.raceEnded ? this.getElapsedLabel() : '0:00',
        mode: this.mode,
        playMode: this.playMode,
        sound: this.audio.enabled,
        raceLimit: this.raceLimitSec,
      });
    }
  }
}

export function buildRefSheet() {
  const grid = document.getElementById('ref-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const order = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter((k) => CANGJIE_RADICALS[k]);
  order.forEach((letter) => {
    const cell = document.createElement('div');
    cell.className = 'ref-cell';
    cell.innerHTML = `<span class="letter">${letter}</span><span class="radical">${CANGJIE_RADICALS[letter]}</span>`;
    grid.appendChild(cell);
  });
}
