import {validateChart} from './saber-chart.mjs';
export const TUTORIAL_BPM=112, TUTORIAL_LOOP=32*60/TUTORIAL_BPM;
export const TUTORIAL_STEPS=Object.freeze([
  {id:'position',title:'첫 위치 잡기',text:'의자에 편하게 앉아 어깨·골반·두 손을 카메라에 보여 주세요. 1인은 가운데, 2인은 P1 왼쪽·P2 오른쪽에서 서로 닿지 않게 준비해요.',hint:'아래 카메라의 자리 틀에 몸통을 놓고 1초 동안 머물러요.'},
  {id:'range',title:'내 손 범위 맞추기',text:'몸통은 제자리에 두고 두 손을 편하게 닿는 위·아래·좌·우로 움직여요. 5초 동안 내 움직임 범위를 기록해요.',hint:'범위 맞추기를 누르세요. 손을 가만히 두거나 가리면 다시 시도해요.'},
  {id:'hands',title:'양손과 검 익히기',text:'빨강 L은 내 왼손, 파랑 R은 내 오른손이에요. 검 끝의 밝은 점을 같은 색 블록에 통과시키세요. 동그라미 블록은 어느 방향으로 베어도 돼요.',hint:'각자 왼손 한 번 + 오른손 한 번. 마우스는 Q/E로 손, 1/2로 사람을 골라요.',practice:true},
  {id:'directions',title:'화살표대로 휘두르기',text:'블록이 앞쪽 네모에 도착하면 화살표 방향으로 베어요. 팔을 움직이면 검의 기울기와 잔상이 따라와요.',hint:'각자 ↓ ↑ ← → 네 방향을 성공해요. 놓치면 같은 짧은 구간을 다시 연습해요.',practice:true},
  {id:'timing',title:'박자와 베이스 느끼기',text:'딱 맞는 순간에 가까울수록 쿵 소리가 커져요. 굳·그레이트는 첫 소리, 퍼팩트는 두 번째, 엑셀런트·야미는 세 번째 소리예요.',hint:'각자 정확도 60% 이상 두 번. 가까운 테두리에 블록이 꽉 찰 때 베어요.',practice:true},
  {id:'sustain',title:'계속 베는 타겟',text:'∞ 타겟은 같은 손으로 네모 안을 좌우·위아래로 계속 움직여요. 가만히 두면 진행되지 않아요. 막대가 차도 끝부분까지 이어가세요.',hint:'각자 ∞ 하나 완성. 전체 시간의 60% 이상 움직이고 마지막까지 유지해요.',practice:true},
  {id:'finish',title:'이제 한 곡을 즐겨요',text:'노래를 고르고 카메라를 켠 뒤 플레이 시작! 접근 속도는 블록의 빠르기, 등장 간격은 타겟 수예요. 스페이스 또는 일시정지로 쉬고, Esc로 전체화면을 나올 수 있어요.',hint:'전신 스트레칭은 별도 카테고리예요. 서기·누워서·커플 세트를 선택해요. 튜토리얼과 일반 플레이 모두 탈락은 없어요.'},
].map(s=>Object.freeze(s)));

const valid=p=>p&&[p.x,p.y,p.visibility??1].every(Number.isFinite)&&(p.visibility??1)>=.55&&(p.visibility??1)<=1&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1;
export function placementStatus(pose,player=0,players=1){
  if(![1,2].includes(players)||!Number.isInteger(player)||player<0||player>=players)return {ready:false,reason:'자리 정보가 없어요'};
  if(!pose||![11,12,23,24,15,16].every(i=>valid(pose[i])))return {ready:false,reason:'어깨·골반·두 손을 보여 주세요'};
  const x=(pose[11].x+pose[12].x)/2,sy=(pose[11].y+pose[12].y)/2,hy=(pose[23].y+pose[24].y)/2;
  const [left,right]=players===1?[.2,.8]:player===0?[.10,.43]:[.57,.90];
  if(x<left||x>right)return {ready:false,reason:players===1?'카메라 가운데에 앉아 주세요':`P${player+1} ${player===0?'왼쪽':'오른쪽'} 자리로 이동해요`};
  if(hy-sy<.12||hy-sy>.62||sy<.08||hy>.94||Math.abs(pose[11].x-pose[12].x)<.045)return {ready:false,reason:'어깨와 골반이 함께 보이도록 거리를 맞춰요'};
  return {ready:true,reason:'좋아요. 이 자리에 잠시 머물러요'};
}

export function tutorialChart(stepId){
  const practice=TUTORIAL_STEPS.find(s=>s.id===stepId)?.practice;
  const beat=60/TUTORIAL_BPM,notes=[];
  if(practice){
    const directions=['down','up','left','right','down','up'];
    const beats=stepId==='sustain'?[8,20]:[4,8,12,16,20,24];
    beats.forEach((b,i)=>{const hand=i%2?'right':'left';notes.push({id:`${stepId}-${i}`,time:b*beat,lineIndex:hand==='left'?1:2,lineLayer:1,hand,cutDirection:stepId==='directions'?directions[i]:'any',...(stepId==='sustain'?{kind:'sustain',durationSeconds:4*beat}:{})});});
  }
  // Reuse the existing 150-second track and strict chart validator; only its opening loop plays.
  return validateChart({schemaVersion:1,songId:`tutorial-${stepId}`,bpm:TUTORIAL_BPM,offsetSeconds:0,notes},{duration:150,allowEmpty:true});
}

export class TutorialProgress {
  constructor(players=1){this.reset(players);}
  reset(players=this.players){this.players=players===2?2:1;this.index=0;this.results=[];this.clearStep();}
  get step(){return TUTORIAL_STEPS[this.index];}
  clearStep(){this.holds=Array(this.players).fill(0);this.positionSince=Array(this.players).fill(null);this.positionTime=null;this.positionReasons=Array(this.players).fill('인식 대기');this.range=Array(this.players).fill(false);this.marks=Array.from({length:this.players},()=>new Set());this.seen=new Set();}
  placement(poses,now){
    if(this.step.id!=='position'||!Number.isFinite(now))return;
    const gap=this.positionTime!==null&&(now-this.positionTime>250||now<this.positionTime);this.positionTime=now;
    for(let p=0;p<this.players;p++){
      const status=placementStatus(poses?.[p],p,this.players);this.positionReasons[p]=status.reason;
      if(!status.ready){this.positionSince[p]=null;this.holds[p]=0;continue;}
      if(gap||this.positionSince[p]===null)this.positionSince[p]=now;
      this.holds[p]=Math.min(1,Math.max(0,(now-this.positionSince[p])/1000));
    }
  }
  losePosition(){if(this.step.id==='position'){this.holds.fill(0);this.positionSince.fill(null);this.positionTime=null;this.positionReasons.fill('카메라 인식을 기다려요');}}
  calibrated(flags){if(this.step.id==='range')this.range=this.range.map((_,p)=>flags?.[p]===true);}
  hit(event,cycle=0){
    if(!this.step.practice||event?.kind!=='hit'||!Number.isInteger(event.player)||event.player<0||event.player>=this.players||typeof event.id!=='string'||!event.id.startsWith(this.step.id+'-'))return false;
    const key=`${cycle}:${event.player}:${event.id}`;if(this.seen.has(key))return false;
    this.seen.add(key);if(this.seen.size>256)this.seen.delete(this.seen.values().next().value);
    const marks=this.marks[event.player];
    if(this.step.id==='hands'&&['left','right'].includes(event.hand))marks.add(event.hand);
    if(this.step.id==='directions'&&['up','down','left','right'].includes(event.direction))marks.add(event.direction);
    if(this.step.id==='timing'&&Number.isFinite(event.accuracy)&&event.accuracy>=60&&marks.size<2)marks.add(key);
    if(this.step.id==='sustain'&&event.targetKind==='sustain'&&event.sustainAccuracy>=60)marks.add('sustain');
    return true;
  }
  playerReady(p,input){
    const id=this.step.id;
    if(id==='finish')return true;
    if(id==='position')return input==='keyboard'||input==='camera'&&this.holds[p]>=1;
    if(id==='range')return input==='keyboard'||input==='camera'&&this.range[p];
    return this.marks[p].size>=({hands:2,directions:4,timing:2,sustain:1}[id]??Infinity);
  }
  ready(input){return Array.from({length:this.players},(_,p)=>this.playerReady(p,input)).every(Boolean);}
  next(input,{skip=false}={}){
    if(this.index===TUTORIAL_STEPS.length-1)return false;
    if(!skip&&!this.ready(input))return false;
    this.results[this.index]={id:this.step.id,players:Array.from({length:this.players},(_,p)=>!this.playerReady(p,input)?'skipped':['position','range'].includes(this.step.id)?input==='camera'?'camera':'test':input==='keyboard'?'test':'practiced')};
    this.index++;this.clearStep();return true;
  }
  back(){if(this.index===0)return false;this.index--;this.results.length=this.index;this.clearStep();return true;}
  retry(){this.results.length=this.index;this.clearStep();}
  report(){return this.results.map(r=>({id:r.id,players:[...r.players]}));}
}
