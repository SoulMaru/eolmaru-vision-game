# 오류 및 후속 검증 검색 메모

## 실제 사용 확인 대기

| ID | 상황/재현 | 현재 동작 | 다음 검증 / 검색어 |
|---|---|---|---|
| H01 | 두 사람이 실제 카메라 양쪽에서 손을 뻗기 | 좌우 고정 슬롯·가운데6% 완충구역 | 1인/2인 완주, 한명퇴장, 교차/가림. `MediaPipe PoseLandmarker numPoses occlusion identity` |
| H02 | 카메라 가까이 앉거나 발/손이 프레임 밖 | 보이는 신뢰도 있는 상체만 비교; 목/하체 안내 유지 | 손 리듬 의자/서기 전신/누운 매트 카메라 구도. `MediaPipe pose wrist visibility standing supine partial body` |
| H03 | 박자에 맞췄는데 체감상 늦음 | 오디오 시계 기준 세이버 입력 ±250ms 보정, 채보offset별도 | 실제 카메라 지연을 관측한 뒤 기본값 조정. `rhythm game audio input latency calibration` |
| H04 | 인식마다 화면이 잠깐 끊김 | 기본12Hz, 추론85ms 초과시 최대8Hz, 640px, GPU→CPU fallback | 사람2명 실측 후 필요시 Worker 전환. `MediaPipe Tasks Vision OffscreenCanvas worker wasm module` |
| H05 | 한국어 안내/칭찬의 감정·발음·음색 일관성과 음악 균형 | F Qwen VoiceDesign sunny/girl_story bright, 안내/칭찬/타격음 별도 볼륨. 설계 음성은 문장 간 음색이 달라질 수 있음 | 사람 청취. `Qwen3 TTS VoiceDesign Korean expressive short utterance` |
| H06 | 사용자 곡의 비트가 채보와 안 맞음 | 사용자 BPM 연습채보, 편집기에서offset·노트시각수정/JSON입력가능 | 인트로·변박 자동분석은 미구현. 기본곡 또는수동편집사용. `audio beat detection onset tempo offset local` |
| H07 | 발끝/목의 움직임을 정확하게 평가하고 싶음 | 해당 동작 시간 안내, 수행/효과 점수 없음 | 다중시점·개인 보정·실제 영상 검증 없이는 정밀 기능이라고 주장하지 않음 |
| H08 | 80~140 BPM별 음색·박자 가독성 및 지속 동작의 편안함 | 고유7곡·정박 합성·2~4박 계속 베기, 진행 중 정지 제외 | 실제 청취 및1/2인 카메라 완주 대기. `tempo training techno beat clarity sustain movement coverage` |
| H09 | 느린 마우스 이벤트 전달에서 계속 베기 진행이 적게 나옴 | 시험 입력은 화면 프레임마다 관측하며 정지한 프레임은 누적하지 않음. 카메라는 새 추론 표본만 사용 | 실제 마우스/터치패드 저빈도 장치 체감 확인. 포인터 자동화는 RAF마다 새 위치를 보내 연속 이동을 재현. `pointer coalesced events frame cadence rhythm sustain` |

## 0.6 개발 중 확인·정리

- TR00: 기존 음악 메타데이터의 CRLF 전용 고정 해시 → JSON만LF정규화 후 Git 원본 해시와 대조. 음악·음성 바이트 비교는 그대로다.
- TR01: 지속 타겟 뒤0.5초 여백의1µs 허용 경계 → 부동소수 잡음 허용만1ns로 축소해 정확한0.5초 정책 유지.
- TR02: 성공도 무조건0.45초 기다리면 끝박자와 효과가 어긋남 → 조건을 채운 성공은 종료 시각에 확정, 미완료만 늦은 입력을 기다린다.
- 브라우저 Vorbis duration은144초 곡에서144.002902초였다. 실제 Ogg granule/전체 디코드 길이는 별도 엄격 검사하며 UI 메타 검사는20ms 코덱 여유로 분리한다.

## 수정 확인된 문제

- R01: 상체가 수직인데 옆구리 동작99점 → 몸통 기울기 오차를 별도 반영, 회귀검사.
- R02: 시작·재개 중 탭숨김/카메라종료 경합 → 단계 잠금과 세션토큰.
- R03: video.readyState<2에서 오래된 포즈 유지 → readyState 검사 전에400ms 신선도 검사.
- R04: 작은 화면에서 캐릭터가 목표와 다른 비율 → 같은 폭/높이 좌표계.
- R05: 계속하기 버튼 초점에서 방향키 무시 → 버튼에서도 방향 입력 전달, 브라우저 회귀.
- R06: 완주 후 시간/점수 잔여 → 세션 초기화 통합.
- R07: 사용자곡 로딩 중 전신모드 전환 → 로딩 중 모드잠금, 완료 후 모드 재확인.
- R08: 누운 오른쪽 무릎/햄스트링 캐릭터가 왼쪽 공간으로 이동 → 오른쪽 팔다리 좌표 반사 및 독립 기하 회귀.
- R09: 누운 안내에 0초 함께 표시 → 측정값 없는 시간·음성 안내로 수정.
- 인원 재설정 중 추론 경쟁 가능성 → setOptions 동안 추론도 중단.
- 코치 반복 재생 → 동작 구간 index 변경시에만 한 번 안내.
- 곡 전환 중복 → 즉시 transition 단계잠금 및 현재 audio.ended 확인.

고장 난 메뉴를 완료 기능으로 남기지 않는다. 미구현 자동BPM, 온라인순위, 신원고정, 의료적 전신판정, 게임중 작곡은 메뉴에서 제외했다.

## 0.3 리듬쇼 및 전체화면

- S14: 작은 역방향 오디오시계 변경에서 예약음 중복 → 커서와 동일한 역이동 조건으로 예약음 취소. 독립회귀통과.
- S15: 취소된 전체화면 요청의 늦은exit가 최신요청을 지움 → exitPromise 추적, 전환중 성공으로 보고하지 않고 버튼재시도 안내. 독립회귀통과.
- S16: 오디오 준비실패 뒤 전체화면만 늦게 켜짐 → 최신세션의 catch에서 전체화면/예약음 정리. 전체화면대기 전에 준비음악정지.
- B01: 기존 브라우저시험이 이미39초진행한세션의 만료노트를4초로되돌려검사 → 시험초기에세션을초기화. 앱의만료노트중복판정정책은유지.
- V01: 동작위치 안내문구와캐릭터다리겹침/작은창예시과소 → 안내문구위로캐릭터범위를제한,좁은세로창전신예시/설명카드상하배치.
- F01: 내장브라우저/iframe에서Fullscreen권한거절가능 → 실패상태를표시하고창에서도진행;Start-Eolmaru.cmd로Chrome/Edge에서다시열기. `Fullscreen API transient activation permissions policy iframe allowfullscreen`.
- A01: 시범소리음높이·음악밸런스의사람청취미검증. `Web Audio oscillator cue timing perceived latency`.

## 세이버 0.4 수정 및 남은 항목

- SB01~06은 새연속입력/순수판정/슬롯/독립채보/타격음/공유전신보존으로 구현했다. 상세 증거는 SABER_REVIEW 및 TEST_RESULTS. 아래0단계 표는 당시대기이력이다.
- SR01: confidence NaN/Infinity가 판정을 통과할 수 있음 → .55~1 유한수만 허용, tracker/core 독립회귀.
- SR02: 늦은기본채보 fetch가 사용자편집을 덮을 수 있음 → 채보세대/편집기/활성상태 검사.
- SR03: 비동기 JSON읽기 중 곡/모드전환 경합 → UI잠금+읽기후곡동일성/세대/모드검사.
- SR04: 모드/채보변경 뒤5초보정 task가남아시작잠금 → configure가보정취소.
- SR05: waiting으로멈춘동일음악시각의손이동을베기로처리 → 같은음악시각거절+궤적초기화.
- SR06: 650ms정상렌더지연을탐색으로오인해누적기록초기화 → 실제seeking이벤트와벽시계대비점프구분.
- SB07의8/12/20Hz합성경계와새외부차단카메라실행은검사했다. **실제1~2인사용자완주/가림/손교차/체감지연은대기**다. H01~05절차대로확인한다.
- MP01: 합성GPU실행때 MediaPipe의NORM_RECT IMAGE_DIMENSIONS경고. 초기화/추론은지속되고페이지오류0. 실영상의구도·비정사각ROI정확도는별도관찰. `MediaPipe NORM_RECT IMAGE_DIMENSIONS non square ROI warning`.
- 편집기의곡ID는builtin과local을구분하지만 임의local파일의음악해시까지검사하지 않는다. 내보낸JSON은같은음악과함께사용한다. 자동BPM/VR/3D실제메시절단/신원고정/온라인랭킹은현행메뉴에없다.

## 세이버 전환 — 단계 0 당시 확인한 후속 구현 항목 이력

2026-09-27 KST, 기준 fdbd8b4. 아래는 현행 0.3의 새 장애를 재현했다는 뜻이 아니라, 새 세이버 요구와 현행 구조의 차이다. 이번에는 코드 수정 없이 설계/검토했으며 구현은 미완료다. 진행표: [SABER_PROGRESS](SABER_PROGRESS.md), 독립 근거: [SABER_REVIEW](SABER_REVIEW.md).

| ID | 확인 근거 / 향후 재현 조건 | 필요한 처리와 검사 | 상태 / 검색어 |
|---|---|---|---|
| SB01 | GestureTracker는 양손 방향을 Set으로 합치고 hit에는 lane만 전달. 양손이 같은 방향이면 손 소유 정보가 없음 | 새 손목 표본과 hand/player/stroke/epoch. 정지·관통·틀린 손·중복 베기 검사 | 단계 1/3/4 대기. `webcam wrist swept segment hand identity` |
| SB02 | assignPlayers는 같은 구역 둘 중 한 명 선택, 이전 사람 연속성을 저장하지 않음 | 세이버 구역 충돌은 비움, 소실/재배정 시 epoch 변경. 현행 전신 정책에 섞지 않음 | 단계 6 대기. `pose slot ambiguity tracking discontinuity` |
| SB03 | 공용 offset이 판정·렌더·시범음에 함께 적용, 기존 범위 ±300ms | 채보 offset과 입력 지연 ±250ms를 별도 설정으로 분리. 새 설정 첫 기본값 0을 표시하고 기존값을 조용히 이식하지 않음. 부호/왕복 검사 | 단계 2/4/5 대기. `rhythm chart offset input latency separate clocks` |
| SB04 | RhythmAudio.setChart는 demoTime/lane을 요구함 | 새 hand/4×3 채보는 별도 어댑터. 타격음은 판정 이벤트, 정지/탐색 때 예약음 취소 | 단계 2/5/7 대기. `Web Audio chart event adapter cancel seek` |
| SB05 | expireNotes는 현재 시각으로 즉시 만료함 | 교차 시각 판정과 유한 유예 뒤 miss/untracked 구분. 창 끝 뒤 도착한 유효 표본 검사 | 단계 3 대기. `rhythm delayed sample watermark grace period` |
| SB06 | show-render의 전신 그림도 show의 ACTS/drawWorld에 의존 | 리듬만 교체, 공유 렌더 보존. 전신 225초/누운 무채점/커플 회귀 | 단계 1~9 공통. `shared renderer dependency regression` |
| SB07 | 아직 실제 웹캠의 세이버 궤적/도달 범위/2인 체감 지연을 측정한 결과 없음 | 8/12/20Hz 합성과 실제 1인/2인·가림·손 교차를 분리 기록 | 단계 4/6/9 대기. `low fps wrist interpolation false positive calibration` |

- SR07: 0.4 브랜드 문구 변경으로 실행기의 기존서버 식별 문자열이 사라짐 → 고정 application-name 메타데이터 EOLMARU VISION을 추가해 표시이름과분리. 서버가이미실행중인상태에서 tools/launch.ps1 실제실행으로 기존서버재사용과브라우저열기를확인했다. `PowerShell local server identity launch existing instance`.

## 0.5 손·성공 반응·음성

- RF01: 초기 칭찬 파일 중 일부만 로딩된 순간 시작하면 나머지 등급 무음 → preload Promise 공유 및 전체 로딩 완료 대기, 독립 회귀 통과.
- RF02: 최대 음량으로 8개 동시 타격음 합성 시 peak >1 → 공유 master의 동시 버스트 수에 따른 음량 정규화, 5등급×1/8중첩 PCM 렌더에서 모두 peak <1. 음악·칭찬까지 포함한 전체 믹스나 사람 청취를 뜻하지 않는다.
- VG01: Qwen 짧은 원고의 생성이 비정상적으로 늘어남 → 해당 소유 작업을 중단하고 프로젝트 어댑터에 문장 길이별 생성 토큰 상한·길이 검사·최대3시드 재시도 추가. F 원본 파일은 변경하지 않았다. `Qwen3 TTS short text runaway max_new_tokens`
- 검의 긴 몸체/손 그림/잔상은 장식이며 실제 충돌은 관측 손목의 밝은 검 끝이다. 손가락 쥠 인식은 추가하지 않았다.
- 이번 음성은 특정 실존 인물의 복제가 없는 가상 캐릭터 합성이다. 모든 안내의 실제 감정/발음 만족도와 카메라 1~2인 체감은 수동 검증 대기.

## 0.7 아케이드 추가 이력

- AR-R01 해결: B포즈에서일시정지하면A로튀던현상. paused/resuming도고정audio.currentTime으로같은포즈를유지한다. review-arcade 및browser-dance검사. 검색어: beat sprite pause resume audio clock.
- AR-R02 해결: Node자식WindowsPowerShell5가PS7의모듈경로를상속하면Get-FileHash/Utility로드실패. 실행기와설치기가자신의PSHOME/Modules를앞에추가한다.시스템영구환경은변경하지않는다. 검색어: PSModulePath Windows PowerShell node spawn utility module.
- H10: 새블래스터효과의실제스피커타격감과음악/칭찬균형청취대기.21PCM조건/최대피크정상은사람취향승인이아니다.설정에서타격음미리듣기/별도음량사용. 검색어: Web Audio transient sound design loudness limiter mix.
- H11: 바로가기는프로젝트의고정절대경로를열며폴더이동은자동추적하지않는다.이폴더파일업데이트는반영한다.폴더이동시기존링크를정리한뒤새폴더tools/install-shortcut.ps1로재설치. 자동Git pull/배포서버/업데이터서비스없음.
- 긴곡의앞150초자동사용과120초미만거부는현재한곡2~3분정책이다.임의구간선택/자동BPM·비트분석은미구현이며H06을따른다.
