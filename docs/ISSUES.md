# 오류 및 후속 검증 검색 메모

## 실제 사용 확인 대기

| ID | 상황/재현 | 현재 동작 | 다음 검증 / 검색어 |
|---|---|---|---|
| H01 | 두 사람이 실제 카메라 양쪽에서 손을 뻗기 | 좌우 고정 슬롯·가운데6% 완충구역 | 1인/2인 완주, 한명퇴장, 교차/가림. `MediaPipe PoseLandmarker numPoses occlusion identity` |
| H02 | 카메라 가까이 앉거나 발/손이 프레임 밖 | 보이는 신뢰도 있는 상체만 비교; 목/하체 안내 유지 | 손 리듬 의자/서기 전신/누운 매트 카메라 구도. `MediaPipe pose wrist visibility standing supine partial body` |
| H03 | 박자에 맞췄는데 체감상 늦음 | 오디오 시계 기준 ±300ms 보정 제공 | 실제 카메라 지연을 관측한 뒤 기본값 조정. `rhythm game audio input latency calibration` |
| H04 | 인식마다 화면이 잠깐 끊김 | 기본12Hz, 추론85ms 초과시 최대8Hz, 640px, GPU→CPU fallback | 사람2명 실측 후 필요시 Worker 전환. `MediaPipe Tasks Vision OffscreenCanvas worker wasm module` |
| H05 | 한국어 안내/음악의 발음·음량 | F 해미 음성·별도 볼륨·음악 ducking | 사람 청취. `Windows SAPI Korean Heami pronunciation` |
| H06 | 사용자 곡의 비트가 채보와 안 맞음 | 사용자 BPM 입력, 파일 시작0초 기준 규칙적 채보 | 인트로 오프셋·변박 자동분석은 미구현. 우선 기본곡 사용. `audio beat detection onset tempo offset local` |
| H07 | 발끝/목의 움직임을 정확하게 평가하고 싶음 | 해당 동작 시간 안내, 수행/효과 점수 없음 | 다중시점·개인 보정·실제 영상 검증 없이는 정밀 기능이라고 주장하지 않음 |

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

## 세이버 전환 — 단계 0에서 확인한 후속 구현 항목

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
