// Run on the real local app in an isolated tab after one trusted #play click.
// No physical camera is opened. Song-end checks deliberately seek near the end.
(async()=>{
  const $=id=>document.getElementById(id),checks=[],delay=ms=>new Promise(r=>setTimeout(r,ms));
  const until=async(fn)=>{const t=performance.now();while(!fn()){if(performance.now()-t>8000)throw Error('Timed out waiting for music state');await delay(40);}};
  const check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);};
  const choose=value=>{$('song-select').value=value;$('song-select').dispatchEvent(new Event('change'));};
  const editorButton=text=>[...$('saber-editor').querySelectorAll('button')].find(b=>b.textContent===text);
  const draft=()=>{editorButton('현재 JSON 보기').click();return JSON.parse($('saber-editor').querySelector('textarea').value);};
  if($('result-dialog').open)$('retry').click();if(!$('stop-session').disabled)$('stop-session').click();
  document.querySelector('[data-mode="rhythm"]').click();$('demo').click();
  const {BUILTIN_SONGS}=await import('/src/songs.mjs');
  const {gridToStage}=await import('/src/saber-render.mjs');
  $('players').value='2';$('players').dispatchEvent(new Event('change'));
  check('three rhythm originals plus a local-file option',BUILTIN_SONGS.every(s=>$('song-select').querySelector(`option[value="${s.value}"]`))&&!!$('song-select').querySelector('option[value="local"]'));
  for(const song of BUILTIN_SONGS.filter(s=>!s.training).slice(1)){
    choose(song.value);await until(()=>$('music').readyState>=1&&$('music').currentSrc.endsWith(song.src));
    check(`${song.songId}: metadata duration matches actual Ogg`,Math.abs($('music').duration-song.duration)<.02);
    check(`${song.songId}: genre, BPM, title and clock update`,$('song-title').textContent===song.title&&$('song-description').textContent.includes(String(song.bpm))&&$('song-description').textContent.includes(song.genre)&&Math.abs($('progress').max-song.duration)<.001);
    $('song-file').dispatchEvent(new Event('cancel'));
    check(`${song.songId}: local picker cancel preserves selection`,$('song-select').value===song.value);
    $('editor-open').click();const chart=draft();
    check(`${song.songId}: editor receives correct chart ownership and tempo`,chart.songId===song.songId&&chart.bpm===song.bpm&&chart.notes.length>150);editorButton('닫기').click();
    $('play').click();await until(()=>!$('music').paused&&!$('pause').disabled);const start=$('music').currentTime;await delay(220);
    check(`${song.songId}: selected music really advances`,$('music').currentTime>start+.05&&$('music').currentSrc.endsWith(song.src));
    check(`${song.songId}: song selection locks during play`,$('song-select').disabled);
    $('music').currentTime=chart.notes[0].time-.23;await delay(45);
    const move=(player,y)=>{const r=$('stage').getBoundingClientRect(),p=gridToStage(1.5,y,r.width,r.height,2,player);$('stage').dispatchEvent(new PointerEvent('pointermove',{clientX:r.left+p.x,clientY:r.top+p.y,bubbles:true}));};
    for(const player of [0,1]){
      $('saber-player').value=String(player);$('saber-player').dispatchEvent(new Event('change'));
      $('saber-hand').value='left';$('saber-hand').dispatchEvent(new Event('change'));
      move(player,.85);await delay(32);for(const y of [1.02,1.20,1.39,1.58]){move(player,y);await delay(20);}
    }
    await delay(110);
    check(`${song.songId}: both players cut independently at the faster tempo`,$('p1-points').textContent==='1'&&$('p2-points').textContent==='1');
    $('pause').click();const frozen=$('music').currentTime;await delay(150);
    check(`${song.songId}: pause freezes audio`,Math.abs($('music').currentTime-frozen)<.02);
    $('pause').click();await until(()=>!$('music').paused&&!$('pause').disabled);
    $('music').currentTime=song.duration-.12;await until(()=>$('result-dialog').open);
    check(`${song.songId}: selected one-song session completes`,$('result-subtitle').textContent.includes(song.title));
    $('retry').click();await delay(80);
    check(`${song.songId}: retry keeps song and resets clock`,$('song-select').value===song.value&&$('music').currentTime===0);
    document.querySelector('[data-mode="stretch"]').click();
    check(`${song.songId}: stretch still starts the original 225-second set`,$('music').getAttribute('src')==='/audio/maru-flow.ogg'&&$('progress').max===225&&$('song-select').value==='set');
    document.querySelector('[data-mode="rhythm"]').click();
    check(`${song.songId}: returning to rhythm restores selected fast song`,$('song-select').value===song.value&&$('music').getAttribute('src')===song.src);
  }
  const savedChoice=$('song-select').value,savedSrc=$('music').getAttribute('src');
  const bad=new DataTransfer();bad.items.add(new File(['not audio'],'broken.ogg',{type:'audio/ogg'}));$('song-file').files=bad.files;$('song-file').dispatchEvent(new Event('change'));
  await until(()=>!$('song-select').disabled);
  check('failed local file preserves the fast builtin song',$('song-select').value===savedChoice&&$('music').getAttribute('src')===savedSrc);
  const blob=await fetch('/audio/maru-pulse-rush.ogg').then(r=>r.blob()),upload=new DataTransfer();upload.items.add(new File([blob],'local-test-song.ogg',{type:'audio/ogg'}));$('song-file').files=upload.files;$('song-file').dispatchEvent(new Event('change'));
  await until(()=>!$('song-select').disabled&&$('song-select').value==='local');
  check('valid local audio remains supported after fast song changes',$('music').getAttribute('src').startsWith('blob:')&&!$('custom-tempo').hidden);
  $('song-bpm').value=156;$('song-bpm').dispatchEvent(new Event('change'));$('editor-open').click();const local=draft();editorButton('닫기').click();
  check('local BPM and chart ID remain independent',local.songId==='local'&&local.bpm===156);
  choose('maru-neon-drive');check('switching from local audio restores the correct builtin',$('music').getAttribute('src')==='/audio/maru-neon-drive.ogg'&&$('custom-tempo').hidden);
  choose('builtin');check('original Flow still selectable',$('music').getAttribute('src')==='/audio/maru-flow.ogg'&&$('song-description').textContent.includes('112'));
  $('players').value='1';$('players').dispatchEvent(new Event('change'));
  const external=performance.getEntriesByType('resource').filter(r=>new URL(r.name).origin!==location.origin);
  check('runtime resources stay local',external.length===0);
  return {passed:checks.length,checks,externalResources:external.length,cameraUsed:false};
})()
