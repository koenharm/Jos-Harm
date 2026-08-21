# AI-assistent bij notities — uitgezet, klaar om aan te zetten

De AI-functies bij notities staan **uit**. Ze kosten geld per gebruik (OpenAI voor het
uittypen, Anthropic/Claude voor het uitwerken), en zonder tegoed werken ze niet.

## Wat er nu wel en niet werkt

Werkt gewoon (kost niets):
- Notities typen, labels, klant koppelen, zoeken, foto's, archiveren.
- **Audio opnemen** bij een notitie — de opname blijft lokaal op het apparaat staan.
- **Live meeschrijven** — spraak naar tekst via de telefoon zelf, zonder externe dienst.

Staat uit:
- Uittypen van een opname met AI (Whisper).
- Verslag + meedenken (titel, samenvatting, afspraken, maten, actiepunten).
- Sprekerslabels, mindmap, herschrijven op toon/lengte.
- De assistent-balk bij een notitie en “Vraag het aan je notities”.

## Weer aanzetten (3 stappen)

1. Zet tegoed op beide accounts:
   - OpenAI: https://platform.openai.com/settings/organization/billing (± $0,006 per minuut audio)
   - Anthropic: https://console.anthropic.com/settings/billing (minimum $5)
2. Rol de functies uit (in de map met `firebase.json`):
   ```
   firebase login
   firebase use jos-harm-werkplaats
   firebase functions:secrets:set OPENAI_API_KEY
   firebase functions:secrets:set ANTHROPIC_API_KEY
   cd functions && npm install && cd ..
   firebase deploy --only functions
   ```
   Er moeten daarna `transcribeAudio` en `aiMessage` in **europe-west1** staan.
3. In `index.html` één regel omzetten:
   ```js
   const AI_ENABLED = false;   ->   const AI_ENABLED = true;
   ```
   Verhoog daarna `CACHE_NAME` in `sw.js` (bijv. v23) zodat de telefoon de nieuwe versie pakt.

De volledige code van alle AI-functies staat nog gewoon in `index.html` — alleen
uitgeschakeld door die ene schakelaar. `index-met-ai-assistent.html` is de bewaarde
versie waarin alles aan staat, als naslag.

## Kosten om rekening mee te houden
- Uittypen: ± €0,11 per 20 minuten gesprek.
- Verslag, mindmap, chat: enkele centen per keer.
- Elders in de app gebruiken “Advies” en “Haarden → snel toevoegen met AI” dezelfde
  Claude-functie; die staan hier los van en blijven ongewijzigd.
