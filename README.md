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
   Steht `jtkconsulting.de` dort schon ohne Weiterleitung von `/api/anfrage` und `/api/e`, bricht es ab: den Block in
   `/etc/caddy/Caddyfile` durch den aus `deploy/Caddyfile` ersetzen und erneut ausführen. Fehlt in einem
   bestehenden Block nur `/api/termine` (Fassung vor der Terminbuchung), ergänzt es die `@plattform`-Zeile
   selbst (vorher gesichert, danach `caddy validate`, sonst zurück zum alten Stand). Leitet `koch.consulting`
   dort noch nicht per 301 auf `jtkconsulting.de` um (auch die Fassung vom 22.10.2026, in der es dieselbe Website
   zeigte), stellt es das um. Fehlt im `handle_errors` das `encode`, ergänzt es die Zeile, damit die 404-Seite
   komprimiert rausgeht. Außerdem
   begrenzt es das System-Journal (Caddys Fehlermeldungen mit IP-Adressen) auf 7 Tage.
3. Bei jeder Änderung danach: `npm run deploy`. Vor dem Hochladen prüft das Skript, ob der Server `/api/anfrage`
   und `/api/e` weiterleitet und der Website-Dienst antwortet; sonst bricht es ab, weil das Formular ins Leere ginge.
   Übergangsweise ohne Dienst: `PUBLIC_ANFRAGE_URL= npm run deploy` (Formular öffnet das E-Mail-Programm).

## Eigenes Foto einbinden

Ein Foto als `public/julian.jpg` ablegen und neu bauen. Es erscheint im Abschnitt „Ihr Ansprechpartner“
(`#ueber-mich`) statt der Berge, automatisch im Zweifarb-Raster der Seite. Am besten ein Porträt mit ruhigem,
hellem Hintergrund im Hochformat.

## Anfrageformular

Das Formular schickt per POST ein JSON an `/api/anfrage` auf derselben Domain. Caddy leitet `/api/anfrage` an den
Website-Dienst weiter (`website-dienst/` im Portal-Repo `~/Workspace/kochConsultingPlatform`, Port 3100). Er speichert die Anfrage, schickt mir eine
Hinweis-Mail und dem Absender eine kurze Bestätigung (ohne seine Nachricht). Felder: `name`, `firma`, `email`,
`telefon`, `nachricht`, `seite` (nur Origin und Pfad), `website` (Honigtopf), `check` (Ergebnis des
Zeitfresser-Checks oder `null`), `aufruf` (ID des Seitenaufrufs, nur für den Zähler „Anfrage gesendet“ in der
Statistik) und `dauer` (ms seit dem Laden der Seite). Anfragen unter 3 s verwirft der Dienst als Spam,
deshalb wartet das Formular notfalls kurz. Fehlermeldungen des Dienstes zeigt das Formular in seiner
Statuszeile an. Lesen und bearbeiten lassen sich die Anfragen im Koch Consulting Portal unter „Anfragen“.

Andere Adresse: in einer Datei `.env` im Projektordner eintragen.

```
PUBLIC_ANFRAGE_URL=https://deine-adresse/api/anfrage
```

Liegt die Adresse auf einer anderen Domain, muss sie Anfragen von jtkconsulting.de erlauben (CORS).
Mit `PUBLIC_ANFRAGE_URL=` (leer) öffnet das Formular stattdessen das E-Mail-Programm mit der fertigen Nachricht.

## Besucher-Statistik

`src/scripts/tracking.ts` misst die Nutzung ohne Cookies und ohne Speicher im Browser: Seitenaufruf,
Herkunft (nur die Domain), Kampagnenparameter (`utm_*`), sichtbare Zeit, Scrolltiefe, gesehene Abschnitte (`section[id]`), Klicks auf Schaltflächen und
Links, den Zeitfresser-Check und den Beginn des Formulars. Die Ereignisse gehen gesammelt per
`sendBeacon` an `/api/e`, ebenfalls an den Website-Dienst; das Dashboard steht im Koch Consulting Portal unter
„Anfragen → Statistik“. Der Dienst speichert keine IP-Adressen und erkennt Besucher nur innerhalb eines Tages wieder (Details in der
Datenschutzerklärung). Geräteeigenschaften wie Sprache oder Bildschirmbreite liest das Skript bewusst nicht
aus; die Sprache leitet der Dienst aus dem `Accept-Language`-Kopf ab. Wer etwas am Skript ändert, muss
die Liste in `src/pages/datenschutz.astro` mitziehen.

Vom Zeitfresser-Check gehen zwei Ereignisse raus, jeweils 1,5 s nach der letzten Änderung (spätestens beim
Verlassen der Seite): `check_stand` mit allen Angaben, auch ohne Ergebnis (jede Karte von Hand, digital oder
unsortiert, Mengen und ob der Regler selbst bewegt wurde, Team, Stundensatz, Durchrutscher, Wünsche, Ergebnis;
Format `CheckStand` in `website-dienst/API.md`, gebaut in `standFuerStatistik` in `src/scripts/zeitfresser.ts`),
und wie bisher `check_fertig` mit dem Ergebnis. Jeden Check einzeln samt CSV-Export zeigt das Portal unter
„Anfragen → Checks“. Neue Karten, Felder oder Wünsche im Check landen dort von selbst; ändert sich die Form
des Stands, ziehen Dienst (`standPruefen`) und Portal mit.

Lokal: Website-Dienst mit `npm run dev` in `~/Workspace/kochConsultingPlatform/website-dienst` starten (Port 3100), dann hier
`npm run dev`. Der Vite-Proxy in `astro.config.mjs` leitet `/api` dorthin. Läuft der Dienst nicht,
gehen Statistik und Formular ins Leere; die Seite selbst funktioniert trotzdem.

Auf dem Server leitet `deploy/Caddyfile` (bzw. `npm run einrichten`) nur `/api/anfrage`, `/api/e`,
`/api/gesundheit` und `/api/termine` (samt `/api/termine/*`) an `127.0.0.1:3100` weiter; alle anderen `/api/*` beantwortet Caddy mit 404. Die
Portal-API des Dienstes ist nur über `app.koch.consulting` erreichbar.

## Suchmaschinen

Die Seite gibt es nur unter `https://jtkconsulting.de`. `koch.consulting` und alle `www.`-Adressen leiten per 301
dorthin (`deploy/Caddyfile`), Mail und `app.koch.consulting` betrifft das nicht.

- `public/robots.txt`: Alle Suchmaschinen und KI-Crawler dürfen alles lesen, auch zum Training (Entscheidung vom
  23.10.2026). Darin der Verweis auf die Sitemap.
- `dist/sitemap.xml` schreibt die kleine Integration in `astro.config.mjs` beim Bauen, mit allen Seiten außer der 404.
  Neue Seiten kommen von selbst dazu.
- Strukturierte Daten (JSON-LD) stehen nur auf der Startseite und kommen aus `src/data/strukturdaten.ts`:
  Website, Firma (`Organization`) und Person. Alles dort muss auch sichtbar auf der Seite stehen, deshalb ohne
  Straße und Postleitzahl (die private Adresse steht nur im Impressum).
  Neue Profile (LinkedIn, Google-Unternehmensprofil, Verzeichnisse) in `kontakt.profile` eintragen, sie werden
  zu `sameAs`. Nach Änderungen auf https://validator.schema.org prüfen.
- Title, Description und die Dachzeile in der h1 der Startseite nennen Leistung und Ort („IT-Beratung … in
  Düsseldorf“). Die Marke heißt überall „JTK Consulting“, nie nur „JTK“ und ohne „Koch Consulting“.
- Search Console und Bing Webmaster Tools brauchen kein Skript auf der Seite (Bestätigung per DNS-TXT).

## Wo was steht

| Was | Datei |
| --- | --- |
| E-Mail, Telefon, Ort, Profile für Suchmaschinen | `src/data/kontakt.ts` |
| Strukturierte Daten (JSON-LD) | `src/data/strukturdaten.ts` |
| Sitemap, robots.txt | `astro.config.mjs`, `public/robots.txt` |
| Texte der Startseite (Erfolg, Begleiter, Projekte, Plan) | `src/pages/index.astro` |
| Problem-Meldungen | `src/components/Problem.astro` |
| Zeitfresser-Check | `src/components/Zeitfresser.astro` |
| Terminbuchung (Erstgespräch) | `src/components/Anfrage.astro`, `src/scripts/termin.ts`; Zeiten und Dauer im Portal unter „Erstgespräche“ |
| Anfrageformular | `src/components/Anfrage.astro` |
| Rechnung im Hero | `src/components/Beleg.astro` |
| Berge oder Foto | `src/components/Persoenlich.astro` |
| Farben, Schrift, Abstände | `src/styles/global.css` (der Kommentar oben erklärt das System) |
| Animation, Check-, Formular- und Bildlogik | `src/scripts/seite.ts` |
| Besucher-Statistik | `src/scripts/tracking.ts` |
| BrandScript (Texte für Website, PDF, LinkedIn) | `docs/brandscript.md` |

## Vor dem Livegang

- [ ] Postfach `julian@koch.consulting` prüfen oder die Adresse in `src/data/kontakt.ts` ändern
- [ ] Impressum und Datenschutz ausfüllen (`src/pages/impressum.astro`, `src/pages/datenschutz.astro`)
- [ ] Projekttexte prüfen: was ist fertig, was noch in Arbeit
- [ ] Kundennamen nur mit deren Einverständnis nennen
- [ ] Optional: Foto, Kundenstimmen, echte Screenshots aus Projekten
- [ ] Datenschutz: Begründung zu § 25 TDDDG (Reichweitenmessung ohne Einwilligung) rechtlich prüfen lassen
- [ ] Google Workspace: Hinweis- und Bestätigungsmails nach spätestens 12 Monaten löschen (Gmail-Filter mit
      Label plus Aufbewahrungsregel in Vault), wie in der Datenschutzerklärung zugesagt
