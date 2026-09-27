// Dedicated local browser tab after one trusted Play click. Native browser audio, no camera.
// Source fixtures are generated WAV Files held in memory; no user music is uploaded anywhere.
(async()=>{
  const $=id=>document.getElementById(id),checks=[],delay=ms=>new Promise(r=>setTimeout(r,ms));
  const until=async(fn)=>{const start=performance.now();while(!fn()){if(performance.now()-start>7000)throw Error('Arcade state timeout');await delay(25);}};
  const check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);};
  const change=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new Event('change'));};
  const choose=file=>{const d=new DataTransfer();d.items.add(file);$('song-file').files=d.files;$('song-file').dispatchEvent(new Event('change'));};
  const wav=seconds=>{
    const rate=8000,n=Math.round(rate*seconds),bytes=new ArrayBuffer(44+n*2),v=new DataView(bytes);
    const str=(at,s)=>[...s].forEach((c,i)=>v.setUint8(at+i,c.charCodeAt(0)));
    str(0,'RIFF');v.setUint32(4,36+n*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,n*2,true);
    for(let i=0;i<n;i++)v.setInt16(44+i*2,Math.round(90*Math.sin(i*2*Math.PI*220/rate)),true);
    return new File([bytes],`test-${seconds}.wav`,{type:'audio/wav'});
  };
  const nativeClick=HTMLInputElement.prototype.click,NativeAudio=window.Audio,created=[];
  const dialog=$('saber-editor'),button=text=>[...dialog.querySelectorAll('button')].find(b=>b.textContent===text);
  const field=text=>[...dialog.querySelectorAll('label')].find(l=>l.querySelector('span')?.textContent===text)?.querySelector('input,select,textarea');
  const draft=()=>{button('현재 JSON 보기').click();return JSON.parse(field('JSON 텍스트').value);};
  try{
    if($('result-dialog').open)$('retry').click();if(!$('stop-session').disabled)$('stop-session').click();
    document.querySelector('[data-mode="stretch"]').click();
    let picked=0;HTMLInputElement.prototype.click=function(){if(this===$('song-file')){picked++;return;}return nativeClick.call(this);};
    $('local-song-open').click();
    check('visible local music button enters rhythm and opens exactly one picker',document.body.dataset.mode==='rhythm'&&picked===1);
    HTMLInputElement.prototype.click=nativeClick;
    const before=$('music').getAttribute('src');$('song-file').dispatchEvent(new Event('cancel'));
    check('picker cancellation preserves the selected rhythm song',$('music').getAttribute('src')===before);
    $('demo').click();
    const dance=await import('/src/saber-dance.mjs');const art=await dance.loadDanceImages();
    check('both original dance images decode in the actual app',art.ready&&art.images.every(i=>i.naturalWidth===1536&&i.naturalHeight===1024));
    check('each dance asset is requested only once',dance.DANCE_URLS.every(url=>performance.getEntriesByType('resource').filter(r=>new URL(r.name).pathname===url).length===1));
    $('settings-open').click();check('blaster volume and preview are accessible',$('hit-preview').offsetWidth>0&&$('hit-volume').value==='75');
    $('hit-preview').click();await delay(300);$('settings-dialog').close();
    check('preview does not play the song or change hit totals',$('music').paused&&$('p1-points').textContent==='0');
    const long=wav(241);choose(long);await until(()=>!$('song-select').disabled&&$('song-select').value==='local');
    await until(()=>$('music').readyState>=1);
    const localUrl=$('music').src;
    check('long local source metadata stays intact',Math.abs($('music').duration-241)<.001&&long.size===44+241*8000*2);
    check('long local game plays only a 150-second prefix',$('progress').max===150&&$('song-description').textContent.includes('원곡 04:01')&&$('notice').textContent.includes('앞 2분 30초'));
    change('song-bpm','140');window.Audio=function(...args){const a=new NativeAudio(...args);created.push(a);return a;};window.Audio.prototype=NativeAudio.prototype;
    $('editor-open').click();const chart=draft(),preview=created.at(-1);await until(()=>preview.readyState>=1);
    check('local chart uses the selected tempo and playable bounds',chart.songId==='local'&&chart.bpm===140&&chart.notes.every(n=>n.time+(n.durationSeconds||0)<150));
    preview.currentTime=149.9;button('재생').click();await until(()=>preview.paused&&preview.currentTime>=149.99);
    check('editor native playback stops at 150 seconds of the 241-second source',preview.currentTime<=150.001&&$('music').paused);
    field('시작 초').value=148.5;field('끝 초').value=150;field('구간 반복').checked=true;preview.currentTime=149.94;button('재생').click();await until(()=>preview.currentTime>=148.5&&preview.currentTime<149.9);
    check('editor loop takes priority over prefix completion',!preview.paused);
    button('닫기').click();check('closing editor releases the long-source preview',preview.paused&&!preview.hasAttribute('src'));
    window.Audio=NativeAudio;
    choose(wav(119));await until(()=>!$('song-select').disabled);
    check('short file failure preserves prior blob, BPM, title and prefix',$('music').src===localUrl&&$('song-bpm').value==='140'&&$('song-title').textContent==='test-241'&&$('progress').max===150);
    choose(new File(['not audio'],'bad.mp3',{type:'audio/mpeg'}));await until(()=>!$('song-select').disabled);
    check('unsupported file failure preserves the prior playable song',$('music').src===localUrl&&$('song-select').value==='local');
    $('play').click();await until(()=>!$('music').paused&&!$('pause').disabled);
    check('local file selection is locked while playing',$('local-song-open').disabled);
    const t=$('music').currentTime;await delay(140);check('native local audio actually advances',$('music').currentTime>t+.05);
    $('music').currentTime=149.92;await until(()=>$('result-dialog').open);
    check('long local song finishes once at the prefix boundary',$('music').paused&&$('result-subtitle').textContent.includes('test-241')&&$('progress').max===150);
    $('retry').click();check('retry keeps local song and resets time',$('music').src===localUrl&&$('music').currentTime===0);
    document.querySelector('[data-mode="stretch"]').click();check('stretch keeps its original 225-second set',$('progress').max===225&&$('music').getAttribute('src')==='/audio/maru-flow.ogg');
    document.querySelector('[data-mode="rhythm"]').click();check('returning restores local source and 150-second prefix',$('music').src===localUrl&&$('progress').max===150);
    change('song-select','builtin');check('built-in music still restores after local use',$('music').getAttribute('src')==='/audio/maru-flow.ogg'&&$('custom-tempo').hidden);
    const external=performance.getEntriesByType('resource').filter(r=>!['blob:','data:'].includes(new URL(r.name).protocol)&&new URL(r.name).origin!==location.origin);
    check('arcade runtime has no external resource requests',external.length===0);
    return {passed:checks.length,checks,sourceSeconds:241,playableSeconds:150,cameraUsed:false,externalRequests:external.length};
  }finally{HTMLInputElement.prototype.click=nativeClick;window.Audio=NativeAudio;if(dialog.open)button('닫기').click();}
})()
