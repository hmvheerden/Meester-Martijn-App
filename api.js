import {settings} from './storage.js';

const OPENAI_BASE='https://api.openai.com/v1';
const GEMINI_BASE='https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_TEXT_MODEL='gpt-5.4-mini';
const DEFAULT_TRANSCRIBE_MODEL='gpt-4o-mini-transcribe';
const DEFAULT_GEMINI_MODEL='gemini-2.5-flash';

function provider(){return String(settings.get('aiProvider','openai')||'openai')}
function apiKey(){return String(settings.get('openaiKey','')).trim()}
function geminiKey(){return String(settings.get('geminiKey','')).trim()}
function textModel(){return String(settings.get('openaiModel',DEFAULT_TEXT_MODEL)).trim()||DEFAULT_TEXT_MODEL}
function geminiModel(){return String(settings.get('geminiModel',DEFAULT_GEMINI_MODEL)).trim()||DEFAULT_GEMINI_MODEL}
function activeModel(){return provider()==='gemini'?geminiModel():textModel()}

function requireOpenAIKey(){
  const key=apiKey();if(!key)throw new Error('Vul eerst je OpenAI API-key in bij Instellingen.');return key;
}
function requireGeminiKey(){
  const key=geminiKey();if(!key)throw new Error('Vul eerst je Gemini API-key in bij Instellingen.');return key;
}
function bytesToBase64(bytes){
  let out='',chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk)out+=String.fromCharCode(...bytes.subarray(i,i+chunk));
  return btoa(out);
}
function geminiText(data){
  return (data?.candidates?.[0]?.content?.parts||[]).map(p=>p?.text||'').join('').trim();
}
function toGeminiContents(messages=[]){
  const system=[];
  const contents=[];
  for(const m of messages){
    if(m.role==='system'){system.push(String(m.content||''));continue}
    const role=m.role==='assistant'?'model':'user';
    const text=String(m.content||'');
    if(contents.length&&contents[contents.length-1].role===role){
      contents[contents.length-1].parts.push({text});
    }else contents.push({role,parts:[{text}]});
  }
  return {system:system.join('\n\n'),contents};
}
async function geminiGenerate({messages=[],json=false}={}){
  const key=requireGeminiKey(),model=geminiModel();
  const {system,contents}=toGeminiContents(messages);
  const body={contents:contents.length?contents:[{role:'user',parts:[{text:'Antwoord met OK'}]}]};
  if(system)body.systemInstruction={parts:[{text:system}]};
  if(json)body.generationConfig={responseMimeType:'application/json'};
  const response=await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`,{
    method:'POST',
    headers:{'Content-Type':'application/json','x-goog-api-key':key},
    body:JSON.stringify(body)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    const msg=data?.error?.message||`Gemini gaf foutcode ${response.status}.`;
    const e=new Error(`Gemini-fout ${response.status}: ${msg}`);e.status=response.status;throw e;
  }
  const text=geminiText(data);
  if(!text)throw new Error('Gemini gaf geen tekst terug.');
  return {choices:[{message:{content:text}}],_provider:'gemini',_model:model};
}
async function geminiTranscribe(formData){
  const key=requireGeminiKey(),model=geminiModel();
  const file=formData?.get?.('file');
  if(!file||typeof file.arrayBuffer!=='function')throw new Error('Geen audio-opname gevonden.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(bytes.byteLength>20*1024*1024)throw new Error('De audio-opname is te groot voor directe Gemini-transcriptie.');
  const mime=file.type||'audio/webm';
  const body={
    contents:[{role:'user',parts:[
      {text:'Transcribeer deze Nederlandse spraakopname nauwkeurig. Geef uitsluitend de gesproken tekst terug, zonder uitleg, tijdcodes of aanhalingstekens. Let extra op gespelde namen en expliciete aanwijzingen over schrijfwijze.'},
      {inlineData:{mimeType:mime,data:bytesToBase64(bytes)}}
    ]}]
  };
  const response=await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`,{
    method:'POST',
    headers:{'Content-Type':'application/json','x-goog-api-key':key},
    body:JSON.stringify(body)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    const msg=data?.error?.message||`Gemini gaf foutcode ${response.status}.`;
    throw new Error(`Gemini-transcriptie mislukt: ${msg}`);
  }
  const text=geminiText(data);
  if(!text)throw new Error('Gemini herkende geen spraak.');
  return {text};
}
async function openai(path,options={}){
  if(provider()==='gemini'){
    if(path==='/audio/transcriptions')return geminiTranscribe(options.body);
    if(path==='/chat/completions'){
      let payload={};try{payload=JSON.parse(options.body||'{}')}catch{}
      return geminiGenerate({messages:payload.messages||[],json:payload?.response_format?.type==='json_object'});
    }
    throw new Error('Deze AI-functie wordt nog niet ondersteund door Gemini.');
  }

  const key=requireOpenAIKey(),headers=new Headers(options.headers||{});headers.set('Authorization',`Bearer ${key}`);
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
   if(provider()==='gemini'){
     const data=await geminiGenerate({messages:[{role:'user',content:'Antwoord uitsluitend met: OK'}]});
     return {ok:Boolean(assistantText(data)),model:geminiModel(),provider:'gemini',credit:true};
   }
   const data=await openai('/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:textModel(),messages:[{role:'user',content:'Antwoord uitsluitend met: OK'}],max_completion_tokens:8})});
   return {ok:Boolean(assistantText(data)),model:textModel(),provider:'openai',credit:true};
 }catch(e){
   if(provider()==='openai'&&e.status===429&&['credit_balance_exhausted','insufficient_quota'].includes(e.code))return {ok:true,model:textModel(),provider:'openai',credit:false,warning:e.message};
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


export async function adjustText(existing,instruction,context='tekst'){
  const data=await openai('/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      model:textModel(),
      messages:[
        {role:'system',content:`Pas een bestaande Nederlandse ${context} aan op basis van een gesproken wijzigingsopdracht. Geef uitsluitend de volledig aangepaste tekst terug. Behoud informatie die niet gewijzigd hoeft te worden. Geen uitleg, geen inleiding en geen aanhalingstekens.`},
        {role:'user',content:`Bestaande tekst:\n${String(existing||'')}\n\nWijzigingsopdracht:\n${String(instruction||'')}`}
      ]
    })
  });
  const out=assistantText(data).trim();
  if(!out)throw new Error('OpenAI gaf geen aangepaste tekst terug.');
  return {text:out};
}

export async function adjustMailByInstruction(subject,body,instruction){
  const data=await openai('/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      model:textModel(),
      messages:[
        {role:'system',content:mailInstructions},
        {role:'user',content:`Pas deze e-mail aan volgens de opdracht.\n\nOnderwerp: ${String(subject||'')}\n\nBericht:\n${String(body||'')}\n\nWijzigingsopdracht:\n${String(instruction||'')}`}
      ],
      response_format:{type:'json_object'}
    })
  });
  const result=parseMail(assistantText(data));
  if(!result.body)throw new Error('OpenAI gaf geen bruikbare aangepaste e-mail terug.');
  return result;
}

export async function adjustFeedback(existing,instruction,student=''){
  const data=await openai('/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      model:textModel(),
      messages:[
        {role:'system',content:`Pas leerlingfeedback aan volgens de gesproken opdracht. Gebruik ALTIJD de jij-vorm. Begin met de leerlingnaam gevolgd door een komma als een naam beschikbaar is. Geef uitsluitend de volledig aangepaste feedback terug, zonder uitleg of afsluiting.`},
        {role:'user',content:`Leerling: ${student||'niet gekozen'}\nBestaande feedback:\n${String(existing||'')}\n\nWijzigingsopdracht:\n${String(instruction||'')}`}
      ]
    })
  });
  const out=assistantText(data).trim();
  if(!out)throw new Error('OpenAI gaf geen aangepaste feedback terug.');
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
    {role:'system',content:`Schrijf korte, concrete feedback voor een basisschoolleerling. Gebruik ALTIJD de jij-vorm. Begin met de naam van de leerling gevolgd door een komma, bijvoorbeeld: "Sara, je hebt ...". Behoud concrete observaties en eventuele vervolgactie. Formuleer positief, duidelijk en natuurlijk. Geen begroeting, afsluiting of ondertekening.`},
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


export async function classifyQuickCapture(text,context={}){
  const now=String(context.now||new Date().toISOString());
  const timezone=String(context.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Amsterdam');
  const system=`Classificeer één Nederlandse snelle invoer voor een persoonlijke schoolassistent.
Huidige datum/tijd: ${now}
Tijdzone: ${timezone}

Kies exact één type:
- todo: concrete taak/actie
- calendar: afspraak of gebeurtenis met datum/tijd
- note: informatie om te bewaren zonder duidelijke actie
- inbox: onduidelijk of nog te verwerken

Geef alleen geldige JSON:
{"type":"todo|calendar|note|inbox","text":"korte nette tekst","dueDate":"YYYY-MM-DD of leeg","priority":false}

Regels:
- Begrijp relatieve datums zoals vandaag, morgen, vrijdag.
- Als iemand woorden spelt of schrijfwijze toelicht, verwerk de bedoelde schrijfwijze.
- Gebruik priority=true alleen als de spreker duidelijk zegt dat het belangrijk/urgent is.
- Voor calendar mag text de volledige natuurlijke opdracht blijven zodat de Agenda-parser hem daarna exact kan verwerken.`;
  const data=await openai('/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    model:textModel(),
    messages:[{role:'system',content:system},{role:'user',content:String(text||'')}],
    response_format:{type:'json_object'}
  })});
  const raw=assistantText(data).replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  let obj;try{obj=JSON.parse(raw)}catch{throw new Error('AI kon de snelle invoer niet indelen.')}
  return {
    type:['todo','calendar','note','inbox'].includes(obj.type)?obj.type:'inbox',
    text:String(obj.text||text||'').trim(),
    dueDate:/^\d{4}-\d{2}-\d{2}$/.test(String(obj.dueDate||''))?String(obj.dueDate):'',
    priority:Boolean(obj.priority)
  };
}

export async function planDayWithAI(tasks,events,date){
  const system=`Maak een korte, praktische dagplanning voor een basisschoolleerkracht.
Gebruik uitsluitend de aangeleverde taken en afspraken. Houd rekening met tijden van afspraken.
Zet belangrijke en verlopen taken vooraan. Schrijf in natuurlijk Nederlands met een overzichtelijke volgorde.
Maximaal ongeveer 10 regels. Geen lange uitleg.`;
  const payload={date,tasks,events};
  const data=await openai('/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    model:textModel(),
    messages:[{role:'system',content:system},{role:'user',content:JSON.stringify(payload)}]
  })});
  const out=assistantText(data);if(!out)throw new Error('AI gaf geen dagplanning terug.');return {text:out};
}

export async function extractTodoActions(text){
  const system=`Haal concrete vervolgacties uit een Nederlandse reflectie, notitie, feedback of AI-tekst.
Geef uitsluitend geldige JSON: {"actions":["actie 1","actie 2"]}.
Maak iedere actie kort, uitvoerbaar en zelfstandig begrijpelijk. Maximaal 5 acties. Als er geen echte actie is, geef een lege lijst.`;
  const data=await openai('/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    model:textModel(),
    messages:[{role:'system',content:system},{role:'user',content:String(text||'')}],
    response_format:{type:'json_object'}
  })});
  const raw=assistantText(data).replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  let obj;try{obj=JSON.parse(raw)}catch{throw new Error('AI kon geen actiepunten uitlezen.')}
  return {actions:Array.isArray(obj.actions)?obj.actions.map(x=>String(x).trim()).filter(Boolean).slice(0,5):[]};
}
