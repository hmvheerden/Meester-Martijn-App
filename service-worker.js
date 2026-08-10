const CACHE='meester-martijn-v9';
const CORE=['./','./index.html','./style.css','./manifest.json','./app.js','./chat.js','./storage.js','./api.js','./utils.js','./recorder.js','./mail.js','./notes.js','./groups.js','./wheel.js','./todos.js','./soundboards.js','./reflection.js','./settings.js'];
self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).catch(()=>{}));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith((async()=>{
    try{
      const fresh=await fetch(event.request,{cache:'no-store'});
      if(fresh && fresh.ok){
        const cache=await caches.open(CACHE);
        cache.put(event.request,fresh.clone()).catch(()=>{});
      }
      return fresh;
    }catch{
      const cached=await caches.match(event.request,{ignoreSearch:true});
      if(cached)return cached;
      if(event.request.mode==='navigate')return caches.match('./index.html');
      throw new Error('Offline en bestand niet in cache');
    }
  })());
});
