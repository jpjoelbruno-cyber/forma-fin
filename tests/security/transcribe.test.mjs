import {test} from 'node:test';import assert from 'node:assert/strict';import handler from '../../api/transcribe.js';
const origin='https://forma-fin.vercel.app';function response(){return{statusCode:null,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this},json(body){this.body=body;return this}};}
test('capabilities expose only a boolean, never a credential',async()=>{const prior=process.env.OPENAI_API_KEY;delete process.env.OPENAI_API_KEY;const r=response();await handler({method:'GET',headers:{}},r);assert.deepEqual(r.body,{cloud:false});if(prior)process.env.OPENAI_API_KEY=prior;});
test('foreign origin is denied before provider processing',async()=>{const r=response();await handler({method:'POST',headers:{origin:'https://other.example'}},r);assert.equal(r.statusCode,403);});
test('missing authentication is denied',async()=>{const r=response();await handler({method:'POST',headers:{origin}},r);assert.equal(r.statusCode,401);});
test('unsupported methods are denied',async()=>{const r=response();await handler({method:'PUT',headers:{origin}},r);assert.equal(r.statusCode,405);});
test('quoted checked-in config authenticates only against independent FORMA',async()=>{
 const saved={fetch:globalThis.fetch,url:process.env.FORMA_SUPABASE_URL,key:process.env.FORMA_SUPABASE_PUBLISHABLE_KEY,ai:process.env.OPENAI_API_KEY};let called;
 try{delete process.env.FORMA_SUPABASE_URL;delete process.env.FORMA_SUPABASE_PUBLISHABLE_KEY;delete process.env.OPENAI_API_KEY;globalThis.fetch=async(url,options)=>{called={url,options};return{ok:true}};
  const r=response();await handler({method:'POST',headers:{origin,authorization:'Bearer synthetic.test.token'},body:{mime:'audio/webm',language:'es',audio:Buffer.alloc(32).toString('base64')}},r);
  assert.equal(called.url,'https://irsuevjqmgpwunvymxbc.supabase.co/auth/v1/user');assert.ok(called.options.headers.apikey.startsWith('sb_publishable_'));assert.equal(r.statusCode,503);assert.match(r.body.error,/avanzada pendiente/);
 }finally{globalThis.fetch=saved.fetch;for(const [name,value] of [['FORMA_SUPABASE_URL',saved.url],['FORMA_SUPABASE_PUBLISHABLE_KEY',saved.key],['OPENAI_API_KEY',saved.ai]]){if(value===undefined)delete process.env[name];else process.env[name]=value;}}
});
