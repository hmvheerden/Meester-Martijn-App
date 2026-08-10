const app=document.getElementById('app');
let page='home';

const navItems=[
  ['home','⌂','Home'],
  ['todos','✓','To Do'],
  ['notes','📝','Notities'],
  ['mail','✉️','Mail'],
  ['class','👥','Klas']
];

const loaders={
  home:()=>import('./chat.js').then(m=>m.renderAIChat),
  todos:()=>import('./todos.js').then(m=>m.renderTodos),
  notes:()=>import('./notes.js').then(m=>m.renderNotes),
  mail:()=>import('./mail.js').then(m=>m.renderMail),
  groups:()=>import('./groups.js').then(m=>m.renderGroups),
  wheel:()=>import('./wheel.js').then(m=>m.renderWheel),
  soundboards:()=>import('./soundboards.js').then(m=>m.renderSoundboards),
  reflection:()=>import('./reflection.js').then(m=>m.renderReflection),
  settings:()=>import('./settings.js').then(m=>m.renderSettings)
};

function shell(){
  app.innerHTML=`<main class="shell"><div id="page"></div></main>
  <nav class="nav"><div class="nav-inner">${navItems.map(([id,icon,label])=>`<button data-nav="${id}"><span class="nicon">${icon}</span><span>${label}</span></button>`).join('')}</div></nav>`;
  app.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>navigate(b.dataset.nav));
  markNav();
}

function markNav(){
  const activeNav=['groups','wheel','soundboards'].includes(page)?'class':page;
  app.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===activeNav));
}

function loading(root){
  root.innerHTML=`<div class="card"><div class="muted">Pagina laden…</div></div>`;
}

function errorPage(root,e){
  console.error(e);
  root.innerHTML=`<div class="card">
    <div class="section-title">De pagina kon niet worden geladen</div>
    <div class="muted">Vernieuw de app. Als dit blijft gebeuren, upload dan alle bestanden uit de nieuwste ZIP opnieuw naar GitHub.</div>
    <div class="muted" style="margin-top:8px;font-size:12px">${String(e?.message||e||'Onbekende fout')}</div>
    <div class="row" style="margin-top:12px"><button class="btn" id="retryPage">Opnieuw proberen</button><button class="btn secondary" id="goHome">Home</button></div>
  </div>`;
  root.querySelector('#retryPage').onclick=()=>navigate(page);
  root.querySelector('#goHome').onclick=()=>navigate('home');
}

function renderClass(root){
  root.innerHTML=`<div class="topbar"><div><div class="title">Klas</div><div class="subtitle">Hulpmiddelen voor dagelijks gebruik in de klas.</div></div><button class="btn secondary small" data-open="settings">⚙ Instellingen</button></div>
  <div class="grid">
    <div class="tile" data-open="groups"><div class="icon">👥</div><div><strong>Groepjesmaker</strong><div class="muted tile-sub">Maak en pas groepjes aan.</div></div></div>
    <div class="tile" data-open="wheel"><div class="icon">🎯</div><div><strong>Namenrad</strong><div class="muted tile-sub">Draai een willekeurige leerling.</div></div></div>
    <div class="tile" data-open="soundboards"><div class="icon">🔊</div><div><strong>Soundboards</strong><div class="muted tile-sub">Gebruik je eigen MP3- en audiobestanden.</div></div></div>
  </div>`;
  root.querySelectorAll('[data-open]').forEach(t=>t.onclick=()=>navigate(t.dataset.open));
}

async function renderHomeWithSettings(root){
  const render=await loaders.home();
  await render(root);
  const top=root.querySelector('.topbar');
  if(top){
    const settingsBtn=document.createElement('button');
    settingsBtn.className='btn secondary small';
    settingsBtn.textContent='⚙ Instellingen';
    settingsBtn.onclick=()=>navigate('settings');
    top.appendChild(settingsBtn);
  }
}

async function navigate(to){
  page=to||'home';
  try{history.replaceState(null,'',`#${page}`)}catch{}
  shell();
  const root=app.querySelector('#page');
  loading(root);
  try{
    if(page==='class') renderClass(root);
    else if(page==='home') await renderHomeWithSettings(root);
    else if(loaders[page]) {
      const render=await loaders[page]();
      await render(root);
    } else {
      page='home';
      await renderHomeWithSettings(root);
    }
  }catch(e){ errorPage(root,e); }
  markNav();
  window.scrollTo(0,0);
}

window.addEventListener('hashchange',()=>navigate(location.hash.slice(1)||'home'));

if('serviceWorker' in navigator){
  window.addEventListener('load',async()=>{
    try{
      const reg=await navigator.serviceWorker.register('./service-worker.js?v=9');
      reg.update?.();
    }catch(e){console.warn('Service worker kon niet worden geregistreerd',e)}
  });
}

shell();
const first=document.getElementById('page');
first.innerHTML=`<div class="card"><div class="section-title">Meester Martijn App</div><div class="muted">App wordt gestart…</div></div>`;
navigate(location.hash.slice(1)||'home');
