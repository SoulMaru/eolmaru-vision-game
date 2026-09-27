import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import http from 'node:http';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {localTrackPlan} from '../src/local-music.mjs';
import {generateEasyChart,validateChart,chartJSON} from '../src/saber-chart.mjs';
import {SaberFeedback} from '../src/saber-feedback.mjs';
import {HIT_GRADES} from '../src/saber-core.mjs';
import {DANCE_URLS,createDanceImageLoader,dancePoseIndex,danceSpriteLayout,drawDanceBackdrop} from '../src/saber-dance.mjs';

const sha=data=>createHash('sha256').update(data).digest('hex');
const root=new URL('../',import.meta.url);
function audioFiles(relative='public/audio'){
  return readdirSync(new URL(`${relative}/`,root),{withFileTypes:true}).flatMap(entry=>{
    const path=`${relative}/${entry.name}`;
    return entry.isDirectory()?audioFiles(path):/\.(ogg|json)$/.test(entry.name)?[path]:[];
  });
}

test('arcade changes preserve all twelve songs, thirty-six voices and fourteen metadata files',()=>{
  // Independently captured from Git commit 5d260af before this task's changes.
  // Strict audio bytes; JSON permits only the checkout's CRLF/LF difference.
  const paths=audioFiles().sort();
  assert.equal(paths.filter(p=>p.endsWith('.ogg')).length,48);
  assert.equal(paths.filter(p=>p.endsWith('.json')).length,14);
  const rows=paths.map(path=>{
    let data=readFileSync(new URL(path,root));
    if(path.endsWith('.json'))data=Buffer.from(data.toString('utf8').replace(/\r\n/g,'\n'));
    return `${path}\0${sha(data)}`;
  });
  assert.equal(sha(rows.join('\n')),'3f715e18f72fbf20084570faf596b63803ac6df458d18b58fc174522c2dd5965');
});

test('local songs from exactly two to three minutes retain their original playable duration',()=>{
  for(const duration of [120,120.000001,147.692307692,150,179.999999,180]){
    assert.deepEqual(localTrackPlan(duration),{sourceDuration:duration,duration,trimmed:false});
  }
});

test('three-minute codec tolerance clamps to 180 while the next microsecond uses the long-song prefix',()=>{
  for(const sourceDuration of [180.000001,180.002902,180.02]){
    assert.deepEqual(localTrackPlan(sourceDuration),{sourceDuration,duration:180,trimmed:false});
  }
  for(const sourceDuration of [180.020001,181,240,3600,Number.MAX_VALUE]){
    assert.deepEqual(localTrackPlan(sourceDuration),{sourceDuration,duration:150,trimmed:true});
  }
});

test('short, unknown and nonnumeric local durations fail without mutating an earlier plan',()=>{
  const before=localTrackPlan(240);
  for(const invalid of [119.999999,0,-1,NaN,Infinity,-Infinity,'240',null,undefined,{},true]){
    assert.throws(()=>localTrackPlan(invalid));
    assert.deepEqual(before,{sourceDuration:240,duration:150,trimmed:true});
  }
  assert.ok(Object.isFrozen(before));assert.throws(()=>{before.duration=240;},TypeError);
});

test('long music generates and exports a 150-second chart without allocating notes for the source tail',()=>{
  for(const sourceDuration of [181,600,3600])for(const bpm of [40,112,240]){
    const plan=localTrackPlan(sourceDuration),chart=generateEasyChart({...plan,bpm,songId:'local'});
    assert.equal(chart.duration,150);assert.ok(chart.notes.every(n=>n.spawnTime>=0&&n.hitTime<=149));
    const reimported=validateChart(chartJSON(chart),{duration:plan.duration,songId:'local'});
    assert.deepEqual(reimported,chart);
    assert.deepEqual(chart,generateEasyChart({duration:150,bpm,songId:'local'}));
  }
});

function audioGraph(){
  const all=[],sources=[],gains=[],shapers=[],buffers=[],panners=[];
  const param=()=>({value:0,events:[],setValueAtTime(value,time){this.value=value;this.events.push([value,time]);},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
  const node=kind=>{const n={kind,to:[],disconnects:0,connect(target){this.to.push(target);},disconnect(){this.disconnects++;}};all.push(n);return n;};
  const source=kind=>{const n=Object.assign(node(kind),{frequency:param(),starts:[],stops:[],start(at){this.starts.push(at);},stop(at){this.stops.push(at);},end(){this.onended?.();}});sources.push(n);return n;};
  const ac={state:'running',currentTime:2,sampleRate:48000,destination:{name:'speaker'},all,sources,gains,shapers,buffers,panners,
    createGain(){const n=Object.assign(node('gain'),{gain:param()});gains.push(n);return n;},
    createWaveShaper(){const n=node('limiter');shapers.push(n);return n;},
    createStereoPanner(){const n=Object.assign(node('pan'),{pan:param()});panners.push(n);return n;},
    createOscillator(){return source('oscillator');},createBufferSource(){return source('buffer');},
    createBiquadFilter(){return Object.assign(node('filter'),{frequency:param()});},
    createBuffer(channels,length,sampleRate){const data=new Float32Array(length),buffer={channels,length,sampleRate,getChannelData:()=>data};buffers.push(buffer);return buffer;},
  };return ac;
}
const hit=(id,tier=4,player=0)=>({id,kind:'hit',player,hand:player?'right':'left',grade:HIT_GRADES[tier],accuracy:tier*20+10});

test('all blaster bursts share the actual finite bounded limiter path and reuse the noise buffer',()=>{
  const ac=audioGraph(),feedback=new SaberFeedback({getContext:()=>ac,effectVolume:()=>1,voiceEnabled:()=>false,players:()=>2});
  for(let i=0;i<20;i++)feedback.hit(hit(`burst-${i}`,i%5,i%2));
  assert.equal(ac.sources.length,24);assert.equal(feedback.bursts.size,8);assert.equal(ac.shapers.length,1);assert.equal(ac.buffers.length,1);
  const {node,limiter}=feedback.master;
  assert.deepEqual(node.to,[limiter]);assert.deepEqual(limiter.to,[ac.destination]);
  assert.ok(ac.panners.every(p=>p.to.length===1&&p.to[0]===node));
  assert.equal(limiter.oversample,'2x');assert.ok(limiter.curve instanceof Float32Array);
  assert.ok(limiter.curve.length>=1000&&limiter.curve.length%2===1);
  const curve=limiter.curve;
  for(let i=0;i<curve.length;i++){
    assert.ok(Number.isFinite(curve[i])&&Math.abs(curve[i])<1);
    if(i)assert.ok(curve[i]>=curve[i-1]);
    assert.ok(Math.abs(curve[i]+curve[curve.length-1-i])<1e-6);
  }
  assert.equal(curve[(curve.length-1)/2],0);
  feedback.stop();assert.equal(feedback.nodes.size,0);assert.equal(feedback.bursts.size,0);
});

test('blaster mute and invalid volumes allocate no sound nodes and full-volume overflow is clamped',()=>{
  let volume=0;const ac=audioGraph(),feedback=new SaberFeedback({getContext:()=>ac,effectVolume:()=>volume,voiceEnabled:()=>false});
  for(const v of [0,-1,NaN,Infinity]){volume=v;feedback.hit(hit(`mute-${v}`));}
  assert.equal(ac.all.length,0);
  volume=1;feedback.hit(hit('normal'));const fullVolume=ac.gains[1].gain.value;feedback.stop();
  volume=100;const gainCount=ac.gains.length;feedback.hit(hit('overflow'));
  assert.equal(ac.gains[gainCount+1].gain.value,fullVolume);feedback.stop();
});

test('stop disconnects the blaster limiter and old ended callbacks cannot disconnect its replacement',()=>{
  const ac=audioGraph(),feedback=new SaberFeedback({getContext:()=>ac,effectVolume:()=>1,voiceEnabled:()=>false});
  feedback.hit(hit('old'));const oldMaster=feedback.master,oldSources=[...ac.sources];feedback.stop();
  assert.equal(feedback.master,null);assert.ok(oldMaster.node.disconnects>0&&oldMaster.limiter.disconnects>0);
  assert.ok(oldSources.every(n=>n.stops.length===2&&n.disconnects>0));
  feedback.hit(hit('new'));const fresh=feedback.master;
  for(const source of oldSources)source.end();
  assert.equal(feedback.master,fresh);assert.equal(fresh.limiter.disconnects,0);assert.equal(fresh.node.disconnects,0);
  assert.equal(feedback.bursts.size,1);assert.equal(feedback.nodes.size,3);
  for(const source of ac.sources.slice(3))source.end();
  assert.equal(feedback.bursts.size,0);assert.equal(feedback.nodes.size,0);feedback.stop();
  assert.ok(fresh.limiter.disconnects>0);
});

test('dance images alternate at two-beat boundaries and never faster than twice per second',()=>{
  for(const bpm of [40,80,112,140,240,1000]){
    const period=Math.max(.5,120/bpm);
    for(let boundary=1;boundary<=6;boundary++){
      assert.equal(dancePoseIndex(boundary*period-.000001,bpm,{phase:'playing'}),(boundary-1)%2);
      assert.equal(dancePoseIndex(boundary*period,bpm,{phase:'playing'}),boundary%2);
    }
  }
  for(const time of [NaN,Infinity,-1])assert.equal(dancePoseIndex(time,112,{phase:'playing'}),0);
  assert.equal(dancePoseIndex(1.1,112,{phase:'playing',reduced:true}),0);
});

test('pausing on pose B retains that music-clock pose and seeking reanchors the alternation',()=>{
  const time=1.1,bpm=112;
  assert.equal(dancePoseIndex(time,bpm,{phase:'playing'}),1);
  for(const phase of ['paused','resuming'])assert.equal(dancePoseIndex(time,bpm,{phase}),1,phase);
  assert.equal(dancePoseIndex(.1,bpm,{phase:'playing'}),0);
  assert.equal(dancePoseIndex(time,bpm,{phase:'idle'}),0);
});

test('dance loader requests exactly two local images once and shares concurrent loading',async()=>{
  const images=[];class Image{constructor(){this.naturalWidth=1536;this.naturalHeight=1024;images.push(this);}}
  const load=createDanceImageLoader({ImageCtor:Image}),first=load(),again=load();
  assert.equal(first,again);assert.deepEqual(images.map(i=>i.src),DANCE_URLS);
  for(const image of images)image.onload();
  const dance=await first;assert.equal(dance.ready,true);assert.equal(dance.images.length,2);
  assert.equal(await load(),dance);assert.equal(images.length,2);assert.ok(Object.isFrozen(dance)&&Object.isFrozen(dance.images));
});

test('a failed image keeps the local fallback cached instead of retrying every rendered frame',async()=>{
  const images=[];class Image{constructor(){this.naturalWidth=1536;this.naturalHeight=1024;images.push(this);}}
  const load=createDanceImageLoader({ImageCtor:Image}),first=load();images[0].onload();images[1].onerror();
  const result=await first;assert.equal(result.ready,false);assert.deepEqual(result.images,[]);
  for(let i=0;i<20;i++)assert.equal(await load(),result);assert.equal(images.length,2);
  assert.equal((await createDanceImageLoader()()).ready,false);
});

test('image timeout releases handlers and a late load cannot turn a cached fallback into ready',async t=>{
  const timers=[],images=[];
  t.mock.method(globalThis,'setTimeout',fn=>{timers.push(fn);return timers.length;});t.mock.method(globalThis,'clearTimeout',()=>{});
  class Image{constructor(){this.naturalWidth=1536;this.naturalHeight=1024;images.push(this);}}
  const load=createDanceImageLoader({ImageCtor:Image,timeoutMs:5}),pending=load(),late=images[1].onload;
  images[0].onload();timers[1]();const failed=await pending;assert.equal(failed.ready,false);
  assert.equal(images[1].onload,null);assert.equal(images[1].onerror,null);late();assert.equal(await load(),failed);
});

test('rainbow rendering uses two cached sprite crops at the edges and survives absent images',()=>{
  const draws=[],gradient=()=>({addColorStop(){}}),c=new Proxy({drawImage:(...args)=>draws.push(args),createLinearGradient:gradient},{get:(target,key)=>target[key]??(()=>{})});
  const images=[{naturalWidth:1536,naturalHeight:1024},{naturalWidth:1536,naturalHeight:1024}],dance={ready:true,images};
  for(const players of [1,2])for(const [w,h] of [[1000,500],[360,220],[1920,1080]])for(const quality of ['high','low']){
    draws.length=0;assert.equal(drawDanceBackdrop(c,w,h,{dance,time:1.1,bpm:112,phase:'playing',players,quality}),true);
    assert.equal(draws.length,2);assert.ok(draws.every(args=>args[0]===images[1]));
    assert.deepEqual(draws.map(args=>args.slice(1,5)),[[0,0,768,1024],[768,0,768,1024]]);
    const boxes=danceSpriteLayout(w,h,players);assert.ok(boxes[0].x+boxes[0].w<=w*.2);assert.ok(boxes[1].x>=w*.8);
  }
  for(const options of [{dance:{...dance,static:true}},{dance,reduced:true}]){
    draws.length=0;assert.equal(drawDanceBackdrop(c,1000,500,{time:1.1,bpm:112,phase:'playing',...options}),true);
    assert.equal(draws.length,2);assert.ok(draws.every(args=>args[0]===images[0]),'manual or OS reduced motion freezes pose A');
  }
  draws.length=0;assert.equal(drawDanceBackdrop(c,1000,500,{dance:{ready:false,images:[]}}),false);assert.equal(draws.length,0);
  assert.deepEqual(danceSpriteLayout(NaN,500),[]);
});

const execute=promisify(execFile),project=fileURLToPath(root);
const startListening=server=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve(server.address().port));});
const closeServer=server=>new Promise(resolve=>server.close(resolve));
const launcherArgs=port=>['-NoProfile','-ExecutionPolicy','Bypass','-File',fileURLToPath(new URL('tools/launch.ps1',root)),'-NoBrowser','-Port',String(port)];

test('Windows launcher rejects another project even when its HTML claims the same game name',{skip:process.platform!=='win32',timeout:20000},async()=>{
  const requests=[],server=http.createServer((req,res)=>{
    requests.push(req.url);res.setHeader('Content-Type','application/json');
    res.end(req.url==='/__eolmaru'?JSON.stringify({appId:'eolmaru-vision',root:'C:\\different-checkout',serverHash:'other'}):JSON.stringify({title:'EOLMARU VISION',nonce:'not-this-checkout'}));
  }),port=await startListening(server);
  try{
    await assert.rejects(execute('powershell.exe',launcherArgs(port),{cwd:project,windowsHide:true,timeout:15000,maxBuffer:1024*1024}));
    assert.ok(requests.includes('/__eolmaru'));assert.ok(requests.some(p=>p.startsWith('/launch-proof-')));
    const response=await fetch(`http://127.0.0.1:${port}/`);assert.equal(response.status,200,'foreign service remains running');
    assert.equal(readdirSync(new URL('public/',root)).some(name=>/^launch-proof-.*\.json$/.test(name)),false);
  }finally{await closeServer(server);}
});

test('Windows launcher reuses this exact server and identity names its real root, current version and source hash',{skip:process.platform!=='win32',timeout:20000},async()=>{
  const reservation=http.createServer(),port=await startListening(reservation);await closeServer(reservation);
  const child=spawn(process.execPath,[fileURLToPath(new URL('tools/server.mjs',root))],{cwd:project,env:{...process.env,PORT:String(port)},windowsHide:true,stdio:['ignore','pipe','pipe']});
  try{
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timeout')),5000);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('error',reject);});
    const response=await fetch(`http://127.0.0.1:${port}/__eolmaru`),identity=await response.json();
    assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(identity.appId,'eolmaru-vision');
    assert.equal(identity.root.toLowerCase(),project.replace(/[\\/]$/,'').toLowerCase());
    assert.equal(identity.version,JSON.parse(readFileSync(new URL('package.json',root))).version);
    assert.equal(identity.serverHash,sha(readFileSync(new URL('tools/server.mjs',root))));
    const html=await fetch(`http://127.0.0.1:${port}/`);assert.equal(html.headers.get('cache-control'),'no-cache');
    const {stdout}=await execute('powershell.exe',launcherArgs(port),{cwd:project,windowsHide:true,timeout:15000,maxBuffer:1024*1024});
    assert.match(stdout,/Reused\s*:\s*True/i);assert.match(stdout,/Restarted\s*:\s*False/i);
    assert.equal(child.exitCode,null,'the owned server process survives reuse');
  }finally{child.kill();await new Promise(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',resolve);});}
});

test('Windows launcher starts a server on an empty port and serves this checkout without an existing process',{skip:process.platform!=='win32',timeout:20000},async()=>{
  const reservation=http.createServer(),port=await startListening(reservation);await closeServer(reservation);
  const quote=value=>`'${value.replace(/'/g,"''")}'`,launcher=fileURLToPath(new URL('tools/launch.ps1',root)),serverFile=fileURLToPath(new URL('tools/server.mjs',root));
  let ownerPid=null;
  try{
    const command=`$run = & ${quote(launcher)} -NoBrowser -Port ${port}; $connection = Get-NetTCPConnection -LocalPort ${port} -State Listen | Select-Object -First 1; [pscustomobject]@{Launch=$run;OwnerPid=$connection.OwningProcess} | ConvertTo-Json -Depth 4 -Compress`;
    const {stdout}=await execute('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',command],{cwd:project,windowsHide:true,timeout:15000,maxBuffer:1024*1024});
    const result=JSON.parse(stdout.trim());ownerPid=result.OwnerPid;
    assert.ok(Number.isInteger(ownerPid)&&ownerPid>0);assert.equal(result.Launch.Reused,false);assert.equal(result.Launch.Restarted,false);
    const identity=await fetch(`http://127.0.0.1:${port}/__eolmaru`).then(r=>r.json());
    assert.equal(identity.root.toLowerCase(),project.replace(/[\\/]$/,'').toLowerCase());
    assert.equal(identity.serverHash,sha(readFileSync(new URL('tools/server.mjs',root))));
    assert.match(result.Launch.Url,/\?version=.+&launch=\d+$/);
  }finally{
    if(ownerPid){
      // Stop only the PID produced by this launch, after checking both port owner
      // and the exact server command. Existing/default game servers are untouched.
      const cleanup=`$env:PSModulePath = (Join-Path $PSHOME 'Modules') + [IO.Path]::PathSeparator + $env:PSModulePath; $connection = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; $owned = Get-CimInstance Win32_Process -Filter 'ProcessId=${ownerPid}'; if($connection.OwningProcess -ne ${ownerPid} -or $owned.Name -ne 'node.exe' -or -not $owned.CommandLine.Contains(${quote(serverFile)})){throw 'Refusing to stop unverified fixture process'}; Stop-Process -Id ${ownerPid} -ErrorAction Stop`;
      await execute('powershell.exe',['-NoProfile','-Command',cleanup],{cwd:project,windowsHide:true,timeout:10000,maxBuffer:1024*1024});
    }
  }
});
