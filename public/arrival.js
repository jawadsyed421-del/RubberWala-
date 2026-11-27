const frameCount=240;
const chapters=[
  {label:'Clouds',frame:1,start:1},
  {label:'Valencia',frame:77,start:65},
  {label:'Nebula',frame:96,start:83},
  {label:'White House',frame:126,start:113},
  {label:'Fuego',frame:156,start:143},
  {label:'Platinum Mall',frame:186,start:173},
  {label:'EON',frame:219,start:203},
];

export function arrivalPage(){
  return `<section class="arrival-track" aria-labelledby="arrival-title">
    <div class="arrival-stage">
      <canvas class="arrival-film" width="1920" height="1080" aria-hidden="true"></canvas>
      <div class="arrival-copy">
        <h1 id="arrival-title">Property<br>Universe</h1>
        <p>Explore the Rubberwala portfolio.</p>
        <button class="button arrival-start" data-arrival-frame="${chapters[1].frame}">Explore the buildings <span aria-hidden="true">↓</span></button>
      </div>
      <button class="arrival-skip" data-arrival-skip>Open workspace <span aria-hidden="true">↓</span></button>
      <nav class="arrival-chapters" aria-label="Opening film chapters">
        ${chapters.map(({label,frame},index)=>`<button data-arrival-frame="${frame}" ${index===0?'aria-current="step"':''}>${label}</button>`).join('')}
      </nav>
    </div>
  </section>
  <section class="arrival-workspace" aria-labelledby="arrival-workspace-title">
    <div class="arrival-workspace-intro">
      <h2 id="arrival-workspace-title" tabindex="-1">Rubberwala workspace</h2>
      <p>Explore the buildings, review project records, or ask Ralix in English or Hindi.</p>
    </div>
    <div class="arrival-links">
      <a href="#property" class="arrival-link arrival-link--property"><strong>Property Universe</strong><span>Explore the towers in 3D and select a floor.</span><i aria-hidden="true">↗</i></a>
      <a href="#command" class="arrival-link"><strong>Command Centre</strong><span>Review sales, collections and construction progress.</span><i aria-hidden="true">↗</i></a>
      <a href="#ralix" class="arrival-link"><strong>Ask Ralix</strong><span>Speak a command or ask about the portfolio.</span><i aria-hidden="true">↗</i></a>
    </div>
    <nav class="arrival-section-links" aria-label="Workspace sections">
      <a href="#sales">Sales &amp; CRM</a><a href="#construction">Construction</a><a href="#finance">Finance</a><a href="#operations">Departments</a><a href="#documents">Documents</a>
    </nav>
  </section>`;
}

export function mountArrival(root){
  const track=root.querySelector('.arrival-track');
  const stage=track.firstElementChild;
  const canvas=stage.querySelector('canvas');
  const mobile=matchMedia('(max-width: 680px)').matches;
  if(mobile){canvas.width=960;canvas.height=540;}
  const context=canvas.getContext('2d',{alpha:false});
  const navButtons=[...stage.querySelectorAll('.arrival-chapters button')];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const downloads=new Map();
  const frames=new Map();
  const decoding=new Set();
  const listeners=new AbortController();
  let target=1, painted=0, pending=0, activeLoads=0, stopped=false, direction=1;

  function paint(){
    if(!context)return;
    let nearest=0;
    for(const number of frames.keys()){
      if(!nearest||Math.abs(number-target)<Math.abs(nearest-target))nearest=number;
    }
    if(!nearest||nearest===painted)return;
    context.drawImage(frames.get(nearest),0,0,canvas.width,canvas.height);
    painted=nearest;
    canvas.dataset.frame=String(nearest);
  }

  function decode(){
    const candidates=reduced.matches?[target]:[target,target+1,target-1,target+2,target-2];
    for(const number of candidates){
      if(decoding.size>=2)break;
      const blob=downloads.get(number);
      if(!blob||decoding.has(number)||frames.has(number))continue;
      decoding.add(number);
      createImageBitmap(blob).then(bitmap=>{
        if(stopped||Math.abs(number-target)>5){bitmap.close();return;}
        frames.set(number,bitmap);
        paint();
        for(const [index,image] of frames){
          if(Math.abs(index-target)>5&&index!==painted){image.close();frames.delete(index);}
        }
      },()=>{downloads.set(number,null);}).finally(()=>{
        decoding.delete(number);
        if(!stopped)decode();
      });
    }
  }

  function load(){
    if(stopped||!context)return;
    const upcoming=Array.from({length:24},(_,i)=>target+(i+1)*direction);
    const trailing=Array.from({length:7},(_,i)=>target-(i+1)*direction);
    const nearby=(reduced.matches?[target]:[target,...upcoming,...trailing])
      .filter(number=>number>=1&&number<=frameCount&&!downloads.has(number));
    for(const number of nearby.slice(0,4-activeLoads)){
      downloads.set(number,null);
      activeLoads++;
      const file=String(number).padStart(4,'0')+'.webp';
      fetch('/frames/'+(mobile?'mobile':'desktop')+'/'+file,{signal:listeners.signal})
        .then(response=>response.ok?response.blob():null)
        .then(blob=>{if(!stopped)downloads.set(number,blob);},()=>{}).finally(()=>{
        activeLoads--;
        if(stopped)return;
        decode();
        load();
      });
    }
  }

  function distance(){return track.offsetHeight-stage.offsetHeight;}
  function update(){
    pending=0;
    const headerHeight=document.querySelector('.topbar').offsetHeight;
    const offset=headerHeight-track.getBoundingClientRect().top;
    const progress=Math.max(0,Math.min(1,offset/Math.max(1,distance())));
    const position=1+progress*(frameCount-1);
    const chapter=chapters.findLastIndex(entry=>entry.start<=position+.25);
    const next=reduced.matches?chapters[chapter].frame:Math.round(position);
    if(next!==target)direction=Math.sign(next-target);
    target=next;
    stage.dataset.chapter=String(chapter);
    stage.style.setProperty('--arrival-progress',String(progress));
    navButtons.forEach((button,index)=>{
      if(index===chapter)button.setAttribute('aria-current','step');
      else button.removeAttribute('aria-current');
    });
    paint();
    decode();
    load();
  }
  function schedule(){if(!pending)pending=requestAnimationFrame(update);}

  stage.addEventListener('click',event=>{
    const button=event.target.closest('[data-arrival-frame],[data-arrival-skip]');
    if(!button)return;
    const behavior=reduced.matches?'instant':'smooth';
    if(button.hasAttribute('data-arrival-skip')){
      const workspace=root.querySelector('.arrival-workspace');
      workspace.scrollIntoView({behavior});
      workspace.querySelector('h2').focus({preventScroll:true});
      return;
    }
    const start=scrollY+track.getBoundingClientRect().top-document.querySelector('.topbar').offsetHeight;
    window.scrollTo({top:start+distance()*(Number(button.dataset.arrivalFrame)-1)/(frameCount-1),behavior});
  },{signal:listeners.signal});
  for(const event of ['scroll','resize'])window.addEventListener(event,schedule,{passive:true,signal:listeners.signal});
  reduced.addEventListener('change',schedule,{signal:listeners.signal});
  update();
  return ()=>{
    stopped=true;
    listeners.abort();
    if(pending)cancelAnimationFrame(pending);
    for(const image of frames.values())image.close();
    frames.clear();
    downloads.clear();
  };
}
