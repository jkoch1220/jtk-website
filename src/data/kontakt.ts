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
