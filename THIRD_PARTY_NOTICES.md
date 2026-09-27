# Third-party and asset notices

Project source code is MIT, except third-party components which retain their own terms.

| Component | Version / provenance | License and use |
|---|---|---|
| MediaPipe Tasks Vision | npm `@mediapipe/tasks-vision` 0.10.32, pinned lockfile | Apache-2.0; bundle and SIMD/non-SIMD WASM redistributed in `public/vendor/vision`; full text in `licenses/MediaPipe-Apache-2.0.txt` |
| Pose Landmarker Lite | float16 model bundle v1, official Google distribution | Apache-2.0, confirmed in the official [model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf), page 2. Original URL and SHA-256 in `public/models/provenance.json`. Official model information: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker |
| JustMove | Ying Wang, commit `17a237f5d1f5fd34fa5611a423d6c4115614757d` | MIT, full license in `licenses/JustMove-MIT.txt`. `src/core.mjs` raised-arm checks adapt the original `POSES['arms-up'].check` with visibility and normalized-angle scoring. Other app logic is independently implemented. No upstream music is shipped. |
| Neon Dash | Shishir Pandey, commit `66b8edd2402c4a185d405eaa230244b262c7f91a` | MIT, license in `licenses/NeonDash-MIT.txt`. Downloaded for reference; body-relative calibration and lightweight architecture studied. No game assets or source copied into runtime. |
| Original background and mascot artwork | Built-in image generation; prompt in `docs/ART.md` | Newly generated project asset, no claim of exclusive rights in AI output. Reuse granted to the extent of the project's rights under this project's MIT terms. |
| Maru Flow / Breeze / Sunset | Original local synthesis using F studio motif + new arrangements | Metadata and generation provenance in `public/audio/*.json` and `docs/MUSIC.md`; no upstream game samples/songs. |
| Neon Drive / Pulse Rush and seven Maru Step tempo songs | Original local synthesis, F studio signature motif and independent arrangements | CC0-1.0 audio per metadata. Tempo songs have distinct original hooks, keys, timbres and arrangements, not resampled existing songs. No external samples, original-game assets or neural music model output. Provenance/measurements in `docs/MUSIC.md` and `docs/TEMPO_MUSIC.md`. Music and voice engines are not redistributed. |
| Korean coach and praise clips | Original scripts synthesized with the installed Qwen3-TTS-12Hz-1.7B-VoiceDesign through F studio | Model declares Apache-2.0 in its installed README; output audio only, no model/engine redistributed and no real-person cloning. Local studio `sunny`/`girl_story`, bright mood. Provenance and verification limits in `docs/VOICE.md`. Earlier Heami clips were replaced in 0.5. |
| Exercise references | NHS and NHS hospital patient guidance | Used as references for original game instructions. No reference photos or motion-capture datasets copied. The routine is not endorsed or clinically validated by those providers. Links in `docs/RESEARCH.md`. |

Reference checkouts in `references/` are local only and ignored by Git. Download URLs and exact commits are recorded in the research log. The original reference games have separate network/music dependencies and were not claimed to run fully offline on this PC.

0.3 reference video: user supplied a local promotional video for design study only. No frames, audio, characters, logos or source footage from that video are distributed. The three scene illustrations and Web Audio cue tones are original project code.
