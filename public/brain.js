import { createVoice } from './voice.js';
import { voiceProvider } from './voice-playback.js';
import { projects, months, metrics, currency, departments } from './data.js';
import { answerDemo, findRoute, normalizeVoice, operations, demoTasks, demoDocuments } from './demo-operations.js';
import { cameraCommand } from './site-commands.js';
import { constructionAnswer, constructionRecord, dateLabel } from './construction-data.js';
import { hindiAnswer, hindiCommand, hindiProject, isHindi } from './hindi.js';
import { namedRubberwalaProject, rubberwalaAnswer } from './rubberwala-knowledge.js';
import { sheetAnswer } from './sheet-knowledge.js';
import { arrivalPage, mountArrival } from './arrival.js';
import { cityProjects, tourProjects } from './city-projects.js';

const $=(selector,root=document)=>root.querySelector(selector);
const view=$('#view');
const dialog=$('#drill');
const saved=(key,fallback)=>{
  try{return JSON.parse(localStorage.getItem('rubberwala.'+key))??fallback;}
  catch{return fallback;}
};
const store=(key,value)=>{
  try{localStorage.setItem('rubberwala.'+key,JSON.stringify(value));}catch{}
};
const clean=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const totals=metrics();
let scene=null, sceneTicket=0, activeRoute='', activeProject=-1, floor=1, mode='overview', filter=saved('projectFilter',-1), department=0;
let floorPlanOpen=false;
let namedQuestionProject=null;
let interior=null, interiorRequest=0;
let liveTour=false;
let stopArrival;
let sceneReady=Promise.resolve(null);
let viewerRequested=false;
let cityScene=null, cityReady=null, citySelection=-1;
let gestureSession=null;
let quality=saved('quality','high');
let tasks=saved('tasks',[]);
tasks.push(...demoTasks.filter(sample=>!tasks.some(task=>task.id===sample.id)).map(task=>({...task})));
let activity=saved('activity',[]);
let lastAnswer=null;
let replyTranscript='';
let playingReply=false;
let conversationActive=false;
let contextProject=-1;
let presenting=-1;
const steps=['home','property','project-demo','ralix','construction','finance','workforce'];
const stepTitles=['Introduction','Property Universe','Project Intelligence','Meet rAlix','Construction','Finance','AI Brain Map'];
const metricNames={value:'Illustrative portfolio value',sold:'Units sold',progress:'Construction complete',collected:'Collections',outstanding:'Outstanding',available:'Available units',profit:'Today’s demo profit',revenue:'Demo revenue',expenses:'Demo expenses'};
const fmt=(key,data)=>key==='profit'?currency(data.today.profit):['value','collected','outstanding','revenue','expenses'].includes(key)?currency(data[key]):key==='progress'?data[key]+'%':data[key].toLocaleString('en-IN');
const subtitle='Illustrative records · June–November 2026';
const selectedList=()=>filter<0?projects:[projects[filter]];
const metricGlyphs={value:'◇',sold:'▤',progress:'◔',collected:'↘',outstanding:'↗',available:'▦',profit:'↗',revenue:'≋',expenses:'↙'};
const navGlyphs={command:'▦',property:'◇',ralix:'◉',workforce:'⊞',insights:'⋄',sales:'▤',construction:'◫',finance:'≋',operations:'▥',documents:'▱',tasks:'✓',approvals:'⊙',integrations:'↔',showroom:'⌂'};
for(const link of document.querySelectorAll('.sidebar a')){
  const icon=document.createElement('span');
  icon.className='nav-glyph';
  icon.setAttribute('aria-hidden','true');
  icon.textContent=navGlyphs[link.hash.slice(1)];
  link.prepend(icon);
}

function modelPreview(project,className=''){
  return `<img class="model-preview ${className}" src="/model-previews/${project.id}.webp" alt="" width="320" height="396" loading="lazy" decoding="async">`;
}

function bars(data){
  const peak=Math.max(...data.history,1);
  return '<div class="chart" role="img" aria-label="'+months.map((month,i)=>month+' '+currency(data.history[i])).join(', ')+'">'+
    data.history.map((n,i)=>`<div title="${months[i]} · ${currency(n)}"><div class="chart-track"><span style="--size:${Math.max(n/peak*100,1)}%"><b>${n.toFixed(0)}</b></span></div><small>${months[i]}</small></div>`).join('')+'</div>';
}

function heading(title,description,actions=''){
  return `<div class="workspace-heading"><div><p class="eyebrow">Rubberwala Brain</p><h1>${title}</h1><p>${description}</p></div>${actions}</div>`;
}
function metricCards(keys,data){
  return `<div class="metrics">${keys.map(key=>`<button class="glass metric" data-metric="${key}"><span class="metric-top"><span class="metric-glyph" aria-hidden="true">${metricGlyphs[key]}</span><span class="metric-arrow" aria-hidden="true">↗</span></span><span>${metricNames[key]}</span><strong>${fmt(key,data)}</strong><small class="sr">View records</small></button>`).join('')}</div>`;
}
function progress(value){return `<div class="meter" role="progressbar" aria-label="Completed floors" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100"><i style="width:${value}%"></i></div>`;}
function projectTable(list){
  return `<div class="table-scroll"><table><thead><tr><th>Project</th><th>Sold</th><th>Available</th><th>Complete</th><th>Collections</th></tr></thead><tbody>${list.map(p=>{
    const m=metrics([p]);
    return `<tr><th><button data-project="${p.index}" class="text-button project-link">${modelPreview(p)}<span>${p.name} <span aria-hidden="true">↗</span></span></button></th><td>${m.sold}</td><td>${m.available}</td><td><div class="table-progress"><span>${m.progress}%</span>${progress(m.progress)}</div></td><td>${currency(m.collected)}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}
function dashboard(route){
  const list=selectedList(), data=metrics(list);
  const labels={command:'Command Centre',sales:'Sales & CRM',construction:'Construction',finance:'Finance'};
  const keys={command:['value','sold','progress','collected'],sales:['sold','available','value'],construction:['progress'],finance:['profit','revenue','expenses','collected','outstanding']};
  return heading(labels[route],subtitle,`<div class="heading-actions"><label>Project <select id="global-project"><option value="-1">All projects</option>${projects.map(p=>`<option value="${p.index}" ${p.index===filter?'selected':''}>${p.name}</option>`).join('')}</select></label><button class="button quiet" data-export>Export CSV</button></div>`)+
    metricCards(keys[route],data)+`<div class="dash-grid">
    <section class="glass panel"><div class="panel-top"><h2>${route==='construction'?'Construction milestones':'Monthly bookings'}</h2><span>Jun–Nov 2026</span></div>
    ${route==='construction'?list.map(p=>{
      const record=constructionRecord(p);
      const [planned,done]=record.waterproofing;
      return `<div class="line-item"><div><strong>${p.name}</strong><span>${p.complete} / ${p.floors} floors</span></div>${progress(metrics([p]).progress)}<p class="site-detail">Waterproofing ${done.toLocaleString('en-IN')} / ${planned.toLocaleString('en-IN')} m²<br>Forecast handover ${dateLabel(record.handover)}</p></div>`;
    }).join(''):`<strong class="display-number">${currency(data.booked)}</strong>${bars(data)}<p class="chart-unit">Booked value in crore rupees</p>`}</section>
    <section class="glass panel"><div class="panel-top"><h2>${route==='finance'?'Collections breakdown':'Portfolio at a glance'}</h2></div>
    ${route==='command'?`<div class="completion-summary"><div class="completion-ring" style="--complete:${data.progress}%" aria-label="${data.progress}% construction complete" role="img"><strong aria-hidden="true">${data.progress}%</strong></div><div><strong>${data.floors} of ${data.planned} floors</strong><span>Construction complete</span></div></div>`:''}
    <div class="summary-row"><span>${route==='finance'?'Collected':'Reserved units'}</span><strong>${route==='finance'?currency(data.collected):data.reserved}</strong></div>
    ${route!=='command'?`<div class="summary-row"><span>${route==='finance'?'Outstanding':'Floors completed'}</span><strong>${route==='finance'?currency(data.outstanding):data.floors+' / '+data.planned}</strong></div>`:''}
    <div class="summary-row"><span>${route==='finance'?'Today’s expenses':'November sales'}</span><strong>${route==='finance'?currency(data.today.expenses):data.monthSold+' units'}</strong></div>
    ${route==='finance'?'<div class="summary-row"><span>Today’s demo revenue</span><strong>'+currency(data.today.revenue)+'</strong></div>':''}
    <a class="button quiet" href="#property">Explore properties ↗</a></section>
    </div><section class="glass panel"><div class="panel-top"><h2>Project breakdown</h2></div>${projectTable(list)}</section>`;
}

const buildingExteriors=[
  ['valencia','Valencia','Parel'],
  ['nebula','Nebula','Khetwadi'],
  ['white-house','White House','Kala Chowki'],
  ['fuego','Fuego','Grant Road'],
  ['platinum-mall','Platinum Mall','Grant Road'],
  ['eon','EON','Jerbai Wadia Road'],
];
const viewerProjects=()=>activeRoute==='property'?tourProjects:projects;
const exteriorPath=id=>`/building-exteriors/${id}.webp`;
function buildingGallery(){
  return `<section class="building-gallery" aria-labelledby="building-gallery-title">
    <h1 id="building-gallery-title">Property Universe</h1>
    <p>Explore Rubberwala’s Mumbai buildings. Exterior artwork is illustrative.</p>
    <button class="button primary building-map-entry" data-city-action="open">Open Property Universe 3D ↓</button>
    <div class="building-gallery-grid">${buildingExteriors.map(([id,name,location])=>`
      <button class="building-card" data-building-exterior="${id}" aria-haspopup="dialog">
        <img src="/building-exteriors/${id}.webp" width="1920" height="1080" alt="" ${id==='valencia'?'fetchpriority="high"':'loading="lazy"'} decoding="async">
        <span><strong>${name}</strong><small>${location}</small></span><i aria-hidden="true">↗</i>
      </button>`).join('')}</div>
  </section>${cityViewer()}<section class="building-gallery model-demo-intro" aria-labelledby="model-demo-title">
    <h2 id="model-demo-title">Explore buildings</h2>
    <p>Switch between cinematic exteriors, interactive reconstructions, and illustrative floor-plan concepts.</p>
  </section>`;
}
function cityViewer(){
  return `<section class="building-gallery city-gallery" aria-labelledby="city-title">
    <h2 id="city-title" tabindex="-1">Property Universe 3D</h2>
    <p>Explore reconstructed landmarks on a schematic Mumbai waterfront map.</p>
    <div class="city-stage">
      <div class="scene" id="city-scene" aria-label="Interactive 3D map"></div>
      <div class="city-hud"><div id="city-selection"><strong>Mumbai portfolio</strong><span>Six architectural reconstructions</span></div>
      <div class="city-camera" aria-label="Map camera"><button class="button quiet" data-city-action="overhead">Overhead</button><button class="button quiet" data-city-action="reset">Reset map</button></div></div>
      <button class="button primary city-launch" data-city-action="open">Load the 3D map</button>
      <p id="city-status" role="status">Drag to orbit · Scroll to zoom · Select a building to get closer</p>
    </div>
    <div class="city-picker" aria-label="Find a building">${cityProjects.map(({index,name,area})=>
      `<button data-city-index="${index}" aria-pressed="false"><strong>${name}</strong><span>${area}</span></button>`).join('')}</div>
  </section>`;
}
async function openCityMap(){
  if(cityReady)return cityReady;
  const host=$('#city-scene'),status=$('#city-status');
  if(!host||activeRoute!=='property')return;
  host.parentElement.dataset.state='loading';
  status.textContent='Loading the Mumbai models…';
  cityReady=(async()=>{
    try{
      const {createScene}=await import('./scene.js');
      if(!host.isConnected)return null;
      cityScene=createScene(host,{catalog:cityProjects,quality,onSelect:index=>void selectCity(index)});
      if(!cityScene)throw new Error('WebGL unavailable');
      const controller=cityScene;
      await controller.show(-1);
      if(!host.isConnected)return null;
      if(host.classList.contains('scene-failed'))throw new Error('Models unavailable');
      host.parentElement.dataset.state='ready';
      status.textContent='Drag to orbit · Scroll to zoom · Select a building to get closer';
      return controller;
    }catch{
      if(host.isConnected){
        cityScene?.dispose();cityScene=null;cityReady=null;
        host.parentElement.dataset.state='failed';
        status.textContent='The 3D map could not load. You can still view and download the building artwork above.';
      }
      return null;
    }
  })();
  return cityReady;
}
async function selectCity(index){
  citySelection=index;
  const project=cityProjects[index];
  const summary=$('#city-selection');
  if(!summary)return;
  summary.innerHTML=project?`<strong>${project.name}</strong><span>${project.area} · ${project.source}</span><a href="${project.path}" download>Download GLB</a><button class="button quiet" data-explore-building="${project.id}">Explore building</button>`:
    '<strong>Mumbai portfolio</strong><span>Six architectural reconstructions</span>';
  for(const button of view.querySelectorAll('[data-city-index]'))button.setAttribute('aria-pressed',String(Number(button.dataset.cityIndex)===index));
  const controller=await openCityMap();
  if(controller&&cityScene===controller&&citySelection===index)await controller.show(index,true);
}
function property(showroom=false){
  const p=viewerProjects()[activeProject];
  const title=showroom?'Customer Showroom':'Property Universe';
  const text=showroom?'Explore the architecture and illustrative availability.':'Orbit the portfolio and select a building to inspect its project records.';
  return (showroom?heading(title,text):buildingGallery())+
    `<div class="property-grid ${showroom?'':'property-tour'}"><div class="glass property-stage">
    <div class="scene scene-poster" id="property-scene" aria-label="Interactive building models"></div>
    <span class="gesture-pointer" id="gesture-pointer" aria-hidden="true" hidden></span>
    <video id="gesture-video" class="gesture-video" aria-label="Mirrored gesture camera preview" autoplay muted playsinline hidden></video>
    <div class="stage-top"><span>${p?clean(p.name):'Portfolio view'}</span><button class="button quiet" id="gesture-toggle" aria-pressed="false" aria-controls="gesture-status">Enable hand gestures</button><small id="scene-status" role="status"></small></div>
    <p id="gesture-status" role="status" hidden></p>
    ${showroom?'':`<div class="tour-render" aria-hidden="true"></div><div id="tour-plan" class="tour-plan" hidden><img fetchpriority="low" alt=""><div id="interior-view" class="interior-view" hidden></div><div id="interior-controls" class="interior-controls" hidden></div><p id="interior-status" class="interior-status" role="status" hidden></p></div>
    <div id="tour-copy" class="tour-copy">${tourCopy()}</div>
    <div id="tour-levels" class="tour-levels"></div>
    <span class="tour-render-caption">Illustrative rendering</span>
    <button class="button quiet tour-view-toggle" data-tour-view>3D view</button>
    <span id="tour-level-marker" class="tour-level-marker" aria-hidden="true" hidden></span>`}
    <div class="stage-bottom"><span>Drag to orbit · Scroll to zoom</span><div><button class="button quiet" data-zoom="1.13" aria-label="Zoom out">−</button><button class="button quiet" data-zoom=".88" aria-label="Zoom in">+</button><button class="button quiet" data-reset>Reset view</button></div></div>
    </div>${showroom?'':`<nav class="tour-chapters" id="tour-chapters" aria-label="Property tour">${tourChapters()}</nav>`}<aside class="glass panel inspector" id="inspector">${inspector(showroom)}</aside></div>
    <div class="tour-resources heading-actions"><a class="button quiet" href="/models.html">Model library ↗</a><label>Rendering <select id="quality"><option value="high">High</option><option value="performance" ${quality==='performance'?'selected':''}>Performance</option></select></label></div>
    <section class="glass panel gesture-guide"><div><h2>Hand controls</h2><p>Turn on the camera in the 3D view. Pinch to grab, raise your hand to lift, or move sideways to carry. Open your palm to separate the building and make a fist to put it back together.</p></div><div class="actions"><button class="button quiet" data-structure="expand">Separate</button><button class="button quiet" data-structure="restore">Reassemble</button></div></section>`;
}
function tourCopy(){
  const project=tourProjects[activeProject];
  if(!project)return `<h2 class="tour-title" tabindex="-1">Property<br>Universe</h2><p>Explore the Rubberwala portfolio</p><button class="button primary" data-tour="tower">Explore the neighborhood <span aria-hidden="true">→</span></button>`;
  if(floorPlanOpen)return `<h2 class="tour-title" tabindex="-1">Level ${floor}</h2><h2>${project.name}</h2><p>Illustrative ${project.id==='platinum-mall'?'retail':'residence'} layout · building concept</p><div class="tour-actions"><button class="button primary" data-interior="open">Enter 3D floor</button><button class="button quiet" data-tour="tower">Back to tower</button></div>`;
  return `<h2 class="tour-title" tabindex="-1">${project.name}</h2><p>${project.area} · Select an illustrative level</p><div class="tour-actions"><label class="sr" for="tour-floor">Select a level</label><select id="tour-floor">${Array.from({length:project.floors},(_,i)=>i+1).map(level=>`<option value="${level}" ${floor===level?'selected':''}>Level ${level}</option>`).join('')}</select><button class="button primary" data-tour="plan">View floor plan</button></div>`;
}
function tourChapters(){
  const stage=floorPlanOpen?'plan':activeProject>=0?'tower':'neighborhood';
  return [['neighborhood','Neighborhood'],['tower','Tower'],['plan','Floor plan']].map(([id,label])=>
    `<button data-tour="${id}" ${id===stage?'aria-current="step"':''} ${id==='plan'&&activeProject<0?'disabled':''}>${label}</button>`).join('');
}
function renderTour(updateCopy=true){
  const copy=$('#tour-copy');
  if(!copy)return;
  if(updateCopy)copy.innerHTML=tourCopy();
  $('#tour-chapters').innerHTML=tourChapters();
  const plan=$('#tour-plan');
  if(!floorPlanOpen)closeInterior();
  plan.hidden=!floorPlanOpen;
  const stage=copy.closest('.property-stage');
  stage.dataset.chapter=floorPlanOpen?'plan':activeProject>=0?'tower':'neighborhood';
  stage.classList.toggle('is-cinematic',!liveTour&&!floorPlanOpen);
  const toggle=stage.querySelector('[data-tour-view]');
  toggle.hidden=floorPlanOpen;
  toggle.textContent=liveTour?'Cinematic view':'3D view';
  const canvas=$('#property-scene');
  canvas.inert=floorPlanOpen||!liveTour;
  const project=tourProjects[activeProject];
  if(floorPlanOpen&&project){
    const image=plan.querySelector('img');
    image.src=`/tour-floor-plans/${project.id}.webp`;
    image.alt=`Illustrative furnished floor-plan cutaway for ${project.name}`;
  }
  const levels=$('#tour-levels');
  levels.hidden=!project||floorPlanOpen;
  if(project&&!floorPlanOpen){
    levels.style.setProperty('--level-position',100*(project.floors-floor)/(project.floors-1)+'%');
    levels.innerHTML=`<label class="sr" for="tour-level-slider">Tower level</label><input id="tour-level-slider" type="range" min="1" max="${project.floors}" value="${floor}"><span class="tour-level-number" aria-hidden="true">${floor}</span>`;
  }
  stage.style.setProperty('--tower-poster',project?`url('${exteriorPath(project.id)}')`:'none');
  scene?.showLevel(floorPlanOpen||mode!=='inventory'?null:floor);
}
function closeInterior(){
  interiorRequest++;
  interior?.dispose();
  interior=null;
  const plan=$('#tour-plan');
  if(!plan)return;
  plan.closest('.property-stage').classList.remove('in-interior');
  $('#interior-view').hidden=true;
  $('#interior-controls').hidden=true;
  $('#interior-status').hidden=true;
}
async function openInterior(button){
  const project=tourProjects[activeProject], host=$('#interior-view'), status=$('#interior-status'), controls=$('#interior-controls');
  if(!project||!host||!floorPlanOpen)return;
  const request=++interiorRequest;
  button.disabled=true;
  status.hidden=false;
  status.textContent='Opening the 3D interior…';
  try{
    const {createInterior}=await import('./interior-tour.js');
    if(request!==interiorRequest||!host.isConnected||!floorPlanOpen)return;
    host.hidden=false;
    interior=createInterior(host,project.id,{onRoomChange:(index,name)=>{
      const label=$('#interior-room');
      if(label)label.textContent=name;
      controls.dataset.interiorMode=index===-2?'overview':'walk';
      for(const item of controls.querySelectorAll('[data-interior-room]')){
        item.setAttribute('aria-pressed',String(Number(item.dataset.interiorRoom)===index));
      }
    }});
    const rooms=[{name:'3D cutaway',index:-2},...interior.rooms.map((name,index)=>({name,index}))];
    controls.innerHTML=`<div class="interior-header"><div><strong>${project.name} · Level ${floor}</strong><span id="interior-room" aria-live="polite">3D cutaway</span></div>
      <button class="button quiet" data-interior="close">Back to floor plan</button></div>
      <div class="interior-navigation"><div class="interior-steps" aria-label="Walk controls"><button class="button quiet" data-interior="back">Walk back</button><button class="button quiet" data-interior="forward">Walk forward</button></div>
      <p class="interior-orbit-help">Drag to orbit. Select a room to enter.</p><p class="interior-walk-help">Drag to look around. Use W A S D to walk.</p><div class="interior-rooms" aria-label="Rooms">${rooms.map(({name,index})=>`<button data-interior-room="${index}" aria-pressed="${index===-2}">${name}</button>`).join('')}</div></div>`;
    host.closest('.property-stage').classList.add('in-interior');
    controls.hidden=false;
    status.hidden=true;
    host.querySelector('canvas')?.focus({preventScroll:true});
  }catch{
    if(request!==interiorRequest)return;
    host.hidden=true;
    status.textContent='Interactive 3D is unavailable. The floor-plan image is still available.';
  }finally{
    if(button.isConnected)button.disabled=false;
  }
}
function changeTour(chapter,focus=false){
  if(chapter==='neighborhood')setFocus(-1);
  else if(chapter==='tower'&&activeProject<0)setFocus(0);
  else if(activeProject>=0){
    floorPlanOpen=chapter==='plan';
    if(floorPlanOpen){stopGestures();mode='inventory';}
    renderInspector();
  }
  if(focus)$('#tour-copy .tour-title')?.focus();
}
function inspector(showroom=false){
  if(!showroom){
    const current=tourProjects[activeProject];
    return `<div class="inspector-title"><h2>Select a building</h2><span>${tourProjects.length} reconstructions</span></div>
      <div class="project-picker">${tourProjects.map(project=>`<button data-focus="${project.index}" aria-pressed="${current===project}"><img class="model-preview" src="${exteriorPath(project.id)}" alt="" loading="lazy"><span><strong>${project.name}</strong><small>${project.area}</small></span><span aria-hidden="true">↗</span></button>`).join('')}</div>
      ${current?`<p class="muted">${current.source} · Floors and layouts are illustrative.</p><a class="button quiet" href="${current.path}" download>Download model ↓</a>`:''}`;
  }
  const p=projects[activeProject];
  if(!p) return `<div class="inspector-title"><h2>Explore buildings</h2><span>${projects.length} models</span></div><div class="project-picker">${projects.map(project=>`<button data-focus="${project.index}">${modelPreview(project)}<span><strong>${project.name}</strong><small>${project.form}</small></span><span aria-hidden="true">↗</span></button>`).join('')}</div>`;
  const data=metrics([p]), level=p.levels[floor-1];
  const tabs=showroom?['overview','inventory']:['overview','inventory','construction','finance'];
  const details={
    overview:`<div class="summary-row"><span>Planned floors</span><strong>${p.floors}</strong></div><div class="summary-row"><span>Available units</span><strong>${data.available}</strong></div><div class="summary-row"><span>Construction complete</span><strong>${data.progress}%</strong></div>`,
    inventory:`<label class="floor-label">Illustrative floor records <select id="floor">${p.levels.map(item=>`<option value="${item.number}" ${floor===item.number?'selected':''}>Floor ${item.number}</option>`).join('')}</select></label>
      <div class="unit-grid">${level.units.filter(unit=>!showroom||unit.status==='Available').map(unit=>`<button class="unit" data-unit="${unit.id}"><strong>${unit.id}</strong><span class="${unit.status.toLowerCase()}">${unit.status}</span></button>`).join('')||'<p>No available units on this floor.</p>'}</div><p class="muted">Floor-to-mesh mapping is unverified.</p>`,
    construction:`<div class="summary-row"><span>Completed floors</span><strong>${p.complete} / ${p.floors}</strong></div>${progress(data.progress)}<div class="summary-row"><span>Waterproofing</span><strong>${Math.round(constructionRecord(p).waterproofing[1]/constructionRecord(p).waterproofing[0]*100)}%</strong></div><div class="summary-row"><span>Forecast handover</span><strong>${dateLabel(constructionRecord(p).handover)}</strong></div><p class="muted">Illustrative site records.</p>`,
    finance:`<div class="summary-row"><span>Booked value</span><strong>${currency(data.booked)}</strong></div><div class="summary-row"><span>Collected</span><strong>${currency(data.collected)}</strong></div><div class="summary-row"><span>Outstanding</span><strong>${currency(data.outstanding)}</strong></div>`,
  };
  return `<button class="text-button" data-focus="-1">← All buildings</button><h2>${p.name}</h2><p class="muted">${p.form}</p><div class="tabs">${tabs.map(tab=>`<button data-mode="${tab}" aria-pressed="${mode===tab}">${tab}</button>`).join('')}</div>${details[mode]||details.overview}<a class="button quiet" href="${p.path}" download>Download model ↓</a>`;
}
function renderInspector(){
  const element=$('#inspector');
  if(element)element.innerHTML=inspector(activeRoute==='showroom');
  const label=$('.stage-top > span');
  if(label)label.textContent=viewerProjects()[activeProject]?.name||'Portfolio view';
  renderTour();
}
function setFocus(index,fromFloor,keepView=false){
  activeProject=index;
  floorPlanOpen=false;
  if(index>=0&&index<projects.length)contextProject=index;
  if(!keepView&&activeRoute==='property')liveTour=false;
  const selected=viewerProjects()[index];
  floor=selected?Math.min(fromFloor||(activeRoute==='property'?18:1),selected.floors):1;
  mode=fromFloor?'inventory':'overview';
  renderInspector();
  if(scene){
    const controller=scene;
    sceneReady=controller.show(index,true).then(()=>{
      if(scene!==controller)return null;
      controller.showLevel(mode==='inventory'&&!floorPlanOpen?floor:null);
      return controller;
    });
  }
}
function stopGestures(){
  if(!gestureSession)return;
  const session=gestureSession;
  gestureSession=null;
  session.controller.abort();
  session.driver?.release();
  session.preview.hidden=true;
  session.pointer.hidden=true;
  session.toggle.textContent='Enable hand gestures';
  session.toggle.setAttribute('aria-pressed','false');
  session.status.hidden=true;
}
async function toggleGestures(){
  if(gestureSession){stopGestures();return;}
  const session={
    controller:new AbortController(),preview:$('#gesture-video'),pointer:$('#gesture-pointer'),
    toggle:$('#gesture-toggle'),status:$('#gesture-status'),
  };
  gestureSession=session;
  const show=message=>{session.status.textContent=message;session.status.hidden=false;};
  session.toggle.textContent='Cancel hand gestures';
  session.toggle.setAttribute('aria-pressed','true');
  show('Starting camera and hand tracking…');
  try{
    const controller=await sceneReady;
    if(gestureSession!==session)return;
    if(!controller||$('#property-scene').classList.contains('scene-poster')){
      stopGestures();
      show('The 3D canvas is unavailable. Open this same Property Universe link in desktop Chrome or Edge with WebGL enabled.');
      return;
    }
    const {createGestureDriver,startHandTracking}=await import('./hand-gestures.js');
    if(gestureSession!==session)return;
    session.driver=createGestureDriver(controller,{onMessage:show,onPoint(point,pose){
      session.pointer.hidden=!point;
      if(point){
        session.pointer.dataset.pose=pose;
        session.pointer.style.left=point.x*100+'%';
        session.pointer.style.top=point.y*100+'%';
      }
    }});
    await startHandTracking({
      video:session.preview,signal:session.controller.signal,onFrame:session.driver.update,
      onError:()=>{stopGestures();show('Hand tracking stopped. Turn the camera on to retry.');},
    });
    if(gestureSession!==session)return;
    session.preview.hidden=false;
    session.toggle.textContent='Turn camera off';
    show('Camera on. Hold your hand in view and aim the dot at a tower.');
  }catch(error){
    if(gestureSession!==session)return;
    stopGestures();
    if(error.name==='NotAllowedError'||error.name==='SecurityError')show('Camera access is blocked. Allow it for this page, or open the same link in desktop Chrome or Edge.');
    else if(error.name==='NotFoundError')show('No webcam was detected. Connect a camera and try again.');
    else if(error.name==='NotReadableError')show('The camera could not start. Close other apps using it and try again.');
    else show('Hand tracking could not start. You can still use Separate and Reassemble on a selected building.');
  }
}
async function showBuildingSections(expand){
  const status=$('#gesture-status');
  const controller=await sceneReady;
  if(!status?.isConnected)return;
  const id=controller?.separateModel(expand)??-1;
  status.hidden=false;
  status.textContent=id>=0?(expand?'Building sections separated.':'Building reassembled.'):
    'Select a building in the 3D view or from the list first.';
}
const examples=['What is the profit today?','How many floors are completed?','How much money is outstanding?','Show floor 25 of Blue Glass Tower A','Open the portfolio, then zoom in','Spin from right to left'];
function jarvis(){
  return heading('Meet rAlix','Ask about the portfolio and see the underlying demo records.')+`
    <div class="jarvis-grid"><section class="glass panel jarvis-identity"><button type="button" class="ralix-globe" id="ralix-globe" aria-label="${conversationActive?'Close rAlix conversation':'Start rAlix conversation'}" aria-pressed="${conversationActive}"><span class="ralix-ring"></span><span class="ralix-ring ralix-ring--outer"></span><span class="ralix-core"><i></i><i></i><i></i></span><span class="ralix-echo"></span></button><h2>rAlix</h2><p>Executive intelligence</p><span class="ralix-session-label">${conversationActive?'Conversation active':'Tap the globe to start'}</span></section>
    <section class="glass panel jarvis-response" aria-live="polite"><h2>${lastAnswer?clean(lastAnswer.title):'Ask the portfolio'}</h2>
    ${lastAnswer?`<p class="query">${clean(lastAnswer.query)}</p><strong class="display-number">${clean(lastAnswer.value)}</strong><p>${clean(lastAnswer.detail)}</p>${lastAnswer.source?`<a class="button quiet" href="${clean(lastAnswer.source)}" target="_blank" rel="noopener">Official source ↗</a>`:lastAnswer.route?`<a class="button quiet" href="#${lastAnswer.route}">View supporting records ↗</a>`:''}`:'<p>Start with a question about November sales, construction progress, receivables or a building floor.</p>'}
    <div class="ralix-transcript" id="ralix-transcript" ${replyTranscript?'':'hidden'}><strong>rAlix reply</strong><p lang="${isHindi(replyTranscript)?'hi':'en'}">${clean(replyTranscript)}</p></div>
    <div class="suggestions">${examples.map((q,i)=>`<button data-example="${i}">${q} ↗</button>`).join('')}</div></section></div>`;
}
function paintRalix(){
  const globe=$('#ralix-globe',view);
  if(!globe)return;
  globe.classList.toggle('is-active',conversationActive);
  globe.classList.toggle('is-speaking',playingReply);
  globe.setAttribute('aria-pressed',String(conversationActive));
  globe.setAttribute('aria-label',conversationActive?'Close rAlix conversation':'Start rAlix conversation');
  $('.ralix-session-label',view).textContent=conversationActive?'Conversation active':'Tap the globe to start';
}
async function runCamera(command){
  const inViewer=['property','showroom'].includes(activeRoute);
  const returnToOverview=inViewer&&command.overview&&activeProject>=0;
  const focus=Number.isInteger(command.project)?command.project:-1;
  if(!inViewer){
    if(command.action==='stop')return 'The portfolio camera is idle.';
    activeProject=focus;
    mode='overview';
    navigate('property');
  }else if(focus>=0&&focus!==activeProject)setFocus(focus);
  else if(returnToOverview)setFocus(-1);
  if(floorPlanOpen)changeTour('tower');
  if(activeRoute==='property'&&command.action!=='stop'){liveTour=true;renderTour(false);ensurePropertyViewer();}
  const controller=await sceneReady;
  if(controller&&(returnToOverview||focus>=0))await controller.whenStill();
  if(!controller||scene!==controller||document.querySelector('#property-scene')?.classList.contains('scene-poster'))
    return 'I couldn’t move the camera. The interactive 3D view is unavailable.';
  if(command.action==='stop'){controller.stopMotion();return 'Camera stopped.';}
  if(command.action==='reset'){controller.reset();return 'Resetting the 3D view.';}
  if(command.action==='logo'){controller.focusLogo();return 'Moving to the Rubberwala logo.';}
  if(command.action==='top'){controller.top();return 'Switching to an overhead view.';}
  if(command.action==='zoom'){
    controller.zoom(command.factor,true);
    return command.out?'Zooming out.':'Zooming in.';
  }
  controller.spin(command.direction,command.degrees,command.continuous);
  return command.direction==='left'?'Rotating from right to left.':'Rotating from left to right.';
}
async function runSequence(commands,options){
  let reply='';
  for(const [index,command] of commands.entries()){
    reply=await ask(command,options);
    if(index<commands.length-1&&scene&&['property','showroom'].includes(activeRoute))await scene.whenStill();
  }
  return reply;
}
const actionResult=message=>({action:true,message});
function ask(query,options={}){
  const q=query.trim(), normalized=normalizeVoice(q);
  const namedProject=namedRubberwalaProject(q);
  if(namedProject)namedQuestionProject=namedProject;
  const contextFor=part=>{
    if(/portfolio|all (?:projects|buildings)|पूरे पोर्टफोलियो|सभी प्रोजेक्ट/i.test(part))return null;
    return namedRubberwalaProject(part)||namedProject||
      (activeRoute==='property'&&tourProjects[activeProject]?namedRubberwalaProject(tourProjects[activeProject].name):null)||
      (/^\s*(?:and|what about)\b|^\s*और|\b(?:this|that) (?:building|tower|project)\b|\bthere\b|इस बिल्डिंग|वहाँ/i.test(part)?namedQuestionProject:null);
  };
  if(isHindi(q)){
    if(/(?:3\s*डी|3d).*नक्शा|मुंबई.*नक्शा/.test(q)&&/खोल|दिखा/.test(q)){
      ask('open Mumbai map',options);
      return actionResult('मुंबई का तीन-आयामी नक्शा खोल रहा हूँ।');
    }
    if(namedProject&&/खोल|पर चल|ले चल/.test(q)&&!/फ्लोर प्लान|मंज़िल का नक्शा|मंजिल का नक्शा/.test(q)){
      ask('open '+namedProject.name,options);
      return actionResult(namedProject.name+' खोल रहा हूँ।');
    }
    const command=hindiCommand(q);
    if(command){
      const outcome=ask(command.command,options);
      const localized=reply=>reply?.action?actionResult(/unavailable|not found|idle/i.test(reply.message)?
        'यह कार्रवाई अभी उपलब्ध नहीं है।':command.message):'कृपया उस बिल्डिंग या सेक्शन का नाम बताइए।';
      return outcome&&typeof outcome.then==='function'?outcome.then(localized):localized(outcome);
    }
    const explicit=hindiProject(q);
    const project=explicit||projects[activeProject>=0?activeProject:contextProject>=0?contextProject:filter];
    if(explicit){filter=explicit.index;contextProject=explicit.index;}
    const parts=q.split(/\s+और\s+(?=(?:क्या|कब|कितन|कौन|कितनी|कितने))/).filter(Boolean);
    const answers=parts.map(part=>sheetAnswer(part,{hi:true,named:Boolean(contextFor(part)||explicit)})||rubberwalaAnswer(part,{hi:true,project:contextFor(part),tasks,data:totals})||hindiAnswer(part,{project,tasks}));
    const first=answers[0];
    const detail=[first.detail,...answers.slice(1).map(item=>item.value.replace(/[।?]$/,'')+'। '+item.detail)].join(' ');
    lastAnswer={query:q,title:answers.length>1?'आपके सवालों के जवाब':first.title,value:first.value,detail,source:first.source,
      route:answers.every(item=>item.route===first.route)?first.route:null};
    if(!options.stayOnPage)navigate('ralix');
    else if(activeRoute==='ralix')render();
    return 'जी सर, '+first.value+(/[।!?]$/.test(first.value)?' ':'। ')+detail;
  }
  if(!normalized)return;
  const command=normalized.replace(/^(?:uh |um |well |right |okay |ok |please |can you |could you |would you )+/,'').replace(/ please$/,'');
  const commands=q.split(/\s*,?\s+(?:(?:and )?then|and(?=\s+(?:zoom|spin|rotate|orbit|swipe|move|open|go to)\b))\s+/i);
  if(commands.length>1&&/^(?:open|show|zoom|spin|rotate|orbit|swipe|move|go|fly|take me|navigate|switch)\b/.test(command))return runSequence(commands,options);
  const task=q.match(/^(?:queue|assign|route|create) (?:a )?(?:demo )?task(?: (?:to|for))?[\s:]+(.+)/i);
  if(task){
    const count=queueCeoTask(task[1].trim().slice(0,300));
    return count+' demo '+(count===1?'task is':'tasks are')+' waiting for approval.';
  }
  const action=cameraCommand(command);
  if(action){
    if(action.action==='zoom'&&!action.overview){
      const tower=projects.find(item=>command.includes(normalizeVoice(item.name)));
      if(tower)action.project=tower.index;
      else if(/\b(?:this|that|current) (?:building|tower|project)\b/.test(command)&&contextProject>=0)action.project=contextProject;
    }
    return runCamera(action).then(actionResult);
  }
  const destination=command.match(/^(?:open(?:ing| up)?|show(?: me)?|go (?:back )?(?:to|in|into)|move(?: from .+)? (?:to|into)|fly to|focus on|take me (?:to|into)|navigate (?:to|into)|switch to|bring up|pull up|return to|head to) (?:the )?(.+)$/)?.[1];
  const namedBuilding=tourProjects.find(item=>destination===normalizeVoice(item.name));
  if(/^(?:property universe 3d|3d property universe|3d map|mumbai map|mumbai 3d map)$/.test(destination||'')){
    if(activeRoute!=='property')navigate('property');
    $('#city-title')?.focus();
    void openCityMap();
    return actionResult('Opening the Mumbai 3D map.');
  }
  if(/^(?:3d floor|interior|walkthrough|floor walkthrough)$/.test(destination||'')){
    if(activeRoute!=='property'||activeProject<0)return actionResult('Select a building first, then say open the interior.');
    if(!floorPlanOpen)changeTour('plan');
    const button=$('[data-interior="open"]');
    if(button&&!interior){button.focus();void openInterior(button);}
    return actionResult('Opening the building interior.');
  }
  if(namedBuilding){
    if(activeRoute!=='property')navigate('property');
    setFocus(namedBuilding.index);
    return actionResult('Opening '+namedBuilding.name+'.');
  }
  if(destination==='floor plan'||destination?.startsWith('floor plan ')){
    const legacy=projects.find(item=>destination.includes(normalizeVoice(item.name)));
    const target=tourProjects.find(item=>destination.includes(normalizeVoice(item.name)))||tourProjects[legacy?.index]||tourProjects[activeProject]||tourProjects[contextProject];
    if(!target)return actionResult('Section not found. Select a tower to open its floor plan.');
    const level=Number(destination.match(/\b(?:level|floor) (\d+)\b/)?.[1]|| (activeProject===target.index?floor:1));
    if(level<1||level>target.floors)return actionResult('Floor not found. This tower has '+target.floors+' levels.');
    if(activeRoute!=='property')navigate('property');
    if(activeProject!==target.index||floor!==level)setFocus(target.index,level);
    changeTour('plan');
    return actionResult('Showing the illustrative floor plan for level '+level+' of '+target.name+'.');
  }
  if(destination&&/^(?:this|that|current) (?:building|tower|project)$/.test(destination)){
    const project=activeRoute==='property'?tourProjects[activeProject]||tourProjects[contextProject]:projects[contextProject];
    if(!project)return 'Which building should I open?';
    if(!['property','showroom'].includes(activeRoute))navigate('property');
    setFocus(project.index);
    return actionResult('Moving to '+project.name+'.');
  }
  if(destination&&/^(?:that|this|(?:that|this|supporting|related) (?:page|section|records))$/.test(destination)){
    if(!lastAnswer?.route)return 'Which section should I open? You can say Finance, Documents, or any page name.';
    navigate(lastAnswer.route);
    return actionResult('Opening the supporting records.');
  }
  const found=findRoute(destination||command);
  if(found){
    const [route,aliases,team]=found;
    if(team!==undefined)department=team;
    if(route==='property'&&activeRoute==='property')setFocus(-1);
    else{
      if(route==='property'){activeProject=-1;mode='overview';}
      navigate(route);
    }
    return actionResult(route==='sales'?'Opening Sales and CRM.':'Opening '+aliases[0]+'.');
  }
  if(destination&&/^(?:monthly bookings|collections breakdown|project breakdown|daily briefing|portfolio at a glance)$/.test(destination)){
    const route=destination==='daily briefing'?'insights':destination==='collections breakdown'?'finance':'command';
    navigate(route);
    [...view.querySelectorAll('h2')].find(heading=>heading.textContent.toLowerCase().includes(destination))?.scrollIntoView({block:'start'});
    return actionResult('Showing '+destination+'.');
  }
  if(/^(?:export|download) (?:the )?(?:portfolio |sales )?(?:csv|report)$/.test(command)){
    exportCsv();
    return actionResult('Requested the demo portfolio CSV download.');
  }
  if(/^(?:scroll (?:up|down)|(?:go|scroll) to (?:the )?(?:top|bottom))$/.test(command)){
    if(command.includes('top')||command.includes('bottom'))window.scrollTo(0,command.includes('top')?0:document.documentElement.scrollHeight);
    else window.scrollBy(0,window.innerHeight*.7*(command.endsWith('down')?1:-1));
    return actionResult('Page scrolled.');
  }
  if(/^(?:start|begin|open) (?:the )?presentation$/.test(command)){
    present(0);
    return actionResult('Starting the presentation.');
  }
  if(/^(?:next|previous)(?: (?:slide|scene))?$/.test(command)){
    if(presenting<0)return 'Start the presentation first.';
    const index=presenting+(command.startsWith('next')?1:-1);
    if(index<0||index>=steps.length)return 'You’re already on the '+(index<0?'first':'last')+' scene.';
    present(index);
    return actionResult(stepTitles[index]+'.');
  }
  if(/^(?:end|exit|close) (?:the )?presentation$/.test(command)){
    present(-1);
    return actionResult('Presentation closed.');
  }
  const matching=projects.find(project=>normalized.includes(normalizeVoice(project.name))||normalized.includes(project.id));
  const projectAlias={'tower a':0,'tower b':3,'sail tower':1,'limestone tower':2};
  const namedDestination=destination&&(projects.find(item=>destination.includes(normalizeVoice(item.name))||destination.includes(item.id))||
    projects[projectAlias[destination]]);
  const project=matching||projects[activeProject>=0&&['property','showroom'].includes(activeRoute)?activeProject:filter];
  const data=project?metrics([project]):totals;
  const scope=project?.name||'the portfolio';
  const match=normalized.match(/(?:floor\s*(\d+)|(\d+)(?:st|nd|rd|th)\s+floor)/);
  let result;
  if(match&&!sheetAnswer(q,{named:Boolean(contextFor(q)||matching)})){
    const n=Number(match[1]||match[2]), target=project?tourProjects[project.index]:tourProjects[activeProject];
    if(!target)result={title:'Select a project',value:'Which building?',detail:'Include a building name to open a floor record.'};
    else if(n<1||n>target.floors)result={title:'Floor unavailable',value:target.name,detail:'The demo records contain floors 1 through '+target.floors+'.'};
    else{
      lastAnswer={query:q,title:'Floor intelligence',value:'Floor '+n,detail:target.name+' · illustrative floor records.',route:'property'};
      if(activeRoute!=='property')navigate('property');
      setFocus(target.index,n);
      return actionResult('Showing floor '+n+' of '+target.name+'.');
    }
  }else if(destination&&(namedDestination||/^(?:the )?(?:tower|building) [1-4]$/.test(destination))&&!/^(?:inventory|overview|finance|construction) (?:for|of) /.test(destination)){
    const target=namedDestination||projects[Number(destination.at(-1))-1];
    if(!['property','showroom'].includes(activeRoute))navigate('property');
    setFocus(target.index);
    return actionResult('Moving to '+target.name+'.');
  }else if(project&&/^(?:inventory|overview|finance|construction) (?:for|of) /.test(destination||'')){
    navigate('property');
    setFocus(project.index);
    mode=destination.split(' ')[0];
    renderInspector();
    return actionResult('Showing '+mode+' for '+project.name+'.');
  }else if(destination&&/^(?:open|go|move|fly|take me|navigate|switch|return to|head to)\b/.test(command)){
    return actionResult('Section not found. Try its name from the sidebar.');
  }else{
    const followUp=normalized.match(/^(?:and|what about) (today|yesterday|this month|last month)$/)?.[1];
    const topic=followUp&&lastAnswer?lastAnswer.title.replace(/^(?:today’s|yesterday’s|portfolio to date|june|july|august|september|october|november)\s+/i,'')+' '+followUp:q;
    const parts=topic.split(/\s*(?:\?|,?\s+and\s+(?=(?:what|how|when|which)\b))\s*/i).map(part=>part.trim()).filter(Boolean);
    const answers=parts.map(part=>{
      const words=normalizeVoice(part);
      const contextual=/this building|this tower|this project|\bit\b/.test(words);
      const building=projects.find(item=>words.includes(normalizeVoice(item.name)))||
        (contextual&&projects[contextProject])||project||projects[contextProject];
      const all=/\b(?:all projects|portfolio|all buildings)\b/.test(words);
      const site=all?projects:building?[building]:/this building|this tower|this project/.test(words)?[]:projects;
      return sheetAnswer(part,{named:Boolean(contextFor(part)||matching)})||rubberwalaAnswer(part,{project:contextFor(part),tasks,data})||
        constructionAnswer(words,site)||answerDemo(part,data,scope,{tasks,project});
    });
    result=answers.length===1?answers[0]:{title:'Portfolio answers',value:answers[0].value,
      detail:[answers[0].detail,...answers.slice(1).map(answer=>answer.title+': '+answer.value+'. '+answer.detail)].join(' '),
      route:answers.every(answer=>answer.route===answers[0].route)?answers[0].route:null,source:answers[0].source};
  }
  if(matching){filter=matching.index;contextProject=matching.index;}
  lastAnswer={query:q,...result};
  if(!options.stayOnPage)navigate('ralix');
  else if(activeRoute==='ralix')render();
  const spokenValue=result.value.replace(/₹([\d,.]+) Cr/g,'$1 crore rupees');
  const separator=/[.!?]$/.test(spokenValue)?' ':'. ';
  return (spokenValue+separator+result.detail.replace(/₹([\d,.]+) Cr/g,'$1 crore rupees')).trim();
}
function queueCeoTask(detail){
  if(!detail)return 0;
  const patterns=[/sales|booking|lead/i,/market|campaign/i,/construction|contractor|site progress/i,/finance|collection|cash|receivable/i,/procurement|supplier|quotation/i,/legal|compliance|rera/i,/customer|complaint|possession/i,/redevelopment|land|tenant/i,/hire|recruit|\bhr\b/i,/brief|report|strategy/i];
  const teams=departments.filter((item,i)=>patterns[i].test(detail));
  if(!teams.length)teams.push(departments[9]);
  const entries=teams.map(team=>({id:crypto.randomUUID(),name:team.roles[0].name,detail,approval:true,state:'Pending approval'}));
  tasks.unshift(...entries);
  store('tasks',tasks);
  log('AI CEO routed '+entries.length+' demo task'+(entries.length===1?'':'s'));
  navigate('approvals');
  return entries.length;
}
function workforce(map){
  const d=departments[department];
  const sample=operations[department];
  return heading(map?'AI Brain Map':'Department Workspaces',map?'Explore the ten departments in the AI workforce.':'Review agent responsibilities and route a local demo task.')+`
    <div class="workforce-grid"><section class="glass panel dept-list"><div class="panel-top"><h2>AI CEO</h2><span>Demo routing</span></div>
    <form id="ceo-form" class="ceo-form"><label for="ceo-command">Cross-department task</label><div><input id="ceo-command" name="command" maxlength="300" required placeholder="Review sales and construction progress"><button class="button primary">Route</button></div></form>
    <div class="dept-nodes">${departments.map(item=>`<button data-dept="${item.index}" aria-pressed="${item.index===department}">${item.name}<small>5 agents</small></button>`).join('')}</div></section>
    <section class="glass panel"><div class="panel-top"><h2>${d.name}</h2><span>5 configured agents</span></div>
    <div class="summary-row"><span>${sample.label}</span><strong>${sample.value}</strong></div><p class="muted">${sample.detail}</p>
    ${d.roles.map(role=>`<div class="summary-row"><span>${role.name}</span><button class="text-button" data-agent="${role.id}">Assign ↗</button></div>`).join('')}</section></div>`;
}
function admin(route){
  if(route==='tasks'||route==='approvals'){
    const approval=route==='approvals';
    const items=tasks.filter(task=>!approval||task.approval);
    return heading(approval?'Approval Centre':'Tasks',approval?'Review locally queued demo tasks that require approval.':'Track work routed to the configured demo agents.')+`
      <section class="glass panel"><div class="panel-top"><h2>${approval?'Approval queue':'Task history'}</h2><a class="text-button" href="#workforce">AI Brain Map ↗</a></div>
      ${items.map(task=>`<div class="task-row"><div><strong>${clean(task.name)}</strong><p>${clean(task.detail)}</p></div><span>${clean(task.state)}</span>${task.state==='Pending approval'?`<button class="button quiet" data-task="${task.id}" data-state="Rejected">Reject</button><button class="button primary" data-task="${task.id}" data-state="Approved">Approve</button>`:''}</div>`).join('')||'<p class="muted">No records yet. Assign an agent from the AI Brain Map to create a demo task.</p>'}</section>
      ${!approval&&activity.length?`<section class="glass panel"><h2>Recent activity</h2>${activity.slice(0,8).map(item=>`<div class="summary-row"><span>${clean(item.label)}</span><time>${clean(item.date)}</time></div>`).join('')}</section>`:''}`;
  }
  if(route==='documents'){
    return heading('Documents','Browse architectural assets and export illustrative portfolio records.')+`
      <section class="glass panel"><h2>Presentation reports</h2>${demoDocuments.map(report=>`<div class="summary-row"><div><strong>${report.title}</strong><p class="muted">${report.detail}</p></div><a class="text-button" href="#${report.route}">Open ↗</a></div>`).join('')}</section>
      <section class="glass panel"><h2>Local asset library</h2>${projects.map(p=>`<div class="summary-row"><span>${p.name}</span><a class="text-button" href="${p.path}" download>GLB ↓</a></div>`).join('')}<button class="button quiet" data-export>Export portfolio CSV</button></section>`;
  }
  return heading('Integrations','Connection status for authorized company data.')+`
    <section class="glass panel"><div class="panel-top"><h2>rAlix voice</h2><span id="tts-provider" class="status-label">Checking voice provider…</span></div>
    <p>With ElevenLabs configured, the Voice button and double-clap conversations use its live transcription and spoken replies. The wake greeting plays locally.</p></section>
    <section class="glass panel"><div class="panel-top"><h2>Google Drive</h2><span class="status-label">Disconnected</span></div>
    <p>Company document access requires a configured OAuth application, approved Drive scopes and server-side credentials.</p>
    <div class="summary-row"><span>Data source</span><strong>Local illustrative records</strong></div>
    <div class="summary-row"><span>Sales, finance and site ledgers</span><strong>Demo fixtures loaded</strong></div>
    <div class="summary-row"><span>Model assets</span><strong>${projects.length} local GLBs</strong></div></section>`;
}

function render(){
  stopGestures();
  closeInterior();
  cityScene?.dispose();
  cityScene=null;cityReady=null;citySelection=-1;
  stopArrival?.();
  stopArrival=null;
  const hash=location.hash.slice(1);
  const route=hash==='jarvis'?'ralix':(hash||'home');
  const known=['home','command','property','ralix','workforce','insights','sales','construction','finance','operations','documents','tasks','approvals','integrations','showroom'];
  activeRoute=known.includes(route)?route:'home';
  if(activeRoute==='showroom'&&activeProject>=projects.length){activeProject=-1;floor=1;mode='overview';}
  const selected=viewerProjects()[activeProject];
  if(selected)floor=Math.min(floor,selected.floors);
  document.body.classList.toggle('in-arrival',activeRoute==='home');
  document.body.classList.toggle('in-property-tour',activeRoute==='property'||activeRoute==='home');
  if(activeRoute!=='property')liveTour=false;
  if(activeRoute!=='property'||activeProject<0)floorPlanOpen=false;
  for(const item of document.querySelectorAll('.sidebar a,.topnav a')){
    if(item.hash==='#'+activeRoute)item.setAttribute('aria-current','page');
    else item.removeAttribute('aria-current');
  }
  if(scene){scene.dispose();scene=null;}
  sceneReady=Promise.resolve(null);
  viewerRequested=false;
  const token=++sceneTicket;
  if(activeRoute==='home'){
    view.innerHTML=arrivalPage();
    stopArrival=mountArrival(view);
  }else if(['command','sales','construction','finance'].includes(activeRoute))view.innerHTML=dashboard(activeRoute);
    else if(['property','showroom'].includes(activeRoute)){
      view.innerHTML=property(activeRoute==='showroom');
      renderTour(false);
      if(activeRoute==='showroom'||liveTour){viewerRequested=true;sceneReady=mountScene($('#property-scene'),token);}
    }else if(activeRoute==='ralix'){
      view.innerHTML=jarvis();
      paintRalix();
    }
    else if(['workforce','operations'].includes(activeRoute))view.innerHTML=workforce(activeRoute==='workforce');
    else if(activeRoute==='insights')view.innerHTML=insights();
    else view.innerHTML=admin(activeRoute);
    if(activeRoute==='integrations'){
      const status=$('#tts-provider');
      void voiceProvider().then(provider=>{status.textContent=provider==='elevenlabs'?'ElevenLabs configured':'Browser voice · ElevenLabs unconfigured';});
    }
  document.title=(activeRoute==='property'?'Property Universe':$('h1',view).textContent)+' | Rubberwala Brain';
}
function ensurePropertyViewer(){
  if(activeRoute!=='property'||viewerRequested)return;
  const host=$('#property-scene');
  if(!host)return;
  viewerRequested=true;
  sceneReady=mountScene(host,sceneTicket);
}
async function mountScene(host,token){
  const status=$('#scene-status');
  if(status)status.textContent='Loading models…';
  try{
    const {createScene}=await import('./scene.js');
    if(token!==sceneTicket)return;
    const propertyTour=activeRoute==='property';
    scene=createScene(host,{quality,tour:propertyTour,marker:$('#tour-level-marker'),
      catalog:propertyTour?tourProjects:null,isolateSelected:propertyTour,onSelect:index=>setFocus(index,undefined,true)});
    await scene?.show(activeProject);
    if(token!==sceneTicket)return;
    scene?.showLevel(mode==='inventory'&&!floorPlanOpen?floor:null);
    if(status)status.textContent=!scene||host.classList.contains('scene-failed')?'3D unavailable · use building list':'';
    return scene;
  }catch{
    host.classList.add('scene-poster');
    if(status)status.textContent='3D unavailable · use building list';
  }
}
function navigate(route){
  if(location.hash!=='#'+route)history.pushState(null,'','#'+route);
  render();
  window.scrollTo(0,0);
}
function open(content){
  $('#drill-content').innerHTML=content;
  if(!dialog.open)dialog.showModal();
}
function exportCsv(){
  const rows=[['Data mode','Project','Floor','Unit','Status','Price (INR crore)','Received (INR crore)']];
  for(const project of selectedList())for(const level of project.levels)for(const unit of level.units)
    rows.push(['Executive Demo - Illustrative Data',project.name,level.number,unit.id,unit.status,unit.price,unit.received]);
  const url=URL.createObjectURL(new Blob([rows.map(row=>row.map(value=>'"'+String(value).replaceAll('"','""')+'"').join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');
  link.href=url;
  link.download='rubberwala-illustrative-portfolio.csv';
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function log(label){
  activity.unshift({label,date:new Date().toLocaleDateString('en-IN')});
  store('activity',activity);
}
document.addEventListener('click',event=>{
  if(event.target.closest('#ralix-globe')){
    if(event.detail<=1){
      if(!conversationActive)store('voiceStandby',true);
      voice.toggleControl(Number($('#clap-count').value));
    }
    return;
  }
  const gestureButton=event.target.closest('#gesture-toggle,[data-structure]');
  if(gestureButton){
    if(gestureButton.id==='gesture-toggle')void toggleGestures();
    else void showBuildingSections(gestureButton.dataset.structure==='expand');
    return;
  }
  const link=event.target.closest('a[href^="#"]');
  if(link){
    event.preventDefault();
    navigate(link.hash.slice(1));
    $('.topnav').classList.remove('open');
    $('#menu').setAttribute('aria-expanded','false');
    return;
  }
  const b=event.target.closest('button');
  if(!b)return;
  const data=b.dataset;
  if(data.interior){
    if(data.interior==='open')void openInterior(b);
    else if(data.interior==='close'){closeInterior();$('[data-interior="open"]')?.focus();}
    else interior?.move(data.interior==='forward'?.46:-.46);
    return;
  }
  if(data.interiorRoom!==undefined){interior?.visit(Number(data.interiorRoom));return;}
  if(data.metric)open(`<h2>${metricNames[data.metric]}</h2><strong class="display-number">${fmt(data.metric,metrics(selectedList()))}</strong>${projectTable(selectedList())}`);
  else if(data.exploreBuilding){
    const project=tourProjects.find(item=>item.id===data.exploreBuilding);
    dialog.close();
    setFocus(project.index);
    $('#tour-copy .tour-title')?.focus();
  }
  else if(data.cityIndex!==undefined){void selectCity(Number(data.cityIndex));}
  else if(data.cityAction==='open'){
    $('#city-title')?.focus();
    void openCityMap();
  }
  else if(data.cityAction==='reset'){void selectCity(-1);}
  else if(data.cityAction==='overhead'){
    void openCityMap().then(controller=>{if(controller===cityScene)controller?.top();});
  }
  else if(data.buildingExterior){
    const [id,name,location]=buildingExteriors.find(([id])=>id===data.buildingExterior);
    open(`<div class="building-preview"><h2>${name}</h2><p>${location}, Mumbai · Illustrative exterior</p><img src="${exteriorPath(id)}" width="1920" height="1080" alt="Illustrative exterior of ${name}"><div class="actions"><button class="button primary" data-explore-building="${id}">Explore building</button><a class="button quiet" download href="${exteriorPath(id)}">Download image ↓</a></div></div>`);
  }
  else if(data.tourView!==undefined){
    if(liveTour)stopGestures();
    liveTour=!liveTour;
    renderTour(false);
    if(liveTour)ensurePropertyViewer();
  }
  else if(data.tour)changeTour(data.tour,true);
  else if(data.project!==undefined){
    dialog.close();
    navigate('property');
    setFocus(Number(data.project));
  }else if(data.focus!==undefined){
    setFocus(Number(data.focus));
    $('#tour-copy .tour-title')?.focus();
  }
  else if(data.mode){mode=data.mode;renderInspector();}
  else if(data.zoom)scene?.zoom(Number(data.zoom));
  else if(data.reset!==undefined)scene?.reset();
  else if(data.export!==undefined)exportCsv();
  else if(data.example!==undefined)ask(examples[Number(data.example)]);
  else if(data.dept!==undefined){department=Number(data.dept);render();}
  else if(data.unit){
    const item=projects[activeProject].levels[floor-1].units.find(unit=>unit.id===data.unit);
    open(`<h2>Unit ${item.id}</h2><div class="summary-row"><span>Status</span><strong>${item.status}</strong></div><div class="summary-row"><span>Illustrative price</span><strong>${currency(item.price)}</strong></div>`);
  }else if(data.agent){
    const agent=departments.flatMap(d=>d.roles).find(role=>role.id===data.agent);
    open(`<h2>${agent.name}</h2><p>Assign a task in the local demonstration. This creates a queue record.</p>
      <form id="assign" data-id="${agent.id}"><label>Task description<textarea name="task" required maxlength="300"></textarea></label><label class="check"><input type="checkbox" name="approval"> Require human approval</label>
      <button class="button primary">Queue demo task</button></form>`);
  }else if(data.task){
    const task=tasks.find(item=>item.id===data.task);
    if(task?.state==='Pending approval'){
      task.state=data.state;
      store('tasks',tasks);
      log(task.state+' · '+task.name);
      render();
    }
  }
});
window.addEventListener('pagehide',stopGestures);
document.addEventListener('change',event=>{
  if(event.target.id==='global-project'){filter=Number(event.target.value);store('projectFilter',filter);render();$('#global-project')?.focus();}
  else if(event.target.id==='floor'){floor=Number(event.target.value);renderInspector();$('#floor')?.focus();}
  else if(event.target.id==='tour-floor'){floor=Number(event.target.value);mode='inventory';renderInspector();$('#tour-floor')?.focus();}
  else if(event.target.id==='tour-level-slider'){floor=Number(event.target.value);mode='inventory';renderInspector();$('#tour-level-slider')?.focus();}
  else if(event.target.id==='quality'){quality=event.target.value;store('quality',quality);render();}
});
document.addEventListener('submit',event=>{
  if(event.target.id==='dock'){
    event.preventDefault();
    const input=$('#dock-query');
    ask(input.value);
    input.value='';
  }else if(event.target.id==='ceo-form'){
    event.preventDefault();
    queueCeoTask(String(new FormData(event.target).get('command')).trim());
  }else if(event.target.id==='assign'){
    event.preventDefault();
    const form=new FormData(event.target);
    const agent=departments.flatMap(d=>d.roles).find(role=>role.id===event.target.dataset.id);
    const detail=String(form.get('task')).trim();
    if(!detail)return;
    const approval=form.has('approval');
    tasks.unshift({id:crypto.randomUUID(),name:agent.name,detail,approval,state:approval?'Pending approval':'Queued'});
    store('tasks',tasks);
    log('Queued · '+agent.name);
    dialog.close();
    navigate('tasks');
  }
});
$('.close',dialog).onclick=()=>dialog.close();
$('#menu').onclick=()=>{
  const open=$('.topnav').classList.toggle('open');
  $('#menu').setAttribute('aria-expanded',String(open));
};
const handsFree=$('#hands-free');
const manualVoice=$('#voice');
const voiceStatus=$('#voice-status');
const voiceSetup=$('#voice-setup');
let dismissVoiceStatus;
const voice=createVoice({
  onCommand:query=>ask(query,{stayOnPage:true}),
  languagePreference:()=>saved('speechLanguage','auto'),
  onDisable:()=>store('voiceStandby',false),
  onPlayback(active){
    playingReply=active;
    document.body.classList.toggle('ralix-speaking',active);
    paintRalix();
  },
  onState({name,message,enabled,manual,conversation}){
    conversationActive=(conversation||manual)&&!['off','paused','clap-standby','limited'].includes(name);
    paintRalix();
    if(name==='speaking'){
      replyTranscript=message;
      const transcript=$('#ralix-transcript');
      if(transcript){
        const paragraph=transcript.querySelector('p');
        paragraph.textContent=message;
        paragraph.lang=isHindi(message)?'hi':'en';
        transcript.hidden=false;
      }
    }
    clearTimeout(dismissVoiceStatus);
    handsFree.dataset.voiceState=name;
    handsFree.setAttribute('aria-pressed',String(enabled));
    handsFree.title=enabled?'Turn off hands-free rAlix':'Enable hands-free rAlix';
    $('#hands-free-label').textContent=name==='starting'?'Starting…':name==='limited'?'Voice limited':['listening','speaking','working'].includes(name)?'rAlix active':enabled?'rAlix standby':'Hands-free';
    manualVoice.textContent=manual?'Listening…':'Voice';
    manualVoice.disabled=manual||['starting','speaking','working','listening'].includes(name);
    voiceStatus.textContent=message;
    voiceStatus.hidden=false;
    if(['off','armed','clap-standby'].includes(name))dismissVoiceStatus=setTimeout(()=>{voiceStatus.hidden=true;},5500);
  },
});
handsFree.onclick=()=>{
  if(voice.isEnabled()||handsFree.dataset.voiceState==='starting'){
    store('voiceStandby',false);
    voice.stop();
  }
  else{
    voiceSetup.returnValue='';
    voiceSetup.showModal();
  }
};
$('#clap-count').value=String(saved('clapCount',2));
$('#speech-language').value=saved('speechLanguage','auto');
$('#enable-mic').onclick=event=>{
  event.preventDefault();
  const count=Number($('#clap-count').value);
  store('clapCount',count);
  store('speechLanguage',$('#speech-language').value);
  store('voiceStandby',true);
  voiceSetup.close();
  void voice.enable(count);
};
manualVoice.onclick=()=>voice.once();

async function resumeVoiceStandby(){
  if(saved('voiceStandby',null)===false)return;
  try{
    const permission=await navigator.permissions.query({name:'microphone'});
    if(permission.state!=='granted')return;
  }catch{
    if(saved('voiceStandby',null)!==true)return;
  }
  if(!voiceSetup.open&&saved('voiceStandby',null)!==false)void voice.enable(Number($('#clap-count').value));
}
void resumeVoiceStandby();
window.addEventListener('pageshow',event=>{if(event.persisted)void resumeVoiceStandby();});
function present(index){
  presenting=index;
  const overlay=$('#presentation');
  overlay.hidden=index<0;
  document.body.classList.toggle('presenting',index>=0);
  if(index<0)return;
  const route=steps[index];
  if(route==='property'){activeProject=-1;mode='overview';}
  if(route==='project-demo'){activeProject=0;floor=1;mode='inventory';}
  $('#step').textContent=(index+1)+' / '+steps.length+' · '+stepTitles[index];
  $('#prev').disabled=index===0;
  $('#next').disabled=index===steps.length-1;
  navigate(route==='project-demo'?'property':route);
}
$('#present').onclick=()=>present(0);
$('#prev').onclick=()=>present(Math.max(0,presenting-1));
$('#next').onclick=()=>present(Math.min(steps.length-1,presenting+1));
$('#exit').onclick=()=>present(-1);
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&presenting>=0&&!dialog.open)present(-1);
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){
    event.preventDefault();
    $('#dock-query').focus();
  }
});
window.addEventListener('hashchange',render);
render();


function insights(){
  const list=selectedList(), data=metrics(list);
  const pending=tasks.filter(task=>task.state==='Pending approval').length;
  const furthest=[...list].sort((a,b)=>b.complete/b.floors-a.complete/a.floors)[0];
  const largest=[...list].sort((a,b)=>metrics([b]).outstanding-metrics([a]).outstanding)[0];
  return heading('AI Insights',subtitle+' · '+(projects[filter]?.name||'All projects'))+
    `<div class="dash-grid"><section class="glass panel"><h2>Daily executive briefing</h2>
    <p>${data.monthSold} flats sold in November. ${data.floors} of ${data.planned} floors are complete across the selected portfolio.</p>
    <div class="summary-row"><span>Highest completion rate</span><strong>${furthest.name}</strong></div>
    <div class="summary-row"><span>Largest outstanding balance</span><strong>${largest.name}</strong></div>
    <a class="button quiet" href="#finance">Review receivables ↗</a></section>
    <section class="glass panel"><h2>Executive notifications</h2><p>${pending?pending+' demo task'+(pending===1?' needs':'s need')+' a decision.':'The local approval queue is clear.'}</p>
    <a class="button quiet" href="#approvals">Open Approval Centre ↗</a></section></div>`;
}







