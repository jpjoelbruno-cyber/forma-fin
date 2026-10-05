import {readFileSync} from 'node:fs';

// No financial records, provider secrets or audio are returned/logged/stored here.
const ORIGIN='https://forma-fin.vercel.app';
function config(){
 const source=readFileSync(process.cwd()+'/config.js','utf8');
 const url=process.env.FORMA_SUPABASE_URL||source.match(/supabaseUrl\s*:\s*['"](https:\/\/[a-z]+\.supabase\.co)['"]/)?.[1];
 const key=process.env.FORMA_SUPABASE_PUBLISHABLE_KEY||source.match(/publishableKey\s*:\s*['"]([^'"]+)['"]/)?.[1];
 if(!/^https:\/\/[a-z]+\.supabase\.co$/.test(url||'')||!key)throw new Error('Not configured');return {url,key};
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method==='GET'){res.status(200).json({cloud:Boolean(process.env.OPENAI_API_KEY)});return;}
 if(req.method!=='POST'){res.setHeader('Allow','GET, POST');res.status(405).json({error:'Método no permitido.'});return;}
 if(req.headers.origin!==ORIGIN){res.status(403).json({error:'Solicitud fuera de FORMÁ.'});return;}
 const authorization=req.headers.authorization;if(!/^Bearer [A-Za-z0-9._-]+$/.test(authorization||'')){res.status(401).json({error:'Entra en tu cuenta para usar la voz.'});return;}
 let cfg,auth;
 try{cfg=config();auth=await fetch(cfg.url+'/auth/v1/user',{headers:{apikey:cfg.key,Authorization:authorization},signal:AbortSignal.timeout(8000)});if(!auth.ok){res.status(401).json({error:'Sesión inválida. Vuelve a entrar.'});return;}}catch{res.status(503).json({error:'No pudimos validar tu sesión.'});return;}
 const body=req.body||{},mime=String(body.mime||'').split(';')[0];
 if(!['audio/webm','audio/ogg','audio/mp4','audio/wav','audio/mpeg'].includes(mime)||!['es','pt'].includes(body.language)||typeof body.audio!=='string'||body.audio.length>2796204||!body.audio.length||!/^[A-Za-z0-9+/]+={0,2}$/.test(body.audio)){res.status(400).json({error:'Audio inválido o demasiado largo.'});return;}
 const bytes=Buffer.from(body.audio,'base64');if(bytes.length<16||bytes.length>2097152){res.status(400).json({error:'Audio inválido o demasiado largo.'});return;}
 if(!process.env.OPENAI_API_KEY){res.status(503).json({error:'Transcripción avanzada pendiente de configuración.'});return;}
 try{
  const quota=await fetch(cfg.url+'/rest/v1/rpc/forma_voice_claim',{method:'POST',headers:{apikey:cfg.key,Authorization:authorization,'Content-Type':'application/json',Origin:ORIGIN},body:JSON.stringify({p_bytes:bytes.length}),signal:AbortSignal.timeout(8000)});
  if(!quota.ok||await quota.json()!==true){res.status(429).json({error:'Sesión no habilitada o límite de voz alcanzado.'});return;}
  const form=new FormData();form.append('file',new Blob([bytes],{type:mime}),'frase.'+({ 'audio/webm':'webm','audio/ogg':'ogg','audio/mp4':'mp4','audio/wav':'wav','audio/mpeg':'mp3'}[mime]));form.append('model','gpt-4o-mini-transcribe');form.append('language',body.language);form.append('prompt',body.language==='pt'?'Frase de finanças pessoais: Uber, Nubank, Inter, pró-labore, reais e centavos.':'Frase de finanzas personales: Uber, Nubank, Inter, pró-labore, reales y centavos.');
  const result=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY},body:form,signal:AbortSignal.timeout(25000)});
  if(!result.ok)throw new Error('Provider failed');const data=await result.json();if(typeof data.text!=='string'||!data.text.trim()||data.text.length>1000)throw new Error('Invalid transcript');res.status(200).json({text:data.text.trim()});
 }catch{res.status(502).json({error:'No pudimos transcribir. Repite la frase; no se guardó un movimiento.'});}
}
