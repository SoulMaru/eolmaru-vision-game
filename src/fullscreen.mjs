// Real Fullscreen API state is separate from the viewport-filling application layout.
export class FullscreenController {
  constructor({doc=document,onExit=()=>{},onChange=()=>{}}={}){
    this.doc=doc;this.onExit=onExit;this.onChange=onChange;this.generation=0;this.wasActive=!!doc.fullscreenElement;this.silentExit=false;this.pending=false;this.desired=false;this.exitPromise=null;
    doc.addEventListener('fullscreenchange',()=>{
      const active=!!doc.fullscreenElement,exited=this.wasActive&&!active;this.wasActive=active;
      if(exited&&!this.silentExit)this.onExit();
      this.silentExit=false;this.onChange(active,active?'전체화면 · Esc로 나가기':'창 화면 · 전체화면 버튼으로 전환');
    });
  }
  request(){
    const generation=++this.generation;this.desired=true;
    if(this.exitPromise){this.onChange(false,'화면 전환 중이에요. 잠시 뒤 전체화면 버튼으로 다시 전환하세요.');return Promise.resolve(false);}
    if(this.doc.fullscreenElement)return Promise.resolve(true);
    if(!this.doc.fullscreenEnabled||!this.doc.documentElement.requestFullscreen){this.onChange(false,'이 창은 전체화면을 지원하지 않아요. Chrome/Edge에서 열어 주세요.');return Promise.resolve(false);}
    this.pending=true;
    let request;try{request=this.doc.documentElement.requestFullscreen({navigationUI:'hide'});}catch(error){request=Promise.reject(error);}
    return Promise.resolve(request).then(async()=>{
      if(generation!==this.generation){if(!this.desired&&this.doc.fullscreenElement){await this.exitNative();}return false;}
      this.onChange(!!this.doc.fullscreenElement,'전체화면 · Esc로 나가기');return !!this.doc.fullscreenElement;
    }).catch(()=>{if(generation===this.generation)this.onChange(false,'전체화면이 허용되지 않았어요. 왼쪽 버튼으로 다시 시도하세요.');return false;}).finally(()=>{if(generation===this.generation)this.pending=false;});
  }
  cancelPending(){this.generation++;this.pending=false;this.desired=false;}
  exitNative(){if(this.exitPromise)return this.exitPromise;if(!this.doc.fullscreenElement)return Promise.resolve();this.silentExit=true;this.exitPromise=Promise.resolve(this.doc.exitFullscreen()).catch(()=>{this.silentExit=false;}).finally(()=>{this.exitPromise=null;});return this.exitPromise;}
  exit(){this.cancelPending();return this.exitNative();}
  toggle(){if(this.doc.fullscreenElement)return this.doc.exitFullscreen().catch(()=>{});return this.request();}
}
