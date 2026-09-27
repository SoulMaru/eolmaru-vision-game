// Local-only impact synthesis and pre-rendered fictional character voices.
import {HIT_GRADES} from './saber-core.mjs';
const bounded=x=>Number.isFinite(x)?Math.max(0,Math.min(1,x)):0;
export class SaberFeedback {
  constructor({getContext,voiceEnabled=()=>true,voiceVolume=()=>.8,effectVolume=()=>.45,canSpeak=()=>true,players=()=>1}={}){
    Object.assign(this,{getContext,voiceEnabled,voiceVolume,effectVolume,canSpeak,players});
    this.buffers=new Map();this.encoded=new Map();this.nodes=new Set();this.bursts=new Set();
    this.activeVoice=null;this.pending=null;this.timer=null;this.seen=new Set();this.epoch=0;this.noise=null;
  }
  async load(){
    if(this.loading)return this.loading;
    this.loading=(async()=>{try{
      const response=await fetch('/audio/praise/manifest.json');if(!response.ok)return false;
      const manifest=await response.json();
      await Promise.all(HIT_GRADES.map(async({key})=>{
        const file=manifest.cues?.[key]?.file;
        if(file!==`/audio/praise/${key}.ogg`)return;
        const r=await fetch(file);if(r.ok)this.encoded.set(key,await r.arrayBuffer());
      }));
      return this.encoded.size===5;
    }catch{return false;}})();
    try{return await this.loading;}finally{this.loading=null;}
  }
  async prepare(){
    // Decode ahead of the first note. Loading never schedules delayed praise.
    if(this.preparing)return this.preparing;
    const ac=this.getContext?.();if(!ac)return false;
    this.preparing=(async()=>{
      if(this.loading)await this.loading;
      if(this.encoded.size<5)await this.load();
      await Promise.all([...this.encoded].map(async([key,bytes])=>{
        if(this.buffers.has(key))return;
        try{this.buffers.set(key,await ac.decodeAudioData(bytes.slice(0)));}catch{}
      }));
      return this.buffers.size===5;
    })();
    try{return await this.preparing;}finally{this.preparing=null;}
  }
  stop(){
    this.epoch++;clearTimeout(this.timer);this.timer=null;this.pending=null;this.seen.clear();
    for(const node of this.nodes){try{node.stop();}catch{}try{node.disconnect();}catch{}}
    this.nodes.clear();for(const burst of this.bursts)burst.disconnect();this.bursts.clear();
    this.master?.node.disconnect();this.master=null;
    if(this.activeVoice){this.activeVoice.gain.disconnect();this.activeVoice=null;}
  }
  hit(event){
    const ac=this.getContext?.(),grade=HIT_GRADES[event?.grade?.tier];
    if(event?.kind!=='hit'||!grade||grade.key!==event.grade.key||!Number.isFinite(event.accuracy)||!ac||ac.state!=='running')return false;
    const key=`${event.player}:${event.id}`;if(this.seen.has(key))return false;
    this.seen.add(key);if(this.seen.size>4096)this.seen.delete(this.seen.values().next().value);
    this.impact(event);
    if(!this.voiceEnabled()||!this.canSpeak()||this.voiceVolume()<=0||this.activeVoice||!this.buffers.has(grade.key))return true;
    // One short collection window chooses the strongest of simultaneous duo hits.
    // Busy voices skip new praise, never enqueue speech behind the music.
    if(!this.pending||event.accuracy>this.pending.accuracy)this.pending=event;
    if(this.timer===null){const epoch=this.epoch;this.timer=setTimeout(()=>{
      this.timer=null;const selected=this.pending;this.pending=null;
      if(epoch===this.epoch&&selected)this.praise(selected);
    },24);}
    return true;
  }
  praise(event){
    const ac=this.getContext?.(),buffer=this.buffers.get(event.grade.key);
    if(!buffer||ac?.state!=='running'||this.activeVoice||!this.voiceEnabled()||!this.canSpeak())return;
    const source=ac.createBufferSource(),gain=ac.createGain();source.buffer=buffer;
    gain.gain.value=bounded(this.voiceVolume());source.connect(gain);gain.connect(ac.destination);
    const record={source,gain};this.activeVoice=record;this.nodes.add(source);
    source.onended=()=>{this.nodes.delete(source);source.disconnect();gain.disconnect();if(this.activeVoice===record)this.activeVoice=null;};
    source.start();
  }
  impact(event){
    const ac=this.getContext?.(),volume=bounded(this.effectVolume());
    if(!volume||!ac||ac.state!=='running'||this.bursts.size>=8)return;
    const at=ac.currentTime,tier=event.grade.tier,duration=.20+tier*.025,base=[220,261.63,293.66,329.63,392][tier];
    if(!this.master){const node=ac.createGain();node.connect(ac.destination);this.master={node,context:ac};}
    const mix=()=>this.master?.node.gain.setValueAtTime(1/Math.sqrt(Math.max(1,this.bursts.size)),ac.currentTime);
    const bus=ac.createGain(),pan=ac.createStereoPanner();
    // Equal-power normalization prevents eight simultaneous impacts from clipping.
    bus.gain.value=volume*.15;pan.pan.value=this.players()===2?(event.player===0?-.5:.5):(event.hand==='left'?-.18:.18);
    bus.connect(pan);pan.connect(this.master.node);const voices=[];
    const burst={disconnect:()=>{bus.disconnect();pan.disconnect();for(const v of voices)for(const n of v.cleanup)n.disconnect();}};
    this.bursts.add(burst);mix();let left=0;
    const register=(source,cleanup,length)=>{
      left++;voices.push({source,cleanup});this.nodes.add(source);
      source.onended=()=>{this.nodes.delete(source);source.disconnect();for(const n of cleanup)n.disconnect();if(--left===0){burst.disconnect();this.bursts.delete(burst);mix();}};
      source.start(at);source.stop(at+length);
    };
    const envelope=(peak,length)=>{
      const gain=ac.createGain();gain.gain.setValueAtTime(.0001,at);gain.gain.linearRampToValueAtTime(peak,at+.004);gain.gain.exponentialRampToValueAtTime(.0001,at+length);return gain;
    };
    // Metallic laser chirp + descending digital shard overtone.
    for(const [ratio,type,peak,length] of [[2,'sawtooth',.48,duration],[5,'sine',.55,duration+.09]]){
      const osc=ac.createOscillator(),gain=envelope(peak,length);osc.type=type;
      osc.frequency.setValueAtTime(base*ratio,at);osc.frequency.exponentialRampToValueAtTime(base*(ratio===2?.48:1.5),at+length);
      osc.connect(gain);gain.connect(bus);register(osc,[gain],length+.015);
    }
    // Deterministic filtered noise crack: no stored duplicate effects or network.
    if(!this.noise){this.noise=ac.createBuffer(1,Math.ceil(ac.sampleRate*.24),ac.sampleRate);const data=this.noise.getChannelData(0);let seed=727;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;data[i]=seed/2147483648;}}
    const shard=ac.createBufferSource(),filter=ac.createBiquadFilter(),gain=envelope(.7,.16+tier*.014);
    shard.buffer=this.noise;filter.type='highpass';filter.frequency.setValueAtTime(1800+tier*350,at);
    shard.connect(filter);filter.connect(gain);gain.connect(bus);register(shard,[filter,gain],.22);
  }
}
