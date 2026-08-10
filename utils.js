export const uid=()=>crypto.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
export const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
export const fmt=d=>new Intl.DateTimeFormat('nl-NL',{dateStyle:'medium',timeStyle:'short'}).format(new Date(d));
export function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2200)}
export function mailto(email,subject,body){location.href=`mailto:${encodeURIComponent(email||'')}?subject=${encodeURIComponent(subject||'')}&body=${encodeURIComponent(body||'')}`}
export function download(name,text,type='application/json'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
export function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
export function parseNames(text){const stop=/^(naam|namen|leerling|leerlingen|klas|groep|voornaam|achternaam|nummer|nr|geboortedatum|pagina|school)$/i;const lines=text.split(/\r?\n|;|,/).map(x=>x.trim()).filter(Boolean);const out=[];for(let line of lines){line=line.replace(/^\d+[.)\-\s]+/,'').trim();if(!line||stop.test(line)||/^\d+$/.test(line))continue;const parts=line.split(/\s+/);let first=parts[0]?.replace(/[^\p{L}'’-]/gu,'');if(first&&first.length>1&&!stop.test(first)&&!out.some(x=>x.toLowerCase()===first.toLowerCase()))out.push(first)}return out}
export async function copy(text){await navigator.clipboard.writeText(text);toast('Gekopieerd')}
