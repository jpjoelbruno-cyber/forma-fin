import {readFileSync} from 'node:fs';

// Owner-only connection diagnostic. No bank Items, accounts or financial writes.
const ORIGIN='https://forma-fin.vercel.app';
const SUPABASE='https://irsuevjqmgpwunvymxbc.supabase.co';
const OWNER='776893e1-f940-437c-94a7-40a83bccc013';
const noBanks={realBanksEnabled:false,importsEnabled:false};
function configuration(){
 const source=readFileSync(process.cwd()+'/config.js','utf8');
 const url=process.env.FORMA_SUPABASE_URL||source.match(/['"]?supabaseUrl['"]?\s*:\s*['"](https:\/\/[a-z]+\.supabase\.co)['"]/)?.[1];
 const key=process.env.FORMA_SUPABASE_PUBLISHABLE_KEY||source.match(/['"]?publishableKey['"]?\s*:\s*['"]([^'"]+)['"]/)?.[1];
 if(url!==SUPABASE||!key)throw new Error('Independent FORMA required');
 return {url,key};
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const fail=(status,code,error)=>res.status(status).json({...noBanks,code,error});
 if(req.method!=='POST'){res.setHeader('Allow','POST');return fail(405,'method','Método no permitido.');}
 if(req.headers.origin!==ORIGIN)return fail(403,'origin','Solicitud fuera de FORMA.');
 const authorization=req.headers.authorization;
 if(!/^Bearer [A-Za-z0-9._-]+$/.test(authorization||''))return fail(401,'session','Inicia sesión en FORMA.');
 if(!req.body||req.body.action!=='check'||Object.keys(req.body).length!==1)return fail(400,'request','Solicitud inválida.');
 try{
  const cfg=configuration(),headers={apikey:cfg.key,Authorization:authorization};
  const auth=await fetch(cfg.url+'/auth/v1/user',{headers,signal:AbortSignal.timeout(8000)});
  if(!auth.ok)return fail(401,'session','Vuelve a entrar en FORMA.');
  const account=await auth.json();
  if(account.id!==OWNER)return fail(403,'owner','Prueba disponible únicamente para la dirección de FORMA.');
  // Existing RPC checks the independent issuer, live session, ban, access and DB role.
  const access=await fetch(cfg.url+'/rest/v1/rpc/forma_agenda_access',{method:'POST',headers:{...headers,Origin:ORIGIN,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(8000)});
  if(!access.ok||(await access.json())?.role!=='owner')return fail(403,'access','No pudimos confirmar tu acceso vigente de dirección.');
 }catch{return fail(503,'access_unavailable','No pudimos validar el acceso de FORMA. Intenta nuevamente.');}
 if(!process.env.PLUGGY_CLIENT_ID||!process.env.PLUGGY_CLIENT_SECRET)return fail(503,'not_configured','Faltan las credenciales bancarias en este despliegue.');
 try{
  const auth=await fetch('https://api.pluggy.ai/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId:process.env.PLUGGY_CLIENT_ID,clientSecret:process.env.PLUGGY_CLIENT_SECRET}),signal:AbortSignal.timeout(10000)});
  if(!auth.ok)return fail(502,'provider_auth','Pluggy no aceptó la autenticación. Revisa las credenciales de FORMA Conecta y su habilitación.');
  const data=await auth.json();
  if(typeof data.apiKey!=='string'||!data.apiKey)return fail(502,'provider_response','Pluggy devolvió una respuesta inesperada.');
  const connectors=await fetch('https://api.pluggy.ai/connectors?sandbox=true',{headers:{'X-API-KEY':data.apiKey},signal:AbortSignal.timeout(10000)});
  if(!connectors.ok)return fail(502,'provider_access','Credenciales aceptadas; Pluggy no permitió consultar los conectores de prueba. Revisa la habilitación del proveedor.');
  const list=await connectors.json();
  if(!Array.isArray(list.results))return fail(502,'provider_response','Pluggy devolvió una respuesta inesperada.');
  const sandboxAvailable=list.results.some(c=>c?.isSandbox===true);
  return res.status(200).json({...noBanks,authenticated:true,sandboxAvailable,checkedAt:new Date().toISOString()});
 }catch{return fail(502,'provider_unavailable','No pudimos completar la prueba con Pluggy. Intenta nuevamente.');}
}
