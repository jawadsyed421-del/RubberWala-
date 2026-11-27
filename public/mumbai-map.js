import * as T from 'three';
import { createContextBuildings } from './site-context.js';

const coastline=[[-35,-30],[-22,-45],[7,-45],[24,-36],[29,-22],[24,-13],[34,-3],[31,8],[21,13],[19,25],[7,39],[-5,38],[-12,29],[-22,24],[-29,12],[-31,-6],[-39,-16]];

export function createMumbaiMap(projects){
  const group=new T.Group();
  const land=new T.Shape(coastline.map(([x,z])=>new T.Vector2(x,-z)));
  const terrain=new T.Mesh(new T.ShapeGeometry(land),new T.MeshStandardMaterial({color:0x414941,roughness:.95}));
  terrain.rotation.x=-Math.PI/2;
  terrain.position.y=-.30;
  terrain.receiveShadow=true;
  group.add(terrain);
  const outline=new T.LineLoop(new T.BufferGeometry().setFromPoints(coastline.map(([x,z])=>new T.Vector3(x,-.265,z))),
    new T.LineBasicMaterial({color:0xb49d79,transparent:true,opacity:.69}));
  group.add(outline);

  const roadMaterial=new T.MeshStandardMaterial({color:0x756c5e,roughness:.92});
  function road(x1,z1,x2,z2,width){
    const length=Math.hypot(x2-x1,z2-z1);
    const strip=new T.Mesh(new T.PlaneGeometry(width,length),roadMaterial);
    strip.rotation.x=-Math.PI/2;
    strip.rotation.z=Math.atan2(x1-x2,z1-z2);
    strip.position.set((x1+x2)/2,-.275,(z1+z2)/2);
    strip.receiveShadow=true;
    group.add(strip);
  }
  for(const z of [-30,-22,-14,-6,2,10,18,26])road(z>18?-15:-27,z,z>18?13:22,z,1);
  for(const x of [-23,-15,-7,1,9,17])road(x,-34,x,x< -17?16:x>12?18:28,1.05);
  road(-27,-23,15,22,1.8);
  road(-17,22,16,-29,1.55);
  const lots=[];
  for(let row=0;row<7;row++)for(let col=0;col<11;col++){
    const x=-25+col*4.35+(row%2)*.17,z=-27+row*7.9+(col%2)*.4;
    if(z>18&&Math.abs(x)>14)continue;
    if(projects.some(({id,position:[px,,pz]})=>Math.abs(x-px)<(id==='platinum-mall'?8.3:5.1)&&Math.abs(z-pz)<4.8))continue;
    lots.push([x,z,2.3+(row+col)%3*.4,2.25+(col%3)*.31,3+(row*3+col)%4]);
  }
  const context=createContextBuildings({lots});
  group.add(context.group);
  return {group,dispose(){
    context.dispose();
    for(const object of group.children){
      object.geometry?.dispose();
      if(object.material!==roadMaterial)object.material?.dispose();
    }
    roadMaterial.dispose();
  }};
}
