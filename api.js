import {settings} from './storage.js';

const OPENAI_BASE='https://api.openai.com/v1';
const DEFAULT_TEXT_MODEL='gpt-5.4-mini';
const DEFAULT_TRANSCRIBE_MODEL='gpt-4o-mini-transcribe';

function apiKey(){return String(settings.get('openaiKey','')).trim()}
function textModel(){return String(settings.get('openaiModel',DEFAULT_TEXT_MODEL)).trim()||DEFAULT_TEXT_MODEL}
function requireKey(){const key=apiKey();if(!key)throw new Error('Vul eerst je OpenAI API-key in bij Instellingen.');return key}

async function openai(path,options={}){
  const key=requireKey();
  const headers=new Headers(options.headers||{});
  headers.set('Authorization',`Bearer ${key}`);
  const response=await fetch(`${OPENAI_BASE}${path}`,{...options,headers});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    const err=data?.error||{};
    const msg=typeof err?.message==='string'?err.message:(typeof err==='string'?err:`OpenAI gaf foutcode ${response.status}.`);
    const code=err?.code||err?.type||'';
    if(response.status===401)throw new Error(`API-key geweigerd (401): ${msg}`);
    if(response.status===429){
      if(code==='insufficient_quota') throw new Error(`OpenAI meldt onvoldoende API-tegoed/projectquotum (429 · ${code}): ${msg}`);
      if(code==='rate_limit_exceeded') throw new Error(`Te veel API-verzoeken in korte tijd (429 · ${code}): ${msg}`);
      throw new Error(`OpenAI-fout 429${code?` · ${code}`:''}: ${msg}`);
    }
    throw new Error(`OpenAI-fout ${response.status}${code?` · ${code}`:''}: ${msg}`);
  }
  return data;
}

function assistantText(data){return data?.choices?.[0]?.message?.content?.trim?.()||''}
function parseMail(text){
  const cleaned=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  try{
    const obj=JSON.parse(cleaned);
    return {subject:String(obj.subject||obj.onderwerp||'').trim(),body:String(obj.body||obj.bericht||obj.text||'').trim()};
  }catch{}
  const subjectMatch=cleaned.match(/(?:^|\n)\s*(?:onderwerp|subject)\s*:\s*(.+)/i);
  let body=cleaned.replace(/(?:^|\n)\s*(?:onderwerp|subject)\s*:\s*.+\n?/i,'').trim();
  return {subject:subjectMatch?.[1]?.trim()||'Bericht',body};
}

const mailInstructions=`Je helpt een Nederlandse basisschoolleerkracht met e-mails. Schrijf vriendelijk, duidelijk, professioneel, niet overdreven formeel en bondig. Corrigeer grammatica vanzelf. Geef uitsluitend geldige JSON terug in deze vorm: {"subject":"...","body":"..."}. Gebruik geen markdown of codeblokken.`;

export async function testConnection(){
  const data=await openai('/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      model:textModel(),
      messages:[{role:'user',content:'Antwoord uitsluitend met: OK'}],
      max_completion_tokens:8
    })
  });
  return {ok:Boolean(assistantText(data)),model:textModel()};
}

export async function chat(messages,action='compose'){
  const actionInstructions={
    compose:'Stel op basis van het gesprek een complete direct bruikbare e-mail op.',
    regenerate:'Maak een nieuwe goede versie van de e-mail.',
    shorter:'Maak de e-mail duidelijk korter zonder belangrijke informatie te verliezen.',
    friendlier:'Maak de e-mail iets warmer en vriendelijker, maar natuurlijk.',
    formal:'Maak de e-mail formeler en professioneel.',
    informal:'Maak de e-mail informeler en natuurlijker, zonder slordig te worden.'
  };
  const apiMessages=[
    {role:'system',content:mailInstructions},
    ...messages.map(m=>({role:m.role==='assistant'?'assistant':'user',content:String(m.content||'')})),
    {role:'user',content:actionInstructions[action]||actionInstructions.compose}
  ];
  const data=await openai('/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({model:textModel(),messages:apiMessages,response_format:{type:'json_object'}})
  });
  const result=parseMail(assistantText(data));
  if(!result.body)throw new Error('OpenAI gaf geen bruikbare e-mail terug. Probeer het opnieuw.');
  return result;
}

export async function summarizeReflection(text){
  const data=await openai('/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      model:textModel(),
      messages:[
        {role:'system',content:'Vat een lesreflectie van een Nederlandse basisschoolleerkracht kort en praktisch samen. Gebruik precies deze kopjes: Wat ging goed:, Wat kan beter:, Volgende keer:. Houd ieder onderdeel kort en concreet. Geen inleiding.'},
        {role:'user',content:String(text||'')}
      ]
    })
  });
  const out=assistantText(data);
  if(!out)throw new Error('OpenAI gaf geen samenvatting terug.');
  return {text:out};
}

export async function transcribe(blob){
  if(!blob)throw new Error('Geen audio-opname gevonden.');
  const type=blob.type||'audio/webm';
  const ext=type.includes('mp4')?'m4a':type.includes('wav')?'wav':type.includes('ogg')?'ogg':'webm';
  const fd=new FormData();
  fd.append('file',blob,`opname.${ext}`);
  fd.append('model',DEFAULT_TRANSCRIBE_MODEL);
  fd.append('language','nl');
  return openai('/audio/transcriptions',{method:'POST',body:fd});
}
