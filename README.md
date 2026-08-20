# Meester Martijn App

GitHub Pages-versie. Upload alle bestanden uit deze map rechtstreeks naar de root van je GitHub-repository.

## Navigatie
Onderin staan alleen Home, Klas, To Do en Instellingen. Alle functies zijn vanaf Home bereikbaar.

## OpenAI
Vul bij Instellingen je OpenAI API-key in. De key wordt lokaal op het apparaat opgeslagen en staat niet in GitHub. API-tegoed is apart van een ChatGPT-abonnement.

## Soundboards
Ondersteunt onder andere MP3, M4A, WAV, AAC, OGG en WebM. Audio wordt lokaal in IndexedDB opgeslagen.


## Versie 5
- Alle app-mails gaan standaard naar martijn.vanheerden@fedra.nl.
- AI-mails bevatten geen ondertekening of slotgroet.
- Notities kunnen worden ingesproken en automatisch kort samengevat.
- Opgeslagen notities kunnen naar het vaste e-mailadres worden gemaild of als universeel .txt-bestand via het iOS-deelmenu worden gedeeld.

## Versie 6
- Home opent direct AI Chat met tekst en spraak.
- Onderste navigatie bevat alle pagina's en is horizontaal scrollbaar.
- Alle mailfuncties gebruiken standaard martijn.vanheerden@fedra.nl.
- Opgeslagen reflecties kunnen ook direct worden gemaild.
- Soundboards blijven echte audiobestanden ondersteunen, inclusief MP3.

## Versie 7
- Home opent direct de AI-chat onder de naam Meesterassistent.
- E-mailadres is weer volledig zelf instelbaar via Instellingen.
- Mail, Notities en Reflectie gebruiken alleen het e-mailadres dat je zelf bij Instellingen hebt ingevuld.
- Er staat geen vast e-mailadres meer in de code.
- Alle pagina's blijven bereikbaar via de horizontaal scrollbare onderste navigatie.

## Versie 8
- Onderste menu: Home, To Do, Notities, Mail, Klas.
- Klas bevat Groepjesmaker, Namenrad en Soundboards.
- Bestaande functies van Groepjesmaker, Namenrad en Soundboards blijven ongewijzigd.

## Versie 9 - blanco scherm reparatie
- De app toont nu altijd eerst een zichtbare laadpagina.
- Pagina-modules worden pas geladen wanneer nodig; één kapot/oud bestand kan niet meer de hele app blanco maken.
- PWA-cache is vernieuwd en gebruikt network-first, zodat GitHub-updates sneller zichtbaar worden.
- Menu blijft: Home, To Do, Notities, Mail, Klas.
- Instellingen is bereikbaar via de knop rechtsboven op Home en Klas.
- Klas bevat Groepjesmaker, Namenrad en Soundboards.

## Versie 10
- Kritieke syntaxfout in api.js gerepareerd.
- Instellingen permanent rechtsboven.
- Home opent Meesterassistent.
- Menu: Home, To Do, Notities, Mail, Klas.

## Versie 11
- Soundboard: één tik start een geluid; nogmaals op hetzelfde geluid tikt stopt het direct.
- Reflectie is weer een aparte hoofdpagina.
- Reflectie heeft Lesreflectie en Dagreflectie.
- Beide reflectietypen ondersteunen typen, inspreken, AI-samenvatting, opslaan, kopiëren en mailen.
- Onderste navigatie bevat Home, To Do, Notities, Mail, Klas en Reflectie.

## Versie 12
- Nieuwe pagina Feedback.
- Leerling kiezen uit de opgeslagen klassenlijst.
- Foto maken met de iPhone-camera of een bestaande foto kiezen.
- Feedback typen of inspreken en transcriberen.
- Feedback met AI kort samenvatten.
- Mail opstellen naar het e-mailadres uit Instellingen.
- Bij een foto gebruikt de app het iOS-deelmenu zodat Mail de foto als bijlage kan ontvangen.

## Versie 13
- Klas bevat nu ook Beurten en Timer.
- Beurten kiest willekeurig uit de klassenlijst en voorkomt herhaling totdat iedereen geweest is.
- Timer heeft 1, 5, 10, 15 en 30 minuten, een eigen tijd, pauzeren en resetten.

## Versie 14
- Feedback is verplaatst naar Klas.
- Klas bevat nu Groepjesmaker, Namenrad, Soundboards, Beurten, Timer en Feedback.
- Feedback staat niet meer als losse knop in het onderste hoofdmenu.

## Versie 15
- Nieuwe pagina Punten onder Klas.
- Volledige klassenlijst met + en - per leerling.
- Punten blijven lokaal opgeslagen.
- Alle punten in één keer op 0 zetten.
- Puntenoverzicht kopiëren.
- Puntenoverzicht direct mailen naar het e-mailadres uit Instellingen.

## Versie 16
- Groepjesmaker heeft nu naast automatisch ook Zelf indelen.
- Bij Zelf indelen kies je 1 t/m 6 groepen, selecteer je een groep en tik je leerlingen uit de klassenlijst aan.
- Een leerling kan maar in één handmatige groep tegelijk staan.
- Nieuwe pagina Checklist onder Klas.
- Checklist krijgt een eigen naam, gebruikt alle leerlingen, bewaart vinkjes en kan later verder worden ingevuld.
- Checklist indienen toont welke leerlingen nog ontbreken.
- Checklistoverzicht kan worden gekopieerd of naar het e-mailadres uit Instellingen worden gemaild.

## Versie 17
- Home is nu een vrijwel schermvullende Meesterassistent-chat.
- Alleen het gespreksgedeelte scrolt; de titel, invoer, verstuurknop en spraakknop blijven zichtbaar.
- De rest van de app is inhoudelijk ongewijzigd gebleven.

## Versie 18
- Onderste hoofdmenu's: Home, To Do, Notities, Mail, Klas en Reflectie.
- Onder Klas: Groepjesmaker, Namenrad, Checklist, Punten, Feedback, Timer, Beurten en Soundboards.
- Instellingen blijft permanent rechtsboven.
- Home blijft de schermvullende Meesterassistent-chat.

## Versie 19
- Nieuwe losse pagina Agenda.
- Typ of spreek een agenda-opdracht in.
- AI haalt titel, datum, begin/eindtijd, locatie en notities eruit.
- Je krijgt altijd eerst een bewerkbaar controlescherm.
- Open in Apple Agenda maakt een .ics-agenda-item voor iPhone.

## Versie 20
- Agenda staat direct naast Home in het hoofdmenu.
- Volgorde: Home, Agenda, To Do, Notities, Mail, Klas, Reflectie.
- Geen tijd genoemd: afspraak start standaard om 08:00.
- Wel tijd genoemd maar geen duur/eindtijd: afspraak duurt standaard 15 minuten.
- Genoemde duur of expliciete eindtijd wordt overgenomen.
- Apple Agenda blijft geopend via een .ics-agenda-item.

## Versie 21
- Agenda toont eerst: Dit is de afspraak, klopt het zo?
- De afspraak wordt kort opgesomd met titel, datum, tijd, locatie en notities.
- Keuzes: Ja, het klopt / Nee, opnieuw.
- Pas na goedkeuring verschijnt Open in Apple Agenda.
- Bij Nee kun je de herkende afspraak aanpassen of opnieuw typen/inspreken.

## Versie 22
- Apple Agenda gebruikt nu bij voorkeur een iOS Shortcut-koppeling.
- De app start de opdracht `Meester Martijn Agenda` via het officiële `shortcuts://run-shortcut` URL-schema en stuurt titel, begin, einde, locatie en notities mee.
- Hiermee kan de Shortcut de native Agenda-actie Add New Event gebruiken.
- De oude .ics-methode blijft als reserve beschikbaar.
- Zie APPLE_AGENDA_KOPPELING.txt voor de eenmalige iPhone-instelling.

## Versie 23
- Shortcut-agenda probleem met datum/tijd hersteld.
- De app stuurt start/eind nu als `YYYY-MM-DD HH:MM` plus losse date/startTime/endTime velden.
- In de Shortcut moeten start en end eerst via `Haal datums op uit invoer` naar echte datumwaarden worden omgezet.

## Versie 24
- De zelfgemaakte Shortcut-koppeling is verwijderd.
- Na goedkeuring deelt Agenda direct een .ics-bestand via het iOS-deelmenu.
- Kies in het deelmenu `ICS To Calendar` om de afspraak aan Apple Agenda toe te voegen.
- De eerdere regels voor standaardtijd en duur blijven behouden.

## Versie 25
- To Do heeft nu `To Do inspreken`.
- Spraak wordt eerst getranscribeerd en daarna door AI omgezet naar één kort, duidelijk en uitvoerbaar actiepunt.
- AI krijgt expliciete instructies om gesproken aanwijzingen over schrijfwijze te verwerken, zoals lange ij/korte ei, dubbele letters, hoofdletters, streepjes en `schrijf je als...`.
- Het AI-resultaat komt eerst in het gewone invoerveld zodat het nog aangepast kan worden voordat het wordt toegevoegd.

## Versie 26
- Reflecties hebben nu expliciet `Mail naar mezelf`, zowel bij de huidige reflectie als bij opgeslagen reflecties.
- Reflecties kunnen daarnaast als `.txt` worden gedeeld, net als bij Notities.
- De mail gebruikt het e-mailadres uit Instellingen en neemt de AI-samenvatting over als die aanwezig is; anders de volledige reflectietekst.

## Versie 27
- Meesterassistent: ieder AI-antwoord heeft Kopieer, Mail antwoord, Deel .txt en Spreek aanpassing in.
- In de chat kun je ook geselecteerde tekst via `Mail selectie` naar het e-mailadres uit Instellingen sturen.
- Feedback wordt door AI altijd in de jij-vorm geschreven en begint waar mogelijk met `Naam, je ...`.
- Feedback heeft `Mail naar mezelf` naar het ingestelde e-mailadres; foto delen blijft apart via het iOS-deelmenu.
- Mail, Notities, Reflectie, Feedback, To Do en Agenda hebben nu een optie `Spreek in om aan te passen` voor het bestaande resultaat.
- Reflectie en Feedback gebruiken voor mailen het e-mailadres dat bij Instellingen is opgeslagen.

## Versie 28 – planning en structuur
- Nieuw hoofdmenu `Vandaag` met Dagstart, AI-dagplanning, weekoverzicht, Inbox, snelle invoer en zoeken door de app.
- Snelle invoer kan getypt of ingesproken worden. AI deelt hem automatisch in als To Do, Agenda, Notitie of Inbox.
- Home heeft een snelle knop naar Snelle invoer.
- To Do ondersteunt deadlines, belangrijk-markering en terugkerende taken (dagelijks, werkdagen, wekelijks, maandelijks).
- Verlopen taken worden als `Te laat` gemarkeerd.
- Terugkerende taken maken bij afronden automatisch de volgende taak aan.
- Agenda-afspraken worden na goedkeuring lokaal onthouden voor Vandaag en Weekoverzicht.
- Chat-antwoorden, Notities, Feedback en Reflecties kunnen direct naar To Do.
- Reflectie kan met AI concrete vervolgacties eruit halen en die afzonderlijk naar To Do sturen.
- Inbox-items kunnen handmatig of met AI naar To Do, Notities of Agenda worden verwerkt.
- `Zoek door alles` zoekt in To Do, Notities, Reflecties, Feedback, Agenda, Checklists, Inbox, Soundboards, opgeslagen groepjes en Punten.

## Versie 29 – Gemini als alternatief voor OpenAI
- Instellingen heeft nu een AI-providerkeuze: OpenAI of Gemini.
- Gemini API-key kan apart lokaal worden opgeslagen.
- Standaard Gemini-model: `gemini-2.5-flash`.
- Chat, Mail, To Do, Notities, Reflectie, Feedback, Agenda en plannings-AI gebruiken automatisch de gekozen provider.
- Spraakopnames kunnen bij Gemini rechtstreeks als audio naar Gemini worden gestuurd voor transcriptie.
- OpenAI-instellingen blijven behouden; wisselen van provider verwijdert geen keys.

## Versie 30
- Agenda heeft nu `Mail afspraak (.ics)`.
- De knop maakt het huidige agenda-item als `.ics`-bestand en opent het iOS-deelmenu.
- Het ingestelde e-mailadres wordt meegenomen in de deeltekst en het onderwerp is vast `afspraak toevoegen`.
- iOS laat een webapp niet tegelijk een lokale bijlage toevoegen én het ontvanger-veld van Mail gegarandeerd vooraf invullen.
- Als delen met bestand niet beschikbaar is, opent de app Mail met het ingestelde e-mailadres en onderwerp.

## Versie 31
- `Mail afspraak (.ics)` gebruikt het e-mailadres uit Instellingen.
- Het e-mailadres wordt bij klikken automatisch naar het klembord gekopieerd.
- Onderwerp: `afspraak toevoegen`.
- Het `.ics`-bestand wordt via het iOS-deelmenu als bijlage aan Mail doorgegeven.
- iOS laat een gewone webapp niet tegelijk het native Aan:-veld en een lokale bijlage afdwingen; als Aan leeg blijft hoeft alleen het al gekopieerde adres geplakt te worden.

## Versie 32
- De pagina `Vandaag` is uit de hoofdnavigatie verwijderd.
- `Snelle invoer` is van Home verwijderd.
- Home blijft de bestaande Meesterassistent/chat.
- Agenda, To Do, Notities, Mail, Klas, Reflectie en alle bestaande opties blijven behouden.
- De agenda-opties voor ICS / ICS To Calendar / `Mail afspraak (.ics)` uit v31 blijven behouden.
- Onderliggende plannerdata en bestaande To Do-opties zijn niet verwijderd, zodat bestaande opgeslagen gegevens behouden blijven.

## Versie 33
- De app gebruikt voortaan altijd de lichte weergave, ook als de iPhone zelf op donker staat.
- De thema-keuze is uit Instellingen verwijderd.
- Nieuwe hoofdmenuvolgorde: Home, To Do, Agenda, Mail, Notities, Klas, Reflectie.
- Alle bestaande functies uit v32 zijn behouden.

## Versie 34 – Gemini Interactions API
- Gemini gebruikt nu de nieuwe Google Interactions API (`/v1beta/interactions`).
- Standaardmodel is `gemini-3.6-flash`, conform de actuele Google-voorbeelden.
- Bestaande Gemini API-key blijft bruikbaar; er is geen nieuwe key nodig vanwege deze modelmigratie.
- Oude opgeslagen waarden `gemini-2.5-flash` en `gemini-3.5-flash` worden automatisch naar `gemini-3.6-flash` gemigreerd.
- JSON-output voor Agenda, Mail en andere gestructureerde AI-functies gebruikt `response_format` met `application/json`.
- Spraaktranscriptie via Gemini gebruikt multimodale audio-input via de Interactions API.
- OpenAI blijft als alternatief volledig beschikbaar.

## Versie 35 – Absenties invoeren
- Onder `Klas` staat nu `Absenties invoeren`.
- Gebruikt automatisch de opgeslagen klassenlijst.
- Per leerling: Aanwezig, Ochtend, Middag of Hele dag.
- Maakt een overzicht met de gekozen datum erboven.
- `Mail naar mezelf` gebruikt het e-mailadres uit Instellingen.
- Mailonderwerp: `Absenties – dd-mm-jjjj`.
- Alle bestaande functies uit v34 blijven behouden.

## Versie 36
- Hoofdmenuvolgorde gewijzigd naar:
  Home, Klas, To Do, Agenda, Mail, Notities, Reflectie.
- Absenties invoeren blijft onder Klas beschikbaar.
- Alle overige functies uit v35 blijven behouden.

## Versie 37 – leerlingnamen in Reflectie
- Reflectie gebruikt de opgeslagen klassenlijst als namenwoordenboek.
- Na inspreken controleert AI automatisch of leerlingnamen overeenkomen met de exacte spelling uit de klassenlijst.
- Ook getypte reflecties worden vóór AI-samenvatting en vóór Opslaan op leerlingnamen gecontroleerd.
- Nieuwe knop `Controleer leerlingnamen` om dit handmatig uit te voeren.
- Alleen duidelijke naam-matches worden aangepast; gewone tekst en twijfelgevallen blijven ongemoeid.
- Alle bestaande functies uit v36 blijven behouden, inclusief Absenties invoeren.

## Versie 38 – Soundboard kleuren en volgorde
- Elk geluid op een soundboard kan een eigen knopkleur krijgen.
- Bij het toevoegen van een nieuw geluid kan direct een kleur worden gekozen.
- Bestaande geluiden krijgen automatisch een standaardkleur.
- Per geluid zijn knoppen `Omhoog` en `Omlaag` toegevoegd om de volgorde te wijzigen.
- De gekozen kleur en volgorde worden lokaal opgeslagen en blijven behouden.
- Alle wijzigingen uit v37 blijven behouden, waaronder klassenlijst-gebaseerde naamcontrole in Reflectie en Absenties invoeren.

## Versie 39
- Timer is verwijderd uit Klas.
- De interne hoofdroute heet nu `klas` in plaats van `class`.
- De zichtbare menunaam blijft `Klas`.
- Oude links met `#class` worden automatisch doorgestuurd naar `#klas`.
- Alle overige functies uit v38 blijven behouden.

## Versie 40 – Klasdagboek
- De algemene AI-chat/Home is verwijderd.
- `Klas` is nu het eerste hoofdmenu en de standaard startpagina.
- Agenda heet `AI-Agenda`.
- Mail heet `AI-Mail`.
- Nieuw onder Klas: `Klasdagboek`.
- Klasdagboek slaat gebeurtenissen per gekozen dag lokaal op.
- Gebeurtenissen kunnen getypt of ingesproken worden.
- Na inspreken worden leerlingnamen automatisch gecontroleerd tegen de klassenlijst.
- Getypte gebeurtenissen worden bij opslaan eveneens tegen de klassenlijst gecontroleerd.
- `Maak een weekverslag` bundelt alle gebeurtenissen van de betreffende ISO-week met AI.
- Weekverslagen krijgen automatisch weeknummer en jaar en worden na generatie nogmaals op leerlingnamen gecontroleerd.
- Weekverslagen kunnen lokaal worden opgeslagen en direct worden gemaild naar het e-mailadres uit Instellingen.
- Mailonderwerp: `Weekverslag [weeknummer]`.
- Onder `Opgeslagen weekverslagen` kunnen eerdere verslagen geopend, individueel gemaild of verwijderd worden.
- Alle bestaande functies uit v39 blijven behouden, behalve de verwijderde algemene AI-chat/Home.

## Versie 41
- Alle leerling-afvinklijsten gebruiken alfabetische volgorde volgens Nederlandse sortering.
- Absenties: eerst leerling aanvinken; daarna standaard `Hele dag`, gevolgd door `Ochtend` en `Middag`.
- AI-Mail controleert vóór tonen/versturen leerlingnamen tegen de klassenlijst.
- Mailen vanuit Notities, Reflectie en AI-chat controleert leerlingnamen eveneens tegen de klassenlijst.
- Lange transcripties zijn robuuster: audio wordt op lagere bitrate opgenomen; grotere Gemini-audio gebruikt de Files API; lange tekst wordt in delen voorbereid voor Mail en Reflectie.
- `Notities` is ook als tegel onder Klas beschikbaar; bestaande notities blijven behouden en mailbaar.
- Nieuwe `To Do` onder Klas voor taken voor klas/leerlingen, met typen, inspreken, afvinken en mailen.
- De losse To Do-hoofdpagina is verwijderd.
- `AI-chat` is het laatste hoofdmenu-item met de eerdere chatfuncties.
- AI-chat ondersteunt `Foto maken` en `Foto kiezen`; daarna kan de vraag getypt of ingesproken worden.
- Ieder AI-chatantwoord kan afzonderlijk direct worden gemaild naar het e-mailadres uit Instellingen.

## Versie 42
- AI-weekverslagen uit het Klasdagboek zijn nu specifiek geschreven voor ouders/verzorgers.
- De toon is warm, positief, toegankelijk en prettig leesbaar.
- Het verslag vormt één samenhangend verhaal over de week in plaats van een administratieve opsomming.
- Leuke momenten, activiteiten en wat de klas heeft geleerd krijgen nadruk.
- Individuele gevoelige of negatieve leerlinginformatie wordt niet in het algemene ouderverslag opgenomen.
- Het verslag eindigt met een korte positieve afronding of vooruitblik.

## Versie 43 – foto-invoer voor AI-Agenda en AI-Mail
- AI-Agenda heeft twee aparte knoppen: `Foto maken van afspraak` en `Foto invoegen`.
- Een foto van een uitnodiging, briefje, kaart of afspraak wordt door AI gelezen en daarna automatisch omgezet naar het bestaande agenda-item met titel, datum, tijd, locatie en notities.
- De normale AI-Agenda-flow blijft behouden: controleren, aanpassen, goedkeuren, ICS To Calendar en mailen als `.ics`.
- AI-Mail heeft twee aparte foto-opties: `Foto maken` en `Foto invoegen`.
- Nieuw onderdeel `Reageren op een bestaande mail`.
- Na het toevoegen van een foto/screenshot van een mail kun je typen wat je in de reactie wilt hebben.
- Je kunt die aanvullende instructie ook inspreken via `Inspreken wat ik wil`.
- `Geef een reactie op deze mail` leest de ontvangen mail op de foto en maakt vervolgens een direct bruikbare reactie waarin je eigen aanvullende wensen zijn verwerkt.
- Leerlingnamen in de gemaakte mail blijven gecontroleerd worden tegen de klassenlijst.
- Alle bestaande functies uit v42 blijven behouden.
