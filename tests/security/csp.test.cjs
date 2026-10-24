const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));
const header=name=>config.headers.find(h=>h.source==='/(.*)').headers.find(h=>h.key===name)?.value||'';
const directive=(csp,name)=>(csp.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+' '))||'').split(/\s+/).slice(1);
const csp=header('Content-Security-Policy');

test('scripts cannot run inline or from eval',()=>{
 const scripts=directive(csp,'script-src');
 assert.ok(scripts.includes("'self'"));
 for(const unsafe of ["'unsafe-inline'","'unsafe-eval'",'https:','*','data:'])assert.ok(!scripts.includes(unsafe),'script-src must not allow '+unsafe);
});

test('images come only from FORMA, data URIs and the two named hosts',()=>{
 const images=directive(csp,'img-src');
 assert.deepEqual(images.sort(),["'self'",'data:','https://cdn.simpleicons.org','https://i.ytimg.com'].sort());
});

test('network connections are limited to FORMA and its own Supabase project',()=>{
 assert.deepEqual(directive(csp,'connect-src').sort(),["'self'",'https://irsuevjqmgpwunvymxbc.supabase.co','wss://irsuevjqmgpwunvymxbc.supabase.co'].sort());
 assert.ok(!csp.includes('ipcqlltatvpvrqceqiox'),'the Eleva project must never appear in the policy');
});

test('framing, plugins and base tags stay locked',()=>{
 assert.deepEqual(directive(csp,'frame-ancestors'),["'none'"]);
 assert.deepEqual(directive(csp,'object-src'),["'none'"]);
 assert.deepEqual(directive(csp,'base-uri'),["'self'"]);
 assert.equal(header('X-Frame-Options'),'DENY');
 assert.equal(header('X-Content-Type-Options'),'nosniff');
});
