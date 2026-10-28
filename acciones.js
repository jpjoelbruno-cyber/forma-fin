/* FORMA Gestión nueva · acciones nativas: Matricular y Cobrar.
   Usan las mismas operaciones del servidor que la pantalla clásica:
   forma_education (list, detail, person, payment) y forma_academic (catalog, enrol_group).
   Todas las escrituras llevan request_id (idempotente): reintentar nunca duplica. */
(function(){
'use strict';
var X=null,S=null;
var METHODS={pix:'PIX',efectivo:'Dinero',tarjeta:'Tarjeta',transferencia:'Transferencia'};
var FATAL=['22003','22001','23P01','22023','23505','23514','23503','23502','40001','42501','22P02','22007','22008','PGRST202','42883'];
function $(s){return document.querySelector(s)}
function uuid(){return crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16)})}
function norm(s){return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim()}
function cents(v){
  var s=String(v==null?'':v).trim().replace(/[^\d.,]/g,'');
  if(!s)return 0;
  var lc=s.lastIndexOf(','),ld=s.lastIndexOf('.');
  if(lc>-1&&ld>-1){s=lc>ld?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'')}
  else if(lc>-1){s=s.replace(',','.')}
  var n=Number(s);
  if(!isFinite(n)||n<0)throw Error('Revisa el importe: usa solo números, por ejemplo 150,00.');
  return Math.round(n*100);
}
function eur(c){return(c/100).toFixed(2).replace('.',',')}
function say(msg){var e=$('#ac-err');if(e){e.textContent=msg||'';e.hidden=!msg}}
function errText(e){
  var m=(e&&e.message)||'';
  if(/timeout/i.test(m))return 'No se confirmó a tiempo. Si pulsas de nuevo se reintenta el mismo registro, sin duplicar.';
  if(e&&e.code==='40001')return 'El grupo cambió mientras lo preparabas. Cierra y vuelve a abrir Matricular.';
  if(e&&e.code==='42501')return 'No tienes permiso para esta acción.';
  if(e&&e.code==='23505')return 'Esa persona ya está matriculada en este grupo. Para cobrar usa «Cobrar un pago».';
  if(m&&m.length<220&&!/^(fetch|Failed|Network)/i.test(m))return m;
  return 'No se pudo guardar. No se cambió nada. Intenta de nuevo.';
}
function field(label,name,type,val,extra){return '<label>'+label+'<input name="'+name+'" type="'+(type||'text')+'" value="'+X.esc(val==null?'':val)+'" '+(extra||'')+'></label>'}
function shell(title,body){X.dlg(title,'<div id="ac-err" class="err" role="alert" hidden></div>'+body,true)}

/* ---------- servidor ---------- */
function simulate(kind){return Promise.resolve({saved:true,person_id:'demo-p',id:'demo-'+kind})}
function eduCall(a,d){return X.demo&&['person','payment','contract','replace_payment','void_payment','person_edit'].indexOf(a)>-1?simulate(a):X.edu(a,d)}
function acaCall(a,d){return X.demo&&a==='enrol_group'?simulate(a):X.rpc('forma_academic',{p_action:a,p_data:d})}

/* ---------- PLAN DE PAGO: valor acordado → entrada + cuotas (compartido por Matricular y Corregir condiciones) ---------- */
var PQ=null;
function isoAdd(iso,n){var p=String(iso).split('-'),d=new Date(Date.UTC(+p[0],+p[1]-1,+p[2],12)),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n);var last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d.toISOString().slice(0,10)}
function dmy(iso){var p=String(iso||'').split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:'—'}
/* Calcula el plan. Los centavos que sobran al dividir van a la primera cuota. Devuelve también lo que espera el servidor:
   fee_cents + monthly_cents×cuotas = total, y payment_schedule (suma = total). */
function calcPlan(Q){
  var o={err:'',rows:[],srv:[]},total,ent;
  try{total=cents(Q.total);ent=cents(Q.ent)}catch(e){o.err=e.message;return o}
  var n=Number(Q.n);
  if(!(total>0)){o.err='Escribe el valor acordado con el alumno.';return o}
  if(ent>total){o.err='La entrada no puede ser mayor que el valor acordado.';return o}
  var rest=total-ent;
  if(rest===0)n=0;
  else if(!(Number.isInteger(n)&&n>=1&&n<=60)){o.err='Elige en cuántas veces paga el resto.';return o}
  if(ent>0&&!/^\d{4}-\d{2}-\d{2}$/.test(Q.entDue||'')){o.err='Indica la fecha de la entrada.';return o}
  if(n>0&&!/^\d{4}-\d{2}-\d{2}$/.test(Q.first||'')){o.err='Indica la fecha de la primera cuota.';return o}
  var m=n?Math.floor(rest/n):0,r=n?rest-m*n:0;
  if(ent>0)o.rows.push({label:'Entrada',due:Q.entDue,cents:ent});
  for(var i=0;i<n;i++)o.rows.push({label:'Cuota '+(i+1),due:(Q.dates&&Q.dates[i])||isoAdd(Q.first,i),cents:m+(i===0?r:0)});
  for(var j=1;j<o.rows.length;j++)if(o.rows[j].due<o.rows[j-1].due){o.err='Las fechas deben ir en orden: '+o.rows[j].label+' no puede ser antes que '+o.rows[j-1].label.toLowerCase()+'.';return o}
  o.total=total;o.ent=ent;o.n=n;o.rest=rest;o.monthly=m;o.rem=r;o.fee=total-m*n;
  o.srv=o.rows.map(function(x){return{due_on:x.due,amount_cents:x.cents,label:x.label}});
  return o;
}
/* Guarda en la primera fila del calendario cómo se llegó al valor (lista, descuento, motivo). El servidor ignora claves extra. */
function withTerms(c,Q){
  var l=Number(Q.listC||0),srv=c.srv.map(function(x){return{due_on:x.due_on,amount_cents:x.amount_cents,label:x.label}});
  if(srv.length&&(l>0&&(l!==c.total||String(Q.disc||'').trim())||Q.terms))srv[0].terms={list_cents:l||(Q.terms&&Q.terms.list_cents)||0,agreed_cents:c.total,discount_cents:Math.max(0,l-c.total),reason:String(Q.disc||'').trim().slice(0,200)};
  return srv;
}
function planHTML(Q,o){
  o=o||{};
  var chips=[1,2,3,4,5,6,10,12].map(function(n){return '<button type="button" class="chip" data-ac="qn" data-n="'+n+'" aria-pressed="'+(Number(Q.n)===n)+'">'+n+'</button>'}).join('');
  return '<div class="ac-pl"><div class="cu-form ac-grid">'+field('Valor acordado con el alumno (R$)','total','text',Q.total,'inputmode="decimal" data-q="total" placeholder="0,00"')+'</div>'+(o.afterTotal||'')
   +'<h3 style="margin:14px 0 6px">Entrada <small style="font-weight:500;color:var(--ink2)">· ya forma parte del valor acordado</small></h3><div class="cu-form ac-grid">'+field('Importe de la entrada (R$)','ent','text',Q.ent,'inputmode="decimal" data-q="ent" placeholder="0,00"')+field('Fecha de la entrada','entDue','date',Q.entDue,'data-q="entDue"')+'</div>'+(o.afterEnt||'')
   +'<h3 style="margin:14px 0 6px">El resto</h3><label>¿En cuántas veces paga?</label><div class="chips" role="group">'+chips+'<input type="number" min="1" max="60" inputmode="numeric" data-q="n" data-nowheel="1" value="'+X.esc(Q.n)+'" aria-label="Otra cantidad de cuotas" class="ac-n"></div>'
   +'<div class="cu-form ac-grid" style="margin-top:10px">'+field('Vence la primera cuota','first','date',Q.first,'data-q="first"')+'</div><div id="ac-plan" aria-live="polite"></div></div>';
}
function paintPlan(){
  var box=$('#ac-plan');if(!box||!PQ)return;
  var c=calcPlan(PQ);PQ.calc=c;
  document.querySelectorAll('[data-ac="qn"]').forEach(function(b){b.setAttribute('aria-pressed',String(Number(b.dataset.n)===Number(PQ.n)))});
  if(c.err){box.innerHTML='<div class="ac-note">'+X.esc(c.err)+'</div>';if(PQ.after)PQ.after(c);return}
  var rows=c.rows.map(function(x,i){var ent=x.label==='Entrada';return '<tr><td>'+X.esc(x.label)+'</td><td>'+(ent?dmy(x.due):'<input type="date" data-qd="'+(i-(c.ent>0?1:0))+'" value="'+x.due+'" aria-label="Fecha de '+X.esc(x.label)+'">')+'</td><td class="r">'+X.R(x.cents)+'</td></tr>'}).join('');
  box.innerHTML='<div class="tw"><table class="ac-tb"><thead><tr><th>Pago</th><th>Fecha</th><th class="r">Valor</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
   +'<div class="ac-sum">Acordado <b>'+X.R(c.total)+'</b>'+(c.ent?' · Entrada <b>'+X.R(c.ent)+'</b>':'')+(c.n?' · Resta <b>'+X.R(c.rest)+'</b> en <b>'+c.n+(c.n===1?' pago':' cuotas')+'</b>'+(c.n>1&&c.rem===0?' de <b>'+X.R(c.monthly)+'</b>':' (≈ '+X.R(Math.round(c.rest/c.n))+')'):'')+'.'+(c.rem?' Los centavos que sobran van a la primera cuota.':'')+'</div>';
  if(PQ.after)PQ.after(c);
}
function wirePlan(Q){PQ=Q;paintPlan()}
document.addEventListener('input',function(e){var t=e.target;if(!PQ||!t||!t.dataset||t.dataset.q===undefined)return;PQ[t.dataset.q]=t.value;if(t.dataset.q==='first')PQ.dates=[];if(t.dataset.q==='n'&&t.value!=='')PQ.dates=(PQ.dates||[]).slice(0,Number(t.value)||0);paintPlan()});
document.addEventListener('change',function(e){var t=e.target;if(!PQ||!t||!t.dataset)return;if(t.dataset.qd!==undefined){PQ.dates=PQ.dates||[];PQ.dates[Number(t.dataset.qd)]=t.value;paintPlan()}if(t.dataset.qb!==undefined){PQ[t.dataset.qb]=!!t.checked;paintPlan()}});

/* ---------- selector de persona (compartido) ---------- */
var searchT=0;
function personBox(allowNew){
  return '<label>Buscar persona<input id="ac-q" type="search" autocomplete="off" placeholder="Nombre, teléfono o correo" aria-label="Buscar persona"></label><div id="ac-res" class="list" aria-live="polite"></div>'+(allowNew?'<button type="button" class="btn s sm" data-ac="newp">Es una persona nueva</button>':'')+'<div id="ac-sel"></div>';
}
function wirePerson(allowNew,onPick){
  var q=$('#ac-q');if(!q)return;
  q.oninput=function(){
    var v=q.value.trim(),my=++searchT;
    if(v.length<2){$('#ac-res').innerHTML='';return}
    $('#ac-res').innerHTML='<p class="skel" role="status">Buscando…</p>';
    setTimeout(function(){
      if(my!==searchT)return;
      X.edu('list',{query:v,offset:0,state:''}).then(function(d){
        if(my!==searchT)return;
        var it=(d&&d.items||[]).slice(0,8);
        $('#ac-res').innerHTML=it.map(function(p){return '<button type="button" class="row" data-ac="pick" data-id="'+X.esc(p.id)+'"><div class="t"><b>'+X.esc(p.name)+'</b><span>'+X.esc(p.phone||p.email||'Sin contacto')+'</span></div></button>'}).join('')||'<p class="note">Sin coincidencias.'+(allowNew?' Puedes registrarla como persona nueva.':'')+'</p>';
      },function(){if(my===searchT)$('#ac-res').innerHTML='<p class="note">No se confirmó la búsqueda. Intenta de nuevo.</p>'});
    },250);
  };
  S.onPick=onPick;
}
function loadPerson(id){
  return X.edu('detail',{person_id:id}).then(function(d){
    if(!d||!d.person)throw Error('No se pudo leer la ficha.');
    S.person=d.person;S.detail=d;S.isNew=false;return d;
  });
}

/* ---------- MATRICULAR ---------- */
function openMat(pre){
  S={kind:'mat',step:1,person:null,detail:null,isNew:false,np:{name:'',phone:'',email:''},cat:null,gid:null,pay:null,pending:null,busy:false,done:false};
  shell('Matricular un alumno','<p class="skel" role="status">Cargando grupos…</p>');
  X.cursos.load(true).then(function(){
    S.cat=X.cursos.cat();
    if(!S.cat||!S.cat.groups)throw Error('catálogo');
    if(pre&&pre.person_id)return loadPerson(pre.person_id).then(function(){S.step=2});
  }).then(function(){paintMat()},function(){shell('Matricular un alumno','<div class="err">No se pudieron cargar los grupos. No se cambió nada.</div>')});
}
function groups(){
  return(S.cat.groups||[]).filter(function(g){return g.active}).map(function(g){
    var days=(g.sessions||[]).map(function(s){return s.day}).sort();
    return{g:g,from:days[0],to:days[days.length-1],left:g.capacity-g.students};
  }).sort(function(a,b){return(a.from||'9')<(b.from||'9')?-1:1});
}
function curG(){return(S.cat.groups||[]).filter(function(g){return g.id===S.gid})[0]}
function stepsBar(){
  var n=['Persona','Grupo','Pago','Confirmar'];
  return '<div class="ac-steps">'+n.map(function(t,i){return '<span class="'+(i+1===S.step?'on':i+1<S.step?'ok':'')+'">'+(i+1)+'. '+t+'</span>'}).join('')+'</div>';
}
var DOWN=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
function grpWhen(g){
  var ss=(g.sessions||[]).filter(function(x){return !x.cancelled});if(!ss.length)return 'sin encuentros';
  var days=[];ss.forEach(function(x){var d=new Date(x.day+'T12:00:00Z').getUTCDay();if(days.indexOf(d)<0)days.push(d)});days.sort(function(a,b){return((a+6)%7)-((b+6)%7)});
  var f=ss.slice().sort(function(a,b){return a.day<b.day?-1:a.day>b.day?1:a.start_min-b.start_min})[0];
  return days.map(function(d){return DOWN[d]}).join('-')+' '+hm(f.start_min)+'–'+hm(f.end_min);
}
function paintMat(){
  var h=stepsBar(),g=S.gid?curG():null;
  if(S.step===1){
    h+='<h3>¿Quién se matricula?</h3>';
    if(S.person){
      h+='<div class="ac-chosen"><b>'+X.esc(S.person.name)+'</b><span>'+X.esc(S.person.phone||'Sin teléfono')+' · '+X.esc(S.person.email||'Sin correo')+'</span><button type="button" class="btn s sm" data-ac="chg">Cambiar</button></div>';
    }else if(S.isNew){
      h+='<form id="ac-np" class="cu-form">'+field('Nombre completo','name','text',S.np.name,'required maxlength="160" autocomplete="off"')+field('Teléfono (WhatsApp)','phone','tel',S.np.phone,'maxlength="40"')+field('Correo (para el acceso del alumno)','email','email',S.np.email,'maxlength="160"')+'<button type="button" class="btn s sm" data-ac="chg">Mejor buscar una existente</button></form>';
    }else h+=personBox(true);
    h+='<div class="cu-foot"><span></span><button class="btn p" data-ac="next">Siguiente</button></div>';
  }
  if(S.step===2){
    var gs=groups();
    h+='<h3>¿En qué grupo?</h3><div class="list">'+(gs.map(function(x){
      var full=x.left<=0;
      return '<button type="button" class="row ac-g'+(x.g.id===S.gid?' on':'')+'"'+(full?' disabled':'')+' data-ac="grp" data-id="'+X.esc(x.g.id)+'"><div class="t"><b>'+X.esc(x.g.course)+' · '+X.esc(x.g.name)+(x.from&&x.from<X.T?' <span class="pill flat">ya empezó</span>':'')+'</b><span>'+(x.from?X.dl(x.from)+' → '+X.dl(x.to):'Sin fechas')+' · '+grpWhen(x.g)+' · '+X.esc(x.g.instructor||'')+' · '+X.esc(x.g.room||'')+'</span></div><span class="pill '+(full?'down':x.left<=2?'flat':'up')+'">'+(full?'Completo':x.left+(x.left===1?' cupo':' cupos'))+'</span></button>';
    }).join('')||'<p class="note">No hay grupos abiertos. Crea uno en Cursos.</p>')+'</div>';
    h+='<div class="cu-foot"><button class="btn s" data-ac="back">Atrás</button><button class="btn p" data-ac="next">Siguiente</button></div>';
  }
  if(S.step===3){
    var ex=existingEnrol(g);
    h+='<h3>'+(ex?'Condiciones de pago':'Valor y forma de pago')+'</h3><p class="note" style="margin:-6px 0 10px">'+X.esc(g.course+' · '+g.name)+' · '+grpWhen(g)+'</p>';
    if(ex){
      var p=S.pay||(S.pay={adv:'',paid_on:X.T,method:'pix',card:'credito',conf:false,portal:false});
      h+='<p class="note">Esta persona ya tiene una matrícula de <b>'+X.esc(ex.course)+'</b> sin grupo. Se vincula a ese grupo y se conservan sus pagos y su contrato.</p>';
      h+='<form id="ac-adv" class="cu-form ac-grid">'+field('Abono recibido hoy (R$, opcional)','adv','text',p.adv,'inputmode="decimal" placeholder="0,00"')+field('Fecha real del pago','paid_on','date',p.paid_on,'max="'+X.T+'"')+'<label>Medio<select name="method">'+Object.keys(METHODS).map(function(k){return '<option value="'+k+'"'+(p.method===k?' selected':'')+'>'+METHODS[k]+'</option>'}).join('')+'</select></label><label>Tarjeta<select name="card"><option value="credito"'+(p.card==='credito'?' selected':'')+'>Crédito</option><option value="debito"'+(p.card==='debito'?' selected':'')+'>Débito</option></select></label><label class="ac-chk"><input name="conf" type="checkbox"'+(p.conf?' checked':'')+'> Confirmo que el dinero fue recibido.</label><label class="ac-chk"><input name="portal" type="checkbox"'+(p.portal?' checked':'')+'> Habilitar acceso del alumno a su área</label></form>';
    }else{
      var Q=S.Q||(S.Q=newPlanState(g));
      var pms=PMS.map(function(m){return '<button type="button" class="chip" data-ac="pm" data-m="'+m[0]+'" aria-pressed="'+(Q.pm===m[0])+'">'+m[1]+'</button>'}).join('');
      var afterTotal='<div class="ac-pr"><div><label>Precio de lista del grupo</label><div class="ac-ro">'+(Q.listC>0?X.R(Q.listC):'Sin precio de lista')+'</div></div><div><label>Descuento</label><div class="ac-ro" id="ac-disc">—</div></div></div><div id="ac-dr" hidden>'+field('Motivo del descuento (opcional)','disc','text',Q.disc,'data-q="disc" maxlength="200" placeholder="Ej.: negociación al matricularse"')+'</div>';
      var afterEnt='<div id="ac-entx"><label>¿Cómo pagó la entrada?</label><div class="chips" role="group">'+pms+'</div><label class="ac-chk"><input type="checkbox" data-qb="recv"'+(Q.recv?' checked':'')+'> La entrada ya fue recibida</label><label class="ac-chk"><input type="checkbox" data-qb="conf"'+(Q.conf?' checked':'')+'> Confirmo que el dinero fue recibido.</label></div>';
      h+=planHTML(Q,{afterTotal:afterTotal,afterEnt:afterEnt});
      h+='<label class="ac-chk" style="margin-top:8px"><input type="checkbox" data-qb="portal"'+(Q.portal?' checked':'')+'> Habilitar acceso del alumno a su área</label>';
    }
    h+='<div class="cu-foot"><button class="btn s" data-ac="back">Atrás</button><button class="btn p" data-ac="next">Revisar</button></div>';
  }
  if(S.step===4){
    var d=S.payload,tot=d.total,c=d.plan,Q4=S.Q;
    h+='<h3>Revisa y confirma</h3><div class="ac-rev"><p><small>Alumno</small><b>'+X.esc(S.person?S.person.name:S.np.name)+(S.isNew?' (persona nueva)':'')+'</b></p><p><small>Grupo</small><b>'+X.esc(g.course+' · '+g.name)+'</b></p><p><small>Días y horario</small><b>'+grpWhen(g)+'</b></p>';
    if(c){
      var disc=Q4.listC>0?Q4.listC-c.total:0;
      h+='<p><small>Valor acordado</small><b>'+X.R(c.total)+'</b></p>'+(disc>0?'<p><small>Lista '+X.R(Q4.listC)+' · descuento</small><b>'+X.R(disc)+(Q4.disc?' · '+X.esc(Q4.disc):'')+'</b></p>':'')+(c.ent>0?'<p><small>Entrada</small><b>'+X.R(c.ent)+' · '+pmLabel(Q4.pm)+' · '+(d.adv>0?'recibida el '+dmy(Q4.entDue):'pendiente, vence el '+dmy(Q4.entDue))+'</b></p>':'')+'</div>';
      h+='<div class="tw"><table class="ac-tb"><thead><tr><th>Pago</th><th>Fecha</th><th class="r">Valor</th></tr></thead><tbody>'+c.rows.map(function(x){return '<tr><td>'+X.esc(x.label)+'</td><td>'+dmy(x.due)+'</td><td class="r">'+X.R(x.cents)+'</td></tr>'}).join('')+'</tbody></table></div><div class="ac-rev" style="margin-top:10px">';
    }else{
      h+='<p><small>Contrato</small><b>'+X.R(tot)+' <span class="note">(matrícula existente)</span></b></p><p><small>Abono hoy</small><b>'+X.R(d.adv)+'</b></p>';
    }
    h+='<p><small>Quedará por pagar</small><b>'+X.R(tot-d.adv-d.paidBefore)+'</b></p></div>';
    h+='<div class="cu-foot"><button class="btn s" data-ac="back"'+(S.busy?' disabled':'')+'>Atrás</button><button class="btn p" data-ac="go"'+(S.busy?' disabled':'')+'>'+(S.pending?'Reintentar el mismo registro':'Confirmar matrícula')+'</button></div>';
  }
  shell('Matricular un alumno',h);
  if(S.step===1&&!S.person&&!S.isNew)wirePerson(true);
  if(S.step===3&&S.Q&&!existingEnrol(curG()))wirePlan(S.Q);
  say(S.msg);S.msg='';
}
function existingEnrol(g){
  if(!S.person||S.isNew||!S.detail)return null;
  var c=norm(g.course);
  return(S.detail.enrolments||[]).filter(function(e){return !e.group_id&&e.state!=='cancelado'&&norm(e.course)===c})[0]||null;
}
var PMS=[['pix','PIX'],['efectivo','Dinero'],['debito','Débito'],['credito','Crédito'],['transferencia','Transferencia']];
function pmLabel(k){var f=PMS.filter(function(m){return m[0]===k})[0];return f?f[1]:k}
function pmSplit(k){return k==='debito'||k==='credito'?{method:'tarjeta',card:k}:{method:k,card:''}}
function afterMat(c){
  var Q=PQ,tot=0,ent=0;if(!Q)return;
  try{tot=cents(Q.total)}catch(e){}try{ent=cents(Q.ent)}catch(e){}
  var d=$('#ac-disc'),dr=$('#ac-dr'),ex=$('#ac-entx'),disc=Q.listC>0&&tot>0?Q.listC-tot:0;
  if(d)d.textContent=!tot?'—':disc>0?X.R(disc)+' ('+Math.round(disc/Q.listC*100)+'%)':disc<0?'Sobre la lista: '+X.R(-disc):'Sin descuento';
  if(dr)dr.hidden=!(disc>0);
  if(ex)ex.hidden=!(ent>0);
}
function newPlanState(g){
  var list=Number(g.fee_cents||0)+Number(g.installments||0)*Number(g.monthly_cents||0);
  return{listC:list,total:list>0?eur(list):'',ent:'',entDue:X.T,n:Number(g.installments)>0?Number(g.installments):1,first:isoAdd(X.T,1),dates:[],disc:'',pm:'pix',recv:true,conf:false,portal:false,after:afterMat};
}
function readPay(){
  var a=$('#ac-adv'),p=S.pay;
  if(a&&p){var w=new FormData(a);p.adv=w.get('adv');p.paid_on=w.get('paid_on');p.method=w.get('method');p.card=w.get('card');p.conf=!!a.elements.conf.checked;p.portal=!!a.elements.portal.checked}
}
function buildPayload(){
  var g=curG(),ex=existingEnrol(g);
  if(!g||!g.active||g.students>=g.capacity)throw Error('El grupo no está disponible o no tiene cupos.');
  if(!(g.sessions||[]).length)throw Error('Este grupo no tiene encuentros. Prepáralo en Cursos.');
  var email=S.isNew?S.np.email:(S.person&&S.person.email);
  if(ex){
    readPay();var p=S.pay,adv=cents(p.adv),total=Number(ex.total_cents),pb=Number(ex.paid_cents||0);
    if(adv>total-pb)throw Error('El abono supera el saldo. Revisa el importe.');
    if(adv>0){
      if(!p.conf)throw Error('Marca que recibiste el dinero antes de registrar el abono.');
      if(!p.paid_on||p.paid_on>X.T)throw Error('Revisa la fecha real del pago.');
    }
    if(p.portal&&!email)throw Error('Para habilitar el acceso del alumno hace falta su correo.');
    return{ex:ex,adv:adv,total:total,paidBefore:pb,plan:null};
  }
  if(S.cat.academic_version!==2)throw Error('Esta versión de FORMÁ no admite un valor distinto al del grupo. Avisa a Joel.');
  var Q=S.Q;PQ=Q;var c=calcPlan(Q);if(c.err)throw Error(c.err);
  var adv=(c.ent>0&&Q.recv)?c.ent:0;
  if(adv>0){
    if(!Q.conf)throw Error('Marca que confirmas que recibiste la entrada, o desmarca «La entrada ya fue recibida».');
    if(!Q.entDue||Q.entDue>X.T)throw Error('La entrada recibida no puede tener fecha futura. Corrige la fecha o desmarca «ya fue recibida».');
  }
  if(Q.portal&&!email)throw Error('Para habilitar el acceso del alumno hace falta su correo.');
  return{ex:null,plan:c,adv:adv,total:c.total,paidBefore:0};
}
function stepNext(){
  say('');
  try{
    if(S.step===1){
      if(S.isNew){
        var f=$('#ac-np'),v=new FormData(f);S.np={name:String(v.get('name')||'').trim(),phone:String(v.get('phone')||'').trim(),email:String(v.get('email')||'').trim()};
        if(S.np.name.length<3)throw Error('Escribe el nombre completo.');
        if(S.np.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(S.np.email))throw Error('Revisa el correo.');
      }else if(!S.person)throw Error('Busca y elige a la persona, o marca que es nueva.');
    }
    if(S.step===2){if(!S.gid)throw Error('Elige un grupo.');if(S.qGid!==S.gid){S.pay=null;S.Q=null;S.qGid=S.gid}}
    if(S.step===3){var ex0=existingEnrol(curG());if(!ex0)PQ=S.Q;S.payload=buildPayload()}
    S.step++;paintMat();
  }catch(e){say(e.message)}
}
function confirmMat(){
  if(S.busy)return;
  var g=curG(),pl=S.payload,p=S.pay;
  if(!S.pending){
    var steps=[];
    if(S.isNew&&!S.personId)steps.push({api:'edu',a:'person',d:{name:S.np.name,phone:S.np.phone,email:S.np.email,language:'es',person_id:null,request_id:uuid()}});
    var en;
    if(pl.ex){
      en={group_id:g.id,expected:g.version,existing_enrolment_id:pl.ex.id,fee_due:X.T,first_due:X.T,advance_cents:pl.adv,paid_on:p.paid_on,method:p.method,card_type:p.method==='tarjeta'?p.card:'',confirmed:!!p.conf,portal:!!p.portal,request_id:uuid()};
    }else{
      var Q=S.Q,c=pl.plan,pm=pmSplit(Q.pm);
      en={group_id:g.id,expected:g.version,existing_enrolment_id:null,fee_due:c.ent>0?Q.entDue:Q.first,first_due:c.n>0?Q.first:Q.entDue,advance_cents:pl.adv,paid_on:pl.adv>0?Q.entDue:X.T,method:pm.method,card_type:pm.card,confirmed:pl.adv>0,portal:!!Q.portal,request_id:uuid(),fee_cents:c.fee,monthly_cents:c.monthly,installments:c.n,payment_schedule:withTerms(c,Q)};
    }
    steps.push({api:'aca',a:'enrol_group',d:en});
    S.pending={steps:steps,i:0};
  }
  S.busy=true;paintMat();
  (function run(){
    var st=S.pending.steps[S.pending.i];
    if(!st){S.busy=false;S.done=true;return finishMat()}
    var d=st.d;if(st.a==='enrol_group')d.person_id=S.personId||(S.person&&S.person.id);
    (st.api==='edu'?eduCall(st.a,d):acaCall(st.a,d)).then(function(r){
      if(!r||!r.saved)throw Error('Sin confirmar');
      if(st.a==='person'){S.personId=r.person_id}
      S.pending.i++;run();
    },function(e){
      S.busy=false;
      if(e&&FATAL.indexOf(e.code)>-1){S.pending=null}
      S.msg=errText(e);paintMat();
    });
  })();
}
function finishMat(){
  var nm=S.person?S.person.name:S.np.name;
  X.cursos.load(true).then(function(){},function(){});
  X.refresh();
  X.dlg('Matrícula guardada','<div class="ac-ok"><b>'+X.esc(nm)+'</b> quedó matriculado en <b>'+X.esc(curG().course+' · '+curG().name)+'</b>.</div><p class="note">Ya aparece en Alumnos y en el cupo del grupo.</p><div class="fi-acts">'+(S.payload.total-S.payload.adv-S.payload.paidBefore>0?'<button class="btn p" data-ac="cobrar-after">Cobrar un pago</button>':'')+'<button class="btn s" data-act="cerrar">Cerrar</button></div>',false);
  S.after={person_id:S.personId||(S.person&&S.person.id)};
}

/* ---------- COBRAR ---------- */
function openPay(pre){
  S={kind:'pay',person:null,detail:null,isNew:false,pending:null,busy:false,enrId:pre&&pre.enrolment_id||null};
  if(pre&&pre.person_id){
    shell('Cobrar un pago','<p class="skel" role="status">Cargando…</p>');
    loadPerson(pre.person_id).then(paintPay,function(){shell('Cobrar un pago','<div class="err">No se pudo cargar la ficha. No se cambió nada.</div>')});
  }else paintPay();
}
/* Próximo vencimiento pendiente de una matrícula (para sugerir el importe al cobrar) */
function nextDue(eid){
  var ds=((S&&S.detail&&S.detail.debts)||[]).filter(function(x){return x.enrolment_id===eid&&!x.cancelled&&Number(x.total_cents)-Number(x.paid_cents)>0}).sort(function(a,b){return(a.due_on||'9')<(b.due_on||'9')?-1:1});
  var d=ds[0];if(!d)return null;
  return{rest:Number(d.total_cents)-Number(d.paid_cents),due:d.due_on,label:'Pago recibido · vence '+dmy(d.due_on)};
}
function openEnrols(){return(S.detail&&S.detail.enrolments||[]).filter(function(e){return e.state!=='cancelado'})}
function paintPay(){
  var h='';
  if(!S.person){
    h+='<h3>¿Quién pagó?</h3>'+personBox(false)+'<div class="cu-foot"><span></span><span></span></div>';
    shell('Cobrar un pago',h);wirePerson(false);return;
  }
  var en=openEnrols();
  if(!en.length){shell('Cobrar un pago','<div class="ac-chosen"><b>'+X.esc(S.person.name)+'</b></div><p class="note">Esta persona todavía no tiene una matrícula. Primero matricúlala.</p><div class="fi-acts"><button class="btn p" data-ac="mat-from-pay">Matricular</button><button class="btn s" data-ac="chg">Cambiar persona</button></div>');return}
  if(!S.enrId||!en.some(function(e){return e.id===S.enrId}))S.enrId=(en.filter(function(e){return Number(e.total_cents)>Number(e.paid_cents)})[0]||en[0]).id;
  var nd=nextDue(S.enrId),v=S.form||{amount:nd?eur(nd.rest):'',paid_on:X.T,method:'pix',card:'',note:nd&&nd.label?nd.label:'Pago recibido',conf:false};S.form=v;
  h+='<div class="ac-chosen"><b>'+X.esc(S.person.name)+'</b><span>'+X.esc(S.person.phone||'')+'</span><button type="button" class="btn s sm" data-ac="chg">Cambiar</button></div>';
  h+='<form id="ac-pf" class="cu-form ac-grid"><label>Matrícula<select name="enr">'+en.map(function(e){return '<option value="'+X.esc(e.id)+'"'+(e.id===S.enrId?' selected':'')+'>'+X.esc(e.course+(e.group_name?' · '+e.group_name:''))+'</option>'}).join('')+'</select></label><div id="ac-bal" class="note ac-bal"></div>'+field('Importe recibido (R$)','amount','text',v.amount,'inputmode="decimal" required placeholder="0,00"')+field('Fecha real del pago','paid_on','date',v.paid_on,'required max="'+X.T+'" min="2020-01-01"')+'<label>Medio<select name="method">'+Object.keys(METHODS).map(function(k){return '<option value="'+k+'"'+(v.method===k?' selected':'')+'>'+METHODS[k]+'</option>'}).join('')+'</select></label><label>Tarjeta (si corresponde)<select name="card"><option value="">No corresponde</option><option value="credito"'+(v.card==='credito'?' selected':'')+'>Crédito</option><option value="debito"'+(v.card==='debito'?' selected':'')+'>Débito</option></select></label>'+field('Concepto / referencia','note','text',v.note,'required maxlength="500"')+'<label class="ac-chk"><input name="conf" type="checkbox"'+(v.conf?' checked':'')+'> Confirmo que el dinero fue recibido.</label></form>';
  h+='<p class="note">Un pago prometido no se registra aquí. Se genera el comprobante al guardar.</p><div class="cu-foot"><button class="btn s" data-act="cerrar"'+(S.busy?' disabled':'')+'>Cancelar</button><button class="btn p" data-ac="paygo"'+(S.busy?' disabled':'')+'>'+(S.pending?'Reintentar el mismo registro':'Guardar el pago')+'</button></div>';
  shell('Cobrar un pago',h);
  var f=$('#ac-pf');
  var upd=function(){
    var e=en.filter(function(x){return x.id===f.elements.enr.value})[0],bal=Number(e.total_cents)-Number(e.paid_cents),am=0,ok=true;
    try{am=cents(f.elements.amount.value)}catch(x){ok=false}
    $('#ac-bal').textContent=e.course+' · Contrato '+X.R(Number(e.total_cents))+' · Ya recibido '+X.R(Number(e.paid_cents))+' · Falta '+X.R(bal)+(ok&&am?' · Saldo después: '+X.R(bal-am)+(am>bal?' ⚠ supera el saldo':''):'');
  };
  f.oninput=function(){S.pending=null;S.enrId=f.elements.enr.value;upd()};
  f.onchange=f.oninput;upd();say(S.msg);S.msg='';
}
function confirmPay(){
  if(S.busy)return;
  var f=$('#ac-pf'),fd=new FormData(f);
  S.form={amount:fd.get('amount'),paid_on:fd.get('paid_on'),method:fd.get('method'),card:fd.get('card'),note:String(fd.get('note')||'').trim(),conf:!!f.elements.conf.checked};
  var v=S.form,en=openEnrols().filter(function(e){return e.id===S.enrId})[0];
  try{
    var am=cents(v.amount);
    if(!am)throw Error('Escribe el importe recibido.');
    if(am>Number(en.total_cents)-Number(en.paid_cents))throw Error('El importe supera lo que falta pagar de esta matrícula. Revisa el importe.');
    if(!v.paid_on||v.paid_on>X.T)throw Error('Revisa la fecha real del pago.');
    if(!v.note)throw Error('Escribe un concepto.');
    if(!v.conf)throw Error('Marca que confirmas que el dinero fue recibido.');
    if(v.method==='tarjeta'&&!v.card)throw Error('Indica si la tarjeta fue crédito o débito.');
    if(!S.pending)S.pending={d:{person_id:S.person.id,enrolment_id:en.id,amount_cents:am,paid_on:v.paid_on,method:v.method,card_type:v.method==='tarjeta'?v.card:'',note:v.note,confirmed:true,request_id:uuid()},am:am,en:en};
  }catch(e){say(e.message);return}
  S.busy=true;paintPay();
  eduCall('payment',S.pending.d).then(function(r){
    if(!r||!r.saved)throw Error('Sin confirmar');
    S.busy=false;X.refresh();
    X.dlg('Pago guardado','<div class="ac-ok"><b>'+X.R(S.pending.am)+'</b> de <b>'+X.esc(S.person.name)+'</b> quedó registrado con su comprobante.</div><div class="fi-acts"><button class="btn s" data-act="cerrar">Cerrar</button></div>',false);
  },function(e){
    S.busy=false;if(e&&FATAL.indexOf(e.code)>-1)S.pending=null;
    S.msg=errText(e);paintPay();
  });
}


/* ---------- REGISTRAR CLASE ---------- */
var ATT={pendiente:'Sin confirmar',asistio:'Asistió',no_asistio:'No asistió',cancelado:'Cancelada'};
function hm(m){return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')}
function openClase(){
  S={kind:'cls',busy:false,sel:null,rows:null,msg:''};
  shell('Registrar la clase','<p class="skel" role="status">Buscando clases…</p>');
  X.cursos.load(true).then(function(){S.cat=X.cursos.cat();paintClase()},function(){shell('Registrar la clase','<div class="err">No se pudieron cargar las clases. No se cambió nada.</div>')});
}
function recentSessions(){
  var from=X.plus(X.T,-14),out=[];
  (S.cat.groups||[]).filter(function(g){return g.active&&g.students>0}).forEach(function(g){
    (g.sessions||[]).forEach(function(x){if(x.day<=X.T&&x.day>=from)out.push({g:g,s:x})});
  });
  return out.sort(function(a,b){return a.s.day<b.s.day?1:a.s.day>b.s.day?-1:a.s.start_min-b.s.start_min});
}
function paintClase(){
  var h='';
  if(!S.sel){
    var rs=recentSessions();
    h+='<h3>¿Qué clase se dio?</h3><p class="note">Clases de los últimos 14 días con alumnos matriculados.</p><div class="list">'+(rs.map(function(r,i){
      return '<button type="button" class="row ac-g" data-ac="cls" data-i="'+i+'"><div class="t"><b>'+X.esc(r.g.course+' · '+r.g.name)+'</b><span>'+X.dl(r.s.day)+' · '+hm(r.s.start_min)+'–'+hm(r.s.end_min)+(r.s.module?' · '+X.esc(r.s.module):'')+'</span></div><span class="pill flat">'+r.g.students+' alumnos</span></button>';
    }).join('')||'<p class="note">No hay clases recientes con alumnos. Si la clase es de hace más de 14 días, usa la ficha del alumno.</p>')+'</div>';
    S.list=rs;
    shell('Registrar la clase',h);return;
  }
  var r=S.sel;
  h+='<div class="ac-chosen"><b>'+X.esc(r.g.course+' · '+r.g.name)+'</b><span>'+X.dl(r.s.day)+' · '+hm(r.s.start_min)+(r.s.module?' · '+X.esc(r.s.module):'')+'</span><button type="button" class="btn s sm" data-ac="clsback">Cambiar clase</button></div>';
  if(!S.rows){h+='<p class="skel" role="status">Cargando alumnos…</p>';shell('Registrar la clase',h);return}
  h+='<div class="fi-acts" style="margin:0 0 10px"><button type="button" class="btn s sm" data-ac="allyes">Marcar a todos «Asistió»</button></div><div class="list">'+S.rows.map(function(x,i){
    return '<div class="row ac-att"><div class="t"><b>'+X.esc(x.name)+'</b>'+(x.err?'<span class="down">'+X.esc(x.err)+'</span>':x.ok?'<span class="in">Guardado</span>':'')+'</div><select data-ac-att="'+i+'" aria-label="Asistencia de '+X.esc(x.name)+'"'+(x.noses?' disabled':'')+'>'+Object.keys(ATT).map(function(k){return '<option value="'+k+'"'+(x.val===k?' selected':'')+'>'+ATT[k]+'</option>'}).join('')+'</select></div>';
  }).join('')+'</div><p class="note">Registrar la asistencia no cambia pagos ni cancela la clase de los demás.</p><div class="cu-foot"><button class="btn s" data-act="cerrar"'+(S.busy?' disabled':'')+'>Cerrar</button><button class="btn p" data-ac="clssave"'+(S.busy?' disabled':'')+'>Guardar asistencia</button></div>';
  shell('Registrar la clase',h);say(S.msg);S.msg='';
  S.rows.forEach(function(){});
}
function pickClase(i){
  var r=S.list[i];S.sel=r;S.rows=null;paintClase();
  var gd=X.demo?Promise.resolve({students:[{person_id:'p1',name:'Ana Pérez',enrolment_id:'e1'},{person_id:'p2',name:'Luis Gómez',enrolment_id:'e2'},{person_id:'p3',name:'Carlos Rojas',enrolment_id:'e3'}]}):X.rpc('forma_academic',{p_action:'group_detail',p_data:{group_id:r.g.id}});
  gd.then(function(d){
    var st=(d&&d.students||[]).filter(function(x){return x.state!=='cancelado'});
    return Promise.all(st.map(function(x){
      if(X.demo)return Promise.resolve({name:x.name,person_id:x.person_id,enrolment_id:x.enrolment_id,session_id:r.s.id,val:'pendiente',orig:'pendiente',ver:0});
      return X.edu('detail',{person_id:x.person_id}).then(function(dt){
        var se=(dt.sessions||[]).filter(function(y){return y.session_id===r.s.id&&y.enrolment_id===x.enrolment_id})[0];
        return{name:x.name,person_id:x.person_id,enrolment_id:x.enrolment_id,session_id:r.s.id,val:se?se.attendance:'pendiente',orig:se?se.attendance:'pendiente',ver:se?Number(se.attendance_version||0):0,noses:!se};
      },function(){return{name:x.name,person_id:x.person_id,enrolment_id:x.enrolment_id,session_id:r.s.id,val:'pendiente',orig:'pendiente',ver:0,noses:true,err:'No se pudo leer'}});
    }));
  }).then(function(rows){S.rows=rows;paintClase()},function(){S.sel=null;S.msg='No se pudieron cargar los alumnos de esa clase.';paintClase();say(S.msg)});
}
function saveClase(){
  if(S.busy)return;
  var ch=S.rows.filter(function(x){return !x.noses&&x.val!==x.orig});
  if(!ch.length){say('No cambiaste ninguna asistencia.');return}
  S.busy=true;paintClase();
  var i=0,fails=0;
  (function next(){
    var x=ch[i];
    if(!x){S.busy=false;if(!fails){X.refresh();X.dlg('Asistencia guardada','<div class="ac-ok">Se registró la asistencia de <b>'+ch.length+'</b> alumno(s).</div><div class="fi-acts"><button class="btn s" data-act="cerrar">Cerrar</button></div>',false)}else{S.msg='Se guardaron '+(ch.length-fails)+' y fallaron '+fails+'. Revisa las marcadas y pulsa guardar otra vez; no se duplica nada.';paintClase()}return}
    x.rid=x.rid||uuid();
    var d={enrolment_id:x.enrolment_id,session_id:x.session_id,status:x.val,expected:x.ver,request_id:x.rid};
    (X.demo?simulate('att'):X.rpc('forma_academic',{p_action:'attendance',p_data:d})).then(function(r){
      if(!r||!r.saved)throw Error('Sin confirmar');
      x.orig=x.val;x.ver=x.ver+1;x.ok=true;x.err='';x.rid=null;i++;next();
    },function(e){
      fails++;x.err=errText(e);if(e&&FATAL.indexOf(e.code)>-1)x.rid=null;i++;next();
    });
  })();
}

/* ---------- NUEVO INTERESADO ---------- */
var SOURCES={whatsapp:'WhatsApp',instagram:'Instagram',tiktok:'TikTok',facebook:'Facebook',presencial:'Presencial',recomendacion:'Recomendación',desconocido:'No sé'};
function openInt(){
  S={kind:'int',busy:false,pending:null,pid:null,person:null,isNew:true,f:{name:'',phone:'',email:'',area:'',source:'whatsapp',next:'',due:'',note:''}};
  shell('Nuevo interesado','<p class="skel" role="status">Cargando…</p>');
  X.cursos.load(false).then(function(){S.cat=X.cursos.cat()},function(){S.cat=null}).then(paintInt);
}
function paintInt(){
  var f=S.f,courses=(S.cat&&S.cat.courses||[]).filter(function(c){return c.active}).map(function(c){return c.name});
  var h='<form id="ac-if" class="cu-form ac-grid">'+field('Nombre completo','name','text',f.name,'required maxlength="160" autocomplete="off"')+field('Teléfono / WhatsApp','phone','tel',f.phone,'maxlength="40"')+field('Correo (opcional)','email','email',f.email,'maxlength="254"')+
   '<label>¿Por qué curso o servicio pregunta?<input name="area" list="ac-areas" value="'+X.esc(f.area)+'" required maxlength="120" placeholder="Elige o escribe"><datalist id="ac-areas">'+courses.map(function(c){return '<option value="'+X.esc(c)+'">'}).join('')+'</datalist></label>'+
   '<label>¿Cómo llegó?<select name="source">'+Object.keys(SOURCES).map(function(k){return '<option value="'+k+'"'+(f.source===k?' selected':'')+'>'+SOURCES[k]+'</option>'}).join('')+'</select></label>'+field('Próximo paso','next','text',f.next,'maxlength="400" placeholder="Ej.: enviar precios"')+field('Fecha del próximo paso','due','date',f.due,'min="'+X.T+'"')+'<label style="grid-column:1/-1">Nota<textarea name="note" rows="2" maxlength="1000">'+X.esc(f.note)+'</textarea></label></form>';
  h+='<p class="note">Antes de guardar, el sistema revisa si ya existe una persona con ese nombre o teléfono para no duplicarla.</p><div id="ac-dup"></div><div class="cu-foot"><button class="btn s" data-act="cerrar"'+(S.busy?' disabled':'')+'>Cancelar</button><button class="btn p" data-ac="intgo"'+(S.busy?' disabled':'')+'>'+(S.pending?'Reintentar el mismo registro':'Guardar interesado')+'</button></div>';
  shell('Nuevo interesado',h);say(S.msg);S.msg='';
}
function readInt(){
  var fd=new FormData($('#ac-if'));
  S.f={name:String(fd.get('name')||'').trim(),phone:String(fd.get('phone')||'').trim(),email:String(fd.get('email')||'').trim(),area:String(fd.get('area')||'').trim(),source:fd.get('source'),next:String(fd.get('next')||'').trim(),due:fd.get('due')||'',note:String(fd.get('note')||'').trim()};
  return S.f;
}
function saveInt(force){
  if(S.busy)return;
  var f=readInt();
  if(f.name.length<2){say('Escribe el nombre.');return}
  if(f.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)){say('Revisa el correo.');return}
  if(!f.area){say('Indica por qué curso o servicio pregunta.');return}
  if(f.due&&f.due<X.T){say('La fecha del próximo paso no puede estar en el pasado.');return}
  var go=function(){
    if(!S.pending)S.pending={pid:S.pid||uuid(),personRid:null,iid:uuid(),personDone:!!S.pid};
    var p=S.pending;S.busy=true;paintInt();
    var step1=p.personDone?Promise.resolve({saved:true}):(X.demo?simulate('person'):X.rpc('forma_crm',{p_action:'person_save',p_data:{person_id:null,expected:null,name:f.name,phone:f.phone,email:f.email,language:'es',booking_id:null,request_id:p.pid}}));
    step1.then(function(r){
      if(!r||!r.saved)throw Error('Sin confirmar');p.personDone=true;
      var d={person_id:p.pid,id:null,expected:null,area:f.area,stage:'nuevo',source:f.source,next_action:f.next,due_on:f.due||null,note:f.note,close_reason:'',request_id:p.iid};
      return X.demo?simulate('int'):X.rpc('forma_crm',{p_action:'interest_save',p_data:d});
    }).then(function(r){
      if(!r||!r.saved)throw Error('Sin confirmar');
      S.busy=false;X.refresh();
      X.dlg('Interesado guardado','<div class="ac-ok"><b>'+X.esc(f.name)+'</b> quedó como interesado en <b>'+X.esc(f.area)+'</b>.</div><div class="fi-acts"><button class="btn p" data-ac="intnew">Agregar otro</button><button class="btn s" data-act="interesados">Ver interesados</button></div>',false);
    },function(e){
      S.busy=false;if(e&&FATAL.indexOf(e.code)>-1&&S.pending&&!S.pending.personDone)S.pending=null;
      S.msg=errText(e);paintInt();
    });
  };
  if(force||S.pending)return go();
  S.busy=true;paintInt();
  (X.demo?Promise.resolve({items:[]}):X.edu('list',{query:f.name,offset:0,state:''})).then(function(d){
    S.busy=false;
    var q=norm(f.name),ph=f.phone.replace(/\D/g,''),dup=(d&&d.items||[]).filter(function(p){return norm(p.name)===q||(ph.length>=8&&String(p.phone||'').replace(/\D/g,'')===ph)});
    if(dup.length){
      paintInt();
      $('#ac-dup').innerHTML='<div class="err">Ya existe <b>'+X.esc(dup[0].name)+'</b> ('+X.esc(dup[0].phone||dup[0].email||'sin contacto')+'). Si es otra persona, guarda igual; si es la misma, ciérralo y búscala en Alumnos.</div><button type="button" class="btn s sm" data-ac="intforce">Es otra persona, guardar igual</button>';
    }else go();
  },function(){S.busy=false;go()});
}


/* ---------- AGENDAR UN SERVICIO ---------- */
function openAgendar(){
  X.cursos.load(false).then(openAgendar2,openAgendar2);
}
function openAgendar2(){
  var M=X.M,d=X.T;
  while(M.date(d).getUTCDay()===0)d=M.plus(d,1);
  S={kind:'ag',busy:false,pending:false,f:{client:'',phone:'',activity:'Mentoría particular',area:M.areas[0],instructor:'Sin asignar',room:'',start_date:d,start_hour:'15',duration:'1',sessions:'1',booking_state:'reservado',group_name:''}};
  paintAg();
}
function paintAg(){
  var M=X.M,f=S.f;
  var opt=function(list,v){return list.map(function(x){return '<option'+(x===v?' selected':'')+'>'+X.esc(x)+'</option>'}).join('')};
  var hours=[13,14,15,16,17].map(function(h){return '<option value="'+h+'"'+(String(h)===String(f.start_hour)?' selected':'')+'>'+h+':00</option>'}).join('');
  var h='<form id="ac-ag" class="cu-form ac-grid">'+field('Cliente o invitado','client','text',f.client,'required maxlength="160" autocomplete="off"')+field('Teléfono','phone','tel',f.phone,'maxlength="40"')+
   '<label>Actividad<select name="activity">'+opt(M.activities,f.activity)+'</select></label><label>Área<select name="area">'+opt(M.areas,f.area)+'</select></label><label>Instructor<select name="instructor">'+opt(M.instructors,f.instructor)+'</select></label>'+field('Sala (opcional)','room','text',f.room,'maxlength="60"')+
   field('Primer día','start_date','date',f.start_date,'required')+'<label>Hora de inicio<select name="start_hour">'+hours+'</select></label><label>Duración (horas)<select name="duration">'+[1,2,3,4,5].map(function(n){return '<option'+(String(n)===String(f.duration)?' selected':'')+'>'+n+'</option>'}).join('')+'</select></label>'+field('Cantidad de encuentros (1 por semana)','sessions','number',f.sessions,'min="1" max="52" data-nowheel="1"')+
   '<label>Estado<select name="booking_state"><option value="reservado"'+(f.booking_state==='reservado'?' selected':'')+'>Reservado</option><option value="por_confirmar"'+(f.booking_state==='por_confirmar'?' selected':'')+'>Por confirmar</option></select></label>'+field('Grupo (opcional)','group_name','text',f.group_name,'maxlength="80"')+'</form>';
  h+='<p class="note">Lunes a sábado, de 13:00 a 18:00. Si el instructor ya está ocupado, el sistema lo avisa y no guarda nada.</p><div class="cu-foot"><button class="btn s" data-act="cerrar"'+(S.busy?' disabled':'')+'>Cancelar</button><button class="btn p" data-ac="aggo"'+(S.busy?' disabled':'')+'>Guardar en la agenda</button></div>';
  shell('Agendar un servicio',h);say(S.msg);S.msg='';
}
function saveAg(){
  if(S.busy)return;
  var fd=new FormData($('#ac-ag')),g=function(k){return String(fd.get(k)==null?'':fd.get(k)).trim()};
  S.f={client:g('client'),phone:g('phone'),activity:g('activity'),area:g('area'),instructor:g('instructor'),room:g('room'),start_date:g('start_date'),start_hour:g('start_hour'),duration:g('duration'),sessions:g('sessions'),booking_state:g('booking_state'),group_name:g('group_name')};
  var f=S.f,b;
  try{
    b={client:f.client,phone:f.phone,activity:f.activity,area:f.area,profession:'',room:f.room,instructor:f.instructor,start_date:f.start_date,start_hour:Number(f.start_hour),duration:Number(f.duration),sessions:Number(f.sessions),instructors:[f.instructor],student_reference:'',booking_state:f.booking_state,override_conflict:false,override_reason:''};
    if(f.group_name)b.group_name=f.group_name;
    X.M.validate(b);
  }catch(e){say(e.message);return}
  S.busy=true;paintAg();
  (X.demo?simulate('ag'):X.rpc('forma_agenda_save',{p_id:null,p_expected:null,p_data:b,p_reason:''})).then(function(r){
    if(!r||!r.saved||!(r.id||X.demo))throw Error('Sin confirmar');
    S.busy=false;X.refresh();
    X.dlg('Reserva guardada','<div class="ac-ok"><b>'+X.esc(b.client)+'</b> quedó agendado: '+X.esc(b.activity)+' · '+X.dl(b.start_date)+' · '+b.start_hour+':00'+(b.sessions>1?' · '+b.sessions+' encuentros':'')+'.</div><div class="fi-acts"><button class="btn p" data-ac="agnew">Agendar otro</button><button class="btn s" data-act="cerrar">Cerrar</button></div>',false);
  },function(e){
    S.busy=false;
    S.msg=/timeout/i.test((e&&e.message)||'')?'No se confirmó a tiempo. Mira la Agenda antes de guardar otra vez para no duplicar la reserva.':errText(e);
    paintAg();
  });
}

/* ---------- EDITAR UNA RESERVA (reprogramar o cancelar) ---------- */
function openEditRes(b){
  S={kind:'edb',busy:false,ask:false,b:b,msg:''};paintEd();
}
function paintEd(){
  var M=X.M,b=S.b,opt=function(list,v){return list.map(function(x){return '<option'+(x===v?' selected':'')+'>'+X.esc(x)+'</option>'}).join('')};
  var hrs=[13,14,15,16,17].map(function(h){return '<option value="'+h+'"'+(Number(b.start_hour)===h?' selected':'')+'>'+h+':00</option>'}).join('');
  var ins=M.instructors.slice();if(ins.indexOf(b.instructor)<0&&b.instructor)ins.push(b.instructor);
  var h='<p class="note"><b>'+X.esc(b.client)+'</b> · '+X.esc(b.activity||'')+'. Cambia lo que haga falta y guarda; el sistema avisa si el instructor ya está ocupado.</p><form id="ac-ed" class="cu-form ac-grid">'+field('Primer día','start_date','date',b.start_date,'required')+
   '<label>Hora de inicio<select name="start_hour">'+hrs+'</select></label><label>Duración (horas)<select name="duration">'+[1,2,3,4,5].map(function(n){return '<option'+(n===Number(b.duration)?' selected':'')+'>'+n+'</option>'}).join('')+'</select></label>'+field('Cantidad de encuentros','sessions','number',b.sessions,'min="1" max="52" data-nowheel="1"')+
   '<label>Instructor<select name="instructor">'+opt(ins,b.instructor)+'</select></label>'+field('Sala','room','text',b.room||'','maxlength="60"')+
   '<label>Estado<select name="booking_state"><option value="reservado"'+(b.booking_state!=='por_confirmar'?' selected':'')+'>Reservado</option><option value="por_confirmar"'+(b.booking_state==='por_confirmar'?' selected':'')+'>Por confirmar</option></select></label>'+field('Motivo (obligatorio para cancelar)','reason','text',S.reason||'','maxlength="200"')+'</form>';
  h+='<div class="cu-foot"><button class="btn s" data-act="cerrar"'+(S.busy?' disabled':'')+'>Cerrar</button>'+(S.ask?'<button class="btn s" data-ac="edcancel2"'+(S.busy?' disabled':'')+' style="color:#B42318;border-color:#B42318">Sí, cancelar toda la serie</button>':'<button class="btn s" data-ac="edcancel"'+(S.busy?' disabled':'')+'>Cancelar la reserva</button>')+'<button class="btn p" data-ac="edgo"'+(S.busy?' disabled':'')+'>Guardar cambios</button></div>';
  shell('Reprogramar o cancelar',h);say(S.msg);S.msg='';
}
function readEd(){
  var fd=new FormData($('#ac-ed')),g=function(k){return String(fd.get(k)==null?'':fd.get(k)).trim()};
  return {start_date:g('start_date'),start_hour:Number(g('start_hour')),duration:Number(g('duration')),sessions:Number(g('sessions')),instructor:g('instructor'),room:g('room'),booking_state:g('booking_state'),reason:g('reason')};
}
function saveEd(){
  if(S.busy)return;var f=readEd(),o=S.b;S.reason=f.reason;
  var b={client:o.client,phone:o.phone||'',activity:o.activity,area:o.area,profession:o.profession||'',room:f.room,instructor:f.instructor,start_date:f.start_date,start_hour:f.start_hour,duration:f.duration,sessions:f.sessions,instructors:f.instructor===o.instructor&&o.instructors&&o.instructors.length?o.instructors:[f.instructor],student_reference:o.student_reference||'',booking_state:f.booking_state,override_conflict:false,override_reason:''};
  if(o.group_name)b.group_name=o.group_name;
  try{X.M.validate(b)}catch(e){S.msg=e.message;paintEd();return}
  S.busy=true;paintEd();
  (X.demo?simulate('ed'):X.rpc('forma_agenda_save',{p_id:o.id,p_expected:o.version,p_data:b,p_reason:f.reason||'Reprogramación desde Gestión'})).then(function(r){
    if(!r||!r.saved)throw Error('Sin confirmar');
    S.busy=false;X.refresh();
    X.dlg('Reserva actualizada','<div class="ac-ok"><b>'+X.esc(b.client)+'</b>: '+X.dl(b.start_date)+' · '+b.start_hour+':00 · '+b.sessions+' encuentro(s).</div><div class="fi-acts"><button class="btn p" data-act="cerrar">Cerrar</button></div>',false);
  },function(e){S.busy=false;S.msg=/timeout/i.test((e&&e.message)||'')?'No se confirmó a tiempo. Mira la Agenda antes de guardar otra vez.':errText(e);paintEd()});
}
function cancelEd(){
  if(S.busy)return;var f=readEd();S.reason=f.reason;
  if(!S.ask){S.ask=true;S.msg=f.reason?'Confirma: se cancelan todas las sesiones y se libera el horario. El historial se conserva.':'Escribe el motivo de cancelación y vuelve a pulsar.';if(!f.reason)S.ask=false;paintEd();return}
  if(!f.reason){S.ask=false;S.msg='Escribe el motivo de cancelación.';paintEd();return}
  S.busy=true;paintEd();
  (X.demo?Promise.resolve({cancelled:true}):X.rpc('forma_agenda_cancel',{p_id:S.b.id,p_expected:S.b.version,p_reason:f.reason})).then(function(r){
    if(!r||!r.cancelled)throw Error('Sin confirmar');
    S.busy=false;X.refresh();
    X.dlg('Reserva cancelada','<div class="ac-ok">La serie de <b>'+X.esc(S.b.client)+'</b> quedó cancelada y el horario está libre. El historial se conserva.</div><div class="fi-acts"><button class="btn p" data-act="cerrar">Cerrar</button></div>',false);
  },function(e){S.busy=false;S.ask=false;S.msg=errText(e);paintEd()});
}

/* ---------- EDITAR UNA MATRÍCULA ---------- */
function openEditMat(person,e){S={kind:'edm',busy:false,p:person,e:e,msg:''};paintEdm()}
function paintEdm(){
  var e=S.e,st=[['activo','En curso'],['matriculado','Matriculado'],['pausa','En pausa'],['concluido','Concluido'],['cancelado','Cancelado']];
  var h='<p class="note"><b>'+X.esc(S.p.name)+'</b> · '+X.esc(e.course||'')+(e.group_name?' · '+X.esc(e.group_name):'')+'</p><form id="ac-em" class="cu-form ac-grid"><label>Estado<select name="state">'+st.map(function(x){return '<option value="'+x[0]+'"'+(x[0]===e.state?' selected':'')+'>'+x[1]+'</option>'}).join('')+'</select></label>'+
   (e.group_id?'<p class="note">Las fechas vienen del grupo; se cambian en Cursos o en la Agenda.</p>':field('Empieza','starts_on','date',e.starts_on||'')+field('Termina','ends_on','date',e.ends_on||''))+'</form><p class="note">El valor del curso y los pagos no cambian aquí: para cobrar usa «Cobrar un pago».</p>';
  h+='<div class="cu-foot"><button class="btn s" data-act="cerrar"'+(S.busy?' disabled':'')+'>Cerrar</button><button class="btn p" data-ac="emgo"'+(S.busy?' disabled':'')+'>Guardar</button></div>';
  shell('Editar matrícula',h);say(S.msg);S.msg='';
}
function saveEdm(){
  if(S.busy)return;var fd=new FormData($('#ac-em')),g=function(k){return String(fd.get(k)==null?'':fd.get(k)).trim()};
  var d={person_id:S.p.id,enrolment_id:S.e.id,expected:S.e.version,state:g('state'),starts_on:g('starts_on'),ends_on:g('ends_on')};
  if(d.starts_on&&d.ends_on&&d.ends_on<d.starts_on){S.msg='La fecha final no puede ser anterior a la inicial.';paintEdm();return}
  S.busy=true;paintEdm();
  (X.demo?simulate('em'):X.edu('update',d)).then(function(r){
    S.busy=false;X.refresh();
    X.dlg('Matrícula actualizada','<div class="ac-ok">Los cambios de <b>'+X.esc(S.p.name)+'</b> quedaron guardados.</div><div class="fi-acts"><button class="btn p" data-act="cerrar">Cerrar</button></div>',false);
  },function(e){S.busy=false;S.msg=errText(e);paintEdm()});
}

/* ---------- CORREGIR (siempre con motivo; el original se conserva en el historial del servidor) ---------- */
function reopenFicha(pid){if(X.reficha&&pid)X.reficha(pid);else X.refresh()}
function reasonField(v){return field('Motivo de la corrección (obligatorio)','reason','text',v||'','required minlength="3" maxlength="500" placeholder="Ej.: error al registrar"')}

/* Corregir condiciones del curso: valor acordado, entrada y cuotas. Conserva todos los pagos ya recibidos. */
function openContract(person,e,ficha){
  var paid=Number(e.paid_cents||0),sch=Array.isArray(e.payment_schedule)?e.payment_schedule:[],Q;
  if(sch.length&&sch[0].label==='Entrada'){
    var cu=sch.slice(1);
    Q={total:eur(Number(e.total_cents)),ent:eur(Number(sch[0].amount_cents)),entDue:sch[0].due_on,n:cu.length,first:cu.length?cu[0].due_on:isoAdd(sch[0].due_on,1),dates:cu.map(function(x){return x.due_on}),terms:sch[0].terms||null,listC:sch[0].terms?Number(sch[0].terms.list_cents||0):0,disc:sch[0].terms?String(sch[0].terms.reason||''):''};
  }else if(sch.length){
    Q={total:eur(Number(e.total_cents)),ent:'0,00',entDue:X.T,n:sch.length,first:sch[0].due_on,dates:sch.map(function(x){return x.due_on}),legacy:true};
  }else{
    var fee=Number(e.fee_cents||0),n=Number(e.installments||0);
    Q={total:eur(Number(e.total_cents)),ent:eur(fee),entDue:e.fee_due||X.T,n:(n<1&&Number(e.total_cents)>fee)?1:n,first:e.first_due||X.T,dates:[]};
  }
  S={kind:'ctr',busy:false,pending:null,p:person,e:e,f:ficha,Q:Q,reason:'',msg:''};paintContract();
}
function paintContract(){
  var e=S.e,Q=S.Q;
  var h='<p class="note"><b>'+X.esc(S.p.name)+'</b> · '+X.esc(e.course||'')+(e.group_name?' · '+X.esc(e.group_name):'')+'</p>'
   +'<div class="ac-rev"><p><small>Valor actual</small><b>'+X.R(Number(e.total_cents))+'</b></p><p><small>Ya recibido (se conserva)</small><b>'+X.R(Number(e.paid_cents||0))+'</b></p></div>'
   +(Q.legacy?'<p class="note">Este plan tenía importes personalizados. Al guardar, las cuotas se calculan en partes iguales.</p>':'')
   +planHTML(Q)
   +'<form id="ac-cr" class="cu-form" onsubmit="return false">'+reasonField(S.reason)+'</form>'
   +'<p class="note">Corregir no borra nada: los pagos recibidos y el plan anterior quedan en el historial.</p>'
   +'<div class="cu-foot"><button class="btn s" data-act="cerrar"'+(S.busy?' disabled':'')+'>Cerrar</button><button class="btn p" data-ac="ctgo"'+(S.busy?' disabled':'')+'>'+(S.pending?'Reintentar el mismo registro':'Guardar la corrección')+'</button></div>';
  shell('Corregir condiciones',h);wirePlan(Q);say(S.msg);S.msg='';
}
function saveContract(){
  if(S.busy)return;
  var Q=S.Q,c=PQ&&PQ.calc||calcPlan(Q),f=$('#ac-cr'),reason=f?String(new FormData(f).get('reason')||'').trim():S.reason;S.reason=reason;
  if(c.err){say(c.err);return}
  if(c.total<Number(S.e.paid_cents||0)){say('El valor no puede quedar por debajo de lo ya recibido ('+X.R(Number(S.e.paid_cents||0))+').');return}
  if(reason.length<3){say('Escribe el motivo de la corrección.');return}
  if(!S.pending)S.pending={person_id:S.p.id,enrolment_id:S.e.id,expected:S.e.version,fee_cents:c.fee,monthly_cents:c.monthly,installments:c.n,fee_due:c.ent>0?Q.entDue:Q.first,first_due:c.n>0?Q.first:Q.entDue,payment_schedule:withTerms(c,Q),reason:reason,request_id:uuid()};
  S.busy=true;
  eduCall('contract',S.pending).then(function(r){
    if(!r||!r.saved)throw Error('Sin confirmar');
    S.busy=false;S.pending=null;X.refresh();reopenFicha(S.p.id);
  },function(er){S.busy=false;if(er&&FATAL.indexOf(er.code)>-1)S.pending=null;S.msg=errText(er);paintContract()});
}

/* Corregir un pago registrado (queda el original anulado + uno nuevo) o anularlo si fue un error. */
function openFixPay(person,r){S={kind:'fpy',busy:false,pending:null,ask:false,p:person,r:r,msg:'',v:null};paintFixPay()}
function paintFixPay(){
  var r=S.r,v=S.v||(S.v={amount:eur(Number(r.amount_cents)),paid_on:r.paid_on,method:r.method||'pix',card:r.card_type||'',note:r.note||'Pago recibido',reason:''});
  var h='<p class="note"><b>'+X.esc(S.p.name)+'</b> · pago de '+X.R(Number(r.amount_cents))+' del '+dmy(r.paid_on)+'. El original se conserva como anulado.</p><form id="ac-fp" class="cu-form ac-grid">'
   +field('Importe correcto (R$)','amount','text',v.amount,'inputmode="decimal" required')+field('Fecha real del pago','paid_on','date',v.paid_on,'required max="'+X.T+'" min="2020-01-01"')
   +'<label>Medio<select name="method">'+Object.keys(METHODS).map(function(k){return '<option value="'+k+'"'+(v.method===k?' selected':'')+'>'+METHODS[k]+'</option>'}).join('')+'</select></label><label>Tarjeta (si corresponde)<select name="card"><option value="">No corresponde</option><option value="credito"'+(v.card==='credito'?' selected':'')+'>Crédito</option><option value="debito"'+(v.card==='debito'?' selected':'')+'>Débito</option></select></label>'
   +field('Concepto / referencia','note','text',v.note,'required maxlength="500"')+reasonField(v.reason)+'</form>'
   +'<p class="note">«Anular» es solo para un error de registro (por ejemplo, un pago cargado dos veces). No es una devolución de dinero.</p>'
   +'<div class="cu-foot"><button class="btn s" data-act="cerrar"'+(S.busy?' disabled':'')+'>Cerrar</button>'+(S.ask?'<button class="btn s" data-ac="fpvoid2"'+(S.busy?' disabled':'')+' style="color:#B42318;border-color:#B42318">Sí, anular este pago</button>':'<button class="btn s" data-ac="fpvoid"'+(S.busy?' disabled':'')+'>Anular el pago</button>')+'<button class="btn p" data-ac="fpgo"'+(S.busy?' disabled':'')+'>'+(S.pending?'Reintentar el mismo registro':'Guardar la corrección')+'</button></div>';
  shell('Corregir un pago',h);say(S.msg);S.msg='';
}
function readFp(){var f=$('#ac-fp'),d=new FormData(f);S.v={amount:d.get('amount'),paid_on:d.get('paid_on'),method:d.get('method'),card:d.get('card'),note:String(d.get('note')||'').trim(),reason:String(d.get('reason')||'').trim()};return S.v}
function saveFixPay(){
  if(S.busy)return;var v=readFp(),r=S.r,am;
  try{am=cents(v.amount)}catch(e){say(e.message);return}
  if(!am){say('Escribe el importe correcto.');return}
  if(!v.paid_on||v.paid_on>X.T){say('Revisa la fecha real del pago.');return}
  if(v.method==='tarjeta'&&!v.card){say('Indica si la tarjeta fue crédito o débito.');return}
  if(!v.note){say('Escribe un concepto.');return}
  if(v.reason.length<3){say('Escribe el motivo de la corrección.');return}
  if(!S.pending){var d={person_id:S.p.id,receipt_id:r.id,amount_cents:am,paid_on:v.paid_on,method:v.method,card_type:v.method==='tarjeta'?v.card:'',note:v.note,reason:v.reason,request_id:uuid()};if(r.module!==undefined&&X.cursos&&X.cursos.cat()&&X.cursos.cat().academic_version===2)d.module=r.module||'';S.pending=d}
  S.busy=true;paintFixPay();
  eduCall('replace_payment',S.pending).then(function(x){
    if(!x||!x.saved)throw Error('Sin confirmar');S.busy=false;S.pending=null;X.refresh();reopenFicha(S.p.id);
  },function(er){S.busy=false;if(er&&FATAL.indexOf(er.code)>-1)S.pending=null;S.msg=errText(er);paintFixPay()});
}
function voidPay(){
  if(S.busy)return;var v=readFp();
  if(!S.ask){S.ask=true;S.msg=v.reason.length>=3?'Confirma: el pago queda anulado y el saldo se recalcula. El comprobante original se conserva.':'Escribe el motivo y vuelve a pulsar.';if(v.reason.length<3)S.ask=false;paintFixPay();return}
  if(v.reason.length<3){S.ask=false;S.msg='Escribe el motivo de la anulación.';paintFixPay();return}
  S.busy=true;paintFixPay();
  eduCall('void_payment',{person_id:S.p.id,receipt_id:S.r.id,reason:v.reason,request_id:uuid()}).then(function(x){
    if(!x||!x.saved)throw Error('Sin confirmar');S.busy=false;X.refresh();reopenFicha(S.p.id);
  },function(er){S.busy=false;S.ask=false;S.msg=errText(er);paintFixPay()});
}

/* Corregir los datos de contacto del alumno (misma ficha, sin crear otra) */
function openEditPerson(person){S={kind:'epr',busy:false,pending:null,p:person,msg:''};paintEp()}
function paintEp(){
  var p=S.p;
  var h='<form id="ac-ep" class="cu-form ac-grid">'+field('Nombre completo','name','text',p.name,'required minlength="2" maxlength="160"')+field('Teléfono (WhatsApp)','phone','tel',p.phone||'','maxlength="40"')+field('Correo del alumno','email','email',p.email||'','maxlength="254"')+'<label>Idioma<select name="language"><option value="es"'+(p.language!=='pt'?' selected':'')+'>Español</option><option value="pt"'+(p.language==='pt'?' selected':'')+'>Português</option></select></label></form>'
   +'<p class="note">Corrige esta misma ficha. Los comprobantes ya emitidos conservan el nombre original. Si cambias el correo de un alumno con acceso, revisa su vínculo.</p>'
   +'<div class="cu-foot"><button class="btn s" data-act="cerrar"'+(S.busy?' disabled':'')+'>Cerrar</button><button class="btn p" data-ac="epgo"'+(S.busy?' disabled':'')+'>Guardar</button></div>';
  shell('Corregir datos del alumno',h);say(S.msg);S.msg='';
}
function saveEp(){
  if(S.busy)return;var d=new FormData($('#ac-ep')),g=function(k){return String(d.get(k)==null?'':d.get(k)).trim()};
  var name=g('name'),email=g('email');
  if(name.length<2){say('Escribe el nombre.');return}
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){say('Revisa el correo.');return}
  if(!S.pending)S.pending={person_id:S.p.id,expected:S.p.version,name:name,phone:g('phone'),email:email,language:g('language'),request_id:uuid()};
  S.busy=true;paintEp();
  eduCall('person_edit',S.pending).then(function(x){
    if(!x||!x.saved)throw Error('Sin confirmar');S.busy=false;S.pending=null;X.refresh();reopenFicha(S.p.id);
  },function(er){S.busy=false;if(er&&FATAL.indexOf(er.code)>-1)S.pending=null;S.msg=errText(er);paintEp()});
}

/* ---------- eventos ---------- */
function click(e){
  var b=e.target.closest('[data-ac]');if(!b||!S)return false;
  var k=b.dataset.ac;
  if(k==='newp'){S.isNew=true;S.person=null;paintMat()}
  else if(k==='chg'){S.person=null;S.detail=null;S.isNew=false;S.enrId=null;S.pending=null;S.kind==='mat'?paintMat():paintPay()}
  else if(k==='pick'){
    var id=b.dataset.id;$('#ac-res').innerHTML='<p class="skel" role="status">Consultando ficha…</p>';
    loadPerson(id).then(function(){S.kind==='mat'?paintMat():paintPay()},function(){say('No se pudo cargar la ficha.')});
  }
  else if(k==='grp'){S.gid=b.dataset.id;paintMat()}
  else if(k==='next')stepNext();
  else if(k==='back'){if(S.step>1&&!S.busy){if(S.step===3)readPay();S.step--;paintMat()}}
  else if(k==='go')confirmMat();
  else if(k==='paygo')confirmPay();
  else if(k==='cobrar-after')openPay(S.after);
  else if(k==='mat-from-pay')openMat({person_id:S.person.id});
  else if(k==='cls')pickClase(Number(b.dataset.i));
  else if(k==='clsback'){S.sel=null;S.rows=null;paintClase()}
  else if(k==='allyes'){S.rows.forEach(function(x){if(!x.noses)x.val='asistio'});paintClase()}
  else if(k==='clssave')saveClase();
  else if(k==='intgo')saveInt(false);
  else if(k==='intforce')saveInt(true);
  else if(k==='intnew')openInt();
  else if(k==='aggo')saveAg();
  else if(k==='agnew')openAgendar();
  else if(k==='edgo')saveEd();
  else if(k==='edcancel'||k==='edcancel2')cancelEd();
  else if(k==='emgo')saveEdm();
  else if(k==='ctgo')saveContract();
  else if(k==='fpgo')saveFixPay();
  else if(k==='fpvoid'||k==='fpvoid2')voidPay();
  else if(k==='epgo')saveEp();
  else if(k==='qn'){PQ.n=Number(b.dataset.n);var ni=$('.ac-n');if(ni)ni.value=PQ.n;PQ.dates=(PQ.dates||[]).slice(0,PQ.n);paintPlan()}
  return true;
}
document.addEventListener('change',function(e){var t=e.target;if(S&&S.kind==='cls'&&t&&t.dataset&&t.dataset.acAtt!==undefined){S.rows[Number(t.dataset.acAtt)].val=t.value}});
function wheel(e){var t=e.target;if(t&&t.matches&&t.matches('input[data-nowheel]'))t.blur()}
document.addEventListener('wheel',wheel,{passive:true});

window.GestionAcciones={
  init:function(ctx){X=ctx},
  matricular:openMat,
  cobrar:openPay,
  clase:openClase,
  interesado:openInt,
  agendar:openAgendar,
  editarReserva:openEditRes,
  editarMatricula:openEditMat,
  corregirCondiciones:openContract,
  corregirPago:openFixPay,
  corregirPersona:openEditPerson,
  click:click
};
})();
