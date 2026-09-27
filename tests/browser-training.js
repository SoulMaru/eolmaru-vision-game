// Run after a trusted Play click in an isolated local browser. No camera is opened.
// End-of-song probes seek near the end; this is not a human full-length play test.
(async()=>{
  const $=id=>document.getElementById(id),checks=[],delay=ms=>new Promise(r=>setTimeout(r,ms));
  window.__trainingChecks=checks;window.__trainingError=null;window.__trainingReport=null;
  const until=async(fn,timeout=9000)=>{const start=performance.now();while(!fn()){if(performance.now()-start>timeout)throw Error('Training browser timeout');await delay(20);}};
  const check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);};
  const {SaberGame}=await import('/src/saber-game.mjs');
  const {BUILTIN_SONGS}=await import('/src/songs.mjs');
  const {gridToStage,drawSaber}=await import('/src/saber-render.mjs');
  const original=SaberGame.prototype.draw;let live=null;
  SaberGame.prototype.draw=function(...args){live=this;return original.apply(this,args);};
  const errors=[],onError=e=>errors.push(String(e.message||e.reason));
  window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onError);
  const change=(id,value)=>{$(id).value=String(value);$(id).dispatchEvent(new Event('input'));$(id).dispatchEvent(new Event('change'));};
  const button=text=>[...$('saber-editor').querySelectorAll('button')].find(b=>b.textContent===text);
  const draft=()=>{button('현재 JSON 보기').click();return JSON.parse($('saber-editor').querySelector('textarea').value);};
  const move=(x,y)=>{const r=$('stage').getBoundingClientRect(),p=gridToStage(x,y,r.width,r.height,1,0);$('stage').dispatchEvent(new PointerEvent('pointermove',{clientX:r.left+p.x,clientY:r.top+p.y,bubbles:true}));};
  try{
    await until(()=>live);if(!$('stop-session').disabled)$('stop-session').click();
    document.querySelector('[data-mode="rhythm"]').click();$('demo').click();
    change('voice-enabled','off');change('players',1);change('target-speed',.6);change('target-spacing',4);
    const songs=BUILTIN_SONGS.filter(s=>s.training);
    check('exact seven ordered training choices',JSON.stringify([...$('song-select').querySelectorAll('optgroup option')].map(o=>Number(o.textContent.split(' ')[0])))===JSON.stringify([80,90,100,110,120,130,140]));
    const durations=[];
    for(const song of songs){
      change('song-select',song.value);await until(()=>$('music').readyState>=1&&$('music').currentSrc.endsWith(song.src));
      durations.push({bpm:song.bpm,seconds:$('music').duration});
      // Chromium includes a small Vorbis padding allowance; container/sample lengths are tested separately.
      check(`${song.bpm}: actual Ogg duration and tempo UI`,Math.abs($('music').duration-song.duration)<.02&&$('song-description').textContent.includes(`${song.bpm} BPM`));
      check(`${song.bpm}: settings survive song changes`,live.playChart.leadSeconds===3&&live.playChart.spacingBeats===4&&$('music').playbackRate===1);
      check(`${song.bpm}: practice filtering preserves original chart`,live.playChart.notes.length<live.chart.notes.length&&live.playChart.notes.every(n=>n.hitTime===live.chart.notes.find(x=>x.id===n.id).hitTime));
      $('editor-open').click();const json=draft(),hold=json.notes.find(n=>n.kind==='sustain');
      check(`${song.bpm}: editor exports full source and sustained data`,json.notes.length===live.chart.notes.length&&hold.durationSeconds>0&&json.songId===song.songId);
      const noteList=$('saber-editor').querySelector('select[aria-label="기록한 노트 선택"]');noteList.value=hold.id;noteList.dispatchEvent(new Event('change'));
      const fields=[...$('saber-editor').querySelectorAll('label')];
      const kind=fields.find(l=>l.querySelector('span')?.textContent==='타겟 종류').querySelector('select');
      const durationField=fields.find(l=>l.querySelector('span')?.textContent==='계속 베기 초 · 0.5~6').querySelector('input');
      check(`${song.bpm}: editor selects sustained type and duration`,kind.value==='sustain'&&Math.abs(Number(durationField.value)-hold.durationSeconds)<1e-8);
      button('선택 수정').click();check(`${song.bpm}: edit round-trip keeps sustained note`,draft().notes.find(n=>n.id===hold.id).kind==='sustain');button('닫기').click();
      $('play').click();await until(()=>!$('music').paused&&!$('pause').disabled);
      const start=$('music').currentTime;await delay(120);
      check(`${song.bpm}: music runs at its own tempo and controls lock`,$('music').currentTime>start+.04&&$('music').playbackRate===1&&$('target-speed').disabled&&$('target-spacing').disabled);
      $('music').currentTime=song.duration-.12;await until(()=>$('result-dialog').open);
      check(`${song.bpm}: one-song end resolves normally`,$('result-subtitle').textContent.includes(song.title));$('retry').click();
    }
    // One actual pointer-driven sustained target, including a pause in its middle.
    change('target-speed',1.6);change('target-spacing',2);change('song-select','maru-step-80');
    $('play').click();await until(()=>!$('music').paused&&!$('pause').disabled);
    check('fast approach uses 1.125 seconds without music pitch change',live.playChart.leadSeconds===1.125&&$('music').playbackRate===1);
    const hold=live.playChart.notes.find(n=>n.kind==='sustain');change('saber-hand',hold.hand);
    $('music').currentTime=hold.hitTime-.2;await delay(40);
    let paused=false,shot=false,iterations=0;const startWall=performance.now();
    while($('music').currentTime<hold.endTime+.1){
      if(performance.now()-startWall>8000)throw Error('Sustained pointer loop stalled');
      const t=$('music').currentTime,phase=(t*2)%1,triangle=phase<.5?phase*4-1:3-phase*4;
      move(hold.lineIndex+.5+triangle*.38,hold.lineLayer+.5);iterations++;
      if(!paused&&t>hold.hitTime+hold.durationSeconds*.40){
        const before=live.sessions[0].sustainProgress(hold).coverage;$('pause').click();const frozen=$('music').currentTime;await delay(130);
        check('pause freezes music and never adds hold progress',Math.abs($('music').currentTime-frozen)<.01&&live.sessions[0].sustainProgress(hold).coverage===before);
        $('pause').click();await until(()=>!$('music').paused&&!$('pause').disabled);paused=true;
      }
      if(!shot&&t>hold.hitTime+hold.durationSeconds*.7){window.__trainingShot=$('stage').toDataURL('image/png');shot=true;}
      // Deliver a fresh pointer position each render, like a continuous hardware mouse stream.
      // A slower 25ms synthetic stream inserts artificial stationary frames at high render rates.
      await new Promise(requestAnimationFrame);
    }
    await until(()=>live.sessions[0].states.has(hold.id));const result=live.sessions[0].states.get(hold.id);window.__trainingHoldResult=structuredClone(result);
    check('actual pointer must keep moving and earns one completed hold',result.kind==='hit'&&result.targetKind==='sustain'&&result.sustainAccuracy>=60&&iterations>20);
    check('completed hold keeps onset accuracy and one terminal count',Number.isFinite(result.accuracy)&&live.sessions[0].counts.hit===1);
    check('sustained target rendered in the actual game canvas',!!window.__trainingShot);
    $('stop-session').click();
    $('editor-open').click();const originalJSON=draft();button('닫기').click();
    change('target-spacing',4);$('editor-open').click();check('settings do not rewrite editable chart',JSON.stringify(draft())===JSON.stringify(originalJSON));button('닫기').click();
    const settings=JSON.parse(localStorage.getItem('eolmaru.settings'));check('tempo practice settings persist',settings['target-speed']==='1.6'&&settings['target-spacing']==='4');
    // Exercise the renderer with a sustained target under low/reduced and two-player layouts.
    const canvas=document.createElement('canvas');canvas.width=700;canvas.height=360;const c=canvas.getContext('2d');
    for(const quality of ['high','low'])for(const reduced of [false,true])drawSaber(c,700,360,{time:hold.hitTime+.6,bpm:80,leadSeconds:3,quality,reduced,phase:'playing',slots:[{notes:[{...hold,sustainProgress:.3}]},{notes:[{...hold,sustainProgress:.1}]}]});
    check('sustained graphics render with low/reduced and two players',canvas.toDataURL().length>1000);
    document.querySelector('[data-mode="stretch"]').click();check('standing full-body mode keeps its original three-part set',$('stretch-profile').value==='standing'&&$('progress').max===225&&$('music').getAttribute('src')==='/audio/maru-flow.ogg');
    document.querySelector('[data-mode="rhythm"]').click();
    check('runtime makes no external media requests',performance.getEntriesByType('resource').every(r=>new URL(r.name).origin===location.origin));
    check('no browser exception during training flow',errors.length===0);
    return {passed:checks.length,checks,durations,cameraUsed:false,fullLengthHumanPlayback:false};
  }finally{SaberGame.prototype.draw=original;window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onError);}
})()
