# 음악 제작 및 재현 기록

최신 추가곡은 아래 **0.4.1 빠른 테크노·댄스** 절에 기록했다. 기존112BPM3곡과 전신 세트는 그대로 보존했다.

`public/audio/maru-flow.ogg`는 이 MVP를 위해 새로 만든 무가사 전자음악 **Maru Flow · 마루의 산책**이다. 150.000초(2분 30초), 112 BPM, 4/4, 280박/70마디다. 인트로·기본 리듬·주 멜로디·잔잔한 중간 구간·마무리로 구성했다. 출처가 불명확한 곡이나 외부 샘플은 사용하지 않았다.

전신 스트레칭 요청을 반영해 **Maru Breeze · 숲속의 바람**, **Maru Sunset · 노을 속 쉼표**를 같은 로컬 제작 경로로 추가했다. 세 곡 모두 원곡은150초다. 손 리듬은 선택곡 전체를, 전신 세트는 각곡의0~75초를 사용해 총225초로 끝낸다.112 BPM에서75초는 정확히140박/35마디다.

## 실제 확인한 F드라이브 엔진

- `F:\0.SoulmaruAI\2.music\music-studio\설치정보.txt`: ACE-Step 1.5 Turbo, 음악 결과 위치, 로컬 API 8001 안내.
- `F:\0.SoulmaruAI\2.music\music-studio\ACE-Step-1.5`: 기존 설치 디렉터리 존재.
- `F:\0.SoulmaruAI\1.aiimage\webtoon-translator\local-api\backend\models\audio-engine.mjs`: 현재 실행 설정이 CPU 모드와 스레드 제한을 사용함을 확인. 설치 안내의 GPU 보조 설명과 코드의 실제 설정은 다르므로 성능을 단정하지 않았다.
- `F:\0.SoulmaruAI\1.aiimage\webtoon-translator\local-api\backend\python\video\webtoon.py`: 샘플 없이 오리지널 5초 멜로디를 합성하는 `signature_soundtrack` 함수를 확인.

MVP에서는 마지막 함수를 실제 호출해 인트로와 엔딩의 짧은 멜로디를 렌더링했고, 이 프로젝트의 새 합성기로 드럼·베이스·코드·멜로디를 150초로 편곡했다. 따라서 이번 곡은 **F 제작소의 경량 합성 함수 + 신규 오프라인 편곡**이며 ACE-Step 신경망으로 생성한 곡이라고 표시하지 않는다. ACE-Step 모델을 추가 다운로드하거나 가동할 필요가 없었다. 기존 F 프로젝트는 읽기만 했으며 수정하지 않았다.

## 산출물과 검증

| 항목 | 확인 값 |
|---|---|
| 파일 | `public/audio/maru-flow.ogg` |
| 메타데이터 | `public/audio/maru-flow.json` |
| 길이 | ffprobe 기준 150.000000초 |
| 형식 | Vorbis / 44,100 Hz / 2채널 |
| 크기 | 1,414,330 bytes |
| 음악 박자 | 112 BPM, 오프셋 0초 |
| 원본 PCM peak | 0.84 full scale |
| 원본 PCM RMS | 0.127514 |
| 배포 Ogg 디코드 평균/최대 음량 | -17.9 dB / -1.5 dB (FFmpeg volumedetect) |
| 원본 합성 seed | 20260927 |
| Ogg SHA-256 | `a940becf5467a95501eed896ac1b860cc90c764239ed18ed2eac5c7090d79cb3` |

추가 두 곡은 서로 다른 멜로디 패턴, 조성 이동, 난수 시드, 패드/멜로디 음량을 사용했다. 각 제작에서도 F 경량 함수의 모티프를 실제 생성하고 해당 조성으로 조정했다. 원래 Flow 배포 파일은 변경하지 않았다.

| 파일/제목 | 길이/BPM | 시드/조성 이동 | 크기 | 디코드 평균/최대 음량 |
|---|---|---|---:|---|
| `maru-breeze.ogg` / 숲속의 바람 |150.000초 /112|20260928 /+2반음|1,444,428 bytes|-17.2 /-1.7 dB|
| `maru-sunset.ogg` / 노을 속 쉼표 |150.000초 /112|20260929 /-3반음|1,372,353 bytes|-16.7 /-1.6 dB|

세 곡의 같은 이름 `.json`에 조성/멜로디 설정·곡 길이·파일 해시를 기록했다. 추가곡은 전체 디코드/메타데이터 해시 검증을 통과했다. 합계 음원 크기는4,231,111 bytes다. 음원 전환을 앱에서 다룰 때 마지막 수백ms를 살짝 줄여도 누적 세트 시간은75/150/225초 경계를 유지해야 한다.

수치와 파일 형식은 자동 확인했다. 실제 스피커/헤드폰 청취, 음색 취향, 화면과 소리의 체감 동기는 별도 검증 대기다. Ogg 인코더 버전이 바뀌면 음원 길이가 같아도 바이트 해시는 달라질 수 있다.

음악은 CC0-1.0으로 제공한다. 상용 리듬 게임의 곡·효과음·채보·스타일팩을 포함하지 않는다. 코드 라이선스는 저장소의 LICENSE를 따른다.

## 재생 연결

웹 경로는 `/audio/maru-flow.ogg`. 메타데이터의 `bpm`, `durationSeconds`, `beatOffsetSeconds`로 채보 시간을 설정한다. 오디오 재생 시각을 기준으로 판정해야 장시간 플레이에서 화면 프레임 수와 박자가 어긋나지 않는다. 플레이 중 F드라이브·Python·FFmpeg는 필요하지 않다.

## 재생성

아래 명령은 저장소 루트에서 실행한다. Python + NumPy + FFmpeg/ffprobe가 필요하다. 출력은 현재 저장소의 `public/audio`에만 만든다.

```powershell
python tools/music-compose.py --f-engine 'F:\0.SoulmaruAI\1.aiimage\webtoon-translator\local-api\backend\python\video\webtoon.py'
```

추가곡은 같은 명령에 `--track maru-breeze` 또는 `--track maru-sunset`을 붙인다. `--track`을 생략하면 기존 `maru-flow`가 대상이다. `--f-engine`을 생략하는 독립 합성에도 세 곡의 설정을 선택할 수 있다.

해당 모듈 전체를 import하지 않고 확인한 `signature_soundtrack` 함수 정의만 추출한다. 그래도 외부 Python 코드를 실행하는 경로이므로 신뢰하는 로컬 파일만 전달해야 한다. 대상 파일 SHA-256은 메타데이터에 남긴다. 중간 WAV는 임시 디렉터리에 만들고 완료 후 자동 정리한다.

F드라이브 제작소가 없는 다른 PC에서는 다음 명령으로 독립 합성 버전을 만들 수 있다. 이 경우 짧은 인트로 악기 소리가 달라지며 메타데이터가 `standalone-original-synthesis`를 기록한다.

```powershell
python tools/music-compose.py
```

독립 합성 경로도 별도 임시 출력 폴더에서 실행해 150.000초 결과와 메타데이터 모드를 확인했다. 임시 결과는 정리했고 배포 Ogg의 해시가 그대로인 것을 재확인했다. 이는 F 경로 없이 생성되는지에 대한 검증이며 별도의 다른 물리 PC 시험은 아니다.

배포 파일 재생에는 재생성이 필요 없다. 향후 ACE-Step 신경망 원곡이 필요하면 기존 엔진 준비 상태와 현재 진행 작업을 먼저 확인하고, 별도의 곡을 만든 뒤 120~180초 길이·권리·박자와 사람 청취 결과를 기록한다.

## 0.4.1 빠른 테크노·댄스 — 2026-09-27 KST

사용자가 추가음악을 빠른 테크노·댄스로 요청했다. `tools/music-dance-compose.py`로 서로 다른 조성과 훅의 두 원곡을 제작했다. 기존112BPM음원을 빠르게 재생하거나 복제한 파일이 아니다. F의 동일한 `signature_soundtrack` 함수만 AST로 추출하여 실제 호출했고, 짧은 인트로·엔딩 모티프에 조용하게 섞었다. F원본은 읽기만 했으며, **ACE-Step 신경망 사용은 없다**. 게임 실행에는 F/Python/FFmpeg가 필요 없다.

| 곡 / ID | BPM / 구조 | 실제 파일 길이 | Ogg bytes | 배포 음량 / true peak |
|---|---|---|---:|---|
| Neon Drive · 네온 질주 / maru-neon-drive |150 / A minor 테크노,96마디384박|153.600000초|2,219,066|-14.01 LUFS / -1.50 dBTP|
| Pulse Rush · 빛의 댄스 / maru-pulse-rush |156 / 밝은 댄스,96마디384박|147.692290초|2,253,505|-13.89 LUFS / -1.38 dBTP|

새 킥·오프비트 베이스·16분 하이햇·2/4박 클랩·음높이 훅·비트에 따른 패드 음량으로 구성했다. 8마디 인트로→16그루브→8빌드→16드롭→8브레이크→8빌드→24드롭→8아웃트로다. 2회 음량 정규화 후 배포 Ogg를 다시 전체 디코드해 수치를 측정했다. 두 파일 모두44,100Hz/2채널Vorbis이고 디코드 오류·클리핑은 발견되지 않았다. 약-14 LUFS는 측정값이며 사람의 음질 만족도를 보증하지 않는다.

Pulse의 의도한 박자길이는147.692307692초, 디코드PCM은6,513,231표본=147.692312925초다. Ogg컨테이너/의도한박자/PCM의 차이는1표본 이내다. Neon은6,773,760표본으로153.6초와 일치한다. 시각 계산은 곡별BPM/의도한길이를 사용하고 ended이벤트도 처리한다.

- Neon SHA-256: `e0cdf1808a0fe94744d5e7c3e9664c985e24802b46cebb4e969d9956a4fd7aca`
- Pulse SHA-256: `3ac7824c0b9a8261287b4b61f0a1ad3aab0c63d226170f78db15f93f1922eb41`
- 메타데이터: 동일이름JSON에 seed/조성/마디/F함수·생성기해시/디코드·음량/도구버전 기록. 라이선스CC0-1.0,외부샘플0,가사없음.
- 새 Ogg합계4,472,571bytes, 기존곡포함5곡합계8,703,682bytes. 중간WAV와임시분석자료는배포하지 않는다.

`src/songs.mjs`의 기본 선택은Flow112/Neon150/Pulse156 세 곡이다. `public/charts/`에 각 곡의JSON채보를 저장했고 실제오디오시계로 접근/베기판정을 한다. 곡선택→음원/길이/BPM/채보/편집기대상이함께바뀐다. 사용자파일선택취소·실패에는 현재곡이 유지된다. 기존전신3곡×75초=225초와음성31개는보존했다.

재생성(기존3곡에는출력하지 않음):

```powershell
python tools/music-dance-compose.py --track all --f-engine 'F:\0.SoulmaruAI\1.aiimage\webtoon-translator\local-api\backend\python\video\webtoon.py'
```

`--track maru-neon-drive` 또는 `--track maru-pulse-rush`로한곡만선택할수있다. F가없는PC는 `--f-engine`을생략하는독립합성경로를지원하며모티프와해시가달라진다. 새생성기만LF줄바꿈을고정해Git체크아웃에서도기록된코드해시를재검사할수있다.

검사근거는 MUSIC_REVIEW/TEST_RESULTS/MUSIC_UPDATE에 있다. 실제사람청취,스피커음색·선호,실제카메라체감박자는미검증이다. 빠른곡은 손 리듬용이며 전신스트레칭을 빠르게 따라하라고 바꾸지 않았다.
