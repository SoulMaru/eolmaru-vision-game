import {validateChart,chartJSON,DIRECTIONS} from './saber-chart.mjs';

const MAX_BYTES=1024*1024,MAX_UNDO=30;
const DIR_LABEL={up:'↑ 위',down:'↓ 아래',left:'← 왼쪽',right:'→ 오른쪽',any:'● 자유'};
const fmt=t=>{const ticks=Math.round(Math.max(0,t)*100);return `${Math.floor(ticks/6000)}:${((ticks%6000)/100).toFixed(2).padStart(5,'0')}`;};
const clone=value=>JSON.parse(JSON.stringify(value));

/** One reusable modal. It owns its own Audio; it never operates the game's audio. */
export function createChartEditor({onApply=()=>{},onNotice=()=>{}}={}) {
  let audio=null,draft=null,original=null,duration=150,history=[],chosen='',frame=0,generation=0,nextId=1;
  let applying=false,lastPreview='',lastPaint=0;
  const urls=new Map();
  const el=(tag,props={},parent)=>{
    const node=document.createElement(tag);
    for(const [key,value] of Object.entries(props)) {
      if(key==='text')node.textContent=value;
      else if(key==='class')node.className=value;
      else if(key in node)node[key]=value;
      else node.setAttribute(key,value);
    }
    if(parent)parent.append(node);return node;
  };
  const dialog=el('dialog',{id:'saber-editor','aria-labelledby':'saber-editor-title',class:'saber-editor'});
  const header=el('div',{class:'saber-editor-header'},dialog);
  el('h2',{id:'saber-editor-title',text:'로컬 채보 편집기'},header);
  const exit=el('button',{type:'button',text:'닫기','aria-label':'채보 편집기 닫기'},header);
  const subtitle=el('p',{class:'saber-editor-intro',text:'게임과 분리된 작성 화면입니다. 저장하거나 적용하기 전까지 게임 채보는 바뀌지 않아요.'},dialog);
  const songLabel=el('p',{class:'saber-editor-song'},dialog);
  const notice=el('p',{class:'saber-editor-notice',role:'status','aria-live':'polite'},dialog);
  function announce(message,error=false) {
    notice.textContent=String(message);notice.dataset.error=String(error);
  }
  function row(parent=dialog){return el('div',{class:'saber-editor-row'},parent);}
  function field(label,type,props={},parent=dialog) {
    const wrap=el('label',{class:'saber-editor-field'},parent);el('span',{text:label},wrap);
    return el(type,props,wrap);
  }
  function button(label,parent=dialog,action){const b=el('button',{type:'button',text:label},parent);if(action)b.addEventListener('click',action);return b;}
  function section(title) {const s=el('section',{},dialog);el('h3',{text:title},s);return s;}
  function select(label,options,parent) {
    const s=field(label,'select',{},parent);
    for(const [value,text] of options)el('option',{value,text},s);
    return s;
  }
  const transport=section('음악과 구간 미리보기');
  const transportRow=row(transport);
  const play=button('재생',transportRow,()=>togglePlay());
  const stop=button('처음으로',transportRow,()=>{if(audio){audio.pause();audio.currentTime=0;paintClock();}});
  const clock=el('output',{class:'saber-editor-clock',text:'0:00.00 / 2:30.00','aria-label':'편집 음악 시간'},transportRow);
  const seek=field('음악 위치','input',{type:'range',min:0,max:150,step:.01,value:0,'aria-label':'편집 음악 위치'},transport);
  seek.addEventListener('input',()=>{if(audio){audio.currentTime=Number(seek.value);paintClock();}});
  const loopRow=row(transport);
  const loop=field('구간 반복','input',{type:'checkbox'},loopRow);
  const loopStart=field('시작 초','input',{type:'number',min:0,step:.1,value:0},loopRow);
  const loopEnd=field('끝 초','input',{type:'number',min:0,step:.1,value:15},loopRow);
  const preview=el('div',{class:'saber-editor-preview','aria-label':'다가오는 노트 미리보기'},transport);
  const cells=Array.from({length:12},(_,i)=>el('div',{class:'saber-editor-cell',text:'·','aria-label':`${i%4+1}열 ${Math.floor(i/4)+1}층`},preview));
  for(const field of [loop,loopStart,loopEnd])field.addEventListener('change',()=>{
    if(loop.checked&&!validLoop()){loop.checked=false;announce('반복 구간은 0초부터 곡 끝 사이에서 시작보다 끝이 커야 해요.',true);}
  });

  const chartSection=section('곡 설정');
  const timingRow=row(chartSection);
  const bpm=field('BPM','input',{type:'number',min:40,max:240,step:1,value:112},timingRow);
  const offset=field('채보 시작 보정 초','input',{type:'number',step:.01,value:0},timingRow);
  button('곡 설정 반영',chartSection,()=>mutate({...draft,bpm:Number(bpm.value),offsetSeconds:Number(offset.value)},'곡 설정을 반영했어요.'));
  el('small',{text:'기록 시간 = 음악 시간 − 채보 시작 보정. 묶음 사이는 최소 2박, 동시는 서로 다른 손·칸 2개까지예요.'},chartSection);

  const editSection=section('노트 기록과 수정');
  const noteRow=row(editSection);
  const column=select('열',[[0,'1'],[1,'2'],[2,'3'],[3,'4']],noteRow);
  const layer=select('층',[[0,'위'],[1,'가운데'],[2,'아래']],noteRow);
  const hand=select('손',[['left','빨강 L'],['right','파랑 R']],noteRow);
  const choiceRow=row(editSection);
  const direction=select('방향',DIRECTIONS.map(d=>[d,DIR_LABEL[d]]),choiceRow);
  const snap=select('기록 박자 스냅',[['2','2박'],['1','1박'],['0','끄기']],choiceRow);
  const noteTime=field('선택 노트 시간 초','input',{type:'number',min:0,step:.000001,value:0},editSection);
  const record=button('현재 음악 시간에 기록',editSection,()=>recordNow());record.classList.add('saber-editor-primary');
  const list=field('기록한 노트 선택','select',{size:5,'aria-label':'기록한 노트 선택'},editSection);
  list.addEventListener('change',()=>{chosen=list.value;populateNote();});
  const editRow=row(editSection);
  const update=button('선택 수정',editRow,()=>{
    const index=draft.notes.findIndex(n=>n.id===chosen);if(index<0)return;
    const notes=draft.notes.map(n=>n.id===chosen?{id:n.id,time:Number(noteTime.value),...noteFields()}:n);
    mutate({...draft,notes},'선택한 노트를 수정했어요.');
  });
  const remove=button('선택 삭제',editRow,()=>mutate({...draft,notes:draft.notes.filter(n=>n.id!==chosen)},'선택한 노트를 지웠어요.'));
  const undo=button('실행 취소',editRow,()=>{
    if(!history.length)return;draft=history.pop();chosen='';sync();announce('직전 편집을 되돌렸어요.');
  });
  button('빈 채보로 시작',editSection,()=>mutate({...draft,notes:[]},'빈 채보를 준비했어요. 실행 취소로 복원할 수 있어요.'));
  el('small',{text:'단축키: 1~4 열 · Q/W/E 층 · Z/X 손 · 방향키 방향 · Space 기록. 입력 칸과 목록을 편집 중에는 단축키를 사용하지 않아요.'},editSection);

  const jsonSection=section('JSON 가져오기와 내보내기');
  const file=field('로컬 JSON 파일 · 최대 1MB','input',{type:'file',accept:'.json,application/json'},jsonSection);
  const jsonText=field('JSON 텍스트','textarea',{rows:5,maxLength:MAX_BYTES,spellcheck:false,placeholder:'v1 채보 JSON을 붙여넣으세요.'},jsonSection);
  const jsonRow=row(jsonSection);
  button('텍스트 가져오기',jsonRow,()=>importJSON(jsonText.value));
  button('현재 JSON 보기',jsonRow,()=>{jsonText.value=JSON.stringify(chartJSON(draft),null,2);announce('현재 편집 내용을 JSON으로 표시했어요.');});
  button('JSON 저장',jsonRow,()=>exportJSON());
  const actions=row();
  const apply=button('검증 후 게임에 적용',actions,()=>applyDraft());apply.classList.add('saber-editor-primary');
  el('small',{text:'저장·적용은 1개 이상의 유효한 노트가 있어야 해요. 원본 음원과 파일은 수정하지 않아요.'},dialog);
  document.body.append(dialog);

  function validate(candidate,allowEmpty=true) {
    return validateChart(candidate,{duration,songId:original.songId,allowEmpty});
  }
  function mutate(candidate,message) {
    if(!draft||applying)return false;
    try {
      const next=chartJSON(validate(candidate));
      history.push(clone(draft));if(history.length>MAX_UNDO)history.shift();
      draft=next;sync();announce(message);return true;
    } catch(error){announce(error.message,true);return false;}
  }
  function noteFields(){return {lineIndex:Number(column.value),lineLayer:Number(layer.value),hand:hand.value,cutDirection:direction.value};}
  function recordNow() {
    if(!audio||!draft||applying)return;
    let time=audio.currentTime-draft.offsetSeconds;
    const interval=Number(snap.value)*60/draft.bpm;
    if(interval>0)time=Math.round(time/interval)*interval;
    time=Math.round(time*1e6)/1e6;
    let id;do{id=`edit-${nextId++}`;}while(draft.notes.some(n=>n.id===id));
    const previous=chosen;chosen=id;
    if(!mutate({...draft,notes:[...draft.notes,{id,time,...noteFields()}]},`음악 ${fmt(time+draft.offsetSeconds)} 위치에 기록했어요.`))chosen=previous;
  }
  function sync() {
    if(!draft)return;
    bpm.value=draft.bpm;offset.value=draft.offsetSeconds;
    list.replaceChildren();
    for(const n of draft.notes)el('option',{value:n.id,text:`${fmt(n.time+draft.offsetSeconds)}  ${n.hand==='left'?'L':'R'} ${DIR_LABEL[n.cutDirection]}  ${n.lineIndex+1}열 ${n.lineLayer+1}층`},list);
    if(!draft.notes.some(n=>n.id===chosen))chosen=draft.notes[0]?.id??'';
    list.value=chosen;undo.disabled=!history.length;
    update.disabled=remove.disabled=!chosen;apply.disabled=applying;
    songLabel.textContent=`${original.songId} · ${duration.toFixed(1)}초 · ${draft.notes.length}개 노트`;
    populateNote();lastPreview='';paintClock();
  }
  function populateNote() {
    const n=draft?.notes.find(n=>n.id===chosen);if(!n)return;
    column.value=n.lineIndex;layer.value=n.lineLayer;hand.value=n.hand;direction.value=n.cutDirection;noteTime.value=n.time;
  }
  function validLoop() {
    const start=Number(loopStart.value),end=Number(loopEnd.value);
    return Number.isFinite(start)&&Number.isFinite(end)&&start>=0&&end>start&&end<=duration;
  }
  function paintClock() {
    if(!audio||!draft)return;
    const t=Number.isFinite(audio.currentTime)?audio.currentTime:0;
    seek.value=t;clock.textContent=`${fmt(t)} / ${fmt(duration)}`;play.textContent=audio.paused?'재생':'일시정지';
    const upcoming=draft.notes.filter(n=>{const delta=n.time+draft.offsetSeconds-t;return delta>=-.15&&delta<=.55;});
    const key=upcoming.map(n=>n.id).join('|');
    if(key!==lastPreview) {
      lastPreview=key;
      cells.forEach(cell=>{cell.textContent='·';delete cell.dataset.hand;});
      for(const n of upcoming){const cell=cells[n.lineLayer*4+n.lineIndex];cell.textContent=`${n.hand==='left'?'L':'R'} ${DIR_LABEL[n.cutDirection].split(' ')[0]}`;cell.dataset.hand=n.hand;}
    }
  }
  function tick(now) {
    frame=0;if(!dialog.open||!audio||audio.paused)return;
    if(loop.checked&&validLoop()&&(audio.currentTime>=Number(loopEnd.value)||audio.currentTime<Number(loopStart.value)))audio.currentTime=Number(loopStart.value);
    if(now-lastPaint>=50){lastPaint=now;paintClock();}
    frame=requestAnimationFrame(tick);
  }
  async function togglePlay() {
    if(!audio)return;
    if(!audio.paused){audio.pause();paintClock();return;}
    const own=audio,ticket=generation;
    try {
      if(loop.checked){if(!validLoop()){announce('반복 구간의 시작·끝을 확인해 주세요.',true);return;}if(own.currentTime>=Number(loopEnd.value)||own.currentTime<Number(loopStart.value))own.currentTime=Number(loopStart.value);}
      await own.play();
      if(ticket!==generation||audio!==own||!dialog.open){own.pause();return;}
      if(!frame)frame=requestAnimationFrame(tick);paintClock();
    } catch(error){if(ticket===generation&&dialog.open)announce('음악을 재생하지 못했어요. 파일을 다시 선택한 뒤 편집기를 열어 주세요.',true);}
  }
  function importJSON(value) {
    try {
      // Import uses the strict player loader, while normal draft edits may be empty.
      const candidate=chartJSON(validate(value,false));
      return mutate(candidate,'채보를 가져왔어요. 게임에 적용하기 전까지 편집기에만 반영돼요.');
    } catch(error){announce(error.message,true);return false;}
  }
  file.addEventListener('change',async()=>{
    const selected=file.files?.[0],ticket=generation;file.value='';if(!selected)return;
    if(selected.size>MAX_BYTES){announce('채보는 1MB 이하여야 해요.',true);return;}
    try {const value=await selected.text();if(ticket===generation&&dialog.open)importJSON(value);}
    catch{if(ticket===generation&&dialog.open)announce('선택한 JSON 파일을 읽지 못했어요.',true);}
  });
  function exportJSON() {
    try {
      const result=validate(draft,false),data=JSON.stringify(chartJSON(result),null,2);
      const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
      const link=el('a',{href:url,download:`${original.songId}.saber.json`});document.body.append(link);link.click();link.remove();
      const timer=setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);},1000);urls.set(url,timer);
      announce('검증된 채보 JSON을 저장했어요. 음원과 개인 경로는 포함하지 않아요.');
    } catch(error){announce(error.message,true);}
  }
  async function applyDraft() {
    if(applying)return;
    const ticket=generation;
    try {
      const result=validate(draft,false);applying=true;apply.disabled=true;
      await onApply(result);
      if(ticket!==generation||!dialog.open)return;
      onNotice('작성한 세이버 채보를 적용했어요. 플레이 시작으로 한 곡을 진행할 수 있어요.');close();
    } catch(error){if(ticket===generation&&dialog.open)announce(error.message||'채보를 적용하지 못했어요.',true);}
    finally{if(ticket===generation){applying=false;apply.disabled=false;}}
  }
  function cleanup() {
    generation++;applying=false;if(frame)cancelAnimationFrame(frame);frame=0;
    if(audio){audio.pause();audio.removeAttribute('src');audio.load();audio=null;}
    for(const [url,timer] of urls){clearTimeout(timer);URL.revokeObjectURL(url);}urls.clear();
    lastPreview='';cells.forEach(cell=>{cell.textContent='·';delete cell.dataset.hand;});
  }
  function close(){cleanup();if(dialog.open)dialog.close();}
  exit.addEventListener('click',close);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('close',()=>{if(!dialog.open)cleanup();});
  dialog.addEventListener('keydown',event=>{
    // Contain all editor keys so the parent game's test input cannot also receive them.
    event.stopPropagation();
    if(event.isComposing||event.ctrlKey||event.metaKey||event.altKey||applying)return;
    if(event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
    const key=event.key.toLowerCase();let handled=true;
    if(/^[1-4]$/.test(key))column.value=Number(key)-1;
    else if(['q','w','e'].includes(key))layer.value=['q','w','e'].indexOf(key);
    else if(key==='z'||key==='x')hand.value=key==='z'?'left':'right';
    else if(key.startsWith('arrow')&&DIRECTIONS.includes(key.slice(5)))direction.value=key.slice(5);
    else if(key===' '){if(!event.repeat)recordNow();}
    else handled=false;
    if(handled)event.preventDefault();
  });

  return {
    open({chart,src,duration:seconds}) {
      if(typeof src!=='string'||!src)throw new Error('편집할 음악이 없어요.');
      const checked=validateChart(chart,{duration:seconds,songId:chart?.songId,allowEmpty:true});
      cleanup();original=chartJSON(checked);draft=clone(original);duration=checked.duration;history=[];chosen='';nextId=1;
      seek.max=duration;seek.value=0;loop.checked=false;loopStart.value=0;loopEnd.value=Math.min(15,duration);
      loopStart.max=loopEnd.max=duration;jsonText.value='';apply.disabled=false;
      const own=new Audio();audio=own;own.preload='metadata';own.src=src;own.volume=.65;
      own.addEventListener('pause',()=>{if(audio===own){if(frame)cancelAnimationFrame(frame);frame=0;paintClock();}});
      own.addEventListener('seeked',()=>{if(audio===own)paintClock();});
      own.addEventListener('ended',()=>{
        if(audio!==own||!dialog.open)return;
        if(loop.checked&&validLoop()){own.currentTime=Number(loopStart.value);togglePlay();}else paintClock();
      });
      own.addEventListener('error',()=>{if(audio===own&&dialog.open)announce('편집 음악을 읽지 못했어요. 채보 편집과 JSON 저장은 계속할 수 있어요.',true);});
      sync();announce('편집 준비 완료. 음악을 들으며 노트를 기록해 보세요.');
      if(!dialog.open)dialog.showModal();play.focus();
    },
    close,
    isOpen:()=>dialog.open,
  };
}
