import {settings,put} from './storage.js';
import {shuffle,esc,uid,copy,toast} from './utils.js';

function conflicts(groups,pairs){return pairs.reduce((n,[a,b])=>n+groups.filter(g=>g.includes(a)&&g.includes(b)).length,0)}
function missingPreferred(groups,pairs){return pairs.reduce((n,[a,b])=>n+(groups.some(g=>g.includes(a)&&g.includes(b))?0:1),0)}
function makeBySize(names,size,avoid,prefer){let best=[],score=1e9;for(let t=0;t<300;t++){const a=shuffle(names),g=[];for(let i=0;i<a.length;i+=size)g.push(a.slice(i,i+size));const s=conflicts(g,avoid)*10+missingPreferred(g,prefer);if(s<score){best=g;score=s;if(!s)break}}return best}
function makeByCount(names,count,avoid,prefer){let best=[],score=1e9;for(let t=0;t<300;t++){const a=shuffle(names),g=Array.from({length:Math.min(count,names.length)},()=>[]);a.forEach((n,i)=>g[i%g.length].push(n));const s=conflicts(g,avoid)*10+missingPreferred(g,prefer);if(s<score){best=g;score=s;if(!s)break}}return best}

export async function renderGroups(root){
  const names=settings.get('classList',[]);
  let groups=[],dragName=null,mode='auto',manualCount=4,activeManual=0;
  let manualGroups=Array.from({length:manualCount},()=>[]);

  root.innerHTML=`<div class="topbar"><div><div class="title">Groepjesmaker</div><div class="subtitle">Aantal leerlingen: ${names.length}</div></div></div>
  ${!names.length?'<div class="card">Voeg eerst je klassenlijst toe bij Instellingen.</div>':''}
  <div class="seg group-mode"><button data-gmode="auto" class="active">Automatisch</button><button data-gmode="manual">Zelf indelen</button></div>

  <div id="autoMode" style="margin-top:14px">
    <div class="card"><div class="field"><label>Groepsindeling</label><select id="groupMode" class="select">
      <option value="2">Tweetallen</option><option value="3">Groepjes van 3</option><option value="4">Groepjes van 4</option><option value="5">Groepjes van 5</option><option value="size">Zelf groepsgrootte kiezen</option><option value="count">Zelf aantal groepen kiezen</option>
    </select></div><div class="field hidden" id="customWrap"><label id="customLabel">Groepsgrootte</label><input id="customValue" type="number" min="2" max="12" value="4" class="input"></div><button class="btn" id="makeGroups" ${!names.length?'disabled':''}>Maak groepjes</button></div>
    <div class="card"><div class="section-title">Combinaties</div><div class="muted">Optioneel: geef aan wie juist niet of wel samen moet.</div><div class="pair-grid"><select id="p1" class="select">${names.map(n=>`<option>${esc(n)}</option>`).join('')}</select><select id="p2" class="select">${names.map(n=>`<option>${esc(n)}</option>`).join('')}</select></div><div class="row" style="margin-top:9px"><button id="addAvoid" class="btn secondary small">Niet samen</button><button id="addPrefer" class="btn secondary small">Juist samen</button></div><div id="pairList" class="list" style="margin-top:10px"></div></div>
    <div id="groups" class="groups"></div>
    <div id="groupActions" class="row hidden" style="margin-top:12px"><button class="btn secondary" id="reshuffle">Opnieuw verdelen</button><button class="btn secondary" id="copyGroups">Kopiëren</button><button class="btn" id="saveGroups">Opslaan</button><button class="btn secondary" id="shareGroups">Delen</button></div>
  </div>

  <div id="manualMode" class="hidden" style="margin-top:14px">
    <div class="card">
      <div class="field"><label>Hoeveel groepen?</label><select id="manualCount" class="select">${[1,2,3,4,5,6].map(n=>`<option value="${n}" ${n===4?'selected':''}>${n} groep${n===1?'':'en'}</option>`).join('')}</select></div>
      <div class="muted">Kies eerst een groep en tik daarna op de leerlingen die je daarin wilt zetten.</div>
    </div>
    <div id="manualTabs" class="todo-tabs"></div>
    <div class="card"><div class="section-title" id="manualTitle">Groep 1</div><div id="manualNames" class="manual-name-grid"></div></div>
    <div class="section-title">Indeling</div><div id="manualOverview" class="groups"></div>
    <div class="row" style="margin-top:12px"><button id="copyManual" class="btn secondary">Kopiëren</button><button id="saveManual" class="btn">Opslaan</button><button id="clearManual" class="btn danger small">Wissen</button></div>
  </div>`;

  const autoMode=root.querySelector('#autoMode'),manualMode=root.querySelector('#manualMode');
  root.querySelectorAll('[data-gmode]').forEach(b=>b.onclick=()=>{
    mode=b.dataset.gmode;
    root.querySelectorAll('[data-gmode]').forEach(x=>x.classList.toggle('active',x===b));
    autoMode.classList.toggle('hidden',mode!=='auto');
    manualMode.classList.toggle('hidden',mode!=='manual');
    if(mode==='manual')drawManual();
  });

  // Automatic mode
  const sel=root.querySelector('#groupMode'),wrap=root.querySelector('#customWrap'),label=root.querySelector('#customLabel'),out=root.querySelector('#groups'),actions=root.querySelector('#groupActions');
  sel.onchange=()=>{wrap.classList.toggle('hidden',!['size','count'].includes(sel.value));label.textContent=sel.value==='count'?'Aantal groepen':'Groepsgrootte'};
  function pairState(){return {avoid:settings.get('avoidPairs',[]),prefer:settings.get('preferPairs',[])}}
  function drawPairs(){const {avoid,prefer}=pairState(),el=root.querySelector('#pairList');const rows=[...avoid.map((p,i)=>({type:'avoid',i,p})),...prefer.map((p,i)=>({type:'prefer',i,p}))];el.innerHTML=rows.length?rows.map(r=>`<div class="item row"><span class="grow"><strong>${r.type==='avoid'?'Niet samen':'Juist samen'}:</strong> ${esc(r.p[0])} + ${esc(r.p[1])}</span><button class="icon-btn danger-text" data-pair="${r.type}:${r.i}">×</button></div>`).join(''):'<span class="muted">Geen combinaties ingesteld.</span>';el.querySelectorAll('[data-pair]').forEach(b=>b.onclick=()=>{const [type,ix]=b.dataset.pair.split(':');const key=type==='avoid'?'avoidPairs':'preferPairs',arr=settings.get(key,[]);arr.splice(+ix,1);settings.set(key,arr);drawPairs()})}
  function addPair(key){const a=root.querySelector('#p1').value,b=root.querySelector('#p2').value;if(!a||!b||a===b)return toast('Kies twee verschillende leerlingen.');const arr=settings.get(key,[]);if(!arr.some(p=>p.includes(a)&&p.includes(b)))arr.push([a,b]);settings.set(key,arr);drawPairs()}
  root.querySelector('#addAvoid').onclick=()=>addPair('avoidPairs');root.querySelector('#addPrefer').onclick=()=>addPair('preferPairs');
  function draw(){out.innerHTML=groups.map((g,i)=>`<div class="card group-card" data-group="${i}"><strong>Groep ${i+1}</strong>${g.map(n=>`<div class="student" draggable="true" data-name="${esc(n)}">${esc(n)}</div>`).join('')}</div>`).join('');actions.classList.toggle('hidden',!groups.length);out.querySelectorAll('.student').forEach(el=>{el.ondragstart=()=>dragName=el.dataset.name;el.onclick=()=>dragName=el.dataset.name});out.querySelectorAll('[data-group]').forEach(card=>{card.ondragover=e=>e.preventDefault();card.ondrop=e=>{e.preventDefault();move(dragName,+card.dataset.group)};card.onclick=e=>{if(e.target===card&&dragName)move(dragName,+card.dataset.group)}})}
  function move(name,to){if(!name)return;let from=-1;groups.forEach((g,i)=>{const ix=g.indexOf(name);if(ix>=0){from=i;g.splice(ix,1)}});if(from>=0)groups[to].push(name);dragName=null;draw()}
  function generate(){const {avoid,prefer}=pairState();if(sel.value==='count')groups=makeByCount(names,Math.max(2,+root.querySelector('#customValue').value||4),avoid,prefer);else groups=makeBySize(names,sel.value==='size'?Math.max(2,+root.querySelector('#customValue').value||4):+sel.value,avoid,prefer);draw()}
  const textAuto=()=>groups.map((g,i)=>`Groep ${i+1}: ${g.join(', ')}`).join('\n');
  root.querySelector('#makeGroups').onclick=generate;root.querySelector('#reshuffle').onclick=generate;root.querySelector('#copyGroups').onclick=()=>copy(textAuto());root.querySelector('#shareGroups').onclick=async()=>{if(navigator.share)try{await navigator.share({title:'Groepjes',text:textAuto()})}catch{}else copy(textAuto())};root.querySelector('#saveGroups').onclick=async()=>{await put('savedGroups',{id:uid(),createdAt:new Date().toISOString(),groups});toast('Groepjes opgeslagen')};drawPairs();

  // Manual mode
  const tabs=root.querySelector('#manualTabs'),manualNames=root.querySelector('#manualNames'),overview=root.querySelector('#manualOverview'),title=root.querySelector('#manualTitle');
  root.querySelector('#manualCount').onchange=e=>{
    manualCount=Number(e.target.value);
    const old=manualGroups;
    manualGroups=Array.from({length:manualCount},(_,i)=>old[i]||[]);
    const assigned=new Set(manualGroups.flat());
    manualGroups=manualGroups.map(g=>g.filter((n,i,a)=>names.includes(n)&&a.indexOf(n)===i));
    // remove duplicates across groups
    const seen=new Set();
    manualGroups=manualGroups.map(g=>g.filter(n=>{if(seen.has(n))return false;seen.add(n);return true}));
    activeManual=Math.min(activeManual,manualCount-1);
    drawManual();
  };
  function studentGroup(name){return manualGroups.findIndex(g=>g.includes(name))}
  function toggleStudent(name){
    const current=studentGroup(name);
    if(current===activeManual){
      manualGroups[activeManual]=manualGroups[activeManual].filter(n=>n!==name);
    }else{
      if(current>=0)manualGroups[current]=manualGroups[current].filter(n=>n!==name);
      manualGroups[activeManual].push(name);
    }
    drawManual();
  }
  function drawManual(){
    tabs.innerHTML=Array.from({length:manualCount},(_,i)=>`<button data-mgroup="${i}" class="${i===activeManual?'active':''}">Groep ${i+1}</button>`).join('');
    tabs.querySelectorAll('[data-mgroup]').forEach(b=>b.onclick=()=>{activeManual=Number(b.dataset.mgroup);drawManual()});
    title.textContent=`Groep ${activeManual+1}`;
    manualNames.innerHTML=names.map(n=>{
      const g=studentGroup(n),selected=g===activeManual;
      return `<button class="manual-name ${selected?'selected':''}" data-student="${esc(n)}">${esc(n)}${g>=0?` <small>G${g+1}</small>`:''}</button>`;
    }).join('')||'<div class="muted">Nog geen leerlingen.</div>';
    manualNames.querySelectorAll('[data-student]').forEach(b=>b.onclick=()=>toggleStudent(b.dataset.student));
    overview.innerHTML=manualGroups.map((g,i)=>`<div class="card group-card"><strong>Groep ${i+1}</strong>${g.length?g.map(n=>`<div class="student">${esc(n)}</div>`).join(''):'<div class="muted" style="margin-top:8px">Nog leeg</div>'}</div>`).join('');
  }
  const manualText=()=>manualGroups.map((g,i)=>`Groep ${i+1}: ${g.join(', ')||'—'}`).join('\n');
  root.querySelector('#copyManual').onclick=()=>copy(manualText());
  root.querySelector('#saveManual').onclick=async()=>{await put('savedGroups',{id:uid(),createdAt:new Date().toISOString(),groups:manualGroups,manual:true});toast('Handmatige indeling opgeslagen')};
  root.querySelector('#clearManual').onclick=()=>{if(confirm('Handmatige groepsindeling wissen?')){manualGroups=Array.from({length:manualCount},()=>[]);drawManual()}};
  drawManual();
}
