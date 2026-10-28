/* FORMÁ · selector de espacios. Solo presentación: muestra los espacios que el SERVIDOR confirma para esta cuenta.
   No da ni quita permisos: cada acción sigue validándose en el servidor (owner / manager / instructor).
   Sin sesión o ante cualquier error, no muestra nada y la página funciona como siempre. */
(function(){'use strict';
var SP=[{k:'alumno',t:'Alumno',d:'Mi presupuesto y cursos',u:'/',need:null},{k:'gestion',t:'Gestión',d:'Agenda, cobros, alumnos, ventas',u:'/agenda.html#inicio',need:['owner','manager','instructor']},{k:'admin',t:'Administración',d:'Personas, accesos y cursos online',u:'/agenda.html#admin',need:['owner']}];
function here(){var p=location.pathname;if(/agenda|gestion|administracion/.test(p))return(/administracion/.test(p)||location.hash==='#admin')?'admin':'gestion';return 'alumno'}
function token(){try{var s=JSON.parse(localStorage.getItem('forma-independent-auth-v1')||'null');return s&&s.access_token||null}catch(e){return null}}
function role(){var cfg=window.FORMA_CONFIG,t=token();if(!cfg||!t)return Promise.resolve(null);
  var c=new AbortController(),to=setTimeout(function(){c.abort()},8000);
  return fetch(cfg.supabaseUrl+'/rest/v1/rpc/forma_agenda_access',{method:'POST',headers:{apikey:cfg.publishableKey,Authorization:'Bearer '+t,'Content-Type':'application/json'},body:'{}',signal:c.signal}).then(function(r){clearTimeout(to);return r.ok?r.json():null}).then(function(d){return d&&d.role||null}).catch(function(){clearTimeout(to);return null})}
function mount(host,list){
  if(!host||document.getElementById('fs-sw'))return;
  var cur=here(),now=list.filter(function(s){return s.k===cur})[0]||list[0];
  var w=document.createElement('div');w.id='fs-sw';w.className='on';
  w.innerHTML='<button type="button" aria-haspopup="true" aria-expanded="false" aria-label="Cambiar de espacio"><span class="fs-t">'+now.t+'</span><span class="fs-c">▼</span></button><div id="fs-menu" role="menu" hidden>'+list.map(function(s){return '<a role="menuitem" href="'+s.u+'"'+(s.k===cur?' aria-current="true"':'')+'><span>'+s.t+'<br><small>'+s.d+'</small></span>'+(s.k===cur?'<span>✓</span>':'')+'</a>'}).join('')+'</div>';
  var sm=host.querySelector('small');if(sm)sm.hidden=true;
  host.parentNode.insertBefore(w,host.nextSibling);
  var b=w.querySelector('button'),m=w.querySelector('#fs-menu');
  function close(){m.hidden=true;b.setAttribute('aria-expanded','false')}
  function sync(){var c=here(),n=list.filter(function(s){return s.k===c})[0]||list[0];w.querySelector('.fs-t').textContent=n.t;w.querySelectorAll('a').forEach(function(a,i){if(list[i].k===c)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current');var ck=a.lastElementChild;if(a.children.length>1)a.removeChild(ck);if(list[i].k===c)a.insertAdjacentHTML('beforeend','<span>✓</span>')});close()}
  window.addEventListener('hashchange',sync);
  b.addEventListener('click',function(e){e.stopPropagation();var o=m.hidden;m.hidden=!o;b.setAttribute('aria-expanded',String(o))});
  document.addEventListener('click',function(e){if(!w.contains(e.target))close()});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')close()});
}
function hostEl(){return document.querySelector('.top-in .brand')||document.querySelector('#av-nav .av-brand')}
function start(){
  if(/[?&](vista=ejemplo|demo)/.test(location.search))return;
  role().then(function(r){
    if(!r)return;
    var list=SP.filter(function(s){return !s.need||s.need.indexOf(r)>=0});
    if(list.length<2)return;
    var tries=0;(function wait(){var h=hostEl();if(h)mount(h,list);else if(++tries<40)setTimeout(wait,250)})();
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
