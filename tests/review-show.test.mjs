import test from 'node:test';
import assert from 'node:assert/strict';
import {generateShowChart,showMoment,makeCueEvents,CueCursor,RhythmAudio} from '../src/show.mjs';
import {FullscreenController} from '../src/fullscreen.mjs';
import {drawRhythmShow} from '../src/show-render.mjs';
import {createScore,judgeHit} from '../src/core.mjs';

const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} differs from ${expected}`);
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('show chart fits every supported tempo/song endpoint with eight-beat calls and two-beat response spacing',()=>{
  for(const bpm of [40,112,240])for(const duration of [120,150,180]){
    const beat=60/bpm,chart=generateShowChart({bpm,duration});
    assert.ok(chart.length>0);
    assert.equal(new Set(chart.map(n=>n.id)).size,chart.length);
    assert.equal(new Set(chart.map(n=>n.lane)).size,4);
    assert.ok(new Set(chart.map(n=>n.pattern)).size>1);
    chart.forEach((note,i)=>{
      assert.ok(note.demoTime>=0&&note.time<duration-2);
      near(note.time-note.demoTime,8*beat);
      const local=note.time/beat-note.phrase*16;
      assert.ok(local>=8-1e-8&&local<16);
      if(i)assert.ok(note.time-chart[i-1].time>=2*beat-1e-8);
    });
  }
});

test('show chart rejects invalid clock inputs rather than allocating an unbounded chart',()=>{
  for(const bpm of [0,39.99,240.01,NaN,Infinity,'112'])assert.throws(()=>generateShowChart({bpm}));
  for(const duration of [0,-1,NaN,Infinity,'150'])assert.throws(()=>generateShowChart({duration}));
});

test('act and call-response phases follow song time exactly, including pause and repeat calculations',()=>{
  assert.deepEqual(showMoment(10),showMoment(10));
  for(const [time,act] of [[0,0],[49.999,0],[50,1],[99.999,1],[100,2],[150,2],[500,2]])assert.equal(showMoment(time,120,150).act,act);
  assert.equal(showMoment(3.999,120).demonstrating,true);
  assert.equal(showMoment(4,120).demonstrating,false);
  assert.equal(showMoment(8,120).demonstrating,true);
  assert.equal(showMoment(-.2,120).phrase,0);
});

test('every note has one ordered local demonstration and response cue; scoring remains independent per player',()=>{
  const chart=generateShowChart(),events=makeCueEvents(chart),p1=createScore(),p2=createScore();
  assert.equal(events.length,chart.length*2);
  assert.equal(new Set(events.map(e=>e.id)).size,events.length);
  assert.ok(events.every((e,i)=>!i||e.time>=events[i-1].time));
  for(const note of chart){
    assert.deepEqual(events.filter(e=>e.id===`d${note.id}`).map(e=>[e.time,e.lane,e.kind]),[[note.demoTime,note.lane,'demo']]);
    assert.deepEqual(events.filter(e=>e.id===`n${note.id}`).map(e=>[e.time,e.lane,e.kind]),[[note.time,note.lane,'target']]);
  }
  const first=chart[0];assert.ok(judgeHit(chart,p1,first.lane,first.time));
  assert.equal(judgeHit(chart,p1,first.lane,first.time),null);
  assert.equal(p2.hits.size,0);assert.ok(judgeHit(chart,p2,first.lane,first.time));
});

test('cue cursor emits a lookahead event only once while frames repeat or overlap',()=>{
  const cursor=new CueCursor(),events=[0,.1,.2,1].map((time,id)=>({id,time}));
  assert.deepEqual(cursor.take(events,0).map(e=>e.id),[0,1]);
  assert.deepEqual(cursor.take(events,0),[]);
  assert.deepEqual(cursor.take(events,.05),[]);
  assert.deepEqual(cursor.take(events,.1).map(e=>e.id),[2]);
  assert.deepEqual(cursor.take(events,.2),[]);
});

test('cue cursor drops skipped history and reanchors backward seeks without a burst of stale cues',()=>{
  const cursor=new CueCursor(),events=[0,1,2,3,4].map((time,id)=>({id,time}));
  cursor.take(events,0);
  assert.deepEqual(cursor.take(events,3.05),[]);
  assert.deepEqual(cursor.take(events,3.9).map(e=>e.id),[4]);
  assert.deepEqual(cursor.take(events,.95).map(e=>e.id),[1]);
  assert.deepEqual(cursor.take(events,1),[]);
  cursor.reset();assert.deepEqual(cursor.take(events,2).map(e=>e.id),[2]);
  for(const time of [NaN,Infinity,-.1])assert.deepEqual(cursor.take(events,time),[]);
});

function soundFixture(){
  const nodes=[];
  const parameter={setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}};
  const context={state:'running',currentTime:10,destination:{},
    createOscillator(){const node={frequency:parameter,stops:[],connect(){},disconnect(){this.disconnected=true;},start(at){this.at=at;},stop(...args){this.stops.push(args);}};nodes.push(node);return node;},
    createGain(){return {gain:parameter,connect(){},disconnect(){}};}};
  const audio=new RhythmAudio();audio.context=context;return {audio,nodes};
}

test('local cue scheduling uses audio-clock delay and stop cancels all future sounds without leaking old ended callbacks',()=>{
  const {audio,nodes}=soundFixture();audio.events=[{id:'a',time:1.1,lane:'left',kind:'demo'}];
  audio.tick(1,.65);assert.equal(nodes.length,1);near(nodes[0].at,10.1);
  audio.tick(1.01,.65);assert.equal(nodes.length,1);
  audio.stop();assert.deepEqual(nodes[0].stops.at(-1),[]);assert.equal(audio.voices.size,0);
  audio.tick(1,.65);assert.equal(nodes.length,2);nodes[0].onended();
  assert.equal(audio.voices.size,1,'late completion of an old node must not erase a new voice');
  nodes[1].onended();assert.equal(audio.voices.size,0);
  audio.tone('left','hit',0,0);assert.equal(nodes.length,2);
});

test('small backward clock adjustment cancels already scheduled cues before replay (S14)',()=>{
  const {audio,nodes}=soundFixture();audio.events=[{id:'a',time:1.1,lane:'left',kind:'demo'}];
  audio.tick(1,.65);audio.tick(.98,.65);
  assert.deepEqual(nodes[0].stops.at(-1),[],'old lookahead sound must be stopped when cursor rewinds');
  assert.equal(nodes.length,2);
  assert.equal(audio.voices.size,1);
});

function screenFixture({enabled=true,immediateExit=true}={}){
  const listeners=new Map(),requests=[],exits=[],changes=[];let userExits=0;
  const doc={fullscreenEnabled:enabled,fullscreenElement:null,
    addEventListener(type,fn){listeners.set(type,fn);},
    documentElement:{requestFullscreen(){return new Promise((resolve,reject)=>requests.push({resolve,reject}));}},
    exitFullscreen(){if(immediateExit){doc.fullscreenElement=null;listeners.get('fullscreenchange')?.();return Promise.resolve();}return new Promise(resolve=>exits.push(resolve));}};
  const controller=new FullscreenController({doc,onExit:()=>userExits++,onChange:(...args)=>changes.push(args)});
  const enter=i=>{doc.fullscreenElement=doc.documentElement;listeners.get('fullscreenchange')?.();requests[i].resolve();};
  const escape=()=>{doc.fullscreenElement=null;listeners.get('fullscreenchange')?.();};
  const completeExit=()=>{escape();exits.shift()?.();};
  return {doc,controller,requests,exits,changes,enter,escape,completeExit,get userExits(){return userExits;}};
}

test('actual fullscreen state and user ESC are distinct from layout and silent application exit',async()=>{
  const f=screenFixture();const first=f.controller.request();assert.equal(f.controller.pending,true);f.enter(0);
  assert.equal(await first,true);assert.equal(f.controller.pending,false);f.escape();assert.equal(f.userExits,1);
  const again=f.controller.request();f.enter(1);assert.equal(await again,true);
  await f.controller.exit();assert.equal(f.doc.fullscreenElement,null);assert.equal(f.userExits,1,'app exit must not trigger a second pause');
});

test('unsupported and rejected fullscreen requests resolve cleanly with a retryable state',async()=>{
  const unsupported=screenFixture({enabled:false});assert.equal(await unsupported.controller.request(),false);assert.equal(unsupported.requests.length,0);
  const f=screenFixture(),pending=f.controller.request();f.requests[0].reject(new Error('Denied'));
  assert.equal(await pending,false);assert.equal(f.controller.pending,false);assert.equal(f.changes.at(-1)[0],false);
  const retry=f.controller.request();f.enter(1);assert.equal(await retry,true);
});

test('cancelled fullscreen request that succeeds late exits without an unsolicited pause',async()=>{
  const f=screenFixture(),pending=f.controller.request();f.controller.cancelPending();f.enter(0);
  assert.equal(await pending,false);assert.equal(f.doc.fullscreenElement,null);assert.equal(f.userExits,0);assert.equal(f.controller.pending,false);
});

test('an old cancelled fullscreen request cannot close a newer desired request',async()=>{
  const f=screenFixture(),old=f.controller.request();f.controller.cancelPending();const latest=f.controller.request();
  f.enter(0);assert.equal(await old,false);assert.ok(f.doc.fullscreenElement);
  f.enter(1);assert.equal(await latest,true);assert.ok(f.doc.fullscreenElement);assert.equal(f.userExits,0);
});

test('a pending silent fullscreen exit must not report a new request as lasting success (S15)',async()=>{
  const f=screenFixture({immediateExit:false}),old=f.controller.request();f.controller.cancelPending();f.enter(0);await flush();
  assert.equal(f.exits.length,1);
  const latest=f.controller.request();
  f.completeExit();await old;await flush();
  // A controller may either decline a retry while exiting or request again after cleanup.
  if(f.requests.length>1)f.enter(1);
  const succeeded=await latest;
  assert.equal(succeeded,!!f.doc.fullscreenElement,'a settled successful request must still be fullscreen after stale exit');
});

test('two-player renderer clips independent scenes and preserves square example geometry in every act',()=>{
  for(const width of [280,840,1680])for(const time of [1,55,105]){
    const rects=[],robots=[],labels=[];let saved=0,clipped=0;
    const canvas=new Proxy({createLinearGradient:()=>({addColorStop(){}}),save(){saved++;},restore(){saved--;},rect(...r){rects.push(r);},clip(){clipped++;},fillText(s){labels.push(s);}},
      {get:(target,key)=>key in target?target[key]:(...args)=>{for(const n of args)if(typeof n==='number')assert.ok(Number.isFinite(n));},set:(target,key,value)=>(target[key]=value,true)});
    const state={players:2,phase:'playing',input:'keyboard',flash:[null,null],chart:generateShowChart(),scores:[createScore(),createScore()]};
    drawRhythmShow(canvas,width,500,{state,time,bpm:112,duration:150,now:10000,drawRobot:(c,p,x,y,w,h)=>robots.push({x,y,w,h}),reduced:true});
    assert.equal(saved,0);assert.equal(clipped,2);assert.equal(rects.length,2);assert.equal(robots.length,2);
    rects.forEach((r,i)=>{assert.equal(r[0],i*width/2);assert.equal(r[2],width/2);});
    robots.forEach((r,i)=>{assert.equal(r.w,r.h);assert.ok(r.x>=i*width/2&&r.x+r.w<=(i+1)*width/2);});
    assert.ok(labels.includes('P1')&&labels.includes('P2'));
    assert.equal(state.scores[0].hits.size+state.scores[1].hits.size,0,'drawing alone never awards a hit');
  }
});
