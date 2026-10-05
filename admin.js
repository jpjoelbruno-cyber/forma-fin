// Administration reports contain adoption flags only, never financial amounts.
(() => {
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
  dialog.innerHTML='<div class="admin-heading"><div><span class="eyebrow">FORMÁ EDUCACIONAL</span><h2>Administración</h2></div><button aria-label="Cerrar administración" data-close>×</button></div><div class="admin-tabs"><button data-tab="usage" aria-pressed="true">Uso y evolución</button><button data-tab="support" aria-pressed="false">Ayuda</button><button data-tab="billing" aria-pressed="false">Cobros · Próximamente</button></div><div id="admin-usage"><div class="admin-controls"><label>Periodo <select id="admin-days"><option value="7">7 días</option><option value="30" selected>30 días</option><option value="90">90 días</option></select></label><button id="admin-refresh">Actualizar</button></div><p id="admin-status" role="status"></p><div id="admin-report"></div></div><div id="admin-support" hidden><h3>WhatsApp de ayuda</h3><p>Los alumnos abren una conversación contigo. No se envían mensajes automáticamente ni se añaden datos financieros.</p><label>Número con código de país<input id="admin-phone" inputmode="tel" maxlength="24" placeholder="Ejemplo: +55 11 99999-9999"></label><button id="admin-save-phone" class="action-main">Guardar número</button><p id="admin-phone-status" role="status"></p></div><div id="admin-billing" hidden><h3>Cobros: siguiente etapa</h3><p>Esta versión no realiza cobros ni solicita tarjetas.</p><p>El próximo módulo podrá reunir planes, becas para alumnos, periodos de prueba, pagos pendientes, comprobantes e historial de suscripción.</p><p>Antes de activarlo definiremos precios, proveedor de pagos y reglas de cancelación.</p></div>';
  document.body.append(dialog);
  [dialog,help].forEach(el=>{el.querySelector('[data-close]').onclick=()=>el.close();el.addEventListener('click',e=>{if(e.target===el)el.close()});});
  const adminButton=document.getElementById('forma-admin-button');
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
    const rev=++generation;admin=false;report=null;entryReady=false;clearTimeout(sectionTimer);adminButton.hidden=true;phone='';
    if(demo()||!user||!sb)return;
    const id=user.id;
    const r=await sb.from('forma_admin_members').select('user_id').eq('user_id',id).maybeSingle();
    if(rev!==generation||user?.id!==id||demo())return;
    admin=!r.error&&Boolean(r.data);adminButton.hidden=!admin;adminButton.textContent='Administración';
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
    document.getElementById('admin-report').innerHTML=`<div class="admin-metrics">${[['Entraron a FORMÁ · Verificados',r.verified_entries],['Con datos guardados · Entrada antigua no comprobada',r.historical_only],['Activos con entrada verificada en el periodo',r.active]].map(([name,n])=>`<article><strong>${Number(n)}</strong><span>${name}</span></article>`).join('')}</div><p class="evidence-note">Solo evidencia de FORMÁ. Los perfiles automáticos vacíos quedan fuera. ${Number(r.staff_excluded)} cuenta(s) de administración excluida(s) de las cifras de alumnos. Una cuenta autenticada no acredita matrícula ni una persona única.</p><section class="admin-thermo"><span class="eyebrow">EVOLUCIÓN DEL USO</span><h3>${pct}% combina presupuesto y movimientos</h3><div class="admin-meter" role="progressbar" aria-label="Adopción con datos guardados" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div><p class="muted-note">${Number(r.activated)} de ${Number(r.total)} cuentas con evidencia de FORMÁ. Incluye datos guardados anteriores a la medición de entradas. Presupuesto de ${esc(r.budget_month)}; movimientos en el periodo elegido.</p></section><div class="evidence-charts"><section><h3>¿Qué secciones consultan más?</h3><p class="muted-note">Usuarios distintos con entrada autenticada y consulta de al menos 5 segundos. Es una medición de consulta, no de una acción guardada.</p>${r.sections.length?bars(r.sections.map(s=>[labels[s.section]||s.section,s.users]),Math.max(...r.sections.map(s=>s.users)),'#5A3BCC'):'<p class="evidence-empty">Todavía no hay consultas verificadas de alumnos en el periodo. No se estiman visitas antiguas.</p>'}</section><section><h3>¿Qué acciones tienen guardadas?</h3><p class="muted-note">Usuarios distintos con registros existentes en el servidor. No depende de clics.</p>${bars([['Presupuesto',r.budget],['Movimientos',r.movements],['Metas',r.goals],['Lecciones',r.learning]],r.total,'#13866B')}</section></div><h3>Entradas verificadas por día</h3>${r.daily.length?bars(r.daily.map(d=>[d.day,d.users]),Math.max(...r.daily.map(d=>d.users)),'#FF6B00'):'<p class="evidence-empty">Sin entradas verificadas de alumnos en el periodo. Las fechas antiguas no se reconstruyen.</p>'}<h3>Cuentas con evidencia de FORMÁ</h3><label>Buscar por nombre<input id="admin-search" placeholder="Nombre del usuario" maxlength="100"></label><p class="muted-note">Cada fila indica su evidencia. Los montos, descripciones y bancos siguen privados.</p><div class="admin-table-wrap"><table><thead><tr><th>Usuario</th><th>Cómo se validó</th><th>Primera entrada verificada</th><th>Última entrada verificada</th><th>Presupuesto</th><th>Movimientos</th><th>Metas</th><th>Aprender</th></tr></thead><tbody id="admin-roster"></tbody></table></div><p id="admin-roster-count" class="muted-note"></p>`;
    document.getElementById('admin-search').oninput=paintRoster;paintRoster();
  }
  function paintRoster(){
    const q=document.getElementById('admin-search').value.toLocaleLowerCase(),all=report.users.filter(u=>(u.name||'').toLocaleLowerCase().includes(q)),rows=all.slice(0,300);
    const date=v=>v?esc(stamp(v)):'No comprobada';
    document.getElementById('admin-roster').innerHTML=rows.map(u=>`<tr><td>${esc(u.name||'Sin nombre')}</td><td>${u.entry_verified?'Sesión autenticada · Servidor':'Datos guardados · Sin prueba de entrada antigua'}</td><td>${date(u.first_entry)}</td><td>${date(u.last_seen)}</td>${['budget','movements','goals','learning'].map(k=>`<td>${u[k]?'Sí':'Aún no'}</td>`).join('')}</tr>`).join('');
    document.getElementById('admin-roster-count').textContent=`${rows.length} de ${all.length} cuentas con evidencia en esta búsqueda`;
  }
  function selectTab(name){dialog.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===name)));['usage','support','billing'].forEach(t=>document.getElementById('admin-'+t).hidden=t!==name);}
  dialog.querySelectorAll('[data-tab]').forEach(b=>b.onclick=async()=>{selectTab(b.dataset.tab);if(b.dataset.tab==='support'){await loadSupport();document.getElementById('admin-phone').value=phone;}});
  adminButton.onclick=()=>{dialog.showModal();selectTab('usage');refresh();};
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
  const originalDemo=startDemo;startDemo=function(...args){const result=originalDemo(...args);++generation;admin=false;adminButton.hidden=true;adminButton.textContent='Administración';return result;};
  if(sb)sb.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){++generation;admin=false;report=null;phone='';entryReady=false;clearTimeout(sectionTimer);adminButton.hidden=true;dialog.close();help.close();document.getElementById('admin-report').innerHTML='';}});
  if(user&&!demo())init();
})();
