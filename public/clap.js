export function createClapDetector(onClap, count){
  let previous=-Infinity, lastHit=-Infinity, lastWake=-Infinity;
  let noise=.006, priorRms=0;
  return (samples,time)=>{
    let peak=0, energy=0, crossings=0;
    for(let i=0;i<samples.length;i++){
      const sample=samples[i];
      peak=Math.max(peak,Math.abs(sample));
      energy+=sample*sample;
      if(i&&(sample>=0)!==(samples[i-1]>=0))crossings++;
    }
    const rms=Math.sqrt(energy/samples.length);
    const transient=rms>Math.max(.013,noise*2.8,priorRms*1.38)&&
      peak>Math.max(.075,noise*6,rms*2.05)&&crossings>samples.length*.095;
    priorRms=rms;
    if(!transient){
      noise=Math.max(.002,noise*.992+Math.min(rms,noise*1.8)*.008);
      return;
    }
    if(time-lastHit<95||time-lastWake<1050)return;
    lastHit=time;
    const interval=time-previous;
    previous=time;
    if(count===1||(interval>=110&&interval<=500)){
      previous=-Infinity;
      lastWake=time;
      onClap();
    }
  };
}

export async function listenForClaps({onClap,count,active}){
  const AudioContext=window.AudioContext||window.webkitAudioContext;
  if(!AudioContext||!navigator.mediaDevices?.getUserMedia)throw new Error('Microphone capture unavailable');
  const context=new AudioContext();
  let stream, timer;
  function stop(){
    clearInterval(timer);
    stream?.getTracks().forEach(track=>track.stop());
    if(context.state!=='closed')void context.close().catch(()=>{});
  }
  try{
    if(context.state!=='running')void context.resume().catch(()=>{});
    stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true}});
    if(context.state!=='running')void context.resume().catch(()=>{});
    const analyser=context.createAnalyser();
    analyser.fftSize=1024;
    context.createMediaStreamSource(stream).connect(analyser);
    const silence=context.createGain();
    silence.gain.value=0;
    analyser.connect(silence).connect(context.destination);
    const samples=new Float32Array(analyser.fftSize);
    let detect;
    timer=setInterval(()=>{
      if(!active()||context.state!=='running'){detect=null;return;}
      detect??=createClapDetector(onClap,count);
      analyser.getFloatTimeDomainData(samples);
      detect(samples,performance.now());
    },13);
    return {stream,stop,pause:()=>void context.suspend().catch(()=>{}),resume:()=>void context.resume().catch(()=>{})};
  }catch(error){
    stop();
    throw error;
  }
}
