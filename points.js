import {settings,getAll,put} from './storage.js';
import {esc,mailto,copy,toast} from './utils.js';

export async function renderPoints(root){
  const names=settings.get('classList',[]);
  root.innerHTML=`<div class="topbar"><div><div class="title">Punten bijhouden</div><div class="subtitle">Geef per leerling punten erbij of eraf.</div></div></div>
  ${!names.length?'<div class="card">Voeg eerst je klassenlijst toe via Instellingen.</div>':''}
  <div class="card">
    <div class="row"><button id="resetPoints" class="btn danger small">Alle punten op 0</button><button id="copyPoints" class="btn secondary small">Kopieer overzicht</button><button id="mailPoints" class="btn">Mail puntenoverzicht</button></div>
  </div>
  <div id="pointsList" class="list"></div>`;

  const stored=await getAll('points');
  const map=new Map(stored.map(x=>[x.name,x.points||0]));
  for(const n of names) if(!map.has(n)) map.set(n,0);

  const list=root.querySelector('#pointsList');

  async function save(name,value){
    map.set(name,value);
    await put('points',{id:name,name,points:value,updatedAt:new Date().toISOString()});
  }

  function overview(){
    return `Puntenoverzicht\n\n${names.map(n=>`${n}: ${map.get(n)||0} punten`).join('\n')}`;
  }

  function draw(){
    list.innerHTML=names.length?names.map(n=>`
      <div class="item points-row">
        <div class="points-name">${esc(n)}</div>
        <div class="points-controls">
          <button class="points-btn minus" data-minus="${esc(n)}">−</button>
          <div class="points-score" data-score="${esc(n)}">${map.get(n)||0}</div>
          <button class="points-btn plus" data-plus="${esc(n)}">+</button>
        </div>
      </div>`).join(''):'<div class="muted">Nog geen leerlingen.</div>';

    list.querySelectorAll('[data-plus]').forEach(b=>b.onclick=async()=>{
      const name=b.dataset.plus; await save(name,(map.get(name)||0)+1); draw();
    });
    list.querySelectorAll('[data-minus]').forEach(b=>b.onclick=async()=>{
      const name=b.dataset.minus; await save(name,(map.get(name)||0)-1); draw();
    });
  }

  root.querySelector('#resetPoints').onclick=async()=>{
    if(!confirm('Alle punten van alle leerlingen op 0 zetten?'))return;
    for(const n of names) await save(n,0);
    draw(); toast('Alle punten staan op 0');
  };

  root.querySelector('#copyPoints').onclick=()=>copy(overview());

  root.querySelector('#mailPoints').onclick=()=>{
    const email=settings.get('email','');
    if(!email)toast('Vul eerst je e-mailadres in bij Instellingen.');
    mailto(email,'Puntenoverzicht klas',overview());
  };

  draw();
}
