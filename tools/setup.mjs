import { mkdir, copyFile, writeFile, readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vendor = path.join(root,'public/vendor/vision');
await mkdir(path.join(vendor,'wasm'), {recursive:true});
const pkg = path.join(root,'node_modules/@mediapipe/tasks-vision');
await copyFile(path.join(pkg,'vision_bundle.mjs'),path.join(vendor,'vision_bundle.mjs'));
for (const file of ['vision_wasm_internal.js','vision_wasm_internal.wasm','vision_wasm_nosimd_internal.js','vision_wasm_nosimd_internal.wasm']) await copyFile(path.join(pkg,'wasm',file),path.join(vendor,'wasm',file));
await mkdir(path.join(root,'public/models'), {recursive:true});
const model = path.join(root,'public/models/pose_landmarker_lite.task');
const url = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
try { await access(model); } catch {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Model download failed: ${response.status}`);
  await writeFile(model, Buffer.from(await response.arrayBuffer()));
}
const bytes = await readFile(model);
if(createHash('sha256').update(bytes).digest('hex')!=='59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a') throw new Error('Model checksum does not match the pinned Lite v1 model');
await writeFile(path.join(root,'public/models/provenance.json'),JSON.stringify({model:'MediaPipe Pose Landmarker Lite float16 v1',url,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length},null,2)+'\n');
console.log('Offline vision assets are ready. npm start');
