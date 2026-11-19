# Project Architecture Rules (VocaQuiz)

> CountryQuiz 를 복사해 단어 퀴즈로 고친 앱이다(2026-11-19). CountryQuiz 는 CharQuiz 를 복사한 앱이라, 아래 규칙 가운데 CharQuiz 이름은 VocaQuiz 로 읽는다.

## 0. 단어 퀴즈 전용 규칙
- 단어 데이터: `data/words/{도메인}.js`(AI 초안, 검수 필요). 영어 `[단어, 뜻, 품사]`, 일본어 `[표기, 읽기(히라가나), 뜻, 품사]`. 묶는 곳은 `components/word-data.js`(LEVELS), 화면은 `components/word-view.js`.
- 도메인 = 단계(챕터) 9개: 영어 `vocaEn1`~`vocaEn4`(초등·중학·고등·수능토익), 일본어 `vocaJaN5`~`vocaJaN1`. 언어 묶음(DOMAIN_GROUPS)은 영어·일본어 둘.
  Firestore 진도 경로 `users/{uid}/progress/{domain}` 를 다른 퀴즈 앱과 같이 쓰므로 도메인 ID 는 `voca` 접두어를 지킨다.
- 단계 안 단어 순서가 charId 다. 순서를 바꾸거나 중간에 끼우면 기존 진도가 다른 단어로 옮겨 가므로, 단어를 더할 때는 파일 끝에만 붙이고 지우지 말고 고치기만 한다.
- 한 단계 안에서 단어·뜻이 겹치지 않게 한다(보기에서 답이 둘이 됨). 보기에서는 `conflictsWithAnswer` 가 쉼표로 나눈 뜻이 겹치는 단어를 거른다.
- 문제 종류(퀴즈 범위)는 `QUIZ_TYPES`: `read`(글자 보기), `listen`(소리 듣기). 보기는 늘 한국어 뜻.
- 소리는 브라우저 TTS(`components/audio-manager.js` 의 `speakWord`). 일본어는 한자 오독을 막으려 읽기(히라가나)를 읽힌다. 후리가나 표시는 `userConfig.furigana`.
- 단계 파일을 더하면 `components/word-data.js` 의 import·LEVELS, `index.html` 의 단어장 import map 목록, `components/i18n.js` 의 `summary.{도메인}`, QuizQuiz `firestore.rules` 의 `voca_hints` 도메인 목록을 함께 고친다.
- Firebase: 퀴즈 앱 공용 프로젝트 `quizquiz-quiz` 의 VocaQuiz 웹 앱. 순위 `vocaquiz_*`, 힌트 `voca_hints`, 설정 필드 `vocaquizConfig`, 게스트 ID 키 `VOCAQUIZ_GUEST_ID`. 규칙·함수는 `C:\git\QuizQuiz` 에서 배포.
- 같은 도메인의 다른 퀴즈 앱과 섞이지 않도록 localStorage 접두어는 `VOCAQUIZ_`.

## 1. CSS 스타일링 아키텍처
- **단일 중앙 집중형 CSS (`common.css`)**:
  - 애플리케이션의 주요 레이아웃, 디자인 토큰(`:root`), 모드 카드, 게임 화면(학습/기록/관전 모드), 모달 스타일은 모두 루트의 `common.css`에서 중앙 집중형으로 관리한다.
  - `view/*.html` 조각 파일 내부에 `common.css`와 충돌하는 인라인 `<style>` 재정의를 지양한다.

## 2. 이원화 버전 관리 및 캐시 버스팅 (Cache-Busting)
- **정식 시맨틱 버전 (`window.APP_VERSION`)**: 사용자 승인 시 갱신되는 정식 릴리즈 버전 태그 (예: `v1.0.5`).
- **일자 기반 캐시 버스팅 태그 (`window.CACHE_BUST`)**: 코드/스타일 수정 시 `YYYYMMDDvN` 포맷(예: `20261116v1`)으로 자동 갱신하여 `common.css`, `main.js`, `components/*.js`, `view/*.html` 원격 fetch 시 브라우저 강제 새로고침 없이도 최신 리소스가 즉시 반영되도록 유지한다.
- **ES 모듈 캐시 버스팅 (import map)**: `index.html`의 `componentModules` 목록에 있는 모듈만 `?v=CACHE_BUST`로 로드된다.
  - `components/`에 모듈을 **추가·삭제·이름 변경하면 반드시 이 목록도 함께 수정**한다. 빠뜨리면 그 모듈만 캐시 버스팅이 적용되지 않는다.

## 3. 배포 위치 및 외부 연동 설정
- **서비스 위치**: GitHub Pages 프로젝트 사이트 → `https://iseohyun.com/VocaQuiz/` (부모 사용자 사이트 `iseohyun/html`의 CNAME `iseohyun.com`을 상속). 로컬은 Live Server `http://127.0.0.1:5500/`.
- **경로·도메인을 코드에 하드코딩하지 않는다.** 배포 위치에 따라 달라지는 값은 `components/app-config.js`의 `APP_BASE_URL`(런타임 계산)을 사용한다.
- **외부 연동 상수**(Cloud Run 엔드포인트, OAuth 클라이언트 ID, FCM VAPID 키)는 `components/app-config.js` 한곳에서 관리한다.
- 서비스 경로가 바뀌면 코드 수정 없이 각 콘솔(Kakao/Naver 리다이렉트 URI, Firebase 승인 도메인, API 키 리퍼러)만 갱신하면 된다.

## 4. 로컬 저장소(localStorage) 키 규칙
- 접두어는 `CHARQUIZ_`를 사용한다. 키 이름을 바꿀 때는 **반드시 `components/storage-migration.js`에 옛 키 → 새 키 마이그레이션을 추가**한다 (사용자 데이터 유실 방지).
- 날짜 키는 `components/date-utils.js`의 `toLocalDateKey()`(로컬 날짜 기준)를 사용한다. `toISOString()`(UTC)로 날짜 키를 만들지 않는다.
- Firestore/localStorage에 진도를 저장할 때는 `toPersistedSchema()`로 영속 필드만 저장한다 (세션 전용 플래그 저장 금지).
