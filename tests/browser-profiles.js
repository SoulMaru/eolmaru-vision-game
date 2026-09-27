// Run after browser-flow.js (idle stretch), or unlock audio with a real Play click first.
(async()=>{
  const $=id=>document.getElementById(id),checks=[],delay=ms=>new Promise(r=>setTimeout(r,ms));
  const until=async(fn)=>{const start=performance.now();while(!fn()){if(performance.now()-start>8000)throw Error('Timed out');await delay(50);}};
  const check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);};
  const choose=value=>{$('stretch-profile').value=value;$('stretch-profile').dispatchEvent(new Event('change'));};
  choose('standing');
  check('standing selection is full-body, not seated',$('intro').textContent.includes('서서 전신')&&!$('intro').textContent.includes('앉아'));
  document.querySelector('[data-mode="rhythm"]').click();
  check('rhythm explicitly uses seated hands only',$('intro').textContent.includes('의자에 앉아 손만')&&$('stretch-options').hidden);
  document.querySelector('[data-mode="stretch"]').click();choose('couple');
  check('couple forces two players and locks count',$('players').value==='2'&&$('players').disabled&&!$('p2-score').hidden);
  $('demo').click();$('play').click();await until(()=>!$('pause').disabled);
  check('routine choice locks during play',$('stretch-profile').disabled);
  $('stop-session').click();await delay(120);
  check('stop resets the full set',$('session-clock').textContent.includes('00:00')&&!$('stretch-profile').disabled);
  choose('floor');
  check('floor frees player count and explains no pose score',!$('players').disabled&&$('guide-description').textContent.includes('일치율을 매기지'));
  $('play').click();await until(()=>!$('pause').disabled);
  $('music').currentTime=74.8;await until(()=>$('music').getAttribute('src').includes('breeze'));await until(()=>!$('pause').disabled);
  $('music').currentTime=74.8;await until(()=>$('music').getAttribute('src').includes('sunset'));await until(()=>!$('pause').disabled);
  $('music').currentTime=74.8;await until(()=>$('result-dialog').open);
  check('floor completes its own 225-second set',$('result-subtitle').textContent.includes('누워서 전신')&&$('session-clock').textContent.includes('03:45'));
  check('floor result is guidance only',Array.from($('result-cards').querySelectorAll('strong')).every(x=>x.textContent==='—')&&$('result-cards').textContent.includes('시간·음성 안내'));
  $('retry').click();choose('standing');
  return {passed:checks.length,checks};
})()
