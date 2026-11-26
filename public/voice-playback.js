let provider, providerCheckedAt=0;
export function voiceProvider(){
  if(!provider||Date.now()-providerCheckedAt>30000){
    providerCheckedAt=Date.now();
    provider=fetch('/api/voice/status',{cache:'no-store',signal:AbortSignal.timeout(1500)})
      .then(response=>response.ok?response.json():null)
      .then(info=>info?.provider==='elevenlabs'?'elevenlabs':'browser',()=> 'browser');
  }
  return provider;
}

export function createStreamingVoice(){
  void voiceProvider();
  let cancel=null;
  let retryAfter=0;
  function stop(){
    cancel?.();
    cancel=null;
  }
  function speak(text,{onEnd,onFallback,onPlaying,language}){
    stop();
    const controller=new AbortController();
    let audio, deadline, started=false, finished=false;
    function cleanup(){
      clearTimeout(deadline);
      controller.abort();
      if(audio){
        audio.onplaying=audio.onwaiting=audio.onended=audio.onerror=null;
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
    }
    function finish(playFallback){
      if(finished)return;
      finished=true;
      cleanup();
      cancel=null;
      if(playFallback)onFallback();
      else onEnd();
    }
    function remoteUnavailable(){
      if(finished)return;
      retryAfter=Date.now()+15000;
      finish(!started);
    }
    cancel=()=>{
      finished=true;
      cleanup();
    };
    void (async()=>{
      try{
        if(Date.now()<retryAfter||await voiceProvider()!=='elevenlabs'){
          finish(true);
          return;
        }
        if(finished)return;
        deadline=setTimeout(remoteUnavailable,4500);
        const reply=await fetch('/api/voice/replies',{
          method:'POST',
          headers:{'Content-Type':'application/json','X-Jarvis-Voice':'1'},
          body:JSON.stringify({text,language}),
          signal:controller.signal,
        });
        if(!reply.ok){remoteUnavailable();return;}
        const {url}=await reply.json();
        if(finished)return;
        if(typeof url!=='string'||!url.startsWith('/api/voice/stream/')){remoteUnavailable();return;}
        audio=new Audio(url);
        audio.onplaying=()=>{started=true;clearTimeout(deadline);onPlaying?.();};
        audio.onwaiting=()=>{
          if(!started)return;
          clearTimeout(deadline);
          deadline=setTimeout(remoteUnavailable,7500);
        };
        audio.onended=()=>finish(false);
        audio.onerror=remoteUnavailable;
        await audio.play();
      }catch{
        remoteUnavailable();
      }
    })();
  }
  return {speak,stop};
}
