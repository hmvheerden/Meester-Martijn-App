import {chat,transcribe,adjustMailByInstruction,normalizeClassNames,generalChatWithImage} from './api.js';
import {settings} from './storage.js';
import {esc,mailto,copy,toast} from './utils.js';
import {Recorder} from './recorder.js';
let history=[]; let last={subject:'',body:''}; let recorder; let adjustRecorder; let replyRecorder; let mailPhoto=null; let mailPhotoUrl='';
export async function renderMail(root){root.innerHTML=`<div class="topbar"><div><div class="title">AI-Mail</div><div class="subtitle">Typ of spreek je bericht in.</div></div><button class="btn secondary small" id="newMail">Nieuwe mail</button></div>
<div class="card"><div id="chat" class="chat"></div>
<div class="field"><textarea id="mailPrompt" class="textarea" placeholder="Bijv. Maak een mail aan collega's over de studiedag..."></textarea></div>
<div class="row"><button class="btn" id="sendMail">Maak mail</button><button class="btn secondary" id="recordMail">🎙️ Spraak</button><span id="recordState"></span></div>
</div>
<div class="card">
  <div class="section-title">Reageren op een bestaande mail</div>
  <div class="muted">Maak een foto van de mail of voeg een bestaande foto/screenshot toe. Geef daarna aan wat je in je reactie wilt zetten.</div>
  <div id="mailPhotoPreview" class="hidden chat-image-preview" style="margin-top:10px"></div>
  <div class="row" style="margin-top:10px">
    <label class="btn secondary">📷 Foto maken
      <input id="mailCameraInput" type="file" accept="image/*" capture="environment" hidden>
    </label>
    <label class="btn secondary">🖼️ Foto invoegen
      <input id="mailPhotoInput" type="file" accept="image/*" hidden>
    </label>
  </div>
  <div class="field" style="margin-top:12px"><label>Wat wil je dat er in de reactie staat?</label>
    <textarea id="mailReplyInstruction" class="textarea" placeholder="Bijv. Geef een reactie op deze mail en schrijf erbij dat ik akkoord ben, maar dinsdag niet kan."></textarea>
  </div>
  <div class="row">
    <button id="makeMailReply" class="btn">Geef een reactie op deze mail</button>
    <button id="recordMailReplyInstruction" class="btn secondary">🎙️ Inspreken wat ik wil</button>
    <span id="mailReplyState"></span>
  </div>
</div>
<div class="card"><div class="section-title">Resultaat</div><div class="field"><label>Onderwerp</label><input id="subject" class="input"></div><div class="field"><label>Bericht</label><textarea id="body" class="textarea" style="min-height:220px"></textarea></div><div class="row"><button class="btn secondary small act" data-act="regenerate">Opnieuw</button><button class="btn secondary small act" data-act="shorter">Korter</button><button class="btn secondary small act" data-act="friendlier">Vriendelijker</button><button class="btn secondary small act" data-act="formal">Formeler</button><button class="btn secondary small act" data-act="informal">Informeler</button><button class="btn secondary small" id="copyMail">Kopiëren</button><button class="btn secondary small" id="adjustMailVoice">🎙️ Spreek in om aan te passen</button><button class="btn" id="openMail">Mail openen</button><span id="adjustMailState"></span></div></div>`;
const chatEl=root.querySelector('#chat'), prompt=root.querySelector('#mailPrompt'), subject=root.querySelector('#subject'), body=root.querySelector('#body');
const mailCameraInput=root.querySelector('#mailCameraInput'),mailPhotoInput=root.querySelector('#mailPhotoInput'),mailPhotoPreview=root.querySelector('#mailPhotoPreview'),mailReplyInstruction=root.querySelector('#mailReplyInstruction'),mailReplyState=root.querySelector('#mailReplyState');
function clearMailPhoto(){
  mailPhoto=null;
  if(mailPhotoUrl){try{URL.revokeObjectURL(mailPhotoUrl)}catch{}mailPhotoUrl=''}
  mailCameraInput.value='';mailPhotoInput.value='';
  mailPhotoPreview.classList.add('hidden');mailPhotoPreview.innerHTML='';
}
function selectMailPhoto(file){
  if(!file)return;
  clearMailPhoto();
  mailPhoto=file;
  mailPhotoUrl=URL.createObjectURL(file);
  mailPhotoPreview.classList.remove('hidden');
  mailPhotoPreview.innerHTML=`<div class="chat-image-wrap"><img src="${mailPhotoUrl}" alt="Foto van mail"><button id="removeMailPhoto" class="btn danger small">Foto verwijderen</button></div>`;
  mailPhotoPreview.querySelector('#removeMailPhoto').onclick=clearMailPhoto;
}
mailCameraInput.onchange=()=>selectMailPhoto(mailCameraInput.files?.[0]||null);
mailPhotoInput.onchange=()=>selectMailPhoto(mailPhotoInput.files?.[0]||null);

function drawHistory(){chatEl.innerHTML=history.map(m=>`<div class="bubble ${m.role==='user'?'user':'ai'}">${esc(m.content)}</div>`).join('');chatEl.scrollTop=chatEl.scrollHeight}
function sync(){last={subject:subject.value,body:body.value}}
function setResult(data){last={subject:data.subject||'',body:data.body||data.text||''};subject.value=last.subject;body.value=last.body}
async function normalizeMailNames(){
  sync();
  const names=settings.get('classList',[]);
  if(!Array.isArray(names)||!names.length)return;
  try{
    const b=await normalizeClassNames(last.body,names);
    const s=await normalizeClassNames(last.subject,names);
    setResult({subject:s.text||last.subject,body:b.text||last.body});
  }catch(e){console.warn('Naamcontrole mail overgeslagen:',e)}
}
async function ask(text,action='compose'){if(!text.trim())return;history.push({role:'user',content:text.trim()});drawHistory();prompt.value='';try{root.querySelector('#sendMail').disabled=true;const data=await chat(history,action);history.push({role:'assistant',content:`${data.subject?data.subject+'\n\n':''}${data.body||data.text||''}`});setResult(data);await normalizeMailNames();drawHistory()}catch(e){toast(e.message)}finally{root.querySelector('#sendMail').disabled=false}}
async function makeReplyFromPhoto(){
  if(!mailPhoto)return toast('Maak eerst een foto van de mail of voeg een foto toe.');
  const instruction=mailReplyInstruction.value.trim()||'Geef een passende, vriendelijke en professionele reactie op deze mail.';
  const btn=root.querySelector('#makeMailReply');
  try{
    btn.disabled=true;btn.textContent='Mail lezen…';mailReplyState.textContent='AI leest de mail op de foto…';
    const source=await generalChatWithImage([],mailPhoto,
      'Lees deze foto of screenshot van een e-mail nauwkeurig. Neem de volledige inhoud over die nodig is om erop te reageren, inclusief afzender indien zichtbaar, onderwerp, vragen, afspraken, data, namen en belangrijke context. Verzin niets. Geef alleen een duidelijke transcriptie/samenvatting van de ontvangen e-mail.');
    mailReplyState.textContent='Reactie opstellen…';
    const request=`Schrijf een direct bruikbare REACTIE op de onderstaande ontvangen e-mail.

ONTVANGEN MAIL:
${source.text}

WAT IK IN MIJN REACTIE WIL:
${instruction}

Belangrijk: reageer inhoudelijk op de ontvangen mail. Verwerk mijn aanvullende wensen. Schrijf geen ondertekening of afsluitende groet.`;
    history.push({role:'user',content:`Reactie op foto-mail. ${instruction}`});
    const data=await chat([{role:'user',content:request}],'compose');
    setResult(data);await normalizeMailNames();
    history.push({role:'assistant',content:`${data.subject?data.subject+'\n\n':''}${data.body||''}`});
    drawHistory();
    mailReplyState.textContent='Reactie klaar.';
  }catch(e){mailReplyState.textContent='';toast(e.message)}
  finally{btn.disabled=false;btn.textContent='Geef een reactie op deze mail'}
}

root.querySelector('#makeMailReply').onclick=makeReplyFromPhoto;

root.querySelector('#recordMailReplyInstruction').onclick=async()=>{
  const btn=root.querySelector('#recordMailReplyInstruction');
  if(!replyRecorder){
    try{
      replyRecorder=new Recorder(sec=>mailReplyState.innerHTML=`<span class="recording"><span class="pulse"></span>${sec}s</span>`);
      await replyRecorder.start();btn.textContent='Stop inspreken';
    }catch(e){replyRecorder=null;toast(e.message)}
  }else{
    const r=replyRecorder;replyRecorder=null;btn.textContent='🎙️ Inspreken wat ik wil';mailReplyState.textContent='Transcriberen…';
    try{
      const blob=await r.stop();const t=await transcribe(blob);
      mailReplyInstruction.value=t.text;
      mailReplyState.textContent=`Je zei: ${t.text}`;
    }catch(e){mailReplyState.textContent='';toast(e.message)}
  }
};

root.querySelector('#sendMail').onclick=()=>ask(prompt.value);prompt.onkeydown=e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter')ask(prompt.value)};
root.querySelector('#newMail').onclick=()=>{history=[];last={subject:'',body:''};subject.value='';body.value='';mailReplyInstruction.value='';clearMailPhoto();drawHistory()};
root.querySelectorAll('.act').forEach(b=>b.onclick=async()=>{sync();if(!last.body)return toast('Maak eerst een mail.');await ask(`Pas deze e-mail aan. Onderwerp: ${last.subject}\n\n${last.body}`,b.dataset.act)});
root.querySelector('#copyMail').onclick=()=>{sync();copy(`${last.subject}\n\n${last.body}`)};
root.querySelector('#openMail').onclick=async()=>{sync();await normalizeMailNames();mailto(settings.get('email',''),last.subject,last.body)};
root.querySelector('#adjustMailVoice').onclick=async()=>{
 const btn=root.querySelector('#adjustMailVoice'),state=root.querySelector('#adjustMailState');sync();
 if(!last.body)return toast('Maak eerst een mail.');
 if(!adjustRecorder){
   try{adjustRecorder=new Recorder(sec=>state.innerHTML=`<span class="recording"><span class="pulse"></span>${sec}s</span>`);await adjustRecorder.start();btn.textContent='Stop aanpassing'}
   catch(e){adjustRecorder=null;toast(e.message)}
 }else{
   const r=adjustRecorder;adjustRecorder=null;btn.textContent='🎙️ Spreek in om aan te passen';state.textContent='Transcriberen…';
   try{const blob=await r.stop();const t=await transcribe(blob);state.textContent='Mail aanpassen…';const data=await adjustMailByInstruction(last.subject,last.body,t.text);setResult(data);await normalizeMailNames();state.textContent=`Aangepast op: ${t.text}`}
   catch(e){state.textContent='';toast(e.message)}
 }
};

subject.oninput=sync;body.oninput=sync;
root.querySelector('#recordMail').onclick=async()=>{const btn=root.querySelector('#recordMail'),state=root.querySelector('#recordState');if(!recorder){try{recorder=new Recorder(s=>state.innerHTML=`<span class="recording"><span class="pulse"></span>${s}s</span>`);await recorder.start();btn.textContent='Stop opname'}catch(e){recorder=null;toast(e.message)}}else{const r=recorder;recorder=null;btn.textContent='🎙️ Spraak';state.textContent='Transcriberen…';try{const blob=await r.stop();const data=await transcribe(blob);state.textContent=`Je zei: ${data.text}`;await ask(data.text)}catch(e){state.textContent='';toast(e.message)}}};
}
