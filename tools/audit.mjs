import { readdir,readFile,stat,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {BUILTIN_SONGS} from '../src/songs.mjs';
import {SET_TRACKS} from '../src/routine.mjs';
import {validateChart} from '../src/saber-chart.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=[];
async function walk(dir){for(const item of await readdir(path.join(root,dir),{withFileTypes:true})){const name=path.posix.join(dir,item.name);if(item.isDirectory())await walk(name);else files.push(name);}}
await walk('public');await walk('src');
const entries=await Promise.all(files.map(async file=>{const bytes=await readFile(path.join(root,file));return {file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}));
const groups=new Map();for(const item of entries){const key=item.sha256;groups.set(key,[...(groups.get(key)||[]),item.file]);}
const duplicates=[...groups.values()].filter(x=>x.length>1);
const required=['public/index.html','public/audio/maru-flow.ogg','public/audio/voice/manifest.json','public/models/pose_landmarker_lite.task','public/vendor/vision/vision_bundle.mjs','public/vendor/vision/wasm/vision_wasm_internal.wasm','public/vendor/vision/wasm/vision_wasm_nosimd_internal.wasm','public/assets/icon.svg'];
const musicFiles=[...new Set([...BUILTIN_SONGS,...SET_TRACKS].map(song=>song.src))];
required.push(...musicFiles.flatMap(src=>[`public${src}`,`public${src.replace(/\.ogg$/,'.json')}`]),...BUILTIN_SONGS.map(song=>`public${song.chart}`));
const missing=[];for(const file of required){try{await stat(path.join(root,file));}catch{missing.push(file);}}
const manifest=JSON.parse(await readFile(path.join(root,'public/audio/voice/manifest.json'),'utf8'));
const voiceErrors=[];for(const [id,cue] of Object.entries(manifest.cues)){const record=entries.find(e=>e.file===`public${cue.file}`);if(!record||record.sha256!==cue.sha256||record.bytes!==cue.bytes)voiceErrors.push(id);}
const musicErrors=[];
for(const src of musicFiles){
  try{
    const music=JSON.parse(await readFile(path.join(root,`public${src.replace(/\.ogg$/,'.json')}`),'utf8'));
    const file=entries.find(e=>e.file===`public${src}`);
    if(!file||file.sha256!==music.measurements.sha256||file.bytes!==music.measurements.fileBytes)throw Error('bytes/hash');
    const builtin=BUILTIN_SONGS.find(song=>song.src===src);
    if(builtin){
      if(music.id!==builtin.songId||music.bpm!==builtin.bpm||Math.abs(music.durationSeconds-builtin.duration)>.02)throw Error('catalog metadata');
      const chart=validateChart(await readFile(path.join(root,`public${builtin.chart}`),'utf8'),{duration:builtin.duration,songId:builtin.songId});
      if(chart.bpm!==builtin.bpm)throw Error('chart BPM');
    }
  }catch(error){musicErrors.push({file:src,reason:error.message});}
}
const sourceFiles=entries.filter(e=>e.file.startsWith('src/')||['public/index.html','public/style.css'].includes(e.file));
const externalRuntimeReferences=[];for(const {file} of sourceFiles){const content=await readFile(path.join(root,file),'utf8');if(/https?:\/\//.test(content))externalRuntimeReferences.push(file);}
const result={checkedAt:new Date().toISOString(),runtimeFiles:entries.length,runtimeBytes:entries.reduce((n,e)=>n+e.bytes,0),missing,duplicates,voiceErrors,musicErrors,externalRuntimeReferences,files:entries};
await writeFile(path.join(root,'docs/ASSET_AUDIT.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,files:undefined},null,2));
if(missing.length||duplicates.length||voiceErrors.length||musicErrors.length||externalRuntimeReferences.length)process.exitCode=1;
