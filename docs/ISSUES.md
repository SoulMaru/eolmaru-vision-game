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
