// Run in a dedicated local browser tab, after trusted clicks on #demo and #play.
// Stop the short test run with #stop-session, then agent-browser eval --stdin this file.
// Uses the actual app's editor, File input and Blob export. No real camera is opened.
(async()=>{
  const $=id=>document.getElementById(id),checks=[];
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const until=async(fn,timeout=6000)=>{const started=performance.now();while(!fn()){if(performance.now()-started>timeout)throw Error('Timed out waiting for editor state');await delay(30);}};
  const check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);};
  const NativeAudio=window.Audio,nativeURL=URL.createObjectURL,nativeClick=HTMLAnchorElement.prototype.click;
  const created=[],downloads=[];let exported=null,original=null;
  const dialog=$('saber-editor');
  const button=text=>[...dialog.querySelectorAll('button')].find(b=>b.textContent===text);
  const field=text=>[...dialog.querySelectorAll('label')].find(l=>l.querySelector('span')?.textContent===text)?.querySelector('input,select,textarea');
  const message=()=>dialog.querySelector('[role=status]').textContent;
  const open=()=>{$('editor-open').click();check('editor opens from actual app',dialog.open);};
  const currentJSON=()=>{button('현재 JSON 보기').click();return JSON.parse(field('JSON 텍스트').value);};
  const chooseFile=(input,text,name='integration.saber.json')=>{
    const transfer=new DataTransfer();transfer.items.add(new File([text],name,{type:'application/json'}));
    input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
  };
  const close=async()=>{button('닫기').click();await until(()=>!dialog.open);await delay(30);};
  try{
    if($('result-dialog').open)$('retry').click();
    if(!$('stop-session').disabled)$('stop-session').click();
    document.querySelector('[data-mode="rhythm"]').click();
    $('song-select').value='builtin';$('song-select').dispatchEvent(new Event('change'));
    $('demo').click();await until(()=>!$('editor-open').disabled);
    // Capture Audio construction only to observe ownership/lifecycle; use native media.
    window.Audio=function(...args){const own=new NativeAudio(...args);created.push(own);return own;};
    window.Audio.prototype=NativeAudio.prototype;
    open();original=currentJSON();
    const firstAudio=created.at(-1);await until(()=>firstAudio.readyState>=1);
    const bounds=dialog.getBoundingClientRect();
    check('left modal and single instance',bounds.left===12&&bounds.width<=420&&document.querySelectorAll('#saber-editor').length===1);
    button('재생').click();await until(()=>!firstAudio.paused&&firstAudio.currentTime>.05);
    check('editor audio plays independently',firstAudio!==$('music')&&$('music').paused);
    field('시작 초').value=2;field('끝 초').value=3;field('구간 반복').checked=true;firstAudio.currentTime=4;
    await until(()=>firstAudio.currentTime>=2&&firstAudio.currentTime<3);
    check('loop preview returns to selected range',true);
    await close();
    check('closing pauses and unloads editor audio',firstAudio.paused&&!firstAudio.hasAttribute('src')&&$('music').paused);
    check('closing keeps game idle',$('pause').disabled&&$('stop-session').disabled&&!$('play').disabled);
    open();
    const sample={schemaVersion:1,songId:original.songId,bpm:112,offsetSeconds:.25,notes:[
      {id:'editor-first',time:5,lineIndex:0,lineLayer:1,hand:'left',cutDirection:'up'},
      {id:'editor-second',time:10,lineIndex:3,lineLayer:1,hand:'right',cutDirection:'down'},
    ]};
    chooseFile(field('로컬 JSON 파일 · 최대 1MB'),JSON.stringify(sample));
    await until(()=>field('기록한 노트 선택').options.length===2);
    check('editor local file import exact JSON',JSON.stringify(currentJSON())===JSON.stringify(sample));
    field('JSON 텍스트').value='{ invalid';button('텍스트 가져오기').click();
    check('invalid editor import preserves draft',message().includes('JSON')&&JSON.stringify(currentJSON())===JSON.stringify(sample));
    const audio=created.at(-1);audio.currentTime=15;field('기록 박자 스냅').value='0';
    button('현재 음악 시간에 기록').click();
    check('record subtracts offset exactly once',currentJSON().notes.at(-1).time===14.75);
    button('실행 취소').click();
    check('undo restores imported chart',JSON.stringify(currentJSON())===JSON.stringify(sample));
    // The textarea's Space must not also record or reach the parent saber controller.
    field('JSON 텍스트').dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true,cancelable:true}));
    check('editor text input isolates game hotkeys',field('기록한 노트 선택').options.length===2);
    URL.createObjectURL=function(blob){exported=blob;return nativeURL.call(URL,blob);};
    HTMLAnchorElement.prototype.click=function(){if(this.download)downloads.push({name:this.download,href:this.href});return nativeClick.call(this);};
    button('JSON 저장').click();
    const downloaded=JSON.parse(await exported.text());
    check('download uses chart filename and local blob',downloads.at(-1)?.name===`${sample.songId}.saber.json`&&downloads.at(-1)?.href.startsWith('blob:'));
    check('export preserves raw chart without media path',JSON.stringify(downloaded)===JSON.stringify(sample)&&!('src' in downloaded)&&!('hitTime' in downloaded.notes[0]));
    button('검증 후 게임에 적용').click();await until(()=>!dialog.open);
    check('apply unloads editor and leaves game idle',audio.paused&&!audio.hasAttribute('src')&&$('music').paused&&$('pause').disabled);
    open();check('applied chart is stored by game',JSON.stringify(currentJSON())===JSON.stringify(sample));await close();
    // The app-level file loader must be atomic too, independently from the editor.
    chooseFile($('chart-file'),'{ invalid');await until(()=>!$('editor-open').disabled);
    check('app rejects malformed import visibly',$('notice').textContent.includes('JSON'));
    open();check('failed app import preserves active chart',JSON.stringify(currentJSON())===JSON.stringify(sample));
    field('JSON 텍스트').value=JSON.stringify(downloaded);button('텍스트 가져오기').click();
    check('download can be imported again without drift',JSON.stringify(currentJSON())===JSON.stringify(sample));
    chooseFile(field('로컬 JSON 파일 · 최대 1MB'),'x'.repeat(1024*1024+1));
    check('oversize file rejects without replacing draft',message().includes('1MB')&&JSON.stringify(currentJSON())===JSON.stringify(sample));
    button('빈 채보로 시작').click();button('검증 후 게임에 적용').click();await delay(30);
    check('empty draft cannot replace game chart',dialog.open&&message().includes('1~2000'));
    button('실행 취소').click();
    dialog.dispatchEvent(new Event('cancel',{cancelable:true}));await until(()=>!dialog.open);await delay(30);
    check('Escape cancel unloads current audio',created.at(-1).paused&&!created.at(-1).hasAttribute('src'));
    // Restore the original chart so repeating this script begins from a stable state.
    open();field('JSON 텍스트').value=JSON.stringify(original);button('텍스트 가져오기').click();
    button('검증 후 게임에 적용').click();await until(()=>!dialog.open);
    check('all editor audio objects are released',created.every(a=>a.paused&&!a.hasAttribute('src')));
    check('game audio stayed idle',$('music').paused&&$('music').currentTime===0);
    return {passed:checks.length,checks,editorAudioObjects:created.length,downloads:downloads.map(d=>d.name)};
  }finally{
    window.Audio=NativeAudio;URL.createObjectURL=nativeURL;HTMLAnchorElement.prototype.click=nativeClick;
    if(dialog.open)button('닫기').click();
  }
})()
