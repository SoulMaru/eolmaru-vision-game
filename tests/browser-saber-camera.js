// Independent synthetic camera check. Never use this on a real-camera browser session.
// Start a NEW agent-browser session with both fake-device/fake-ui media flags;
// open about:blank, route https://** --abort, then open http://127.0.0.1:8765/.
// Choose hand rhythm + 2 players, enable camera, and click Play with agent-browser.
// Run this file with eval --stdin. The HTTPS route and CLI errors/console are checked separately.
(async()=>{
  const $=id=>document.getElementById(id),checks=[],metrics=[],stage=$('stage'),audio=$('music'),camera=$('camera');
  const delay=ms=>new Promise(r=>setTimeout(r,ms));
  const until=async(fn,timeout=10000)=>{const start=performance.now();while(!fn()){if(performance.now()-start>timeout)throw Error('Timed out waiting for synthetic camera session');await delay(50);}};
  const check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);};
  const videoTracks=camera.srcObject?.getVideoTracks()||[];
  check('only the synthetic camera is active',videoTracks.length===1&&videoTracks[0].label==='fake_device_0');
  check('no microphone track requested',camera.srcObject.getAudioTracks().length===0);
  check('hand rhythm uses two player panels',$('mode-label').textContent==='손동작 리듬'&&$('players').value==='2'&&!$('p2-score').hidden);
  const streamSettings=videoTracks[0].getSettings();
  check('synthetic camera frames have loaded',camera.readyState>=2&&camera.videoWidth>0&&camera.videoHeight>0);
  check('model reports the GPU delegate',$('performance').textContent.includes('GPU'));
  const proto=CanvasRenderingContext2D.prototype,originalText=proto.fillText,footers=new Map(),pageErrors=[];
  const onError=event=>pageErrors.push(String(event.message||event.reason));
  window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onError);
  // Observe already-rendered status text only; inference, timestamps and decisions are untouched.
  proto.fillText=function(value,x,y,...rest){
    if(this.canvas===stage&&String(value).startsWith('베기 '))footers.set(Math.round(x),String(value));
    return originalText.call(this,value,x,y,...rest);
  };
  try{
    await until(()=>!audio.paused&&!$('pause').disabled);
    const initialTime=audio.currentTime;
    for(let i=0;i<12;i++){await delay(250);metrics.push($('performance').textContent);}
    check('music clock advances during camera play',audio.currentTime>initialTime+1);
    const raw=await fetch('/charts/maru-flow.saber.json').then(r=>r.json());
    await until(()=>audio.currentTime>raw.notes[0].time+raw.offsetSeconds+.85);
    await delay(250);
    check('synthetic image has no accepted human poses',$('p1-status').textContent.includes('인식 대기')&&$('p2-status').textContent.includes('인식 대기'));
    check('no invisible hand earns a hit',$('p1-points').textContent==='0'&&$('p2-points').textContent==='0');
    const status=[...footers.values()];
    check('both players classify unseen notes as untracked',status.length===2&&status.every(s=>/인식 안 됨 [1-9]\d*/.test(s)&&/놓침 0/.test(s)&&/방향\/손 0/.test(s)));
    const resources=performance.getEntriesByType('resource').map(r=>r.name);
    check('local model and WASM were fetched',resources.some(u=>u.endsWith('/models/pose_landmarker_lite.task'))&&resources.some(u=>u.endsWith('/vendor/vision/wasm/vision_wasm_internal.wasm')));
    const external=resources.filter(u=>new URL(u).origin!==location.origin);
    check('runtime resource origins remain local',external.length===0);
    check('no page error during observation',pageErrors.length===0);
    $('stop-session').click();$('camera-stop').click();await delay(120);
    check('camera and music release on stop',camera.srcObject===null&&audio.paused&&videoTracks[0].readyState==='ended');
    return {passed:checks.length,checks,synthetic:true,realPersonVerified:false,
      stream:{label:'fake_device_0',width:streamSettings.width,height:streamSettings.height,frameRate:streamSettings.frameRate},
      inferenceReadouts:metrics,untrackedStatus:status,runtimeResources:resources.length,externalResources:external,pageErrors};
  } finally {
    proto.fillText=originalText;window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onError);
    if(!$('stop-session').disabled)$('stop-session').click();
    if(camera.srcObject)$('camera-stop').click();
  }
})()
