// Run in an isolated local browser during a trusted Play-started 2-player Flow session.
// UI pointer cuts are real app events. Later explicit audio calls are diagnostic probes.
(async()=>{
  const $=id=>document.getElementById(id),checks=[];
  const delay=ms=>new Promise(r=>setTimeout(r,ms));
  const until=async(fn,timeout=10000)=>{const start=performance.now();while(!fn()){if(performance.now()-start>timeout)throw Error('Feedback check timeout');await delay(25);}};
  const check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);};
  const {SaberFeedback}=await import('/src/saber-feedback.mjs');
  const {SaberGame}=await import('/src/saber-game.mjs');
  const {HIT_GRADES}=await import('/src/saber-core.mjs');
  const {gridToStage}=await import('/src/saber-render.mjs');
  const originalHit=SaberFeedback.prototype.hit,originalDraw=SaberGame.prototype.draw;
  const events=[],voices=[],errors=[];let liveFeedback=null;
  const onError=e=>errors.push(String(e.message||e.reason));
  window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onError);
  SaberFeedback.prototype.hit=function(event){liveFeedback=this;events.push(structuredClone(event));return originalHit.call(this,event);};
  SaberGame.prototype.draw=function(...args){
    originalDraw.apply(this,args);
    if(!window.__feedbackShot&&this.effects.some(e=>e.kind==='hit'&&this.audio.currentTime-e.time>.1))window.__feedbackShot=$('stage').toDataURL('image/png');
  };
  try{
    $('voice-enabled').value='on';$('voice-enabled').dispatchEvent(new Event('input'));
    await until(()=>!$('pause').disabled&&!$('music').paused);
    check('trusted two-player Flow session ready',$('players').value==='2'&&$('mode-label').textContent==='손동작 리듬'&&$('song-select').value==='builtin');
    check('praise volume control is connected',$('praise-volume').value==='80');
    const raw=await fetch('/charts/maru-flow.saber.json').then(r=>r.json()),first=raw.notes[0];
    const move=(player,x,y)=>{const r=$('stage').getBoundingClientRect(),p=gridToStage(x,y,r.width,r.height,2,player);$('stage').dispatchEvent(new PointerEvent('pointermove',{clientX:r.left+p.x,clientY:r.top+p.y,bubbles:true}));};
    $('music').currentTime=first.time+raw.offsetSeconds-.23;await delay(45);
    for(const player of [0,1]){
      $('saber-player').value=String(player);$('saber-player').dispatchEvent(new Event('change'));
      $('saber-hand').value='left';$('saber-hand').dispatchEvent(new Event('change'));
      move(player,1.5,.85);await delay(32);
      for(const y of [1.02,1.20,1.39,1.58]){move(player,1.5,y);await delay(20);}
    }
    await delay(100);
    check('actual pointer cuts deliver separate player events',events.length===2&&events[0].player===0&&events[1].player===1);
    check('actual success events carry timing accuracy and grade',events.every(e=>e.kind==='hit'&&e.accuracy>=0&&e.accuracy<=100&&HIT_GRADES[e.grade.tier].key===e.grade.key&&Number.isFinite(e.timingErrorMs)));
    check('five local praise clips decoded in Web Audio',liveFeedback.buffers.size===5);
    check('actual hit scene captured',!!window.__feedbackShot);
    const ac=liveFeedback.getContext();check('audio context running',ac.state==='running');
    liveFeedback.stop();await delay(80);
    // Audition each grade through the production output path with synthetic hit data.
    for(const grade of HIT_GRADES){
      const event={id:`probe-${grade.key}`,player:0,hand:'left',kind:'hit',grade,accuracy:grade.tier*20+10};
      check(`${grade.key}: feedback accepted`,liveFeedback.hit(event));await delay(40);
      const voice=liveFeedback.activeVoice;
      check(`${grade.key}: correct local buffer starts`,voice?.source.buffer===liveFeedback.buffers.get(grade.key));
      voices.push({grade:grade.key,duration:voice.source.buffer.duration});
      check(`${grade.key}: duplicate cut rejected`,liveFeedback.hit(event)===false);
      await delay((voice.source.buffer.duration+.09)*1000);
    }
    liveFeedback.stop();
    const hit=(id,tier,player=0)=>({id,player,hand:player?'right':'left',kind:'hit',grade:HIT_GRADES[tier],accuracy:tier*20+10});
    liveFeedback.hit(hit('duo-low',0));liveFeedback.hit(hit('duo-high',4,1));await delay(35);
    check('simultaneous duo speaks the strongest grade once',liveFeedback.activeVoice?.source.buffer===liveFeedback.buffers.get('yummy'));
    const prior=liveFeedback.activeVoice;
    for(let i=0;i<20;i++)liveFeedback.hit(hit(`burst-${i}`,i%5,i%2));
    check('rapid cuts have one active voice and no voice queue',liveFeedback.activeVoice===prior&&liveFeedback.pending===null);
    check('cyber impact bursts remain bounded',liveFeedback.bursts.size<=8);
    $('pause').click();await delay(30);
    check('pause cancels nodes, voice and timer',!liveFeedback.activeVoice&&!liveFeedback.nodes.size&&!liveFeedback.bursts.size&&liveFeedback.timer===null);
    $('pause').click();await until(()=>!$('music').paused&&!$('pause').disabled);
    liveFeedback.hit(hit('seek-pending',4));$('music').currentTime=20;await delay(50);
    check('seek cancels pending praise',liveFeedback.timer===null&&liveFeedback.activeVoice===null);
    $('voice-enabled').value='off';$('voice-enabled').dispatchEvent(new Event('input'));
    liveFeedback.hit(hit('muted',4));await delay(45);
    check('voice mute blocks praise while impacts remain',!liveFeedback.activeVoice&&liveFeedback.bursts.size>0);
    $('voice-enabled').value='on';$('voice-enabled').dispatchEvent(new Event('input'));
    const before=liveFeedback.nodes.size;liveFeedback.hit({...hit('wrong',4),kind:'wrongCut'});
    check('wrong cuts cannot trigger successful feedback',liveFeedback.nodes.size===before);
    $('stop-session').click();await delay(20);
    check('stop clears all success audio',!liveFeedback.activeVoice&&!liveFeedback.nodes.size&&liveFeedback.timer===null);
    const resources=performance.getEntriesByType('resource').map(x=>x.name);
    check('all feedback resources remain local',resources.every(x=>new URL(x).origin===location.origin));
    check('no browser exception',errors.length===0);
    return {passed:checks.length,checks,actualPointerHitEvents:events.slice(0,2),diagnosticVoicePlayback:voices,errors,realCameraVerified:false,humanListeningVerified:false};
  } finally {
    SaberFeedback.prototype.hit=originalHit;SaberGame.prototype.draw=originalDraw;
    window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onError);
    if(!$('stop-session').disabled)$('stop-session').click();
    $('voice-enabled').value='on';$('voice-enabled').dispatchEvent(new Event('input'));
  }
})()
