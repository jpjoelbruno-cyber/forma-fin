/* Audit corrections: FORMÁ only. No app memberships or financial data inferred by UI. */
(()=>{
 const $=id=>document.getElementById(id);
 async function bounded(promise,ms){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),ms);})]);}finally{clearTimeout(timer);}}
 const pending=document.createElement('section');pending.id='access-pending-card';pending.hidden=true;
 pending.innerHTML='<span class="eyebrow">TU REGISTRO ESTÁ RECIBIDO</span><h2>Estamos validando tu acceso</h2><p>Tu cuenta se creó correctamente. El equipo de FORMÁ necesita confirmar tu acceso como alumno.</p><p>Tu referencia: <strong id="pending-reference"></strong></p><a id="pending-contact" class="action-main" target="_blank" rel="noopener noreferrer">Solicitar ayuda</a><p id="pending-contact-status" role="status"></p><p class="muted-note">Aún no hay un plazo de respuesta definido. No necesitas volver a registrarte. Tus datos anteriores se conservan.</p>';
 document.querySelector('.auth-card').append(pending);pending.append($('pending-actions'));
 window.showPendingAccess=async reference=>{
  $('auth-screen').classList.add('access-pending');pending.hidden=false;$('pending-actions').hidden=false;$('pending-reference').textContent=reference;
  const link=$('pending-contact'),text='Hola, solicito validar mi acceso a FORMÁ. Mi referencia es '+reference+'.';
  // Owner contact is an explicit fallback; no financial values or email added to message.
  link.href='mailto:jp.joelbruno@gmail.com?subject='+encodeURIComponent('Acceso a FORMÁ')+'&body='+encodeURIComponent(text);link.textContent='Pedir ayuda por correo';$('pending-contact-status').textContent='Comparte tu referencia con el equipo de FORMÁ.';
  try{const r=await bounded(sb.from('forma_support_settings').select('whatsapp').eq('id',true).single(),10000);
   if(!pending.isConnected||!$('auth-screen').classList.contains('access-pending')||$('pending-reference').textContent!==reference)return;
   const phone=String(r.data?.whatsapp||'').replace(/\D/g,'');if(!r.error&&/^[1-9][0-9]{7,14}$/.test(phone)){link.href='https://wa.me/'+phone+'?text='+encodeURIComponent(text);link.textContent='Pedir ayuda por WhatsApp';}
  }catch{};
 };
 const nav=$('bnav'),more=document.createElement('button');more.id='nb-more';more.className='nb';more.innerHTML='<span class="ni" aria-hidden="true">⋯</span><span class="nl">Más</span>';more.onclick=()=>goPanel('more');nav.append(more);
 const panel=document.createElement('section');panel.id='p-more';panel.className='panel';panel.innerHTML='<div class="section-head"><h2>Más opciones</h2></div><div class="more-options"><button data-section="historico">Historial <small>Consulta y corrige tus movimientos</small></button><button data-section="banco">Mis cuentas <small>Dónde tienes tu dinero anotado</small></button><button data-section="anual">Mi año <small>Tu evolución mes a mes</small></button><button id="more-help">Ayuda <small>Comunícate con FORMÁ</small></button></div>';$('app-screen').insertBefore(panel,nav);
 panel.querySelectorAll('[data-section]').forEach(b=>b.onclick=()=>goPanel(b.dataset.section));$('more-help').onclick=()=>$('forma-help-button').click();
 const help=$('forma-help-button');document.querySelector('.tb-inner').append(help);help.innerHTML='<span aria-hidden="true">?</span><span class="help-label">Ayuda</span>';help.setAttribute('aria-label','Abrir ayuda');document.querySelector('.forma-tools')?.remove();
 const bank=$('nb-banco');bank.innerHTML='<span class="ni" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 9h18L12 3 3 9zm2 2v7m7-7v7m7-7v7M3 21h18"/></svg></span><span class="nl">Mis cuentas</span>';
 const priorPanel=goPanel;goPanel=function(id){const result=priorPanel(id);more.classList.toggle('active',['more','historico','banco','anual'].includes(id));return result;};
 const manual=$('manual-register');manual.open=true;manual.querySelector('summary').textContent='Registrar por escrito';const parent=$('p-registrar'),layout=document.createElement('div');layout.className='register-methods';parent.append(layout);layout.append(parent.querySelector('.voice-card'),manual);
 // Honest budget summary: one set of recorded amounts; plan editing beside thermometer.
 const planButton=document.querySelector('.plan-card .btn-sm');document.querySelector('.thermometer-card .sh').append(planButton);
 const priorOverview=updateOverview;updateOverview=function(){priorOverview();const sub=$('hero-sub');sub.hidden=true;let totals=$('hero-totals');if(!totals){totals=document.createElement('div');totals.id='hero-totals';totals.className='hero-totals';$('hero-bal').after(totals);}totals.replaceChildren();for(const [label,id] of [['Entradas','s-inc'],['Gastos','s-exp']]){const el=document.createElement('div'),name=document.createElement('span'),value=document.createElement('strong');name.textContent=label;value.textContent=$(id).textContent;el.append(name,value);totals.append(el);}};
 // Pending users cannot see the app, and return-to-login restores the regular view.
 const oldTab=switchTab;switchTab=function(tab){$('auth-screen').classList.remove('access-pending');pending.hidden=true;return oldTab(tab);};
 const eventStatus=document.createElement('p');eventStatus.id='event-save-status';eventStatus.setAttribute('role','status');$('event-overlay').querySelector('.modal').append(eventStatus);
 let eventPending=null,eventBusy=false;
 const oldOpen=openGoalEvent;openGoalEvent=function(id,direction){if(eventPending){toast('Confirma primero el guardado pendiente de tu meta.',false);return;}eventStatus.textContent='';oldOpen(id,direction);};
 saveGoalEvent=async function(){
  if(window.FORMA_DEMO){demoNotice();return;}if(eventBusy||!user)return;
  const uid=user.id,amount=Number($('event-amount').value),goal=remoteGoals.find(g=>g.id===eventGoalId);
  if(!goal||!Number.isFinite(amount)||amount<=0||amount>999999999||!FormaIntent.isValidDate($('event-date').value)){toast('Revisa monto y fecha',false);return;}
  const data={p_id:eventPending?.p_id||crypto.randomUUID(),p_goal:eventGoalId,p_direction:eventDirection,p_amount:amount,p_institution:$('event-bank').value,p_location:$('event-location').value.trim(),p_date:$('event-date').value};
  if(eventPending&&JSON.stringify({...data,p_id:eventPending.p_id})!==JSON.stringify(eventPending)){toast('No cambies los datos durante un guardado pendiente. Reintenta primero.',false);return;}
  eventPending=data;eventBusy=true;eventStatus.textContent='Guardando y confirmando…';
  try{let r=await bounded(sb.rpc('forma_save_goal_event',data),15000);
   // Positive self-reported deposits remain available while the owner installs SQL.
   // Withdrawals never use this compatibility path. Explicit IDs make retries safe.
   if((r.error?.code==='PGRST202'||r.error?.code==='42883')&&data.p_direction==='contribution'){
    const row={id:data.p_id,user_id:uid,goal_id:data.p_goal,direction:data.p_direction,amount:data.p_amount,institution_code:data.p_institution,location_label:data.p_location,occurred_on:data.p_date,source:'self_reported'};
    r=await bounded(sb.from('forma_goal_events').insert(row).select('id,user_id,goal_id,direction,amount,institution_code,location_label,occurred_on').single(),15000);
    if(r.error?.code==='23505')r=await bounded(sb.from('forma_goal_events').select('id,user_id,goal_id,direction,amount,institution_code,location_label,occurred_on').eq('id',data.p_id).eq('user_id',uid).single(),15000);
    if(!r.error&&(!r.data||Object.entries(row).some(([key,value])=>key!=='source'&&(key==='amount'?Number(r.data[key])!==value:r.data[key]!==value))))throw Error('unconfirmed');
   }
   if(r.error){if(r.error.code==='PGRST202'||r.error.code==='42883'){eventPending=null;eventStatus.textContent='El propietario necesita activar la protección de retiros.';toast('Los retiros requieren activar la protección de metas. No se guardó el retiro.',false);return;}if(r.error.code==='23514'||r.error.code==='22023'){eventPending=null;toast('Revisa el monto: el retiro no puede superar lo ahorrado.',false);return;}throw r.error;}if(r.data?.id!==data.p_id)throw Error('unconfirmed');eventPending=null;eventStatus.textContent='Guardado confirmado.';if(user?.id!==uid)return;$('event-overlay').classList.remove('open');toast('Anotación guardada y confirmada.');await renderGoals();
  }catch{eventStatus.textContent='Guardado sin confirmar. Reintenta con los mismos datos para evitar duplicados.';toast('No se confirmó el guardado. Reintenta con los mismos datos; no se duplicará.',false);}finally{eventBusy=false;}
 };
 if(window.FORMA_DEMO)updateOverview();
 else if('FORMA_PENDING_REFERENCE' in window)showPendingAccess(window.FORMA_PENDING_REFERENCE);
 if(sb)sb.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){eventPending=null;pending.hidden=true;$('auth-screen').classList.remove('access-pending');}});
})();
