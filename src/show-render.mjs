import {ARROWS,clamp,targetPose} from './core.mjs';
import {ACTS,showMoment} from './show.mjs';
const INK='#314556',CREAM='#fff5d8',PLAYER=['#76cbb1','#b99bcc'];
const round=(c,x,y,w,h,r,fill,stroke)=>{c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=2;c.stroke();}};
const label=(c,s,x,y,size=14,color=INK,align='left',weight=600)=>{c.font=`${weight} ${size}px "Segoe UI","Malgun Gothic",sans-serif`;c.textAlign=align;c.fillStyle=color;c.fillText(s,x,y);};
function star(c,x,y,r,color,rotation=0){c.save();c.translate(x,y);c.rotate(rotation);c.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,d=i%2?r*.45:r;i?c.lineTo(Math.cos(a)*d,Math.sin(a)*d):c.moveTo(Math.cos(a)*d,Math.sin(a)*d);}c.closePath();c.fillStyle=color;c.fill();c.restore();}
function cloud(c,x,y,w,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,w*.5,w*.13,0,0,Math.PI*2);c.ellipse(x-w*.20,y-w*.05,w*.21,w*.17,0,0,Math.PI*2);c.ellipse(x+w*.07,y-w*.09,w*.25,w*.22,0,0,Math.PI*2);c.ellipse(x+w*.29,y,w*.17,w*.12,0,0,Math.PI*2);c.fill();}
function flower(c,x,y,r,color,rotation=0){c.save();c.translate(x,y);c.rotate(rotation);for(let i=0;i<5;i++){c.rotate(Math.PI*2/5);c.beginPath();c.ellipse(0,-r*.7,r*.43,r*.7,0,0,Math.PI*2);c.fillStyle=color;c.fill();}c.beginPath();c.arc(0,0,r*.38,0,Math.PI*2);c.fillStyle='#ffdf81';c.fill();c.restore();}
function parcel(c,x,y,r,color=CREAM){round(c,x-r,y-r*.7,r*2,r*1.4,r*.15,color,INK);c.strokeStyle='#db9e75';c.lineWidth=r*.18;c.beginPath();c.moveTo(x,y-r*.65);c.lineTo(x,y+r*.65);c.stroke();star(c,x,y,r*.36,'#d88c5c');}
export function drawWorld(c,w,h,act=0,time=0,reduced=false){
  const theme=ACTS[act],t=reduced?0:time,g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,theme.colors[0]);g.addColorStop(1,theme.colors[1]);c.fillStyle=g;c.fillRect(0,0,w,h);
  // Fixed-size decorative loops, no accumulating particles or per-frame asset requests.
  const orbX=w*.82,orbY=h*.22;c.globalAlpha=.7;c.beginPath();c.arc(orbX,orbY,Math.min(w,h)*.13,0,Math.PI*2);c.fillStyle=act===2?'#fff0c2':'#fff5d2';c.fill();c.globalAlpha=1;
  if(act===0){
    c.save();c.globalAlpha=.35;c.lineWidth=Math.min(w,h)*.025;['#f6bd9c','#f6d393','#b0d2bd','#a3c5d9'].forEach((color,i)=>{c.strokeStyle=color;c.beginPath();c.arc(w*.73,h*.62,Math.min(w,h)*(.65-i*.027),Math.PI*1.05,Math.PI*1.93);c.stroke();});c.restore();
  }
  for(let i=0;i<6;i++){const x=((i*.219*w+t*(act===1?5:2))%(w+180))-70;cloud(c,x,h*(.15+(i%3)*.13),80+(i%3)*45,act===2?'#8995be44':'#fffcf2a0');}
  c.fillStyle=theme.colors[2];c.beginPath();c.moveTo(0,h*.88);c.bezierCurveTo(w*.23,h*.68,w*.45,h*.95,w*.68,h*.77);c.bezierCurveTo(w*.85,h*.63,w,h*.84,w,h*.81);c.lineTo(w,h);c.lineTo(0,h);c.fill();
  c.fillStyle=act===2?'#375779':'#438f8030';c.beginPath();c.moveTo(0,h*.96);c.quadraticCurveTo(w*.5,h*.73,w,h*.96);c.lineTo(w,h);c.lineTo(0,h);c.fill();
  for(let i=0;i<10;i++){const x=(i*.109+.03)*w,y=h*(.14+(i%4)*.12);if(act===2)star(c,x,y,3+(i%3)*2,'#fae5a4',t*.08+i);else{c.beginPath();c.arc(x,y,2+(i%2),0,Math.PI*2);c.fillStyle='#fff8daaa';c.fill();}}
  for(let i=0;i<7;i++){const x=(i+.4)/7*w,y=h*(.91+(i%2)*.05);if(act===0)star(c,x,y,6,'#efd792',i);else if(act===1)cloud(c,x,y,35,'#f3e7ed80');else flower(c,x,y,8+i%3*2,['#e8b3be','#b8cfd6','#c8b6e7'][i%3],t*.08);}
}
function poseForLane(lane){const p=targetPose('rest');if(lane==='up'){p[13]={x:.25,y:.2};p[15]={x:.22,y:.06};}if(lane==='left'){p[13]={x:.24,y:.34};p[15]={x:.06,y:.31};}if(lane==='right'){p[14]={x:.76,y:.34};p[16]={x:.94,y:.31};}if(lane==='down'){p[14]={x:.72,y:.58};p[16]={x:.76,y:.83};}return p;}
function particles(c,x,y,age,color,reduced){
  if(age<0||age>1)return;
  for(let j=0;j<(reduced?5:15);j++){const a=j*2.4,r=age*(35+j%4*14),px=x+Math.cos(a)*r,py=y+Math.sin(a)*r-age*35;c.globalAlpha=1-age;star(c,px,py,(1-age)*(3+j%3),j%2?color:'#fff8d6',a+age);}
  c.globalAlpha=1;
}
export function drawRhythmShow(c,w,h,{state,time,bpm,duration,now,drawRobot,reduced=false}){
  const moment=showMoment(time,bpm,duration),act=ACTS[moment.act],beatSeconds=60/bpm;
  drawWorld(c,w,h,moment.act,time,reduced);
  const compact=w<550,top=compact?44:56,section=w/state.players;
  round(c,w*.03,12,w*.94,compact?28:34,14,'#fff7e8de');
  label(c,`${moment.act+1} / 3  ${act.name}`,w*.055,compact?31:35,compact?11:16);
  label(c,moment.demonstrating?'♪ 먼저 듣고, 기억해요':'✦ 이제 손으로 답해요',w*.945,compact?31:35,compact?9:12,INK,'right');
  for(let player=0;player<state.players;player++){
    c.save();c.beginPath();c.rect(player*section,top,section,h-top);c.clip();const left=player*section,cx=left+section*.5,color=PLAYER[player],mini=section<380;
    if(player>0){c.strokeStyle='#ffffff55';c.setLineDash([5,8]);c.beginPath();c.moveTo(left,top+10);c.lineTo(left,h-12);c.stroke();c.setLineDash([]);}
    const active=state.phase==='playing',flash=state.flash[player],hitAge=flash?.hit?(now-(flash.until-230))/1000:2;
    const phraseNotes=state.chart.filter(n=>n.phrase===moment.phrase),demo=phraseNotes.find(n=>time>=n.demoTime&&time<n.demoTime+beatSeconds*.65);
    const upcoming=state.chart.find(n=>!state.scores[player].hits.has(n.id)&&!state.scores[player].expired.has(n.id)&&n.time>=time-.30);
    const lane=active&&flash&&now<flash.until?flash.lane:moment.demonstrating&&demo?demo.lane:null;
    const unit=Math.max(36,Math.min(section*.53,h*.61-top,330)),fy=top+Math.max(8,(h*.68-top-unit)/2),hop=!reduced&&hitAge<.45?Math.sin(hitAge/.45*Math.PI)*unit*.10:0;
    c.fillStyle='#315c5a25';c.beginPath();c.ellipse(cx,fy+unit*1.04,unit*.45,unit*.055,0,0,Math.PI*2);c.fill();
    if(moment.act===1){cloud(c,cx,fy+unit*.98,unit*1.08,'#fef6ed');round(c,cx-unit*.42,fy+unit*.75,unit*.84,unit*.24,unit*.09,'#d99cac',INK);c.fillStyle='#ffeccf';c.beginPath();c.ellipse(cx,fy+unit*.75,unit*.42,unit*.08,0,0,Math.PI*2);c.fill();}
    drawRobot(c,poseForLane(lane),cx-unit/2,fy-hop,unit,unit,color);
    if(moment.act===0){parcel(c,cx-unit*.65,fy+unit*.78,unit*.105);parcel(c,cx+unit*.63,fy+unit*.80,unit*.09,'#e8ccf0');}
    if(moment.act===2){flower(c,cx-unit*.60,fy+unit*.87,unit*.11,'#deb0d2',time*.18);flower(c,cx+unit*.60,fy+unit*.88,unit*.10,'#bbdcca',-time*.15);}
    if(hitAge<1){particles(c,cx,fy+unit*.34,hitAge,act.accent,reduced);round(c,cx-unit*.4,fy+unit*.12,unit*.8,25,12,'#fff5dceb');label(c,moment.act===0?'별빛 도착!':moment.act===1?'통, 통!':'꽃이 피었어요',cx,fy+unit*.12+17,mini?10:14,INK,'center');}
    if(upcoming&&active){const delta=upcoming.time-time;if(delta<4*beatSeconds&&delta>-.3){const p=clamp(1-delta/(4*beatSeconds)),r=mini?17:24,ox=cx+Math.cos(p*Math.PI)*unit*.57,oy=Math.max(top+r+4,fy+unit*.05-Math.sin(p*Math.PI)*unit*.12);c.save();c.globalAlpha=.35+.65*p;if(moment.act===0)parcel(c,ox,oy,r*.75);else if(moment.act===1)cloud(c,ox,oy,r*2,CREAM);else star(c,ox,oy,r,CREAM,time);label(c,ARROWS[upcoming.lane],ox,oy+6,r*.85,INK,'center');c.restore();}}
    // Four compact landing pads keep direction and timing explicit under the character scene.
    const laneTop=h*.76,padWidth=Math.min(section*.18,82),start=cx-padWidth*2;
    ['left','up','down','right'].forEach((dir,i)=>{
      const px=start+(i+.5)*padWidth,py=h*.88,l=active&&flash?.lane===dir&&now<flash.until;
      round(c,px-padWidth*.43,py-14,padWidth*.86,28,9,l?'#fff8d8':moment.act===2?'#d8e7e6':'#fff5e6',l?act.accent:'#5a827870');label(c,ARROWS[dir],px,py+8,22,INK,'center');
      for(const n of state.chart){const d=n.time-time;if(n.lane!==dir||d>2.6||d<-.3||state.scores[player].hits.has(n.id)||state.scores[player].expired.has(n.id))continue;const ny=py-d*(py-laneTop)/2.6;star(c,px,ny,mini?8:11,color);}
      if(state.input==='keyboard')label(c,(player===0?['A','W','S','D']:['←','↑','↓','→'])[i],px,py+28,8,moment.act===2?'#f9edcf':'#355e58','center');
    });
    label(c,`P${player+1}`,left+15,top+23,10,moment.act===2?CREAM:INK);
    const signal=moment.demonstrating?(demo?`${ARROWS[demo.lane]}  이 소리를 기억해요`:'들어요 · 다음에 같은 박자'):(upcoming&&upcoming.time-time<beatSeconds*.4?`${ARROWS[upcoming.lane]}  지금!`:'손을 가슴 앞으로 돌아와요');
    label(c,signal,cx,h*.72,mini?9:13,moment.act===2?CREAM:INK,'center');c.restore();
  }
}
export function drawWelcome(c,w,h,{stretch,drawRobot,pose,profile='standing',reduced=false,time=0}){
  drawWorld(c,w,h,stretch?0:1,time,reduced);const floor=stretch&&profile==='floor',pair=stretch&&profile==='couple',size=Math.min(h*.66,w*(pair?.27:.35),340),cy=h*.07;
  if(floor){const fw=Math.min(w*.58,h*1.4);round(c,w/2-fw/2,h*.15,fw,h*.45,25,'#e2ead7','#80aaa0');drawRobot(c,pose,w/2-fw/2,h*.12,fw,h*.48,PLAYER[0]);}
  else{for(let i=0;i<(pair?2:1);i++){const cx=pair?w*(.35+i*.30):w*.5;drawRobot(c,stretch?pose:poseForLane('up'),cx-size/2,cy,size,size,PLAYER[i]);}}
  for(let i=0;i<3;i++){const x=w*(.12+i*.38);star(c,x,h*.35+(i%2)*h*.14,Math.min(15,w*.025),['#f6d18a','#e6aed4','#f6d18a'][i],i);}
}
export function drawStretchWorld(c,w,h,{item,steps,profile,pose,drawRobot,time,reduced=false}){
  drawWorld(c,w,h,0,time,reduced);const compact=w<660,narrow=w<400,tx=narrow?w*.04:compact?w*.46:w*.50,area=narrow?w:w*.45;
  const floor=profile==='floor',pair=profile==='couple',size=Math.min(area/(pair?2.25:1.2),h*(narrow?.34:.74),360),fy=((narrow?h*.43:h)-size)/2-8;
  if(floor){const fw=area*.95,fh=Math.min(h*(narrow?.34:.65),fw*.8),my=h*(narrow?.035:.15);round(c,area*.02,my,fw,fh,22,'#e5e9d5','#8caea4');drawRobot(c,pose,area*.02,my-h*.02,fw,fh,PLAYER[0]);label(c,'누운 자세 · 위에서 본 예시',area/2,narrow?h*.40:h*.80,compact?8:11,'#527575','center');}
  else for(let i=0;i<(pair?2:1);i++){const cx=area*(i+1)/(pair?3:2);c.beginPath();c.ellipse(cx,fy+size, size*.47,size*.055,0,0,Math.PI*2);c.fillStyle='#285d4930';c.fill();drawRobot(c,pose,cx-size/2,fy,size,size,PLAYER[i]);if(pair)label(c,`P${i+1}`,cx,fy-3,11,INK,'center');}
  const cardX=tx,cardW=w-tx-w*.035,cardY=h*(narrow?.44:.11),cardH=h*(narrow?.40:.68);round(c,cardX,cardY,cardW,cardH,20,'#fff8e9e8','#ece0bc');
  const x=cardX+cardW*.08,contentW=cardW*.84;
  label(c,`${item.region}  /  ${item.match?'카메라 일치 확인':'시간·음성 안내'}`,x,cardY+cardH*.14,compact?8:11,'#618178');
  const wrap=(str,y,font,max=3)=>{c.font=`600 ${font}px "Segoe UI","Malgun Gothic",sans-serif`;let line='',rows=[];for(const ch of str){if(c.measureText(line+ch).width>contentW&&line){rows.push(line);line=ch;}else line+=ch;}if(line)rows.push(line);rows.slice(0,max).forEach((r,i)=>label(c,r,x,y+i*font*1.45,font,INK));};
  wrap(item.resting?'천천히 힘을 풀어요':item.title,cardY+cardH*.29,compact?13:Math.min(25,cardW*.062),2);
  wrap(item.cue,cardY+cardH*.51,compact?9:13,narrow?4:3);
  const radius=Math.min(22,cardH*.095);c.beginPath();c.arc(cardX+cardW*.82,cardY+cardH*.84,radius,0,Math.PI*2);c.strokeStyle='#d7e3cf';c.lineWidth=4;c.stroke();c.beginPath();c.arc(cardX+cardW*.82,cardY+cardH*.84,radius,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp(item.remaining/item.seconds));c.strokeStyle='#6eaf98';c.stroke();label(c,String(Math.ceil(item.remaining)),cardX+cardW*.82,cardY+cardH*.84+5,14,INK,'center');
  label(c,`${item.index+1} / ${steps.length} 동작`,x,cardY+cardH*.87,compact?8:11,'#6b8980');
  const timelineY=h*.91,tw=w*.86,ix=w*.07;for(let i=0;i<steps.length;i++)round(c,ix+i*tw/steps.length,timelineY,tw/steps.length-4,5,2,i<=item.index?'#548e77':'#e8efd780');
  label(c,steps[item.index+1]?`다음 · ${steps[item.index+1].title}`:'편안한 호흡으로 마무리',w*.5,h*.87,compact?9:12,'#355e56','center');
}
