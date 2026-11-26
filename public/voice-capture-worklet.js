class VoiceCapture extends AudioWorkletProcessor {
  constructor(){
    super();
    this.chunk=new Int16Array(512);
    this.offset=0;
  }

  process(inputs){
    const samples=inputs[0]?.[0];
    if(!samples)return true;
    for(const sample of samples){
      const value=Math.max(-1,Math.min(1,sample));
      this.chunk[this.offset++]=value*(value<0?32768:32767);
      if(this.offset===this.chunk.length){
        this.port.postMessage(this.chunk.buffer,[this.chunk.buffer]);
        this.chunk=new Int16Array(512);
        this.offset=0;
      }
    }
    return true;
  }
}

registerProcessor('ralix-voice-capture',VoiceCapture);
