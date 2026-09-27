import {generateEasyChart,validateChart,visibleNotes,HANDS} from './saber-chart.mjs';
import {SaberSession} from './saber-core.mjs';
import {createHands,assignSaberPlayers,calibrationFromPose,poseHand,calibrationMoved,pointerStep} from './saber-input.mjs';
import {drawSaber,stageToGrid} from './saber-render.mjs';

export class SaberGame {
  constructor({stage,audio,phase,players,input,notice,onHit,latency,range,quality}){
    Object.assign(this,{stage,audio,phase,players,input,notice,onHit,latency,range,quality});
    this.chart=generateEasyChart();this.selected={player:0,hand:'left'};this.keys=new Set();this.sessionId=0;this.epoch=0;
    this.calibrations=[null,null];this.cameraPoses=[null,null];this.status=['손을 편안하게 준비해요','손을 편안하게 준비해요'];
    this.points=[{left:{x:1.5,y:2.7},right:{x:2.5,y:2.7}},{left:{x:1.5,y:2.7},right:{x:2.5,y:2.7}}];
    this.calibrationTask=null;this.frameId=0;this.lastTime=null;this.lastFrame=null;this.configure();
    stage.addEventListener('pointermove',event=>{
      if(this.input()!=='keyboard'||document.querySelector('dialog[open]'))return;
      const rect=stage.getBoundingClientRect(),p=stageToGrid(event.clientX-rect.left,event.clientY-rect.top,rect.width,rect.height,this.players(),this.selected.player);
      if(p)this.points[this.selected.player][this.selected.hand]=p;
    });
    window.addEventListener('blur',()=>this.resetInput());
    window.addEventListener('resize',()=>this.resetInput());
    audio.addEventListener?.('seeking',()=>{if(this.phase()==='playing'){this.sessions.forEach(s=>s.seek(audio.currentTime));this.resetInput();this.lastTime=audio.currentTime;}});
  }
  configure(){this.calibrationTask=null;this.sessions=[new SaberSession(this.chart,0),new SaberSession(this.chart,1)];this.hands=[createHands(),createHands()];this.effects=[];this.resetInput();}
  setChart(chart){this.chart=chart;this.configure();}
  setTrack(track){this.setChart(generateEasyChart({bpm:track.bpm,duration:track.duration,songId:track.songId||'maru-flow'}));}
  importChart(text,track){const chart=validateChart(text,{duration:track.duration,songId:track.songId||'maru-flow'});this.setChart(chart);return chart;}
  start(){this.sessionId++;this.configure();this.lastTime=0;}
  resetInput(){this.epoch++;this.keys.clear();this.hands?.forEach(h=>HANDS.forEach(hand=>h[hand].reset()));this.lastFrame=null;this.effects=[];}
  forgetCamera(){this.calibrations=[null,null];this.cameraPoses=[null,null];this.calibrationTask=null;this.resetInput();}
  select(player,hand){this.selected={player:Math.min(player,this.players()-1),hand:HANDS.includes(hand)?hand:'left'};this.resetInput();}
  key(event,down){
    if(this.input()!=='keyboard')return false;
    if(['KeyQ','KeyE','Digit1','Digit2'].includes(event.code)){
      if(down&&!event.repeat){const player=event.code==='Digit1'?0:event.code==='Digit2'?1:this.selected.player,hand=event.code==='KeyQ'?'left':event.code==='KeyE'?'right':this.selected.hand;this.select(player,hand);}
      return true;
    }
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyA','KeyD','KeyW','KeyS'].includes(event.code)){down?this.keys.add(event.code):this.keys.delete(event.code);return true;}
    return false;
  }
  sample(player,hand,point,now,audioTime,source,frameId){
    const tracker=this.hands[player][hand];
    if(!point){tracker.missing();return;}
    const sample={...point,sessionId:this.sessionId,inputEpoch:this.epoch,player,hand,source,capturedAtMs:now,audioTimeSeconds:this.phase()==='idle'?now/1000:audioTime-this.latency(),frameId,valid:true};
    const segment=tracker.push(sample);
    if(this.phase()==='playing'){
      const event=this.sessions[player].observe(segment,this.audio.currentTime);
      if(event){this.effects.push({...event,time:this.audio.currentTime});this.effects=this.effects.slice(-24);if(event.kind==='hit')this.onHit(event.direction);}
    }
  }
  camera(poses,aspect,now,capturedAudioTime){
    const slots=assignSaberPlayers(poses,this.players());this.cameraPoses=slots;
    const fid=++this.frameId;
    slots.forEach((pose,player)=>{
      if(!pose){
        this.calibrations[player]=null;HANDS.forEach(h=>this.hands[player][h].missing());this.status[player]='인식 대기 · 내 구역에 앉아 주세요';return;
      }
      if(calibrationMoved(pose,this.calibrations[player])){
        this.calibrations[player]=calibrationFromPose(pose,aspect,this.range());HANDS.forEach(h=>this.hands[player][h].reset());
      }
      const c=this.calibrations[player];
      if(!c){this.status[player]='어깨·몸통·두 손을 보여 주세요';return;}
      if(this.calibrationTask){
        for(const id of [15,16]){const point=pose[id],confidence=point?.visibility??1;if(point&&[point.x,point.y,confidence].every(Number.isFinite)&&confidence>=.55&&confidence<=1)this.calibrationTask.points[player].push({x:point.x*aspect,y:point.y});}
      }
      let valid=0;
      for(const hand of HANDS){const p=poseHand(pose,hand,c);if(p)valid++;this.sample(player,hand,p,now,capturedAudioTime,'camera',fid);}
      this.status[player]=valid===2?'양손 인식 · 편안한 범위로 베어요':valid?'한 손 가림 · 두 손을 보여 주세요':'손 인식 대기';
    });
    return slots;
  }
  beginCalibration(){
    if(this.input()!=='camera'){this.notice('카메라를 켠 뒤 범위를 맞춰 주세요. 시험 입력은 바로 사용할 수 있어요.');return;}
    if(this.phase()!=='idle'){this.notice('곡을 마친 뒤 범위를 맞출 수 있어요.');return;}
    this.resetInput();this.calibrationTask={until:performance.now()+5000,points:[[],[]]};
    this.notice('5초 동안 양손을 편하게 닿는 위·아래·좌·우로 움직여 주세요.');
  }
  finishCalibration(){
    const task=this.calibrationTask;if(!task)return;this.calibrationTask=null;let success=0;
    for(let player=0;player<this.players();player++){
      const points=task.points[player],c=this.calibrations[player];if(!c||points.length<20)continue;
      const xs=points.map(p=>p.x).sort((a,b)=>a-b),ys=points.map(p=>p.y).sort((a,b)=>a-b),q=(a,f)=>a[Math.floor((a.length-1)*f)];
      const left=q(xs,.03),right=q(xs,.97),top=q(ys,.03),bottom=q(ys,.97),cell=Math.min((right-left)/4,(bottom-top)/3);
      if(cell<.035||right-left<c.shoulder*.8||bottom-top<.12)continue;
      this.calibrations[player]={...c,cx:(left+right)/2,cy:(top+bottom)/2,cell};success++;
    }
    this.resetInput();this.notice(success===this.players()?'편안한 손 범위를 맞췄어요. 빨강 L은 내 왼손, 파랑 R은 내 오른손이에요.':`${success}/${this.players()}명 범위 완료. 움직임이 작거나 가려진 자리는 어깨 기준 범위를 사용해요. 다시 맞출 수 있어요.`);
  }
  tick(now){
    const time=this.audio.currentTime,elapsed=this.lastFrame===null?0:Math.max(0,(now-this.lastFrame)/1000),dt=Math.min(.05,elapsed);this.lastFrame=now;
    if(this.calibrationTask){if(now>=this.calibrationTask.until)this.finishCalibration();else this.notice(`범위 맞추기 ${Math.ceil((this.calibrationTask.until-now)/1000)}초 · 편한 범위로 양손을 움직여 주세요`);}
    if(this.lastTime!==null&&this.phase()==='playing'&&(time<this.lastTime-.03||time-this.lastTime>elapsed+.5)){
      this.sessions.forEach(s=>s.seek(time));this.resetInput();
    }
    this.lastTime=time;
    if(this.input()==='keyboard'){
      this.selected.player=Math.min(this.selected.player,this.players()-1);
      const player=this.selected.player,hand=this.selected.hand;
      const left=this.keys.has('ArrowLeft')||this.keys.has('KeyA'),right=this.keys.has('ArrowRight')||this.keys.has('KeyD'),up=this.keys.has('ArrowUp')||this.keys.has('KeyW'),down=this.keys.has('ArrowDown')||this.keys.has('KeyS');
      this.points[player][hand]=pointerStep(this.points[player][hand],Number(right)-Number(left),Number(down)-Number(up),dt);
      const fid=++this.frameId;
      for(let p=0;p<this.players();p++)for(const h of HANDS)this.sample(p,h,this.points[p][h],now,time,'test',fid);
      this.status=['마우스 또는 방향키 · Q 왼손 / E 오른손','1·2로 시험할 사람 선택'];
    }
    if(this.phase()==='playing')for(let p=0;p<this.players();p++)this.sessions[p].advance(time);
    this.effects=this.effects.filter(e=>time-e.time<.65&&time>=e.time);
  }
  draw(ctx,w,h,{reduced=false}={}){
    const idle=this.phase()==='idle',time=idle?performance.now()/1000:this.audio.currentTime;
    const slots=Array.from({length:this.players()},(_,p)=>({hands:Object.fromEntries(HANDS.map(hand=>[hand,this.hands[p][hand].display()])),notes:idle?[]:visibleNotes(this.chart,this.sessions[p].states,time),status:this.status[p],counts:this.sessions[p].counts}));
    drawSaber(ctx,w,h,{time,bpm:this.chart.bpm,slots,phase:this.phase(),effects:this.effects,reduced,quality:this.quality(),selected:this.selected});
  }
  finish(){this.sessions.forEach(s=>s.advance(this.chart.duration));this.resetInput();return this.sessions.slice(0,this.players()).map(s=>s.summary());}
  summary(){return this.sessions.slice(0,this.players()).map(s=>s.summary());}
}
