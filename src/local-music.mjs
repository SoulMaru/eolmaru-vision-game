// Local media stays on this device. Long sources use a short playable prefix.
export function localTrackPlan(sourceDuration){
  if(typeof sourceDuration!=='number'||!Number.isFinite(sourceDuration)||sourceDuration<120)throw new Error('2분 이상인 음악을 선택해 주세요. 긴 곡은 앞 2분 30초를 사용해요.');
  const trimmed=sourceDuration>180.02;
  return Object.freeze({sourceDuration,duration:trimmed?150:Math.min(sourceDuration,180),trimmed});
}
