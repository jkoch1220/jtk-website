// Zentrale Kontaktdaten – hier ändern, gilt für die ganze Seite.
export const kontakt = {
  firma: "JTK Consulting",
  name: "Julian Koch",
  email: "julian@jtkconsulting.de",
  telefonAnzeige: "+49 160 6102912",
  telefonLink: "tel:+491606102912",
  ort: "Düsseldorf",
};

export const mailBetreff = "Anfrage über jtkconsulting.de";

// Optional: Adresse, an die das Anfrageformular direkt sendet (z. B. ein n8n-Webhook).
// In einer Datei .env im Projektordner eintragen:  PUBLIC_ANFRAGE_URL=https://...
// Ohne Eintrag öffnet das Formular das E-Mail-Programm mit der fertigen Nachricht.
export const anfrageUrl: string = import.meta.env.PUBLIC_ANFRAGE_URL ?? "";
