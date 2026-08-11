import {getAll,put,del} from './storage.js';
import {uid,esc,toast} from './utils.js';
import {transcribe,makeTodoFromSpeech} from './api.js';
import {Recorder} from './recorder.js';

const folders=[
  ['teacher','To Do Leerkracht'],
  ['today','To Do vandaag'],
  ['students','To Do voor de leerlingen']
];

let recorder=null;

export async function renderTodos(root){
  let current='today';

  root.innerHTML=`<div class="topbar">
    <div><div class="title">To Do</div><div class="subtitle">Drie vaste lijsten voor school.</div></div>
  </div>

  <div class="todo-tabs">
    ${folders.map(([id,n])=>`<button data-folder="${id}" class="${id===current?'active':''}">${n}</button>`).join('')}
  </div>

  <div class="card">
    <div class="row">
      <input id="todoInput" class="input grow" placeholder="Nieuwe taak...">
      <button id="addTodo" class="btn">Toevoegen</button>
    </div>

    <div class="row" style="margin-top:10px">
      <button id="recordTodo" class="btn secondary">🎙️ To Do inspreken</button>
      <span id="todoRecordState"></span>
    </div>

    <div id="todoSpeechResult" class="hidden todo-speech-result">
      <div class="muted" id="todoTranscript"></div>
      <div class="status" id="todoAIStatus" style="margin-top:8px"></div>
    </div>
  </div>

  <div id="todoList" class="list"></div>

  <div class="row" style="margin-top:12px">
    <button id="clearDone" class="btn secondary small">Wis afgeronde taken</button>
  </div>`;

  const input=root.querySelector('#todoInput');
  const list=root.querySelector('#todoList');
  const speechWrap=root.querySelector('#todoSpeechResult');
  const transcriptEl=root.querySelector('#todoTranscript');
  const aiStatus=root.querySelector('#todoAIStatus');
  const recordBtn=root.querySelector('#recordTodo');
  const recordState=root.querySelector('#todoRecordState');

  async function draw(){
    root.querySelectorAll('[data-folder]').forEach(b=>b.classList.toggle('active',b.dataset.folder===current));
    const items=(await getAll('todos'))
      .filter(x=>x.folder===current)
      .sort((a,b)=>a.done-b.done||a.createdAt.localeCompare(b.createdAt));

    list.innerHTML=items.length
      ? items.map(x=>`<div class="item todo-item ${x.done?'done':''}">
          <label class="todo-check">
            <input type="checkbox" data-check="${x.id}" ${x.done?'checked':''}>
            <span>${esc(x.text)}</span>
          </label>
          <button class="icon-btn danger-text" data-del="${x.id}" aria-label="Verwijderen">×</button>
        </div>`).join('')
      : '<div class="muted">Nog geen taken in deze lijst.</div>';

    list.querySelectorAll('[data-check]').forEach(c=>c.onchange=async()=>{
      const x=items.find(i=>i.id===c.dataset.check);
      x.done=c.checked;
      x.updatedAt=new Date().toISOString();
      await put('todos',x);
      draw();
    });

    list.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{
      await del('todos',b.dataset.del);
      draw();
    });
  }

  async function add(){
    const text=input.value.trim();
    if(!text)return;
    const now=new Date().toISOString();
    await put('todos',{
      id:uid(),
      folder:current,
      text,
      done:false,
      createdAt:now,
      updatedAt:now
    });
    input.value='';
    speechWrap.classList.add('hidden');
    transcriptEl.textContent='';
    aiStatus.textContent='';
    await draw();
  }

  recordBtn.onclick=async()=>{
    if(!recorder){
      try{
        speechWrap.classList.add('hidden');
        transcriptEl.textContent='';
        aiStatus.textContent='';
        recorder=new Recorder(sec=>{
          recordState.innerHTML=`<span class="recording"><span class="pulse"></span>${sec}s</span>`;
        });
        await recorder.start();
        recordBtn.textContent='Stop opname';
      }catch(e){
        recorder=null;
        recordState.textContent='';
        toast(e.message);
      }
      return;
    }

    const r=recorder;
    recorder=null;
    recordBtn.textContent='🎙️ To Do inspreken';
    recordState.textContent='Transcriberen…';

    try{
      const blob=await r.stop();
      const t=await transcribe(blob);
      const spoken=String(t.text||'').trim();
      if(!spoken)throw new Error('Er is geen spraak herkend.');

      speechWrap.classList.remove('hidden');
      transcriptEl.innerHTML=`<strong>Je zei:</strong> ${esc(spoken)}`;
      aiStatus.textContent='AI maakt er een duidelijk To Do-punt van…';

      const result=await makeTodoFromSpeech(spoken);
      input.value=result.text||spoken;
      aiStatus.innerHTML='<span class="dot ok"></span> To Do-punt staat klaar. Controleer het eventueel en druk op Toevoegen.';
      input.focus();
    }catch(e){
      aiStatus.textContent='';
      toast(e.message);
    }finally{
      recordState.textContent='';
    }
  };

  root.querySelector('#addTodo').onclick=add;
  input.onkeydown=e=>{if(e.key==='Enter')add()};

  root.querySelectorAll('[data-folder]').forEach(b=>b.onclick=()=>{
    current=b.dataset.folder;
    draw();
  });

  root.querySelector('#clearDone').onclick=async()=>{
    const all=await getAll('todos');
    for(const x of all.filter(i=>i.folder===current&&i.done))await del('todos',x.id);
    toast('Afgeronde taken gewist');
    draw();
  };

  draw();
}
