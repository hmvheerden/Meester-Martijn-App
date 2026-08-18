import {settings} from './storage.js';

const OPENAI_BASE='https://api.openai.com/v1';
const GEMINI_INTERACTIONS='https://generativelanguage.googleapis.com/v1beta/interactions';
const DEFAULT_TEXT_MODEL='gpt-5.4-mini';
const DEFAULT_TRANSCRIBE_MODEL='gpt-4o-mini-transcribe';
const DEFAULT_GEMINI_MODEL='gemini-3.6-flash';

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
function interactionText(data){
  if(typeof data?.output_text==='string'&&data.output_text.trim())return data.output_text.trim();
  const parts=[];
  for(const step of data?.steps||[]){
    const content=step?.content;
    if(Array.isArray(content)){
      for(const block of content)if(block?.type==='text'&&block?.text)parts.push(block.text);
    }else if(content?.type==='text'&&content?.text)parts.push(content.text);
  }
  return parts.join('').trim();
}
function flattenGeminiMessages(messages=[]){
  const system=[];
  const lines=[];
  for(const m of messages){
    const role=String(m.role||'user');
    const text=String(m.content||'');
    if(role==='system')system.push(text);
    else lines.push(`${role==='assistant'?'Assistent':'Gebruiker'}:\n${text}`);
  }
  return {system:system.join('\n\n'),input:lines.join('\n\n')||'Antwoord met OK'};
}
async function geminiInteraction({messages=[],json=false,input=null,systemInstruction=''}={}){
  const key=requireGeminiKey(),model=geminiModel();
  const flattened=flattenGeminiMessages(messages);
  const body={
    model,
    input:input ?? flattened.input
  };
  const sys=[flattened.system,systemInstruction].filter(Boolean).join('\n\n');
  if(sys)body.system_instruction=sys;
  if(json)body.response_format={type:'text',mime_type:'application/json'};

  const response=await fetch(GEMINI_INTERACTIONS,{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'x-goog-api-key':key
    },
    body:JSON.stringify(body)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    const msg=data?.error?.message||`Gemini gaf foutcode ${response.status}.`;
    const e=new Error(`Gemini-fout ${response.status}: ${msg}`);
    e.status=response.status;
    throw e;
  }
  const text=interactionText(data);
  if(!text)throw new Error('Gemini gaf geen tekst terug.');
  return {choices:[{message:{content:text}}],_provider:'gemini',_model:model,_raw:data};
}
function generateContentText(data){
  return (data?.candidates?.[0]?.content?.parts||[]).map(x=>x?.text||'').join('').trim();
}
async function uploadGeminiFile(file,mime){
  const key=requireGeminiKey();
  const startResponse=await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files',{
    method:'POST',
    headers:{
      'x-goog-api-key':key,
      'X-Goog-Upload-Protocol':'resumable',
      'X-Goog-Upload-Command':'start',
      'X-Goog-Upload-Header-Content-Length':String(file.size),
      'X-Goog-Upload-Header-Content-Type':mime,
      'Content-Type':'application/json'
    },
    body:JSON.stringify({file:{display_name:'spraakopname'}})
  });
  if(!startResponse.ok){
    const data=await startResponse.json().catch(()=>({}));
    throw new Error(data?.error?.message||'Gemini kon de lange audio-upload niet starten.');
  }
  const uploadUrl=startResponse.headers.get('x-goog-upload-url');
  if(!uploadUrl)throw new Error('Gemini gaf geen upload-URL terug.');

  const uploadResponse=await fetch(uploadUrl,{
    method:'POST',
    headers:{
      'Content-Length':String(file.size),
      'X-Goog-Upload-Offset':'0',
      'X-Goog-Upload-Command':'upload, finalize'
    },
    body:file
  });
  const info=await uploadResponse.json().catch(()=>({}));
  if(!uploadResponse.ok)throw new Error(info?.error?.message||'Gemini kon de audio niet uploaden.');
  if(!info?.file?.uri)throw new Error('Gemini gaf geen bestand-URI terug.');
  return info.file;
}
async function geminiGenerateContent(parts){
  const key=requireGeminiKey();
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel())}:generateContent`,{
    method:'POST',
    headers:{'Content-Type':'application/json','x-goog-api-key':key},
    body:JSON.stringify({contents:[{role:'user',parts}]})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data?.error?.message||`Gemini gaf foutcode ${response.status}.`);
  const text=generateContentText(data);
  if(!text)throw new Error('Gemini herkende geen spraak.');
  return text;
}
async function geminiTranscribe(formData){
  const file=formData?.get?.('file');
  if(!file||typeof file.arrayBuffer!=='function')throw new Error('Geen audio-opname gevonden.');

  let mime=file.type||'audio/m4a';
  if(mime.startsWith('audio/mp4'))mime='audio/m4a';
  else if(mime.startsWith('audio/webm'))mime='audio/ogg';

  const prompt='Transcribeer deze Nederlandse spraakopname volledig en nauwkeurig. Geef uitsluitend de gesproken tekst terug, zonder uitleg, tijdcodes of aanhalingstekens. Sla niets over, ook niet bij een langere opname. Let extra op gespelde namen en expliciete aanwijzingen over schrijfwijze.';

  // Kleine/middelgrote opnames inline; grotere opnames via de officiële Files API.
  if(file.size<18*1024*1024){
    const bytes=new Uint8Array(await file.arrayBuffer());
    const text=await geminiGenerateContent([
      {text:prompt},
      {inlineData:{mimeType:mime,data:bytesToBase64(bytes)}}
    ]);
    return {text};
  }

  const uploaded=await uploadGeminiFile(file,mime);
  const text=await geminiGenerateContent([
    {text:prompt},
    {file_data:{mime_type:uploaded.mimeType||mime,file_uri:uploaded.uri}}
  ]);
  return {text};
}

async function openai(path,options={}){
  if(provider()==='gemini'){
    if(path==='/audio/transcriptions')return geminiTranscribe(options.body);
    if(path==='/chat/completions'){
      let payload={};try{payload=JSON.parse(options.body||'{}')}catch{}
      return geminiInteraction({messages:payload.messages||[],json:payload?.response_format?.type==='json_object'});
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
     const data=await geminiInteraction({messages:[{role:'user',content:'Antwoord uitsluitend met: OK'}]});
     return {ok:Boolean(assistantText(data)),model:geminiModel(),provider:'gemini',credit:true};
   }
   const data=await openai('/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:textModel(),messages:[{role:'user',content:'Antwoord uitsluitend met: OK'}],max_completion_tokens:8})});
   return {ok:Boolean(assistantText(data)),model:textModel(),provider:'openai',credit:true};
 }catch(e){
   if(provider()==='openai'&&e.status===429&&['credit_balance_exhausted','insufficient_quota'].includes(e.code))return {ok:true,model:textModel(),provider:'openai',credit:false,warning:e.message};
   throw e;
 }
}
async function prepareLongText(text,purpose='samenvatting'){
  const source=String(text||'').trim();
  if(source.length<=12000)return source;
  const chunks=[];
  for(let i=0;i<source.length;i+=9000)chunks.push(source.slice(i,i+9000));
  const notes=[];
  for(let i=0;i<chunks.length;i++){
    const data=await openai('/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model:activeModel(),
        messages:[
          {role:'system',content:`Haal alle relevante informatie uit deel ${i+1} van een langere Nederlandse transcriptie voor ${purpose}. Verlies geen namen, feiten, afspraken, observaties, data, gevoelens, voorbeelden of gewenste acties. Maak compacte maar volledige werknotities. Geen inleiding.`},
          {role:'user',content:chunks[i]}
        ]
      })
    });
    notes.push(assistantText(data));
  }
  return `Samengevoegde werknotities uit een lange transcriptie:\n\n${notes.join('\n\n')}`;
}

export async function chat(messages,action='compose'){
  const actions={
    compose:'Stel op basis van het gesprek een complete direct bruikbare e-mail op.',
    regenerate:'Maak een nieuwe goede versie van de e-mail.',
    shorter:'Maak de e-mail duidelijk korter zonder belangrijke informatie te verliezen.',
    friendlier:'Maak de e-mail iets warmer en vriendelijker, maar natuurlijk.',
    formal:'Maak de e-mail formeler en professioneel.',
    informal:'Maak de e-mail informeler en natuurlijker, zonder slordig te worden.'
  };
  const prepared=[];
  for(const m of messages){
    let content=String(m.content||'');
    if(m.role!=='assistant'&&content.length>12000)content=await prepareLongText(content,'het opstellen van een e-mail');
    prepared.push({role:m.role==='assistant'?'assistant':'user',content});
  }
  const apiMessages=[{role:'system',content:mailInstructions},...prepared,{role:'user',content:actions[action]||actions.compose}];
  const data=await openai('/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({model:activeModel(),messages:apiMessages,response_format:{type:'json_object'}})
  });
  let result=parseMail(assistantText(data));
  if(!result.body)throw new Error('AI gaf geen bruikbare e-mail terug. Probeer het opnieuw.');

  const classList=settings.get('classList',[]);
  if(Array.isArray(classList)&&classList.length){
    const checkedBody=await normalizeClassNames(result.body,classList);
    const checkedSubject=await normalizeClassNames(result.subject,classList);
    result={subject:checkedSubject.text||result.subject,body:checkedBody.text||result.body};
  }
  return result;
}



export async function generalChat(messages){
  const apiMessages=[
    {role:'system',content:'Je bent de persoonlijke AI-assistent in de Meester Martijn App. Antwoord in natuurlijk Nederlands, behulpzaam en duidelijk. Houd antwoorden compact tenzij meer uitleg nuttig is. Je bent een gewone algemene chatassistent.'},
    ...messages.map(m=>({role:m.role==='assistant'?'assistant':'user',content:String(m.content||'')}))
  ];
  const data=await openai('/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({model:activeModel(),messages:apiMessages})
  });
  const out=assistantText(data);
  if(!out)throw new Error('AI gaf geen antwoord terug.');
  return {text:out};
}

async function fileToDataURL(file){
  const bytes=new Uint8Array(await file.arrayBuffer());
  return `data:${file.type||'image/jpeg'};base64,${bytesToBase64(bytes)}`;
}

export async function generalChatWithImage(messages,file,prompt=''){
  if(!file)return generalChat(messages);
  const question=String(prompt||'').trim()||'Bekijk deze afbeelding en help me ermee.';

  if(provider()==='gemini'){
    const bytes=new Uint8Array(await file.arrayBuffer());
    const text=await geminiGenerateContent([
      {text:`Je bent de persoonlijke AI-assistent in de Meester Martijn App. Antwoord in natuurlijk Nederlands, behulpzaam en duidelijk. Houd antwoorden compact tenzij meer uitleg nuttig is.\n\nVraag van de gebruiker:\n${question}`},
      {inlineData:{mimeType:file.type||'image/jpeg',data:bytesToBase64(bytes)}}
    ]);
    return {text};
  }

  const key=requireOpenAIKey();
  const dataUrl=await fileToDataURL(file);
  const prior=messages.slice(-8).map(m=>({
    role:m.role==='assistant'?'assistant':'user',
    content:String(m.content||'')
  }));
  const response=await fetch(`${OPENAI_BASE}/chat/completions`,{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},
    body:JSON.stringify({
      model:textModel(),
      messages:[
        {role:'system',content:'Je bent de persoonlijke AI-assistent in de Meester Martijn App. Antwoord in natuurlijk Nederlands, behulpzaam en duidelijk.'},
        ...prior,
        {role:'user',content:[
          {type:'text',text:question},
          {type:'image_url',image_url:{url:dataUrl}}
        ]}
      ]
    })
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    const msg=data?.error?.message||`OpenAI gaf foutcode ${response.status}.`;
    throw new Error(msg);
  }
  const out=data?.choices?.[0]?.message?.content?.trim?.()||'';
  if(!out)throw new Error('AI gaf geen antwoord terug.');
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
  const prepared=await prepareLongText(String(text||''),mode==='day'?'een dagreflectie':'een lesreflectie');
  const data=await openai('/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({model:activeModel(),messages:[{role:'system',content:system},{role:'user',content:prepared}]})
  });
  const out=assistantText(data);
  if(!out)throw new Error('AI gaf geen samenvatting terug.');
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


export async function normalizeClassNames(text,names=[]){
  const cleanNames=(Array.isArray(names)?names:[]).map(x=>String(x||'').trim()).filter(Boolean);
  const source=String(text||'').trim();
  if(!source||!cleanNames.length)return {text:source};

  const system=`Controleer uitsluitend de spelling van leerlingnamen in een Nederlandse tekst.
Gebruik de onderstaande klassenlijst als het gezaghebbende namenwoordenboek.

KLASSENLIJST:
${cleanNames.join('\n')}

Regels:
- Als een naam in de tekst fonetisch, verkeerd gespeld of door spraakherkenning anders is geschreven, vervang die alleen wanneer duidelijk is welke leerling uit de klassenlijst bedoeld wordt.
- Gebruik altijd exact de schrijfwijze uit de klassenlijst.
- Als meerdere namen plausibel zijn of je bent niet zeker, verander die naam dan niet.
- Verander GEEN gewone woorden, zinsbouw, inhoud, leestekens of formulering behalve waar dat strikt nodig is om een leerlingnaam correct te schrijven.
- Voeg geen namen toe die niet genoemd of duidelijk bedoeld zijn.
- Geef uitsluitend de volledige gecorrigeerde tekst terug, zonder uitleg of aanhalingstekens.`;

  const data=await openai('/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      model:activeModel(),
      messages:[
        {role:'system',content:system},
        {role:'user',content:source}
      ]
    })
  });
  const out=assistantText(data).trim();
  if(!out)throw new Error('AI kon de namen niet controleren.');
  return {text:out};
}


export async function summarizeClassWeek(events,context={}){
  const weekNumber=String(context.weekNumber||'');
  const year=String(context.year||'');
  const classList=Array.isArray(context.classList)?context.classList:[];
  const system=`Maak van de gebeurtenissen uit het klasdagboek een warm, positief en prettig leesbaar weekverslag voor de ouders/verzorgers van een basisschoolklas.

Week: ${weekNumber}
Jaar: ${year}

Bekende leerlingnamen:
${classList.map(x=>String(x)).join('\n')}

Regels:
- Schrijf alsof de leerkracht ouders op een leuke en toegankelijke manier meeneemt in wat de klas deze week heeft beleefd.
- Maak er één samenhangend verhaal van en geen droge opsomming of administratie.
- Begin met een korte, natuurlijke opening over de week.
- Benoem leuke momenten, activiteiten, wat de kinderen hebben geleerd of geoefend en andere noemenswaardige gebeurtenissen.
- Houd de toon warm, enthousiast en persoonlijk, maar niet overdreven of kinderachtig.
- Positieve momenten mogen extra naar voren komen.
- Verwerk aandachtspunten alleen als ze geschikt en relevant zijn voor een algemeen bericht aan alle ouders. Formuleer ze zorgvuldig en constructief.
- Neem geen gevoelige, vertrouwelijke of negatieve informatie over een individuele leerling op in een algemeen ouderverslag.
- Gebruik alleen informatie uit de aangeleverde gebeurtenissen en verzin niets.
- Als leerlingnamen voorkomen en het passend is om die te noemen, gebruik exact de spelling uit de klassenlijst.
- Verander namen alleen als duidelijk is welke leerling bedoeld wordt.
- Schrijf in natuurlijk, vlot Nederlands met prettige korte alinea's.
- Gebruik eventueel een paar passende tussenkopjes als dat de leesbaarheid verbetert.
- Eindig met een korte positieve vooruitblik of afronding.
- Geen formele briefaanhef, geen ondertekening en geen afsluiting zoals "Met vriendelijke groet".
- Geef uitsluitend het weekverslag terug.`;

  const payload=(Array.isArray(events)?events:[]).map(x=>({
    date:String(x.date||''),
    text:String(x.text||'')
  }));

  const data=await openai('/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      model:activeModel(),
      messages:[
        {role:'system',content:system},
        {role:'user',content:JSON.stringify(payload)}
      ]
    })
  });
  const out=assistantText(data).trim();
  if(!out)throw new Error('AI gaf geen weekverslag terug.');
  return {text:out};
}
