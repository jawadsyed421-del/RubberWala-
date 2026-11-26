import { listenForClaps } from './clap.js';
import { createStreamingVoice, voiceProvider } from './voice-playback.js';
import { StreamingRecognition } from './voice-recognition.js';
import { findRoute, normalizeVoice } from './demo-operations.js';
import { isHindi } from './hindi.js';

const wakePhrase=/^\s*(?:(?:uh|um|अं)[\s,.]+)*(?:(?:hey|hi|okay|ok)[\s,]+(?:ralix|rahilx|ralyx|rallix|ra lix|ray licks|relics|alex|jarvis|jar vise|jar viz)\b|(?:हे|हाय|ओके|hey|hi)[\s,]+(?:रैलिक्स|रेलिक्स|रालिक्स|रैलिक्‍स|राहिलक्स))(?=$|[\s,.!?;:–—।-])[\s,.!?;:–—।-]*/i;
const greeting='Okay. Hi sir, what do you want?';
const hindiGreeting='जी सर, बताइए। मैं आपकी क्या मदद कर सकता हूँ?';
const interruptWord=/^(?:stop|wait|hold on|one moment|रुको|रुकिए|ठहरो|ठहरिए)$/;
const transcriptWords=text=>isHindi(text)?text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim():normalizeVoice(text);

export function interruptionCandidate(transcript,reply,isFinal){
  const heard=transcriptWords(transcript);
  if(!heard)return false;
  const spoken=transcriptWords(reply);
  if((' '+spoken+' ').includes(' '+heard+' '))return false;
  if(interruptWord.test(heard))return true;
  if(wakePhrase.test(transcript))return true;
  const words=heard.split(' ');
  if(words.length<2)return isFinal&&Boolean(findRoute(heard));
  const previous=new Set(spoken.split(' '));
  const novel=words.filter(word=>!previous.has(word));
  if((words.length>=3||isFinal)&&/^(?:and )?(?:what|which|how|when|where|why|open|show|zoom|go to|take me|switch to)\b/.test(heard)&&novel.length>0)return true;
  return novel.length>=2||((isFinal||words.length>=3)&&novel.length/words.length>=.34);
}

export function createVoice({onCommand,onState,onDisable,onPlayback,languagePreference=()=> 'auto'}){
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  const synthesis=window.speechSynthesis;
  const streamingVoice=createStreamingVoice();
  const greetingAudio=new Audio('/jarvis-greeting.mp3');
  greetingAudio.preload='none';
  let enabled=false, manual=false, current=null, telling=false, conversation=false;
  let restartTimer, followTimer, utterance, speechTimer, attempts=0, local=false, setup=0, preparing=false;
  let clapListener, clapCount=2, speechError='', startTimer, wakeTimer;
  let remoteAllowed=false, remoteFailed=false, nativeFailed=false;
  let commandToken=0;
  let spokenText='', echoUntil=0, canInterrupt=false;
  let clapOnly=false;
  let networkRetries=0, resumeConversation=false;
  let queuedCommand='';

  function state(name,message){
    onState({name,message,enabled,manual,conversation});
  }

  function ready(feedback){
    if(document.hidden)state('paused','Microphone paused while this tab is hidden.');
    else if(clapOnly&&!conversation&&!manual)state('clap-standby',clapCount===1?'Conversation closed. Clap once to reopen.':'Conversation closed. Double-clap to reopen.');
    else if(speechError)state('limited',clapListener&&remoteAllowed&&!remoteFailed?'Double-clap to start ElevenLabs speech recognition.':speechError+(clapListener?' Clap activation is ready.':''));
    else if(conversation||manual)state('listening',feedback||'Ralix is listening. Clap again to close the conversation.');
    else state('armed',clapListener?(clapCount===1?'Clap once or say “Hey Ralix”.':'Double-clap or say “Hey Ralix”.'):'Say “Hey Ralix”.');
  }

  function windowForCommand(){
    clearTimeout(followTimer);
    if(manual)followTimer=setTimeout(stopManual,45000);
  }

  function stopManual(){
    manual=false;
    clearTimeout(followTimer);
    abort();
    state('off','Manual voice is ready.');
  }

  function abort(){
    clearTimeout(restartTimer);
    clearTimeout(wakeTimer);
    clearTimeout(startTimer);
    if(current){
      current.intentional=true;
      current.recognition.abort();
    }
  }

  function cutReply(){
    commandToken++;
    utterance=null;
    canInterrupt=false;
    echoUntil=Date.now()+700;
    clearTimeout(speechTimer);
    streamingVoice.stop();
    greetingAudio.pause();
    if(telling)synthesis?.cancel();
    telling=false;
    queuedCommand='';
    onPlayback?.(false);
  }

  function stop(message='Hands-free voice is off.'){
    setup++;
    enabled=manual=preparing=false;
    clapListener?.stop();
    clapListener=null;
    conversation=false;
    resumeConversation=false;
    clearTimeout(followTimer);
    abort();
    cutReply();
    state('off',message);
  }

  function speak(text,openFollowUp){
    telling=true;
    clearTimeout(followTimer);
    canInterrupt=openFollowUp;
    spokenText=text;
    if(openFollowUp&&enabled)conversation=true;
    if(!canInterrupt)abort();
    else current?.recognition.resume?.();
    if(canInterrupt&&!current)schedule(0);
    state('speaking',text);
    const response=window.SpeechSynthesisUtterance?new SpeechSynthesisUtterance(text):{};
    utterance=response;
    const language=isHindi(text)?'hi':'en';
    response.lang=language==='hi'?'hi-IN':'en-IN';
    response.rate=language==='hi'?.98:.94;
    const voices=synthesis?.getVoices()??[];
    const voice=voices.find(item=>item.localService&&item.lang.toLowerCase()===response.lang.toLowerCase())||
      voices.find(item=>item.localService&&item.lang.toLowerCase().slice(0,2)===language);
    if(voice)response.voice=voice;
    const done=()=>{
      if(utterance!==response)return;
      onPlayback?.(false);
      utterance=null;
      clearTimeout(speechTimer);
      telling=false;
      canInterrupt=false;
      echoUntil=Date.now()+420;
      if(enabled){
        conversation=openFollowUp;
        if(conversation&&remoteAllowed&&!remoteFailed){
          speechError='';
          if(current&&!current.remote)abort();
          else current?.recognition.resume();
        }else if(current?.remote)abort();
        ready();
        schedule(100);
      }else if(manual&&current){windowForCommand();ready();}
      else stopManual();
    };
    const playing=()=>{
      if(utterance!==response)return;
      clearTimeout(speechTimer);
      onPlayback?.(true);
    };
    response.onstart=()=>{
      playing();
      function checkSpeech(){
        if(utterance!==response)return;
        if(synthesis?.speaking===false&&!synthesis.pending){done();return;}
        speechTimer=setTimeout(checkSpeech,1000);
      }
      speechTimer=setTimeout(checkSpeech,1000);
    };
    response.onend=response.onerror=done;
    let synthesisStarted=false;
    const synthesize=()=>{
      if(utterance!==response||synthesisStarted)return;
      synthesisStarted=true;
      if(!synthesis||!window.SpeechSynthesisUtterance){done();return;}
      speechTimer=setTimeout(()=>{done();synthesis.cancel();},5000);
      try{synthesis.speak(response);}catch{done();}
    };
    if(text===greeting){
      let requested=false;
      const playRemote=()=>{
        if(requested||utterance!==response)return;
        requested=true;
        clearTimeout(speechTimer);
        greetingAudio.pause();
        streamingVoice.speak(text,{onEnd:done,onFallback:synthesize,onPlaying:playing,language});
      };
      greetingAudio.onended=done;
      greetingAudio.onerror=playRemote;
      greetingAudio.onplaying=playing;
      greetingAudio.currentTime=0;
      speechTimer=setTimeout(playRemote,2000);
      void greetingAudio.play().catch(playRemote);
    }else streamingVoice.speak(text,{onEnd:done,onFallback:synthesize,onPlaying:playing,language});
  }

  function handle(text){
    const wake=text.match(wakePhrase);
    if(!wake&&!manual&&!conversation)return false;
    const command=(wake?text.slice(wake[0].length):text).trim();
    if(!command){
      if(isHindi(text)||languagePreference()==='hi')speak(hindiGreeting,true);
      else speak(greeting,true);
      return true;
    }
    if(/^(?:stop listening|turn off (?:the )?(?:voice|microphone)|disable hands free|सुनना बंद करो|माइक बंद करो)[.!?।]*$/i.test(command)){
      onDisable?.();
      stop('Microphone off. Use Hands-free to enable it again.');
      return true;
    }
    if(/^(?:go to sleep|stand by|standby|cancel|never mind|बातचीत बंद करो|स्टैंडबाय पर जाओ)[.!?।]*$/i.test(command)){
      if(enabled){clapOnly=true;speak(isHindi(command)?'ठीक है, बातचीत बंद कर रहा हूँ।':'Standing by.',false);}
      else stopManual();
      return true;
    }
    const result=onCommand(command);
    const complete=reply=>{
      if(queuedCommand){
        const next=queuedCommand;
        queuedCommand='';
        telling=false;
        if(handle(next))return;
      }
      if(reply?.action){
        telling=false;
        current?.recognition.resume?.();
        if(conversation||manual)ready(reply.message);
        else state('armed',reply.message);
        if(manual)windowForCommand();
        if(!current)schedule(0);
      }else speak(reply||'Done.',true);
    };
    if(result&&typeof result.then==='function'){
      const token=++commandToken;
      telling=true;
      canInterrupt=false;
      state('working','Ralix is carrying out your command…');
      void Promise.resolve(result).then(
        reply=>{if(token===commandToken)complete(reply);},
        ()=>{if(token===commandToken)complete({action:true,message:'I couldn’t complete that command.'});},
      );
    }else complete(result);
    return true;
  }

  function toggleConversation(){
    if(conversation){
      conversation=false;
      clapOnly=true;
      cutReply();
      if(nativeFailed||!Recognition)speechError='Browser wake-word recognition is unavailable.';
      if(current&&!current.intentional)abort();
      ready();
    }else{
      clapOnly=false;
      conversation=true;
      if(remoteAllowed&&!remoteFailed){
        speechError='';
        if(current&&!current.remote)abort();
      }
      speak(languagePreference()==='hi'?hindiGreeting:greeting,true);
    }
  }

  function schedule(delay){
    clearTimeout(restartTimer);
    if((enabled||manual)&&(!clapOnly||conversation)&&!speechError&&(!telling||canInterrupt)&&!document.hidden)
      restartTimer=setTimeout(start,delay);
  }

  function start(){
    const remote=remoteAllowed&&!remoteFailed&&(manual||conversation);
    if((clapOnly&&!conversation&&!manual)||(!remote&&(!Recognition||nativeFailed))||speechError||current||(telling&&!canInterrupt)||document.hidden||(!enabled&&!manual))return;
    const language=languagePreference();
    const recognition=remote?new StreamingRecognition(()=>clapListener?.stream,language):new Recognition();
    const session={recognition,remote,intentional:false,error:null,retryNative:false};
    current=session;
    recognition.lang=language==='hi'?'hi-IN':local?'en-US':'en-IN';
    if(local)recognition.processLocally=true;
    recognition.continuous=true;
    recognition.interimResults=true;
    recognition.onstart=()=>{
      if(current===session&&!session.intentional){
        clearTimeout(startTimer);
        if(manual)windowForCommand();
        if(!telling)ready();
      }
    };
    recognition.onresult=event=>{
      if(current!==session||session.intentional)return;
      attempts=0;
      if(session.remote)networkRetries=0;
      clearTimeout(wakeTimer);
      for(let i=event.resultIndex;i<event.results.length;i++){
        const result=event.results[i];
        const transcript=result[0].transcript.trim();
        if(telling){
          if(!utterance&&!canInterrupt){
            if(result.isFinal&&(conversation||manual||wakePhrase.test(transcript)))queuedCommand=transcript;
            continue;
          }
          if(!canInterrupt||!interruptionCandidate(transcript,spokenText,result.isFinal))continue;
          cutReply();
          ready();
        }
        if(Date.now()<echoUntil&&spokenText&&!interruptionCandidate(transcript,spokenText,result.isFinal))continue;
        if(result.isFinal){
          if(interruptWord.test(transcriptWords(transcript)))continue;
          if(handle(transcript))break;
        }else if(wakePhrase.test(transcript)&&!transcript.replace(wakePhrase,'')){
          wakeTimer=setTimeout(()=>{
            if(current===session&&!session.intentional&&!telling)handle(transcript);
          },850);
        }
      }
    };
    recognition.onerror=event=>{
      if(current!==session||session.intentional)return;
      const error=event.error;
      session.error=error;
      if(remote){
        if(error==='network'&&networkRetries<2){
          networkRetries++;
          return;
        }
        remoteFailed=true;
        if(Recognition&&!nativeFailed&&error!=='audio-capture')session.retryNative=true;
        else speechFailed(error==='audio-capture'?'Microphone access was denied or unavailable. Check permissions for this page.':'ElevenLabs speech recognition is unavailable. Check your key’s Speech to Text permission and account quota.');
        return;
      }
      if(error==='not-allowed'||error==='service-not-allowed'){
        if(local&&error==='service-not-allowed'){local=false;return;}
        nativeFailed=true;
        speechFailed('Speech recognition was blocked. Check microphone permission or open the app in desktop Chrome.');
      }else if(error==='audio-capture'){
        speechFailed('No microphone is available. Connect a microphone and try again.');
      }else if(error!=='no-speech'&&error!=='aborted'&&manual){
        stop('Speech recognition is unavailable. Try again or type your command.');
      }
    };
    recognition.onend=()=>{
      if(current!==session)return;
      current=null;
      clearTimeout(startTimer);
      clearTimeout(wakeTimer);
      if(session.retryNative){schedule(0);return;}
      if(speechError||(telling&&!canInterrupt))return;
      if(remote&&!session.intentional&&!remoteFailed&&(conversation||manual)){
        if(!telling)state('reconnecting','Reconnecting Ralix’s microphone…');
        schedule(session.error?200*networkRetries:0);
        return;
      }
      if(enabled){
        if(!session.intentional&&session.error&&session.error!=='no-speech'&&++attempts>=3){
          nativeFailed=true;
          speechFailed('The speech service is unavailable. Try desktop Chrome or use the text dock.');
          return;
        }
        schedule(session.intentional?100:Math.min(300*2**attempts,2400));
      }else if(manual && !session.intentional)stopManual();
    };
    startTimer=setTimeout(()=>{
      if(current!==session||session.intentional)return;
      if(remote)recognition.fail('network');
      else{
        nativeFailed=true;
        speechFailed('The browser speech service did not start. Double-clap to try ElevenLabs or use the text dock.');
      }
    },remote?10000:6500);
    try{recognition.start();}
    catch{
      current=null;
      speechFailed('Voice could not start. Try desktop Chrome or use the text dock.');
    }
  }

  function speechFailed(message){
    if(!enabled){stop(message);return;}
    speechError=message;
    abort();
    ready();
  }

  async function activate(handsFree,count=2,openConversation=false){
    if(preparing||manual||enabled||telling)return;
    const token=++setup;
    enabled=handsFree;
    manual=!handsFree;
    clapCount=count;
    speechError=Recognition?'':'Speech recognition is unavailable here. Try desktop Chrome for spoken commands.';
    preparing=true;
    remoteFailed=nativeFailed=false;
    networkRetries=0;
    local=false;
    attempts=0;
    conversation=openConversation;
    clapOnly=false;
    state('starting','Starting microphone…');
    if(handsFree)greetingAudio.preload='auto';
    if(handsFree)void listenForClaps({
      count,
      active:()=>enabled&&!document.hidden,
      onClap:toggleConversation,
    }).then(listener=>{
      if(token!==setup){listener.stop();return;}
      clapListener=listener;
      if(document.hidden)listener.pause();
      if(!preparing&&!telling)ready();
    }).catch(()=>{
      if(token===setup&&speechError)stop('Microphone unavailable. Allow access in browser settings or try desktop Chrome.');
    });
    const provider=await voiceProvider();
    if(token!==setup)return;
    remoteAllowed=provider==='elevenlabs';
    if((manual||conversation)&&remoteAllowed)speechError='';
    if(manual&&speechError){stop(speechError);return;}
    if(Recognition?.available&&!(remoteAllowed&&(conversation||manual))){
      try{
        const availability=await Promise.race([
          Recognition.available({langs:[languagePreference()==='hi'?'hi-IN':'en-US'],processLocally:true}),
          new Promise(resolve=>setTimeout(()=>resolve('unknown'),750)),
        ]);
        if(token===setup)local=availability==='available';
      }catch{}
    }
    if(token!==setup)return;
    preparing=false;
    if(speechError)ready();
    else start();
  }

  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){
      resumeConversation=enabled&&conversation;
      clapListener?.pause();
      abort();
      cutReply();
      conversation=false;
      clearTimeout(followTimer);
      if(manual)stopManual();
      if(enabled)ready();
    }else if(enabled){
      clapListener?.resume();
      if(resumeConversation){conversation=true;resumeConversation=false;}
      ready();
      schedule(100);
    }
  });
  window.addEventListener('pagehide',()=>stop());
  function once(){
    if(!enabled)return activate(false);
    if(telling||conversation||!remoteAllowed||remoteFailed)return;
    clapOnly=false;
    conversation=true;
    speechError='';
    if(current&&!current.remote)abort();
    ready();
    schedule(100);
  }
  function toggleControl(count){
    if(preparing)return;
    if(conversation){toggleConversation();return;}
    if(!enabled){void activate(true,count,true);return;}
    clapOnly=false;
    conversation=true;
    if(remoteAllowed&&!remoteFailed){
      speechError='';
      if(current&&!current.remote)abort();
    }
    ready();
    schedule(0);
  }
  return {enable:count=>activate(true,count),once,toggleControl,stop,isEnabled:()=>enabled};
}


