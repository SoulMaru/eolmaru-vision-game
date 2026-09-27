// Original local rhythm songs. Stretch routines keep their own gentle playlist.
export const BUILTIN_SONGS=Object.freeze([
  {value:'builtin',songId:'maru-flow',title:'Maru Flow',genre:'편안한 리듬',bpm:112,duration:150},
  {value:'maru-neon-drive',songId:'maru-neon-drive',title:'Neon Drive',genre:'테크노',bpm:150,duration:96*4*60/150},
  {value:'maru-pulse-rush',songId:'maru-pulse-rush',title:'Pulse Rush',genre:'댄스',bpm:156,duration:96*4*60/156},
  ...[
    [80,48,'앰버 스텝'],[90,56,'벨벳 바운스'],[100,64,'유리빛 아케이드'],
    [110,68,'메트로 스파크'],[120,76,'프리즘 모션'],[130,80,'오로라 서킷'],[140,88,'혜성 스프린트'],
  ].map(([bpm,bars,title])=>({value:`maru-step-${bpm}`,songId:`maru-step-${bpm}`,title,genre:'템포 적응 · 댄스/테크노',bpm,duration:bars*4*60/bpm,training:true})),
].map(song=>Object.freeze({...song,src:`/audio/${song.songId}.ogg`,chart:`/charts/${song.songId}.saber.json`})));

export const getBuiltinSong=value=>BUILTIN_SONGS.find(song=>song.value===value)||null;
