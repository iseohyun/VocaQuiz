/**
 * @file components/word-view.js
 * @description 문제 단어 카드와 단계 아이콘을 그린다(CountryQuiz 의 map-view.js 자리).
 *  - 글자 보기: 단어를 크게(일본어는 후리가나 선택), 소리 듣기: 스피커 단추만 보이고 단어는 감춘다.
 *  - 단계 아이콘: 단계 색 둥근 네모에 짧은 이름(초·중·고·토 / N5~N1). 언어 표시(EN/JA)를 작게 붙인다.
 */

import { getLevel, escapeHtml, renderForeignHtml } from './word-data.js';

/** 단계 아이콘(SVG) */
export function renderLevelIcon(levelId, { size = 24, title = '' } = {}) {
  const level = getLevel(levelId);
  const label = escapeHtml(level.short);
  const fontSize = label.length > 1 ? 11 : 14;
  const lang = level.lang === 'ja' ? 'JA' : 'EN';
  return `<svg class="level-icon" viewBox="0 0 24 24" width="${size}" height="${size}" role="img" aria-label="${escapeHtml(title)}">
    <rect x="1" y="1" width="22" height="22" rx="6" fill="${level.color}"></rect>
    <text x="12" y="${label.length > 1 ? 15 : 16}" text-anchor="middle" font-size="${fontSize}" font-weight="800" fill="#fff"
      font-family="Outfit, 'Noto Sans KR', sans-serif">${label}</text>
    <text x="12" y="21.5" text-anchor="middle" font-size="4.5" font-weight="700" fill="rgba(255,255,255,0.85)"
      font-family="Outfit, sans-serif">${lang}</text>
  </svg>`;
}

/** 단어를 보여 주는 HTML(일본어는 후리가나) */
export const renderWordHtml = renderForeignHtml;

/**
 * 문제 단어 카드.
 * @param {HTMLElement} container
 * @param {object} word getWord() 결과
 * @param {{direction?: 'toKo'|'fromKo', read?: boolean, listen?: boolean, furigana?: boolean, revealed?: boolean}} options
 *   외→한: read 면 단어를 보이고, read 가 꺼져 있으면 큰 스피커만(revealed 면 단어도).
 *   한→외: 한국어 뜻을 크게 보인다. 소리를 켰으면 작은 스피커(정답 단어 소리).
 */
export function renderWordCard(container, word, { direction = 'toKo', read = true, listen = false, furigana = true, revealed = false } = {}) {
  if (!container || !word) return;
  const level = getLevel(word.domain);
  let body;
  let speak = '';
  if (direction === 'fromKo') {
    body = `<div class="word-card-word word-card-meaning${[...word.meaning].length > 9 ? ' long' : ''}" lang="ko">${escapeHtml(word.meaning)}</div>`;
    if (listen) speak = '<button type="button" class="word-card-speak small" data-speak aria-label="소리 듣기" title="소리 듣기 (Space)"><span class="material-symbols-outlined">volume_up</span></button>';
  } else {
    const showWord = read || revealed;
    body = showWord ? `<div class="word-card-word${[...word.word].length > 9 ? ' long' : ''}">${renderForeignHtml(word, { furigana })}</div>` : '';
    speak = `<button type="button" class="word-card-speak${showWord ? ' small' : ''}" data-speak aria-label="소리 듣기" title="소리 듣기 (Space)">
        <span class="material-symbols-outlined">volume_up</span>
      </button>`;
  }
  container.innerHTML = `
    <div class="word-card${direction === 'toKo' && !read ? ' listen' : ''}" style="--level-color:${level.color}">
      <span class="word-card-level">${renderLevelIcon(word.domain, { size: 22, title: level.name })}${escapeHtml(level.name)}</span>
      ${body}
      ${speak}
    </div>`;
}
