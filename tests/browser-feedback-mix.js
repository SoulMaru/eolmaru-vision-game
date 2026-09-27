// Offline Web Audio rendering measures the exact production cyber synthesis.
(async()=>{
  const {SaberFeedback}=await import('/src/saber-feedback.mjs');
  const {HIT_GRADES}=await import('/src/saber-core.mjs');
  const results=[];
  for(const count of [1,8])for(const grade of HIT_GRADES){
    const ac=new OfflineAudioContext(2,48000,48000);
    // Offline contexts expose 'suspended' until rendering; synthesis only schedules nodes.
    Object.defineProperty(ac,'state',{get:()=> 'running'});
    const feedback=new SaberFeedback({getContext:()=>ac,effectVolume:()=>1,voiceEnabled:()=>false});
    for(let i=0;i<count;i++)feedback.hit({id:i,kind:'hit',player:0,hand:'left',grade,accuracy:grade.tier*20+10});
    const buffer=await ac.startRendering();let peak=0,energy=0;
    for(let c=0;c<2;c++)for(const value of buffer.getChannelData(c)){peak=Math.max(peak,Math.abs(value));energy+=value*value;}
    results.push({count,grade:grade.key,peak,rms:Math.sqrt(energy/(buffer.length*2)),clipped:peak>=1});
  }
  return {passed:results.every(r=>r.peak>0&&r.peak<1),sampleRate:48000,seconds:1,results};
})()
