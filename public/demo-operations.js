import { currency, departments } from './data.js';

export const demoTasks=[
  {id:'demo-cash',name:'AI Cash Flow Analyst',detail:'Review the weekly collections forecast.',approval:true,state:'Pending approval'},
  {id:'demo-site',name:'AI Site Progress Monitoring',detail:'Check the next podium milestone.',approval:true,state:'Pending approval'},
  {id:'demo-leads',name:'AI Lead Qualification',detail:'Segment new showroom enquiries.',approval:false,state:'Completed'},
  {id:'demo-compliance',name:'AI MahaRERA Compliance',detail:'Compile the illustrative filing checklist.',approval:false,state:'Queued'},
];

export const demoDocuments=[
  {title:'Executive portfolio briefing',detail:'Bookings, collections, construction and daily demo profit',route:'insights'},
  {title:'Illustrative sales register',detail:'Bookings and unit availability by project',route:'sales'},
  {title:'Illustrative milestone register',detail:'Completed floors and construction progress',route:'construction'},
];

export const operations=[
  {topic:/lead|enquir|site visit|conversion|crm/i,label:'Sales pipeline',value:'86 qualified leads',detail:'24 site visits are scheduled and the demo conversion rate is 18%.'},
  {topic:/market|campaign|impression|advertis/i,label:'Marketing performance',value:'3 active campaigns',detail:'The illustrative campaigns reached 24,600 people and generated 126 enquiries.'},
  {topic:/contractor|delay|milestone|safety/i,label:'Site operations',value:'2 milestones due this week',detail:'The demonstration tracker has one schedule risk and no open safety incidents.'},
  {topic:/finance|accounts/i,label:'Finance and accounts',value:'4 project ledgers',detail:'The illustrative revenue, cost, profit, collections and receivables reports are available in Finance.'},
  {topic:/suppl|procure|material|purchase|vendor|quotation/i,label:'Procurement pipeline',value:'12 purchase requests',detail:'Three requests are awaiting a supplier quote in the demo tracker.'},
  {topic:/legal|rera|compliance|filing|permit/i,label:'Compliance tracker',value:'3 upcoming filings',detail:'Two checklists are ready for review and one is being drafted in the demo tracker.'},
  {topic:/customer|complaint|ticket|service/i,label:'Customer relations',value:'7 open service tickets',detail:'The demo team resolved 19 tickets this month, with a 96% satisfaction score.'},
  {topic:/redevelop|land|tenant/i,label:'Redevelopment pipeline',value:'4 sites under review',detail:'Two illustrative proposals are at the feasibility stage.'},
  {topic:/employee|staff|hiring|recruit|human resource|\bhr\b|attendance/i,label:'People operations',value:'118 employees',detail:'The demo has six open roles and a 96% attendance rate.'},
  {topic:/chairman|executive|strategy/i,label:'Chairman’s office',value:'3 executive priorities',detail:'The demo priorities are collections, site delivery, and sales conversion.'},
];

const routes={
  home:['home','home page','homepage','landing page','opening screen','main page'],
  command:['command centre','command center','dashboard','executive dashboard','executive command centre','executive overview'],
  property:['property universe','properties','portfolio','3d view','3d portfolio','property map','map','3d map','buildings','all buildings','3d buildings'],
  ralix:['ralix','ralix ai','rahilx','rahilx ai','jarvis','assistant','ai assistant','voice assistant'],
  workforce:['ai brain map','brain map','workforce','agents','ai workforce','ai ceo'],
  insights:['ai insights','insights','executive briefing'],
  sales:['sales','sales and crm','sales crm','crm','sales dashboard','sales reports','customer relationship management'],
  construction:['construction','construction dashboard','construction milestones','site progress','agency crm','agency c r m'],
  finance:['finance','finance dashboard','finance reports','accounts','finance and accounts','financials','financial reports','financial department','accounting'],
  operations:['departments','department workspaces','operations'],
  documents:['documents','document','docs','document library','files','project documents','asset library','models','model library','building models'],
  tasks:['tasks','task','task history','task list','task queue'],
  approvals:['approval centre','approval center','approvals','approval queue'],
  integrations:['integrations','connections','google drive'],
  showroom:['customer showroom','showroom','customer view'],
};

export function normalizeVoice(text){
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu,'').replace(/&/g,' and ').replace(/\bthree d\b/g,'3d')
    .replace(/[^a-z0-9\s-]/g,' ').replace(/\s+/g,' ').trim()
    .replace(/\b(?:c[ -]r[ -]m|see (?:are|ar) (?:em|m))\b/g,'crm');
}

export function findRoute(destination){
  const clean=normalizeVoice(destination).replace(/^(?:the |my |any )+/, '')
    .replace(/^(?:section|department|page|tab) (?:for |of )?/,'')
    .replace(/(?: (?:for me|now|please|page|screen|section|tab))+$/,'');
  const withoutDepartment=clean.replace(/(?: (?:departments?|workspaces?))+$/,'');
  const direct=Object.entries(routes).find(([,aliases])=>aliases.some(alias=>{
    const name=normalizeVoice(alias).replace(/(?: (?:page|screen|section|tab))+$/,'');
    return name===clean||name===withoutDepartment;
  }));
  if(direct)return direct;
  const match=departments.find(item=>{
    const name=normalizeVoice(item.name);
    return name===withoutDepartment||name.startsWith(withoutDepartment+' and ');
  });
  return match?['operations',[match.name],match.index]:undefined;
}

const result=(title,value,detail,route)=>({title,value,detail,route});
const months=['june','july','august','september','october','november'];

export function answerDemo(query,data,scope,{tasks,project}){
  const text=normalizeVoice(query);
  const month=months.findIndex(name=>text.includes(name));
  const today=/\btoday\b|daily|yesterday/.test(text);
  const monthly=month>=0||/this month|monthly|last month/.test(text);
  const period=today?(text.includes('yesterday')?'Yesterday':'Today'):monthly?
    (month>=0?months[month][0].toUpperCase()+months[month].slice(1):text.includes('last month')?'October':'November'):'Portfolio to date';
  const index=month>=0?month:text.includes('last month')?4:5;
  const finance=today?(text.includes('yesterday')?data.yesterday:data.today):monthly?data.financeMonths[index]:data;
  const timeLabel=today?(text.includes('yesterday')?'Yesterday’s':'Today’s'):period;
  const origin=today?'Illustrative figures for '+scope+'.':'Illustrative '+period.toLowerCase()+' figures for '+scope+'.';
  if(/profit|margin|earnings|net income|ebitda/.test(text)){
    const margin=finance.revenue?Math.round(finance.profit/finance.revenue*1000)/10:0;
    const detail=currency(finance.revenue)+' in revenue less '+currency(finance.expenses)+' in expenses. '+origin;
    return result(timeLabel+' profit',/margin/.test(text)?margin+'%':currency(finance.profit),detail,'finance');
  }
  if(/revenue|turnover|income|expenses?|spend|cost(?:ing|s)?|budget|cash flow/.test(text)){
    const costs=/expenses?|spend|cost(?:ing|s)?|budget/.test(text);
    return result(timeLabel+(costs?' expenses':' revenue'),currency(costs?finance.expenses:finance.revenue),origin,'finance');
  }
  if(/outstanding|receivable|\bowing\b|payments? due/.test(text))return result('Outstanding receivables',currency(data.outstanding),'Booked value less payments received for '+scope+'.','finance');
  if(/collections?|payment|collected/.test(text))return result('Customer collections',currency(data.collected),'Total illustrative receipts recorded for '+scope+'.','finance');
  if(/approv|\btask|pending/.test(text)){
    const pending=tasks.filter(task=>task.state==='Pending approval').length;
    return result('Approval queue',pending+' pending',tasks.length+' demo tasks are in the tracker.','approvals');
  }
  if(/available|inventory|reserved|price|pricing|cost of/.test(text)){
    const askingPrice=/price|pricing|cost of/.test(text);
    const reserved=/reserved/.test(text);
    return result('Property inventory',askingPrice?currency(project?.price??data.value/data.units):reserved?data.reserved+' reserved':data.available+' available units',
      data.units+' illustrative units are recorded for '+scope+'.','property');
  }
  if(/construction|completed|floors|progress/.test(text)&&!/delay|contractor/.test(text))
    return result('Construction progress',data.floors+' of '+data.planned+' floors',data.progress+'% complete across '+scope+'.','construction');
  if(/document|report|file/.test(text))return result('Document library',demoDocuments.length+' demo reports','The library includes executive, sales, and construction records, plus the building models.','documents');
  const department=operations.find(item=>item.topic.test(text));
  if(department)return result(department.label,department.value,department.detail,'operations');
  if(/sales|sold|booked|flats?|units?/.test(text)){
    const count=today?(text.includes('yesterday')?data.yesterday.sales:data.today.sales):monthly?data.salesMonths[index]:data.sold;
    const range=monthly||today?period+' bookings':'All recorded bookings';
    return result(monthly||today?timeLabel+' sales':'Sales to date',count+' units sold',range+' for '+scope+'.','sales');
  }
  if(/^(hi|hello|good morning|good evening)\b/.test(text))return result('Executive assistant','Hello, sir.','You can ask for a figure, a building, or any page in the presentation.');
  if(/brief|summary|overview|portfolio/.test(text))return result('Executive briefing',currency(data.today.profit)+' in demo profit today',
    'For '+scope+', '+data.sold+' units are sold and construction is '+data.progress+'% complete.','insights');
  return result('No matching demo record','I don’t have a figure for that yet.',
    'Try a project name and a specific item such as waterproofing, completed floors, handover, or collections.');
}
