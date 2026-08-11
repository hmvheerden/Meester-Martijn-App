import {chat,transcribe,adjustMailByInstruction} from './api.js';
import {settings} from './storage.js';
import {esc,mailto,copy,toast} from './utils.js';
import {Recorder} from './recorder.js';
let history=[]; let last={subject:'',body:''}; let recorder; let adjustRecorder;
export async function renderMail(root){root.innerHTML=`<div class="topbar"><div><div class="title">Mail opstellen</div><div class="subtitle">Typ of spreek je bericht in.</div></div><button class="btn secondary small" id="newMail">Nieuwe mail</button></div>
<div class="card"><div id="chat" class="chat"></div><div class="field"><textarea id="mailPrompt" class="textarea" placeholder="Bijv. Maak een mail aan collega's over de studiedag..."></textarea></div><div class="row"><button class="btn" id="sendMail">Maak mail</button><button class="btn secondary" id="recordMail">🎙️ Spraak</button><span id="recordState"></span></div></div>
<div class="card"><div class="section-title">Resultaat</div><div class="field"><label>Onderwerp</label><input id="subject" class="input"></div><div class="field"><label>Bericht</label><textarea id="body" class="textarea" style="min-height:220px"></textarea></div><div class="row"><button class="btn secondary small act" data-act="regenerate">Opnieuw</button><button class="btn secondary small act" data-act="shorter">Korter</button><button class="btn secondary small act" data-act="friendlier">Vriendelijker</button><button class="btn secondary small act" data-act="formal">Formeler</button><button class="btn secondary small act" data-act="informal">Informeler</button><button class="btn secondary small" id="copyMail">Kopiëren</button><button class="btn secondary small" id="adjustMailVoice">🎙️ Spreek in om aan te passen</button><button class="btn" id="openMail">Mail openen</button><span id="adjustMailState"></span></div></div>`;
const chatEl=root.querySelector('#chat'), prompt=root.querySelector('#mailPrompt'), subject=root.querySelector('#subject'), body=root.querySelector('#body');
function drawHistory(){chatEl.innerHTML=history.map(m=>`<div class="bubble ${m.role==='user'?'user':'ai'}">${esc(m.content)}</div>`).join('');chatEl.scrollTop=chatEl.scrollHeight}
function sync(){last={subject:subject.value,body:body.value}}
function setResult(data){last={subject:data.subject||'',body:data.body||data.text||''};subject.value=last.subject;body.value=last.body}
async function ask(text,action='compose'){if(!text.trim())return;history.push({role:'user',content:text.trim()});drawHistory();prompt.value='';try{root.querySelector('#sendMail').disabled=true;const data=await chat(history,action);history.push({role:'assistant',content:`${data.subject?data.subject+'\n\n':''}${data.body||data.text||''}`});setResult(data);drawHistory()}catch(e){toast(e.message)}finally{root.querySelector('#sendMail').disabled=false}}
root.querySelector('#sendMail').onclick=()=>ask(prompt.value);prompt.onkeydown=e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter')ask(prompt.value)};
root.querySelector('#newMail').onclick=()=>{history=[];last={subject:'',body:''};subject.value='';body.value='';drawHistory()};
root.querySelectorAll('.act').forEach(b=>b.onclick=async()=>{sync();if(!last.body)return toast('Maak eerst een mail.');await ask(`Pas deze e-mail aan. Onderwerp: ${last.subject}\n\n${last.body}`,b.dataset.act)});
root.querySelector('#copyMail').onclick=()=>{sync();copy(`${last.subject}\n\n${last.body}`)};
root.querySelector('#openMail').onclick=()=>{sync();mailto(settings.get('email',''),last.subject,last.body)};
root.querySelector('#adjustMailVoice').onclick=async()=>{
 const btn=root.querySelector('#adjustMailVoice'),state=root.querySelector('#adjustMailState');sync();
 if(!last.body)return toast('Maak eerst een mail.');
 if(!adjustRecorder){
   try{adjustRecorder=new Recorder(sec=>state.innerHTML=`<span class="recording"><span class="pulse"></span>${sec}s</span>`);await adjustRecorder.start();btn.textContent='Stop aanpassing'}
   catch(e){adjustRecorder=null;toast(e.message)}
 }else{
   const r=adjustRecorder;adjustRecorder=null;btn.textContent='🎙️ Spreek in om aan te passen';state.textContent='Transcriberen…';
   try{const blob=await r.stop();const t=await transcribe(blob);state.textContent='Mail aanpassen…';const data=await adjustMailByInstruction(last.subject,last.body,t.text);setResult(data);state.textContent=`Aangepast op: ${t.text}`}
   catch(e){state.textContent='';toast(e.message)}
 }
};

subject.oninput=sync;body.oninput=sync;
root.querySelector('#recordMail').onclick=async()=>{const btn=root.querySelector('#recordMail'),state=root.querySelector('#recordState');if(!recorder){try{recorder=new Recorder(s=>state.innerHTML=`<span class="recording"><span class="pulse"></span>${s}s</span>`);await recorder.start();btn.textContent='Stop opname'}catch(e){recorder=null;toast(e.message)}}else{const r=recorder;recorder=null;btn.textContent='🎙️ Spraak';state.textContent='Transcriberen…';try{const blob=await r.stop();const data=await transcribe(blob);state.textContent=`Je zei: ${data.text}`;await ask(data.text)}catch(e){state.textContent='';toast(e.message)}}};
}
