/** Offline F-studio Qwen3 VoiceDesign client. Never changes the studio or models. */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync,mkdirSync,copyFileSync,unlinkSync,statSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const base=process.env.MARU_VOICE_URL||'http://127.0.0.1:8013';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))throw Error('Only a loopback voice studio is supported.');
const script='F:/0.SoulmaruAI/1.aiimage/webtoon-translator/local-api/backend/python/voice/tts_server.py';
const staging=join(root,'test-results/voice-build');mkdirSync(staging,{recursive:true});
const original=JSON.parse(readFileSync(join(root,'public/audio/voice/manifest.json'),'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const sourceHash=hash(readFileSync(script));
const presets=[
  {folder:'praise',title:'마루의 명랑한 어린이풍 칭찬',speaker:'girl_story',rate:2,
    direction:'',cues:Object.fromEntries(['굳!','그레이트!','퍼팩트!','엑셀런트!','야미!'].map((text,i)=>[['good','great','perfect','excellent','yummy'][i],text]))},
  {folder:'voice',title:'마루의 밝은 한국어 여성 코치',speaker:'sunny',rate:0,
    direction:'A smiling, encouraging Korean game coach. Warm expressive rising and falling intonation, clear gentle instructions, friendly and lively. Speak only the supplied words; no extra commentary, laughter or music.',
    cues:Object.fromEntries(Object.entries(original.cues).map(([id,cue])=>[id,cue.text]))},
];
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8',windowsHide:true,timeout:120000});if(r.error||r.status)throw Error(r.error?.message||r.stderr);return r.stdout;}
async function request(path,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});const data=await r.json();if(!r.ok)throw Error(data.error||`Voice studio ${r.status}`);return data;}
const health=await request('/health');if(!health.speakers?.some(x=>x.id==='sunny')||!health.speakers.some(x=>x.id==='girl_story'))throw Error('Installed VoiceDesign styles required. No SAPI fallback.');
if(health.activeTasks)throw Error('Voice studio is already busy. Use a separate owned engine instance.');
for(const preset of presets){
  const out=join(root,`public/audio/${preset.folder}`);mkdirSync(out,{recursive:true});
  const engine={name:'Qwen3-TTS-12Hz-1.7B-VoiceDesign',source:'F-drive voice studio',studioScript:script,studioScriptSha256:sourceHash,voice:preset.speaker,mood:'bright',direction:preset.direction,rate:preset.rate,seed:727,networkRequired:false,impersonation:false};
  const manifest={version:2,language:'ko-KR',title:preset.title,generatedAt:new Date().toISOString(),engine,
    generationAdapter:{file:'tools/voice-local-server.py',sha256:hash(readFileSync(join(root,'tools/voice-local-server.py'))),policy:'Per-utterance token cap; initial seven verified short clips reused from the direct studio. CPU, six threads, offline.'},
    rights:'Original game scripts synthesized locally with Qwen3-TTS VoiceDesign (Apache-2.0 model). Fictional voices; no recorded person or cloned voice. Model is not redistributed.',
    verification:'Full decode, duration, bytes and SHA-256 checked. Emotion, pronunciation and game mix require human listening. VoiceDesign does not guarantee identical speaker identity between utterances.',cues:{}};
  for(const [id,text] of Object.entries(preset.cues)){
    const key=`${preset.folder}-${id}`,wav=join(staging,`${key}.wav`),ogg=join(staging,`${key}.ogg`),record=join(staging,`${key}.json`),signature=hash(JSON.stringify({engine,text}));
    let cached;try{cached=JSON.parse(readFileSync(record,'utf8'));}catch{}
    const published=join(out,`${id}.ogg`);
    if(cached?.signature===signature&&!existsSync(ogg)&&existsSync(published)&&hash(readFileSync(published))===cached.cue.sha256)copyFileSync(published,ogg);
    if(cached?.signature===signature&&existsSync(ogg)&&hash(readFileSync(ogg))===cached.cue.sha256){manifest.cues[id]=cached.cue;console.log(`${key}: verified staged cue reused`);continue;}
    const began=Date.now();console.log(`${key}: synthesizing ${text}`);
    let completed=false,usedSeed=727;
    for(let attempt=0;attempt<3;attempt++){
      usedSeed=727+attempt;const attemptStart=Date.now();let settled=false;
      const accepted=await request('/speak',{text,speaker:preset.speaker,language:'Korean',mood:'bright',direction:preset.direction,seed:usedSeed,rate:preset.rate,volume:100,output:wav});
      while(Date.now()-attemptStart<5*60*1000){
        await new Promise(r=>setTimeout(r,1800));const task=await request(`/task/${accepted.id}`);
        if(task.state==='failed')throw Error(`${key}: ${task.error}`);
        if(task.state==='done'){
          settled=true;
          const cap=Math.max(72,Math.min(192,Math.ceil(text.length*2.4+24)))/12/(2**(preset.rate/10));
          completed=task.seconds<cap-.22;
          if(!completed)console.log(`${key}: reached the duration guard (${task.seconds}s); retrying a fresh seed`);
          break;
        }
      }
      if(!settled)throw Error(`${key}: timed out; stop the owned engine before retrying. No additional task was queued.`);
      if(completed)break;
    }
    if(!completed)throw Error(`${key}: bounded generation did not finish cleanly; review before publishing.`);
    const filter='silenceremove=start_periods=1:start_duration=0.015:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_duration=0.015:start_threshold=-45dB,areverse,apad=pad_dur=0.07,loudnorm=I=-18:TP=-2:LRA=7';
    run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',wav,'-af',filter,'-ar','24000','-ac','1','-c:a','libvorbis','-q:a','4','-metadata',`title=Maru ${preset.folder} - ${id}`,ogg]);
    run('ffmpeg',['-v','error','-i',ogg,'-f','null','-']);
    const p=JSON.parse(run('ffprobe',['-v','error','-show_entries','format=duration:stream=sample_rate,channels','-of','json',ogg]));
    const duration=Number(p.format.duration);if(!(duration>.15&&duration<(preset.folder==='praise'?4:18)))throw Error(`${key}: unexpected duration ${duration}`);
    const cue={text,file:`/audio/${preset.folder}/${id}.ogg`,durationSeconds:duration,sampleRate:Number(p.streams[0].sample_rate),channels:p.streams[0].channels,bytes:statSync(ogg).size,sha256:hash(readFileSync(ogg)),seed:usedSeed};
    manifest.cues[id]=cue;writeFileSync(record,JSON.stringify({signature,cue},null,2)+'\n');unlinkSync(wav);
    console.log(`${key}: ${duration.toFixed(3)}s / ${cue.bytes} bytes / generated in ${((Date.now()-began)/1000).toFixed(1)}s`);
  }
  // Publish a complete, verified group only; failures retain the previous coach group.
  for(const id of Object.keys(preset.cues))copyFileSync(join(staging,`${preset.folder}-${id}.ogg`),join(out,`${id}.ogg`));
  writeFileSync(join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  // Remove only this verified group's intermediates; JSON checkpoints are tiny
  // provenance records. Interrupted, un-published groups remain resumable.
  for(const [id,cue] of Object.entries(manifest.cues)){
    const staged=join(staging,`${preset.folder}-${id}.ogg`);
    if(existsSync(staged)&&hash(readFileSync(staged))===cue.sha256)unlinkSync(staged);
  }
  console.log(`${preset.folder}: published ${Object.keys(manifest.cues).length} locally generated clips.`);
}
