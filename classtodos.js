import {getAll,put,del,settings} from './storage.js';
import {uid,esc,toast,mailto} from './utils.js';
import {transcribe,makeTodoFromSpeech,normalizeClassNames} from './api.js';
import {Recorder} from './recorder.js';

let recorder=null;

export async function renderClassTodos(root){
  root.innerHTML=`<div class="topbar"><div>
    <div class="title">To Do Klas</div>
    <div class="subtitle">Taken die je voor de klas of leerlingen moet regelen.</div>
  </div></div>

  <div class="card">
    <div class="field"><label>Nieuwe taak</label>
      <textarea id="classTodoInput" class="textarea" placeholder="Bijv. Werkboek voor Lisa klaarleggen"></textarea>
    </div>
    <div class="row">
      <button id="addClassTodo" class="btn">Toevoegen</button>
      <button id="recordClassTodo" class="btn secondary">🎙️ Taak inspreken</button>
      <span id="classTodoState"></span>
    </div>
    <div id="classTodoTranscript" class="muted" style="margin-top:10px"></div>
  </div>

  <div id="classTodoList" class="list"></div>

  <div class="row" style="margin-top:12px">
    <button id="clearClassTodos" class="btn secondary small">Wis afgeronde taken</button>
    <button id="mailClassTodos" class="btn secondary small">Mail openstaande taken</button>
  </div>`;

  const input=root.querySelector('#classTodoInput');
  const list=root.querySelector('#classTodoList');
  const state=root.querySelector('#classTodoState');
  const transcript=root.querySelector('#classTodoTranscript');
  const classList=settings.get('classList',[]);

  async function normalize(value){
    const source=String(value||'').trim();
    if(!source||!classList.length)return source;
    try{
      const d=await normalizeClassNames(source,classList);
      return d.text||source;
    }catch{return source}
  }

  async function draw(){
    const items=(await getAll('classTodos')).sort((a,b)=>Number(a.done)-Number(b.done)||String(b.createdAt).localeCompare(String(a.createdAt)));
    list.innerHTML=items.length?items.map(x=>`<div class="item todo-item ${x.done?'done':''}">
      <label class="todo-check"><input type="checkbox" data-check="${x.id}" ${x.done?'checked':''}><span>${esc(x.text)}</span></label>
      <button class="icon-btn danger-text" data-del="${x.id}" aria-label="Verwijderen">×</button>
    </div>`).join(''):'<div class="muted">Nog geen taken voor de klas.</div>';

    list.querySelectorAll('[data-check]').forEach(c=>c.onchange=async()=>{
      const x=items.find(i=>i.id===c.dataset.check);
      x.done=c.checked;x.updatedAt=new Date().toISOString();await put('classTodos',x);draw();
    });
    list.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{await del('classTodos',b.dataset.del);draw()});
  }

  async function add(){
    let value=input.value.trim();if(!value)return toast('Typ of spreek eerst een taak in.');
    value=await normalize(value);
    const now=new Date().toISOString();
    await put('classTodos',{id:uid(),text:value,done:false,createdAt:now,updatedAt:now});
    input.value='';transcript.textContent='';toast('Taak toegevoegd');draw();
  }

  root.querySelector('#addClassTodo').onclick=add;

  root.querySelector('#recordClassTodo').onclick=async()=>{
    const btn=root.querySelector('#recordClassTodo');
    if(!recorder){
      try{
        recorder=new Recorder(sec=>state.innerHTML=`<span class="recording"><span class="pulse"></span>${sec}s</span>`);
        await recorder.start();btn.textContent='Stop opname';
      }catch(e){recorder=null;toast(e.message)}
    }else{
      const r=recorder;recorder=null;btn.textContent='🎙️ Taak inspreken';state.textContent='Transcriberen…';
      try{
        const blob=await r.stop();
        const tr=await transcribe(blob);
        state.textContent='Taak duidelijk maken…';
        const ai=await makeTodoFromSpeech(tr.text);
        const corrected=await normalize(ai.text||tr.text);
        input.value=corrected;
        transcript.textContent=`Je zei: ${tr.text}`;
        state.textContent='Klaar om toe te voegen';
      }catch(e){state.textContent='';toast(e.message)}
    }
  };

  root.querySelector('#clearClassTodos').onclick=async()=>{
    for(const x of (await getAll('classTodos')).filter(x=>x.done))await del('classTodos',x.id);
    toast('Afgeronde taken gewist');draw();
  };

  root.querySelector('#mailClassTodos').onclick=async()=>{
    const items=(await getAll('classTodos')).filter(x=>!x.done);
    const email=String(settings.get('email','')||'').trim();
    if(!email)return toast('Vul eerst je e-mailadres in bij Instellingen.');
    mailto(email,'To Do Klas',items.length?items.map(x=>`- ${x.text}`).join('\n'):'Geen openstaande taken.');
  };

  draw();
}
