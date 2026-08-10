import {settings} from './storage.js';
const OPENAI_BASE='https://api.openai.com/v1';
const DEFAULT_TEXT_MODEL='gpt-5.4-mini';
const DEFAULT_TRANSCRIBE_MODEL='gpt-4o-mini-transcribe';
function apiKey(){return String(settings.get('openaiKey','')).trim()}
function textModel(){return String(settings.get('openaiModel',DEFAULT_TEXT_MODEL)).trim()||DEFAULT_TEXT_MODEL}
function requireKey(){const key=apiKey();if(!key)throw new Error('Vul eerst je OpenAI API-key in bij Instellingen.');return key}

async function openai(path,options={}){
 const key=requireKey(),headers=new Headers(options.headers||{});headers.set('Authorization',`Bearer ${key}`);
 const response=await fetch(`${OPENAI_BASE}${path}`,{...options,headers});
 const data=await response.json().catch(()=>({}));
 if(!response.ok){
   const err=data?.error||{},msg=typeof err?.message==='string'?err.message:`OpenAI gaf foutcode ${response.status}.`,code=err?.code||err?.type||'';
   const e=new Error(msg);e.status=response.status;e.code=code;e.openaiMessage=msg;
   if(response.status===401)e.message='De OpenAI API-key wordt niet geaccepteerd.';
   else if(response.status===429&&['credit_balance_exhausted','insufficient_quota'].includes(code))e.message='API-key geldig, maar OpenAI meldt dat er geen API-tegoed beschikbaar is voor dit account/project.';
   else if(response.status===429&&code==='rate_limit_exceeded')e.message='Te veel API-verzoeken in korte tijd. Probeer het over een moment opnieuw.';
   else e.message=`OpenAI-fout ${response.status}${code?` · ${code}`:''}: ${msg}`;
   throw e;
 }
 return data;
}
function assistantText(data){return data?.choices?.[0]?.message?.content?.trim?.()||''}
function stripMailClosing(body){
  return String(body||'').replace(/\n\s*(?:met\s+vriendelijke\s+groet(?:en)?|vriendelijke\s+groet(?:en)?|hartelijke\s+groet(?:en)?|groet(?:en)?|mvg)[,!.]?\s*(?:\n[\s\S]*)?$/i,'').trim();
}
function parseMail(text){const cleaned=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');try{const obj=JSON.parse(cleaned);return {subject:String(obj.subject||obj.onderwerp||'').trim(),body:stripMailClosing(String(obj.body||obj.bericht||obj.text||'').trim())}}catch{}const subjectMatch=cleaned.match(/(?:^|\n)\s*(?:onderwerp|subject)\s*:\s*(.+)/i);return {subject:subjectMatch?.[1]?.trim()||'Bericht',body:stripMailClosing(cleaned.replace(/(?:^|\n)\s*(?:onderwerp|subject)\s*:\s*.+\n?/i,'').trim())}}
const mailInstructions=`Je helpt een Nederlandse basisschoolleerkracht met e-mails. Schrijf vriendelijk, duidelijk, professioneel, niet overdreven formeel en bondig. Corrigeer grammatica vanzelf. Voeg NOOIT een ondertekening, naam, groet of afsluiting toe; dus ook geen "Met vriendelijke groet", "Groet", "Hartelijke groet" of vergelijkbare slotregel. Eindig direct na de inhoud van de mail. Geef uitsluitend geldige JSON terug in deze vorm: {"subject":"...","body":"..."}. Gebruik geen markdown of codeblokken.`;

export async function testConnection(){
 try{
   const data=await openai('/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:textModel(),messages:[{role:'user',content:'Antwoord uitsluitend met: OK'}],max_completion_tokens:8})});
   return {ok:Boolean(assistantText(data)),model:textModel(),credit:true};
 }catch(e){
   if(e.status===429&&['credit_balance_exhausted','insufficient_quota'].includes(e.code))return {ok:true,model:textModel(),credit:false,warning:e.message};
   throw e;
 }
}
export async function chat(messages,action='compose'){const actions={compose:'Stel op basis van het gesprek een complete direct bruikbare e-mail op.',regenerate:'Maak een nieuwe goede versie van de e-mail.',shorter:'Maak de e-mail duidelijk korter zonder belangrijke informatie te verliezen.',friendlier:'Maak de e-mail iets warmer en vriendelijker, maar natuurlijk.',formal:'Maak de e-mail formeler en professioneel.',informal:'Maak de e-mail informeler en natuurlijker, zonder slordig te worden.'};const apiMessages=[{role:'system',content:mailInstructions},...messages.map(m=>({role:m.role==='assistant'?'assistant':'user',content:String(m.content||'')})),{role:'user',content:actions[action]||actions.compose}];const data=await openai('/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:textModel(),messages:apiMessages,response_format:{type:'json_object'}})});const result=parseMail(assistantText(data));if(!result.body)throw new Error('OpenAI gaf geen bruikbare e-mail terug. Probeer het opnieuw.');return result}

export async function generalChat(messages){
  const apiMessages=[
    {role:'system',content:'Je bent de persoonlijke AI-assistent in de Meester Martijn App. Antwoord in natuurlijk Nederlands, behulpzaam en duidelijk. Houd antwoorden compact tenzij meer uitleg nuttig is. Je bent een gewone algemene chatassistent.'},
    ...messages.map(m=>({role:m.role==='assistant'?'assistant':'user',content:String(m.content||'')}))
  ];
  const data=await openai('/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:textModel(),messages:apiMessages})});
  const out=assistantText(data);
  if(!out)throw new Error('OpenAI gaf geen antwoord terug.');
  return {text:out};
}

export async function summarizeReflection(text){const data=await openai('/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:textModel(),messages:[{role:'system',content:'Vat een lesreflectie van een Nederlandse basisschoolleerkracht kort en praktisch samen. Gebruik precies deze kopjes: Wat ging goed:, Wat kan beter:, Volgende keer:. Houd ieder onderdeel kort en concreet. Geen inleiding.'},{role:'user',content:String(text||'')} ]})});const out=assistantText(data);if(!out)throw new Error('OpenAI gaf geen samenvatting terug.');return {text:out}}

export async function summarizeNote(text){const data=await openai('/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:textModel(),messages:[{role:'system',content:'Maak van deze Nederlandse gesproken of getypte notitie een korte, duidelijke en bruikbare samenvatting. Behoud belangrijke namen, afspraken, data en actiepunten. Geen inleiding en geen ondertekening.'},{role:'user',content:String(text||'')} ]})});const out=assistantText(data);if(!out)throw new Error('OpenAI gaf geen samenvatting terug.');return {text:out}}
export async function transcribe(blob){if(!blob)throw new Error('Geen audio-opname gevonden.');const type=blob.type||'audio/webm',ext=type.includes('mp4')?'m4a':type.includes('wav')?'wav':type.includes('ogg')?'ogg':'webm',fd=new FormData();fd.append('file',blob,`opname.${ext}`);fd.append('model',DEFAULT_TRANSCRIBE_MODEL);fd.append('language','nl');return openai('/audio/transcriptions',{method:'POST',body:fd})}
