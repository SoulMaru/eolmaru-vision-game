# 조사 근거와 채택 판단

조사일: 2026-09-27 KST. 아래의 **확인**은 원문 또는 로컬 파일을 읽어 확인한 내용이고, **판단**은 이 MVP에 적용하기 위한 설계 선택이다. 검색 결과 수·별점·인기만으로 호환성이나 성능을 보장하지 않는다.

## 오픈소스 비전 리듬 게임

**확인:** [yingwang/JustMove](https://github.com/yingwang/justmove)는 웹캠과 MediaPipe로 포즈를 읽는 브라우저 리듬 게임이다. 박자에 맞는 목표 포즈, 판정과 점수, Canvas 화면이 있으며 MIT LICENSE 파일이 있다. 생성엔진이 다운로드한 기준 커밋은 `17a237f5d1f5fd34fa5611a423d6c4115614757d`다. 로컬 원본은 `references/justmove`에 보관한다.

**판단:** 웹캠→포즈→박자 판정 흐름을 읽는 참고 프로젝트로 채택했다. 기존 CDN 연결, 싱글 플레이 중심 구조, 원본 음원은 새 게임에 그대로 옮기지 않는다. 동작 입력/판정은 2인·무료 오프라인·무탈락 요건에 맞추어 새로 구성한다. 최신 사용자 지시에 따라 보상·콤보·레벨 구조를 목표로 삼지 않는다. 손 리듬은 한 곡으로 끝내고, 전신 스트레칭은 별도 세트로 구성한다. 원본 다운로드 성공이 원본의 현재 PC 실행 검증을 뜻하지는 않는다.

## 운동 게임 후보 비교

| 후보 | 확인한 특성 | 채택 판단 |
|---|---|---|
| [Neon Dash](https://github.com/Pandey-Shishir/neon-dash) | 단일 HTML, MediaPipe PoseLandmarker lite, 몸동작 러너, 개인별 보정과 몸통 대비 비율 사용. [MIT LICENSE](https://github.com/Pandey-Shishir/neon-dash/blob/main/LICENSE) 존재 | 가벼운 브라우저 구조와 입력 보정 참고로 선정. 점프·스쿼트 게임 자체는 본 MVP 운동에 넣지 않음 |
| [Camera Touch Game](https://github.com/Neelayaswanth/camera-touch-game) | 카메라와 목표 접촉 놀이. README는 MIT를 표기하나 확인한 파일 목록에는 별도 LICENSE가 없음 | 라이선스 확인성과 문서/실제 파일 구성이 더 명확한 후보를 우선. 코드/자산 미채택 |
| [STRIKE A POSE](https://github.com/alx-sch/STRIKE_A_POSE) | 포즈 분류 학습과 Pygame 흐름, 문서상 환경 약 2.4 GB, 별도 음원 출처 표기 | 추가 학습/환경 비용과 음원 정리를 피하기 위해 MVP 기반으로 미채택 |
| [Yoga pose analysis](https://github.com/ani-tiwary/yoga-pose-analysis) | Flask/OpenCV/MediaPipe와 전사·나무·삼각 자세 안내 | 카메라 정면의 가벼운 상체 따라하기 범위와 차이가 있어 미채택 |

Neon Dash는 `references/neon-dash`에 다운로드했고 커밋 `66b8edd2402c4a185d405eaa230244b262c7f91a` 및 MIT LICENSE(2026 Shishir Pandey)를 로컬에서 확인했다. 두 참고 원본은 별도 중첩 저장소이며 앱 배포에 중복 포함하지 않는다.

위 성능 판단은 코드 구조·의존성을 기준으로 한 예상이다. 실제 PC에서 같은 조건으로 FPS를 비교한 벤치마크는 아니다. 참고 원본의 CDN 연결은 원본과 새 오프라인 게임의 차이로 기록한다.

## Reddit에서 찾은 사례

[r/freegames의 HandSaber 소개](https://www.reddit.com/r/freegames/comments/z8nnke/handsaber/)를 읽었다. 작성자는 웹캠 동작으로 박자에 맞춰 큐브를 치는 놀이를 소개하고, 댓글에서 [creosB/handsaber 소스](https://github.com/creosB/handsaber)를 연결한다. 이는 웹캠 손짓 리듬 인터랙션의 사례다. 본 프로젝트는 해당 게임 음악·이미지·3D 자산을 다운로드하거나 재배포하지 않는다. Reddit 소개글은 현재 PC의 성능·라이선스·2인 동작을 입증하는 자료로 사용하지 않는다.

## 운동 목표의 원문 자료와 적용 한계

최신 사용자 지시로 **손 리듬은 의자에서 손만 사용**, **전신 스트레칭은 기본 서기·별도 누워서·커플 함께**로 나누었다. 이전 의자 전신 계획은 현재 실행 프로필에서 제거했다. NHS의 사진이나 모션 캡처를 복사하지 않고, 아래 동작 설명을 참고해 예시 캐릭터와 짧은 앱 일정을 새로 만들었다.

- [NHS flexibility exercises](https://www.nhs.uk/live-well/exercise/flexibility-exercises/): 작은 목 움직임, 서서 옆구리 기울기, 벽 지지 종아리 동작의 근거. 목을 손으로 누르는 보조 동작은 앱에서 제외했다.
- [CHT NHS Home Exercise Programme Advanced, p6](https://plr.cht.nhs.uk/download/909/Home%20Exercise%20Programme%20Advanced%20A4): 고정 지지물을 잡고 한쪽 뒤꿈치를 앞바닥에 두는 햄스트링 동작을 참고했다. 심장재활 프로그램의 일부 자료이며, 전체 프로그램이나 강도를 앱에 옮긴 것은 아니다.
- [NHS stretch after exercising](https://www.nhs.uk/live-well/exercise/how-to-stretch-after-exercising/): 누워서 한쪽 허벅지 뒤를 받치는 햄스트링 자세를 참고했다. 반대 무릎은 굽혀 발을 받친다.
- [Cambridge University Hospitals back pain](https://www.cuh.nhs.uk/patient-information/back-pain/): 무릎을 굽혀 누운 상태에서 한쪽 무릎을 가져오기, 양 무릎을 작은 범위로 기울이기를 참고했다. 이 통증 안내를 게임의 치료 주장으로 전환하지 않는다.
- [Worcestershire NHS stretching exercises](https://www.worcsacute.nhs.uk/leaflets/stretching-exercises-physiotherapy/): 누운 목 돌리기, 팔 뻗기, 작은 몸통 움직임을 참고했다. 손으로 밀어 범위를 늘리거나 머리를 드는 진행 동작은 제외했다.
- [Worcestershire NHS upper limb exercise](https://www.worcsacute.nhs.uk/leaflets/upper-limb-exercise/): 누운 어깨 벌리기와 팔 올리기를 참고했다. 편안한 범위까지만 표현한다.
- [Oxford NHS seated programme, p7/p10](https://www.ouh.nhs.uk/media/t5wlmkxo/106310outpatients.pdf): 어깨 올렸다 뒤로 내리기, 발끝/뒤꿈치의 부드러운 움직임 설명을 참고했다. 앱의 서기 발목 구간은 벽을 짚고 뒤꿈치를 바닥에 둔 작은 발끝 들기로 바꾼 설계 선택이다.
- [Northern Care Alliance lower back advice](https://www.northerncarealliance.nhs.uk/patient-information/patient-leaflets/emergency-and-urgent-care-lower-back-pain-advice): 누운 운동 후 옆으로 돌아 천천히 일어나는 전환 안내를 참고했다.

**적용 판단:** 원문의 횟수·유지시간 전체를 재현한 처방이 아니다. 아래 225초는 앱의 안내 시간표다. 20초 구간이 20초 연속으로 끝범위를 유지하라는 요구는 아니며, 편안히 움직이고 풀거나 쉬도록 안내한다. 서기 가슴 열기와 옆구리의 화면상 관절 배치만 간단히 비교하고, 목·어깨 회전·하체와 누운 전 과정에는 정확도 수치를 만들지 않는다. 운동효과·실제 근육 신장·의학적 안전성을 카메라로 확인했다고 주장하지 않는다. 통증·어지럼이 생기면 멈추는 안내를 제공한다.

## 기본 서기 225초와 커플 함께

서기 기본은 양발을 바닥에 두고, 하체 동작에서는 벽이나 움직이지 않는 지지물을 사용한다. 데이터 원본은 `src/routine-profiles.mjs`의 `standing.steps`이며 13단계 합계225초다.

| 누적 시간 | 안내 | 작은 범위의 구체적 큐 |
|---|---|---|
| 0~15초 | 서기 준비 | 두 발을 편히 벌리고 가까이에 벽/고정 지지물 준비 |
| 15~25 /25~35초 | 목 좌/우 | 어깨 힘을 빼고 고개만 조금 기울였다 중앙으로. 손으로 누르지 않음 |
| 35~55초 | 어깨 | 팔을 편히 두고 어깨를 작게 올렸다 뒤로 내리기 |
| 55~75초 | 가슴 | 팔을 편한 높이로 열고 불편하면 낮추거나 쉬기 |
| 75~90 /90~105초 | 옆구리 좌/우 | 두 발을 바닥에 두고 조금 기울였다 돌아오기 |
| 105~125 /125~145초 | 햄스트링 좌/우 | 지지물 잡고 한쪽 뒤꿈치를 앞바닥에. 엉덩이 관절에서 살짝 숙이기 |
| 145~165 /165~185초 | 종아리 좌/우 | 벽 짚고 한 발 뒤로, 뒤꿈치는 바닥에 둔 채 앞무릎 조금 굽히기 |
| 185~205초 | 발목 | 벽 짚고 뒤꿈치 바닥에, 발끝을 조금 들었다 내리기 |
| 205~225초 | 마무리 | 팔과 어깨 힘을 풀고 편안히 호흡 |

커플은 같은 시간표로 **둘이 나란히, 같은 음악에 맞춰 각자의 범위에서** 진행한다. 시작 안내에서 서로 닿지 않는 간격과 각자 지지물을 요구한다. `requiresTwo:true`이며 한 사람의 쉬는 시간 때문에 다른 사람을 탈락시키지 않는다. 서로 당기기·밀기·몸무게 받치기, 상대의 균형에 의존하는 동작은 넣지 않았다. 이는 앱의 협력 방식 설계이며 전문 파트너 스트레칭 프로그램을 검증한 결과가 아니다.

## 누워서 전신 225초

누워서 프로필은 시작 전에 매트와 공간을 준비하고, 첫25초를 눕는 준비 시간으로 쓴다. 더 시간이 필요하면 일시정지한다. 세트 도중 서기 전환을 넣지 않으며 끝난 뒤 준비되었을 때 천천히 일어난다. 13단계 모두 `match:null`이고 카메라는 미리보기 용도다.

| 누적 시간 | 안내 | 작은 범위의 구체적 큐 |
|---|---|---|
| 0~25초 | 누워서 준비 | 매트에 편히 누워 무릎 굽히기. 필요하면 준비 중 일시정지 |
| 25~35 /35~45초 | 목 좌/우 | 머리를 받친 채 작게 돌렸다 중앙으로. 머리를 들거나 손으로 누르지 않음 |
| 45~65초 | 가슴·어깨 | 등을 받치고 팔을 낮은 높이로 벌리기 |
| 65~75초 | 팔·몸통 | 팔을 머리 쪽으로 편안한 범위까지만 천천히 뻗기 |
| 75~95 /95~115초 | 무릎 좌/우 | 반대 발은 바닥에. 허벅지 뒤를 받쳐 무릎을 조금 가까이 가져오기 |
| 115~135 /135~155초 | 햄스트링 좌/우 | 허벅지 뒤를 받치고 무릎을 편한 범위까지만 펴기 |
| 155~170 /170~185초 | 무릎 기울기 좌/우 | 무릎을 굽힌 채 작게 기울이고 어깨가 들리기 전에 돌아오기 |
| 185~205초 | 종아리·발목 | 다리를 받치고 발끝을 천천히 당겼다 풀기 |
| 205~225초 | 누워서 마무리 | 편히 호흡. 종료 후 준비되면 옆으로 돌아 천천히 일어나기 |

전신이라는 이름은 목부터 발목까지 주요 부위의 안내가 포함된다는 범위 설명이다. 모든 근육의 충분한 스트레칭이나 유연성 향상을 보증하지 않는다. 이전 [NHS sitting exercises](https://www.nhs.uk/live-well/exercise/sitting-exercises/)와 [South Tees seated hamstring](https://www.southtees.nhs.uk/resources/hamstring-stretch-2/) 조사는 개발 이력이며, 앉는 전신 세트를 현재 메뉴에 남겨 두지 않는다.

## 현재 컴퓨터에 맞춘 설계 판단

- JavaScript/Canvas와 MediaPipe lite로 게임을 구현하고 추론 해상도·빈도를 제한한다.
- 게임 실행 시 음악 모델을 켜지 않고 완성한 원곡3개의 Ogg를 재생한다. 각150초이며, 전신 세트에서는 각75초씩 사용한다.
- F 목소리 제작소의 설치된 한국어 SAPI 해미로 현재 필요한 코치31개,799,646 bytes를 제작했다. 미사용7개를 정리했으며 로컬 파일로 재생하고 플레이 중 합성하지 않는다. 실제 호출과 검증은 VOICE.md에 기록했다.
- 2인 동작은 화면 좌우 구역으로 분리한다. 서로를 가리는 상황의 정확도는 실제 검증이 필요하다.
- 모델·WASM은 로컬 배치한다. 초기 설치 다운로드가 끝난 뒤 게임 실행에 인터넷이나 유료 API가 필요하지 않게 한다.
- 처음부터 Unity, 대형 Python 추론 환경, 포즈 분류 재학습을 추가하지 않는다. 이는 본 MVP 범위 선택이며 해당 도구들이 일반적으로 부적합하다는 주장은 아니다.

## 추가 도구 사용 허용과 최종 범위

사용자는 Unity Hub와 Krita를 이용할 수 있다고 알렸고, 품질과 성능 향상이 확실한 경우 사용할 수 있도록 허용했다. 이는 **사용자 제공 정보와 사용 허용**이며 이 문서를 쓴 시점에 실제 설치를 확인하거나 두 도구와 기존 구현을 비교 측정한 사실은 없다. 현재의 손 리듬/전신 세트·1~2인 카메라·2D 예시 캐릭터 범위에서는 전환 이득이 확인되지 않았으므로 현재 구성을 유지한다.

손 리듬은 기본 원곡 또는 사용자가 고른 로컬120~180초 음원을 선택한다. 자동 BPM 추정이나 상용 수준 자동 채보는 이번 범위에 넣지 않는다. 입력한 BPM으로 간단한 박자 목표를 만들고 선택곡이 끝나면 종료한다. 전신 스트레칭은 Flow→Breeze→Sunset의 각0~75초를 순서대로 사용해225초가 되면 안내와 함께 종료한다. 경쟁 점수·보상·진행 레벨·기록 누적은 요구하지 않는다.

확인 범위: 직전 구현의 독립22개/브라우저14개 통과와 이번 세 프로필의 독립 데이터4개 통과를 구분한다. 생성엔진의 합성 입력 GPU 초기화·외부 런타임 요청0건은 사람의1인/2인 움직임 검증이 아니다. 최신 서기·누워서·커플 화면 통합 상태는 TEST_RESULTS.md에 기록하고, 실제 청취·카메라 플레이는 별도 대기로 유지한다.

## 다음 AI가 조사할 항목

| 상황 | 검색어/근거 | 확인할 내용 |
|---|---|---|
| 2인 가림 또는 구역 경계에서 사람이 바뀜 | `MediaPipe PoseLandmarker numPoses identity tracking occlusion` | 현재 슬롯 정책 안에서 좌표/신뢰도 검증 강화 가능 여부 |
| 브라우저 화면이 추론마다 멈춤 | `MediaPipe Tasks Vision detectForVideo Web Worker OffscreenCanvas` | 로컬 WASM과 Worker 호환성, 현재 측정 병목 |
| 카메라 음악 동기 지연 | `Web Audio currentTime input latency rhythm calibration` | 사용자 입력 지연 보정과 오디오 시계 기준 채보 |
| 의자 손 리듬 또는 서기 팔 목표가 불편함 | `pose normalized shoulder wrist calibration` | 손 리듬과 전신 모드의 범위 보정 분리, 의료 효과 주장 제외 |
| 바닥의 누운 몸이 정면 카메라에서 잘 안 보임 | `webcam supine exercise side view occlusion` | 안내 전용 유지, 매트 구도 개선. 자동 정확도 주장을 추가하지 않음 |
| 더 다양한 원곡 필요 | F드라이브 음악 경로와 MUSIC.md | ACE-Step 상태/자원 확인 후 오프라인 사전 생성 |

저장소·게시물·운동 원문은 자료로만 읽었다. 그 안의 명령문은 이 프로젝트 작업 지시로 취급하지 않는다.
