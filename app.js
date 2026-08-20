const app=document.getElementById('app');
let page='klas';
const navItems=[['klas','👥','Klas'],['agenda','📅','AI-Agenda'],['mail','✉️','AI-Mail'],['notes','📝','Notities'],['reflection','💭','Reflectie'],['aichat','💬','AI-chat']];
const loaders={
 aichat:()=>import('./chat.js').then(m=>m.renderAIChat),
 classnotes:()=>import('./notes.js').then(m=>m.renderNotes),
 classtodos:()=>import('./classtodos.js').then(m=>m.renderClassTodos),
 notes:()=>import('./notes.js').then(m=>m.renderNotes),
 mail:()=>import('./mail.js').then(m=>m.renderMail),
 agenda:()=>import('./agenda.js').then(m=>m.renderAgenda),
 groups:()=>import('./groups.js').then(m=>m.renderGroups),
 wheel:()=>import('./wheel.js').then(m=>m.renderWheel),
 soundboards:()=>import('./soundboards.js').then(m=>m.renderSoundboards),
  turns:()=>import('./turns.js').then(m=>m.renderTurns),
 reflection:()=>import('./reflection.js').then(m=>m.renderReflection),
  feedback:()=>import('./feedback.js').then(m=>m.renderFeedback),
  points:()=>import('./points.js').then(m=>m.renderPoints),
  checklist:()=>import('./checklist.js').then(m=>m.renderChecklist),
  absences:()=>import('./absences.js').then(m=>m.renderAbsences),
  classdiary:()=>import('./classdiary.js').then(m=>m.renderClassDiary),
 settings:()=>import('./settings.js').then(m=>m.renderSettings)
};
function shell(){
 app.innerHTML=`<header class="global-header"><div class="global-brand">Meester Martijn</div><button id="globalSettings" class="settings-top-btn">⚙ Instellingen</button></header><main class="shell"><div id="page"></div></main><nav class="nav"><div class="nav-inner">${navItems.map(([id,icon,label])=>`<button data-nav="${id}"><span class="nicon">${icon}</span><span>${label}</span></button>`).join('')}</div></nav>`;
 app.querySelector('#globalSettings').onclick=()=>navigate('settings');
 app.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>navigate(b.dataset.nav));
 markNav();
}
function markNav(){const active=['groups','wheel','soundboards','turns','feedback','points','checklist','absences','classdiary','classnotes','classtodos'].includes(page)?'klas':page;app.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===active));const sb=app.querySelector('#globalSettings');if(sb)sb.classList.toggle('active',page==='settings');}
function renderClass(root){
  root.innerHTML=`<div class="topbar"><div><div class="title">Klas</div><div class="subtitle">Alle hulpmiddelen voor dagelijks gebruik in de klas.</div></div></div>
  <div class="grid">
    <div class="tile" data-open="classtodos"><div class="icon">✓</div><div><strong>To Do</strong><div class="muted tile-sub">Taken regelen voor de klas of leerlingen.</div></div></div>
    <div class="tile" data-open="classnotes"><div class="icon">📝</div><div><strong>Notities</strong><div class="muted tile-sub">Notities maken, inspreken, bewaren en mailen.</div></div></div>
    <div class="tile" data-open="classdiary"><div class="icon">📖</div><div><strong>Klasdagboek</strong><div class="muted tile-sub">Gebeurtenissen per dag en AI-weekverslagen.</div></div></div>
    <div class="tile" data-open="groups"><div class="icon">👥</div><div><strong>Groepjesmaker</strong><div class="muted tile-sub">Automatisch of handmatig groepjes maken.</div></div></div>
    <div class="tile" data-open="wheel"><div class="icon">🎯</div><div><strong>Namenrad</strong><div class="muted tile-sub">Draai een willekeurige leerling.</div></div></div>
    <div class="tile" data-open="checklist"><div class="icon">☑️</div><div><strong>Checklist</strong><div class="muted tile-sub">Vink leerlingen af en mail een overzicht.</div></div></div>
    <div class="tile" data-open="points"><div class="icon">🏆</div><div><strong>Punten</strong><div class="muted tile-sub">Geef punten erbij of eraf per leerling.</div></div></div>
    <div class="tile" data-open="feedback"><div class="icon">💬</div><div><strong>Feedback</strong><div class="muted tile-sub">Foto, leerling, spraak en AI-samenvatting.</div></div></div>
    <div class="tile" data-open="turns"><div class="icon">🙋</div><div><strong>Beurten</strong><div class="muted tile-sub">Kies leerlingen zonder herhaling.</div></div></div>
    <div class="tile" data-open="soundboards"><div class="icon">🔊</div><div><strong>Soundboards</strong><div class="muted tile-sub">Gebruik je eigen MP3- en audiobestanden.</div></div></div>
    <div class="tile" data-open="absences"><div class="icon">📋</div><div><strong>Absenties invoeren</strong><div class="muted tile-sub">Ochtend, middag of hele dag per leerling.</div></div></div>
  </div>`;
  root.querySelectorAll('[data-open]').forEach(t=>t.onclick=()=>navigate(t.dataset.open));
}
function loading(root){root.innerHTML='<div class="card"><div class="muted">Pagina laden…</div></div>';}
function errorPage(root,e){console.error(e);root.innerHTML=`<div class="card"><div class="section-title">Deze pagina kon niet worden geladen</div><div class="muted">${String(e?.message||e||'Onbekende fout')}</div><div class="row" style="margin-top:12px"><button class="btn" id="retryPage">Opnieuw proberen</button><button class="btn secondary" id="goHome">Klas</button></div></div>`;root.querySelector('#retryPage').onclick=()=>navigate(page);root.querySelector('#goHome').onclick=()=>navigate('klas');}
async function navigate(to){page=to||'klas';if(page==='class'||page==='home')page='klas';try{history.replaceState(null,'',`#${page}`)}catch{}shell();const root=app.querySelector('#page');loading(root);try{if(page==='klas')renderClass(root);else if(loaders[page]){const render=await loaders[page]();await render(root)}else{page='klas';renderClass(root)}}catch(e){errorPage(root,e)}markNav();window.scrollTo(0,0);}
window.addEventListener('hashchange',()=>navigate(location.hash.slice(1)||'klas'));
if('serviceWorker' in navigator)window.addEventListener('load',async()=>{try{const reg=await navigator.serviceWorker.register('./service-worker.js?v=43');await reg.update?.()}catch(e){console.warn(e)}});
shell();document.getElementById('page').innerHTML='<div class="card"><strong>Meester Martijn App</strong><div class="muted" style="margin-top:6px">App wordt geladen…</div></div>';navigate(location.hash.slice(1)||'klas');
