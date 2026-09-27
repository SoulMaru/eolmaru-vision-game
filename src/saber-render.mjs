// Original local Canvas artwork. Render coordinates never feed back into hit judgement.
// The bright tip is the observed wrist point; the blade is a decorative representation.
const PALETTE = {
  left: {fill:'#eb4269', dark:'#642a59', edge:'#ff9bb1', glow:'#ff537f', name:'L'},
  right: {fill:'#228adc', dark:'#174784', edge:'#91eaff', glow:'#45ceff', name:'R'},
};
const finite = Number.isFinite;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const font = '"Segoe UI", "Malgun Gothic", sans-serif';
const MAX_NOTES = 48, MAX_EFFECTS = 16, MAX_TRAIL = 20;
export const EFFECT_SECONDS = .85;
const TRAIL_SECONDS = .22;
const GRADE_VISUALS = Object.freeze([
  {key:'good',label:'굳',color:'#a9eacf'},
  {key:'great',label:'그레이트',color:'#71e2ff'},
  {key:'perfect',label:'퍼팩트',color:'#c4a2ff'},
  {key:'excellent',label:'엑셀런트',color:'#ffe28e'},
  {key:'yummy',label:'야미',color:'#ff9edb'},
]);

/** Visual budgets are pure and bounded; no score or tracking result is created here. */
export function effectStyle(grade,{low=false,reduced=false}={}) {
  const known=GRADE_VISUALS.findIndex(g=>g.key===grade?.key);
  const tier=known<0?0:known;
  return {tier,color:GRADE_VISUALS[tier].color,label:known<0?null:GRADE_VISUALS[tier].label,
    particles:reduced?0:low?5+tier:8+tier*5,
    confetti:reduced||low||tier<3?0:4+(tier-3)*4,
    rings:reduced||low?1:1+Math.floor(tier/2),
    afterimages:reduced?0:low?2:6};
}

function validLayout(w, h, players, player) {
  return finite(w) && finite(h) && w > 0 && h > 0 &&
    (players === 1 || players === 2) && Number.isInteger(player) && player >= 0 && player < players;
}

/** Square cells, with a banner above and status below. This is the exact hit plane. */
export function planeRect(w, h, players = 1, player = 0) {
  if (!validLayout(w, h, players, player)) return {x:0,y:0,w:0,h:0,cell:0};
  const section = w / players;
  const top = Math.min(64, h * .17), bottom = Math.min(39, h * .11);
  const cell = Math.max(0, Math.min(section * .87 / 4, (h - top - bottom) / 3));
  return {x:player * section + (section - 4 * cell) / 2,
    y:top + (h - top - bottom - 3 * cell) / 2, w:4 * cell, h:3 * cell, cell};
}

export function stageToGrid(px, py, w, h, players = 1, player = 0) {
  if (!finite(px) || !finite(py)) return null;
  const r = planeRect(w,h,players,player);
  if (!r.cell || px < r.x || py < r.y || px > r.x + r.w || py > r.y + r.h) return null;
  return {x:(px-r.x)/r.cell, y:(py-r.y)/r.cell};
}

export function gridToStage(x, y, w, h, players = 1, player = 0) {
  if (!finite(x) || !finite(y)) return null;
  const r = planeRect(w,h,players,player);
  return r.cell ? {x:r.x+x*r.cell, y:r.y+y*r.cell} : null;
}

function text(c, value, x, y, size=12, color='#daeaff', align='left', weight=600) {
  c.font=`${weight} ${size}px ${font}`;c.textAlign=align;c.textBaseline='alphabetic';
  c.fillStyle=color;c.fillText(value,x,y);
}
function fitText(c, value, x, y, maxWidth, size=12, color='#a9bed7', align='left') {
  c.font=`600 ${size}px ${font}`;
  let s=String(value ?? '');
  if (c.measureText(s).width>maxWidth) {
    while(s.length && c.measureText(`${s}…`).width>maxWidth)s=s.slice(0,-1);
    s+='…';
  }
  text(c,s,x,y,size,color,align);
}
function path(c, points, fill, stroke, width=1) {
  c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();
  if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}
}
function rounded(c,x,y,w,h,r,fill,stroke,width=1) {
  c.beginPath();c.roundRect(x,y,w,h,Math.max(0,r));
  if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}
}
function line(c,x1,y1,x2,y2,color,width=1) {
  c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=width;c.stroke();
}

/** Draw a filled vector arrow, keeping its meaning independent of font glyph support. */
function arrow(c,x,y,size,direction,color='#fff5f6') {
  c.save();c.translate(x,y);c.fillStyle=color;c.strokeStyle=color;
  if(direction==='any') {
    c.beginPath();c.arc(0,0,size*.21,0,Math.PI*2);c.fill();
    c.beginPath();c.arc(0,0,size*.39,0,Math.PI*2);c.lineWidth=Math.max(1,size*.055);c.stroke();
  } else {
    const angles={up:0,right:Math.PI/2,down:Math.PI,left:-Math.PI/2};
    c.rotate(angles[direction] ?? 0);
    path(c,[[0,-size*.48],[size*.4,-size*.06],[size*.16,-size*.06],[size*.16,size*.43],[-size*.16,size*.43],[-size*.16,-size*.06],[-size*.4,-size*.06]],color);
  }
  c.restore();
}

function atmosphere(c,w,h,time,bpm,reduced,low) {
  const bg=c.createLinearGradient(0,0,w,h);
  bg.addColorStop(0,'#070c25');bg.addColorStop(.48,'#151237');bg.addColorStop(1,'#081a31');
  c.fillStyle=bg;c.fillRect(0,0,w,h);
  if(!low) {
    const halo=c.createRadialGradient(w*.5,h*.4,0,w*.5,h*.4,Math.max(w,h)*.58);
    halo.addColorStop(0,'#7657a62c');halo.addColorStop(.5,'#243e6130');halo.addColorStop(1,'#0a142200');
    c.fillStyle=halo;c.fillRect(0,0,w,h);
  }
  // Small, steady stars: fixed count and no full-screen beat flashes.
  const stars=low?12:32;
  for(let i=0;i<stars;i++) {
    const x=((i*73+17)%181)/181*w,y=((i*41+13)%113)/113*h*.78;
    c.globalAlpha=.17+(i%3)*.07;c.fillStyle=i%2?'#70b8e7':'#d7b7f4';
    c.fillRect(x,y,i%7===0?2:1,i%7===0?2:1);
  }
  c.globalAlpha=1;
  const beat=finite(bpm)&&bpm>0 ? time*bpm/60 : 0;
  const pulse=reduced?0:(1+Math.cos(beat*Math.PI*2))*.5;
  line(c,0,h-1,w,h-1,`rgba(84,174,226,${.22+pulse*.12})`,2);
  return pulse;
}

function corridor(c,w,h,r,player,players,pulse,low) {
  const sw=w/players,left=player*sw,cx=r.x+r.w/2,vy=r.y+r.h*.38;
  const far={x:cx-r.w*.12,y:vy-r.h*.09,w:r.w*.24,h:r.h*.18};
  const rails=[[[r.x,r.y],[far.x,far.y]],[[r.x+r.w,r.y],[far.x+far.w,far.y]],
    [[r.x,r.y+r.h],[far.x,far.y+far.h]],[[r.x+r.w,r.y+r.h],[far.x+far.w,far.y+far.h]]];
  // A faceted tunnel and physical deck provide depth without moving the hit plane.
  path(c,[[left,h],[r.x,r.y+r.h],[far.x,far.y+far.h],[cx,vy],[left,h*.15]],'#111a3938');
  path(c,[[left+sw,h],[r.x+r.w,r.y+r.h],[far.x+far.w,far.y+far.h],[cx,vy],[left+sw,h*.15]],'#16224138');
  path(c,[[r.x,r.y+r.h],[r.x+r.w,r.y+r.h],[far.x+far.w,far.y+far.h],[far.x,far.y+far.h]],'#17244180');
  rails.forEach(([[x1,y1],[x2,y2]],i)=>line(c,x1,y1,x2,y2,i%2?'#45aed847':'#9e79d84a',1.3));
  for(let i=1;i<=4;i++) {
    const s=.15+i*i*.034,rx=cx-r.w*s/2,ry=vy+(r.y-vy)*s;
    c.strokeStyle=`rgba(105,145,201,${.04+i*.015})`;c.lineWidth=1;
    c.strokeRect(rx,ry,r.w*s,r.h*s);
  }
  for(let i=0;i<=4;i++)line(c,r.x+i*r.cell,r.y+r.h,far.x+i*far.w/4,far.y+far.h,'#5eaace35',1);
  if(!low) {
    // Sparse side accents stay outside the reachable target plane.
    for(let i=0;i<3;i++) {
      const y=r.y+r.h*(.15+i*.26),length=Math.max(2,Math.min(11,sw*.02));
      line(c,r.x-length-5,y,r.x-5,y+12,'#ba7bdb75',2);
      line(c,r.x+r.w+5,y,r.x+r.w+length+5,y+12,'#65d2e375',2);
    }
  }
  // A dark, restrained interaction pane stays legible behind the bright notes.
  rounded(c,r.x,r.y,r.w,r.h,Math.min(12,r.cell*.13),'#0c153429','#647dac42');
  c.setLineDash([2,6]);
  for(let i=1;i<4;i++)line(c,r.x+i*r.cell,r.y,r.x+i*r.cell,r.y+r.h,'#abc6ff18');
  for(let i=1;i<3;i++)line(c,r.x,r.y+i*r.cell,r.x+r.w,r.y+i*r.cell,'#abc6ff18');
  c.setLineDash([]);
  // Corner brackets identify the exact near plane without a heavy enclosing frame.
  const bracket=Math.max(3,r.cell*.16);
  for(const [x,y,sx,sy] of [[r.x,r.y,1,1],[r.x+r.w,r.y,-1,1],[r.x,r.y+r.h,1,-1],[r.x+r.w,r.y+r.h,-1,-1]]) {
    line(c,x+sx*bracket,y,x,y,`rgba(121,198,226,${.5+pulse*.08})`,2);
    line(c,x,y,x,y+sy*bracket,`rgba(121,198,226,${.5+pulse*.08})`,2);
  }
}

function noteBlock(c,x,y,size,hand,direction,alpha,low,late=false) {
  const p=PALETTE[hand] ?? PALETTE.left;
  c.save();c.globalAlpha=alpha;
  const a=size/2,depth=size*.1;
  path(c,[[x-a,y-a],[x-a+depth,y-a-depth],[x+a+depth,y-a-depth],[x+a,y-a]],p.edge);
  path(c,[[x+a,y-a],[x+a+depth,y-a-depth],[x+a+depth,y+a-depth],[x+a,y+a]],p.dark);
  if(!low){c.shadowColor=p.glow;c.shadowBlur=Math.min(15,size*.16);}
  rounded(c,x-a,y-a,size,size,Math.max(2,size*.085),late?p.dark:p.fill,p.edge,Math.max(1,size*.025));
  c.shadowBlur=0;
  // Arrow and letter use separate zones; the letter remains readable without color.
  arrow(c,x,y+size*.035,size*.58,direction);
  if(size>=24)text(c,p.name,x-a+size*.12,y-a+size*.23,Math.max(7,size*.16),'#fff','left',800);
  line(c,x-a+size*.15,y+a-size*.08,x+a-size*.15,y+a-size*.08,'#ffffff39',Math.max(1,size*.025));
  c.restore();
}

function sustainBlock(c,x,y,size,n,time,low){
  const p=PALETTE[n.hand]??PALETTE.left,active=time>=n.hitTime,progress=clamp(n.sustainProgress??0,0,1);
  c.save();
  if(!low){c.shadowColor=p.glow;c.shadowBlur=Math.min(18,size*.15);}
  rounded(c,x-size/2,y-size/2,size,size,size*.2,active?'#132e49f2':'#182741df',p.edge,Math.max(2,size*.035));c.shadowBlur=0;
  c.strokeStyle=p.glow;c.lineWidth=Math.max(2,size*.035);
  c.beginPath();c.arc(x,y-size*.07,size*.28,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp((time-n.hitTime)/n.durationSeconds,0,1));c.stroke();
  text(c,'∞',x,y+size*.03,size*.40,p.edge,'center',800);
  if(size>32){
    text(c,`${p.name} · 계속 베기`,x,y-size*.33,Math.max(7,size*.11),'#f1fbff','center');
    text(c,`${Math.max(0,active?n.endTime-time:n.durationSeconds).toFixed(1)}초`,x,y+size*.30,Math.max(8,size*.13),'#d6ecff','center');
  }
  rounded(c,x-size*.35,y+size*.39,size*.7,size*.045,size*.02,'#50617c');
  if(progress>0)rounded(c,x-size*.35,y+size*.39,size*.7*Math.min(1,progress/.6),size*.045,size*.02,'#a6ffd7');
  c.restore();
}

function drawNotes(c,r,notes,time,low,leadSeconds) {
  const vx=r.x+r.w*.5,vy=r.y+r.h*.38;
  // Caller supplies active pending notes. Bound the work even for malformed integrations.
  const visible=notes.slice(0,MAX_NOTES).filter(n=>finite(n.hitTime)&&finite(n.lineIndex)&&finite(n.lineLayer)
    &&n.lineIndex>=0&&n.lineIndex<4&&n.lineLayer>=0&&n.lineLayer<3
    &&time>=(finite(n.spawnTime)?n.spawnTime:n.hitTime-1.8)&&time<=(n.endTime??n.hitTime)+.30);
  visible.sort((a,b)=>b.hitTime-a.hitTime);
  for(const n of visible) {
    const delta=n.hitTime-time,scale=1/(1+Math.max(n.kind==='sustain'?0:-.12,delta)*2.4*1.8/leadSeconds);
    const targetX=r.x+(n.lineIndex+.5)*r.cell,targetY=r.y+(n.lineLayer+.5)*r.cell;
    const x=vx+(targetX-vx)*scale,y=vy+(targetY-vy)*scale;
    const late=delta<-.05,alpha=delta<0?clamp(1+delta/.3,.12,1):clamp(.42+scale*.58,.4,1);
    // Exact size at delta=0 is .72 cell, equal to the collision rectangle contract.
    if(n.kind==='sustain')sustainBlock(c,x,y,r.cell*1.1*scale,n,time,low);
    else noteBlock(c,x,y,r.cell*.72*scale,n.hand,n.cutDirection,alpha,low,late);
    if(delta>=0&&delta<.3) {
      c.save();c.globalAlpha=(1-delta/.3)*.38;
      rounded(c,targetX-r.cell*.4,targetY-r.cell*.4,r.cell*.8,r.cell*.8,r.cell*.09,null,PALETTE[n.hand]?.edge??'#fff',1);
      c.restore();
    }
  }
}

function bladeGeometry(x,y,cell,handName) {
  const sx=handName==='left'?-1:1;
  return {x,y,baseX:x+sx*cell*.20,baseY:y+cell*.65,angle:-sx*Math.atan(.20/.65),length:Math.hypot(.20,.65)*cell};
}

function saberShape(c,x,y,cell,handName,{ghost=false,low=false,selected=false}={}) {
  const p=PALETTE[handName],g=bladeGeometry(x,y,cell,handName);
  c.save();c.translate(x,y);c.rotate(g.angle);c.lineCap='round';
  if(ghost) {
    line(c,0,0,0,g.length,p.glow,Math.max(4,cell*.11));
    line(c,0,g.length,0,g.length+cell*.25,p.edge,Math.max(5,cell*.12));
    line(c,-cell*.12,g.length,cell*.12,g.length,p.edge,Math.max(2,cell*.045));
    c.restore();return;
  }
  // Blade tip remains at the observed wrist coordinate; the rest is a stylized prop.
  if(!low){c.shadowColor=p.glow;c.shadowBlur=19;}
  line(c,0,g.length,0,0,p.glow,Math.max(6,cell*.12));
  c.shadowBlur=0;
  line(c,0,g.length,0,0,p.edge,Math.max(3,cell*.069));
  line(c,0,g.length,0,0,'#f4ffff',Math.max(1.6,cell*.028));
  rounded(c,-cell*.064,g.length,cell*.128,cell*.34,cell*.03,'#151d33','#758fa9',1.2);
  for(let i=0;i<4;i++)line(c,-cell*.055,g.length+cell*(.08+i*.055),cell*.055,g.length+cell*(.08+i*.055),'#455974',Math.max(1,cell*.018));
  path(c,[[-cell*.16,g.length-cell*.02],[-cell*.10,g.length+cell*.045],[cell*.10,g.length+cell*.045],[cell*.16,g.length-cell*.02]],p.edge,'#f1fbff',1);

  // A compact original armored glove holds the hilt. It is artwork, not finger tracking.
  const gy=g.length+cell*.16;
  rounded(c,-cell*.17,gy-cell*.075,cell*.34,cell*.245,cell*.075,'#273f54','#92b8c8',Math.max(1,cell*.018));
  rounded(c,-cell*.125,gy-cell*.14,cell*.25,cell*.17,cell*.05,'#b5ccd3','#e6f4f2',Math.max(1,cell*.012));
  for(let i=0;i<3;i++) {
    rounded(c,cell*(-.125+i*.085),gy-cell*.12,cell*.079,cell*.10,cell*.025,'#d6e6e6',null);
    line(c,cell*(-.11+i*.085),gy-cell*.043,cell*(-.068+i*.085),gy-cell*.043,'#718c9d',Math.max(1,cell*.009));
  }
  c.save();c.translate((handName==='left'?-1:1)*cell*.125,gy+cell*.04);c.rotate((handName==='left'?1:-1)*.6);
  rounded(c,-cell*.05,-cell*.08,cell*.11,cell*.17,cell*.047,'#c3d8dc','#6b8eaa',1);c.restore();
  rounded(c,-cell*.13,gy+cell*.105,cell*.26,cell*.09,cell*.025,p.dark,p.edge,1.3);
  line(c,-cell*.075,gy+cell*.145,cell*.075,gy+cell*.145,p.edge,Math.max(1,cell*.022));
  c.restore();
  c.save();
  c.beginPath();c.arc(x,y,Math.max(3,cell*.056),0,Math.PI*2);c.fillStyle='#f0ffff';c.fill();
  c.beginPath();c.arc(x,y,Math.max(7,cell*(selected?.13:.10)),0,Math.PI*2);c.strokeStyle=p.edge;c.lineWidth=selected?2:1;c.stroke();
  const tag=Math.max(9,Math.min(12,cell*.18));
  rounded(c,x+10,y-19,tag*1.6,tag*1.6,4,'#111e39ed',p.edge);
  text(c,p.name,x+10+tag*.8,y-19+tag*1.16,tag,p.edge,'center',800);
  c.restore();
}

function drawHand(c,r,hand,handName,time,selected,low,reduced) {
  if(!hand || !hand.valid || !finite(hand.x) || !finite(hand.y))return;
  // Do not turn an off-plane observation into a false on-plane pointer by clamping it.
  if(hand.x<-.2||hand.x>4.2||hand.y<-.2||hand.y>3.2)return;
  const p=PALETTE[handName],x=r.x+hand.x*r.cell,y=r.y+hand.y*r.cell;
  const trail=Array.isArray(hand.trail)?hand.trail.slice(-MAX_TRAIL):[];
  if(!reduced) {
    const validTrail=[];
    for(let i=1;i<trail.length;i++) {
      const a=trail[i-1],b=trail[i],age=time-b.t;
      if(!finite(a.x)||!finite(a.y)||!finite(b.x)||!finite(b.y)||!finite(age)||age<0||age>TRAIL_SECONDS||b.t<=a.t||b.t-a.t>.2)continue;
      const distance=Math.hypot(b.x-a.x,b.y-a.y);
      if(distance<.018||distance>7)continue;
      const ga=bladeGeometry(r.x+a.x*r.cell,r.y+a.y*r.cell,r.cell,handName);
      const gb=bladeGeometry(r.x+b.x*r.cell,r.y+b.y*r.cell,r.cell,handName);
      c.save();c.globalAlpha=(1-age/TRAIL_SECONDS)*(low?.07:.15);
      // The whole blade sweeps a translucent ribbon, not only its observed tip.
      path(c,[[ga.x,ga.y],[gb.x,gb.y],[gb.baseX,gb.baseY],[ga.baseX,ga.baseY]],p.glow);
      c.globalAlpha=(1-age/TRAIL_SECONDS)*.55;
      line(c,ga.x,ga.y,gb.x,gb.y,p.glow,Math.max(3,r.cell*.135));
      c.globalAlpha=(1-age/TRAIL_SECONDS)*.6;
      line(c,ga.x,ga.y,gb.x,gb.y,p.edge,Math.max(1.5,r.cell*.039));c.restore();
      validTrail.push({point:a,age:time-a.t});
    }
    const count=low?2:6,stride=Math.max(1,Math.ceil(validTrail.length/count));
    for(let i=0,drawn=0;i<validTrail.length&&drawn<count;i+=stride,drawn++) {
      const {point,age}=validTrail[i];if(age<0||age>TRAIL_SECONDS)continue;
      c.save();c.globalAlpha=(1-age/TRAIL_SECONDS)*(low?.12:.25);
      saberShape(c,r.x+point.x*r.cell,r.y+point.y*r.cell,r.cell,handName,{ghost:true,low:true});c.restore();
    }
  }
  saberShape(c,x,y,r.cell,handName,{selected,low});
}

function diamond(c,x,y,radius,color,angle=0) {
  c.save();c.translate(x,y);c.rotate(angle);
  path(c,[[0,-radius],[radius*.4,0],[0,radius],[-radius*.4,0]],color);c.restore();
}

function drawEffect(c,r,e,time,reduced,low) {
  const age=time-e.time;
  if(!finite(age)||age<0||age>=EFFECT_SECONDS-1e-9||!finite(e.x)||!finite(e.y))return;
  const x=r.x+e.x*r.cell,y=r.y+e.y*r.cell;
  const progress=age/EFFECT_SECONDS,fade=1-progress;
  c.save();c.globalAlpha=fade;
  if(e.kind!=='hit') {
    // Quiet feedback; wrong cuts never show the success split.
    if(age<.35) {
      c.globalAlpha=1-age/.35;
      line(c,x-r.cell*.14,y-r.cell*.14,x+r.cell*.14,y+r.cell*.14,'#d7be9d',2);
      line(c,x+r.cell*.14,y-r.cell*.14,x-r.cell*.14,y+r.cell*.14,'#d7be9d',2);
    }
    c.restore();return;
  }
  const p=PALETTE[e.hand]??PALETTE.left,style=effectStyle(e.grade,{low,reduced});
  const vectors={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0],any:[0,-1]};
  const [dx,dy]=vectors[e.direction]??vectors.any;
  const angle=Math.atan2(dy,dx),spread=(reduced?.06:age*(.95+style.tier*.12))*r.cell,half=r.cell*.36;
  // Local impact flash only. Never pulse the full canvas or shake the camera.
  if(!reduced&&!low&&age<.14) {
    const radius=r.cell*(.42+style.tier*.045);
    const glow=c.createRadialGradient(x,y,0,x,y,radius);
    glow.addColorStop(0,'#ebfcff8f');glow.addColorStop(.28,`${p.glow}70`);glow.addColorStop(1,`${p.glow}00`);
    c.globalAlpha=(1-age/.14)*.7;c.fillStyle=glow;c.beginPath();c.arc(x,y,radius,0,Math.PI*2);c.fill();
  }
  c.globalAlpha=fade;
  for(let i=0;i<style.rings;i++) {
    const radius=r.cell*(reduced?.46:.20+progress*(.75+style.tier*.12)+i*.14);
    c.save();c.translate(x,y);c.rotate(angle+i*.6);
    c.strokeStyle=i%2?p.edge:style.color;c.lineWidth=Math.max(1,r.cell*(.038-i*.008))*fade;
    c.globalAlpha=fade*(i===0?.62:.38);
    c.beginPath();c.ellipse(0,0,radius,radius*(i===1?.42:1),0,0,Math.PI*2);c.stroke();c.restore();
  }
  c.globalAlpha=fade*.9;
  c.save();c.translate(x,y);c.rotate(angle);
  for(const sign of [-1,1]) {
    c.save();c.translate(age*r.cell*.08,sign*spread+(reduced?0:age*age*r.cell*.18));
    if(!reduced)c.rotate(sign*age*(.5+style.tier*.06));
    path(c,[[-half,sign*2],[half,sign*2],[half,sign*half],[-half,sign*half]],p.fill,p.edge,1.2);
    line(c,-half,sign*2,half,sign*2,'#e8faff',Math.max(2,r.cell*.04));c.restore();
  }
  c.restore();
  const colors=[p.edge,style.color,'#d8fcff','#aaffd8','#ffc7ee'];
  for(let i=0;i<style.particles;i++) {
    const a=angle+i*2.399,travel=Math.pow(progress,.72)*r.cell*(.45+(i%5)*.18+style.tier*.12);
    const px=x+Math.cos(a)*travel,py=y+Math.sin(a)*travel+age*age*r.cell*.43;
    const length=r.cell*(.045+(i%3)*.032)*fade;
    c.globalAlpha=fade*(.65+(i%2)*.3);
    line(c,px,py,px+Math.cos(a)*length,py+Math.sin(a)*length,colors[i%Math.min(colors.length,style.tier+2)],Math.max(1,r.cell*(i%3===0?.045:.020)));
    if(!low&&i%5===0)diamond(c,px,py,Math.max(1,r.cell*.05*fade),'#f1ffff',a);
  }
  for(let i=0;i<style.confetti;i++) {
    const a=i*2.4+.3,distance=r.cell*(.45+style.tier*.09)*Math.sqrt(progress);
    const px=x+Math.cos(a)*distance,py=y+Math.sin(a)*distance-progress*r.cell*.35;
    c.save();c.translate(px,py);c.rotate(a+age*3);c.globalAlpha=fade*.85;
    rounded(c,-r.cell*.025,-r.cell*.055,r.cell*.05,r.cell*.11,r.cell*.012,colors[i%colors.length]);c.restore();
  }
  c.restore();
}

function drawGradeLabel(c,r,e,time,reduced,low) {
  const age=time-e.time;
  if(e.kind!=='hit'||!finite(age)||age<0||age>=EFFECT_SECONDS-1e-9||!finite(e.x)||!finite(e.y))return;
  const style=effectStyle(e.grade,{low,reduced});if(!style.label)return;
  const progress=age/EFFECT_SECONDS,alpha=Math.min(1,(1-progress)*2.5);
  const size=Math.max(11,Math.min(27,r.cell*(.19+style.tier*.017)));
  const accuracy=finite(e.accuracy)?` · ${Math.floor(clamp(e.accuracy,0,100)+1e-9)}%`:'';
  const label=`${style.label}${accuracy}`,maxWidth=r.w*.90;
  c.font=`800 ${size}px ${font}`;
  const width=Math.min(maxWidth,c.measureText(label).width+24);
  const x=clamp(r.x+e.x*r.cell,r.x+width/2+2,r.x+r.w-width/2-2);
  const y=clamp(r.y+e.y*r.cell-r.cell*.58-(reduced?0:progress*r.cell*.18),r.y+size,r.y+r.h-size);
  c.save();c.globalAlpha=alpha;
  rounded(c,x-width/2,y-size*.93,width,size*1.48,Math.min(10,size*.4),'#0b183bea',style.color,1.4);
  if(!low&&!reduced){c.shadowColor=style.color;c.shadowBlur=8;}
  fitText(c,label,x,y+size*.18,width-14,size,style.color,'center');c.shadowBlur=0;
  if(style.tier>=3&&!low&&!reduced) {
    diamond(c,x-width/2-5,y-size*.2,size*.24,style.color,Math.PI/4);
    diamond(c,x+width/2+5,y-size*.2,size*.24,style.color,Math.PI/4);
  }
  c.restore();
}

/** Main render; no clock, DOM, browser global, mutation, or external resources. */
export function drawSaber(c,w,h,{time=0,bpm=112,leadSeconds=1.8,slots=[],phase='idle',effects=[],reduced=false,quality='high',selected={player:0,hand:'left'}}={}) {
  if(!c||!finite(w)||!finite(h)||w<=0||h<=0)return;
  const players=slots.length===2?2:1,low=quality==='low';
  time=finite(time)?time:0;
  leadSeconds=finite(leadSeconds)&&leadSeconds>0?leadSeconds:1.8;
  c.save();c.globalAlpha=1;c.lineCap='butt';c.setLineDash([]);
  const pulse=atmosphere(c,w,h,time,bpm,reduced,low);
  const compact=w<600,headerSize=compact?10:13;
  text(c,'얼마루 / NEON SABER',Math.max(10,w*.018),Math.min(24,h*.062),headerSize,'#e0eaff','left',800);
  if(w>420)text(c,'L  빨강 왼손     R  파랑 오른손',w-Math.max(10,w*.018),Math.min(24,h*.062),compact?9:11,'#aac0db','right');
  for(let player=0;player<players;player++) {
    const section=w/players,left=section*player,r=planeRect(w,h,players,player),slot=slots[player]??{};
    c.save();c.beginPath();c.rect(left,Math.min(31,h*.085),section,h);c.clip();
    corridor(c,w,h,r,player,players,pulse,low);
    if(player>0)line(c,left,36,left,h-12,'#7286b736',1);
    const py=Math.min(49,h*.13),small=section<320,tiny=section<200;
    text(c,`P${player+1}`,left+Math.max(10,section*.027),py,small?9:11,player===0?'#c5b9ff':'#9cdef0','left',800);
    const status=slot.status || (phase==='idle'?'양손을 편안하게 준비해요':phase==='paused'?'일시정지':'음악에 맞춰 화살표 방향으로');
    if(!tiny)fitText(c,status,left+section*.5,py,section*.70,small?8:10,'#a5b8d3','center');
    drawNotes(c,r,Array.isArray(slot.notes)?slot.notes:[],time,low,leadSeconds);
    const visibleEffects=effects.slice(-(reduced?4:low?8:MAX_EFFECTS));
    for(const e of visibleEffects)if(e.player===player)drawEffect(c,r,e,time,reduced,low);
    for(const handName of ['left','right'])drawHand(c,r,slot.hands?.[handName],handName,time,selected?.player===player&&selected?.hand===handName,low,reduced);
    for(const e of visibleEffects)if(e.player===player)drawGradeLabel(c,r,e,time,reduced,low);
    if(phase==='idle' && !(slot.notes?.length)) {
      const cx=r.x+r.w/2,cy=r.y+r.h*(tiny?.24:.51),titleSize=Math.min(25,Math.max(10,r.w*.060));
      text(c,tiny?'빛을 베어요':'다가오는 빛을 베어요',cx,cy,titleSize,'#deebff','center',700);
      fitText(c,tiny?'화살표 방향으로':'검 끝으로 블록을 지나며 화살표 방향으로',cx,cy+titleSize*1.7,r.w*.9,tiny?8:Math.min(12,titleSize*.52),'#96abc9','center');
      if(r.w>190) {
        text(c,'L',cx-r.w*.19,cy+titleSize*3.0,Math.max(11,titleSize*.72),PALETTE.left.edge,'center',800);
        text(c,'R',cx+r.w*.19,cy+titleSize*3.0,Math.max(11,titleSize*.72),PALETTE.right.edge,'center',800);
      }
    }
    const footerY=Math.min(h-10,r.y+r.h+24);
    if(slot.counts && phase!=='idle') {
      const n=slot.counts;
      fitText(c,tiny?`베기 ${n.hit??0}`:`베기 ${n.hit??0}  ·  방향/손 ${n.wrongCut??0}  ·  놓침 ${n.miss??0}  ·  인식 안 됨 ${n.untracked??0}`,
        left+section*.5,footerY,section*.94,small?8:10,'#9db2ca','center');
    } else {
      fitText(c,tiny?'탈락 없이 한 곡':'손만 움직여 한 곡 · 탈락 없이 끝까지',left+section*.5,footerY,section*.9,small?8:10,'#94a8c6','center');
    }
    c.restore();
  }
  c.restore();
}
