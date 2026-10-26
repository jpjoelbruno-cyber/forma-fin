/* Atajo desde la nueva Gestión: /agenda-clasica.html#ir=matricular|cobrar|agendar|interesado|asistencia
   Espera a que la pantalla clásica esté lista y pulsa los mismos botones que pulsaría René. No guarda nada por su cuenta. */
(function(){'use strict';
var m=/[#&]ir=([a-z]+)/.exec(location.hash||'');if(!m)return;
var steps={
 matricular:[['[data-view="education"]'],['[data-academic-tab="enrol"]']],
 cobrar:[['[data-view="income"]']],
 agendar:[['[data-view="week"]'],['#new']],
 interesado:[['[data-view="sales"]'],['#crm-create']],
 asistencia:[['[data-view="today"]']]
}[m[1]];
if(!steps)return;
var i=0,tries=0,t=setInterval(function(){
  tries++;if(tries>80||i>=steps.length){clearInterval(t);if(i>=steps.length)try{history.replaceState(null,'',location.pathname+location.search)}catch(e){}return}
  var el=document.querySelector(steps[i][0]);
  if(el&&el.offsetParent&&!el.disabled){el.click();i++}
},250);
})();
