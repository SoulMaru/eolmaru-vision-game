import {targetPose} from './core.mjs';

// Original illustrated poses. Timed floor/leg examples are not scoring templates.
export function makeFigurePose(item,profile='standing'){
  const id=item.resting?'rest':item.pose||item.id;
  const p=targetPose(['open','up','left','right'].includes(id)?id:'rest');
  const set=(i,x,y)=>p[i]={x,y,visibility:1};
  const wave=Math.sin((item.local||0)*Math.PI*.6);
  if(profile==='floor'||id.startsWith('supine-')){
    set(0,.15,.50);set(11,.28,.44);set(12,.28,.58);set(23,.55,.46);set(24,.55,.59);
    set(13,.39,.38);set(14,.39,.66);set(15,.50,.36);set(16,.50,.69);
    set(25,.75,.47);set(26,.75,.61);set(27,.91,.48);set(28,.91,.62);
    const left=id.endsWith('left'),knee=left?25:26,ankle=left?27:28;
    // Supine preparation has bent knees; floor examples use a top-down illustration.
    if(['supine-rest','rest'].includes(id)){set(25,.67,.38);set(26,.67,.68);set(27,.81,.48);set(28,.81,.61);}
    if(id.includes('neck'))p[0].y+=(left?-.018:.018)*(.5+.5*wave);
    if(id.includes('open')){set(13,.28,.30);set(15,.30,.17);set(14,.28,.73);set(16,.30,.86);}
    if(id.includes('knee')){
      set(knee,.43,.22);set(ankle,.60,.31);set(13,.34,.31);set(15,.43,.23);set(14,.37,.42);set(16,.46,.29);
    }else if(id.includes('hamstring')){
      set(knee,.57,.25);set(ankle,.67,.10);set(13,.41,.32);set(15,.54,.28);set(14,.46,.39);set(16,.58,.31);
    }else if(id.includes('twist')){
      const direction=left?-1:1;set(25,.65,.42+direction*.16);set(26,.65,.47+direction*.16);set(27,.80,.52+direction*.16);set(28,.80,.57+direction*.16);
      set(13,.29,.27);set(15,.29,.12);set(14,.29,.75);set(16,.29,.89);
    }else if(id.includes('reach')){
      set(13,.18,.36);set(15,.04,.33);set(14,.18,.67);set(16,.04,.71);
    }
    if(!left&&(id.includes('knee')||id.includes('hamstring'))){
      for(const n of [knee,ankle,13,14,15,16])p[n].y=1-p[n].y;
    }
    for(const n of [27,28])p[n].footAngle=-Math.PI/2+(id.includes('ankle')?wave*.35:0);
    return p;
  }
  if(id==='neck-left')p[0].x-=.04*(.5+.5*wave);
  if(id==='neck-right')p[0].x+=.04*(.5+.5*wave);
  if(id==='shoulder-roll')for(const n of [11,12,13,14])p[n].y+=wave*.025;
  if(id==='march'){const lift=Math.sin((item.local||0)*Math.PI);p[25].y-=Math.max(0,lift)*.09;p[27].y-=Math.max(0,lift)*.09;p[26].y-=Math.max(0,-lift)*.09;p[28].y-=Math.max(0,-lift)*.09;}
  if(id.includes('hamstring')||id.includes('calf')){
    const left=id.endsWith('left'),knee=left?25:26,ankle=left?27:28;
    set(knee,left?.32:.68,.78);set(ankle,left?.20:.80,.96);
    if(id.includes('hamstring')){for(const n of [0,11,12,13,14,15,16])p[n].y+=.04;p[ankle].footAngle=left?-.30:.30;}
    else {p[ankle].footAngle=left?-.2:.2;for(const n of [0,11,12])p[n].x+=left?.035:-.035;}
  }
  if(id.includes('ankle')){p[27].footAngle=wave*.22;p[28].footAngle=-wave*.22;}
  return p;
}
