// Local render workload comparison, not webcam or end-to-end latency measurement.
(async()=>{
  const {drawSaber}=await import('/src/saber-render.mjs');
  const canvas=document.createElement('canvas');canvas.width=1668;canvas.height=630;
  const c=canvas.getContext('2d'),results=[];
  for(const players of [1,2])for(const quality of ['high','low']){
    const slots=Array.from({length:players},()=>({status:'합성 렌더 부하',counts:{hit:1,miss:0,wrongCut:0,untracked:0},hands:Object.fromEntries(['left','right'].map((hand,i)=>[hand,{x:1.5+i,y:1.5,valid:true,trail:Array.from({length:18},(_,j)=>({x:1.2+i+j*.02,y:1.4+j*.01,t:10-.21+j*.012}))}])),notes:Array.from({length:8},(_,i)=>({hitTime:10+i*.22,spawnTime:8.2+i*.22,lineIndex:i%4,lineLayer:i%3,hand:i%2?'left':'right',cutDirection:['up','down','left','right'][i%4]}))}));
    const effects=Array.from({length:16},(_,i)=>({kind:'hit',x:i%4+.5,y:i%3+.5,time:9.8,hand:i%2?'left':'right',player:i%players,direction:'up'}));
    const options={time:10,bpm:112,slots,effects,quality,phase:'playing',selected:{player:0,hand:'left'}},costs=[];
    for(let i=0;i<30;i++)drawSaber(c,canvas.width,canvas.height,options);
    for(let i=0;i<180;i++){
      const start=performance.now();drawSaber(c,canvas.width,canvas.height,options);costs.push(performance.now()-start);
      if(i%20===0)await new Promise(requestAnimationFrame);
    }
    costs.sort((a,b)=>a-b);results.push({players,quality,meanMs:Number((costs.reduce((a,b)=>a+b)/costs.length).toFixed(3)),p95Ms:Number(costs[Math.floor(costs.length*.95)].toFixed(3))});
  }
  return {canvas:[canvas.width,canvas.height],framesPerCase:180,notesPerPlayer:8,effects:16,results,scope:'Canvas command submission, synthetic workload; excludes GPU completion and camera inference'};
})()
