// Administration reports contain adoption flags only, never financial amounts.
(() => {
  let admin=false, report=null, phone='', pending=false, generation=0;
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
  help.innerHTML='<div class="admin-heading"><h2>¿Necesitas ayuda?</h2><button aria-label="Cerrar ayuda" data-close>×</button></div><p>Te acompañamos a organizar tu presupuesto, registrar movimientos y crear metas.</p><a id="forma-whatsapp" class="support-whatsapp" hidden target="_blank" rel="noopener noreferrer">Hablar por WhatsApp</a><p id="forma-support-status" role="status">Cargando el canal de ayuda…</p><details><summary>No veo mis datos</summary><p>Comprueba que entraste con la misma cuenta. Los datos de ejemplo no son tu presupuesto.</p></details><details><summary>¿Cómo sé si se guardó el presupuesto?</summary><p>Espera el mensaje «Guardado». Si aparece un error, mantén la pantalla abierta y vuelve a intentar antes de salir.</p></details><details><summary>¿El aplicativo mueve mi dinero?</summary><p>Los movimientos y cofrinhos son anotaciones personales. Las conexiones bancarias siguen desactivadas.</p></details><hr><p class="muted-note">Medimos qué secciones se usan y cuándo, sin incluir montos ni descripciones. Esto ayuda a mejorar FORMÁ.</p><label class="usage-choice"><input id="forma-usage-choice" type="checkbox"> Permitir medición de las secciones que utilizo</label><p class="muted-note">El panel educativo también indica si creaste presupuesto, movimientos, metas o completaste una lección; no muestra sus valores.</p>';
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
    const rev=++generation;admin=false;report=null;adminButton.hidden=true;phone='';
    if(demo()||!user||!sb)return;
    const id=user.id;
    const r=await sb.from('forma_admin_members').select('user_id').eq('user_id',id).maybeSingle();
    if(rev!==generation||user?.id!==id||demo())return;
    admin=!r.error&&Boolean(r.data);adminButton.hidden=!admin;adminButton.textContent='Administración';
    track('resumo');
  }
  async function track(section){
    if(demo()||!user||!sb||!enabled()||!labels[section])return;
    // Server timestamps and UTC day align with database CURRENT_DATE.
    const now=new Date();
    const r=await sb.from('forma_usage_daily').upsert({user_id:user.id,day:now.toISOString().slice(0,10),section,seen_at:now.toISOString()},{onConflict:'user_id,day,section'});
    if(r.error)console.warn('FORMÁ usage measurement unavailable');
  }
  function fakeReport(){return {total:20,active:14,budget:12,movements:10,goals:8,learning:6,activated:9,budget_month:todayMonth(),sections:[{section:'resumo',users:14},{section:'registrar',users:10},{section:'metas',users:8},{section:'aprender',users:6}],users:[{id:'example-1',name:'Alumno de ejemplo',joined:new Date().toISOString(),last_seen:new Date().toISOString(),budget:true,movements:true,goals:true,learning:false}]};}
  async function refresh(){
    if(pending)return;
    const status=document.getElementById('admin-status'),box=document.getElementById('admin-report');
    if(!admin||demo()){status.textContent='Esta cuenta no tiene acceso administrativo.';box.innerHTML='';return;}
    pending=true;document.getElementById('admin-refresh').disabled=true;box.innerHTML='';status.textContent='Cargando indicadores…';
    const rev=generation,id=user?.id;
    try {
      if(demo())report=fakeReport();
      else {const r=await sb.rpc('forma_admin_report',{p_days:Number(document.getElementById('admin-days').value)});if(r.error)throw r.error;if(rev!==generation||user?.id!==id)return;report=r.data;}
      status.textContent=demo()?'DEMOSTRACIÓN ADMINISTRATIVA · Datos ficticios':'Datos actualizados · '+new Date().toLocaleTimeString('es-BR')+' · Medición de accesos desde el 5/10/2026';
      renderReport();
    } catch(e){report=null;status.textContent='No pudimos cargar el panel. Revisa tu acceso y pulsa Actualizar.';}
    finally {pending=false;document.getElementById('admin-refresh').disabled=false;}
  }
  function renderReport(){
    const r=report,pct=percentage(r.activated,r.total);
    document.getElementById('admin-report').innerHTML=`<div class="admin-metrics">${[['Usuarios registrados',r.total],['Activos en el periodo',r.active],['Presupuesto preparado',r.budget],['Con movimientos',r.movements],['Con metas',r.goals],['Con lecciones completadas',r.learning]].map(([name,n])=>`<article><strong>${Number(n)}</strong><span>${name}</span></article>`).join('')}</div><section class="admin-thermo"><div><span class="eyebrow">TERMÓMETRO DE ADOPCIÓN</span><h3>${pct}% ya combina presupuesto y registro</h3><p>${Number(r.activated)} de ${Number(r.total)} usuarios.</p></div><div class="admin-meter" role="progressbar" aria-label="Adopción del aplicativo" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div><p class="muted-note">Presupuesto de ${esc(r.budget_month)} con entradas y gastos previstos; al menos un movimiento en el periodo elegido. No mide la salud financiera.</p></section><h3>Qué secciones se usan</h3><p class="muted-note">Usuarios distintos por sección en el periodo. Los accesos anteriores al inicio de la medición no están disponibles.</p><div class="admin-sections">${r.sections.length?r.sections.map(s=>`<div><span>${labels[s.section]||esc(s.section)}</span><meter min="0" max="${Math.max(1,r.total)}" value="${Number(s.users)}">${Number(s.users)}</meter><strong>${Number(s.users)}</strong></div>`).join(''):'<p>Aún no hay accesos medidos.</p>'}</div><h3>Acompañamiento de alumnos</h3><label>Buscar por nombre<input id="admin-search" placeholder="Nombre del alumno" maxlength="100"></label><p class="muted-note">Solo indicadores de avance. Sin montos, saldos, cuentas bancarias ni descripción de gastos.</p><div class="admin-table-wrap"><table><thead><tr><th>Alumno</th><th>Último acceso medido</th><th>Presupuesto</th><th>Movimientos</th><th>Metas</th><th>Aprender</th></tr></thead><tbody id="admin-roster"></tbody></table></div><p id="admin-roster-count" class="muted-note"></p>`;
    document.getElementById('admin-search').oninput=paintRoster;paintRoster();
  }
  function paintRoster(){
    const q=document.getElementById('admin-search').value.toLocaleLowerCase(),all=report.users.filter(u=>(u.name||'').toLocaleLowerCase().includes(q)),rows=all.slice(0,300);
    document.getElementById('admin-roster').innerHTML=rows.map(u=>`<tr><td>${esc(u.name||'Sin nombre')}</td><td>${esc(stamp(u.last_seen))}</td>${['budget','movements','goals','learning'].map(k=>`<td>${u[k]?'Sí':'Aún no'}</td>`).join('')}</tr>`).join('');
    document.getElementById('admin-roster-count').textContent=`${rows.length} de ${all.length} usuarios en esta búsqueda`;
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
  const originalShow=showApp;showApp=function(...args){const result=originalShow(...args);init();return result;};
  const originalPanel=goPanel;goPanel=function(id){const result=originalPanel(id);track(id);return result;};
  const originalDemo=startDemo;startDemo=function(...args){const result=originalDemo(...args);++generation;admin=false;adminButton.hidden=true;adminButton.textContent='Administración';return result;};
  if(sb)sb.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){++generation;admin=false;report=null;phone='';adminButton.hidden=true;dialog.close();help.close();document.getElementById('admin-report').innerHTML='';}});
  if(user&&!demo())init();
})();
