import {readFileSync} from 'node:fs';
import {createPluggyTransport} from '../server/providers/pluggy.js';
import {OWNER,ORIGIN,SUPABASE,UUID,vaultKey,marker,seal,unseal,connectorAllowed,verifyItem,readLink,safeText,transactionRows,cursorToken} from '../server/bank-security.js';
const consentVersion='owner-readonly-v1',products=['ACCOUNTS','TRANSACTIONS'];
class Failure extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code;}}
const fail=(status,code,message)=>{throw new Failure(status,code,message)};
function config(){const s=readFileSync(process.cwd()+'/config.js','utf8'),url=process.env.FORMA_SUPABASE_URL||s.match(/['"]?supabaseUrl['"]?\s*:\s*['"](https:\/\/[a-z]+\.supabase\.co)['"]/)?.[1],key=process.env.FORMA_SUPABASE_PUBLISHABLE_KEY||s.match(/['"]?publishableKey['"]?\s*:\s*['"]([^'"]+)['"]/)?.[1];if(url!==SUPABASE||!key)fail(503,'config','Configuración independiente de FORMA pendiente.');return{url,key};}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 try{
  if(req.method!=='POST'){res.setHeader('Allow','POST');fail(405,'method','Método no permitido.');}
  if(req.headers.origin!==ORIGIN)fail(403,'origin','Solicitud fuera de FORMA.');
  const auth=req.headers.authorization;if(!/^Bearer [A-Za-z0-9._-]+$/.test(auth||''))fail(401,'session','Inicia sesión en FORMA.');
  const b=req.body;if(!b||typeof b!=='object'||Array.isArray(b)||JSON.stringify(b).length>8192||!['status','preflight','start','attach','accounts','transactions','disconnect'].includes(b.action))fail(400,'request','Solicitud inválida.');
  const fields={status:['action'],preflight:['action'],start:['action','mode','consent','providerConfirmed'],attach:['action','itemId'],accounts:['action'],transactions:['action','accountId','cursor'],disconnect:['action']};
  if(Object.keys(b).some(k=>!fields[b.action].includes(k)))fail(400,'request','Parámetros no permitidos.');
  const cfg=config(),headers={apikey:cfg.key,Authorization:auth,'Content-Type':'application/json',Origin:ORIGIN};
  const deadline=Date.now()+45000;
  const request=async(url,options={})=>{const remaining=deadline-Date.now();if(remaining<=0)fail(504,'timeout','La consulta tardó demasiado. Intenta nuevamente.');return fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(Math.min(8000,remaining))});};
  const u=await request(SUPABASE+'/auth/v1/user',{headers});if(!u.ok)fail(401,'session','Vuelve a entrar en FORMA.');if((await u.json()).id!==OWNER)fail(403,'owner','Piloto disponible únicamente para Joel.');
  const access=await request(SUPABASE+'/rest/v1/rpc/forma_agenda_access',{method:'POST',headers,body:'{}'});if(!access.ok||(await access.json())?.role!=='owner')fail(403,'access','No pudimos confirmar tu sesión vigente de dirección.');
  const rpc=async(action,data={})=>{
   const r=await request(SUPABASE+'/rest/v1/rpc/forma_bank_pilot',{method:'POST',headers,body:JSON.stringify({p_action:action,p_data:data})});
   if(!r.ok){let d={};try{d=await r.json()}catch{}if(d.code==='PGRST202'||r.status===404)fail(503,'setup','Falta instalar el almacenamiento privado del piloto en la base exclusiva de FORMA.');if(d.code==='54000')fail(429,'quota','Límite diario del piloto alcanzado. Intenta mañana.');if(d.code==='40001')fail(409,'conflict','La prueba cambió o sigue activa. Actualiza su estado antes de continuar.');fail(503,'storage','No pudimos confirmar el almacenamiento del piloto. No se importaron movimientos.');}
   return r.json();
  };
  let keyReady=true;try{vaultKey()}catch{keyReady=false}
  const realEnabled=process.env.FORMA_BANK_PILOT_ENABLED==='owner-openfinance-v1';
  if(b.action==='status'){
   let state;try{state=await rpc('state')}catch(e){if(e.code==='setup')return res.status(200).json({installed:false,keyReady,realEnabled:false,importsEnabled:false});throw e;}
   const l=state.link;return res.status(200).json({installed:true,keyReady,realEnabled:realEnabled&&keyReady,importsEnabled:false,link:l?{state:l.state,mode:l.mode,consentedAt:l.consented_at}:null});
  }
  if(!keyReady)fail(503,'vault_key','Falta configurar la clave privada FORMA_BANK_VAULT_KEY en Vercel.');
  if(!process.env.PLUGGY_CLIENT_ID||!process.env.PLUGGY_CLIENT_SECRET)fail(503,'provider_config','Faltan las credenciales del proveedor en el servidor.');
  const provider=createPluggyTransport({request,fail});
  if(b.action==='preflight'){
   // Counts against the existing private read quota; never creates an Item or consent.
   await rpc('read');
   const list=await provider('/connectors?isOpenFinance=true');
   if(!Array.isArray(list.results))fail(502,'provider_response','Respuesta inesperada del proveedor.');
   const eligible=list.results.filter(c=>connectorAllowed(c,'live')&&Array.isArray(c.products)&&products.every(p=>c.products.includes(p)));
   return res.status(200).json({authenticated:true,catalogAvailable:true,compatibleInstitutions:new Set(eligible.map(c=>c.id)).size,realEnabled,checkedAt:new Date().toISOString(),importsEnabled:false});
  }
  if(b.action==='start'){
   if(!['sandbox','live'].includes(b.mode)||b.consent!==true)fail(400,'consent','Confirma la consulta de cuentas y movimientos antes de continuar.');
   if(b.mode==='live'&&(!realEnabled||b.providerConfirmed!==true))fail(403,'live_disabled','El piloto con banco real requiere habilitación del proveedor y activación privada en Vercel.');
   const {link}=await rpc('begin',{mode:b.mode,consent:true,consent_version:consentVersion});
   if(!link||!UUID.test(link.id||''))fail(503,'storage','No se confirmó la preparación de la prueba.');
   // Quota and consent are committed before any provider request.
   const list=await provider(b.mode==='live'?'/connectors?isOpenFinance=true':'/connectors?sandbox=true');if(!Array.isArray(list.results))fail(502,'provider_response','Respuesta inesperada del proveedor.');
   const ids=list.results.filter(c=>connectorAllowed(c,b.mode)).map(c=>c.id);
   if(!ids.length)fail(502,'connectors','El proveedor no ofreció conectores compatibles con este piloto.');
   const token=await provider('/connect_token','POST',{options:{clientUserId:marker(link.id),avoidDuplicates:true,products}});
   if(typeof token.accessToken!=='string'||!token.accessToken)fail(502,'provider_response','No se recibió el permiso temporal de conexión.');
   return res.status(200).json({connectToken:token.accessToken,connectorIds:ids,mode:b.mode,products,importsEnabled:false});
  }
  const {link}=await rpc('state');if(!link)fail(409,'link','No hay una prueba activa.');
  if(link.mode==='live'&&!realEnabled&&b.action!=='disconnect')fail(403,'live_disabled','El piloto real está pausado. Puedes desconectar la cuenta.');
  const owned=async(id)=>{const i=await provider('/items/'+id);try{return verifyItem(i,link)}catch{fail(403,'ownership','La conexión no pertenece a esta prueba de FORMA o usa un conector no permitido.');}};
  const pauseSync=async(item)=>{
   if(item.nextAutoSyncAt===null)return item;
   const paused=await provider('/items/'+item.id+'/disable-auto-sync','PATCH');
   try{verifyItem(paused,link)}catch{fail(502,'pause_unconfirmed','No se confirmó la pausa de actualizaciones automáticas. La conexión puede estar guardada; actualiza su estado o desconéctala.');}
   if(paused.id!==item.id||paused.nextAutoSyncAt!==null)fail(502,'pause_unconfirmed','El proveedor no confirmó la pausa de actualizaciones automáticas. Actualiza el estado o desconecta la prueba.');
   return paused;
  };
  if(b.action==='attach'){
   if(!UUID.test(b.itemId||''))fail(400,'item','Referencia de conexión inválida.');
   const item=await owned(b.itemId);
   if(link.state==='connected'){const existing=readLink(link);if(existing.item!==item.id)fail(409,'conflict','Esta prueba ya tiene otra conexión.');}
   else await rpc('bind',{id:link.id,connector_id:item.connector.id,vault:seal({uid:OWNER,link:link.id,item:item.id,mode:link.mode,connector:item.connector.id})});
   await pauseSync(item);
   return res.status(200).json({saved:true,mode:link.mode,institution:safeText(item.connector.name),status:safeText(item.status),importsEnabled:false});
  }
  if(link.state!=='connected'||!link.vault)fail(409,'pending','La autorización no terminó. Reanuda la conexión; no se registraron movimientos.');
  let v;try{v=readLink(link)}catch{fail(409,'vault','No pudimos validar la referencia cifrada. No cambies la clave del piloto con una conexión activa.');}
  let item;
  if(b.action==='disconnect'){
   // A known sealed reference may already have been deleted remotely: DELETE is idempotent.
   try{item=await provider('/items/'+v.item)}catch(e){if(e.code!=='provider_access')throw e;}
   if(item){try{verifyItem(item,link)}catch{fail(403,'ownership','La conexión no pertenece a esta prueba.');}}
   const removed=await provider('/items/'+v.item,'DELETE');if(removed.deleted!==true&&(!Number.isInteger(removed.count)||removed.count<0))fail(502,'delete_unconfirmed','El proveedor no confirmó la desconexión. Vuelve a intentar.');
   await rpc('revoke',{id:link.id});return res.status(200).json({revoked:true,importsEnabled:false});
  }
  await rpc('read');item=await owned(v.item);
  if(item.id!==v.item||item.connector.id!==v.connector)fail(403,'ownership','La conexión cambió.');
  item=await pauseSync(item);
  if(item.status!=='UPDATED')return res.status(200).json({ready:false,status:safeText(item.status),accounts:[],transactions:[],importsEnabled:false});
  if(item.consentExpiresAt&&new Date(item.consentExpiresAt).getTime()<=Date.now())fail(409,'expired','La autorización venció. Desconecta y autoriza nuevamente.');
  const accounts=await provider('/accounts?itemId='+v.item);
  if(!Array.isArray(accounts.results)||accounts.results.some(a=>!UUID.test(a.id||'')||a.itemId!==v.item)||Number(accounts.totalPages||1)>1||new Set(accounts.results.map(a=>a.id)).size!==accounts.results.length)fail(502,'provider_response','No se pudo validar la lista completa de cuentas.');
  if(b.action==='accounts')return res.status(200).json({ready:true,mode:link.mode,institution:safeText(item.connector.name),lastUpdatedAt:safeText(item.lastUpdatedAt,40),accountCount:accounts.results.length,bankAccountCount:accounts.results.filter(a=>a.type==='BANK').length,creditAccountCount:accounts.results.filter(a=>a.type==='CREDIT').length,accounts:accounts.results.map(a=>({id:a.id,name:safeText(a.name),type:safeText(a.type,20),currency:safeText(a.currencyCode,3),balance:Number.isFinite(a.balance)?a.balance:null})),importsEnabled:false});
  if(!UUID.test(b.accountId||'')||!accounts.results.some(a=>a.id===b.accountId))fail(403,'account','La cuenta no pertenece a tu conexión.');
  let after,from=new Date(Date.now()-30*86400000).toISOString().slice(0,10),to=new Date().toISOString().slice(0,10);
  if(b.cursor){try{const c=unseal(b.cursor);if(c.link!==link.id||c.account!==b.accountId||c.uid!==OWNER||c.exp<Date.now())throw Error('cursor');after=c.after;from=c.from;to=c.to;}catch{fail(400,'cursor','La página de movimientos venció. Actualiza las cuentas.');}}
  const q=new URLSearchParams({accountId:b.accountId,dateFrom:from,dateTo:to});if(after)q.set('after',after);
  const tx=await provider('/v2/transactions?'+q.toString());let rows,next;try{rows=transactionRows(tx,b.accountId);next=cursorToken(tx.next,{uid:OWNER,link:link.id,account:b.accountId,from,to});}catch{fail(502,'provider_response','No se pudo validar la respuesta de movimientos.');}
  return res.status(200).json({ready:true,mode:link.mode,transactions:rows,next,from,to,importsEnabled:false});
 }catch(e){return res.status(e instanceof Failure?e.status:503).json({code:e instanceof Failure?e.code:'unavailable',error:e instanceof Failure?e.message:'No se pudo completar la prueba. Intenta nuevamente; no se importaron movimientos.',importsEnabled:false});}
}
