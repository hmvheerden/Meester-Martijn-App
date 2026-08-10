import {settings} from './storage.js';
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
const pages={mail:renderMail,notes:renderNotes,groups:renderGroups,wheel:renderWheel,soundboards:renderSoundboards,reflection:renderReflection,settings:renderSettings,todos:renderTodos};
const tiles=[
 ['mail','✉️','Mail opstellen','AI helpt je snel een goede mail maken.'],
 ['todos','✓','To Do','Leerkracht, vandaag en leerlingen.'],
 ['notes','📝','Notities','Snel notities bewaren en mailen.'],
 ['groups','👥','Groepjesmaker','Maak willekeurige groepjes.'],
 ['wheel','🎯','Namenrad','Draai een leerling uit de klas.'],
 ['soundboards','🔊','Soundboards','Gebruik je eigen geluidsfragmenten.'],
 ['reflection','💭','Reflectie','Spreek of typ je lesreflectie.'],
 ['settings','⚙️','Instellingen','Klas, AI, thema en gegevens.']
];
function applyTheme(){const t=settings.get('theme','auto');if(t==='auto')document.documentElement.removeAttribute('data-theme');else document.documentElement.dataset.theme=t}applyTheme();
function shell(content){app.innerHTML=`<main class="shell"><div id="page">${content||''}</div></main><nav class="nav"><div class="nav-inner"><button data-nav="home"><span class="nicon">⌂</span>Home</button><button data-nav="mail"><span class="nicon">✉</span>Mail</button><button data-nav="class"><span class="nicon">👥</span>Klas</button><button data-nav="todos"><span class="nicon">✓</span>To Do</button><button data-nav="more"><span class="nicon">•••</span>Meer</button></div></nav>`;app.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>navigate(b.dataset.nav));markNav()}
function markNav(){const map={home:'home',mail:'mail',groups:'class',wheel:'class',todos:'todos',notes:'more',soundboards:'more',reflection:'more',settings:'more',class:'class',more:'more'};app.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===map[page]))}
function renderHome(){page='home';shell();const root=app.querySelector('#page');root.innerHTML=`<div class="hero"><div class="eyebrow">Persoonlijke schoolassistent</div><div class="title">Meester Martijn App</div><div class="subtitle">Alles wat je tijdens een schooldag snel nodig hebt.</div></div><div class="grid">${tiles.map(([id,icon,title,sub])=>`<div class="tile" data-open="${id}"><div class="icon">${icon}</div><div><strong>${title}</strong><div class="muted tile-sub">${sub}</div></div></div>`).join('')}</div>`;root.querySelectorAll('[data-open]').forEach(t=>t.onclick=()=>navigate(t.dataset.open));markNav()}
function renderClass(){page='class';shell();const root=app.querySelector('#page');root.innerHTML=`<div class="topbar"><div><div class="title">Klas</div><div class="subtitle">Hulpmiddelen met je opgeslagen klassenlijst.</div></div></div><div class="grid"><div class="tile" data-open="groups"><div class="icon">👥</div><strong>Groepjesmaker</strong><span class="muted">Verdeel leerlingen snel.</span></div><div class="tile" data-open="wheel"><div class="icon">🎯</div><strong>Namenrad</strong><span class="muted">Draai een willekeurige naam.</span></div></div>`;root.querySelectorAll('[data-open]').forEach(t=>t.onclick=()=>navigate(t.dataset.open));markNav()}
function renderMore(){page='more';shell();const root=app.querySelector('#page');root.innerHTML=`<div class="topbar"><div><div class="title">Meer</div><div class="subtitle">Extra hulpmiddelen en instellingen.</div></div></div><div class="grid">${tiles.filter(x=>['notes','soundboards','reflection','settings'].includes(x[0])).map(([id,icon,title,sub])=>`<div class="tile" data-open="${id}"><div class="icon">${icon}</div><div><strong>${title}</strong><div class="muted tile-sub">${sub}</div></div></div>`).join('')}</div>`;root.querySelectorAll('[data-open]').forEach(t=>t.onclick=()=>navigate(t.dataset.open));markNav()}
async function navigate(to){if(to==='home')return renderHome();if(to==='class')return renderClass();if(to==='more')return renderMore();page=to;shell();const root=app.querySelector('#page');try{await pages[to]?.(root)}catch(e){console.error(e);root.innerHTML=`<div class="card"><strong>Deze pagina kon niet worden geopend.</strong><div class="muted">${e.message}</div></div>`}markNav();window.scrollTo(0,0)}
window.addEventListener('popstate',()=>navigate(location.hash.slice(1)||'home'));
window.addEventListener('hashchange',()=>{const h=location.hash.slice(1);if(h&&h!==page)navigate(h)});
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(console.warn));
renderHome();
