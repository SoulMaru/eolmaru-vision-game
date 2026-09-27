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

function drawNotes(c,r,notes,time,low) {
  const vx=r.x+r.w*.5,vy=r.y+r.h*.38;
  // Caller supplies active pending notes. Bound the work even for malformed integrations.
  const visible=notes.slice(0,MAX_NOTES).filter(n=>finite(n.hitTime)&&finite(n.lineIndex)&&finite(n.lineLayer)
    &&n.lineIndex>=0&&n.lineIndex<4&&n.lineLayer>=0&&n.lineLayer<3
    &&time>=(finite(n.spawnTime)?n.spawnTime:n.hitTime-1.8)&&time<=n.hitTime+.30);
  visible.sort((a,b)=>b.hitTime-a.hitTime);
  for(const n of visible) {
    const delta=n.hitTime-time,scale=1/(1+Math.max(-.12,delta)*2.4);
    const targetX=r.x+(n.lineIndex+.5)*r.cell,targetY=r.y+(n.lineLayer+.5)*r.cell;
    const x=vx+(targetX-vx)*scale,y=vy+(targetY-vy)*scale;
    const late=delta<-.05,alpha=delta<0?clamp(1+delta/.3,.12,1):clamp(.42+scale*.58,.4,1);
    // Exact size at delta=0 is .72 cell, equal to the collision rectangle contract.
    noteBlock(c,x,y,r.cell*.72*scale,n.hand,n.cutDirection,alpha,low,late);
    if(delta>=0&&delta<.3) {
      c.save();c.globalAlpha=(1-delta/.3)*.38;
      rounded(c,targetX-r.cell*.4,targetY-r.cell*.4,r.cell*.8,r.cell*.8,r.cell*.09,null,PALETTE[n.hand]?.edge??'#fff',1);
      c.restore();
    }
  }
}

function drawHand(c,r,hand,handName,time,selected,low,reduced) {
  if(!hand || !hand.valid || !finite(hand.x) || !finite(hand.y))return;
  // Do not turn an off-plane observation into a false on-plane pointer by clamping it.
  if(hand.x<-.2||hand.x>4.2||hand.y<-.2||hand.y>3.2)return;
  const p=PALETTE[handName],x=r.x+hand.x*r.cell,y=r.y+hand.y*r.cell;
  const trail=Array.isArray(hand.trail)?hand.trail.slice(-MAX_TRAIL):[];
  if(!reduced) {
    for(let i=1;i<trail.length;i++) {
      const a=trail[i-1],b=trail[i],age=time-b.t;
      if(!finite(a.x)||!finite(a.y)||!finite(b.x)||!finite(b.y)||!finite(age)||age<0||age>.22||b.t<a.t||b.t-a.t>.2)continue;
      c.save();c.globalAlpha=(1-age/.22)*.5;
      line(c,r.x+a.x*r.cell,r.y+a.y*r.cell,r.x+b.x*r.cell,r.y+b.y*r.cell,p.glow,Math.max(2,r.cell*.085));c.restore();
    }
  }
  c.save();c.lineCap='round';
  // Fixed decorative blade axis avoids inventing 3D wrist orientation from 2D pose.
  const sx=handName==='left'?-1:1,baseX=x+sx*r.cell*.20,baseY=y+r.cell*.65;
  if(!low){c.shadowColor=p.glow;c.shadowBlur=14;}
  line(c,baseX,baseY,x,y,p.glow,Math.max(4,r.cell*.075));
  c.shadowBlur=0;line(c,baseX,baseY,x,y,'#effeff',Math.max(1.5,r.cell*.022));
  line(c,baseX,baseY,baseX+sx*r.cell*.045,baseY+r.cell*.14,'#6f809d',Math.max(5,r.cell*.085));
  line(c,baseX-r.cell*.07,baseY+r.cell*.012,baseX+r.cell*.07,baseY-r.cell*.012,p.edge,Math.max(2,r.cell*.035));
  c.beginPath();c.arc(x,y,Math.max(3,r.cell*.065),0,Math.PI*2);c.fillStyle='#efffff';c.fill();
  c.beginPath();c.arc(x,y,Math.max(7,r.cell*(selected?.115:.09)),0,Math.PI*2);c.strokeStyle=p.edge;c.lineWidth=selected?2:1;c.stroke();
  const tag=Math.max(9,Math.min(12,r.cell*.18));
  rounded(c,x+10,y-19,tag*1.6,tag*1.6,4,'#111e39d9',p.edge);
  text(c,p.name,x+10+tag*.8,y-19+tag*1.16,tag,p.edge,'center',800);
  c.restore();
}

function drawEffect(c,r,e,time,reduced,low) {
  const age=time-e.time;
  if(!finite(age)||age<0||age>.42||!finite(e.x)||!finite(e.y))return;
  const x=r.x+e.x*r.cell,y=r.y+e.y*r.cell;
  c.save();c.globalAlpha=1-age/.42;
  if(e.kind!=='hit') {
    // Quiet feedback; wrong cuts never show the success split.
    line(c,x-r.cell*.14,y-r.cell*.14,x+r.cell*.14,y+r.cell*.14,'#d7be9d',2);
    line(c,x+r.cell*.14,y-r.cell*.14,x-r.cell*.14,y+r.cell*.14,'#d7be9d',2);
    c.restore();return;
  }
  const p=PALETTE[e.hand]??PALETTE.left;
  const vectors={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0],any:[0,-1]};
  const [dx,dy]=vectors[e.direction]??vectors.any;
  const angle=Math.atan2(dy,dx),spread=age*r.cell*(reduced?.2:.8),half=r.cell*.36;
  c.save();c.translate(x,y);c.rotate(angle);
  for(const sign of [-1,1]) {
    c.save();c.translate(age*r.cell*.08,sign*spread);
    if(!reduced)c.rotate(sign*age*.4);
    path(c,[[-half,sign*2],[half,sign*2],[half,sign*half],[-half,sign*half]],p.fill,p.edge,1.2);
    line(c,-half,sign*2,half,sign*2,'#e8faff',2);c.restore();
  }
  c.restore();
  if(!reduced) {
    const count=low?4:10;
    for(let i=0;i<count;i++) {
      const a=angle+i*2.399,dist=age*r.cell*(.8+(i%3)*.3);
      const px=x+Math.cos(a)*dist,py=y+Math.sin(a)*dist+age*age*r.cell*.35;
      line(c,px,py,px+Math.cos(a)*r.cell*.045,py+Math.sin(a)*r.cell*.045,i%3?p.edge:'#fff',Math.max(1,r.cell*.022));
    }
  }
  c.restore();
}

/** Main render; no clock, DOM, browser global, mutation, or external resources. */
export function drawSaber(c,w,h,{time=0,bpm=112,slots=[],phase='idle',effects=[],reduced=false,quality='high',selected={player:0,hand:'left'}}={}) {
  if(!c||!finite(w)||!finite(h)||w<=0||h<=0)return;
  const players=slots.length===2?2:1,low=quality==='low';
  time=finite(time)?time:0;
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
    drawNotes(c,r,Array.isArray(slot.notes)?slot.notes:[],time,low);
    for(const e of effects.slice(-MAX_EFFECTS))if(e.player===player)drawEffect(c,r,e,time,reduced,low);
    for(const handName of ['left','right'])drawHand(c,r,slot.hands?.[handName],handName,time,selected?.player===player&&selected?.hand===handName,low,reduced);
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
