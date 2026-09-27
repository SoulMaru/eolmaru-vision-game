# 0.7 무지개 춤 무대 — 이미지 제작 및 검증 이력

작성일: 2026-09-27 KST. 생성 담당: AI 시각 생성엔진. 작업 기준: `5d260af`. 두 포즈의 창작 캐릭터와 Canvas 무지개 무대를 추가한다. 채보, 판정, 4×3 좌표, 검 끝 좌표는 바꾸지 않았다.

## 최종 파일과 출처

- `public/assets/dance-a.png`: 1536×1024 PNG, 1,894,084 bytes, SHA-256 `19772bd72d97d026dcc518c34fbcdf73ee0604f48e8eaa548a6d8b2a13da32f8`.
- `public/assets/dance-b.png`: 1536×1024 PNG, 1,919,277 bytes, SHA-256 `e544f1f350fb9f6a17542e55ea950d763625917a1f00aa1492019169d144e79b`.
- 신규 `src/saber-dance.mjs`: 한 번만 실행하는 이미지 로더, 박자별 포즈 선택, 고정 무지개 무대와 두 캐릭터의 순수 Canvas 렌더링.
- `src/saber-render.mjs`: 새 모듈 import, `dance` 선택 인수, 기존 배경 다음의 새 배경 호출만 추가. 기존 판정면과 노트/검/효과 코드는 유지.
- 생성 도구: 내장 `image_gen.imagegen`, A는 신규 생성, A를 `view_image`로 읽은 뒤 B는 A를 참조한 편집. 두 호출 모두 `transparent_background:true`.
- 외부 샘플, 특정 작품/브랜드/기존 캐릭터를 사용하지 않았다. 창작한 보라색/민트색 chibi 두 캐릭터다. AI 생성 결과에 독점적 권리나 법적 독창성을 보장한다는 뜻은 아니다.
- 별도 CLI/API 키, 이미지 후처리 프로그램, Krita/Unity 설치는 사용하지 않았다. 생성 PNG 원본을 그대로 프로젝트에 복사했다. 크기 조절·반쪽 선택은 실행 중 Canvas drawImage의 표시 처리다.
- 원본 A: `C:\Users\Microsoft\.codex\generated_images\01a0e1b4-d320-77d2-b944-178cc7cfa94c\exec-c905d7e3-db9e-4c08-8ab7-5e61b8dbce08.png`.
- 원본 B: `C:\Users\Microsoft\.codex\generated_images\01a0e1b4-d320-77d2-b944-178cc7cfa94c\exec-3baab264-622d-4006-bbc8-8a724974ba0f.png`.
- 생성 도구 내부 작업 식별자: A `exec-c905d7e3-db9e-4c08-8ab7-5e61b8dbce08`, B `exec-3baab264-622d-4006-bbc8-8a724974ba0f`. 출력 폴더 `01a0e1b4-d320-77d2-b944-178cc7cfa94c`. 생성은 개발 시 도구를 사용했으며 게임 실행에는 두 로컬 PNG만 필요하다.

## A 생성 프롬프트

~~~text
Use case: stylized-concept. Asset type: transparent PNG sprite sheet, dance pose A, for an original local webcam rhythm game.
Create exactly TWO completely original charming anime/chibi young-adult dancers, full body, highly polished cel-shaded game illustration with clean dark outlines, soft luminous rim lighting and readable shapes. Never copy any existing anime, idol, mascot or game character.
Left dancer: fluffy short lavender hair, violet eyes, small star-shaped hair clip, cropped sporty purple jacket over opaque white tee, dark navy knee-length shorts, chunky violet-and-white sneakers, comfortable fingerless gloves. Right dancer: short turquoise hair with one playful upward lock, amber eyes, mint and deep-blue sporty jacket, navy tapered joggers, chunky cyan-and-white sneakers, comfortable fingerless gloves. Gender-neutral friendly designs, fully clothed, cute chibi proportions about 3.5 heads tall, cheerful expressive faces, no weapons.
Composition must be production-ready for two separately cropped sprites: broad horizontal canvas, left dancer completely contained in left 45% and right dancer completely contained in right 45%, neither crosses the central 10% strip. Both equal height and scale, facing camera, feet on the SAME baseline around 90% image height, generous 8% transparent margins top/bottom/outer sides. Stable front camera. Both feet fully visible. No ground shadows connecting subjects.
Pose A: dance step leaning slightly to their own left; left arm bends upward with gloved hand beside head and elbow pointing outward, right arm points diagonally down; one knee softly bends while feet stay near the baseline. Mirror the energy but do not mirror outfits. Smiling open eyes. Distinct clear arm silhouettes suitable for switching between just two frames.
Background is genuinely transparent alpha, with NO checkerboard, NO scene, NO stage, NO circles, NO panel, NO backdrop, NO text, NO letters, NO numbers, NO logos, NO watermark, NO decorative particles. The game supplies its own rainbow stage. Render only the two isolated original character cutouts.
~~~

## B 편집 프롬프트

참조: 위 A 원본. 참조 이미지를 먼저 시각적으로 읽고 편집을 호출했다.

~~~text
Use case: identity-preserve edit. Asset type: dance pose B for a TWO-FRAME transparent sprite animation. The supplied PNG is the edit target, not a style example.
Change ONLY the dance poses of the same two original anime/chibi dancers. Keep their identities, faces, hair silhouettes/colors, eyes, star clip, exact clothing designs/colors/accessories, gloves, sneakers, linework, cel shading, lighting, size, body proportions, subject order, camera, image dimensions, and genuinely transparent alpha background. No new character, scene, ground, text, logo, watermark, panels or particles. Each character must remain entirely in their original left or right half; leave the middle dividing strip transparent.
Pose B: switch the dance step to the opposite side. Their screen-right arm is now raised beside the head with the elbow outward, while their screen-left arm points diagonally downward. Head and shoulders lean slightly to screen-right instead of screen-left. Alternate the softly bent knee. Cheerful smile stays recognizable, eyes open. Keep the top of the heads very near the original height and feet anchored on exactly the original baseline and similar horizontal positions, so alternating images makes a smooth playful side-to-side dance rather than a camera jump. Full bodies and shoes visible. Keep equal scale and stable centers: left dancer centered at original x around 470, right dancer at x around 1120 on a 1536x1024 canvas.
Preserve transparent background and the two independently crop-able full-body cutout sprites. Make this a complementary pose, not a duplicate of the input.
~~~

## 연결 계약과 최적화

`loadDanceImages()`를 게임 생성 측에서 한 번 호출하고 반환값 `{ready,images}`를 `drawSaber(...,{dance})`에 넣는다. 기본 로더는 Promise 자체를 캐시하므로 여러 게임 객체도 같은 두 이미지를 쓴다. `createDanceImageLoader({ImageCtor,timeoutMs})`는 독립 시험용이며 기본 제한은 8초다. 로드 오류·시간초과·Image 미지원은 `{ready:false,images:[]}`로 끝나며 프레임마다 재요청하지 않는다. 두 장이 모두 준비되어야 새로운 무대를 사용하므로 실패한 이미지 한 장을 번갈아 표시하지 않는다. 렌더러는 DOM/네트워크/시계를 읽지 않고 전달된 이미지와 재생 시간만 사용한다.

`dancePoseIndex(time,bpm,{phase,reduced})`는 음악의 현재 시간에 따라 2박마다 A/B를 교체하며, 매우 높은 BPM에서도 최소 교체 주기를 0.5초로 제한한다. idle 또는 reduced만 A 고정이다. paused/resuming에서는 멈춘 `audio.currentTime`을 그대로 사용하므로 정지 직전의 A/B 포즈를 유지하고, 재개 후 음악 시간이 진행되면 그 시각의 포즈로 이어진다. seek는 이동한 음악 시각의 포즈를 사용한다. 교체 사이에 보간·확대·위치 이동을 추가하지 않았다. 무대 밝기는 재생 시각에 의존하지 않으며 전체 배경 점멸은 없다. 기존 작은 판정면 장식의 맥박 표현은 기존 코드다.

캐릭터는 이미지 좌/우 절반을 각각 1회 그려 프레임당 `drawImage`는 항상 최대 2회다. 동일 캔버스에 2인이 있어도 캐릭터를 복제하지 않는다. 1인에서는 양끝 각20% 이내, 2인에서는 각15.5% 이내를 사용하고 중앙은 비운다. 2인 캐릭터는 alpha 0.57로 더 흐리게 표시하며, 노트·검·판정면은 뒤에 그려 캐릭터보다 앞에 있다. 2인 외곽 셀 뒤로 일부 배경 캐릭터가 지나갈 수 있으나 중앙 표적이나 앞쪽 블록을 가리는 전경 요소는 아니다. 좌표와 플레이어 clipping은 그대로다.

low에서는 상단 빛살 7→4, 바닥 타원 3→0; 캐릭터는 동일한 두 장의 캐시만 사용한다. 이미지 압축은 도구 PNG 그대로 유지해 재인코딩 손실/중복 파생파일을 만들지 않았다. 총 추가 PNG 용량은 3,813,361 bytes다.

## 생성 담당의 확인 결과

- A/B를 각각 `view_image`로 육안 확인: 같은 두 인물의 머리색·의상·얼굴 스타일·배치·기준선 유지, 팔과 기울기 반대 포즈, 전신과 신발 보임. 배경 캐릭터로 식별 가능. 세부 머리 모양과 의상 주름은 생성 편집 과정에서 조금 달라진다.
- 실제 PNG를 브라우저 Canvas로 읽은 alpha 검사: A는 alpha 0 픽셀 1,060,640 / 1,572,864(약67.4%), B는 1,047,445 / 1,572,864(약66.6%). 두 장 모두 중앙32px 띠에 alpha>200인 픽셀 0. 배경은 실제 투명이며 체크무늬를 그린 이미지가 아니다.
- Node 구문 검사: `node --check src/saber-dance.mjs`, `node --check src/saber-render.mjs` 통과.
- Node 독립 검사: 포즈 경계/2Hz 상한, idle/reduced 정지, 로더 동일 결과·2회 요청 제한, 로딩 실패·시간초과·Image 미지원 fallback, 1/2인 가장자리 영역, high/low 각각 drawImage2회 상한 통과. 이 검사는 메모리에서 실행했으며 별도 테스트 파일을 소유 범위 밖에 만들지 않았다.
- 기존 `node --test tests/review-saber.test.mjs` **32/32 통과**. 이는 생성 담당의 관련 회귀 검사이며 전체 프로젝트의 최종 통합 검사 수는 별도 검토 기록을 따른다.
- 실제 localhost 8765의 독립 브라우저 합성 장면: 이미지 요청 각1회/총2회. A/B 픽셀은 서로 다름. A 구간 내부/idle/reduced에서는 배경 픽셀이 동일. 브라우저 오류 0.
- 독립 검토가 B에서 일시정지할 때 A로 튀는 초기 정책 오류를 발견했다. `tests/review-arcade.test.mjs`의 `pausing on pose B retains that music-clock pose and seeking reanchors the alternation` 재현을 기준으로 paused/resuming에서도 정지된 음악 시간을 사용하도록 수정했다. 현재 정책은 일시정지 전후의 동일 음악 시간에서 동일 포즈 유지다.
- 수정 후 해당 dance/pausing Node 검사3개 통과. 브라우저에서 112 BPM/1.1초(B 포즈)의 playing→paused→resuming을 같은 시간으로 그려 픽셀 동일, 0.1초 seek는 다른 포즈, idle은 A와 같음을 확인했다. 픽셀 비교 전 이미지 `decode()`를 기다리고 `getContext('2d',{willReadFrequently:true})`를 사용했다. 기본 context는 반복 readback 중 GPU/CPU 래스터 경로가 바뀌어 동일 입력도 반올림 차이가 생길 수 있으므로 해시 비교용 context에 이 옵션이 필요했다. 배포 렌더러의 context 설정은 변경하지 않았다.
- 1280×600 1인/2인 캔버스에서 화살표, 빨강/파랑 노트와 검, 중앙 판정면의 가독성을 시각 확인. low/reduced 390×350 2인 장면에서도 가로 스크롤 없이 유지. 모바일 주 타깃은 아니며 좁은 화면에서는 인물도 작아진다.
- 장면 캡처: `C:\Users\Microsoft\.agent-browser\tmp\screenshots\screenshot-1790501078948.png`(1인), `screenshot-1790501089492.png`(2인), `screenshot-1790501164410.png`(390px low/reduced 2인). 이 경로들은 개발 브라우저 임시 증거이며 배포 자산은 아니다.
- 600×320 합성 2인 빈 노트 장면200회 호출의 CPU 시간 평균: low 약0.12ms, high 약4.37ms. 단일 로컬 브라우저의 짧은 호출 측정이며 실제 카메라 프레임률 또는 GPU 합성 시간의 보장이 아니다.

## 한계와 다음 검수

두 그림을 교체하는 배경 연출이며 skeletal animation, 입 모양 연동, 카메라 사람과 자세 동기화가 아니다. 프레임 사이 얼굴/옷의 세부 모양은 완전한 픽셀 고정이 아니므로 정밀 캐릭터 애니메이션으로 홍보하지 않는다. 실제 사람 2인의 카메라/성능 검증은 이 그림 검사로 대신하지 않았다. 생성 담당은 배경 모듈과 이미지까지만 소유했고 앱 로더 연결·실제 곡 재생·최종 전체 검사는 종합기획/독립 검토 담당이 확인한다.

AI 검색어: two pose sprite animation, transparent PNG alpha validation, deterministic beat animation, Canvas drawImage sprite halves, cached Image timeout fallback, reduced motion rhythm background.

## 바탕화면 아이콘

public/assets/eolmaru-vision.ico는 기존 창작 public/assets/icon.svg를 브라우저 Canvas에서256×256 PNG로 렌더한 뒤 표준ICO컨테이너에 넣은 기술적 포맷 변환이다. 생성 이미지나 외부 로고를 새로 복제한 것이 아니다. Windows System.Drawing.Icon으로256×256을 읽고 실제바탕화면.lnk의IconLocation과대조했다. 두춤이미지와별도로아이콘이름을유지한다.

최종 앱은 설정의 **배경 캐릭터 춤 → 춤 멈추기**를브라우저에저장하고A로고정한다. OS reduced-motion과별도로선택가능하며둘중하나라도정지면A포즈다. 앱과SaberGame연결은부모생성엔진이완료하고실제stage의음악시계/pause/설정변경/새로고침을통합검사했다.
