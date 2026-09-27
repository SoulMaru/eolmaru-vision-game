// Observation coordinates only. Decorative interpolation is never fed to judging.
import {HANDS} from './saber-chart.mjs';
const validConfidence=value=>Number.isFinite(value)&&value>=.55&&value<=1;
const validPoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&validConfidence(p.visibility??1);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function assignSaberPlayers(poses,count=1){
  const candidates=Array.from({length:count},()=>[]);
  for(const pose of poses){
    if(![11,12,23,24].every(i=>validPoint(pose[i])))continue;
    const x=(pose[11].x+pose[12].x)/2;
    const slot=count===1?0:x<.47?0:x>.53?1:-1;
    if(slot>=0)candidates[slot].push(pose);
  }
  return candidates.map(list=>list.length===1?list[0]:null);
}

export function calibrationFromPose(pose,aspect=4/3,range=1){
  if(!pose||![11,12,23,24].every(i=>validPoint(pose[i]))||!Number.isFinite(aspect)||aspect<=0)return null;
  const cx=(pose[11].x+pose[12].x)/2*aspect,sy=(pose[11].y+pose[12].y)/2,hy=(pose[23].y+pose[24].y)/2;
  const shoulder=Math.abs(pose[11].x-pose[12].x)*aspect,torso=hy-sy;
  if(shoulder<.045||torso<.07)return null;
  const cell=Math.max(.025,Math.min(shoulder*.56,torso*.5))*clamp(range,.65,1.3);
  return {cx,cy:sy+torso*.42,cell,aspect,anchorX:cx,anchorY:sy,shoulder};
}

export function poseHand(pose,hand,calibration){
  const point=pose?.[hand==='left'?15:16];
  if(!calibration||!validPoint(point))return null;
  return {x:(point.x*calibration.aspect-calibration.cx)/calibration.cell+2,y:(point.y-calibration.cy)/calibration.cell+1.5,confidence:point.visibility??1};
}

export function calibrationMoved(pose,c){
  if(!c||!pose||![11,12].every(i=>validPoint(pose[i])))return true;
  const x=(pose[11].x+pose[12].x)/2*c.aspect,y=(pose[11].y+pose[12].y)/2;
  return Math.hypot(x-c.anchorX,y-c.anchorY)>Math.max(c.shoulder*.65,.12);
}

export class HandTracker {
  constructor({maxGap=.2,maxSpeed=35,minSpeed=.65,minDistance=.07,trailSeconds=.22,maxTrail=18}={}){
    Object.assign(this,{maxGap,maxSpeed,minSpeed,minDistance,trailSeconds,maxTrail});this.serial=0;this.reset();
  }
  reset(){this.previous=null;this.trail=[];this.stroke=null;this.lastVector=null;this.lastMove=-Infinity;this.strokeDistance=0;}
  missing(){this.reset();}
  push(sample){
    if(!sample||sample.valid===false||![sample.x,sample.y,sample.audioTimeSeconds,sample.capturedAtMs].every(Number.isFinite)||!validConfidence(sample.confidence??1)){this.reset();return null;}
    const prev=this.previous;
    if(prev&&sample.frameId===prev.frameId&&sample.inputEpoch===prev.inputEpoch&&sample.sessionId===prev.sessionId)return null;
    const time=sample.audioTimeSeconds,dt=prev?(sample.capturedAtMs-prev.capturedAtMs)/1000:0;
    const same=prev&&sample.sessionId===prev.sessionId&&sample.inputEpoch===prev.inputEpoch&&sample.hand===prev.hand&&sample.player===prev.player&&sample.source===prev.source;
    if(!same||dt<=0||dt>this.maxGap+1e-9||time<=prev.audioTimeSeconds){this.reset();this.previous={...sample};this.trail=[{x:sample.x,y:sample.y,t:time}];return null;}
    const dx=sample.x-prev.x,dy=sample.y-prev.y,distance=Math.hypot(dx,dy),speed=distance/dt;
    if(speed>this.maxSpeed){this.reset();this.previous={...sample};return null;}
    this.previous={...sample};this.trail.push({x:sample.x,y:sample.y,t:time});this.trail=this.trail.filter(p=>time-p.t<=this.trailSeconds).slice(-this.maxTrail);
    const moving=speed>=this.minSpeed;
    let vector=null;
    if(moving){
      vector={x:dx/distance,y:dy/distance};
      if(!this.stroke||time-this.lastMove>.14||(this.lastVector&&vector.x*this.lastVector.x+vector.y*this.lastVector.y<.15)){this.stroke=++this.serial;this.strokeDistance=0;}
      this.strokeDistance+=distance;
      this.lastVector=vector;this.lastMove=time;
    }else if(time-this.lastMove>.14){this.stroke=null;this.lastVector=null;}
    return {from:prev,to:{...sample},dt,distance,speed,moving,vector,strokeDistance:this.strokeDistance,strokeId:this.stroke===null?null:`${sample.sessionId}:${sample.inputEpoch}:${sample.player}:${sample.hand}:${this.stroke}`};
  }
  display(){return this.previous?{x:this.previous.x,y:this.previous.y,valid:true,trail:this.trail}:{x:2,y:1.5,valid:false,trail:[]};}
}

export function createHands(){return Object.fromEntries(HANDS.map(hand=>[hand,new HandTracker()]));}
export function pointerStep(point,dx,dy,dt){return {x:clamp(point.x+dx*dt*4,-.5,4.5),y:clamp(point.y+dy*dt*4,-.5,3.5)};}
