// Independent review tests: behavior and invariants, without camera/hardware claims.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assignPlayers, mirrorPose, GestureTracker, generateChart, createScore,
  judgeHit, expireNotes, resultSummary, targetPose, poseSimilarity,
} from '../src/core.mjs';

const clone = value => structuredClone(value);
const transform = (pose, scale, dx, dy) => pose.map(p => ({...p, x:p.x*scale+dx, y:p.y*scale+dy}));

// Fixture is specified independently from targetPose and gesture implementation.
function person(cx=.5) {
  const p = Array.from({length:33}, () => ({x:cx,y:.5,visibility:1}));
  p[11]={x:cx-.1,y:.32,visibility:1}; p[12]={x:cx+.1,y:.32,visibility:1};
  p[23]={x:cx-.06,y:.64,visibility:1}; p[24]={x:cx+.06,y:.64,visibility:1};
  p[15]={x:cx-.02,y:.48,visibility:1}; p[16]={x:cx+.02,y:.48,visibility:1};
  return p;
}
function handPose(direction) {
  const p=person();
  const positions={left:[.15,.4],right:[.85,.4],up:[.45,.1],down:[.45,.85],center:[.48,.48]};
  const [x,y]=positions[direction];
  p[15]={x,y,visibility:1};
  p[16].visibility=0; // Isolate the active wrist.
  return p;
}

test('two-player slots do not depend on detector ordering and missing player leaves empty slot', () => {
  const left=person(.25),right=person(.75);
  assert.deepEqual(assignPlayers([right,left],2),[left,right]);
  assert.deepEqual(assignPlayers([left,right],2),[left,right]);
  assert.deepEqual(assignPlayers([right],2),[null,right]);
  assert.deepEqual(assignPlayers([],2),[null,null]);
});

test('two people in one half never populate the absent opposite half; center boundaries are empty', () => {
  const centeredLeft=person(.25),otherLeft=person(.4);
  assert.deepEqual(assignPlayers([otherLeft,centeredLeft],2),[centeredLeft,null]);
  for(const x of [.47,.5,.53]) assert.deepEqual(assignPlayers([person(x)],2),[null,null]);
});

test('low-confidence, missing, or non-finite body anchors cannot create player slots', () => {
  for(const index of [11,12,23,24]) {
    const invisible=person(); invisible[index].visibility=.1;
    assert.deepEqual(assignPlayers([invisible],1),[null]);
    const missing=person(); missing[index]=undefined;
    assert.deepEqual(assignPlayers([missing],1),[null]);
    const invalid=person(); invalid[index].x=NaN;
    assert.deepEqual(assignPlayers([invalid],1),[null]);
  }
});

test('mirroring exchanges screen zones, preserves source, and round-trips coordinates', () => {
  const raw=person(.75),saved=clone(raw),mirrored=mirrorPose(raw);
  assert.equal(assignPlayers([mirrored],2)[0],mirrored);
  assert.deepEqual(raw,saved);
  const restored=mirrorPose(mirrored);
  restored.forEach((p,i)=>assert.ok(Math.abs(p.x-raw[i].x)<1e-12));
});

test('all four screen directions require center rearm; holding cannot repeat', () => {
  for(const direction of ['left','up','down','right']) {
    const tracker=new GestureTracker();
    assert.deepEqual(tracker.update(handPose(direction),0),[],'first detected pose must not score');
    assert.deepEqual(tracker.update(handPose('center'),100),[]);
    assert.deepEqual(tracker.update(handPose(direction),200),[direction]);
    for(const t of [300,500,700]) assert.deepEqual(tracker.update(handPose(direction),t),[]);
    assert.deepEqual(tracker.update(handPose('center'),800),[]);
    assert.deepEqual(tracker.update(handPose(direction),1000),[direction]);
  }
});

test('direction-to-direction movement cannot bypass neutral return', () => {
  const tracker=new GestureTracker();
  tracker.update(handPose('center'),0);
  assert.deepEqual(tracker.update(handPose('left'),100),['left']);
  assert.deepEqual(tracker.update(handPose('up'),400),[]);
  assert.deepEqual(tracker.update(handPose('right'),700),[]);
});

test('missing frame and long tracking gap discard armed hands and cannot score on reacquisition', () => {
  const tracker=new GestureTracker();
  tracker.update(handPose('center'),0);
  assert.deepEqual(tracker.update(null,50),[]);
  assert.deepEqual(tracker.update(handPose('up'),100),[]);
  tracker.update(handPose('center'),200);
  assert.deepEqual(tracker.update(handPose('up'),650),[],'long gap must disarm');
  tracker.update(handPose('center'),700);
  assert.deepEqual(tracker.update(handPose('up'),800),['up']);
});

test('individual low-confidence wrist requires rearm after recovery', () => {
  const tracker=new GestureTracker();
  tracker.update(handPose('center'),0);
  const lost=handPose('up'); lost[15].visibility=.2;
  assert.deepEqual(tracker.update(lost,100),[]);
  assert.deepEqual(tracker.update(handPose('up'),200),[]);
  tracker.update(handPose('center'),300);
  assert.deepEqual(tracker.update(handPose('up'),400),['up']);
});

test('gesture directions stay invariant to translation and body scale', () => {
  for(const direction of ['left','up','down','right']) {
    const tracker=new GestureTracker();
    tracker.update(transform(handPose('center'),.55,.2,.15),0);
    assert.deepEqual(tracker.update(transform(handPose(direction),.55,.2,.15),100),[direction]);
  }
});

test('same note cannot score twice and separate players own independent scores', () => {
  const notes=[{id:0,time:10,lane:'left'}],a=createScore(),b=createScore();
  assert.equal(judgeHit(notes,a,'left',10)?.rating,'perfect');
  assert.equal(judgeHit(notes,a,'left',10),null);
  assert.equal(judgeHit(notes,b,'left',10)?.rating,'perfect');
  assert.equal(a.score,100); assert.equal(a.perfect,1); assert.equal(a.hits.size,1);
  assert.equal(b.score,100);
});

test('late, wrong-direction, expired and invalid hits do not award points; misses remain recoverable', () => {
  const notes=[{id:0,time:1,lane:'left'},{id:1,time:3,lane:'up'}],state=createScore();
  for(const [lane,time] of [['right',1],['left',1.31],['left',NaN],['invalid',1]])
    assert.equal(judgeHit(notes,state,lane,time),null);
  expireNotes(notes,state,1.31);
  expireNotes(notes,state,1.8);
  assert.equal(state.miss,1); assert.equal(state.score,0);
  assert.equal(judgeHit(notes,state,'left',1),null,'expired notes cannot be resurrected');
  assert.equal(judgeHit(notes,state,'up',3)?.rating,'perfect','a miss does not eliminate player');
  assert.deepEqual(resultSummary(state,2),{score:100,maxCombo:1,perfect:1,great:0,good:0,miss:1,accuracy:50});
});

test('chart stays in song bounds, ids unique, and density grows for normal', () => {
  const easy=generateChart(),normal=generateChart({difficulty:'normal'});
  assert.ok(easy.length>0); assert.ok(normal.length>easy.length);
  assert.equal(new Set(easy.map(n=>n.id)).size,easy.length);
  assert.ok(easy.every((n,i)=>n.time>0&&n.time<150&&['left','up','down','right'].includes(n.lane)&&(!i||n.time>easy[i-1].time)));
  for(const args of [{bpm:0},{bpm:NaN},{duration:-1},{duration:Infinity}]) assert.throws(()=>generateChart(args));
});

test('pose similarity is position/scale invariant and respects non-square camera pixels', () => {
  for(const id of ['open','up','left','right']) {
    // targetPose is a Cartesian drawing; normalized camera x is divided by aspect.
    const expected=targetPose(id);
    const camera=expected.map(p=>({...p,x:.5+(p.x-.5)/(16/9)}));
    assert.equal(poseSimilarity(camera,id,16/9),100);
    assert.equal(poseSimilarity(transform(camera,.7,.1,.07),id,16/9),100);
  }
});

test('pose scoring distinguishes opposite movement, skips rest, and refuses missing joints', () => {
  assert.ok(poseSimilarity(targetPose('left'),'right',1)<35);
  assert.ok(poseSimilarity(targetPose('rest'),'up',1)<35);
  assert.ok(poseSimilarity(targetPose('open'),'up',1)<55);
  assert.equal(poseSimilarity(null,'up'),null);
  assert.equal(poseSimilarity(targetPose('up'),'rest'),null);
  for(const index of [11,12,13,14,15,16,23,24]) {
    const pose=targetPose('up'); pose[index].visibility=.2;
    assert.equal(poseSimilarity(pose,'up'),null);
  }
});

test('side-stretch cannot score near-perfect when arms match but torso stays upright (R01)', () => {
  for(const id of ['left','right']) {
    const pose=targetPose(id);
    const undoLean=id==='left'?.08:-.08;
    pose.forEach((point,index)=>{if(index<23)point.x+=undoLean;});
    assert.ok(poseSimilarity(pose,id,1)<=85,`${id}: upright torso must differ from a side stretch`);
    assert.equal(poseSimilarity(targetPose(id),id,1),100,'actual gentle target still receives full match');
  }
});
