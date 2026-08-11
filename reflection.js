import {getAll,put,del,settings} from './storage.js';
import {summarizeReflection,transcribe,adjustText,extractTodoActions} from './api.js';
import {Recorder} from './recorder.js';
import {uid,esc,fmt,copy,mailto,toast} from './utils.js';
import {createTodo} from './planner-utils.js';

let recorder=null;
let adjustRecorder=null;

function reflectionTxtFile(title,body){
  const safeTitle=String(title||'Reflectie').replace(/[\\/:*?"<>|]/g,'-').slice(0,80);
  return new File([String(body||'')],`${safeTitle}.txt`,{type:'text/plain;charset=utf-8'});
}
async function shareReflectionTxt(title,body){
  if(!String(body||'').trim())return toast('Voeg eerst een reflectie toe.');
  const file=reflectionTxtFile(title,body);
  if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
    try{await navigator.share({title,files:[file]});return}
    catch(e){if(e?.name==='AbortError')return}
  }
  const url=URL.createObjectURL(file);
  const a=document.createElement('a');a.href=url;a.download=file.name;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
  toast('Tekstbestand aangemaakt');
}


export async function renderReflection(root){
  const subjects=settings.get('subjects',['Rekenen','Taal','Spelling','Lezen','Wereldoriëntatie','Gym','Overig']);
  let editId=null, mode='lesson';

  root.innerHTML=`<div class="topbar"><div><div class="title">Reflectie</div><div class="subtitle">Reflecteer op een les of op je hele schooldag.</div></div></div>
  <div class="seg reflection-mode">
    <button data-mode="lesson" class="active">Lesreflectie</button>
    <button data-mode="day">Dagreflectie</button>
  </div>

  <div class="card" style="margin-top:14px">
    <div id="lessonFields">
      <div class="field"><label>Les</label><input id="lesson" class="input" placeholder="Bijv. Breuken - instructieles"></div>
      <div class="field"><label>Vak</label><select id="subject" class="select">${subjects.map(s=>`<option>${esc(s)}</option>`).join('')}</select></div>
    </div>
    <div id="dayFields" class="hidden">
      <div class="field"><label>Dag / titel</label><input id="dayTitle" class="input" placeholder="Bijv. Maandag - start schoolweek"></div>
    </div>

    <div class="field"><label id="reflectionLabel">Reflectie op de les</label>
      <textarea id="reflectionText" class="textarea" placeholder="Hoe ging de les? Wat ging goed? Wat kan beter?"></textarea>
    </div>

    <div class="row">
      <button id="recordReflection" class="btn secondary">🎙️ Reflectie inspreken</button>
      <span id="reflectionRecordState"></span>
    </div>
    <div id="transcriptWrap" class="muted" style="margin-top:10px"></div>

    <div class="row" style="margin-top:12px">
      <button id="summarize" class="btn">Maak AI-samenvatting</button>
      <button id="shorten" class="btn secondary">Korter maken</button><button id="adjustReflectionVoice" class="btn secondary">🎙️ Spreek in om aan te passen</button><span id="adjustReflectionState"></span>
    </div>

    <div class="field"><label>Samenvatting</label><textarea id="summary" class="textarea" style="min-height:190px"></textarea></div>
    <div class="row">
      <button id="saveReflection" class="btn">Opslaan</button>
      <button id="copyReflection" class="btn secondary">Kopiëren</button>
      <button id="mailReflection" class="btn secondary">Mail naar mezelf</button><button id="shareReflection" class="btn secondary">Deel .txt</button><button id="reflectionToTodo" class="btn secondary">Naar To Do</button><button id="extractActions" class="btn secondary">Haal acties eruit</button>
    </div><div id="reflectionActions" class="hidden" style="margin-top:12px"></div>
  </div>

  <div class="field"><input id="searchReflection" class="input" placeholder="Zoek in reflecties"></div>
  <div class="section-title">Opgeslagen reflecties</div>
  <div id="reflectionList" class="list"></div>`;

  const text=root.querySelector('#reflectionText');
  const summary=root.querySelector('#summary');
  const lesson=root.querySelector('#lesson');
  const subject=root.querySelector('#subject');
  const dayTitle=root.querySelector('#dayTitle');
  const list=root.querySelector('#reflectionList');

  function setMode(next){
    mode=next;
    root.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
    root.querySelector('#lessonFields').classList.toggle('hidden',mode!=='lesson');
    root.querySelector('#dayFields').classList.toggle('hidden',mode!=='day');
    root.querySelector('#reflectionLabel').textContent=mode==='day'?'Reflectie op de dag':'Reflectie op de les';
    text.placeholder=mode==='day'
      ? 'Hoe was de dag? Wat ging goed? Wat vroeg aandacht? Wat wil je morgen anders doen?'
      : 'Hoe ging de les? Wat ging goed? Wat kan beter?';
  }

  root.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));

  async function ai(short=false){
    const source=(summary.value||text.value).trim();
    if(!source)return toast('Schrijf of spreek eerst een reflectie in.');
    try{
      root.querySelector('#summarize').disabled=true;
      const prompt=short?`Maak deze reflectie nog korter:\n${source}`:source;
      const d=await summarizeReflection(prompt,mode);
      summary.value=d.text||'';
    }catch(e){toast(e.message)}
    finally{root.querySelector('#summarize').disabled=false}
  }

  async function draw(){
    const q=root.querySelector('#searchReflection').value.toLowerCase();
    const items=(await getAll('reflections'))
      .sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))
      .filter(x=>`${x.mode||'lesson'} ${x.lesson||''} ${x.dayTitle||''} ${x.subject||''} ${x.text||''} ${x.summary||''}`.toLowerCase().includes(q));

    list.innerHTML=items.length?items.map(x=>{
      const isDay=(x.mode||'lesson')==='day';
      const title=isDay?(x.dayTitle||'Dagreflectie'):(x.lesson||x.subject||'Lesreflectie');
      const meta=isDay?`Dagreflectie · ${fmt(x.updatedAt)}`:`Lesreflectie · ${esc(x.subject||'')} · ${fmt(x.updatedAt)}`;
      const body=x.summary||x.text||'';
      return `<div class="item">
        <strong>${esc(title)}</strong>
        <div class="muted">${meta}</div>
        <div class="preview">${esc(body.slice(0,150))}${body.length>150?'…':''}</div>
        <div class="row" style="margin-top:9px">
          <button class="btn secondary small" data-edit="${x.id}">Open</button>
          <button class="btn secondary small" data-copy="${x.id}">Kopiëren</button>
          <button class="btn secondary small" data-mail="${x.id}">Mail naar mezelf</button><button class="btn secondary small" data-file="${x.id}">Deel .txt</button><button class="btn secondary small" data-todo="${x.id}">Naar To Do</button>
          <button class="btn danger small" data-del="${x.id}">Verwijderen</button>
        </div>
      </div>`;
    }).join(''):'<div class="muted">Nog geen reflecties.</div>';

    list.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{
      const x=items.find(i=>i.id===b.dataset.edit);
      editId=x.id;
      setMode(x.mode||'lesson');
      lesson.value=x.lesson||'';
      dayTitle.value=x.dayTitle||'';
      subject.value=x.subject||subjects[0];
      text.value=x.text||'';
      summary.value=x.summary||'';
      window.scrollTo({top:0,behavior:'smooth'});
    });
    list.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>{
      const x=items.find(i=>i.id===b.dataset.copy);copy(x.summary||x.text||'');
    });
    list.querySelectorAll('[data-mail]').forEach(b=>b.onclick=()=>{
      const x=items.find(i=>i.id===b.dataset.mail);
      const title=(x.mode||'lesson')==='day'?(x.dayTitle||'Dagreflectie'):(x.lesson||x.subject||'Lesreflectie');
      mailto(settings.get('email',''),`Reflectie – ${title}`,x.summary||x.text||'');
    });
    list.querySelectorAll('[data-file]').forEach(b=>b.onclick=()=>{
      const x=items.find(i=>i.id===b.dataset.file);
      const title=(x.mode||'lesson')==='day'?(x.dayTitle||'Dagreflectie'):(x.lesson||x.subject||'Lesreflectie');
      shareReflectionTxt(`Reflectie – ${title}`,x.summary||x.text||'');
    });
    list.querySelectorAll('[data-todo]').forEach(b=>b.onclick=async()=>{
      const x=items.find(i=>i.id===b.dataset.todo);await createTodo(x.summary||x.text||'',{folder:'today'});toast('Toegevoegd aan To Do vandaag');
    });
    list.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{
      if(confirm('Deze reflectie verwijderen?')){await del('reflections',b.dataset.del);draw()}
    });
  }

  root.querySelector('#adjustReflectionVoice').onclick=async()=>{
    const btn=root.querySelector('#adjustReflectionVoice'),state=root.querySelector('#adjustReflectionState');
    const current=(summary.value||text.value).trim();if(!current)return toast('Maak eerst een reflectie of samenvatting.');
    if(!adjustRecorder){
      try{adjustRecorder=new Recorder(sec=>state.innerHTML=`<span class="recording"><span class="pulse"></span>${sec}s</span>`);await adjustRecorder.start();btn.textContent='Stop aanpassing'}
      catch(e){adjustRecorder=null;toast(e.message)}
    }else{
      const r=adjustRecorder;adjustRecorder=null;btn.textContent='🎙️ Spreek in om aan te passen';state.textContent='Transcriberen…';
      try{const blob=await r.stop();const t=await transcribe(blob);state.textContent='Reflectie aanpassen…';const d=await adjustText(current,t.text,'reflectie');if(summary.value.trim())summary.value=d.text;else text.value=d.text;state.textContent=`Aangepast op: ${t.text}`}
      catch(e){state.textContent='';toast(e.message)}
    }
  };
  root.querySelector('#summarize').onclick=()=>ai(false);
  root.querySelector('#shorten').onclick=()=>ai(true);

  root.querySelector('#saveReflection').onclick=async()=>{
    if(!text.value.trim()&&!summary.value.trim())return toast('Voeg eerst een reflectie toe.');
    const now=new Date().toISOString();
    const existing=editId?(await getAll('reflections')).find(x=>x.id===editId):null;
    await put('reflections',{
      id:editId||uid(),
      mode,
      lesson:lesson.value.trim(),
      dayTitle:dayTitle.value.trim(),
      subject:subject.value,
      text:text.value.trim(),
      summary:summary.value.trim(),
      updatedAt:now,
      createdAt:existing?.createdAt||now
    });
    editId=null;lesson.value='';dayTitle.value='';text.value='';summary.value='';
    toast('Reflectie opgeslagen');draw();
  };

  root.querySelector('#copyReflection').onclick=()=>copy(summary.value||text.value||'');
  root.querySelector('#mailReflection').onclick=()=>{
    const title=mode==='day'?(dayTitle.value||'Dagreflectie'):(lesson.value||subject.value||'Lesreflectie');
    mailto(settings.get('email',''),`Reflectie – ${title}`,summary.value||text.value||'');
  };
  root.querySelector('#shareReflection').onclick=()=>{
    const title=mode==='day'?(dayTitle.value||'Dagreflectie'):(lesson.value||subject.value||'Lesreflectie');
    shareReflectionTxt(`Reflectie – ${title}`,summary.value||text.value||'');
  };
  root.querySelector('#reflectionToTodo').onclick=async()=>{
    const body=(summary.value||text.value).trim();if(!body)return toast('Maak eerst een reflectie.');
    await createTodo(body,{folder:'today'});toast('Toegevoegd aan To Do vandaag');
  };
  root.querySelector('#extractActions').onclick=async()=>{
    const body=(summary.value||text.value).trim();if(!body)return toast('Maak eerst een reflectie.');
    const box=root.querySelector('#reflectionActions');
    try{
      box.classList.remove('hidden');box.textContent='Actiepunten zoeken…';
      const d=await extractTodoActions(body);
      box.innerHTML=d.actions.length?`<div class="section-title">Vervolgacties</div>${d.actions.map((a,i)=>`<div class="item row"><span class="grow">${esc(a)}</span><button class="btn secondary tiny" data-action="${i}">Naar To Do</button></div>`).join('')}`:'<div class="muted">Geen concrete vervolgacties gevonden.</div>';
      box.querySelectorAll('[data-action]').forEach(b=>b.onclick=async()=>{await createTodo(d.actions[+b.dataset.action],{folder:'today'});b.textContent='Toegevoegd';b.disabled=true});
    }catch(e){box.textContent='';toast(e.message)}
  };
  root.querySelector('#searchReflection').oninput=draw;

  root.querySelector('#recordReflection').onclick=async()=>{
    const btn=root.querySelector('#recordReflection'),state=root.querySelector('#reflectionRecordState'),tw=root.querySelector('#transcriptWrap');
    if(!recorder){
      try{
        recorder=new Recorder(sec=>state.innerHTML=`<span class="recording"><span class="pulse"></span>${sec}s</span>`);
        await recorder.start();btn.textContent='Stop opname';
      }catch(e){recorder=null;toast(e.message)}
    }else{
      const r=recorder;recorder=null;btn.textContent='🎙️ Reflectie inspreken';state.textContent='Transcriberen…';
      try{
        const blob=await r.stop();
        const d=await transcribe(blob);
        tw.textContent=`Je zei: ${d.text}`;
        text.value=(text.value?text.value+'\n':'')+d.text;
        state.textContent='';
      }catch(e){state.textContent='';toast(e.message)}
    }
  };

  setMode('lesson');
  draw();
}
