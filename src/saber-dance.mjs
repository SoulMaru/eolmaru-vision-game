// Original two-pose artwork is loaded once, outside the pure Canvas renderer.
export const DANCE_URLS=Object.freeze(['/assets/dance-a.png','/assets/dance-b.png']);
const finite=Number.isFinite;
const COLORS=['#fa5388','#fb9460','#e8cd60','#62d69b','#5ad5df','#7281f4','#bb74e7'];
const EMPTY=Object.freeze({ready:false,images:Object.freeze([])});

/** Injectable loader for tests; a failed load is cached and never retried per frame. */
export function createDanceImageLoader({ImageCtor,timeoutMs=8000}={}) {
  let pending;
  return function load() {
    if(pending)return pending;
    if(typeof ImageCtor!=='function')return pending=Promise.resolve(EMPTY);
    const loadOne=url=>new Promise(resolve=>{
      let image,timer,done=false;
      const finish=ok=>{
        if(done)return;done=true;clearTimeout(timer);
        if(image){image.onload=null;image.onerror=null;}
        resolve(ok?image:null);
      };
      try {
        image=new ImageCtor();image.decoding='async';
        image.onload=()=>finish(image.naturalWidth>0&&image.naturalHeight>0);
        image.onerror=()=>finish(false);
        timer=setTimeout(()=>finish(false),Math.max(1,Math.min(30000,timeoutMs||8000)));
        image.src=url;
      } catch {finish(false);}
    });
    pending=Promise.all(DANCE_URLS.map(loadOne)).then(images=>
      images.every(Boolean)?Object.freeze({ready:true,images:Object.freeze(images)}):EMPTY);
    return pending;
  };
}

let defaultLoader;
export function loadDanceImages() {
  defaultLoader??=createDanceImageLoader({ImageCtor:globalThis.Image});
  return defaultLoader();
}

/** Audio time anchors the pose, including paused/resuming; only idle/reduced force A. */
export function dancePoseIndex(time,bpm=112,{phase='idle',reduced=false}={}) {
  if(reduced||phase==='idle'||!finite(time)||time<0)return 0;
  const period=Math.max(.5,120/(finite(bpm)&&bpm>0?bpm:112));
  return Math.floor((time+1e-9)/period)%2;
}

/** Fixed edge placements; the middle 60% is free of character sprites. */
export function danceSpriteLayout(w,h,players=1) {
  if(!finite(w)||!finite(h)||w<=0||h<=0)return [];
  const width=Math.min(w*(players===2?.155:.20),h*.46);
  const height=width*4/3,bottom=h*.92;
  return [{x:-width*.035,y:bottom-height,w:width,h:height,half:0},
    {x:w-width*.965,y:bottom-height,w:width,h:height,half:1}];
}

/** Pure draw: steady rainbow architecture and exactly two cached-image draws. */
export function drawDanceBackdrop(c,w,h,{dance,time=0,bpm=112,phase='idle',reduced=false,quality='high',players=1}={}) {
  if(!dance?.ready||dance.images?.length!==2||!c||!finite(w)||!finite(h)||w<=0||h<=0)return false;
  const index=dancePoseIndex(time,bpm,{phase,reduced:reduced||dance.static}),image=dance.images[index];
  if(!(image?.naturalWidth>0&&image?.naturalHeight>0))return false;
  const low=quality==='low';
  c.save();
  // Constant luminance: no beat-controlled full-screen brightness, flashes or camera motion.
  const wash=c.createLinearGradient(0,0,w,h*.45);
  ['#451b48','#4a2929','#363c26','#153d41','#192d54','#342257'].forEach((color,i)=>wash.addColorStop(i/5,color));
  c.globalAlpha=.85;c.fillStyle=wash;c.fillRect(0,0,w,h);c.globalAlpha=1;
  const cx=w*.5,horizon=h*.46;
  const rays=low?4:7;
  for(let i=0;i<rays;i++) {
    const color=COLORS[Math.round(i*6/(rays-1))],edge=i/(rays-1)*w;
    c.globalAlpha=.075;c.fillStyle=color;c.beginPath();
    c.moveTo(cx,horizon);c.lineTo(edge-w*.065,0);c.lineTo(edge+w*.065,0);c.closePath();c.fill();
  }
  c.globalAlpha=1;
  // Rainbow floor paths stay below the skyline and never move the interaction geometry.
  for(let i=0;i<7;i++) {
    const x=w*(.055+i*.148),color=COLORS[i];
    c.strokeStyle=color;c.globalAlpha=low?.18:.25;c.lineWidth=low?2:3;
    c.beginPath();c.moveTo(cx+(x-cx)*.15,horizon);c.lineTo(x,h);c.stroke();
  }
  if(!low)for(let i=0;i<3;i++) {
    c.strokeStyle=COLORS[1+i*2];c.globalAlpha=.20;c.lineWidth=1.5;
    c.beginPath();c.ellipse(cx,horizon+h*(.13+i*.105),w*(.35+i*.13),h*(.055+i*.025),0,0,Math.PI*2);c.stroke();
  }
  // Deep center preserves arrows, red/blue hand colors, and both players' target lanes.
  const shade=c.createLinearGradient(0,0,w,0);
  shade.addColorStop(0,'#080d2400');shade.addColorStop(.24,'#080d2480');
  shade.addColorStop(.5,'#080d24b5');shade.addColorStop(.76,'#080d2480');shade.addColorStop(1,'#080d2400');
  c.globalAlpha=1;c.fillStyle=shade;c.fillRect(0,0,w,h);
  const half=image.naturalWidth/2;
  for(const box of danceSpriteLayout(w,h,players)) {
    c.globalAlpha=players===2?.57:.78;
    c.drawImage(image,box.half*half,0,half,image.naturalHeight,box.x,box.y,box.w,box.h);
  }
  c.restore();return true;
}
