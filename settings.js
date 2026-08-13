import {settings,exportData,importData,clearAll} from './storage.js';
import {testConnection} from './api.js';
import {parseNames,esc,download,toast} from './utils.js';
export async function renderSettings(root){
 let candidates=[...settings.get('classList',[])];
 root.innerHTML=`<div class="topbar"><div><div class="title">Instellingen</div><div class="subtitle">Alleen de belangrijkste app-instellingen.</div></div></div>
 <div class="card"><div class="section-title">Persoonlijk</div><div class="field"><label>Mijn e-mailadres</label><input id="email" class="input" type="email" value="${esc(settings.get('email',''))}" placeholder="jij@example.nl"></div><button id="savePersonal" class="btn">Opslaan</button></div>
 <div class="card"><div class="section-title">AI</div>
   <div class="field"><label>AI-provider</label>
     <div class="seg ai-provider">
       <button data-provider="openai">OpenAI</button>
       <button data-provider="gemini">Gemini</button>
     </div>
   </div>

   <div id="openaiSettings">
     <div class="field"><label>OpenAI API-key</label><div class="row"><input id="openaiKey" class="input grow" type="password" autocomplete="off" value="${esc(settings.get('openaiKey',''))}" placeholder="sk-..."><button id="toggleOpenAIKey" class="btn secondary small" type="button">Tonen</button></div></div>
   </div>

   <div id="geminiSettings" class="hidden">
     <div class="field"><label>Gemini API-key</label><div class="row"><input id="geminiKey" class="input grow" type="password" autocomplete="off" value="${esc(settings.get('geminiKey',''))}" placeholder="Google AI Studio API-key"><button id="toggleGeminiKey" class="btn secondary small" type="button">Tonen</button></div></div>
     <div class="field"><label>Gemini-model</label><input id="geminiModel" class="input" value="${esc(settings.get('geminiModel','gemini-2.5-flash'))}" placeholder="gemini-2.5-flash"></div>
   </div>

   <div id="aiStatus" class="status"><span class="dot"></span> Niet getest</div>
   <div class="row" style="margin-top:12px"><button id="saveAI" class="btn">AI-instellingen opslaan</button><button id="testAI" class="btn secondary">Verbinding testen</button><button id="deleteAI" class="btn danger small">Actieve key verwijderen</button></div>
   <p class="muted">De gekozen API-key wordt alleen lokaal op dit apparaat bewaard. Gemini kan een gratis API-tier hebben binnen de actuele Google-limieten. OpenAI en Gemini zijn losse diensten.</p>
 </div>
 <div class="card"><div class="section-title">Klassenlijst</div><div class="field"><label>Handmatig of tekst plakken</label><textarea id="classText" class="textarea" placeholder="Eén leerling per regel"></textarea></div><div class="field"><label>Of upload PDF</label><input id="pdfFile" class="input" type="file" accept="application/pdf"></div><div class="row"><button id="readNames" class="btn secondary">Haal namen uit tekst</button><button id="readPdf" class="btn secondary">Lees PDF</button></div><div class="section-title" style="margin-top:18px">Herkende leerlingen</div><div id="nameEditor" class="list"></div><div class="row" style="margin-top:10px"><button id="addName" class="btn secondary small">Naam toevoegen</button><button id="saveClass" class="btn">Klassenlijst opslaan</button><button id="clearClass" class="btn danger small">Wissen</button></div></div>
 <div class="card"><div class="section-title">Back-up</div><div class="row"><button id="exportData" class="btn secondary">Exporteer gegevens</button><label class="btn secondary">Importeer gegevens<input id="importData" type="file" accept="application/json" hidden></label><button id="deleteAll" class="btn danger">Alle lokale gegevens verwijderen</button></div></div>`;
 const editor=root.querySelector('#nameEditor');
 function drawNames(){editor.innerHTML=candidates.length?candidates.map((n,i)=>`<div class="item row"><input class="input grow" data-name-index="${i}" value="${esc(n)}"><button class="icon-btn danger-text" data-remove-index="${i}">×</button></div>`).join(''):'<div class="muted">Nog geen namen herkend.</div>';editor.querySelectorAll('[data-name-index]').forEach(i=>i.onchange=()=>candidates[+i.dataset.nameIndex]=i.value.trim());editor.querySelectorAll('[data-remove-index]').forEach(b=>b.onclick=()=>{candidates.splice(+b.dataset.removeIndex,1);drawNames()})}drawNames();
 root.querySelector('#savePersonal').onclick=()=>{settings.set('email',root.querySelector('#email').value.trim());toast('E-mailadres opgeslagen')};
 const openaiKeyInput=root.querySelector('#openaiKey');
 const geminiKeyInput=root.querySelector('#geminiKey');
 const geminiModelInput=root.querySelector('#geminiModel');
 let aiProvider=settings.get('aiProvider','openai');

 function drawProvider(){
   root.querySelectorAll('[data-provider]').forEach(b=>b.classList.toggle('active',b.dataset.provider===aiProvider));
   root.querySelector('#openaiSettings').classList.toggle('hidden',aiProvider!=='openai');
   root.querySelector('#geminiSettings').classList.toggle('hidden',aiProvider!=='gemini');
   root.querySelector('#aiStatus').innerHTML='<span class="dot"></span> Niet getest';
 }
 root.querySelectorAll('[data-provider]').forEach(b=>b.onclick=()=>{aiProvider=b.dataset.provider;settings.set('aiProvider',aiProvider);drawProvider()});
 drawProvider();

 root.querySelector('#saveAI').onclick=()=>{
   settings.set('aiProvider',aiProvider);
   settings.set('openaiKey',openaiKeyInput.value.trim());
   settings.set('geminiKey',geminiKeyInput.value.trim());
   settings.set('geminiModel',geminiModelInput.value.trim()||'gemini-2.5-flash');
   toast(`${aiProvider==='gemini'?'Gemini':'OpenAI'}-instellingen lokaal opgeslagen`);
 };

 root.querySelector('#toggleOpenAIKey').onclick=()=>{
   const show=openaiKeyInput.type==='password';openaiKeyInput.type=show?'text':'password';
   root.querySelector('#toggleOpenAIKey').textContent=show?'Verbergen':'Tonen';
 };
 root.querySelector('#toggleGeminiKey').onclick=()=>{
   const show=geminiKeyInput.type==='password';geminiKeyInput.type=show?'text':'password';
   root.querySelector('#toggleGeminiKey').textContent=show?'Verbergen':'Tonen';
 };

 root.querySelector('#deleteAI').onclick=()=>{
   const label=aiProvider==='gemini'?'Gemini':'OpenAI';
   if(confirm(`${label} API-key van dit apparaat verwijderen?`)){
     if(aiProvider==='gemini'){settings.remove('geminiKey');geminiKeyInput.value=''}
     else{settings.remove('openaiKey');openaiKeyInput.value=''}
     root.querySelector('#aiStatus').innerHTML='<span class="dot"></span> Niet verbonden';
     toast(`${label} API-key verwijderd`);
   }
 };

 root.querySelector('#testAI').onclick=async()=>{
   settings.set('aiProvider',aiProvider);
   settings.set('openaiKey',openaiKeyInput.value.trim());
   settings.set('geminiKey',geminiKeyInput.value.trim());
   settings.set('geminiModel',geminiModelInput.value.trim()||'gemini-2.5-flash');
   const st=root.querySelector('#aiStatus');
   try{
     st.innerHTML='<span class="dot"></span> Verbinding testen…';
     const r=await testConnection();
     if(r.credit===false){
       st.innerHTML=`<span class="dot ok"></span> API-key geldig<br><small>${esc(r.warning)}</small>`;
       toast('API-key is geldig, maar er is geen API-tegoed beschikbaar.');
     }else{
       const label=r.provider==='gemini'?'Gemini':'OpenAI';
       st.innerHTML=`<span class="dot ok"></span> ${label} verbonden · ${esc(r.model||'')}`;
       toast(`${label}-verbinding werkt`);
     }
   }catch(e){
     st.innerHTML=`<span class="dot"></span> Niet verbonden<br><small>${esc(e.message)}</small>`;
     toast(e.message);
   }
 };
 root.querySelector('#readNames').onclick=()=>{candidates=parseNames(root.querySelector('#classText').value);drawNames()};
 root.querySelector('#addName').onclick=()=>{candidates.push('Nieuwe leerling');drawNames()};
 root.querySelector('#saveClass').onclick=()=>{candidates=[...new Set(candidates.map(x=>x.trim()).filter(Boolean))];settings.set('classList',candidates);toast(`${candidates.length} leerlingen opgeslagen`);drawNames()};
 root.querySelector('#clearClass').onclick=()=>{if(confirm('Klassenlijst wissen?')){candidates=[];settings.set('classList',[]);drawNames()}};
 root.querySelector('#readPdf').onclick=async()=>{const f=root.querySelector('#pdfFile').files[0];if(!f)return toast('Kies eerst een PDF.');try{toast('PDF wordt gelezen…');const pdfjs=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';const pdf=await pdfjs.getDocument({data:await f.arrayBuffer()}).promise;let txt='';for(let p=1;p<=pdf.numPages;p++){const pg=await pdf.getPage(p),content=await pg.getTextContent();txt+=content.items.map(i=>i.str).join('\n')+'\n'}candidates=parseNames(txt);drawNames();toast(`${candidates.length} mogelijke namen gevonden`)}catch(e){toast('PDF kon niet worden gelezen. Probeer tekst te plakken.')}};
 settings.set('theme','light');
 document.documentElement.dataset.theme='light';
 root.querySelector('#exportData').onclick=async()=>download(`meester-martijn-export-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(await exportData(),null,2));
 root.querySelector('#importData').onchange=async e=>{try{await importData(JSON.parse(await e.target.files[0].text()));toast('Gegevens geïmporteerd')}catch(err){toast(err.message)}};
 root.querySelector('#deleteAll').onclick=async()=>{if(confirm('Echt ALLE lokale gegevens uit de app verwijderen?')){await clearAll();Object.keys(localStorage).filter(k=>k.startsWith('sa:')).forEach(k=>localStorage.removeItem(k));location.reload()}};
}
