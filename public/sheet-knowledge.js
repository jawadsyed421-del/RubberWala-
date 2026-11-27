const local=typeof location==='undefined'||['localhost','127.0.0.1','[::1]'].includes(location.hostname);
const trades=local?(await import('./sheet-knowledge-data.js').catch(()=>null))?.default:null;

const source='https://docs.google.com/spreadsheets/d/1A-vhHOw6etj2UxO6VndtBHn1sy_lf6OCjT2wE3FxakY/edit';
const topics=[
  ['lift-jambs',/lift.*jamb|लिफ्ट.*जाम/],
  ['window-jambs',/window jamb|door frame.*(?:bath|toilet)|खिड़की.*जाम/],
  ['sliding-windows',/sliding window|window work|स्लाइडिंग|खिड़की/],
  ['waterproofing',/water[\s-]*proof|base\s*coat|brickbat|वॉटर\s*प्रूफ|वाटरप्रूफ|जलरोध/],
  ['drainage',/drainage|down\s*take|rainwater|water supply line|ड्रेनेज/],
  ['staircase',/staircase|granite.*stair|सीढ़ी/],
  ['electrical',/electric|wir(?:e|ing)|switchboard|बिजली|वायरिंग/],
  ['fire',/fire\s*fight|sprinkler|fire shaft|स्प्रिंकलर|अग्नि/],
  ['plumbing',/plumb|pipe work|प्लंबिंग|प्लम्बिंग|पाइप/],
  ['tiles',/tiles?|flooring|टाइल|फ्लोरिंग/],
  ['gypsum',/gypsum|जिप्सम/],
  ['doors',/wooden door|door frame|door installation|दरवाज़|दरवाज/],
  ['painting',/painting|paint|putty|पेंट|पुट्टी/],
];
const fields=[
  [/base\s*coat|बेसकोट/,'basecoat'],[/brickbat/,'brickbat'],[/\bips\b/,'ips'],
  [/skirting|स्कर्टिंग/,'skirting'],[/pressure testing|प्रेशर टेस्ट/,'test'],
  [/(?:for|in|of) (?:the )?kitchen|किचन|रसोई/,'kitchen'],
  [/(?:for|in|of) (?:the )?bath(?:room)?|बाथरूम/,'bath'],
  [/(?:for|in|of) (?:the )?(?:wc|toilet)|टॉयलेट/,'wc'],
];
const normalize=value=>value.toLowerCase().replace(/[.]/g,'').replace(/\s+/g,' ');
const answer=(title,value,detail)=>({title,value,detail,source});
export function sheetAnswer(query,{hi=false,named=false}={}){
  if(!trades)return null;
  const text=query.toLowerCase().replace(/[०-९]/g,digit=>String(digit.charCodeAt(0)-0x966));
  const workbook=/sheet|spreadsheet|workbook|tracker|google sheets|शीट|स्प्रेडशीट|वर्कबुक/.test(text);
  if(named&&!workbook)return null;
  const tradeKeys=topics.filter(([,matcher])=>matcher.test(text)).map(([key])=>key);
  const flat=text.match(/(?:flat|unit|फ्लैट|यूनिट)\s*(?:no\.?\s*)?(\d{1,4})/)?.[1];
  const floor=text.match(/(?:floor|level|मंजिल|मंज़िल|फ्लोर)\s*(?:no\.?\s*)?(\d{1,2})\b|\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:floor|level)/);
  const level=floor?Number(floor[1]||floor[2]):null;
  if(!tradeKeys.length){
    if(!workbook&&!flat)return null;
    if(/profit|cost|budget|revenue|approval|structural|मुनाफ|बजट|लागत|मंजूरी/.test(text))
      return hi?answer('निर्माण ट्रैकर','इस शीट में काम की स्थिति दर्ज है','इसमें मुनाफ़ा, लागत, मंज़ूरी या ढाँचे की कुल प्रगति के रिकॉर्ड नहीं हैं।'):
        answer('Construction tracker','This workbook tracks trade work','It does not record costs, profit, approvals, or structural floor completion.');
    if(!flat&&level===null)return hi?answer('निर्माण ट्रैकर','13 काम के टैब','फ्लैट या फ्लोर नंबर के साथ वॉटरप्रूफिंग, बिजली, प्लंबिंग या अन्य काम पूछें।'):
      answer('Construction tracker','13 work-tracking tabs','Ask about waterproofing, electrical, plumbing, painting, or another trade. Include a flat or floor number to narrow the answer.');
  }
  const filters=fields.filter(([matcher])=>matcher.test(text)).map(([,value])=>value);
  const summary=[];
  for(const key of tradeKeys.length?tradeKeys:Object.keys(trades)){
    const trade=trades[key];
    const columns=trade.columns.map((name,index)=>({name,index}));
    const matched=columns.filter(({name})=>filters.every(filter=>normalize(name).includes(filter)));
    const selected=matched.length?matched:columns;
    const rows=trade.rows.filter(([unit,rowFloor])=>(!flat||unit===flat)&&(level===null||rowFloor===level));
    if(!rows.length)continue;
    const count={D:0,W:0,P:0,N:0,'?':0,'':0};
    const details=[];
    for(const [unit,,statuses] of rows)for(const {name,index} of selected){
      const status=statuses[index];
      count[status]++;
      if(flat&&['D','W','P'].includes(status)&&details.length<14)details.push(name.toLowerCase()+' '+({D:'done',W:'in progress',P:'pending'}[status]));
    }
    const unrecorded=count['']+count['?'];
    const heading=trade.tab+(filters.length&&matched.length?(' · '+filters.join(', ')):'');
    const line=hi?`${heading}: ${count.D} जाँचें पूरी, ${count.W} जारी, ${count.P} लंबित, ${count.N} लागू नहीं, और ${unrecorded} की स्थिति दर्ज या स्पष्ट नहीं।`:
      `${heading}: ${count.D} checks marked done, ${count.W} in progress, ${count.P} explicitly pending, ${count.N} not applicable, and ${unrecorded} blank or unclear.`;
    summary.push(line+(!hi&&details.length?' '+details.join(', ')+'.':''));
  }
  if(!summary.length)return hi?answer('निर्माण ट्रैकर','इस चयन की कोई पंक्ति नहीं मिली','शीट में दर्ज फ्लैट या फ्लोर नंबर से दोबारा पूछें।'):
    answer('Construction tracker','No matching row in the supplied workbook','Try a recorded flat or floor number.');
  const scope=flat?(hi?'फ्लैट ':'Flat ')+flat:level!==null?(hi?'फ्लोर ':'Floor ')+level:hi?'शीट में दर्ज काम':'Work recorded in the supplied sheet';
  const note=named?(hi?' शीट में बिल्डिंग का नाम दर्ज नहीं है।':' The workbook does not identify the building.'):'';
  return answer(hi?'शीट से निर्माण की स्थिति':'Construction tracker',scope,summary.join(' ')+note);
}
