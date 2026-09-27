// All angles in this module are decorative Canvas rotations, never hit-test input.
const finite=Number.isFinite;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const TAU=Math.PI*2;
export const SWING_MAX_RADIANS_PER_SECOND=10;
export const SWING_ANGLE_DEADBAND=.025;

export function defaultBladeAngle(hand='left') {
  return (hand==='left'?1:-1)*Math.atan(.20/.65);
}

/** Signed shortest turn. Wrapping prevents a full spin across the -PI/PI seam. */
export function angleDelta(from,to) {
  if(!finite(from)||!finite(to))return 0;
  return ((to-from+Math.PI)%TAU+TAU)%TAU-Math.PI;
}

export function initialBladeAngle(hand,armAngle) {
  return finite(armAngle)?angleDelta(0,armAngle):defaultBladeAngle(hand);
}

/** One bounded observation update; there is no animation clock or idle oscillation. */
export function nextBladeAngle(previous,{hand='left',armAngle,previousArmAngle,dx=0,dy=0,dt=0,moving=false,speed=0}={}) {
  const current=finite(previous)?previous:initialBladeAngle(hand,armAngle);
  if(!finite(dt)||dt<=0||dt>.2+1e-9)return initialBladeAngle(hand,armAngle);
  const hasArm=finite(armAngle);
  const hasMotion=moving&&finite(dx)&&finite(dy)&&Math.hypot(dx,dy)>1e-7;
  const armChanged=hasArm&&(!finite(previousArmAngle)||Math.abs(angleDelta(previousArmAngle,armAngle))>=SWING_ANGLE_DEADBAND);
  // Once the observed hand/arm stops, do not invent an easing-back swing.
  if(!hasMotion&&!armChanged)return current;
  const motionAngle=hasMotion?Math.atan2(dy,dx)+Math.PI/2:null;
  let target=hasArm?armAngle:motionAngle;
  if(hasArm&&hasMotion) {
    // Reliable arm pose leads; faster wrist motion adds at most 23 degrees of lean.
    const weight=clamp((speed-.65)/7,0,.28);
    target+=clamp(angleDelta(target,motionAngle),-Math.PI*.46,Math.PI*.46)*weight;
  }
  const delta=angleDelta(current,target);
  if(Math.abs(delta)<SWING_ANGLE_DEADBAND)return current;
  const eased=delta*(1-Math.exp(-dt/.055));
  const turn=clamp(eased,-SWING_MAX_RADIANS_PER_SECOND*dt,SWING_MAX_RADIANS_PER_SECOND*dt);
  return angleDelta(0,current+turn);
}

/** Tip is exactly (x,y); rotating the hilt never shifts the observed bright point. */
export function bladeGeometry(x,y,cell,hand,bladeAngle) {
  const angle=finite(bladeAngle)?bladeAngle:defaultBladeAngle(hand);
  const length=Math.hypot(.20,.65)*cell;
  return {x,y,baseX:x-Math.sin(angle)*length,baseY:y+Math.cos(angle)*length,angle,length};
}
