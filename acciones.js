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
function eduCall(a,d){return X.demo&&(a==='person'||a==='payment')?simulate(a):X.edu(a,d)}
function acaCall(a,d){return X.demo&&a==='enrol_group'?simulate(a):X.rpc('forma_academic',{p_action:a,p_data:d})}

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
      return '<button type="button" class="row ac-g'+(x.g.id===S.gid?' on':'')+'"'+(full?' disabled':'')+' data-ac="grp" data-id="'+X.esc(x.g.id)+'"><div class="t"><b>'+X.esc(x.g.course)+' · '+X.esc(x.g.name)+'</b><span>'+(x.from?X.dl(x.from)+' → '+X.dl(x.to):'Sin fechas')+' · '+X.esc(x.g.room||'')+'</span></div><span class="pill '+(full?'down':x.left<=2?'flat':'up')+'">'+(full?'Completo':x.left+(x.left===1?' cupo':' cupos'))+'</span></button>';
    }).join('')||'<p class="note">No hay grupos abiertos. Crea uno en Cursos.</p>')+'</div>';
    h+='<div class="cu-foot"><button class="btn s" data-ac="back">Atrás</button><button class="btn p" data-ac="next">Siguiente</button></div>';
  }
  if(S.step===3){
    var ex=existingEnrol(g),p=S.pay||(S.pay={fee:eur(g.fee_cents),inst:String(g.installments),monthly:eur(g.monthly_cents),adv:'',fee_due:X.T,first_due:X.T,paid_on:X.T,method:'pix',card:'credito',conf:false,portal:false});
    h+='<h3>Condiciones de pago</h3>';
    if(ex)h+='<p class="note">Esta persona ya tiene una matrícula de <b>'+X.esc(ex.course)+'</b> sin grupo. Se vincula a ese grupo y se conservan sus pagos y su contrato.</p>';
    else h+='<form id="ac-pay" class="cu-form ac-grid">'+field('Matrícula / reserva (R$)','fee','text',p.fee,'inputmode="decimal"')+field('Cantidad de cuotas','inst','number',p.inst,'min="0" max="60" data-nowheel="1"')+field('Valor de cada cuota (R$)','monthly','text',p.monthly,'inputmode="decimal"')+field('Vence la matrícula','fee_due','date',p.fee_due,'')+field('Vence la 1.ª cuota','first_due','date',p.first_due,'')+'</form><div id="ac-tot" class="note"></div>';
    h+='<form id="ac-adv" class="cu-form ac-grid">'+field('Abono recibido hoy (R$, opcional)','adv','text',p.adv,'inputmode="decimal" placeholder="0,00"')+field('Fecha real del pago','paid_on','date',p.paid_on,'max="'+X.T+'"')+'<label>Medio<select name="method">'+Object.keys(METHODS).map(function(k){return '<option value="'+k+'"'+(p.method===k?' selected':'')+'>'+METHODS[k]+'</option>'}).join('')+'</select></label><label>Tarjeta<select name="card"><option value="credito"'+(p.card==='credito'?' selected':'')+'>Crédito</option><option value="debito"'+(p.card==='debito'?' selected':'')+'>Débito</option></select></label><label class="ac-chk"><input name="conf" type="checkbox"'+(p.conf?' checked':'')+'> Confirmo que el dinero fue recibido.</label><label class="ac-chk"><input name="portal" type="checkbox"'+(p.portal?' checked':'')+'> Habilitar acceso del alumno a su área</label></form>';
    h+='<div class="cu-foot"><button class="btn s" data-ac="back">Atrás</button><button class="btn p" data-ac="next">Revisar</button></div>';
  }
  if(S.step===4){
    var d=S.payload,tot=d.total;
    h+='<h3>Revisa y confirma</h3><div class="ac-rev"><p><small>Alumno</small><b>'+X.esc(S.person?S.person.name:S.np.name)+(S.isNew?' (persona nueva)':'')+'</b></p><p><small>Grupo</small><b>'+X.esc(g.course+' · '+g.name)+'</b></p><p><small>Contrato</small><b>'+X.R(tot)+'</b>'+(d.ex?' <span class="note">(matrícula existente)</span>':'')+'</p><p><small>Abono hoy</small><b>'+X.R(d.adv)+'</b></p><p><small>Quedará por pagar</small><b>'+X.R(tot-d.adv-d.paidBefore)+'</b></p></div>';
    h+='<div class="cu-foot"><button class="btn s" data-ac="back"'+(S.busy?' disabled':'')+'>Atrás</button><button class="btn p" data-ac="go"'+(S.busy?' disabled':'')+'>'+(S.pending?'Reintentar el mismo registro':'Confirmar matrícula')+'</button></div>';
  }
  shell('Matricular un alumno',h);
  if(S.step===1&&!S.person&&!S.isNew)wirePerson(true);
  if(S.step===3)wireTotals();
  say(S.msg);S.msg='';
}
function existingEnrol(g){
  if(!S.person||S.isNew||!S.detail)return null;
  var c=norm(g.course);
  return(S.detail.enrolments||[]).filter(function(e){return !e.group_id&&e.state!=='cancelado'&&norm(e.course)===c})[0]||null;
}
function readPay(){
  var f=$('#ac-pay'),a=$('#ac-adv'),p=S.pay;
  if(f){var v=new FormData(f);p.fee=v.get('fee');p.inst=v.get('inst');p.monthly=v.get('monthly');p.fee_due=v.get('fee_due');p.first_due=v.get('first_due')}
  if(a){var w=new FormData(a);p.adv=w.get('adv');p.paid_on=w.get('paid_on');p.method=w.get('method');p.card=w.get('card');p.conf=!!a.elements.conf.checked;p.portal=!!a.elements.portal.checked}
}
function totalOf(){
  var p=S.pay;return cents(p.fee)+Number(p.inst||0)*cents(p.monthly);
}
function wireTotals(){
  var upd=function(){var t=$('#ac-tot');if(!t)return;try{readPay();var n=Number(S.pay.inst);t.textContent='Total del contrato: '+X.R(totalOf())+' ('+X.R(cents(S.pay.fee))+' + '+n+' × '+X.R(cents(S.pay.monthly))+')'}catch(e){t.textContent='Revisa los importes.'}};
  var f=$('#ac-pay');if(f){f.oninput=upd;upd()}
}
function buildPayload(){
  var g=curG(),ex=existingEnrol(g);
  readPay();var p=S.pay;
  if(!g||!g.active||g.students>=g.capacity)throw Error('El grupo no está disponible o no tiene cupos.');
  if(!(g.sessions||[]).length)throw Error('Este grupo no tiene encuentros. Prepáralo en Cursos.');
  var adv=cents(p.adv),fee,monthly,inst,total,paidBefore=0;
  if(ex){total=Number(ex.total_cents);paidBefore=Number(ex.paid_cents||0);fee=null}
  else{
    fee=cents(p.fee);monthly=cents(p.monthly);inst=Number(p.inst);
    if(!Number.isInteger(inst)||inst<0||inst>60)throw Error('Revisa la cantidad de cuotas (de 0 a 60).');
    total=fee+monthly*inst;
    if(total<=0)throw Error('El contrato debe tener un valor mayor que cero.');
    if(!p.fee_due||!p.first_due)throw Error('Indica las fechas de vencimiento.');
  }
  if(adv>total-paidBefore)throw Error('El abono supera el saldo. Revisa el importe.');
  if(adv>0){
    if(!p.conf)throw Error('Marca que recibiste el dinero antes de registrar el abono.');
    if(!p.paid_on||p.paid_on>X.T)throw Error('Revisa la fecha real del pago.');
  }
  var email=S.isNew?S.np.email:(S.person&&S.person.email);
  if(p.portal&&!email)throw Error('Para habilitar el acceso del alumno hace falta su correo.');
  return{ex:ex,adv:adv,total:total,paidBefore:paidBefore,fee:fee,monthly:monthly,inst:inst};
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
    if(S.step===2){if(!S.gid)throw Error('Elige un grupo.');S.pay=null}
    if(S.step===3){S.payload=buildPayload()}
    S.step++;paintMat();
  }catch(e){say(e.message)}
}
function confirmMat(){
  if(S.busy)return;
  var g=curG(),pl=S.payload,p=S.pay;
  if(!S.pending){
    var steps=[];
    if(S.isNew&&!S.personId)steps.push({api:'edu',a:'person',d:{name:S.np.name,phone:S.np.phone,email:S.np.email,language:'es',person_id:null,request_id:uuid()}});
    var en={group_id:g.id,expected:g.version,existing_enrolment_id:pl.ex?pl.ex.id:null,fee_due:p.fee_due,first_due:p.first_due,advance_cents:pl.adv,paid_on:p.paid_on,method:p.method,card_type:p.method==='tarjeta'?p.card:'',confirmed:!!p.conf,portal:!!p.portal,request_id:uuid()};
    if(!pl.ex&&S.cat.academic_version===2){en.fee_cents=pl.fee;en.monthly_cents=pl.monthly;en.installments=pl.inst;en.payment_schedule=[]}
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
  var v=S.form||{amount:'',paid_on:X.T,method:'pix',card:'',note:'Pago recibido',conf:false};S.form=v;
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
  click:click
};
})();
