import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {SET_TRACKS,SET_DURATION} from '../src/routine.mjs';
import {BUILTIN_SONGS,getBuiltinSong} from '../src/songs.mjs';
import {validateChart,generateEasyChart,chartJSON,visibleNotes} from '../src/saber-chart.mjs';
import {SaberSession} from '../src/saber-core.mjs';

const publicFile=path=>readFileSync(new URL(`../public/${path}`,import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
// Inspect the distributed container without requiring FFmpeg or Python to run
// the project tests. Full codec decoding is a separate documented review step.
function vorbisFormat(bytes){
  let offset=0,serial=null,format=null,endGranule=null,pages=0;
  while(offset<bytes.length){
    assert.ok(offset+27<=bytes.length,'complete Ogg header');
    assert.equal(bytes.toString('ascii',offset,offset+4),'OggS');assert.equal(bytes[offset+4],0);
    const flags=bytes[offset+5],granule=bytes.readBigUInt64LE(offset+6),pageSerial=bytes.readUInt32LE(offset+14),count=bytes[offset+26];
    if(serial===null)serial=pageSerial;else assert.equal(pageSerial,serial,'one logical audio stream');
    const body=offset+27+count;assert.ok(body<=bytes.length,'complete lacing table');
    let size=0;for(let index=0;index<count;index++)size+=bytes[offset+27+index];
    assert.ok(body+size<=bytes.length,'complete Ogg page body');
    if(!format){
      assert.equal(bytes[body],1);assert.equal(bytes.toString('ascii',body+1,body+7),'vorbis');
      format={channels:bytes[body+11],sampleRate:bytes.readUInt32LE(body+12)};
    }
    if(flags&4){assert.equal(endGranule,null,'single EOS page');endGranule=Number(granule);assert.equal(body+size,bytes.length,'EOS is the last page');}
    offset=body+size;pages++;
  }
  assert.ok(pages>2&&Number.isSafeInteger(endGranule)&&endGranule>0,'complete playable audio stream');
  return {...format,frames:endGranule,duration:endGranule/format.sampleRate,pages};
}
// Independently captured before music work, at HEAD 8e7971c. Do not regenerate
// these expectations from changed metadata: the test protects original music.
// Voice replacement is explicitly authorized by the later feedback update;
// its current manifest/assets are checked by profile/feedback tests instead.
const ORIGINAL_HASHES={
  'audio/maru-flow.ogg':'a940becf5467a95501eed896ac1b860cc90c764239ed18ed2eac5c7090d79cb3',
  'audio/maru-flow.json':'f02131e0119dc53ce70e40c06e16ad9971e5419ed08dbdb091362396a8422bae',
  'audio/maru-breeze.ogg':'55e0d152805249f29f2fb3f399a6478e8e2f9d97977eb79a43f4000bdcbc13b1',
  'audio/maru-breeze.json':'1560979b5db0bd6c3c822603156ed9ccf348530e45b2e154ae4eb74def8881f7',
  'audio/maru-sunset.ogg':'2eab0411221a10f2529ded19362709e5f553a8e8da49b1094506ee8be33345d6',
  'audio/maru-sunset.json':'963830465320d2279fa6d10e3e0eeab841014b5b14d1706b5dc4dad6c95df62b',
};

test('dance expansion preserves the three original songs and their metadata byte-for-byte',()=>{
  for(const [path,expected] of Object.entries(ORIGINAL_HASHES))assert.equal(hash(publicFile(path)),expected,path);
});

test('faster rhythm music never changes the existing three-half-song stretching set',()=>{
  assert.equal(SET_DURATION,225);
  assert.deepEqual(SET_TRACKS.map(({src,bpm,segmentSeconds})=>({src,bpm,segmentSeconds})),[
    {src:'/audio/maru-flow.ogg',bpm:112,segmentSeconds:75},
    {src:'/audio/maru-breeze.ogg',bpm:112,segmentSeconds:75},
    {src:'/audio/maru-sunset.ogg',bpm:112,segmentSeconds:75},
  ]);
});

test('builtin song choices remain unique immutable local records with the original selection alias',()=>{
  assert.ok(Object.isFrozen(BUILTIN_SONGS));assert.ok(BUILTIN_SONGS.every(Object.isFrozen));
  for(const field of ['value','songId','src','chart'])assert.equal(new Set(BUILTIN_SONGS.map(song=>song[field])).size,BUILTIN_SONGS.length,field);
  assert.equal(getBuiltinSong('builtin').songId,'maru-flow');assert.equal(getBuiltinSong('builtin').bpm,112);assert.equal(getBuiltinSong('builtin').duration,150);
  for(const value of ['local','set','maru-flow','https://example.com',null,undefined])assert.equal(getBuiltinSong(value),null);
  for(const song of BUILTIN_SONGS){
    assert.equal(getBuiltinSong(song.value),song);
    assert.equal(song.src,`/audio/${song.songId}.ogg`);assert.equal(song.chart,`/charts/${song.songId}.saber.json`);
    assert.match(song.songId,/^[a-z0-9-]+$/);assert.ok(song.duration>=120&&song.duration<=180);
    assert.throws(()=>{song.bpm=1;},TypeError);
  }
});

test('the two dance catalog durations match 96 complete four-beat bars at their assigned tempos',()=>{
  for(const [value,bpm] of [['maru-neon-drive',150],['maru-pulse-rush',156]]){
    const song=getBuiltinSong(value);assert.ok(song);assert.equal(song.bpm,bpm);
    assert.equal(song.duration,96*4*60/bpm);assert.ok(song.bpm>getBuiltinSong('builtin').bpm);
  }
});

test('every supplied rhythm chart uses its own song clock, two-beat groups and full entry/end margins',()=>{
  for(const song of BUILTIN_SONGS){
    const raw=JSON.parse(publicFile(song.chart.slice(1))),chart=validateChart(raw,{duration:song.duration,songId:song.songId});
    assert.equal(chart.bpm,song.bpm);assert.equal(chart.offsetSeconds,0);
    assert.deepEqual(chartJSON(generateEasyChart({bpm:song.bpm,duration:song.duration,songId:song.songId})),chartJSON(chart),'cached chart and pre-fetch fallback follow the same timing');
    let previous=null;
    for(const note of chart.notes){
      assert.ok(note.spawnTime>=0&&note.hitTime<=song.duration-1);
      assert.ok(Math.abs(note.hitTime*song.bpm/60-Math.round(note.hitTime*song.bpm/60))<=.000003,'fixed-tempo note is on a beat');
      if(previous!==null&&note.timeUs!==previous)assert.ok(note.timeUs-previous+1>=120e6/song.bpm);
      previous=note.timeUs;
    }
    const first=chart.notes[0],last=chart.notes.at(-1),session=new SaberSession(chart);
    assert.equal(visibleNotes(chart,new Map(),first.spawnTime-1e-6).some(n=>n.id===first.id),false);
    assert.equal(visibleNotes(chart,new Map(),first.hitTime).some(n=>n.id===first.id),true);
    assert.equal(visibleNotes(chart,new Map(),song.duration).length,0);
    session.advance(song.duration);assert.equal(session.counts.untracked,chart.notes.length);assert.equal(session.counts.hit,0);
    assert.ok(last.hitTime+.25+.45<song.duration,'the final grace period completes before the audio ends');
  }
});

test('a chart from another builtin song is rejected without weakening song ownership validation',()=>{
  for(const song of BUILTIN_SONGS){
    const other=BUILTIN_SONGS.find(candidate=>candidate.songId!==song.songId),raw=publicFile(song.chart.slice(1)).toString();
    assert.throws(()=>validateChart(raw,{duration:other.duration,songId:other.songId}),/곡 이름/);
  }
});

const DANCE_IDS=['maru-neon-drive','maru-pulse-rush'];
const metadata=id=>JSON.parse(publicFile(`audio/${id}.json`));

test('new distributed Oggs match metadata hashes, stereo format and actual container duration within one sample',()=>{
  for(const id of DANCE_IDS){
    const song=getBuiltinSong(id),meta=metadata(id),bytes=publicFile(`audio/${id}.ogg`),format=vorbisFormat(bytes);
    assert.equal(meta.id,song.songId);assert.equal(meta.file,`${id}.ogg`);assert.equal(meta.bpm,song.bpm);
    assert.equal(meta.measurements.fileBytes,bytes.length);assert.equal(meta.measurements.sha256,hash(bytes));
    assert.equal(format.sampleRate,44100);assert.equal(format.channels,2);assert.equal(meta.sampleRate,format.sampleRate);assert.equal(meta.channels,format.channels);
    const oneSample=1/format.sampleRate;
    assert.ok(Math.abs(meta.duration-format.duration)<=oneSample,`${id}: container/declared duration`);
    assert.ok(Math.abs(song.duration-format.duration)<=oneSample,`${id}: ideal beat clock/container duration`);
    assert.ok(Math.abs(meta.durationSeconds-song.duration)<1e-10);
    assert.equal(meta.measurements.decodedFrames,Math.round(song.duration*format.sampleRate));
    assert.ok(Math.abs(meta.measurements.decodedFrames-format.frames)<=1,'codec end granule and decoded PCM may differ by one sample');
    assert.equal(meta.generator,'tools/music-dance-compose.py');
    assert.equal(meta.generatorSha256,hash(readFileSync(new URL(`../${meta.generator}`,import.meta.url))));
  }
});

test('dance arrangements are distinct local originals with 96 contiguous bars and 384 beats',()=>{
  const allAudio=['maru-flow','maru-breeze','maru-sunset',...DANCE_IDS].map(id=>hash(publicFile(`audio/${id}.ogg`)));
  assert.equal(new Set(allAudio).size,5,'new files do not duplicate any original song');
  const arrangements=DANCE_IDS.map(metadata);
  assert.notEqual(arrangements[0].seed,arrangements[1].seed);assert.notDeepEqual(arrangements[0].arrangement.hook,arrangements[1].arrangement.hook);
  for(const meta of arrangements){
    assert.equal(meta.bars,96);assert.equal(meta.beats,384);assert.equal(meta.timeSignature,'4/4');assert.equal(meta.beatOffsetSeconds,0);
    assert.equal(meta.license,'CC0-1.0');assert.equal(meta.externalSamples,false);assert.equal(meta.vocals,false);
    let bar=0;
    for(const section of meta.sections){
      assert.equal(section.startBar,bar);assert.ok(section.endBar>bar);
      assert.ok(Math.abs(section.startSeconds-section.startBar*4*60/meta.bpm)<.000001);
      assert.ok(Math.abs(section.endSeconds-section.endBar*4*60/meta.bpm)<.000001);
      bar=section.endBar;
    }
    assert.equal(bar,96);
  }
});

test('generation measurements disclose finite unclipped levels and preserve the documented F-function provenance',()=>{
  const prior=JSON.parse(publicFile('audio/maru-flow.json'));
  for(const id of DANCE_IDS){
    const meta=metadata(id),measure=meta.measurements;
    for(const key of ['decodedPeak','decodedRms','decodedPeakDbFS','decodedRmsDbFS','integratedLufs','truePeakDbTP','loudnessRangeLU'])assert.ok(Number.isFinite(measure[key]),key);
    assert.ok(measure.decodedPeak>0&&measure.decodedPeak<.99);assert.ok(measure.decodedRms>0&&measure.decodedRms<measure.decodedPeak);
    assert.ok(Math.abs(measure.integratedLufs+14)<1);assert.ok(measure.truePeakDbTP<0);assert.equal(measure.fullDecodePassed,true);
    assert.equal(meta.engine.function,'signature_soundtrack');assert.equal(meta.engine.sha256,prior.engine.sha256);
    assert.equal(meta.engine.sourceModified,false);assert.equal(meta.engine.neuralModelUsed,false);
    assert.match(meta.review,/Human listening.*unverified/);
  }
});
