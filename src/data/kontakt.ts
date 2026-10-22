// Zentrale Kontaktdaten – hier ändern, gilt für die ganze Seite.
export const kontakt = {
  firma: "JTK Consulting",
  name: "Julian Koch",
  email: "julian@koch.consulting",
  telefonAnzeige: "+49 160 6102912",
  telefonLink: "tel:+491606102912",
  strasse: "Adersstraße 79",
  plz: "40215",
  ort: "Düsseldorf",
  // Umsatzsteuer-ID, sobald vom Finanzamt erteilt (z. B. "DE123456789"). Leer = Abschnitt im Impressum ausgeblendet.
  ustId: "",
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

// Öffentlicher Site-Key für Cloudflare Turnstile (Spam-Schutz der Buchung, scripts/turnstile.ts). Das Geheimnis
// dazu steht nur auf dem Server (TURNSTILE_SECRET des Website-Dienstes). Lokal gilt Cloudflares Test-Schlüssel,
// der immer besteht. Überschreiben in .env:  PUBLIC_TURNSTILE_SITE_KEY=...  Leer = ohne Prüfung.
export const turnstileSiteKey: string =
  import.meta.env.PUBLIC_TURNSTILE_SITE_KEY ?? (import.meta.env.DEV ? "1x00000000000000000000AA" : "0x4AAAAAAFg7x21-UEF9eSAq");
