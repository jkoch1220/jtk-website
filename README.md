# JTK Consulting – Website

Startseite für jtkconsulting.de, aufgebaut nach StoryBrand (siehe `docs/brandscript.md`).
Gebaut mit Astro 7, GSAP und Lenis. Die Schriften (Mona Sans, Jersey 10) liegen auf dem eigenen Server,
es werden keine Google-Dienste geladen.

## Lokal starten

```sh
npm install
npm run dev
```

Dann im Browser: http://localhost:4321

## Bauen

```sh
npm run build
```

Das Ergebnis liegt in `dist/`: reine statische Dateien, kein Node-Server nötig.

## Auf den VPS bringen

1. Bei GoDaddy unter DNS die A-Records für `@` durch einen einzigen A-Record mit der IP des VPS ersetzen.
   `www` zeigt per CNAME schon auf `@`.
2. Einmalig: `npm run einrichten`. Das Skript installiert Caddy auf dem VPS, legt den Ordner an,
   trägt die Seite ein (HTTPS kommt automatisch) und lädt sie hoch. Ist Port 80/443 schon von einem
   anderen Programm belegt, bricht es ab, ohne etwas zu ändern. Dann stattdessen `deploy/nginx.conf` nutzen.
3. Bei jeder Änderung danach: `npm run deploy`.

## Eigenes Foto einbinden

Ein Foto als `public/julian.jpg` ablegen und neu bauen. Es erscheint im Abschnitt „Ich kenne das Problem
von innen“ statt der Berge, automatisch im Zweifarb-Raster der Seite. Am besten ein Porträt mit ruhigem,
hellem Hintergrund im Hochformat.

## Anfrageformular direkt senden lassen

Ohne Einstellung öffnet das Formular das E-Mail-Programm des Besuchers mit der fertigen Nachricht.
Damit Anfragen direkt ankommen (zum Beispiel in einem n8n-Workflow oder im eigenen Portal), eine Datei
`.env` im Projektordner anlegen:

```
PUBLIC_ANFRAGE_URL=https://deine-adresse/webhook/anfrage
```

Das Formular schickt dann per POST ein JSON mit `name`, `firma`, `email`, `telefon`, `nachricht` und `seite`.
Die Adresse muss Anfragen von jtkconsulting.de erlauben (CORS). Den Empfänger in der Datenschutzerklärung nennen.

## Wo was steht

| Was | Datei |
| --- | --- |
| E-Mail, Telefon, Ort | `src/data/kontakt.ts` |
| Texte der Startseite (Erfolg, Begleiter, Projekte, Plan) | `src/pages/index.astro` |
| Problem-Meldungen | `src/components/Problem.astro` |
| Zeitfresser-Check | `src/components/Zeitfresser.astro` |
| Anfrageformular | `src/components/Anfrage.astro` |
| Rechnung im Hero | `src/components/Beleg.astro` |
| Berge oder Foto | `src/components/Persoenlich.astro` |
| Farben, Schrift, Abstände | `src/styles/global.css` (der Kommentar oben erklärt das System) |
| Animation, Check-, Formular- und Bildlogik | `src/scripts/seite.ts` |
| BrandScript (Texte für Website, PDF, LinkedIn) | `docs/brandscript.md` |

## Vor dem Livegang

- [ ] Postfach `julian@jtkconsulting.de` anlegen oder die Adresse in `src/data/kontakt.ts` ändern
- [ ] Impressum und Datenschutz ausfüllen (`src/pages/impressum.astro`, `src/pages/datenschutz.astro`)
- [ ] Projekttexte prüfen: was ist fertig, was noch in Arbeit
- [ ] Kundennamen nur mit deren Einverständnis nennen
- [ ] Optional: Foto, Kundenstimmen, echte Screenshots aus Projekten
