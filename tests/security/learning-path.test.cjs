const test=require('node:test'),a=require('node:assert/strict'),L=require('../../learning-utils');
const courses=[{id:'second',position:1},{id:'first',position:0},{id:'third',position:2}];
test('unconfigured backend grants no completion and only first course preview',()=>{const r=L.pathway(courses,{courses:[{id:'second',done:true}]},false);a.deepEqual(r.map(c=>[c.id,c.open,c.done]),[['first',true,false],['second',false,false],['third',false,false]]);a.equal(L.thermometer(r).percent,0)});
test('only verified server state unlocks courses',()=>{const r=L.pathway(courses,{courses:[{id:'first',open:true,done:true,total:2},{id:'second',open:true,done:false,total:3},{id:'third',open:false,done:false,total:2}]},true);a.equal(r[0].done,true);a.equal(r[1].open,true);a.equal(r[2].open,false);a.equal(L.thermometer(r).percent,33)});
test('missing server lesson cannot be opened by client',()=>a.equal(L.lessonState('unknown',{lessons:[]},true).open,false));
test('video playback progress never counts as a concluded course',()=>{const s={courses:[{id:'first',open:true,done:false}],lessons:[{id:'x',duration:100,watched_seconds:100}]};a.equal(L.watchedPercent(s.lessons[0]),100);a.equal(L.thermometer(L.pathway(courses,s,true)).done,0)});
test('empty catalog is zero progress without invented course counts',()=>a.deepEqual(L.thermometer([]),{done:0,total:0,percent:0}));
