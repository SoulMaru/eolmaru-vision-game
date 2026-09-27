"""Seven original, grid-aligned dance tracks for gradual tempo practice.

python tools/music-training-compose.py --track all --f-engine "F:/.../webtoon.py"
Uses NumPy and installed FFmpeg only. Existing songs/voices and the F source are
read-only. Intermediate WAV/Ogg files live in a temporary directory; only fully
decoded and measured final Ogg/JSON pairs are published to public/audio.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import shutil
import sys
import tempfile
import wave

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "audio"
RATE = 44100
HELPER_PATH = Path(__file__).with_name("music-dance-compose.py")
# Reuse reviewed AST-only F rendering and FFmpeg measurement helpers, not its songs.
_loader = importlib.util.spec_from_file_location("maru_dance_helpers", HELPER_PATH)
helpers = importlib.util.module_from_spec(_loader)
_previous_bytecode = sys.dont_write_bytecode
sys.dont_write_bytecode = True
try:
    _loader.loader.exec_module(helpers)
finally:
    sys.dont_write_bytecode = _previous_bytecode

TRACKS = {
    80: {"title":"Maru Amber Steps · 앰버 스텝", "bars":48, "seed":20261180,
         "key":"C minor", "genre":"warm downtempo dance", "voice":"round", "motifTranspose":3,
         "chords":[[48,51,55],[51,55,58],[46,50,53],[41,44,48]],
         "hook":[72,75,79,75,70,72,75,67,72,79,82,79,77,75,70,72],
         "mask":[1,0,1,0,1,0,1,0], "lengths":[4,8,12,4,4,12,4]},
    90: {"title":"Maru Velvet Bounce · 벨벳 바운스", "bars":56, "seed":20261190,
         "key":"D minor", "genre":"soft house dance", "voice":"mallet", "motifTranspose":5,
         "chords":[[50,53,57],[46,50,53],[48,52,55],[53,57,60]],
         "hook":[74,77,81,77,76,74,69,72,74,81,79,77,72,76,77,74],
         "mask":[1,0,1,1,0,1,1,0], "lengths":[4,12,12,4,4,16,4]},
    100:{"title":"Maru Glass Arcade · 유리빛 아케이드", "bars":64, "seed":20261200,
         "key":"G major", "genre":"glass electro dance", "voice":"glass", "motifTranspose":7,
         "chords":[[43,47,50],[40,43,47],[48,52,55],[50,54,57]],
         "hook":[67,71,74,78,76,74,71,69,67,74,79,78,74,76,71,67],
         "mask":[1,1,0,1,1,0,1,1], "lengths":[8,12,12,4,8,16,4]},
    110:{"title":"Maru Metro Spark · 메트로 스파크", "bars":68, "seed":20261210,
         "key":"E minor", "genre":"pulse electro techno", "voice":"pulse", "motifTranspose":7,
         "chords":[[52,55,59],[48,52,55],[43,47,50],[50,54,57]],
         "hook":[76,71,74,79,78,76,71,74,83,79,76,78,74,71,74,76],
         "mask":[1,0,1,1,1,1,0,1], "lengths":[4,16,16,4,8,16,4]},
    120:{"title":"Maru Prism Motion · 프리즘 모션", "bars":76, "seed":20261220,
         "key":"A minor", "genre":"bright organ house", "voice":"organ", "motifTranspose":0,
         "chords":[[45,48,52],[41,45,48],[48,52,55],[43,47,50]],
         "hook":[69,72,76,79,81,76,72,74,69,76,81,79,77,76,72,69],
         "mask":[1,1,1,0,1,0,1,1], "lengths":[8,16,16,4,8,20,4]},
    130:{"title":"Maru Aurora Circuit · 오로라 서킷", "bars":80, "seed":20261230,
         "key":"D dorian", "genre":"acid melodic techno", "voice":"acid", "motifTranspose":0,
         "chords":[[50,53,57],[43,47,50],[48,52,55],[45,48,52]],
         "hook":[62,69,65,72,69,74,71,69,62,65,69,77,74,72,69,65],
         "mask":[1,1,1,1,1,0,1,1], "lengths":[8,16,16,8,8,20,4]},
    140:{"title":"Maru Comet Sprint · 혜성 스프린트", "bars":88, "seed":20261240,
         "key":"F# minor", "genre":"wide melodic dance", "voice":"wide", "motifTranspose":-3,
         "chords":[[54,57,61],[50,54,57],[45,49,52],[52,56,59]],
         "hook":[78,81,85,83,81,78,76,73,78,85,88,85,83,81,76,78],
         "mask":[1,1,1,0,1,1,1,1], "lengths":[8,16,24,4,8,24,4]},
}
SECTION_NAMES = ["intro","groove","first-lift","short-break","build","final-lift","outro"]


def protected_snapshot():
    own = {f"maru-step-{tempo}{suffix}" for tempo in TRACKS for suffix in [".ogg",".json"]}
    return {str(p.relative_to(ROOT)):helpers.sha(p) for p in OUT.rglob("*")
            if p.is_file() and p.name not in own}


def snapshot_digest(snapshot):
    return hashlib.sha256(json.dumps(snapshot,sort_keys=True,separators=(",",":")).encode()).hexdigest()


def compose(bpm,f_engine,ffmpeg,ffprobe,protected):
    spec = TRACKS[bpm]
    track_id = f"maru-step-{bpm}"
    beat = 60/bpm
    duration_exact = spec["bars"]*4*beat
    frames = round(duration_exact*RATE)
    duration = frames/RATE
    mix = np.zeros((frames,2),dtype=np.float32)
    rng = np.random.default_rng(spec["seed"])
    cache = {}
    sections = []
    cursor = 0
    for name,length in zip(SECTION_NAMES,spec["lengths"]):
        sections.append({"name":name,"startBar":cursor,"endBar":cursor+length,
                         "startSeconds":round(cursor*4*beat,9),"endSeconds":round((cursor+length)*4*beat,9)})
        cursor += length
    assert cursor == spec["bars"]

    def add(data,when,gain=1,pan=0):
        offset = round(when*RATE)
        if offset<0 or offset>=frames:
            return
        data = np.asarray(data,dtype=np.float32)
        count = min(len(data),frames-offset)
        if data.ndim==2:
            mix[offset:offset+count] += data[:count]*gain
        else:
            mix[offset:offset+count,0] += data[:count]*gain*math.sqrt((1-pan)/2)
            mix[offset:offset+count,1] += data[:count]*gain*math.sqrt((1+pan)/2)

    def tone(note,seconds,voice):
        key = (note,round(seconds,5),voice)
        if key in cache:
            return cache[key]
        t = np.arange(round(seconds*RATE),dtype=np.float32)/RATE
        hz = 440*2**((note-69)/12)
        phase = 2*np.pi*hz*t
        tail = np.minimum(np.maximum(seconds-t,0)/.025,1)
        if voice=="bass":
            wave_data = np.sin(phase)+.26*np.sin(phase*2)+.11*np.sin(phase*3)
            envelope = np.minimum(t/.004,1)*np.exp(-t*(4.5+bpm/80))*tail
            wave_data = np.tanh(wave_data*1.4)*.84
        elif voice=="pad":
            wave_data = np.sin(phase)+.17*np.sin(phase*2)+.055*np.sin(phase*.996)
            envelope = np.minimum(t/.13,1)*np.minimum(np.maximum(seconds-t,0)/.24,1)
            envelope *= .36+.64*np.minimum(np.mod(t,beat)/(beat*.36),1)
        elif voice=="round":
            wave_data = np.sin(phase+.25*np.exp(-t*3)*np.sin(phase*2))+.08*np.sin(phase*3)
            envelope = np.minimum(t/.007,1)*np.exp(-t*3.7)*tail
        elif voice=="mallet":
            wave_data = np.sin(phase)+.31*np.sin(phase*2)*np.exp(-t*9)+.09*np.sin(phase*3)*np.exp(-t*18)
            envelope = np.minimum(t/.003,1)*np.exp(-t*5.2)*tail
        elif voice=="glass":
            wave_data = np.sin(phase+.72*np.exp(-t*10)*np.sin(phase*2))+.12*np.sin(phase*4)*np.exp(-t*15)
            envelope = np.minimum(t/.004,1)*np.exp(-t*5.6)*tail
        elif voice=="organ":
            wave_data = np.sin(phase)+.32*np.sin(phase*2)+.16*np.sin(phase*4)
            envelope = np.minimum(t/.009,1)*(.80+.20*np.exp(-t*9))*np.minimum(np.maximum(seconds-t,0)/.065,1)
        elif voice=="pulse":
            wave_data = np.sin(phase)+.24*np.sin(phase*3)*np.exp(-t*3)+.11*np.sin(phase*5)*np.exp(-t*7)
            envelope = np.minimum(t/.005,1)*np.exp(-t*2.8)*tail
        else:
            wave_data = np.zeros_like(t)
            ratios = [.997,1,1.003] if voice=="wide" else [1]
            for ratio in ratios:
                for harmonic in range(1,min(7,int(6900/hz))+1):
                    decay = np.exp(-t*(harmonic-1)*(9 if voice=="acid" else 1.8))
                    wave_data += np.sin(phase*ratio*harmonic)*decay/(harmonic*len(ratios))
            if voice=="acid":
                wave_data = np.tanh(wave_data*1.5)*.76
            envelope = np.minimum(t/.004,1)*np.exp(-t*(5 if voice=="acid" else 1.6))*tail
        cache[key] = (wave_data*np.maximum(envelope,0)).astype(np.float32)
        return cache[key]

    def drum(kind,variant=0):
        key = (kind,variant)
        if key in cache:
            return cache[key]
        seconds = {"kick":.36,"clap":.23,"hat":.075,"open":.19,"rim":.105,"crash":1.1,"snare":.18}[kind]
        t = np.arange(round(seconds*RATE),dtype=np.float32)/RATE
        noise = rng.standard_normal(len(t)).astype(np.float32)
        smooth = np.convolve(noise,np.ones(5,dtype=np.float32)/5,mode="same")
        low = np.convolve(noise,np.ones(29,dtype=np.float32)/29,mode="same")
        if kind=="kick":
            fundamental = 46+(bpm-80)*.10
            phase = 2*np.pi*(fundamental*t+85*.027*(1-np.exp(-t/.027)))
            data = (np.sin(phase)*np.exp(-t*(9.5+bpm/80))+smooth*.13*np.exp(-t*150))*np.minimum(t/.0015,1)
        elif kind=="clap":
            env = sum(np.exp(-np.maximum(t-start,0)*85)*(t>=start) for start in [0,.010,.019])
            env += .5*np.exp(-np.maximum(t-.03,0)*20)*(t>=.03)
            data = (smooth-low)*env*.63
        elif kind=="rim":
            data = (.45*np.sin(2*np.pi*(630+bpm)*t)+.22*np.sin(2*np.pi*1250*t)+.20*(smooth-low))*np.exp(-t*63)*np.minimum(t/.001,1)
        elif kind=="snare":
            data = ((smooth-low)*.52+np.sin(2*np.pi*180*t)*.22)*np.exp(-t*25)*np.minimum(t/.001,1)
        else:
            decay = 78 if kind=="hat" else 21 if kind=="open" else 4.4
            data = (smooth-low)*np.exp(-t*decay)*np.minimum(t/.0015,1)
        data *= np.minimum(np.maximum(seconds-t,0)/.006,1)
        cache[key] = data.astype(np.float32)
        return cache[key]

    kick,clap,open_hat,rim,crash,snare = [drum(kind) for kind in ["kick","clap","open","rim","crash","snare"]]
    hats = [drum("hat",i) for i in range(4)]
    for bar in range(spec["bars"]):
        section = next(s for s in sections if s["startBar"]<=bar<s["endBar"])
        name = section["name"]
        intro,outro = name=="intro",name=="outro"
        lift = name in ["first-lift","final-lift"]
        quiet = name=="short-break"
        build = name=="build"
        start = bar*4*beat
        chord = spec["chords"][(bar//2)%len(spec["chords"])]
        if bar==section["startBar"] and lift:
            add(crash,start,.12 if bpm<110 else .15,-.18)
        # Quiet sections keep a soft quarter-note kick so the practice pulse never disappears.
        for b in range(4):
            at = start+b*beat
            add(kick,at,.30 if quiet else .47 if intro or outro else .61 if lift else .55)
            if b%2 and not intro:
                add(clap,at,.08 if quiet else .21 if lift else .17,.05)
            if not quiet and not intro:
                add(tone(chord[0]-12,beat*.43,"bass"),at+.5*beat,.31 if lift else .25)
                if bpm>=110 and lift and b==3 and bar%4==3:
                    add(tone(chord[0],beat*.17,"bass"),at+.80*beat,.08)
            # All hats are quantized; extra subdivisions are lower in volume than the beat.
            for i in range(4):
                if (bpm<=90 or quiet or intro) and i%2:
                    continue
                gain = [.031,.016,.051,.020][i]*(.45 if quiet else 1 if lift else .78)
                add(hats[(i+bar)%4],at+i*.25*beat,gain,-.28 if i%2==0 else .26)
            if not quiet and not intro and bpm>=100:
                add(open_hat,at+.5*beat,.036 if lift else .024,.2)
            if bpm in [80,90,120] and bar%2 and b in [1,3] and not quiet:
                add(rim,at+.75*beat,.025 if bpm==80 else .040,-.36)
        if not intro and not outro:
            for j,n in enumerate(chord):
                add(tone(n+12,4*beat+.10,"pad"),start,.025 if quiet else .014,(j-1)*.40)
        if not intro and not quiet and not outro:
            for i in range(8):
                if not spec["mask"][i] and not (lift and bar%4==3):
                    continue
                index = (bar%2)*8+i
                note = spec["hook"][index]
                # Distinct chord-tone answer phrase every other four bars.
                if bar%8>=4:
                    note = chord[[0,2,1,2,0,1,2,1][(i+bpm//10)%8]]+24
                if name=="final-lift" and bar%8>=6 and bpm in [100,120,140]:
                    note -= 12
                seconds = beat*(.77 if i in [3,7] else .47)
                sound = tone(note,seconds,spec["voice"])
                gain = .105 if spec["voice"] in ["round","mallet","glass"] else .084
                gain *= 1 if lift else .75
                add(sound,start+i*.5*beat,gain,-.10)
                add(sound,start+(i*.5+.75)*beat,gain*.22,.46)
            if lift and bpm>=120:
                for i in range(8):
                    n=chord[(i+bar)%3]+12
                    add(tone(n,beat*.21,"glass" if bpm==120 else "acid"),start+(i*.5+.25)*beat,.026,.31)
        elif quiet:
            for i,note in enumerate(chord):
                add(tone(note+24,beat*1.35,"round"),start+i*beat,.062,(-1)**i*.30)
        if build:
            position = (bar-section["startBar"])/(section["endBar"]-section["startBar"])
            count = 4 if position<.5 else 8 if position<.85 else 16
            for i in range(count):
                add(snare,start+i*(4/count)*beat,.027+position*.045,(-1)**i*.15)
            t = np.arange(round(4*beat*RATE),dtype=np.float32)/RATE
            noise = rng.standard_normal(len(t)).astype(np.float32)
            noise = np.convolve(noise,np.ones(19,dtype=np.float32)/19,mode="same")
            env = np.minimum(t/.04,1)*np.minimum((4*beat-t)/.06,1)
            add(noise*env,start,.015+position*.036)
        if lift and bar%8==7:
            for i in range(3):
                add(snare,start+(3.25+i*.25)*beat,.035+i*.012,(-1)**i*.18)

    with tempfile.TemporaryDirectory(prefix="maru-training-") as name:
        temporary = Path(name)
        motif,engine = helpers.f_motif(f_engine,temporary)
        if motif is not None:
            ratio = 2**(spec["motifTranspose"]/12)
            old_t = np.arange(len(motif))/RATE
            new_t = np.arange(round(len(motif)/ratio))/RATE*ratio
            transformed = np.column_stack([np.interp(new_t,old_t,motif[:,ch]) for ch in range(2)]).astype(np.float32)
            add(transformed,.10,.46)
            add(transformed,duration-len(transformed)/RATE-.65,.35)
            engine = {**engine,"mode":"F-drive-signature-plus-original-tempo-training-composition",
                      "motifTransposeSemitones":spec["motifTranspose"],
                      "use":"AST-extracted function actually called; rendered short motif pitch-shifted to the track's related major key and placed in the intro/outro only."}
        else:
            for i,note in enumerate(spec["hook"][:4]):
                add(tone(note,beat*1.4,"round"),i*beat+.1,.046)
                add(tone(note,beat*1.4,"round"),duration-5*beat+i*beat,.036)
        mix -= np.mean(mix,axis=0)
        np.tanh(mix*1.17,out=mix)
        mix *= .78/max(float(np.max(np.abs(mix))),1e-9)
        fade = np.minimum(np.arange(frames,dtype=np.float32)/(RATE*.012),1)
        fade *= np.minimum((frames-np.arange(frames,dtype=np.float32))/(RATE*2.0),1)
        mix *= fade[:,None]
        master_peak = float(np.max(np.abs(mix)))
        master_rms = float(np.sqrt(np.mean(mix**2,dtype=np.float64)))
        master = temporary/"master.wav"
        pcm = np.round(mix*32767).astype("<i2")
        with wave.open(str(master),"wb") as wav:
            wav.setnchannels(2);wav.setsampwidth(2);wav.setframerate(RATE);wav.writeframes(pcm.tobytes())
        before = helpers.loudness(ffmpeg,master)
        normalizer = ("loudnorm=I=-14:TP=-2:LRA=9:linear=true:"
                      f"measured_I={before['input_i']}:measured_TP={before['input_tp']}:"
                      f"measured_LRA={before['input_lra']}:measured_thresh={before['input_thresh']}:"
                      f"offset={before['target_offset']},aresample={RATE},"
                      f"atrim=end_sample={frames},asetpts=N/SR/TB")
        ogg = temporary/f"{track_id}.ogg"
        helpers.run([ffmpeg,"-hide_banner","-loglevel","error","-y","-i",str(master),
            "-af",normalizer,"-ar",str(RATE),"-ac","2","-c:a","libvorbis","-q:a","5",
            "-metadata",f"title={spec['title']}","-metadata","artist=Eolmaru Vision Game",
            "-metadata",f"BPM={bpm}","-metadata","copyright=CC0-1.0",str(ogg)])
        probe = json.loads(helpers.run([ffprobe,"-v","error","-show_entries",
            "format=duration,size:stream=codec_name,sample_rate,channels","-of","json",str(ogg)]).stdout)
        raw = helpers.run([ffmpeg,"-v","error","-i",str(ogg),"-f","f32le","-acodec","pcm_f32le","-"]).stdout
        decoded = np.frombuffer(raw,dtype="<f4").reshape(-1,2)
        peak = float(np.max(np.abs(decoded)))
        rms = float(np.sqrt(np.mean(decoded**2,dtype=np.float64)))
        measured = helpers.loudness(ffmpeg,ogg)
        stream = probe["streams"][0]
        assert stream["codec_name"]=="vorbis" and stream["sample_rate"]==str(RATE) and stream["channels"]==2
        assert abs(float(probe["format"]["duration"])-duration_exact)<.02 and abs(len(decoded)-frames)<=1
        assert peak<.99 and -15.3<float(measured["input_i"])<-12.8
        now = protected_snapshot()
        if now != protected:
            raise RuntimeError("A pre-existing audio file changed; refusing to publish")
        measurements = {
            "masterPeak":round(master_peak,6),"masterRms":round(master_rms,6),
            "masterPcmSha256":hashlib.sha256(pcm.tobytes()).hexdigest(),
            "decodedPeak":round(peak,6),"decodedPeakDbFS":round(20*math.log10(peak),3),
            "decodedRms":round(rms,6),"decodedRmsDbFS":round(20*math.log10(rms),3),
            "integratedLufs":float(measured["input_i"]),"truePeakDbTP":float(measured["input_tp"]),
            "loudnessRangeLU":float(measured["input_lra"]),"decodedFrames":len(decoded),
            "fullDecodePassed":True,"fileBytes":ogg.stat().st_size,"sha256":helpers.sha(ogg),
        }
        metadata = {
            "id":track_id,"title":spec["title"],"file":ogg.name,"artist":"얼마루 비전게임",
            "bpm":bpm,"duration":float(probe["format"]["duration"]),"durationSeconds":duration_exact,
            "beatOffsetSeconds":0,"beats":spec["bars"]*4,"bars":spec["bars"],"timeSignature":"4/4",
            "sampleRate":RATE,"channels":2,"seed":spec["seed"],"genre":spec["genre"],"key":spec["key"],
            "license":"CC0-1.0","vocals":False,"externalSamples":False,"neuralModelUsed":False,
            "engine":engine,"generator":"tools/music-training-compose.py","generatorSha256":helpers.sha(Path(__file__)),
            "helperGenerator":"tools/music-dance-compose.py","helperGeneratorSha256":helpers.sha(HELPER_PATH),
            "sections":sections,
            "arrangement":{"leadVoice":spec["voice"],"chordsMidi":spec["chords"],"hookMidi":spec["hook"],
                "eighthNoteMask":spec["mask"],"tempoResampledFromExistingSong":False,
                "drums":"Quarter-note kick through every section; 2/4 clap, quantized eighth/sixteenth hats and restrained fills.",
                "bass":"Offbeat original synthesis; no imported music/drum samples.",
                "mastering":"Two-pass -14 LUFS / -2 dBTP loudnorm; exact sample trim and PTS; Vorbis quality 5."},
            "timing":{"grid":"Generated at exact n * 60 / BPM; each event rounded only once to an integer audio sample.",
                "maxSchedulingRoundingSeconds":.5/RATE,"firstEightKickSeconds":[round(i*beat,9) for i in range(8)],
                "firstEightKickSamples":[round(i*beat*RATE) for i in range(8)],
                "durationSampleRoundingSeconds":duration-duration_exact},
            "measurements":measurements,
            "preservation":{"preExistingAudioFiles":len(protected),"snapshotSha256":snapshot_digest(protected),"verifiedUnchanged":True},
            "toolVersions":{"python":sys.version.split()[0],"numpy":np.__version__,
                "ffmpeg":helpers.run([ffmpeg,"-version"]).stdout.decode().splitlines()[0]},
            "review":"Complete Ogg decode, frame length, peak/RMS/LUFS, source/generator hashes and preservation measured. Human listening, timbre preference and physical speaker/game synchronization remain unverified.",
        }
        shutil.copyfile(ogg,OUT/ogg.name)
        (OUT/f"{track_id}.json").write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        print(json.dumps({"id":track_id,"bpm":bpm,"duration":metadata["duration"],**measurements},ensure_ascii=False),flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--track",choices=["all",*[str(n) for n in TRACKS]],default="all")
    parser.add_argument("--f-engine",type=Path)
    args = parser.parse_args()
    ffmpeg,ffprobe = shutil.which("ffmpeg"),shutil.which("ffprobe")
    if not ffmpeg or not ffprobe:
        raise SystemExit("FFmpeg and ffprobe are required on PATH")
    OUT.mkdir(parents=True,exist_ok=True)
    protected = protected_snapshot()
    for bpm in TRACKS if args.track=="all" else [int(args.track)]:
        compose(bpm,args.f_engine,ffmpeg,ffprobe,protected)


if __name__=="__main__":
    main()
