import {settings} from './storage.js';
function base(){return String(settings.get('backend','')).replace(/\/$/,'')}
async function request(path,opts={}){if(!base())throw new Error('Vul eerst je backend-URL in bij Instellingen.');const r=await fetch(base()+path,opts);const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Er ging iets mis met de AI-verbinding.');return data}
export const testConnection=()=>request('/health');
export const chat=async(messages,action='compose')=>request('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages,action})});
export const summarizeReflection=async(text)=>request('/summarize-reflection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
export const transcribe=async(blob)=>{const fd=new FormData();fd.append('file',blob,'opname.webm');return request('/transcribe',{method:'POST',body:fd})};
