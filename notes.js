import {getAll,put,del,settings} from './storage.js';
import {uid,fmt,esc,mailto,copy,toast} from './utils.js';
import {transcribe,summarizeNote} from './api.js';
import {Recorder} from './recorder.js';

let recorder=null;

function txtFile(note){
  const date=new Date(note.updatedAt||Date.now()).toLocaleDateString('nl-NL').replaceAll('/','-');
  return new File([note.text],`Notitie - ${date}.txt`,{type:'text/plain;charset=utf-8'});
}
async function shareTxt(note){
  const file=txtFile(note);
  if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
    try { await navigator.share({title:'Notitie',files:[file]}); return; }
    catch(e){ if(e?.name==='AbortError') return; }
  }
  const a=document.createElement('a'); a.href=URL.createObjectURL(file); a.download=file.name; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  toast('Tekstbestand aangemaakt');
}

export async function renderNotes(root){
 let editId=null;
 root.innerHTML=`<div class="topbar"><div><div class="title">Notities</div><div class="subtitle">Typ of spreek een notitie in en laat AI hem kort samenvatten.</div></div></div>
 <div class="card"><div class="section-title">Nieuwe notitie</div>
 <textarea id="noteText" class="textarea" placeholder="Schrijf je notitie..."></textarea>
 <div class="row"><button class="btn secondary" id="recordNote">🎙️ Notitie inspreken</button><span id="recordState"></span></div>
 <div id="transcriptBox" class="muted" style="margin-top:10px"></div>
 <div class="row" style="margin-top:12px"><button class="btn secondary" id="summarizeNote">Maak korte samenvatting</button><button class="btn" id="saveNote">Opslaan</button><button class="btn secondary" id="clearNote">Wissen</button></div></div>
 <div class="field"><input id="searchNotes" class="input" placeholder="Zoek in notities"></div>
 <div class="section-title">Opgeslagen notities</div><div id="notesList" class="list"></div>`;
 const text=root.querySelector('#noteText'),list=root.querySelector('#notesList'),state=root.querySelector('#recordState'),transcriptBox=root.querySelector('#transcriptBox');

 async function draw(){
  const q=root.querySelector('#searchNotes').value.toLowerCase();
  const notes=(await getAll('notes')).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).filter(n=>n.text.toLowerCase().includes(q));
  list.innerHTML=notes.length?notes.map(n=>`<div class="item"><div class="item-head"><div><strong>${esc(n.text.slice(0,70))}${n.text.length>70?'…':''}</strong><div class="muted">${fmt(n.updatedAt)}</div></div></div><div class="row" style="margin-top:10px"><button class="btn secondary small" data-edit="${n.id}">Bewerken</button><button class="btn secondary small" data-copy="${n.id}">Kopiëren</button><button class="btn secondary small" data-mail="${n.id}">Mail naar mezelf</button><button class="btn secondary small" data-file="${n.id}">Deel .txt</button><button class="btn danger small" data-del="${n.id}">Verwijderen</button></div></div>`).join(''):'<div class="muted">Nog geen notities.</div>';
  for(const b of list.querySelectorAll('[data-edit]'))b.onclick=()=>{const n=notes.find(x=>x.id===b.dataset.edit);editId=n.id;text.value=n.text;text.focus()};
  for(const b of list.querySelectorAll('[data-copy]'))b.onclick=()=>copy(notes.find(x=>x.id===b.dataset.copy).text);
  for(const b of list.querySelectorAll('[data-mail]'))b.onclick=()=>{const n=notes.find(x=>x.id===b.dataset.mail);mailto(settings.get('email',''),`Notitie – ${new Date(n.updatedAt).toLocaleDateString('nl-NL')}`,n.text)};
  for(const b of list.querySelectorAll('[data-file]'))b.onclick=()=>shareTxt(notes.find(x=>x.id===b.dataset.file));
  for(const b of list.querySelectorAll('[data-del]'))b.onclick=async()=>{if(confirm('Deze notitie verwijderen?')){await del('notes',b.dataset.del);draw()}};
 }
 root.querySelector('#recordNote').onclick=async()=>{
   const btn=root.querySelector('#recordNote');
   if(!recorder){
     try{recorder=new Recorder(s=>state.innerHTML=`<span class="recording"><span class="pulse"></span>${s}s</span>`);await recorder.start();btn.textContent='Stop opname'}
     catch(e){recorder=null;toast(e.message)}
   }else{
     const r=recorder;recorder=null;btn.textContent='🎙️ Notitie inspreken';state.textContent='Transcriberen…';
     try{const blob=await r.stop();const data=await transcribe(blob);transcriptBox.textContent=`Je zei: ${data.text}`;state.textContent='Samenvatten…';const sum=await summarizeNote(data.text);text.value=sum.text;state.textContent='Samenvatting klaar'}
     catch(e){state.textContent='';toast(e.message)}
   }
 };
 root.querySelector('#summarizeNote').onclick=async()=>{if(!text.value.trim())return toast('Typ of spreek eerst een notitie in.');try{const original=text.value;root.querySelector('#summarizeNote').disabled=true;const sum=await summarizeNote(original);text.value=sum.text;toast('Notitie samengevat')}catch(e){toast(e.message)}finally{root.querySelector('#summarizeNote').disabled=false}};
 root.querySelector('#saveNote').onclick=async()=>{if(!text.value.trim())return toast('Schrijf eerst iets.');const now=new Date().toISOString();const old=editId?(await getAll('notes')).find(n=>n.id===editId):null;await put('notes',{id:editId||uid(),text:text.value.trim(),createdAt:old?.createdAt||now,updatedAt:now});editId=null;text.value='';transcriptBox.textContent='';toast('Notitie opgeslagen');draw()};
 root.querySelector('#clearNote').onclick=()=>{editId=null;text.value='';transcriptBox.textContent=''};
 root.querySelector('#searchNotes').oninput=draw; draw();
}
