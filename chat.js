import {generalChat,transcribe,adjustText} from './api.js';
import {settings} from './storage.js';
import {esc,toast,mailto,copy} from './utils.js';
import {createTodo} from './planner-utils.js';
import {Recorder} from './recorder.js';

let history=[];
let recorder=null;
let adjustTarget=null;

function txtFile(name,text){
  return new File([String(text||'')],name,{type:'text/plain;charset=utf-8'});
}
async function shareTxt(text,index){
  const file=txtFile(`Meesterassistent antwoord ${index+1}.txt`,text);
  if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
    try{await navigator.share({title:'Meesterassistent',files:[file]});return}catch(e){if(e?.name==='AbortError')return}
  }
  const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function mailText(text,subject='Meesterassistent'){
  mailto(settings.get('email',''),subject,String(text||''));
}

export async function renderAIChat(root){
  root.classList.add('home-chat-page');
  root.innerHTML=`<div class="topbar home-chat-topbar"><div><div class="title">Meesterassistent</div><div class="subtitle">Typ of spreek. Elk AI-antwoord kun je apart mailen of delen.</div></div><button id="newChat" class="btn secondary small">Nieuwe chat</button></div>
  <div class="card ai-chat-card fullscreen-chat-card">
    <div id="aiChatHistory" class="chat home-chat"></div>
    <div id="chatSpeechState" class="muted" style="margin-bottom:8px"></div>
    <textarea id="chatInput" class="textarea chat-input" placeholder="Typ je bericht..."></textarea>
    <div class="row" style="margin-top:10px">
      <button id="sendChat" class="btn">Verstuur</button>
      <button id="recordChat" class="btn secondary">🎙️ Spraak</button>
      <button id="mailSelection" class="btn secondary small">Mail selectie</button>
      <span id="recordChatState"></span>
    </div>
  </div>`;
  const hist=root.querySelector('#aiChatHistory'),input=root.querySelector('#chatInput'),send=root.querySelector('#sendChat'),speech=root.querySelector('#chatSpeechState');

  function draw(){
    if(!history.length){
      hist.innerHTML=`<div class="chat-empty"><strong>Waar kan ik mee helpen?</strong><div class="muted">Je kunt typen of een spraakbericht sturen.</div></div>`;
    }else{
      hist.innerHTML=history.map((m,i)=>{
        const actions=m.role==='assistant'?`<div class="chat-answer-actions">
          <button class="btn secondary tiny" data-copy-answer="${i}">Kopieer</button>
          <button class="btn secondary tiny" data-mail-answer="${i}">Mail antwoord</button>
          <button class="btn secondary tiny" data-file-answer="${i}">Deel .txt</button>
          <button class="btn secondary tiny" data-adjust-answer="${i}">🎙️ Spreek aanpassing in</button><button class="btn secondary tiny" data-todo-answer="${i}">Naar To Do</button>
        </div>`:'';
        return `<div class="chat-message-wrap"><div class="bubble ${m.role==='user'?'user':'ai'}">${esc(m.content)}</div>${actions}</div>`;
      }).join('');
      hist.querySelectorAll('[data-copy-answer]').forEach(b=>b.onclick=()=>copy(history[+b.dataset.copyAnswer].content));
      hist.querySelectorAll('[data-mail-answer]').forEach(b=>b.onclick=()=>mailText(history[+b.dataset.mailAnswer].content,'Meesterassistent – antwoord'));
      hist.querySelectorAll('[data-file-answer]').forEach(b=>{b.onclick=()=>shareTxt(history[+b.dataset.fileAnswer].content,+b.dataset.fileAnswer)});
      hist.querySelectorAll('[data-todo-answer]').forEach(b=>b.onclick=async()=>{await createTodo(history[+b.dataset.todoAnswer].content,{folder:'today'});toast('Toegevoegd aan To Do vandaag')});
      hist.querySelectorAll('[data-adjust-answer]').forEach(b=>b.onclick=()=>startAdjust(+b.dataset.adjustAnswer,b));
    }
    hist.scrollTop=hist.scrollHeight;
  }

  async function ask(value){
    const q=String(value||'').trim();if(!q)return;
    history.push({role:'user',content:q});input.value='';draw();send.disabled=true;
    try{
      const data=await generalChat(history);
      history.push({role:'assistant',content:data.text});draw();
    }catch(e){toast(e.message)}
    finally{send.disabled=false}
  }

  async function startAdjust(index,button){
    if(recorder)return toast('Er loopt al een opname.');
    adjustTarget=index;
    try{
      recorder=new Recorder(sec=>root.querySelector('#recordChatState').innerHTML=`<span class="recording"><span class="pulse"></span>${sec}s</span>`);
      await recorder.start();
      button.textContent='Stop aanpassing';
      button.dataset.adjustRecording='1';
      const stop=async()=>{
        const r=recorder;recorder=null;button.textContent='🎙️ Spreek aanpassing in';delete button.dataset.adjustRecording;
        const st=root.querySelector('#recordChatState');st.textContent='Transcriberen…';
        try{
          const blob=await r.stop(),t=await transcribe(blob);
          st.textContent='AI past antwoord aan…';
          const result=await adjustText(history[adjustTarget].content,t.text,'AI-antwoord');
          history[adjustTarget].content=result.text;st.textContent=`Aangepast op: ${t.text}`;draw();
        }catch(e){st.textContent='';toast(e.message)}
        finally{adjustTarget=null}
      };
      button.onclick=stop;
    }catch(e){recorder=null;adjustTarget=null;toast(e.message)}
  }

  send.onclick=()=>ask(input.value);
  input.onkeydown=e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter')ask(input.value)};
  root.querySelector('#newChat').onclick=()=>{history=[];speech.textContent='';draw()};
  root.querySelector('#mailSelection').onclick=()=>{
    const selected=String(window.getSelection?.()||'').trim();
    if(!selected)return toast('Selecteer eerst een stukje tekst uit de chat.');
    mailText(selected,'Meesterassistent – geselecteerde tekst');
  };
  root.querySelector('#recordChat').onclick=async()=>{
    const btn=root.querySelector('#recordChat'),state=root.querySelector('#recordChatState');
    if(!recorder){
      try{recorder=new Recorder(sec=>state.innerHTML=`<span class="recording"><span class="pulse"></span>${sec}s</span>`);await recorder.start();btn.textContent='Stop opname'}
      catch(e){recorder=null;toast(e.message)}
    }else{
      const r=recorder;recorder=null;btn.textContent='🎙️ Spraak';state.textContent='Transcriberen…';
      try{const blob=await r.stop();const d=await transcribe(blob);speech.textContent=`Je zei: ${d.text}`;state.textContent='';await ask(d.text)}
      catch(e){state.textContent='';toast(e.message)}
    }
  };
  draw();
}
