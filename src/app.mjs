import {DIRECTIONS,ARROWS,clamp,mirrorPose,assignPlayers,generateChart,createScore,judgeHit,expireNotes,GestureTracker,poseSimilarity,validateTrackDuration} from './core.mjs';
import {SET_TRACKS,SET_DURATION,ROUTINE,routineAt,routinePose} from './routine.mjs';

const $=id=>document.getElementById(id);
const stage=$('stage'),ctx=stage.getContext('2d'),camera=$('camera'),overlay=$('camera-overlay'),camCtx=overlay.getContext('2d'),audio=$('music');
const coach=new Audio();coach.preload='auto';let lastVoiceKey='',voiceFiles={};
fetch('/audio/voice/manifest.json').then(r=>r.json()).then(data=>{voiceFiles=data.cues;}).catch(()=>{});
const musicVolume=()=>Number($('volume').value)/100;
function restoreMusic(){audio.volume=musicVolume();}
function stopVoice(){coach.pause();coach.currentTime=0;restoreMusic();}
function speak(id,interrupt=true){
  if($('voice-enabled').value==='off'||!voiceFiles[id]||document.hidden)return;
  if(!interrupt&&!coach.paused)return;
  stopVoice();coach.src=voiceFiles[id].file;coach.volume=Number($('voice-volume').value)/100;
  audio.volume=musicVolume()*.35;coach.play().catch(restoreMusic);
}
coach.addEventListener('ended',restoreMusic);coach.addEventListener('error',restoreMusic);
const work=document.createElement('canvas'),workCtx=work.getContext('2d',{willReadFrequently:true});
const COLORS=['#85e4ce','#e4b5ed'];
const CONNECT=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]];
const state={mode:'rhythm',players:1,input:null,phase:'idle',poses:[null],scores:[createScore(),createScore()],gestures:[new GestureTracker(),new GestureTracker()],stretch:[{sum:0,samples:0,hold:0},{sum:0,samples:0,hold:0}],matches:[null,null],chart:generateChart(),countdownAt:0,flash:[null,null],lastResult:null};
let track={title:'Maru Flow',duration:150,bpm:112},localSongUrl=null,songLoading=false;
let segmentIndex=0;
const sessionDuration=()=>state.mode==='stretch'?SET_DURATION:track.duration;
const sessionTime=()=>state.mode==='stretch'?segmentIndex*75+Math.min(audio.currentTime,75):audio.currentTime;
const selectedAudio=()=>state.mode==='stretch'?SET_TRACKS[segmentIndex].src:localSongUrl||'/audio/maru-flow.ogg';
let stream=null,landmarker=null,starting=false,visionImport=null,delegate='GPU',lastInference=0,lastVideoTime=-1,lastDetection=0,inferMs=0,inferFPS=0,lastUI=0,lastStretchTime=null,stopGeneration=0,gameGeneration=0,lastRender=performance.now();
let saved={};try{saved=JSON.parse(localStorage.getItem('eolmaru.settings')||'{}');}catch{}
const settingIds=['quality','sensitivity','offset','volume','voice-enabled','voice-volume'];
for(const id of settingIds) if(saved[id]!==undefined) $(id).value=saved[id];
audio.volume=Number($('volume').value)/100;
const config=()=>({fps:Number($('quality').value)||12,sensitivity:Number($('sensitivity').value)||1,offset:Number($('offset').value)/1000});
const notice=text=>$('notice').textContent=text;
const clock=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
const aspect=()=>camera.videoWidth&&camera.videoHeight?camera.videoWidth/camera.videoHeight:4/3;
const active=()=>['playing','paused','countdown','preparing','starting','resuming','transition'].includes(state.phase);

function saveSettings(){
  $('sensitivity-value').textContent=Number($('sensitivity').value).toFixed(1);$('offset-value').textContent=`${$('offset').value} ms`;$('volume-value').textContent=`${$('volume').value}%`;
  $('voice-volume-value').textContent=`${$('voice-volume').value}%`;coach.volume=Number($('voice-volume').value)/100;
  if($('voice-enabled').value==='off')stopVoice();
  audio.volume=musicVolume()*(coach.paused?1:.35);
  const settings=Object.fromEntries(settingIds.map(id=>[id,$(id).value]));
  try{localStorage.setItem('eolmaru.settings',JSON.stringify(settings));}catch{}
}
for(const id of settingIds) $(id).addEventListener('input',saveSettings);
saveSettings();
$('settings-open').onclick=()=>$('settings-dialog').showModal();$('help-open').onclick=()=>$('help-dialog').showModal();

function resetTracking(){state.poses=Array(state.players).fill(null);state.matches=[null,null];state.gestures.forEach(g=>g.reset());lastStretchTime=null;}
function updateControls(){
  const locked=active();
  document.querySelectorAll('[data-mode]').forEach(b=>b.disabled=locked||songLoading);
  $('players').disabled=locked||starting;$('song-select').disabled=locked||songLoading||state.mode==='stretch';$('song-bpm').disabled=locked;$('song-reselect').disabled=locked||songLoading;
  $('play').disabled=!state.input||locked||starting||songLoading;$('camera-start').disabled=!!stream||starting||locked;
  $('camera-select').disabled=!!stream||starting;$('demo').disabled=locked||starting;
  $('pause').disabled=!['playing','paused'].includes(state.phase);$('pause').textContent=state.phase==='paused'?'계속하기':'일시정지';
  $('stop-session').disabled=!locked;
  $('camera-stop').hidden=!stream;$('p2-score').hidden=state.players!==2;
  $('input-badge').textContent=state.input==='camera'?'CAMERA · LOCAL':state.input==='keyboard'?'KEYBOARD · 체험':'입력 대기';
  $('stage-message').hidden=state.phase!=='idle';
  $('stage-message').querySelector('h2').textContent=state.input?'준비됐어요. 편안하게 시작하세요.':'당신의 움직임을 기다리고 있어요';
  $('stage-message').querySelector('p').textContent=state.input?'플레이 시작을 누르면 3초 뒤 시작합니다.':'카메라를 켜거나 키보드 체험으로 시작하세요.';
}
function selectMode(mode){
  if(active())return;
  state.mode=mode;state.scores=[createScore(),createScore()];state.matches=[null,null];state.stretch=[{sum:0,samples:0,hold:0},{sum:0,samples:0,hold:0}];
  audio.pause();segmentIndex=0;audio.src=selectedAudio();audio.currentTime=0;state.flash=[null,null];stopVoice();lastVoiceKey='';updateSong();
  document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});
  const stretch=mode==='stretch';
  $('mode-label').textContent=stretch?'전신 스트레칭 세트':'손동작 리듬';
  $('headline').innerHTML=stretch?'한 세트, <em>온몸을</em> 가볍게.':'손끝의 움직임이 <em>리듬</em>이 되는 순간.';
  $('intro').textContent=stretch?'의자에 앉아서 목부터 발목까지 · 3곡의 절반씩, 3분 45초':'위·아래·옆으로 손을 뻗으며 선택한 한 곡을 즐겨요.';
  $('stage-title').textContent=stretch?'마루의 움직임 가이드':'리듬 스테이지';
  $('stage-subtitle').textContent=stretch?'위쪽 동작을 따라 하고 아래에서 나의 움직임을 확인해요':'박자에 맞춰 화살표 방향으로 손을 뻗어요';
  $('guide-title').innerHTML=stretch?'안정된 의자에 앉아<br>두 발을 바닥에 놓아 주세요.':'손을 가슴 앞으로 모은 뒤<br>가볍게 뻗어 주세요.';
  $('guide-description').textContent=stretch?'목·어깨·가슴·몸통·허벅지·종아리·발목 순서예요. 하체와 목은 시간 안내를 따라 해요.':'한 번 뻗고 가슴 앞으로 돌아오면 다음 박자를 칠 수 있어요.';
  $('guide-foot').textContent=stretch?'화면에 발까지 보이면 동작 확인이 더 쉬워요.':'2인 플레이는 화면의 왼쪽 P1 · 오른쪽 P2';
  $('camera-placeholder').querySelector('p').textContent=stretch?'의자에 앉은 몸과 발끝까지 화면에 보이게 준비해 주세요.':'어깨부터 골반까지, 두 손이 화면에 보이게 준비해 주세요.';
  notice(stretch?'동작을 수행했을 때 한 세트가 됩니다. 통증이나 어지럼이 있으면 멈추세요.':'준비되면 시작해요. 편안한 범위에서 손을 움직이세요.');
  updateControls();
}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>selectMode(b.dataset.mode));
function updateSong(){
  if(state.mode==='stretch'){
    $('song-title').textContent=`전신 세트 · ${SET_TRACKS[segmentIndex].title}`;$('song-source').textContent=`${segmentIndex+1} / 3`;$('song-description').textContent='목·어깨 → 몸통·허벅지 → 종아리·발목 · 각 곡 75초';$('progress').max=225;$('custom-tempo').hidden=true;$('song-select').value='set';$('song-reselect').hidden=true;return;
  }
  $('song-title').textContent=track.title;$('song-source').textContent=localSongUrl?'LOCAL FILE':'ORIGINAL';
  $('song-description').textContent=`${localSongUrl?'내 컴퓨터의 노래':'얼마루 음악엔진'} · ${track.bpm} BPM · ${clock(track.duration)}`;
  $('progress').max=track.duration;$('custom-tempo').hidden=!localSongUrl;
  $('song-select').value=localSongUrl?'local':'builtin';$('song-reselect').hidden=!localSongUrl;
}
$('song-reselect').onclick=()=>$('song-file').click();
$('song-select').onchange=()=>{
  if($('song-select').value==='local'){$('song-file').click();return;}
  resetSession();audio.src='/audio/maru-flow.ogg';if(localSongUrl)URL.revokeObjectURL(localSongUrl);localSongUrl=null;track={title:'Maru Flow',duration:150,bpm:112};updateSong();
};
$('song-file').addEventListener('cancel',()=>{$('song-select').value=localSongUrl?'local':'builtin';});
$('song-file').onchange=async()=>{
  if(state.mode!=='rhythm'||active()||songLoading){$('song-file').value='';return;}
  const file=$('song-file').files[0];if(!file){$('song-select').value=localSongUrl?'local':'builtin';return;}
  if(file.size>100*1024*1024){notice('100MB 이하, 2~3분 길이의 음악을 선택해 주세요.');$('song-select').value=localSongUrl?'local':'builtin';return;}
  songLoading=true;updateControls();const url=URL.createObjectURL(file),probe=new Audio();
  try{
    const duration=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('음악 정보를 읽는 시간이 초과됐어요.')),8000);probe.onloadedmetadata=()=>{clearTimeout(timer);resolve(probe.duration);};probe.onerror=()=>{clearTimeout(timer);reject(new Error('이 음악 형식을 읽을 수 없어요. MP3, Ogg, WAV를 사용해 주세요.'));};probe.src=url;});
    if(!validateTrackDuration(duration))throw new Error('한 곡은 2분~3분으로 선택해 주세요.');
    if(state.mode!=='rhythm')throw new Error('모드가 바뀌어 노래 선택을 취소했어요.');
    resetSession();audio.src=url;if(localSongUrl)URL.revokeObjectURL(localSongUrl);localSongUrl=url;track={title:file.name.replace(/\.[^.]+$/,''),duration,bpm:112};$('song-bpm').value=112;updateSong();notice('노래를 골랐어요. 곡의 BPM을 맞추고 시작하세요. 음악 파일은 전송하지 않습니다.');
  }catch(error){URL.revokeObjectURL(url);$('song-select').value=localSongUrl?'local':'builtin';notice(error.message);}
  finally{probe.removeAttribute('src');probe.load();songLoading=false;$('song-file').value='';updateControls();}
};
$('song-bpm').onchange=()=>{track.bpm=clamp(Number($('song-bpm').value)||112,40,240);$('song-bpm').value=track.bpm;updateSong();};
$('players').onchange=async()=>{state.players=Number($('players').value);resetTracking();if(landmarker){starting=true;updateControls();try{await landmarker.setOptions({numPoses:state.players});}catch{stopCamera();notice('인원 설정을 바꾸지 못했어요. 카메라를 다시 켜 주세요.');}finally{starting=false;}}updateControls();};

async function listCameras(){
  try{
    const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');
    const current=$('camera-select').value;$('camera-select').replaceChildren(new Option('기본 카메라',''));
    devices.forEach((d,i)=>$('camera-select').add(new Option(d.label||`카메라 ${i+1}`,d.deviceId)));
    $('camera-select').value=current;
  }catch{}
}
async function startCamera(){
  if(starting||stream)return;
  starting=true;const generation=++stopGeneration;updateControls();notice('카메라 사용을 허용해 주세요. 로컬 인식 모델을 준비합니다…');
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('이 브라우저에서는 카메라를 열 수 없습니다. Chrome 또는 Edge에서 localhost 주소를 열어 주세요.');
    const deviceId=$('camera-select').value;
    stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:960},height:{ideal:540},frameRate:{ideal:24,max:30},...(deviceId?{deviceId:{exact:deviceId}}:{})}});
    if(generation!==stopGeneration){stream.getTracks().forEach(t=>t.stop());stream=null;return;}
    camera.srcObject=stream;await camera.play();
    stream.getVideoTracks()[0].onended=()=>{stopCamera();notice('카메라 연결이 끊겼어요. 다시 연결한 뒤 카메라를 켜 주세요.');};
    notice('카메라 연결 완료. 이 컴퓨터에서 자세 인식을 준비하는 중…');
    visionImport??=import('/vendor/vision/vision_bundle.mjs');
    const {FilesetResolver,PoseLandmarker}=await visionImport;
    const fileset=await FilesetResolver.forVisionTasks('/vendor/vision/wasm');
    const options={baseOptions:{modelAssetPath:'/models/pose_landmarker_lite.task',delegate:'GPU'},runningMode:'VIDEO',numPoses:state.players,minPoseDetectionConfidence:.55,minPosePresenceConfidence:.55,minTrackingConfidence:.5,outputSegmentationMasks:false};
    try{landmarker=await PoseLandmarker.createFromOptions(fileset,options);delegate='GPU';}
    catch{options.baseOptions.delegate='CPU';landmarker=await PoseLandmarker.createFromOptions(fileset,options);delegate='CPU';}
    if(generation!==stopGeneration){landmarker.close();landmarker=null;return;}
    state.input='camera';resetTracking();lastVideoTime=-1;lastInference=0;lastDetection=performance.now();
    $('camera-placeholder').hidden=true;$('camera-corner').textContent='LIVE · LOCAL ONLY';
    notice(state.mode==='stretch'?'카메라 준비 완료. 안정된 의자에 앉아 전신과 발끝이 보이게 준비하세요.':'카메라 준비 완료. 화면에 어깨·골반·두 손이 보이면 플레이를 시작하세요.');
    await listCameras();
  }catch(error){
    stopCamera();
    const messages={NotAllowedError:'카메라 권한이 필요해요. 주소창의 카메라 권한을 허용하거나 키보드로 체험하세요.',NotFoundError:'연결된 카메라를 찾지 못했어요. USB 카메라를 확인하거나 키보드로 체험하세요.',NotReadableError:'카메라가 다른 앱에서 사용 중일 수 있어요. 그 앱을 닫고 다시 켜 주세요.',OverconstrainedError:'선택한 카메라를 열 수 없어요. 기본 카메라로 다시 시도해 주세요.'};
    notice(messages[error.name]||`인식을 준비하지 못했어요: ${error.message}. 다시 카메라를 켜거나 키보드로 체험하세요.`);
  }finally{starting=false;updateControls();}
}
function stopCamera(){
  stopGeneration++;if(active())pauseGame();
  stopVoice();
  if(stream){stream.getTracks().forEach(t=>{t.onended=null;t.stop();});stream=null;}
  if(landmarker){landmarker.close();landmarker=null;}
  camera.srcObject=null;resetTracking();
  if(state.input==='camera')state.input=null;
  if(state.phase==='paused'){state.phase='idle';audio.pause();audio.currentTime=0;}
  $('camera-placeholder').hidden=false;$('camera-corner').textContent='CAMERA OFF';$('tracking-label').textContent='카메라가 꺼져 있어요';$('performance').textContent='— fps';
  updateControls();
}
$('camera-start').onclick=startCamera;$('camera-stop').onclick=()=>{stopCamera();notice('카메라를 껐어요. 다시 켜거나 키보드로 체험할 수 있어요.');};
$('demo').onclick=()=>{stopCamera();state.input='keyboard';notice(state.mode==='rhythm'?'키보드 체험: P1 A·W·S·D / P2 방향키. 플레이 시작을 누르세요.':'카메라 없이도 음악과 음성 안내를 따라 한 세트를 진행할 수 있어요. 자세 유사도는 표시하지 않습니다.');$('camera-corner').textContent='CAMERA-FREE PREVIEW';updateControls();};

async function beginGame(){
  if(!state.input||active()||songLoading)return;
  const ticket=++gameGeneration;state.phase='preparing';updateControls();
  state.scores=[createScore(),createScore()];state.stretch=[{sum:0,samples:0,hold:0},{sum:0,samples:0,hold:0}];state.matches=[null,null];
  state.chart=generateChart({bpm:track.bpm,duration:track.duration,difficulty:'easy'});state.gestures.forEach(g=>g.reset());lastStretchTime=null;state.flash=[null,null];
  segmentIndex=0;audio.src=selectedAudio();audio.currentTime=0;updateSong();
  // Unlock playback inside the click gesture; the countdown runs while audio is paused.
  try{await audio.play();if(ticket!==gameGeneration||state.phase!=='preparing')return;audio.pause();audio.currentTime=0;}
  catch(error){if(ticket===gameGeneration){state.phase='idle';updateControls();notice(error.name==='NotAllowedError'?'소리 재생을 허용하려면 플레이 시작 버튼을 직접 눌러 주세요.':'음악 파일을 열지 못했어요. audio/maru-flow.ogg 파일을 확인하고 다시 시작해 주세요.');}return;}
  state.phase='countdown';state.countdownAt=performance.now();lastVoiceKey='';speak('ready');$('countdown').hidden=false;updateControls();notice('3초 뒤 시작합니다. 편안하게 준비해 주세요.');
}
function pauseGame(){
  stopVoice();
  if(state.phase==='playing'){audio.pause();state.phase='paused';speak('pause');notice('잠시 쉬어 가세요. 계속하기를 누르면 이어집니다.');}
  else if(state.phase==='transition'){gameGeneration++;audio.pause();state.phase='paused';notice('곡 사이에서 잠시 멈췄어요. 계속하기로 이어갑니다.');}
  else if(['countdown','preparing','starting','resuming'].includes(state.phase)){gameGeneration++;audio.pause();state.phase='idle';$('countdown').hidden=true;}
  resetTracking();updateControls();
}
async function resumeGame(){
  if(state.phase!=='paused')return;
  if(state.input==='camera'&&!stream){notice('카메라를 먼저 다시 켜 주세요.');return;}
  const ticket=++gameGeneration;state.phase='resuming';stopVoice();updateControls();
  try{await audio.play();if(ticket!==gameGeneration||state.phase!=='resuming')return;state.phase='playing';lastStretchTime=null;state.gestures.forEach(g=>g.reset());notice('다시 시작해요. 내 속도에 맞춰 움직이세요.');}
  catch{if(ticket===gameGeneration){state.phase='paused';notice('음악 재생을 다시 허용해 주세요. 계속하기 버튼을 한 번 더 누르세요.');}}
  updateControls();
}
$('play').onclick=beginGame;$('pause').onclick=()=>state.phase==='paused'?resumeGame():pauseGame();
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseGame();});
window.addEventListener('pagehide',()=>{stream?.getTracks().forEach(t=>t.stop());audio.pause();stopVoice();});
audio.addEventListener('ended',()=>{if(state.phase==='playing'&&audio.ended){if(state.mode==='stretch'&&segmentIndex<2)advanceSegment();else finishGame();}});
audio.addEventListener('waiting',()=>{if(state.phase==='playing')notice('음악을 읽는 중입니다. 파일 읽기가 끝나면 이어집니다.');});
audio.addEventListener('error',()=>{if(active())pauseGame();notice('음악 파일을 읽을 수 없어요. 설치 폴더의 음악 파일을 확인해 주세요.');});

function hit(player,lane,now=performance.now()){
  if(state.phase!=='playing'||state.mode!=='rhythm'||player>=state.players)return;
  const result=judgeHit(state.chart,state.scores[player],lane,audio.currentTime-config().offset);
  state.flash[player]={lane,until:now+230,hit:!!result};
}
document.addEventListener('keydown',event=>{
  if(['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName)||document.querySelector('dialog[open]'))return;
  if(event.code==='Space'){if(event.target.tagName==='BUTTON')return;event.preventDefault();if(!event.repeat)(state.phase==='paused'?resumeGame():pauseGame());return;}
  const controls={KeyA:[0,'left'],KeyW:[0,'up'],KeyS:[0,'down'],KeyD:[0,'right'],ArrowLeft:[1,'left'],ArrowUp:[1,'up'],ArrowDown:[1,'down'],ArrowRight:[1,'right']};
  if(controls[event.code]){
    event.preventDefault();
    if(!event.repeat&&state.input==='keyboard'){const [p,lane]=controls[event.code];hit(p,lane);}
  }
});

async function advanceSegment(){
  if(state.phase!=='playing'||state.mode!=='stretch'||segmentIndex>=2)return;
  state.phase='transition';const ticket=++gameGeneration;audio.pause();segmentIndex++;audio.src=selectedAudio();audio.currentTime=0;lastStretchTime=null;updateSong();updateControls();
  try{await audio.play();if(ticket!==gameGeneration||state.phase!=='transition')return;state.phase='playing';updateControls();notice(`${segmentIndex+1}번째 음악 · 세트를 이어갑니다.`);}
  catch{if(ticket===gameGeneration){state.phase='paused';updateControls();notice('다음 음악을 읽지 못했어요. 계속하기로 다시 시도해 주세요.');}}
}
function finishGame(){
  if(state.phase==='results')return;
  audio.pause();state.phase='results';speak('finish');$('countdown').hidden=true;
  state.lastResult={version:'0.1.0',timestamp:new Date().toISOString(),mode:state.mode,input:state.input,duration:Math.min(sessionTime(),sessionDuration()),players:state.players,track:state.mode==='stretch'?'전신 스트레칭 세트':track.title,elimination:false,results:Array.from({length:state.players},(_,i)=>state.mode==='rhythm'?{matched:state.scores[i].hits.size,total:state.chart.length}: {similarity:state.stretch[i].samples?Math.round(state.stretch[i].sum/state.stretch[i].samples):null,matchedSeconds:Math.round(state.stretch[i].hold),observedFrames:state.stretch[i].samples})};
  $('result-dialog').querySelector('h2').textContent=state.mode==='stretch'?'한 세트의 안내를 마쳤어요.':'한 곡을 마쳤어요.';
  $('result-subtitle').textContent=state.mode==='stretch'?'목부터 발목까지 3분 45초 · 하체 동작 수행 여부나 운동 효과를 자동 확인한 것은 아니에요.':`${track.title} · ${clock(track.duration)} · 편안하게 마무리하세요.`;
  $('result-cards').replaceChildren();
  state.lastResult.results.forEach((r,i)=>{
    const card=document.createElement('div');card.className='result-card';
    const title=document.createElement('h3');title.textContent=`PLAYER ${i+1}`;
    const points=document.createElement('strong');points.textContent=state.mode==='rhythm'?`${r.matched} / ${r.total}`:r.similarity===null?'—':`${r.similarity}%`;
    const label=document.createElement('span');label.textContent=state.mode==='rhythm'?'일치한 박자':'관측된 팔·몸통 자세의 평균 유사도';
    const detail=document.createElement('p');detail.textContent=state.mode==='rhythm'?'놓친 박자는 신경 쓰지 않아도 괜찮아요.':r.similarity===null?'인식된 자세가 없어 기록하지 않았어요.':`편안하게 따라 한 시간 ${r.matchedSeconds}초`;
    card.append(title,points,label,detail);$('result-cards').append(card);
  });
  $('result-dialog').showModal();updateControls();notice('완주했어요! 기록을 저장하거나 다시 즐겨 보세요.');
}
function resetSession(){audio.pause();segmentIndex=0;audio.src=selectedAudio();audio.currentTime=0;stopVoice();lastVoiceKey='';state.phase='idle';state.scores=[createScore(),createScore()];state.stretch=[{sum:0,samples:0,hold:0},{sum:0,samples:0,hold:0}];state.flash=[null,null];resetTracking();updateSong();updateControls();}
$('retry').onclick=()=>{$('result-dialog').close();resetSession();};
$('stop-session').onclick=()=>{gameGeneration++;resetSession();notice('진행을 마쳤어요. 다른 모드나 노래를 고를 수 있습니다.');};
$('result-dialog').addEventListener('cancel',resetSession);
$('export-result').onclick=()=>{
  if(!state.lastResult)return;
  const link=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(state.lastResult,null,2)],{type:'application/json'}));
  link.href=url;link.download=`eolmaru-${state.mode}-${Date.now()}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};

function infer(now){
  if(!stream||!landmarker)return;
  if(now-lastDetection>400){resetTracking();inferFPS=0;$('tracking-label').textContent='카메라 프레임이 멈췄어요';}
  if(camera.readyState<2)return;
  if(camera.currentTime===lastVideoTime){
    return;
  }
  const fps=inferMs>85?Math.min(config().fps,8):config().fps;
  if(now-lastInference<1000/fps)return;
  const previous=lastInference;lastInference=now;lastVideoTime=camera.currentTime;
  work.width=640;work.height=Math.round(640/aspect());workCtx.drawImage(camera,0,0,work.width,work.height);
  try{
    const started=performance.now();
    const result=landmarker.detectForVideo(work,now);inferMs=performance.now()-started;inferFPS=previous?1000/(now-previous):0;lastDetection=now;
    state.poses=assignPlayers(result.landmarks.map(mirrorPose),state.players);
    const count=state.poses.filter(Boolean).length;
    $('tracking-label').textContent=count?`${count} / ${state.players}명 인식 · 화면 좌우 기준`:'어깨·골반·두 손을 화면에 보여 주세요';
    for(let i=0;i<state.players;i++){
      const actions=state.gestures[i].update(state.poses[i],now,config().sensitivity,aspect());
      if(state.input==='camera'&&state.phase==='playing')actions.forEach(lane=>hit(i,lane,now));
    }
    if(state.mode==='stretch'&&state.phase==='playing'){
      const exercise=routineAt(sessionTime());
      const elapsed=lastStretchTime===null?0:clamp(sessionTime()-lastStretchTime,0,.25);lastStretchTime=sessionTime();
      for(let i=0;i<state.players;i++){
        const similarity=exercise.match?poseSimilarity(state.poses[i],exercise.match,aspect()):null;state.matches[i]=similarity;
        if(similarity!==null){state.stretch[i].sum+=similarity;state.stretch[i].samples++;if(similarity>=70)state.stretch[i].hold+=elapsed;}
      }
    }
  }catch(error){stopCamera();notice(`자세 인식이 중지됐어요: ${error.message}. 카메라를 다시 켜 주세요.`);}
}

function resize(canvas,context){
  const rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,1.5);
  const w=Math.round(rect.width*dpr),h=Math.round(rect.height*dpr);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  context.setTransform(dpr,0,0,dpr,0,0);return {w:rect.width,h:rect.height};
}
function rounded(context,x,y,w,h,r,fill,stroke){context.beginPath();context.roundRect(x,y,w,h,r);if(fill){context.fillStyle=fill;context.fill();}if(stroke){context.strokeStyle=stroke;context.stroke();}}
function text(context,str,x,y,size=12,color='#9baac3',align='left'){context.font=`${size}px "Segoe UI", "Malgun Gothic", sans-serif`;context.textAlign=align;context.fillStyle=color;context.fillText(str,x,y);}
function wrappedText(context,str,x,y,width,size,color,maxLines=2){
  context.font=`${size}px "Segoe UI", "Malgun Gothic", sans-serif`;let line='',rows=[];
  for(const ch of str){if(context.measureText(line+ch).width>width&&line){rows.push(line);line=ch;}else line+=ch;}if(line)rows.push(line);
  rows.slice(0,maxLines).forEach((row,i)=>text(context,row,x,y+i*size*1.4,size,color));
}
function drawRobot(context,pose,x,y,w,h,color=COLORS[0]){
  const pos=i=>({x:x+pose[i].x*w,y:y+pose[i].y*h});
  context.save();context.lineCap='round';
  for(const [a,b] of CONNECT){const pa=pos(a),pb=pos(b);context.lineWidth=w*.045;context.strokeStyle='#263b4b';context.beginPath();context.moveTo(pa.x,pa.y);context.lineTo(pb.x,pb.y);context.stroke();context.lineWidth=w*.018;context.strokeStyle=color;context.stroke();}
  const l=pos(11),r=pos(12),hip=pos(23);rounded(context,l.x-w*.025,l.y-w*.02,r.x-l.x+w*.05,hip.y-l.y,w*.07,color);
  const head=pos(0),hw=w*.22;rounded(context,head.x-hw*.5,head.y-hw*.4,hw,hw*.8,hw*.35,color);
  rounded(context,head.x-hw*.38,head.y-hw*.26,hw*.76,hw*.55,hw*.2,'#f7f1d9');
  for(const side of [-1,1]){context.fillStyle='#293642';context.beginPath();context.ellipse(head.x+side*hw*.18,head.y,hw*.045,hw*.072,0,0,Math.PI*2);context.fill();}
  context.strokeStyle=color;context.lineWidth=2;context.beginPath();context.moveTo(head.x,head.y-hw*.4);context.lineTo(head.x,head.y-hw*.59);context.stroke();
  context.fillStyle=color;context.beginPath();context.ellipse(head.x+hw*.05,head.y-hw*.64,hw*.10,hw*.05,-.5,0,Math.PI*2);context.fill();
  for(const id of [15,16]){const p=pos(id);context.beginPath();context.arc(p.x,p.y,w*.034,0,Math.PI*2);context.fillStyle='#f1ad9c';context.fill();}
  for(const id of [27,28]){const p=pos(id);rounded(context,p.x-w*.043,p.y-h*.02,w*.10,h*.042,h*.015,'#f4edda');}
  context.restore();
}
function drawRhythm(w,h,now){
  const count=state.players,section=w/count,time=audio.currentTime-config().offset;
  for(let player=0;player<count;player++){
    const left=section*player+section*.08, width=section*.84,laneW=width/4,hitY=h-43,color=COLORS[player];
    for(let lane=0;lane<4;lane++){
      const x=left+laneW*lane;
      ctx.fillStyle=lane%2?'#192439':'#172133';ctx.fillRect(x+2,0,laneW-4,h);
      ctx.strokeStyle='#304057';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+laneW*.5,0);ctx.lineTo(x+laneW*.5,h);ctx.stroke();
      const flash=state.flash[player],lit=flash?.lane===DIRECTIONS[lane]&&flash.until>now;
      rounded(ctx,x+laneW*.13,hitY-18,laneW*.74,36,9,lit?color:'#263c48',lit?null:color);
      text(ctx,ARROWS[DIRECTIONS[lane]],x+laneW*.5,hitY+8,25,lit?'#183a31':color,'center');
      if(state.input==='keyboard')text(ctx,(player===0?['A','W','S','D']:['←','↑','↓','→'])[lane],x+laneW*.5,h-9,9,'#97a8bf','center');
    }
    ctx.strokeStyle=color;ctx.globalAlpha=.25;ctx.beginPath();ctx.moveTo(left,hitY);ctx.lineTo(left+width,hitY);ctx.stroke();ctx.globalAlpha=1;
    for(const note of state.chart){
      if(state.scores[player].hits.has(note.id)||state.scores[player].expired.has(note.id))continue;
      const delta=note.time-time;if(delta>2.6||delta<-.30)continue;
      const lane=DIRECTIONS.indexOf(note.lane),x=left+laneW*(lane+.5),y=hitY-delta*(hitY/2.6);
      rounded(ctx,x-laneW*.30,y-13,laneW*.60,26,7,color);text(ctx,ARROWS[note.lane],x,y+7,22,'#19323b','center');
    }
    text(ctx,`P${player+1}`,left+10,22,10,color);
    if(state.phase==='playing'&&time<4.1)text(ctx,'손을 가슴 앞에 · 준비',left+width/2,h*.45,14,'#dee6f3','center');
    const flash=state.flash[player];if(flash?.hit&&flash.until>now)text(ctx,'박자가 맞았어요',left+width/2,h*.43,15,color,'center');
  }
}
function drawStretch(w,h){
  const item=routineAt(sessionTime()),pose=routinePose(item),figureW=Math.min(190,w*.40,h*.82),figureH=figureW;
  const cx=w<500?w*.25:w*.30;
  ctx.strokeStyle='#38534f';ctx.beginPath();ctx.ellipse(cx,h*.92,figureW*.55,9,0,0,Math.PI*2);ctx.stroke();
  const fy=h*.08;ctx.strokeStyle='#809298';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(cx-figureW*.18,fy+figureH*.38);ctx.lineTo(cx-figureW*.18,fy+figureH*.70);ctx.lineTo(cx+figureW*.18,fy+figureH*.70);ctx.moveTo(cx-figureW*.15,fy+figureH*.70);ctx.lineTo(cx-figureW*.15,fy+figureH*.98);ctx.moveTo(cx+figureW*.15,fy+figureH*.70);ctx.lineTo(cx+figureW*.15,fy+figureH*.98);ctx.stroke();
  drawRobot(ctx,pose,cx-figureW/2,fy,figureW,figureH);
  const tx=w<500?w*.48:w*.52;
  text(ctx,`${item.region} · ${item.match?'카메라 일치 확인':'시간 안내'}`,tx,h*.22,10,COLORS[0]);
  // Compact copy remains legible on small screens.
  const title=item.resting?'어깨의 힘을 풀고 잠시 쉬어요':w<550?item.title.replace('화면 ','').replace('옆구리 늘리기','늘리기'):item.title;
  wrappedText(ctx,title,tx,h*.36,w-tx-12,w<550?12:19,'#e7eff6');
  wrappedText(ctx,item.cue,tx,h*.52,w-tx-12,w<550?9:12,'#a3b3c8');
  text(ctx,`동작 ${item.index+1} / ${ROUTINE.length} · ${Math.ceil(item.remaining)}초`,tx,h*.68,10,'#849cb2');
  const next=ROUTINE[item.index+1];wrappedText(ctx,next?`다음: ${next.title}`:'편안한 호흡으로 마무리해요',tx,h*.80,w-tx-10,w<550?8:9,'#74948f');
  const beat=Math.floor(audio.currentTime/(60/112))%4;for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(tx+i*15,h*.94,3,0,Math.PI*2);ctx.fillStyle=i===beat?COLORS[0]:'#364757';ctx.fill();}text(ctx,'음악과 함께 천천히',tx+65,h*.95,8,'#8ca69c');
}
function drawStage(now){
  const {w,h}=resize(stage,ctx);ctx.clearRect(0,0,w,h);
  if(state.phase==='idle')return;
  if(state.mode==='rhythm')drawRhythm(w,h,now);else drawStretch(w,h);
  if(state.phase==='paused'){ctx.fillStyle='#101828c9';ctx.fillRect(0,0,w,h);text(ctx,'잠시 쉬어 가요',w/2,h/2,23,COLORS[0],'center');}
}
function drawCamera(){
  const {w,h}=resize(overlay,camCtx);camCtx.clearRect(0,0,w,h);
  if(!stream||camera.readyState<2)return;
  const scale=Math.min(w/camera.videoWidth,h/camera.videoHeight),vw=camera.videoWidth*scale,vh=camera.videoHeight*scale,ox=(w-vw)/2,oy=(h-vh)/2;
  camCtx.save();camCtx.translate(ox+vw,oy);camCtx.scale(-1,1);camCtx.drawImage(camera,0,0,vw,vh);camCtx.restore();
  if(state.players===2){camCtx.fillStyle='#11182745';camCtx.fillRect(ox+vw*.47,oy,vw*.06,vh);camCtx.strokeStyle='#aebcce88';camCtx.setLineDash([5,5]);camCtx.beginPath();camCtx.moveTo(w/2,0);camCtx.lineTo(w/2,h);camCtx.stroke();camCtx.setLineDash([]);text(camCtx,'P1',ox+15,22,11,COLORS[0]);text(camCtx,'P2',ox+vw-30,22,11,COLORS[1]);}
  state.poses.forEach((pose,i)=>{
    if(!pose)return;
    const point=n=>({x:ox+pose[n].x*vw,y:oy+pose[n].y*vh});
    camCtx.strokeStyle=COLORS[i];camCtx.lineWidth=2.5;camCtx.lineCap='round';
    for(const [a,b] of CONNECT){if((pose[a].visibility??1)<.55||(pose[b].visibility??1)<.55)continue;const pa=point(a),pb=point(b);camCtx.beginPath();camCtx.moveTo(pa.x,pa.y);camCtx.lineTo(pb.x,pb.y);camCtx.stroke();}
    for(const n of [11,12,13,14,15,16,23,24]){if((pose[n].visibility??1)<.55)continue;const p=point(n);camCtx.fillStyle=COLORS[i];camCtx.beginPath();camCtx.arc(p.x,p.y,[15,16].includes(n)?6:3,0,Math.PI*2);camCtx.fill();}
  });
}
function updateScores(){
  for(let i=0;i<state.players;i++){
    const n=i+1,score=state.scores[i];
    $(`p${n}-points`).textContent=state.mode==='rhythm'?String(score.hits.size):state.matches[i]===null?'—':`${state.matches[i]}%`;
    $(`p${n}-detail`).textContent=state.mode==='rhythm'?'박자 일치':`${Math.floor(state.stretch[i].hold)}초 함께`;
    $(`p${n}-status`).textContent=state.mode==='rhythm'?'내 속도로 움직여요':!routineAt(sessionTime()).match?'시간 안내 · 편안하게 따라 해요':state.matches[i]===null?'자세를 보여 주세요':'게임용 자세 유사도';
  }
  $('session-clock').innerHTML=`${clock(sessionTime())} <span>/ ${clock(sessionDuration())}</span>`;$('progress').value=sessionTime();
  if(stream)$('performance').textContent=`${Math.round(inferFPS)} fps · ${Math.round(inferMs)} ms · ${delegate}`;
}
function frame(now){
  // Always schedule the next frame, even if one draw/inference encounters an error.
  requestAnimationFrame(frame);
  const frameGap=now-lastRender;lastRender=now;
  if(frameGap>1000&&state.phase==='playing')pauseGame();
  if(state.phase==='countdown'){
    const left=3-Math.floor((now-state.countdownAt)/1000);$('countdown').textContent=Math.max(left,1);
    if(left<=0){const ticket=gameGeneration;state.phase='starting';updateControls();$('countdown').hidden=true;audio.play().then(()=>{if(ticket!==gameGeneration||state.phase!=='starting')return;if(document.hidden){pauseGame();return;}state.phase='playing';updateControls();notice(state.mode==='rhythm'?'아래 판정선에 노트가 닿을 때 손을 뻗어요. 놓쳐도 끝까지 즐길 수 있어요.':'위쪽 마루의 움직임을 편안하게 따라 하세요. 중간중간 쉬어 갑니다.');}).catch(()=>{if(ticket===gameGeneration){state.phase='idle';updateControls();notice('재생이 멈췄어요. 플레이 시작을 다시 눌러 주세요.');}});}
  }
  if(!document.hidden)infer(now);
  if(state.phase==='playing'){
    if(state.mode==='stretch')audio.volume=musicVolume()*(coach.paused?1:.35)*Math.min(clamp(audio.currentTime/.4),clamp((75-audio.currentTime)/.4));
    if(state.mode==='stretch'){const item=routineAt(sessionTime()),key=String(item.index);if(key!==lastVoiceKey){lastVoiceKey=key;speak(item.voice);}}
    else if(lastVoiceKey!=='rhythm-start'){lastVoiceKey='rhythm-start';speak('start');}
    if(state.mode==='rhythm')for(let i=0;i<state.players;i++)expireNotes(state.chart,state.scores[i],audio.currentTime-config().offset);
    if(state.mode==='stretch'&&audio.currentTime>=75){if(segmentIndex<2)advanceSegment();else finishGame();}
    else if(state.mode==='rhythm'&&audio.currentTime>=track.duration)finishGame();
  }
  drawStage(now);drawCamera();
  if(now-lastUI>100){lastUI=now;updateScores();}
}
selectMode('stretch');updateControls();requestAnimationFrame(frame);
