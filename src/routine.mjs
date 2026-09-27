import {targetPose} from './core.mjs';
export const SET_TRACKS=[
  {title:'Maru Flow',src:'/audio/maru-flow.ogg',bpm:112,segmentSeconds:75},
  {title:'Maru Breeze',src:'/audio/maru-breeze.ogg',bpm:112,segmentSeconds:75},
  {title:'Maru Sunset',src:'/audio/maru-sunset.ogg',bpm:112,segmentSeconds:75}
];
// Original game guidance, informed by cited public exercise guidance (docs/RESEARCH.md).
// Camera feedback is restricted to frontal upper-body shapes, never a health assessment.
export const ROUTINE=[
  {id:'prepare',seconds:10,title:'의자에 앉아 준비하기',cue:'안정된 의자 · 두 발은 바닥에 · 편안하게 호흡',region:'준비',voice:'prepare-body'},
  {id:'neck-left',seconds:10,title:'목을 화면 왼쪽으로 살짝',cue:'어깨는 그대로, 고개만 아주 조금. 불편하면 쉬어요.',region:'목',voice:'neck-left'},
  {id:'neck-right',seconds:10,title:'목을 화면 오른쪽으로 살짝',cue:'반동 없이 천천히 기울이고 돌아와요.',region:'목',voice:'neck-right'},
  {id:'shoulder-roll',seconds:20,title:'어깨를 천천히 돌리기',cue:'작은 원을 그리며 어깨의 힘을 풀어요.',region:'어깨',voice:'shoulder-roll'},
  {id:'open',seconds:25,title:'편안하게 가슴 열기',cue:'어깨가 편한 높이로 팔을 벌리고, 5초마다 쉬어요.',region:'가슴 · 어깨',voice:'open',match:'open'},
  {id:'left',seconds:15,title:'화면 왼쪽 옆구리 늘리기',cue:'엉덩이는 의자에 두고, 몸을 조금만 기울여요.',region:'몸통',voice:'left',match:'left'},
  {id:'right',seconds:15,title:'화면 오른쪽 옆구리 늘리기',cue:'숨을 참지 말고 짧게 늘린 뒤 돌아와요.',region:'몸통',voice:'right',match:'right'},
  {id:'march',seconds:15,title:'무릎을 번갈아 조금 들기',cue:'의자를 잡고, 발을 낮게 들었다 내려요.',region:'골반 · 다리',voice:'march'},
  {id:'hamstring-left',seconds:15,title:'화면 왼쪽 다리 뒤쪽 늘리기',cue:'뒤꿈치는 바닥에. 다리를 펴고 몸을 조금만 앞으로.',region:'허벅지 뒤',voice:'hamstring-left'},
  {id:'hamstring-right',seconds:15,title:'화면 오른쪽 다리 뒤쪽 늘리기',cue:'등을 길게 유지하고 편안한 당김까지만 움직여요.',region:'허벅지 뒤',voice:'hamstring-right'},
  {id:'calf-left',seconds:15,title:'화면 왼쪽 종아리와 발목',cue:'의자에서 다리를 편하게 펴고 발끝을 몸 쪽으로.',region:'종아리 · 발목',voice:'calf-left'},
  {id:'calf-right',seconds:15,title:'화면 오른쪽 종아리와 발목',cue:'발끝을 천천히 당기고 풀어요. 무리하지 않아요.',region:'종아리 · 발목',voice:'calf-right'},
  {id:'ankle',seconds:25,title:'발목을 천천히 펴고 당기기',cue:'양발을 번갈아 부드럽게 움직여요.',region:'발목',voice:'ankle'},
  {id:'rest',seconds:20,title:'호흡하며 마무리하기',cue:'두 발은 바닥에, 어깨는 편안하게. 한 세트가 끝나요.',region:'마무리',voice:'rest'}
];
export const SET_DURATION=SET_TRACKS.reduce((sum,t)=>sum+t.segmentSeconds,0);
export function routineAt(elapsed){
  let start=0;
  for(let index=0;index<ROUTINE.length;index++){
    const item=ROUTINE[index];
    if(elapsed<start+item.seconds){
      const local=Math.max(0,elapsed-start),side=['left','right'].includes(item.id);
      const resting=!!item.match&&local%(side?6:10)>=(side?2:5);
      return {...item,index,start,local,remaining:start+item.seconds-elapsed,resting,match:resting?null:item.match??null};
    }
    start+=item.seconds;
  }
  return {...ROUTINE.at(-1),index:ROUTINE.length-1,start:205,local:20,remaining:0,resting:true,match:null};
}
export function routinePose(item){
  const id=item.resting?'rest':item.id,p=targetPose(['open','left','right'].includes(id)?id:'rest');
  const set=(i,x,y)=>p[i]={x,y,visibility:1};
  set(25,.38,.75);set(26,.62,.75);set(27,.38,.96);set(28,.62,.96);
  const wave=Math.sin(item.local*Math.PI*.6);
  if(id==='neck-left')p[0].x-=.04*(.5+.5*wave);
  if(id==='neck-right')p[0].x+=.04*(.5+.5*wave);
  if(id==='shoulder-roll')for(const n of [11,12,13,14])p[n].y+=wave*.025;
  if(id==='march'){const lift=Math.sin(item.local*Math.PI);p[25].y-=Math.max(0,lift)*.09;p[27].y-=Math.max(0,lift)*.09;p[26].y-=Math.max(0,-lift)*.09;p[28].y-=Math.max(0,-lift)*.09;}
  if(id.includes('hamstring')||id.includes('calf')){
    const left=id.endsWith('left'),knee=left?25:26,ankle=left?27:28;
    set(knee,left?.32:.68,.77);set(ankle,left?.20:.80,.94);
    if(id.includes('hamstring'))for(const n of [0,11,12,13,14,15,16])p[n].y+=.04;
    if(id.includes('calf'))p[ankle].y+=wave*.02;
  }
  if(id==='ankle'){p[27].y+=wave*.018;p[28].y-=wave*.018;}
  return p;
}
