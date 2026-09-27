import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {ROUTINE_PROFILES} from '../src/routine-profiles.mjs';

const manifest=JSON.parse(readFileSync(new URL('../public/audio/voice/manifest.json',import.meta.url),'utf8'));

test('standing, floor and couple schedules each fill one complete 225-second session',()=>{
  assert.deepEqual(Object.keys(ROUTINE_PROFILES),['standing','floor','couple']);
  for(const [id,profile] of Object.entries(ROUTINE_PROFILES)){
    assert.equal(profile.duration,225,id);
    assert.equal(profile.steps.length,13,id);
    assert.equal(profile.steps.reduce((total,step)=>total+step.seconds,0),225,id);
    assert.equal(new Set(profile.steps.map(step=>step.id)).size,profile.steps.length);
    assert.ok(profile.steps.every(step=>Number.isFinite(step.seconds)&&step.seconds>0&&step.title&&step.cue&&step.pose));
  }
});

test('floor never provides camera accuracy and unsupported standing joints remain guidance only',()=>{
  assert.ok(ROUTINE_PROFILES.floor.steps.every(step=>step.match===null&&step.pose.startsWith('supine-')));
  for(const id of ['standing','couple']){
    const scored=ROUTINE_PROFILES[id].steps.filter(step=>step.match!==null);
    assert.deepEqual(scored.map(step=>step.match),['open','left','right']);
    assert.ok(ROUTINE_PROFILES[id].steps.filter(step=>step.region.includes('목')||step.id.startsWith('hamstring')||step.id.startsWith('calf')).every(step=>step.match===null));
  }
});

test('couple profile requires two independent slots and follows the same unassisted standing sequence',()=>{
  assert.equal(ROUTINE_PROFILES.couple.requiresTwo,true);
  assert.equal(ROUTINE_PROFILES.standing.requiresTwo,false);
  assert.equal(ROUTINE_PROFILES.floor.requiresTwo,false);
  assert.deepEqual(ROUTINE_PROFILES.couple.steps.map(step=>[step.id,step.seconds,step.pose,step.match]),ROUTINE_PROFILES.standing.steps.map(step=>[step.id,step.seconds,step.pose,step.match]));
  assert.match(ROUTINE_PROFILES.couple.steps[0].cue,/서로 당기지 않고 각자 지지물/);
  assert.match(ROUTINE_PROFILES.couple.description,/서로 당기거나 밀지/);
});

test('every profile cue resolves to an actual local voice asset with matching bytes and hash',()=>{
  const ids=new Set(Object.values(ROUTINE_PROFILES).flatMap(profile=>profile.steps.map(step=>step.voice)));
  for(const id of ids){
    const cue=manifest.cues[id];
    assert.ok(cue,`missing voice manifest entry: ${id}`);
    assert.ok(cue.file.startsWith('/audio/voice/')&&!cue.file.includes('..'));
    const bytes=readFileSync(new URL('../public'+cue.file,import.meta.url));
    assert.equal(bytes.subarray(0,4).toString(),'OggS',id);
    assert.equal(bytes.length,cue.bytes,id);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),cue.sha256,id);
  }
  for(const step of [...ROUTINE_PROFILES.standing.steps,...ROUTINE_PROFILES.couple.steps]){
    assert.doesNotMatch(manifest.cues[step.voice].text,/의자에\s*앉/,'standing instructions must not reuse seated voice prompts');
  }
});
