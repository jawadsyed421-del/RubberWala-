import * as T from 'three';

// Illustrative infill provides scale around the four portfolio models.
const blocks=[
  // Rear streets.
  [-17,-13,3.3,2.65,5],[-12.9,-13,3.4,2.75,7],[-9,-13.2,3,2.7,5],
  [-1.4,-14,3.25,2.6,5],[2.6,-14,3.5,2.75,6],[7.1,-14,3.85,2.85,8],
  [11.6,-14,3.5,2.65,5],[16.6,-13,3.3,2.7,6],[20.1,-10,2.7,2.5,4],
  // Mid-block lots leave the main promenade and logo plaza clear.
  [-17.4,-7.3,3.15,2.8,4],[-13.5,-6.4,3.85,3.05,6],[-9.1,-5,3.2,2.7,5],
  [-5.3,-5.8,2.7,2.5,4],[-.6,-7.8,3.15,2.8,5],
  [4.1,-6.4,4.1,3.15,7],[8.6,-6.1,3.3,2.8,6],[19.5,-4.8,2.9,2.6,5],
  [-17.1,-1.4,3,2.8,5],[-6.5,-.9,3.25,2.55,4],
  [5.25,-1.7,3,2.6,5],[10.8,-1.4,3.2,2.65,5],[18.5,1,3.2,2.5,6],
  // Shorter foreground buildings keep the towers visible.
  [-16.8,5.9,3.35,2.6,4],[-12.8,7.2,3.35,2.75,5],[-8.9,7.3,2.8,2.45,4],
  [-5.0,6.6,3.6,2.65,4],[1.0,8.5,3.6,2.7,3],
  [13.3,6.7,3.6,2.65,5],[17.8,6.7,3.6,2.55,4],
  [-7.1,12,3.5,2.65,3],[-2.9,12.6,3.1,2.5,4],[3.4,12.6,3.2,2.5,3],
  [13.1,11.4,3.45,2.6,4],[17.4,11.5,3.45,2.5,5],
];
export function createContextBuildings({lots=blocks}={}){
  const group=new T.Group();
  group.name='Illustrative low-rise buildings';
  const geometry=new T.BoxGeometry(1,1,1);
  const finishes={
    cream:new T.MeshStandardMaterial({color:0xc5ac88,roughness:.79}),
    stone:new T.MeshStandardMaterial({color:0x98846d,roughness:.77}),
    coping:new T.MeshStandardMaterial({color:0xb5a492,roughness:.71}),
    roof:new T.MeshStandardMaterial({color:0x4d4946,roughness:.9}),
    glazing:new T.MeshStandardMaterial({color:0x283943,metalness:.26,roughness:.29}),
    lit:new T.MeshStandardMaterial({color:0x997957,emissive:0xe7a959,emissiveIntensity:.25,roughness:.45}),
  };
  const batches=new Map();
  const transform=new T.Matrix4();
  function box(material,x,y,z,width,height,depth){
    if(!batches.has(material))batches.set(material,[]);
    batches.get(material).push(transform.makeScale(width,height,depth).setPosition(x,y,z).clone());
  }

  for(const [index,[x,z,width,depth,floors]] of lots.entries()){
    const base=-.24, pitch=.39, height=floors*pitch+.13, top=base+height;
    const bays=Math.round(width*1.55), finish=index%3===0?'stone':'cream';
    box('coping',x,-.28,z,width+.33,.07,depth+.33);
    box(finish,x,base+height/2,z,width,height,depth);
    box('roof',x,top+.025,z,width-.08,.06,depth-.08);
    for(const side of [-1,1]){
      box('coping',x,top+.08,z+side*depth/2,width+.05,.18,.09);
      box('coping',x+side*width/2,top+.08,z,.09,.18,depth);
    }
    box(finish,x+.4,top+.16,z-.34,.83,.32,.66);
    box('roof',x+.4,top+.33,z-.34,.9,.05,.73);

    for(let level=0;level<floors;level++){
      const y=base+.25+level*pitch;
      for(const side of [-1,1]){
        const front=z+side*(depth/2+.009);
        for(let bay=0;bay<bays;bay++){
          const paneX=x+width*((bay+1)/(bays+1)-.5);
          const lit=(index*5+level*3+bay*7+side)%13===0;
          box(lit?'lit':'glazing',paneX,y,front,width/(bays+1)*.56,level?.22:.29,.022);
        }
        for(let bay=0;bay<4;bay++){
          box('glazing',x+side*(width/2+.009),y,z+depth*((bay+1)/5-.5),.022,.22,depth*.105);
        }
        if(level>0 && level%2===0)box('coping',x,y-.155,front,width+.03,.038,.09);
      }
    }
    box('glazing',x,base+.18,z+depth/2+.028,.55,.36,.04);
  }

  for(const [name,matrices] of batches){
    const mesh=new T.InstancedMesh(geometry,finishes[name],matrices.length);
    matrices.forEach((matrix,index)=>mesh.setMatrixAt(index,matrix));
    mesh.castShadow=mesh.receiveShadow=true;
    group.add(mesh);
  }
  return {group,dispose(){
    geometry.dispose();
    Object.values(finishes).forEach(material=>material.dispose());
    group.children.forEach(mesh=>mesh.dispose());
  }};
}

