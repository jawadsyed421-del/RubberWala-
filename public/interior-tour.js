import * as T from 'three';
import { interiorLayouts } from './interior-layouts.js';

const wallHeight=2.95;
const eyeHeight=1.64;

export function createInterior(host,slug,{onRoomChange=()=>{}}={}){
  const layout=interiorLayouts[slug];
  if(!layout)throw new Error('Unknown interior');
  const renderer=new T.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.65));
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.06;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.autoUpdate=false;
  const scene=new T.Scene();
  scene.background=new T.Color(0x231610);
  const camera=new T.PerspectiveCamera(67,1,.04,90);
  camera.rotation.order='YXZ';
  const geometry=new T.BoxGeometry(1,1,1);
  const cylinder=new T.CylinderGeometry(.5,.5,1,40);
  const cushion=new T.SphereGeometry(.5,28,16);
  const textures=[];
  const materials=[];
  const finish=(color,roughness=.76,metalness=0)=>{
    const mat=new T.MeshStandardMaterial({color,roughness,metalness});materials.push(mat);return mat;
  };
  const plaster=finish(0xe2d1bc), ceiling=finish(0xddcfbb), trim=finish(0x715142);
  const wood=finish(0x9b7656), grain=finish(0x866344), marble=finish(0xd7c4ad,.45);
  const seam=finish(0xaf9a82), ivory=finish(0xe7d3bc), bronze=finish(0xbf9a63,.35,.55);
  const charcoal=finish(0x302c2b), linen=finish(0xcabc9f), accent=finish(layout.accent), plant=finish(0x456248);
  const railing=new T.MeshStandardMaterial({color:0xb7b9aa,transparent:true,opacity:.26,roughness:.18,metalness:.21,depthWrite:false});
  materials.push(railing);
  function woodgrain(){
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#cbb096';ctx.fillRect(0,0,256,256);
    for(let i=0;i<150;i++){
      const y=i*256/150;
      ctx.strokeStyle=i%3===0?'#77604c55':'#f4dfbd60';
      ctx.beginPath();ctx.moveTo(0,y);
      ctx.bezierCurveTo(82,y+Math.sin(i)*6,172,y+Math.cos(i)*5,256,y);ctx.stroke();
    }
    const texture=new T.CanvasTexture(canvas);
    texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;textures.push(texture);
    return texture;
  }
  wood.map=woodgrain();
  const light=new T.MeshBasicMaterial({color:0xffe0a6});materials.push(light);
  const sky=new T.MeshBasicMaterial({color:0xa7c0ce});materials.push(sky);
  const skyline=document.createElement('canvas');
  skyline.width=512;skyline.height=256;
  const vista=skyline.getContext('2d');
  const dusk=vista.createLinearGradient(0,0,0,256);
  dusk.addColorStop(0,'#91a6ba');dusk.addColorStop(.63,'#e6bd9b');dusk.addColorStop(1,'#b59382');
  vista.fillStyle=dusk;vista.fillRect(0,0,512,256);
  for(let i=0;i<29;i++){
    const x=i*19, height=20+(i*47)%88;
    vista.fillStyle=['#596673','#79848c','#8f9194'][i%3];
    vista.fillRect(x,256-height,12+(i*13)%17,height);
    vista.fillStyle='#dec0a0';
    for(let row=5;row<height;row+=8)vista.fillRect(x+4,256-height+row,2,2);
  }
  const viewTexture=new T.CanvasTexture(skyline);
  viewTexture.colorSpace=T.SRGBColorSpace;
  const windowMaterial=new T.MeshBasicMaterial({map:viewTexture});materials.push(windowMaterial);
  const wallBoxes=[], cutWalls=[], ceilings=[];
  const obstacles=[];
  const walkable=[];
  const rooms=[];
  function box(x,y,z,w,h,d,mat,meshGeometry=geometry){
    const object=new T.Mesh(meshGeometry,mat);
    object.position.set(x,y,z);object.scale.set(w,h,d);
    object.castShadow=h>.095;object.receiveShadow=true;scene.add(object);return object;
  }
  function solid(x,z,w,d,h,mat,y=0,block=true){
    box(x,y+h/2,z,w,h,d,mat);
    if(block)obstacles.push([x-w/2,x+w/2,z-d/2,z+d/2]);
  }
  function wall(x,z,w,d,cutHeight=1.1){
    if(w<=0||d<=0)return;
    cutWalls.push({mesh:box(x,wallHeight/2,z,w,wallHeight,d,plaster),cutHeight});
    box(x,.07,z,w+.025,.14,d+.025,trim);
    wallBoxes.push([x-w/2,x+w/2,z-d/2,z+d/2]);
  }
  function floor(x,z,w,d,tile){
    box(x,-.07,z,w,.14,d,tile?marble:wood);
    const spacing=tile?1:.46;
    for(let offset=spacing;offset<w;offset+=spacing)box(x-w/2+offset,.002,z,.014,.004,d,tile?seam:grain);
    if(tile)for(let offset=spacing;offset<d;offset+=spacing)box(x,.002,z-d/2+offset,w,.004,.014,seam);
    ceilings.push(box(x,wallHeight+.06,z,w,.13,d,ceiling));
  }
  function windowWall(x,z,w){
    const opening=w*.64;
    wall(x-(w+opening)/4,z,(w-opening)/2,.12,wallHeight);
    wall(x+(w+opening)/4,z,(w-opening)/2,.12,wallHeight);
    box(x,.45,z,opening,.9,.12,plaster);
    box(x,2.72,z,opening,.46,.12,plaster);
    box(x,1.64,z,opening,1.55,.035,windowMaterial);
    for(const y of [.9,2.41])box(x,y,z,opening+.06,.055,.15,bronze);
    for(const fraction of [-.5,-.17,.17,.5])box(x+opening*fraction,1.66,z,.057,1.55,.15,bronze);
    box(x,.91,z,opening+.15,.07,.25,marble);
    for(const edge of [-1,1]){
      for(let fold=0;fold<4;fold++)box(x+edge*(opening*.5+fold*.076),1.56,z+.075,.092,2.51,.14,linen);
    }
  }
  function lamp(x,z){
    ceilings.push(box(x,2.82,z,.68,.12,.27,trim));
    ceilings.push(box(x,2.75,z,.61,.02,.21,light));
  }
  function greenery(x,z){
    box(x,.185,z,.38,.37,.38,bronze,cylinder);
    box(x,.62,z,.08,.58,.08,grain);
    for(let i=0;i<9;i++){
      const angle=i*2.4;
      const dx=Math.cos(angle)*.17,dz=Math.sin(angle)*.17;
      const leaf=box(x+dx,.62+(i%4)*.095,z+dz,.33,.066,.155,plant,cushion);
      leaf.rotation.set(0,angle,dx*1.8);
    }
  }
  function furnish(room){
    const {name,x,z,side,w,d}=room;
    const back=z+side*(d/2-.7);
    const seating=/Living|Lounge/.test(name);
    if(/Terrace|Balcony/.test(name)){
      box(x,.3,z,.31,.6,.31,wood,cylinder);
      box(x,.61,z,.61,.068,.61,marble,cylinder);
      for(const side of [-1,1]){
        box(x+side*.69,.29,z,.55,.51,.54,wood,cylinder);
        box(x+side*.69,.53,z,.5,.18,.5,linen,cushion);
        box(x+side*.91,.59,z,.16,.56,.53,wood,cushion);
      }
      greenery(x-w*.38,z);greenery(x+w*.38,z);
      return;
    }
    if(/Bedroom/.test(name)){
      solid(x,back-side*.58,1.75,2.05,.35,wood);
      solid(x,back-side*.58,1.7,2,.21,ivory,.35,false);
      box(x,.8,back+side*.39,1.85,.98,.13,accent);
      for(const p of [-.42,.42]){
        box(x+p,.64,back+side*.12,.74,.19,.43,linen,cushion);
        box(x+p*2.65,.24,back,.48,.48,.47,wood);
        box(x+p*2.65,.59,back,.23,.23,.23,light,cylinder);
      }
      box(x,.58,back-side*.97,1.69,.08,.91,accent);
      solid(x+w*.37,z,.48,1.48,2.25,wood);
      return;
    }
    if(/Kitchen|Bathroom|Restroom/.test(name)){
      solid(x,back,w*.78,.59,.88,wood);
      box(x,.92,back,w*.8,.075,.64,marble);
      box(x-.25,.966,back,.55,.028,.35,charcoal);
      box(x-.25,1.1,back+.2,.032,.25,.034,bronze);
      if(name==='Kitchen'){
        box(x,1.95,back+.12,w*.73,.58,.34,wood);
        solid(x,z,.62,1.17,.86,accent);
        box(x,.91,z,.67,.071,1.23,marble);
      }else{
        box(x,1.62,back+.18,.9,.65,.035,bronze);
        box(x,1.62,back+.14,.82,.57,.029,sky);
        solid(x-w*.28,z,.5,.66,.46,ivory);
      }
      return;
    }
    if(seating){
      box(x,.017,z,Math.min(w*.7,2.65),.018,1.56,linen);
      solid(x,back,Math.min(w*.74,2.85),.86,.42,accent);
      box(x,.69,back+side*.34,Math.min(w*.72,2.78),.55,.22,accent);
      for(const dx of [-.61,0,.61])box(x+dx,.54,back,.55,.24,.58,linen,cushion);
      for(const dx of [-1.13,1.13])box(x+dx,.62,back,.19,.39,.79,accent);
      box(x,.22,z,.42,.44,.4,wood,cylinder);
      box(x,.43,z,1.03,.083,.76,wood,cylinder);
      obstacles.push([x-.49,x+.49,z-.36,z+.36]);
      box(x+.21,.455,z,.28,.045,.23,trim);
      box(x-.19,.49,z-.1,.115,.15,.11,bronze);
      box(x-w/2+.075,1.64,z,.09,.81,1.17,trim);
      box(x-w/2+.129,1.64,z,.023,.7,1.05,ivory);
      box(x-w/2+.15,1.61,z-.05,.018,.39,.62,accent).rotation.x=.32;
      greenery(x+w*.37,back);
      return;
    }
    if(/Dining/.test(name)){
      solid(x,z,1.52,.85,.73,wood);
      box(x,.74,z,1.59,.07,.94,marble);
      for(const dx of [-.55,.55])for(const dz of [-.68,.68]){
        solid(x+dx,z+dz,.47,.43,.47,accent);
        box(x+dx,.62,z+dz*1.26,.47,.29,.07,accent);
      }
      return;
    }
    if(/concourse/.test(name)){
      box(x,.08,z,1.55,.16,1.55,marble,cylinder);
      greenery(x,z);return;
    }
    for(const dx of [-w*.33,w*.33]){
      solid(x+dx,back,.72,.6,1.74,wood);
      for(let shelf=1;shelf<4;shelf++)box(x+dx,.33+shelf*.36,back,.76,.06,.65,bronze);
    }
    solid(x,z,1.5,.69,.92,accent);
    box(x,.95,z,1.56,.06,.73,marble);
  }

  const maxX=Math.max(...layout.rooms.map(([,x,,w])=>x+w));
  const maxZ=Math.max(...layout.rooms.map(([,,z,,d])=>z+d));
  const center=new T.Vector3(maxX/2,.47,maxZ/2);
  const exterior=[];
  for(const [name,startX,startZ,w,d] of layout.rooms){
    const x=startX+w/2,z=startZ+d/2;
    const outdoor=/Balcony|Terrace/.test(name);
    floor(x,z,w,d,/Kitchen|Bathroom|Restroom|Retail|Boutique|concourse/.test(name));
    if(outdoor)ceilings.at(-1).userData.outdoor=true;
    walkable.push([startX,startX+w,startZ,startZ+d]);
    exterior.push([startX,startZ,startX+w,startZ],[startX,startZ+d,startX+w,startZ+d],
      [startX,startZ,startX,startZ+d],[startX+w,startZ,startX+w,startZ+d]);
    const side=/Bedroom|Living/.test(name)?-1:startZ>maxZ*.36?-1:1;
    const room={name,x,z,side,w,d,spawnZ:z-side*d*.33};
    furnish(room);
    if(!outdoor)lamp(x,z);
    rooms.push(room);
  }
  const inside=(x,z)=>walkable.some(([a,b,c,d])=>x>a&&x<b&&z>c&&z<d);
  const seen=new Set();
  for(const [x1,z1,x2,z2] of exterior){
    const horizontal=z1===z2;
    const start=horizontal?x1:z1,end=horizontal?x2:z2,axis=horizontal?z1:x1;
    const boundaries=[start,end,...walkable.flatMap(([a,b,c,d])=>horizontal?[a,b]:[c,d]).filter(n=>n>start+.001&&n<end-.001)];
    const values=[...new Set(boundaries)].sort((a,b)=>a-b);
    for(let i=1;i<values.length;i++){
      const length=values[i]-values[i-1],mid=(values[i]+values[i-1])/2;
      const x=horizontal?mid:axis,z=horizontal?axis:mid;
      const edge=[x.toFixed(3),z.toFixed(3),horizontal].join(':');
      const offset=horizontal?[0,.03]:[.03,0];
      if(seen.has(edge)||inside(x+offset[0],z+offset[1])===inside(x-offset[0],z-offset[1]))continue;
      seen.add(edge);
      if(horizontal&&Math.abs(axis-maxZ)<.03){
        if(layout.oval){
          const steps=18;
          const xStart=values[i-1];
          const point=t=>[xStart+length*t,z-.46*(1-Math.sin(Math.PI*t))];
          for(let j=0;j<steps;j++){
            const [ax,az]=point(j/steps),[bx,bz]=point((j+1)/steps);
            const width=Math.hypot(bx-ax,bz-az),angle=Math.atan2(az-bz,bx-ax);
            box((ax+bx)/2,.46,(az+bz)/2,width,.82,.035,railing).rotation.y=angle;
            box((ax+bx)/2,.9,(az+bz)/2,width,.044,.067,bronze).rotation.y=angle;
            if(j%2===0)box(ax,.45,az,.042,.9,.05,bronze);
          }
          continue;
        }
        box(x,.46,z,length,.82,.035,railing);
        box(x,.9,z,length,.044,.067,bronze);
        for(let post=0;post<=length;post+=.85)box(values[i-1]+post,.45,z,.043,.9,.05,bronze);
      }else if(horizontal&&axis<maxZ*.24&&length>2.1&&
        rooms.some(room=>Math.abs(x-room.x)<room.w*.5&&Math.abs(z-room.z)<room.d*.5+.04&&!/Kitchen|Bathroom/.test(room.name))){
        windowWall(x,z,length);
      }else wall(x,z,horizontal?length:.12,horizontal?.12:length,axis<1&&horizontal?2.48:.79);
    }
  }
  for(const [x1,z1,x2,z2] of layout.walls){
    wall((x1+x2)/2,(z1+z2)/2,Math.abs(x2-x1)||.115,Math.abs(z2-z1)||.115,1.05);
  }

  scene.add(new T.HemisphereLight(0xffeee0,0xaf8b72,1.9));
  const key=new T.DirectionalLight(0xffe3bf,2.35);
  key.position.set(center.x-5,13,center.z+2);
  key.target.position.copy(center);
  key.castShadow=true;
  key.shadow.mapSize.set(1536,1536);
  Object.assign(key.shadow.camera,{left:-11,right:11,top:11,bottom:-11,near:.5,far:35});
  key.shadow.normalBias=.026;key.shadow.bias=-.00025;
  scene.add(key,key.target);
  const fill=new T.DirectionalLight(0xffeee5,.54);
  fill.position.set(8,5,-4);scene.add(fill);
  const canvas=renderer.domElement;
  canvas.tabIndex=0;
  canvas.setAttribute('aria-label','Interactive interior. Drag to look. Use W A S D to walk or the arrow keys to turn.');
  host.replaceChildren(canvas);
  const events=new AbortController();
  const options={signal:events.signal};
  const keys=new Set();
  let yaw=0,pitch=0,pointer=null,dragPoint=null,frame=0,last=0,current=-3,disposed=false,overview=true;
  let orbitAngle=layout.oval?-.09:-.19,orbitHeight=.68,orbitScale=1;
  function identifyRoom(){
    const {x,z}=camera.position;
    const next=overview?-2:rooms.findIndex(room=>Math.abs(x-room.x)<room.w/2&&Math.abs(z-room.z)<room.d/2);
    if(current!==next){current=next;onRoomChange(next,next===-2?'3D cutaway':next<0?'Entrance':rooms[next].name);}
  }
  function paint(){
    if(disposed)return;
    if(overview){
      const distance=Math.max(maxX,maxZ)*1.08*orbitScale*Math.max(1,.82/camera.aspect);
      const horizontal=Math.cos(orbitHeight)*distance;
      camera.position.set(center.x+Math.sin(orbitAngle)*horizontal,center.y+Math.sin(orbitHeight)*distance,center.z+Math.cos(orbitAngle)*horizontal);
      camera.lookAt(center);
    }else camera.rotation.set(pitch,yaw,0,'YXZ');
    renderer.render(scene,camera);
    identifyRoom();
  }
  function look(dx,dy){
    if(overview){
      orbitAngle-=dx;
      orbitHeight=T.MathUtils.clamp(orbitHeight+dy,.25,1.43);
    }else{
      yaw-=dx;
      pitch=T.MathUtils.clamp(pitch-dy,-1.25,1.25);
    }
  }
  function allowed(x,z){
    if(!walkable.some(([a,b,c,d])=>x>=a&&x<=b&&z>=c&&z<=d))return false;
    return ![...wallBoxes,...obstacles].some(([a,b,c,d])=>x>a-.14&&x<b+.14&&z>c-.14&&z<d+.14);
  }
  function step(forward,right){
    if(overview){
      orbitScale=T.MathUtils.clamp(orbitScale-forward*.17,.57,1.75);
      orbitAngle-=right*.18;return;
    }
    const x=-Math.sin(yaw)*forward+Math.cos(yaw)*right;
    const z=-Math.cos(yaw)*forward-Math.sin(yaw)*right;
    if(allowed(camera.position.x+x,camera.position.z))camera.position.x+=x;
    if(allowed(camera.position.x,camera.position.z+z))camera.position.z+=z;
  }
  function tick(now){
    frame=0;
    if(!keys.size||disposed)return;
    const delta=last?Math.min(.04,(now-last)/1000):.016;
    last=now;
    const has=key=>Number(keys.has(key));
    look((has('ArrowRight')-has('ArrowLeft'))*delta*1.35,(has('ArrowDown')-has('ArrowUp'))*delta);
    step((has('KeyW')-has('KeyS'))*delta*2.15,(has('KeyD')-has('KeyA'))*delta*2.15);
    paint();
    frame=requestAnimationFrame(tick);
  }
  function release(){keys.clear();last=0;}
  canvas.addEventListener('keydown',event=>{
    if(!['KeyW','KeyA','KeyS','KeyD','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.code))return;
    event.preventDefault();keys.add(event.code);
    if(!frame)frame=requestAnimationFrame(tick);
  },options);
  window.addEventListener('keyup',event=>{keys.delete(event.code);if(!keys.size)last=0;},options);
  canvas.addEventListener('blur',release,options);
  window.addEventListener('blur',release,options);
  canvas.addEventListener('pointerdown',event=>{
    if(!event.isPrimary||event.button!==0)return;
    pointer=event.pointerId;dragPoint=[event.clientX,event.clientY];
    canvas.setPointerCapture(pointer);canvas.focus({preventScroll:true});
  },options);
  canvas.addEventListener('pointermove',event=>{
    if(event.pointerId!==pointer)return;
    const previous=dragPoint;
    dragPoint=[event.clientX,event.clientY];
    if(previous){look((event.clientX-previous[0])*.0045,(event.clientY-previous[1])*.0045);paint();}
  },options);
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{pointer=null;dragPoint=null;},options);
  canvas.addEventListener('wheel',event=>{
    if(!overview||document.activeElement!==canvas)return;
    event.preventDefault();
    orbitScale=T.MathUtils.clamp(orbitScale+event.deltaY*.001,.57,1.75);
    paint();
  },{...options,passive:false});
  const observer=new ResizeObserver(()=>{
    const {clientWidth:w,clientHeight:h}=host;
    if(!h||!w)return;
    renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();paint();
  });
  observer.observe(host);
  function visit(index){
    overview=index===-2;
    for(const ceiling of ceilings)ceiling.visible=!overview&&!ceiling.userData.outdoor;
    for(const {mesh,cutHeight} of cutWalls){
      const height=overview?cutHeight:wallHeight;
      mesh.scale.y=height;mesh.position.y=height/2;
    }
    renderer.shadowMap.needsUpdate=true;
    const room=rooms[index];
    if(room){
      const points=[[room.x,room.spawnZ],[room.x-room.w*.32,room.spawnZ],[room.x+room.w*.32,room.spawnZ],[room.x,room.z+room.d*.34]];
      const [x,z]=points.find(([px,pz])=>allowed(px,pz))||points[0];
      camera.position.set(x,eyeHeight,z);
      yaw=Math.atan2(x-room.x,z-room.z);pitch=-.15;
    }else if(!overview){
      camera.position.set(layout.entry[0],eyeHeight,layout.entry[1]);
      yaw=Math.atan2(layout.entry[0]-center.x,layout.entry[1]-center.z);pitch=-.08;
    }
    paint();
  }
  visit(-2);
  return {rooms:rooms.map(({name})=>name),visit,move(distance){step(distance,0);paint();},dispose(){
    disposed=true;events.abort();observer.disconnect();cancelAnimationFrame(frame);
    geometry.dispose();cylinder.dispose();cushion.dispose();viewTexture.dispose();
    for(const texture of textures)texture.dispose();
    for(const material of materials)material.dispose();
    key.shadow.dispose();
    renderer.dispose();renderer.forceContextLoss();host.replaceChildren();
  }};
}
