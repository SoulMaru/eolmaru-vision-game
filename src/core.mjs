// Raised-arm scoring adapts JustMove (c) 2026 Ying Wang, MIT. See THIRD_PARTY_NOTICES.md.
export const DIRECTIONS = ['left','up','down','right'];
export const ARROWS = {left:'←',up:'↑',down:'↓',right:'→'};
export const clamp = (x,a=0,b=1) => Math.max(a,Math.min(b,x));
export const midpoint = (a,b) => ({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
export const visible = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility ?? 1) >= .55;
export function validateTrackDuration(seconds){return Number.isFinite(seconds)&&seconds>=120&&seconds<=180;}
export function mirrorPose(pose) { return pose.map(p=>({...p,x:1-p.x})); }

// Assign by mirrored screen position, never by the detector's result order.
// In two-player mode, no usable person in one zone leaves that slot empty.
export function assignPlayers(poses, count=1) {
  const slots=Array(count).fill(null), quality=Array(count).fill(-1);
  for(const pose of poses) {
    if(![11,12,23,24].every(i=>visible(pose[i]))) continue;
    const center=midpoint(pose[11],pose[12]);
    const zone=count===1 ? 0 : center.x < .47 ? 0 : center.x > .53 ? 1 : -1;
    if(zone<0) continue;
    const target=count===1 ? .5 : zone===0 ? .25 : .75;
    const q=1-Math.abs(center.x-target);
    if(q>quality[zone]) { slots[zone]=pose; quality[zone]=q; }
  }
  return slots;
}

export function generateChart({bpm=112,duration=150,difficulty='easy'}={}) {
  if(!Number.isFinite(bpm)||bpm<40||bpm>240||!Number.isFinite(duration)||duration<=0) throw new Error('Invalid chart parameters');
  const beat=60/bpm, step=difficulty==='normal'?2:4;
  const pattern=['left','up','right','down','up','left','down','right'];
  const notes=[];
  for(let b=8;b*beat<duration-2;b+=step) notes.push({id:notes.length,time:b*beat,lane:pattern[notes.length%pattern.length]});
  return notes;
}
export function createScore() {return {score:0,combo:0,maxCombo:0,perfect:0,great:0,good:0,miss:0,hits:new Set(),expired:new Set(),last:'준비'};}
export function judgeHit(notes,state,lane,time,window=.30) {
  if(!Number.isFinite(time)||!DIRECTIONS.includes(lane)) return null;
  let match=null, delta=Infinity;
  for(const note of notes) {
    if(note.lane!==lane||state.hits.has(note.id)||state.expired.has(note.id)) continue;
    const d=Math.abs(note.time-time);
    if(d<=window&&d<delta) {match=note;delta=d;}
  }
  if(!match) return null;
  const rating=delta<=.12?'perfect':delta<=.22?'great':'good';
  state.hits.add(match.id); state[rating]++; state.combo++; state.maxCombo=Math.max(state.maxCombo,state.combo);
  state.score+=rating==='perfect'?100:rating==='great'?70:40; state.last=rating.toUpperCase();
  return {note:match,rating,delta};
}
export function expireNotes(notes,state,time,window=.30) {
  for(const note of notes) if(note.time+window<time&&!state.hits.has(note.id)&&!state.expired.has(note.id)) {
    state.expired.add(note.id);state.miss++;state.combo=0;state.last='다음 박자로!';
  }
}

function handZone(pose,index,sensitivity=1,aspect=4/3) {
  if(![11,12,23,24,index].every(i=>visible(pose[i]))) return null;
  const shoulder=midpoint(pose[11],pose[12]), hip=midpoint(pose[23],pose[24]);
  const width=Math.abs(pose[11].x-pose[12].x)*aspect;
  const torso=Math.abs(hip.y-shoulder.y);
  if(width<.045||torso<.07) return null;
  const x=(pose[index].x-shoulder.x)*aspect/width, y=(pose[index].y-shoulder.y)/torso;
  if(y<-.35/sensitivity) return 'up';
  if(y>.95/sensitivity) return 'down';
  if(x<-.95/sensitivity) return 'left';
  if(x>.95/sensitivity) return 'right';
  return 'center';
}

export class GestureTracker {
  constructor(){this.reset();}
  reset(){this.hands=[{zone:null,armed:false,last:-Infinity},{zone:null,armed:false,last:-Infinity}];this.lastSeen=null;}
  update(pose,now,sensitivity=1,aspect=4/3){
    if(!pose||!Number.isFinite(now)){this.reset();return [];}
    if(this.lastSeen!==null&&now-this.lastSeen>400) this.reset();
    this.lastSeen=now;
    const actions=[];
    [15,16].forEach((id,h)=>{
      const zone=handZone(pose,id,sensitivity,aspect), hand=this.hands[h];
      if(zone===null) {hand.armed=false;hand.zone=null;return;}
      if(zone==='center') hand.armed=true;
      else if(hand.armed&&zone!==hand.zone&&now-hand.last>=250) {
        actions.push(zone);hand.last=now;hand.armed=false;
      }
      hand.zone=zone;
    });
    return [...new Set(actions)];
  }
}

export function targetPose(id='rest'){
  const p=Array.from({length:33},()=>({x:.5,y:.5,visibility:1}));
  const lean=id==='left'?-.08:id==='right'?.08:0;
  const set=(i,x,y)=>p[i]={x:x+((i<23)?lean:0),y,visibility:1};
  set(0,.5,.16);set(11,.40,.32);set(12,.60,.32);set(23,.44,.64);set(24,.56,.64);
  set(25,.42,.80);set(26,.58,.80);set(27,.40,.96);set(28,.60,.96);
  const arms=id==='open'?[.25,.32,.75,.32,.10,.32,.90,.32]:id==='up'?[.32,.19,.68,.19,.30,.04,.70,.04]:id==='left'?[.32,.48,.55,.14,.30,.64,.40,.06]:id==='right'?[.45,.14,.68,.48,.60,.06,.70,.64]:[.34,.47,.66,.47,.34,.62,.66,.62];
  [13,14,15,16].forEach((n,i)=>set(n,arms[i*2],arms[i*2+1]));
  return p;
}
export function poseSimilarity(actual,id,aspect=4/3){
  if(id==='rest') return null;
  if(!actual||![11,12,13,14,15,16,23,24].every(i=>visible(actual[i]))) return null;
  const expected=targetPose(id);
  const pairs=[[11,13],[13,15],[12,14],[14,16]];
  const cosine=(a,b,c,d,s=1)=>{
    const ax=(b.x-a.x)*s,ay=b.y-a.y,bx=d.x-c.x,by=d.y-c.y;
    const len=Math.hypot(ax,ay)*Math.hypot(bx,by);
    return len<.0001?0:clamp((ax*bx+ay*by)/len);
  };
  let score=pairs.reduce((sum,[a,b])=>sum+cosine(actual[a],actual[b],expected[a],expected[b],aspect),0)/4;
  const trunk=cosine(midpoint(actual[23],actual[24]),midpoint(actual[11],actual[12]),midpoint(expected[23],expected[24]),midpoint(expected[11],expected[12]),aspect);
  score=score*.8+trunk*.2;
  if(['left','right'].includes(id)) {
    const tilt=(p,s)=>{const hip=midpoint(p[23],p[24]),shoulder=midpoint(p[11],p[12]);return Math.atan2((shoulder.x-hip.x)*s,hip.y-shoulder.y);};
    const error=Math.abs(tilt(actual,aspect)-tilt(expected,1));
    const leanMatch=clamp(1-error/.28);
    score=score*.7+leanMatch*.3;
  }
  if(id==='up') {
    // Adapted from JustMove POSES['arms-up'].check; guarded visibility above.
    const raised=(actual[15].y<actual[11].y?.3:0)+(actual[16].y<actual[12].y?.3:0)+(actual[15].y<actual[13].y?.2:0)+(actual[16].y<actual[14].y?.2:0);
    score=score*.8+raised*.2;
  }
  return Math.round(clamp(score)*100);
}

export function resultSummary(state,chartLength) {
  return {score:state.score,maxCombo:state.maxCombo,perfect:state.perfect,great:state.great,good:state.good,miss:state.miss,accuracy:chartLength?Math.round(state.hits.size/chartLength*100):0};
}
