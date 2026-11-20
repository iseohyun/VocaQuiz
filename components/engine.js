/**
 * @file components/engine.js
 * @description 간격 반복(Spaced Repetition) 및 룩업 테이블 기반 퀴즈 출제/승급 알고리즘 엔진
 */

import { WORD_ROWS } from './word-data.js';

// 도메인 = 단계(챕터). 한 줄에 단어 5개, 자주 쓰는 순서 (components/word-data.js)
export const ALPHABETS = WORD_ROWS;

export const INTERVALS = [1, 10, 30, 120, 1440, 4320, 10080, 21600, 43200]; // 단위: 분

const EARLY_RECALL_LATENCY_THRESHOLD_MS = 1200;
const MAX_RESPONSE_LATENCY_CAP_MS = 5000;
const MIN_REQUIRED_FOR_OPTIONS = 4;

export function getFlattenedDataset(domain) {
  const rows = ALPHABETS[domain] || [];
  const flattened = [];
  let idCounter = 0;
  for (const row of rows) {
    for (const char of row) {
      if (char !== '_') {
        flattened.push({ charId: idCounter++, char });
      }
    }
  }
  return flattened;
}

/**
 * 복습 주기를 채웠는지(= 이번 세션에서 정식 승급 자격이 있는지) 판정한다.
 * 학습 모드(initSessionPool)와 기록 모드가 같은 기준을 쓰도록 한곳에서 관리한다.
 * @param {object} item 진도 데이터 (totalSolved, stage, lastSessionTime)
 * @param {number} [now=Date.now()]
 * @returns {boolean}
 */
export function isDueForReview(item, now = Date.now()) {
  if (!item || !(item.totalSolved > 0)) return false;
  const stage = item.stage || 0;
  const requiredMin = INTERVALS[stage] !== undefined ? INTERVALS[stage] : INTERVALS[INTERVALS.length - 1];
  const elapsedMin = (now - (item.lastSessionTime || 0)) / (60 * 1000);
  return elapsedMin >= requiredMin;
}

/**
 * 자동 진도 계획을 { newCount, force } 로 맞춘다. true/false(예전 방식)는 새 문항 1개/0개.
 * (계획은 components/adaptive-progress.js 의 planNewItems 가 최근 정답률로 정한다)
 */
function normalizeProgressPlan(autoProgress) {
  if (autoProgress && typeof autoProgress === 'object') {
    return { newCount: Math.max(0, Number(autoProgress.newCount) || 0), force: Boolean(autoProgress.force) };
  }
  return { newCount: autoProgress ? 1 : 0, force: false };
}

/**
 * [3단계] 새 문항을 넣는다. force 면 풀이 차 있어도 자리를 비운다:
 * 복습 때가 안 된 조기 보충 문항부터 빼고, 그래도 모자라면 뒤쪽 복습 문항을 다음 판으로 미룬다.
 */
function addNewItems(pool, processedData, plan, maxSize) {
  if (plan.newCount <= 0) return pool;
  const fresh = processedData.filter((item) => !item.hasHistory && !pool.some((p) => p.charId === item.charId));
  const take = plan.force ? plan.newCount : Math.min(plan.newCount, maxSize - pool.length);
  const picked = fresh.slice(0, Math.max(0, Math.min(take, maxSize)));
  if (picked.length === 0) return pool;
  let next = [...pool];
  let overflow = next.length + picked.length - maxSize;
  for (let i = next.length - 1; i >= 0 && overflow > 0; i--) {
    if (!next[i].isEligibleForPromotion) {
      next.splice(i, 1);
      overflow--;
    }
  }
  if (overflow > 0) next = next.slice(0, next.length - overflow);
  picked.forEach((item) => { item.isForcedNew = plan.force; });
  return next.concat(picked);
}

/**
 * 세션 진입 시 단어 풀 구성 함수
 * autoProgress: true/false 또는 { newCount, force } (adaptive-progress.js 의 planNewItems)
 */
export function initSessionPool(domain, dbData = {}, autoProgress = true, MAX_POOL_SIZE = 10) {
  const now = Date.now();
  const allCharacters = getFlattenedDataset(domain);

  const processedData = allCharacters.map(meta => {
    const saved = dbData[meta.charId] || {};
    return {
      domain,
      charId: meta.charId,
      char: meta.char,
      stage: saved.stage !== undefined ? saved.stage : 0,
      recentLatencies: saved.recentLatencies || [],
      latenciesIdx: saved.latenciesIdx || 0,
      outCnt: saved.outCnt || 0,
      resetOutCnt: saved.resetOutCnt || 0,
      totalSolved: saved.totalSolved || 0,
      lastSessionTime: saved.lastSessionTime || 0,
      sessionStreak: saved.sessionStreak || 0,
      hasHistory: saved.totalSolved > 0,
      isEligibleForPromotion: false,
      hasBeenPromotedThisSession: false
    };
  });

  let pool = [];

  const getAvgLatency = (item) => {
    if (!item.recentLatencies || item.recentLatencies.length === 0) return 0;
    return item.recentLatencies.reduce((a, b) => a + b, 0) / item.recentLatencies.length;
  };

  // [1단계] '복습 주기를 채운' 정식 단어 수급
  const reviewCandidates = processedData.filter(item => isDueForReview(item, now));

  // 정식 복습 주기를 채운 후보군은 승급 가능 자격 flag 부여
  reviewCandidates.forEach(item => {
    item.isEligibleForPromotion = true;
  });

  reviewCandidates.sort((a, b) => {
    if (a.stage !== b.stage) return a.stage - b.stage;
    return getAvgLatency(b) - getAvgLatency(a);
  });
  pool = reviewCandidates.slice(0, MAX_POOL_SIZE);

  // [2단계] 빈자리 수급 (조기 소환이므로 승급 불가(flag = false))
  if (pool.length < MAX_POOL_SIZE) {
    const insufficientCandidates = processedData.filter(item => {
      if (!item.hasHistory || pool.some(p => p.charId === item.charId)) return false;
      const avg = getAvgLatency(item);
      return avg > EARLY_RECALL_LATENCY_THRESHOLD_MS;
    });

    insufficientCandidates.sort((a, b) => getAvgLatency(b) - getAvgLatency(a));
    const remain = MAX_POOL_SIZE - pool.length;
    pool = pool.concat(insufficientCandidates.slice(0, remain));
  }

  // [3단계] 자동진도: 신규 문항 진입 (최근 정답률이 높으면 풀이 차 있어도 넣는다)
  pool = addNewItems(pool, processedData, normalizeProgressPlan(autoProgress), MAX_POOL_SIZE);

  // [4단계] 잔여 슬롯 방어선 구축
  if (pool.length < MIN_REQUIRED_FOR_OPTIONS) {
    const backupCandidates = processedData.filter(item => {
      return item.hasHistory && !pool.some(p => p.charId === item.charId);
    });
    backupCandidates.sort((a, b) => getAvgLatency(b) - getAvgLatency(a));
    const remain = MIN_REQUIRED_FOR_OPTIONS - pool.length;
    pool = pool.concat(backupCandidates.slice(0, remain));
  }

  if (pool.length < MIN_REQUIRED_FOR_OPTIONS) {
    const freshNewCandidates = processedData.filter(item => !pool.some(p => p.charId === item.charId));
    const remain = MIN_REQUIRED_FOR_OPTIONS - pool.length;
    pool = pool.concat(freshNewCandidates.slice(0, remain));
  }

  if (pool.length > MAX_POOL_SIZE) {
    pool = pool.slice(0, MAX_POOL_SIZE);
  }

  processedData.forEach(item => {
    if (pool.some(p => p.charId === item.charId)) {
      item.sessionStreak++;
    } else {
      item.sessionStreak = 0;
    }
  });

  return pool;
}

/** 보기 겹침 비교용 열쇠. 단어는 단계 안에서 서로 다르므로 그대로 쓴다 */
export function getSoundKey(char) {
  return String(char || '');
}

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

/**
 * 4지선다. 보기는 단어의 한국어 뜻이다.
 * @param {object} targetItem 정답
 * @param {object[]} currentPool 이번 풀(먼저 여기서 오답을 고른다)
 * @param {{type?: string, conflicts?: Function, fallbackPool?: object[]}} options
 *   conflicts(item): 이 단어를 보기에 넣으면 답이 둘이 되는가(뜻이 겹침)
 *   fallbackPool: 풀에서 오답이 모자랄 때 쓰는 고른 단계 전체 단어
 * @returns {{target, type, options: number[], optionItems: object}}
 */
export function generateFourOptions(targetItem, currentPool, { type, conflicts, fallbackPool = [] } = {}) {
  const picked = [targetItem];
  const tryAdd = (item) => {
    if (picked.length >= 4) return;
    if (picked.some((p) => p.charId === item.charId || p.char === item.char)) return;
    if (conflicts && conflicts(item)) return;
    picked.push(item);
  };
  shuffle(currentPool).forEach(tryAdd);
  if (picked.length < 4) shuffle(fallbackPool).forEach(tryAdd);
  const items = shuffle(picked);
  return {
    target: targetItem,
    type,
    options: items.map((item) => item.charId),
    optionItems: Object.fromEntries(items.map((item) => [item.charId, item]))
  };
}

/**
 * 퀴즈 풀이 결과 : 복습 주기 기반 승급 제어
 */
export function calculateReviewState(item, isCorrect, latency) {
  item.totalSolved++;
  item.lastSessionTime = Date.now();
  item.hasHistory = true;

  // 5초 이상 응답 지연 예외 처리
  if (latency >= MAX_RESPONSE_LATENCY_CAP_MS) {
    latency = MAX_RESPONSE_LATENCY_CAP_MS;
    item.resetOutCnt = 0;

    item.recentLatencies = item.recentLatencies || [];
    if (item.recentLatencies.length < 10) {
      item.recentLatencies.push(latency);
    } else {
      item.recentLatencies[item.latenciesIdx] = latency;
    }
    item.latenciesIdx = (item.latenciesIdx + 1) % 10;

    return item;
  }

  // 오답 처리 분기 : 3 Strikes Out -> 기억소실(Stage 0)
  if (!isCorrect) {
    item.outCnt++;
    item.resetOutCnt = 0;

    if (item.outCnt >= 3) {
      item.stage = 0;
      item.outCnt = 0;
      item.resetOutCnt = 0;
      item.recentLatencies = [];
      item.latenciesIdx = 0;
      item.isEligibleForPromotion = false; // 3out 시 승급 기회 박탈
    }
    return item;
  }

  // 정상 정답 처리 분기
  item.recentLatencies = item.recentLatencies || [];
  if (item.recentLatencies.length < 10) {
    item.recentLatencies.push(latency);
  } else {
    item.recentLatencies[item.latenciesIdx] = latency;
  }
  item.latenciesIdx = (item.latenciesIdx + 1) % 10;

  item.resetOutCnt++;
  if (item.resetOutCnt >= 3) {
    item.outCnt = Math.max(0, item.outCnt - 1);
    item.resetOutCnt = 0;
  }

  // 복습 주기를 채우지 못한 조기 소환 문항은 승급 금지
  if (!item.isEligibleForPromotion) {
    // 최초 신규 진입 문항(stage=0)인 경우에만 1단계 활성화 허용
    if (item.stage === 0 && !item.hasBeenPromotedThisSession) {
      item.stage = 1;
      item.hasBeenPromotedThisSession = true;
    }
    return item;
  }

  // 최근 10회 정답 기반 숙련도(평균 속도) 및 반응속도 판단 검증
  if (item.recentLatencies.length < 10) {
    return item;
  }

  const avgLatency = item.recentLatencies.reduce((a, b) => a + b, 0) / item.recentLatencies.length;
  const margin = avgLatency * 0.2;

  if (latency > avgLatency + margin) {
    // 느린 반응 속도 : 취약 -> 강등
    item.stage = Math.max(0, item.stage - 1);
  } else {
    // 복습 주기를 채웠고 속도도 양호함 -> 정석 승급
    if (!item.hasBeenPromotedThisSession) {
      item.stage = Math.min(8, item.stage + 1);
      item.isEligibleForPromotion = false; // 한 세션 내 추가 승급 방지를 위해 자격 해제
      item.hasBeenPromotedThisSession = true;
    }
  }

  return item;
}
