import { readdir,readFile,stat,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=[];
async function walk(dir){for(const item of await readdir(path.join(root,dir),{withFileTypes:true})){const name=path.posix.join(dir,item.name);if(item.isDirectory())await walk(name);else files.push(name);}}
await walk('public');await walk('src');
const entries=await Promise.all(files.map(async file=>{const bytes=await readFile(path.join(root,file));return {file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}));
const groups=new Map();for(const item of entries){const key=item.sha256;groups.set(key,[...(groups.get(key)||[]),item.file]);}
const duplicates=[...groups.values()].filter(x=>x.length>1);
const required=['public/index.html','public/audio/maru-flow.ogg','public/audio/voice/manifest.json','public/models/pose_landmarker_lite.task','public/vendor/vision/vision_bundle.mjs','public/vendor/vision/wasm/vision_wasm_internal.wasm','public/vendor/vision/wasm/vision_wasm_nosimd_internal.wasm','public/assets/icon.svg'];
const missing=[];for(const file of required){try{await stat(path.join(root,file));}catch{missing.push(file);}}
const manifest=JSON.parse(await readFile(path.join(root,'public/audio/voice/manifest.json'),'utf8'));
const voiceErrors=[];for(const [id,cue] of Object.entries(manifest.cues)){const record=entries.find(e=>e.file===`public${cue.file}`);if(!record||record.sha256!==cue.sha256||record.bytes!==cue.bytes)voiceErrors.push(id);}
const music=JSON.parse(await readFile(path.join(root,'public/audio/maru-flow.json'),'utf8'));
const song=entries.find(e=>e.file==='public/audio/maru-flow.ogg');
if(song.sha256!==music.measurements.sha256)throw Error('Music hash mismatch');
const sourceFiles=entries.filter(e=>e.file.startsWith('src/')||['public/index.html','public/style.css'].includes(e.file));
const externalRuntimeReferences=[];for(const {file} of sourceFiles){const content=await readFile(path.join(root,file),'utf8');if(/https?:\/\//.test(content))externalRuntimeReferences.push(file);}
const result={checkedAt:new Date().toISOString(),runtimeFiles:entries.length,runtimeBytes:entries.reduce((n,e)=>n+e.bytes,0),missing,duplicates,voiceErrors,externalRuntimeReferences,files:entries};
await writeFile(path.join(root,'docs/ASSET_AUDIT.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,files:undefined},null,2));
if(missing.length||duplicates.length||voiceErrors.length||externalRuntimeReferences.length)process.exitCode=1;
