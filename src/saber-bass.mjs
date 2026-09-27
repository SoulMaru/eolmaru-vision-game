// Three locally synthesized kick voices; grade numbering in the UI is one-based.
const VOICES=Object.freeze([
  Object.freeze({key:'soft',label:'1·2단계 · 둥',start:116,end:52,harmonic:2,body:'sine',gain:.55}),
  Object.freeze({key:'round',label:'3단계 · 쿵',start:138,end:49,harmonic:2.5,body:'sine',gain:.78}),
  Object.freeze({key:'deep',label:'4·5단계 · 쿠웅',start:158,end:46,harmonic:3,body:'sine',gain:1}),
]);
export function bassProfile(event={}) {
  const tier=event.grade?.tier;
  if(!Number.isInteger(tier)||tier<0||tier>4)return null;
  const accuracy=Number.isFinite(event.accuracy)?Math.max(0,Math.min(100,event.accuracy)):(tier+.5)*20;
  const group=tier<2?0:tier===2?1:2,voice=VOICES[group];
  return {...voice,group,accuracy,level:voice.gain*(.72+.28*accuracy/100),duration:.30};
}
