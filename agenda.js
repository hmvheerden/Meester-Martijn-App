import {parseCalendarEvent,transcribe} from './api.js';
import {Recorder} from './recorder.js';
import {esc,toast,uid} from './utils.js';
import {put,settings} from './storage.js';

let recorder=null;
let adjustRecorder=null;

function pad(n){return String(n).padStart(2,'0')}
function icsEscape(v=''){
  return String(v).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
}
function addMinutes(time,mins){
  const [h,m]=String(time||'09:00').split(':').map(Number);
  const d=new Date(2000,0,1,h||0,m||0);
  d.setMinutes(d.getMinutes()+mins);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function nextDate(date){
  const d=new Date(`${date}T12:00:00`);
  d.setDate(d.getDate()+1);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function dt(date,time){
  return `${String(date).replaceAll('-','')}T${String(time).replace(':','')}00`;
}
function makeICS(ev){
  const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const id=`${Date.now()}-${Math.random().toString(36).slice(2)}@meester-martijn-app`;
  const lines=[
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Meester Martijn App//NL','CALSCALE:GREGORIAN','METHOD:PUBLISH',
    'BEGIN:VEVENT',`UID:${id}`,`DTSTAMP:${stamp}`,`SUMMARY:${icsEscape(ev.title)}`
  ];
  if(ev.allDay){
    lines.push(`DTSTART;VALUE=DATE:${ev.date.replaceAll('-','')}`);
    lines.push(`DTEND;VALUE=DATE:${nextDate(ev.date).replaceAll('-','')}`);
  }else{
    lines.push(`DTSTART:${dt(ev.date,ev.startTime)}`);
    lines.push(`DTEND:${dt(ev.date,ev.endTime)}`);
  }
  if(ev.location)lines.push(`LOCATION:${icsEscape(ev.location)}`);
  if(ev.notes)lines.push(`DESCRIPTION:${icsEscape(ev.notes)}`);
  lines.push('END:VEVENT','END:VCALENDAR');
  return lines.join('\r\n');
}
async function openAgendaFile(ev){
  const file=new File([makeICS(ev)],`${ev.title||'Agenda-item'}.ics`,{type:'text/calendar;charset=utf-8'});
  // Op iPhone werkt delen als bestand het betrouwbaarst; Calendar kan .ics openen/importeren.
  if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
    try{
      await navigator.share({title:ev.title,files:[file]});
      return;
    }catch(e){if(e?.name==='AbortError')return;}
  }
  const url=URL.createObjectURL(file);
  const a=document.createElement('a');
  a.href=url;a.download=file.name;a.target='_blank';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
  toast('Agenda-bestand geopend. Kies Agenda om het item toe te voegen.');
}



export async function renderAgenda(root){
  let event=null;
  root.innerHTML=`<div class="topbar"><div><div class="title">Agenda</div><div class="subtitle">Typ of spreek een afspraak in. AI maakt er een agenda-item van.</div></div></div>
  <div class="card">
    <div class="field"><label>Wat wil je in je agenda zetten?</label>
      <textarea id="agendaPrompt" class="textarea" placeholder="Bijv. Morgen om half vier oudergesprek met Lisa, duurt 30 minuten."></textarea>
    </div>
    <div class="row">
      <button id="makeAgenda" class="btn">Maak agenda-item</button>
      <button id="recordAgenda" class="btn secondary">🎙️ Inspreken</button>
      <span id="agendaRecordState"></span>
    </div>
    <div id="agendaTranscript" class="muted" style="margin-top:10px"></div>
  </div>

  <div id="agendaResult" class="hidden">
    <div class="card">
      <div class="section-title">Dit is de afspraak, klopt het zo?</div>
      <div id="agendaSummary" class="agenda-summary"></div>

      <div id="agendaConfirmActions" class="row" style="margin-top:14px">
        <button id="confirmAgenda" class="btn">Ja, het klopt</button>
        <button id="redoAgenda" class="btn secondary">Nee, opnieuw</button>
        <button id="adjustAgendaVoice" class="btn secondary">🎙️ Spreek in om aan te passen</button>
        <span id="adjustAgendaState"></span>
      </div>

      <div id="agendaApproved" class="hidden" style="margin-top:14px">
        <div class="status"><span class="dot ok"></span> Afspraak goedgekeurd</div>
        <button id="shareAgendaICS" class="btn" style="margin-top:12px">Voeg toe via ICS To Calendar</button>
        <div class="muted" style="margin-top:10px">De app opent het iOS-deelmenu met het .ics-bestand. Kies daar <strong>ICS To Calendar</strong> en voeg daarna de afspraak toe aan Apple Agenda.</div>
      </div>
    </div>

    <div id="agendaEditCard" class="card hidden">
      <div class="section-title">Afspraak aanpassen</div>
      <div class="field"><label>Titel</label><input id="agendaTitle" class="input"></div>
      <div class="field"><label>Datum</label><input id="agendaDate" class="input" type="date"></div>
      <label class="calendar-all-day"><input id="agendaAllDay" type="checkbox"> Hele dag</label>
      <div id="agendaTimes" class="calendar-time-grid">
        <div class="field"><label>Begintijd</label><input id="agendaStart" class="input" type="time"></div>
        <div class="field"><label>Eindtijd</label><input id="agendaEnd" class="input" type="time"></div>
      </div>
      <div class="field"><label>Locatie</label><input id="agendaLocation" class="input"></div>
      <div class="field"><label>Notities</label><textarea id="agendaNotes" class="textarea"></textarea></div>
      <div class="row">
        <button id="saveAgendaCorrection" class="btn">Gebruik deze afspraak</button>
        <button id="cancelAgendaCorrection" class="btn secondary">Opnieuw inspreken/typen</button>
      </div>
    </div>
  </div>`;

  const prompt=root.querySelector('#agendaPrompt'),result=root.querySelector('#agendaResult');
  const summaryEl=root.querySelector('#agendaSummary');
  const approved=root.querySelector('#agendaApproved');
  const confirmActions=root.querySelector('#agendaConfirmActions');
  const editCard=root.querySelector('#agendaEditCard');
  const title=root.querySelector('#agendaTitle'),date=root.querySelector('#agendaDate'),start=root.querySelector('#agendaStart'),end=root.querySelector('#agendaEnd'),allDay=root.querySelector('#agendaAllDay'),times=root.querySelector('#agendaTimes'),location=root.querySelector('#agendaLocation'),notes=root.querySelector('#agendaNotes');
  const pendingPrompt=settings.get('pendingAgendaPrompt','');
  if(pendingPrompt){prompt.value=pendingPrompt;settings.remove('pendingAgendaPrompt');setTimeout(()=>make(),100);}


  function formatDateNL(value){
    try{return new Date(`${value}T12:00:00`).toLocaleDateString('nl-NL',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
    catch{return value}
  }
  function drawSummary(ev){
    const time=ev.allDay?'Hele dag':`${ev.startTime} – ${ev.endTime}`;
    summaryEl.innerHTML=`<div class="agenda-summary-row"><span>Titel</span><strong>${esc(ev.title||'')}</strong></div>
      <div class="agenda-summary-row"><span>Datum</span><strong>${esc(formatDateNL(ev.date))}</strong></div>
      <div class="agenda-summary-row"><span>Tijd</span><strong>${esc(time)}</strong></div>
      ${ev.location?`<div class="agenda-summary-row"><span>Locatie</span><strong>${esc(ev.location)}</strong></div>`:''}
      ${ev.notes?`<div class="agenda-summary-row"><span>Notities</span><strong>${esc(ev.notes)}</strong></div>`:''}`;
  }
  function syncEvent(){
    event={
      title:title.value.trim(),date:date.value,startTime:start.value,endTime:end.value,
      allDay:allDay.checked,location:location.value.trim(),notes:notes.value.trim()
    };
    if(!event.allDay && !event.endTime && event.startTime)event.endTime=addMinutes(event.startTime,15);
    return event;
  }
  function showEvent(ev){
    event=ev;
    title.value=ev.title||'';
    date.value=ev.date||'';
    start.value=ev.startTime||'08:00';
    end.value=ev.endTime||addMinutes(start.value,15);
    allDay.checked=Boolean(ev.allDay);
    location.value=ev.location||'';
    notes.value=ev.notes||'';
    times.classList.toggle('hidden',allDay.checked);
    drawSummary(event);
    approved.classList.add('hidden');
    editCard.classList.add('hidden');
    confirmActions.classList.remove('hidden');
    result.classList.remove('hidden');
    setTimeout(()=>result.scrollIntoView({behavior:'smooth',block:'start'}),50);
  }
  async function make(){
    const q=prompt.value.trim();
    if(!q)return toast('Typ of spreek eerst wat je in de agenda wilt zetten.');
    const btn=root.querySelector('#makeAgenda');
    try{
      btn.disabled=true;btn.textContent='AI verwerkt…';
      const ev=await parseCalendarEvent(q,{
        now:new Date().toISOString(),
        timezone:Intl.DateTimeFormat().resolvedOptions().timeZone
      });
      if(!ev.title||!ev.date)throw new Error('Datum of titel kon niet goed worden bepaald.');
      if(!ev.allDay){
        ev.startTime=ev.startTime||'08:00';
        ev.endTime=ev.endTime||addMinutes(ev.startTime,15);
      }
      showEvent(ev);
    }catch(e){toast(e.message)}
    finally{btn.disabled=false;btn.textContent='Maak agenda-item'}
  }

  root.querySelector('#makeAgenda').onclick=make;
  allDay.onchange=()=>times.classList.toggle('hidden',allDay.checked);

  root.querySelector('#adjustAgendaVoice').onclick=async()=>{
    const btn=root.querySelector('#adjustAgendaVoice'),state=root.querySelector('#adjustAgendaState');
    const current=syncEvent();
    if(!current.title||!current.date)return toast('Maak eerst een agenda-item.');
    if(!adjustRecorder){
      try{adjustRecorder=new Recorder(sec=>state.innerHTML=`<span class="recording"><span class="pulse"></span>${sec}s</span>`);await adjustRecorder.start();btn.textContent='Stop aanpassing'}
      catch(e){adjustRecorder=null;toast(e.message)}
    }else{
      const r=adjustRecorder;adjustRecorder=null;btn.textContent='🎙️ Spreek in om aan te passen';state.textContent='Transcriberen…';
      try{
        const blob=await r.stop(),t=await transcribe(blob);
        state.textContent='Agenda-item aanpassen…';
        const instruction=`Bestaande afspraak:
Titel: ${current.title}
Datum: ${current.date}
Begintijd: ${current.startTime}
Eindtijd: ${current.endTime}
Locatie: ${current.location||''}
Notities: ${current.notes||''}

Pas deze afspraak alleen aan volgens deze wijzigingsopdracht en behoud alle andere gegevens:
${t.text}`;
        const ev=await parseCalendarEvent(instruction,{now:new Date().toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone});
        showEvent(ev);
        state.textContent=`Aangepast op: ${t.text}`;
      }catch(e){state.textContent='';toast(e.message)}
    }
  };

  root.querySelector('#confirmAgenda').onclick=async()=>{
    event=syncEvent();
    if(!event.localId)event.localId=uid();
    await put('calendarEvents',{id:event.localId,title:event.title,date:event.date,startTime:event.startTime,endTime:event.endTime,allDay:event.allDay,location:event.location,notes:event.notes,updatedAt:new Date().toISOString()});
    drawSummary(event);
    confirmActions.classList.add('hidden');
    editCard.classList.add('hidden');
    approved.classList.remove('hidden');
  };

  root.querySelector('#redoAgenda').onclick=()=>{
    approved.classList.add('hidden');
    confirmActions.classList.add('hidden');
    editCard.classList.remove('hidden');
    setTimeout(()=>editCard.scrollIntoView({behavior:'smooth',block:'start'}),50);
  };

  root.querySelector('#saveAgendaCorrection').onclick=()=>{
    event=syncEvent();
    if(!event.title)return toast('Vul een titel in.');
    if(!event.date)return toast('Vul een datum in.');
    if(!event.allDay&&(!event.startTime||!event.endTime))return toast('Vul begin- en eindtijd in.');
    drawSummary(event);
    editCard.classList.add('hidden');
    approved.classList.add('hidden');
    confirmActions.classList.remove('hidden');
    setTimeout(()=>result.scrollIntoView({behavior:'smooth',block:'start'}),50);
  };

  root.querySelector('#cancelAgendaCorrection').onclick=()=>{
    result.classList.add('hidden');
    prompt.focus();
    window.scrollTo({top:0,behavior:'smooth'});
  };



  root.querySelector('#shareAgendaICS').onclick=async()=>{
    const ev=syncEvent();
    if(!ev.title)return toast('Vul een titel in.');
    if(!ev.date)return toast('Vul een datum in.');
    if(!ev.allDay&&(!ev.startTime||!ev.endTime))return toast('Vul begin- en eindtijd in.');
    const file=new File([makeICS(ev)],`${ev.title||'Agenda-item'}.ics`,{type:'text/calendar;charset=utf-8'});
    if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
      try{
        await navigator.share({title:ev.title,files:[file]});
        return;
      }catch(e){
        if(e?.name==='AbortError')return;
      }
    }
    // Fallback: open/download the ICS file so it can still be shared manually.
    const url=URL.createObjectURL(file);
    const a=document.createElement('a');
    a.href=url;
    a.download=file.name;
    a.target='_blank';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
    toast('ICS-bestand geopend. Kies Delen en daarna ICS To Calendar.');
  };

  root.querySelector('#recordAgenda').onclick=async()=>{
    const btn=root.querySelector('#recordAgenda'),state=root.querySelector('#agendaRecordState'),trans=root.querySelector('#agendaTranscript');
    if(!recorder){
      try{
        recorder=new Recorder(sec=>state.innerHTML=`<span class="recording"><span class="pulse"></span>${sec}s</span>`);
        await recorder.start();btn.textContent='Stop opname';
      }catch(e){recorder=null;toast(e.message)}
    }else{
      const r=recorder;recorder=null;btn.textContent='🎙️ Inspreken';state.textContent='Transcriberen…';
      try{
        const blob=await r.stop();const d=await transcribe(blob);
        prompt.value=d.text;trans.textContent=`Je zei: ${d.text}`;state.textContent='';
        await make();
      }catch(e){state.textContent='';toast(e.message)}
    }
  };
}
