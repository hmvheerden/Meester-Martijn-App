import {settings} from './storage.js';
import {esc,toast} from './utils.js';

let used=new Set();
let history=[];

export async function renderTurns(root){
  const names=settings.get('classList',[]);
  root.innerHTML=`<div class="topbar"><div><div class="title">Beurten</div><div class="subtitle">Geef leerlingen willekeurig een beurt zonder iemand te vergeten.</div></div></div>
  <div class="card">
    <div class="stat">Beschikbaar: <strong id="turnCount">${names.length}</strong> van ${names.length}</div>
    <div id="turnResult" class="wheel-result" style="margin:20px 0">Nog niemand gekozen</div>
    <div class="row"><button id="chooseTurn" class="btn">Kies leerling</button><button id="resetTurns" class="btn secondary">Iedereen opnieuw</button></div>
  </div>
  <div class="section-title">Eerder gekozen</div><div id="turnHistory" class="list"></div>`;
  const count=root.querySelector('#turnCount'),result=root.querySelector('#turnResult'),hist=root.querySelector('#turnHistory');
  function draw(){
    count.textContent=Math.max(0,names.length-used.size);
    hist.innerHTML=history.length?history.map((n,i)=>`<div class="item"><strong>${i+1}. ${esc(n)}</strong></div>`).join(''):'<div class="muted">Nog geen beurten.</div>';
  }
  root.querySelector('#chooseTurn').onclick=()=>{
    if(!names.length)return toast('Voeg eerst leerlingen toe via Instellingen.');
    const available=names.filter(n=>!used.has(n));
    if(!available.length)return toast('Iedereen is aan de beurt geweest. Kies “Iedereen opnieuw”.');
    const name=available[Math.floor(Math.random()*available.length)];
    used.add(name);history.unshift(name);result.textContent=`Gekozen: ${name}`;draw();
  };
  root.querySelector('#resetTurns').onclick=()=>{used=new Set();history=[];result.textContent='Nog niemand gekozen';draw();};
  draw();
}
