import {ROUTINE_PROFILES} from './routine-profiles.mjs';
import {makeFigurePose} from './figures.mjs';
export {ROUTINE_PROFILES};
export const SET_TRACKS=[
  {title:'Maru Flow',src:'/audio/maru-flow.ogg',bpm:112,segmentSeconds:75},
  {title:'Maru Breeze',src:'/audio/maru-breeze.ogg',bpm:112,segmentSeconds:75},
  {title:'Maru Sunset',src:'/audio/maru-sunset.ogg',bpm:112,segmentSeconds:75}
];
export const SET_DURATION=SET_TRACKS.reduce((sum,t)=>sum+t.segmentSeconds,0);
export const ROUTINE=ROUTINE_PROFILES.standing.steps;
export function routineAt(elapsed,profile='standing'){
  const steps=(ROUTINE_PROFILES[profile]||ROUTINE_PROFILES.standing).steps;
  let start=0;
  for(let index=0;index<steps.length;index++){
    const item=steps[index];
    if(elapsed<start+item.seconds){
      const local=Math.max(0,elapsed-start),side=['left','right'].includes(item.id);
      const resting=!!item.match&&local%(side?6:10)>=(side?2:5);
      return {...item,index,start,local,remaining:start+item.seconds-Math.max(0,elapsed),resting,match:resting?null:item.match??null};
    }
    start+=item.seconds;
  }
  const last=steps.at(-1);
  return {...last,index:steps.length-1,start:start-last.seconds,local:last.seconds,remaining:0,resting:true,match:null};
}
export const routinePose=(item,profile='standing')=>makeFigurePose(item,profile);
