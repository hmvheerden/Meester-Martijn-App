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


export async function makeTodoFromSpeech(text){
  const system=`Maak van gesproken Nederlandse tekst precies één kort, duidelijk en uitvoerbaar To Do-punt voor een basisschoolleerkracht.

Regels:
- Geef alleen het uiteindelijke To Do-punt terug, zonder inleiding, bullets, aanhalingstekens of uitleg.
- Schrijf als een concrete actie, liefst beginnend met een werkwoord.
- Verwijder stopwoorden, herhalingen en spreektaal.
- Behoud relevante namen, data, tijden, vakken en details.
- Let extra goed op expliciete aanwijzingen over schrijfwijze en spelling.
- Voorbeelden van zulke aanwijzingen: "met lange ij", "met korte ei", "dubbele d", "met ck", "met een streepje", "hoofdletter", "schrijf je als...", of een woord dat letter voor letter wordt gespeld.
- Als de spreker een schrijfwijze expliciet verduidelijkt, pas die verduidelijking toe in het uiteindelijke woord en laat de uitleg over de spelling zelf weg tenzij die inhoudelijk nodig is.
- Verzin niets dat niet uit de gesproken tekst volgt.
- Houd het compact maar volledig.`;
  const data=await openai('/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      model:textModel(),
      messages:[
        {role:'system',content:system},
        {role:'user',content:String(text||'')}
      ]
    })
  });
  const out=assistantText(data).replace(/^[-•]\s*/,'').replace(/^["“]|["”]$/g,'').trim();
  if(!out)throw new Error('OpenAI gaf geen bruikbaar To Do-punt terug.');
  return {text:out};
}

export async function summarizeFeedback(text,student=''){
  const data=await openai('/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:textModel(),messages:[
    {role:'system',content:'Vat feedback van een Nederlandse basisschoolleerkracht kort, feitelijk en professioneel samen. Behoud concrete observaties en eventuele vervolgactie. Schrijf geen begroeting, afsluiting of ondertekening. Formuleer geschikt om later in een e-mail te gebruiken.'},
    {role:'user',content:`Leerling: ${student||'niet gekozen'}\nFeedback: ${String(text||'')}`}
  ]})});
  const out=assistantText(data);
  if(!out)throw new Error('OpenAI gaf geen samenvatting terug.');
  return {text:out};
}

export async function summarizeReflection(text,mode='lesson'){
  const system=mode==='day'
    ? 'Vat een dagreflectie van een Nederlandse basisschoolleerkracht kort en praktisch samen. Gebruik precies deze kopjes: Wat ging goed vandaag:, Wat vroeg aandacht:, Belangrijk voor morgen:. Houd ieder onderdeel kort en concreet. Geen inleiding.'
    : 'Vat een lesreflectie van een Nederlandse basisschoolleerkracht kort en praktisch samen. Gebruik precies deze kopjes: Wat ging goed:, Wat kan beter:, Volgende keer:. Houd ieder onderdeel kort en concreet. Geen inleiding.';
  const data=await openai('/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:textModel(),messages:[{role:'system',content:system},{role:'user',content:String(text||'')}]})});
  const out=assistantText(data);
  if(!out)throw new Error('OpenAI gaf geen samenvatting terug.');
  return {text:out};
}

export async function summarizeNote(text){const data=await openai('/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:textModel(),messages:[{role:'system',content:'Maak van deze Nederlandse gesproken of getypte notitie een korte, duidelijke en bruikbare samenvatting. Behoud belangrijke namen, afspraken, data en actiepunten. Geen inleiding en geen ondertekening.'},{role:'user',content:String(text||'')} ]})});const out=assistantText(data);if(!out)throw new Error('OpenAI gaf geen samenvatting terug.');return {text:out}}
export async function transcribe(blob){if(!blob)throw new Error('Geen audio-opname gevonden.');const type=blob.type||'audio/webm',ext=type.includes('mp4')?'m4a':type.includes('wav')?'wav':type.includes('ogg')?'ogg':'webm',fd=new FormData();fd.append('file',blob,`opname.${ext}`);fd.append('model',DEFAULT_TRANSCRIBE_MODEL);fd.append('language','nl');return openai('/audio/transcriptions',{method:'POST',body:fd})}


export async function parseCalendarEvent(text,context={}){
  const now=String(context.now||new Date().toISOString());
  const timezone=String(context.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Amsterdam');
  const system=`Je zet een Nederlandse gesproken of getypte agenda-opdracht om in één agenda-item.
Huidige datum/tijd: ${now}
Tijdzone: ${timezone}
Interpreteer woorden als vandaag, morgen, overmorgen, volgende maandag enzovoort op basis van deze datum.

Belangrijke regels:
- Als de gebruiker GEEN tijd noemt: gebruik 08:00 als begintijd.
- Als de gebruiker WEL een tijd noemt maar GEEN duur of eindtijd: gebruik 15 minuten duur.
- Als de gebruiker een duur noemt, bijvoorbeeld "half uur", "30 minuten", "een uur", gebruik die duur.
- Als de gebruiker een expliciete eindtijd noemt, gebruik die eindtijd.
- Gebruik allDay alleen als de gebruiker letterlijk duidelijk maakt dat het om de hele dag gaat.
- Verzin geen locatie of notities die niet genoemd zijn.

Geef uitsluitend geldige JSON terug:
{"title":"...","date":"YYYY-MM-DD","startTime":"HH:MM","endTime":"HH:MM","allDay":false,"location":"","notes":"","timeMentioned":true,"durationMentioned":false}`;

  const data=await openai('/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    model:textModel(),
    messages:[{role:'system',content:system},{role:'user',content:String(text||'')}],
    response_format:{type:'json_object'}
  })});
  const raw=assistantText(data).replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  let obj;
  try{obj=JSON.parse(raw)}catch{throw new Error('AI kon hier geen geldig agenda-item van maken.')}

  function addMinutes(time,mins){
    const [h,m]=String(time||'08:00').split(':').map(Number);
    const d=new Date(2000,0,1,h||0,m||0);
    d.setMinutes(d.getMinutes()+mins);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  const allDay=Boolean(obj.allDay);
  let startTime=String(obj.startTime||'').trim();
  let endTime=String(obj.endTime||'').trim();
  const timeMentioned=Boolean(obj.timeMentioned);

  if(!allDay){
    if(!timeMentioned || !startTime) startTime='08:00';
    if(!endTime) endTime=addMinutes(startTime,15);
  }

  return {
    title:String(obj.title||'').trim(),
    date:String(obj.date||'').trim(),
    startTime,
    endTime,
    allDay,
    location:String(obj.location||'').trim(),
    notes:String(obj.notes||'').trim()
  };
}
