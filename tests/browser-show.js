// Run after a real Play click in rhythm mode. Uses only this local game page.
(async()=>{
  const $=id=>document.getElementById(id),checks=[],delay=ms=>new Promise(r=>setTimeout(r,ms));
  const check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);};
  const until=async(fn)=>{const start=performance.now();while(!fn()){if(performance.now()-start>8000)throw Error('Timed out');await delay(40);}};
  await until(()=>!$('pause').disabled);
  check('trusted start entered real Fullscreen API',document.fullscreenElement===document.documentElement);
  check('all gameplay buttons and settings are left of the stage',document.querySelector('main').querySelectorAll('button,input,select').length===0&&['play','pause','stop-session','settings-open','help-open','fullscreen-toggle','camera-start'].every(id=>!!$(id).closest('.sidebar')));
  const stage=$('stage').getBoundingClientRect(),camera=$('camera-overlay').getBoundingClientRect();
  check('large stage and camera share viewport without page scrolling',stage.width>innerWidth*.70&&stage.height>innerHeight*.40&&camera.top>stage.bottom&&document.documentElement.scrollHeight<=innerHeight+1);
  await document.exitFullscreen();await until(()=>$('music').paused);
  check('fullscreen exit pauses playback',$('pause').textContent==='계속하기');
  $('stop-session').click();await delay(100);
  check('stop restores setup and exits fullscreen',!document.fullscreenElement&&!$('players').disabled&&!document.body.classList.contains('in-session'));
  // Controlled rejection ensures fullscreen failure never prevents a free local session.
  const original=document.documentElement.requestFullscreen;
  Object.defineProperty(document.documentElement,'requestFullscreen',{configurable:true,value:()=>Promise.reject(new DOMException('Test rejection','NotAllowedError'))});
  $('play').click();await until(()=>!$('pause').disabled);
  check('fullscreen denial has a truthful fallback',!document.fullscreenElement&&$('fullscreen-status').textContent.includes('허용되지'));
  check('music continues in window mode after fullscreen denial',!$('music').paused);
  $('settings-open').click();
  check('settings pause the game and open on the left',$('music').paused&&$('settings-dialog').open&&$('settings-dialog').getBoundingClientRect().left<30);
  $('settings-dialog').close();$('stop-session').click();
  Object.defineProperty(document.documentElement,'requestFullscreen',{configurable:true,value:original});
  const resources=performance.getEntriesByType('resource');
  check('all show assets are local',resources.every(r=>new URL(r.name).origin===location.origin));
  return {passed:checks.length,checks,stage:{width:stage.width,height:stage.height},camera:{width:camera.width,height:camera.height}};
})()
