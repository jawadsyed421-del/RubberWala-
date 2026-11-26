import * as T from 'three';
import { GLTFLoader } from './vendor/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from './vendor/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from './vendor/examples/jsm/environments/RoomEnvironment.js';

const models = [
  ['Blue Glass Tower A','blue-glass-tower-a'],
  ['Ivory Sail Tower','ivory-sail-tower'],
  ['Limestone & Glass Tower','limestone-glass-tower'],
  ['Blue Glass Tower B','blue-glass-tower-b'],
];
const stage = document.querySelector('#stage');
const nav = document.querySelector('#models');
const title = document.querySelector('#model-title');
const status = document.querySelector('#status');
const download = document.querySelector('#download');
const buttons = models.map(([name], index) => {
  const button = document.createElement('button');
  button.textContent = name;
  button.onclick = () => select(index);
  nav.append(button);
  return button;
});

const scene = new T.Scene();
const camera = new T.PerspectiveCamera(32,1,.1,90);
const loader = new GLTFLoader();
const cache = new Map();
let renderer, controls, model, height, selected, target, distance, plane;
try {
  renderer = new T.WebGLRenderer({ alpha:true, antialias:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  stage.append(renderer.domElement);
  controls = new OrbitControls(camera,renderer.domElement);
  controls.enablePan = false;
  controls.minPolarAngle = .09;
  controls.maxPolarAngle = 1.58;

  const environment = new RoomEnvironment();
  const generator = new T.PMREMGenerator(renderer);
  scene.environment = generator.fromScene(environment,.04).texture;
  scene.environmentIntensity = .82;
  generator.dispose();
  environment.dispose();
  scene.add(new T.HemisphereLight(0xe4efff,0x778370,1.2));
  const key = new T.DirectionalLight(0xfff5dc,2.3);
  key.position.set(7,14,8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048,2048);
  key.shadow.camera.left = key.shadow.camera.bottom = -9;
  key.shadow.camera.right = key.shadow.camera.top = 9;
  key.shadow.normalBias = .03;
  scene.add(key);
  const rim = new T.DirectionalLight(0xbddfff,1.15);
  rim.position.set(-6,9,-8);
  scene.add(rim);
  plane = new T.Mesh(new T.PlaneGeometry(150,150),new T.ShadowMaterial({opacity:.35}));
  plane.rotation.x = -Math.PI/2;
  plane.position.y = -.025;
  plane.receiveShadow = true;
  scene.add(plane);

  new ResizeObserver(() => {
    const {clientWidth:w,clientHeight:h} = stage;
    if (!w || !h) return;
    renderer.setSize(w,h,false);
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
    render();
  }).observe(stage);
  controls.addEventListener('change', render);
} catch {
  renderer = null;
}
function render() {
  renderer?.render(scene,camera);
}

function reset(){
  if (!model) return;
  controls.target.copy(target);
  const defaultAngle = selected === 1 ? .43 : .75;
  distance = height*(camera.aspect < .9 ? 2.55 : 2.32);
  camera.position.copy(target).add(new T.Vector3(Math.sin(defaultAngle),.205,Math.cos(defaultAngle)).multiplyScalar(distance));
  controls.minDistance = height*.68;
  controls.maxDistance = height*5;
  controls.update();
  render();
}
function zoom(factor) {
  if (!model) return;
  const offset=camera.position.clone().sub(controls.target);
  const length = T.MathUtils.clamp(offset.length()*factor,controls.minDistance,controls.maxDistance);
  camera.position.copy(controls.target).add(offset.setLength(length));
  controls.update();
}
document.querySelector('#reset').onclick = reset;
document.querySelector('#zoom-in').onclick = () => zoom(.87);
document.querySelector('#zoom-out').onclick = () => zoom(1.15);
stage.addEventListener('keydown',event => {
  if (!model) return;
  if (event.key === '+' || event.key === '=') zoom(.87);
  else if (event.key === '-') zoom(1.15);
  else if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {
    const orbit = new T.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    if (event.key === 'ArrowLeft') orbit.theta -= .14;
    if (event.key === 'ArrowRight') orbit.theta += .14;
    if (event.key === 'ArrowUp') orbit.phi -= .11;
    if (event.key === 'ArrowDown') orbit.phi += .11;
    orbit.phi = T.MathUtils.clamp(orbit.phi,.09,1.58);
    camera.position.copy(controls.target).add(new T.Vector3().setFromSpherical(orbit));
    controls.update();
  } else return;
  event.preventDefault();
});

let request = 0;
async function select(index) {
  const current = ++request;
  selected = index;
  const [label,slug]=models[index];
  const url='/models/'+slug+'.glb';
  title.textContent=label;
  download.href=url;
  for (const [i,button] of buttons.entries()) button.setAttribute('aria-pressed',String(i===index));
  if (!renderer) {
    status.textContent = 'WebGL is unavailable. The GLB download is available.';
    return;
  }
  if (model) scene.remove(model);
  model = null;
  render();
  status.textContent='Loading model…';
  try {
    if (!cache.has(url)) cache.set(url,loader.loadAsync(url).catch(error => {
      cache.delete(url);
      throw error;
    }));
    const loaded = await cache.get(url);
    if (current !== request) return;
    model=loaded.scene;
    model.traverse(object=>{
      if (object.isMesh) object.castShadow=object.receiveShadow=true;
    });
    scene.add(model);
    const bounds=new T.Box3().setFromObject(model);
    height=bounds.max.y-bounds.min.y;
    target=bounds.getCenter(new T.Vector3());
    plane.position.y=bounds.min.y-.025;
    status.textContent='';
    reset();
  } catch (error) {
    if (current === request) status.textContent='Model failed to load. Select it again to retry.';
    console.error(error);
  }
}
select(0);
