# Meester Martijn App — GitHub-vriendelijke versie

Deze versie heeft **geen mappen nodig**. Upload alle bestanden uit deze map rechtstreeks naar de hoofdmap van je GitHub-repository.

## 1. Upload naar GitHub

Upload alle bestanden in één keer via **Add file → Upload files**. Belangrijk voor GitHub Pages zijn onder andere:

- `index.html`
- `style.css`
- `manifest.json`
- `service-worker.js`
- alle `.js`-bestanden
- `icon-192.png`
- `icon-512.png`

`cloudflare-worker.js` en `wrangler.toml.example` zijn voor de AI-backend en hoeven niet door de website zelf te worden geladen. Ze mogen wel gewoon in dezelfde GitHub-repository staan.

## 2. GitHub Pages aanzetten

Ga in de repository naar **Settings → Pages**. Kies bij Source voor **Deploy from a branch**, selecteer je hoofdbranch (`main`) en `/ (root)`. Sla dit op.

## 3. OpenAI veilig koppelen

Zet je OpenAI API-key **niet** in de GitHub-bestanden. Gebruik `cloudflare-worker.js` voor een Cloudflare Worker en voeg daar in Cloudflare een secret toe met de naam:

`OPENAI_API_KEY`

Publiceer de Worker. Kopieer daarna de Worker-URL en vul die in de app in bij **Instellingen → AI → Backend/API URL**. Gebruik daarna **Verbinding testen**.

## 4. Op iPhone installeren

Open je GitHub Pages-adres in Safari, tik op de deelknop en kies **Zet op beginscherm**.

## Functies

De eerste versie bevat Mail opstellen, Notities, To Do, Groepjesmaker, Namenrad, Soundboards, Reflectie en Instellingen. Lokale gegevens worden waar mogelijk op het apparaat bewaard.
