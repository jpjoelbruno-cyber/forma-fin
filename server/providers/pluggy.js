/* Server-only Pluggy transport. Provider credentials never enter browser contracts. */
export function createPluggyTransport({request,fail}) {
 let apiKey;
 return async function provider(path,method='GET',body) {
  if(typeof path!=='string'||!path.startsWith('/')||path.startsWith('//')||/[\r\n#]/.test(path)||path.includes('..'))fail(400,'provider_path','Ruta de proveedor inválida.');
  if(!apiKey){
   const r=await request('https://api.pluggy.ai/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId:process.env.PLUGGY_CLIENT_ID,clientSecret:process.env.PLUGGY_CLIENT_SECRET})});
   if(!r.ok)fail(502,'provider_auth','Pluggy no aceptó las credenciales o su habilitación.');
   apiKey=(await r.json()).apiKey;
   if(typeof apiKey!=='string'||!apiKey)fail(502,'provider_response','Respuesta inesperada del proveedor.');
  }
  const r=await request('https://api.pluggy.ai'+path,{method,headers:{'X-API-KEY':apiKey,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  if(method==='DELETE'&&r.status===404)return{deleted:true};
  if(!r.ok)fail(502,'provider_access','El proveedor no completó la consulta o autorización. Revisa la habilitación de FORMA Conecta.');
  return r.status===204?{}:r.json();
 };
}
