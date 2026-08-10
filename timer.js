import {toast} from './utils.js';
let interval=null, remaining=300, running=false;

export async function renderTimer(root){
  if(interval){clearInterval(interval);interval=null;running=false}
  root.innerHTML=`<div class="topbar"><div><div class="title">Timer</div><div class="subtitle">Een eenvoudige grote klassikale timer.</div></div></div>
  <div class="card timer-card">
    <div id="timerDisplay" class="timer-display">05:00</div>
    <div class="timer-presets">
      <button class="btn secondary small" data-min="1">1 min</button>
      <button class="btn secondary small" data-min="5">5 min</button>
      <button class="btn secondary small" data-min="10">10 min</button>
      <button class="btn secondary small" data-min="15">15 min</button>
      <button class="btn secondary small" data-min="30">30 min</button>
    </div>
    <div class="field"><label>Eigen tijd (minuten)</label><input id="customMinutes" class="input" type="number" inputmode="numeric" min="1" max="180" placeholder="Bijv. 7"></div>
    <div class="row"><button id="timerStart" class="btn">Start</button><button id="timerReset" class="btn secondary">Reset</button></div>
  </div>`;
  const display=root.querySelector('#timerDisplay'),start=root.querySelector('#timerStart'),custom=root.querySelector('#customMinutes');
  function draw(){const m=Math.floor(remaining/60),s=remaining%60;display.textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;}
  function setTime(sec){if(interval)clearInterval(interval);interval=null;running=false;remaining=sec;start.textContent='Start';draw();}
  root.querySelectorAll('[data-min]').forEach(b=>b.onclick=()=>setTime(Number(b.dataset.min)*60));
  custom.onchange=()=>{const m=Math.max(1,Math.min(180,Number(custom.value)||5));setTime(Math.round(m*60));};
  start.onclick=()=>{
    if(running){clearInterval(interval);interval=null;running=false;start.textContent='Verder';return}
    if(remaining<=0)return toast('Stel eerst een nieuwe tijd in.');
    running=true;start.textContent='Pauze';
    interval=setInterval(()=>{
      remaining--;draw();
      if(remaining<=0){
        clearInterval(interval);interval=null;running=false;start.textContent='Start';
        try{navigator.vibrate?.([200,100,200])}catch{}
        toast('De tijd is om!');
      }
    },1000);
  };
  root.querySelector('#timerReset').onclick=()=>setTime(300);
  draw();
}
