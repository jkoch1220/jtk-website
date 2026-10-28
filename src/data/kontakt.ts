// Zentrale Kontaktdaten – hier ändern, gilt für die ganze Seite.
export const kontakt = {
  firma: "JTK Consulting",
  name: "Julian Koch",
  // Voller Name: dafür steht „JTK“. Sichtbar im Über-mich-Absatz, dazu alternateName in src/data/strukturdaten.ts.
  nameVoll: "Julian Tim Koch",
  email: "julian@koch.consulting",
  telefonAnzeige: "",
  telefonLink: "",
  strasse: "Adersstraße 79",
  plz: "40215",
  ort: "Düsseldorf",
  // Umsatzsteuer-ID, sobald vom Finanzamt erteilt (z. B. "DE123456789"). Leer = Abschnitt im Impressum ausgeblendet.
  ustId: "",
  // Öffentliche Profile derselben Firma bzw. Person (LinkedIn, Google-Unternehmensprofil, XING, Verzeichnisse).
  // Landen als sameAs in den strukturierten Daten; nur eintragen, was es wirklich gibt.
  profile: [] as string[],
};

export const mailBetreff = "Anfrage über jtkconsulting.de";

// Adresse, an die das Anfrageformular sendet. Standard ist die Koch-Plattform auf derselben Domain
// (Caddy leitet /api/* weiter, im Dev der Vite-Proxy aus astro.config.mjs).
// Überschreiben in einer Datei .env im Projektordner:  PUBLIC_ANFRAGE_URL=https://...
// Bleibt der Wert leer (PUBLIC_ANFRAGE_URL=), öffnet das Formular das E-Mail-Programm mit der fertigen Nachricht.
// deploy/deploy.sh prüft vor dem Hochladen, ob der Server /api/* wirklich an die Plattform weiterleitet.
export const anfrageUrl: string = import.meta.env.PUBLIC_ANFRAGE_URL ?? "/api/anfrage";

// Basisadresse der Terminbuchung im Website-Dienst (GET {terminUrl}/frei, POST {terminUrl}).
// Überschreiben in .env:  PUBLIC_TERMIN_URL=https://...  Leer (PUBLIC_TERMIN_URL=) = keine Buchung,
// dann zeigt die Seite nur das Anfrageformular. Ist der Dienst aus oder der Kalender nicht verbunden,
// passiert dasselbe von selbst (Antwort aktiv=false).
export const terminUrl: string = import.meta.env.PUBLIC_TERMIN_URL ?? "/api/termine";

// Basisadresse der KI-Demos im Website-Dienst (GET {kiUrl}/status, POST {kiUrl}/scanner, /roentgen, /telefon;
// Abschnitt 07 „Ausprobieren“, scripts/ki/). Überschreiben in .env:  PUBLIC_KI_URL=https://...  Eine andere Domain
// bräuchte CORS im Dienst. Leer (PUBLIC_KI_URL=) = die Demos zeigen nur einen Hinweis statt des Startknopfs, etwa
// solange der Dienst die Demos noch nicht kennt.
export const kiUrl: string = import.meta.env.PUBLIC_KI_URL ?? "/api/ki";

// Öffentlicher Site-Key für Cloudflare Turnstile (Spam-Schutz der Buchung, scripts/turnstile.ts). Das Geheimnis
// dazu steht nur auf dem Server (TURNSTILE_SECRET des Website-Dienstes). Lokal gilt Cloudflares Test-Schlüssel,
// der immer besteht. Überschreiben in .env:  PUBLIC_TURNSTILE_SITE_KEY=...  Leer = ohne Prüfung.
export const turnstileSiteKey: string =
  import.meta.env.PUBLIC_TURNSTILE_SITE_KEY ?? (import.meta.env.DEV ? "1x00000000000000000000AA" : "0x4AAAAAAFg7x21-UEF9eSAq");
