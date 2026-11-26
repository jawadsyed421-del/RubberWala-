import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export function createVoiceRoutes({apiKey,voiceId='JBFqnCBsd6RMkjVDRZzb',request=fetch}){
  const configured=Boolean(apiKey&&/^[a-zA-Z0-9]{20,32}$/.test(voiceId));
  const tickets=new Map();
  let streaming=0;
  let tokenInFlight=false;
  const json=(response,status,value)=>response.writeHead(status,{
    'Content-Type':'application/json','Cache-Control':'no-store',
  }).end(JSON.stringify(value));
  return async (pathname,req,res)=>{
    if(!pathname.startsWith('/api/voice/'))return false;
    const host=req.headers.host||'';
    if(!/^(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(host)||
       (req.headers.origin&&req.headers.origin!=='http://'+host)){
      json(res,403,{error:'Local access only'});
      return true;
    }
    if(pathname==='/api/voice/status'&&req.method==='GET'){
      json(res,200,{provider:configured?'elevenlabs':'browser'});
      return true;
    }
    if(!configured){
      json(res,503,{error:'ElevenLabs is not configured'});
      return true;
    }
    if(pathname==='/api/voice/recognition-token'&&req.method==='POST'){
      if(req.headers['x-jarvis-voice']!=='1'||tokenInFlight){
        json(res,429,{error:'Recognition request unavailable'});
        return true;
      }
      tokenInFlight=true;
      try{
        const upstream=await request('https://api.elevenlabs.io/v1/single-use-token/realtime_scribe?max_session_duration_seconds=120',{
          method:'POST',headers:{'xi-api-key':apiKey},signal:AbortSignal.timeout(6500),
        });
        if(!upstream.ok){
          await upstream.body?.cancel();
          json(res,[401,403].includes(upstream.status)?403:502,{error:'Speech-to-text permission or service unavailable'});
        }else{
          const {token}=await upstream.json();
          if(typeof token!=='string'||!token)json(res,502,{error:'Recognition token unavailable'});
          else json(res,200,{token});
        }
      }catch{
        if(!res.destroyed)json(res,502,{error:'Recognition token unavailable'});
      }finally{tokenInFlight=false;}
      return true;
    }
    if(pathname==='/api/voice/replies'&&req.method==='POST'){
      if(req.headers['content-type']?.split(';')[0]!=='application/json'||req.headers['x-jarvis-voice']!=='1'){
        json(res,415,{error:'Expected a JARVIS reply'});
        return true;
      }
      let payload='';
      try{
        for await(const chunk of req){
          payload+=chunk;
          if(payload.length>4096){
            json(res,413,{error:'Reply is too large'});
            return true;
          }
        }
        const text=JSON.parse(payload)?.text?.trim();
        if(!text||text.length>900){
          json(res,400,{error:'Expected 1 to 900 reply characters'});
          return true;
        }
        const now=Date.now();
        for(const [id,ticket] of tickets)if(ticket.expires<now)tickets.delete(id);
        if(tickets.size>=12||streaming>=2){
          json(res,429,{error:'Voice is busy'});
          return true;
        }
        const id=randomUUID();
        tickets.set(id,{text,expires:now+15000});
        json(res,201,{url:'/api/voice/stream/'+id});
      }catch{
        if(!res.writableEnded)json(res,400,{error:'Invalid reply'});
      }
      return true;
    }
    const match=pathname.match(/^\/api\/voice\/stream\/([0-9a-f-]{36})$/);
    const ticket=match&&tickets.get(match[1]);
    if(req.method!=='GET'||!ticket||ticket.expires<Date.now()){
      json(res,404,{error:'Voice stream expired'});
      return true;
    }
    tickets.delete(match[1]);
    if(streaming>=2){
      json(res,429,{error:'Voice is busy'});
      return true;
    }
    streaming++;
    const controller=new AbortController();
    const cancel=()=>controller.abort();
    res.once('close',cancel);
    const timeout=setTimeout(cancel,20000);
    try{
      const upstream=await request('https://api.elevenlabs.io/v1/text-to-speech/'+voiceId+'/stream?output_format=mp3_22050_32',{
        method:'POST',
        headers:{'xi-api-key':apiKey,'Content-Type':'application/json','Accept':'audio/mpeg'},
        body:JSON.stringify({text:ticket.text,model_id:'eleven_flash_v2_5',voice_settings:{style:0,use_speaker_boost:false,speed:1.04}}),
        signal:controller.signal,
      });
      if(!upstream.ok||!upstream.body){
        await upstream.body?.cancel();
        json(res,502,{error:'Speech provider unavailable'});
        return true;
      }
      res.writeHead(200,{'Content-Type':'audio/mpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      await pipeline(Readable.fromWeb(upstream.body),res);
    }catch{
      if(!res.headersSent&&!res.destroyed)json(res,502,{error:'Speech stream unavailable'});
    }finally{
      clearTimeout(timeout);
      res.off('close',cancel);
      streaming--;
    }
    return true;
  };
}
