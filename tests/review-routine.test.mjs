import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateTrackDuration,generateChart,poseSimilarity} from '../src/core.mjs';
import {SET_TRACKS,SET_DURATION,ROUTINE,routineAt,routinePose} from '../src/routine.mjs';

test('local song duration accepts exactly two through three minutes, including endpoints',()=>{
  for(const seconds of [120,120.001,150,179.999,180])assert.equal(validateTrackDuration(seconds),true,`${seconds}s accepted`);
  for(const seconds of [119.999,180.001,0,-1,225,360])assert.equal(validateTrackDuration(seconds),false,`${seconds}s rejected`);
});

test('unreadable, indefinite and coerced media duration values cannot be accepted',()=>{
  for(const duration of [NaN,Infinity,-Infinity,undefined,null,'150',{},[],true])assert.equal(validateTrackDuration(duration),false);
});

test('local rhythm chart never extends beyond the selected 120/180-second song',()=>{
  for(const duration of [120,180]){
    const chart=generateChart({duration,bpm:112});
    assert.ok(chart.length>0);
    assert.ok(chart.every(note=>note.time>0&&note.time<duration-2));
  }
});

test('full-body set is exactly three distinct local half songs with 225 total seconds',()=>{
  assert.equal(SET_TRACKS.length,3);
  assert.equal(new Set(SET_TRACKS.map(track=>track.src)).size,3);
  assert.equal(SET_DURATION,225);
  assert.ok(SET_TRACKS.every(track=>track.segmentSeconds===75&&track.src.startsWith('/audio/')&&!track.src.includes('..')));
  // File hashes prove the three names resolve to different supplied audio bytes.
  const hashes=SET_TRACKS.map(track=>{
    const bytes=readFileSync(new URL('../public'+track.src,import.meta.url));
    assert.equal(bytes.subarray(0,4).toString(),'OggS');
    return createHash('sha256').update(bytes).digest('hex');
  });
  assert.equal(new Set(hashes).size,3);
});

test('full-body routine covers every second in order and finishes at 225 seconds',()=>{
  assert.equal(ROUTINE.length,14);
  assert.equal(ROUTINE.reduce((total,item)=>total+item.seconds,0),SET_DURATION);
  let time=0;
  for(let index=0;index<ROUTINE.length;index++){
    const entry=ROUTINE[index],start=routineAt(time),last=routineAt(time+entry.seconds-.001);
    assert.equal(start.id,entry.id);assert.equal(start.index,index);assert.equal(start.local,0);
    assert.equal(start.remaining,entry.seconds);assert.equal(last.index,index);
    time+=entry.seconds;
  }
  for(const end of [225,226,1000]){
    assert.equal(routineAt(end).id,'rest');assert.equal(routineAt(end).remaining,0);assert.equal(routineAt(end).match,null);
  }
  assert.equal(routineAt(75).id,'left');
  assert.equal(routineAt(150).id,'calf-left');
});

test('neck and every lower-body phase remain guidance only, never artificial pose scores',()=>{
  const comparable=new Set(['open','left','right']);
  for(let time=0;time<SET_DURATION;time+=.25){
    const item=routineAt(time);
    if(!comparable.has(item.id))assert.equal(item.match,null,`${item.id} at ${time}s`);
    else assert.ok(item.match===item.id||item.resting&&item.match===null);
  }
  for(const time of [55,77,92]){
    const item=routineAt(time);
    assert.equal(item.resting,true);assert.equal(item.match,null);
  }
});

test('example poses are drawable throughout and compared upper-body targets retain their geometry',()=>{
  for(let time=0;time<=SET_DURATION;time+=.5){
    const item=routineAt(time),pose=routinePose(item);
    assert.equal(pose.length,33);
    assert.ok(pose.every(point=>Number.isFinite(point.x)&&Number.isFinite(point.y)&&point.x>=0&&point.x<=1&&point.y>=0&&point.y<=1));
    if(item.match)assert.equal(poseSimilarity(pose,item.match,1),100);
  }
  for(const start of [105,180]){
    const before=routinePose(routineAt(start)),moving=routinePose(routineAt(start+.5));
    assert.notDeepEqual(before,moving,'march and ankle demonstrations move with time');
  }
});
