// Local v1 chart contract. Times are seconds; source objects are never mutated.
export const DIRECTIONS = Object.freeze(['up','down','left','right','any']);
export const HANDS = Object.freeze(['left','right']);
export const LEAD_SECONDS = 1.8;
const fail = message => { throw new Error(message); };
const finite = value => typeof value === 'number' && Number.isFinite(value);
const token = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);

export function validateChart(input,{duration=150,leadSeconds=LEAD_SECONDS,songId=null,allowEmpty=false}={}) {
  if(!finite(duration)||duration<120||duration>180)fail('노래 길이는 120~180초여야 해요.');
  if(!finite(leadSeconds)||leadSeconds<.5||leadSeconds>5)fail('접근 시간이 올바르지 않아요.');
  let raw=input;
  try {
    const json=typeof input==='string'?input:JSON.stringify(input);
    if(typeof json!=='string'||new TextEncoder().encode(json).length>1024*1024)fail('채보는 1MB 이하여야 해요.');
    raw=JSON.parse(json);
  } catch(error) { if(error.message.includes('1MB'))throw error;fail('채보 JSON을 읽을 수 없어요.'); }
  if(!raw||Array.isArray(raw)||raw.schemaVersion!==1)fail('지원하는 채보 형식은 v1이에요.');
  if(!token(raw.songId)||(songId!==null&&raw.songId!==songId))fail('현재 노래와 채보의 곡 이름이 달라요.');
  if(!finite(raw.bpm)||raw.bpm<40||raw.bpm>240)fail('BPM은 40~240 사이 숫자여야 해요.');
  if(!finite(raw.offsetSeconds))fail('채보 시작 보정값이 올바르지 않아요.');
  if(!Array.isArray(raw.notes)||raw.notes.length>2000||(!allowEmpty&&!raw.notes.length))fail('채보에는 1~2000개의 노트가 필요해요.');
  const ids=new Set();
  const notes=raw.notes.map(n=>{
    if(!n||!token(n.id)||ids.has(n.id))fail('노트 ID가 없거나 중복됐어요.');
    ids.add(n.id);
    if(!finite(n.time)||n.time<0||n.time>duration)fail('노트 시간이 노래 범위를 벗어났어요.');
    if(!Number.isInteger(n.lineIndex)||n.lineIndex<0||n.lineIndex>3||!Number.isInteger(n.lineLayer)||n.lineLayer<0||n.lineLayer>2)fail('노트 위치는 4열 × 3층 안이어야 해요.');
    if(!HANDS.includes(n.hand)||!DIRECTIONS.includes(n.cutDirection))fail('노트의 손 또는 방향이 올바르지 않아요.');
    const kind=n.kind??'tap';
    if(!['tap','sustain'].includes(kind))fail('타겟 종류는 tap 또는 sustain이어야 해요.');
    if(kind==='sustain'&&(!finite(n.durationSeconds)||n.durationSeconds<.5||n.durationSeconds>6||n.cutDirection!=='any'))fail('지속 타겟은 자유 방향, 0.5~6초로 만들어 주세요.');
    if(kind==='tap'&&n.durationSeconds!==undefined)fail('한 번 베는 타겟에는 지속 시간이 필요하지 않아요.');
    const timeUs=Math.round(n.time*1e6),time=timeUs/1e6,hitTime=time+raw.offsetSeconds,spawnTime=hitTime-leadSeconds;
    if(spawnTime<0||hitTime>duration-1||hitTime<0)fail('첫 노트의 접근 시간 또는 곡 끝 1초 여백이 부족해요.');
    const extra=kind==='sustain'?{kind,durationSeconds:n.durationSeconds,endTime:hitTime+n.durationSeconds}:{};
    if(extra.endTime>duration-1)fail('지속 타겟이 끝난 뒤 곡 끝까지 1초 여백이 필요해요.');
    return Object.freeze({id:n.id,time,timeUs,hitTime,spawnTime,lineIndex:n.lineIndex,lineLayer:n.lineLayer,hand:n.hand,cutDirection:n.cutDirection,...extra});
  }).sort((a,b)=>a.timeUs-b.timeUs||a.id.localeCompare(b.id));
  let previous=null,group=[];
  for(const n of notes) {
    if(previous!==n.timeUs){
      if(previous!==null&&n.timeUs-previous+1<120e6/raw.bpm)fail('노트 묶음 사이는 최소 2박이어야 해요.');
      previous=n.timeUs;group=[];
    }
    if(group.length>=2||group.some(other=>other.hand===n.hand||(other.lineIndex===n.lineIndex&&other.lineLayer===n.lineLayer)))fail('동시 노트는 서로 다른 손과 위치의 두 개까지 가능해요.');
    group.push(n);
  }
  for(let i=0;i<notes.length;i++)if(notes[i].kind==='sustain'){
    const hold=notes[i];
    for(let j=i+1;j<notes.length&&notes[j].hitTime<hold.endTime+.5-1e-9;j++){
      const n=notes[j];
      if(n.hand===hold.hand||(n.lineIndex===hold.lineIndex&&n.lineLayer===hold.lineLayer))fail('지속 타겟이 끝나고 0.5초 뒤에 같은 손·칸의 다음 타겟을 놓아 주세요.');
    }
  }
  return Object.freeze({schemaVersion:1,songId:raw.songId,bpm:raw.bpm,offsetSeconds:raw.offsetSeconds,leadSeconds,duration,notes:Object.freeze(notes)});
}

export function generateEasyChart({bpm=112,duration=150,offsetSeconds=0,songId='maru-flow',leadSeconds=LEAD_SECONDS}={}) {
  if(!finite(bpm)||bpm<40||bpm>240||!finite(duration)||duration<120||duration>180||!finite(offsetSeconds)||Math.abs(offsetSeconds)>duration)fail('연습 패턴의 길이·BPM·보정값을 확인해 주세요.');
  const beat=60/bpm,notes=[];
  let group=0;
  const first=Math.max(8,Math.ceil((leadSeconds+.3-offsetSeconds)/beat/2)*2);
  for(let b=first;b*beat<=duration&&b*beat+offsetSeconds<=duration-1.05;b+=2,group++){
    const hands=group>0&&group%12===0?HANDS:[group%2?'right':'left'];
    for(const hand of hands){
      const phase=Math.floor(group/4)%4;
      notes.push({id:`n${notes.length+1}`,time:Math.round(b*beat*1e6)/1e6,lineIndex:hand==='left'?1:2,lineLayer:phase===2?0:phase===3?2:1,hand,cutDirection:phase===0?'down':phase===1?'up':phase===2?'any':hand==='left'?'left':'right'});
    }
  }
  return validateChart({schemaVersion:1,songId,bpm,offsetSeconds,notes},{duration,leadSeconds,songId});
}

export function chartJSON(chart) {
  return {schemaVersion:1,songId:chart.songId,bpm:chart.bpm,offsetSeconds:chart.offsetSeconds,notes:chart.notes.map(({id,time,lineIndex,lineLayer,hand,cutDirection,kind,durationSeconds})=>({id,time,lineIndex,lineLayer,hand,cutDirection,...(kind==='sustain'?{kind,durationSeconds}:{})}))};
}

export function visibleNotes(chart,states,time) {
  return chart.notes.filter(n=>n.spawnTime<=time&&(n.endTime??n.hitTime)+.25>=time&&(!states?.has(n.id)));
}

/** Original training arrangement. Every phrase teaches taps, then a sustained sweep. */
export function generateTrainingChart(options={}){
  const easy=generateEasyChart(options),beat=60/easy.bpm,notes=[];
  let group=0,lastTime=null,blockedUntil=-Infinity;
  for(const source of easy.notes){
    if(source.time!==lastTime){lastTime=source.time;group++;}
    if(source.hitTime<blockedUntil-1e-6)continue;
    const n=chartJSON({...easy,notes:[source]}).notes[0];
    if(group%12===5){
      const durationSeconds=(Math.floor(group/12)%2?4:2)*beat;
      if(source.hitTime+durationSeconds<=easy.duration-1){
        const hand=Math.floor(group/12)%2?'right':'left';
        Object.assign(n,{kind:'sustain',cutDirection:'any',durationSeconds,hand,lineIndex:hand==='left'?1:2});
        blockedUntil=source.hitTime+durationSeconds+.5;
      }
    }
    notes.push(n);
  }
  return validateChart({...chartJSON(easy),notes},{duration:easy.duration,songId:easy.songId,leadSeconds:easy.leadSeconds});
}

/** Display/practice settings never rewrite the source chart or change its music clock. */
export function applyTrainingSettings(chart,{approachSpeed=1,spacingBeats=2}={}){
  if(!finite(approachSpeed)||approachSpeed<.6||approachSpeed>1.6||![2,4].includes(spacingBeats))fail('접근 속도는 0.6~1.6배, 등장 간격은 2박 또는 4박이에요.');
  const leadSeconds=LEAD_SECONDS/approachSpeed;
  let group=-1,previous=null;
  const notes=chart.notes.filter(n=>{
    if(n.timeUs!==previous){group++;previous=n.timeUs;}
    return spacingBeats===2||group%2===0;
  }).map(n=>Object.freeze({...n,spawnTime:Math.max(0,n.hitTime-leadSeconds)}));
  return Object.freeze({...chart,leadSeconds,approachSpeed,spacingBeats,notes:Object.freeze(notes)});
}
