# 창작 캐릭터와 화면 기록

2026-09-27. 캐릭터 이름은 **마루**, 잎 모양 안테나와 민트색 몸체, 크림색 얼굴, 산호색 장갑의 작은 로봇 코치다. 기존 작품의 캐릭터·음악게임 스킨·로고를 사용하지 않았다.

배경과 캐릭터 그림은 내장 image_gen 도구로 생성해 `public/assets/maru-garden.png`에 처음 저장했다. 0.3에서 실행 배경을 Canvas 풍경으로 교체하면서 원화는 `docs/art/maru-garden.png`로 옮겨 보존했다. 도구 기본 출력의 사본을 프로젝트로 복사했으며 원본은 보존했다. 생성 후 이미지를 시각적으로 확인했다. 게임 속 동작 캐릭터는 동일한 색과 특징을 가진 Canvas 벡터 캐릭터이며 `src/figures.mjs`의 관절 예시를 직접 그린다. 동작 예시와 상체 판정 목표를 공유하고, 원근/회전 판단이 필요한 하체는 시간 안내로 구분한다.

## 최종 생성 프롬프트

Use case: stylized-concept. Asset type: original character and game background artwork for a Korean local webcam rhythm and gentle stretching game named Eolmaru Vision. Create one wide 1536x1024 illustration, no text or lettering. A friendly original small mint-teal round robot coach with luminous warm cream face, two expressive dark oval eyes, flexible navy fabric arms, coral gloves, cream sneakers and a tiny leaf antenna stands at the right third, raising one hand joyfully. Not based on any existing character. A dreamy midnight-blue and lavender outdoor rhythm garden with glowing circular floor tiles, soft coral and cyan trails, distant rounded hills and a crescent-like abstract disc. Premium playful editorial 3D clay illustration, beautifully soft light, restrained details and clean silhouette. Left half must be calm dark navy negative space for interface overlays. Friendly all-ages movement game mood, not a medical illustration. No logos, no watermark.

## 도구 판단

Unity Hub와 Krita는 사용자가 설치되어 있고 도움이 확실할 때 사용할 수 있다고 알렸다. 이 두 도구의 설치 상태나 성능 이득을 직접 측정하지는 않았다. 현재 간단한 로컬 2D MVP에는 이미지 한 장과 가벼운 벡터 애니메이션을 사용했다. 별도 Unity 플레이어 설치나 중복 캐릭터 프로젝트는 만들지 않았다. 후속 3D/관절 애니메이션 또는 원화 수정의 구체적 필요가 생길 때 도구별 이점을 비교한다.

서기 예시의 의자 그림을 제거했고, 커플은 두 색의 코치를 나란히 배치한다. 누운 동작은 매트 위에서 본 예시로 별도 표시하며 기울어진 몸통/머리와 좌우 다리를 그린다. 해부학적 정확성을 검증한 의료 도해는 아니다.

## 0.3 리듬쇼 창작

사용자 제공 소개영상의 대표프레임을 로컬에서 확인해 큰 캐릭터, 읽기 쉬운 입력 신호, 장면별 다른 반응을 참고했다. 원본 프레임은 test-results/video-reference에만 있으며 게임 및 Git에는 포함하지 않는다. 새 별빛택배/구름북/정원마법 배경·소품·꽃·별·구름은 src/show-render.mjs의 창작 Canvas 도형이다. 마루는 기존 디자인의 얼굴·잎 안테나·산호 장갑을 유지하며 더 큰 얼굴과 표정을 그린다. 추가 래스터 이미지 생성은 하지 않았고 기존 원화를 보존했다. 반복프레임의 파티클 배열을 누적하지 않으며 시간값으로 정해진 개수만 그린다.

## 0.4 비전 세이버 창작

`src/saber-render.mjs`에 남색·보라색 터널, 산호 빨강L/청색R 블록과 광선검, 벡터 화살표, 두 조각 반응을 직접 그렸다. 4×3 등방성 판정면을 향한 원근 투영이며 실제 3D 메시/VR 검이 아니다. 색상 외에도 L/R 글자와 방향을 표시한다. 판정은 밝은 손목 끝점이며 긴 검/잔상은 장식이다. 효과 최대16개, 표시노트48개/인, 잔상20점/손으로 제한하고 가벼운 효과와 움직임 줄이기를 지원한다. 새 이미지 파일·폰트·라이브러리 없이 기존 스트레칭 마루는 유지했다. 실제 1920×1080 화면과 390×844 레이아웃을 확인했다. 작은 세로창의 2인 판정면은 좁으므로 주 사용 대상은 PC 가로 화면이다.
