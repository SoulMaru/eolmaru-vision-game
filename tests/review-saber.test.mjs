import test from 'node:test';
import assert from 'node:assert/strict';
import {validateChart,generateEasyChart,chartJSON} from '../src/saber-chart.mjs';
import {HandTracker,assignSaberPlayers,calibrationFromPose,poseHand,calibrationMoved,createHands} from '../src/saber-input.mjs';
import {SaberSession,segmentRect,intervalCoverage} from '../src/saber-core.mjs';
import {mirrorPose} from '../src/core.mjs';
import {SaberGame} from '../src/saber-game.mjs';

const near=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b}`);
const note=(changes={})=>({id:'n1',time:10,lineIndex:1,lineLayer:1,hand:'left',cutDirection:'right',...changes});
const raw=(notes=[note()],changes={})=>({schemaVersion:1,songId:'maru-flow',bpm:120,offsetSeconds:0,notes,...changes});
const chart=(notes=[note()],changes={})=>validateChart(raw(notes,changes));
let frameSerial=0,strokeSerial=0;
const sample=(x,y,t,changes={})=>({sessionId:'s1',inputEpoch:1,source:'test',player:0,hand:'left',x,y,capturedAtMs:t*1000,audioTimeSeconds:t,confidence:1,frameId:++frameSerial,valid:true,...changes});
function segment(a,b,changes={}){return {from:a,to:b,strokeId:`fixture-${++strokeSerial}`,strokeDistance:Math.hypot(b.x-a.x,b.y-a.y),...changes};}
const crossing=(changes={},strokeId)=>segment(sample(.8,1.5,9.95,changes),sample(2.2,1.5,10.05,changes),strokeId?{strokeId}:{});

test('saber chart copies, sorts, normalizes microseconds and deeply freezes the playable data',()=>{
  const source=raw([note({id:'later',time:12.0000004}),note({id:'first',time:10.0000004})]),saved=structuredClone(source);
  const result=validateChart(source);
  assert.deepEqual(source,saved);assert.deepEqual(result.notes.map(n=>n.id),['first','later']);
  assert.equal(result.notes[0].timeUs,10000000);assert.equal(result.notes[0].time,10);
  assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.notes)&&result.notes.every(Object.isFrozen));
  assert.throws(()=>{result.notes[0].hand='right';},TypeError);
});

test('microsecond note groups enforce two beats globally, including the one-microsecond tolerance',()=>{
  assert.doesNotThrow(()=>chart([note(),note({id:'n2',time:10.999999,hand:'right',lineIndex:2})]));
  assert.throws(()=>chart([note(),note({id:'n2',time:10.999998,hand:'right',lineIndex:2})]));
  const simultaneous=chart([note({time:10.0000001}),note({id:'n2',time:10.0000004,hand:'right',lineIndex:2})]);
  assert.equal(simultaneous.notes[0].timeUs,simultaneous.notes[1].timeUs);
  assert.throws(()=>chart([note(),note({id:'n2',time:10.000001,hand:'right',lineIndex:2})]));
  assert.throws(()=>chart([note(),note({id:'n2',hand:'left',lineIndex:2})]));
  assert.throws(()=>chart([note(),note({id:'n2',hand:'right'})]));
  assert.throws(()=>chart([note(),note({id:'n2',hand:'right',lineIndex:2}),note({id:'n3',hand:'right',lineIndex:3})]));
});

test('effective hit/spawn times respect offsets, full lead time and the final one-second margin',()=>{
  const delayed=chart([note({time:2})],{offsetSeconds:.1});near(delayed.notes[0].hitTime,2.1);near(delayed.notes[0].spawnTime,.3);
  assert.doesNotThrow(()=>chart([note({time:2})],{offsetSeconds:-.2}));
  assert.throws(()=>chart([note({time:2})],{offsetSeconds:-.20001}));
  assert.doesNotThrow(()=>chart([note({time:148.5})],{offsetSeconds:.5}));
  assert.throws(()=>chart([note({time:148.5})],{offsetSeconds:.50001}));
  assert.throws(()=>chart([note({time:-1})],{offsetSeconds:10}));
  assert.throws(()=>chart([note({time:151})],{offsetSeconds:-10}));
});

test('invalid chart shapes, types, enums, song ownership and oversized data fail before use',()=>{
  for(const input of [null,[],42,'{',raw([]),raw([note(),note()]),raw([note()],{schemaVersion:2}),raw([note()],{bpm:'120'}),raw([note()],{offsetSeconds:Infinity})])assert.throws(()=>validateChart(input));
  for(const patch of [{lineIndex:1.5},{lineIndex:4},{lineLayer:-1},{lineLayer:3},{hand:'screen-left'},{cutDirection:'diagonal'},{time:NaN},{id:'<b>bad</b>'}])assert.throws(()=>chart([note(patch)]));
  assert.throws(()=>validateChart(raw(),{songId:'another-song'}));
  assert.throws(()=>validateChart(raw(Array.from({length:2001},(_,i)=>note({id:`n${i}`})))));
  assert.throws(()=>validateChart({...raw(),ignored:'가'.repeat(400000)}));
  assert.equal(validateChart(raw([]),{allowEmpty:true}).notes.length,0,'an explicitly empty editor draft remains possible');
});

test('generated easy charts support duration and BPM endpoints and survive editor JSON round-trips',()=>{
  for(const duration of [120,150,180])for(const bpm of [40,112,240])for(const offsetSeconds of [-.25,0,.25]){
    const generated=generateEasyChart({duration,bpm,offsetSeconds});
    assert.ok(generated.notes.length>0&&generated.notes.length<=2000);
    assert.ok(generated.notes.every(n=>n.spawnTime>=0&&n.hitTime<=duration-1));
    assert.deepEqual(validateChart(JSON.stringify(chartJSON(generated)),{duration}),generated);
  }
});

test('segment collision finds outside-to-outside crossing, parallel misses and boundary contact',()=>{
  const box={left:1,right:2,top:1,bottom:2};
  assert.deepEqual(segmentRect({x:0,y:1.5},{x:3,y:1.5},box),{enter:1/3,exit:2/3});
  assert.equal(segmentRect({x:0,y:.5},{x:3,y:.5},box),null);
  assert.deepEqual(segmentRect({x:0,y:1},{x:1,y:1},box),{enter:1,exit:1});
  assert.equal(segmentRect({x:0,y:0},{x:0,y:0},box),null);
});

test('swept cuts use the crossing time inside the window even when the newest sample arrives outside it',()=>{
  const session=new SaberSession(chart());
  const late=segment(sample(.9,1.5,10.2),sample(1.5,1.5,10.3));
  const result=session.observe(late,10.3);
  assert.equal(result?.kind,'hit');near(result.time,10.24);
  assert.equal(session.observe(late,10.31),null);assert.equal(session.summary().hit,1);
});

test('spatial intersections are clipped to the timing window instead of counting an early pass',()=>{
  const earlySession=new SaberSession(chart());
  const earlyPass=segment(sample(1.5,1.5,9.6),sample(2.2,1.5,9.8));
  assert.equal(earlySession.observe(earlyPass,9.8),null,'spatial exit is before the timing window');
  const clipped=new SaberSession(chart());
  const stillCrossing=segment(sample(1.2,1.5,9.7),sample(1.7,1.5,9.9));
  const event=clipped.observe(stillCrossing,9.9);assert.equal(event?.kind,'hit');near(event.time,9.75);
});

test('direction, anatomical hand and free-direction notes have distinct cut outcomes',()=>{
  assert.equal(new SaberSession(chart()).observe(crossing(),10.05)?.kind,'hit');
  assert.equal(new SaberSession(chart()).observe(crossing({hand:'right'}),10.05)?.kind,'wrongCut');
  const reverse=segment(sample(2.2,1.5,9.95),sample(.8,1.5,10.05));
  assert.equal(new SaberSession(chart()).observe(reverse,10.05)?.kind,'wrongCut');
  assert.equal(new SaberSession(chart([note({cutDirection:'any'})])).observe(reverse,10.05)?.kind,'hit');
  const still=segment(sample(1.5,1.5,9.95),sample(1.5,1.5,10.05));
  assert.equal(new SaberSession(chart([note({cutDirection:'any'})])).observe(still,10.05),null);
});

test('early, late, implausibly fast and tiny motions cannot consume a note',()=>{
  const session=new SaberSession(chart());
  for(const [a,b,arrival] of [
    [sample(.8,1.5,9.5),sample(2.2,1.5,9.6),9.6],
    [sample(.8,1.5,10.3),sample(2.2,1.5,10.4),10.4],
    [sample(-5,1.5,9.95),sample(5,1.5,10.05),10.05],
    [sample(1.5,1.5,9.95),sample(1.52,1.5,10.05),10.05],
  ])assert.equal(session.observe(segment(a,b),arrival),null);
  assert.equal(session.states.size,0);
});

test('one stroke consumes at most one note and each player owns a separate terminal map',()=>{
  const shared=chart([note(),note({id:'n2',time:10.5})],{bpm:240}),p1=new SaberSession(shared,0),p2=new SaberSession(shared,1);
  assert.equal(p1.observe(crossing({},'same-stroke'),10.05)?.id,'n1');
  const next=segment(sample(.8,1.5,10.45),sample(2.2,1.5,10.55),{strokeId:'same-stroke'});
  assert.equal(p1.observe(next,10.55),null);assert.equal(p1.states.has('n2'),false);
  assert.equal(p1.observe({...next,strokeId:'new-stroke'},10.55)?.id,'n2');
  assert.equal(p2.states.size,0);assert.equal(p2.observe(crossing({player:1}),10.05)?.kind,'hit');
  assert.equal(p1.observe(crossing({player:1}),10.05),null);assert.notEqual(p1.states,p2.states);
});

test('two simultaneous blocks remain independently cuttable by all four hands across two players',()=>{
  const shared=chart([note(),note({id:'right-note',hand:'right',lineIndex:2,cutDirection:'left'})]);
  const players=[new SaberSession(shared,0),new SaberSession(shared,1)];
  for(const player of [0,1]){
    const left=segment(sample(.8,1.5,9.95,{player}),sample(2,1.5,10.05,{player}));
    const right=segment(sample(3.2,1.5,9.95,{player,hand:'right'}),sample(2,1.5,10.05,{player,hand:'right'}));
    assert.equal(players[player].observe(left,10.05)?.kind,'hit');
    assert.equal(players[player].observe(right,10.05)?.kind,'hit');
    assert.equal(players[player].summary().hit,2);
  }
});

test('overlapping observation intervals use a clipped union, not duplicated lengths',()=>{
  near(intervalCoverage([[9,9.9],[9.8,10.05],[10,10.15],[10.1,10.15],[12,13]],9.75,10.25),.8);
  assert.equal(intervalCoverage([[1,2]],3,4),0);assert.equal(intervalCoverage([[0,10]],3,4),1);
});

function observeCoverage(session,start,end,hand='left'){
  for(let from=start;from<end-1e-10;){const to=Math.min(end,from+.1);session.observe(segment(sample(0,0,from,{hand}),sample(0,0,to,{hand})),to);from=to;}
}

test('pending notes finalize only after grace with the exact 80-percent required-hand coverage policy',()=>{
  for(const [end,kind] of [[10.149999,'untracked'],[10.15,'miss'],[10.150001,'miss']]){
    const session=new SaberSession(chart());observeCoverage(session,9.75,end);
    assert.deepEqual(session.advance(10.7),[]);assert.equal(session.states.size,0);
    const terminal=session.advance(10.70001);assert.equal(terminal.length,1);assert.equal(terminal[0].kind,kind);
    assert.deepEqual(session.advance(11),[]);assert.equal(session.observe(crossing(),11),null);
  }
  const wrongHandOnly=new SaberSession(chart());observeCoverage(wrongHandOnly,9.75,10.25,'right');
  assert.equal(wrongHandOnly.advance(10.71)[0].kind,'untracked');
});

test('short tracking loss is not terminal and a valid return can cut before finalization',()=>{
  const session=new SaberSession(chart());observeCoverage(session,9.75,9.85);
  assert.deepEqual(session.advance(10.3),[]);
  const returnCut=segment(sample(.9,1.5,10.2),sample(1.5,1.5,10.3));
  assert.equal(session.observe(returnCut,10.45)?.kind,'hit');
  assert.deepEqual(session.advance(10.71),[]);
});

test('a practice seek skips old notes without invented results or resurrecting previous cuts',()=>{
  const session=new SaberSession(chart([note(),note({id:'later',time:12})]));session.observe(crossing(),10.05);
  session.seek(11);assert.equal(session.states.get('n1').kind,'skipped');
  assert.deepEqual(session.summary(),{hit:0,wrongCut:0,miss:0,untracked:0,total:2});
  assert.equal(session.observe(crossing(),11),null);assert.equal(session.states.has('later'),false);
});

test('tracker first sample, duplicate frame, epoch/session/hand/source changes never bridge trajectories',()=>{
  for(const changed of [{inputEpoch:2},{sessionId:'s2'},{hand:'right'},{player:1},{source:'camera'}]){
    const tracker=new HandTracker(),first=sample(0,1.5,9.9);assert.equal(tracker.push(first),null);
    assert.equal(tracker.push({...first,x:4}),null);
    assert.equal(tracker.push(sample(2,1.5,10,changed)),null);
    assert.ok(tracker.push(sample(2.2,1.5,10.1,changed)));
    tracker.reset();assert.equal(tracker.display().valid,false);
    assert.equal(tracker.push(sample(2.5,1.5,10.2,changed)),null);
  }
});

test('tracker bounds time gaps and movement, resets after loss and keeps only a bounded display trail',()=>{
  for(const gap of [0,-.01,.20001]){const t=new HandTracker();t.push(sample(0,0,10));assert.equal(t.push(sample(.1,0,10+gap)),null);}
  const edge=new HandTracker();edge.push(sample(0,0,10));assert.ok(edge.push(sample(.1,0,10.2)));
  assert.equal(edge.push(sample(100,0,10.3)),null);
  edge.missing();assert.equal(edge.push(sample(2,0,10.4)),null);
  const trail=new HandTracker();for(let i=0;i<100;i++)trail.push(sample(i*.02,0,10+i*.02));
  assert.ok(trail.display().trail.length<=18);assert.ok(trail.display().trail.every(p=>11.98-p.t<=.22000001));
});

test('invalid confidence never creates a continuous input or an observed cut (SB1)',()=>{
  for(const confidence of [NaN,Infinity,-Infinity,1.01,.1]){
    const tracker=new HandTracker();tracker.push(sample(.8,1.5,9.95));
    assert.equal(tracker.push(sample(2.2,1.5,10.05,{confidence})),null);
    const session=new SaberSession(chart());
    assert.equal(session.observe(crossing({confidence}),10.05),null);
    assert.equal(session.observed.left.length,0);
  }
});

test('sessions reject segments that cross a player/hand/epoch boundary or stale arrival limit',()=>{
  for(const patch of [{player:1},{hand:'right'},{inputEpoch:2},{sessionId:'s2'},{source:'camera'},{valid:false}]){
    const a=sample(.8,1.5,9.95),b=sample(2.2,1.5,10.05,patch),session=new SaberSession(chart());
    assert.equal(session.observe(segment(a,b),10.05),null);assert.equal(session.states.size,0);
  }
  assert.equal(new SaberSession(chart()).observe(crossing(),10.70001),null);
});

function person(cx=.5){
  const p=Array.from({length:33},()=>({x:cx,y:.5,visibility:1}));
  p[11]={x:cx-.1,y:.3,visibility:1};p[12]={x:cx+.1,y:.3,visibility:1};
  p[23]={x:cx-.06,y:.65,visibility:1};p[24]={x:cx+.06,y:.65,visibility:1};
  p[15]={x:cx+.15,y:.5,visibility:1};p[16]={x:cx-.15,y:.5,visibility:1};return p;
}

test('saber slots reject ambiguous occupants while mirroring preserves anatomical wrist ownership',()=>{
  const l=person(.25),r=person(.75);
  assert.deepEqual(assignSaberPlayers([r,l],2),[l,r]);
  assert.deepEqual(assignSaberPlayers([l,person(.3)],2),[null,null]);
  assert.deepEqual(assignSaberPlayers([person(.5)],2),[null,null]);
  const mirrored=mirrorPose(person()),calibration=calibrationFromPose(mirrored);
  const left=poseHand(mirrored,'left',calibration),right=poseHand(mirrored,'right',calibration);
  assert.ok(left.x<right.x,'indices retain hand ownership when x is mirrored');
  const hands=createHands();assert.notEqual(hands.left,hands.right);
});

test('calibration keeps x/y angular units equal and detects substantial body relocation',()=>{
  for(const aspect of [4/3,16/9]){
    const p=person(),c=calibrationFromPose(p,aspect);
    p[15]={x:c.cx/aspect,y:c.cy,visibility:1};const a=poseHand(p,'left',c);
    p[15].x+=.05/aspect;p[15].y+=.05;const b=poseHand(p,'left',c);
    near(b.x-a.x,b.y-a.y);assert.equal(calibrationMoved(p,c),false);
    const moved=p.map(point=>({...point,x:point.x+.3}));assert.equal(calibrationMoved(moved,c),true);
  }
});

test('the same slow real trajectory cuts once at 8, 12 and 20 Hz rather than depending on per-frame distance',()=>{
  for(const hz of [8,12,20]){
    const tracker=new HandTracker(),session=new SaberSession(chart());let hits=0;
    for(let i=0;i<=hz;i++){
      const t=9.5+i/hz,part=tracker.push(sample(1.5+(t-10),1.5,t));
      if(session.observe(part,t)?.kind==='hit')hits++;
    }
    assert.equal(hits,1,`${hz} Hz`);assert.equal(session.summary().hit,1);
    const still=new HandTracker(),untouched=new SaberSession(chart());
    for(let i=0;i<=hz;i++){const t=9.5+i/hz;assert.equal(untouched.observe(still.push(sample(1.5,1.5,t)),t),null);}
    assert.equal(untouched.states.size,0);
  }
});

test('a dropped frame beyond the maximum continuous gap cannot create a phantom sweep',()=>{
  const tracker=new HandTracker(),session=new SaberSession(chart());tracker.push(sample(0,1.5,9.9));
  const gap=tracker.push(sample(3,1.5,10.15));assert.equal(gap,null);assert.equal(session.observe(gap,10.15),null);
  assert.equal(session.observe(tracker.push(sample(3,1.5,10.2)),10.2),null);assert.equal(session.states.size,0);
});

test('a frozen music clock cannot consume blocks while the audio is waiting',()=>{
  const session=new SaberSession(chart());
  const a=sample(.8,1.5,10),b=sample(2.2,1.5,10,{capturedAtMs:10100});
  assert.equal(session.observe(segment(a,b),10),null);
  assert.equal(session.states.size,0);
  const tracker=new HandTracker();assert.equal(tracker.push(a),null);assert.equal(tracker.push(b),null);
});

function gameFixture(t){
  const prior=globalThis.window;globalThis.window={addEventListener(){}};
  t.after(()=>{if(prior===undefined)delete globalThis.window;else globalThis.window=prior;});
  const state={phase:'idle',input:'keyboard',players:1,latency:0,range:1},listeners=new Map(),sounds=[];
  const audio={currentTime:0,addEventListener(type,listener){listeners.set(type,listener);},dispatch(type){listeners.get(type)?.();}};
  const game=new SaberGame({stage:{addEventListener(){}},audio,phase:()=>state.phase,players:()=>state.players,input:()=>state.input,notice(){},onHit:event=>sounds.push(event),latency:()=>state.latency,range:()=>state.range,quality:()=> 'low'});
  game.setChart(chart());return {game,state,audio,sounds};
}

test('mode/chart reconfiguration cancels an in-progress five-second calibration',t=>{
  const {game,state}=gameFixture(t);state.input='camera';game.beginCalibration();
  assert.ok(game.calibrationTask);game.configure();assert.equal(game.calibrationTask,null);
});

test('game phase reset discards paused movements and prevents a resume sweep or duplicate sound',t=>{
  const {game,state,audio,sounds}=gameFixture(t);game.start();state.phase='playing';
  audio.currentTime=9.9;game.sample(0,'left',{x:.8,y:1.5},9900,9.9,'test',1);
  state.phase='paused';game.resetInput();
  game.sample(0,'left',{x:2.2,y:1.5},9950,9.9,'test',2);assert.equal(game.sessions[0].states.size,0);
  state.phase='playing';game.resetInput();audio.currentTime=10;
  game.sample(0,'left',{x:2.2,y:1.5},10000,10,'test',3);assert.equal(game.sessions[0].states.size,0);
  audio.currentTime=10.1;game.sample(0,'left',{x:.8,y:1.5},10100,10.1,'test',4);
  assert.equal(game.sessions[0].counts.wrongCut,1);assert.equal(sounds.length,0);
  game.start();assert.equal(game.sessions[0].states.size,0);assert.equal(game.hands[0].left.display().valid,false);
});

test('chart import is atomic and input latency remains separate from chart offset',t=>{
  const {game,state,audio}=gameFixture(t),prior=game.chart;
  assert.throws(()=>game.importChart('{',{duration:150,songId:'maru-flow'}));assert.equal(game.chart,prior);
  assert.throws(()=>game.importChart(JSON.stringify(raw()),{duration:150,songId:'different'}));assert.equal(game.chart,prior);
  game.setChart(chart([note()],{offsetSeconds:.1}));state.latency=.1;state.phase='playing';
  audio.currentTime=10.2;game.sample(0,'left',{x:.8,y:1.5},10000,10.15,'test',1);
  game.sample(0,'left',{x:2.2,y:1.5},10100,10.25,'test',2);
  assert.equal(game.sessions[0].counts.hit,1);near(game.chart.notes[0].hitTime,10.1);
  near(game.hands[0].left.display().trail.at(-1).t,10.15);
});

test('camera loss and reappearance clear only the affected players hand histories',t=>{
  const {game,state,audio}=gameFixture(t);state.input='camera';state.players=2;state.phase='playing';
  const p1=person(.25),p2=person(.75);audio.currentTime=9.9;
  game.camera([p1,p2],4/3,9900,9.9);assert.ok(game.calibrations.every(Boolean));
  game.camera([p2],4/3,10000,10);assert.equal(game.calibrations[0],null);
  assert.equal(game.hands[0].left.display().valid,false);assert.equal(game.hands[1].left.display().valid,true);
  audio.currentTime=10.1;game.camera([p1,p2],4/3,10100,10.1);
  assert.equal(game.hands[0].left.display().trail.length,1);assert.equal(game.sessions[0].states.size,0);
});

test('a normal 650ms rendering stall does not erase earlier session outcomes',t=>{
  const {game,state,audio}=gameFixture(t);state.phase='playing';state.input='camera';
  audio.currentTime=10.05;game.sessions[0].observe(crossing(),10.05);game.tick(10050);
  assert.equal(game.sessions[0].counts.hit,1);
  audio.currentTime=10.7;game.tick(10700);
  assert.equal(game.sessions[0].counts.hit,1);assert.equal(game.sessions[0].states.get('n1').kind,'hit');
});

test('successful comfortable-range calibration stays isotropic and fixed until body relocation',t=>{
  const {game,state}=gameFixture(t);state.input='camera';const p=person();
  game.camera([p],4/3,1000,0);const base={...game.calibrations[0]};
  const points=Array.from({length:40},(_,i)=>({x:base.anchorX+(i%2? .4:-.4),y:i%4<2?.3:.9}));
  game.calibrationTask={points:[points,[]],until:0};game.finishCalibration();
  const calibrated={...game.calibrations[0]};near(calibrated.cell,.2);near(calibrated.cy,.6);
  assert.equal(game.calibrationTask,null);assert.equal(game.hands[0].left.display().valid,false);
  game.camera([p],4/3,1100,0);assert.deepEqual(game.calibrations[0],calibrated);
  game.forgetCamera();state.range=.65;game.camera([p],4/3,1200,0);near(game.calibrations[0].cell,base.cell*.65);
});

test('an explicit audio seek clears trajectories and skips historical notes without replaying effects',t=>{
  const {game,state,audio,sounds}=gameFixture(t);state.phase='playing';state.input='camera';
  game.setChart(chart([note(),note({id:'later',time:12})]));
  audio.currentTime=10.05;game.sample(0,'left',{x:.8,y:1.5},9950,9.95,'camera',1);
  game.sample(0,'left',{x:2.2,y:1.5},10050,10.05,'camera',2);
  assert.equal(game.sessions[0].counts.hit,1);assert.equal(sounds.length,1);
  audio.currentTime=11;audio.dispatch('seeking');
  assert.equal(game.sessions[0].states.get('n1').kind,'skipped');assert.equal(game.sessions[0].states.has('later'),false);
  assert.equal(game.sessions[0].counts.hit,0);assert.equal(game.hands[0].left.display().valid,false);assert.equal(game.effects.length,0);
  game.tick(11000);assert.equal(sounds.length,1);
});
