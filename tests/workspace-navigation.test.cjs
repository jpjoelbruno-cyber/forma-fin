const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../admin.js','utf8');
const adapter=source.slice(source.indexOf("let previousPanel='resumo';"),source.indexOf('  dialog.innerHTML='));
function harness(initial='resumo'){
 let active=initial;const calls=[];
 const dialog={classList:{contains:()=>active==='admin'}};
 const context=vm.createContext({dialog,document:{querySelector:()=>({id:'p-'+active})},window:{scrollTo(){}},goPanel(id){active=id;calls.push(id);}});
 vm.runInContext(adapter,context);return {dialog,calls,active:()=>active};
}
test('administration opens as an application section and returns to the previous section',()=>{
 const h=harness('metas');h.dialog.showModal();assert.equal(h.active(),'admin');h.dialog.close();assert.equal(h.active(),'metas');
});
test('opening administration again preserves the return destination',()=>{
 const h=harness('historico');h.dialog.showModal();h.dialog.showModal();h.dialog.close();assert.equal(h.active(),'historico');
});
test('closing an inactive administration panel does not navigate or reload finances',()=>{
 const h=harness('registrar');h.dialog.close();assert.deepEqual(h.calls,[]);assert.equal(h.active(),'registrar');
});
