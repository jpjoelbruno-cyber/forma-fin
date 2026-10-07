(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FormaIntent=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const words={cero:0,zero:0,un:1,uno:1,una:1,um:1,uma:1,dos:2,dois:2,duas:2,tres:3,cuatro:4,quatro:4,cinco:5,seis:6,siete:7,sete:7,ocho:8,oito:8,nueve:9,nove:9,diez:10,dez:10,once:11,onze:11,doce:12,doze:12,trece:13,treze:13,catorce:14,quatorze:14,quince:15,quinze:15,dieciseis:16,dezesseis:16,diecisiete:17,dezessete:17,dieciocho:18,dezoito:18,diecinueve:19,dezenove:19,veinte:20,vinte:20,veintiuno:21,veintidos:22,veintitres:23,veinticuatro:24,veinticinco:25,veintiseis:26,veintisiete:27,veintiocho:28,veintinueve:29,treinta:30,trinta:30,cuarenta:40,quarenta:40,cincuenta:50,cinquenta:50,sesenta:60,sessenta:60,setenta:70,ochenta:80,oitenta:80,noventa:90,cien:100,ciento:100,cem:100,cento:100,doscientos:200,duzentos:200,trescientos:300,trezentos:300,cuatrocientos:400,quatrocentos:400,quinientos:500,quinhentos:500,seiscientos:600,seiscentos:600,setecientos:700,setecentos:700,ochocientos:800,oitocentos:800,novecientos:900,novecentos:900};
 function decimal(s){s=s.replace(/\s/g,'');if(s.includes(',')&&s.includes('.')){const mark=s.lastIndexOf(',')>s.lastIndexOf('.')?',':'.';s=s.replace(mark==='.'?/,/g:/\./g,'').replace(',','.');}else if(/^\d{1,3}([.,]\d{3})+$/.test(s)){s=s.replace(/[.,]/g,'');}else{s=s.replace(',','.');}const n=Number(s);return Number.isFinite(n)?n:null;}
 function wordNumber(s){let total=0,part=0,seen=false;for(const w of s.trim().split(/[\s-]+/)){if(w==='y'||w==='e')continue;if(w==='mil'){total+=(part||1)*1000;part=0;seen=true;}else if(Object.hasOwn(words,w)){part+=words[w];seen=true;}else if(/^\d+(?:[.,]\d+)*$/.test(w)){const n=decimal(w);if(n===null)return null;part+=n;seen=true;}else return null;}return seen?total+part:null;}
 const numberToken='(?:\\d+(?:[.,]\\d+)*|'+Object.keys(words).join('|')+'|mil)';
 const numberRun=new RegExp('\\b'+numberToken+'(?:(?:\\s+(?:y|e)\\s+|\\s+)'+numberToken+')*\\b','g');
 function amounts(s){const runs=[...s.matchAll(numberRun)].map(m=>({n:wordNumber(m[0]),start:m.index,end:m.index+m[0].length}));
  if(runs.length===1&&/centav/.test(s.slice(runs[0].end)))return [runs[0].n/100];
  if(runs.length===2&&/^(?:\s*(?:reales|reais|real|soles|pesos))?\s*(?:y|e|con|com|virgula|coma)\s*$/.test(s.slice(runs[0].end,runs[1].start))&&runs[1].n<100)return [Math.round((runs[0].n+runs[1].n/100)*100)/100];
  return runs.map(x=>x.n);
 }
 function isValidDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!isNaN(new Date(value+'T12:00:00Z').getTime())&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;}
 function shiftDate(today,days){const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
 function parse(raw,{today,categories=[],preferences=[]}={}){
  let text=normalize(raw),date=today||new Date().toISOString().slice(0,10),dateIssue=false;
  if(/\b(anteayer|anteontem)\b/.test(text))date=shiftDate(date,-2);else if(/\b(ayer|ontem)\b/.test(text))date=shiftDate(date,-1);
  const explicit=text.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{4}))?\b/);
  if(explicit){const proposed=`${explicit[3]||date.slice(0,4)}-${explicit[2].padStart(2,'0')}-${explicit[1].padStart(2,'0')}`;if(!isNaN(new Date(proposed+'T12:00:00Z').getTime())&&new Date(proposed+'T12:00:00Z').toISOString().slice(0,10)===proposed)date=proposed;else dateIssue=true;text=text.replace(explicit[0],'');}
  if(/\b(manana|amanha|semana|lunes|martes|miercoles|jueves|viernes|sabado|domingo|segunda|terca|quarta|quinta|sexta|dia\s+\d|el\s+\d|pasado|passado)\b/.test(text))dateIssue=true;
  let type=/\b(recibi|recebi|recibido|recebido|ingreso|entrada|gane|ganhei|cobre|cobrei|me pagaron|me pagaram|sueldo|salario|pro[ -]?labore)\b/.test(text)?'income':/\b(gaste|gasto|gastos|pague|pago|compre|comprei|gastos|gastei|paguei|saio|saiu)\b/.test(text)?'expense':null;
  const transfer=/\b(transferi|transferencia|pase|passei|movi)\b/.test(text)&&/\b(mi otra|minha outra|mis cuentas|minhas contas|mi cuenta|minha conta|caixinha|cofrinho|reserva)\b/.test(text);
  const candidates=amounts(text),valid=candidates.filter(n=>n!==null&&n>0&&n<=999999999&&Math.abs(n*100-Math.round(n*100))<0.001);
  let amount=!/\bmenos\b|(?:^|\s)-\s*\d/.test(text)&&candidates.length===1&&valid.length===1?Math.round(valid[0]*100)/100:null;
  let category=null;
  const rules=type==='income'?[
   ['negocio',/pro[ -]?labore/],['salario',/sueldo|salario/],['pension-i',/pension|jubilacion|aposentadoria/],['alquiler-i',/alquiler|aluguel/],['inversion',/rendimiento|rendimento|dividendo/],['bono',/bono|bonus|premio/],['freelance',/uber|servicio|servico|freelance|trabaj|trabalh/]
  ]:[['restaurantes',/uber eats|ifood|delivery|restaurante|almuerzo|almoco|cena|jantar/],['uber',/\buber\b|\btaxi\b|\b99\b/],['supermercado',/supermercado|atacado|mercado|mercadinho/],['farmacia',/farmacia|medicamento/],['alquiler',/alquiler|aluguel/],['luz',/electricidad|energia|\bluz\b/],['agua',/\bagua\b/],['internet',/internet/],['gasolina',/gasolina|combustible|combustivel/],['ropa',/ropa|roupa|vestido|zapato|calcado/],['celular',/celular|telefono|telefone/],['medico',/medico|consulta/],['academia',/academia|gym|gimnasio/],['panaderia',/panaderia|padaria/],['gas',/\bgas\b/]];
  for(const [id,re] of rules){if(re.test(text)&&categories.some(c=>c.id===id&&(!type||c.type===type))){category=id;break;}}
  if(!category){const match=categories.filter(c=>c.type===type&&normalize(c.label).length>=4&&text.includes(normalize(c.label)));if(match.length===1)category=match[0].id;}
  for(const p of preferences){if(p.type===type&&p.phrase&&text.includes(normalize(p.phrase))&&categories.some(c=>c.id===p.category&&c.type===type)){category=p.category;break;}}
  const missing=[];if(transfer)missing.push('transfer');if(!type)missing.push('type');if(!amount)missing.push(candidates.length>1?'ambiguous_amount':'amount');if(!category)missing.push('category');if(dateIssue)missing.push('date');
  return {type,amount,category,date,description:String(raw||'').trim().slice(0,500),missing,transfer};
 }
 return {parse,normalize,decimal,wordNumber,isValidDate};
});
