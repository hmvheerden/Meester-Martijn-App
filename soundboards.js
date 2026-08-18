import {getAll,put,del,settings} from './storage.js';
import {uid,esc,toast} from './utils.js';
let activeAudio=new Map();
const ACCEPT='.mp3,.m4a,.wav,.aac,.ogg,.oga,.webm,.mp4,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,audio/aac,audio/ogg,audio/webm,audio/*';
const DEFAULT_SOUND_COLOR='#0a84ff';
function safeColor(value){return /^#[0-9a-f]{6}$/i.test(String(value||''))?value:DEFAULT_SOUND_COLOR}

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
    <div class="card"><div class="field"><label>Geluidsbestand</label><input id="soundFile" type="file" accept="${ACCEPT}" class="input"><div class="muted" style="margin-top:6px">Ondersteund: MP3, M4A, WAV, AAC, OGG, WebM en andere audioformaten die Safari kan afspelen.</div></div><div class="row"><input id="soundName" class="input grow" placeholder="Naam van geluid"><label class="sound-color-add">Kleur <input id="soundColor" type="color" value="${DEFAULT_SOUND_COLOR}"></label><button id="addSound" type="button" class="btn">Toevoegen</button></div><div id="addStatus" class="muted" style="margin-top:8px"></div></div>
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
      const existing=(await getAll('sounds')).filter(x=>x.boardId===selected.id);
      const nextOrder=existing.length?Math.max(...existing.map((x,i)=>Number.isFinite(Number(x.order))?Number(x.order):i))+1:0;
      const color=safeColor(detail.querySelector('#soundColor')?.value);
      await put('sounds',{id:uid(),boardId:selected.id,name,fileName:file.name,mimeType:file.type||mimeFromName(file.name),data,color,order:nextOrder,createdAt:new Date().toISOString()});
      input.value='';detail.querySelector('#soundName').value='';detail.querySelector('#soundColor').value=DEFAULT_SOUND_COLOR;status.textContent=`Toegevoegd: ${name}`;
      await drawSounds();toast('Geluid toegevoegd');
    }catch(e){console.error(e);status.textContent='Toevoegen mislukt.';toast(`Geluid kon niet worden opgeslagen: ${e.message||'onbekende fout'}`)}finally{button.disabled=false}
  }

  async function drawSounds(){
    let sounds=(await getAll('sounds')).filter(x=>x.boardId===selected.id);

    // Bestaande geluiden uit oudere versies krijgen automatisch een vaste volgorde.
    let changed=false;
    sounds=sounds
      .map((x,i)=>{
        if(!Number.isFinite(Number(x.order))){x.order=i;changed=true}
        if(!x.color){x.color=DEFAULT_SOUND_COLOR;changed=true}
        return x;
      })
      .sort((a,b)=>Number(a.order)-Number(b.order)||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
    if(changed)for(const item of sounds)await put('sounds',item);

    const el=detail.querySelector('#sounds');
    el.innerHTML=sounds.length?sounds.map((snd,index)=>`
      <div class="sound-tile">
        <button class="sound-btn" data-play="${snd.id}" style="background:${safeColor(snd.color)};border-color:${safeColor(snd.color)};color:#fff">▶<br>${esc(snd.name)}</button>
        <div class="muted" style="font-size:12px;margin:5px 0">${esc(snd.fileName||'Audiobestand')}</div>
        <div class="sound-control-row">
          <label class="sound-color-control" title="Kleur kiezen"><span>Kleur</span><input type="color" data-color="${snd.id}" value="${safeColor(snd.color)}"></label>
          <button class="btn secondary small" data-up="${snd.id}" ${index===0?'disabled':''}>↑ Omhoog</button>
          <button class="btn secondary small" data-down="${snd.id}" ${index===sounds.length-1?'disabled':''}>↓ Omlaag</button>
        </div>
        <div class="row" style="margin-top:7px">
          <button class="btn secondary small" data-rename="${snd.id}">Naam</button>
          <button class="btn danger small" data-del="${snd.id}">Wis</button>
        </div>
      </div>`).join(''):'<div class="muted">Nog geen geluiden toegevoegd.</div>';

    el.querySelectorAll('[data-play]').forEach(b=>b.onclick=()=>play(sounds.find(x=>x.id===b.dataset.play),b));

    el.querySelectorAll('[data-color]').forEach(input=>input.oninput=async()=>{
      const snd=sounds.find(x=>x.id===input.dataset.color);
      if(!snd)return;
      snd.color=safeColor(input.value);
      await put('sounds',snd);
      const playBtn=el.querySelector(`[data-play="${snd.id}"]`);
      if(playBtn){playBtn.style.background=snd.color;playBtn.style.borderColor=snd.color}
    });

    async function moveSound(id,direction){
      const index=sounds.findIndex(x=>x.id===id);
      const other=index+direction;
      if(index<0||other<0||other>=sounds.length)return;
      const a=sounds[index],b=sounds[other];
      const ao=Number(a.order),bo=Number(b.order);
      a.order=bo;b.order=ao;
      await put('sounds',a);await put('sounds',b);
      await drawSounds();
    }

    el.querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>moveSound(b.dataset.up,-1));
    el.querySelectorAll('[data-down]').forEach(b=>b.onclick=()=>moveSound(b.dataset.down,1));

    el.querySelectorAll('[data-rename]').forEach(b=>b.onclick=async()=>{
      const snd=sounds.find(x=>x.id===b.dataset.rename);
      const n=prompt('Nieuwe naam:',snd.name);
      if(n?.trim()){snd.name=n.trim();await put('sounds',snd);drawSounds()}
    });

    el.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{
      if(confirm('Dit geluid verwijderen?')){await del('sounds',b.dataset.del);drawSounds()}
    });
  }

  function mimeFromName(name=''){const ext=name.split('.').pop()?.toLowerCase();return ({mp3:'audio/mpeg',m4a:'audio/mp4',mp4:'audio/mp4',wav:'audio/wav',aac:'audio/aac',ogg:'audio/ogg',oga:'audio/ogg',webm:'audio/webm'})[ext]||'audio/mpeg'}
  function stopSound(id){
    const item=activeAudio.get(id);
    if(!item)return false;
    try{item.audio.pause();item.audio.currentTime=0}catch{}
    try{URL.revokeObjectURL(item.url)}catch{}
    item.btn?.classList.remove('playing');
    activeAudio.delete(id);
    return true;
  }
  function stopAll(){
    for(const id of [...activeAudio.keys()])stopSound(id);
  }
  function play(s,btn){
    if(!s)return;

    // Tik je op een geluid dat al speelt, dan stopt het direct.
    if(activeAudio.has(s.id)){
      stopSound(s.id);
      return;
    }

    if(!settings.get('multiAudio',false))stopAll();

    try{
      let blob;
      if(s.data) blob=new Blob([s.data],{type:s.mimeType||mimeFromName(s.fileName)});
      else if(s.blob) blob=s.blob;
      else throw new Error('Geen audiogegevens gevonden');

      const url=URL.createObjectURL(blob);
      const audio=new Audio();
      audio.src=url;
      audio.preload='auto';
      activeAudio.set(s.id,{audio,url,btn});
      btn.classList.add('playing');

      const cleanup=()=>{
        const current=activeAudio.get(s.id);
        if(current?.audio===audio){
          btn.classList.remove('playing');
          activeAudio.delete(s.id);
          try{URL.revokeObjectURL(url)}catch{}
        }
      };

      audio.onended=cleanup;
      audio.onerror=()=>{cleanup();toast('Dit geluidsbestand kan Safari niet afspelen.')};
      audio.play().catch(e=>{cleanup();toast(`Afspelen lukt niet: ${e.message||'onbekende fout'}`)});
    }catch(e){toast(`Geluid kon niet worden geopend: ${e.message}`)}
  }
  await drawBoards();
}
