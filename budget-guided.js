/* FORMÁ personal budget: one section at a time; original confirmed save remains authoritative. */
(()=>{
 const $=id=>document.getElementById(id),root=$('orc-cats'),overlay=$('orc-overlay');
 const keyFor=input=>input.id.startsWith('oc-inc-')?'income:'+input.id.slice(7):input.id.slice(3);
 const inputList=()=>[...root.querySelectorAll('input.orc-input')];
 let groups=[],active=0,reviewed=new Set(),visited=new Set(),owner=null,period=null,revision=0,ready=false,markBusy=false;
 let select,nav,content,progress,review,mark,previous,next,initialised=new WeakSet();
 window.FormaBudgetGuided={supportsPending:false};
 async function bounded(promise){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),12000);})]);}finally{clearTimeout(timer);}}
 function initialise(input){if(initialised.has(input))return;initialised.add(input);const key=keyFor(input);
  input.value=Object.hasOwn(budgets,key)&&budgets[key]!==null?String(budgets[key]):'';input.placeholder='Por estimar';input.removeAttribute('oninput');
  const row=input.closest('.orc-row');if(!row)return;const label=row.querySelector('.orc-label');input.setAttribute('aria-label','Monto previsto: '+label.textContent.trim());
  const button=document.createElement('button');button.type='button';button.className='budget-pending';button.textContent='No sé';button.setAttribute('aria-label','Dejar por estimar: '+label.textContent.trim());button.title='Dejar este monto pendiente; no es cero';button.disabled=!window.FormaBudgetGuided.supportsPending;
  button.onclick=()=>{if(!window.FormaBudgetGuided.supportsPending)return;input.value='';input.dataset.pending='true';input.dispatchEvent(new Event('input',{bubbles:true}));};row.append(button);
 }
 function values(section){const inputs=[...section.el.querySelectorAll('.orc-input')],known=inputs.filter(i=>i.value!==''&&Number.isFinite(Number(i.value))&&Number(i.value)>=0);
  return{known:known.length,pending:inputs.length-known.length,total:known.reduce((n,i)=>n+Number(i.value),0)};
 }
 function redraw(){
  if(!groups.length)return;const incomes=inputList().filter(i=>i.id.startsWith('oc-inc-')),expenses=inputList().filter(i=>!i.id.startsWith('oc-inc-'));
  const total=list=>list.reduce((n,i)=>n+(Number(i.value)||0),0),known=list=>list.some(i=>i.value!==''&&Number.isFinite(Number(i.value))&&Number(i.value)>=0);
  const inc=total(incomes),exp=total(expenses),pending=inputList().filter(i=>i.value==='').length;
  $('orc-live').innerHTML=`<div><span>Entradas previstas</span><strong>${known(incomes)?escapeHTML(fmt(inc)):'Por estimar'}</strong></div><div><span>Gastos previstos</span><strong>${known(expenses)?escapeHTML(fmt(exp)):'Por estimar'}</strong></div><div><span>Diferencia del plan</span><strong>${known(incomes)&&known(expenses)?escapeHTML(fmt(inc-exp)):'Pendiente'}</strong></div><p>Resumen parcial · ${pending} monto(s) por estimar. Un campo pendiente no significa cero.</p>`;
  for(let i=0;i<groups.length;i++){const g=groups[i],v=values(g),b=nav.querySelector('[data-section="'+i+'"]');b.querySelector('small').textContent=(v.known?fmt(v.total):'Por estimar')+(reviewed.has(g.id)?' · ✓ Revisada':'');b.setAttribute('aria-current',active===i?'step':'false');select.options[i].textContent=g.label+(reviewed.has(g.id)?' · ✓':'');}
  const count=groups.filter(g=>reviewed.has(g.id)).length;
  progress.textContent=ready?`${count} de ${groups.length} secciones revisadas · Puedes volver y corregir cualquier valor.`:`${visited.size} de ${groups.length} secciones visitadas en este recorrido. La revisión guardada aún no está disponible.`;
  mark.disabled=markBusy||!ready||active>=groups.length;mark.textContent=active<groups.length&&reviewed.has(groups[active].id)?'✓ Sección revisada':'Revisé esta sección';
  review.innerHTML='<h3>Revisa tu presupuesto completo</h3><p>Incluye todas las categorías. Puedes volver a cada sección para estimar o corregir.</p><div class="budget-review-list">'+groups.map((g,i)=>{const v=values(g);return`<button type="button" data-edit="${i}"><span>${escapeHTML(g.label)}<small>${v.pending} por estimar · ${reviewed.has(g.id)?'Revisada':'Sin revisar'}</small></span><strong>${v.known?escapeHTML(fmt(v.total)):'Por estimar'}</strong><span>Editar →</span></button>`;}).join('')+'</div>';
  review.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>show(Number(b.dataset.edit),true));
 }
 function show(index,focus=false){active=Math.max(0,Math.min(groups.length,index));groups.forEach((g,i)=>g.el.hidden=i!==active);review.hidden=active!==groups.length;select.value=String(active);if(active<groups.length)visited.add(active);
  previous.disabled=active===0;next.disabled=active===groups.length;next.textContent=active===groups.length-1?'Revisar presupuesto →':'Siguiente →';redraw();
  if(focus){const heading=active<groups.length?groups[active].el.querySelector('h3'):review.querySelector('h3');heading?.setAttribute('tabindex','-1');heading?.focus({preventScroll:true});const top=$('budget-guide-toolbar');top?.scrollIntoView({block:'start',behavior:'auto'});}
 }
 async function loadReview(rev){if(window.FORMA_DEMO){ready=false;redraw();return;}try{const r=await bounded(sb.rpc('forma_budget_review_state',{p_month:period}));if(rev!==revision||owner!==user?.id||period!==month)return;if(r.error||r.data?.version!==1)throw Error('not_ready');ready=true;window.FormaBudgetGuided.supportsPending=r.data.supports_pending===true;reviewed=new Set((r.data.reviewed||[]).filter(id=>groups.some(g=>g.id===id)));root.querySelectorAll('.budget-pending').forEach(b=>b.disabled=!window.FormaBudgetGuided.supportsPending);redraw();}catch{if(rev===revision){ready=false;redraw();}}}
 const priorRefresh=refreshOrc;refreshOrc=function(){if(root.querySelector('.budget-guided-layout'))redraw();else priorRefresh();};
 const priorOpen=openOrcModal;openOrcModal=function(){priorOpen();if(!overlay.classList.contains('open')||root.querySelector('.budget-guided-layout'))return;
  revision++;owner=user?.id;period=month;ready=false;markBusy=false;window.FormaBudgetGuided.supportsPending=false;reviewed=new Set();visited=new Set();initialised=new WeakSet();
  const original=[...root.querySelectorAll('.orc-group')],defs=[{id:'income',l:'Entradas previstas'},...CAT_GROUPS.filter(g=>g.id!=='trabajo').map(g=>({id:g.id,l:g.l}))];groups=[];
  original.forEach((old,i)=>{const el=document.createElement('section');el.className='budget-group';const heading=document.createElement('h3');heading.textContent=defs[i]?.l||old.querySelector('summary').textContent;el.append(heading);for(const child of [...old.children])if(child.tagName!=='SUMMARY')el.append(child);old.replaceWith(el);groups.push({id:defs[i]?.id||'personalizadas',label:heading.textContent,el});});
  let custom=groups.find(g=>g.id==='personalizadas');if(!custom){const el=document.createElement('section');el.className='budget-group';el.innerHTML='<h3>Otros · Mis gastos</h3>';custom={id:'personalizadas',label:'Otros · Mis gastos',el};groups.push(custom);}const tools=$('custom-budget-tools');if(tools)custom.el.append(tools);
  const toolbar=document.createElement('div');toolbar.id='budget-guide-toolbar';toolbar.innerHTML='<label for="budget-section-select">¿Qué parte quieres revisar?</label><select id="budget-section-select" class="inp-simple"></select><p id="budget-review-progress" role="status"></p>';
  const layout=document.createElement('div');layout.className='budget-guided-layout';nav=document.createElement('nav');nav.className='budget-section-nav';nav.setAttribute('aria-label','Secciones del presupuesto');content=document.createElement('div');content.className='budget-section-content';
  for(let i=0;i<groups.length;i++){const g=groups[i],b=document.createElement('button');b.type='button';b.dataset.section=i;b.innerHTML='<span>'+escapeHTML(g.label)+'</span><small></small>';b.onclick=()=>show(i,true);nav.append(b);content.append(g.el);}
  review=document.createElement('section');review.className='budget-review';content.append(review);const reviewButton=document.createElement('button');reviewButton.type='button';reviewButton.textContent='Revisar presupuesto →';reviewButton.onclick=()=>show(groups.length,true);nav.append(reviewButton);
  layout.append(nav,content);root.append(toolbar,layout);select=$('budget-section-select');progress=$('budget-review-progress');select.innerHTML=groups.map((g,i)=>'<option value="'+i+'">'+escapeHTML(g.label)+'</option>').join('')+'<option value="'+groups.length+'">Revisar presupuesto</option>';select.onchange=()=>show(Number(select.value),true);
  const controls=document.createElement('div');controls.className='budget-guide-controls';controls.innerHTML='<button type="button" id="budget-previous">← Anterior</button><button type="button" id="budget-review-mark">Revisé esta sección</button><button type="button" id="budget-next">Siguiente →</button>';root.append(controls);previous=$('budget-previous');next=$('budget-next');mark=$('budget-review-mark');previous.onclick=()=>show(active-1,true);next.onclick=()=>show(active+1,true);
  mark.onclick=async()=>{if(!ready||markBusy||active>=groups.length||!user||user.id!==owner)return;const rev=revision,section=groups[active].id,uid=owner,chosenPeriod=period;markBusy=true;redraw();try{if(!await window.FormaBudgetSave.confirm())return;const r=await bounded(sb.rpc('forma_budget_review_mark',{p_month:chosenPeriod,p_section:section,p_reviewed:true}));if(rev!==revision||user?.id!==uid)return;if(r.error||r.data?.section!==section||r.data.reviewed!==true)throw Error('unconfirmed');reviewed.add(section);toast('Sección revisada y guardada.');}catch{if(rev===revision)toast('No se confirmó la revisión. Tus montos conservan su guardado independiente.',false);}finally{if(rev===revision){markBusy=false;redraw();}}};
  inputList().forEach(initialise);
  const newRows=$('new-custom-budget-rows');if(newRows)new MutationObserver(()=>{newRows.querySelectorAll('.orc-input').forEach(initialise);redraw();}).observe(newRows,{childList:true});
  content.insertAdjacentHTML('afterbegin','<p class="budget-guide-hint">Escribe el monto mensual. Si no tienes ese gasto, escribe <strong>0</strong>. Si aún no sabes, déjalo <strong>por estimar</strong>.</p>');
  show(groups.findIndex(g=>g.id==='servicios')>=0?groups.findIndex(g=>g.id==='servicios'):0);loadReview(revision);
 };
 root.addEventListener('input',event=>{if(root.querySelector('.budget-guided-layout')&&event.target.classList.contains('orc-input')){if(event.target.value!=='')delete event.target.dataset.pending;redraw();}},{passive:true});
 if(sb)sb.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){revision++;window.FormaBudgetGuided.supportsPending=false;overlay.classList.remove('open');}});
})();
