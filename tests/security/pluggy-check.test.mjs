import {test} from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/pluggy-check.js';
const origin='https://forma-fin.vercel.app',owner='776893e1-f940-437c-94a7-40a83bccc013';
function response(){return{headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(b){this.body=b;return this}}}
const request=()=>({method:'POST',headers:{origin,authorization:'Bearer synthetic.token'},body:{action:'check'}});
async function run(overrides={},req=request()){
 const saved={fetch:globalThis.fetch,id:process.env.PLUGGY_CLIENT_ID,secret:process.env.PLUGGY_CLIENT_SECRET,url:process.env.FORMA_SUPABASE_URL},calls=[];
 try{
  process.env.PLUGGY_CLIENT_ID='test-client';process.env.PLUGGY_CLIENT_SECRET='test-secret';delete process.env.FORMA_SUPABASE_URL;
  if(overrides.missing)delete process.env.PLUGGY_CLIENT_SECRET;
  if(overrides.foreignProject)process.env.FORMA_SUPABASE_URL='https://other.supabase.co';
  globalThis.fetch=async(url,options)=>{
   calls.push({url,options});assert.ok(options.signal);
   if(overrides.throwAt===calls.length)throw new Error('secret must not leak');
   if(url.endsWith('/auth/v1/user'))return{ok:!overrides.noAuth,json:async()=>({id:overrides.otherUser?'student':owner})};
   if(url.endsWith('/rpc/forma_agenda_access'))return{ok:!overrides.revoked,json:async()=>({role:overrides.role||'owner'})};
   if(url==='https://api.pluggy.ai/auth')return{ok:!overrides.badCredentials,json:async()=>overrides.badKey?{}:{apiKey:'private-provider-key'}};
   if(url==='https://api.pluggy.ai/connectors?sandbox=true')return{ok:!overrides.blocked,json:async()=>overrides.badList?{}:{results:[{id:601,isSandbox:false,secret:'not-returned'},...(overrides.noSandbox?[]:[{id:2,isSandbox:true}])]}};
   throw new Error('Unexpected URL');
  };
  const res=response();await handler(req,res);assert.equal(res.headers['Cache-Control'],'no-store');
  assert.equal(res.body.realBanksEnabled,false);assert.equal(res.body.importsEnabled,false);
  assert.doesNotMatch(JSON.stringify(res.body),/test-secret|test-client|private-provider-key|not-returned|synthetic.token/);
  return{res,calls};
 }finally{globalThis.fetch=saved.fetch;for(const [k,v] of [['PLUGGY_CLIENT_ID',saved.id],['PLUGGY_CLIENT_SECRET',saved.secret],['FORMA_SUPABASE_URL',saved.url]]){if(v===undefined)delete process.env[k];else process.env[k]=v}}
}
test('unsupported method, foreign origin and missing bearer fail before network',async()=>{
 for(const [patch,status] of [[{method:'GET'},405],[{headers:{origin:'https://eleva.example'}},403],[{headers:{origin}},401]]){const {res,calls}=await run({},Object.assign(request(),patch));assert.equal(res.statusCode,status);assert.equal(calls.length,0)}
});
test('reject arbitrary item/connector/action payloads before network',async()=>{
 for(const body of [null,{action:'connect'},{action:'check',itemId:'other'},{action:'check',connectorId:601}]){const {res,calls}=await run({}, {...request(),body});assert.equal(res.statusCode,400);assert.equal(calls.length,0)}
});
test('foreign backend, non-owner, expired or changed session cannot reach provider',async()=>{
 for(const options of [{foreignProject:true},{noAuth:true},{otherUser:true},{revoked:true},{role:'manager'},{role:'instructor'},{throwAt:2}]){const {res,calls}=await run(options);assert.ok(res.statusCode>=400);assert.equal(calls.some(c=>c.url.includes('api.pluggy.ai')),false)}
});
test('live role check uses independent backend and authenticated same-origin RPC',async()=>{
 const {calls}=await run();assert.equal(calls[0].url,'https://irsuevjqmgpwunvymxbc.supabase.co/auth/v1/user');assert.equal(calls[1].options.headers.Origin,origin);assert.equal(calls[1].options.headers.Authorization,'Bearer synthetic.token');assert.equal(calls[1].options.body,'{}');
});
test('missing credentials and rejected provider responses produce honest errors',async()=>{
 for(const [opt,code] of [[{missing:true},'not_configured'],[{badCredentials:true},'provider_auth'],[{badKey:true},'provider_response'],[{blocked:true},'provider_access'],[{badList:true},'provider_response'],[{throwAt:3},'provider_unavailable']]){const {res}=await run(opt);assert.ok(res.statusCode>=400);assert.equal(res.body.code,code)}
});
test('successful check returns booleans only and does not create Items or query financial data',async()=>{
 const {res,calls}=await run();assert.equal(res.statusCode,200);assert.equal(res.body.authenticated,true);assert.equal(res.body.sandboxAvailable,true);
 assert.deepEqual(Object.keys(res.body).sort(),['authenticated','checkedAt','importsEnabled','realBanksEnabled','sandboxAvailable']);
 assert.equal(calls.length,4);assert.deepEqual(calls.map(c=>c.options.method||'GET'),['GET','POST','POST','GET']);
 assert.equal(calls[3].options.headers['X-API-KEY'],'private-provider-key');
 assert.doesNotMatch(calls.map(c=>c.url).join(' '),/items|transactions|accounts|payments/);
});
test('real connectors never count as Sandbox availability',async()=>{const {res}=await run({noSandbox:true});assert.equal(res.statusCode,200);assert.equal(res.body.sandboxAvailable,false)});
