const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
test('FORMA install identity, scope, routes and raster icons are valid',()=>{
 a.equal(manifest.name,'FORMA');a.equal(manifest.id,'/');a.equal(manifest.start_url,'/');a.equal(manifest.scope,'/');a.equal(manifest.display,'standalone');
 for(const size of[192,512]){const icon=manifest.icons.find(i=>i.sizes===`${size}x${size}`);a.equal(icon.type,'image/png');const b=fs.readFileSync('.'+icon.src);a.equal(b.subarray(1,4).toString(),'PNG');a.equal(b.readUInt32BE(16),size);a.equal(b.readUInt32BE(20),size)}
 for(const entry of['index.html','agenda.html']){const s=fs.readFileSync(entry,'utf8');a.match(s,/rel="manifest"/);a.match(s,/apple-touch-icon/);a.match(s,/\/pwa.js\?v=/);}
});
function worker(fetch){const handlers={};const self={location:{origin:'https://forma-fin.vercel.app'},addEventListener:(n,f)=>handlers[n]=f,skipWaiting:async()=>{},clients:{claim:async()=>{}}};vm.runInNewContext(fs.readFileSync('sw.js','utf8'),{self,fetch,URL,Response});return handlers;}
test('worker never intercepts writes, fetch APIs, provider/auth calls or foreign origins',()=>{
 let network=0,intercepts=0;const w=worker(()=>{network++;return Promise.resolve(new Response('x'))});
 for(const patch of[{method:'POST',url:'https://forma-fin.vercel.app/api/bank-pilot'},{mode:'cors',url:'https://forma-fin.vercel.app/api/bank-pilot'},{url:'https://irsuevjqmgpwunvymxbc.supabase.co/auth/v1/user'},{url:'https://api.pluggy.ai/accounts'}])w.fetch({request:{method:'GET',mode:'navigate',url:'https://forma-fin.vercel.app/',...patch},respondWith(){intercepts++}});
 a.equal(network,0);a.equal(intercepts,0);
});
test('navigation always reads network and returns fresh response without caching',async()=>{let options,p;const w=worker(async(req,o)=>{options=o;return new Response('fresh')});w.fetch({request:{url:'https://forma-fin.vercel.app/agenda.html',mode:'navigate',method:'GET'},respondWith(v){p=v}});a.equal(await(await p).text(),'fresh');a.equal(options.cache,'no-store');});
test('offline response contains no financial/auth data and preserves only allowed retry route',async()=>{const w=worker(async()=>{throw Error('offline')});for(const path of['/agenda.html?token=private-secret','/?code=private-secret']){let p;w.fetch({request:{url:'https://forma-fin.vercel.app'+path,mode:'navigate',method:'GET'},respondWith(v){p=v}});const r=await p,html=await r.text();a.equal(r.status,503);a.equal(r.headers.get('Cache-Control'),'no-store');a.match(html,/Necesitas conexión/);a.doesNotMatch(html,/private-secret|token=|code=/);a.match(html,path.startsWith('/agenda')?/href="\/agenda.html"/:/href="\/"/);}});
test('only one installer handles prompts and worker contains no caches or queues',()=>{a.doesNotMatch(fs.readFileSync('app.js','utf8'),/addEventListener\('beforeinstallprompt'/);a.doesNotMatch(fs.readFileSync('sw.js','utf8'),/caches\.|indexedDB|localStorage|sync\.register/);a.doesNotMatch(fs.readFileSync('pwa.js','utf8'),/location\.reload|controllerchange|localStorage/)});
