import { metrics, projects } from './data.js';
import { constructionRecord } from './construction-data.js';

const romanHindi=/\b(?:kya|kitna|kitni|kitne|batao|bataye|dikhao|kholo|kholiye|aaj|kal kab|ho gaya|hua hai|kab tak|kar do|karo|mein jao)\b/i;
export const isHindi=text=>/\p{Script=Devanagari}/u.test(text)||romanHindi.test(text);
const names=['ब्लू ग्लास टावर ए','आइवरी सेल टावर','लाइमस्टोन और ग्लास टावर','ब्लू ग्लास टावर बी'];
const aliases=[/ब्लू ग्लास टावर (?:ए|a)(?=\s|$|[,.।])/i,/आइवरी|आइवोरी|sail tower/i,/लाइमस्टोन|चूना पत्थर|limestone/i,/ब्लू ग्लास टावर (?:बी|b)(?=\s|$|[,.।])/i];
const fmt=new Intl.NumberFormat('hi-IN',{maximumFractionDigits:2});
const dateFmt=new Intl.DateTimeFormat('hi-IN',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
const money=new Intl.NumberFormat('hi-IN',{maximumFractionDigits:1});
const amount=value=>money.format(value)+' करोड़ रुपये';
const siteDate='2026-11-26';
const date=value=>dateFmt.format(Date.parse(value));
const dayDifference=(from,to)=>Math.round((Date.parse(to)-Date.parse(from))/86400000);
const result=(title,value,detail,route)=>({title,value,detail,route});

export function hindiProject(text){
  return projects.find((project,i)=>aliases[i].test(text)||text.toLowerCase().includes(project.name.toLowerCase()));
}

const places=[
  [/होम|मुख्य पेज|शुरुआत|\bhome\b/i,'home','होम पेज'],
  [/डैशबोर्ड|कमांड सेंटर|command cent|dashboard/i,'dashboard','डैशबोर्ड'],
  [/पोर्टफोलियो|प्रॉपर्टी|प्रॉपर्टी यूनिवर्स|(?:3\s*डी|3d)|पोर्टफ़ोलियो|नक्शा|portfolio|property universe/i,'portfolio','प्रॉपर्टी यूनिवर्स'],
  [/फाइनेंस|फ़ाइनेंस|वित्त|अकाउंट|finance|accounts/i,'finance','फाइनेंस'],
  [/बिक्री|सेल्स|सी\s*आर\s*एम|sales|\bcrm\b/i,'sales','सेल्स और सीआरएम'],
  [/निर्माण|कंस्ट्रक्शन|साइट प्रगति|construction/i,'construction','निर्माण'],
  [/दस्तावेज|दस्तावेज़|डॉक्यूमेंट|फाइल|फ़ाइल|document|\bfiles\b/i,'documents','दस्तावेज़'],
  [/अनुमोदन|अप्रूवल|मंजूरी|मंज़ूरी|approval/i,'approvals','अनुमोदन'],
  [/इंटीग्रेशन|कनेक्शन|integration/i,'integrations','इंटीग्रेशन'],
  [/शोरूम|showroom/i,'customer showroom','शोरूम'],
  [/कार्य सूची|टास्क|\btasks?\b/i,'tasks','कार्य सूची'],
  [/ब्रेन मैप|वर्कफोर्स|brain map|workforce/i,'ai brain map','एआई ब्रेन मैप'],
  [/इनसाइट|insight/i,'insights','इनसाइट्स'],
  [/विभाग|डिपार्टमेंट|department/i,'operations','विभाग'],
  [/रैलिक्स|रेलिक्स|\bralix\b/i,'ralix','रैलिक्स'],
];

export function hindiCommand(text){
  const question=/क्या|कितन|कौन|कब|कैसे|ky[aa]+|kitn|kab|kaise/i.test(text);
  const navigation=/खोल|जाओ|जाइए|ले चल|पर चल|दिखा|\b(?:kholo|kholiye|jao|jaaiye|dikhao|open|show)\b/i.test(text);
  const strongNavigation=/खोल|जाओ|जाइए|ले चल|पर चल|\b(?:kholo|kholiye|jao|jaaiye|open)\b/i.test(text);
  if(/ज़ूम|जूम|zoom|करीब लाओ|पास लाओ|पीछे करो/i.test(text)){
    const out=/आउट|दूर|पीछे|\bout\b/i.test(text);
    return {command:out?'zoom out':'zoom in',message:out?'ज़ूम कम कर रहा हूँ।':'ज़ूम बढ़ा रहा हूँ।'};
  }
  if(/घुमा|स्वाइप|\b(?:swipe|rotate|spin)\b/i.test(text)){
    const right=/बाएँ से दाएँ|बाएं से दाएं|left to right|दाईं ओर/i.test(text);
    return {command:right?'swipe left to right':'swipe right to left',message:'तीन-आयामी दृश्य घुमा रहा हूँ।'};
  }
  if(!navigation||question&&!strongNavigation)return null;
  if(/मुनाफ|नफ़ा|लाभ|वाटरप्र|मंज़िल|मंजिल|फ्लोर|\b(?:profit|floor|waterproofing)\b/i.test(text))return null;
  const tower=hindiProject(text);
  if(tower)return {command:'open '+tower.name,message:names[tower.index]+' खोल रहा हूँ।'};
  if(/(?:इस|ये|यह) (?:बिल्डिंग|टावर)/.test(text))return {command:'open this building',message:'चुनी हुई बिल्डिंग खोल रहा हूँ।'};
  const place=places.find(([match])=>match.test(text));
  if(!place)return null;
  return {command:'open '+place[1],message:place[2]+' खोल रहा हूँ।'};
}

export function hindiAnswer(text,{project,tasks=[]}={}){
  const selected=hindiProject(text)||project;
  const all=/सभी प्रोजेक्ट|सब प्रोजेक्ट|पूरे पोर्टफोलियो|all projects/i.test(text);
  const list=selected&&!all?[selected]:projects;
  const data=metrics(list);
  const scope=list.length===1?names[list[0].index]:'पूरे पोर्टफोलियो';
  const selectedScope=list.length===1?'इस प्रोजेक्ट में':'सभी प्रोजेक्ट में';
  const note='ये डेमो के आँकड़े हैं।';
  const yesterday=/बीते कल|कल का|कल की|कल कितन|कल क्या हुआ|\byesterday\b/i.test(text);
  const monthly=/इस महीन|महीने का|\b(?:this month|monthly)\b/i.test(text);
  const today=/आज|\b(?:aaj|today)\b/i.test(text);
  const ledger=yesterday?data.yesterday:monthly?data.financeMonths[5]:today?data.today:data;
  const period=yesterday?'बीते कल':monthly?'नवंबर':today?'आज':'अब तक';
  const trade=[
    [/वाटर\s*प्रूफ|वॉटर\s*प्रूफ|water\s*proof/i,'waterproofing','वॉटरप्रूफिंग','वर्ग मीटर'],
    [/फसाड|फ़साड|फैसाड|क्लैडिंग|facade|cladding/i,'facade','बाहरी दीवार का काम','वर्ग मीटर'],
    [/बिजली|इलेक्ट्रिकल|वायरिंग|electrical/i,'electrical','बिजली का काम','सर्किट'],
    [/प्लंबिंग|पाइप|plumb/i,'plumbing','प्लंबिंग','मंज़िलें'],
  ].find(([match])=>match.test(text));
  const schedule=/कब तक|कब.*(?:पूरा|तैयार|हैंडओवर|खत्म)|कितना समय|कितने दिन|कितने महीने|हैंडओवर|kab tak|handover|completion date/i.test(text);
  const floorProgress=/मंजि[ल़]|मंज़िल|फ्लोर|तल|\bfloors?\b/i.test(text);
  if(/^(?:नमस्ते|नमस्कार|कैसे हो|कैसे हैं)[।?! ]*$/.test(text.trim()))
    return result('स्वागत','नमस्ते', 'बताइए, किस प्रोजेक्ट या विभाग की जानकारी चाहिए?');
  if(/(?:हिंदी|हिन्दी) में (?:बोल|जवाब)/.test(text))
    return result('हिन्दी में मदद','ज़रूर, आप हिन्दी में पूछ सकते हैं', 'मैं बिक्री, वित्त, निर्माण और प्रोजेक्ट की जानकारी हिन्दी में बता सकता हूँ।');
  if(!selected&&!all&&/इस (?:बिल्डिंग|टावर|प्रोजेक्ट)/.test(text)&&(trade||schedule||floorProgress))
    return result('बिल्डिंग चुनें','किस बिल्डिंग की जानकारी चाहिए?', 'टावर का नाम बताइए या उसे प्रॉपर्टी यूनिवर्स में चुनिए।','property');
  if(trade){
    const [,key,label,unit]=trade;
    let planned=0,complete=0;
    for(const item of list){const [total,done]=constructionRecord(item)[key];planned+=total;complete+=done;}
    const remainder=/बाकी|बचा|शेष|remaining/i.test(text);
    return result(label,remainder?fmt.format(planned-complete)+' '+unit+' बाकी हैं':Math.round(complete/planned*100)+' प्रतिशत काम पूरा है',
      scope+' में '+fmt.format(planned)+' '+unit+' में से '+fmt.format(complete)+' '+unit+' का काम हो चुका है। '+note,'construction');
  }
  if(schedule){
    if(list.length>1)return result('अनुमानित हैंडओवर','चार प्रोजेक्ट की अनुमानित तारीखें',
      list.map(item=>names[item.index]+': '+date(constructionRecord(item).handover)).join('। ')+'। '+note,'construction');
    const record=constructionRecord(list[0]);
    return result('अनुमानित हैंडओवर',date(record.handover),
      scope+' की इस तारीख तक पूरा होने की उम्मीद है। डेमो रिकॉर्ड की तारीख '+date(siteDate)+' से '+dayDifference(siteDate,record.handover)+' दिन बाकी हैं।','construction');
  }
  if(floorProgress){
    const remaining=/बाकी|बचा|शेष|remaining/i.test(text);
    return result('मंज़िलों की प्रगति',remaining?(data.planned-data.floors)+' मंज़िलें बाकी हैं':data.planned+' में से '+data.floors+' मंज़िलें पूरी हैं',
      scope+' में ढाँचे का '+data.progress+' प्रतिशत काम पूरा है। '+note,'construction');
  }
  if(/मुनाफ|लाभ|नफ़ा|नफा|\bprofit\b|munafa/i.test(text))
    return result('मुनाफ़ा',period+' का मुनाफ़ा '+amount(ledger.profit)+' रहा',
      selectedScope+' आमदनी '+amount(ledger.revenue)+' और खर्च '+amount(ledger.expenses)+' रहा। '+note,'finance');
  if(/खर्च|आमदनी|आय|राजस्व|\b(?:revenue|costs?|expenses)\b/i.test(text)){
    const costs=/खर्च|\b(?:costs?|expenses)\b/i.test(text);
    return result(costs?'खर्च':'आमदनी',period+(costs?' का खर्च ':' की आमदनी ')+amount(costs?ledger.expenses:ledger.revenue)+(costs?' रहा':' रही'),scope+' के डेमो खाते से।','finance');
  }
  if(/बकाया|वसूली|कलेक्शन|वसूल|भुगतान|receivable|collection/i.test(text)){
    const due=/बकाया|receivable/i.test(text);
    return result(due?'बकाया रकम':'वसूली',amount(due?data.outstanding:data.collected),scope+' के डेमो खाते से।','finance');
  }
  if(/उपलब्ध|खाली|अवेलेबल|बिक[ीेा]|बेच|बिक्री|सेल्स|बुकिंग|\b(?:sales|sold|bookings?)\b/i.test(text)){
    const available=/उपलब्ध|खाली|अवेलेबल|available/i.test(text);
    const count=available?data.available:yesterday?data.yesterday.sales:monthly?data.monthSold:today?data.today.sales:data.sold;
    return result(available?'उपलब्ध यूनिट':'बिक्री',available?count+' यूनिट उपलब्ध हैं':period+' '+count+' यूनिट बिकीं',scope+' के डेमो रिकॉर्ड से।','sales');
  }
  if(/मंज़ूरी|मंजूरी|अप्रूवल|अनुमोदन|approval/i.test(text))
    return result('अनुमोदन',tasks.filter(task=>task.state==='Pending approval').length+' काम मंज़ूरी के लिए बाकी हैं',note,'approvals');
  if(/कंस्ट्रक्शन|निर्माण|प्रगति/i.test(text))
    return result('निर्माण की प्रगति',scope+' में '+data.progress+' प्रतिशत ढाँचा पूरा है',
      data.planned+' में से '+data.floors+' मंज़िलें पूरी हैं। '+note,'construction');
  if(/क्या हुआ|कुछ बताओ|आज|सारांश|अपडेट|ब्रिफ|brief|aaj|kya hua|batao/i.test(text)){
    const day=yesterday?data.yesterday:data.today;
    const label=yesterday?'बीते कल':'आज';
    return result(label+' की संक्षिप्त जानकारी',label+' '+day.sales+' यूनिट बिकीं और मुनाफ़ा '+amount(day.profit)+' रहा',
      scope+' में अब तक '+data.planned+' में से '+data.floors+' मंज़िलें पूरी हैं। '+note,'insights');
  }
  return result('और जानकारी चाहिए','इस सवाल का जवाब मेरे डेमो रिकॉर्ड में नहीं है',
    'आप किसी बिल्डिंग का नाम लेकर उसकी प्रगति, हैंडओवर, बिक्री या मुनाफ़ा पूछ सकते हैं।');
}
