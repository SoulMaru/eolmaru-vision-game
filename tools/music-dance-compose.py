"""Render two original fast dance scores locally, without downloaded samples.

python tools/music-dance-compose.py --track all --f-engine "F:/.../webtoon.py"
Requires existing NumPy and FFmpeg. Only signature_soundtrack is AST-extracted
from the reviewed F-drive source; the source module is never imported/modified.
Omitting --f-engine uses a new standalone motif and records that distinction.
Outputs only maru-neon-drive / maru-pulse-rush Ogg and JSON, never older tracks.
"""
from __future__ import annotations

import argparse
import ast
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import wave

import numpy as np

RATE = 44100
BARS = 96
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "audio"
SECTIONS = [(0, 8, "intro"), (8, 24, "groove"), (24, 32, "build-one"),
            (32, 48, "drop-one"), (48, 56, "short-break"),
            (56, 64, "build-two"), (64, 88, "drop-two"), (88, 96, "outro")]
TRACKS = {
    "maru-neon-drive": {
        "title": "Maru Neon Drive · 네온 질주", "bpm": 150, "seed": 20261011,
        "genre": "original melodic techno", "key": "A minor", "style": "techno",
        "chords": [[45, 48, 52], [41, 45, 48], [38, 41, 45], [40, 44, 47]],
        "hook": [0, 0, 7, 12, 10, 7, 3, 7, 0, 12, 7, 15, 12, 10, 7, 3],
    },
    "maru-pulse-rush": {
        "title": "Maru Pulse Rush · 빛의 댄스", "bpm": 156, "seed": 20261012,
        "genre": "original uplifting dance", "key": "C major / A minor", "style": "dance",
        "chords": [[48, 52, 55], [43, 47, 50], [45, 48, 52], [41, 45, 48]],
        "hook": [72, 76, 79, 76, 81, 79, 76, 74, 72, 76, 79, 84, 81, 79, 76, 72],
    },
}


def run(args):
    return subprocess.run(args, check=True, capture_output=True)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def loudness(ffmpeg, path):
    # FFmpeg prints a single machine-readable measured loudness object on stderr.
    result = run([ffmpeg, "-hide_banner", "-nostats", "-i", str(path),
                  "-af", "loudnorm=I=-14:TP=-2:LRA=9:print_format=json", "-f", "null", "-"])
    match = re.search(r'\{\s*"input_i".*?\}', result.stderr.decode("utf-8", "replace"), re.S)
    if not match:
        raise RuntimeError("FFmpeg did not return loudness measurements")
    return json.loads(match.group(0))


def f_motif(source, temporary):
    if not source:
        return None, {"mode": "standalone-original-synthesis", "source": None}
    source = source.resolve()
    content = source.read_text(encoding="utf-8-sig")
    tree = ast.parse(content)
    function = next((n for n in tree.body if isinstance(n, ast.FunctionDef)
                     and n.name == "signature_soundtrack"), None)
    if function is None:
        raise RuntimeError("Reviewed signature_soundtrack function not found")
    original_hash = sha(source)
    module = ast.fix_missing_locations(ast.Module(body=[function], type_ignores=[]))
    namespace = {"sys": sys}
    exec(compile(module, str(source), "exec"), namespace)
    path = temporary / "f-signature.wav"
    namespace["signature_soundtrack"](path, music=True, bell=False)
    with wave.open(str(path), "rb") as wav:
        if wav.getnchannels() != 2 or wav.getsampwidth() != 2:
            raise RuntimeError("Unexpected F motif format")
        rate, frames = wav.getframerate(), wav.getnframes()
        data = np.frombuffer(wav.readframes(frames), dtype="<i2").reshape(-1, 2).astype(np.float32) / 32768
    samples = np.arange(round(frames / rate * RATE)) / RATE
    source_times = np.arange(frames) / rate
    motif = np.column_stack([np.interp(samples, source_times, data[:, ch]) for ch in range(2)]).astype(np.float32)
    if sha(source) != original_hash:
        raise RuntimeError("F source changed during generation")
    return motif, {
        "mode": "F-drive-signature-soundtrack-plus-original-dance-arrangement",
        "source": str(source), "function": "signature_soundtrack", "sha256": original_hash,
        "functionSha256": hashlib.sha256(ast.get_source_segment(content, function).encode("utf-8")).hexdigest(),
        "use": "Actually rendered with music=True, bell=False. Quiet five-second intro and ending only.",
        "neuralModelUsed": False, "sourceModified": False,
    }


def compose(track_id, f_engine, ffmpeg, ffprobe):
    spec = TRACKS[track_id]
    bpm, seed = spec["bpm"], spec["seed"]
    beat = 60 / bpm
    exact_duration = BARS * 4 * beat
    frames = round(exact_duration * RATE)
    duration = frames / RATE
    rng = np.random.default_rng(seed)
    mix = np.zeros((frames, 2), dtype=np.float32)
    cache = {}

    def add(sound, at, gain=1, pan=0):
        offset = round(at * RATE)
        if offset < 0 or offset >= frames:
            return
        sound = np.asarray(sound, dtype=np.float32)
        count = min(len(sound), frames-offset)
        if sound.ndim == 2:
            mix[offset:offset+count] += sound[:count] * gain
        else:
            mix[offset:offset+count, 0] += sound[:count] * gain * math.sqrt((1-pan)/2)
            mix[offset:offset+count, 1] += sound[:count] * gain * math.sqrt((1+pan)/2)

    def oscillator(midi, seconds, kind):
        key = (midi, round(seconds, 5), kind)
        if key in cache:
            return cache[key]
        t = np.arange(round(seconds*RATE), dtype=np.float32) / RATE
        hz = 440 * 2 ** ((midi-69)/12)
        phase = 2*np.pi*hz*t
        release = np.minimum(np.maximum(seconds-t, 0)/.018, 1)
        if kind == "bass":
            sound = np.sin(phase) + .31*np.sin(phase*2) + .13*np.sin(phase*3)
            sound = np.tanh(sound*1.45)*.85
            env = np.minimum(t/.004, 1)*np.exp(-t*5.8)*release
        elif kind == "acid":
            sound = np.zeros_like(t)
            for harmonic in range(1, min(9, int(7500/hz))+1):
                sound += np.sin(phase*harmonic)/harmonic*np.exp(-t*(harmonic-1)*9)
            sound = np.tanh(sound*1.7)*.75
            env = np.minimum(t/.003, 1)*np.exp(-t*6)*release
        elif kind == "lead":
            sound = np.zeros_like(t)
            for ratio in [.9965, 1, 1.0035]:
                for harmonic in range(1, min(6, int(7000/hz))+1):
                    sound += np.sin(phase*ratio*harmonic)/(harmonic*3)*np.exp(-t*(harmonic-1)*1.2)
            env = np.minimum(t/.008, 1)*np.minimum(np.maximum(seconds-t, 0)/.065, 1)
        elif kind == "pad":
            sound = np.sin(phase)+.19*np.sin(phase*2)+.08*np.sin(phase*.998)
            env = np.minimum(t/.15, 1)*np.minimum(np.maximum(seconds-t, 0)/.27, 1)
            # Explicit beat-shaped ducking leaves the kick room, without a sidechain plug-in.
            duck = .42 + .58 * np.minimum(np.mod(t, beat)/(.36*beat), 1)
            env *= duck
        else:
            sound = np.sin(phase+.7*np.exp(-t*7)*np.sin(phase*2))
            env = np.minimum(t/.004, 1)*np.exp(-t*4.6)*release
        result = (sound*np.maximum(env, 0)).astype(np.float32)
        cache[key] = result
        return result

    def drum(seconds, kind, variant=0):
        key = (kind, variant)
        if key in cache:
            return cache[key]
        t = np.arange(round(seconds*RATE), dtype=np.float32)/RATE
        noise = rng.standard_normal(len(t)).astype(np.float32)
        # Short FIR differences give soft band-limited noise; no external drum samples.
        smooth = np.convolve(noise, np.ones(5, dtype=np.float32)/5, mode="same")
        broad = np.convolve(noise, np.ones(25, dtype=np.float32)/25, mode="same")
        if kind == "kick":
            phase = 2*np.pi*(49*t+95*.024*(1-np.exp(-t/.024)))
            body = np.sin(phase)*np.exp(-t*10.5)
            click = smooth*np.exp(-t*130)*.16
            data = (body+click)*np.minimum(t/.0015, 1)
        elif kind == "clap":
            env = sum(np.exp(-np.maximum(t-start, 0)*75)*(t>=start) for start in [0, .009, .019])
            env += .55*np.exp(-np.maximum(t-.027, 0)*17)*(t>=.027)
            data = (smooth-broad)*env*.7
        elif kind == "snare":
            data = ((smooth-broad)*.55+np.sin(2*np.pi*180*t)*.22)*np.exp(-t*23)*np.minimum(t/.0015, 1)
        elif kind == "hat":
            data = (smooth-broad)*np.exp(-t*(75 if seconds<.1 else 20))*np.minimum(t/.001, 1)
        else:
            data = (smooth-broad)*np.exp(-t*3.7)*np.minimum(t/.008, 1)
        data = data.astype(np.float32)
        data *= np.minimum(np.maximum(seconds-t, 0)/.006, 1)
        cache[key] = data
        return data

    kick = drum(.34, "kick")
    clap = drum(.25, "clap")
    snare = drum(.18, "snare")
    hats = [drum(.064, "hat", i) for i in range(4)]
    open_hat = drum(.21, "hat", 10)
    crash = drum(1.4, "crash")
    techno = spec["style"] == "techno"
    for bar in range(BARS):
        start = bar*4*beat
        intro, outro = bar < 8, bar >= 88
        build = 24 <= bar < 32 or 56 <= bar < 64
        drop = 32 <= bar < 48 or 64 <= bar < 88
        sparse_break = 48 <= bar < 56
        chord = spec["chords"][(bar//2)%4]
        root = chord[0]
        if bar in [8, 32, 64]:
            add(crash, start, .13, -.15)
        # A small harmonic opening makes the independent F motif clearly audible.
        if bar >= 4 and not outro:
            for i, note in enumerate(chord):
                add(oscillator(note+12, 4*beat+.08, "pad"), start,
                    .025 if sparse_break else .012 if techno else .018, (i-1)*.38)
        for b in range(4):
            at = start+b*beat
            audible_kick = not sparse_break or (bar>=54 and b in [0, 2])
            if audible_kick:
                add(kick, at, .67 if drop else .57 if not intro else .48)
            if b%2 and bar>=4 and not (sparse_break and bar<52):
                add(clap, at, .27 if drop else .20, .04)
            if (not intro or bar>=4) and not sparse_break:
                add(oscillator(root-12, beat*.43, "bass"), at+beat*.5, .33 if drop else .27)
                if drop and bar%4==3 and b==3:
                    add(oscillator(root, beat*.19, "bass"), at+beat*.80, .11)
            if not sparse_break:
                for step in range(4):
                    if intro and bar<4 and step not in [2]:
                        continue
                    gain = [.039, .022, .055, .025][step] * (1.0 if drop else .78)
                    add(hats[(bar+step)%4], at+step*beat/4, gain, -.24 if step%2==0 else .28)
                if bar>=8:
                    add(open_hat, at+beat*.5, .048 if drop else .031, .18)
        if build:
            relative = bar-(24 if bar<40 else 56)
            density = 2 if relative<4 else 4 if relative<7 else 8
            for i in range(density*2):
                add(snare, start+i*2*beat/density, .035+.007*relative, (-1)**i*.13)
            # A quiet filtered noise riser; band-limited to avoid sharp treble fatigue.
            rt = np.arange(round(4*beat*RATE), dtype=np.float32)/RATE
            noise = rng.standard_normal(len(rt)).astype(np.float32)
            noise = np.convolve(noise, np.ones(17,dtype=np.float32)/17, mode="same")
            gain = .02+.055*(relative/8)
            add(noise*np.minimum(rt/.08,1)*np.minimum((4*beat-rt)/.05,1),start,gain)
        if techno and (8<=bar<48 or 56<=bar<92):
            pattern = spec["hook"]
            for i in range(8 if drop else 4):
                interval = pattern[(bar%2)*8+i]
                if interval%12 == 3 and chord[1]-root == 4:
                    interval += 1  # Keep the third in tune with the current major chord.
                midi = root+12+interval
                at = start+i*(.5 if drop else 1)*beat
                signal = oscillator(midi, beat*.48, "acid")
                add(signal, at, .135 if drop else .085, -.11)
                if drop:
                    add(signal, at+beat*.75, .032, .46)
        elif not techno and (8<=bar<48 or 56<=bar<92):
            # Four-bar original hook; chord-dependent answer notes give a distinct dance song.
            for i in range(8):
                index = ((bar%2)*8+i)%16
                note = spec["hook"][index]
                if bar%8>=4:
                    note = chord[[0,1,2,1,2,1,0,2][i]]+24
                length = beat*(.72 if i in [3,7] else .43)
                signal = oscillator(note, length, "lead" if drop else "pluck")
                add(signal, start+i*.5*beat, .105 if drop else .068, -.12)
                add(signal, start+(i*.5+.75)*beat, .027 if drop else .015, .42)
        if sparse_break:
            for i,note in enumerate(chord):
                add(oscillator(note+24, 1.5*beat, "pluck"),start+i*beat,.09,(-1)**i*.32)
        if drop and bar%8==7:
            for i in range(4):
                add(snare,start+(3+i*.25)*beat,.05+i*.011,(-1)**i*.2)

    with tempfile.TemporaryDirectory(prefix="maru-dance-") as temporary_name:
        temporary = Path(temporary_name)
        motif, engine = f_motif(f_engine, temporary)
        if motif is not None:
            add(motif,.10,.70)
            add(motif,duration-6.4,.50)
        else:
            for when,note in [(0,72),(.5,76),(1,79),(1.5,81),(2,76),(2.5,72)]:
                add(oscillator(note,1,"pluck"),when+.1,.052)
                add(oscillator(note,1,"pluck"),duration-5+when,.035)
        # Remove tiny DC offsets, gently saturate, then leave ample encoding headroom.
        mix -= np.mean(mix,axis=0)
        np.tanh(mix*1.16,out=mix)
        mix *= .78/max(float(np.max(np.abs(mix))),1e-8)
        fades = np.minimum(np.arange(frames,dtype=np.float32)/(RATE*.012),1)
        fades *= np.minimum((frames-np.arange(frames,dtype=np.float32))/(RATE*2.3),1)
        mix *= fades[:,None]
        master_peak = float(np.max(np.abs(mix)))
        master_rms = float(np.sqrt(np.mean(mix**2)))
        master = temporary/"dance-master.wav"
        with wave.open(str(master),"wb") as wav:
            wav.setnchannels(2);wav.setsampwidth(2);wav.setframerate(RATE)
            wav.writeframes(np.round(mix*32767).astype("<i2").tobytes())
        before = loudness(ffmpeg,master)
        normalizer = ("loudnorm=I=-14:TP=-2:LRA=9:linear=true:"
                      f"measured_I={before['input_i']}:measured_TP={before['input_tp']}:"
                      f"measured_LRA={before['input_lra']}:measured_thresh={before['input_thresh']}:"
                      f"offset={before['target_offset']},aresample={RATE},"
                      f"atrim=end_sample={frames},asetpts=N/SR/TB")
        ogg = OUT/f"{track_id}.ogg"
        run([ffmpeg,"-hide_banner","-loglevel","error","-y","-i",str(master),
             "-af",normalizer,"-ar",str(RATE),"-ac","2","-c:a","libvorbis","-q:a","5",
             "-metadata",f"title={spec['title']}","-metadata","artist=Eolmaru Vision Game",
             "-metadata",f"BPM={bpm}","-metadata","copyright=CC0-1.0",str(ogg)])
        probe = json.loads(run([ffprobe,"-v","error","-show_entries",
              "format=duration,size:stream=codec_name,sample_rate,channels","-of","json",str(ogg)]).stdout)
        # Decode the complete distributed Ogg, not a short sample or the intermediate PCM.
        decoded_bytes = run([ffmpeg,"-v","error","-i",str(ogg),"-f","f32le","-acodec","pcm_f32le","-"]).stdout
        decoded = np.frombuffer(decoded_bytes,dtype="<f4").reshape(-1,2)
        peak = float(np.max(np.abs(decoded)))
        rms = float(np.sqrt(np.mean(decoded**2,dtype=np.float64)))
        measured = loudness(ffmpeg,ogg)
        if abs(float(probe["format"]["duration"])-exact_duration)>.02 or peak>=.99:
            raise RuntimeError("Output failed duration / clipping guard")
        stream = probe["streams"][0]
        if stream["codec_name"]!="vorbis" or stream["sample_rate"]!=str(RATE) or stream["channels"]!=2:
            raise RuntimeError("Output format guard failed")
        measurements = {
            "masterPeak":round(master_peak,6),"masterRms":round(master_rms,6),
            "decodedPeak":round(peak,6),"decodedPeakDbFS":round(20*math.log10(max(peak,1e-12)),3),
            "decodedRms":round(rms,6),"decodedRmsDbFS":round(20*math.log10(max(rms,1e-12)),3),
            "integratedLufs":float(measured["input_i"]),"truePeakDbTP":float(measured["input_tp"]),
            "loudnessRangeLU":float(measured["input_lra"]),"decodedFrames":len(decoded),
            "fullDecodePassed":True,"fileBytes":ogg.stat().st_size,"sha256":sha(ogg),
        }
        metadata = {
            "id":track_id,"title":spec["title"],"file":ogg.name,"artist":"얼마루 비전게임",
            "bpm":bpm,"duration":float(probe["format"]["duration"]),"durationSeconds":exact_duration,
            "beatOffsetSeconds":0,"beats":384,"bars":BARS,"timeSignature":"4/4",
            "sampleRate":RATE,"channels":2,"seed":seed,"genre":spec["genre"],"key":spec["key"],
            "license":"CC0-1.0","vocals":False,"externalSamples":False,
            "engine":engine,"generator":"tools/music-dance-compose.py","generatorSha256":sha(Path(__file__)),
            "arrangement":{"chordsMidi":spec["chords"],"hook":spec["hook"],
                "drums":"Quarter-note synthesized kick, beat-2/4 clap, alternating sixteenth hats, builds and short fills.",
                "bass":"New offbeat synthesized bass notes; no stretching or recycling of older Maru tracks.",
                "synthesis":"Bounded additive oscillators, seeded band-limited noise, saturation, beat-ducked pads.",
                "mastering":"Two-pass FFmpeg loudnorm, target -14 LUFS / -2 dBTP / LRA 9, Vorbis quality 5."},
            "sections":[{"name":name,"startBar":a,"endBar":b,"startSeconds":round(a*4*beat,6),
                         "endSeconds":round(b*4*beat,6)} for a,b,name in SECTIONS],
            "measurements":measurements,
            "toolVersions":{"python":sys.version.split()[0],"numpy":np.__version__,
                "ffmpeg":run([ffmpeg,"-version"]).stdout.decode().splitlines()[0]},
            "review":"Full distributed-file decode, duration, stereo, peak/RMS/LUFS and hashes measured automatically. Human listening, taste and physical speaker playback remain unverified.",
        }
        (OUT/f"{track_id}.json").write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        print(json.dumps({"id":track_id,"bpm":bpm,"duration":metadata["duration"],**measurements},ensure_ascii=False),flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--track",choices=["all",*TRACKS],default="all")
    parser.add_argument("--f-engine",type=Path)
    args = parser.parse_args()
    ffmpeg,ffprobe = shutil.which("ffmpeg"),shutil.which("ffprobe")
    if not ffmpeg or not ffprobe:
        raise SystemExit("FFmpeg and ffprobe are required on PATH")
    OUT.mkdir(parents=True,exist_ok=True)
    for track_id in TRACKS if args.track=="all" else [args.track]:
        compose(track_id,args.f_engine,ffmpeg,ffprobe)


if __name__=="__main__":
    main()
