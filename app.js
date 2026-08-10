import {settings} from './storage.js';
import {renderAIChat} from './chat.js';
import {renderMail} from './mail.js';
import {renderNotes} from './notes.js';
import {renderGroups} from './groups.js';
import {renderWheel} from './wheel.js';
import {renderSoundboards} from './soundboards.js';
import {renderReflection} from './reflection.js';
import {renderSettings} from './settings.js';
import {renderTodos} from './todos.js';

const app=document.getElementById('app');
let page='home';

const pages={
  home:renderAIChat,
  mail:renderMail,
  notes:renderNotes,
  groups:renderGroups,
  wheel:renderWheel,
  soundboards:renderSoundboards,
  reflection:renderReflection,
  todos:renderTodos,
  settings:renderSettings
};

const navItems=[
  ['home','⌂','Home'],
  ['todos','✓','To Do'],
  ['notes','📝','Notities'],
  ['mail','✉️','Mail'],
  ['class','👥','Klas']
];

function applyTheme(){
  const t=settings.get('theme','auto');
  if(t==='auto')document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme=t;
}
applyTheme();

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

function renderClass(root){
  root.innerHTML=`<div class="topbar"><div><div class="title">Klas</div><div class="subtitle">Hulpmiddelen voor dagelijks gebruik in de klas.</div></div></div>
  <div class="grid">
    <div class="tile" data-open="groups">
      <div class="icon">👥</div>
      <div><strong>Groepjesmaker</strong><div class="muted tile-sub">Maak en pas groepjes aan.</div></div>
    </div>
    <div class="tile" data-open="wheel">
      <div class="icon">🎯</div>
      <div><strong>Namenrad</strong><div class="muted tile-sub">Draai een willekeurige leerling.</div></div>
    </div>
    <div class="tile" data-open="soundboards">
      <div class="icon">🔊</div>
      <div><strong>Soundboards</strong><div class="muted tile-sub">Gebruik je eigen MP3- en audiobestanden.</div></div>
    </div>
  </div>`;
  root.querySelectorAll('[data-open]').forEach(t=>t.onclick=()=>navigate(t.dataset.open));
}

async function navigate(to){
  page=to||'home';
  if(location.hash.slice(1)!==page)history.replaceState(null,'',`#${page}`);
  shell();
  const root=app.querySelector('#page');
  try{
    if(page==='class') renderClass(root);
    else if(pages[page]) await pages[page](root);
    else { page='home'; await pages.home(root); }
  }catch(e){
    console.error(e);
    root.innerHTML=`<div class="card"><strong>Deze pagina kon niet worden geopend.</strong><div class="muted">${e.message}</div></div>`;
  }
  markNav();
  window.scrollTo(0,0);
}

window.addEventListener('hashchange',()=>navigate(location.hash.slice(1)||'home'));

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(console.warn));
}

navigate(location.hash.slice(1)||'home');
