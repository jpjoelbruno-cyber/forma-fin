/* Network-only FORMA worker. No cache, background sync, queued writes or user data. */
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||request.mode!=='navigate'||url.origin!==self.location.origin)return;
 event.respondWith(fetch(request,{cache:'no-store'}).catch(()=>{
  const destination=url.pathname==='/agenda.html'?'/agenda.html':'/';
  return new Response('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#5A3BCC"><title>FORMA · Sin conexión</title><body><h1>Necesitas conexión a internet</h1><p>Conéctate para abrir FORMA y consultar o guardar tus datos.</p><p>Esta pantalla no muestra registros guardados ni pone operaciones en una cola de envío.</p><p><a href="'+destination+'">Volver a intentar</a></p></body></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'}});
 }));
});
