# 다른 AI를 위한 인수인계

## 세이버 전환의 현재 단계

2026-09-27 KST, `fdbd8b4`에서 사용자 제공 SABER_PROMPTS를 적용해 **0단계 설계와 기준 검사**를 진행했다. 게임 코드는 0.3 그대로다. 손 리듬을 최대 2인·각자 양손의 접근 블록 베기로 전환하며 전신 225초는 별도 보존한다. 실행한 기존 자동 검사는 41/41, 자산 감사는 56개/33,573,975 bytes/누락·중복 0이다. 이번에는 카메라·브라우저 실기나 청취를 새로 검증하지 않았다.

최신 진행과 다음 단계 파일 범위는 [SABER_PROGRESS](SABER_PROGRESS.md), 독립 근거는 [SABER_REVIEW](SABER_REVIEW.md), 전환 위험은 [ISSUES의 SB 항목](ISSUES.md)을 읽는다. 다음은 **1단계: 원근 무대·양손 세이버·시험 입력**이다. 기존 방향 이벤트를 베기 판정으로 이름만 바꾸지 말고, show/show-render의 전신 공유 기능과 FullscreenController를 보존한다. 초기 프롬프트는 이력으로 남기고 진행 체크는 SABER_PROGRESS에서 관리한다.

## 현재 목적과 최신 요구

게임 모양의 간단한 무료 로컬 움직임 앱이다. 화폐·보상·레벨·랭킹은 넣지 않는다. **전신 스트레칭 세트(기본 서기, 누워서/커플 선택, 3곡×앞75초=225초)**와 **손동작 리듬(의자에 앉아 손만, 선택한120~180초 한곡)**을 분리한다. 한 카메라로 최대2인. 위는 예시/리듬, 아래는 카메라. 탈락 없음. 사용자가 말한 `2/1`은 절반으로 해석해 구현했다.

사용자가 서기 기본 + 누워서 + 커플을 명시했고, 의자 손동작은 리듬 전용이라고 정정했다. 최종 구현은 세 스트레칭 프로필을 각각 13단계/225초로 제공한다. floor는 전 구간 match:null, couple은 2인 자동 설정/잠금이며 서로 당기는 보조 동작을 넣지 않았다. 초기 의자 스트레칭 가정은 폐기했다.

## 최신 0.3 요구

사용자 참고 영상의 큰 장면·소리예고·입력반응 설계로 마루 리듬쇼를 추가했다. 모든 일반 조작은 왼쪽, 상단 큰 무대/하단 카메라는 오른쪽 뷰포트 안에 있다. 세 테마는 한 곡 길이의 1/3씩 자동 전환된다. 소리/동작은 오디오 시계이며 16박 중 8박 시범/8박 응답, 최소2박 간격이다. 80종/30종 게임,4인,원작RPG는 구현 범위가 아니다.

시작 버튼 동기 구간에서 audio.play → AudioContext.resume → requestFullscreen을 호출한다. 음악이 준비되면 즉시 pause/0으로 돌리고 전체화면 결과 뒤 카운트다운한다. Esc/fullscreenchange는 pauseGame, 완료/그만하기는 silent exit. 거절은 창 화면으로 계속 진행하며 실제 전체화면이라고 표시하지 않는다. 늦은 전체화면 성공/exit 경합은 세대토큰·desired·exitPromise로 처리한다. exit 중 재요청은 false와 재시도 안내를 반환한다.

## 위치와 시작

- 프로젝트: `D:\3_GosranAI\8.visiongame\eolmaru-vision-game`
- 기존 요청 시작 폴더 `D:\3_GosranAI\4.adkiller`는 수정하지 않았다.
- GitHub: https://github.com/SoulMaru/eolmaru-vision-game
- `Start-Eolmaru.cmd` 또는 `npm start`, 주소 `http://127.0.0.1:8765`
- 로컬 서버는 loopback에만 바인딩하며 public/src만 제공한다.

## 구조

| 파일 | 역할 |
|---|---|
| src/core.mjs | 신뢰도·좌우 슬롯·미러·네 방향 재무장·박자 판정·상체 유사도 |
| src/routine.mjs | 225초 세트, 3곡 목록, 프로필별 시간/휴식 조회 |
| src/routine-profiles.mjs / figures.mjs | 서기·누워서·커플 동작 데이터 / 창작 관절 예시 |
| src/show.mjs | 16박 호출/응답 채보·3막·시계 기반 효과음 예약/취소 |
| src/show-render.mjs | 새 Canvas 풍경·반응·큰 자세 예시·작은 화면 재배치 |
| src/fullscreen.mjs | 실제 Fullscreen API/해제/거절/경합 상태 |
| src/app.mjs | 카메라/MediaPipe·음악 시계·곡 전환·한국어 코치·UI·로컬 곡 선택 |
| public/index.html / style.css | 한국어 화면·설정·기본 창작 이미지 |
| tools/server.mjs / launch.ps1 | 로컬 서버와 Windows 시작 |
| tools/setup.mjs | 고정 MediaPipe 배포 파일과 로컬 모델 준비 |
| tools/music-compose.py | 기존 F 함수 + 자체 작곡, 150초3곡 재생성 |
| tools/voice-generate.mjs / voice-sapi.ps1 | F SAPI로 31코치 음성 제작, F 없는 PC는 로컬 어댑터 |
| tests/review-*.test.mjs | 검토엔진의 독립 회귀 검사 |
| tests/browser-show.js | 실제 전체화면/해제/거절, 왼쪽 조작, 무대 크기, 로컬 자산 |
| tests/browser-profiles.js | 기본 서기·손 리듬 분리, 커플 2인 잠금, 누운 세트 종료 |
| tests/browser-flow.js | 브라우저 한곡/225초전환·버튼 초점 입력·카메라 없는 무점수 검사 |

브라우저 시험은 실제 사용자 클릭으로 음성 재생을 먼저 허용해야 한다. `tests/browser-flow.js`를 페이지 콘텍스트에서 실행한다. 곡 시간을 이동해 전환 경계를 검사하며 사람이 한 곡을 실제 플레이한 증거가 아니다.

## 절대 혼동하지 않을 점

1. 신원 추적이 아니라 화면 좌우 슬롯이다. 가운데 경계 또는 가림은 입력을 중단할 수 있다.
2. 미검출·낮은 신뢰도·400ms 이상 프레임 정지 때 포즈·재무장을 비운다. 관측 없는 유사도는 null.
3. 목/다리/발목 동작은 정면2D로 깊이·접지·당김을 검증할 수 없어 시간 안내다. 팔/몸통 평균을 전신 정확도나 운동 효과로 이름 붙이지 않는다.
4. 음악의 currentTime이 기준이다. 세트 경과시간은 `segmentIndex×75 + min(currentTime,75)`이므로 파일 로딩시간은 운동시간에 넣지 않는다.
5. 시작/재개/전환 비동기 작업은 phase와 generation token으로 취소한다. 오래된 play promise가 새 세션을 멈추지 않게 한다.
6. 설정만 보관하며 원할 때 이번 결과 JSON을 내려받는다. 카메라/마이크 기록, 계정·영상 전송 없음.
7. 세 엔진은 개발 역할(생성/독립검토/기획)이며 게임 실행 때 유료 AI 세 개를 켜는 구조가 아니다.

## 남은 실제 검증

코드가 완성되었어도 실제 사용자 두 명의 움직임·낮은조도·카메라 위치·공간폭·입력 지연·음성 청취를 자동시험으로 대체할 수 없다. 구체적 수동 절차는 REVIEW 및 ISSUES에 있다. 연결된 USB 2.0 Camera 장치가 OK인 점은 확인했고, 합성 영상으로 로컬 모델 실행은 확인했다. 사용자 영상을 녹화하거나 공개하지 않았다.

## 작업 규칙

AGENTS.md와 PLAN/REVIEW/TEST_RESULTS를 먼저 읽는다. F 원본 제작소는 수정하지 않는다. 참고 저장소/설치환경의 중복과 배포 자산의 중복은 구별한다. 변경 후 필요한 회귀만 실행하고, 출처/판단/실측을 분리해 이력을 업데이트한다.

0.3 검증: 독립41개, 브라우저14+8+9개. 실제 headed Chrome에서 document.fullscreenElement=HTML, inner/outer/screen 모두1920×1080, Escape에일시정지 및계속하기재진입 확인. test-results/의 캡처·사용자참고영상추출물은 공개하지 않는다. 초기 원화는 docs/art/maru-garden.png로 옮겨 실행 시 요청하지 않는다.
