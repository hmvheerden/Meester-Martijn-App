import {settings} from './storage.js';
import {transcribe,summarizeFeedback} from './api.js';
import {Recorder} from './recorder.js';
import {esc,mailto,toast} from './utils.js';

let recorder=null;
let photoFile=null;
let photoUrl='';

function cleanupPhoto(){
  if(photoUrl){try{URL.revokeObjectURL(photoUrl)}catch{} photoUrl='';}
}

async function shareMailWithPhoto({to,subject,body,file}){
  // Web Share is the only browser-safe way to hand a local attachment to iOS Mail.
  if(file && navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
    try{
      await navigator.share({title:subject,text:`Aan: ${to}\nOnderwerp: ${subject}\n\n${body}`,files:[file]});
      return;
    }catch(e){if(e?.name==='AbortError')return;}
  }
  if(file){
    toast('Bijlage kan niet automatisch via mailto worden toegevoegd. De mail wordt geopend; deel de foto daarna handmatig als bijlage.');
  }
  mailto(to,subject,body);
}

export async function renderFeedback(root){
  const students=settings.get('classList',[]);
  root.innerHTML=`<div class="topbar"><div><div class="title">Feedback</div><div class="subtitle">Leg snel feedback vast bij een leerling.</div></div></div>
  <div class="card">
    <div class="field"><label>Kies leerling</label>
      <select id="feedbackStudent" class="select">
        <option value="">Kies leerling…</option>
        ${students.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('')}
      </select>
      ${students.length?'':'<div class="muted" style="margin-top:6px">Voeg eerst je klassenlijst toe via Instellingen.</div>'}
    </div>

    <div class="field"><label>Foto</label>
      <label class="btn secondary">📷 Foto maken / kiezen
        <input id="feedbackPhoto" type="file" accept="image/*" capture="environment" hidden>
      </label>
      <div id="photoPreview" style="margin-top:10px"></div>
    </div>

    <div class="field"><label>Feedback</label>
      <textarea id="feedbackText" class="textarea" placeholder="Typ je observatie of spreek hem hieronder in…"></textarea>
    </div>

    <div class="row">
      <button id="feedbackRecord" class="btn secondary">🎙️ Spraakbericht</button>
      <span id="feedbackRecordState"></span>
    </div>
    <div id="feedbackTranscript" class="muted" style="margin-top:10px"></div>

    <div class="row" style="margin-top:12px">
      <button id="feedbackSummarize" class="btn">Vat samen met AI</button>
    </div>
    <div class="field"><label>Samenvatting</label>
      <textarea id="feedbackSummary" class="textarea" style="min-height:150px" placeholder="Hier verschijnt de AI-samenvatting…"></textarea>
    </div>

    <div class="row">
      <button id="feedbackMail" class="btn">Mail opstellen</button>
      <button id="feedbackClear" class="btn secondary">Wissen</button>
    </div>
    <p class="muted">Met een foto opent ‘Mail opstellen’ het iOS-deelmenu. Kies daar Mail om de foto als bijlage mee te sturen. Zonder foto opent direct je mailapp.</p>
  </div>`;

  const student=root.querySelector('#feedbackStudent');
  const text=root.querySelector('#feedbackText');
  const summary=root.querySelector('#feedbackSummary');
  const preview=root.querySelector('#photoPreview');
  const fileInput=root.querySelector('#feedbackPhoto');

  fileInput.onchange=()=>{
    cleanupPhoto();
    photoFile=fileInput.files?.[0]||null;
    if(!photoFile){preview.innerHTML='';return;}
    photoUrl=URL.createObjectURL(photoFile);
    preview.innerHTML=`<div class="feedback-photo-wrap"><img class="feedback-photo" src="${photoUrl}" alt="Gekozen foto"><button id="removeFeedbackPhoto" class="btn danger small">Foto verwijderen</button></div>`;
    preview.querySelector('#removeFeedbackPhoto').onclick=()=>{cleanupPhoto();photoFile=null;fileInput.value='';preview.innerHTML='';};
  };

  root.querySelector('#feedbackRecord').onclick=async()=>{
    const btn=root.querySelector('#feedbackRecord'),state=root.querySelector('#feedbackRecordState'),trans=root.querySelector('#feedbackTranscript');
    if(!recorder){
      try{
        recorder=new Recorder(sec=>state.innerHTML=`<span class="recording"><span class="pulse"></span>${sec}s</span>`);
        await recorder.start();btn.textContent='Stop opname';
      }catch(e){recorder=null;toast(e.message)}
    }else{
      const r=recorder;recorder=null;btn.textContent='🎙️ Spraakbericht';state.textContent='Transcriberen…';
      try{
        const blob=await r.stop();const d=await transcribe(blob);
        trans.textContent=`Je zei: ${d.text}`;
        text.value=(text.value?text.value+'\n':'')+d.text;
        state.textContent='';
      }catch(e){state.textContent='';toast(e.message)}
    }
  };

  root.querySelector('#feedbackSummarize').onclick=async()=>{
    if(!text.value.trim())return toast('Typ of spreek eerst feedback in.');
    try{
      const b=root.querySelector('#feedbackSummarize');b.disabled=true;
      const d=await summarizeFeedback(text.value,student.value);
      summary.value=d.text||'';
    }catch(e){toast(e.message)}
    finally{root.querySelector('#feedbackSummarize').disabled=false}
  };

  root.querySelector('#feedbackMail').onclick=async()=>{
    if(!student.value)return toast('Kies eerst een leerling.');
    const body=(summary.value||text.value).trim();
    if(!body)return toast('Voeg eerst feedback toe.');
    const to=settings.get('email','');
    const subject=`Feedback – ${student.value}`;
    await shareMailWithPhoto({to,subject,body,file:photoFile});
  };

  root.querySelector('#feedbackClear').onclick=()=>{
    text.value='';summary.value='';student.value='';root.querySelector('#feedbackTranscript').textContent='';
    cleanupPhoto();photoFile=null;fileInput.value='';preview.innerHTML='';
  };
}
