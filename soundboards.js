import {getAll,put,del,settings} from './storage.js';
import {uid,esc,toast} from './utils.js';
let activeAudio=[];
const ACCEPT='.mp3,.m4a,.wav,.aac,.ogg,.oga,.webm,.mp4,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,audio/aac,audio/ogg,audio/webm,audio/*';

export async function renderSoundboards(root){
  let selected=null;
  root.innerHTML=`<div class="topbar"><div><div class="title">Soundboards</div><div class="subtitle">Voeg je eigen geluidsfragmenten toe en speel ze direct af.</div></div></div>
  <div class="card"><label><input id="multiAudioPage" type="checkbox" ${settings.get('multiAudio',false)?'checked':''}> Meerdere geluiden tegelijk afspelen</label></div>
  <div id="boardsView"><div class="card"><div class="row"><input id="newBoardName" class="input grow" placeholder="Naam soundboard"><button id="newBoard" class="btn">Nieuw soundboard</button></div></div><div id="boards" class="grid"></div></div><div id="boardDetail" class="hidden"></div>`;
  root.querySelector('#multiAudioPage').onchange=e=>settings.set('multiAudio',e.target.checked);
  const boardsEl=root.querySelector('#boards'),detail=root.querySelector('#boardDetail'),overview=root.querySelector('#boardsView');

  async function drawBoards(){
    const boards=await getAll('soundboards');
    boardsEl.innerHTML=boards.length?boards.map(b=>`<div class="tile" data-board="${b.id}"><div class="icon">🔊</div><strong>${esc(b.name)}</strong><span class="muted">Open soundboard</span></div>`).join(''):'<div class="muted">Nog geen soundboards.</div>';
    boardsEl.querySelectorAll('[data-board]').forEach(t=>t.onclick=()=>openBoard(t.dataset.board));
  }
  root.querySelector('#newBoard').onclick=async()=>{const n=root.querySelector('#newBoardName').value.trim();if(!n)return toast('Geef het soundboard een naam.');await put('soundboards',{id:uid(),name:n,createdAt:new Date().toISOString()});root.querySelector('#newBoardName').value='';await drawBoards()};

  async function openBoard(id){
    selected=(await getAll('soundboards')).find(x=>x.id===id);if(!selected)return;
    overview.classList.add('hidden');detail.classList.remove('hidden');
    detail.innerHTML=`<div class="topbar"><button id="backBoards" class="btn secondary small">← Terug</button><div style="text-align:right"><div class="section-title" style="margin:0">${esc(selected.name)}</div></div></div>
    <div class="card"><div class="field"><label>Geluidsbestand</label><input id="soundFile" type="file" accept="${ACCEPT}" class="input"><div class="muted" style="margin-top:6px">Ondersteund: MP3, M4A, WAV, AAC, OGG, WebM en andere audioformaten die Safari kan afspelen.</div></div><div class="row"><input id="soundName" class="input grow" placeholder="Naam van geluid"><button id="addSound" type="button" class="btn">Toevoegen</button></div><div id="addStatus" class="muted" style="margin-top:8px"></div></div>
    <div id="sounds" class="sound-grid"></div><div class="row" style="margin-top:14px"><button id="renameBoard" class="btn secondary small">Hernoemen</button><button id="deleteBoard" class="btn danger small">Soundboard verwijderen</button></div>`;
    detail.querySelector('#backBoards').onclick=()=>{stopAll();detail.classList.add('hidden');overview.classList.remove('hidden');drawBoards()};
    detail.querySelector('#addSound').onclick=addSound;
    detail.querySelector('#renameBoard').onclick=async()=>{const n=prompt('Nieuwe naam:',selected.name);if(n?.trim()){selected.name=n.trim();await put('soundboards',selected);openBoard(selected.id)}};
    detail.querySelector('#deleteBoard').onclick=async()=>{if(!confirm('Dit soundboard en alle geluiden verwijderen?'))return;for(const s of (await getAll('sounds')).filter(x=>x.boardId===selected.id))await del('sounds',s.id);await del('soundboards',selected.id);detail.querySelector('#backBoards').click()};
    await drawSounds();
  }

  async function addSound(){
    const input=detail.querySelector('#soundFile'),status=detail.querySelector('#addStatus'),button=detail.querySelector('#addSound');
    const file=input.files?.[0];
    if(!file)return toast('Kies eerst een geluidsbestand.');
    const name=detail.querySelector('#soundName').value.trim()||file.name.replace(/\.[^.]+$/,'');
    try{
      button.disabled=true;status.textContent='Geluid wordt toegevoegd…';
      const data=await file.arrayBuffer();
      await put('sounds',{id:uid(),boardId:selected.id,name,fileName:file.name,mimeType:file.type||mimeFromName(file.name),data,createdAt:new Date().toISOString()});
      input.value='';detail.querySelector('#soundName').value='';status.textContent=`Toegevoegd: ${name}`;
      await drawSounds();toast('Geluid toegevoegd');
    }catch(e){console.error(e);status.textContent='Toevoegen mislukt.';toast(`Geluid kon niet worden opgeslagen: ${e.message||'onbekende fout'}`)}finally{button.disabled=false}
  }

  async function drawSounds(){
    const sounds=(await getAll('sounds')).filter(x=>x.boardId===selected.id),el=detail.querySelector('#sounds');
    el.innerHTML=sounds.length?sounds.map(s=>`<div class="sound-tile"><button class="sound-btn" data-play="${s.id}">▶<br>${esc(s.name)}</button><div class="muted" style="font-size:12px;margin:5px 0">${esc(s.fileName||'Audiobestand')}</div><div class="row"><button class="btn secondary small" data-rename="${s.id}">Naam</button><button class="btn danger small" data-del="${s.id}">Wis</button></div></div>`).join(''):'<div class="muted">Nog geen geluiden toegevoegd.</div>';
    el.querySelectorAll('[data-play]').forEach(b=>b.onclick=()=>play(sounds.find(s=>s.id===b.dataset.play),b));
    el.querySelectorAll('[data-rename]').forEach(b=>b.onclick=async()=>{const s=sounds.find(x=>x.id===b.dataset.rename);const n=prompt('Nieuwe naam:',s.name);if(n?.trim()){s.name=n.trim();await put('sounds',s);drawSounds()}});
    el.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(confirm('Dit geluid verwijderen?')){await del('sounds',b.dataset.del);drawSounds()}});
  }

  function mimeFromName(name=''){const ext=name.split('.').pop()?.toLowerCase();return ({mp3:'audio/mpeg',m4a:'audio/mp4',mp4:'audio/mp4',wav:'audio/wav',aac:'audio/aac',ogg:'audio/ogg',oga:'audio/ogg',webm:'audio/webm'})[ext]||'audio/mpeg'}
  function stopAll(){activeAudio.forEach(a=>{try{a.pause();if(a._url)URL.revokeObjectURL(a._url)}catch{}});activeAudio=[]}
  function play(s,btn){
    if(!s)return;
    if(!settings.get('multiAudio',false))stopAll();
    try{
      let blob;
      if(s.data) blob=new Blob([s.data],{type:s.mimeType||mimeFromName(s.fileName)});
      else if(s.blob) blob=s.blob;
      else throw new Error('Geen audiogegevens gevonden');
      const url=URL.createObjectURL(blob),a=new Audio();a.src=url;a.preload='auto';a._url=url;activeAudio.push(a);btn.classList.add('playing');
      const cleanup=()=>{btn.classList.remove('playing');URL.revokeObjectURL(url);activeAudio=activeAudio.filter(x=>x!==a)};
      a.onended=cleanup;a.onerror=()=>{cleanup();toast('Dit geluidsbestand kan Safari niet afspelen.')};
      a.play().catch(e=>{cleanup();toast(`Afspelen lukt niet: ${e.message||'onbekende fout'}`)});
    }catch(e){toast(`Geluid kon niet worden geopend: ${e.message}`)}
  }
  await drawBoards();
}
