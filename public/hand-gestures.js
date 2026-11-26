const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0));

export function describeHand(points,pinching=false){
  if(!points||points.length<21)return {pose:'none'};
  const wrist=points[0], palm=Math.max(dist(wrist,points[9]),.025);
  const extended=[8,12,16,20].filter(tip=>dist(wrist,points[tip])>dist(wrist,points[tip-2])*1.13).length;
  const pinch=dist(points[4],points[8])/palm<(pinching?.52:.37)&&dist(wrist,points[8])>palm*.92;
  const pose=pinch?'pinch':extended===4?'open':extended===0?'fist':'aim';
  const pointer=pinch?{x:(points[4].x+points[8].x)/2,y:(points[4].y+points[8].y)/2}:points[8];
  return {pose,x:1-pointer.x,y:pointer.y};
}

export function createGestureDriver(scene,{onMessage,onPoint}){
  let held=false, previous='', candidate='', stable=0;
  let pointer=null, missing=0, lastPalm=null, tracking=false;
  function release(hover=false){
    if(held)scene.releaseModel(hover);
    held=false;
  }
  function update(input){
    const hands=Array.isArray(input?.[0])?input:input?.length?[input]:[];
    if(!hands.length){
      if(++missing<4)return;
      release();
      candidate=previous='';
      stable=0;
      pointer=null;
      lastPalm=null;
      onPoint(null);
      if(tracking){tracking=false;onMessage('Hand out of view. Show your hand to the camera again.');}
      return;
    }
    missing=0;
    const options=hands.map(points=>({points,palm:points[9],hand:describeHand(points,held)}));
    const primary=lastPalm?options.reduce((a,b)=>dist(a.palm,lastPalm)<dist(b.palm,lastPalm)?a:b):
      options.find(item=>item.hand.pose==='pinch')||options[0];
    lastPalm=primary.palm;
    const hand=primary.hand;
    if(!tracking){tracking=true;onMessage('Hand detected. Pinch over a tower to lift it.');}
    const clamped={x:Math.max(0,Math.min(1,hand.x)),y:Math.max(0,Math.min(1,hand.y))};
    pointer=pointer?{x:pointer.x+(clamped.x-pointer.x)*.42,y:pointer.y+(clamped.y-pointer.y)*.42}:clamped;
    onPoint(pointer,held?'holding':hand.pose);
    if(hand.pose!==candidate){candidate=hand.pose;stable=1;}
    else stable++;
    if(stable>=(candidate==='open'||candidate==='fist'?4:2)&&candidate!==previous){
      previous=candidate;
      if(previous==='pinch'){
        held=scene.grabModel(pointer.x,pointer.y)>=0;
        onMessage(held?'Building held. Raise your hand to lift it, or move left and right.':'Aim the dot at a tower, or select one from the list.');
      }else{
        release(previous==='open');
        if(previous==='open'||previous==='fist'){
          const expand=previous==='open';
          if(scene.separateModel(expand,pointer.x,pointer.y)>=0)onMessage(expand?'Building sections separated. Make a fist to reassemble.':'Building reassembled and returned to its original position.');
          else onMessage('Select a tower, then open your palm or make a fist.');
        }
      }
    }
    if(held&&hand.pose==='pinch')scene.moveModel(pointer.x,pointer.y);
  }
  return {update,release};
}

export async function startHandTracking({video,signal,onFrame,onError}){
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera unavailable');
  const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},facingMode:'user'},audio:false});
  let tracker, animation, stopped=false;
  function stop(){
    if(stopped)return;
    stopped=true;
    cancelAnimationFrame(animation);
    stream.getTracks().forEach(track=>track.stop());
    tracker?.close();
    video.srcObject=null;
    signal.removeEventListener('abort',stop);
  }
  if(signal.aborted){stop();return;}
  signal.addEventListener('abort',stop,{once:true});
  try{
    const base='/vendor/hand-tracking/';
    const {FilesetResolver,HandLandmarker}=await import(base+'vision_bundle.mjs');
    const files=await FilesetResolver.forVisionTasks(base+'wasm');
    if(stopped)return;
    tracker=await HandLandmarker.createFromOptions(files,{
      baseOptions:{modelAssetPath:base+'hand_landmarker.task',delegate:'CPU'},
      runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.5,
    });
    if(stopped){tracker.close();return;}
    video.srcObject=stream;
    await video.play();
    if(stopped)return;
    let lastFrame=-1,lastInference=-Infinity;
    function frame(now){
      if(stopped)return;
      if(video.readyState>=2&&video.currentTime!==lastFrame&&now-lastInference>=48){
        lastFrame=video.currentTime;
        lastInference=now;
        try{onFrame(tracker.detectForVideo(video,now).landmarks);}
        catch(error){stop();onError(error);return;}
      }
      animation=requestAnimationFrame(frame);
    }
    animation=requestAnimationFrame(frame);
    return stop;
  }catch(error){stop();throw error;}
}
