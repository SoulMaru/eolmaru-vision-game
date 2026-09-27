// Original local rhythm songs. Stretch routines keep their own gentle playlist.
export const BUILTIN_SONGS=Object.freeze([
  {value:'builtin',songId:'maru-flow',title:'Maru Flow',genre:'편안한 리듬',bpm:112,duration:150},
  {value:'maru-neon-drive',songId:'maru-neon-drive',title:'Neon Drive',genre:'테크노',bpm:150,duration:96*4*60/150},
  {value:'maru-pulse-rush',songId:'maru-pulse-rush',title:'Pulse Rush',genre:'댄스',bpm:156,duration:96*4*60/156},
].map(song=>Object.freeze({...song,src:`/audio/${song.songId}.ogg`,chart:`/charts/${song.songId}.saber.json`})));

export const getBuiltinSong=value=>BUILTIN_SONGS.find(song=>song.value===value)||null;
