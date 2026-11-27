export const cityProjects=[
  {id:'valencia',name:'Valencia',area:'Parel',height:12,position:[-5,0,-9],source:'Turntable reconstruction'},
  {id:'nebula',name:'Nebula',area:'Khetwadi',height:15,position:[-15,0,9],source:'Turntable reconstruction'},
  {id:'white-house',name:'White House',area:'Kala Chowki',height:14,position:[10,0,-8],source:'Exterior-image reconstruction'},
  {id:'fuego',name:'Fuego',area:'Grant Road',height:12,position:[-4,0,13],source:'Turntable reconstruction'},
  {id:'platinum-mall',name:'Platinum Mall',area:'Grant Road',height:15,position:[-21,0,2],source:'Turntable reconstruction'},
  {id:'eon',name:'EON',area:'Jerbai Wadia Road',height:22,position:[-1,0,-21],source:'Turntable reconstruction'},
].map((project,index)=>({...project,index,path:'/models/mumbai-'+project.id+'.glb'}));

// Keep the original four demo slots available as navigation aliases.
const tourOrder=['valencia','eon','white-house','fuego','nebula','platinum-mall'];
const exampleLevels=[15,45,26,22,27,24];
export const tourProjects=tourOrder.map((id,index)=>({
  ...cityProjects.find(project=>project.id===id),
  index,
  floors:exampleLevels[index],
}));
