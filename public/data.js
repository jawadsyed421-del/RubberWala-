export const projects = [
  { id:'blue-glass-tower-a', name:'Blue Glass Tower A', form:'Curved glass / limestone', source:'0f0e8cac-9901-46f9-bf39-007400f4ff04', height:9.6, floors:30, complete:23, price:1.46 },
  { id:'ivory-sail-tower', name:'Ivory Sail Tower', form:'Sculpted glass / ivory fins', source:'5533b51d-83e1-4c58-82bf-3fe8a506266b', height:10.5, floors:40, complete:26, price:1.85 },
  { id:'limestone-glass-tower', name:'Limestone & Glass Tower', form:'Limestone / blue glazing', source:'aa6f188a-1a17-48bf-bd63-d9daa63617dd', height:8.1, floors:18, complete:16, price:1.22 },
  { id:'blue-glass-tower-b', name:'Blue Glass Tower B', form:'Curved glass / aluminum', source:'ff551a8d-c666-4e23-ae5c-cc9643c23ca1', height:9.85, floors:31, complete:17, price:1.54 },
].map((project,index)=>({
  ...project, index, path:'/models/'+project.id+'.glb', assetStatus:'illustrative',
  levels:Array.from({length:project.floors},(_,floor)=>({
    number:floor+1, complete:floor<project.complete,
    units:Array.from({length:4},(_,unit)=>{
      const key=(floor*31+unit*17+index*11)%113;
      const status=key<62?'Sold':key<78?'Reserved':'Available';
      const price=Math.round((project.price+floor*.019+unit*.085)*100)/100;
      return {
        id:`${floor+1}0${unit+1}`, status, price,
        month:status==='Sold' ? (key*5+floor)%6 : null,
        received:status==='Sold' ? Math.round(price*(.5+(key%4)*.1)*100)/100 : 0,
      };
    }),
  })),
}));
export const months=['Jun','Jul','Aug','Sep','Oct','Nov'];
export function metrics(list=projects){
  const units=list.flatMap(project=>project.levels.flatMap(level=>level.units));
  const sold=units.filter(unit=>unit.status==='Sold');
  const history=months.map((_,i)=>sold.filter(unit=>unit.month===i));
  const sum=(items,field)=>items.reduce((total,item)=>total+item[field],0);
  const value=sum(units,'price'), booked=sum(sold,'price'), collected=sum(sold,'received');
  function ledger(revenue,expenses){
    const round=n=>Math.round(n*100)/100;
    return {revenue:round(revenue),expenses:round(expenses),profit:round(revenue-expenses)};
  }
  const financeMonths=history.map((items,i)=>{
    const revenue=sum(items,'price');
    return ledger(revenue,revenue*(.72+i%3*.018));
  });
  const salesMonths=history.map(items=>items.length);
  // Sample daily ledger entries are included in the November reporting period.
  const daily=[[5.65,4.04,3,4.1,3.02,2],[4.8,3.64,2,3.6,2.7,2],[3.1,2.4,2,2.7,2.02,2],[4.5,3.32,3,3.32,2.48,2]];
  function day(offset){
    const sumDaily=field=>list.reduce((total,project)=>total+daily[project.index][offset+field],0);
    return {...ledger(sumDaily(0),sumDaily(1)),sales:sumDaily(2)};
  }
  const financials=ledger(sum(financeMonths,'revenue'),sum(financeMonths,'expenses'));
  return {
    value, booked, collected, outstanding:booked-collected, sold:sold.length, units:units.length,
    ...financials, financeMonths, salesMonths, today:day(0), yesterday:day(3),
    reserved:units.filter(unit=>unit.status==='Reserved').length,
    available:units.filter(unit=>unit.status==='Available').length,
    progress:Math.round(100*sum(list,'complete')/sum(list,'floors')),
    floors:sum(list,'complete'), planned:sum(list,'floors'),
    monthSold:history[5].length,
    history:history.map(items=>sum(items,'price')),
  };
}
export const currency=value=>'₹'+value.toLocaleString('en-IN',{maximumFractionDigits:1})+' Cr';
export const departments=[
  ['Sales','Property Sales Manager|Lead Qualification|Site Visit Booking|Channel Partner Manager|Sales Follow-up'],
  ['Marketing','Marketing Head|Social Media Manager|Advertisement Creator|Competitor Research|Campaign Manager'],
  ['Construction','Construction Project Manager|Site Progress Monitoring|Material Requirement|Contractor Performance|Construction Delay Detection'],
  ['Finance & Accounts','Chief Financial Officer|Cash Flow Analyst|Payment Collection|Expense Monitoring|Project Profitability'],
  ['Procurement','Purchase Manager|Supplier Research|Quotation Comparison|Inventory Monitoring|Material Cost Analyst'],
  ['Legal & Compliance','Legal Assistant|MahaRERA Compliance|Government Approval Tracker|Agreement Review|Documentation Manager'],
  ['Customer Relations','Customer Relationship Manager|WhatsApp Support|Customer Complaint|Possession Support|Customer Payment Reminder'],
  ['Redevelopment','Redevelopment Manager|Tenant Record Management|Land Opportunity Research|Project Feasibility|Tenant Rent Tracking'],
  ['Human Resources','HR Manager|Recruitment Assistant|Attendance Monitoring|Employee Performance Analyst|Administrative Assistant'],
  ["Chairman’s Office",'Executive Assistant|Daily Report Generator|Business Intelligence Analyst|Risk Management|Strategic Planning'],
].map(([name,roles],index)=>({name,index,roles:roles.split('|').map((role,i)=>({id:`${index+1}-${i+1}`,name:'AI '+role}))}));

