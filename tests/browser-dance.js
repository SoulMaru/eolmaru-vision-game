// Actual SaberGame renderer instrumentation in an isolated tab after a trusted Play click.
// Leaves dance-motion off so the caller can reload and verify persistence, then restore on.
(async()=>{
  const $=id=>document.getElementById(id),checks=[],delay=ms=>new Promise(r=>setTimeout(r,ms));
  const check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);};
  const until=async(fn)=>{const t=performance.now();while(!fn()){if(performance.now()-t>6500)throw Error('Dance wait timed out');await delay(25);}};
  const native=CanvasRenderingContext2D.prototype.drawImage;let lastPose=null,draws=0;
  CanvasRenderingContext2D.prototype.drawImage=function(image,...args){if(this.canvas.id==='stage'&&image?.src?.includes('/assets/dance-')){lastPose=image.src.endsWith('dance-b.png')?'b':'a';draws++;}return native.call(this,image,...args);};
  const motion=value=>{$('dance-motion').value=value;$('dance-motion').dispatchEvent(new Event('input'));};
  try{
    if($('result-dialog').open)$('retry').click();if(!$('stop-session').disabled)$('stop-session').click();
    document.querySelector('[data-mode="rhythm"]').click();$('demo').click();motion('on');$('play').click();await until(()=>!$('music').paused&&!$('pause').disabled);
    check('real game renders both cached characters',draws>=2);
    $('music').currentTime=1.2;await until(()=>lastPose==='b');
    check('real game uses music-clock pose B',true);
    $('pause').click();const frozen=$('music').currentTime;await delay(150);
    check('pause preserves B without moving the audio clock',lastPose==='b'&&Math.abs($('music').currentTime-frozen)<.01);
    $('settings-open').click();motion('off');await until(()=>lastPose==='a');
    check('dance-off redraws fixed pose A in the actual game',true);
    check('dance preference is saved in this browser',JSON.parse(localStorage.getItem('eolmaru.settings'))['dance-motion']==='off');
    motion('on');await until(()=>lastPose==='b');check('enabling dance restores the frozen musical pose',true);
    motion('off');$('settings-dialog').close();$('stop-session').click();await delay(80);
    check('idle keeps fixed pose A after stopping',lastPose==='a');
    check('background controls never enable the camera',$('camera-stop').hidden);
    return {passed:checks.length,checks,reloadExpected:'off',cameraUsed:false};
  }finally{CanvasRenderingContext2D.prototype.drawImage=native;}
})()
