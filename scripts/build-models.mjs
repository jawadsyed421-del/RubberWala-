import * as T from '#three';
import { GLTFExporter } from '../public/vendor/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries } from '../public/vendor/examples/jsm/utils/BufferGeometryUtils.js';
import { writeFile } from 'node:fs/promises';

globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(buffer => {
      this.result = buffer;
      this.onloadend();
    });
  }
};

function material(name, color, roughness, metalness = 0) {
  return new T.MeshStandardMaterial({ name, color, roughness, metalness });
}

const stone = material('Pale limestone', 0xd1c9bb, .69);
const white = material('Ivory slab edges', 0xe0e4df, .44, .09);
const dark = material('Recessed graphite metal', 0x263137, .5, .3);
const silver = material('Anodized aluminum', 0x95a3ab, .37, .55);
const bronze = material('Warm metal mullions', 0xa98c6a, .4, .48);
const blue = [0x4c6f88, 0x57788f, 0x395871, 0x6a889a, 0x829aa7, 0x314d65]
  .map((color, i) => material('Blue glazing ' + (i+1), color, .25, .38));
const warm = [0x55646c, 0x41494b, 0x78746c, 0x676059]
  .map((color,i) => material('Smoked glazing ' + (i+1), color, .3, .31));
const shell = material('Pale blue rear cladding', 0x88abc1, .31, .31);

function addSection(model, name, construct) {
  const buckets = new Map();
  const add = (g, mat) => {
    if (!buckets.has(mat)) buckets.set(mat, []);
    buckets.get(mat).push(g);
  };
  const box = (x,y,z,w,h,d,mat) => add(new T.BoxGeometry(w,h,d).translate(x,y,z),mat);
  const quad = (a,b,c,d,mat) => {
    const g = new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute((a === d ? [a,b,c] : [a,b,c,d]).flat(),3));
    g.setIndex(a === d ? [0,1,2] : [0,1,2,0,2,3]);
    g.computeVertexNormals();
    g.setAttribute('uv',new T.Float32BufferAttribute(a === d ? [0,0,1,0,1,1] : [0,0,1,0,1,1,0,1],2));
    add(g,mat);
  };
  construct({add,box,quad});
  const group = new T.Group();
  group.name = name;
  for (const [mat, geometries] of buckets) {
    const mesh = new T.Mesh(mergeGeometries(geometries),mat);
    mesh.name = mat.name;
    group.add(mesh);
  }
  model.add(group);
}

function ring(width,depth,radius) {
  const corners=[[1,1],[-1,1],[-1,-1],[1,-1]];
  const cornerPoint=(i,angle)=>{
    const [x,z]=corners[i];
    return [x*(width/2-radius)+radius*Math.cos(angle),z*(depth/2-radius)+radius*Math.sin(angle)];
  };
  return corners.flatMap((_,i)=>{
    const start=i*Math.PI/2, end=start+Math.PI/2;
    const arc=Array.from({length:6},(_,k)=>cornerPoint(i,start+k*Math.PI/10));
    const a=arc[5], b=cornerPoint((i+1)%4,end);
    const side=Array.from({length:10},(_,k)=>a.map((value,j)=>T.MathUtils.lerp(value,b[j],(k+1)/11)));
    return [...arc,...side];
  });
}
function oval(width,depth,steps=64) {
  return Array.from({length:steps},(_,i)=>{
    const a=i*2*Math.PI/steps;
    return [width/2*Math.cos(a),depth/2*Math.sin(a)];
  });
}

function skin(quad, bottom, top, y0, y1, choose) {
  for (let i=0;i<bottom.length;i++) {
    const j=(i+1)%bottom.length;
    const point=(loop,k,y)=>[loop[k][0],y,loop[k][1]];
    quad(point(bottom,i,y0),point(top,i,y1),point(top,j,y1),point(bottom,j,y0),choose(i));
  }
}

function slab(quad, loop, y0, y1, mat) {
  skin(quad,loop,loop,y0,y1,()=>mat);
  for(let i=0;i<loop.length;i++){
    const [x,z]=loop[i], [u,v]=loop[(i+1)%loop.length];
    const top=[0,y1,0], bottom=[0,y0,0];
    quad(top,[u,y1,v],[x,y1,z],top,mat);
    quad(bottom,[x,y0,z],[u,y0,v],bottom,mat);
  }
}

function bar(box, a,b,y,width,height,mat) {
  box((a[0]+b[0])/2,y,(a[1]+b[1])/2,width,height,width,mat);
}

const shade = (floor,bay,colors) => colors[((floor*29+bay*41) ^ (floor*bay*7)) % colors.length];

function roundedTower(name, version) {
  const model = new T.Group();
  model.name=name;
  const w=version ? 3.2 : 3.38, d=version ? 2.72 : 2.55;
  const floors=version ? 31 : 30, pitch=.235, podium=1.49;
  addSection(model,'Stone and glass podium',({quad,box})=>{
    const base=ring(w+.18,d+.2,.64);
    slab(quad,base,0,.11,stone);
    skin(quad,base,base,.11,podium, i=>i%4===0 ? silver : shade(3,i,warm));
    for(let i=0;i<5;i++) slab(quad,ring(w+.25,d+.25,.67),.12+.28*i,.15+.28*i,i===4 ? white : silver);
    for(let i=0;i<base.length;i++) bar(box,base[i],base[i],.78,.035,1.35,stone);
    slab(quad,ring(w+.36,d+.36,.68),podium-.08,podium+.05,white);
  });
  addSection(model,'Curved curtain wall and balcony slabs',({quad,box})=>{
    for(let f=0;f<floors;f++){
      const step=f<20 ? .17 : 0;
      const level=podium+f*pitch;
      const loop=ring(w+step,d+step,.67);
      const edge=ring(w+step+.16,d+step+.16,.71);
      skin(quad,loop,loop,level,level+pitch,i=>shade(f,i,blue));
      slab(quad,edge,level,level+.024,white);
      skin(quad,edge,edge,level+.063,level+.075,()=>silver);
      for(let i=0;i<loop.length;i++){
        const [x,z]=loop[i];
        box(x,level+.128,z,i%4===0?.021:.012,.208,i%4===0?.021:.012,silver);
      }
    }
    const h=podium+floors*pitch;
    slab(quad,ring(w+.2,d+.2,.75),h-.025,h+.055,white);
    slab(quad,ring(w-.18,d-.15,.66),h+.055,h+.24,blue[2]);
    slab(quad,ring(w-.04,d-.01,.68),h+.24,h+.31,white);
    const crown=ring(w-.42,d-.35,.64);
    slab(quad,crown,h+.31,h+.64,shell);
    for(const [x,z] of crown) box(x,h+.48,z,.019,.3,.019,silver);
    box(.42,h+.7,-.27,.022,.25,.022,silver);
  });
  return model;
}

function sailTower(){
  const model = new T.Group();
  model.name='Ivory Sail Tower';
  const floors=40, height=10, first=.35, pitch=.222;
  const profile=y=>{
    const ratio=y/height;
    const width=2.57*Math.pow(Math.max(.005,1-Math.pow(Math.abs((ratio-.3)/.72),2.25)),.64);
    return oval(width, width*.70).map(([x,z])=>[x,z-.18*ratio]);
  };
  addSection(model,'Circular entrance podium',({quad,box})=>{
    const base=oval(2.99,2.28);
    slab(quad,base,0,.1,stone);
    slab(quad,oval(2.89,2.19),.1,first,silver);
    for(let i=0;i<base.length;i+=2) bar(box,base[i],base[i],.22,.048,.22,white);
  });
  addSection(model,'Tapered curtain wall and continuous rear shell',({quad,box})=>{
    const front=i=>i>=3&&i<29;
    for(let f=0;f<floors;f++){
      const y=first+f*pitch, a=profile(y), b=profile(y+pitch);
      skin(quad,a,b,y,y+pitch,i=>front(i) ? shade(f,i,f>=34?warm:blue) : shell);
      const lip=loop=>loop.map(([x,z])=>[x*1.027,z*1.027+.007]);
      skin(quad,lip(a),lip(profile(y+.029)),y,y+.029,i=>front(i)?white:shell);
      for(let i=4;i<29;i+=2) bar(box,a[i],b[i],y+.13,.017,.181,f>=34?bronze:silver);
      for(const i of [3,29]) bar(box,a[i],b[i],y+.111,.069,.231,white);
    }
    const crownStart=first+floors*pitch;
    for(let f=0;f<20;f++){
      const y=crownStart+f*(10.17-crownStart)/20;
      const next=crownStart+(f+1)*(10.17-crownStart)/20;
      skin(quad,profile(y),profile(next),y,next,i=>front(i)?white:shell);
    }
    slab(quad,profile(10.17),10.17,10.19,white);
  });
  return model;
}

function rectTower(){
  const model = new T.Group();
  model.name='Limestone and Blue Glass Tower';
  const w=4.3,d=2.65,podium=2.03,pitch=.283,floors=18;
  addSection(model,'Street-level entrance and podium',({box})=>{
    box(0,.08,0,w+.42,.16,d+.4,stone);
    box(0,1.05,0,w,1.9,d,dark);
    for(const side of [-1,1]){
      box(-1.46,1.28,side*d/2,1.33,1.29,.088,silver);
      box(1.42,1.30,side*d/2,1.43,1.28,.105,stone);
      for(let n=0;n<7;n++){
        box(-1.46,.72+n*.178,side*(d/2+.058),1.3,.036,.036,white);
      }
      for(let n=0;n<14;n++){
        box(-2.06+n*.316,.385,side*(d/2+.04),.039,.55,.08,bronze);
      }
      for(let n=0;n<5;n++) box(1+.208*n,1.07,side*(d/2+.06),.09,.09,.021,dark);
      for(let n=0;n<8;n++){
        box(-.7+n*.2,1.32,side*(d/2+.016),.027,1.25,.047,bronze);
      }
    }
    for(const side of [-1,1]) box(side*w/2,1.29,0,.09,1.42,d,stone);
    box(0,1.99,0,w+.1,.085,d+.09,white);
  });
  addSection(model,'Window bays and limestone fins',({box})=>{
    box(0,podium+floors*pitch/2,0,w-.1,floors*pitch,d-.1,dark);
    for(let f=0;f<floors;f++){
      const y=podium+f*pitch;
      box(0,y,0,w+.05,.044,d+.067,white);
      for(const side of [-1,1]){
        for(let i=0;i<8;i++){
          const x=-w/2+(i+.5)*w/8;
          box(x,y+.145,side*d/2,w/8-.059,pitch-.055,.037,shade(f,i,blue));
        }
        for(let i=0;i<5;i++){
          const z=-d/2+(i+.5)*d/5;
          box(side*w/2,y+.145,z,.038,pitch-.058,d/5-.064,shade(f,i+4,blue));
        }
      }
    }
    const h=podium+floors*pitch;
    for(const side of [-1,1]){
      for(let i=0;i<=8;i++){
        box(-w/2+i*w/8,(podium+h)/2,side*(d/2+.06),i%4===0?.118:.064,h-podium,.14,i%4===0?stone:bronze);
      }
      for(const z of [-.82,.82]) box(side*w/2,(podium+h)/2,z,.16,h-podium,.155,stone);
      box(side*w/2,h+.23,0,.126,.48,d+.02,stone);
      for(const x of [-1.68,-.87,0,.87,1.68]) box(x,h+.18,side*d/2,.085,.36,.09,stone);
      box(0,h+.37,side*d/2,w,.08,.127,white);
    }
    box(0,h,0,w+.14,.1,d+.12,white);
    for(const z of [-.41,.41]){
      box(-.57,h+.4,z,.1,.76,.13,white);
      box(.57,h+.4,z,.1,.76,.13,white);
      box(0,h+.76,z,1.24,.1,.13,white);
    }
    box(0,h+.22,0,1,.34,.73,silver);
  });
  return model;
}

const models=[
  ['blue-glass-tower-a',roundedTower('Blue Glass Tower A',false)],
  ['ivory-sail-tower',sailTower()],
  ['limestone-glass-tower',rectTower()],
  ['blue-glass-tower-b',roundedTower('Blue Glass Tower B',true)],
];
const exporter=new GLTFExporter();
for(const [file,model] of models){
  const result=await exporter.parseAsync(model,{binary:true});
  await writeFile(new URL('../public/models/'+file+'.glb',import.meta.url),Buffer.from(result));
  console.log(file,result.byteLength);
}

