import {SaberGame} from './saber-game.mjs';
import {TutorialProgress,TUTORIAL_STEPS,TUTORIAL_LOOP,tutorialChart} from './tutorial-core.mjs';

export function createTutorial({stage,audio,players,input,latency,range,quality,dance,volume,onHit,onStop,onSoundReady,onNotice,onExit}){
  const $=id=>document.getElementById(id),model=new TutorialProgress(players());
  let active=false,phase='idle',generation=0,cycle=0,lastPaint=0,missing=false;
  const game=new SaberGame({stage,audio,phase:()=>phase,players:()=>model.players,input:()=>active?input():null,latency,range,quality,dance,
    trainingSettings:()=>({approachSpeed:.8,spacingBeats:2}),notice:onNotice,onReset:onStop,
    onCalibration:flags=>{model.calibrated(flags);paint();},
    onHit:event=>{if(active&&phase==='playing'){model.hit(event,cycle);onHit(event);}}});
  const stop=()=>{generation++;audio.pause();phase='idle';game.calibrationTask=null;game.resetInput();onStop();};
  function prepareStep(){stop();audio.currentTime=0;cycle=0;game.setChart(tutorialChart(model.step.id));game.start();paint();}
  function enter(){active=true;model.reset(players());audio.src='/audio/maru-flow.ogg';prepareStep();onNotice('튜토리얼이에요. 카메라를 켜거나 마우스·키보드 체험을 선택하세요.');}
  function leave(){stop();active=false;audio.removeAttribute('src');audio.load();game.forgetCamera();}
  function reset(){if(!active)return;model.reset(players());prepareStep();onNotice('인원 또는 입력이 바뀌어 첫 위치부터 다시 준비해요.');}
  function pause(message='잠시 멈췄어요. 연습 계속하기를 눌러요.'){
    if(!active)return;
    const wasPlaying=['playing','starting','resuming'].includes(phase);
    generation++;audio.pause();phase=wasPlaying||phase==='paused'?'paused':'idle';
    if(game.calibrationTask){game.calibrationTask=null;model.calibrated([]);}
    game.resetInput();onStop();paint();if(wasPlaying)onNotice(message);
  }
  async function play(){
    if(!active||!model.step.practice||!input()||document.hidden||['playing','starting','resuming'].includes(phase))return;
    const resume=phase==='paused',ticket=++generation;
    if(!resume){audio.currentTime=0;game.start();cycle++;}
    phase=resume?'resuming':'starting';paint();
    // Prime playback in the trusted click, then freeze its clock until fullscreen is ready.
    const startTime=audio.currentTime;
    try{const ready=Promise.resolve(onSoundReady()),request=audio.play();await request;if(ticket!==generation||!active)return;audio.pause();audio.currentTime=startTime;await ready;if(ticket!==generation||!active)return;if(document.hidden){pause();return;}await audio.play();if(ticket!==generation||!active)return;phase='playing';game.resetInput();paint();}
    catch{if(ticket===generation&&active){audio.pause();phase='paused';paint();onNotice('연습 시작 버튼을 다시 눌러 소리를 허용해 주세요.');}}
  }
  async function loop(){
    if(phase!=='playing')return;
    const ticket=++generation;phase='starting';audio.pause();audio.currentTime=0;game.start();cycle++;
    try{await audio.play();if(ticket!==generation||!active)return;if(document.hidden){pause();return;}phase='playing';game.resetInput();}
    catch{if(ticket===generation){phase='paused';onNotice('반복 연습이 멈췄어요. 연습 계속하기를 눌러요.');}}
    paint();
  }
  function next(skip=false){
    if(!active)return;
    if(model.step.id==='finish'){const calibrated=game.calibrations.map(c=>c?{...c}:null);onExit(calibrated);return;}
    if(model.next(input(),{skip})){prepareStep();onNotice(model.step.hint);}
  }
  $('tutorial-next').onclick=()=>next();$('tutorial-skip').onclick=()=>next(true);
  $('tutorial-back').onclick=()=>{if(active&&model.back())prepareStep();};
  $('tutorial-retry').onclick=()=>{if(active){model.retry();prepareStep();}};
  $('tutorial-exit').onclick=()=>{if(active)onExit(null);};
  $('tutorial-action').onclick=()=>{
    if(!active)return;
    if(model.step.id==='range'&&input()==='camera'){
      if(game.calibrationTask)return;model.calibrated([]);game.beginCalibration();paint();
    }else if(model.step.practice){phase==='playing'?pause():void play();}
  };
  $('tutorial-player').onchange=()=>{game.select(Number($('tutorial-player').value),game.selected.hand);paint();};
  $('tutorial-hand').onchange=()=>{game.select(game.selected.player,$('tutorial-hand').value);paint();};
  audio.addEventListener('timeupdate',()=>{if(active&&phase==='playing'&&audio.currentTime>=TUTORIAL_LOOP)void loop();});
  audio.addEventListener('ended',()=>{if(active&&phase==='playing'&&audio.ended)void loop();});
  audio.addEventListener('error',()=>{if(active){pause();onNotice('튜토리얼 음악을 읽지 못했어요. 설치 폴더의 Maru Flow를 확인해 주세요.');}});
  function detail(p){
    const id=model.step.id,keyboard=input()==='keyboard';
    if(id==='position')return keyboard?'시험 위치 · 카메라 확인 아님':input()==='camera'?`${model.positionReasons[p]} · ${Math.round(model.holds[p]*100)}%`:'카메라 또는 시험 입력을 선택해요';
    if(id==='range')return keyboard?'시험 입력 · 실제 손 범위 보정 생략':model.range[p]?'손 범위 확인 완료':game.calibrationTask?'편하게 위·아래·좌·우로 움직여요':'범위 맞추기를 기다려요';
    const marks=model.marks[p];
    if(id==='hands')return `${marks.has('left')?'✓':'○'} 왼손 L   ${marks.has('right')?'✓':'○'} 오른손 R`;
    if(id==='directions')return [['down','↓'],['up','↑'],['left','←'],['right','→']].map(([d,g])=>`${marks.has(d)?'✓':'○'}${g}`).join('  ');
    if(id==='timing')return `정타에 가까운 베기 ${marks.size} / 2`;
    if(id==='sustain')return `계속 베기 ${marks.size} / 1`;
    const report=model.report(),skipped=report.filter(r=>r.players[p]==='skipped').length;
    return `확인 ${report.length-skipped}단계 · 건너뜀 ${skipped}단계${report.some(r=>r.players[p]==='test')?' · 시험 입력 포함':''}`;
  }
  function paint(){
    if(!active)return;
    const step=model.step,ready=model.ready(input()),busy=['starting','resuming'].includes(phase);
    $('tutorial-panel').dataset.step=step.id;$('tutorial-panel').dataset.phase=phase;
    $('tutorial-step').textContent=`${model.index+1} / ${TUTORIAL_STEPS.length} · 처음부터 함께`;
    $('tutorial-title').textContent=step.title;$('tutorial-description').textContent=step.text;$('tutorial-hint').textContent=step.hint;
    $('tutorial-progress').replaceChildren(...Array.from({length:model.players},(_,p)=>{const row=document.createElement('p');row.textContent=`P${p+1} · ${detail(p)}`;row.className=model.playerReady(p,input())?'ready':'';return row;}));
    const action=$('tutorial-action');action.hidden=!step.practice&&!(step.id==='range'&&input()==='camera');action.disabled=!input()||busy||!!game.calibrationTask;
    action.textContent=step.id==='range'?game.calibrationTask?`범위 기록 중 · ${Math.max(1,Math.ceil((game.calibrationTask.until-performance.now())/1000))}초`:'내 손 범위 맞추기 · 5초':phase==='playing'?'연습 일시정지':phase==='paused'?'연습 계속하기':'▶ 반복 연습 시작';
    $('tutorial-next').disabled=!ready||!!game.calibrationTask||busy;
    $('tutorial-next').textContent=step.id==='finish'?'♫ 한 곡 고르러 가기':['position','range'].includes(step.id)&&input()==='keyboard'?'카메라 확인 없이 시험으로 다음':'확인했어요 · 다음';
    $('tutorial-skip').hidden=step.id==='finish';$('tutorial-skip').disabled=busy;
    $('tutorial-back').disabled=model.index===0;$('tutorial-test-controls').hidden=input()!=='keyboard'||!step.practice;
    $('tutorial-player').value=String(game.selected.player);$('tutorial-player').querySelector('[value="1"]').disabled=players()!==2;$('tutorial-hand').value=game.selected.hand;
    $('stage-subtitle').textContent=`${model.index+1}/${TUTORIAL_STEPS.length} · ${step.title}`;
    $('song-title').textContent=step.practice?'Maru Flow · 짧은 반복 연습':'처음부터 배우기';$('song-source').textContent='TUTORIAL';$('song-description').textContent=step.practice?'112 BPM · 약 17초 반복 · 성공한 연습은 유지돼요':'내 노래와 채보는 그대로 보관돼요';
    $('progress').max=TUTORIAL_STEPS.length;$('progress').value=model.index;
    $('session-clock').textContent=`${model.index+1} / ${TUTORIAL_STEPS.length} 단계`;
    for(let p=0;p<model.players;p++){$(`p${p+1}-points`).textContent=model.playerReady(p,input())?'✓':'…';$(`p${p+1}-status`).textContent=detail(p);$(`p${p+1}-detail`).textContent=input()==='keyboard'?'마우스 체험 · 카메라 미확인':'튜토리얼 연습';}
  }
  function camera(poses,aspect,now,capturedAudioTime=audio.currentTime){
    const slots=game.camera(poses,aspect,now,capturedAudioTime);missing=false;model.placement(slots,now);
    if(phase==='playing'&&slots.some(p=>!p))pause('자리 인식이 끊겨 연습을 멈췄어요. 다시 자리 잡고 계속하세요.');
    return slots;
  }
  function lostTracking(){
    if(!active||input()!=='camera'||missing)return;missing=true;game.forgetCamera();model.losePosition();pause('카메라가 멈춰 연습도 잠시 멈췄어요.');
  }
  function tick(now){
    if(!active)return;
    audio.volume=volume();
    if(document.hidden){if(['playing','starting','resuming'].includes(phase)||game.calibrationTask)pause();return;}
    game.tick(now);
    if(phase==='playing'&&model.ready(input())){pause();onNotice('모두 이 연습을 마쳤어요. 다음 단계로 가거나 다시 연습할 수 있어요.');}
    else if(phase==='playing'&&audio.currentTime>=TUTORIAL_LOOP)void loop();
    if(now-lastPaint>150){lastPaint=now;paint();}
  }
  function draw(c,w,h,{reduced=false}={}){
    if(model.step.practice){game.draw(c,w,h,{reduced});return;}
    c.save();c.fillStyle='#101c31';c.fillRect(0,0,w,h);c.textAlign='center';c.textBaseline='middle';
    for(let p=0;p<players();p++){
      const section=w/players(),cx=section*(p+.5),unit=Math.min(section*.27,h*.33),cy=h*.50,ready=model.playerReady(p,input());
      c.strokeStyle=ready?'#8be6c5':'#7f92be';c.lineWidth=2;c.setLineDash([7,6]);c.strokeRect(cx-unit,cy-unit,unit*2,unit*1.65);c.setLineDash([]);
      c.lineCap='round';c.lineWidth=unit*.075;c.strokeStyle='#b6c9dd';c.beginPath();c.arc(cx,cy-unit*.63,unit*.18,0,Math.PI*2);c.stroke();
      const paths=[[-.45,-.18,.45,-.18],[0,-.40,0,.45],[-.45,-.18,-.70,.10],[.45,-.18,.70,.10],[0,.45,-.4,.8],[0,.45,.4,.8]];
      for(const [x1,y1,x2,y2] of paths){c.beginPath();c.moveTo(cx+x1*unit,cy+y1*unit);c.lineTo(cx+x2*unit,cy+y2*unit);c.stroke();}
      for(const [side,color,label] of [[-1,'#ff7295','L'],[1,'#64d7ff','R']]){c.fillStyle=color;c.beginPath();c.arc(cx+side*unit*.7,cy+unit*.1,unit*.13,0,Math.PI*2);c.fill();c.font=`bold ${Math.max(10,unit*.14)}px sans-serif`;c.fillStyle='#13253a';c.fillText(label,cx+side*unit*.7,cy+unit*.1);}
      c.font=`bold ${Math.max(12,Math.min(22,section*.045))}px "Malgun Gothic",sans-serif`;c.fillStyle=ready?'#a1f1d6':'#e8f1ff';c.fillText(`P${p+1} · ${players()===1?'가운데 자리':p===0?'왼쪽 자리':'오른쪽 자리'}`,cx,h*.12);
      c.font=`${Math.max(10,Math.min(14,section*.029))}px "Malgun Gothic",sans-serif`;c.fillStyle='#c2d5e9';c.fillText(model.step.id==='finish'?'준비되면 한 곡을 골라요':input()==='keyboard'?'마우스·키보드 체험 · 카메라 확인 아님':model.step.id==='range'?'몸통은 제자리 · 손만 편한 범위로':'어깨 · 골반 · 두 손을 화면 안으로',cx,h*.9);
    }
    c.restore();
  }
  function drawCameraGuide(c,ox,oy,w,h){
    if(!active||model.step.id!=='position')return;
    c.save();c.lineWidth=2;c.setLineDash([7,5]);
    for(let p=0;p<players();p++){const [a,b]=players()===1?[.2,.8]:p===0?[.1,.43]:[.57,.9];c.strokeStyle=model.holds[p]>=1?'#91e8c6':'#d7dfea';c.strokeRect(ox+w*a,oy+h*.08,w*(b-a),h*.86);}
    c.restore();
  }
  return {enter,leave,reset,pause,tick,draw,paint,camera,lostTracking,drawCameraGuide,key:(e,down)=>active&&game.key(e,down),toggle:()=>phase==='playing'?pause():void play(),get active(){return active;},get phase(){return phase;},get clock(){return audio.currentTime;}};
}
