import { createContextBuildings } from './site-context.js';
import * as T from 'three';
import { GLTFLoader } from './vendor/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from './vendor/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from './vendor/examples/jsm/environments/RoomEnvironment.js';
import { projects } from './data.js';

const loader=new GLTFLoader();
const assets=new Map();
function asset(project){
  if(!assets.has(project.id)){
    assets.set(project.id,loader.loadAsync(project.path).catch(error=>{
      assets.delete(project.id);
      throw error;
    }));
  }
  return assets.get(project.id);
}
const locations=[[-11,0,2],[-5,0,-11],[15,0,-7],[8,0,8]];
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createScene(host,{hero=false,onSelect=()=>{},quality='high'}={}){
  let renderer;
  try { renderer=new T.WebGLRenderer({antialias:true,alpha:true}); }
  catch {
    host.classList.add('scene-poster');
    return null;
  }
  const night=hero;
  const scene=new T.Scene();
  scene.fog=new T.FogExp2(night?0x100e0b:0x141411,night?.013:.009);
  const camera=new T.PerspectiveCamera(hero?34:41,1,.1,140);
  renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='performance'?1:1.5));
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=night?1.12:1.22;
  renderer.shadowMap.enabled=quality!=='performance';
  renderer.shadowMap.type=T.PCFShadowMap;
  renderer.shadowMap.autoUpdate=false;
  renderer.shadowMap.needsUpdate=true;
  host.replaceChildren(renderer.domElement);
  const room=new RoomEnvironment();
  const pmrem=new T.PMREMGenerator(renderer);
  const environment=pmrem.fromScene(room,.04);
  scene.environment=environment.texture;
  scene.environmentIntensity=night?.49:.95;
  room.dispose();
  pmrem.dispose();
  scene.add(new T.HemisphereLight(0xc3cbd7,0x6a5240,night?.65:1.25));
  const sun=new T.DirectionalLight(0xffe4bf,night?2.2:2.8);
  sun.position.set(-4,14,8);
  sun.castShadow=renderer.shadowMap.enabled;
  sun.shadow.mapSize.set(1024,1024);
  Object.assign(sun.shadow.camera,{left:-24,right:24,top:24,bottom:-24,far:60});
  sun.shadow.normalBias=.045;
  scene.add(sun);
  const rim=new T.DirectionalLight(0x9bb5d8,night?1.6:.95);
  rim.position.set(8,12,-10);
  scene.add(rim);
  const ground=new T.Mesh(new T.PlaneGeometry(230,230),new T.MeshStandardMaterial({color:night?0x211b14:0x24211c,roughness:.83}));
  ground.rotation.x=-Math.PI/2;
  ground.position.y=-.31;
  ground.receiveShadow=true;
  scene.add(ground);
  const site=new T.Group();
  const paving=new T.MeshStandardMaterial({color:0x373029,roughness:.89});
  const inlay=new T.MeshBasicMaterial({color:0x927553,transparent:true,opacity:.55});
  function tile(width,depth,x,z,material,y){
    const mesh=new T.Mesh(new T.PlaneGeometry(width,depth),material);
    mesh.rotation.x=-Math.PI/2;
    mesh.position.set(x,y,z);
    mesh.receiveShadow=true;
    site.add(mesh);
  }
  const district=new T.MeshStandardMaterial({color:0x393833,roughness:.91});
  tile(44,33,1,-.7,district,-.307);
  tile(40,1.25,1,-10.9,paving,-.304);
  tile(40,1.2,1,10.3,paving,-.304);
  tile(1.25,27,-15.5,-.1,paving,-.305);
  tile(1.25,27,17.1,-.1,paving,-.305);
  tile(35,1.8,1.5,2,paving,-.301);
  tile(.024,1.8,-16,2,inlay,-.299);
  tile(35,.035,1.5,1.1,inlay,-.299);
  tile(35,.035,1.5,2.9,inlay,-.299);
  tile(1.7,13,-5,-5.4,paving,-.303);
  tile(1.7,10,15,-3.9,paving,-.303);
  tile(1.7,6,8,5.9,paving,-.303);
  scene.add(site);
  const platformMaterial=new T.MeshStandardMaterial({color:0x38322b,roughness:.75,metalness:.22});
  const edgeMaterial=new T.MeshStandardMaterial({color:0x826c53,roughness:.46,metalness:.47});
  const content=new T.Group();
  scene.add(content);
  const instances=new Map();
  const modelControls=new Map();
  let gestureTarget=-1;
  let held=null;
  let disposed=false, current=-2, frame, orbit, dynamic=false, dirty=true, lastRender=0;
  const monument=new T.Group();
  const podium=new T.Mesh(new T.BoxGeometry(5.9,.55,3.05),platformMaterial);
  podium.position.y=-.025;
  const reveal=new T.Mesh(new T.BoxGeometry(5.82,.052,3.0),edgeMaterial);
  reveal.position.y=.253;
  const sign=new T.Group();
  sign.position.y=1.89;
  const frameMesh=new T.Mesh(new T.BoxGeometry(4.9,3.3,.22),edgeMaterial);
  const logo=new T.TextureLoader().load('/rubberwala-logo.png',()=>{
    if(!disposed)dirty=true;
  });
  logo.colorSpace=T.SRGBColorSpace;
  logo.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
  logo.offset.set(50/441,51/332);
  logo.repeat.set(341/441,230/332);
  const face=new T.Mesh(new T.PlaneGeometry(4.7,3.10),new T.MeshBasicMaterial({map:logo,toneMapped:false}));
  face.position.z=.116;
  sign.add(frameMesh,face);
  monument.add(podium,reveal,sign);
  const context=createContextBuildings();
  scene.add(monument,context.group);

  let desiredPosition=new T.Vector3(), desiredTarget=new T.Vector3();
  let sweep=null;
  let viewAdjusted=false;
  const orbitOffset=new T.Vector3();
  const stillResolvers=new Set();
  function settle(){
    if(dynamic||(sweep&&!sweep.continuous))return;
    for(const resolve of stillResolvers)resolve();
    stillResolvers.clear();
  }
  function stopMotion(){dynamic=false;sweep=null;settle();}
  function frameCamera(target,position,animate){
    if(!orbit)return;
    sweep=null;
    desiredTarget.copy(target);
    desiredPosition.copy(position);
    dynamic=animate&&!reduceMotion;
    if(!dynamic){
      camera.position.copy(desiredPosition);
      orbit.target.copy(desiredTarget);
      orbit.update();
    }
    dirty=true;
  }
  if(!hero){
    orbit=new OrbitControls(camera,renderer.domElement);
    orbit.enablePan=false;
    orbit.enableDamping=true;
    orbit.maxPolarAngle=1.52;
    orbit.minDistance=4;
    orbit.maxDistance=95;
    orbit.addEventListener('start',()=>{viewAdjusted=true;stopMotion();});
    orbit.addEventListener('change',()=>{dirty=true;});
  }
  function render(now){
    if(disposed)return;
    frame=requestAnimationFrame(render);
    if(document.hidden)return;
    for(const item of modelControls.values()){
      if(item.landing){
        const position=item.model.position;
        if(reduceMotion||position.distanceTo(item.landing)<.018){
          position.copy(item.landing);
          item.landing=null;
        }else position.lerp(item.landing,.23);
        renderer.shadowMap.needsUpdate=true;
        dirty=true;
      }
      if(!item.stand.visible||item.amount===item.target)continue;
      const difference=item.target-item.amount;
      item.amount=reduceMotion||Math.abs(difference)<.004?item.target:item.amount+difference*.16;
      for(const section of item.sections)section.object.position.copy(section.origin).addScaledVector(section.offset,item.amount);
      renderer.shadowMap.needsUpdate=true;
      dirty=true;
    }
    if(sweep){
      sweep.start??=now;
      const elapsed=now-sweep.start;
      const progress=Math.min(1,elapsed/sweep.duration);
      sweep.offset.theta=sweep.theta+(sweep.continuous?sweep.direction*elapsed*.00065:sweep.angle*(.5-Math.cos(progress*Math.PI)*.5));
      camera.position.copy(orbit.target).add(orbitOffset.setFromSpherical(sweep.offset));
      dirty=true;
      if(!sweep.continuous&&progress===1)sweep=null;
    }
    if(dynamic){
      dirty=true;
      camera.position.lerp(desiredPosition,.09);
      orbit.target.lerp(desiredTarget,.09);
      if(camera.position.distanceTo(desiredPosition)<.035)dynamic=false;
    }
    if(hero){
      const angle=reduceMotion ? 0 : Math.sin(now*.00018)*.53;
      const fit=Math.max(1,1.48/camera.aspect);
      camera.position.set((8+angle)*fit,17.7*fit,(49-angle)*fit);
      camera.lookAt(.2,4.1,-1.7);
    } else orbit.update();
    if(dirty || (hero&&!reduceMotion&&now-lastRender>44)){
      sign.rotation.y=Math.atan2(camera.position.x,camera.position.z);
      renderer.render(scene,camera);
      dirty=false;
      lastRender=now;
    }
    settle();
  }
  function resize(){
    const {clientWidth:w,clientHeight:h}=host;
    if(!w||!h)return;
    camera.aspect=w/h;
    camera.updateProjectionMatrix();
    renderer.setSize(w,h,false);
    if(orbit&&current<0&&!viewAdjusted)reset();
    dirty=true;
  }
  const observer=new ResizeObserver(resize);
  observer.observe(host);
  function reset(animate=false){
    viewAdjusted=false;
    const point=current<0?new T.Vector3(0,0,-1.4):new T.Vector3(...locations[current]);
    const target=point.clone().add(new T.Vector3(0,current<0?3.35:4.75,0));
    const fit=current<0?Math.max(1,1.18/camera.aspect):Math.max(1,.72/camera.aspect);
    const offset=new T.Vector3(...(current<0?[5,29,49]:[8,9,17])).multiplyScalar(fit);
    frameCamera(target,point.add(offset),animate);
  }
  let generation=0;
  async function show(index=-1,animate=false){
    const run=++generation;
    const list=index<0?projects:[projects[index]];
    current=index;
    releaseModel();
    gestureTarget=index;
    monument.visible=context.group.visible=index<0;
    dirty=true;
    renderer.shadowMap.needsUpdate=true;
    reset(animate);
    for(const [key,item] of instances)item.visible=index<0||key===index;
    host.setAttribute('aria-busy','true');
    try{
      await Promise.all(list.map(async project=>{
        if(instances.has(project.index))return;
        const loaded=await asset(project);
        if(disposed || instances.has(project.index))return;
        const model=loaded.scene.clone();
        const bounds=new T.Box3().setFromObject(model);
        const originalHeight=bounds.max.y-bounds.min.y;
        const scale=project.height/originalHeight;
        const center=bounds.getCenter(new T.Vector3());
        model.scale.multiplyScalar(scale);
        model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
        model.traverse(object=>{
          if(object.isMesh){
            object.castShadow=object.receiveShadow=true;
            object.userData.project=project.index;
          }
        });
        model.rotation.y=[.2,.38,-.25,-.35][project.index];
        const stand=new T.Group();
        stand.position.set(...locations[project.index]);
        const base=new T.Mesh(new T.BoxGeometry(project.index===2?5.7:4.8,.23,4.5),platformMaterial);
        base.position.y=-.135;
        base.receiveShadow=true;
        base.userData.project=project.index;
        const trim=new T.Mesh(new T.BoxGeometry(project.index===2?5.76:4.86,.035,4.56),edgeMaterial);
        trim.position.y=-.255;
        trim.userData.project=project.index;
        stand.add(model,base,trim);
        stand.visible=current<0||project.index===current;
        content.add(stand);
        stand.updateMatrixWorld(true);
        let shell=model;
        while(shell.children.length===1&&!shell.children[0].isMesh)shell=shell.children[0];
        const parts=shell.children.map(object=>({object,center:new T.Box3().setFromObject(object).getCenter(new T.Vector3())}))
          .sort((a,b)=>a.center.y-b.center.y);
        const worldScale=shell.getWorldScale(new T.Vector3()).y||1;
        const sections=parts.map(({object},i)=>({
          object,origin:object.position.clone(),
          offset:new T.Vector3((i%2?1:-1)*i*.55,i*2.1,(i%2?1:-1)*i*.24).divideScalar(worldScale),
        }));
        modelControls.set(project.index,{stand,model,origin:model.position.clone(),sections,amount:0,target:0,landing:null,height:project.height});
        instances.set(project.index,stand);
        renderer.shadowMap.needsUpdate=true;
        dirty=true;
      }));
      if(!disposed && run===generation)host.classList.remove('scene-poster','scene-failed');
    }catch{
      if(!disposed&&run===generation)host.classList.add('scene-poster','scene-failed');
    }finally{
      if(!disposed&&run===generation)host.setAttribute('aria-busy','false');
    }
  }
  const ray=new T.Raycaster();
  function pickModel(x,y){
    ray.setFromCamera(new T.Vector2(x*2-1,1-y*2),camera);
    return ray.intersectObjects([...instances.values()].filter(item=>item.visible),true)
      .find(hit=>Number.isInteger(hit.object.userData.project))?.object.userData.project??-1;
  }
  function targetUnderHand(x,y){
    const hit=pickModel(x,y);
    if(hit>=0)return hit;
    let nearest=-1, distance=.16;
    for(const [id,item] of modelControls){
      if(!item.stand.visible)continue;
      const center=item.stand.position.clone().add(item.model.position);
      for(const fraction of [.24,.5,.77]){
        const point=center.clone().add(new T.Vector3(0,item.height*fraction,0)).project(camera);
        if(point.z>1||point.z< -1)continue;
        const d=Math.hypot(x-(point.x+1)/2,y-(1-point.y)/2);
        if(d<distance){distance=d;nearest=id;}
      }
    }
    return nearest;
  }
  function releaseModel(hover=false){
    if(!held)return;
    if(!hover)held.item.landing=held.item.model.position.clone().setY(held.item.origin.y);
    held=null;
    dirty=true;
    renderer.shadowMap.needsUpdate=true;
  }
  function grabModel(x,y){
    const id=current>=0?current:targetUnderHand(x,y);
    const item=modelControls.get(id);
    if(!item)return -1;
    stopMotion();
    gestureTarget=id;
    item.landing=null;
    held={item,x,y,start:item.model.position.clone()};
    item.model.position.y=item.origin.y+.65;
    dirty=true;
    return id;
  }
  function moveModel(x,y){
    if(!held)return;
    const right=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,0).setY(0).normalize();
    const movement=Math.min(36,Math.max(14,camera.position.distanceTo(orbit.target)*.74));
    const model=held.item.model;
    model.position.copy(held.start).addScaledVector(right,(x-held.x)*movement);
    model.position.y=held.item.origin.y+T.MathUtils.clamp(.65+(held.y-y)*movement,.25,10);
    dirty=true;
    renderer.shadowMap.needsUpdate=true;
  }
  function separateModel(expand,x,y){
    const id=current>=0?current:gestureTarget>=0?gestureTarget:Number.isFinite(x)&&Number.isFinite(y)?targetUnderHand(x,y):-1;
    const item=modelControls.get(id);
    if(!item||item.sections.length<2)return -1;
    gestureTarget=id;
    item.target=expand?1:0;
    if(!expand)item.landing=item.origin.clone();
    renderer.shadowMap.needsUpdate=true;
    dirty=true;
    return id;
  }
  let pointer;
  if(orbit){
    host.tabIndex=0;
    host.setAttribute('aria-label','Interactive building models. Use arrow keys to orbit.');
    host.onkeydown=event=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
      event.preventDefault();
      viewAdjusted=true;
      stopMotion();
      const sphere=new T.Spherical().setFromVector3(camera.position.clone().sub(orbit.target));
      if(event.key==='ArrowLeft')sphere.theta-=.15;
      if(event.key==='ArrowRight')sphere.theta+=.15;
      if(event.key==='ArrowUp')sphere.phi-=.12;
      if(event.key==='ArrowDown')sphere.phi+=.12;
      sphere.phi=T.MathUtils.clamp(sphere.phi,.1,orbit.maxPolarAngle);
      camera.position.copy(orbit.target).add(new T.Vector3().setFromSpherical(sphere));
      orbit.update();
    };
  }
  renderer.domElement.addEventListener('pointerdown',event=>{pointer=[event.clientX,event.clientY];});
  renderer.domElement.addEventListener('pointerup',event=>{
    if(hero||!pointer||Math.hypot(event.clientX-pointer[0],event.clientY-pointer[1])>5)return;
    const rect=renderer.domElement.getBoundingClientRect();
    const id=pickModel((event.clientX-rect.left)/rect.width,(event.clientY-rect.top)/rect.height);
    if(id>=0)onSelect(id);
  });
  host.classList.add('scene-poster');
  resize();
  frame=requestAnimationFrame(render);
  return {show,reset:()=>reset(true),stopMotion,grabModel,moveModel,releaseModel,separateModel,whenStill(){
    return new Promise(resolve=>{stillResolvers.add(resolve);settle();});
  },zoom(factor,animate=false){
    if(!orbit)return;
    viewAdjusted=true;
    const target=(dynamic?desiredTarget:orbit.target).clone();
    const delta=(dynamic?desiredPosition:camera.position).clone().sub(target);
    frameCamera(target,target.clone().add(delta.setLength(T.MathUtils.clamp(delta.length()*factor,orbit.minDistance,orbit.maxDistance))),animate);
  },spin(direction,degrees,continuous){
    if(!orbit)return;
    viewAdjusted=true;
    stopMotion();
    const offset=new T.Spherical().setFromVector3(orbitOffset.copy(camera.position).sub(orbit.target));
    const sign=direction==='left'?1:-1;
    const angle=T.MathUtils.degToRad(degrees)*sign;
    if(reduceMotion){
      offset.theta+=angle;
      camera.position.copy(orbit.target).add(orbitOffset.setFromSpherical(offset));
      orbit.update();
      dirty=true;
    }else sweep={start:null,offset,theta:offset.theta,angle,direction:sign,continuous,duration:Math.max(850,degrees*18)};
  },top(){
    if(!orbit)return;
    viewAdjusted=true;
    const target=orbit.target.clone();
    const radius=camera.position.distanceTo(target);
    frameCamera(target,target.clone().add(new T.Vector3(0,radius*.995,radius*.1)),true);
  },focusLogo(){
    viewAdjusted=true;
    frameCamera(new T.Vector3(0,1.7,0),new T.Vector3(1.8,5.1,13),true);
  },dispose(){
    disposed=true;
    stopMotion();
    cancelAnimationFrame(frame);
    observer.disconnect();
    orbit?.dispose();
    environment.dispose();
    ground.geometry.dispose();
    ground.material.dispose();
    for(const tile of site.children)tile.geometry.dispose();
    paving.dispose();
    district.dispose();
    inlay.dispose();
    monument.traverse(object=>object.geometry?.dispose());
    face.material.dispose();
    logo.dispose();
    context.dispose();
    platformMaterial.dispose();
    edgeMaterial.dispose();
    for(const stand of instances.values())for(const platform of stand.children.slice(1))platform.geometry.dispose();
    sun.shadow.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    host.onkeydown=null;
    host.replaceChildren();
  }};
}







