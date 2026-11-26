const statusDate='2026-11-26';
const records=[
  {handover:'2027-09-30',baseline:'2027-09-30',waterproofing:[7420,5200],facade:[12800,5700],electrical:[90,38],plumbing:[30,18],milestone:'Complete the level 24 structural slab'},
  {handover:'2028-03-31',baseline:'2028-02-29',waterproofing:[9100,4300],facade:[16100,5100],electrical:[120,39],plumbing:[40,15],milestone:'Begin facade installation on levels 15 to 19'},
  {handover:'2027-04-30',baseline:'2027-04-30',waterproofing:[5600,4920],facade:[8400,7100],electrical:[54,43],plumbing:[18,15],milestone:'Complete the level 17 services inspection'},
  {handover:'2027-12-15',baseline:'2027-11-30',waterproofing:[7900,3250],facade:[13200,3300],electrical:[93,26],plumbing:[31,11],milestone:'Complete the podium waterproofing inspection'},
];

export function constructionRecord(project){
  return records[project?.index];
}
export const dateLabel=value=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(Date.parse(value));
const number=n=>n.toLocaleString('en-IN');
const percent=(done,total)=>Math.round(done/total*100);
const days=(from,to)=>Math.round((Date.parse(to)-Date.parse(from))/86400000);
const trades=[
  {key:'waterproofing',match:/water\s*proof/,label:'Waterproofing',unit:'square metres'},
  {key:'facade',match:/facade|cladding|curtain wall|glazing/,label:'Façade installation',unit:'square metres'},
  {key:'electrical',match:/electrical|wiring/,label:'Electrical installation',unit:'circuits'},
  {key:'plumbing',match:/plumb|drainage|pipework/,label:'Plumbing',unit:'floors'},
];

export function constructionAnswer(text,projects){
  const trade=trades.find(item=>item.match.test(text));
  const schedule=/completion date|finish date|handover|possession date|behind schedule|(?:when|how long|how much time|what is the time|how many (?:days|months)|time left).*(?:building|tower|project|complete|finish|done|ready|remaining|left)/.test(text);
  const milestone=/next milestone|next construction step/.test(text);
  const floorProgress=/\bfloors?\b/.test(text)&&/complete|completed|done|built|finished|cast|ready|left|remaining|progress|how many floors/.test(text);
  if(!trade&&!schedule&&!milestone&&!floorProgress)return null;
  if(!projects.length)return {title:'Which building?',value:'Choose a tower',detail:'Say its name or select it in Property Universe to use its construction records.',route:'property'};
  if(trade){
    const [total,done]=projects.reduce(([sum,finished],project)=>{
      const [planned,complete]=constructionRecord(project)[trade.key];
      return [sum+planned,finished+complete];
    },[0,0]);
    const remaining=/left|remaining|pending/.test(text);
    return {title:trade.label,value:remaining?number(total-done)+' '+trade.unit+' remaining':percent(done,total)+'% complete',
      detail:number(done)+' of '+number(total)+' '+trade.unit+' finished as of '+dateLabel(statusDate)+'. Illustrative site records.',route:'construction'};
  }
  if(schedule||milestone){
    if(projects.length!==1){
      const windows=projects.map(project=>project.name+' · '+dateLabel(constructionRecord(project).handover));
      return {title:'Forecast handovers',value:projects.length+' projects',detail:windows.join('. ')+'. Illustrative forecasts.',route:'construction'};
    }
    const project=projects[0], record=constructionRecord(project);
    const variance=days(record.baseline,record.handover);
    if(milestone)return {title:'Next milestone',value:record.milestone,detail:project.name+' · Demo site schedule.',route:'construction'};
    return {title:'Forecast completion',value:dateLabel(record.handover),detail:project.name+' has '+days(statusDate,record.handover)+' days remaining from the '+dateLabel(statusDate)+' demo snapshot. '+(variance>0?'The forecast is '+variance+' days after the baseline.':'On the baseline schedule.'),route:'construction'};
  }
  const done=projects.reduce((sum,project)=>sum+project.complete,0);
  const total=projects.reduce((sum,project)=>sum+project.floors,0);
  const name=projects.length===1?projects[0].name:'The portfolio';
  const remaining=/left|remaining|pending/.test(text);
  return {title:'Structural floor progress',value:remaining?(total-done)+' floors remaining':done+' of '+total+' floors complete',
    detail:name+' is '+percent(done,total)+' complete by structural floors. Illustrative site records.',route:'construction'};
}
