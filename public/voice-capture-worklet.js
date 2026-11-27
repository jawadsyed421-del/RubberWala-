class VoiceCapture extends AudioWorkletProcessor {
  constructor(){
    super();
    this.chunk=new Int16Array(512);
    this.offset=0;
    this.position=0;
  }

  process(inputs){
    const samples=inputs[0]?.[0];
    if(!samples)return true;
    const ratio=sampleRate/16000;
    for(;this.position<samples.length;this.position+=ratio){
      const sample=samples[Math.floor(this.position)];
      const value=Math.max(-1,Math.min(1,sample));
      this.chunk[this.offset++]=value*(value<0?32768:32767);
      if(this.offset===this.chunk.length){
        this.port.postMessage(this.chunk.buffer,[this.chunk.buffer]);
        this.chunk=new Int16Array(512);
        this.offset=0;
      }
    }
    this.position-=samples.length;
    return true;
  }
}

registerProcessor('ralix-voice-capture',VoiceCapture);
