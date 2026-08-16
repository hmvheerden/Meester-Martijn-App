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
  const students=settings.get('classList',[]);
  const initialDate=todayISO();

  root.innerHTML=`<div class="topbar"><div>
    <div class="title">Absenties invoeren</div>
    <div class="subtitle">Vink alleen leerlingen aan die absent zijn.</div>
  </div></div>

  <div class="card">
    <div class="field">
      <label>Datum</label>
      <input id="absenceDate" class="input" type="date" value="${initialDate}">
    </div>

    ${students.length?`
      <div class="section-title">Leerlingen</div>
      <div id="absenceStudents" class="absence-list">
        ${students.map((name,i)=>`<div class="absence-row" data-absence-row="${i}">
          <div class="absence-head">
            <div class="absence-name">${esc(name)}</div>
            <label class="absence-toggle">
              <input class="absence-check" type="checkbox" data-index="${i}">
              <span>Absent</span>
            </label>
          </div>

          <div class="absence-details hidden" data-details="${i}">
            <div class="absence-field">
              <label>Absentie</label>
              <select class="input absence-status">
                <option value="Geoorloofd absent">Geoorloofd absent</option>
                <option value="Ongeoorloofd absent">Ongeoorloofd absent</option>
              </select>
            </div>

            <div class="absence-field">
              <label>Dagdeel</label>
              <div class="absence-periods">
                <label><input type="radio" name="absence-period-${i}" value="Ochtend" checked> Ochtend</label>
                <label><input type="radio" name="absence-period-${i}" value="Middag"> Middag</label>
                <label><input type="radio" name="absence-period-${i}" value="Hele dag"> Hele dag</label>
              </div>
            </div>

            <div class="absence-field">
              <label>Reden <span class="muted">(optioneel)</span></label>
              <input class="input absence-reason" type="text" placeholder="Bijv. ziek, tandarts, verlof…">
            </div>
          </div>
        </div>`).join('')}
      </div>
      <div class="row" style="margin-top:14px">
        <button id="makeAbsenceList" class="btn">Maak absentielijst</button>
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

  root.querySelectorAll('.absence-check').forEach(check=>{
    check.addEventListener('change',()=>{
      const i=check.dataset.index;
      const details=root.querySelector(`[data-details="${i}"]`);
      details?.classList.toggle('hidden',!check.checked);
      root.querySelector(`[data-absence-row="${i}"]`)?.classList.toggle('is-absent',check.checked);
    });
  });

  function collect(){
    const rows=[];
    students.forEach((name,i)=>{
      const row=root.querySelector(`[data-absence-row="${i}"]`);
      const checked=row?.querySelector('.absence-check')?.checked;
      if(!checked)return;
      const status=row.querySelector('.absence-status')?.value||'Geoorloofd absent';
      const period=row.querySelector(`input[name="absence-period-${i}"]:checked`)?.value||'Ochtend';
      const reason=(row.querySelector('.absence-reason')?.value||'').trim();
      rows.push({name,status,period,reason});
    });
    return rows;
  }

  function lineFor(x){
    return `${x.name} – ${x.status} – ${x.period}${x.reason?` – Reden: ${x.reason}`:''}`;
  }

  function makeOverview(){
    const rows=collect();
    const d=dateInput.value||initialDate;
    heading.textContent=`Absenties – ${dateNL(d)}`;
    text.value=rows.length
      ? rows.map(lineFor).join('\n')
      : 'Geen leerlingen absent gemeld.';
    result.classList.remove('hidden');
    setTimeout(()=>result.scrollIntoView({behavior:'smooth',block:'start'}),50);
  }

  root.querySelector('#makeAbsenceList').onclick=makeOverview;

  root.querySelector('#clearAbsences').onclick=()=>{
    root.querySelectorAll('.absence-check').forEach(check=>{
      check.checked=false;
      const i=check.dataset.index;
      root.querySelector(`[data-details="${i}"]`)?.classList.add('hidden');
      root.querySelector(`[data-absence-row="${i}"]`)?.classList.remove('is-absent');
      const row=root.querySelector(`[data-absence-row="${i}"]`);
      if(row){
        const status=row.querySelector('.absence-status');
        if(status)status.value='Geoorloofd absent';
        const morning=row.querySelector(`input[name="absence-period-${i}"][value="Ochtend"]`);
        if(morning)morning.checked=true;
        const reason=row.querySelector('.absence-reason');
        if(reason)reason.value='';
      }
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
