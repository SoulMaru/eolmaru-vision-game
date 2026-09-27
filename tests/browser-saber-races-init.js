// Test-only init script. Use an isolated browser session; never load this in the app.
// Gates one builtin chart response and named synthetic File.text calls.
(()=>{
  let releaseFetch,releaseFile;
  const fetchGate=new Promise(resolve=>{releaseFetch=resolve;}),originalFetch=window.fetch.bind(window),originalText=File.prototype.text;
  const probe=window.__saberRace={fetchWaiting:false,fetchDelivered:false,fileWaiting:false,delayFile:false,
    releaseFetch:()=>releaseFetch(),releaseFile:()=>releaseFile?.()};
  window.fetch=async function(input,options){
    const url=typeof input==='string'?input:input.url;
    const response=await originalFetch(input,options);
    if(new URL(url,location.href).pathname==='/charts/maru-flow.saber.json'){
      const chart=await response.json();
      // Distinct valid IDs make an unintended replacement visible even when the
      // normal builtin chart is identical to the synchronous fallback generator.
      chart.notes=chart.notes.map(n=>({...n,id:`delayed-${n.id}`}));
      probe.fetchWaiting=true;await fetchGate;probe.fetchDelivered=true;
      return new Response(JSON.stringify(chart),{status:200,headers:{'Content-Type':'application/json'}});
    }
    return response;
  };
  File.prototype.text=async function(){
    const text=await originalText.call(this);
    if(probe.delayFile&&this.name.startsWith('race-')){
      probe.fileWaiting=true;await new Promise(resolve=>{releaseFile=resolve;});probe.fileWaiting=false;
    }
    return text;
  };
})();
