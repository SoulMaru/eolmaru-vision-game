import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {HIT_GRADES,timingGrade,SaberSession} from '../src/saber-core.mjs';
import {validateChart} from '../src/saber-chart.mjs';
import {SaberGame} from '../src/saber-game.mjs';
import {SaberFeedback} from '../src/saber-feedback.mjs';

const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
const chart=()=>validateChart({schemaVersion:1,songId:'maru-flow',bpm:120,offsetSeconds:0,notes:[{id:'cut',time:10,lineIndex:1,lineLayer:1,hand:'left',cutDirection:'right'}]});
const sample=(x,time,player=0,hand='left')=>({x,y:1.5,capturedAtMs:time*1000,audioTimeSeconds:time,sessionId:1,inputEpoch:1,source:'test',player,hand,confidence:1,valid:true});
const cut=(player=0,hand='left')=>({from:sample(.9,10.2,player,hand),to:sample(1.5,10.3,player,hand),strokeId:'sweep',strokeDistance:.6});
const event=(id='cut',tier=4,player=0)=>({id,kind:'hit',player,hand:'left',accuracy:[10,30,50,70,90][tier],grade:HIT_GRADES[tier]});

test('feedback grades retain the requested Korean order and immutable shared descriptors',()=>{
  assert.deepEqual(HIT_GRADES.map(g=>[g.key,g.label,g.tier]),[['good','굳',0],['great','그레이트',1],['perfect','퍼팩트',2],['excellent','엑셀런트',3],['yummy','야미',4]]);
  assert.ok(Object.isFrozen(HIT_GRADES)&&HIT_GRADES.every(Object.isFrozen));
});

test('accuracy uses signed music-clock error and inclusive 20-point boundaries on both sides',()=>{
  for(const [distance,accuracy,tier] of [[.25,0,0],[.2,20,1],[.15,40,2],[.1,60,3],[.05,80,4],[0,100,4]]){
    for(const sign of [-1,1]){
      const result=timingGrade(10+sign*distance,10);
      near(result.accuracy,accuracy);near(result.timingErrorMs,sign*distance*1000);assert.equal(result.grade,HIT_GRADES[tier]);
    }
  }
});

test('one microsecond on either side of a grade boundary is not rounded into the wrong tier',()=>{
  for(const [distance,tier] of [[.2,1],[.15,2],[.1,3],[.05,4]])for(const sign of [-1,1]){
    assert.equal(timingGrade(100+sign*(distance+.000001),100).grade.tier,tier-1);
    assert.equal(timingGrade(100+sign*(distance-.000001),100).grade.tier,tier);
  }
});

test('accuracy clamps out-of-window times and rejects invalid clocks and nonpositive windows',()=>{
  assert.equal(timingGrade(11,10).accuracy,0);assert.equal(timingGrade(9,10).accuracy,0);
  near(timingGrade(10.1,10,.5).accuracy,80);assert.equal(timingGrade(10,10).accuracy,100);
  for(const args of [[NaN,0],[0,Infinity],['10',10],[10,10,0],[10,10,-1],[10,10,NaN],[10,10,Infinity]])assert.throws(()=>timingGrade(...args),RangeError);
});

test('success feedback grades the swept crossing, not arrival or the newest sample time',()=>{
  const session=new SaberSession(chart()),result=session.observe(cut(),10.3);
  assert.equal(result.kind,'hit');near(result.time,10.24);near(result.accuracy,4);near(result.timingErrorMs,240);assert.equal(result.grade.key,'good');
  assert.equal(session.observe(cut(),10.31),null);assert.equal(session.summary().hit,1);
});

test('wrong cuts, misses and untracked notes carry no success-grade fields',()=>{
  const wrong=new SaberSession(chart()).observe(cut(0,'right'),10.3),lost=new SaberSession(chart()).advance(11)[0];
  const observed=new SaberSession(chart());
  for(let i=0;i<5;i++){
    const time=9.75+i*.1,a={...sample(0,time),y:0},b={...sample(0,time+.1),y:0};
    observed.observe({from:a,to:b,strokeId:`stationary-${i}`,strokeDistance:0},time+.1);
  }
  const missed=observed.advance(11)[0];assert.equal(wrong.kind,'wrongCut');assert.equal(lost.kind,'untracked');assert.equal(missed.kind,'miss');
  for(const result of [wrong,lost,missed])for(const field of ['grade','accuracy','timingErrorMs'])assert.equal(Object.hasOwn(result,field),false);
});

test('two players receive independent grades for the same chart note',()=>{
  const a=new SaberSession(chart(),0),b=new SaberSession(chart(),1);
  assert.equal(a.observe(cut(0),10.3).player,0);assert.equal(b.states.size,0);
  const closer={from:sample(.9,10,1),to:sample(1.5,10.1,1),strokeId:'other',strokeDistance:.6};
  const result=b.observe(closer,10.1);assert.equal(result.player,1);assert.equal(result.grade.key,'yummy');near(result.accuracy,84);
});

test('the game forwards the original graded event and resets feedback on seek, start and finish',t=>{
  const previous=globalThis.window;globalThis.window={addEventListener(){}};
  t.after(()=>{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;});
  const listeners=new Map(),received=[],resets=[],audio={currentTime:10.3,addEventListener:(type,fn)=>listeners.set(type,fn)};
  const game=new SaberGame({stage:{addEventListener(){}},audio,phase:()=> 'playing',players:()=>1,input:()=> 'camera',notice(){},onHit:e=>received.push(e),onReset:()=>resets.push(true),latency:()=>0,range:()=>1,quality:()=> 'low'});
  game.setChart(chart());game.sample(0,'left',{x:.9,y:1.5},10200,10.2,'test',1);game.sample(0,'left',{x:1.5,y:1.5},10300,10.3,'test',2);
  assert.equal(received.length,1);assert.equal(received[0],game.sessions[0].states.get('cut'));near(received[0].accuracy,4);assert.equal(received[0].grade.key,'good');
  for(const action of [()=>listeners.get('seeking')(),()=>game.start(),()=>game.finish()]){const count=resets.length;action();assert.ok(resets.length>count);}
  assert.equal(received.length,1,'reset does not replay success audio');
});

// Small controllable WebAudio boundary: this proves lifecycle decisions, not
// browser output, perceived timbre, speaker loudness, or human pronunciation.
function audioMock(){
  const sources=[],gains=[],panners=[],buffers=[];
  const param=()=>({value:0,setValueAtTime(value){this.value=value;},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
  const node=()=>({connect(){},disconnect(){this.disconnected=true;}});
  const source=type=>{const n={...node(),type,frequency:param(),starts:[],stops:[],start(at){this.starts.push(at);},stop(at){this.stops.push(at);},end(){this.onended?.();}};sources.push(n);return n;};
  const ac={state:'running',currentTime:10,sampleRate:24000,destination:{},sources,gains,panners,buffers,
    createBufferSource(){return source('buffer');},createOscillator(){return source('oscillator');},
    createGain(){const n={...node(),gain:param()};gains.push(n);return n;},
    createStereoPanner(){const n={...node(),pan:param()};panners.push(n);return n;},
    createBiquadFilter(){return {...node(),frequency:param()};},
    createBuffer(channels,length,sampleRate){const data=new Float32Array(length),b={channels,length,sampleRate,getChannelData:()=>data};buffers.push(b);return b;},
    async decodeAudioData(bytes){return {decoded:true,bytes:bytes.byteLength};},
  };return ac;
}
function timers(t){
  const pending=new Map();let serial=0;
  t.mock.method(globalThis,'setTimeout',(callback,delay)=>{const id=++serial;pending.set(id,{callback,delay});return id;});
  t.mock.method(globalThis,'clearTimeout',id=>pending.delete(id));
  return {pending,flush(){const batch=[...pending.values()];pending.clear();for(const task of batch)task.callback();}};
}
function feedbackFixture(t,options={}){
  const clock=timers(t),ac=audioMock(),feedback=new SaberFeedback({getContext:()=>ac,effectVolume:()=>0,...options});
  for(const grade of HIT_GRADES)feedback.buffers.set(grade.key,{key:grade.key});
  t.after(()=>feedback.stop());return {clock,ac,feedback};
}

test('success-only dispatch rejects wrong outcomes, corrupt grades and suspended audio',t=>{
  const {clock,ac,feedback}=feedbackFixture(t);
  for(const invalid of [null,{...event(),kind:'wrongCut'},{...event(),kind:'miss'},{...event(),kind:'untracked'},{...event(),grade:{tier:4,key:'good'}},{...event(),accuracy:NaN}])assert.equal(feedback.hit(invalid),false);
  ac.state='suspended';assert.equal(feedback.hit(event()),false);assert.equal(clock.pending.size,0);assert.equal(ac.sources.length,0);
});

test('24ms simultaneous hits speak the highest accuracy once and duplicate IDs are player-local',t=>{
  const {clock,ac,feedback}=feedbackFixture(t);
  assert.equal(feedback.hit(event('same',1,0)),true);assert.equal(feedback.hit(event('same',1,0)),false);
  assert.equal(feedback.hit(event('same',4,1)),true);assert.equal(clock.pending.size,1);assert.equal([...clock.pending.values()][0].delay,24);
  clock.flush();assert.equal(ac.sources.length,1);assert.equal(ac.sources[0].buffer.key,'yummy');assert.equal(ac.sources[0].starts.length,1);
});

test('busy praise skips intervening hits without a delayed queue and resumes after ended',t=>{
  const {clock,ac,feedback}=feedbackFixture(t);feedback.hit(event('a'));clock.flush();
  feedback.hit(event('b',2));assert.equal(clock.pending.size,0);assert.equal(ac.sources.length,1);
  ac.sources[0].end();assert.equal(feedback.activeVoice,null);clock.flush();assert.equal(ac.sources.length,1);
  feedback.hit(event('c',1));clock.flush();assert.equal(ac.sources.length,2);assert.equal(ac.sources[1].buffer.key,'great');
});

test('voice disable, volume zero and coach/phase gate suppress speech without changing a hit',t=>{
  let enabled=true,volume=.7,allowed=true;
  const {clock,ac,feedback}=feedbackFixture(t,{voiceEnabled:()=>enabled,voiceVolume:()=>volume,canSpeak:()=>allowed});
  enabled=false;assert.equal(feedback.hit(event('off')),true);
  enabled=true;volume=0;assert.equal(feedback.hit(event('zero')),true);
  volume=.7;allowed=false;assert.equal(feedback.hit(event('coach')),true);
  assert.equal(clock.pending.size,0);assert.equal(ac.sources.length,0);
  allowed=true;feedback.hit(event('pending'));allowed=false;clock.flush();assert.equal(ac.sources.length,0,'gate is checked again when the collection window ends');
});

test('stop cancels pending speech and a retained old callback cannot play after the session ends',t=>{
  const {clock,ac,feedback}=feedbackFixture(t);feedback.hit(event());const delayed=[...clock.pending.values()][0].callback;
  feedback.stop();assert.equal(clock.pending.size,0);assert.equal(feedback.pending,null);delayed();assert.equal(ac.sources.length,0);
  assert.equal(feedback.hit(event()),true,'a fresh session may reuse its chart IDs');clock.flush();assert.equal(ac.sources.length,1);
});

test('late ended from stopped speech cannot clear the current session voice',t=>{
  const {clock,ac,feedback}=feedbackFixture(t);feedback.hit(event('old'));clock.flush();const old=ac.sources[0];
  feedback.stop();assert.equal(old.stops.length,1);assert.ok(old.disconnected);
  feedback.hit(event('new',2));clock.flush();const active=feedback.activeVoice;
  old.end();assert.equal(feedback.activeVoice,active);assert.equal(feedback.nodes.has(active.source),true);
  active.source.end();assert.equal(feedback.activeVoice,null);assert.equal(feedback.nodes.size,0);
});

test('cyber impacts use three local layers, bounded eight-burst overlap and two-player stereo',t=>{
  const {ac,feedback}=feedbackFixture(t,{effectVolume:()=>1,voiceEnabled:()=>false,players:()=>2});
  for(let i=0;i<9;i++)feedback.hit(event(`rapid-${i}`,i%5,i%2));
  assert.equal(ac.sources.length,24);assert.equal(feedback.bursts.size,8);assert.equal(feedback.nodes.size,24);assert.equal(ac.buffers.length,1,'noise buffer is reused');
  assert.deepEqual(ac.panners.map(p=>p.pan.value),[-.5,.5,-.5,.5,-.5,.5,-.5,.5]);
  assert.ok(ac.sources.every(n=>n.starts.length===1&&n.stops.length===1));
  for(const source of [...ac.sources])source.end();assert.equal(feedback.bursts.size,0);assert.equal(feedback.nodes.size,0);
  feedback.hit(event('after-ended'));assert.equal(ac.sources.length,27);
  feedback.stop();assert.equal(feedback.bursts.size,0);assert.equal(feedback.nodes.size,0);assert.ok(ac.sources.every(n=>n.disconnected));
});

test('overlapping impacts attenuate the shared bus and a stopped bus cannot affect the new session (RF02)',t=>{
  const {ac,feedback}=feedbackFixture(t,{effectVolume:()=>1,voiceEnabled:()=>false});
  feedback.hit(event('a'));const firstMaster=feedback.master.node;near(firstMaster.gain.value,1);
  feedback.hit(event('b'));near(firstMaster.gain.value,1/Math.sqrt(2));
  for(const source of ac.sources.slice(0,3))source.end();near(firstMaster.gain.value,1);
  const remaining=ac.sources.slice(3);feedback.stop();assert.equal(feedback.master,null);assert.ok(firstMaster.disconnected);
  feedback.hit(event('new'));const newMaster=feedback.master.node;assert.notEqual(newMaster,firstMaster);
  for(const source of remaining)source.end();assert.equal(feedback.master.node,newMaster);assert.equal(newMaster.disconnected,undefined);near(newMaster.gain.value,1);
});

test('local praise decoding prepares buffers without scheduling sound and concurrent callers share work',async t=>{
  const ac=audioMock(),feedback=new SaberFeedback({getContext:()=>ac}),requests=[],manifest={cues:Object.fromEntries(HIT_GRADES.map(g=>[g.key,{file:`/audio/praise/${g.key}.ogg`}]))};
  t.mock.method(globalThis,'fetch',async url=>{requests.push(url);return {ok:true,json:async()=>manifest,arrayBuffer:async()=>new ArrayBuffer(5)};});
  assert.deepEqual(await Promise.all([feedback.prepare(),feedback.prepare()]),[true,true]);
  assert.equal(requests.length,6);assert.equal(feedback.buffers.size,5);assert.equal(ac.sources.length,0);
  assert.equal(await feedback.prepare(),true);assert.equal(requests.length,6);assert.equal(ac.sources.length,0);
});

test('starting while the initial preload is partial eventually decodes all five available voices (RF01)',async t=>{
  const ac=audioMock(),feedback=new SaberFeedback({getContext:()=>ac}),delayed=[],manifest={cues:Object.fromEntries(HIT_GRADES.map(g=>[g.key,{file:`/audio/praise/${g.key}.ogg`}]))};
  t.mock.method(globalThis,'fetch',async url=>({ok:true,json:async()=>manifest,arrayBuffer:()=>url.endsWith('/good.ogg')?Promise.resolve(new ArrayBuffer(5)):new Promise(done=>delayed.push(done))}));
  const initial=feedback.load();await new Promise(setImmediate);
  assert.equal(feedback.encoded.size,1,'the first file is cached while the other four are loading');
  const preparing=feedback.prepare();await new Promise(setImmediate);
  for(const done of delayed)done(new ArrayBuffer(5));
  assert.equal(await initial,true);assert.equal(await preparing,true);assert.equal(feedback.buffers.size,5);assert.equal(ac.sources.length,0);
});

test('a malformed manifest cannot redirect sound fetches outside the five local cue paths',async t=>{
  const requested=[],ac=audioMock(),feedback=new SaberFeedback({getContext:()=>ac});
  t.mock.method(globalThis,'fetch',async url=>{requested.push(url);return {ok:true,json:async()=>({cues:{good:{file:'https://example.invalid/voice.ogg'},great:{file:'/audio/praise/../voice/great.ogg'}}})};});
  assert.equal(await feedback.prepare(),false);assert.deepEqual(requested,['/audio/praise/manifest.json']);assert.equal(ac.sources.length,0);
});

test('network and decode failure degrade to effects without delayed or rejected speech playback',async t=>{
  const ac=audioMock(),feedback=new SaberFeedback({getContext:()=>ac,effectVolume:()=>0});
  t.mock.method(globalThis,'fetch',async()=>{throw new Error('offline');});
  assert.equal(await feedback.prepare(),false);assert.equal(feedback.hit(event('no-file')),true);assert.equal(ac.sources.length,0);
  for(const grade of HIT_GRADES)feedback.encoded.set(grade.key,new ArrayBuffer(1));
  ac.decodeAudioData=async()=>{throw new Error('unsupported data');};
  assert.equal(await feedback.prepare(),false);assert.equal(feedback.hit(event('no-codec')),true);assert.equal(ac.sources.length,0);
});

test('stop during pending decoding cannot revive speech when decoding completes',async t=>{
  const {ac,feedback}=feedbackFixture(t);feedback.buffers.clear();
  const resolve=[];ac.decodeAudioData=()=>new Promise(done=>resolve.push(done));
  for(const grade of HIT_GRADES)feedback.encoded.set(grade.key,new ArrayBuffer(1));
  const preparing=feedback.prepare();feedback.stop();for(const done of resolve)done({decoded:true});
  assert.equal(await preparing,true);assert.equal(ac.sources.length,0);assert.equal(feedback.activeVoice,null);assert.equal(feedback.pending,null);
});

test('all five praise cues have exact grade names, unique verified local Oggs and disclosed fictional provenance',()=>{
  const root=new URL('../public/audio/praise/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('manifest.json',root)));
  assert.deepEqual(Object.keys(manifest.cues).sort(),HIT_GRADES.map(g=>g.key).sort());
  assert.equal(manifest.engine.networkRequired,false);assert.equal(manifest.engine.impersonation,false);assert.match(manifest.engine.name,/VoiceDesign/);
  const hashes=[];
  for(const grade of HIT_GRADES){
    const cue=manifest.cues[grade.key];assert.equal(cue.file,`/audio/praise/${grade.key}.ogg`);assert.equal(cue.text,`${grade.label}!`);
    const bytes=readFileSync(new URL(`${grade.key}.ogg`,root)),hash=createHash('sha256').update(bytes).digest('hex');
    assert.equal(bytes.subarray(0,4).toString(),'OggS');assert.equal(bytes.length,cue.bytes);assert.equal(hash,cue.sha256);hashes.push(hash);
    assert.equal(cue.channels,1);assert.equal(cue.sampleRate,24000);assert.ok(cue.durationSeconds>0&&cue.durationSeconds<2);
  }
  assert.equal(new Set(hashes).size,5);assert.equal(readdirSync(root).filter(f=>f.endsWith('.ogg')).length,5);
});
