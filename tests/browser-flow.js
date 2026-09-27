// Run in the local page with agent-browser eval --stdin. Does not access a real camera.
(async()=>{
  const $=id=>document.getElementById(id),checks=[];
  const delay=ms=>new Promise(r=>setTimeout(r,ms));
  const until=async(fn,timeout=8000)=>{const start=performance.now();while(!fn()){if(performance.now()-start>timeout)throw Error('Timed out');await delay(50);}};
  const check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);};
  if($('result-dialog').open)$('retry').click();
  if(!$('stop-session').disabled)$('stop-session').click();
  document.querySelector('[data-mode="rhythm"]').click();
  $('players').value='2';$('players').dispatchEvent(new Event('change'));
  $('demo').click();$('play').click();await until(()=>!$('pause').disabled);
  check('two player score panels visible',!$('p2-score').hidden);
  $('pause').click();const frozen=$('music').currentTime;await delay(300);
  check('pause freezes audio clock',Math.abs($('music').currentTime-frozen)<.02);
  $('pause').click();await until(()=>!$('music').paused&&!$('pause').disabled);
  // Continuous real pointer samples cross the same first block in each player plane.
  const {gridToStage}=await import('/src/saber-render.mjs');
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
  check('both players independently cut the same block',$('p1-points').textContent==='1'&&$('p2-points').textContent==='1');
  // A held hand does not keep cutting. Timing alone never awards a hit.
  await delay(350);check('held hands cannot repeat a cut',$('p1-points').textContent==='1'&&$('p2-points').textContent==='1');
  $('music').currentTime=149.5;await until(()=>$('result-dialog').open);
  check('rhythm completes without elimination',$('result-cards').children.length===2);
  check('result has no score or combo rewards',!$('result-cards').textContent.includes('콤보')&&!$('result-cards').textContent.includes('리듬 점수'));
  $('retry').click();await delay(150);
  check('retry clears time and score',$('music').currentTime===0&&$('p1-points').textContent==='0');
  document.querySelector('[data-mode="stretch"]').click();
  $('play').click();await until(()=>!$('pause').disabled);
  check('full body set selected',$('mode-label').textContent==='전신 스트레칭 세트');
  $('music').currentTime=51;await delay(300);
  check('keyboard stretch never invents similarity',$('p1-points').textContent==='—');
  $('music').currentTime=74.8;await until(()=>$('music').getAttribute('src').includes('breeze'));
  await until(()=>!$('pause').disabled);check('set advances once to second song',$('song-source').textContent==='2 / 3');
  $('music').currentTime=74.8;await until(()=>$('music').getAttribute('src').includes('sunset'));
  await until(()=>!$('pause').disabled);check('set advances once to third song',$('song-source').textContent==='3 / 3');
  $('music').currentTime=74.8;await until(()=>$('result-dialog').open);
  check('set ends at 225 seconds',$('session-clock').textContent.includes('03:45'));
  check('guided lower body never invents similarity',Array.from($('result-cards').querySelectorAll('strong')).every(x=>x.textContent==='—'));
  $('retry').click();
  const resources=performance.getEntriesByType('resource').map(r=>r.name);
  check('all runtime resource URLs local',resources.every(u=>new URL(u).origin===location.origin));
  check('local coach audio requested',resources.some(u=>u.includes('/audio/voice/')&&u.endsWith('.ogg')));
  return {passed:checks.length,checks,runtimeResources:resources.length,externalResources:resources.filter(u=>new URL(u).origin!==location.origin)};
})()
