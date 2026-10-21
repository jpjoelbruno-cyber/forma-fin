/* Installation is shared by personal FORMA and Gestão; roles remain server-authorized. */
(()=>{'use strict';
 let permission=null,installing=false,installed=false;
 const standalone=()=>installed||window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true;
 const dialog=document.createElement('dialog');dialog.id='forma-install-dialog';dialog.setAttribute('aria-labelledby','forma-install-title');
 dialog.innerHTML='<div class="forma-install-heading"><img src="/icons/forma-192.png" width="52" height="52" alt="Sello FORMA"><div><h2 id="forma-install-title">Instalar FORMA</h2><p>Un acceso directo a tu app.</p></div><button type="button" data-install-close aria-label="Cerrar instrucciones">×</button></div><p>La app instalada usa tu misma cuenta y los mismos datos. Los permisos de alumnos, instructores y administración se mantienen.</p><button type="button" id="forma-install-now" hidden>Instalar ahora</button><div id="forma-install-guide"></div><p class="forma-install-note">Necesitas internet para consultar y guardar datos. La instalación no activa bancos ni notificaciones, y no requiere un APK.</p><p id="forma-install-status" role="status" aria-live="polite"></p>';
 document.body.append(dialog);
 const buttons=[];
 for(const target of [document.querySelector('.auth-footer'),document.querySelector('.tb-inner'),document.querySelector('body > header nav')]){
  if(!target)continue;const button=document.createElement('button');button.type='button';button.className='forma-install-button';button.setAttribute('aria-label','Instalar FORMA');button.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4"/></svg><span class="forma-install-label">Instalar</span>';button.onclick=open;
  if(target.classList.contains('auth-footer'))target.before(button);else target.append(button);buttons.push(button);
 }
 const guide=document.getElementById('forma-install-guide'),status=document.getElementById('forma-install-status'),action=document.getElementById('forma-install-now');
 const ios=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 function paint(){
  const active=standalone();buttons.forEach(b=>b.hidden=Boolean(active));action.hidden=Boolean(active)||!permission;action.disabled=installing;
  if(active){guide.innerHTML='<p>FORMA ya se está usando como aplicación instalada.</p>';return;}
  if(ios())guide.innerHTML='<h3>En iPhone o iPad</h3><ol><li>Abre <strong>forma-fin.vercel.app</strong> en Safari.</li><li>Pulsa <strong>Compartir</strong> y luego <strong>Añadir a pantalla de inicio / Adicionar à Tela de Início</strong>.</li><li>Si aparece, activa <strong>Abrir como app</strong> y pulsa <strong>Añadir / Adicionar</strong>.</li></ol>';
  else if(/Android/.test(navigator.userAgent))guide.innerHTML='<h3>En Android</h3><p>Pulsa <strong>Instalar ahora</strong> cuando aparezca. También puedes abrir el menú ⋮ de Chrome y elegir <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>.</p><p>Si abriste el enlace dentro de WhatsApp o Instagram, ábrelo primero en Chrome.</p>';
  else guide.innerHTML='<h3>En computadora</h3><p>Pulsa <strong>Instalar ahora</strong> cuando aparezca, o utiliza el icono de instalación junto a la dirección en Chrome o Edge. En Safari para Mac, usa <strong>Archivo → Añadir al Dock</strong> si está disponible.</p><p>Si tu navegador no ofrece instalación, abre FORMA en Chrome, Edge o Safari compatible.</p>';
 }
 function open(){paint();status.textContent='';if(typeof dialog.showModal==='function'){if(!dialog.open)dialog.showModal();}else dialog.setAttribute('open','');}
 function close(){if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');}
 dialog.querySelector('[data-install-close]').onclick=close;dialog.addEventListener('click',e=>{if(e.target===dialog)close();});
 action.onclick=async()=>{
  if(!permission||installing||standalone())return;const prompt=permission;permission=null;installing=true;action.disabled=true;
  try{await prompt.prompt();const choice=await prompt.userChoice;if(!installed)status.textContent=choice.outcome==='accepted'?'Solicitud aceptada. Tu navegador completará la instalación.':'Puedes instalar FORMA más tarde desde este botón.';}
  catch{status.textContent='No se pudo abrir el instalador. Usa las instrucciones de tu navegador.';}
  finally{installing=false;paint();}
 };
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();permission=event;paint();});
 window.addEventListener('appinstalled',()=>{installed=true;permission=null;status.textContent='FORMA se instaló correctamente. Ya puedes abrirla desde su icono.';paint();});
 window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change',paint);
 window.FormaInstall={open,close};paint();
 // No financial data, authenticated responses, scripts or app pages enter Cache Storage.
 // Never force reload: an update must not discard an in-progress form.
 if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(()=>{});
})();
