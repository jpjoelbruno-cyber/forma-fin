const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const code=fs.readFileSync(require('node:path').join(__dirname,'../../budget-save.js'),'utf8');
function setup(mode='ok'){
  const events={},saved=new Map(),writes=[],timers=[];
  const elements={'orc-cats':{},'budget-save-status':{textContent:''},'orc-overlay':{closed:false,classList:{remove(){elements['orc-overlay'].closed=true;}}}};
  const input={id:'oc-rent',value:'0',validity:{badInput:false}};
  const ctx={user:{id:'test-user'},month:'2026-10',budgetDataReady:true,budgets:{},window:{FORMA_DEMO:false,addEventListener:(k,f)=>events[k]=f},document:{getElementById:id=>elements[id],querySelectorAll:()=>[input]},setTimeout:f=>timers.push(f),clearTimeout:()=>{},console:{error:()=>{}},toast:()=>{},refreshOrc:()=>{},renderResume:()=>{},openOrcModal:()=>{},doLogout:()=>{},demoNotice:()=>{},sb:{from(){return{async upsert(rows){writes.push(rows);if(mode==='fail')return{error:new Error('offline')};rows.forEach(r=>saved.set(r.category,r.planned));return{};},select(){return{eq(){return this;},async in(_,keys){return{data:keys.map(category=>({category,planned:mode==='mismatch'?999:saved.get(category)}))};}};}}}}};
  vm.createContext(ctx);vm.runInContext(code,ctx);
  return{ctx,input,elements,writes,events,saved,timers};
}
test('changed budget saved, read back, and modal closes only after confirmation',async()=>{const s=setup();s.ctx.openOrcModal();s.input.value='123.45';s.elements['orc-cats'].oninput();await s.ctx.saveOrc();assert.equal(s.saved.get('rent'),123.45);assert.equal(s.ctx.budgets.rent,123.45);assert.equal(s.elements['orc-overlay'].closed,true);assert.match(s.elements['budget-save-status'].textContent,/Guardado/);});
test('no writes when no fields change',async()=>{const s=setup();s.ctx.openOrcModal();await s.ctx.closeOrcModal();assert.equal(s.writes.length,0);});
test('failed save keeps modal open and warns against page close',async()=>{const s=setup('fail');s.ctx.openOrcModal();s.input.value='10';s.elements['orc-cats'].oninput();await s.ctx.closeOrcModal();assert.equal(s.elements['orc-overlay'].closed,false);assert.match(s.elements['budget-save-status'].textContent,/No se pudo/);let blocked=false;s.events.beforeunload({preventDefault(){blocked=true;}});assert.equal(blocked,true);});
test('read-back mismatch must never claim saved',async()=>{const s=setup('mismatch');s.ctx.openOrcModal();s.input.value='10';s.elements['orc-cats'].oninput();await s.ctx.saveOrc();assert.equal(s.elements['orc-overlay'].closed,false);assert.match(s.elements['budget-save-status'].textContent,/No se pudo/);});
test('invalid negative value is not written',async()=>{const s=setup();s.ctx.openOrcModal();s.input.value='-1';s.elements['orc-cats'].oninput();await s.ctx.saveOrc();assert.equal(s.writes.length,0);assert.equal(s.elements['orc-overlay'].closed,false);});
test('demo never writes',async()=>{const s=setup();s.ctx.window.FORMA_DEMO=true;s.ctx.openOrcModal();s.input.value='10';s.elements['orc-cats'].oninput();await s.ctx.saveOrc();assert.equal(s.writes.length,0);});
test('stale month is written to captured month, not new month',async()=>{const s=setup();s.ctx.openOrcModal();s.input.value='10';s.elements['orc-cats'].oninput();s.ctx.month='2026-11';await s.ctx.saveOrc();assert.equal(s.writes[0][0].month,'2026-10');});
test('changed session cannot write into either account',async()=>{const s=setup();s.ctx.openOrcModal();s.input.value='10';s.elements['orc-cats'].oninput();s.ctx.user={id:'different-user'};await s.ctx.saveOrc();assert.equal(s.writes.length,0);});
test('budget editor is blocked before cloud data loads',()=>{const s=setup();s.ctx.budgetDataReady=false;s.ctx.openOrcModal();assert.equal(s.elements['orc-cats'].oninput,undefined);});
test('automatic save occurs after input without pressing any button',async()=>{const s=setup();s.ctx.openOrcModal();s.input.value='55';s.elements['orc-cats'].oninput();await s.timers.at(-1)();assert.equal(s.saved.get('rent'),55);assert.match(s.elements['budget-save-status'].textContent,/Guardado/);assert.equal(s.elements['orc-overlay'].closed,false);});
