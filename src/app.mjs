import {clamp,mirrorPose,assignPlayers,createScore,judgeHit,expireNotes,GestureTracker,poseSimilarity,validateTrackDuration} from './core.mjs';
import {SET_TRACKS,SET_DURATION,ROUTINE_PROFILES,routineAt,routinePose} from './routine.mjs';

import {generateShowChart,RhythmAudio} from './show.mjs';
import {drawRhythmShow,drawWelcome,drawStretchWorld} from './show-render.mjs';
import {FullscreenController} from './fullscreen.mjs';

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
const state={mode:'rhythm',profile:'standing',players:1,input:null,phase:'idle',poses:[null],scores:[createScore(),createScore()],gestures:[new GestureTracker(),new GestureTracker()],stretch:[{sum:0,samples:0,hold:0},{sum:0,samples:0,hold:0}],matches:[null,null],chart:generateShowChart(),countdownAt:0,flash:[null,null],lastResult:null};
const rhythmAudio=new RhythmAudio();
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
const fullscreen=new FullscreenController({onExit:()=>{pauseGame();notice('전체화면을 나와 잠시 멈췄어요. 왼쪽 계속하기로 이어가세요.');},onChange:(active,message)=>{$('fullscreen-toggle').textContent=active?'⛶ 전체화면 나가기':'⛶ 전체화면';$('fullscreen-status').textContent=message;document.body.classList.toggle('native-fullscreen',active);}});
$('fullscreen-toggle').onclick=()=>fullscreen.toggle();
let track={title:'Maru Flow',duration:150,bpm:112},localSongUrl=null,songLoading=false;
let segmentIndex=0;
const profile=()=>ROUTINE_PROFILES[state.profile];
const currentExercise=()=>routineAt(sessionTime(),state.profile);
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
$('settings-open').onclick=()=>{if(active())pauseGame();$('settings-dialog').showModal();};$('help-open').onclick=()=>{if(active())pauseGame();$('help-dialog').showModal();};

function resetTracking(){state.poses=Array(state.players).fill(null);state.matches=[null,null];state.gestures.forEach(g=>g.reset());lastStretchTime=null;}
function updateControls(){
  const locked=active();
  document.body.classList.toggle('in-session',locked);
  document.body.dataset.mode=state.mode;
  document.querySelectorAll('[data-mode]').forEach(b=>b.disabled=locked||songLoading||starting);
  $('stretch-profile').disabled=locked||starting||songLoading;
  $('players').disabled=locked||starting||(state.mode==='stretch'&&profile().requiresTwo);$('song-select').disabled=locked||songLoading||state.mode==='stretch';$('song-bpm').disabled=locked;$('song-reselect').disabled=locked||songLoading;
  $('play').disabled=!state.input||locked||starting||songLoading;$('camera-start').disabled=!!stream||starting||locked;
  $('camera-select').disabled=!!stream||starting;$('demo').disabled=locked||starting;
  $('pause').disabled=!['playing','paused'].includes(state.phase);$('pause').textContent=state.phase==='paused'?'계속하기':'일시정지';
  $('stop-session').disabled=!locked;
  $('camera-stop').hidden=!stream;$('p2-score').hidden=state.players!==2;
  $('input-badge').textContent=state.input==='camera'?'CAMERA · LOCAL':state.input==='keyboard'?(state.mode==='stretch'?'GUIDE · 안내':'KEYBOARD · 체험'):'입력 대기';
  $('stage-message').hidden=state.phase!=='idle';
  $('stage-message').querySelector('h2').textContent=state.input?'준비됐어요. 편안하게 시작하세요.':'당신의 움직임을 기다리고 있어요';
  $('stage-message').querySelector('p').textContent=state.input?'플레이 시작을 누르면 3초 뒤 시작합니다.':state.mode==='stretch'?'카메라를 켜거나 카메라 없이 안내 보기를 선택하세요.':'카메라를 켜거나 키보드 체험으로 시작하세요.';
}
function selectMode(mode){
  if(active()||starting||songLoading)return;
  state.mode=mode;state.scores=[createScore(),createScore()];state.matches=[null,null];state.stretch=[{sum:0,samples:0,hold:0},{sum:0,samples:0,hold:0}];
  audio.pause();segmentIndex=0;audio.src=selectedAudio();audio.currentTime=0;state.flash=[null,null];stopVoice();rhythmAudio.stop();lastVoiceKey='';updateSong();
  document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});
  const stretch=mode==='stretch',floor=stretch&&state.profile==='floor',couple=stretch&&state.profile==='couple';
  $('stretch-options').hidden=!stretch;
  $('demo').textContent=stretch?'카메라 없이 안내 보기 →':'키보드로 체험 →';
  document.querySelector('.directions').hidden=stretch;
  if(couple&&state.players!==2)setPlayerCount(2);
  $('mode-label').textContent=stretch?'전신 스트레칭 세트':'손동작 리듬';
  $('headline').innerHTML=stretch?'한 세트, <em>온몸을</em> 가볍게.':'손끝의 움직임이 <em>리듬</em>이 되는 순간.';
  $('intro').textContent=stretch?`${profile().name} · 목부터 발목까지 · 3곡 × 75초, 총 3분 45초`:'의자에 앉아 손만 위·아래·옆으로 · 선택한 한 곡을 즐겨요.';
  $('stage-title').textContent=stretch?'마루의 움직임 가이드':'마루 리듬쇼';
  $('stage-subtitle').textContent=stretch?'위쪽 동작을 따라 하고 아래에서 나의 움직임을 확인해요':'소리를 듣고 → 같은 박자에 손으로 답해요';
  $('guide-title').innerHTML=stretch?(floor?'매트에 먼저 누워서<br>편안하게 준비해 주세요.':couple?'둘이 나란히 서서<br>각자의 범위로 따라 해요.':'두 발로 편안히 서서<br>전신을 천천히 움직여요.'):'의자에 앉아 손을 가슴 앞으로.<br>손만 가볍게 뻗어 주세요.';
  $('guide-description').textContent=stretch?(floor?'누운 동작은 시간과 음성으로 안내해요. 카메라 일치율을 매기지 않아요.':couple?'서로 당기거나 밀지 않고 같은 동작을 함께해요. 각자 벽이나 안정된 지지물을 준비해요.':'목·어깨·가슴·몸통·허벅지·종아리·발목 순서예요. 목과 하체는 시간 안내를 따라 해요.'):'먼저 소리와 방향을 보고, 다음 구간에서 같은 박자에 손을 뻗어요. 가슴 앞으로 돌아오면 다음 입력 준비!';
  $('guide-foot').textContent=stretch?(floor?'누운 상태로 한 세트 · 일어날 때는 천천히':'벽이나 안정된 지지물 옆 · 머리부터 발까지 화면에'):'2인 플레이는 화면의 왼쪽 P1 · 오른쪽 P2';
  $('camera-placeholder').querySelector('p').textContent=stretch?(floor?'매트와 누운 몸 전체가 보이게 카메라를 준비해 주세요.':'서 있는 몸의 머리부터 발끝까지 화면에 보이게 준비해 주세요.'):'의자에 앉아 어깨·골반·두 손이 화면에 보이게 준비해 주세요.';
  notice(stretch?'동작을 수행했을 때 한 세트가 됩니다. 통증이나 어지럼이 있으면 멈추세요.':'준비되면 시작해요. 편안한 범위에서 손을 움직이세요.');
  updateControls();
}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>selectMode(b.dataset.mode));
function updateSong(){
  if(state.mode==='stretch'){
    $('song-title').textContent=`${profile().name} · ${SET_TRACKS[segmentIndex].title}`;$('song-source').textContent=`${segmentIndex+1} / 3`;$('song-description').textContent='목·어깨 → 몸통·허벅지 → 종아리·발목 · 각 곡 75초';$('progress').max=225;$('custom-tempo').hidden=true;$('song-select').value='set';$('song-reselect').hidden=true;return;
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
async function setPlayerCount(count){state.players=count;$('players').value=String(count);resetTracking();if(landmarker){starting=true;updateControls();try{await landmarker.setOptions({numPoses:state.players});}catch{stopCamera();notice('인원 설정을 바꾸지 못했어요. 카메라를 다시 켜 주세요.');}finally{starting=false;}}updateControls();}
$('players').onchange=()=>setPlayerCount(Number($('players').value));
$('stretch-profile').onchange=()=>{if(active()||starting||songLoading)return;state.profile=$('stretch-profile').value;selectMode('stretch');};

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
    notice(state.mode==='stretch'?`카메라 준비 완료. ${profile().description}. 전신이 보이게 준비하세요.`:'카메라 준비 완료. 화면에 어깨·골반·두 손이 보이면 플레이를 시작하세요.');
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
  if(!state.input||active()||songLoading||starting)return;
  const ticket=++gameGeneration;state.phase='preparing';updateControls();
  state.scores=[createScore(),createScore()];state.stretch=[{sum:0,samples:0,hold:0},{sum:0,samples:0,hold:0}];state.matches=[null,null];
  state.chart=generateShowChart({bpm:track.bpm,duration:track.duration});rhythmAudio.setChart(state.chart);state.gestures.forEach(g=>g.reset());lastStretchTime=null;state.flash=[null,null];
  segmentIndex=0;audio.src=selectedAudio();audio.currentTime=0;updateSong();
  // Invoke both privileged APIs synchronously inside the trusted Play click.
  const playRequest=audio.play();rhythmAudio.unlock();const screenRequest=fullscreen.request();
  try{await playRequest;if(ticket!==gameGeneration||state.phase!=='preparing')return;audio.pause();audio.currentTime=0;await screenRequest;if(ticket!==gameGeneration||state.phase!=='preparing')return;}
  catch(error){if(ticket===gameGeneration){fullscreen.exit();rhythmAudio.stop();state.phase='idle';updateControls();notice(error.name==='NotAllowedError'?'소리 재생을 허용하려면 플레이 시작 버튼을 직접 눌러 주세요.':'음악 파일을 열지 못했어요. audio/maru-flow.ogg 파일을 확인하고 다시 시작해 주세요.');}return;}
  state.phase='countdown';state.countdownAt=performance.now();lastVoiceKey='';speak(state.mode==='rhythm'?'start':'ready');$('countdown').hidden=false;updateControls();notice('3초 뒤 시작합니다. 편안하게 준비해 주세요.');
}
function pauseGame(){
  fullscreen.cancelPending();rhythmAudio.stop();stopVoice();
  if(state.phase==='playing'){audio.pause();state.phase='paused';speak('pause');notice('잠시 쉬어 가세요. 계속하기를 누르면 이어집니다.');}
  else if(state.phase==='transition'){gameGeneration++;audio.pause();state.phase='paused';notice('곡 사이에서 잠시 멈췄어요. 계속하기로 이어갑니다.');}
  else if(['countdown','preparing','starting','resuming'].includes(state.phase)){gameGeneration++;audio.pause();state.phase='idle';$('countdown').hidden=true;}
  resetTracking();updateControls();
}
async function resumeGame(){
  if(state.phase!=='paused')return;
  if(state.input==='camera'&&!stream){notice('카메라를 먼저 다시 켜 주세요.');return;}
  const ticket=++gameGeneration;state.phase='resuming';stopVoice();rhythmAudio.unlock();rhythmAudio.stop();updateControls();
  const playRequest=audio.play();const screenRequest=fullscreen.request();
  try{await playRequest;await screenRequest;if(ticket!==gameGeneration||state.phase!=='resuming')return;state.phase='playing';lastStretchTime=null;state.gestures.forEach(g=>g.reset());notice('다시 시작해요. 내 속도에 맞춰 움직이세요.');}
  catch{if(ticket===gameGeneration){fullscreen.exit();rhythmAudio.stop();state.phase='paused';notice('음악 재생을 다시 허용해 주세요. 계속하기 버튼을 한 번 더 누르세요.');}}
  updateControls();
}
$('play').onclick=beginGame;$('pause').onclick=()=>state.phase==='paused'?resumeGame():pauseGame();
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseGame();});
window.addEventListener('pagehide',()=>{stream?.getTracks().forEach(t=>t.stop());audio.pause();rhythmAudio.stop();stopVoice();});
audio.addEventListener('ended',()=>{if(state.phase==='playing'&&audio.ended){if(state.mode==='stretch'&&segmentIndex<2)advanceSegment();else finishGame();}});
audio.addEventListener('waiting',()=>{if(state.phase==='playing')notice('음악을 읽는 중입니다. 파일 읽기가 끝나면 이어집니다.');});
audio.addEventListener('playing',()=>{if(state.phase==='playing')notice(state.mode==='rhythm'?'소리와 방향을 듣고 같은 박자에 손으로 답해요.':'마루의 동작을 편안한 범위에서 따라 해요.');});
audio.addEventListener('error',()=>{if(active())pauseGame();notice('음악 파일을 읽을 수 없어요. 설치 폴더의 음악 파일을 확인해 주세요.');});

function hit(player,lane,now=performance.now()){
  if(state.phase!=='playing'||state.mode!=='rhythm'||player>=state.players)return;
  const result=judgeHit(state.chart,state.scores[player],lane,audio.currentTime-config().offset);
  state.flash[player]={lane,until:now+230,hit:!!result};
  if(result)rhythmAudio.tone(lane,'hit',0,musicVolume());
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
  audio.pause();rhythmAudio.stop();state.phase='results';fullscreen.exit();speak('finish');$('countdown').hidden=true;
  state.lastResult={version:'0.3.0',timestamp:new Date().toISOString(),mode:state.mode,profile:state.mode==='stretch'?state.profile:null,input:state.input,duration:Math.min(sessionTime(),sessionDuration()),players:state.players,track:state.mode==='stretch'?profile().name:track.title,elimination:false,results:Array.from({length:state.players},(_,i)=>state.mode==='rhythm'?{matched:state.scores[i].hits.size,total:state.chart.length}: {similarity:state.stretch[i].samples?Math.round(state.stretch[i].sum/state.stretch[i].samples):null,matchedSeconds:Math.round(state.stretch[i].hold),observedFrames:state.stretch[i].samples})};
  $('result-dialog').querySelector('h2').textContent=state.mode==='stretch'?'한 세트의 안내를 마쳤어요.':'한 곡을 마쳤어요.';
  $('result-subtitle').textContent=state.mode==='stretch'?`${profile().name} · 3분 45초 안내 완료. 동작 수행 여부나 운동 효과를 자동 확인한 것은 아니에요.`:`${track.title} · ${clock(track.duration)} · 편안하게 마무리하세요.`;
  $('result-cards').replaceChildren();
  state.lastResult.results.forEach((r,i)=>{
    const card=document.createElement('div');card.className='result-card';
    const title=document.createElement('h3');title.textContent=`PLAYER ${i+1}`;
    const points=document.createElement('strong');points.textContent=state.mode==='rhythm'?`${r.matched} / ${r.total}`:r.similarity===null?'—':`${r.similarity}%`;
    const label=document.createElement('span');label.textContent=state.mode==='rhythm'?'일치한 박자':state.profile==='floor'?'시간·음성 안내':'관측된 팔·몸통 자세의 평균 유사도';
    const detail=document.createElement('p');detail.textContent=state.mode==='rhythm'?'놓친 박자는 신경 쓰지 않아도 괜찮아요.':r.similarity===null?(state.profile==='floor'?'누운 동작에는 카메라 점수를 매기지 않아요.':'관측된 비교 동작이 없어 기록하지 않았어요.'):`편안하게 따라 한 시간 ${r.matchedSeconds}초`;
    card.append(title,points,label,detail);$('result-cards').append(card);
  });
  $('result-dialog').showModal();updateControls();notice('완주했어요! 기록을 저장하거나 다시 즐겨 보세요.');
}
function resetSession(){fullscreen.exit();rhythmAudio.stop();audio.pause();segmentIndex=0;audio.src=selectedAudio();audio.currentTime=0;stopVoice();lastVoiceKey='';state.phase='idle';state.scores=[createScore(),createScore()];state.stretch=[{sum:0,samples:0,hold:0},{sum:0,samples:0,hold:0}];state.flash=[null,null];resetTracking();updateSong();updateControls();}
$('retry').onclick=()=>{$('result-dialog').close();resetSession();};
$('stop-session').onclick=()=>{gameGeneration++;resetSession();notice('진행을 마쳤어요. 다른 모드나 노래를 고를 수 있습니다.');};
$('result-dialog').addEventListener('cancel',resetSession);
$('export-result').onclick=()=>{
  if(!state.lastResult)return;
  const link=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(state.lastResult,null,2)],{type:'application/json'}));
  link.href=url;link.download=`eolmaru-${state.mode}-${Date.now()}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};

function infer(now){
  if(starting||!stream||!landmarker)return;
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
      const exercise=currentExercise();
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
function drawRobot(context,pose,x,y,w,h,color=COLORS[0]){
  const pos=i=>({x:x+pose[i].x*w,y:y+pose[i].y*h});
  const unit=Math.min(w,h);
  context.save();context.lineCap='round';context.lineJoin='round';
  for(const [a,b] of CONNECT){const pa=pos(a),pb=pos(b);context.lineWidth=unit*.045;context.strokeStyle='#263b4b';context.beginPath();context.moveTo(pa.x,pa.y);context.lineTo(pb.x,pb.y);context.stroke();context.lineWidth=unit*.018;context.strokeStyle=color;context.stroke();}
  context.beginPath();[11,12,24,23].forEach((id,i)=>{const p=pos(id);i?context.lineTo(p.x,p.y):context.moveTo(p.x,p.y);});context.closePath();context.fillStyle=color;context.fill();context.strokeStyle=color;context.lineWidth=unit*.05;context.stroke();
  const head=pos(0),hw=unit*.29,l=pos(11),r=pos(12),hipL=pos(23),hipR=pos(24);
  const rotation=Math.atan2((l.y+r.y-hipL.y-hipR.y)/2,(l.x+r.x-hipL.x-hipR.x)/2)+Math.PI/2;
  context.save();context.translate(head.x,head.y);context.rotate(rotation);
  rounded(context,-hw*.5,-hw*.4,hw,hw*.8,hw*.35,color,'#37626a');
  context.fillStyle='#d9f8df90';context.beginPath();context.ellipse(-hw*.23,-hw*.22,hw*.12,hw*.045,-.5,0,Math.PI*2);context.fill();
  rounded(context,-hw*.38,-hw*.26,hw*.76,hw*.55,hw*.2,'#f7f1d9');
  for(const side of [-1,1]){context.fillStyle='#293642';context.beginPath();context.ellipse(side*hw*.18,0,hw*.045,hw*.072,0,0,Math.PI*2);context.fill();}
  context.strokeStyle='#567269';context.lineWidth=hw*.025;context.beginPath();context.arc(0,hw*.02,hw*.10,.2,Math.PI-.2);context.stroke();
  for(const side of [-1,1]){context.fillStyle='#ecb2a28a';context.beginPath();context.ellipse(side*hw*.27,hw*.08,hw*.07,hw*.035,0,0,Math.PI*2);context.fill();}
  context.strokeStyle=color;context.lineWidth=2;context.beginPath();context.moveTo(0,-hw*.4);context.lineTo(0,-hw*.59);context.stroke();
  context.fillStyle=color;context.beginPath();context.ellipse(hw*.05,-hw*.64,hw*.10,hw*.05,-.5,0,Math.PI*2);context.fill();context.restore();
  for(const id of [15,16]){const p=pos(id);context.beginPath();context.arc(p.x,p.y,unit*.034,0,Math.PI*2);context.fillStyle='#f1ad9c';context.fill();}
  for(const id of [27,28]){const p=pos(id);context.save();context.translate(p.x,p.y);context.rotate(pose[id].footAngle||0);rounded(context,-unit*.043,-unit*.02,unit*.10,unit*.042,unit*.015,'#f4edda');context.restore();}
  context.restore();
}
function drawStage(now){
  const {w,h}=resize(stage,ctx);ctx.clearRect(0,0,w,h);
  const common={drawRobot,reduced:reducedMotion.matches,time:state.phase==='idle'?0:sessionTime()};
  if(state.phase==='idle'){
    drawWelcome(ctx,w,h,{...common,stretch:state.mode==='stretch',profile:state.profile,pose:routinePose(currentExercise(),state.profile)});return;
  }
  if(state.mode==='rhythm')drawRhythmShow(ctx,w,h,{...common,state,time:audio.currentTime-config().offset,bpm:track.bpm,duration:track.duration,now});
  else drawStretchWorld(ctx,w,h,{...common,item:currentExercise(),steps:profile().steps,profile:state.profile,pose:routinePose(currentExercise(),state.profile)});
  if(state.phase==='paused'){ctx.fillStyle='#182c45a6';ctx.fillRect(0,0,w,h);text(ctx,'잠시 쉬어 가요',w/2,h/2,w<450?20:34,'#fff3d0','center');text(ctx,'왼쪽 계속하기로 다시 시작해요',w/2,h/2+32,w<450?10:13,'#d1e9dc','center');}
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
    $(`p${n}-detail`).textContent=state.mode==='rhythm'?'박자 일치':state.profile==='floor'?'시간·음성 안내':`일치 ${Math.floor(state.stretch[i].hold)}초`;
    $(`p${n}-status`).textContent=state.mode==='rhythm'?'내 속도로 움직여요':!currentExercise().match?'시간 안내 · 편안하게 따라 해요':state.matches[i]===null?'자세를 보여 주세요':'게임용 자세 유사도';
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
    if(left<=0){const ticket=gameGeneration;state.phase='starting';updateControls();$('countdown').hidden=true;audio.play().then(()=>{if(ticket!==gameGeneration||state.phase!=='starting')return;if(document.hidden){pauseGame();return;}state.phase='playing';updateControls();notice(state.mode==='rhythm'?'먼저 소리와 방향을 듣고, 이제 손으로 답해요 구간에 같은 박자로 움직여요.':'위쪽 마루의 움직임을 편안하게 따라 하세요. 중간중간 쉬어 갑니다.');}).catch(()=>{if(ticket===gameGeneration){state.phase='idle';updateControls();notice('재생이 멈췄어요. 플레이 시작을 다시 눌러 주세요.');}});}
  }
  if(!document.hidden)infer(now);
  if(state.phase==='playing'){
    if(state.mode==='stretch')audio.volume=musicVolume()*(coach.paused?1:.35)*Math.min(clamp(audio.currentTime/.4),clamp((75-audio.currentTime)/.4));
    if(state.mode==='stretch'){const item=currentExercise(),key=`${state.profile}:${item.index}`;if(key!==lastVoiceKey){lastVoiceKey=key;speak(item.voice);}}
    else if(lastVoiceKey!=='rhythm-start'){lastVoiceKey='rhythm-start';}
    if(state.mode==='rhythm')rhythmAudio.tick(audio.currentTime-config().offset,musicVolume());
    if(state.mode==='rhythm')for(let i=0;i<state.players;i++)expireNotes(state.chart,state.scores[i],audio.currentTime-config().offset);
    if(state.mode==='stretch'&&audio.currentTime>=75){if(segmentIndex<2)advanceSegment();else finishGame();}
    else if(state.mode==='rhythm'&&audio.currentTime>=track.duration)finishGame();
  }
  drawStage(now);drawCamera();
  if(now-lastUI>100){lastUI=now;updateScores();}
}
selectMode('stretch');updateControls();requestAnimationFrame(frame);
