// Aktenstapel im Hero: ein Arbeitstag der erfundenen Muster Haustechnik GmbH. Die erste Akte ist
// die bisherige Rechnung und ohne JavaScript das statische Bild (mit Stempel). Mit JavaScript
// stempelt der Besucher eine Akte nach der anderen ab, danach liegt die Tagesübersicht oben.
//
// Alle Firmen, Personen und Adressen sind erfunden. Bildunterschriften wiederholen nur Aussagen,
// die schon auf der Seite stehen (Leistungen, Zeitfresser-Check), keine neuen Versprechen.
// „{jahr}“ wird beim Bauen und im Browser durch das laufende Jahr ersetzt.
//
// Alle Akten haben dasselbe Gerüst (drei Meta-Felder, zwei Parteizeilen, drei Tabellenzeilen,
// drei Summenzeilen, Fuß). Sie liegen im selben Rasterfeld übereinander, so ist der Bogen immer
// gleich hoch und nichts springt beim Wechsel.
//
// Beträge, nachgerechnet:
// Rechnung {jahr}-0418: 170,00 (2 Std. × 85,00) + 214,50 + 45,00 = 429,50 netto,
//   19 % USt. = 81,605 → 81,61, gesamt 429,50 + 81,61 = 511,11.
// Angebot {jahr}-0231 und Rechnung {jahr}-0419 (gleiche Positionen, gleicher Stundensatz 85,00):
//   486,00 + 255,00 (3 Std. × 85,00) + 45,00 = 786,00 netto,
//   19 % USt. = 149,34, gesamt 786,00 + 149,34 = 935,34.

export type Feld = {
  dt: string;
  dd: string;
  // datum: heute, gestern: heute − 1 Tag (beides im Browser neu gesetzt)
  art?: "datum" | "gestern";
};

export type Akte = {
  // Kurzname für Knopf, Ansage und Tagesübersicht
  name: string;
  titel: string;
  absender: string;
  meta: [Feld, Feld, Feld];
  partei: { bezeichnung: string; zeilen: [string, string] };
  spalten: [string, string, string, string];
  zeilen: [string, string, string, string][];
  // Die letzte Zeile ist doppelt unterstrichen (Gesamt bzw. Status)
  summen: [Feld, Feld, Feld];
  fuss: string;
  plakette: string;
  stempel: string;
  bildunterschrift: string;
  // Kurzfassung für Screenreader
  kurz: string;
};

const ABSENDER = "Muster Haustechnik GmbH, Musterweg 3, 40878 Ratingen";
const POSITIONEN_SPALTEN: Akte["spalten"] = ["Pos.", "Bezeichnung", "Menge", "Betrag €"];
const PUMPE: Akte["zeilen"] = [
  ["1", "Hocheffizienz-Umwälzpumpe", "1 Stk.", "486,00"],
  ["2", "Austausch, Inbetriebnahme", "3 Std.", "255,00"],
  ["3", "Anfahrtspauschale", "1", "45,00"],
];
const MUSTERFRAU: [string, string] = ["Hausverwaltung Musterfrau", "Beispielallee 7, 40210 Düsseldorf"];

export const akten: Akte[] = [
  {
    name: "Rechnung {jahr}-0418",
    titel: "Rechnung",
    absender: ABSENDER,
    meta: [
      { dt: "Rechnungs-Nr.", dd: "{jahr}-0418" },
      { dt: "Datum", dd: "", art: "datum" },
      { dt: "Kunden-Nr.", dd: "10482" },
    ],
    partei: { bezeichnung: "Empfänger", zeilen: ["Mustermann Gebäudeservice GmbH", "Musterstraße 12, 41460 Neuss"] },
    spalten: POSITIONEN_SPALTEN,
    zeilen: [
      ["1", "Wartung Lüftungsanlage", "2 Std.", "170,00"],
      ["2", "Filtersatz F7", "1 Stk.", "214,50"],
      ["3", "Anfahrtspauschale", "1", "45,00"],
    ],
    summen: [
      { dt: "Netto", dd: "429,50" },
      { dt: "USt. 19 %", dd: "81,61" },
      { dt: "Gesamt", dd: "511,11 €" },
    ],
    fuss: "Zahlbar innerhalb von 14 Tagen ohne Abzug.",
    plakette: "E-Rechnung (ZUGFeRD)",
    stempel: "ERLEDIGT",
    bildunterschrift: "So entsteht Ihre nächste Rechnung: automatisch erstellt und als E-Rechnung verschickt.",
    kurz: "Rechnung der Muster Haustechnik an die Mustermann Gebäudeservice GmbH, drei Positionen, gesamt 511,11 Euro.",
  },
  {
    name: "Anfrage A-{jahr}-0231",
    titel: "Anfrage",
    absender: "Eingang über das Anfrageformular der Website",
    meta: [
      { dt: "Anfrage-Nr.", dd: "A-{jahr}-0231" },
      { dt: "Eingang", dd: "", art: "datum" },
      { dt: "Uhrzeit", dd: "07:42" },
    ],
    partei: { bezeichnung: "Von", zeilen: MUSTERFRAU },
    spalten: ["Pos.", "Anliegen", "Umfang", "Wunsch"],
    zeilen: [
      ["1", "Heizungspumpe brummt", "1 Anlage", "bald"],
      ["2", "Obere Etagen kalt", "3 Whg.", "–"],
      ["3", "Angebot erbeten", "–", "E-Mail"],
    ],
    summen: [
      { dt: "Kanal", dd: "Website" },
      { dt: "Kunde", dd: "Neukunde" },
      { dt: "Status", dd: "offen" },
    ],
    fuss: "Direkt im System angelegt.",
    plakette: "Website-Formular",
    stempel: "ERFASST",
    bildunterschrift: "Jede Anfrage landet direkt im System statt im Postfach.",
    kurz: "Anfrage der Hausverwaltung Musterfrau über die Website: Die Heizungspumpe brummt, oben wird es nicht warm, ein Angebot ist erbeten.",
  },
  {
    name: "Angebot {jahr}-0231",
    titel: "Angebot",
    absender: ABSENDER,
    meta: [
      { dt: "Angebots-Nr.", dd: "{jahr}-0231" },
      { dt: "Datum", dd: "", art: "datum" },
      { dt: "Kunden-Nr.", dd: "10517" },
    ],
    partei: { bezeichnung: "Empfänger", zeilen: MUSTERFRAU },
    spalten: POSITIONEN_SPALTEN,
    zeilen: PUMPE,
    summen: [
      { dt: "Netto", dd: "786,00" },
      { dt: "USt. 19 %", dd: "149,34" },
      { dt: "Gesamt", dd: "935,34 €" },
    ],
    fuss: "Gültig 30 Tage. Ausführung nach Absprache.",
    plakette: "aus Anfrage A-{jahr}-0231",
    stempel: "FREIGEGEBEN",
    bildunterschrift: "Mit wenigen Klicks machen Sie aus der Anfrage ein Angebot. Was rausgeht, entscheiden Sie.",
    kurz: "Angebot an die Hausverwaltung Musterfrau für den Tausch der Umwälzpumpe, drei Positionen, gesamt 935,34 Euro.",
  },
  {
    name: "Telefonnotiz A-{jahr}-0230",
    titel: "Telefonnotiz",
    absender: "Aufgenommen vom KI-Telefonassistenten",
    meta: [
      { dt: "Vorgang", dd: "A-{jahr}-0230" },
      { dt: "Anruf am", dd: "", art: "gestern" },
      { dt: "Uhrzeit", dd: "19:42" },
    ],
    partei: { bezeichnung: "Anrufer", zeilen: ["Beispiel Wohnbau KG", "Beispielstraße 8, 40477 Düsseldorf"] },
    spalten: ["Pos.", "Notiz", "Umfang", "Rückruf"],
    zeilen: [
      ["1", "Wartung Heizungsanlage", "6 Whg.", "–"],
      ["2", "Termin vor dem Winter", "–", "–"],
      ["3", "Rückruf erbeten", "–", "ab 8 Uhr"],
    ],
    summen: [
      { dt: "Dauer", dd: "2:15 Min." },
      { dt: "Kunde", dd: "Neukunde" },
      { dt: "Status", dd: "angelegt" },
    ],
    fuss: "Nach Feierabend angenommen.",
    plakette: "KI-Telefonassistent",
    stempel: "ÜBERNOMMEN",
    bildunterschrift:
      "Ein KI-Telefonassistent nimmt jeden Anruf an, auch nach Feierabend, und legt neue Anfragen im System an.",
    kurz: "Telefonnotiz von gestern Abend: Die Beispiel Wohnbau KG möchte eine Wartung der Heizungsanlage für sechs Wohnungen und bittet um Rückruf.",
  },
  {
    name: "Rechnung {jahr}-0419",
    titel: "Rechnung",
    absender: ABSENDER,
    meta: [
      { dt: "Rechnungs-Nr.", dd: "{jahr}-0419" },
      { dt: "Datum", dd: "", art: "datum" },
      { dt: "Kunden-Nr.", dd: "10517" },
    ],
    partei: { bezeichnung: "Empfänger", zeilen: MUSTERFRAU },
    spalten: POSITIONEN_SPALTEN,
    zeilen: PUMPE,
    summen: [
      { dt: "Netto", dd: "786,00" },
      { dt: "USt. 19 %", dd: "149,34" },
      { dt: "Gesamt", dd: "935,34 €" },
    ],
    fuss: "Zahlbar innerhalb von 14 Tagen ohne Abzug.",
    plakette: "E-Rechnung (ZUGFeRD)",
    stempel: "VERSENDET",
    bildunterschrift: "Aus dem Auftrag wird die Rechnung, und sie geht als E-Rechnung raus.",
    kurz: "Rechnung an die Hausverwaltung Musterfrau zum Angebot über den Pumpentausch, drei Positionen, gesamt 935,34 Euro.",
  },
];

// Ab hier der Stempel am Tagesende, der von selbst fällt
export const FEIERABEND = "FEIERABEND";

// Stempeltexte mit mehr Zeichen werden auf die Rahmenbreite gestaucht
export const STEMPEL_ZEICHEN_MAX = 8;

export const mitJahr = (text: string, jahr: number) => text.replaceAll("{jahr}", String(jahr));
export const hatJahr = (text: string) => text.includes("{jahr}");
