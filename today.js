import {getAll,put,del,settings} from './storage.js';
import {uid,esc,fmt,toast,mailto,copy} from './utils.js';
import {classifyQuickCapture,planDayWithAI,transcribe} from './api.js';
import {Recorder} from './recorder.js';
import {todayISO,createTodo} from './planner-utils.js';

let recorder=null;

function dateNL(v){
  if(!v)return '';
  try{return new Date(`${v}T12:00:00`).toLocaleDateString('nl-NL',{weekday:'short',day:'numeric',month:'short'})}catch{return v}
}
function eventLine(e){
  const time=e.allDay?'hele dag':`${e.startTime||''}${e.endTime?`–${e.endTime}`:''}`;
  return `${time} ${e.title||'Afspraak'}`.trim();
}

export async function renderToday(root){
  const today=todayISO();
  root.innerHTML=`<div class="topbar"><div><div class="title">Vandaag</div><div class="subtitle">Dagstart, snelle invoer, weekoverzicht, Inbox en zoeken.</div></div></div>

  <div class="card quick-capture-card">
    <div class="section-title">Snelle invoer</div>
    <div class="muted">Zeg gewoon wat je bedenkt. AI bepaalt of het een To Do, afspraak, notitie of Inbox-item is.</div>
    <textarea id="quickText" class="textarea" placeholder="Bijv. Morgen moeder van Lisa mailen over rekenen"></textarea>
    <div class="row">
      <button id="processQuick" class="btn">Verwerk</button>
      <button id="recordQuick" class="btn secondary">🎙️ Snel inspreken</button>
      <span id="quickState"></span>
    </div>
    <div id="quickResult" class="muted" style="margin-top:10px"></div>
  </div>

  <div class="card">
    <div class="row"><div class="section-title grow" style="margin:0">Dagstart</div><button id="planDay" class="btn secondary small">Plan mijn dag met AI</button></div>
    <div id="dayPlan" class="day-plan hidden"></div>
    <div class="planner-columns">
      <div><strong>Openstaande taken</strong><div id="todayTasks" class="list compact-list"></div></div>
      <div><strong>Afspraken</strong><div id="todayEvents" class="list compact-list"></div></div>
    </div>
  </div>

  <div class="card">
    <div class="section-title">Weekoverzicht</div>
    <div id="weekOverview"></div>
  </div>

  <div class="card">
    <div class="row"><div class="section-title grow" style="margin:0">Inbox</div><span id="inboxCount" class="badge"></span></div>
    <div class="row" style="margin-top:10px"><input id="inboxManual" class="input grow" placeholder="Snel iets bewaren zonder het nu in te delen"><button id="addInbox" class="btn secondary small">Bewaar</button></div>
    <div id="inboxList" class="list"></div>
  </div>

  <div class="card">
    <div class="section-title">Zoek door alles</div>
    <input id="globalSearch" class="input" placeholder="Zoek in To Do, notities, reflecties, feedback, afspraken...">
    <div id="searchResults" class="list" style="margin-top:10px"></div>
  </div>`;

  const quick=root.querySelector('#quickText'),qstate=root.querySelector('#quickState'),qresult=root.querySelector('#quickResult');

  async function loadDashboard(){
    const todos=await getAll('todos');
    const events=await getAll('calendarEvents');
    const open=todos.filter(x=>!x.done && (!x.dueDate || x.dueDate<=today))
      .sort((a,b)=>(b.priority-a.priority)||String(a.dueDate||'9999').localeCompare(String(b.dueDate||'9999')));
    const todayEvents=events.filter(e=>e.date===today).sort((a,b)=>String(a.startTime||'').localeCompare(String(b.startTime||'')));
    const taskEl=root.querySelector('#todayTasks'),eventEl=root.querySelector('#todayEvents');
    taskEl.innerHTML=open.length?open.map(x=>`<div class="mini-row"><span>${x.priority?'★ ':''}${esc(x.text)}</span>${x.dueDate?`<small>${esc(dateNL(x.dueDate))}</small>`:''}</div>`).join(''):'<div class="muted">Geen openstaande taken voor vandaag.</div>';
    eventEl.innerHTML=todayEvents.length?todayEvents.map(e=>`<div class="mini-row"><span>${esc(eventLine(e))}</span></div>`).join(''):'<div class="muted">Geen afspraken opgeslagen voor vandaag.</div>';

    const start=new Date(`${today}T12:00:00`),days=[];
    for(let i=0;i<7;i++){const d=new Date(start);d.setDate(d.getDate()+i);days.push(todayISO(d))}
    const weekTodos=todos.filter(x=>!x.done&&x.dueDate&&days.includes(x.dueDate));
    const weekEvents=events.filter(e=>days.includes(e.date));
    root.querySelector('#weekOverview').innerHTML=days.map(d=>{
      const ts=weekTodos.filter(x=>x.dueDate===d),es=weekEvents.filter(e=>e.date===d);
      if(!ts.length&&!es.length)return '';
      return `<div class="week-day"><strong>${esc(dateNL(d))}</strong>
        ${es.map(e=>`<div class="week-line">📅 ${esc(eventLine(e))}</div>`).join('')}
        ${ts.map(t=>`<div class="week-line">${t.priority?'★':'✓'} ${esc(t.text)}</div>`).join('')}
      </div>`;
    }).join('')||'<div class="muted">Nog niets gepland voor de komende 7 dagen.</div>';
  }

  async function processQuick(){
    const text=quick.value.trim();if(!text)return toast('Typ of spreek eerst iets in.');
    const btn=root.querySelector('#processQuick');
    try{
      btn.disabled=true;qresult.textContent='AI deelt je invoer in…';
      const c=await classifyQuickCapture(text,{now:new Date().toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone});
      if(c.type==='todo'){
        await createTodo(c.text,{folder:c.dueDate===today?'today':'teacher',dueDate:c.dueDate,priority:c.priority});
        qresult.textContent=`Toegevoegd aan To Do: ${c.text}`;
      }else if(c.type==='note'){
        const now=new Date().toISOString();await put('notes',{id:uid(),text:c.text,createdAt:now,updatedAt:now});
        qresult.textContent=`Opgeslagen als notitie: ${c.text}`;
      }else if(c.type==='calendar'){
        settings.set('pendingAgendaPrompt',text);
        qresult.textContent='Wordt geopend in Agenda om te controleren.';
        setTimeout(()=>{location.hash='agenda'},450);
      }else{
        const now=new Date().toISOString();await put('inbox',{id:uid(),text:c.text||text,createdAt:now,updatedAt:now});
        qresult.textContent='In Inbox gezet om later te verwerken.';
      }
      quick.value='';await loadDashboard();await drawInbox();
    }catch(e){qresult.textContent='';toast(e.message)}
    finally{btn.disabled=false}
  }

  root.querySelector('#processQuick').onclick=processQuick;
  root.querySelector('#recordQuick').onclick=async()=>{
    const btn=root.querySelector('#recordQuick');
    if(!recorder){
      try{recorder=new Recorder(sec=>qstate.innerHTML=`<span class="recording"><span class="pulse"></span>${sec}s</span>`);await recorder.start();btn.textContent='Stop opname'}
      catch(e){recorder=null;toast(e.message)}
    }else{
      const r=recorder;recorder=null;btn.textContent='🎙️ Snel inspreken';qstate.textContent='Transcriberen…';
      try{const blob=await r.stop(),t=await transcribe(blob);quick.value=t.text;qstate.textContent=`Je zei: ${t.text}`;await processQuick()}
      catch(e){qstate.textContent='';toast(e.message)}
    }
  };

  root.querySelector('#planDay').onclick=async()=>{
    const el=root.querySelector('#dayPlan'),btn=root.querySelector('#planDay');
    try{
      btn.disabled=true;el.classList.remove('hidden');el.textContent='Dagplanning maken…';
      const todos=(await getAll('todos')).filter(x=>!x.done&&(!x.dueDate||x.dueDate<=today)).map(x=>({text:x.text,dueDate:x.dueDate,priority:x.priority}));
      const events=(await getAll('calendarEvents')).filter(e=>e.date===today).map(e=>({title:e.title,startTime:e.startTime,endTime:e.endTime,location:e.location}));
      const d=await planDayWithAI(todos,events,today);el.textContent=d.text;
    }catch(e){el.textContent='';toast(e.message)}
    finally{btn.disabled=false}
  };

  async function drawInbox(){
    const items=(await getAll('inbox')).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    root.querySelector('#inboxCount').textContent=items.length||'';
    const el=root.querySelector('#inboxList');
    el.innerHTML=items.length?items.map(x=>`<div class="item"><div>${esc(x.text)}</div><div class="row" style="margin-top:8px">
      <button class="btn secondary tiny" data-todo="${x.id}">Naar To Do</button>
      <button class="btn secondary tiny" data-note="${x.id}">Naar Notities</button>
      <button class="btn secondary tiny" data-agenda="${x.id}">Naar Agenda</button><button class="btn secondary tiny" data-ai="${x.id}">Laat AI indelen</button>
      <button class="btn danger tiny" data-del="${x.id}">Verwijder</button>
    </div></div>`).join(''):'<div class="muted">Inbox is leeg.</div>';
    el.querySelectorAll('[data-todo]').forEach(b=>b.onclick=async()=>{const x=items.find(i=>i.id===b.dataset.todo);await createTodo(x.text,{folder:'today'});await del('inbox',x.id);drawInbox();loadDashboard()});
    el.querySelectorAll('[data-note]').forEach(b=>b.onclick=async()=>{const x=items.find(i=>i.id===b.dataset.note),now=new Date().toISOString();await put('notes',{id:uid(),text:x.text,createdAt:now,updatedAt:now});await del('inbox',x.id);drawInbox()});
    el.querySelectorAll('[data-agenda]').forEach(b=>b.onclick=async()=>{const x=items.find(i=>i.id===b.dataset.agenda);settings.set('pendingAgendaPrompt',x.text);await del('inbox',x.id);location.hash='agenda'});
    el.querySelectorAll('[data-ai]').forEach(b=>b.onclick=async()=>{
      const x=items.find(i=>i.id===b.dataset.ai);
      try{
        const c=await classifyQuickCapture(x.text,{now:new Date().toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone});
        if(c.type==='todo'){await createTodo(c.text,{folder:c.dueDate===today?'today':'teacher',dueDate:c.dueDate,priority:c.priority});await del('inbox',x.id);toast('AI zette dit bij To Do')}
        else if(c.type==='note'){const now=new Date().toISOString();await put('notes',{id:uid(),text:c.text,createdAt:now,updatedAt:now});await del('inbox',x.id);toast('AI zette dit bij Notities')}
        else if(c.type==='calendar'){settings.set('pendingAgendaPrompt',x.text);await del('inbox',x.id);location.hash='agenda';return}
        else toast('AI laat dit voorlopig in Inbox staan');
        drawInbox();loadDashboard();
      }catch(e){toast(e.message)}
    });
    el.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{await del('inbox',b.dataset.del);drawInbox()});
  }
  root.querySelector('#addInbox').onclick=async()=>{
    const inp=root.querySelector('#inboxManual'),t=inp.value.trim();if(!t)return;
    const now=new Date().toISOString();await put('inbox',{id:uid(),text:t,createdAt:now,updatedAt:now});inp.value='';drawInbox();
  };

  root.querySelector('#globalSearch').oninput=async e=>{
    const q=e.target.value.trim().toLowerCase(),el=root.querySelector('#searchResults');
    if(q.length<2){el.innerHTML='';return}
    const stores=['todos','notes','reflections','feedback','calendarEvents','checklists','inbox','soundboards','savedGroups','points'];
    const rows=[];
    for(const store of stores){
      for(const x of await getAll(store)){
        const blob=JSON.stringify(x).toLowerCase();
        if(blob.includes(q)){
          let label=store,txt='';
          if(store==='todos')txt=x.text;
          else if(store==='notes')txt=x.text;
          else if(store==='reflections')txt=x.summary||x.text;
          else if(store==='feedback')txt=x.summary||x.text||x.student;
          else if(store==='calendarEvents')txt=`${x.date||''} ${x.title||''}`;
          else if(store==='checklists')txt=x.name;
          else if(store==='inbox')txt=x.text;
          else if(store==='soundboards')txt=x.name;
          else if(store==='savedGroups')txt=(x.groups||[]).flat().join(', ');
          else if(store==='points')txt=`${x.name||''}: ${x.points??0} punten`;
          rows.push({label,txt:String(txt||'').slice(0,180)});
        }
      }
    }
    el.innerHTML=rows.length?rows.slice(0,30).map(r=>`<div class="item"><strong>${esc(r.label)}</strong><div>${esc(r.txt)}</div></div>`).join(''):'<div class="muted">Geen resultaten.</div>';
  };

  await loadDashboard();await drawInbox();
}
