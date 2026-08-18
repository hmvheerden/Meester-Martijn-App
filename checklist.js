import {settings,getAll,put,del} from './storage.js';
import {uid,esc,fmt,mailto,copy,toast} from './utils.js';

export async function renderChecklist(root){
  const names=settings.get('classList',[]).slice().sort((a,b)=>String(a).localeCompare(String(b),'nl',{sensitivity:'base'}));
  let active=null;

  root.innerHTML=`<div class="topbar"><div><div class="title">Checklist</div><div class="subtitle">Maak checklists op basis van je volledige klassenlijst.</div></div></div>
  <div id="checklistOverview">
    <div class="card"><div class="row"><input id="newChecklistName" class="input grow" placeholder="Naam checklist, bijv. Boek ingeleverd"><button id="createChecklist" class="btn">Nieuwe checklist</button></div></div>
    <div id="savedChecklists" class="list"></div>
  </div>
  <div id="checklistDetail" class="hidden"></div>`;

  const overview=root.querySelector('#checklistOverview'),detail=root.querySelector('#checklistDetail'),saved=root.querySelector('#savedChecklists');

  async function drawOverview(){
    const items=(await getAll('checklists')).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
    saved.innerHTML=items.length?items.map(x=>{
      const done=Object.values(x.checked||{}).filter(Boolean).length;
      return `<div class="item"><strong>${esc(x.name)}</strong><div class="muted">${done}/${names.length} afgevinkt · ${fmt(x.updatedAt)}</div><div class="row" style="margin-top:9px"><button class="btn secondary small" data-open="${x.id}">Open</button><button class="btn danger small" data-del="${x.id}">Verwijderen</button></div></div>`;
    }).join(''):'<div class="muted">Nog geen checklists.</div>';
    saved.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openChecklist(b.dataset.open));
    saved.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(confirm('Deze checklist verwijderen?')){await del('checklists',b.dataset.del);drawOverview()}});
  }

  root.querySelector('#createChecklist').onclick=async()=>{
    const name=root.querySelector('#newChecklistName').value.trim();
    if(!name)return toast('Geef de checklist een naam.');
    if(!names.length)return toast('Voeg eerst je klassenlijst toe via Instellingen.');
    const now=new Date().toISOString();
    const item={id:uid(),name,checked:{},createdAt:now,updatedAt:now,submitted:false};
    await put('checklists',item);
    root.querySelector('#newChecklistName').value='';
    openChecklist(item.id);
  };

  async function openChecklist(id){
    active=(await getAll('checklists')).find(x=>x.id===id);
    if(!active)return;
    overview.classList.add('hidden');detail.classList.remove('hidden');
    drawDetail();
  }

  function missingNames(){return names.filter(n=>!active.checked?.[n])}
  function mailText(){
    const missing=missingNames();
    return `Checklist: ${active.name}\n\nAfgevinkt: ${names.length-missing.length}/${names.length}\n\n${missing.length?`Ontbreken nog:\n${missing.map(n=>`- ${n}`).join('\n')}`:'Iedereen is afgevinkt.'}`;
  }

  function drawDetail(){
    const missing=missingNames();
    detail.innerHTML=`<div class="topbar"><button id="backChecklists" class="btn secondary small">← Terug</button><div style="text-align:right"><div class="section-title" style="margin:0">${esc(active.name)}</div><div class="muted">${names.length-missing.length}/${names.length} afgevinkt</div></div></div>
      <div class="card">
        <div class="checklist-names">${names.map(n=>`<label class="check-student ${active.checked?.[n]?'done':''}"><input type="checkbox" data-name="${esc(n)}" ${active.checked?.[n]?'checked':''}><span>${esc(n)}</span></label>`).join('')}</div>
      </div>
      <div class="row"><button id="submitChecklist" class="btn">Checklist indienen</button><button id="mailChecklist" class="btn secondary">Mail checklist</button><button id="copyChecklist" class="btn secondary">Kopiëren</button></div>
      <div id="missingCard" style="margin-top:14px">${active.submitted?missingCardHtml(missing):''}</div>`;

    detail.querySelector('#backChecklists').onclick=()=>{detail.classList.add('hidden');overview.classList.remove('hidden');drawOverview()};
    detail.querySelectorAll('[data-name]').forEach(c=>c.onchange=async()=>{
      active.checked=active.checked||{};
      active.checked[c.dataset.name]=c.checked;
      active.updatedAt=new Date().toISOString();
      await put('checklists',active);
      drawDetail();
    });
    detail.querySelector('#submitChecklist').onclick=async()=>{
      active.submitted=true;active.updatedAt=new Date().toISOString();await put('checklists',active);
      drawDetail();
      toast(missingNames().length?'Checklist ingediend; ontbrekende leerlingen staan onderaan.':'Checklist compleet');
    };
    detail.querySelector('#mailChecklist').onclick=()=>mailto(settings.get('email',''),`Checklist – ${active.name}`,mailText());
    detail.querySelector('#copyChecklist').onclick=()=>copy(mailText());
  }

  function missingCardHtml(missing){
    return `<div class="card"><div class="section-title">Deze leerlingen ontbreken nog</div>${missing.length?`<div class="chips">${missing.map(n=>`<span class="chip">${esc(n)}</span>`).join('')}</div><div class="muted" style="margin-top:10px">Je kunt hierboven later gewoon verder afvinken.</div>`:'<div class="muted">Iedereen is afgevinkt.</div>'}</div>`;
  }

  drawOverview();
}
