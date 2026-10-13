# JTK Consulting – Website

Startseite für jtkconsulting.de. Gebaut mit Astro 7, GSAP und Lenis.
Die Schrift (Mona Sans) liegt auf dem eigenen Server, es werden keine Google-Dienste geladen.

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

**Mit Caddy** (holt das HTTPS-Zertifikat automatisch):

1. Bei GoDaddy A-Records für `jtkconsulting.de` und `www.jtkconsulting.de` auf die IP des VPS setzen.
2. Auf dem VPS: `apt install caddy` und `mkdir -p /var/www/jtkconsulting`.
3. Den Inhalt von `deploy/Caddyfile` in `/etc/caddy/Caddyfile` übernehmen, dann `systemctl reload caddy`.
4. Vom Mac aus: `npm run deploy` baut die Seite und lädt `dist/` per rsync hoch.

Läuft auf dem VPS schon ein anderer Webserver auf Port 80/443 (zum Beispiel Nginx für andere Projekte),
dort stattdessen einen Server-Block ergänzen. Vorlage: `deploy/nginx.conf`.

## Wo was steht

| Was | Datei |
| --- | --- |
| E-Mail, Telefon, Ort | `src/data/kontakt.ts` |
| Texte der Startseite | `src/pages/index.astro` |
| Checkliste („Was läuft bei Ihnen noch von Hand?“) | `src/components/Checkliste.astro` |
| Rechnung im Hero | `src/components/Beleg.astro` |
| Farben, Schrift, Abstände | `src/styles/global.css` (der Kommentar oben erklärt das System) |
| Animation und Checklisten-Logik | `src/scripts/seite.ts` |

## Vor dem Livegang

- [ ] Postfach `julian@jtkconsulting.de` anlegen oder die Adresse in `src/data/kontakt.ts` ändern
- [ ] Impressum und Datenschutz ausfüllen (`src/pages/impressum.astro`, `src/pages/datenschutz.astro`)
- [ ] Projekttexte prüfen: was ist fertig, was noch in Arbeit
- [ ] Kundennamen nur mit deren Einverständnis nennen
- [ ] Optional: Porträtfoto und echte Screenshots für die Projekte
