// Pure, player-local decisions. No DOM, clock reads, score or audio side effects.
export const POLICY=Object.freeze({window:.25,grace:.45,directionDegrees:50,coverage:.8,halfSize:.36,maxGap:.2,minDistance:.07,minSpeed:.65,maxSpeed:35});
const vectors={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};
export const HIT_GRADES=Object.freeze([
  ['good','굳'],['great','그레이트'],['perfect','퍼팩트'],['excellent','엑셀런트'],['yummy','야미'],
].map(([key,label],tier)=>Object.freeze({key,label,tier})));
export function timingGrade(hitTime,noteTime,window=POLICY.window){
  if(![hitTime,noteTime,window].every(Number.isFinite)||window<=0)throw new RangeError('Finite times and a positive timing window are required.');
  const timingErrorMs=(hitTime-noteTime)*1000;
  const accuracy=Math.max(0,Math.min(100,100*(1-Math.abs(hitTime-noteTime)/window)));
  // Absorb binary representation noise at exact boundaries, not display rounding.
  const tier=Math.min(4,Math.floor((accuracy+1e-9)/20));
  return {accuracy,timingErrorMs,grade:HIT_GRADES[tier]};
}

export function segmentRect(a,b,rect){
  let enter=0,exit=1;
  const dx=b.x-a.x,dy=b.y-a.y;
  for(const [p,q] of [[-dx,a.x-rect.left],[dx,rect.right-a.x],[-dy,a.y-rect.top],[dy,rect.bottom-a.y]]){
    if(Math.abs(p)<1e-12){if(q<0)return null;continue;}
    const r=q/p;if(p<0)enter=Math.max(enter,r);else exit=Math.min(exit,r);if(enter>exit)return null;
  }
  return {enter,exit};
}
export function intervalCoverage(intervals,start,end){
  if(end<=start)return 0;
  const clipped=intervals.map(([a,b])=>[Math.max(a,start),Math.min(b,end)]).filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0]);
  let total=0,left=null,right=null;
  for(const [a,b] of clipped){if(left===null){left=a;right=b;}else if(a<=right)right=Math.max(right,b);else{total+=right-left;left=a;right=b;}}
  if(left!==null)total+=right-left;
  return Math.min(1,total/(end-start));
}

export class SaberSession {
  constructor(chart,player=0,policy={}){this.chart=chart;this.player=player;this.policy={...POLICY,...policy};this.reset();}
  reset(){this.states=new Map();this.usedStrokes=new Set();this.observed={left:[],right:[]};this.counts={hit:0,wrongCut:0,miss:0,untracked:0};this.lastAdvance=null;}
  outcome(note,kind,time,hand=note.hand){
    if(this.states.has(note.id))return null;
    const event={id:note.id,kind,time,player:this.player,hand,x:note.lineIndex+.5,y:note.lineLayer+.5,direction:note.cutDirection};
    if(kind==='hit')Object.assign(event,timingGrade(time,note.hitTime,this.policy.window));
    this.states.set(note.id,event);this.counts[kind]++;return event;
  }
  observe(segment,arrivalTime){
    if(!segment||!Number.isFinite(arrivalTime))return null;
    const {from:a,to:b}=segment,p=this.policy;
    if(!a||!b||a.player!==this.player||b.player!==this.player||a.hand!==b.hand||!this.observed[b.hand]||a.sessionId!==b.sessionId||a.inputEpoch!==b.inputEpoch||a.source!==b.source)return null;
    const t0=a.audioTimeSeconds,t1=b.audioTimeSeconds,dt=(b.capturedAtMs-a.capturedAtMs)/1000;
    if(![a.x,a.y,b.x,b.y,t0,t1,dt].every(Number.isFinite)||dt<=0||dt>p.maxGap+1e-9||t1<=t0||![a.confidence??1,b.confidence??1].every(c=>Number.isFinite(c)&&c>=.55&&c<=1)||a.valid===false||b.valid===false)return null;
    const distance=Math.hypot(b.x-a.x,b.y-a.y),speed=distance/dt;
    if(speed>p.maxSpeed||arrivalTime-t1>p.grace+1e-9||t1-arrivalTime>.25+1e-9)return null;
    this.observed[b.hand].push([t0,t1]);
    if((segment.strokeDistance??distance)<p.minDistance||distance<1e-8||speed<p.minSpeed||!segment.strokeId||this.usedStrokes.has(segment.strokeId))return null;
    const candidates=[];
    for(const note of this.chart.notes){
      if(this.states.has(note.id)||arrivalTime>note.hitTime+p.window+p.grace||t1<note.hitTime-p.window||t0>note.hitTime+p.window)continue;
      const x=note.lineIndex+.5,y=note.lineLayer+.5,rect={left:x-p.halfSize,right:x+p.halfSize,top:y-p.halfSize,bottom:y+p.halfSize};
      const intersection=segmentRect(a,b,rect);if(!intersection)continue;
      // Clip intersection against the temporal window; entering spatially early may still cross during the window.
      const ratio=Math.max(intersection.enter,t1>t0?(note.hitTime-p.window-t0)/(t1-t0):0),time=t0+(t1-t0)*ratio;
      if(ratio>intersection.exit||time>note.hitTime+p.window+1e-9)continue;
      candidates.push({note,time});
    }
    candidates.sort((a,b)=>a.time-b.time||a.note.hitTime-b.note.hitTime||a.note.id.localeCompare(b.note.id));
    const found=candidates[0];if(!found)return null;
    const target=vectors[found.note.cutDirection];
    const directionOK=!target||((b.x-a.x)*target.x+(b.y-a.y)*target.y)/distance>=Math.cos(p.directionDegrees*Math.PI/180);
    const kind=found.note.hand===b.hand&&directionOK?'hit':'wrongCut';
    this.usedStrokes.add(segment.strokeId);
    return this.outcome(found.note,kind,found.time,b.hand);
  }
  advance(time){
    if(!Number.isFinite(time))return [];
    const events=[],p=this.policy;
    for(const note of this.chart.notes){
      if(this.states.has(note.id)||time<=note.hitTime+p.window+p.grace)continue;
      const covered=intervalCoverage(this.observed[note.hand],note.hitTime-p.window,note.hitTime+p.window);
      events.push(this.outcome(note,covered+1e-9>=p.coverage?'miss':'untracked',time));
    }
    for(const hand of ['left','right'])this.observed[hand]=this.observed[hand].filter(([,b])=>b>=time-3);
    this.lastAdvance=time;return events;
  }
  seek(time){
    this.reset();
    // Practice seeks skip history without inventing misses, hits, or sound events.
    for(const n of this.chart.notes)if(n.hitTime+this.policy.window<time)this.states.set(n.id,{id:n.id,kind:'skipped',time});
    this.lastAdvance=time;
  }
  summary(){return {...this.counts,total:this.chart.notes.length};}
}
