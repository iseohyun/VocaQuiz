/**
 * @file components/word-data.js
 * @description 단어장 데이터(data/words/*.js)를 퀴즈에 맞게 묶는다.
 *  - 단계(초등·중학·고등·수능토익 / JLPT N5~N1) = 챕터(도메인). 단계 안의 단어 순서가 글자 ID(charId)다.
 *    순서를 바꾸면 기존 진도가 다른 단어로 옮겨 가므로, 단어를 더할 때는 파일 끝에만 붙인다.
 *  - 문제 종류(퀴즈 범위): 글자 보기(단어를 보고 뜻 고르기), 소리 듣기(읽어 주는 소리를 듣고 뜻 고르기).
 *  - 보기는 늘 한국어 뜻 4개. 뜻이 겹치는 단어는 보기에서 뺀다.
 */

import EN1 from '../data/words/vocaEn1.js';
import EN2 from '../data/words/vocaEn2.js';
import EN3 from '../data/words/vocaEn3.js';
import EN4 from '../data/words/vocaEn4.js';
import JA5 from '../data/words/vocaJaN5.js';
import JA4 from '../data/words/vocaJaN4.js';
import JA3 from '../data/words/vocaJaN3.js';
import JA2 from '../data/words/vocaJaN2.js';
import JA1 from '../data/words/vocaJaN1.js';

/** 언어별 TTS 언어 코드 */
export const LANGS = {
  en: { id: 'en', name: '영어', tts: 'en-US' },
  ja: { id: 'ja', name: '일본어', tts: 'ja-JP' }
};

// 단계 색: 낮은 단계일수록 밝게. 아이콘(renderLevelIcon)·칩에 함께 쓴다
export const LEVELS = [
  { id: 'vocaEn1', lang: 'en', name: '초등', short: '초', color: '#22c55e', rows: EN1 },
  { id: 'vocaEn2', lang: 'en', name: '중학', short: '중', color: '#0ea5e9', rows: EN2 },
  { id: 'vocaEn3', lang: 'en', name: '고등', short: '고', color: '#6366f1', rows: EN3 },
  { id: 'vocaEn4', lang: 'en', name: '수능·토익', short: '토', color: '#a855f7', rows: EN4 },
  { id: 'vocaJaN5', lang: 'ja', name: 'N5', short: 'N5', color: '#f59e0b', rows: JA5 },
  { id: 'vocaJaN4', lang: 'ja', name: 'N4', short: 'N4', color: '#f97316', rows: JA4 },
  { id: 'vocaJaN3', lang: 'ja', name: 'N3', short: 'N3', color: '#ef4444', rows: JA3 },
  { id: 'vocaJaN2', lang: 'ja', name: 'N2', short: 'N2', color: '#db2777', rows: JA2 },
  { id: 'vocaJaN1', lang: 'ja', name: 'N1', short: 'N1', color: '#9333ea', rows: JA1 }
];

/** 데이터 한 줄 → 단어 객체. 영어 [단어, 뜻, 품사], 일본어 [표기, 읽기, 뜻, 품사] */
function toWord(row, level) {
  if (level.lang === 'ja') {
    const [word, reading, meaning, pos] = row;
    return { word, reading: reading || '', meaning, pos: pos || '', lang: 'ja', domain: level.id };
  }
  const [word, meaning, pos] = row;
  return { word, reading: '', meaning, pos: pos || '', lang: 'en', domain: level.id };
}

const ROW_SIZE = 5;
const byWord = new Map();
const wordsByDomain = {};
LEVELS.forEach((level) => {
  const list = (level.rows || []).map((row) => toWord(row, level));
  wordsByDomain[level.id] = list;
  list.forEach((w) => { if (!byWord.has(w.word)) byWord.set(w.word, w); });
});

/** 단계별 단어 표(한 줄 5개). engine.js 의 ALPHABETS 로 쓴다 */
export const WORD_ROWS = Object.fromEntries(LEVELS.map(({ id }) => {
  const words = wordsByDomain[id].map((w) => w.word);
  const rows = [];
  for (let i = 0; i < words.length; i += ROW_SIZE) rows.push(words.slice(i, i + ROW_SIZE));
  return [id, rows];
}));

export function getWord(word) {
  return byWord.get(word) || null;
}

export function getLevel(id) {
  return LEVELS.find((l) => l.id === id) || LEVELS[0];
}

/**
 * 표시 방식(퀴즈 범위의 앞 칩). 함께 켤 수 있다: 둘 다 켜면 글자를 보이면서 읽어 준다.
 *  - read: 외국어 단어를 글자로 보인다
 *  - listen: 외국어 단어를 소리로 읽어 준다
 */
export const QUIZ_TYPES = [
  { id: 'read', label: '글자 보기' },
  { id: 'listen', label: '소리 듣기' }
];
export const DEFAULT_QUIZ_TYPES = ['read', 'listen'];

/**
 * 출제 방향(퀴즈 범위의 뒤 칩). 둘 다 켜면 문제마다 섞는다.
 *  - toKo: 외국어 → 한국어(보기는 한국어 뜻)
 *  - fromKo: 한국어 → 외국어(문제는 한국어 뜻, 보기는 외국어 단어)
 */
export const DIRECTIONS = [
  { id: 'toKo', label: '외→한' },
  { id: 'fromKo', label: '한→외' }
];
export const DEFAULT_DIRECTIONS = ['toKo', 'fromKo'];

/** 방향 칩 이름을 언어에 맞춰(영→한, 일→한 …) */
export function getDirectionLabel(direction, lang) {
  const f = lang === 'ja' ? '일' : '영';
  return direction === 'fromKo' ? `한→${f}` : `${f}→한`;
}

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * 일본어 표기에 후리가나를 붙인다. 표기 앞뒤의 가나(送り仮名)는 읽기에서 떼어 한자 부분에만 읽기를 단다.
 * 가나만으로 된 단어는 그대로 둔다.
 */
export function renderJapaneseHtml(word, reading, { furigana = true } = {}) {
  const isKana = (ch) => /[぀-ヿー]/.test(ch);
  const toHira = (s) => s.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
  if (!furigana || !reading || [...word].every(isKana)) return escapeHtml(word);
  const chars = [...word];
  let head = 0;
  while (head < chars.length && isKana(chars[head])) head++;
  let tail = chars.length;
  while (tail > head && isKana(chars[tail - 1])) tail--;
  const prefix = chars.slice(0, head).join('');
  const suffix = chars.slice(tail).join('');
  let core = toHira(reading);
  if (prefix && core.startsWith(toHira(prefix))) core = core.slice(prefix.length);
  if (suffix && core.endsWith(toHira(suffix))) core = core.slice(0, core.length - suffix.length);
  const base = chars.slice(head, tail).join('');
  return `${escapeHtml(prefix)}<ruby>${escapeHtml(base)}<rt>${escapeHtml(core)}</rt></ruby>${escapeHtml(suffix)}`;
}

/**
 * 문제 글.
 * @param {{direction: 'toKo'|'fromKo', read?: boolean, listen?: boolean, lang?: string}} q
 */
export function renderQuestionHtml(q = {}) {
  const langName = q.lang === 'ja' ? '일본어' : '영어';
  if (q.direction === 'fromKo') return `<span class="q-label">이 뜻의 <b>${langName}</b> 단어는?</span>`;
  const text = q.read === false ? '들리는 단어의 <b>뜻</b>은?' : '이 단어의 <b>뜻</b>은?';
  return `<span class="q-label">${text}</span>`;
}

/** 외국어 단어 글자(일본어는 후리가나) */
export function renderForeignHtml(word, { furigana = true } = {}) {
  if (!word) return '';
  if (word.lang === 'ja') return `<span lang="ja">${renderJapaneseHtml(word.word, word.reading, { furigana })}</span>`;
  return `<span lang="en">${escapeHtml(word.word)}</span>`;
}

/** 보기 한 칸: 외→한이면 한국어 뜻, 한→외면 외국어 단어 */
export function renderOptionHtml(direction, word, { furigana = true } = {}) {
  if (!word) return '';
  return direction === 'fromKo' ? renderForeignHtml(word, { furigana }) : escapeHtml(word.meaning);
}

/** 힌트 종류. 방향·표시 방식·언어에 따라 쓸 수 있는 것만 차례로 연다 */
export const HINT_TYPES = ['pos', 'sound', 'reading', 'word', 'initial'];

/**
 * @param {string} hint
 * @param {{direction: string, read: boolean, listen: boolean, autoSound: boolean}} q autoSound: 문제가 나올 때 이미 읽어 줌
 * @param {object} word
 * @param {{furigana?: boolean}} opts
 */
export function isHintAvailable(hint, q, word, { furigana = true } = {}) {
  if (!word || !q) return false;
  if (hint === 'pos') return !!word.pos;
  if (hint === 'sound') return !q.autoSound; // 이미 읽어 주는 문제에서는 뺀다
  if (hint === 'initial') return true;
  if (q.direction === 'fromKo') return false; // 한→외에서 읽기·철자는 답이 된다
  if (hint === 'word') return q.read === false; // 글자를 안 보이는 문제에서만 철자를
  if (hint === 'reading') return word.lang === 'ja' && !!word.reading && (q.read === false || !furigana);
  return false;
}

/** 💡로 연 힌트 한 개(칩) */
export function renderHintChipHtml(hint, word, direction = 'toKo') {
  if (!word) return '';
  const chip = (label, value) => `<span class="hint-chip"><b>${label}</b> ${value}</span>`;
  switch (hint) {
    case 'pos': return chip('품사', escapeHtml(word.pos));
    case 'sound': return chip('소리', '🔊');
    case 'reading': return chip('읽기', escapeHtml(word.reading));
    case 'word': return chip('철자', escapeHtml(word.word));
    case 'initial': {
      if (direction === 'fromKo') {
        const head = [...(word.lang === 'ja' ? (word.reading || word.word) : word.word)][0] || '';
        return chip('첫 글자', `${escapeHtml(head)}…`);
      }
      return chip('뜻 첫 글자', `${escapeHtml([...word.meaning][0] || '')}…`);
    }
    default: return '';
  }
}

/** 단어 정보 한 줄(관전 모드·정답 확인) */
export function renderFactLine(word) {
  const reading = word.lang === 'ja' && word.reading && word.reading !== word.word ? ` [${escapeHtml(word.reading)}]` : '';
  return `${escapeHtml(word.word)}${reading} · ${escapeHtml(word.meaning)}${word.pos ? ` · ${escapeHtml(word.pos)}` : ''}`;
}

/** 뜻을 낱말로 나눈다(「크다, 넓다」→ [크다, 넓다]) */
const senses = (meaning) => String(meaning || '').split(/[,·/]/).map((s) => s.trim()).filter(Boolean);

/** 이 단어를 보기에 넣으면 답이 둘이 되는가(뜻이 같거나 겹친다) */
export function conflictsWithAnswer(_type, answer, other) {
  if (!answer || !other || answer.word === other.word) return true;
  const a = senses(answer.meaning);
  return senses(other.meaning).some((s) => a.includes(s));
}
