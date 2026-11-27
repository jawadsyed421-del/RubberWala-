import { cityProjects } from './city-projects.js';
import { currency } from './data.js';

const official='https://www.rubberwala.com';
const portfolio=official+'/projects';
const completed=cityProjects.filter(project=>project.id!=='eon');
const hindiNames=[/वैलेंसिया|वेलेंसिया|वैलेंशिया/u,/नेबुला|नेब्यूला/u,/व्हाइट हाउस|वाइट हाउस/u,/फुएगो|फ्यूगो/u,/प्लैटिनम मॉल|प्लेटिनम मॉल/u,/ईओएन|ईऑन|ई ओ एन|इऑन/u];
const examples=[
  {floors:[13,15],water:[2940,3400],money:[12.6,9.4],units:8,approvals:['Level 13 slab inspection','Podium waterproofing method']},
  {floors:[21,30],water:[6200,9100],money:[19.8,15.3],units:18,approvals:['Façade sample panel','Level 20 slab inspection']},
  {floors:[20,26],water:[4720,5850],money:[16.1,12.25],units:13,approvals:['Wet-area waterproofing mock-up','Level 19 service inspection']},
  {floors:[18,22],water:[3950,4800],money:[14.2,10.8],units:11,approvals:['Level 18 slab inspection','Terrace drainage mock-up']},
  {floors:[19,24],water:[5400,7200],money:[24.4,18.8],units:16,approvals:['Retail podium finish sample','Concourse electrical inspection']},
  {floors:[31,45],water:[7200,11100],money:[27.6,22.1],units:22,approvals:['Level 30 slab inspection','Façade tender shortlist']},
];
const result=(title,value,detail,route,source)=>({title,value,detail,route,source});
export function namedRubberwalaProject(text){
  const normalized=' '+text.toLowerCase().replace(/\be\s+o\s+n\b/g,'eon').replace(/[^a-z0-9]+/g,' ').trim()+' ';
  return cityProjects.find(({name},index)=>normalized.includes(' '+name.toLowerCase()+' ')||hindiNames[index].test(text));
}
export function rubberwalaAnswer(text,{hi=false,project,tasks=[],data}={}){
  const q=text.toLowerCase();
  const current=project&&examples[project.index];
  const publicQuestion=/official|actual|real (?:status|data|figures)|publicly|आधिकारिक|असल|वास्तविक/.test(q);
  const construction=/\bfloors?\b|construction|progress|slabs?|structural|मंज़िल|मंजिल|फ्लोर|निर्माण/.test(q);
  const water=/water[\s-]*proof|वॉटरप्रूफ|वाटरप्रूफ|वॉटर प्रूफ|जलरोध/.test(q);
  const money=/profit|cost(?:ing|s)?|expenses?|revenue|turnover|budget|margin|मुनाफ|नफ़ा|नफा|लाभ|खर्च|लागत|बजट|आमदनी/.test(q);
  const approval=/approv(?:als?|ed|es?)|sanction|अप्रूव|स्वीकृत|मंज़ूरी|मंजूरी/.test(q);
  const remaining=/remaining|left|pending|outstanding|बचा|बचे|बाकी|लंबित/.test(q);
  const monthFinance=/last month|previous month|yesterday|today|october|june|july|august|september|पिछले महीने|बीते महीने|कल|आज|अक्टूबर/.test(q);
  if(/contact|office address|phone number|email address|संपर्क|फोन नंबर|ऑफिस का पता/.test(q)){
    return hi?result('संपर्क','रबरवाला का मुंबई कार्यालय','रबरवाला हाउस, डॉक्टर आनंद राव नायर रोड, अग्रिपाड़ा। फ़ोन 022 4958 7800। ईमेल info@rubberwala.com।',null,official+'/contact-us'):
      result('Official contact','Rubberwala House, Agripada','Dr. Anand Rao Nair Road, Mumbai 400011. Call +91 22 4958 7800 or email info@rubberwala.com.',null,official+'/contact-us');
  }
  if(/founder|who (?:owns|founded|is rubberwala)|company (?:history|profile)|tell me about rubberwala|रबरवाला के बारे|किसने शुरू|संस्थापक/.test(q)){
    return hi?result('कंपनी परिचय','रबरवाला हाउसिंग एंड इंफ्रास्ट्रक्चर','मुंबई की इस डेवलपर कंपनी की शुरुआत तबरेज़ शेख़ ने शेख़ एंड एसोसिएट्स के रूप में की।',null,official+'/about-us'):
      result('Company profile','Rubberwala Housing & Infrastructure Ltd.','The Mumbai developer traces its roots to Shaikh & Associates, founded by Tabrez Shaikh.',null,official+'/about-us');
  }
  if(publicQuestion&&(money||water||approval||/how many.*done|complete.*floors|floors.*complete|कितन.*मंजिल/.test(q))){
    return hi?result('सत्यापित रिकॉर्ड','इसके लिए आधिकारिक दस्तावेज़ चाहिए','रबरवाला की सार्वजनिक सूची में इस सवाल के लिए सत्यापित आँकड़ा उपलब्ध नहीं मिला। प्रस्तुति के लिए उदाहरण आँकड़े पूछ सकते हैं।',null,portfolio):
      result('Verified records','This figure needs a project record','The public project listing does not establish this figure. Ask for the presentation scenario to hear the sample figures.',null,portfolio);
  }
  if(current&&/available|inventory|unsold|उपलब्ध|बिक्री के लिए/.test(q)){
    return hi?result('उदाहरण इन्वेंटरी',`${current.units} यूनिट उपलब्ध`,project.name+'। प्रस्तुति के उदाहरण आँकड़े।','sales'):
      result('Sample inventory',current.units+' units available',project.name+' · Illustrative presentation inventory.','sales');
  }
  if(current&&(water||construction||money||approval||remaining)&&!(publicQuestion&&/status|स्थिति/.test(q)&&!water&&!money&&!approval)){
    const source=hi?' प्रस्तुति के उदाहरण आँकड़े।':' Illustrative presentation figures.';
    const [done,total]=water?current.water:current.floors;
    if(water||construction){
      const label=water?'Waterproofing':'Structural floors',unit=water?'square metres':'floors';
      const unitHi=water?'वर्ग मीटर':'मंज़िलें';
      return hi?result(water?'वॉटरप्रूफिंग':'निर्माण प्रगति',remaining?`${total-done} ${unitHi} बाकी हैं`:`${total} में से ${done} ${unitHi} पूरी हैं`,project.name+'।'+source,'construction'):
        result(label,remaining?`${total-done} ${unit} remaining`:`${done} of ${total} ${unit} complete`,project.name+' · '+Math.round(done*100/total)+'% complete.'+source,'construction');
    }
    if(money&&!monthFinance){
      const [revenue,cost]=current.money;
      const kind=/profit|margin|मुनाफ|लाभ|नफ़ा|नफा/.test(q)?'profit':/cost|expense|budget|लागत|खर्च|बजट/.test(q)?'cost':'revenue';
      const amount=kind==='profit'?revenue-cost:kind==='cost'?cost:revenue;
      const rupees=n=>Number(n.toFixed(2))+' करोड़ रुपये';
      return hi?result('नवंबर 2026 का उदाहरण',rupees(amount),`${project.name} में आमदनी ${rupees(revenue)} और लागत ${rupees(cost)}।`+source,'finance'):
        result('November 2026 '+kind,currency(amount),`${project.name}: ${currency(revenue)} revenue and ${currency(cost)} costs.`+source,'finance');
    }
    if(money)return hi?result('वित्तीय अवधि','इस बिल्डिंग का उदाहरण नवंबर 2026 के लिए है','नवंबर की लागत, आमदनी या लाभ पूछें।','finance'):
      result('Financial period','The project example covers November 2026','Ask for November profit, revenue, or costs for this project.','finance');
    if(approval){
      const count=current.approvals.length;
      if(remaining)return hi?result('नमूना अनुमोदन','एक समीक्षा लंबित है','अगली साइट गुणवत्ता समीक्षा उदाहरण के तौर पर लंबित है।','approvals'):
        result('Sample approvals','One review pending','The next site quality review is pending in the presentation scenario.','approvals');
      return hi?result('नमूना अनुमोदन',`${count} उदाहरण अनुमोदित`,'साइट निरीक्षण और डिज़ाइन या काम की समीक्षा।'+source,'approvals'):
        result('Sample approvals',count+' sign-offs',current.approvals.join('; ')+'.'+source,'approvals');
    }
    if(remaining)return hi?result('बचा हुआ काम',`${total-done} मंज़िलें और ${current.units} यूनिट`,'यूनिट बिक्री के लिए बची हैं।'+source,'construction'):
      result('Remaining work',`${total-done} structural floors remaining`,`${current.water[1]-current.water[0]} square metres of waterproofing remain, and ${current.units} units are available.`+source,'construction');
  }
  if(current&&/location|address|where|status|tell me about|overview|which area|कहाँ|कहां|इलाका|स्थिति|के बारे/.test(q)){
    const eon=project.id==='eon';
    const detail=eon?'Rubberwala’s archive lists it among ongoing projects.':'Rubberwala’s current portfolio lists it as completed.';
    return hi?result('परियोजना परिचय',project.name,project.area+' में है। '+(eon?'पुरानी सूची में इसे जारी परियोजना के रूप में दिखाया गया है।':'रबरवाला की वर्तमान सूची में इसे पूरा बताया गया है।'),'property',eon?official+'/eon.htm':portfolio+'/'+project.id):
      result('Published project information',project.name,project.area+', Mumbai. '+detail,'property',eon?official+'/eon.htm':portfolio+'/'+project.id);
  }
  if(/complet(?:ed|e).*projects|projects.*complet(?:ed|e)|which (?:buildings|projects)|पूरी परियोजना|कौन.*बिल्डिंग.*पूरी/.test(q)){
    return hi?result('प्रकाशित पोर्टफोलियो','पाँच परियोजनाएँ पूरी', 'वैलेंसिया, नेबुला, व्हाइट हाउस, फुएगो और प्लैटिनम मॉल।','property',portfolio):
      result('Published portfolio','Five projects listed as completed',completed.map(p=>p.name).join(', ')+'.','property',portfolio);
  }
  if(approval&&/\bapproved\b|स्वीकृत|मंज़ूर|मंजूर/.test(q)){
    const approved=tasks.filter(task=>task.state==='Approved');
    return hi?result('अनुमोदन सूची',`${approved.length} काम स्वीकृत`,approved.length?'स्वीकृत काम अनुमोदन सूची में देखें।':'अभी कोई काम स्वीकृत दर्ज नहीं है।','approvals'):
      result('Approval queue',approved.length+' approved',approved.length?approved.slice(0,4).map(task=>task.detail).join(' '):'The local tracker has no approved tasks yet.','approvals');
  }
  if(data&&remaining&&!water&&!approval&&!money&&!construction&&!/balance|collections?|receivables?|payment|वसूली/.test(q)){
    return hi?result('बाकी काम',`${data.planned-data.floors} मंज़िलें बाकी`,`${data.available} यूनिट उपलब्ध हैं। ये प्रस्तुति के उदाहरण आँकड़े हैं।`,'construction'):
      result('Remaining work',`${data.planned-data.floors} structural floors remaining`,`${data.available} available units and ${currency(data.outstanding)} in outstanding receivables. Illustrative portfolio records.`,'construction');
  }
  return null;
}
