/**
 * @file components/audio-manager.js
 * @description 단어를 브라우저 내장 TTS(Web Speech API)로 읽어 준다. 언어(영어 en-US, 일본어 ja-JP)에 맞는 목소리를 고르고,
 * 일본어는 한자 오독을 막기 위해 읽기(히라가나)를 읽힌다. 속도는 설정의 음성 속도(userConfig.speechRate).
 */

import { userConfig } from './store.js';

const voiceCache = {};

function pickVoice(langCode) {
  if (!('speechSynthesis' in window)) return null;
  if (voiceCache[langCode]) return voiceCache[langCode];
  const voices = window.speechSynthesis.getVoices();
  const prefix = langCode.split('-')[0];
  const sameLang = voices.filter((v) => (v.lang || '').replace('_', '-').toLowerCase().startsWith(prefix));
  // 같은 언어 안에서 자연스러운 목소리(Google·Natural·Online)를 먼저, 그다음 정확히 같은 지역 코드
  const voice =
    sameLang.find((v) => /natural|online|google/i.test(v.name) && v.lang.replace('_', '-') === langCode) ||
    sameLang.find((v) => v.lang.replace('_', '-') === langCode) ||
    sameLang[0] || null;
  if (voice) voiceCache[langCode] = voice;
  return voice;
}

export function initAudioEngine() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
      Object.keys(voiceCache).forEach((k) => delete voiceCache[k]);
    };
    window.speechSynthesis.getVoices();
  }
  return Promise.resolve(true);
}

/** TTS 를 쓸 수 있는가 */
export function isSpeechSupported() {
  return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

/**
 * 단어 하나를 읽는다.
 * @param {{word: string, reading?: string, lang: 'en'|'ja'}} word
 */
export function speakWord(word) {
  if (!word || !isSpeechSupported()) return false;
  const langCode = word.lang === 'ja' ? 'ja-JP' : 'en-US';
  const text = word.lang === 'ja' ? (word.reading || word.word) : word.word;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    const voice = pickVoice(langCode);
    if (voice) utterance.voice = voice;
    utterance.rate = userConfig.speechRate || 0.85;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch (e) {
    console.error('[TTS] 읽지 못했습니다:', e);
    return false;
  }
}

/** 설정의 음성 테스트: 지금 언어의 예시 단어 */
export function playSoundTest() {
  const ja = String(userConfig.currentDomain || '').startsWith('vocaJa');
  return speakWord(ja ? { word: 'こんにちは', reading: 'こんにちは', lang: 'ja' } : { word: 'hello', lang: 'en' });
}

export function stopAllVoices() {
  if ('speechSynthesis' in window) {
    try { window.speechSynthesis.cancel(); } catch { /* 무시 */ }
  }
}
