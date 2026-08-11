const app=document.getElementById('app');
let page='home';
const navItems=[['home','⌂','Home'],['agenda','📅','Agenda'],['todos','✓','To Do'],['notes','📝','Notities'],['mail','✉️','Mail'],['class','👥','Klas'],['reflection','💭','Reflectie']];
const loaders={
 home:()=>import('./chat.js').then(m=>m.renderAIChat),
 todos:()=>import('./todos.js').then(m=>m.renderTodos),
 notes:()=>import('./notes.js').then(m=>m.renderNotes),
 mail:()=>import('./mail.js').then(m=>m.renderMail),
 agenda:()=>import('./agenda.js').then(m=>m.renderAgenda),
 groups:()=>import('./groups.js').then(m=>m.renderGroups),
 wheel:()=>import('./wheel.js').then(m=>m.renderWheel),
 soundboards:()=>import('./soundboards.js').then(m=>m.renderSoundboards),
  turns:()=>import('./turns.js').then(m=>m.renderTurns),
  timer:()=>import('./timer.js').then(m=>m.renderTimer),
 reflection:()=>import('./reflection.js').then(m=>m.renderReflection),
  feedback:()=>import('./feedback.js').then(m=>m.renderFeedback),
  points:()=>import('./points.js').then(m=>m.renderPoints),
  checklist:()=>import('./checklist.js').then(m=>m.renderChecklist),
 settings:()=>import('./settings.js').then(m=>m.renderSettings)
};
function shell(){
 app.innerHTML=`<header class="global-header"><div class="global-brand">Meester Martijn</div><button id="globalSettings" class="settings-top-btn">⚙ Instellingen</button></header><main class="shell"><div id="page"></div></main><nav class="nav"><div class="nav-inner">${navItems.map(([id,icon,label])=>`<button data-nav="${id}"><span class="nicon">${icon}</span><span>${label}</span></button>`).join('')}</div></nav>`;
 app.querySelector('#globalSettings').onclick=()=>navigate('settings');
 app.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>navigate(b.dataset.nav));
 markNav();
}
function markNav(){const active=['groups','wheel','soundboards','turns','timer','feedback','points','checklist'].includes(page)?'class':page;app.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===active));const sb=app.querySelector('#globalSettings');if(sb)sb.classList.toggle('active',page==='settings');}
function renderClass(root){
  root.innerHTML=`<div class="topbar"><div><div class="title">Klas</div><div class="subtitle">Alle hulpmiddelen voor dagelijks gebruik in de klas.</div></div></div>
  <div class="grid">
    <div class="tile" data-open="groups"><div class="icon">👥</div><div><strong>Groepjesmaker</strong><div class="muted tile-sub">Automatisch of handmatig groepjes maken.</div></div></div>
    <div class="tile" data-open="wheel"><div class="icon">🎯</div><div><strong>Namenrad</strong><div class="muted tile-sub">Draai een willekeurige leerling.</div></div></div>
    <div class="tile" data-open="checklist"><div class="icon">☑️</div><div><strong>Checklist</strong><div class="muted tile-sub">Vink leerlingen af en mail een overzicht.</div></div></div>
    <div class="tile" data-open="points"><div class="icon">🏆</div><div><strong>Punten</strong><div class="muted tile-sub">Geef punten erbij of eraf per leerling.</div></div></div>
    <div class="tile" data-open="feedback"><div class="icon">💬</div><div><strong>Feedback</strong><div class="muted tile-sub">Foto, leerling, spraak en AI-samenvatting.</div></div></div>
    <div class="tile" data-open="timer"><div class="icon">⏱️</div><div><strong>Timer</strong><div class="muted tile-sub">Grote klassikale timer.</div></div></div>
    <div class="tile" data-open="turns"><div class="icon">🙋</div><div><strong>Beurten</strong><div class="muted tile-sub">Kies leerlingen zonder herhaling.</div></div></div>
    <div class="tile" data-open="soundboards"><div class="icon">🔊</div><div><strong>Soundboards</strong><div class="muted tile-sub">Gebruik je eigen MP3- en audiobestanden.</div></div></div>
  </div>`;
  root.querySelectorAll('[data-open]').forEach(t=>t.onclick=()=>navigate(t.dataset.open));
}
function loading(root){root.innerHTML='<div class="card"><div class="muted">Pagina laden…</div></div>';}
function errorPage(root,e){console.error(e);root.innerHTML=`<div class="card"><div class="section-title">Deze pagina kon niet worden geladen</div><div class="muted">${String(e?.message||e||'Onbekende fout')}</div><div class="row" style="margin-top:12px"><button class="btn" id="retryPage">Opnieuw proberen</button><button class="btn secondary" id="goHome">Home</button></div></div>`;root.querySelector('#retryPage').onclick=()=>navigate(page);root.querySelector('#goHome').onclick=()=>navigate('home');}
async function navigate(to){page=to||'home';try{history.replaceState(null,'',`#${page}`)}catch{}shell();const root=app.querySelector('#page');loading(root);try{if(page==='class')renderClass(root);else if(loaders[page]){const render=await loaders[page]();await render(root)}else{page='home';const render=await loaders.home();await render(root)}}catch(e){errorPage(root,e)}markNav();window.scrollTo(0,0);}
window.addEventListener('hashchange',()=>navigate(location.hash.slice(1)||'home'));
if('serviceWorker' in navigator)window.addEventListener('load',async()=>{try{const reg=await navigator.serviceWorker.register('./service-worker.js?v=21');await reg.update?.()}catch(e){console.warn(e)}});
shell();document.getElementById('page').innerHTML='<div class="card"><strong>Meester Martijn App</strong><div class="muted" style="margin-top:6px">App wordt geladen…</div></div>';navigate(location.hash.slice(1)||'home');
