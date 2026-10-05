const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../../admin.js','utf8');
const functions=source.slice(source.indexOf('  async function verifyEntry(){'),source.indexOf('  async function refresh(){'));
function context({demo=false,ready=true,error=null,confirmed=true}={}){
 const calls=[],timers=[];const c=vm.createContext({user:{id:'student'},budgetDataReady:ready,generation:1,entryReady:false,entryPending:null,sectionTimer:null,labels:{resumo:'Inicio',metas:'Metas'},demo:()=>demo,enabled:()=>true,document:{visibilityState:'visible',querySelector:()=>({id:'p-resumo'})},clearTimeout:()=>{},setTimeout:fn=>{timers.push(fn);return timers.length;},console,sb:{rpc:async(name,args)=>{calls.push({name,args});return {error,data:{verified:confirmed}};}}});
 vm.runInContext(functions,c);return {c,calls,timers};
}
test('demo and incomplete data loads never attest an entry',async()=>{for(const options of [{demo:true},{ready:false}]){const x=context(options);await x.c.verifyEntry();assert.equal(x.calls.length,0);assert.equal(x.c.entryReady,false);}});
test('a failed or unconfirmed server write never enables section tracking',async()=>{for(const options of [{error:{message:'denied'}},{confirmed:false}]){const x=context(options);assert.equal(await x.c.verifyEntry(),false);x.c.track('resumo');assert.equal(x.timers.length,0);}});
test('confirmed entry uses only section RPC, never client timestamps or user identity',async()=>{const x=context();assert.equal(await x.c.verifyEntry(),true);assert.deepEqual(JSON.parse(JSON.stringify(x.calls)),[{name:'forma_record_access',args:{p_section:'entry'}}]);await x.timers[0]();assert.equal(x.calls.length,2);assert.equal(x.calls[1].args.p_section,'resumo');assert.equal(Object.keys(x.calls[1].args).length,1);});
test('a changed account during the consultation timer emits no event',async()=>{const x=context();await x.c.verifyEntry();x.c.user={id:'other'};await x.timers[0]();assert.equal(x.calls.length,1);});
test('a hidden tab during the consultation timer emits no event',async()=>{const x=context();await x.c.verifyEntry();x.c.document.visibilityState='hidden';await x.timers[0]();assert.equal(x.calls.length,1);});
