"""Make the original 150-second Maru Flow score, entirely offline.

Usage: python tools/music-compose.py --track maru-flow --f-engine "F:/.../webtoon.py"
Requires Python, numpy and FFmpeg. Existing F-drive source is read-only.
Only the reviewed signature_soundtrack function is executed, not its module.
Without --f-engine, an original internal phrase replaces that optional motif.
"""
from __future__ import annotations

import argparse
import ast
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import wave

import numpy as np

RATE = 44100
DURATION = 150
BPM = 112
BEAT = 60 / BPM
SEED = 20260927
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "audio"
TRACKS = {
    "maru-flow": {"title": "Maru Flow · 마루의 산책", "seed": SEED, "transpose": 0,
                  "lead": [[0, 2, 1, 3, 2, 1, 2, 0], [2, 3, 2, 1, 0, 1, 2, 1], [0, 1, 2, 3, 2, 3, 1, 0], [3, 2, 1, 2, 0, 1, 2, 3]], "padGain": .028, "leadGain": .067},
    "maru-breeze": {"title": "Maru Breeze · 숲속의 바람", "seed": 20260928, "transpose": 2,
                    "lead": [[1, 0, 2, 1, 3, 2, 0, 2], [0, 2, 3, 2, 1, 0, 1, 2], [2, 0, 1, 3, 1, 2, 3, 1], [1, 3, 0, 2, 1, 0, 2, 0]], "padGain": .034, "leadGain": .058},
    "maru-sunset": {"title": "Maru Sunset · 노을 속 쉼표", "seed": 20260929, "transpose": -3,
                    "lead": [[3, 1, 2, 0, 1, 3, 2, 1], [1, 2, 0, 1, 3, 1, 0, 2], [3, 2, 0, 2, 1, 0, 3, 2], [2, 1, 3, 0, 2, 3, 1, 0]], "padGain": .036, "leadGain": .050},
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--f-engine", type=Path)
    parser.add_argument("--track", choices=TRACKS, default="maru-flow")
    args = parser.parse_args()
    arrangement = TRACKS[args.track]
    transpose = arrangement["transpose"]
    ffmpeg = shutil.which("ffmpeg")
    ffprobe = shutil.which("ffprobe")
    if not ffmpeg or not ffprobe:
        raise SystemExit("FFmpeg and ffprobe must be available on PATH.")
    OUT.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(arrangement["seed"])
    mix = np.zeros((RATE * DURATION, 2), dtype=np.float32)

    def add(data, when, gain=1.0, pan=0.0):
        offset = int(round(when * RATE))
        if offset < 0 or offset >= len(mix):
            return
        data = np.asarray(data, dtype=np.float32)
        n = min(len(data), len(mix) - offset)
        if data.ndim == 1:
            left = np.sqrt((1 - pan) / 2)
            right = np.sqrt((1 + pan) / 2)
            mix[offset:offset+n, 0] += data[:n] * gain * left
            mix[offset:offset+n, 1] += data[:n] * gain * right
        else:
            mix[offset:offset+n] += data[:n] * gain

    def tone(midi, seconds, kind="pluck"):
        t = np.arange(int(seconds * RATE), dtype=np.float32) / RATE
        f = 440 * 2 ** ((midi - 69) / 12)
        phase = 2 * np.pi * f * t
        if kind == "pad":
            sound = (np.sin(phase) + .22 * np.sin(phase * 2) + .10 * np.sin(phase * 3))
            env = np.minimum(t / .18, 1) * np.minimum((seconds - t) / .45, 1)
        elif kind == "bass":
            sound = np.sin(phase) + .21 * np.sin(phase * 2)
            env = np.minimum(t / .008, 1) * np.exp(-t * 4) * np.minimum((seconds - t) / .025, 1)
        else:
            sound = np.sin(phase + .65 * np.exp(-t * 5) * np.sin(phase * 2))
            env = np.minimum(t / .009, 1) * np.exp(-t * 4.5) * np.minimum((seconds - t) / .03, 1)
        return sound * np.maximum(env, 0)

    def kick():
        t = np.arange(int(.28 * RATE), dtype=np.float32) / RATE
        phase = 2 * np.pi * (48 * t + 65 * .028 * (1 - np.exp(-t / .028)))
        return np.sin(phase) * np.exp(-t * 18) * np.minimum(t / .003, 1)

    def drum(seconds, decay, pitch=190):
        t = np.arange(int(seconds * RATE), dtype=np.float32) / RATE
        noise = rng.normal(0, 1, len(t)).astype(np.float32)
        high = noise - np.concatenate(([0], noise[:-1]))
        return (.35 * high + .25 * np.sin(2 * np.pi * pitch * t)) * np.exp(-t * decay) * np.minimum(t / .002, 1)

    chords = [[n + transpose for n in chord] for chord in [[48, 52, 55, 59], [45, 48, 52, 55], [41, 45, 48, 52], [43, 47, 50, 55]]]
    lead_patterns = arrangement["lead"]
    # 70 bars at 112 BPM = precisely 150 seconds. The audio clock is the beat clock.
    sections = [(0, 8, "intro"), (8, 24, "groove-a"), (24, 40, "lift-a"),
                (40, 48, "breathing-space"), (48, 64, "lift-b"), (64, 70, "outro")]
    for bar in range(70):
        when = bar * 4 * BEAT
        chord = chords[(bar // 2) % 4]
        is_break = 40 <= bar < 48
        is_lift = 24 <= bar < 40 or 48 <= bar < 64
        is_outro = bar >= 64
        for j, note in enumerate(chord):
            add(tone(note + 12, 4 * BEAT + .3, "pad"), when, arrangement["padGain"], (j - 1.5) / 3)
        for b in range(4):
            at = when + b * BEAT
            add(kick(), at, .27 if not is_break else .16)
            add(tone(chord[0] - 12 + (12 if b == 3 else 0), .42, "bass"), at, .13)
            if b % 2:
                add(drum(.17, 28), at, .09 if not is_break else .035)
            add(drum(.06, 68, 6500), at + .5 * BEAT, .032, .24)
            if is_lift:
                add(drum(.045, 85, 7600), at, .016, -.26)
        if bar >= 4 and not is_break:
            pattern = lead_patterns[(bar // 4) % 4]
            count = 8 if is_lift else 4
            for i in range(count):
                at = when + i * (4 / count) * BEAT
                note = chord[pattern[i]] + 24
                phrase = tone(note, .65)
                add(phrase, at, arrangement["leadGain"] if not is_outro else .042, -.18)
                add(phrase, at + .75 * BEAT, .018, .4)
        elif is_break:
            for i in range(2):
                add(tone(chord[i * 2] + 24, 1.6), when + i * 2 * BEAT, .06, (-1) ** i * .2)

    engine_info = {"mode": "standalone-original-synthesis", "source": None, "sha256": None}
    with tempfile.TemporaryDirectory(prefix="maru-music-") as temp_name:
        temp = Path(temp_name)
        if args.f_engine:
            source = args.f_engine.resolve()
            text = source.read_text(encoding="utf-8-sig")
            tree = ast.parse(text)
            function = next((n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "signature_soundtrack"), None)
            if function is None:
                raise SystemExit("The reviewed F-drive signature_soundtrack function was not found.")
            module = ast.fix_missing_locations(ast.Module(body=[function], type_ignores=[]))
            namespace = {"sys": sys}
            exec(compile(module, str(source), "exec"), namespace)
            stem = temp / "f-signature.wav"
            namespace["signature_soundtrack"](stem, music=True, bell=False)
            with wave.open(str(stem), "rb") as wav:
                assert wav.getnchannels() == 2 and wav.getsampwidth() == 2
                frames = wav.getnframes()
                rate = wav.getframerate()
                samples = np.frombuffer(wav.readframes(frames), dtype="<i2").reshape(-1, 2).astype(np.float32) / 32768
            pitch_ratio = 2 ** (transpose / 12)
            sample_times = np.arange(int(frames / rate * RATE / pitch_ratio)) / RATE * pitch_ratio
            original_times = np.arange(frames) / rate
            motif = np.stack([np.interp(sample_times, original_times, samples[:, c]) for c in range(2)], axis=1)
            add(motif, .1, .42)
            add(motif, 143, .30)
            engine_info = {"mode": "F-drive-signature-soundtrack-plus-original-arrangement",
                           "source": str(source), "function": "signature_soundtrack",
                           "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                           "use": "Original five-second motif, rendered with bell=False; intro and ending only."}
        else:
            for at, note in [(0, 72), (.65, 76), (1.3, 79), (2, 76), (2.7, 74), (3.4, 72)]:
                add(tone(note + transpose, 1.5), at + .1, .045)

        fade_in = np.minimum(np.arange(len(mix), dtype=np.float32) / (RATE * .02), 1)
        fade_out = np.minimum((len(mix) - np.arange(len(mix), dtype=np.float32)) / (RATE * 3), 1)
        mix *= (fade_in * fade_out)[:, None]
        mix = np.tanh(mix * 1.45)
        mix *= .84 / max(float(np.max(np.abs(mix))), 1e-6)
        pcm = np.round(mix * 32767).astype("<i2")
        wav_path = temp / "master.wav"
        with wave.open(str(wav_path), "wb") as wav:
            wav.setnchannels(2)
            wav.setsampwidth(2)
            wav.setframerate(RATE)
            wav.writeframes(pcm.tobytes())
        ogg = OUT / f"{args.track}.ogg"
        subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav_path),
                        "-c:a", "libvorbis", "-q:a", "4", "-metadata", f"title={arrangement['title']}",
                        "-metadata", "artist=Eolmaru Vision Game", str(ogg)], check=True)
        probe = json.loads(subprocess.check_output([ffprobe, "-v", "error", "-show_entries", "format=duration,size:stream=codec_name,sample_rate,channels", "-of", "json", str(ogg)], text=True))
        assert abs(float(probe["format"]["duration"]) - DURATION) < .02
        metadata = {"id": args.track, "title": arrangement["title"], "file": f"{args.track}.ogg",
                    "artist": "얼마루 비전게임", "bpm": BPM, "duration": float(probe["format"]["duration"]),
                    "durationSeconds": DURATION, "beatOffsetSeconds": 0, "beats": 280, "bars": 70,
                    "timeSignature": "4/4", "sampleRate": RATE, "channels": 2, "seed": arrangement["seed"],
                    "arrangement": {"transposeSemitones": transpose, "leadPatterns": lead_patterns},
                    "license": "CC0-1.0", "vocals": False, "externalSamples": False,
                    "engine": engine_info, "generator": "tools/music-compose.py",
                    "sections": [{"name": name, "startBar": a, "endBar": b, "startSeconds": round(a * 4 * BEAT, 6)} for a, b, name in sections],
                    "measurements": {"masterPeak": round(float(np.max(np.abs(mix))), 6),
                                     "masterRms": round(float(np.sqrt(np.mean(mix ** 2))), 6),
                                     "fileBytes": ogg.stat().st_size,
                                     "sha256": hashlib.sha256(ogg.read_bytes()).hexdigest()},
                    "review": "Duration, peak, stereo format and byte hash verified automatically; human listening still required."}
        (OUT / f"{args.track}.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({"file": str(ogg), "duration": metadata["duration"], "bpm": BPM,
                          "bytes": ogg.stat().st_size, "engine": engine_info["mode"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
