# Meester Martijn App — GitHub Pages versie

Deze versie heeft **geen mappen en geen Cloudflare Worker nodig**. Upload alle bestanden uit deze map rechtstreeks naar de hoofdmap van je GitHub-repository.

## 1. Upload naar GitHub

Upload alle bestanden via **Add file → Upload files**. GitHub Pages gebruikt onder andere:

- `index.html`
- `style.css`
- `manifest.json`
- `service-worker.js`
- alle `.js`-bestanden
- `icon-192.png`
- `icon-512.png`

## 2. GitHub Pages aanzetten

Ga in de repository naar **Settings → Pages**. Kies bij Source voor **Deploy from a branch**, selecteer `main` en `/ (root)`, en sla dit op.

## 3. OpenAI koppelen

Open de app en ga naar **Instellingen → AI**. Plak daar je OpenAI API-key en tik op **API-key opslaan**. Gebruik daarna **Verbinding testen**.

De key wordt alleen lokaal in de browseropslag op jouw apparaat opgeslagen. De key staat niet in de GitHub-bestanden en wordt ook niet meegenomen in de JSON-export van de app.

Let op: client-side opslag van een API-key is minder veilig dan gebruik via een eigen backend. Gebruik deze versie alleen als je dat risico bewust accepteert en zet bij voorkeur een laag API-budget/gebruikslimiet op je OpenAI-account.

## 4. Op iPhone installeren

Open je GitHub Pages-adres in Safari, tik op de deelknop en kies **Zet op beginscherm**.

## Functies

De app bevat Mail opstellen, Notities, To Do, Groepjesmaker, Namenrad, Soundboards, Reflectie en Instellingen. Notities, klassenlijsten, reflecties, taken en soundboards worden waar mogelijk lokaal opgeslagen.
