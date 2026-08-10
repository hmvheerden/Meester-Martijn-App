import {generalChat,transcribe} from './api.js';
import {esc,toast} from './utils.js';
import {Recorder} from './recorder.js';

let history=[];
let recorder=null;

export async function renderAIChat(root){
  root.classList.add('home-chat-page');
  root.innerHTML=`<div class="topbar home-chat-topbar"><div><div class="title">Meesterassistent</div><div class="subtitle">Typ of spreek. Het gesprek blijft bewaard zolang de app open is.</div></div><button id="newChat" class="btn secondary small">Nieuwe chat</button></div>
  <div class="card ai-chat-card fullscreen-chat-card">
    <div id="aiChatHistory" class="chat home-chat"></div>
    <div id="chatSpeechState" class="muted" style="margin-bottom:8px"></div>
    <textarea id="chatInput" class="textarea chat-input" placeholder="Typ je bericht..."></textarea>
    <div class="row" style="margin-top:10px">
      <button id="sendChat" class="btn">Verstuur</button>
      <button id="recordChat" class="btn secondary">🎙️ Spraak</button>
      <span id="recordChatState"></span>
    </div>
  </div>`;
  const hist=root.querySelector('#aiChatHistory'),input=root.querySelector('#chatInput'),send=root.querySelector('#sendChat'),speech=root.querySelector('#chatSpeechState');
  function draw(){
    hist.innerHTML=history.length?history.map(m=>`<div class="bubble ${m.role==='user'?'user':'ai'}">${esc(m.content)}</div>`).join(''):`<div class="chat-empty"><strong>Waar kan ik mee helpen?</strong><div class="muted">Je kunt typen of een spraakbericht sturen.</div></div>`;
    hist.scrollTop=hist.scrollHeight;
  }
  async function ask(value){
    const q=String(value||'').trim(); if(!q)return;
    history.push({role:'user',content:q}); input.value=''; draw(); send.disabled=true;
    try{
      const data=await generalChat(history);
      history.push({role:'assistant',content:data.text}); draw();
    }catch(e){toast(e.message)}
    finally{send.disabled=false}
  }
  send.onclick=()=>ask(input.value);
  input.onkeydown=e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter')ask(input.value)};
  root.querySelector('#newChat').onclick=()=>{history=[];speech.textContent='';draw()};
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
