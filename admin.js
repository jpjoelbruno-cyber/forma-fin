// Administration reports contain adoption flags only, never financial amounts.
(() => {
  let accessReport=null,accessPending=false;
  let admin=false, report=null, phone='', pending=false, generation=0, entryReady=false, entryPending=null, sectionTimer=null;
  const labels={resumo:'Inicio',registrar:'Registrar',historico:'Historial',metas:'Metas',aprender:'Aprender',anual:'Año'};
  const demo=()=>Boolean(window.FORMA_DEMO);
  const esc=value=>escapeHTML(String(value??''));
  const percentage=(a,b)=>b?Math.round(a/b*100):0;
  const stamp=value=>value?new Date(value).toLocaleString('es-BR',{dateStyle:'short',timeStyle:'short'}):'Sin acceso medido';
  const key=()=> 'forma_usage_optout_'+user?.id;
  const enabled=()=>localStorage.getItem(key())!=='1';
  const toolbar=document.createElement('div');toolbar.className='forma-tools';
  toolbar.innerHTML='<button id="forma-help-button">Ayuda</button><button id="forma-admin-button" hidden>Administración</button>';
  document.querySelector('#app-screen .topbar').after(toolbar);
  const help=document.createElement('dialog');help.className='forma-dialog';
  help.innerHTML='<div class="admin-heading"><h2>¿Necesitas ayuda?</h2><button aria-label="Cerrar ayuda" data-close>×</button></div><p>Te acompañamos a organizar tu presupuesto, registrar movimientos y crear metas.</p><a id="forma-whatsapp" class="support-whatsapp" hidden target="_blank" rel="noopener noreferrer">Hablar por WhatsApp</a><p id="forma-support-status" role="status">Cargando el canal de ayuda…</p><details><summary>No veo mis datos</summary><p>Comprueba que entraste con la misma cuenta. Los datos de ejemplo no son tu presupuesto.</p></details><details><summary>¿Cómo sé si se guardó el presupuesto?</summary><p>Espera el mensaje «Guardado». Si aparece un error, mantén la pantalla abierta y vuelve a intentar antes de salir.</p></details><details><summary>¿El aplicativo mueve mi dinero?</summary><p>Los movimientos y cofrinhos son anotaciones personales. Las conexiones bancarias siguen desactivadas.</p></details><hr><p class="muted-note">Confirmamos la entrada autenticada a FORMÁ en el servidor. Opcionalmente medimos qué secciones se consultan, sin montos ni descripciones. Esto ayuda a mejorar FORMÁ.</p><label class="usage-choice"><input id="forma-usage-choice" type="checkbox"> Permitir medición de las secciones que utilizo</label><p class="muted-note">El panel educativo también indica si creaste presupuesto, movimientos, metas o completaste una lección; no muestra sus valores.</p>';
  document.body.append(help);
  const dialog=document.createElement('dialog');dialog.className='forma-dialog admin-dialog';
  dialog.innerHTML='<div class="admin-heading"><div><span class="eyebrow">FORMÁ EDUCACIONAL</span><h2>Administración</h2></div><button aria-label="Cerrar administración" data-close>×</button></div><div class="admin-tabs"><button data-tab="usage" aria-pressed="true">Uso y evolución</button><button data-tab="access" aria-pressed="false">Accesos</button><button data-tab="support" aria-pressed="false">Ayuda</button><button data-tab="billing" aria-pressed="false">Cobros · Próximamente</button></div><div id="admin-usage"><div class="admin-controls"><label>Periodo <select id="admin-days"><option value="7">7 días</option><option value="30" selected>30 días</option><option value="90">90 días</option></select></label><button id="admin-refresh">Actualizar</button></div><p id="admin-status" role="status"></p><div id="admin-report"></div></div><div id="admin-access" hidden><h3>Acceso de alumnos a FORMÁ</h3><p>Los perfiles sin evidencia quedaron pendientes. Conservamos sus datos; este control solo afecta a FORMÁ. Valida una cuenta únicamente si reconoces al alumno y su referencia.</p><button id="admin-access-refresh">Actualizar accesos</button><p id="admin-access-status" role="status"></p><label>Buscar nombre o referencia<input id="admin-access-search" maxlength="120" placeholder="Nombre o referencia del alumno"></label><div id="admin-access-list"></div></div><div id="admin-support" hidden><h3>WhatsApp de ayuda</h3><p>Los alumnos abren una conversación contigo. No se envían mensajes automáticamente ni se añaden datos financieros.</p><label>Número con código de país<input id="admin-phone" inputmode="tel" maxlength="24" placeholder="Ejemplo: +55 11 99999-9999"></label><button id="admin-save-phone" class="action-main">Guardar número</button><p id="admin-phone-status" role="status"></p></div><div id="admin-billing" hidden><h3>Cobros: siguiente etapa</h3><p>Esta versión no realiza cobros ni solicita tarjetas.</p><p>El próximo módulo podrá reunir planes, becas para alumnos, periodos de prueba, pagos pendientes, comprobantes e historial de suscripción.</p><p>Antes de activarlo definiremos precios, proveedor de pagos y reglas de cancelación.</p></div>';
  document.body.append(dialog);
  [dialog,help].forEach(el=>{el.querySelector('[data-close]').onclick=()=>el.close();el.addEventListener('click',e=>{if(e.target===el)el.close()});});
  const adminButton=document.getElementById('forma-admin-button');
  function paintAdminButton(){adminButton.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 20V10m8 10V4m8 16v-7"/></svg><span>Mi administración<small>Uso y evolución de FORMÁ</small></span>';adminButton.setAttribute('aria-label','Abrir mi administración de FORMÁ');}
  paintAdminButton();
  document.getElementById('forma-help-button').onclick=async()=>{document.getElementById('forma-usage-choice').checked=enabled();help.showModal();await loadSupport();};
  document.getElementById('forma-usage-choice').onchange=e=>{localStorage.setItem(key(),e.target.checked?'0':'1');if(e.target.checked)track('resumo');};
  function paintSupport(){
    const link=document.getElementById('forma-whatsapp'),status=document.getElementById('forma-support-status');
    link.hidden=!phone||demo();
    if(phone&&!demo()){link.href='https://wa.me/'+phone+'?text='+encodeURIComponent('Hola, necesito ayuda con FORMÁ Financiero.');status.textContent='Se abrirá WhatsApp. Tú eliges qué información compartir.';}
    else status.textContent=demo()?'Vista de ejemplo. La ayuda de tu cuenta aparecerá al entrar.':'El número de atención está pendiente de configuración. Puedes consultar la ayuda de abajo.';
  }
  async function loadSupport(){
    if(demo()||!user||!sb){phone='';paintSupport();return;}
    const current=user.id;
    const r=await sb.from('forma_support_settings').select('whatsapp').eq('id',true).single();
    if(user?.id!==current||demo())return;
    if(r.error){phone='';paintSupport();document.getElementById('forma-support-status').textContent='No pudimos cargar el canal. Vuelve a abrir Ayuda.';return;}
    phone=r.data.whatsapp;paintSupport();
  }
  async function init(){
    const rev=++generation;admin=false;report=null;accessReport=null;entryReady=false;clearTimeout(sectionTimer);adminButton.hidden=true;phone='';dialog.close();document.getElementById('admin-report').innerHTML='';document.getElementById('admin-access-list').innerHTML='';
    if(demo()||!user||!sb)return;
    const id=user.id;
    const r=await sb.from('forma_admin_members').select('user_id').eq('user_id',id).maybeSingle();
    if(rev!==generation||user?.id!==id||demo())return;
    admin=!r.error&&Boolean(r.data);adminButton.hidden=!admin;paintAdminButton();
    if(budgetDataReady)await verifyEntry();
  }
  async function verifyEntry(){
    if(demo()||!user||!sb||!budgetDataReady)return false;
    if(entryPending)return entryPending;
    const id=user.id,rev=generation;
    entryPending=(async()=>{
      try{const r=await sb.rpc('forma_record_access',{p_section:'entry'});
        if(rev!==generation||user?.id!==id||demo())return false;
        entryReady=!r.error&&r.data?.verified===true;
        if(entryReady)track(document.querySelector('.panel.active')?.id.replace('p-','')||'resumo');
        return entryReady;
      }catch(e){entryReady=false;return false;}
    })();
    try{return await entryPending;}finally{entryPending=null;}
  }
  function track(section){
    clearTimeout(sectionTimer);
    if(demo()||!user||!sb||!enabled()||!entryReady||!labels[section])return;
    const id=user.id,rev=generation;
    sectionTimer=setTimeout(async()=>{
      if(rev!==generation||user?.id!==id||demo()||!enabled()||document.visibilityState!=='visible'||document.querySelector('.panel.active')?.id!=='p-'+section)return;
      const r=await sb.rpc('forma_record_access',{p_section:section});
      if(r.error)console.warn('FORMÁ section measurement unavailable');
    },5000);
  }
  async function refresh(){
    if(pending)return;
    const status=document.getElementById('admin-status'),box=document.getElementById('admin-report');
    if(!admin||demo()){status.textContent='Esta cuenta no tiene acceso administrativo.';box.innerHTML='';return;}
    pending=true;document.getElementById('admin-refresh').disabled=true;box.innerHTML='';status.textContent='Cargando indicadores…';
    const rev=generation,id=user?.id;
    try {
      {const r=await sb.rpc('forma_admin_report',{p_days:Number(document.getElementById('admin-days').value)});if(r.error)throw r.error;if(rev!==generation||user?.id!==id)return;report=r.data;}
      status.textContent='Datos confirmados por el servidor · '+new Date().toLocaleTimeString('es-BR')+' · Entradas verificadas desde el 5/10/2026';
      renderReport();
    } catch(e){report=null;status.textContent='No pudimos cargar el panel. Revisa tu acceso y pulsa Actualizar.';}
    finally {pending=false;document.getElementById('admin-refresh').disabled=false;}
  }
  function bars(rows,max,color){return rows.map(([label,value])=>`<div class="evidence-bar"><span>${esc(label)}</span><div class="evidence-track"><i style="width:${percentage(value,Math.max(1,max))}%;background:${color}"></i></div><strong>${Number(value)}</strong></div>`).join('');}
  function renderReport(){
    const r=report,pct=percentage(r.activated,r.total);
    document.getElementById('admin-report').innerHTML=`<div class="admin-metrics">${[['Entraron a FORMÁ · Verificados',r.verified_entries],['Con datos guardados · Entrada antigua no comprobada',r.historical_only],['Activos con entrada verificada en el periodo',r.active]].map(([name,n])=>`<article><strong>${Number(n)}</strong><span>${name}</span></article>`).join('')}</div><p class="evidence-note">Solo evidencia de FORMÁ. Los perfiles automáticos vacíos quedan fuera. ${Number(r.staff_excluded)} cuenta(s) de administración excluida(s) de las cifras de alumnos. Una cuenta autenticada no acredita matrícula ni una persona única.</p><section class="admin-thermo"><span class="eyebrow">EVOLUCIÓN DEL USO</span><h3>${pct}% combina presupuesto y movimientos</h3><div class="admin-meter" role="progressbar" aria-label="Adopción con datos guardados" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div><p class="muted-note">${Number(r.activated)} de ${Number(r.total)} cuentas con evidencia de FORMÁ. Incluye datos guardados anteriores a la medición de entradas. Presupuesto de ${esc(r.budget_month)}; movimientos en el periodo elegido.</p></section><div class="evidence-charts"><section><h3>¿Qué secciones consultan más?</h3><p class="muted-note">Usuarios distintos con entrada autenticada y consulta de al menos 5 segundos. Es una medición de consulta, no de una acción guardada.</p>${r.sections.length?bars(r.sections.map(s=>[labels[s.section]||s.section,s.users]),Math.max(...r.sections.map(s=>s.users)),'#5A3BCC'):'<p class="evidence-empty">Todavía no hay consultas verificadas de alumnos en el periodo. No se estiman visitas antiguas.</p>'}</section><section><h3>¿Qué acciones tienen guardadas?</h3><p class="muted-note">Usuarios distintos con registros existentes en el servidor. No depende de clics.</p>${bars([['Presupuesto',r.budget],['Movimientos',r.movements],['Metas',r.goals],['Lecciones',r.learning]],r.total,'#13866B')}</section></div><h3>Entradas verificadas por día</h3>${r.daily.length?bars(r.daily.map(d=>[d.day,d.users]),Math.max(...r.daily.map(d=>d.users)),'#FF6B00'):'<p class="evidence-empty">Sin entradas verificadas de alumnos en el periodo. Las fechas antiguas no se reconstruyen.</p>'}<h3>Cuentas con evidencia de FORMÁ</h3><label>Buscar por nombre<input id="admin-search" placeholder="Nombre del usuario" maxlength="100"></label><p class="muted-note">Cada fila indica su evidencia. Los montos, descripciones y bancos siguen privados.</p><div class="admin-table-wrap"><table><thead><tr><th>Usuario</th><th>Cómo se validó</th><th>Primera entrada verificada</th><th>Última actividad verificada</th><th>En el periodo</th><th>Presupuesto</th><th>Movimientos</th><th>Metas</th><th>Aprender</th></tr></thead><tbody id="admin-roster"></tbody></table></div><p id="admin-roster-count" class="muted-note"></p>`;
    document.getElementById('admin-search').oninput=paintRoster;paintRoster();
  }
  function paintRoster(){
    const q=document.getElementById('admin-search').value.toLocaleLowerCase(),all=report.users.filter(u=>(u.name||'').toLocaleLowerCase().includes(q)),rows=all.slice(0,300);
    const date=v=>v?esc(stamp(v)):'No comprobada';
    document.getElementById('admin-roster').innerHTML=rows.map(u=>`<tr><td>${esc(u.name||'Sin nombre')}</td><td>${u.entry_verified?'Sesión autenticada · Servidor':'Datos guardados · Sin prueba de entrada antigua'}</td><td>${date(u.first_entry)}</td><td>${date(u.last_seen)}</td><td>${u.active?'Activo':'Sin actividad medida'}</td>${['budget','movements','goals','learning'].map(k=>`<td>${u[k]?'Sí':'Aún no'}</td>`).join('')}</tr>`).join('');
    document.getElementById('admin-roster-count').textContent=`${rows.length} de ${all.length} cuentas con evidencia en esta búsqueda`;
  }
  function selectTab(name){dialog.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===name)));['usage','access','support','billing'].forEach(t=>document.getElementById('admin-'+t).hidden=t!==name);}
  dialog.querySelectorAll('[data-tab]').forEach(b=>b.onclick=async()=>{selectTab(b.dataset.tab);if(b.dataset.tab==='access')await loadAccessReview();if(b.dataset.tab==='support'){await loadSupport();document.getElementById('admin-phone').value=phone;}});
  async function loadAccessReview(){
    if(!admin||!user||!sb||demo()||accessPending)return;
    const uid=user.id,rev=generation,status=document.getElementById('admin-access-status');
    accessPending=true;accessReport=null;document.getElementById('admin-access-list').innerHTML='';status.textContent='Comprobando accesos en el servidor…';
    try{
      const r=await sb.rpc('forma_admin_access_review');
      if(uid!==user?.id||rev!==generation||!admin)return;
      if(r.error||!Array.isArray(r.data?.pending))throw new Error('Access review unavailable');
      accessReport=r.data;status.textContent=`${Number(r.data.active)} cuentas habilitadas de alumnos; ${Number(r.data.pending_count)} pendientes; ${Number(r.data.staff)} de administración. Habilitado no significa matrícula verificada.`;
      const recovery=await sb.rpc('forma_recovery_report');
      if(uid!==user?.id||rev!==generation||!admin)return;
      if(recovery.error)throw recovery.error;
      status.textContent+=` Recuperación anterior: ${Number(recovery.data.restored)} cuentas recuperadas; ${Number(recovery.data.awaiting_google)} esperando su Google; ${Number(recovery.data.manual_review)} requieren verificación asistida. Estas cifras no son nuevas entradas de usuarios.`;
      for(const item of recovery.data.manual_records||[]) status.textContent+=` [${item.name} · ${item.reference}: ${item.reason}]`;
      renderAccessReview();
    }catch(e){if(uid===user?.id&&rev===generation)status.textContent='No pudimos consultar los accesos. No se modificó ninguna cuenta.';}
    finally{accessPending=false;}
  }
  function renderAccessReview(){
    const q=document.getElementById('admin-access-search').value.trim().toLocaleLowerCase();
    const rows=(accessReport?.pending||[]).filter(x=>(x.name||'').toLocaleLowerCase().includes(q)||x.id.toLocaleLowerCase().includes(q)).slice(0,100);
    document.getElementById('admin-access-list').innerHTML=rows.length?'<div class="admin-table-wrap"><table><thead><tr><th>Nombre</th><th>Referencia</th><th>Solicitó acceso</th><th>Validación</th></tr></thead><tbody>'+rows.map(x=>`<tr><td>${esc(x.name||'Sin nombre')}</td><td>${esc(x.id.slice(0,8))}</td><td>${x.requested_at?esc(stamp(x.requested_at)):'Sin solicitud registrada'}</td><td><button data-validate-access="${esc(x.id)}">Validar alumno</button></td></tr>`).join('')+'</tbody></table></div>':'<p>No hay cuentas pendientes en esta búsqueda.</p>';
  }
  document.getElementById('admin-access-refresh').onclick=loadAccessReview;
  document.getElementById('admin-access-search').oninput=renderAccessReview;
  document.getElementById('admin-access-list').addEventListener('click',async event=>{
    const button=event.target.closest('button[data-validate-access]');
    if(!button||!admin||!user||demo()||accessPending)return;
    const target=accessReport?.pending.find(x=>x.id===button.dataset.validateAccess);
    if(!target||!window.confirm(`¿Confirmas que ${target.name||'esta persona'} es alumno de FORMÁ y que su referencia es ${target.id.slice(0,8)}? Esto habilita únicamente su acceso a FORMÁ.`))return;
    const uid=user.id,rev=generation;accessPending=true;button.disabled=true;
    const status=document.getElementById('admin-access-status');status.textContent='Validando acceso…';
    try{
      const r=await sb.rpc('forma_admin_validate_access',{p_user_id:target.id});
      if(uid!==user?.id||rev!==generation||!admin)return;
      if(r.error||r.data?.id!==target.id||r.data?.status!=='active')throw new Error('Validation not confirmed');
      accessPending=false;await loadAccessReview();status.textContent+=' Acceso validado. El alumno puede volver a entrar a FORMÁ.';
    }catch(e){if(uid===user?.id&&rev===generation)status.textContent='No pudimos confirmar la validación. Actualiza la lista antes de reintentar.';}
    finally{accessPending=false;button.disabled=false;}
  });
  adminButton.onclick=()=>{if(!admin||demo())return;dialog.showModal();selectTab('usage');refresh();};
  document.getElementById('admin-refresh').onclick=refresh;
  document.getElementById('admin-days').onchange=refresh;
  document.getElementById('admin-save-phone').onclick=async()=>{
    const status=document.getElementById('admin-phone-status');if(demo()){status.textContent='Ejemplo: no se guardan cambios.';return;}
    if(!admin||!user)return;
    const value=document.getElementById('admin-phone').value.replace(/[\s()+-]/g,'');
    if(!/^[1-9][0-9]{7,14}$/.test(value)){status.textContent='Escribe el número completo con código de país.';return;}
    const button=document.getElementById('admin-save-phone');button.disabled=true;
    try{const r=await sb.from('forma_support_settings').update({whatsapp:value}).eq('id',true).select('whatsapp').single();if(r.error||r.data?.whatsapp!==value)throw new Error('Not saved');phone=r.data.whatsapp;paintSupport();status.textContent='Número guardado. Ya está disponible para los alumnos.';}
    catch(e){status.textContent='No se guardó el número. Intenta de nuevo.';}finally{button.disabled=false;}
  };
  const originalLoad=loadMonthData;loadMonthData=async function(...args){const id=user?.id;const result=await originalLoad(...args);if(user?.id===id&&!demo()&&budgetDataReady)await verifyEntry();return result;};
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')track(document.querySelector('.panel.active')?.id.replace('p-','')||'resumo');else clearTimeout(sectionTimer);});
  const originalShow=showApp;showApp=function(...args){const result=originalShow(...args);init();return result;};
  const originalPanel=goPanel;goPanel=function(id){const result=originalPanel(id);track(id);return result;};
  const originalDemo=startDemo;startDemo=function(...args){const result=originalDemo(...args);++generation;admin=false;adminButton.hidden=true;paintAdminButton();return result;};
  if(sb)sb.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){++generation;admin=false;report=null;accessReport=null;phone='';entryReady=false;clearTimeout(sectionTimer);adminButton.hidden=true;dialog.close();help.close();document.getElementById('admin-report').innerHTML='';document.getElementById('admin-access-list').innerHTML='';}});
  if(user&&!demo())init();
})();
