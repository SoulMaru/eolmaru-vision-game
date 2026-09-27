// Real app UI + pointer input, after a trusted tutorial practice-start click.
// Seeks shorten waiting; no physical camera, microphone or full-song claim.
(async()=>{
  const $=id=>document.getElementById(id),checks=[],errors=[],delay=ms=>new Promise(r=>setTimeout(r,ms));
  window.__tutorialChecks=checks;window.__tutorialReport=null;window.__tutorialError=null;
  const check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);};
  const until=async(fn)=>{const start=performance.now();while(!fn()){if(performance.now()-start>8000)throw Error('Tutorial browser timeout');await delay(15);}};
  const change=(id,value)=>{$(id).value=String(value);$(id).dispatchEvent(new Event('change'));};
  const {SaberGame}=await import('/src/saber-game.mjs'),{gridToStage}=await import('/src/saber-render.mjs');
  const original=SaberGame.prototype.draw;let live;
  SaberGame.prototype.draw=function(...args){if(this.audio.id==='tutorial-music')live=this;return original.apply(this,args);};
  const onError=e=>errors.push(String(e.message||e.reason));window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onError);
  const a=$('tutorial-music'),phase=()=>$('tutorial-panel').dataset.phase,step=()=>$('tutorial-panel').dataset.step;
  const move=(player,x,y)=>{const r=$('stage').getBoundingClientRect(),p=gridToStage(x,y,r.width,r.height,Number($('players').value),player);$('stage').dispatchEvent(new PointerEvent('pointermove',{clientX:r.left+p.x,clientY:r.top+p.y,bubbles:true}));};
  const run=async()=>{if(phase()!=='playing')$('tutorial-action').click();await until(()=>phase()==='playing'&&!a.paused);};
  async function cut(note,player){
    change('tutorial-player',player);change('tutorial-hand',note.hand);await run();
    a.currentTime=note.hitTime-.65;
    await delay(45);
    const x=note.lineIndex+.5,y=note.lineLayer+.5;
    const direction=note.cutDirection==='any'?'down':note.cutDirection,dx=direction==='left'?-1:direction==='right'?1:0,dy=direction==='up'?-1:direction==='down'?1:0;
    const start=performance.now();
    while(a.currentTime<note.hitTime+.21&&phase()==='playing'){
      if(performance.now()-start>4000)throw Error('Pointer cut stalled');
      // Enters the target's .36 half-size near hitTime at four cells/sec.
      const d=Math.max(-.92,Math.min(.8,4*(a.currentTime-note.hitTime)-.36));
      move(player,x+dx*d,y+dy*d);await new Promise(requestAnimationFrame);
    }
    const result=live.sessions[player].states.get(note.id);
    check(`${Number($('players').value)}P ${step()} P${player+1} ${note.id} real swept hit`,result?.kind==='hit');
    if(step()==='timing')check(`timing accuracy P${player+1} ${note.id} >=60`,result.accuracy>=60);
  }
  async function sustain(note,player){
    change('tutorial-player',player);change('tutorial-hand',note.hand);await run();a.currentTime=note.hitTime-.4;await delay(40);
    const start=performance.now();
    while(a.currentTime<note.endTime+.2&&phase()==='playing'){
      if(performance.now()-start>5000)throw Error('Sustain stalled');
      const t=a.currentTime,p=(t*2)%1,triangle=p<.5?p*4-1:3-p*4;
      move(player,note.lineIndex+.5+triangle*.38,note.lineLayer+.5);await new Promise(requestAnimationFrame);
    }
    await until(()=>live.sessions[player].states.has(note.id));
    const result=live.sessions[player].states.get(note.id);
    check(`${Number($('players').value)}P P${player+1} real continuous hold`,result.kind==='hit'&&result.sustainAccuracy>=60);
  }
  try{
    await until(()=>live);
    change('voice-enabled','off');
    for(const players of [1,2]){
      change('players',players);
      check(`${players}P separate entry requires explicit test input`,step()==='position'&&$('tutorial-progress').textContent.includes('카메라 확인 아님'));
      check(`${players}P entry freezes independent music`,a.paused&&$('music').paused);
      $('tutorial-next').click();check(`${players}P range labels skipped physical calibration`,step()==='range'&&$('tutorial-progress').textContent.includes('실제 손 범위 보정 생략'));
      $('tutorial-next').click();await until(()=>live.chart.songId==='tutorial-hands');
      for(const id of ['hands','directions','timing','sustain']){
        check(`${players}P enters ${id} with no inherited success`,step()===id&&$('tutorial-next').disabled);
        await run();const notes=live.playChart.notes.slice(0,id==='hands'||id==='timing'?2:id==='directions'?4:1);
        for(let player=0;player<players;player++){
          for(const note of notes)id==='sustain'?await sustain(note,player):await cut(note,player);
          if(players===2&&player===0)check(`${id} P1 never completes P2`,$('tutorial-next').disabled);
        }
        await until(()=>!$('tutorial-next').disabled);check(`${players}P ${id} auto-pauses when all finished`,a.paused&&phase()==='paused');
        if(id==='directions')window.__tutorialPracticeShot=$('stage').toDataURL('image/png');
        $('tutorial-next').click();await delay(30);
      }
      check(`${players}P all seven steps reached without skipping`,step()==='finish'&&$('tutorial-progress').textContent.includes('건너뜀 0단계'));
      $('tutorial-next').click();check(`${players}P finish returns to song selection`,document.querySelector('button[data-mode="rhythm"]').getAttribute('aria-pressed')==='true'&&a.paused&&!a.getAttribute('src')&&!$('song-controls').hidden);
      if(players===1){document.querySelector('[data-mode="tutorial"]').click();$('tutorial-next').click();$('tutorial-next').click();}
    }
    document.querySelector('[data-mode="stretch"]').click();check('full-body standing set remains separate 225 seconds',$('progress').max===225&&$('stretch-profile').value==='standing');
    document.querySelector('[data-mode="tutorial"]').click();
    check('no external runtime requests',performance.getEntriesByType('resource').every(r=>new URL(r.name).origin===location.origin));check('no browser exception',errors.length===0);
    return {passed:checks.length,checks,errors,cameraUsed:false,seeksUsed:true};
  }finally{SaberGame.prototype.draw=original;window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onError);}
})()
