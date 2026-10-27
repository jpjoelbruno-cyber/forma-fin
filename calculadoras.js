/* Calculadoras del área personal: interés compuesto, independencia financiera y primer millón.
   Todo ocurre en el navegador: no envía ni guarda cifras. Solo recuerda idioma y moneda en este equipo. */
(()=>{'use strict';
const C=window.FormaCalc;if(!C)return;
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const BLUE='#2f6fdd',GREEN='#1f9d6b',GOAL='#c2410c';
const CUR={BRL:['pt-BR','R$ Real'],USD:['en-US','US$ Dólar'],EUR:['es-ES','€ Euro'],ARS:['es-AR','$ Peso argentino'],MXN:['es-MX','$ Peso mexicano'],COP:['es-CO','$ Peso colombiano'],CLP:['es-CL','$ Peso chileno'],PEN:['es-PE','S/ Sol'],UYU:['es-UY','$ Peso uruguayo'],PYG:['es-PY','₲ Guaraní']};
const REGION={AR:'ARS',MX:'MXN',CO:'COP',CL:'CLP',PE:'PEN',UY:'UYU',PY:'PYG',US:'USD',ES:'EUR',PT:'EUR',BR:'BRL'};
const T={
es:{title:'Calculadoras',sub:'Escribe tus números y mira el resultado al instante.',t1:'Interés',t2:'Independencia',t3:'Primer millón',
 ini:'Monto inicial',ap:'Aporte mensual',rate:'Tasa de rendimiento',time:'Tiempo',year:'Año',month:'Mes',years:'Años',months:'Meses',
 eqM:'equivale a {x}% al mes',eqY:'equivale a {x}% al año',isM:'son {x} meses',isY:'son {x}',ex:'Ejemplos al año:',exY:'al año',
 put:'Tú pusiste',gain:'Rendimientos',will:'Tendrás en {t}',bridge:'Con este total podrías retirar {x} al mes',bridgeBtn:'Usar en Independencia →',
 want:'Quiero recibir al mes',have:'Ya tengo',haveLinked:'viene de tu simulación de interés compuesto',need:'Necesitas juntar',rule:'regla del {p}% al año',
 prog:'Hoy vas en',arrive:'Con tu aporte llegas en',cons:'Conservador',mod:'Moderado',risk:'Arriesgado',recv:'Recibirías {x}/mes con lo que tienes',
 goal:'Mi meta',gm1:'¿En cuánto tiempo llego?',gm2:'¿Cuánto aporto para llegar en…?',reach:'Llegas a tu meta en',mustAp:'Debes aportar al mes',
 hit:'Etapas del camino',grow:'Cómo va creciendo',sum:'Resumen',full:'Completo',seeAll:'Ver todo mes a mes ({n} meses) ▾',seeLess:'Ver menos ▴',
 stage:'Etapa',colPut:'Tú pusiste',colGain:'Rendimiento',colTotal:'Total',colPm:'Rinde por mes',colAp:'Aportaste',colRin:'Rinde',colAcc:'Rend. acumulado',vals:'Valores',start:'Inicio',
 yearN:'Año {n}',monthN:'Mes {n}',bad:'Revisa los números: algún valor está vacío o fuera de rango.',never:'Con estos números no llegas a la meta en 100 años.',
 foot:'Ejemplo educativo. Las tasas son estimaciones que tú escribes: no son una promesa de rentabilidad ni una recomendación de inversión. Los cálculos se hacen en tu equipo y no se guardan.',
 back:'← Interés',indep:'Independencia →',chartPut:'Lo que tú pones',chartGain:'Lo que gana tu dinero',chartGoal:'Tu meta',currency:'Moneda',lang:'Idioma',
 tillGoal:'{y} y {m}',yS:'{n} año',yP:'{n} años',mS:'{n} mes',mP:'{n} meses',and:' y ',inY:'en el año {n}',inM:'en el mes {n}',already:'Ya llegaste',linkBtn:'Usar el total de mi simulación',noSim:'Tu total de la simulación'},
pt:{title:'Calculadoras',sub:'Digite seus números e veja o resultado na hora.',t1:'Juros',t2:'Independência',t3:'Primeiro milhão',
 ini:'Valor inicial',ap:'Aporte mensal',rate:'Taxa de rendimento',time:'Tempo',year:'Ano',month:'Mês',years:'Anos',months:'Meses',
 eqM:'equivale a {x}% ao mês',eqY:'equivale a {x}% ao ano',isM:'são {x} meses',isY:'são {x}',ex:'Exemplos ao ano:',exY:'ao ano',
 put:'Você colocou',gain:'Rendimentos',will:'Você terá em {t}',bridge:'Com este total você poderia retirar {x} por mês',bridgeBtn:'Usar em Independência →',
 want:'Quero receber por mês',have:'Já tenho',haveLinked:'vem da sua simulação de juros compostos',need:'Você precisa juntar',rule:'regra dos {p}% ao ano',
 prog:'Hoje você está em',arrive:'Com seu aporte você chega em',cons:'Conservador',mod:'Moderado',risk:'Arriscado',recv:'Você receberia {x}/mês com o que tem',
 goal:'Minha meta',gm1:'Em quanto tempo chego?',gm2:'Quanto aporto para chegar em…?',reach:'Você chega à meta em',mustAp:'Você deve aportar por mês',
 hit:'Etapas do caminho',grow:'Como vai crescendo',sum:'Resumo',full:'Completo',seeAll:'Ver tudo mês a mês ({n} meses) ▾',seeLess:'Ver menos ▴',
 stage:'Etapa',colPut:'Você colocou',colGain:'Rendimento',colTotal:'Total',colPm:'Rende por mês',colAp:'Aportou',colRin:'Rende',colAcc:'Rend. acumulado',vals:'Valores',start:'Início',
 yearN:'Ano {n}',monthN:'Mês {n}',bad:'Confira os números: algum valor está vazio ou fora do limite.',never:'Com estes números você não chega à meta em 100 anos.',
 foot:'Exemplo educativo. As taxas são estimativas que você digita: não são promessa de rentabilidade nem recomendação de investimento. Os cálculos são feitos no seu aparelho e não são guardados.',
 back:'← Juros',indep:'Independência →',chartPut:'O que você coloca',chartGain:'O que seu dinheiro rende',chartGoal:'Sua meta',currency:'Moeda',lang:'Idioma',
 yS:'{n} ano',yP:'{n} anos',mS:'{n} mês',mP:'{n} meses',and:' e ',already:'Você já chegou',linkBtn:'Usar o total da minha simulação',noSim:'Seu total da simulação'}
};
const store={get(k){try{return localStorage.getItem(k)}catch{return null}},set(k,v){try{localStorage.setItem(k,v)}catch{}}};
function detectLang(){const s=store.get('forma-calc-lang');if(s==='es'||s==='pt')return s;return String(navigator.language||'es').toLowerCase().startsWith('pt')?'pt':'es';}
function detectCur(lang){const s=store.get('forma-calc-cur');if(s&&CUR[s])return s;const nl=String(navigator.language||'');const m=nl.match(/^es[-_]([A-Za-z]{2})$/i);const r=m&&REGION[m[1].toUpperCase()];return r&&lang!=='pt'?r:'BRL';}
const lang0=detectLang();
const S={tab:'int',lang:lang0,cur:detectCur(lang0),
 int:{ini:1000,ap:150,rate:8,rateU:'y',time:20,timeU:'y'},
 ind:{want:2000,have:0,ap:150,rate:8,rateU:'y',pct:4,linked:false},
 mil:{goal:1000000,have:1000,ap:500,rate:8,rateU:'y',time:20,timeU:'y',mode:'t'},
 tbl:{int:'r',mil:'r'},open:{int:{},mil:{}},last:null};
const t=(k,v)=>{let s=(T[S.lang][k]!=null?T[S.lang][k]:T.es[k]||k);if(v)for(const x in v)s=s.split('{'+x+'}').join(v[x]);return s;};
/* ---------- formato ---------- */
const loc=()=>CUR[S.cur][0];
const nf={};function fmtr(key,o){const k=S.cur+key;return nf[k]||(nf[k]=new Intl.NumberFormat(loc(),o));}
const money=v=>fmtr('m',{style:'currency',currency:S.cur,maximumFractionDigits:0}).format(Math.round(v));
const dec2=v=>fmtr('d',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v);
const compact=v=>fmtr('c',{style:'currency',currency:S.cur,notation:'compact',maximumFractionDigits:1}).format(v);
const plain=v=>fmtr('p',{maximumFractionDigits:2}).format(v);
const sym=()=>{const p=fmtr('m',{style:'currency',currency:S.cur,maximumFractionDigits:0}).formatToParts(0).find(x=>x.type==='currency');return p?p.value:S.cur;};
const pc=(v,d)=>new Intl.NumberFormat(loc(),{maximumFractionDigits:d==null?2:d}).format(v);
function span(m){m=Math.round(m);const y=Math.floor(m/12),r=m%12;const ys=y===1?t('yS',{n:1}):t('yP',{n:y}),ms=r===1?t('mS',{n:1}):t('mP',{n:r});
 if(y===0)return ms;return r?ys+t('and')+ms:ys;}
/* ---------- gráfico ---------- */
function niceTick(max){const raw=max/4;const mag=Math.pow(10,Math.floor(Math.log10(raw)));for(const k of [1,2,2.5,5,10]){if(raw<=mag*k)return mag*k;}return mag*10;}
function chart(el,pts,goal){
  const w=el.clientWidth;if(!w||!pts.length){el.innerHTML='';return;}
  const vh=window.innerHeight||700;const H=w<500?Math.max(200,Math.min(250,Math.round(w*.62))):Math.max(220,Math.min(400,vh-430,Math.round(w*.45)));
  let mx=Math.max(...pts.map(p=>p.bal));if(goal)mx=Math.max(mx,goal*1.04);
  const tick=niceTick(mx);const top=Math.ceil(mx/tick)*tick||1;
  const labels=[];for(let v=0;v<=top+1e-9;v+=tick)labels.push(v);
  const padL=Math.max(...labels.map(v=>compact(v).length))*6.2+14,padR=8,padT=14,padB=26;
  const iw=w-padL-padR,ih=H-padT-padB;const Y=v=>padT+ih-v/top*ih;const n=pts.length,bw=iw/n;
  let s='<svg width="'+w+'" height="'+H+'" viewBox="0 0 '+w+' '+H+'" role="img" aria-label="'+esc(t('grow'))+'">';
  labels.forEach(v=>{s+='<line x1="'+padL+'" x2="'+(w-padR)+'" y1="'+Y(v).toFixed(1)+'" y2="'+Y(v).toFixed(1)+'" stroke="#e3e8ef"/><text x="'+(padL-6)+'" y="'+(Y(v)+4).toFixed(1)+'" text-anchor="end" font-size="11" fill="#6b7686">'+esc(compact(v))+'</text>';});
  const want=w<500?5:8;const ns=[1,2,5,10,20,25,50].find(v=>n/v<=want)||50;
  pts.forEach((p,k)=>{const x=padL+k*bw+bw*.14,bwi=Math.max(1.5,bw*.72);const yc=Y(p.con),yb=Y(p.bal);
   const tip=(p.unit==='y'?t('yearN',{n:p.x}):t('monthN',{n:p.x}))+' · '+t('put')+' '+money(p.con)+' · '+t('gain')+' '+money(p.gain)+' · Total '+money(p.bal);
   s+='<g><title>'+esc(tip)+'</title><rect x="'+x.toFixed(1)+'" y="'+yc.toFixed(1)+'" width="'+bwi.toFixed(1)+'" height="'+Math.max(0,Y(0)-yc).toFixed(1)+'" fill="'+BLUE+'" rx="2"/><rect x="'+x.toFixed(1)+'" y="'+yb.toFixed(1)+'" width="'+bwi.toFixed(1)+'" height="'+Math.max(0,yc-yb-(p.gain>0?2:0)).toFixed(1)+'" fill="'+GREEN+'" rx="2"/></g>';
   if(p.x%ns===0)s+='<text x="'+(x+bwi/2).toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle" font-size="11" fill="#6b7686">'+p.x+'</text>';});
  if(goal){const gy=Y(goal).toFixed(1);s+='<line x1="'+padL+'" x2="'+(w-padR)+'" y1="'+gy+'" y2="'+gy+'" stroke="'+GOAL+'" stroke-width="2" stroke-dasharray="6 4"/><text x="'+(padL+6)+'" y="'+(gy-6)+'" font-size="12" font-weight="700" fill="'+GOAL+'">'+esc(t('chartGoal'))+' · '+esc(money(goal))+'</text>';}
  el.innerHTML=s+'</svg>';
}
/* ---------- campos ---------- */
function field(k,label,o){o=o||{};
 const seg=o.seg?'<span class="cl-sg" role="group">'+o.seg.map(([v,tx])=>'<button type="button" data-seg="'+o.segKey+':'+v+'" class="'+(o.segOn===v?'on':'')+'" aria-pressed="'+(o.segOn===v)+'">'+esc(tx)+'</button>').join('')+'</span>':'';
 return '<div class="cl-f"><label for="cl-'+k+'">'+esc(label)+'</label><div class="cl-inp'+(o.focus?' f':'')+'">'+(o.money?'<small class="cl-pre" data-pre>'+esc(sym())+'</small>':'')+'<input id="cl-'+k+'" data-k="'+k+'" type="text" inputmode="decimal" autocomplete="off" '+(o.money?'data-money="1" ':'')+'value="'+esc(o.value)+'">'+(o.suffix?'<small>'+esc(o.suffix)+'</small>':'')+seg+'</div><div class="cl-h" id="cl-h-'+k+'">'+esc(o.hint||'')+'</div></div>';}
const mfield=(k,label,v,o)=>field(k,label,Object.assign({money:true,value:v?dec2(v).replace(/[.,]00$/,''):(v===0?'0':''),},o));
function fieldsHTML(){
 const tab=S.tab,d=S[tab];
 const rate=field('rate',t('rate'),{value:pc(d.rate,4),suffix:'%',seg:[['y',t('year')],['m',t('month')]],segKey:'rateU',segOn:d.rateU});
 const time=field('time',t('time'),{value:pc(d.time),seg:[['y',t('years')],['m',t('months')]],segKey:'timeU',segOn:d.timeU});
 let h='';
 if(tab==='int')h=mfield('ini',t('ini'),d.ini)+mfield('ap',t('ap'),d.ap,{focus:true})+rate+time+
  '<div class="cl-chips">'+esc(t('ex'))+' '+[6,9,12].map(v=>'<button type="button" class="cl-chip" data-rate="'+v+'">'+v+'%</button>').join('')+'</div>';
 else if(tab==='ind')h=mfield('want',t('want'),d.want,{focus:true})+mfield('have',t('have'),d.have,{hint:d.linked?t('haveLinked'):''})+mfield('ap',t('ap'),d.ap)+rate;
 else h='<div class="cl-mode" role="group">'+['t','a'].map(m=>'<button type="button" data-mode="'+m+'" class="'+(d.mode===m?'on':'')+'" aria-pressed="'+(d.mode===m)+'">'+esc(t(m==='t'?'gm1':'gm2'))+'</button>').join('')+'</div>'+mfield('goal',t('goal'),d.goal,{focus:true})+mfield('have',t('have'),d.have)+(d.mode==='t'?mfield('ap',t('ap'),d.ap):time)+rate;
 return h;
}
/* ---------- lectura de campos ---------- */
function read(){
 const d=S[S.tab];let bad=false;
 document.querySelectorAll('#cl-in [data-k]').forEach(i=>{const k=i.dataset.k;const v=C.parseNumber(i.value);const empty=!i.value.trim();
  const ok=!(Number.isNaN(v));if(empty&&['ini','ap','have'].includes(k)){d[k]=0;i.parentNode.classList.remove('bad');return;}
  if(ok)d[k]=v;else bad=true;i.parentNode.classList.toggle('bad',!ok);});
 return !bad;
}
function hints(){
 const d=S[S.tab];const r=$('cl-h-rate'),tm=$('cl-h-time');
 if(r&&Number.isFinite(d.rate)){const x=d.rateU==='y'?C.monthlyRate(d.rate,'y')*100:C.annualRate(d.rate,'m')*100;r.textContent=Number.isFinite(x)?t(d.rateU==='y'?'eqM':'eqY',{x:pc(x,2)}):'';}
 if(tm&&Number.isFinite(d.time)){const m=C.toMonths(d.time,d.timeU);tm.textContent=d.timeU==='y'?t('isM',{x:pc(m,0)}):(m>=12?t('isY',{x:span(m)}):'');}
}
/* ---------- tabla ---------- */
function tableHTML(key,rows){
 const n=rows.length;const mode=S.tbl[key];
 const head='<div class="cl-th"><h2>'+esc(t('grow'))+'</h2><span class="cl-sg2" role="group"><button type="button" data-tbl="r" class="'+(mode==='r'?'on':'')+'">'+esc(t('sum'))+'</button><button type="button" data-tbl="f" class="'+(mode==='f'?'on':'')+'">'+esc(t('full'))+'</button></span></div>';
 let b;
 if(mode==='r'){
  b='<table class="cl-t"><thead><tr><th>'+esc(t('stage'))+'</th><th>'+esc(t('colPut'))+'</th><th>'+esc(t('colGain'))+'</th><th>'+esc(t('colTotal'))+'</th><th class="hc">'+esc(t('colPm'))+'</th></tr></thead><tbody>'+
  C.stages(n).map(s=>{const r=rows[s.m-1];const lab=s.y?t('yearN',{n:s.y}):t('monthN',{n:s.m});return '<tr class="y"><td>'+esc(lab)+'</td><td class="b">'+dec2(r.con)+'</td><td class="g">'+dec2(r.gain)+'</td><td>'+dec2(r.bal)+'</td><td class="hc g">+'+dec2(r.g)+'</td></tr>';}).join('')+'</tbody></table>'+
  '<button type="button" class="cl-more" data-tbl="f">'+esc(t('seeAll',{n:pc(n,0)}))+'</button>';
 }else{
  const first=rows[0];const ini=first.con-first.ap;
  b='<table class="cl-t"><thead><tr><th>'+esc(t('vals'))+'</th><th>'+esc(t('colAp'))+'</th><th>'+esc(t('colRin'))+'</th><th class="hc">'+esc(t('colAcc'))+'</th><th>'+esc(t('colTotal'))+'</th></tr></thead><tbody>'+
  '<tr class="ini"><td>'+esc(t('start'))+'</td><td class="b">'+dec2(ini)+'</td><td class="g">—</td><td class="hc g">0,00</td><td>'+dec2(ini)+'</td></tr>';
  const Y=Math.ceil(n/12);
  for(let y=1;y<=Y;y++){const a=(y-1)*12,z=Math.min(y*12,n);const seg=rows.slice(a,z);const open=!!S.open[key][y];const last=seg[seg.length-1];
   b+='<tr class="y'+(open?' o':'')+'" data-y="'+y+'" tabindex="0" role="button" aria-expanded="'+open+'"><td>'+esc(t('yearN',{n:y}))+'</td><td class="b">+'+dec2(seg.reduce((s,r)=>s+r.ap,0))+'</td><td class="g">+'+dec2(seg.reduce((s,r)=>s+r.g,0))+'</td><td class="hc g">'+dec2(last.gain)+'</td><td>'+dec2(last.bal)+'</td></tr>';
   if(open)seg.forEach(r=>{b+='<tr class="m"><td>'+esc(t('monthN',{n:r.m}))+'</td><td class="b">+'+dec2(r.ap)+'</td><td class="g">+'+dec2(r.g)+'</td><td class="hc g">'+dec2(r.gain)+'</td><td>'+dec2(r.bal)+'</td></tr>';});}
  b+='</tbody></table><button type="button" class="cl-more" data-tbl="r">'+esc(t('seeLess'))+'</button>';
 }
 return head+'<div class="cl-tw">'+b+'</div>';
}
/* ---------- cálculo y pantalla ---------- */
const kc=(cls,label,val,extra)=>'<div class="cl-kc '+(cls||'')+'"><span>'+label+'</span><b>'+val+'</b>'+(extra||'')+'</div>';
const dot=c=>'<i class="cl-dot" style="background:'+c+'"></i>';
function update(){
 const out=$('cl-out');if(!out)return;out.dataset.tab=S.tab;const ok=read();hints();
 const d=S[S.tab];const kpi=$('cl-kpi'),ch=$('cl-chartbox'),ex=$('cl-extra'),tb=$('cl-table'),st=$('cl-sticky');
 S.last=null;
 const lim=C.validate(Object.assign({},d,{months:S.tab==='ind'?1:(S.tab==='mil'&&d.mode==='t'?1:C.toMonths(d.time,d.timeU))}));
 if(!ok||lim.length||(S.tab==='int'&&!(d.ap>0||d.ini>0))||(S.tab==='ind'&&!(d.want>0))||(S.tab==='mil'&&!(d.goal>0))){kpi.innerHTML='<p class="cl-bad">'+esc(t('bad'))+'</p>';ch.hidden=true;ex.innerHTML='';tb.hidden=true;st.hidden=true;return;}
 ch.hidden=false;tb.hidden=false;st.hidden=false;
 const i=C.monthlyRate(d.rate,d.rateU);
 if(S.tab==='int'){
  const n=C.toMonths(d.time,d.timeU),rows=C.simulate(d.ini,d.ap,i,n),l=rows[n-1];
  kpi.innerHTML=kc('',dot(BLUE)+' '+esc(t('put')),money(l.con),'')+kc('',dot(GREEN)+' '+esc(t('gain')),money(l.gain),'')+kc('tt',esc(t('will',{t:span(n)})),money(l.bal));
  S.last={pts:C.series(rows)};tb.innerHTML=tableHTML('int',rows);
  ex.innerHTML='<div class="cl-bridge"><span>'+esc(t('bridge',{x:money(C.monthlyIncome(l.bal,4))}))+'</span><button type="button" class="cl-link" data-go="ind" data-total="'+Math.round(l.bal)+'">'+esc(t('bridgeBtn'))+'</button></div>';
  st.innerHTML='<div><small>'+esc(t('will',{t:span(n)}))+'</small><b>'+money(l.bal)+'</b></div><button type="button" data-go="ind" data-total="'+Math.round(l.bal)+'">'+esc(t('indep'))+'</button>';
 }else if(S.tab==='ind'){
  const need=C.neededWealth(d.want,d.pct);const pct=Math.min(100,d.have/need*100);const m=C.monthsToGoal(need,d.have,d.ap,i);
  kpi.innerHTML=kc('tt',esc(t('need')),money(need),'<small>'+esc(t('rule',{p:d.pct}))+'</small>')+kc('',esc(t('prog')),'<span class="pr">'+pc(pct,0)+'%</span>','<div class="cl-prog"><i style="width:'+pct.toFixed(1)+'%"></i></div>')+kc('',esc(t('arrive')),m===null?'—':(m===0?esc(t('already')):span(m)));
  ex.innerHTML='<div class="cl-scen">'+[[3,'cons'],[4,'mod'],[5,'risk']].map(([p,k])=>'<button type="button" data-pct="'+p+'" class="cl-sc'+(d.pct===p?' on':'')+'" aria-pressed="'+(d.pct===p)+'"><span>'+esc(t(k))+' '+p+'%</span><b>'+money(C.neededWealth(d.want,p))+'</b>'+(d.have>0?'<small>'+esc(t('recv',{x:money(C.monthlyIncome(d.have,p))}))+'</small>':'')+'</button>').join('')+'</div>'+(m===null?'<p class="cl-bad">'+esc(t('never'))+'</p>':'');
  tb.innerHTML='';tb.hidden=true;
  if(m!==null&&m>0){const rows=C.simulate(d.have,d.ap,i,Math.min(m,C.MAX_MONTHS));S.last={pts:C.series(rows),goal:need};}else S.last=null;
  ch.hidden=!S.last;
  st.innerHTML='<div><small>'+esc(t('need'))+'</small><b>'+money(need)+'</b></div><button type="button" data-go="int">'+esc(t('back'))+'</button>';
 }else{
  let n,ap,m;
  if(d.mode==='t'){ap=d.ap;m=C.monthsToGoal(d.goal,d.have,ap,i);n=m;}
  else{n=C.toMonths(d.time,d.timeU);ap=C.neededContribution(d.goal,d.have,i,n);m=n;}
  if(m===null){kpi.innerHTML='<p class="cl-bad">'+esc(t('never'))+'</p>';ch.hidden=true;ex.innerHTML='';tb.hidden=true;st.hidden=true;return;}
  if(m===0){kpi.innerHTML='<p class="cl-bad">'+esc(t('already'))+'</p>';ch.hidden=true;ex.innerHTML='';tb.hidden=true;st.hidden=true;return;}
  const rows=C.simulate(d.have,ap,i,m),l=rows[m-1];
  const main=d.mode==='t'?kc('tt',esc(t('reach')),span(m)):kc('tt',esc(t('mustAp')),money(ap));
  kpi.innerHTML=main+kc('',dot(BLUE)+' '+esc(t('put')),money(l.con))+kc('',dot(GREEN)+' '+esc(t('gain')),money(l.gain));
  ex.innerHTML='<h3 class="cl-h3">'+esc(t('hit'))+'</h3><div class="cl-hits">'+[.1,.25,.5,1].map(f=>{const g=d.goal*f;const mm=C.monthsToGoal(g,d.have,ap,i);return '<div class="cl-hit'+(f===1?' last':'')+'"><span>'+esc(compact(g))+'</span><b>'+(mm===null?'—':(mm===0?esc(t('already')):span(mm)))+'</b></div>';}).join('')+'</div>';
  S.last={pts:C.series(rows),goal:d.goal};tb.innerHTML=tableHTML('mil',rows);
  st.innerHTML='<div><small>'+esc(t(d.mode==='t'?'reach':'mustAp'))+'</small><b>'+(d.mode==='t'?span(m):money(ap))+'</b></div>';
 }
 drawChart();
}
function drawChart(){const el=$('cl-chart');if(!el)return;if(S.last)chart(el,S.last.pts,S.last.goal);else el.innerHTML='';}
/* ---------- estructura ---------- */
function shell(){
 const p=$('p-calculadoras');if(!p)return;
 p.innerHTML='<div id="cl-root"><div class="cl-top"><div><h1>'+esc(t('title'))+'</h1><p>'+esc(t('sub'))+'</p></div><div class="cl-tools"><label>'+esc(t('currency'))+'<select id="cl-cur" aria-label="'+esc(t('currency'))+'">'+Object.keys(CUR).map(c=>'<option value="'+c+'"'+(c===S.cur?' selected':'')+'>'+esc(CUR[c][1])+'</option>').join('')+'</select></label><span class="cl-sg2" role="group" aria-label="'+esc(t('lang'))+'"><button type="button" data-lang="es" class="'+(S.lang==='es'?'on':'')+'">ES</button><button type="button" data-lang="pt" class="'+(S.lang==='pt'?'on':'')+'">PT</button></span></div></div>'+
 '<div class="cl-tabs" role="tablist">'+[['int','t1'],['ind','t2'],['mil','t3']].map(([k,l])=>'<button type="button" role="tab" data-tab="'+k+'" aria-selected="'+(S.tab===k)+'" class="'+(S.tab===k?'on':'')+'">'+esc(t(l))+'</button>').join('')+'</div>'+
 '<div class="cl-grid"><section class="cl-card cl-in" id="cl-in"></section><div class="cl-out" id="cl-out"><div class="cl-k3" id="cl-kpi"></div><div class="cl-card cl-chartbox" id="cl-chartbox"><div class="cl-legend"><span>'+dot(BLUE)+esc(t('chartPut'))+'</span><span>'+dot(GREEN)+esc(t('chartGain'))+'</span>'+(S.tab!=='int'?'<span class="cl-gl">- - '+esc(t('chartGoal'))+'</span>':'')+'</div><div id="cl-chart"></div></div><div id="cl-extra"></div><section class="cl-card cl-tbl" id="cl-table"></section></div></div>'+
 '<p class="cl-foot">'+esc(t('foot'))+'</p><div class="cl-sticky" id="cl-sticky"></div></div>';
 $('cl-in').innerHTML=fieldsHTML();update();
}
function fieldsOnly(){$('cl-in').innerHTML=fieldsHTML();update();}
function formatMoneyInput(i){const v=C.parseNumber(i.value);if(!Number.isNaN(v))i.value=dec2(v).replace(/[.,]00$/,'');}
function click(e){
 const b=e.target.closest('button,tr[data-y]');if(!b)return;
 if(b.dataset.tab){if(S.tab!==b.dataset.tab){S.tab=b.dataset.tab;shell();}return;}
 if(b.dataset.lang){S.lang=b.dataset.lang;store.set('forma-calc-lang',S.lang);shell();return;}
 if(b.dataset.seg){const [k,v]=b.dataset.seg.split(':');const d=S[S.tab];
  const cur=Number(C.parseNumber($('cl-'+(k==='rateU'?'rate':'time')).value));
  if(d[k]!==v){/* convierte el valor para que el significado no cambie sin querer */
   if(k==='timeU'&&Number.isFinite(cur)){d.time=v==='m'?Math.round(cur*12):Math.round(cur/12*100)/100;}
   if(k==='rateU'&&Number.isFinite(cur)){d.rate=v==='m'?Math.round(C.monthlyRate(cur,'y')*100*1000)/1000:Math.round(C.annualRate(cur,'m')*100*100)/100;}
   d[k]=v;fieldsOnly();}return;}
 if(b.dataset.rate){const d=S[S.tab];d.rate=Number(b.dataset.rate);d.rateU='y';fieldsOnly();return;}
 if(b.dataset.mode){S.mil.mode=b.dataset.mode;fieldsOnly();return;}
 if(b.dataset.pct){S.ind.pct=Number(b.dataset.pct);update();return;}
 if(b.dataset.tbl){S.tbl[S.tab]=b.dataset.tbl;update();return;}
 if(b.dataset.y){const k=S.tab,y=b.dataset.y;S.open[k][y]=!S.open[k][y];update();return;}
 if(b.dataset.go){if(b.dataset.go==='ind'&&b.dataset.total){S.ind.have=Number(b.dataset.total);S.ind.linked=true;S.ind.ap=S.int.ap;S.ind.rate=S.int.rate;S.ind.rateU=S.int.rateU;}
  S.tab=b.dataset.go;shell();window.scrollTo({top:0,behavior:'smooth'});try{document.body.scrollTo({top:0,behavior:'smooth'})}catch{}}
}
function build(){
 const app=$('app-screen');if(!app||$('p-calculadoras'))return;
 const p=document.createElement('section');p.id='p-calculadoras';p.className='panel';app.insertBefore(p,$('bnav'));
 p.addEventListener('click',click);
 p.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('tr[data-y]')){e.preventDefault();click(e);}});
 p.addEventListener('input',e=>{if(e.target.matches('[data-k]')){if(S.tab==='ind'&&e.target.dataset.k==='have')S.ind.linked=false;update();}});
 p.addEventListener('focusout',e=>{if(e.target.matches('[data-money]'))formatMoneyInput(e.target);});
 p.addEventListener('focusin',e=>{if(e.target.matches('[data-k]'))setTimeout(()=>{try{e.target.select()}catch{}},0);});
 p.addEventListener('change',e=>{if(e.target.id==='cl-cur'){S.cur=e.target.value;store.set('forma-calc-cur',S.cur);document.querySelectorAll('#cl-in [data-money]').forEach(formatMoneyInput);document.querySelectorAll('[data-pre]').forEach(x=>x.textContent=sym());update();}});
 shell();
 if(window.ResizeObserver){let w=0;new ResizeObserver(()=>{const el=$('cl-chart');if(el&&el.clientWidth!==w){w=el.clientWidth;drawChart();}}).observe(p);}
 new MutationObserver(()=>{if(p.classList.contains('active'))drawChart();}).observe(p,{attributes:true,attributeFilter:['class']});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else build();
})();
