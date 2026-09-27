import {DIRECTIONS,clamp} from './core.mjs';
export const ACTS=[
  {id:'parcel',name:'별빛 택배',tag:'STAR DELIVERY',hint:'별빛을 받아 하늘로 보내요',colors:['#bce9e5','#f8edc8','#6cbeab'],accent:'#ed9c59'},
  {id:'drum',name:'구름 북',tag:'CLOUD ORCHESTRA',hint:'구름 위에 나만의 리듬을',colors:['#bdccf0','#f7ddda','#a79ecb'],accent:'#e794b0'},
  {id:'magic',name:'정원 마법',tag:'GARDEN OF SOUND',hint:'손끝에서 꽃과 별이 피어나요',colors:['#344e83','#b48cc3','#638daa'],accent:'#edc878'}
];
const PATTERNS=[[8,12],[8,10,14],[8,12,14],[8,10,12,14],[8,14],[8,10,14]];
const SEQUENCES=[['left','up','right','down'],['up','down','up','right'],['right','left','down','up'],['left','right','up','down']];
export function generateShowChart({bpm=112,duration=150}={}){
  if(!Number.isFinite(bpm)||bpm<40||bpm>240||!Number.isFinite(duration)||duration<=0)throw Error('Invalid show parameters');
  const beat=60/bpm,notes=[];
  // Eight beats of demonstration, then eight beats of response; never faster than two beats.
  for(let phrase=0;phrase*16*beat<duration-2;phrase++){
    const pattern=PATTERNS[phrase%PATTERNS.length],sequence=SEQUENCES[phrase%SEQUENCES.length];
    pattern.forEach((offset,i)=>{const time=(phrase*16+offset)*beat;if(time<duration-2)notes.push({id:notes.length,time,lane:sequence[i],demoTime:(phrase*16+offset-8)*beat,phrase,pattern:phrase%PATTERNS.length});});
  }
  return notes;
}
export function showMoment(time,bpm=112,duration=150){
  const beat=Math.max(0,time)/(60/bpm),local=beat%16;
  return {act:Math.min(2,Math.floor(clamp(time/Math.max(duration,1))*3)),phrase:Math.floor(beat/16),demonstrating:local<8,beat:Math.floor(beat),pulse:1-beat%1,local};
}
export function makeCueEvents(notes){
  return notes.flatMap(n=>[{id:`d${n.id}`,time:n.demoTime,lane:n.lane,kind:'demo'},{id:`n${n.id}`,time:n.time,lane:n.lane,kind:'target'}]).sort((a,b)=>a.time-b.time);
}
export class CueCursor {
  constructor(){this.reset();}
  reset(){this.last=null;this.index=0;}
  take(events,time,horizon=.12){
    if(!Number.isFinite(time)||time<0)return [];
    if(this.last===null||time<this.last-.01||time-this.last>.5){this.index=events.findIndex(e=>e.time>=time-.035);if(this.index<0)this.index=events.length;}
    this.last=time;const due=[];
    while(this.index<events.length&&events[this.index].time<=time+horizon){const e=events[this.index++];if(e.time>=time-.035)due.push(e);}
    return due;
  }
}
export class RhythmAudio {
  constructor(){this.context=null;this.cursor=new CueCursor();this.voices=new Set();this.events=[];}
  unlock(){try{this.context??=new(window.AudioContext||window.webkitAudioContext)();return this.context.resume().catch(()=>{});}catch{return Promise.resolve();}}
  setChart(notes){this.stop();this.events=makeCueEvents(notes);}
  stop(){this.cursor.reset();for(const voice of this.voices){try{voice.stop();}catch{}}this.voices.clear();}
  tone(lane,kind,delay=0,volume=.65){
    const ac=this.context;if(!ac||ac.state!=='running'||volume<=0)return;
    const oscillator=ac.createOscillator(),gain=ac.createGain(),at=ac.currentTime+Math.max(0,delay),duration=kind==='hit'?.23:kind==='demo'?.13:.055;
    const frequency=({left:392,up:523.25,down:329.63,right:440})[lane]||440;
    oscillator.type=kind==='target'?'sine':'triangle';oscillator.frequency.setValueAtTime(kind==='target'?110:kind==='hit'?frequency*2:frequency,at);
    if(kind==='hit')oscillator.frequency.exponentialRampToValueAtTime(frequency*3,at+.14);
    gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume*(kind==='target'?.09:kind==='hit'?.16:.23),at+.006);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    oscillator.connect(gain);gain.connect(ac.destination);this.voices.add(oscillator);oscillator.onended=()=>{this.voices.delete(oscillator);oscillator.disconnect();gain.disconnect();};oscillator.start(at);oscillator.stop(at+duration+.02);
  }
  tick(time,volume){if(this.cursor.last!==null&&(time<this.cursor.last-.01||time-this.cursor.last>.5))this.stop();for(const event of this.cursor.take(this.events,time))this.tone(event.lane,event.kind,event.time-time,volume);}
}
