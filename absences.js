import {settings} from './storage.js';
import {esc,mailto,toast} from './utils.js';

function todayISO(){
  const d=new Date();
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function dateNL(value){
  try{
    return new Date(`${value}T12:00:00`).toLocaleDateString('nl-NL',{
      weekday:'long',day:'numeric',month:'long',year:'numeric'
    });
  }catch{return value}
}
function subjectDate(value){
  try{
    return new Date(`${value}T12:00:00`).toLocaleDateString('nl-NL',{
      day:'2-digit',month:'2-digit',year:'numeric'
    });
  }catch{return value}
}

export async function renderAbsences(root){
  const students=settings.get('classList',[]).slice().sort((a,b)=>String(a).localeCompare(String(b),'nl',{sensitivity:'base'}));
  const initialDate=todayISO();

  root.innerHTML=`<div class="topbar"><div>
    <div class="title">Absenties invoeren</div>
    <div class="subtitle">Vink per leerling ochtend, middag of hele dag afwezig aan.</div>
  </div></div>

  <div class="card">
    <div class="field">
      <label>Datum</label>
      <input id="absenceDate" class="input" type="date" value="${initialDate}">
    </div>

    ${students.length?`
      <div class="section-title">Leerlingen</div>
      <div id="absenceStudents" class="absence-list">
        ${students.map((name,i)=>`<div class="absence-row">
          <label class="absence-student-check">
            <input type="checkbox" data-absence-toggle="${i}">
            <span class="absence-name">${esc(name)}</span>
          </label>
          <div class="absence-options hidden" data-absence-options="${i}">
            <label><input type="radio" name="absence-${i}" value="Hele dag" checked> Hele dag</label>
            <label><input type="radio" name="absence-${i}" value="Ochtend"> Ochtend</label>
            <label><input type="radio" name="absence-${i}" value="Middag"> Middag</label>
          </div>
        </div>`).join('')}
      </div>
      <div class="row" style="margin-top:14px">
        <button id="makeAbsenceList" class="btn">Maak overzicht</button>
        <button id="clearAbsences" class="btn secondary">Wissen</button>
      </div>
    `:`
      <div class="muted">Voeg eerst een klassenlijst toe via Instellingen.</div>
    `}
  </div>

  <div id="absenceResult" class="hidden">
    <div class="card">
      <div class="section-title" id="absenceHeading"></div>
      <textarea id="absenceText" class="textarea" style="min-height:220px"></textarea>
      <div class="row" style="margin-top:12px">
        <button id="mailAbsences" class="btn">Mail naar mezelf</button>
        <button id="copyAbsences" class="btn secondary">Kopiëren</button>
      </div>
    </div>
  </div>`;

  if(!students.length)return;

  const dateInput=root.querySelector('#absenceDate');
  const result=root.querySelector('#absenceResult');
  const heading=root.querySelector('#absenceHeading');
  const text=root.querySelector('#absenceText');

  function collect(){
    const rows=[];
    students.forEach((name,i)=>{
      const toggle=root.querySelector(`[data-absence-toggle="${i}"]`);
      if(!toggle?.checked)return;
      const selected=root.querySelector(`input[name="absence-${i}"]:checked`);
      const value=selected?.value||'Hele dag';
      rows.push({name,value});
    });
    return rows;
  }

  function makeOverview(){
    const rows=collect();
    const d=dateInput.value||initialDate;
    heading.textContent=`Absenties – ${dateNL(d)}`;
    text.value=rows.length
      ? rows.map(x=>`${x.name} – ${x.value}`).join('\n')
      : 'Geen absenties.';
    result.classList.remove('hidden');
    setTimeout(()=>result.scrollIntoView({behavior:'smooth',block:'start'}),50);
  }

  root.querySelectorAll('[data-absence-toggle]').forEach(toggle=>toggle.onchange=()=>{
    const i=toggle.dataset.absenceToggle;
    const options=root.querySelector(`[data-absence-options="${i}"]`);
    options?.classList.toggle('hidden',!toggle.checked);
    if(toggle.checked){
      const fullDay=root.querySelector(`input[name="absence-${i}"][value="Hele dag"]`);
      if(fullDay)fullDay.checked=true;
    }
  });

  root.querySelector('#makeAbsenceList').onclick=makeOverview;

  root.querySelector('#clearAbsences').onclick=()=>{
    students.forEach((_,i)=>{
      const toggle=root.querySelector(`[data-absence-toggle="${i}"]`);
      const fullDay=root.querySelector(`input[name="absence-${i}"][value="Hele dag"]`);
      const options=root.querySelector(`[data-absence-options="${i}"]`);
      if(toggle)toggle.checked=false;
      if(fullDay)fullDay.checked=true;
      options?.classList.add('hidden');
    });
    result.classList.add('hidden');
    text.value='';
  };

  root.querySelector('#mailAbsences').onclick=()=>{
    if(result.classList.contains('hidden'))makeOverview();
    const to=String(settings.get('email','')||'').trim();
    if(!to)return toast('Vul eerst je e-mailadres in bij Instellingen.');
    const d=dateInput.value||initialDate;
    mailto(to,`Absenties – ${subjectDate(d)}`,text.value);
  };

  root.querySelector('#copyAbsences').onclick=async()=>{
    try{
      await navigator.clipboard.writeText(text.value);
      toast('Absentieoverzicht gekopieerd');
    }catch{
      toast('Kopiëren is niet gelukt.');
    }
  };
}
