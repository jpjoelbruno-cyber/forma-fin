/* FORMA Gestión nueva · Embudo de ventas con movimiento.
   Arrastrar (PC) o botones (celular) para llevar a una persona de una etapa a otra, hasta Matriculado.
   "No se concretó" NO borra: la persona queda en Cerrados con su motivo y se puede reabrir.
   Usa las operaciones del servidor ya existentes de forma_crm: interest_move e interest_undo
   (con request_id: reintentar nunca duplica; sin cambios optimistas: la pantalla cambia cuando el servidor confirma). */
(function(){
'use strict';
var X=null;
var STG=[['nuevo','Nuevo'],['conversacion','En conversación'],['seguimiento','Seguimiento'],['preparar_matricula','Preparando matrícula'],['matriculado','Matriculado']];
var NAME={nuevo:'Nuevo',conversacion:'En conversación',seguimiento:'Seguimiento',preparar_matricula:'Preparando matrícula',matriculado:'Matriculado',cerrado:'No se concretó'};
var PLANS=[['sin_definir','Pago por definir'],['presencial','Pagará presencialmente'],['acuerdo','Según acuerdo existente']];
var REASONS=['No respondió','Eligió otro lugar','Sin presupuesto por ahora','Ya no le interesa'];
var TEMPS=[['','Sin evaluar'],['frio','Frío'],['tibio','Tibio'],['caliente','Caliente'],['muy_caliente','Muy caliente']];
var TN={'':'Sin evaluar',frio:'Frío',tibio:'Tibio',caliente:'Caliente',muy_caliente:'Muy caliente'};
var axis='stage';try{axis=localStorage.getItem('forma-ventas-eje')==='temp'?'temp':'stage'}catch(e){}
var st={closed:null,showClosed:false,busy:false,last:null,drag:null,msg:''};
function $(s){return document.querySelector(s)}
function uuid(){return crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16)})}
function stageOf(id){var s=X.data();return ((s&&s.items)||[]).concat(st.closed||[]).filter(function(i){return i.id===id})[0]||null}
function nextOf(stage){for(var i=0;i<STG.length-1;i++)if(STG[i][0]===stage)return STG[i+1][0];return null}
function sub(i){return [i.area,i.next_action,i.due_on?X.dl(i.due_on):''].filter(Boolean).map(X.esc).join(' · ')}

function card(i,closed){
  var e=X.esc,mgr=X.manager(),nx=nextOf(i.stage),a='',tk=axis==='temp'?(i.stage==='matriculado'?'ok':(i.temperature||'none')):i.stage;
  if(mgr){
    if(closed)a='<button type="button" class="btn s sm" data-em="reopen" data-id="'+e(i.id)+'">Reabrir</button>';
    else{
      if(nx)a+='<button type="button" class="btn p sm" data-em="next" data-id="'+e(i.id)+'">'+(nx==='matriculado'?'Matricular':'Avanzar')+' →</button>';
      a+='<button type="button" class="btn s sm" data-em="mv" data-id="'+e(i.id)+'">Mover a…</button>';
      if(i.stage!=='matriculado')a+='<button type="button" class="btn s sm em-no" data-em="no" data-id="'+e(i.id)+'">No se concretó</button>';
    }
  }
  var th='';
  if(!closed&&i.stage!=='matriculado'){th='<div class="vt" role="group" aria-label="Termómetro: '+e(TN[i.temperature||''])+'">'+TEMPS.map(function(t){return '<button type="button" class="vt-b t-'+(t[0]||'none')+((i.temperature||'')===t[0]?' on':'')+'" '+(mgr?'data-em="temp" data-id="'+e(i.id)+'" data-t="'+t[0]+'" ':'disabled ')+'title="'+t[1]+'" aria-label="'+t[1]+'" aria-pressed="'+((i.temperature||'')===t[0])+'"></button>'}).join('')+'<small>'+e(TN[i.temperature||''])+'</small></div>'}
  return '<div class="vc c-'+tk+'" data-iid="'+e(i.id)+'"'+(mgr&&!closed?' draggable="true"':'')+'><b>'+e(i.name)+'</b><span>'+sub(i)+'</span>'+th+(closed&&i.close_reason?'<span class="em-why">Motivo: '+e(i.close_reason)+'</span>':'')+(a?'<div class="va">'+a+'</div>':'')+'</div>';
}
function html(s,head){
  var c=s.counts||{},tot=STG.reduce(function(a,x){return a+Number(c[x[0]]||0)},0),mx=Math.max.apply(null,STG.map(function(x){return Number(c[x[0]]||0)}).concat([1])),it=s.items||[],e=X.esc,mgr=X.manager();
  return head('Ventas','Embudo de ventas: quién espera respuesta y en qué etapa está.',(mgr?'<button class="btn p" data-act="interesado">'+X.plus+'Nuevo interesado</button>':''))+
   '<div id="em-msg" role="status" aria-live="polite">'+msgHtml()+'</div>'+
   topHtml(s,it,tot)+
   (mgr?'<p class="note em-help"><span class="em-pc">Arrastra una tarjeta a otra columna, o usa los botones.</span><span class="em-mob">Usa Avanzar o Mover a… en cada tarjeta.</span> «No se concretó» no borra nada: la persona queda en Cerrados y puedes reabrirla.</p>':'')+
   '<div class="lanes em-lanes'+(axis==='temp'?' em-temp':'')+'">'+lanesHtml(it,c)+'</div>'+
   (it.length>=50?'<p class="note">Se muestran las primeras 50 tarjetas; los contadores incluyen todas.</p>':'')+
   '<section class="card em-closed"><h2>No se concretaron <span class="note">('+Number(c.cerrado||0)+')</span> <button type="button" class="link" data-em="closed">'+(st.showClosed?'Ocultar':'Ver')+'</button></h2>'+(st.showClosed?(st.closed?'<div class="em-closed-grid">'+(st.closed.map(function(i){return card(i,true)}).join('')||'<p class="note" style="margin:0">Nadie en esta lista.</p>')+'</div>':'<p class="skel" role="status">Cargando…</p>'):'<p class="note" style="margin:0">Aquí quedan guardadas las personas que no avanzaron, con su motivo. Nada se elimina.</p>')+'</section>';
}
function topHtml(s,it,tot){
  var c=s.counts||{},tc={};it.forEach(function(i){if(i.stage!=='matriculado'&&i.stage!=='cerrado'){var k=i.temperature||'';tc[k]=(tc[k]||0)+1}});
  var rows=axis==='temp'?TEMPS.map(function(t){return [t[0]||'none',t[1],tc[t[0]]||0]}).concat([['ok','Matriculado',Number(c.matriculado||0)]]):STG.map(function(x){return [x[0],x[1],Number(c[x[0]]||0)]});
  var mx=Math.max.apply(null,rows.map(function(r){return r[2]}).concat([1]));
  return '<section class="card em-th"><div class="em-thh"><h2>Embudo de ventas</h2><div class="seg" role="group" aria-label="Ver por"><button type="button" data-em="axis" data-a="stage" aria-pressed="'+(axis==='stage')+'">Por etapa</button><button type="button" data-em="axis" data-a="temp" aria-pressed="'+(axis==='temp')+'">Termómetro</button></div></div>'+
   '<div class="em-ks">'+rows.map(function(r){return '<div class="em-k c-'+r[0]+'"><b>'+r[2]+'</b><span>'+r[1]+'</span><i style="width:'+Math.round(r[2]/mx*100)+'%"></i></div>'}).join('')+'</div>'+
   '<p style="margin:12px 0 0;color:var(--ink2)">Conversión: <b class="in">'+(tot?Math.round(Number(c.matriculado||0)/tot*100):0)+'%</b> de las personas del tablero ya se matricularon. <span class="note">'+(axis==='temp'?'Del frío al matriculado: marca con los puntos de cada tarjeta qué tan listo está cada cliente.':'Los colores van del gris (nuevo) al verde (matriculado) y se repiten en cada columna.')+'</span></p></section>';
}
function lanesHtml(it,c){
  if(axis==='temp'){
    return TEMPS.map(function(t){var l=it.filter(function(i){return i.stage!=='matriculado'&&(i.temperature||'')===t[0]});return '<div class="lane lt c-'+(t[0]||'none')+'" data-lane="'+t[0]+'" data-axis="temp"><h3>'+t[1]+'<span>'+l.length+'</span></h3>'+(l.map(function(i){return card(i,false)}).join('')||'<span class="note">Sin tarjetas aquí</span>')+'</div>'}).join('')+
     '<div class="lane em-ok c-ok" data-lane="matriculado" data-axis="stage"><h3>Matriculado<span>'+Number(c.matriculado||0)+'</span></h3>'+(it.filter(function(i){return i.stage==='matriculado'}).map(function(i){return card(i,false)}).join('')||'<span class="note">Sin tarjetas aquí</span>')+'</div>';
  }
  return STG.map(function(x){var l=it.filter(function(i){return i.stage===x[0]});return '<div class="lane c-'+x[0]+(x[0]==='matriculado'?' em-ok':'')+'" data-lane="'+x[0]+'" data-axis="stage"><h3>'+x[1]+'<span>'+Number(c[x[0]]||0)+'</span></h3>'+(l.map(function(i){return card(i,false)}).join('')||'<span class="note">Sin tarjetas aquí</span>')+'</div>'}).join('');
}
function msgHtml(){
  if(!st.msg)return '';
  return '<div class="em-bar"><span>'+X.esc(st.msg)+'</span>'+(st.last?'<button type="button" class="btn s sm" data-em="undo">Deshacer</button>':'')+'</div>';
}
function say(m){st.msg=m||'';var b=$('#em-msg');if(b)b.innerHTML=msgHtml()}

/* ---------- movimientos ---------- */
function errText(e){
  var m=(e&&e.message)||'';
  if(e&&e.code==='40001')return 'Esa tarjeta cambió mientras la movías. Se actualizó la lista; vuelve a intentarlo.';
  if(e&&e.code==='42501')return 'No tienes permiso para mover personas.';
  if(/timeout/i.test(m))return 'No se confirmó a tiempo. No se cambió nada confirmado; revisa y reintenta.';
  if(m&&m.length<200&&!/^(fetch|Failed|Network)/i.test(m))return m;
  return 'No se pudo guardar. No se cambió nada.';
}
function apply(i,r,stage,reason){
  var s=X.data(),c=s.counts||(s.counts={}),from=i.stage;
  var upd={stage:r.stage||stage,version:r.version||(Number(i.version||1)+1)};
  if(stage==='cerrado')upd.close_reason=reason;
  Object.keys(upd).forEach(function(k){i[k]=upd[k]});
  c[from]=Math.max(0,Number(c[from]||0)-1);c[i.stage]=Number(c[i.stage]||0)+1;
  s.items=(s.items||[]).filter(function(x){return x.id!==i.id});
  if(i.stage!=='cerrado')s.items.unshift(i);
  st.closed=st.closed?st.closed.filter(function(x){return x.id!==i.id}):st.closed;
  if(i.stage==='cerrado'&&st.closed)st.closed.unshift(i);
}
function doMove(id,stage,extra){
  var i=stageOf(id);if(!i||st.busy||!X.manager())return Promise.resolve();
  if(i.stage===stage)return Promise.resolve();
  st.busy=true;say('Guardando…');
  var rid=uuid(),data={request_id:rid,id:i.id,person_id:i.person_id,expected:i.version,stage:stage,temperature:i.temperature||''};
  if(stage==='cerrado')data.close_reason=(extra&&extra.reason)||'';
  if(stage==='matriculado'){data.confirm_enrolment=true;data.course=i.area;data.starts_on=(extra&&extra.starts_on)||null;data.payment_plan=(extra&&extra.plan)||'sin_definir'}
  var before=i.stage;
  return X.crm('interest_move',data).then(function(r){
    if(!r||r.saved!==true)throw Error('unconfirmed');
    apply(i,r,stage,data.close_reason);
    st.last={rid:rid,person_id:i.person_id,expected:r.version||i.version,name:i.name};
    st.busy=false;st.msg=i.name+' pasó a «'+NAME[stage]+'».';
    X.close();X.render();
  },function(e){
    st.busy=false;st.last=null;st.msg=errText(e);X.close();
    if(e&&e.code==='40001')X.reload();else X.render();
  });
}
function setTemp(id,temp){
  var i=stageOf(id);if(!i||st.busy||!X.manager()||i.stage==='matriculado'||i.stage==='cerrado'||(i.temperature||'')===temp)return;
  st.busy=true;say('Guardando…');var rid=uuid();
  X.crm('interest_move',{request_id:rid,id:i.id,person_id:i.person_id,expected:i.version,stage:i.stage,temperature:temp}).then(function(r){
    if(!r||r.saved!==true)throw Error('unconfirmed');
    i.temperature=temp;i.version=r.version||(Number(i.version||1)+1);
    st.last={rid:rid,person_id:i.person_id,expected:i.version,name:i.name};st.busy=false;st.msg=i.name+': '+TN[temp]+'.';X.render();
  },function(e){st.busy=false;st.last=null;st.msg=errText(e);if(e&&e.code==='40001')X.reload();else X.render()});
}
function undo(){
  var l=st.last;if(!l||st.busy)return;st.busy=true;say('Deshaciendo…');
  X.crm('interest_undo',{request_id:uuid(),person_id:l.person_id,undo_of:l.rid,expected:l.expected}).then(function(){
    st.busy=false;st.last=null;st.msg='Movimiento deshecho: '+l.name+' volvió a su etapa anterior.';st.closed=null;X.reload();
  },function(e){st.busy=false;st.last=null;st.msg=errText(e);X.reload()});
}

/* ---------- diálogos ---------- */
function openClose(id){
  var i=stageOf(id);if(!i)return;
  X.dlg('No se concretó',
   '<div id="em-err" class="err" role="alert" hidden></div><p><b>'+X.esc(i.name)+'</b> · '+X.esc(i.area||'')+'</p><p class="note">No se borra nada: queda en «No se concretaron» con este motivo y la puedes reabrir cuando quieras.</p>'+
   '<div class="chips" role="group" aria-label="Motivos frecuentes">'+REASONS.map(function(r){return '<button type="button" class="chip" data-em="why" data-t="'+X.esc(r)+'">'+X.esc(r)+'</button>'}).join('')+'</div>'+
   '<label>Motivo<textarea id="em-reason" maxlength="400" rows="2" placeholder="Por qué no se concretó"></textarea></label>'+
   '<div class="fi-acts"><button type="button" class="btn s" data-act="cerrar">Cancelar</button><button type="button" class="btn p" data-em="closego" data-id="'+X.esc(id)+'">Guardar en No se concretó</button></div>');
}
function openEnrol(id){
  var i=stageOf(id);if(!i)return;
  X.dlg('Matricular',
   '<div id="em-err" class="err" role="alert" hidden></div><p><b>'+X.esc(i.name)+'</b></p><p class="note">Esto marca la matrícula comercial. No reserva un cupo ni confirma un pago; para cobrar usa «Cobrar un pago».</p>'+
   '<label>Curso o servicio<input value="'+X.esc(i.area||'')+'" readonly></label>'+
   '<label>Condición de pago<select id="em-plan">'+PLANS.map(function(p){return '<option value="'+p[0]+'">'+p[1]+'</option>'}).join('')+'</select></label>'+
   '<label>Fecha de inicio · opcional<input id="em-start" type="date" min="2020-01-01" max="2045-12-31"></label>'+
   '<div class="fi-acts"><button type="button" class="btn s" data-act="cerrar">Cancelar</button><button type="button" class="btn p" data-em="enrolgo" data-id="'+X.esc(id)+'">Confirmar matrícula</button></div>');
}
function openMove(id){
  var i=stageOf(id);if(!i)return;
  X.dlg('Mover a…','<p><b>'+X.esc(i.name)+'</b> está en «'+X.esc(NAME[i.stage]||i.stage)+'».</p><div class="em-pick">'+
   STG.concat([['cerrado','No se concretó']]).map(function(s){return '<button type="button" class="btn '+(s[0]===i.stage?'p':'s')+'" data-em="to" data-to="'+s[0]+'" data-id="'+X.esc(id)+'"'+(s[0]===i.stage?' disabled':'')+'>'+s[1]+'</button>'}).join('')+'</div>');
}
function route(id,to){
  X.close();
  if(to==='cerrado')return openClose(id);
  if(to==='matriculado'){var i=stageOf(id);if(i&&i.enrolment&&i.enrolment.status==='confirmada')return doMove(id,to,{});return openEnrol(id)}
  doMove(id,to,{});
}
function loadClosed(){
  st.closed=null;X.render();
  X.crm('sales',{stage:'cerrado',offset:0}).then(function(d){st.closed=(d&&d.items)||[];X.render()},function(){st.closed=[];say('No se pudo cargar la lista de cerrados.');X.render()});
}

/* ---------- eventos ---------- */
function click(e){
  var b=e.target.closest&&e.target.closest('[data-em]');if(!b)return false;
  var k=b.dataset.em,id=b.dataset.id;
  if(k==='next'){var i=stageOf(id);if(i)route(id,nextOf(i.stage))}
  else if(k==='mv')openMove(id);
  else if(k==='no')openClose(id);
  else if(k==='to')route(id,b.dataset.to);
  else if(k==='temp')setTemp(id,b.dataset.t);
  else if(k==='axis'){axis=b.dataset.a==='temp'?'temp':'stage';try{localStorage.setItem('forma-ventas-eje',axis)}catch(x){}X.render()}
  else if(k==='reopen')doMove(id,'conversacion',{});
  else if(k==='undo')undo();
  else if(k==='closed'){st.showClosed=!st.showClosed;if(st.showClosed)loadClosed();else X.render()}
  else if(k==='why'){var t=$('#em-reason');if(t)t.value=b.dataset.t}
  else if(k==='closego'){var r=($('#em-reason')||{}).value;r=String(r||'').trim();if(!r){var er=$('#em-err');er.textContent='Escribe o elige un motivo.';er.hidden=false;return true}doMove(id,'cerrado',{reason:r})}
  else if(k==='enrolgo'){doMove(id,'matriculado',{plan:($('#em-plan')||{}).value,starts_on:($('#em-start')||{}).value||null})}
  return true;
}
function dragstart(e){var c=e.target.closest&&e.target.closest('.vc[draggable="true"]');if(!c)return;st.drag=c.dataset.iid;c.classList.add('em-drag');try{e.dataTransfer.setData('text/plain',st.drag);e.dataTransfer.effectAllowed='move'}catch(x){}}
function dragover(e){if(!st.drag)return;var l=e.target.closest('.lane[data-lane]');if(!l)return;e.preventDefault();document.querySelectorAll('.lane.em-over').forEach(function(x){if(x!==l)x.classList.remove('em-over')});l.classList.add('em-over')}
function dragend(){st.drag=null;document.querySelectorAll('.em-drag,.em-over').forEach(function(x){x.classList.remove('em-drag','em-over')})}
function drop(e){var l=e.target.closest('.lane[data-lane]');if(!l||!st.drag)return;e.preventDefault();var id=st.drag;dragend();var i=stageOf(id);if(!i)return;if(l.dataset.axis==='temp'){setTemp(id,l.dataset.lane);return}if(i.stage!==l.dataset.lane)route(id,l.dataset.lane)}
document.addEventListener('dragstart',dragstart);document.addEventListener('dragover',dragover);document.addEventListener('drop',drop);document.addEventListener('dragend',dragend);

window.GestionEmbudo={init:function(ctx){X=ctx},html:html,click:click,reset:function(){st.closed=null;st.showClosed=false;st.last=null;st.msg=''}};
})();
