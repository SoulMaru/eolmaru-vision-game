# F드라이브 목소리 제작소 활용 기록

사용자의 F 목소리 활용 요청으로 기본 코치9개를, 이어진 전신 스트레칭 요청으로10개를 추가해 총19개를 제공한다.2026-09-27 KST에 F 제작소의 기존 스크립트를 직접 호출해 새 원고를 합성했다. 인터넷·유료 API·GPU 없이 제작했으며, 게임에서는 완성된 로컬 음성 파일만 재생한다.

## 확인한 엔진과 선택

- `F:\0.SoulmaruAI\4.aimp3\voice-studio\사용안내.txt`는 Windows 기본 한국어 해미/영어 지라를 사용하고 인터넷과 GPU가 필요 없다고 설명한다.
- `F:\0.SoulmaruAI\1.aiimage\webtoon-translator\local-api\backend\python\speech.ps1`는 System.Speech/SAPI로 설치된 음성을 조회하고 WAV 파일을 만드는 기존 제작소 기능이다.
- 이 파일의 `-List`를 실제 실행하여 `Microsoft Heami Desktop`(ko-KR)과 `Microsoft Zira Desktop`(en-US) 설치를 확인했다.
- `voice-engine.mjs`와 `tts_server.py`에는 별도 Qwen3-TTS/VoiceDesign 기능도 있다. 이번에는 짧은 게임 안내를 위해 이미 설치된 경량 해미 엔진을 선택했다. Qwen 모델을 실행하거나 새 모델을 받지 않았다.

사용한 목소리는 **Microsoft Heami Desktop**, 속도 `1`, 합성 음량 `95`다. 실제 사람의 녹음을 넣거나 특정 인물을 복제하지 않았다. F 프로젝트와 기존 출력물은 수정하지 않았다. 호출한 F 스크립트의 SHA-256은 배포 manifest에 기록했다.

## 제공 파일

| ID | 원고 | 길이 |
|---|---|---:|
| ready | 준비됐나요? 잠시 후 시작해요. | 2.922초 |
| start | 시작해요. 편안하게 움직여 주세요. | 2.964초 |
| open | 팔을 편안한 높이로 벌려 주세요. | 2.039초 |
| up | 두 손을 천천히 위로 뻗어 주세요. | 2.091초 |
| left | 화면 왼쪽으로 조금만 기울여 주세요. | 2.295초 |
| right | 화면 오른쪽으로 조금만 기울여 주세요. | 2.389초 |
| rest | 어깨의 힘을 풀고 잠시 쉬어요. | 1.863초 |
| finish | 오늘도 잘 움직였어요. 수고했어요. | 3.100초 |
| pause | 잠시 쉬어 가요. | 1.069초 |
| prepare-body | 안정된 의자에 앉고, 두 발을 바닥에 놓아 주세요. |3.633초|
| neck-left | 고개를 왼쪽으로 아주 조금 기울여 주세요. |2.468초|
| neck-right | 고개를 오른쪽으로 아주 조금 기울여 주세요. |2.571초|
| shoulder-roll | 어깨를 천천히 돌리며 힘을 풀어 주세요. |2.440초|
| march | 의자에 앉아 무릎을 조금씩 번갈아 들어 주세요. |2.869초|
| hamstring-left | 왼쪽 다리를 앞으로 펴고, 편안한 범위에서 몸을 조금 숙여 주세요. |4.600초|
| hamstring-right | 오른쪽 다리를 앞으로 펴고, 편안한 범위에서 몸을 조금 숙여 주세요. |4.600초|
| calf-left | 왼쪽 다리를 편하게 펴고, 발끝을 몸 쪽으로 당겨 주세요. |4.100초|
| calf-right | 오른쪽 다리를 편하게 펴고, 발끝을 몸 쪽으로 당겨 주세요. |4.200초|
| ankle | 발목을 천천히 펴고 당겨 주세요. |2.128초|

파일: `public/audio/voice/{ID}.ogg`. 연결 정보: `public/audio/voice/manifest.json`의 `cues[ID]`에 웹 경로·원고·길이·크기·SHA-256을 기록했다. 전체 Ogg19개는 **360,797 bytes**, 각각 Vorbis /24,000 Hz /모노다. 기존9개는 원고·엔진설정·파일해시가 같아 재사용했고 새10개만 제작했다. WAV/요청JSON은 임시 디렉터리에서 정리하여 중복 음원을 배포하지 않는다.

원고와 새 어댑터 코드는 본 프로젝트에서 만들었다. Windows 음성 엔진·모델·설치 파일은 저장소에 재배포하지 않는다. 게임 재생에는 Windows 음성 기능이나 F드라이브가 필요 없다.

## 게임 연결 원칙

1. 음성은 사용자 시작 버튼 이후에 재생하고, 소리 차단 또는 파일 오류가 있어도 게임을 계속 사용할 수 있게 한다.
2. 같은 안내를 프레임마다 호출하지 않는다. `open/up/left/right`는 목표 블록 시작에 한 번 안내하고, 짧은 활성/휴식 반복마다 멘트를 중복 재생하지 않는다.
3. 다음 안내·일시정지·완료 때 이전 코치 소리를 정리한다. 노래와 코치 음량을 따로 조절하거나 안내 중 음악을 잠시 낮춘다.
4. 화면 왼쪽·오른쪽 원고와 실제 거울 표시 방향이 일치해야 한다.
5. 화면의 안내 문구는 음성을 꺼도 읽을 수 있게 유지한다.

## 재생성

저장소 루트에서 실행한다. Windows PowerShell, 설치된 한국어 SAPI 음성, Node.js, FFmpeg/ffprobe가 필요하다.

```powershell
node tools/voice-generate.mjs
```

기본값은 위에서 확인한 F 제작소 `speech.ps1`이다. F 경로가 없는 다른 Windows PC에서는 프로젝트의 `tools/voice-sapi.ps1` 어댑터로 설치된 한국어 음성을 사용한다. 한국어 음성이 없으면 원인을 표시하고 종료하며 온라인 음성 서비스로 자동 전환하지 않는다. 이미 제공된 Ogg를 재생하는 데는 이 준비가 필요 없다.

다른 신뢰하는 제작소 스크립트를 사용할 때는 같은 `-List`/`-RequestFile` 규격의 파일을 명시한다.

```powershell
node tools/voice-generate.mjs --engine=F:/path/to/speech.ps1
```

외부 스크립트는 코드를 실행하는 입력이므로 확인한 파일만 전달한다. manifest의 생성 경로와 스크립트 해시는 실제 사용한 엔진을 구분하며, F가 없는 fallback을 F 제작소 호출로 표시하지 않는다.

## 확인 결과와 남은 검증

- 실제 F 스크립트를 사용한 순차 합성 9개 성공. 전체 작업 약 6.1초.
- 전신10개 추가 순차 합성 성공, 기존9개는 검증 후 재사용. 추가 작업 약7.4초.
- ffprobe로19개 형식·길이 확인, 메타데이터와 실제 파일 SHA-256 19개 모두 일치.
- FFmpeg로19개 전체 디코드 및 음량 확인. 평균 -20.1~-16.8 dB, 최대 -3.6~-1.8 dB로 무음이나 디지털 최대치 도달 없음.
- 생성 도구 JavaScript 구문 검사 통과.
- 실제 사람 청취·한국어 발음 만족도·음악과 코치 음량 균형·브라우저 자동재생 동작은 게임 통합 검증에서 확인해야 한다. 파일 수치 확인만으로 청취 품질을 검증했다고 표시하지 않는다.

다음 AI의 검색어: `Windows System.Speech SpeechSynthesizer Korean Heami`, `HTMLAudioElement user activation autoplay`, `Web Audio music ducking narration`, `MediaPipe exercise cue once per phase`.
