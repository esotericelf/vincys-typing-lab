/**
 * rime-cangjie (Cangjie 5) dictionary loader & text analytics
 * Source: https://github.com/rime/rime-cangjie
 *
 * Load order:
 *  1) Local static JSON (src/assets + dict/) with 3s timeout
 *  2) Built-in baseline FALLBACK_DICT (never hang)
 *  3) Background upgrade to full JSON / CDN YAML when available
 */

import { CANGJIE_RADICALS } from './cangjieData.js';
import { FALLBACK_DICT } from './fallbackDict.js';

const LOCAL_JSON_URLS = [
  './src/assets/cangjie.json',
  './dict/cangjie5.json',
  './src/assets/cangjie-baseline.json',
];

const CDN_YAML_URL =
  'https://cdn.jsdelivr.net/gh/rime/rime-cangjie@master/cangjie5.base.dict.yaml';

const LOAD_TIMEOUT_MS = 3000;

/** @type {Map<string, string>} char -> Cangjie code (A-Z) */
export const codeMap = new Map();

/** @type {Map<string, number>} char -> frequency rank (lower = more common) */
export const freqMap = new Map();

/** @type {Map<string, string[]>} quickCode -> chars sorted by frequency */
export const quickIndex = new Map();

export const QUICK_PAGE_SIZE = 9;

let loaded = false;
let loadPromise = null;
/** @type {'full' | 'fallback' | null} */
export let dictSource = null;

export function charFreq(ch) {
  return freqMap.has(ch) ? freqMap.get(ch) : 9e8;
}

export function rebuildQuickIndex() {
  quickIndex.clear();
  for (const [ch, code] of codeMap) {
    const q = quickFromCangjie(code);
    if (!q) continue;
    let list = quickIndex.get(q);
    if (!list) {
      list = [];
      quickIndex.set(q, list);
    }
    list.push(ch);
  }
  for (const [q, list] of quickIndex) {
    list.sort((a, b) => charFreq(a) - charFreq(b) || a.localeCompare(b, 'zh-Hant'));
    quickIndex.set(q, list);
  }
}

export function lookupQuickCandidates(quickCode, { limit = 0 } = {}) {
  const q = (quickCode || '').toUpperCase();
  if (!q) return [];
  const raw = quickIndex.get(q) || [];
  const sliced = limit > 0 ? raw.slice(0, limit) : raw;
  return sliced.map((ch) => charEntry(ch)).filter(Boolean);
}

export function quickFromCangjie(code) {
  const c = (code || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (c.length <= 1) return c;
  return c[0] + c[c.length - 1];
}

export function rootsFromCode(code) {
  return [...(code || '').toUpperCase()].map((k) => CANGJIE_RADICALS[k] || k);
}

export function lookupCode(char) {
  return codeMap.get(char) || null;
}

export function charEntry(char) {
  const cangjieCode = lookupCode(char);
  if (!cangjieCode) return null;
  return {
    char,
    cangjieCode,
    quickCode: quickFromCangjie(cangjieCode),
    roots: rootsFromCode(cangjieCode),
    frequency: frequencyFromCode(cangjieCode),
    pinyin: '',
    meaning: '',
  };
}

export function frequencyFromCode(code) {
  const len = (code || '').length;
  if (len <= 2) return 1;
  if (len === 3) return 2;
  return 3;
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`[dict] timeout ${ms}ms: ${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function fetchText(url, { timeoutMs = LOAD_TIMEOUT_MS } = {}) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl
    ? setTimeout(() => ctrl.abort(), timeoutMs)
    : null;
  try {
    const res = await fetch(url, { signal: ctrl?.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchJson(url, { timeoutMs = LOAD_TIMEOUT_MS } = {}) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl
    ? setTimeout(() => ctrl.abort(), timeoutMs)
    : null;
  try {
    const res = await fetch(url, { signal: ctrl?.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Parse rime YAML/TSV body: `字\tcode` after `...` */
export function parseRimeDictText(text) {
  const map = new Map();
  const parts = text.split(/\n\.\.\.\s*\n/);
  const body = parts.length > 1 ? parts[parts.length - 1] : text;
  let rank = 0;

  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    let cols = line.split('\t');
    if (cols.length < 2) cols = line.split(/\s+/);
    if (cols.length < 2) continue;

    const ch = cols[0];
    let code = (cols[1] || '').trim().toLowerCase();
    if (ch.length !== 1) continue;
    if (!/^[a-z]+$/.test(code)) continue;
    if (code.startsWith('x') || code.startsWith('z')) continue;

    code = code.toUpperCase();
    const prev = map.get(ch);
    if (!prev || code.length < prev.length) map.set(ch, code);
    if (!freqMap.has(ch)) freqMap.set(ch, rank++);
  }
  return map;
}

function ingestObject(data, { clearFreq = false } = {}) {
  if (clearFreq) freqMap.clear();
  const map = new Map();
  let fallbackRank = 0;
  for (const [ch, val] of Object.entries(data || {})) {
    if (ch.length !== 1) continue;
    if (typeof val === 'string') {
      map.set(ch, val.toUpperCase());
      if (!freqMap.has(ch)) freqMap.set(ch, fallbackRank++);
    } else if (val && typeof val === 'object' && val.c) {
      map.set(ch, String(val.c).toUpperCase());
      const f = Number(val.f);
      freqMap.set(ch, Number.isFinite(f) ? f : fallbackRank++);
    }
  }
  return map;
}

function applyMap(map, source) {
  codeMap.clear();
  map.forEach((v, k) => codeMap.set(k, v));
  rebuildQuickIndex();
  loaded = true;
  dictSource = source;
  return codeMap;
}

function applyFallbackDict(reason) {
  console.warn('[dict] using built-in baseline fallback:', reason);
  try {
    const map = ingestObject(FALLBACK_DICT, { clearFreq: true });
    applyMap(map, 'fallback');
    return codeMap;
  } catch (err) {
    console.error('[dict] fallback ingest failed', err);
    // Absolute last resort: a few hard-coded radicals
    const tiny = {
      日: 'A', 月: 'B', 金: 'C', 木: 'D', 水: 'E', 火: 'F', 土: 'G',
      竹: 'H', 戈: 'I', 十: 'J', 大: 'K', 中: 'L', 一: 'M', 弓: 'N',
      人: 'O', 心: 'P', 手: 'Q', 口: 'R', 尸: 'S', 廿: 'T', 山: 'U',
      女: 'V', 田: 'W', 難: 'X', 卜: 'Y', 明: 'AB', 好: 'VND',
    };
    applyMap(ingestObject(tiny, { clearFreq: true }), 'fallback');
    return codeMap;
  }
}

async function tryLoadLocalJson() {
  let lastErr = null;
  for (const url of LOCAL_JSON_URLS) {
    try {
      console.info('[dict] fetching', url);
      const data = await fetchJson(url, { timeoutMs: LOAD_TIMEOUT_MS });
      const map = ingestObject(data, { clearFreq: true });
      if (map.size < 20) throw new Error(`too few entries (${map.size}) from ${url}`);
      console.info('[dict] loaded', map.size, 'chars from', url);
      return { map, url, source: url.includes('baseline') ? 'fallback' : 'full' };
    } catch (err) {
      lastErr = err;
      console.warn('[dict] local load failed:', url, err?.message || err);
    }
  }
  throw lastErr || new Error('all local dictionary URLs failed');
}

async function tryLoadCdnYaml() {
  console.info('[dict] fetching CDN yaml', CDN_YAML_URL);
  const text = await fetchText(CDN_YAML_URL, { timeoutMs: 8000 });
  const map = parseRimeDictText(text);
  if (map.size < 20) throw new Error(`CDN yaml too small (${map.size})`);
  console.info('[dict] loaded', map.size, 'chars from CDN yaml');
  return map;
}

/** Quiet background upgrade after fallback — never throws to callers */
function upgradeInBackground() {
  (async () => {
    try {
      const result = await tryLoadLocalJson();
      if (result.map.size > codeMap.size) {
        applyMap(result.map, result.source);
        console.info('[dict] background upgrade →', codeMap.size, 'chars');
        window.dispatchEvent(
          new CustomEvent('dict-upgraded', { detail: { size: codeMap.size, source: dictSource } })
        );
      }
    } catch (err) {
      try {
        const map = await tryLoadCdnYaml();
        if (map.size > codeMap.size) {
          applyMap(map, 'full');
          window.dispatchEvent(
            new CustomEvent('dict-upgraded', { detail: { size: codeMap.size, source: dictSource } })
          );
        }
      } catch (cdnErr) {
        console.warn('[dict] background upgrade skipped', cdnErr?.message || cdnErr);
      }
    }
  })();
}

/**
 * Load dictionary. Always resolves (fallback if needed) so the UI never hangs.
 * @returns {Promise<Map<string,string>>}
 */
export async function loadDictionary() {
  if (loaded && codeMap.size > 0) return codeMap;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const result = await withTimeout(tryLoadLocalJson(), LOAD_TIMEOUT_MS + 500, 'local-json');
      applyMap(result.map, result.source);
      return codeMap;
    } catch (err) {
      console.error('[dict] primary load failed or timed out', err);
      applyFallbackDict(err?.message || String(err));
      upgradeInBackground();
      return codeMap;
    }
  })();

  try {
    return await loadPromise;
  } catch (err) {
    // Should never happen — belt and suspenders
    console.error('[dict] unexpected loadPromise rejection', err);
    applyFallbackDict('unexpected rejection');
    return codeMap;
  }
}

export function isCjkChar(ch) {
  if (!ch || ch.length !== 1) return false;
  const cp = ch.codePointAt(0);
  return (
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x20000 && cp <= 0x2a6df)
  );
}

export function analyzeText(text) {
  const chars = [...text].filter((c) => isCjkChar(c));
  const unique = new Set(chars);
  let known = 0;
  let keyLenSum = 0;
  let hard = 0;

  for (const ch of unique) {
    const code = lookupCode(ch);
    if (!code) continue;
    known += 1;
    keyLenSum += code.length;
    if (code.length >= 4) hard += 1;
  }

  const uniqueCount = unique.size;
  const avgKeyLen = known ? keyLenSum / known : 0;
  const hardRatio = known ? hard / known : 0;

  let difficulty = 'Easy';
  let difficultyScore = 1;
  if (avgKeyLen >= 3.2 || hardRatio >= 0.35) {
    difficulty = 'Hard';
    difficultyScore = 3;
  } else if (avgKeyLen >= 2.4 || hardRatio >= 0.18) {
    difficulty = 'Medium';
    difficultyScore = 2;
  }

  return {
    totalChars: chars.length,
    uniqueCount,
    knownUnique: known,
    avgKeyLen: Math.round(avgKeyLen * 100) / 100,
    difficulty,
    difficultyScore,
    rawLength: text.length,
  };
}

export function extractTypeableSequence(text) {
  const seq = [];
  for (const ch of text) {
    if (!isCjkChar(ch)) continue;
    const entry = charEntry(ch);
    if (entry) seq.push(entry);
  }
  return seq;
}

export async function loadPracticeChars() {
  try {
    const data = await fetchJson('./dict/practice_chars.json', { timeoutMs: 2000 });
    if (Array.isArray(data) && data.length) return data;
  } catch (err) {
    console.warn('[dict] practice_chars.json failed, using embedded list', err?.message || err);
  }
  return [...'日月金木水火土竹戈十大中一弓人心手口尸廿山女田卜難明林炎昌天本早華港國愛地好安家學生時年東西南北春夏秋冬風雨電車門開問看見語書文字漢香花草魚鳥馬我你他龍鳳灣粵臺機腦'];
}

export const SAMPLE_TEXTS = [
  {
    id: 'sanzi',
    title: '三字經（節錄）',
    path: './texts/sanzi.txt',
  },
  {
    id: 'news',
    title: '香港與輸入法',
    path: './texts/news.txt',
  },
  {
    id: 'classical',
    title: '古典散文（節錄）',
    path: './texts/classical.txt',
  },
];
