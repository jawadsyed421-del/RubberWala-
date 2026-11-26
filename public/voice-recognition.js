const url='wss://api.elevenlabs.io/v1/speech-to-text/realtime';

export class StreamingRecognition {
  constructor(getStream){
    this.getStream=getStream;
  }

  start(){
    const controller=new AbortController();
    this.controller=controller;
    this.connect(controller).catch(error=>{
      if(!controller.signal.aborted)this.fail(error.name==='NotAllowedError'?'audio-capture':'network');
    });
  }

  async connect(controller){
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    if(!AudioContext)throw new Error('Audio capture unavailable');
    const context=new AudioContext({sampleRate:16000});
    this.context=context;
    void context.resume().catch(()=>{});
    const canUseWorklet=window.AudioWorkletNode&&context.audioWorklet;
    const worklet=canUseWorklet?context.audioWorklet.addModule('/voice-capture-worklet.js').then(()=>true,()=>false):Promise.resolve(false);
    const tokenRequest=fetch('/api/voice/recognition-token',{
      method:'POST',headers:{'X-Jarvis-Voice':'1'},signal:controller.signal,
    });
    void tokenRequest.catch(()=>{});
    let stream=this.getStream();
    if(!stream){
      stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
      if(controller.signal.aborted){stream.getTracks().forEach(track=>track.stop());return;}
      this.ownedStream=stream;
    }
    void context.resume().catch(()=>{});
    const [reply,useWorklet]=await Promise.all([tokenRequest,worklet]);
    if(controller.signal.aborted)return;
    if(!reply.ok){
      this.fail(reply.status===403?'service-not-allowed':'network');
      return;
    }
    const {token}=await reply.json();
    if(controller.signal.aborted)return;
    const params=new URLSearchParams({
      token,model_id:'scribe_v2_realtime',audio_format:'pcm_16000',
      language_code:'en',commit_strategy:'vad',vad_silence_threshold_secs:'.48',
    });
    const socket=new WebSocket(url+'?'+params);
    this.socket=socket;
    socket.onmessage=event=>{
      if(controller.signal.aborted)return;
      const item=JSON.parse(event.data);
      if(item.message_type==='session_started'){
        try{this.attach(stream,context,socket,useWorklet);}
        catch{this.fail('audio-capture');return;}
        this.onstart?.();
      }else if(['partial_transcript','committed_transcript'].includes(item.message_type)&&item.text?.trim()&&!this.paused){
        this.onresult?.({resultIndex:0,results:[Object.assign([{transcript:item.text}],{isFinal:item.message_type==='committed_transcript'})]});
      }else if(item.message_type==='session_time_limit_exceeded'){
        this.abort();
      }else if(item.message_type?.includes('error')||['quota_exceeded','invalid_request','unaccepted_terms','rate_limited','insufficient_audio_activity','resource_exhausted'].includes(item.message_type)){
        const permanent=['auth_error','quota_exceeded','invalid_request','unaccepted_terms'].includes(item.message_type);
        this.fail(permanent?'service-not-allowed':'network');
      }
    };
    socket.onerror=()=>this.fail('network');
    socket.onclose=()=>this.abort();
  }

  attach(stream,context,socket,useWorklet){
    const source=context.createMediaStreamSource(stream);
    const send=buffer=>{
      if(this.paused||socket.readyState!==WebSocket.OPEN)return;
      if(socket.bufferedAmount>128000){
        this.fail('network');
        return;
      }
      const audio=btoa(String.fromCharCode(...new Uint8Array(buffer)));
      socket.send(JSON.stringify({message_type:'input_audio_chunk',audio_base_64:audio,sample_rate:16000,commit:false}));
    };
    if(useWorklet){
      const processor=new AudioWorkletNode(context,'ralix-voice-capture',{channelCount:1,channelCountMode:'explicit'});
      processor.port.onmessage=event=>send(event.data);
      source.connect(processor);
      processor.connect(context.destination);
      return;
    }
    const processor=context.createScriptProcessor(1024,1,1);
    source.connect(processor);
    processor.connect(context.destination);
    processor.onaudioprocess=event=>{
      if(this.paused||socket.readyState!==WebSocket.OPEN||socket.bufferedAmount>128000)return;
      const samples=event.inputBuffer.getChannelData(0);
      const pcm=new DataView(new ArrayBuffer(samples.length*2));
      for(let i=0;i<samples.length;i++){
        const sample=Math.max(-1,Math.min(1,samples[i]));
        pcm.setInt16(i*2,sample*(sample<0?32768:32767),true);
      }
      send(pcm.buffer);
    };
  }

  pause(){this.paused=true;}
  resume(){this.paused=false;}

  fail(error){
    if(this.controller?.signal.aborted)return;
    this.onerror?.({error});
    this.abort();
  }

  abort(){
    if(!this.controller||this.controller.signal.aborted)return;
    this.controller.abort();
    this.ownedStream?.getTracks().forEach(track=>track.stop());
    if(this.socket){
      this.socket.onmessage=this.socket.onerror=this.socket.onclose=null;
      this.socket.close();
    }
    if(this.context?.state!=='closed')void this.context?.close().catch(()=>{});
    queueMicrotask(()=>this.onend?.());
  }
}
