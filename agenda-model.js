/* René's existing weekly calendar rules, shared by view and tests. */
(function(root){'use strict';
 const activities=['Mentoría particular','Asesoría / agendamiento','Clase grupal','Inmersión','Otra actividad','Invitación para podcast'];
 const areas=['Educación financiera','Estructura empresarial','Bolsa de valores e inversiones','Creación de carteras de inversión','Informática','Inteligencia artificial','Shopee','TikTok Shop','Shein','Mercado Libre','Gestión de cuentas en marketplaces','Contabilidad y CNPJ','Creación de contenido para emprendedores','Podcast','Otra área'];
 const instructors=['Sin asignar','Joel','René','Luis','Emerson','Miguel'];
 const iso=d=>[d.getUTCFullYear(),String(d.getUTCMonth()+1).padStart(2,'0'),String(d.getUTCDate()).padStart(2,'0')].join('-');
 function date(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error('Fecha inválida');const d=new Date(s+'T12:00:00Z');if(!Number.isFinite(+d)||iso(d)!==s)throw Error('Fecha inválida');return d;}
 function plus(s,n){const d=date(s);d.setUTCDate(d.getUTCDate()+n);return iso(d);}
 function monday(s){const d=date(s);return plus(s,-((d.getUTCDay()+6)%7));}
 function validate(b){date(b.start_date);if(!b.client?.trim()||b.client.length>160)throw Error('Indica el nombre del cliente o invitado.');if(!activities.includes(b.activity)||!areas.includes(b.area)||!instructors.includes(b.instructor))throw Error('Revisa actividad, área e instructor.');if(date(b.start_date).getUTCDay()===0||!Number.isInteger(b.start_hour)||b.start_hour<13||b.start_hour>17||!Number.isInteger(b.duration)||b.duration<1||b.duration>5||b.start_hour+b.duration>18||!Number.isInteger(b.sessions)||b.sessions<1||b.sessions>52)throw Error('Usa lunes a sábado, de 13:00 a 18:00, entre 1 y 52 sesiones.');return b;}
 function occurrence(b,day){const delta=Math.round((date(day)-date(b.start_date))/86400000);return delta>=0&&delta%7===0&&delta/7<b.sessions?delta/7:-1;}
 function conflicts(list,b,id){validate(b);for(let i=0;i<b.sessions;i++){const day=plus(b.start_date,i*7);for(const old of list)if(old.id!==id&&!old.cancelled&&occurrence(old,day)>=0&&b.start_hour<old.start_hour+old.duration&&old.start_hour<b.start_hour+b.duration)return true;}return false;}
 const api={activities,areas,instructors,iso,date,plus,monday,validate,occurrence,conflicts};root.FormaAgendaModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
