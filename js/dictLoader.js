/**
 * rime-cangjie (Cangjie 5) dictionary loader & text analytics
 * Source: https://github.com/rime/rime-cangjie
 */

import { CANGJIE_RADICALS } from './cangjieData.js';

const DICT_URLS = [
  './dict/cangjie5.json',
  'https://cdn.jsdelivr.net/gh/rime/rime-cangjie@master/cangjie5.base.dict.yaml',
];

/** @type {Map<string, string>} char -> Cangjie code (A-Z) */
export const codeMap = new Map();

/** @type {Map<string, number>} char -> frequency rank (lower = more common, Windows/Rime style) */
export const freqMap = new Map();

/** @type {Map<string, string[]>} quickCode -> chars sorted by frequency */
export const quickIndex = new Map();

/** Candidates per IME page (number keys 1–9) */
export const QUICK_PAGE_SIZE = 9;

let loaded = false;
let loadPromise = null;

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
  // Sort each bucket by Windows/Rime-like frequency (ascending rank)
  for (const [q, list] of quickIndex) {
    list.sort((a, b) => charFreq(a) - charFreq(b) || a.localeCompare(b, 'zh-Hant'));
    quickIndex.set(q, list);
  }
}

/**
 * Characters that share a 速成 (first+last) code, frequency-sorted like Windows IME.
 */
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

/** Parse rime YAML/TSV body: `字\tcode` or `字 code` after `...` */
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

async function fetchJsonMap(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const map = new Map();
  let fallbackRank = 0;
  for (const [ch, val] of Object.entries(data)) {
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

async function fetchYamlMap(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseRimeDictText(await res.text());
}

export async function loadDictionary() {
  if (loaded) return codeMap;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    // Prefer local JSON (prebuilt from rime-cangjie)
    try {
      const map = await fetchJsonMap('./dict/cangjie5.json');
      map.forEach((v, k) => codeMap.set(k, v));
      rebuildQuickIndex();
      loaded = true;
      return codeMap;
    } catch {
      /* fall through */
    }

    // CDN YAML fallback (base table)
    try {
      const map = await fetchYamlMap(DICT_URLS[1]);
      map.forEach((v, k) => codeMap.set(k, v));
      rebuildQuickIndex();
      loaded = true;
      return codeMap;
    } catch (err) {
      console.error('Failed to load rime-cangjie dictionary', err);
      throw err;
    }
  })();

  return loadPromise;
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

/**
 * Analyze Traditional Chinese practice text against the dictionary.
 */
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

/** Extract typeable CJK chars that exist in the dictionary (preserve order). */
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
    const res = await fetch('./dict/practice_chars.json');
    if (res.ok) return await res.json();
  } catch {
    /* ignore */
  }
  return [...'日月金木水火土竹戈十大中一弓人心手口山女田明華港國愛龍天地'];
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
