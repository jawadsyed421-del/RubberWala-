import * as T from '#three';
import { GLTFExporter } from '../public/vendor/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries } from '../public/vendor/examples/jsm/utils/BufferGeometryUtils.js';
import { writeFile } from 'node:fs/promises';
import { cityProjects } from '../public/city-projects.js';

globalThis.FileReader=class {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend();});}
};

const finish=(name,color,roughness=.55,metalness=.1,emissive=0)=>new T.MeshStandardMaterial({name,color,roughness,metalness,emissive});
const stone=finish('Warm limestone',0xc9a98a);
const ivory=finish('Ivory facade',0xe0dbd2);
const bronze=finish('Bronze trim',0xad7c4b,.38,.55);
const dark=finish('Recessed facade',0x292b2d);
const glass=[finish('Slate glazing',0x3b505f,.24,.4),finish('Reflective glazing',0x6b7780,.24,.45),finish('Interior light',0xb69670,.36,.2,0x3a1b06)];

function section(model,name,draw){
  const batches=new Map();
  const add=(geometry,material)=>{
    if(!batches.has(material))batches.set(material,[]);
    batches.get(material).push(geometry.index?geometry.toNonIndexed():geometry);
  };
  const box=(x,y,z,w,h,d,material)=>add(new T.BoxGeometry(w,h,d).translate(x,y,z),material);
  draw(box,add);
  const group=new T.Group();
  group.name=name;
  for(const [material,geometries] of batches){
    group.add(new T.Mesh(mergeGeometries(geometries),material));
    for(const geometry of geometries)geometry.dispose();
  }
  model.add(group);
}
const pane=(floor,bay,side)=>glass[(floor*7+bay*11+side*3)%13>9?2:(floor+bay*3)%3===0?1:0];

function block(box,{x=0,z=0,base=0,width,depth,count,pitch=.36,bays=8,slab=stone,vertical=bronze,bands=true}){
  const height=count*pitch;
  box(x,base+height/2,z,width-.095,height,depth-.095,dark);
  for(let floor=0;floor<count;floor++){
    const y=base+floor*pitch;
    if(bands)box(x,y+.018,z,width+.06,.047,depth+.07,slab);
    for(const direction of [-1,1]){
      for(let bay=0;bay<bays;bay++){
        const spacing=width/bays, center=x+(bay+.5-bays/2)*spacing;
        box(center,y+pitch*.54,z+direction*depth/2,spacing*.83,pitch*.69,.032,pane(floor,bay,direction));
      }
      const sideBays=Math.max(2,Math.round(bays*depth/width));
      for(let bay=0;bay<sideBays;bay++){
        const spacing=depth/sideBays,center=z+(bay+.5-sideBays/2)*spacing;
        box(x+direction*width/2,y+pitch*.54,center,.032,pitch*.69,spacing*.83,pane(floor,bay,direction));
      }
    }
  }
  for(const side of [-1,1]){
    for(let bay=0;bay<=bays;bay++){
      const beam=x+(bay/bays-.5)*width;
      box(beam,base+height/2,z+side*(depth/2+.025),bay%3===0?.115:.055,height,.08,vertical);
    }
    for(const end of [-1,1])box(x+side*width/2,base+height/2,z+end*depth/2,.13,height,.13,vertical);
  }
  box(x,base+height,z,width+.09,.09,depth+.09,slab);
}

function standard(project){
  const model=new T.Group();
  const configs={
    valencia:{width:2.7,depth:2.15,count:15,bays:5,podium:1.3,slab:stone},
    nebula:{width:5.6,depth:2.5,count:27,bays:13,podium:1.15,slab:bronze},
    'white-house':{width:3.1,depth:2.3,count:26,bays:7,podium:1.6,slab:ivory},
    fuego:{width:5.1,depth:3.15,count:22,bays:11,podium:2.3,slab:stone,bands:false},
  };
  const spec=configs[project.id];
  const {width,depth,podium,count,slab}=spec;
  section(model,'Entrances and podium',(box)=>{
    box(0,.09,0,width+.54,.18,depth+.52,stone);
    block(box,{width:width+.18,depth:depth+.21,count:3,pitch:podium/3,bays:Math.ceil(width*2),slab});
    box(0,.44,depth/2+.16,width*.31,.62,.09,glass[1]);
    box(0,.81,depth/2+.28,width*.39,.105,.48,bronze);
  });
  section(model,'Facade',(box)=>{
    block(box,{...spec,base:podium,vertical:project.id==='white-house'?ivory:bronze});
    if(project.id==='white-house'){
      for(const x of [-width*.42,-width*.16,width*.36])box(x,podium+count*.18,depth/2+.1,.16,count*.36,.22,ivory);
    }
    if(project.id==='fuego'){
      for(const x of [-width*.45,-width*.16,width*.15,width*.45])box(x,podium+count*.18,depth/2+.09,.24,count*.36,.19,stone);
    }
  });
  section(model,'Roof detailing',(box,add)=>{
    const top=podium+count*.36;
    if(project.id==='nebula'){
      for(let tier=0;tier<4;tier++){
        const widthAt=width*(1-tier*.11), depthAt=depth*(1-tier*.1);
        add(new T.CylinderGeometry(1,1,.19,72).scale(widthAt/2,1,depthAt/2).translate(0,top+tier*.23,0),tier%2?ivory:bronze);
      }
      box(.8,top+1.2,0,.045,.95,.045,bronze);
    }else if(project.id==='valencia'){
      for(const x of [-1.05,1.05])for(const z of [-.81,.81])box(x,top+.32,z,.14,.64,.14,bronze);
      box(0,top+.69,0,width*1.18,.16,depth*1.15,stone);
      box(0,top+.8,0,width*.85,.16,depth*.81,bronze);
    }else{
      box(0,top+.21,0,width*.87,.36,depth*.81,slab);
      box(0,top+.43,0,width*.56,.18,depth*.55,dark);
    }
  });
  return model;
}

function mall(){
  const model=new T.Group();
  section(model,'Arcaded stone podium',(box,add)=>{
    block(box,{width:9.9,depth:4.4,count:5,pitch:.62,bays:15,slab:stone,vertical:stone});
    for(let n=0;n<9;n++){
      const x=(n-4)*1.06;
      box(x,.94,2.27,.69,1.37,.05,dark);
      for(const offset of [-.36,.36])box(x+offset,.98,2.32,.115,1.43,.19,ivory);
      const arch=new T.TorusGeometry(.36,.059,8,22,Math.PI);
      add(arch.translate(x,1.67,2.36),ivory);
    }
    for(const y of [.19,2.15,2.93,3.14])box(0,y,0,10.14,.12,4.61,ivory);
  });
  section(model,'Stepped residential wings',(box)=>{
    for(const [x,count,depth,z] of [[-4.04,23,2.8,.18],[-2.5,20,2.4,0],[-.85,18,2.3,-.2],[.8,22,2.7,.06],[2.45,19,2.45,-.13],[4.03,24,2.85,.17]]){
      block(box,{x,z,base:3.15,width:1.56,depth,count,pitch:.31,bays:3,slab:stone,vertical:ivory});
      box(x,3.15+count*.31+.15,z,1.64,.28,depth+.05,stone);
    }
  });
  return model;
}

function eon(){
  const model=new T.Group();
  const top=16, floorCount=45, pitch=top/floorCount;
  const radius=y=>1.09+1.03*Math.sin(Math.PI*Math.pow(y/top,.89));
  section(model,'Podium',(box)=>{
    box(0,.19,0,4.9,.38,3.2,ivory);
    box(0,.44,0,3.7,.32,2.25,dark);
  });
  section(model,'Tapered balcony and glazing rings',(box,add)=>{
    for(let i=0;i<floorCount;i++){
      const y=.55+i*pitch, low=radius(i*pitch), high=radius((i+1)*pitch);
      add(new T.CylinderGeometry(high*.94,low*.94,pitch,48).scale(1,1,.63).translate(0,y+pitch/2,0),glass[0]);
      add(new T.CylinderGeometry(low,low,.048,56).scale(1,1,.64).translate(0,y,0),ivory);
      for(let bay=0;bay<32;bay++){
        const angle=bay*Math.PI/16;
        const x=Math.cos(angle)*low*.947,z=Math.sin(angle)*low*.6;
        box(x,y+pitch*.49,z,.026,pitch*.76,.026,bronze);
        if((i*7+bay*3)%27===0){
          add(new T.BoxGeometry(.13,pitch*.43,.025).rotateY(Math.PI/2-angle).translate(x,y+pitch*.45,z),glass[2]);
        }
      }
    }
  });
  section(model,'Sail crown with through opening',(box,add)=>{
    const shape=new T.Shape();
    shape.moveTo(-1.13,0);
    shape.bezierCurveTo(-.87,1.52,-.47,2.92,0,2.96);
    shape.bezierCurveTo(.47,2.92,.87,1.52,1.13,0);
    shape.closePath();
    const hole=new T.Path();
    hole.absellipse(0,2.02,.43,.49,0,Math.PI*2,true);
    shape.holes.push(hole);
    add(new T.ExtrudeGeometry(shape,{depth:.45,bevelEnabled:true,bevelSize:.055,bevelThickness:.055,bevelSegments:3,curveSegments:28}).translate(0,top+.53,-.225),ivory);
  });
  return model;
}

const exporter=new GLTFExporter();
for(const project of cityProjects){
  const model=project.id==='eon'?eon():project.id==='platinum-mall'?mall():standard(project);
  model.name=project.name;
  model.userData.source=project.source;
  const data=await exporter.parseAsync(model,{binary:true});
  await writeFile(new URL('../public'+project.path,import.meta.url),Buffer.from(data));
  console.log(project.name,data.byteLength);
}
