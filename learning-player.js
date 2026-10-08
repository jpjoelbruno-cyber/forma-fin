/* YouTube telemetry is client-observed, never proof of attention. Server owns credit. */
(()=>{
 let apiPromise=null;
 function api(){if(window.YT?.Player)return Promise.resolve(window.YT);if(apiPromise)return apiPromise;
 apiPromise=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('YouTube no disponible')),15000);const previous=window.onYouTubeIframeAPIReady;window.onYouTubeIframeAPIReady=()=>{clearTimeout(timer);previous?.();resolve(window.YT)};const s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';s.onerror=()=>{clearTimeout(timer);reject(new Error('YouTube no disponible'))};document.head.append(s)}).catch(e=>{apiPromise=null;throw e});return apiPromise;}
 function bounded(request){let timer;return Promise.race([Promise.resolve(request),new Promise((_,reject)=>timer=setTimeout(()=>reject(new Error('timeout')),15000))]).finally(()=>clearTimeout(timer));}
 let controller=null;
 function stop(){if(controller){controller.stopped=true;clearInterval(controller.timer);controller.player?.destroy();controller=null;}}
 async function watch(lesson,iframe,{progress,error}={}){
 stop();const uid=user?.id,c={stopped:false,player:null,timer:null,measurementReady:false,chain:Promise.resolve()};controller=c;
 const valid=()=>!c.stopped&&user?.id===uid&&!window.FORMA_DEMO;

 try{const YT=await api();if(!valid())return;const start=await bounded(sb.rpc('forma_learning_start',{p_lesson:lesson.id}));if(start.error||!start.data?.token)throw new Error('No se pudo iniciar la validación');if(!valid())return;
 const tick=ended=>{if(!valid()||!c.measurementReady||!c.player?.getCurrentTime)return;const values={p_token:start.data.token,p_position:c.player.getCurrentTime(),p_playing:document.visibilityState==='visible'&&c.player.getPlayerState()===1,p_rate:c.player.getPlaybackRate()||1,p_ended:ended===true};c.chain=c.chain.then(async()=>{if(!valid())return;const result=await bounded(sb.rpc('forma_learning_tick',values));if(!valid())return;if(result.error){error?.('No se confirmó este tramo. Comprueba tu conexión y vuelve a abrir la clase.');return;}progress?.(result.data);}).catch(()=>{if(valid())error?.('La conexión interrumpió la medición. Vuelve a abrir la clase.');});};
 c.player=new YT.Player(iframe,{events:{onReady:()=>{if(!valid())return;const actual=c.player.getDuration();if(Math.abs(actual-start.data.duration)>2){error?.('La duración del video no coincide con la configurada. Comunícate con FORMÁ.');return;}c.measurementReady=true;c.player.seekTo(Math.max(0,Math.min(lesson.last_position||0,start.data.duration-1)),true);tick(false);c.timer=setInterval(()=>tick(false),5000);},onStateChange:e=>{if(valid())tick(e.data===0);},onError:()=>error?.('YouTube no pudo reproducir este video. No se marcó como concluido.')}});
 c.visibility=()=>{if(valid()&&document.visibilityState!=='visible'){tick(false);c.player?.pauseVideo();}};document.addEventListener('visibilitychange',c.visibility);
 }catch(e){if(valid())error?.('La reproducción está disponible, pero no pudimos iniciar la medición. No se contará como concluida.');}
 }
 const priorStop=stop;stop=function(){if(controller?.visibility)document.removeEventListener('visibilitychange',controller.visibility);priorStop();};
 window.FormaLessonPlayer={watch,stop};
})();
