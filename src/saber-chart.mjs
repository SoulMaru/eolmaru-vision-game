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
    const timeUs=Math.round(n.time*1e6),time=timeUs/1e6,hitTime=time+raw.offsetSeconds,spawnTime=hitTime-leadSeconds;
    if(spawnTime<0||hitTime>duration-1||hitTime<0)fail('첫 노트의 접근 시간 또는 곡 끝 1초 여백이 부족해요.');
    return Object.freeze({id:n.id,time,timeUs,hitTime,spawnTime,lineIndex:n.lineIndex,lineLayer:n.lineLayer,hand:n.hand,cutDirection:n.cutDirection});
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
  return {schemaVersion:1,songId:chart.songId,bpm:chart.bpm,offsetSeconds:chart.offsetSeconds,notes:chart.notes.map(({id,time,lineIndex,lineLayer,hand,cutDirection})=>({id,time,lineIndex,lineLayer,hand,cutDirection}))};
}

export function visibleNotes(chart,states,time) {
  return chart.notes.filter(n=>n.spawnTime<=time&&n.hitTime+.25>=time&&(!states?.has(n.id)));
}
