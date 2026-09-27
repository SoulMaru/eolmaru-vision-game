// Load with browser-saber-races-init.js BEFORE navigation.
// Run fresh pages ?race=import, ?race=editor, ?race=file, ?race=stale-editor.
// This uses only DOM events/UI and synthetic File objects; it never accesses app-private state.
(async()=>{
  const $=id=>document.getElementById(id),probe=window.__saberRace,checks=[],scenario=new URL(location.href).searchParams.get('race');
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const until=async(fn)=>{const started=performance.now();while(!fn()){if(performance.now()-started>8000)throw Error(`Timed out: ${scenario}`);await delay(30);}};
  const check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);};
  const fixture=id=>({schemaVersion:1,songId:'maru-flow',bpm:120,offsetSeconds:0,notes:[{id,time:10,lineIndex:1,lineLayer:1,hand:'left',cutDirection:'right'}]});
  const editorButton=label=>[...$('saber-editor').querySelectorAll('button')].find(b=>b.textContent===label);
  const readDraft=()=>{editorButton('현재 JSON 보기').click();return JSON.parse($('saber-editor').querySelector('textarea').value);};
  const importDraft=id=>{$('saber-editor').querySelector('textarea').value=JSON.stringify(fixture(id));editorButton('텍스트 가져오기').click();};
  const openEditor=()=>{$('editor-open').click();check('editor opens',$('saber-editor').open);};
  const closeEditor=()=>editorButton('닫기').click();
  const upload=id=>{const transfer=new DataTransfer();transfer.items.add(new File([JSON.stringify(fixture(id))],`race-${id}.json`,{type:'application/json'}));$('chart-file').files=transfer.files;$('chart-file').dispatchEvent(new Event('change'));};
  await until(()=>probe?.fetchWaiting);
  document.querySelector('[data-mode="rhythm"]').click();$('demo').click();
  check('builtin response is held before user work',!probe.fetchDelivered);
  if(scenario==='import'){
    upload('user-import-before-default');await until(()=>$('notice').textContent.includes('채보를 불러왔어요'));
    openEditor();check('user import is active',readDraft().notes[0].id==='user-import-before-default');closeEditor();
    probe.releaseFetch();await until(()=>probe.fetchDelivered);await delay(80);
    openEditor();check('late builtin response cannot overwrite imported chart',readDraft().notes[0].id==='user-import-before-default');closeEditor();
  }else if(scenario==='editor'){
    openEditor();const initial=readDraft();importDraft('unapplied-editor-draft');
    check('editor contains an unapplied draft',readDraft().notes[0].id==='unapplied-editor-draft');
    probe.releaseFetch();await until(()=>probe.fetchDelivered);await delay(80);
    check('late builtin leaves open draft intact',$('saber-editor').open&&readDraft().notes[0].id==='unapplied-editor-draft');closeEditor();
    openEditor();check('late builtin also leaves underlying game chart intact',JSON.stringify(readDraft())===JSON.stringify(initial));closeEditor();
  }else if(scenario==='file'){
    probe.releaseFetch();await until(()=>probe.fetchDelivered);await delay(80);
    check('play starts enabled before the read',!$('play').disabled);
    probe.delayFile=true;upload('delayed-file');await until(()=>probe.fileWaiting);
    check('song and play controls lock during file text read',['song-select','song-reselect','song-bpm','play','editor-open'].every(id=>$(id).disabled));
    check('mode buttons lock during file text read',[...document.querySelectorAll('button[data-mode]')].every(b=>b.disabled));
    // Invoke the real event handlers despite the disabled UI to check their guards.
    document.querySelector('button[data-mode="stretch"]').onclick();
    $('song-select').value='local';$('song-select').onchange();$('song-bpm').value=140;$('song-bpm').onchange();await $('play').onclick();
    check('mode and play handler guards reject pending-read transitions',$('mode-label').textContent==='손동작 리듬'&&$('music').paused&&$('countdown').hidden);
    probe.releaseFile();await until(()=>!$('chart-import').disabled);await delay(80);
    check('controls unlock after the read',!$('play').disabled&&!$('song-select').disabled);
    openEditor();check('delayed file applies once to the unchanged song',readDraft().notes[0].id==='delayed-file'&&readDraft().bpm===120);closeEditor();
  }else if(scenario==='stale-editor'){
    probe.releaseFetch();await until(()=>probe.fetchDelivered);await delay(80);openEditor();importDraft('newer-editor-chart');
    // An adversarial delayed file event while the modal is already open tests the
    // post-await revision guard without mutating the module's private state.
    probe.delayFile=true;upload('stale-file');await until(()=>probe.fileWaiting);
    editorButton('검증 후 게임에 적용').click();await until(()=>!$('saber-editor').open);
    probe.releaseFile();await until(()=>!$('chart-import').disabled);
    check('a stale response is rejected after a newer chart is applied',$('notice').textContent.includes('채보 읽기를 취소'));
    openEditor();check('stale response preserves the newer editor chart',readDraft().notes[0].id==='newer-editor-chart');closeEditor();
  }else throw Error('Unknown race case');
  return {scenario,passed:checks.length,checks,privateStateMutated:false,cameraUsed:false};
})()
