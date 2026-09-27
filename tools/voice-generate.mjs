/** Generate Korean coach cues using the F-drive studio's installed offline SAPI engine. */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const preferred = 'F:/0.SoulmaruAI/1.aiimage/webtoon-translator/local-api/backend/python/speech.ps1';
const requested = process.argv.find(arg => arg.startsWith('--engine='))?.slice('--engine='.length);
const engine = resolve(requested || (existsSync(preferred) ? preferred : join(root, 'tools/voice-sapi.ps1')));
const out = join(root, 'public/audio/voice');
const cues = {
  ready: '준비됐나요? 잠시 후 시작해요.',
  start: '시작해요. 편안하게 움직여 주세요.',
  open: '팔을 편안한 높이로 벌려 주세요.',
  up: '두 손을 천천히 위로 뻗어 주세요.',
  left: '화면 왼쪽으로 조금만 기울여 주세요.',
  right: '화면 오른쪽으로 조금만 기울여 주세요.',
  rest: '어깨의 힘을 풀고 잠시 쉬어요.',
  finish: '오늘도 잘 움직였어요. 수고했어요.',
  pause: '잠시 쉬어 가요.',
  'prepare-body': '안정된 의자에 앉고, 두 발을 바닥에 놓아 주세요.',
  'neck-left': '고개를 왼쪽으로 아주 조금 기울여 주세요.',
  'neck-right': '고개를 오른쪽으로 아주 조금 기울여 주세요.',
  'shoulder-roll': '어깨를 천천히 돌리며 힘을 풀어 주세요.',
  march: '의자에 앉아 무릎을 조금씩 번갈아 들어 주세요.',
  'hamstring-left': '왼쪽 다리를 앞으로 펴고, 편안한 범위에서 몸을 조금 숙여 주세요.',
  'hamstring-right': '오른쪽 다리를 앞으로 펴고, 편안한 범위에서 몸을 조금 숙여 주세요.',
  'calf-left': '왼쪽 다리를 편하게 펴고, 발끝을 몸 쪽으로 당겨 주세요.',
  'calf-right': '오른쪽 다리를 편하게 펴고, 발끝을 몸 쪽으로 당겨 주세요.',
  ankle: '발목을 천천히 펴고 당겨 주세요.',
};
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function run(executable, args) {
  const result = spawnSync(executable, args, { encoding: 'utf8', windowsHide: true, timeout: 120_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${executable} failed: ${(result.stderr || result.stdout).slice(-2000)}`);
  return result.stdout.replace(/^\uFEFF/, '').trim();
}
if (process.platform !== 'win32') throw new Error('Voice regeneration needs Windows with an installed Korean SAPI voice. Playback works on other systems.');
if (!existsSync(engine)) throw new Error(`Voice studio script not found: ${engine}`);
const shellArgs = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', engine];
const voices = JSON.parse(run('powershell.exe', [...shellArgs, '-List']));
const korean = voices.find(item => item.id === 'Microsoft Heami Desktop') || voices.find(item => item.language === 'ko-KR');
if (!korean) throw new Error('No Korean voice is installed. Install a local Korean Windows speech voice before regenerating.');
mkdirSync(out, { recursive: true });
const temp = mkdtempSync(join(tmpdir(), 'maru-voice-'));
const manifest = {
  version: 1,
  language: 'ko-KR',
  title: '얼마루 한국어 코치',
  generatedAt: new Date().toISOString(),
  engine: {
    name: 'Windows SAPI / System.Speech',
    voice: korean.id,
    studioScript: engine,
    studioScriptSha256: sha256(readFileSync(engine)),
    source: engine === resolve(preferred) ? 'F-drive voice studio' : 'local adapter',
    rate: 1,
    networkRequired: false,
    gpuRequired: false,
    impersonation: false,
  },
  rights: 'Original project scripts spoken by an installed Windows system voice. No speech engine, model or recorded human voice is redistributed.',
  verification: 'Each encoded file inspected with ffprobe; duration, bytes and SHA-256 recorded. Human listening and in-game sound balance remain manual checks.',
  cues: {},
};
let previous = null;
try { previous = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8')); } catch {}
try {
  for (const [id, text] of Object.entries(cues)) {
    const file = join(out, `${id}.ogg`);
    const cached = previous?.cues?.[id];
    if (cached?.text === text && previous.engine?.studioScriptSha256 === manifest.engine.studioScriptSha256
      && previous.engine?.voice === manifest.engine.voice && previous.engine?.rate === manifest.engine.rate
      && existsSync(file) && sha256(readFileSync(file)) === cached.sha256) {
      manifest.cues[id] = cached;
      console.log(`${id}: verified existing cue reused`);
      continue;
    }
    const wav = join(temp, `${id}.wav`);
    const request = join(temp, `${id}.json`);
    writeFileSync(request, JSON.stringify({ text, voice: korean.id, rate: 1, volume: 95, output: wav }), 'utf8');
    run('powershell.exe', [...shellArgs, '-RequestFile', request]);
    const filter = 'silenceremove=start_periods=1:start_duration=0.02:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_duration=0.02:start_threshold=-45dB,areverse,apad=pad_dur=0.12,loudnorm=I=-18:TP=-2:LRA=7';
    run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav, '-af', filter, '-ar', '24000', '-ac', '1', '-c:a', 'libvorbis', '-q:a', '4', '-metadata', `title=Maru coach - ${id}`, file]);
    const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_name,sample_rate,channels', '-of', 'json', file]));
    const duration = Number(probe.format.duration);
    if (!(duration > .3 && duration < 12)) throw new Error(`Unexpected voice duration: ${id} ${duration}`);
    manifest.cues[id] = {
      text,
      file: `/audio/voice/${id}.ogg`,
      durationSeconds: duration,
      sampleRate: Number(probe.streams[0].sample_rate),
      channels: Number(probe.streams[0].channels),
      bytes: statSync(file).size,
      sha256: sha256(readFileSync(file)),
    };
    console.log(`${id}: ${duration.toFixed(3)} sec, ${manifest.cues[id].bytes} bytes`);
  }
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`Generated ${Object.keys(cues).length} cues using ${korean.id}; runtime playback is offline.`);
} finally {
  // Only this process's mkdtemp-created directory is removed.
  const checkedTemp = resolve(temp);
  if (dirname(checkedTemp) !== resolve(tmpdir()) || !basename(checkedTemp).startsWith('maru-voice-')) {
    throw new Error('Refusing to remove a temporary path outside the expected directory.');
  }
  rmSync(checkedTemp, { recursive: true, force: true });
}
