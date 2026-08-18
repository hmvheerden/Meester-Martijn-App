import {getAll,put,del,settings} from './storage.js';
import {uid,esc,mailto,toast,copy} from './utils.js';
import {transcribe,normalizeClassNames,summarizeClassWeek} from './api.js';
import {Recorder} from './recorder.js';

let recorder=null;

function todayISO(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function dateNL(value){
  try{return new Date(`${value}T12:00:00`).toLocaleDateString('nl-NL',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
  catch{return value}
}
function isoWeekInfo(dateStr){
  const d=new Date(`${dateStr}T12:00:00`);
  const target=new Date(d.valueOf());
  const dayNr=(d.getDay()+6)%7;
  target.setDate(target.getDate()-dayNr+3);
  const firstThursday=new Date(target.getFullYear(),0,4,12);
  const firstDayNr=(firstThursday.getDay()+6)%7;
  firstThursday.setDate(firstThursday.getDate()-firstDayNr+3);
  const week=1+Math.round((target-firstThursday)/(7*24*60*60*1000));
  const year=target.getFullYear();

  const monday=new Date(d.valueOf());
  monday.setDate(monday.getDate()-dayNr);
  const sunday=new Date(monday.valueOf());
  sunday.setDate(sunday.getDate()+6);

  const iso=x=>`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
  return {week,year,monday:iso(monday),sunday:iso(sunday)};
}

export async function renderClassDiary(root){
  const classList=settings.get('classList',[]);
  let selectedDate=todayISO();

  root.innerHTML=`<div class="topbar">
    <div>
      <div class="title">Klasdagboek</div>
      <div class="subtitle">Leg gebeurtenissen per dag vast en maak aan het einde van de week een AI-weekverslag.</div>
    </div>
  </div>

  <div class="card">
    <div class="field">
      <label>Datum</label>
      <input id="diaryDate" class="input" type="date" value="${selectedDate}">
    </div>

    <div class="field">
      <label>Gebeurtenis</label>
      <textarea id="diaryText" class="textarea" placeholder="Typ een gebeurtenis of spreek hem in..."></textarea>
    </div>

    <div class="row">
      <button id="saveDiaryEvent" class="btn">Gebeurtenis opslaan</button>
      <button id="recordDiaryEvent" class="btn secondary">🎙️ Gebeurtenis inspreken</button>
      <span id="diaryRecordState"></span>
    </div>
    <div id="diaryTranscript" class="muted" style="margin-top:10px"></div>
  </div>

  <div class="card">
    <div class="section-title" id="dayHeading"></div>
    <div id="dayEvents" class="list"></div>
  </div>

  <div class="card">
    <div class="section-title">Weekverslag</div>
    <div id="weekInfo" class="muted"></div>
    <button id="makeWeekReport" class="btn" style="margin-top:12px">Maak een weekverslag</button>
    <div id="weekReportWrap" class="hidden" style="margin-top:14px">
      <textarea id="weekReportText" class="textarea" style="min-height:280px"></textarea>
      <div class="row" style="margin-top:10px">
        <button id="saveWeekReport" class="btn">Weekverslag opslaan</button>
        <button id="mailWeekReport" class="btn secondary">Mail weekverslag</button>
        <button id="copyWeekReport" class="btn secondary">Kopiëren</button>
      </div>
    </div>
  </div>

  <div class="card">
    <button id="toggleSavedReports" class="btn secondary">Opgeslagen weekverslagen</button>
    <div id="savedReports" class="hidden" style="margin-top:14px"></div>
  </div>`;

  const dateInput=root.querySelector('#diaryDate');
  const text=root.querySelector('#diaryText');
  const state=root.querySelector('#diaryRecordState');
  const transcript=root.querySelector('#diaryTranscript');
  const dayEvents=root.querySelector('#dayEvents');
  const dayHeading=root.querySelector('#dayHeading');
  const weekInfo=root.querySelector('#weekInfo');
  const reportWrap=root.querySelector('#weekReportWrap');
  const reportText=root.querySelector('#weekReportText');
  const savedReports=root.querySelector('#savedReports');

  async function correctNames(value){
    const source=String(value||'').trim();
    if(!source||!classList.length)return source;
    const d=await normalizeClassNames(source,classList);
    return d.text||source;
  }

  function currentWeek(){
    return isoWeekInfo(dateInput.value||selectedDate);
  }

  async function drawDay(){
    selectedDate=dateInput.value||todayISO();
    dayHeading.textContent=dateNL(selectedDate);
    const items=(await getAll('classDiaryEvents'))
      .filter(x=>x.date===selectedDate)
      .sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));

    dayEvents.innerHTML=items.length?items.map(x=>`<div class="item">
      <div>${esc(x.text)}</div>
      <div class="muted" style="margin-top:6px">${new Date(x.createdAt).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})}</div>
      <div class="row" style="margin-top:8px"><button class="btn danger tiny" data-del-event="${x.id}">Verwijder</button></div>
    </div>`).join(''):'<div class="muted">Nog geen gebeurtenissen voor deze dag.</div>';

    dayEvents.querySelectorAll('[data-del-event]').forEach(b=>b.onclick=async()=>{
      if(confirm('Deze gebeurtenis verwijderen?')){
        await del('classDiaryEvents',b.dataset.delEvent);
        drawDay();
      }
    });

    const w=currentWeek();
    weekInfo.textContent=`Week ${w.week} · ${dateNL(w.monday)} t/m ${dateNL(w.sunday)}`;
  }

  async function saveEvent(){
    const raw=text.value.trim();
    if(!raw)return toast('Typ of spreek eerst een gebeurtenis in.');
    try{
      const corrected=await correctNames(raw);
      const now=new Date().toISOString();
      await put('classDiaryEvents',{id:uid(),date:dateInput.value||todayISO(),text:corrected,createdAt:now,updatedAt:now});
      text.value='';transcript.textContent='';
      toast('Gebeurtenis opgeslagen');
      await drawDay();
    }catch(e){toast(e.message)}
  }

  root.querySelector('#saveDiaryEvent').onclick=saveEvent;
  dateInput.onchange=()=>drawDay();

  root.querySelector('#recordDiaryEvent').onclick=async()=>{
    const btn=root.querySelector('#recordDiaryEvent');
    if(!recorder){
      try{
        recorder=new Recorder(sec=>state.innerHTML=`<span class="recording"><span class="pulse"></span>${sec}s</span>`);
        await recorder.start();
        btn.textContent='Stop opname';
      }catch(e){recorder=null;toast(e.message)}
    }else{
      const r=recorder;recorder=null;btn.textContent='🎙️ Gebeurtenis inspreken';state.textContent='Transcriberen…';
      try{
        const blob=await r.stop();
        const d=await transcribe(blob);
        state.textContent='Namen controleren…';
        const corrected=await correctNames(d.text);
        transcript.textContent=corrected!==d.text?`Je zei: ${d.text}\nNamen gecorrigeerd: ${corrected}`:`Je zei: ${d.text}`;
        text.value=(text.value?text.value+'\n':'')+corrected;
        state.textContent='';
      }catch(e){state.textContent='';toast(e.message)}
    }
  };

  root.querySelector('#makeWeekReport').onclick=async()=>{
    const btn=root.querySelector('#makeWeekReport');
    const w=currentWeek();
    try{
      btn.disabled=true;btn.textContent='Weekverslag maken…';
      const events=(await getAll('classDiaryEvents'))
        .filter(x=>x.date>=w.monday&&x.date<=w.sunday)
        .sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt));

      if(!events.length)return toast(`Er zijn nog geen gebeurtenissen opgeslagen in week ${w.week}.`);

      const d=await summarizeClassWeek(events,{weekNumber:w.week,year:w.year,classList});
      const corrected=await correctNames(d.text);
      reportText.value=corrected;
      reportWrap.classList.remove('hidden');
      setTimeout(()=>reportWrap.scrollIntoView({behavior:'smooth',block:'start'}),50);
    }catch(e){toast(e.message)}
    finally{btn.disabled=false;btn.textContent='Maak een weekverslag'}
  };

  root.querySelector('#saveWeekReport').onclick=async()=>{
    const body=reportText.value.trim();if(!body)return toast('Maak eerst een weekverslag.');
    const w=currentWeek();
    const existing=(await getAll('weeklyReports')).find(x=>x.week===w.week&&x.year===w.year);
    const now=new Date().toISOString();
    await put('weeklyReports',{
      id:existing?.id||uid(),
      week:w.week,year:w.year,
      monday:w.monday,sunday:w.sunday,
      text:body,
      createdAt:existing?.createdAt||now,
      updatedAt:now
    });
    toast(`Weekverslag ${w.week} opgeslagen`);
    await drawSavedReports();
  };

  root.querySelector('#mailWeekReport').onclick=()=>{
    const body=reportText.value.trim();if(!body)return toast('Maak eerst een weekverslag.');
    const email=String(settings.get('email','')||'').trim();
    if(!email)return toast('Vul eerst je e-mailadres in bij Instellingen.');
    const w=currentWeek();
    mailto(email,`Weekverslag ${w.week}`,body);
  };

  root.querySelector('#copyWeekReport').onclick=()=>copy(reportText.value);

  async function drawSavedReports(){
    const items=(await getAll('weeklyReports')).sort((a,b)=>b.year-a.year||b.week-a.week);
    savedReports.innerHTML=items.length?items.map(x=>`<div class="item">
      <strong>Weekverslag ${x.week} · ${x.year}</strong>
      <div class="muted">${dateNL(x.monday)} t/m ${dateNL(x.sunday)}</div>
      <div class="preview" style="margin-top:7px">${esc((x.text||'').slice(0,180))}${(x.text||'').length>180?'…':''}</div>
      <div class="row" style="margin-top:9px">
        <button class="btn secondary small" data-open-report="${x.id}">Open</button>
        <button class="btn secondary small" data-mail-report="${x.id}">Mail</button>
        <button class="btn danger small" data-del-report="${x.id}">Verwijder</button>
      </div>
    </div>`).join(''):'<div class="muted">Nog geen opgeslagen weekverslagen.</div>';

    savedReports.querySelectorAll('[data-open-report]').forEach(b=>b.onclick=()=>{
      const x=items.find(i=>i.id===b.dataset.openReport);
      reportText.value=x.text||'';
      reportWrap.classList.remove('hidden');
      savedReports.classList.add('hidden');
      setTimeout(()=>reportWrap.scrollIntoView({behavior:'smooth',block:'start'}),50);
    });

    savedReports.querySelectorAll('[data-mail-report]').forEach(b=>b.onclick=()=>{
      const x=items.find(i=>i.id===b.dataset.mailReport);
      const email=String(settings.get('email','')||'').trim();
      if(!email)return toast('Vul eerst je e-mailadres in bij Instellingen.');
      mailto(email,`Weekverslag ${x.week}`,x.text||'');
    });

    savedReports.querySelectorAll('[data-del-report]').forEach(b=>b.onclick=async()=>{
      if(confirm('Dit opgeslagen weekverslag verwijderen?')){
        await del('weeklyReports',b.dataset.delReport);
        drawSavedReports();
      }
    });
  }

  root.querySelector('#toggleSavedReports').onclick=async()=>{
    savedReports.classList.toggle('hidden');
    if(!savedReports.classList.contains('hidden'))await drawSavedReports();
  };

  await drawDay();
}
