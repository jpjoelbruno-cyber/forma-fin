const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../../personalize.js'),'utf8');
const context={goalEvents:[],goalEmoji:()=> '🎯'};vm.createContext(context);vm.runInContext(source.slice(0,source.indexOf('const goalModal=')),context);
test('25 percent saved leaves 75 percent and correct amount',()=>{const p=context.goalProgress({id:'a',saved:250,target:1000});assert.equal(p.pct,25);assert.equal(p.remainingPct,75);assert.equal(p.remaining,750);});
test('contributions and withdrawals count only for the selected goal',()=>{const p=context.goalProgress({id:'a',saved:0,target:1000},[{goal_id:'a',direction:'contribution',amount:400},{goal_id:'a',direction:'withdrawal',amount:100},{goal_id:'b',direction:'contribution',amount:900}]);assert.equal(p.saved,300);assert.equal(p.pct,30);});
test('correcting target updates progress without changing saved amount',()=>{const p=context.goalProgress({id:'a',saved:250,target:500});assert.equal(p.pct,50);assert.equal(p.saved,250);});
test('exceeded target never displays negative remaining',()=>{const p=context.goalProgress({id:'a',saved:1500,target:1000});assert.equal(p.pct,100);assert.equal(p.remainingPct,0);assert.equal(p.remaining,0);});
