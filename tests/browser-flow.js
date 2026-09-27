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
  // Keep focus on the button: direction keys must still reach the game after resume.
  $('pause').focus();$('music').currentTime=60/112*8;
  document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyA',bubbles:true}));
  document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowLeft',bubbles:true}));
  await delay(120);
  check('both players independently match same beat',$('p1-points').textContent==='1'&&$('p2-points').textContent==='1');
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
