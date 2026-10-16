/* Types, areas, booking state and session markers are separate concepts. */
(function(root){'use strict';
 const legacyActivities=['Mentoría particular','Asesoría / agendamiento','Clase grupal','Inmersión','Otra actividad','Invitación para podcast'];
 const activities=['Mentoría particular','Asesoría','Agendamiento','Clase grupal','Clase individual','Inmersión','Invitación para podcast','Orientación','Otra actividad','Consulta'];
 const areas=['Educación financiera','Estructura empresarial','Bolsa de valores e inversiones','Creación de carteras de inversión','Informática','Inteligencia artificial','Shopee','TikTok Shop','Shein','Mercado Libre','Gestión de cuentas en marketplaces','Contabilidad y CNPJ','Creación de contenido para emprendedores','Podcast','Otra área','Método FORMA','Asesoría / Agendamiento','Asesoría','Bolsa de valores','Inversiones','Shopify','Informática e IA para niños','Aprender a enviar dinero a Bolivia'];
 const instructors=['Sin asignar','Joel','René','Luis','Emerson','Miguel'];
 const palette=Object.fromEntries(['Disponible',...activities].map(a=>[a,a==='Disponible'?'#FFFFFF':a==='Invitación para podcast'?'#FFF0E5':'#F0F2FA']));
 const isPodcast=b=>b.activity==='Invitación para podcast'||['Podcast','Eleva Podcast'].includes(b.area);
 const iso=d=>[d.getUTCFullYear(),String(d.getUTCMonth()+1).padStart(2,'0'),String(d.getUTCDate()).padStart(2,'0')].join('-');
 function date(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error('Fecha inválida');const d=new Date(s+'T12:00:00Z');if(!Number.isFinite(+d)||iso(d)!==s)throw Error('Fecha inválida');return d;}
 function plus(s,n){const d=date(s);d.setUTCDate(d.getUTCDate()+n);return iso(d);}
 function monday(s){const d=date(s);return plus(s,-((d.getUTCDay()+6)%7));}
 function teachers(b){return b.instructors?.length?[...new Set(b.instructors)]:[b.instructor||'Sin asignar'];}
 function validate(b){date(b.start_date);if(!b.client?.trim()||b.client.length>160)throw Error('Indica el nombre del cliente o invitado.');if(![...activities,'Asesoría / agendamiento'].includes(b.activity)||(!b.area?.trim()||b.area.length>120)||!teachers(b).length||teachers(b).some(t=>!instructors.includes(t))||teachers(b).length>5||(teachers(b).includes('Sin asignar')&&teachers(b).length>1))throw Error('Revisa actividad, área e instructores.');if(date(b.start_date).getUTCDay()===0||!Number.isInteger(b.start_hour)||b.start_hour<13||b.start_hour>17||!Number.isInteger(b.duration)||b.duration<1||b.duration>5||b.start_hour+b.duration>18||!Number.isInteger(b.sessions)||b.sessions<1||b.sessions>52)throw Error('Usa lunes a sábado, de 13:00 a 18:00, entre 1 y 52 encuentros.');return b;}
 function occurrence(b,day){const delta=Math.round((date(day)-date(b.start_date))/86400000);return delta>=0&&delta%7===0&&delta/7<b.sessions?delta/7:-1;}
 function conflicts(list,b,id,perInstructor=true){validate(b);for(let i=0;i<b.sessions;i++){const day=plus(b.start_date,i*7);for(const old of list)if(old.id!==id&&!old.cancelled&&(!perInstructor||teachers(old).includes('Sin asignar')||teachers(b).includes('Sin asignar')||teachers(old).some(t=>teachers(b).includes(t)))&&occurrence(old,day)>=0&&b.start_hour<old.start_hour+old.duration&&old.start_hour<b.start_hour+b.duration)return true;}return false;}
 function state(b,day){const n=occurrence(b,day);if(n<0)return '';return b.sessions===1?(b.booking_state==='por_confirmar'?'POR CONFIRMAR':'RESERVADO'):n===0?'INICIO':n===b.sessions-1?'FINALIZA':`ENCUENTRO ${n+1}/${b.sessions}`;}
 const color=b=>isPodcast(b)?'#FFF0E5':'#F0F2FA';
 function matches(b,q){q=q.trim().toLocaleLowerCase();if(!q)return true;const raw=[b.client,b.phone,b.student_reference,b.activity,b.area,...teachers(b)].join(' ').toLocaleLowerCase();const digits=q.replace(/\D/g,'');return raw.includes(q)||(digits.length>=3&&String(b.phone||'').replace(/\D/g,'').includes(digits));}
 const api={activities,legacyActivities,areas,instructors,palette,iso,date,plus,monday,validate,occurrence,conflicts,teachers,state,color,isPodcast,matches};root.FormaAgendaModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
