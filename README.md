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
   selbst (vorher gesichert, danach `caddy validate`, sonst zurück zum alten Stand). Fehlt `/api/ki/*` (Fassung vor
   den KI-Demos), ergänzt es die `@plattform`-Zeile ebenso und nimmt den Pfad von der Kompression aus; ist Caddy
   älter als 2.11.7, sagt es Bescheid (siehe „KI-Demos“). Leitet `koch.consulting`
   dort noch nicht per 301 auf `jtkconsulting.de` um (auch die Fassung vom 22.10.2026, in der es dieselbe Website
   zeigte), stellt es das um. Fehlt im `handle_errors` das `encode`, ergänzt es die Zeile, damit die 404-Seite
   komprimiert rausgeht. Außerdem
   begrenzt es das System-Journal (Caddys Fehlermeldungen mit IP-Adressen) auf 7 Tage.
3. Bei jeder Änderung danach: `npm run deploy`. Vor dem Hochladen prüft das Skript, ob der Server `/api/anfrage`
   und `/api/e` weiterleitet und der Website-Dienst antwortet; sonst bricht es ab, weil das Formular ins Leere ginge.
   Übergangsweise ohne Dienst: `PUBLIC_ANFRAGE_URL= npm run deploy` (Formular öffnet das E-Mail-Programm).
   Nach dem Hochladen fragt es `https://jtkconsulting.de/api/ki/status` ab und meldet nur, ob die KI-Demos bereit
   sind; daran scheitert kein Deploy, denn ohne Dienst zeigen die Demos ihre Meldung statt des Startknopfs.

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

## KI-Demos

Abschnitt 07 „Ausprobieren“ (`#ausprobieren`, zwischen Akteneinsicht und Ablauf) zeigt drei Programme, in denen eine
KI antwortet: Auftrags-Scanner, Büro-Röntgenblick und Probeanruf (KI-Telefonassistent eines erfundenen Betriebs). Sie
senden per `fetch` (POST, JSON) an `/api/ki/scanner`, `/api/ki/roentgen` und `/api/ki/telefon` auf derselben Domain
und lesen die Antwort als Server-Sent Events aus `response.body` (`start`, `stand`, `neu`, `fertig`, `fehler`).
`GET /api/ki/status` meldet, ob die Demos bereit sind und wie viele Durchläufe heute noch gehen. Caddy leitet
`/api/ki/*` an den Website-Dienst weiter; nur dort liegen der Anthropic-Schlüssel, der Schlüssel für den
Sprachdienst, die Prompts, Drossel und Budget (Vertrag in `website-dienst/API.md` im Portal-Repo). Nie
`EventSource` und keine Eingaben in GET-Parametern (die Begrüßung trägt nur Betrieb und Variante): Eingaben gehören
nicht in Adressen, die in Fehlermeldungen des Webservers landen können.

- **Ohne Dienst bleibt die Seite heil:** Ist er nicht erreichbar, kennt Caddy `/api/ki` noch nicht oder meldet der
  Dienst `bereit: false` (kein Schlüssel, Budget aufgebraucht), steht in den Programmen ein Satz statt des
  Startknopfs. Andere Adresse in `.env`: `PUBLIC_KI_URL=https://…` (eine andere Domain braucht CORS im Dienst);
  `PUBLIC_KI_URL=` (leer) schaltet die Demos ab, dann steht dort nur ein Hinweis.
- **Schutz:** Turnstile (Aktionen `ki-scanner`, `ki-roentgen`, `ki-telefon`; beim Probeanruf nur im ersten Zug),
  Durchläufe je IP und Tag, Tages- und Monatsbudget, alles im Dienst. Seine Meldungen zeigt die Demo je `code` an.
- **Datenschutz:** Eingaben, Transkripte und Antworten speichern weder Browser noch Dienst, und sie gehen nie in die
  Statistik (Datenschutzerklärung „KI-Demos“, Anker `#ki-demos`). Kein Browser-Speicher, auch nicht für die
  Zustimmung zur Spracheingabe oder das Gesprächs-Token des Probeanrufs. Spracheingabe nur auf Klick, erst auf dem
  Gerät, sonst nach Zustimmung. Vorlesen mit den Stimmen des Geräts oder, wenn der Dienst seine Stimme anbietet
  (`stimme.bereit` im Status), mit der künstlich erzeugten Stimme: Dann steht der Hinweis darauf schon vor dem
  Einschalten neben dem Schalter, und erst das Einschalten schickt Antworttext an den Sprachdienst. Scheitert sie,
  liest die Stimme des Geräts, ohne Meldung. „Ton aus“ heißt Stille: Ohne Ton liest keine Stimme vor, und der
  Telefonzug fordert die Stimme des Dienstes nicht an (`vorlesen: true` nur mit Vorlesen und Ton, sonst hält der
  Dienst keinen Antworttext bereit). Setzt Caddy später eine `Permissions-Policy`, muss sie
  `microphone=(self)` erlauben, sonst geht die Spracheingabe nicht.
- **Kennzeichnung (KI-VO Art. 50):** „KI“ in jeder Titelleiste, ein eigener KI-Hinweis an jedem Eingabefeld, „Die KI
  kann sich irren …“ unter jedem Ergebnis, Ansagen für Screenreader beginnen mit „Antwort der KI:“. Das Befund-PDF
  trägt Metadaten (Author „KI-Assistent von JTK Consulting“, Keywords „KI-generiert; AI-generated“). Den Anbieter
  nennt nur die Datenschutzerklärung.
- **Klänge:** neue Rezepte `freiton`, `taste`, `hoerer`, `scanner`, `roentgen` und `tippen` in
  `src/scripts/klang-rezepte.ts` (gerendert und vermessen, noch nicht abgehört). „Antwort kopieren“ trägt
  `data-klang-still`; der Probeanruf hat einen eigenen Ton-Schalter (`data-ton-schalter="Telefonassistent"`).

| Was | Datei |
| --- | --- |
| Abschnitt, Programmwahl, Hinweiszeile | `src/components/ki/KiLabor.astro`, `src/scripts/ki/ki.ts` (lädt Status und Programme erst in der Nähe per `import()`) |
| Programme | `src/components/ki/Auftragsscanner.astro`, `Roentgenblick.astro`, `TelefonSimulator.astro`; `src/scripts/ki/scanner.ts`, `roentgen.ts`, `telefon.ts` |
| Verbindung (POST, SSE, Zeitlimits, Fehlercodes) | `src/scripts/ki/verbindung.ts` |
| Gemeinsame Steuerung (Zustände, Fehlerkasten, Anhalten, Rückfrage bei Kontaktdaten), Schreibmaschine, Ansagen | `src/scripts/ki/anzeige.ts` |
| Spracheingabe und Vorlesen | `src/scripts/ki/sprache.ts` |
| Stimme des Probeanrufs (MP3 vom Dienst, gespielt über den AudioContext aus `klang.ts`) | `src/scripts/ki/stimme.ts` (`GET /api/ki/telefon/begruessung?variante=<betrieb>-<variante>`, `POST /api/ki/telefon/stimme` mit dem Token aus `event: fertig`) |
| Befund als PDF | `src/scripts/ki/befund-pdf.ts` (mit den Teilen aus `src/scripts/beleg-pdf.ts`) |
| Befund in „Worum geht es?“ übernehmen | `src/scripts/vorbelegen.ts` (Ereignis `anfrage:vorbelegen`, Handler in `seite.ts` und `termin.ts`) |
| Texte, Vorlagen, Beispiele, Betriebe | `src/data/ki-demos.ts` (die Begrüßungen am Telefon stehen wortgleich im Dienst) |
| Richtwerte wie im Zeitfresser-Check | `src/data/richtwerte.ts` (dieselben Werte im Dienst) |
| Musterbild Werkstatt-Zettel (erfunden) | `src/assets/ki/werkstatt-zettel.webp` (dieselbe Datei als Base64 im Dienst) |
| Stile | `src/styles/ki.css`, `ki-scanner.css`, `ki-roentgen.css`, `ki-telefon.css` (zusammen höchstens 40 KB minifiziert) |

Lokal testen mit der Attrappe des Dienstes (feste Antworten ohne Claude, ohne Schlüssel und Kosten):

```sh
# im Portal-Repo, Ordner website-dienst
KI_ATTRAPPE=1 GEODATEN=aus npm run dev      # Port 3100
# hier
npm run dev
```

Läuft der Dienst auf einem anderen Port: `JTK_DIENST_URL=http://localhost:3121 npm run dev` (Ziel des Vite-Proxys in
`astro.config.mjs`). Testschalter am Anfang eines eigenen Texts: `[attrappe:abgelehnt]`, `[attrappe:zeit]`,
`[attrappe:abbruch]`, `[attrappe:unvollstaendig]`, `[attrappe:fehler]`, `[attrappe:ueberlastet]` und
`[attrappe:ausweichen]`; nur im Auftrags-Scanner zusätzlich `[attrappe:themenfremd]` (Fall „kein Auftrag“, eigener
Text ab 20 Zeichen). Die Grenzen je Adresse (Scanner 5, Röntgenblick 5, Probeanruf 3 Gespräche am Tag, 10 Versuche
je Minute) hält der Dienst nur im Speicher; ein Neustart setzt sie zurück, für viele Läufe `KI_LIMIT_SCANNER=100`
usw. Gegen die echte API prüft `npm run ki:probe` im Website-Dienst.

## Besucher-Statistik

`src/scripts/tracking.ts` misst die Nutzung ohne Cookies und ohne Speicher im Browser: Seitenaufruf,
Herkunft (nur die Domain), Kampagnenparameter (`utm_*`), sichtbare Zeit, Scrolltiefe, gesehene Abschnitte (`section[id]`), Klicks auf Schaltflächen und
Links, den Zeitfresser-Check, die KI-Demos (nur Schritte, nie Inhalte) und den Beginn des Formulars. Die Ereignisse gehen gesammelt per
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

**Nutzung der Seite.** Was Besucher bedienen, meldet jeder Teil selbst über `nutzung("Bereich", "Aktion")`
aus `src/scripts/nutzung.ts` (nur ein DOM-Ereignis, keine Abhängigkeit vom Tracking). `tracking.ts` zählt je
„Bereich: Aktion“ und schickt je Aufruf einen Stand (Ereignis `nutzung`: Anzahl, Zeitpunkt des ersten Mals,
größter `wert`, letztes `detail`), 5 s nach der letzten Aktion, alle 30 s und beim Verlassen; höchstens 60
verschiedene Aktionen je Aufruf. Dazu `abschnitt_zeit`: wie lange jeder Abschnitt im Bild war. Ein Element mit
`data-gesehen="Bereich: Aktion"` meldet sich einmal, sobald es zur Hälfte zu sehen ist (Bergbild, freie Termine).
Das Portal zeigt alles unter „Anfragen → Statistik“ (Nutzung der Seite, Trichter, abgebrochene Buchungen) und
je Besuch unter „Letzte Besuche“.

| Bereich | Wo gemeldet | Beispiele |
| --- | --- | --- |
| Hero | `beleg-stempel.ts` | Akte gestempelt (Maus/Touch/Tastatur), Stempel in die Hand genommen, alle Akten abgelegt |
| Problem | `meldungen.ts` | Knopf „OK“, Fenster mit × geschlossen, Antwort „Ja“, alle Meldungen weggeklickt (Sekunden) |
| Check | `zeitfresser.ts` | Karte gewischt, Rückgängig, Richtwerte geöffnet, Beleg ausgestellt |
| Berge | `berge-buehne.ts`, `Persoenlich.astro` | Bild gesehen, ins Bild geklickt, Strudel zum Knall gebracht, Pixel gewischt, neu gezeichnet |
| Akten | `praxis-lesetisch.ts` | Akte 01 aufgeschlagen (Einstieg), geblättert (weiteste Seite), gelesen (Sekunden), Bild vergrößert |
| Termin | `termin.ts`, `Anfrage.astro` | Zeiten angezeigt, Uhrzeit gewählt, Feld „Name“ begonnen, Absenden geklickt, Hinweis, gebucht |
| Anfrage | `seite.ts` | Feld „Nachricht“ begonnen, Absenden geklickt, gesendet, vom Dienst abgelehnt, aus dem Check vorbelegt, aus dem Röntgenblick vorbelegt |
| Ausprobieren | `ki/ki.ts` | Programm gewechselt (detail scanner, roentgen oder telefon) |
| Auftrags-Scanner | `ki/scanner.ts` | Demo gesehen, Vorlage Baustellen-Mail / Werkstatt-Zettel / Altsystem-CSV gewählt, eigener Text begonnen, Auswertung gestartet (Vorlage), Auswertung fertig (Sekunden; vollständig oder mit Warnhinweisen), Antwort-Mail kopiert |
| Röntgenblick | `ki/roentgen.ts` | Demo gesehen, Beispiel gewählt (zettel, angebote, telefon), Beschreibung begonnen, Diagnose gestartet (Beispiel, eigener Text, Spracheingabe), Diagnose fertig (Stunden pro Woche), Befund ausgestellt, Befund als PDF geladen, PDF gescheitert, Termin mit Befund gewünscht |
| Telefonassistent | `ki/telefon.ts` | Demo gesehen, Anruf gestartet, Satz gewählt (Zug; Satz-ID), eigener Satz gesendet (Zug), Ticket fertig (Zug; Notfall, dringend, normal), Gespräch beendet (Züge; aufgelegt, Höchstzahl erreicht, vom Assistenten beendet) |
| alle drei Demos | `ki/anzeige.ts`, `ki/sprache.ts` | nicht verfügbar (aus, pause), vom Dienst abgelehnt (429) bzw. mit dem jeweiligen HTTP-Status, vom Dienst abgebrochen, Verbindung gescheitert, jeweils mit festem Wort wie Limit, Budget, Zeitlimit oder Netz; Röntgenblick und Telefonassistent: Spracheingabe gestartet (auf dem Gerät, über den Browser-Dienst) oder nicht möglich; Telefonassistent: Vorlesen eingeschaltet, ausgeschaltet |
| Ton, Design | `klang.ts`, `tracking.ts` | eingeschaltet (Ort Kopf, Taskleiste oder Telefonassistent), dunkel geschaltet |
| Kopf, Hero, Ablauf … | `tracking.ts` | Knopf „…“ und Link „…“ mit dem Abschnitt, in dem sie stehen |

Regeln: Bereich und Aktion sind feste Wörter (Wechselndes in `detail` oder `wert`, sonst wird die Statistik
unlesbar). **Nie Eingaben** von Besuchern melden, nur Schritte und Feldnamen. Die Trichter-Schritte
„Termin: Zeiten angezeigt / Uhrzeit gewählt / Angaben begonnen / Absenden geklickt“ und „Anfrage: Absenden
geklickt“ stehen auch im Dienst (`TERMIN_SCHRITTE`, `ANFRAGE_ABSENDEN` in `statistik.ts`) – umbenennen nur
gemeinsam. Neue Messpunkte in die Liste in `src/pages/datenschutz.astro` aufnehmen, wenn sie dort nicht schon
gedeckt sind.

Knöpfe und Links in `[data-ki-demo]` zählt `tracking.ts` nicht generisch, die Demos melden feste Aktionen selbst
(je Modul `const BEREICH` und ein Union-Typ der Aktionen); nie Eingaben, Antworten der KI oder Felder der
Telefonnotiz. Ein fester Klick läuft über `data-klickziel`: „Auftrags-Scanner: Meinen Fall besprechen“,
„Röntgenblick: Termin mit Befund“, „Telefonassistent: Assistent anfragen“. Die Bereiche „Termin“ und „Anfrage“
gehören den Trichtern und den abgebrochenen Buchungen; andere Teile melden dort nichts (einzige Ausnahme ist
„Anfrage: aus dem Röntgenblick vorbelegt“ aus `seite.ts`). Bereich höchstens 30 Zeichen ohne Doppelpunkt, Aktion
höchstens 80, sonst verwirft der Dienst still.

Lokal: Website-Dienst mit `npm run dev` in `~/Workspace/kochConsultingPlatform/website-dienst` starten (Port 3100), dann hier
`npm run dev`. Der Vite-Proxy in `astro.config.mjs` leitet `/api` dorthin (anderer Port: `JTK_DIENST_URL`, siehe
„KI-Demos“). Läuft der Dienst nicht, gehen Statistik, Formular und KI-Demos ins Leere; die Seite selbst funktioniert
trotzdem.

Auf dem Server leitet `deploy/Caddyfile` (bzw. `npm run einrichten`) nur `/api/anfrage`, `/api/e`,
`/api/gesundheit`, `/api/termine` (samt `/api/termine/*`) und `/api/ki/*` an `127.0.0.1:3100` weiter; alle anderen `/api/*` beantwortet Caddy mit 404. Die
Portal-API des Dienstes ist nur über `app.koch.consulting` erreichbar. `/api/ki/*` geht unkomprimiert durch
(`@komprimieren`) und bewusst ohne `flush_interval`: Server-Sent Events reicht Caddy von selbst sofort durch, und nur
so bricht er die Anfrage an den Dienst ab, wenn der Besucher geht (dann endet auch der Aufruf bei Anthropic). Auf dem
VPS muss mindestens Caddy 2.11.7 laufen, denn 2.11.6 bricht Streams auf POST über HTTP/1.1 nach 60 s ab. Für nginx
steht dasselbe in `deploy/nginx.conf` (`proxy_buffering off`, `gzip off`, `proxy_read_timeout 120s`).

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
| KI-Demos (Abschnitt 07) | `src/components/ki/`, `src/scripts/ki/`, Texte in `src/data/ki-demos.ts` (Übersicht unter „KI-Demos“); Dienst: `website-dienst/src/oeffentlich/ki.ts` und `src/lib/server/ki/` im Portal-Repo |
| Ton (Rezepte, Synthese, Abspielen) | `src/scripts/klang.ts` (Fassade), `klang-rezepte.ts`, `klang-werk.ts`, `klang-begruessung.ts` |
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
- [ ] Datenschutz „KI-Demos“ rechtlich prüfen lassen: die Stellen mit `[PRÜFEN]` im Quelltext von
      `src/pages/datenschutz.astro` (Rechtsgrundlage, Spracheingabe nach § 25 TDDDG, Speicherfristen bei Anthropic,
      DPF-Status), danach `Stand:` auf den Monat des Livegangs setzen
- [ ] Anthropic-Konto: Vertragspartner Anthropic Ireland (Rechnungsadresse in Deutschland), Auftragsverarbeitung
      (DPA) mit Datum ablegen; DPF-Status von Anthropic auf dataprivacyframework.gov nachsehen
- [ ] Anthropic Console: eigener Workspace für die Demos mit eigenem Schlüssel und einem Ausgabenlimit über dem
      Monatsbudget des Website-Dienstes, Inferenzort `us`
- [ ] Caddy auf dem VPS mindestens 2.11.7 (`caddy version`), danach `npm run einrichten` für `/api/ki/*`
- [ ] Neue Klänge (freiton, taste, hoerer, scanner, roentgen, tippen) abgehört, am besten auch am Handy; danach den
      Herkunftsnachweis in `src/scripts/klang-rezepte.ts` anpassen
- [ ] Musterbild Werkstatt-Zettel: gerendert lassen oder durch ein echtes, abgeschriebenes Foto ersetzen (gleiche
      Datei auch im Dienst)
