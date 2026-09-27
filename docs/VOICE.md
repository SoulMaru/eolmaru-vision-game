# 밝은 코치와 어린이풍 성공 음성 — 0.5

2026-09-27 KST. 사용자 요청에 따라 기존 SAPI 안내31개를 모두 교체하고 성공어5개를 추가했다. **F 제작소의 이미 설치된 Qwen3-TTS VoiceDesign**을 사용했으며 추가 모델 다운로드나 유료/온라인 음성 서비스는 사용하지 않았다. 게임에서는 최종 Ogg만 재생한다.

## 실제 제작 설정

| 구분 | 안내31개 | 칭찬5개 |
|---|---|---|
| 로컬 화자 설정 | sunny, 밝고 명랑한 한국 성인 여성풍 | girl_story, 명랑한 어린이 캐릭터풍 |
| 감정 지시 | bright + 미소/따뜻한 격려/자연스러운 억양 지시 | bright + 원본 제작소의 가족용 캐릭터 지시 |
| 속도 | 0 | 2: 원본 제작소의 음높이를 유지하는 속도 조절 |
| 기본 시드 | 727 | 727 |
| 최종 크기 | 993,102 bytes | 36,510 bytes |

제작 PC의 CPU 6스레드, 로컬 float32 모델을 사용했다. 게임 실행 중에는 해당 모델이나 GPU 추론이 필요 없다. 설치된 모델 README의 라이선스 표기는 Apache-2.0이며 모델 자체를 게임에 복사하지 않았다. 실제 인물 녹음이나 음성 복제를 사용하지 않았다. VoiceDesign은 문장마다 음색이 달라질 수 있으므로 동일 화자 음색을 완전히 보장하지 않는다. **밝은 감정·발음·어린이풍 만족도와 음악 균형은 사람의 청취 확인이 남아 있다.**

- 원본 제작소: `F:/0.SoulmaruAI/1.aiimage/webtoon-translator/local-api/backend/python/voice/tts_server.py`
- 원본 SHA-256: `b265d0cbcb23ca5055f9147dfc6fc9e01c81bd69bd60618fd839c55e4419cd8e`. 작업 전후 동일하며 F 원본을 수정하지 않았다.
- 기존 환경: `C:/SoulmaruAI/얼마루/runtime/voice-env/Scripts/python.exe`
- 기존 모델: `C:/SoulmaruAI/얼마루/models/qwen3-tts/VoiceDesign`
- 프로젝트 도구: `tools/voice-expressive.mjs`, `tools/voice-local-server.py`, `tools/generate-expressive-voices.ps1`

## 생성 중 발견·해결한 문제

직접 제작소를 호출해 칭찬5개와 ready/start를 생성한 뒤, 짧은 open 원고가 비정상적으로 오래 생성되는 현상을 발견했다. 이 작업 전용 서버만 중단하고 프로젝트 어댑터에서 문장 길이에 따라 생성량을 제한했다. 종료 길이에 닿은 결과는 새 시드로 최대3회 재시도하며, 시간 초과는 다른 작업을 더 쌓지 않고 실패한다. F 원본은 읽기 전용으로 불러온다. 최초7개도 실제 생성·검증된 파일을 재사용했다.

각 그룹의 모든 파일이 완성된 뒤 배포 경로와 manifest를 갱신했다. FFmpeg로 선후 무음을 다듬고 -18 LUFS/-2 dBTP를 목표로 정규화해 24kHz 모노 Vorbis로 저장했다. 이는 인코딩 설정이며 사람 청취나 전체 게임 믹스의 음량 보장은 아니다. 중간 WAV와 검증된 중간 Ogg는 정리했고 JSON 제작 체크포인트만 test-results에 남겼다. 배포에는 구버전 음성 복사본을 두지 않는다.

## 재현

이미 설치된 음성 환경에서 저장소 루트 기준으로 실행한다. 무료 로컬 생성이며 수 분 이상 걸릴 수 있다. 게임 재생에는 이 명령이나 F드라이브가 필요 없다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/generate-expressive-voices.ps1
```

이 도구는 사용 중인 포트를 빼앗지 않고 작업용 서버를 숨김 실행한다. 기존 모델/환경이 없으면 설명하고 종료하며 자동 다운로드하지 않는다. 현재 PC 외의 설치 경로는 `-EngineRoot`, 사용 가능한 다른 포트는 `-Port`로 지정한다. 제작 성공/실패 뒤 자신이 실행한 서버만 정리한다. 완성 파일의 해시가 같으면 재합성하지 않는다. 이전 해미 도구 `tools/voice-generate.mjs`는 이력용으로 유지하되 새 음성 덮어쓰기는 명시적 `--legacy-sapi` 옵션을 요구한다.

## 재생 정책과 확인 범위

안내 ID와 운동 원고31개는 0.4.1과 동일하다. 안내는 블록마다 한 번, 시작/정지/종료 시 이전 안내를 교체한다. 안내 중에는 음악을 낮춘다. 칭찬은 손 리듬의 성공만 재생하고, 24ms 안의 동시 타격에서 가장 정확한 멘트 하나를 선택한다. 이미 말하는 동안의 다음 칭찬은 쌓지 않는다. 화면·타격음 반응은 각자 유지한다. 칭찬은 코치가 쉬는 동안만 나오며 안내·칭찬·타격음 음량이 각각 조절된다.

칭찬5개는 실제 브라우저 Web Audio 디코드·재생·중단을 확인했다. 새 전체36개는 생성 도구가 전체 디코드·길이·크기·SHA를 검사했고, 최종 독립 결과는 FEEDBACK_REVIEW.md와 TEST_RESULTS.md를 따른다. 카메라 실사용, 스피커 청취, 의료적 운동 효과는 이 검사로 확인하지 않는다.

## 제공 원고와 실제 파일 길이

각 manifest는 `public/audio/voice/manifest.json`과 `public/audio/praise/manifest.json`이다. 아래 길이는 인코딩 파일 측정값이다.

| 파일 ID | 원고 | 길이 |
|---|---|---:|
| voice/ready | 준비됐나요? 잠시 후 시작해요. | 2.626초 |
| voice/start | 시작해요. 편안하게 움직여 주세요. | 2.410초 |
| voice/open | 팔을 편안한 높이로 벌려 주세요. | 1.761초 |
| voice/left | 화면 왼쪽으로 조금만 기울여 주세요. | 4.500초 |
| voice/right | 화면 오른쪽으로 조금만 기울여 주세요. | 2.213초 |
| voice/rest | 어깨의 힘을 풀고 잠시 쉬어요. | 2.287초 |
| voice/finish | 오늘도 잘 움직였어요. 수고했어요. | 2.907초 |
| voice/pause | 잠시 쉬어 가요. | 0.959초 |
| voice/neck-left | 고개를 왼쪽으로 아주 조금 기울여 주세요. | 3.138초 |
| voice/neck-right | 고개를 오른쪽으로 아주 조금 기울여 주세요. | 2.803초 |
| voice/shoulder-roll | 어깨를 천천히 돌리며 힘을 풀어 주세요. | 3.377초 |
| voice/ankle | 발목을 천천히 펴고 당겨 주세요. | 1.833초 |
| voice/standing-prepare | 두 발을 편안히 벌리고 서 주세요. 가까이에 벽이나 안정된 지지물을 준비해 주세요. | 5.000초 |
| voice/couple-prepare | 둘이 나란히 서 주세요. 서로 닿지 않을 간격을 두고, 각자 편안한 범위로 움직여요. | 6.000초 |
| voice/floor-prepare | 매트에 편안히 누워 무릎을 굽혀 주세요. 준비가 더 필요하면 잠시 멈춰도 좋아요. | 5.400초 |
| voice/standing-hamstring-left | 지지물을 잡고 왼발을 조금 앞으로 놓아요. 뒤꿈치를 바닥에 두고 몸을 살짝 숙여 주세요. | 7.000초 |
| voice/standing-hamstring-right | 지지물을 잡고 오른발을 조금 앞으로 놓아요. 뒤꿈치를 바닥에 두고 몸을 살짝 숙여 주세요. | 5.900초 |
| voice/standing-calf-left | 벽을 짚고 왼발을 뒤로 놓아요. 뒤꿈치는 바닥에 두고 앞무릎을 조금 굽혀 주세요. | 6.200초 |
| voice/standing-calf-right | 벽을 짚고 오른발을 뒤로 놓아요. 뒤꿈치는 바닥에 두고 앞무릎을 조금 굽혀 주세요. | 6.300초 |
| voice/standing-ankle | 벽을 짚고 뒤꿈치는 바닥에 두세요. 발끝을 조금 들었다 천천히 내려 주세요. | 5.300초 |
| voice/floor-neck-left | 머리를 편안히 받친 채 고개를 왼쪽으로 조금 돌렸다 돌아와 주세요. | 4.400초 |
| voice/floor-neck-right | 머리를 편안히 받친 채 고개를 오른쪽으로 조금 돌렸다 돌아와 주세요. | 4.600초 |
| voice/floor-open | 등을 편안하게 받치고 두 팔을 낮은 높이로 벌려 주세요. | 3.713초 |
| voice/floor-reach | 누운 채 양팔을 머리 쪽으로 편안한 범위까지만 천천히 뻗어 주세요. | 4.300초 |
| voice/floor-knee-left | 왼쪽 허벅지 뒤를 받치고 무릎을 가슴 쪽으로 조금 가져왔다가 천천히 내려 주세요. | 5.600초 |
| voice/floor-knee-right | 오른쪽 허벅지 뒤를 받치고 무릎을 가슴 쪽으로 조금 가져왔다가 천천히 내려 주세요. | 5.300초 |
| voice/floor-hamstring-left | 누운 채 왼쪽 허벅지 뒤를 받치고 무릎을 편안한 범위까지 펴 주세요. | 6.700초 |
| voice/floor-hamstring-right | 누운 채 오른쪽 허벅지 뒤를 받치고 무릎을 편안한 범위까지 펴 주세요. | 4.900초 |
| voice/floor-twist-left | 두 무릎을 굽힌 채 왼쪽으로 아주 조금 기울였다 돌아와 주세요. | 4.300초 |
| voice/floor-twist-right | 두 무릎을 굽힌 채 오른쪽으로 아주 조금 기울였다 돌아와 주세요. | 5.000초 |
| voice/floor-finish | 누운 채 편안하게 호흡하며 마무리해요. 일어날 때는 옆으로 돌아 천천히 움직여 주세요. | 6.100초 |
| praise/good | 굳! | 0.213초 |
| praise/great | 그레이트! | 0.909초 |
| praise/perfect | 퍼팩트! | 0.658초 |
| praise/excellent | 엑셀런트! | 0.830초 |
| praise/yummy | 야미! | 0.516초 |

이전0.2~0.4.1은 Windows Heami/SAPI로31개를 제작했으며 해당 이력은 Git에 남는다. 최신0.5의 감정 음성 제작 근거와 혼동하지 않는다.
