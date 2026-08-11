import {getAll,put,del} from './storage.js';
import {uid,esc,toast,mailto} from './utils.js';
import {transcribe,makeTodoFromSpeech,adjustText} from './api.js';
import {Recorder} from './recorder.js';
import {todayISO,nextRecurringDate,createTodo} from './planner-utils.js';

const folders=[
  ['teacher','To Do Leerkracht'],
  ['today','To Do vandaag'],
  ['students','To Do voor de leerlingen']
];

let recorder=null;
let adjustRecorder=null;

export async function renderTodos(root){
  let current='today';
  const today=todayISO();

  root.innerHTML=`<div class="topbar"><div><div class="title">To Do</div><div class="subtitle">Taken, deadlines, prioriteiten en herhaling.</div></div></div>
  <div class="todo-tabs">${folders.map(([id,n])=>`<button data-folder="${id}" class="${id===current?'active':''}">${n}</button>`).join('')}</div>

  <div class="card">
    <div class="field"><label>Nieuwe taak</label><input id="todoInput" class="input" placeholder="Nieuwe taak..."></div>
    <div class="todo-meta-grid">
      <div class="field"><label>Deadline</label><input id="todoDate" class="input" type="date"></div>
      <div class="field"><label>Herhalen</label><select id="todoRepeat" class="select">
        <option value="none">Niet herhalen</option><option value="daily">Dagelijks</option><option value="weekdays">Werkdagen</option><option value="weekly">Wekelijks</option><option value="monthly">Maandelijks</option>
      </select></div>
    </div>
    <label class="todo-important"><input id="todoPriority" type="checkbox"> Belangrijk</label>
    <div class="row"><button id="addTodo" class="btn">Toevoegen</button><button id="recordTodo" class="btn secondary">🎙️ To Do inspreken</button><button id="adjustTodoVoice" class="btn secondary">🎙️ Spreek in om aan te passen</button><span id="todoRecordState"></span></div>
    <div id="todoSpeechResult" class="hidden todo-speech-result"><div class="muted" id="todoTranscript"></div><div class="status" id="todoAIStatus" style="margin-top:8px"></div></div>
  </div>

  <div id="overdueBox"></div>
  <div id="todoList" class="list"></div>
  <div class="row" style="margin-top:12px"><button id="clearDone" class="btn secondary small">Wis afgeronde taken</button><button id="mailTodos" class="btn secondary small">Mail deze lijst</button></div>`;

  const input=root.querySelector('#todoInput'),list=root.querySelector('#todoList'),speechWrap=root.querySelector('#todoSpeechResult');
  const transcriptEl=root.querySelector('#todoTranscript'),aiStatus=root.querySelector('#todoAIStatus'),recordBtn=root.querySelector('#recordTodo'),recordState=root.querySelector('#todoRecordState');
  const dateInput=root.querySelector('#todoDate'),repeat=root.querySelector('#todoRepeat'),priority=root.querySelector('#todoPriority');

  function dueLabel(x){
    if(!x.dueDate)return '';
    const d=new Date(`${x.dueDate}T12:00:00`).toLocaleDateString('nl-NL',{day:'numeric',month:'short'});
    return x.dueDate<today?`Te laat · ${d}`:d;
  }

  async function draw(){
    root.querySelectorAll('[data-folder]').forEach(b=>b.classList.toggle('active',b.dataset.folder===current));
    const all=await getAll('todos');
    const items=all.filter(x=>x.folder===current).sort((a,b)=>Number(a.done)-Number(b.done)||Number(b.priority)-Number(a.priority)||String(a.dueDate||'9999').localeCompare(String(b.dueDate||'9999'))||a.createdAt.localeCompare(b.createdAt));
    const overdue=items.filter(x=>!x.done&&x.dueDate&&x.dueDate<today);
    root.querySelector('#overdueBox').innerHTML=overdue.length?`<div class="card overdue-card"><strong>Te laat</strong><div class="muted">${overdue.length} openstaande ${overdue.length===1?'taak':'taken'} met verstreken deadline.</div></div>`:'';

    list.innerHTML=items.length?items.map(x=>`<div class="item todo-item ${x.done?'done':''} ${x.priority?'important':''}">
      <label class="todo-check"><input type="checkbox" data-check="${x.id}" ${x.done?'checked':''}><span>${x.priority?'★ ':''}${esc(x.text)}</span></label>
      <div class="todo-meta-line">${x.dueDate?`<span class="${x.dueDate<today&&!x.done?'overdue-text':''}">${esc(dueLabel(x))}</span>`:''}${x.recurrence&&x.recurrence!=='none'?`<span>↻ ${esc(x.recurrence)}</span>`:''}</div>
      <button class="icon-btn danger-text" data-del="${x.id}" aria-label="Verwijderen">×</button>
    </div>`).join(''):'<div class="muted">Nog geen taken in deze lijst.</div>';

    list.querySelectorAll('[data-check]').forEach(c=>c.onchange=async()=>{
      const x=items.find(i=>i.id===c.dataset.check);
      x.done=c.checked;x.updatedAt=new Date().toISOString();await put('todos',x);
      if(c.checked&&x.recurrence&&x.recurrence!=='none'&&!x.recurrenceSpawned){
        const next=nextRecurringDate(x.dueDate||today,x.recurrence);
        await createTodo(x.text,{folder:x.folder,dueDate:next,priority:x.priority,recurrence:x.recurrence});
        x.recurrenceSpawned=true;await put('todos',x);
        toast(`Volgende herhaling klaargezet voor ${next}`);
      }
      draw();
    });
    list.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{await del('todos',b.dataset.del);draw()});
  }

  async function add(){
    const text=input.value.trim();if(!text)return;
    await createTodo(text,{folder:current,dueDate:dateInput.value,priority:priority.checked,recurrence:repeat.value});
    input.value='';dateInput.value='';priority.checked=false;repeat.value='none';speechWrap.classList.add('hidden');transcriptEl.textContent='';aiStatus.textContent='';await draw();
  }

  recordBtn.onclick=async()=>{
    if(!recorder){
      try{speechWrap.classList.add('hidden');recorder=new Recorder(sec=>recordState.innerHTML=`<span class="recording"><span class="pulse"></span>${sec}s</span>`);await recorder.start();recordBtn.textContent='Stop opname'}
      catch(e){recorder=null;toast(e.message)}
    }else{
      const r=recorder;recorder=null;recordBtn.textContent='🎙️ To Do inspreken';recordState.textContent='Transcriberen…';
      try{const blob=await r.stop(),t=await transcribe(blob),spoken=String(t.text||'').trim();speechWrap.classList.remove('hidden');transcriptEl.innerHTML=`<strong>Je zei:</strong> ${esc(spoken)}`;aiStatus.textContent='AI maakt er een duidelijk To Do-punt van…';const result=await makeTodoFromSpeech(spoken);input.value=result.text||spoken;aiStatus.innerHTML='<span class="dot ok"></span> Klaar om toe te voegen.'}
      catch(e){toast(e.message)}finally{recordState.textContent=''}
    }
  };

  root.querySelector('#adjustTodoVoice').onclick=async()=>{
    const btn=root.querySelector('#adjustTodoVoice');if(!input.value.trim())return toast('Maak eerst een To Do-punt.');
    if(!adjustRecorder){
      try{adjustRecorder=new Recorder(sec=>recordState.innerHTML=`<span class="recording"><span class="pulse"></span>${sec}s</span>`);await adjustRecorder.start();btn.textContent='Stop aanpassing'}
      catch(e){adjustRecorder=null;toast(e.message)}
    }else{
      const r=adjustRecorder;adjustRecorder=null;btn.textContent='🎙️ Spreek in om aan te passen';recordState.textContent='Transcriberen…';
      try{const blob=await r.stop(),t=await transcribe(blob),d=await adjustText(input.value,t.text,'To Do-punt');input.value=d.text;recordState.textContent=`Aangepast op: ${t.text}`}
      catch(e){recordState.textContent='';toast(e.message)}
    }
  };

  root.querySelector('#addTodo').onclick=add;input.onkeydown=e=>{if(e.key==='Enter')add()};
  root.querySelectorAll('[data-folder]').forEach(b=>b.onclick=()=>{current=b.dataset.folder;draw()});
  root.querySelector('#clearDone').onclick=async()=>{const all=await getAll('todos');for(const x of all.filter(i=>i.folder===current&&i.done))await del('todos',x.id);toast('Afgeronde taken gewist');draw()};
  root.querySelector('#mailTodos').onclick=async()=>{const items=(await getAll('todos')).filter(x=>x.folder===current&&!x.done);const label=folders.find(x=>x[0]===current)?.[1]||'To Do';mailto(localStorage.getItem('sa:email')?JSON.parse(localStorage.getItem('sa:email')):'',label,items.map(x=>`${x.priority?'★ ':''}${x.text}${x.dueDate?` – ${x.dueDate}`:''}`).join('\n')||'Geen openstaande taken.')};
  draw();
}
