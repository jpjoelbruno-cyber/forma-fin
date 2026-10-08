(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.FormaLearning=factory();})(typeof window!=='undefined'?window:this,function(){
 function pathway(courses,state,ready){const ordered=[...courses].sort((a,b)=>(a.position||0)-(b.position||0)||String(a.id).localeCompare(String(b.id)));const verified=state?.courses||[];return ordered.map((c,i)=>{const v=verified.find(v=>v.id===c.id);return {...c,open:ready?v?.open===true:i===0,done:ready?v?.done===true:false,total:v?.total||0};});}
 function lessonState(id,state,ready){const l=(state?.lessons||[]).find(l=>l.id===id);return ready?l||{id,open:false,configured:false}: {id,open:true,configured:false,completed_at:null,watched_seconds:0};}
 function thermometer(rows){const done=rows.filter(c=>c.done).length;return {done,total:rows.length,percent:rows.length?Math.round(done/rows.length*100):0};}
 function watchedPercent(l){return l?.duration?Math.min(100,Math.floor((l.watched_seconds||0)/l.duration*100)):0;}
 return {pathway,lessonState,thermometer,watchedPercent};
});
