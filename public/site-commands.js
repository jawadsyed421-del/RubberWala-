export function cameraCommand(command){
  const text=command.replace(/\b3-d\b/g,'3d');
  if(/^(?:stop|pause|halt) (?:the )?(?:spin(?:ning)?|rotat(?:e|ion|ing)|orbit(?:ing)?|camera)$/.test(text))
    return {action:'stop'};
  if(/^(?:reset|recenter|centre|center) (?:the )?(?:3d )?(?:view|camera|portfolio)$/.test(text))
    return {action:'reset'};
  if(/^(?:move|fly|go|zoom|take me|navigate) (?:in )?to (?:the )?(?:central plaza|logo|rubberwala logo|center|centre)(?: of the (?:map|portfolio))?$/.test(text))
    return {action:'logo',overview:true};
  if(/^(?:(?:more |a (?:bit|little) more |a bit |a little )?zoom\b|(?:go |move |come )?closer\b|pull back\b|(?:go |move )?(?:farther|further) (?:back|away)\b)/.test(text)){
    const out=/\b(?:out|back|away)\b/.test(text);
    const large=/\b(?:much|a lot|twice|far)\b/.test(text);
    const small=/\ba (?:bit|little)\b/.test(text);
    return {action:'zoom',factor:out?(large?1.55:small?1.1:1.22):(large?.63:small?.9:.78),out,overview:/\bportfolio\b/.test(text)};
  }
  if(/^(?:spin|rotate|orbit|turn|pan|swipe|keep (?:spinning|rotating|orbiting)|move (?:left|right))\b/.test(text)){
    if(/\b(?:top|aerial|overhead)\b/.test(text))return {action:'top'};
    const direction=/left to right|counterclockwise|counter clockwise|anti-clockwise|anticlockwise/.test(text)?
      'right':/right to left|clockwise/.test(text)?'left':/\bright\b/.test(text)?'right':'left';
    const amount=text.match(/\b(\d{1,3})\s*degrees?\b/)?.[1];
    const degrees=amount?Math.min(360,Math.max(5,Number(amount))):/full|all the way/.test(text)?360:90;
    return {action:'spin',direction,degrees,continuous:/\b(?:keep|continuous|continuously)\b/.test(text)};
  }
  if(/^(?:show|open|switch to|go to) (?:the |an? )?(?:top|aerial|overhead)(?: down)? (?:view|angle)$/.test(text))
    return {action:'top'};
  return null;
}
