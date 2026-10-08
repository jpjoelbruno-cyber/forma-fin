const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync('app.js','utf8');
function harness(active=true){
 const elements=new Map();
 const el=id=>{if(!elements.has(id))elements.set(id,{style:{display:id==='app-screen'?(active?'flex':'none'):'none'},hidden:false});return elements.get(id)};
 let callback,shown=0,checks=0;const tasks=[];
 const context=vm.createContext({user:active?{id:'owner'}:null,profile:active?{id:'owner'}:null,passwordRecoveryActive:false,window:{FORMA_DEMO:false},document:{getElementById:el,querySelector:()=>null},sb:{auth:{onAuthStateChange:fn=>callback=fn}},setTimeout:fn=>tasks.push(fn),loadProfile:async()=>{checks++;context.profile={id:context.user.id}},showApp:()=>shown++,showPasswordRecovery:()=>{},hideEl:id=>el(id).style.display='none',showEl:id=>el(id).style.display='flex',switchTab:()=>{},console:{error:()=>{}}});
 vm.runInContext(source.slice(source.indexOf('let authRevision=0;'),source.indexOf('if(sb) sb.auth.getSession()')),context);
 return {context,el,event:async(event,id='owner')=>{callback(event,id?{user:{id}}:null);await tasks.shift()()},get shown(){return shown},get checks(){return checks}};
}
test('focus SIGNED_IN and TOKEN_REFRESHED keep workspace and unsaved input, but recheck access',async()=>{const h=harness();h.el('lesson-title').value='Mi video pendiente';await h.event('SIGNED_IN');await h.event('TOKEN_REFRESHED');assert.equal(h.shown,0);assert.equal(h.checks,2);assert.equal(h.el('lesson-title').value,'Mi video pendiente')});
test('initial login builds application',async()=>{const h=harness(false);await h.event('INITIAL_SESSION');assert.equal(h.shown,1)});
test('different account rebuilds application',async()=>{const h=harness();await h.event('SIGNED_IN','student');assert.equal(h.shown,1)});
test('revoked access hides workspace on revalidation',async()=>{const h=harness();h.context.loadProfile=async()=>{throw Object.assign(new Error('Pending'),{code:'FORMA_ACCESS_PENDING'})};await h.event('TOKEN_REFRESHED');assert.equal(h.el('app-screen').style.display,'none');assert.equal(h.context.user,null)});
test('sign out hides protected workspace',async()=>{const h=harness();await h.event('SIGNED_OUT',null);assert.equal(h.el('app-screen').style.display,'none');assert.equal(h.context.profile,null)});
