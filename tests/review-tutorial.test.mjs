import test from 'node:test';
import assert from 'node:assert/strict';
import {bassProfile} from '../src/saber-bass.mjs';
import {HIT_GRADES,SaberSession} from '../src/saber-core.mjs';
import {validateChart} from '../src/saber-chart.mjs';
import {HandTracker,poseHand} from '../src/saber-input.mjs';
import {SaberGame} from '../src/saber-game.mjs';
import {angleDelta,defaultBladeAngle,initialBladeAngle,nextBladeAngle,bladeGeometry,SWING_MAX_RADIANS_PER_SECOND} from '../src/saber-swing.mjs';
import {TUTORIAL_STEPS,TUTORIAL_BPM,TUTORIAL_LOOP,TutorialProgress,placementStatus,tutorialChart} from '../src/tutorial-core.mjs';
import {createTutorial} from '../src/tutorial.mjs';

const near=(a,b,epsilon=1e-8)=>assert.ok(Math.abs(a-b)<=epsilon,`${a} != ${b}`);
const graded=accuracy=>({grade:HIT_GRADES[Math.min(4,Math.floor(accuracy/20))],accuracy});

test('bass maps exactly grades 1/2, 3, and 4/5 to three distinct descending sine drums',()=>{
  const profiles=HIT_GRADES.map(grade=>bassProfile({grade}));
  assert.deepEqual(profiles.map(p=>p.group),[0,0,1,2,2]);
  assert.deepEqual(profiles.map(p=>p.key),['soft','soft','round','deep','deep']);
  assert.equal(new Set(profiles.map(p=>`${p.start}:${p.end}:${p.harmonic}`)).size,3);
  assert.ok(profiles.every(p=>p.body==='sine'&&p.start>p.end&&p.end>0&&p.duration===.3));
  assert.deepEqual(profiles.map(p=>p.accuracy),[10,30,50,70,90]);
});

test('bass continuous loudness rises inside tiers and across both timbre boundaries',()=>{
  let previous=-Infinity;
  for(const accuracy of [0,1,10,19.999999,20,30,39.999999,40,50,59.999999,60,70,79.999999,80,90,99,100]){
    const p=bassProfile(graded(accuracy));assert.ok(p.level>=previous,`${accuracy}%`);assert.ok(p.level>0&&p.level<=1);previous=p.level;
  }
  for(let tier=0;tier<5;tier++){
    const grade=HIT_GRADES[tier],a=bassProfile({grade,accuracy:tier*20+1}),b=bassProfile({grade,accuracy:tier*20+19});
    assert.ok(b.level>a.level,'accuracy is not collapsed into one volume per grade');
  }
});

test('bass rejects invalid grades, clamps valid accuracy, and cannot mutate shared voice definitions',()=>{
  for(const tier of [-1,5,1.5,NaN,Infinity,'2',undefined])assert.equal(bassProfile({grade:{tier}}),null);
  assert.equal(bassProfile(),null);
  const grade=HIT_GRADES[2];assert.equal(bassProfile({grade,accuracy:-20}).accuracy,0);assert.equal(bassProfile({grade,accuracy:200}).accuracy,100);
  for(const accuracy of [NaN,Infinity,undefined,'50'])assert.equal(bassProfile({grade,accuracy}).accuracy,50);
  const first=bassProfile({grade});first.start=999;assert.equal(bassProfile({grade}).start,138);
});

test('arm rotation preserves the observed tip and blade length at every angle and display size',()=>{
  for(const cell of [24,100,300])for(const hand of ['left','right'])for(const angle of [-Math.PI,-1,0,1,Math.PI,NaN]){
    const geometry=bladeGeometry(123.5,45.25,cell,hand,angle);
    assert.equal(geometry.x,123.5);assert.equal(geometry.y,45.25);
    near(Math.hypot(geometry.baseX-geometry.x,geometry.baseY-geometry.y),Math.hypot(.2,.65)*cell);
    assert.ok(Number.isFinite(geometry.angle));
    if(Number.isNaN(angle))assert.equal(geometry.angle,defaultBladeAngle(hand));
  }
});

test('arm rotation takes the shortest path across pi and obeys a time-scaled angular speed bound',()=>{
  near(angleDelta(Math.PI-.01,-Math.PI+.01),.02);
  near(angleDelta(-Math.PI+.01,Math.PI-.01),-.02);
  for(const hz of [8,12,20,60])for(const from of [-3,-1,0,1,3])for(const to of [-3,-1,0,1,3]){
    const dt=1/hz,next=nextBladeAngle(from,{armAngle:to,dt});
    assert.ok(Math.abs(angleDelta(from,next))<=SWING_MAX_RADIANS_PER_SECOND*dt+1e-8);
    assert.ok(Math.abs(angleDelta(next,to))<=Math.abs(angleDelta(from,to))+1e-8);
  }
});

test('absent motion or untrusted elapsed time does not invent a continuing visual swing',()=>{
  for(const dt of [1/8,1/12,1/20]){
    assert.equal(nextBladeAngle(.8,{dt,moving:false}),.8);
    assert.equal(nextBladeAngle(.8,{dt,armAngle:.81,moving:false}),.8,'small angle noise stays in the deadband');
    assert.equal(nextBladeAngle(.8,{dt,armAngle:2,previousArmAngle:2,moving:false}),.8,'a stopped observed arm cannot keep easing toward its last angle');
  }
  for(const dt of [0,-.1,.200001,NaN,Infinity]){
    near(nextBladeAngle(2,{hand:'right',armAngle:-.8,dt}),-.8);
  }
  assert.ok(Number.isFinite(initialBladeAngle('left',NaN)));
});

function calibration(){return {aspect:16/9,cx:.8,cy:.5,cell:.1};}
function pose(){
  const p=Array.from({length:33},()=>({x:.5,y:.5,visibility:1}));
  p[15]={x:.65,y:.3,visibility:1};p[13]={x:.55,y:.5,visibility:1};
  p[16]={x:.25,y:.4,visibility:1};p[14]={x:.35,y:.55,visibility:1};return p;
}

test('camera arm angle uses anatomical elbows and aspect correction without changing wrist grid coordinates',()=>{
  const p=pose(),c=calibration();
  for(const [hand,wrist,elbow] of [['left',15,13],['right',16,14]]){
    const point=poseHand(p,hand,c);
    near(point.x,(p[wrist].x*c.aspect-c.cx)/c.cell+2);near(point.y,(p[wrist].y-c.cy)/c.cell+1.5);
    near(point.armAngle,Math.atan2(p[wrist].y-p[elbow].y,(p[wrist].x-p[elbow].x)*c.aspect)+Math.PI/2);
    const changed=structuredClone(p);changed[elbow].x+=.04;
    const rotated=poseHand(changed,hand,c);assert.equal(rotated.x,point.x);assert.equal(rotated.y,point.y);assert.notEqual(rotated.armAngle,point.armAngle);
  }
});

test('low-confidence, foreshortened or absent elbows remove only angle while invalid wrists remove the hand',()=>{
  for(const visibility of [.54,1.01,NaN,Infinity]){
    const p=pose();p[13].visibility=visibility;const result=poseHand(p,'left',calibration());assert.ok(result);assert.equal(Object.hasOwn(result,'armAngle'),false);
  }
  for(const elbow of [undefined,{x:.65,y:.3,visibility:1},{x:-1,y:-1,visibility:1}]){
    const p=pose();p[13]=elbow;assert.equal(Object.hasOwn(poseHand(p,'left',calibration()),'armAngle'),false);
  }
  const p=pose();p[15].visibility=.54;assert.equal(poseHand(p,'left',calibration()),null);
});

const sample=(x,time,armAngle,extra={})=>({x,y:1.5,armAngle,capturedAtMs:time*1000,audioTimeSeconds:time,confidence:1,frameId:time,sessionId:1,inputEpoch:1,source:'camera',player:0,hand:'left',...extra});

test('different decorative arm angles produce exactly the same swept verdict and timing grade',()=>{
  const chart=validateChart({schemaVersion:1,songId:'test',bpm:120,offsetSeconds:0,notes:[{id:'one',time:10,lineIndex:1,lineLayer:1,hand:'left',cutDirection:'right'}]});
  const outcomes=[];
  for(const angles of [[0,0],[-3,3],[1,-2],[undefined,undefined]]){
    const tracker=new HandTracker(),session=new SaberSession(chart);
    assert.equal(tracker.push(sample(.8,9.95,angles[0])),null);
    const segment=tracker.push(sample(2.2,10.05,angles[1]));outcomes.push(session.observe(segment,10.05));
    assert.equal(tracker.display().x,2.2);assert.equal(tracker.display().y,1.5);
  }
  assert.equal(outcomes[0].kind,'hit');for(const outcome of outcomes)assert.deepEqual(outcome,outcomes[0]);
});

test('angle-only camera changes remain stationary and a lost hand restores without a swept hit',()=>{
  const tracker=new HandTracker();tracker.push(sample(1.5,10,-1));
  const still=tracker.push(sample(1.5,10.1,1));assert.equal(still.distance,0);assert.equal(still.moving,false);assert.equal(still.strokeId,null);
  assert.ok(tracker.display().trail.every(p=>!p.swing));
  tracker.missing();assert.equal(tracker.display().valid,false);assert.equal(tracker.push(sample(3,10.2,-2)),null);
  near(tracker.display().bladeAngle,initialBladeAngle('left',-2));assert.equal(tracker.display().trail.length,1);
  assert.equal(tracker.push(sample(0,10.3,2,{inputEpoch:2})),null);assert.equal(tracker.display().trail.length,1);
});

function seated(cx=.5){
  const p=Array.from({length:33},()=>({x:cx,y:.5,visibility:1}));
  p[11]={x:cx-.08,y:.25,visibility:1};p[12]={x:cx+.08,y:.25,visibility:1};
  p[23]={x:cx-.05,y:.65,visibility:1};p[24]={x:cx+.05,y:.65,visibility:1};
  p[15]={x:cx-.12,y:.45,visibility:1};p[16]={x:cx+.12,y:.45,visibility:1};return p;
}
const reachStep=(id,players=1)=>{const progress=new TutorialProgress(players);while(progress.step.id!==id)assert.equal(progress.next('camera',{skip:true}),true);return progress;};
const practiceHit=(id,player=0,extra={})=>({id,player,kind:'hit',hand:'left',direction:'down',accuracy:80,...extra});

test('tutorial has seven immutable ordered steps and practice notes fit the independent opening loop',()=>{
  assert.deepEqual(TUTORIAL_STEPS.map(s=>s.id),['position','range','hands','directions','timing','sustain','finish']);
  assert.ok(Object.isFrozen(TUTORIAL_STEPS)&&TUTORIAL_STEPS.every(Object.isFrozen));
  assert.equal(TUTORIAL_BPM,112);near(TUTORIAL_LOOP,32*60/112);
  for(const step of TUTORIAL_STEPS){
    const chart=tutorialChart(step.id);assert.equal(chart.duration,150);assert.equal(chart.songId,`tutorial-${step.id}`);
    assert.ok(Object.isFrozen(chart));assert.equal(chart.notes.length>0,!!step.practice);
    assert.ok(chart.notes.every(n=>n.spawnTime>=0&&(n.endTime??n.hitTime)+.45<TUTORIAL_LOOP));
    if(step.id==='directions')assert.deepEqual(new Set(chart.notes.map(n=>n.cutDirection)),new Set(['up','down','left','right']));
    if(step.id==='sustain')assert.ok(chart.notes.every(n=>n.kind==='sustain'&&n.durationSeconds>0));
  }
});

test('position requires both anatomical hands and the correct one- or two-player slot',()=>{
  assert.equal(placementStatus(seated()).ready,true);
  assert.equal(placementStatus(seated(.25),0,2).ready,true);assert.equal(placementStatus(seated(.75),1,2).ready,true);
  assert.equal(placementStatus(seated(.75),0,2).ready,false);assert.equal(placementStatus(seated(.5),0,2).ready,false);
  for(const args of [[seated(),-1,2],[seated(),2,2],[seated(),0,0]])assert.equal(placementStatus(...args).ready,false);
  for(const index of [11,12,23,24,15,16])for(const change of [{visibility:.549999},{visibility:1.000001},{x:-.001},{y:1.001},{x:NaN}]){
    const p=seated();Object.assign(p[index],change);assert.equal(placementStatus(p).ready,false,`${index}:${JSON.stringify(change)}`);
  }
  const threshold=seated();for(const index of [11,12,23,24,15,16])threshold[index].visibility=.55;
  assert.equal(placementStatus(threshold).ready,true);
});

test('position only completes after one continuous second and dropout cannot bank missing time',()=>{
  const progress=new TutorialProgress(),p=seated();
  progress.placement([p],0);assert.equal(progress.holds[0],0);
  for(let t=100;t<=900;t+=100)progress.placement([p],t);
  assert.equal(progress.ready('camera'),false);progress.placement([p],1000);assert.equal(progress.ready('camera'),true);
  progress.placement([null],1100);assert.equal(progress.holds[0],0);
  progress.placement([p],1200);assert.equal(progress.holds[0],0,'first reacquired frame starts a new hold');
  progress.placement([p],2200);assert.equal(progress.holds[0],0,'a long capture gap starts another hold');
  for(let t=2300;t<=3100;t+=100)progress.placement([p],t);
  assert.equal(progress.ready('camera'),false);progress.placement([p],3200);assert.equal(progress.ready('camera'),true);
  progress.losePosition();assert.equal(progress.ready('camera'),false);assert.equal(progress.positionTime,null);
});

test('two-player placement cannot borrow the other players tracked time or confirmation',()=>{
  const progress=new TutorialProgress(2),left=seated(.25);
  for(let t=0;t<=1000;t+=100)progress.placement([left,null],t);
  assert.equal(progress.playerReady(0,'camera'),true);assert.equal(progress.playerReady(1,'camera'),false);assert.equal(progress.next('camera'),false);
  assert.equal(progress.next('camera',{skip:true}),true);assert.deepEqual(progress.report(),[{id:'position',players:['camera','skipped']}]);
  progress.calibrated([true,false]);assert.equal(progress.ready('camera'),false);
  progress.calibrated([false,true]);assert.equal(progress.playerReady(0,'camera'),false,'new calibration result replaces old flags');
  progress.calibrated([true,true]);assert.equal(progress.next('camera'),true);assert.deepEqual(progress.report()[1].players,['camera','camera']);
});

test('mouse practice never claims camera placement or calibration and unknown calibration flags do not pass',()=>{
  const progress=new TutorialProgress(2);assert.equal(progress.next('keyboard'),true);assert.equal(progress.next('keyboard'),true);
  assert.deepEqual(progress.report().map(r=>r.players),[['test','test'],['test','test']]);
  const camera=reachStep('range',2);
  for(const flags of [undefined,[],[1,1],['true','true'],[true,false]]){camera.calibrated(flags);assert.equal(camera.ready('camera'),false);}
  camera.calibrated([true,true]);assert.equal(camera.ready('camera'),true);
});

test('hand practice requires both hands for each player and ignores failures, wrong steps and duplicated events',()=>{
  const progress=reachStep('hands',2);
  for(const bad of [null,practiceHit('hands-0',0,{kind:'wrongCut'}),practiceHit('hands-0',0,{kind:'miss'}),practiceHit('hands-0',0,{kind:'untracked'}),practiceHit('timing-0'),practiceHit('hands-0',2)])assert.equal(progress.hit(bad),false);
  assert.equal(progress.hit(practiceHit('hands-0')),true);assert.equal(progress.hit(practiceHit('hands-0')),false);
  progress.hit(practiceHit('hands-1',0,{hand:'right'}));assert.equal(progress.playerReady(0,'camera'),true);assert.equal(progress.ready('camera'),false);
  progress.hit(practiceHit('hands-0',1));assert.equal(progress.next('camera'),false);
  assert.equal(progress.next('camera',{skip:true}),true);assert.deepEqual(progress.report().at(-1).players,['practiced','skipped']);
  assert.equal(progress.marks[0].size,0);assert.equal(progress.marks[1].size,0);
});

test('direction practice tracks all four directions rather than total hit count',()=>{
  const progress=reachStep('directions');
  for(let i=0;i<8;i++)progress.hit(practiceHit(`directions-${i}`,0,{direction:'down'}));
  assert.equal(progress.ready('camera'),false);
  for(const direction of ['up','left','right'])progress.hit(practiceHit(`directions-${direction}`,0,{direction}));
  assert.equal(progress.ready('camera'),true);
});

test('timing practice needs two distinct 60-percent successes, and a repeated musical loop is a new attempt',()=>{
  const progress=reachStep('timing');
  for(const accuracy of [0,59.999999,NaN])progress.hit(practiceHit(`timing-low-${accuracy}`,0,{accuracy}));
  assert.equal(progress.marks[0].size,0);
  const first=practiceHit('timing-0',0,{accuracy:60});progress.hit(first,1);progress.hit(first,1);
  assert.equal(progress.marks[0].size,1);assert.equal(progress.ready('camera'),false);
  progress.hit(first,2);assert.equal(progress.ready('camera'),true);
});

test('sustain tutorial accepts a completed moving target, not a tap or a partial bar',()=>{
  const progress=reachStep('sustain',2);
  progress.hit(practiceHit('sustain-tap',0,{sustainAccuracy:100}));
  progress.hit(practiceHit('sustain-partial',0,{targetKind:'sustain',sustainAccuracy:59.999999}));
  assert.equal(progress.marks[0].size,0);
  progress.hit(practiceHit('sustain-0',0,{targetKind:'sustain',sustainAccuracy:60}));assert.equal(progress.ready('camera'),false);
  progress.hit(practiceHit('sustain-0',1,{targetKind:'sustain',sustainAccuracy:100}));assert.equal(progress.ready('camera'),true);
});

test('retry, back and player-count reset remove current practice evidence and reports are defensive copies',()=>{
  const progress=reachStep('hands');progress.hit(practiceHit('hands-0'));progress.retry();assert.equal(progress.marks[0].size,0);assert.equal(progress.seen.size,0);
  progress.hit(practiceHit('hands-0'));progress.hit(practiceHit('hands-1',0,{hand:'right'}));assert.equal(progress.next('keyboard'),true);
  const copy=progress.report();copy[0].players[0]='camera';assert.equal(progress.report()[0].players[0],'skipped');
  assert.equal(progress.back(),true);assert.equal(progress.step.id,'hands');assert.equal(progress.ready('camera'),false);assert.equal(progress.report().length,2);
  progress.reset(2);assert.equal(progress.players,2);assert.equal(progress.index,0);assert.deepEqual(progress.report(),[]);assert.ok(progress.marks.every(s=>s.size===0));
  assert.equal(progress.back(),false);
});

function calibrationFixture(t,players=1){
  const before=globalThis.window;globalThis.window={addEventListener(){}};
  t.after(()=>{if(before===undefined)delete globalThis.window;else globalThis.window=before;});
  const results=[],game=new SaberGame({stage:{addEventListener(){}},audio:{currentTime:0,addEventListener(){}},phase:()=> 'idle',players:()=>players,input:()=> 'camera',notice(){},onCalibration:flags=>results.push(flags),latency:()=>0,range:()=>1,quality:()=> 'low'});
  return {game,results};
}
function calibrationPose(cx,index,movingHands=['left','right']){
  const p=seated(cx);
  for(const [hand,id,side] of [['left',15,-1],['right',16,1]]){
    const moving=movingHands.includes(hand);
    p[id]={x:cx+(moving?(index%2?.14:-.14):side*.14),y:moving?(index%4<2?.25:.8):(side<0?.25:.8),visibility:1};
  }
  return p;
}

test('range confirmation rejects diagonally separated stationary hands and one-hand-only exercise',t=>{
  const {game,results}=calibrationFixture(t);
  for(const moving of [[],['left'],['right']]){
    game.camera([calibrationPose(.5,0,moving)],4/3,0,0);game.beginCalibration();
    for(let i=0;i<=50;i++)game.camera([calibrationPose(.5,i,moving)],4/3,i*100,i/10);
    game.finishCalibration();assert.deepEqual(results.at(-1),[false],`moving: ${moving.join(',')||'neither'}`);
  }
});

test('range confirmation reports moving players independently and cancellation cannot publish an old success',t=>{
  const {game,results}=calibrationFixture(t,2);
  game.camera([seated(.25),seated(.75)],4/3,0,0);game.beginCalibration();
  for(let i=0;i<=50;i++)game.camera([calibrationPose(.25,i),calibrationPose(.75,i,[])],4/3,i*100,i/10);
  game.finishCalibration();assert.deepEqual(results,[[true,false]]);
  game.beginCalibration();for(let i=0;i<30;i++)game.camera([calibrationPose(.25,i),calibrationPose(.75,i)],4/3,6000+i*100,6+i/10);
  game.configure();game.finishCalibration();assert.deepEqual(results,[[true,false]],'discarded calibration has no callback');
});

function tutorialFixture(t,{soundReady=()=>Promise.resolve()}={}){
  const priorWindow=globalThis.window,priorDocument=globalThis.document,elements=new Map(),listeners=new Map();
  const element=()=>({dataset:{},value:'0',textContent:'',disabled:false,hidden:false,children:[],replaceChildren(...rows){this.children=rows;},querySelector(){return this.option??=(element());}});
  const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
  globalThis.window={addEventListener(){}};globalThis.document={hidden:false,getElementById:get,createElement:element,querySelector:()=>null};
  t.after(()=>{if(priorWindow===undefined)delete globalThis.window;else globalThis.window=priorWindow;if(priorDocument===undefined)delete globalThis.document;else globalThis.document=priorDocument;});
  const audio={currentTime:0,paused:true,ended:false,playCalls:0,pauseCalls:0,src:'',
    addEventListener(type,callback){const list=listeners.get(type)||[];list.push(callback);listeners.set(type,list);},dispatch(type){for(const fn of listeners.get(type)||[])fn();},
    play(){this.paused=false;this.playCalls++;return Promise.resolve();},pause(){this.paused=true;this.pauseCalls++;},load(){},removeAttribute(key){if(key==='src')this.src='';}};
  const state={players:1,input:'keyboard'},notices=[],stops=[];
  const controller=createTutorial({stage:{addEventListener(){}},audio,players:()=>state.players,input:()=>state.input,latency:()=>0,range:()=>1,quality:()=> 'low',dance:()=>null,volume:()=>.5,onHit(){},onStop:()=>stops.push(true),onSoundReady:soundReady,onNotice:text=>notices.push(text),onExit(){}});
  t.after(()=>controller.leave());controller.enter();
  get('tutorial-next').onclick();get('tutorial-next').onclick();assert.equal(get('tutorial-panel').dataset.step,'hands');
  return {controller,audio,state,get,notices,stops};
}
const microtasks=()=>new Promise(setImmediate);

test('tutorial pauses its priming audio while screen readiness is pending, so opening notes do not elapse',async t=>{
  let ready;const wait=new Promise(resolve=>ready=resolve),{controller,audio,get}=tutorialFixture(t,{soundReady:()=>wait});
  get('tutorial-action').onclick();await microtasks();assert.equal(controller.phase,'starting');assert.equal(audio.paused,true);
  ready();await microtasks();assert.equal(controller.phase,'playing');assert.equal(audio.paused,false);assert.equal(audio.currentTime,0);
});

test('leaving during asynchronous tutorial preparation invalidates the pending start and releases media',async t=>{
  let ready;const wait=new Promise(resolve=>ready=resolve),{controller,audio,get}=tutorialFixture(t,{soundReady:()=>wait});
  get('tutorial-action').onclick();await microtasks();controller.leave();const calls=audio.playCalls;
  ready();await microtasks();assert.equal(controller.active,false);assert.equal(controller.phase,'idle');assert.equal(audio.paused,true);assert.equal(audio.src,'');assert.equal(audio.playCalls,calls);
});

test('tutorial timeupdate and render loop cannot restart the same musical boundary twice',async t=>{
  const {controller,audio,get}=tutorialFixture(t);get('tutorial-action').onclick();await microtasks();assert.equal(controller.phase,'playing');
  const before=audio.playCalls;audio.currentTime=TUTORIAL_LOOP+.01;audio.dispatch('timeupdate');audio.dispatch('timeupdate');controller.tick(performance.now());
  await microtasks();assert.equal(audio.playCalls,before+1);assert.equal(audio.currentTime,0);assert.equal(controller.phase,'playing');
  controller.pause();const pausedCalls=audio.playCalls;audio.currentTime=TUTORIAL_LOOP+.01;audio.dispatch('timeupdate');controller.tick(performance.now());
  assert.equal(audio.playCalls,pausedCalls);assert.equal(controller.phase,'paused');
});

test('a changing external player selector cannot make the current tutorial read a nonexistent player (TR03)',async t=>{
  const {controller,state,audio,get}=tutorialFixture(t);get('tutorial-action').onclick();await microtasks();
  state.input='camera';state.players=2;
  assert.doesNotThrow(()=>controller.lostTracking());assert.equal(audio.paused,true);
  assert.doesNotThrow(()=>controller.paint());assert.equal(get('tutorial-progress').children.length,1,'view and game retain their current model count until reset');
  controller.reset();assert.equal(get('tutorial-panel').dataset.step,'position');assert.equal(get('tutorial-progress').children.length,2);
  assert.equal(get('tutorial-next').disabled,true,'both new camera slots start unconfirmed');
});
