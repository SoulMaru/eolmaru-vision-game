// Original timed guidance informed by primary NHS sources listed in docs/RESEARCH.md.
// These are movement examples, not medical prescriptions or proof of correct execution.
const standing = [
  {id:'prepare',seconds:15,title:'서서 전신 스트레칭 준비',cue:'두 발을 편안히 벌려요. 벽이나 움직이지 않는 의자를 가까이 준비해요.',region:'준비',voice:'standing-prepare',match:null,pose:'rest'},
  {id:'neck-left',seconds:10,title:'고개를 왼쪽으로 조금',cue:'어깨 힘을 빼고 고개만 작게 기울인 뒤 중앙으로 돌아와요.',region:'목',voice:'neck-left',match:null,pose:'neck-left'},
  {id:'neck-right',seconds:10,title:'고개를 오른쪽으로 조금',cue:'손으로 누르지 않고 편안한 범위에서 천천히 움직여요.',region:'목',voice:'neck-right',match:null,pose:'neck-right'},
  {id:'shoulder-roll',seconds:20,title:'어깨를 천천히 돌리기',cue:'팔에 힘을 빼고 어깨를 작게 올렸다 뒤로 내려요.',region:'어깨',voice:'shoulder-roll',match:null,pose:'shoulder-roll'},
  {id:'open',seconds:20,title:'편안하게 가슴 열기',cue:'팔을 편안한 높이로 열어요. 어깨가 불편하면 낮추거나 쉬어요.',region:'가슴 · 어깨',voice:'open',match:'open',pose:'open'},
  {id:'left',seconds:15,title:'왼쪽 옆구리 늘리기',cue:'두 발은 바닥에. 몸을 조금만 옆으로 기울였다 돌아와요.',region:'몸통',voice:'left',match:'left',pose:'left'},
  {id:'right',seconds:15,title:'오른쪽 옆구리 늘리기',cue:'반동 없이 작은 범위로 움직여요. 숨은 편안하게 쉬어요.',region:'몸통',voice:'right',match:'right',pose:'right'},
  {id:'hamstring-left',seconds:20,title:'왼쪽 허벅지 뒤 늘리기',cue:'지지물을 잡고 왼발을 조금 앞으로. 뒤꿈치는 바닥, 엉덩이에서 살짝 숙여요.',region:'허벅지 뒤',voice:'standing-hamstring-left',match:null,pose:'hamstring-left'},
  {id:'hamstring-right',seconds:20,title:'오른쪽 허벅지 뒤 늘리기',cue:'지지물을 잡고 오른발을 조금 앞으로. 등을 길게, 편안한 당김까지만.',region:'허벅지 뒤',voice:'standing-hamstring-right',match:null,pose:'hamstring-right'},
  {id:'calf-left',seconds:20,title:'왼쪽 종아리 늘리기',cue:'벽을 짚고 왼발을 뒤로. 뒤꿈치는 바닥에, 앞무릎만 조금 굽혀요.',region:'종아리',voice:'standing-calf-left',match:null,pose:'calf-left'},
  {id:'calf-right',seconds:20,title:'오른쪽 종아리 늘리기',cue:'벽을 짚고 오른발을 뒤로. 작은 보폭에서 편안하게 유지하고 풀어요.',region:'종아리',voice:'standing-calf-right',match:null,pose:'calf-right'},
  {id:'ankle',seconds:20,title:'서서 발목 부드럽게',cue:'벽을 짚고 뒤꿈치를 바닥에 둔 채 발끝을 조금 들었다 내려요.',region:'발목',voice:'standing-ankle',match:null,pose:'ankle'},
  {id:'rest',seconds:20,title:'전신 힘을 풀며 마무리',cue:'두 발은 바닥에. 팔과 어깨의 힘을 빼고 천천히 호흡해요.',region:'마무리',voice:'rest',match:null,pose:'rest'},
];

const floor = [
  {id:'floor-prepare',seconds:25,title:'매트에 누워 준비하기',cue:'먼저 매트에 편안히 누워 무릎을 굽혀요. 준비가 더 필요하면 일시정지해요.',region:'준비',voice:'floor-prepare',match:null,pose:'supine-rest'},
  {id:'floor-neck-left',seconds:10,title:'누워서 고개를 왼쪽으로 조금',cue:'머리를 받친 채 고개를 작게 돌렸다 중앙으로. 불편하면 그대로 쉬어요.',region:'목',voice:'floor-neck-left',match:null,pose:'supine-neck-left'},
  {id:'floor-neck-right',seconds:10,title:'누워서 고개를 오른쪽으로 조금',cue:'머리를 들거나 손으로 누르지 않고 천천히 돌아와요.',region:'목',voice:'floor-neck-right',match:null,pose:'supine-neck-right'},
  {id:'floor-open',seconds:20,title:'누워서 가슴과 어깨 열기',cue:'등은 편안하게 받치고 두 팔을 낮은 높이로 벌려요.',region:'가슴 · 어깨',voice:'floor-open',match:null,pose:'supine-open'},
  {id:'floor-reach',seconds:10,title:'누워서 팔을 천천히 뻗기',cue:'양팔을 머리 쪽으로 편안한 범위까지만. 어깨가 불편하면 팔을 내려요.',region:'어깨 · 몸통',voice:'floor-reach',match:null,pose:'supine-reach'},
  {id:'floor-knee-left',seconds:20,title:'왼쪽 무릎 가볍게 안아 오기',cue:'반대 발은 바닥에. 왼쪽 허벅지 뒤를 받쳐 무릎을 조금 가까이 가져와요.',region:'엉덩이 · 허리',voice:'floor-knee-left',match:null,pose:'supine-knee-left'},
  {id:'floor-knee-right',seconds:20,title:'오른쪽 무릎 가볍게 안아 오기',cue:'어깨와 머리를 편히 두고 무리하게 당기지 않아요.',region:'엉덩이 · 허리',voice:'floor-knee-right',match:null,pose:'supine-knee-right'},
  {id:'floor-hamstring-left',seconds:20,title:'누워서 왼쪽 허벅지 뒤 늘리기',cue:'허벅지 뒤를 받치고 무릎을 편안한 범위까지 펴요. 다리를 높이 강요하지 않아요.',region:'허벅지 뒤',voice:'floor-hamstring-left',match:null,pose:'supine-hamstring-left'},
  {id:'floor-hamstring-right',seconds:20,title:'누워서 오른쪽 허벅지 뒤 늘리기',cue:'반대 무릎은 굽혀 편히 두고, 등을 바닥에서 억지로 떼지 않아요.',region:'허벅지 뒤',voice:'floor-hamstring-right',match:null,pose:'supine-hamstring-right'},
  {id:'floor-twist-left',seconds:15,title:'무릎을 왼쪽으로 작게',cue:'두 무릎을 굽힌 채 조금만 기울여요. 어깨가 들리기 전에 돌아와요.',region:'몸통 · 골반',voice:'floor-twist-left',match:null,pose:'supine-twist-left'},
  {id:'floor-twist-right',seconds:15,title:'무릎을 오른쪽으로 작게',cue:'깊게 비틀지 않고 작은 범위로 기울였다 돌아와요.',region:'몸통 · 골반',voice:'floor-twist-right',match:null,pose:'supine-twist-right'},
  {id:'floor-ankle',seconds:20,title:'누워서 종아리와 발목 풀기',cue:'다리를 편안히 받치고 발끝을 천천히 몸 쪽으로 당겼다 풀어요.',region:'종아리 · 발목',voice:'ankle',match:null,pose:'supine-ankle'},
  {id:'floor-rest',seconds:20,title:'누운 채 호흡하며 마무리',cue:'급하게 일어나지 않아요. 끝난 뒤 준비되면 옆으로 돌아 천천히 일어나요.',region:'마무리',voice:'floor-finish',match:null,pose:'supine-rest'},
];

// Partners follow the same gentle sequence side-by-side with their own support.
// No pulling, pushing, partner loading or reliance on the other person's balance.
const couple = standing.map(step => ({
  ...step,
  title: step.id === 'prepare' ? '둘이 나란히 서서 준비' : `함께 · ${step.title}`,
  cue: step.id === 'prepare'
    ? '팔이 닿지 않을 간격으로 나란히 서요. 서로 당기지 않고 각자 지지물을 준비해요.'
    : step.id === 'rest'
      ? '같은 음악을 들으며 각자 편히 호흡해요. 한 사람이 쉬어도 기다리며 함께 마쳐요.'
      : `${step.cue} 같은 박자에 각자의 편안한 범위로 함께해요.`,
  voice: step.id === 'prepare' ? 'couple-prepare' : step.voice,
}));

export const ROUTINE_PROFILES = {
  standing: {name:'서서 전신',description:'기본 · 벽이나 안정된 지지물 옆에서 전신을 천천히',duration:225,requiresTwo:false,steps:standing},
  floor: {name:'누워서 전신',description:'매트에 먼저 누워 시작 · 시간과 음성 안내만 제공',duration:225,requiresTwo:false,steps:floor},
  couple: {name:'커플 함께',description:'둘이 나란히 같은 음악에 맞춰 · 서로 당기거나 밀지 않아요',duration:225,requiresTwo:true,steps:couple},
};
