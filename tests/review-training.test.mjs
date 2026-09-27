import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as charts from '../src/saber-chart.mjs';
import {SaberSession} from '../src/saber-core.mjs';
import {HandTracker} from '../src/saber-input.mjs';
import {SaberGame} from '../src/saber-game.mjs';
import {BUILTIN_SONGS} from '../src/songs.mjs';

const readPublic=path=>readFileSync(new URL(`../public/${path}`,import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
// Captured independently from committed baseline 453f4e1. JSON is compared as
// LF text because a clean Windows checkout may retain CRLF before renormalizing.
// Audio remains a strict byte comparison. These are never derived from new files.
const BASELINE={
  'audio/maru-flow.ogg':'a940becf5467a95501eed896ac1b860cc90c764239ed18ed2eac5c7090d79cb3',
  'audio/maru-flow.json':'81f21fd36017d200627f3eafa4428084d2ece99c3c8ce60c33f7b4f092693721',
  'audio/maru-breeze.ogg':'55e0d152805249f29f2fb3f399a6478e8e2f9d97977eb79a43f4000bdcbc13b1',
  'audio/maru-breeze.json':'1273c2ffefb57bebeba9e12723beacc5f3add37bbc5f293ae39de582cacf9baa',
  'audio/maru-sunset.ogg':'2eab0411221a10f2529ded19362709e5f553a8e8da49b1094506ee8be33345d6',
  'audio/maru-sunset.json':'ec9c737b5d6ca5b340014559e7c1ed228c473add07dcf07f7a02c2bbe3216524',
  'audio/maru-neon-drive.ogg':'e0cdf1808a0fe94744d5e7c3e9664c985e24802b46cebb4e969d9956a4fd7aca',
  'audio/maru-neon-drive.json':'1c004a5ab04dac4c0fe8699908a098631517f7f2b1586e5cee62ca9d8fe8c6fe',
  'audio/maru-pulse-rush.ogg':'3ac7824c0b9a8261287b4b61f0a1ad3aab0c63d226170f78db15f93f1922eb41',
  'audio/maru-pulse-rush.json':'c62b3629da39abf33121238c31d04caf8dc041758fa78c647fcd8715561b033a',
  'audio/voice/manifest.json':'944dc997a429c4c3fb6809f68842c169c7b2d30483b3a63d0aeb0b2be41199be',
  'audio/praise/manifest.json':'b2e887e1d3ae676425d9959894019faf5b501fd34dc3d6af1594a950f2374aca',
};

test('training additions preserve the five existing songs, metadata and both voice manifests',()=>{
  for(const [path,expected] of Object.entries(BASELINE)){
    const bytes=readPublic(path),normalized=path.endsWith('.json')?bytes.toString('utf8').replace(/\r\n/g,'\n'):bytes;
    assert.equal(sha(normalized),expected,path);
  }
});

test('all 36 existing coach and praise audio files retain the pinned manifest bytes and hashes',()=>{
  for(const [folder,count] of [['voice',31],['praise',5]]){
    const manifest=JSON.parse(readPublic(`audio/${folder}/manifest.json`));assert.equal(Object.keys(manifest.cues).length,count);
    for(const [id,cue] of Object.entries(manifest.cues)){
      assert.equal(cue.file,`/audio/${folder}/${id}.ogg`);const bytes=readPublic(cue.file.slice(1));
      assert.equal(bytes.length,cue.bytes);assert.equal(sha(bytes),cue.sha256,id);
    }
  }
});

const near=(a,b,epsilon=1e-8)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);
const note=(patch={})=>({id:'s1',time:10,lineIndex:1,lineLayer:1,hand:'left',cutDirection:'any',kind:'sustain',durationSeconds:2,...patch});
const raw=(notes=[note()],patch={})=>({schemaVersion:1,songId:'training-test',bpm:120,offsetSeconds:0,notes,...patch});
const chart=(notes=[note()],patch={})=>charts.validateChart(raw(notes,patch));
const tap=(id,time,hand='left',lineIndex=1)=>({id,time,lineIndex,lineLayer:1,hand,cutDirection:'right'});
let serial=0;
const sample=(x,time,{player=0,hand='left',y=1.5,...patch}={})=>({x,y,sessionId:'training',inputEpoch:1,player,hand,source:'test',capturedAtMs:time*1000,audioTimeSeconds:time,confidence:1,frameId:++serial,valid:true,...patch});
const segment=(a,b,patch={})=>({from:a,to:b,strokeId:'continuous-stroke',strokeDistance:Math.hypot(b.x-a.x,b.y-a.y),...patch});
function observeRange(session,start,end,{moving=true,player=0,hand='left',step=.1,tick=false,...patch}={}){
  let index=0;
  for(let from=start;from<end-1e-10;){
    const to=Math.min(end,from+step),x=moving?(index%2?1.8:1.2):1.5,next=moving?x+(index%2?-.6:.6)*(to-from)/step:1.5;
    assert.equal(session.observe(segment(sample(x,from,{player,hand,...patch}),sample(next,to,{player,hand,...patch}),{strokeDistance:moving?.6*(index+1):0}),to),null,'sustain progress is not a terminal hit');
    if(tick)session.advance(to);from=to;index++;
  }
}

test('sustain fields round-trip through v1 JSON without mutating the source',()=>{
  const source=raw([note()],{offsetSeconds:.1}),saved=structuredClone(source),result=charts.validateChart(source);
  assert.deepEqual(source,saved);assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.notes[0]));
  const n=result.notes[0];assert.equal(n.kind,'sustain');near(n.durationSeconds,2);near(n.hitTime,10.1);near(n.endTime,12.1);
  const exported=charts.chartJSON(result);assert.equal(exported.notes[0].kind,'sustain');assert.equal(exported.notes[0].durationSeconds,2);
  assert.deepEqual(charts.validateChart(JSON.stringify(exported)),result);
});

test('sustain duration boundaries, kind and song-end margin fail closed',()=>{
  for(const durationSeconds of [.5,6])assert.doesNotThrow(()=>chart([note({durationSeconds})]));
  for(const durationSeconds of [.499999,6.000001,0,-1,NaN,Infinity,'2',null])assert.throws(()=>chart([note({durationSeconds})]));
  assert.throws(()=>chart([note({kind:'future-target'})]));
  assert.doesNotThrow(()=>chart([note({time:147,durationSeconds:2})]));
  assert.throws(()=>chart([note({time:147.000001,durationSeconds:2})]));
});

test('active sustains reserve their hand and cell through the half-second release gap',()=>{
  const long=note({durationSeconds:3});
  assert.throws(()=>chart([long,tap('same-hand',12,'left',3)]));
  assert.throws(()=>chart([long,tap('same-cell',12,'right',1)]));
  assert.doesNotThrow(()=>chart([long,tap('other',12,'right',2)]));
  assert.throws(()=>chart([long,tap('other',11,'right',2),tap('later',13.499999,'left',3)]));
  assert.doesNotThrow(()=>chart([long,tap('other',11,'right',2),tap('later',13.5,'left',3)]));
});

test('sustains remain visible through their active end while taps keep the original window',()=>{
  const mixed=chart([note(),tap('tap',14)]),states=new Map();
  assert.equal(charts.visibleNotes(mixed,states,11).some(n=>n.id==='s1'),true);
  assert.equal(charts.visibleNotes(mixed,states,12).some(n=>n.id==='s1'),true);
  assert.equal(charts.visibleNotes(mixed,states,14.250001).some(n=>n.id==='tap'),false);
  states.set('s1',{kind:'skipped'});assert.equal(charts.visibleNotes(mixed,states,11).some(n=>n.id==='s1'),false);
});

test('approach speed changes only presentation timing and never mutates source notes',()=>{
  const source=chart([note({time:2,durationSeconds:2}),tap('tap',5)]),saved=structuredClone(source);
  for(const approachSpeed of [.6,1,1.6]){
    const derived=charts.applyTrainingSettings(source,{approachSpeed,spacingBeats:2});
    near(derived.leadSeconds,1.8/approachSpeed);assert.equal(derived.bpm,source.bpm);
    for(let i=0;i<source.notes.length;i++){
      const a=source.notes[i],b=derived.notes[i];assert.equal(b.id,a.id);assert.equal(b.hitTime,a.hitTime);assert.equal(b.endTime,a.endTime);
      near(b.spawnTime,Math.max(0,a.hitTime-1.8/approachSpeed));
    }
  }
  assert.deepEqual(source,saved);assert.equal(charts.applyTrainingSettings(source,{approachSpeed:.6,spacingBeats:2}).notes[0].spawnTime,0);
});

test('four-beat spacing retains whole alternating time groups, including both hands',()=>{
  const source=chart([tap('aL',10),tap('aR',10,'right',2),tap('b',11),tap('cL',12),tap('cR',12,'right',2),tap('d',13)]);
  const spaced=charts.applyTrainingSettings(source,{approachSpeed:1,spacingBeats:4});
  assert.deepEqual(spaced.notes.map(n=>n.id),['aL','aR','cL','cR']);assert.equal(source.notes.length,6);
  assert.deepEqual(charts.chartJSON(source).notes.map(n=>n.id),['aL','aR','b','cL','cR','d']);
});

test('training charts cover all seven requested tempos with a mix of taps and bounded sustains',()=>{
  for(const bpm of [80,90,100,110,120,130,140])for(const duration of [120,150,180]){
    const generated=charts.generateTrainingChart({bpm,duration,songId:`practice-${bpm}`});
    assert.ok(generated.notes.some(n=>n.kind==='sustain'));assert.ok(generated.notes.some(n=>n.kind!=='sustain'));
    assert.ok(generated.notes.every(n=>n.spawnTime>=0&&(n.endTime??n.hitTime)<=duration-1));
    assert.deepEqual(charts.validateChart(charts.chartJSON(generated),{duration,songId:`practice-${bpm}`}),generated);
  }
});

test('completed movement stays pending before the end and emits one hit exactly at the end',()=>{
  const session=new SaberSession(chart());observeRange(session,10,12);
  assert.equal(session.states.size,0);assert.deepEqual(session.advance(11.999999),[]);
  const events=session.advance(12);assert.equal(events.length,1);assert.equal(events[0].kind,'hit');
  near(events[0].sustainAccuracy,100);assert.ok(events[0].grade);assert.equal(session.counts.hit,1);assert.deepEqual(session.advance(13),[]);
});

test('insufficient movement waits through grace while a final valid sample can recover at the grace boundary',()=>{
  for(const [arrival,kind] of [[12.45,'hit'],[12.450001,'miss']]){
    const session=new SaberSession(chart());observeRange(session,10,12,{moving:false});observeRange(session,10,11.1);
    assert.deepEqual(session.advance(11.999999),[]);assert.deepEqual(session.advance(12),[]);assert.deepEqual(session.advance(12.45),[]);
    assert.equal(session.observe(segment(sample(1.2,11.9),sample(1.8,12)),arrival),null);
    const events=session.advance(arrival);assert.equal(events.length,1);assert.equal(events[0].kind,kind);
  }
  const untracked=new SaberSession(chart());assert.deepEqual(untracked.advance(12),[]);assert.deepEqual(untracked.advance(12.45),[]);
  assert.equal(untracked.advance(12.450001)[0].kind,'untracked');
});

test('sustain coverage threshold distinguishes one microsecond below sixty percent',()=>{
  for(const [earlyEnd,kind] of [[10.699999,'miss'],[10.7,'hit'],[10.700001,'hit']]){
    const session=new SaberSession(chart());observeRange(session,10,12,{moving:false});
    observeRange(session,10,earlyEnd);observeRange(session,11.5,12);
    const result=session.advance(12.45001)[0];assert.equal(result.kind,kind,`early end ${earlyEnd}`);
    if(kind==='hit')near(result.sustainAccuracy,(earlyEnd-10+.5)/2*100);
  }
});

test('early movement cannot finish a sustain without observed motion in its final quarter',()=>{
  const session=new SaberSession(chart());observeRange(session,10,12,{moving:false});observeRange(session,10,11.4);
  assert.equal(session.advance(12.45001)[0].kind,'miss');assert.equal(session.counts.hit,0);
});

test('repeated segment delivery uses an interval union instead of fabricating movement time',()=>{
  const session=new SaberSession(chart());observeRange(session,10,12,{moving:false});
  const only=segment(sample(1.2,11.8),sample(1.8,12));
  for(let repeat=0;repeat<100;repeat++)assert.equal(session.observe(only,12),null);
  assert.equal(session.advance(12.45001)[0].kind,'miss');
});

test('six seconds of tracked stillness finalize as a miss even when advance runs every frame',()=>{
  const session=new SaberSession(chart([note({durationSeconds:6})]));observeRange(session,10,16,{moving:false,tick:true});
  assert.equal(session.advance(16.45001)[0].kind,'miss');assert.equal(session.counts.hit,0);
});

test('wrong hand, outside movement and tracking loss never auto-complete an active sustain',()=>{
  for(const options of [{hand:'right'},{y:0},{confidence:.1},{confidence:NaN}]){
    const session=new SaberSession(chart());observeRange(session,10,12,options);
    assert.notEqual(session.advance(12.45001)[0].kind,'hit');assert.equal(session.counts.hit,0);
  }
  const lost=new SaberSession(chart());observeRange(lost,10,10.4);
  assert.equal(lost.advance(12.45001)[0].kind,'untracked');
});

test('a seek skips an already-started sustain and reset removes its prior progress',()=>{
  const session=new SaberSession(chart());observeRange(session,10,11.5);session.seek(11.5);
  assert.equal(session.states.get('s1').kind,'skipped');observeRange(session,11.5,12);
  assert.equal(session.counts.hit,0);assert.deepEqual(session.advance(13),[]);
  session.reset();assert.equal(session.states.size,0);assert.equal(session.sustains.size,0);observeRange(session,11.5,12);
  assert.notEqual(session.advance(12.45001)[0].kind,'hit');
});

test('two players and two hands own independent sustain progress and terminal results',()=>{
  const shared=chart([note(),note({id:'right',hand:'right',lineIndex:2})]),one=new SaberSession(shared,0),two=new SaberSession(shared,1);
  observeRange(one,10,12);observeRange(two,10,12,{moving:false,player:1});
  const a=one.advance(12.45001),b=two.advance(12.45001);
  assert.equal(a.find(n=>n.id==='s1').kind,'hit');assert.equal(a.find(n=>n.id==='right').kind,'untracked');
  assert.equal(b.find(n=>n.id==='s1').kind,'miss');assert.equal(two.counts.hit,0);assert.notEqual(one.sustains,two.sustains);
});

test('the same continuous circular motion completes at 8, 12 and 20 Hz without a per-frame stroke quota',()=>{
  for(const hz of [8,12,20]){
    const tracker=new HandTracker(),session=new SaberSession(chart()),events=[];
    for(let i=0;i<=2*hz;i++){
      const time=10+i/hz,angle=2*Math.PI*(time-10),p=sample(1.5+.3*Math.cos(angle),time,{y:1.5+.3*Math.sin(angle)});
      assert.equal(session.observe(tracker.push(p),time),null);events.push(...session.advance(time));
    }
    events.push(...session.advance(12.45001));assert.equal(events.length,1);assert.equal(events[0].kind,'hit',`${hz}Hz`);near(events[0].time,12);
  }
});

test('frozen clocks, epoch boundaries and missing-frame bridges contribute no sustain progress',()=>{
  const session=new SaberSession(chart()),tracker=new HandTracker();
  tracker.push(sample(1.2,10));assert.equal(tracker.push(sample(1.8,10,{capturedAtMs:10100})),null);
  tracker.missing();assert.equal(tracker.push(sample(1.8,11.8)),null);
  const crossEpoch=segment(sample(1.2,11.9),sample(1.8,12,{inputEpoch:2}));assert.equal(session.observe(crossEpoch,12),null);
  assert.equal(session.advance(12.45001)[0].kind,'untracked');
});

test('movement time is clipped to the target rectangle instead of crediting outside portions',()=>{
  const session=new SaberSession(chart());
  for(let index=0;index<10;index++){
    const time=10+index*.2,a=sample(index%2?2.6:.4,time),b=sample(index%2?.4:2.6,time+.2);
    assert.equal(session.observe(segment(a,b),time+.2),null);
  }
  near(session.sustainProgress(session.chart.notes[0]).coverage,.5);
  assert.equal(session.advance(12.45001)[0].kind,'miss');
});

test('slow hand jitter and large music-clock discontinuities cannot supply moving coverage',()=>{
  const jitter=new SaberSession(chart());
  for(let i=0;i<20;i++){
    const t=10+i*.1;jitter.observe(segment(sample(1.5,t),sample(1.53,t+.1),{strokeDistance:10}),t+.1);
  }
  assert.equal(jitter.advance(12.45001)[0].kind,'miss');
  const jump=new SaberSession(chart());
  const a=sample(1.2,10),b=sample(1.8,10.2,{capturedAtMs:10100});
  assert.equal(jump.observe(segment(a,b),10.2),null);assert.equal(jump.sustains.size,0);assert.equal(jump.observed.left.length,0);
});

test('sustain completion keeps first-cut timing accuracy separate from final movement coverage',()=>{
  const session=new SaberSession(chart());
  session.observe(segment(sample(1.2,9.9),sample(1.8,10.0)),10);
  observeRange(session,10,12);
  const result=session.advance(12.45001)[0];assert.equal(result.kind,'hit');near(result.timingErrorMs,-100);
  near(result.accuracy,60);near(result.sustainAccuracy,100);assert.equal(result.grade.key,'excellent');
});

function gameFixture(t,settings={approachSpeed:1,spacingBeats:2}){
  const previous=globalThis.window;globalThis.window={addEventListener(){}};
  t.after(()=>{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;});
  const state={phase:'playing'},events=[],listeners=new Map(),audio={currentTime:0,addEventListener:(type,fn)=>listeners.set(type,fn)};
  const game=new SaberGame({stage:{addEventListener(){}},audio,phase:()=>state.phase,players:()=>1,input:()=> 'camera',notice(){},onHit:event=>events.push(event),latency:()=>0,range:()=>1,quality:()=> 'low',trainingSettings:()=>settings});
  game.setChart(chart());return {game,state,events,audio,listeners,settings};
}

test('pause retains only valid progress and resumed input cannot bridge the paused hand movement',t=>{
  const {game,state,audio,events}=gameFixture(t);
  for(let i=0;i<=10;i++){const time=10+i*.1;audio.currentTime=time;game.sample(0,'left',{x:i%2?1.8:1.2,y:1.5},time*1000,time,'camera',i);game.tick(time*1000);}
  const before=game.sessions[0].sustainProgress(game.chart.notes[0]).coverage;near(before,.5);
  state.phase='paused';game.resetInput();game.sample(0,'left',{x:2,y:1.5},15000,11,'camera',20);game.tick(15000);
  near(game.sessions[0].sustainProgress(game.chart.notes[0]).coverage,before);assert.equal(events.length,0);
  state.phase='playing';game.resetInput();
  for(let i=0;i<=10;i++){const time=11+i*.1;audio.currentTime=time;game.sample(0,'left',{x:i%2?1.8:1.2,y:1.5},16000+i*100,time,'camera',21+i);game.tick(16000+i*100);}
  assert.equal(events.length,1);near(events[0].time,12);assert.equal(events[0].targetKind,'sustain');audio.currentTime=12.46;game.tick(17460);assert.equal(events.length,1);
  game.tick(17500);assert.equal(events.length,1);game.start();assert.equal(game.sessions[0].sustains.size,0);
});

test('practice spacing affects the playable chart while editing and exporting retain all source notes',t=>{
  const {game,settings}=gameFixture(t),source=chart([tap('a',10),tap('b',11),tap('c',12),tap('d',13)]);
  game.setChart(source);assert.equal(game.chart,source);assert.equal(game.playChart.notes.length,4);
  settings.spacingBeats=4;settings.approachSpeed=.6;game.start();
  assert.equal(game.chart,source);assert.equal(game.playChart.notes.length,2);assert.equal(game.sessions[0].chart,game.playChart);
  assert.equal(charts.chartJSON(game.chart).notes.length,4);near(game.playChart.leadSeconds,3);
  settings.spacingBeats=2;game.start();assert.equal(game.playChart.notes.length,4);
});

function oggTiming(bytes){
  let offset=0,format=null,frames=null;
  while(offset<bytes.length){
    assert.equal(bytes.toString('ascii',offset,offset+4),'OggS');const flags=bytes[offset+5],count=bytes[offset+26],body=offset+27+count;
    let size=0;for(let i=0;i<count;i++)size+=bytes[offset+27+i];assert.ok(body+size<=bytes.length);
    if(!format){assert.equal(bytes[body],1);assert.equal(bytes.toString('ascii',body+1,body+7),'vorbis');format={channels:bytes[body+11],sampleRate:bytes.readUInt32LE(body+12)};}
    if(flags&4){frames=Number(bytes.readBigUInt64LE(offset+6));assert.equal(body+size,bytes.length);}
    offset=body+size;
  }
  assert.ok(Number.isSafeInteger(frames)&&frames>0);return {...format,frames,duration:frames/format.sampleRate};
}

test('the seven new song choices cover every ten BPM from 80 through 140 without replacing existing choices',()=>{
  const training=BUILTIN_SONGS.filter(song=>song.training);
  assert.equal(BUILTIN_SONGS.length,10);assert.deepEqual(training.map(song=>song.bpm),[80,90,100,110,120,130,140]);
  assert.deepEqual(BUILTIN_SONGS.filter(song=>!song.training).map(song=>song.songId),['maru-flow','maru-neon-drive','maru-pulse-rush']);
  const all=[...BUILTIN_SONGS.map(song=>song.src.slice(1)),'audio/maru-breeze.ogg','audio/maru-sunset.ogg'];
  assert.equal(new Set(all.map(path=>sha(readPublic(path)))).size,12);
});

test('seven training Oggs agree with measured hashes, container timing, tempo grids and local provenance',()=>{
  const metas=[];
  for(const song of BUILTIN_SONGS.filter(song=>song.training)){
    const bytes=readPublic(song.src.slice(1)),meta=JSON.parse(readPublic(`audio/${song.songId}.json`)),format=oggTiming(bytes),measure=meta.measurements;metas.push(meta);
    assert.equal(meta.id,song.songId);assert.equal(meta.bpm,song.bpm);assert.equal(meta.file,`${song.songId}.ogg`);
    assert.equal(bytes.length,measure.fileBytes);assert.equal(sha(bytes),measure.sha256);assert.equal(format.channels,2);assert.equal(format.sampleRate,44100);
    assert.ok(song.duration>=120&&song.duration<=180);near(song.duration,meta.bars*4*60/meta.bpm);near(meta.durationSeconds,song.duration);
    assert.ok(Math.abs(format.duration-song.duration)<=1/44100);assert.ok(Math.abs(format.frames-measure.decodedFrames)<=1);
    assert.equal(measure.decodedFrames,Math.round(song.duration*44100));assert.equal(meta.vocals,false);assert.equal(meta.externalSamples,false);assert.equal(meta.license,'CC0-1.0');
    assert.equal(meta.engine.sourceModified,false);assert.equal(meta.engine.neuralModelUsed,false);assert.equal(meta.arrangement.tempoResampledFromExistingSong,false);
    assert.equal(meta.generatorSha256,sha(readFileSync(new URL(`../${meta.generator}`,import.meta.url))));
    assert.equal(meta.helperGeneratorSha256,sha(readFileSync(new URL(`../${meta.helperGenerator}`,import.meta.url))));
    for(let beat=0;beat<8;beat++)assert.equal(meta.timing.firstEightKickSamples[beat],Math.round(beat*60/song.bpm*44100));
    assert.ok(measure.decodedPeak>0&&measure.decodedPeak<1);assert.ok(measure.decodedRms>0&&measure.decodedRms<measure.decodedPeak);
    assert.ok(Number.isFinite(measure.integratedLufs));assert.ok(measure.truePeakDbTP<0);assert.equal(measure.fullDecodePassed,true);
    let bar=0;for(const section of meta.sections){assert.equal(section.startBar,bar);assert.ok(section.endBar>bar);bar=section.endBar;}assert.equal(bar,meta.bars);
    const playable=charts.validateChart(readPublic(song.chart.slice(1)).toString(),{duration:song.duration,songId:song.songId});
    const holds=playable.notes.filter(n=>n.kind==='sustain');assert.ok(holds.some(n=>n.hand==='left')&&holds.some(n=>n.hand==='right'));
    assert.ok(playable.notes.every(n=>(n.endTime??n.hitTime)+.7<song.duration));
  }
  assert.equal(new Set(metas.map(meta=>meta.seed)).size,7);assert.equal(new Set(metas.map(meta=>JSON.stringify(meta.arrangement.hookMidi))).size,7);
});
