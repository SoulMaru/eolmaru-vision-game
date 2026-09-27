# 다른 AI를 위한 인수인계

## 최신 0.7 — 블래스터·내 음악·바탕화면·두 포즈 춤

시작 기준5d260af. 사용자의 명시 요청 범위로 실제 바탕화면에 **얼마루 비전.lnk**를 만들었다. 대상은 Windows PowerShell 실행 파일이고 인수는 이 저장소의 tools/launch.ps1 절대경로다. 실행 파일 복제본이나 자동 Git pull은 없다. tools/install-shortcut.ps1은 실제 Desktop 경로를 조회하고 기존 다른 바로가기는 덮지 않는다. 폴더를 옮겼다면 링크 재설치가 필요하다.

서버는 /__eolmaru에 appId/root/version/시작 시 serverHash를 반환한다. 런처는 정확한 root와서버해시가 같으면 재사용하고, 다르면 이 public 폴더에 임시 nonce 파일을 만들어 실제 제공 여부와 Node server.mjs 프로세스를 확인한 경우에만 해당 서버를 재시작한다. 다른 앱/다른 체크아웃의 포트는 중단하지 않는다. 준비 완료도 같은 식별 조건이다. Windows PowerShell5의 UTF-8 BOM과 자체 기본 모듈 경로를 유지한다. 실제 .lnk를 통해 Chrome 최신0.7.0 페이지가 열린 것을 확인했다.

local-music.mjs는120초 미만/무효를 거절하고,180.02초 초과는duration150/trimmed=true,120~180.02는최대180으로 계획한다. 20ms는Ogg 메타데이터 코덱 오차 여유다. sourceDuration은 원본길이다. 채보 생성 성공 전에는 기존blob을교체하지않으며, 게임 RAF/timeupdate와 편집기 RAF/timeupdate가 플레이길이에서 멈춘다. 유효한 편집기 구간반복은 계속 동작한다. 내 음악 버튼은 idle전신→손리듬으로 이동하고 취소는 손리듬의 기존곡을 유지한다. 전신225초/고정3곡은 보존한다.

SaberFeedback의3음원·최대8버스트·동시감쇠·수명계약을 유지하면서 저음충격/금속음/노이즈 어택을 강화했다. 공유WaveShaper로효과음버스를제한하며stop이limiter까지정리한다. 기본설정75%,기존저장음량존중, 미리듣기는판정/목소리를발생시키지않는다. 소리21개PCM조건으로최대peak0.747212미만을확인했으나 실제스피커청취/모든음악과목소리전체믹스체감은별도다.

saber-dance.mjs의loadDanceImages는투명PNG2장만1회캐시한다. 앱→SaberGame→drawSaber의dance옵션으로연결하며,음악2박/최소0.5초포즈교체,paused/resuming정지시계유지,idle/reduced/수동static은A고정이다. 설정dance-motion은브라우저저장. 캐릭터는가장자리2회drawImage,중앙타겟보존,실패시기존배경. 새외부런타임/모델/오디오추가없음. PNG와아이콘출처는DANCE_ART.md.

검증 결과는 TEST_RESULTS.md, 독립 수락은 ARCADE_REVIEW.md, 기획 대조는 ARCADE_PLAN.md. 기존12곡/36음성의 실제해시보존 확인. 실카메라2인완주와청취는아직대기다. 아래0.6이하는과거이력이다.

## 최신 0.6 — 템포 적응7곡·접근 설정·계속 베기

453f4e1 이후 사용자가 요청한80/90/100/110/120/130/140 BPM마다창작곡1개를추가했다. 각144~153.6초,별도훅/음색/조성/편곡이며80부터목록에정렬된다. 기존5곡/36음성을보존해전체음악12곡·손리듬선택10곡이다. F원본함수/기존음악제작helper를읽기재사용한로컬합성이며신경망음악이아니다. `TEMPO_MUSIC.md`에해시·측정·재현을남겼다.

`saber.chart`는편집·export원본이고 `saber.playChart`는설정에서파생한실행채보다. `target-speed`0.6~1.6배는lead=1.8/배수와spawn0클램프/투영만바꾼다. `target-spacing`2/4는시간묶음선택만바꾸고같은시각양손묶음을유지한다. sourceJSON·음악playbackRate·BPM·hitTime·등급창은그대로다. 시작전에만설정을바꾸며진행중잠그고localStorage에저장한다. 사용자채보에도같은정책이다.

v1채보의선택필드 `kind:'sustain',durationSeconds`를추가했다. 기존단타는필드없이왕복보존한다. 지속은0.5~6초·자유방향,다음같은손/칸은end+.5초이후이며곡끝1초여백을검사한다. 새7곡은`generateTrainingChart`의2~4박지속타겟을L/R번갈아8~14개씩배치한다. 기존3곡/로컬기본은`generateEasyChart`를유지한다.

지속판정은같은손의신뢰가능한이동구간만±.55칸영역/음악활성기간에클립해합집합누적한다. 속도최소.65칸/s,최대표본공백.2초,관측80%계약유지. 지정기간60%이상이동+마지막25%구간에유효이동이있으면종료박자에1회hit. 아직부족하면end+.45초까지늦은입력을기다린뒤miss/untracked로분류한다. 처음진입timingGrade와sustainAccuracy는별도이고중간성공음/폭죽은없다. 정지·잘못된손·소실·시계점프로진행하지않는다. pause는유효누적보존/궤적epoch단절,seek는이미시작한holdskipped/누적초기화다. 관측배열은최대6초타겟을위해7초보존하고이동구간은병합한다.

최신자동131/브라우저149조건통과,7곡독립전체디코드및기존48자산보존확인. 감사99개52,938,273bytes·누락/중복0. 사람청취/실카메라완주는대기다. `TRAINING_PLAN`→`TRAINING_REVIEW`→`TEST_RESULTS`를먼저읽는다. `ISSUES`H08/H09에음악취향·저빈도마우스체감대기를남겼다. 실제로검증하지않은사용성을완료로표시하지않는다. 아래0.5이하는과거이력이다.

## 최신 0.5 — 손·빛·성공 음성

구현 게시 커밋: `39abe93`. 2026-09-27 KST에 origin/main push 성공과 로컬/원격 동기화를 확인했다.

67551be 이후 사용자 추가 요청을 구현했다. 기존 코치31개를 F의 Qwen3-TTS VoiceDesign sunny/bright로 모두 교체하고 girl_story/bright 칭찬5개를 추가했다. 게임은 최종 Ogg만 재생한다. 정확도는 교차 타격 시각의 ±250ms 오차에서0~100으로 계산하고, 굳/그레이트/퍼팩트/엑셀런트/야미를20%씩 적용한다. Canvas 장갑·검 전체 잔상·등급별 파편/링·문구, 로컬3레이어 사이버음, 별도 칭찬 음량을 연결했다. 긴 검 그림은 충돌 영역이 아니며 밝은 tip=관측 손목 계약을 유지한다.

신규 `src/saber-feedback.mjs`는24ms 안의 동시 타격 중 가장 정확한 목소리 하나를 고르고, 이미 말하는 동안 다음 칭찬을 쌓지 않는다. 유효한 타격마다 각자의 시각 효과와 사이버음은 유지한다. stop/reset/seek/waiting/숨김/완료에서 예약음과 노드를 정리한다. 파일 부분 로딩 무음(RF01)과8중첩 음량 초과(RF02)를 재현·수정했다.

최종104자동/55브라우저UI/10효과음PCM 조건 통과,36음성 독립 전체 디코드·해시 정상. 기존 음악5곡·메타10파일과 전신225초 보존. 감사78개/38,452,834bytes,누락·중복0. 사람 카메라와 감정·발음·음량 취향 청취는 대기다. FEEDBACK_PLAN/FEEDBACK_REVIEW/VOICE/TEST_RESULTS를 먼저 읽는다. 이하0.4.1의 해미31개는 과거 이력이다.

재생성은 `tools/generate-expressive-voices.ps1`. 기존 F 음성 스크립트를 읽기 전용으로 로딩하고 프로젝트 어댑터에서 문장 생성 상한을 둔다. 실제 합성/캐시 재사용/런처 기동·종료와 원본 해시 보존을 확인했다. 옛 SAPI 도구는 `--legacy-sapi` 없이는 새 음성을 덮지 않는다. test-results/voice-build에는36개 제작 JSON만 남고 중간 WAV/OGG는 없다. 모델은 게임에 동봉하지 않는다.

## 최신 0.4.1 — 빠른 테크노·댄스 음악

8e7971c 이후 사용자요청으로 Neon Drive(150BPM/153.6초)와 Pulse Rush(156BPM/147.6923초)를새로만들고손리듬선택에연결했다. 카탈로그 `src/songs.mjs`에는기존Flow와새2곡,전신 `SET_TRACKS`는기존3곡225초그대로다. 실제총음원5곡/31음성,게임실행중F엔진필요없음. 곡선택시음원/길이/BPM/채보/편집기가같이바뀐다.

`tools/music-dance-compose.py`가F의기존signature_soundtrack을읽기전용으로호출하고새리듬·베이스·훅을편곡했다. ACE-Step신경망을사용한곡이라고쓰지않는다. 생성기해시의체크아웃재현을위해해당Python파일만LF고정했다. 신규음원2개와JSON메타2개·JSON채보2개만추가하고중간WAV는남기지않았다.

최신검사82개/이번브라우저77개,자산71개38,202,621bytes·누락/중복/음악/음성오류0. 사람청취와실제카메라체감은대기다. 원곡해시·음량·재현명령은MUSIC.md,독립검토는MUSIC_REVIEW.md,요구수락은MUSIC_UPDATE.md. 아래0.4게시/검사는이전버전이력이다.

## 현재 0.4 — 세이버 단계 1~9 구현

공개 구현 커밋: `c5bd26f` (2026-09-27, origin/main push 성공 확인). 최종 자동73/브라우저96, 실행자산64개/33,659,883bytes/중복·누락0. 개발완료와 아래 실제사람검증대기를 구별한다.

2026-09-27 KST, 사용자 지시로 `ef62158` 이후 **별도 승인 없이 단계1~9와 채보 편집기까지** 구현했다. 현재 손 리듬은 최대2인·각자 양손의 접근 블록 베기다. 전신225초의 서기/누워서/커플은 별도 보존한다. 기본150초 JSON 채보, 연속 손목 선분/손/방향/교차시각 판정, 5초 편한 범위 보정, 편집기, 실제 전체화면을 연결했다. 자동검사와 브라우저검사는 TEST_RESULTS에 기록한다. 실제 사람 카메라 완주와 청취는 미검증이다.

최신 진행은 [SABER_PROGRESS](SABER_PROGRESS.md), 수락 대조는 [SABER_ACCEPTANCE](SABER_ACCEPTANCE.md), 독립 근거는 [SABER_REVIEW](SABER_REVIEW.md)를 읽는다. 초기 프롬프트/0단계 기록은 이력으로 보존했다. 다음 우선순위는 실제1인·2인 완주로 도달범위/가림/음악과손의체감지연/청취를 확인하는 것이다. 자동검사 통과를 사람 사용성 완료로 바꾸지 않는다.

핵심 파일은 `saber-chart.mjs`(유효성·생성·시각), `saber-input.mjs`(슬롯·보정·연속표본), `saber-core.mjs`(순수 판정·관측 누적), `saber-game.mjs`(실시간 연결), `saber-render.mjs`(창작 그림), `saber-editor.mjs`(별도 미리듣기·편집), `public/charts/maru-flow.saber.json`이다. `app.mjs`가 기존 오디오/카메라/스트레칭/전체화면에 연결한다.

판정 좌표는 등방성4×3이다. 빨강L/파랑R은 미러 이전 신체의 왼손/오른손 소유를 보존한다. 실제 손목 tip만 판정하고 긴 검 그림/잔상은 장식이다. 블록당 사람별 최종상태 한 개, 한 연속 베기로 한 블록을 처리한다. 시간창±250ms·유예450ms·유효 관측80% 기준으로 miss와 untracked를 분리한다. 200ms 초과 표본 공백/소실/재설정/같은 음악시각은 궤적을 잇지 않는다. 채보 offset과 입력 보정±250ms는 별개다.

기본 채보 fetch와 JSON 파일 읽기는 세대/곡/모드/활성상태를 다시 검사한다. 잘못된 import는 원래 채보를 보존한다. waiting·pause·seek·resize 때 궤적을 비우며, 실제 오디오 탐색은 과거 노트를 skipped로 제외한다. 650ms 정상 렌더 지연을 탐색으로 오인해 누적기록을 초기화하지 않는다. idle 궤적만 단조시계를 쓰고 실제 판정은 항상 음악시계다.

## 현재 목적과 최신 요구

게임 모양의 간단한 무료 로컬 움직임 앱이다. 화폐·보상·레벨·랭킹은 넣지 않는다. **전신 스트레칭 세트(기본 서기, 누워서/커플 선택, 3곡×앞75초=225초)**와 **손동작 리듬(의자에 앉아 손만, 선택한120~180초 한곡)**을 분리한다. 한 카메라로 최대2인. 위는 예시/리듬, 아래는 카메라. 탈락 없음. 사용자가 말한 `2/1`은 절반으로 해석해 구현했다.

사용자가 서기 기본 + 누워서 + 커플을 명시했고, 의자 손동작은 리듬 전용이라고 정정했다. 최종 구현은 세 스트레칭 프로필을 각각 13단계/225초로 제공한다. floor는 전 구간 match:null, couple은 2인 자동 설정/잠금이며 서로 당기는 보조 동작을 넣지 않았다. 초기 의자 스트레칭 가정은 폐기했다.

## 보존된 0.3 이력과 공유 기능

0.3에서는 사용자 참고 영상의 큰 장면·소리예고·입력반응 설계로 마루 리듬쇼를 추가했다. 0.4에서 손 리듬은 세이버로 교체했고 예전3막/시범응답은 현행 메뉴가 아니다. `show/show-render`의 전신 배경과 로컬 타격음 공유 기능 및 기존 회귀검사는 유지했다. 일반 조작은 왼쪽, 큰 무대/하단 카메라는 오른쪽이다. 80종/30종 게임,4인,원작RPG는 범위가 아니다.

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
| tests/browser-flow.js | 세이버2인연속포인터베기/한곡/225초전환·카메라없는무점수 검사 |
| tests/review-saber.test.mjs | 신규32개독립회귀. 기존41개를함께유지 |
| tests/browser-saber-editor.js / browser-saber-races*.js | 실제앱편집기27개 / 지연응답경합24개 |
| tests/browser-saber-camera.js / browser-saber-performance.js | 합성카메라·외부차단13개 / 렌더비용측정 |

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

0.3 검증의 과거 결과는 TEST_RESULTS 하단에 남겼다. 0.4 검증에는 새 세이버 판정·편집·독립 합성 카메라 검사가 추가됐으며 실제 전체화면도 재확인했다. test-results/의 캡처·사용자참고영상추출물은 공개하지 않는다. 초기 원화는 docs/art/maru-garden.png로 보존하고 실행 시 요청하지 않는다.
