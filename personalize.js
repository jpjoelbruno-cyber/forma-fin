// Personal goal editing and reusable budget categories; all writes use owner RLS.
const GOAL_VISUALS={auto:['Automática','🎯'],house:['Casa','🏡'],travel:['Viaje','✈️'],family:['Familia','👨‍👩‍👧'],car:['Auto','🚗'],reserve:['Reserva','🛡️'],study:['Estudios','🎓'],custom:['Otra meta','⭐']};
let editingGoalId=null, goalSaveBusy=false, customCategoryOwner=null;
function goalVisual(g){return GOAL_VISUALS[g.visual]?.[1]&&g.visual!=='auto'?GOAL_VISUALS[g.visual][1]:goalEmoji(g.name);}
function goalProgress(g,events=goalEvents){
 const saved=Number(g.saved||0)+events.filter(e=>e.goal_id===g.id).reduce((s,e)=>s+(e.direction==='contribution'?1:-1)*Number(e.amount),0);
 const target=Number(g.target),pct=Math.max(0,Math.min(100,target>0?saved/target*100:0));
 return {saved,pct,remaining:Math.max(0,target-saved),remainingPct:Math.max(0,100-pct)};
}
const goalModal=document.querySelector('#goal-overlay .modal');
goalModal.querySelector('.modal-title').id='goal-modal-title';
goalModal.querySelector('.btn-primary').id='goal-submit';
goalModal.querySelector('.btn-primary').insertAdjacentHTML('beforebegin','<div class="fld"><label for="goal-visual">Imagen de tu meta</label><select class="inp-simple" id="goal-visual">'+Object.entries(GOAL_VISUALS).map(([k,[label,emoji]])=>`<option value="${k}">${emoji} ${label}</option>`).join('')+'</select><small>Puedes cambiarla cuando quieras.</small></div><p id="goal-save-status" role="status" aria-live="polite"></p>');
openGoalModal=function(id=null){
 const g=id?remoteGoals.find(x=>x.id===id):null;if(id&&!g)return;
 editingGoalId=g?.id||null;
 for(const [field,value] of [['goal-name',g?.name||''],['goal-target',g?.target||''],['goal-monthly',g?.monthly_plan||''],['goal-date',g?.deadline||''],['goal-visual',g?.visual||'auto']])document.getElementById(field).value=value;
 document.getElementById('goal-modal-title').textContent=g?'Editar mi meta':'Crear mi meta';
 document.getElementById('goal-submit').textContent=g?'Guardar cambios':'Crear meta';
 document.getElementById('goal-save-status').textContent=g?'Tus aportes y retiros se conservan al editar la meta.':'';
 document.getElementById('goal-overlay').classList.add('open');
};
saveGoal=async function(){
 if(window.FORMA_DEMO){demoNotice();return;}if(goalSaveBusy||!user)return;
 const uid=user.id,id=editingGoalId,name=document.getElementById('goal-name').value.trim(),target=Number(document.getElementById('goal-target').value),monthly_plan=Number(document.getElementById('goal-monthly').value||0),deadline=document.getElementById('goal-date').value||null,visual=document.getElementById('goal-visual').value;
 if(!name||name.length>100||!Number.isFinite(target)||target<=0||target>999999999||!Number.isFinite(monthly_plan)||monthly_plan<0||monthly_plan>999999999||!GOAL_VISUALS[visual]){toast('Revisa el nombre y los montos de tu meta',false);return;}
 const payload={name,target,monthly_plan,deadline,visual,goal_type:/reserva|emergencia/i.test(name)?'reserve':'custom'};
 const status=document.getElementById('goal-save-status'),button=document.getElementById('goal-submit');goalSaveBusy=true;button.disabled=true;status.textContent='Guardando en tu cuenta…';
 try{
  const result=id?await sb.from('forma_goals').update(payload).eq('id',id).eq('user_id',uid).select('id,name,target,monthly_plan,deadline,visual'):await sb.from('forma_goals').insert({...payload,user_id:uid,saved:0}).select('id,name,target,monthly_plan,deadline,visual');
  if(result.error||result.data?.length!==1)throw new Error('No se pudo confirmar el guardado');
  const returned=result.data[0];if(returned.name!==name||Number(returned.target)!==target||returned.visual!==visual||Number(returned.monthly_plan)!==monthly_plan||returned.deadline!==deadline)throw new Error('No se pudo confirmar el guardado');
  if(user?.id===uid){closeGoalModal();toast(id?'Meta actualizada y guardada':'Meta creada y guardada');await renderGoals();}
 }catch(e){status.textContent='No se pudo guardar. Tus cambios siguen aquí; vuelve a intentarlo.';toast('No se guardó la meta',false);}finally{goalSaveBusy=false;button.disabled=false;}
};
// Include the visual choice in each cloud reload, including a new session/device.
renderGoals=async function(){
 if(window.FORMA_DEMO){paintGoals();return;}if(!user)return;const uid=user.id;
 const [g,e]=await Promise.all([sb.from('forma_goals').select('id,name,target,saved,deadline,monthly_plan,goal_type,visual').eq('user_id',uid).order('created_at',{ascending:false}),sb.from('forma_goal_events').select('id,goal_id,direction,amount,institution_code,location_label,occurred_on').eq('user_id',uid).order('occurred_on',{ascending:false})]);
 if(user?.id!==uid)return;
 if(g.error||e.error){document.getElementById('goals-list').textContent='No pudimos cargar tus metas. Vuelve a intentarlo.';return;}
 remoteGoals=g.data||[];goalEvents=e.data||[];paintGoals();
};
const originalPaintGoals=paintGoals;
paintGoals=function(){
 originalPaintGoals();
 document.querySelectorAll('#goals-list .goal-item').forEach((card,i)=>{
  const g=remoteGoals[i];if(!g)return;const p=goalProgress(g);
  card.querySelector('.goal-header').insertAdjacentHTML('beforebegin',`<div class="goal-picture" aria-label="${escapeHTML(GOAL_VISUALS[g.visual]?.[0]||'Tu meta')}">${goalVisual(g)}</div>`);
  const track=card.querySelector('.goal-track');track.setAttribute('role','progressbar');track.setAttribute('aria-label','Avance de '+g.name);track.setAttribute('aria-valuenow',p.pct.toFixed(1));track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');
  track.insertAdjacentHTML('afterend',`<div class="goal-progress-copy"><strong>${p.pct.toFixed(1)}% alcanzado</strong><span>Falta ${p.remainingPct.toFixed(1)}% · ${fmt(p.remaining)}</span></div>`);
  const edit=document.createElement('button');edit.textContent='Editar meta';edit.addEventListener('click',()=>openGoalModal(g.id));card.querySelector('.goal-actions').prepend(edit);
 });
};
function customCategoryLabel(key){try{return decodeURIComponent(key.slice(7));}catch{return 'Otro gasto';}}
function registerPersonalCategory(key){
 if(EXP_CATS.some(c=>c.id===key))return;
 const c={id:key,i:'✏️',l:customCategoryLabel(key)};
 let group=CAT_GROUPS.find(g=>g.id==='personalizadas');if(!group){group={id:'personalizadas',i:'✏️',l:'Otros · Mis gastos',subs:[]};CAT_GROUPS.push(group);}group.subs.push(c);EXP_CATS.push(c);
}
async function loadPersonalCategories(uid){
 if(customCategoryOwner!==uid){for(let i=EXP_CATS.length-1;i>=0;i--)if(EXP_CATS[i].id.startsWith('custom:'))EXP_CATS.splice(i,1);const i=CAT_GROUPS.findIndex(g=>g.id==='personalizadas');if(i>=0)CAT_GROUPS.splice(i,1);customCategoryOwner=uid;}
 const {data,error}=await sb.from('forma_budgets').select('category').eq('user_id',uid).like('category','custom:%');
 if(error)throw error;if(user?.id!==uid)return;(data||[]).forEach(r=>registerPersonalCategory(r.category));
 renderDailyCategory();
}
function personalInputRow(key){return `<div class="orc-row"><span class="orc-label">✏️ ${escapeHTML(customCategoryLabel(key))}</span><input class="orc-input" id="oc-${escapeHTML(key)}" type="number" min="0" step="0.01" value="${Number(budgets[key]||0)}" inputmode="decimal" aria-label="${escapeHTML(customCategoryLabel(key))}"></div>`;}
const openBudgetWithSave=openOrcModal;
openOrcModal=function(){
 openBudgetWithSave();if(!document.getElementById('orc-overlay').classList.contains('open'))return;
 if(document.getElementById('custom-budget-tools'))return;
 document.getElementById('orc-cats').insertAdjacentHTML('beforeend','<div id="custom-budget-tools" class="custom-budget-tools"><label for="custom-budget-name">¿Falta un gasto? Personaliza «Otros»</label><input class="inp-simple" id="custom-budget-name" maxlength="80" placeholder="Ej.: Envío a mi familia, mascota…"><button type="button" id="custom-budget-add" data-forma-click="90">+ Añadir mi gasto</button><p id="custom-budget-status" role="status">Se guarda en tu cuenta para reutilizarlo en otros meses.</p><div id="new-custom-budget-rows"></div></div>');
};
async function addPersonalBudgetCategory(){
 if(window.FORMA_DEMO){demoNotice();return;}if(!user||!budgetDataReady)return;
 const label=document.getElementById('custom-budget-name').value.trim().replace(/\s+/g,' ');if(!label||label.length>80){toast('Escribe el nombre del gasto',false);return;}
 const key='custom:'+encodeURIComponent(label).replace(/'/g,'%27'),uid=user.id,period=month;
 if(EXP_CATS.some(c=>c.id===key)){toast('Ese gasto ya está en tu lista',false);return;}
 const button=document.getElementById('custom-budget-add'),status=document.getElementById('custom-budget-status');button.disabled=true;status.textContent='Guardando tu gasto…';
 try{
  const result=await sb.from('forma_budgets').upsert({user_id:uid,month:period,category:key,planned:0},{onConflict:'user_id,month,category',ignoreDuplicates:true});if(result.error)throw result.error;
  const check=await sb.from('forma_budgets').select('category,planned').eq('user_id',uid).eq('month',period).eq('category',key).single();if(check.error||check.data?.category!==key)throw new Error('Unconfirmed save');
  if(user?.id!==uid||month!==period)return;registerPersonalCategory(key);budgets[key]=Number(check.data.planned);
  document.getElementById('new-custom-budget-rows').insertAdjacentHTML('beforeend',personalInputRow(key));document.getElementById('custom-budget-name').value='';status.textContent='✓ Gasto guardado. Escribe el monto; se guarda automáticamente.';renderDailyCategory();refreshOrc();renderResume();
 }catch(e){status.textContent='No se pudo guardar. Vuelve a intentarlo.';}finally{button.disabled=false;}
}
