// Datenmodell der Akten im Abschnitt 06 („Akteneinsicht“).
//
// Regeln, die index.ts beim Bauen prüft (siehe aktenPruefen):
// - jede Akte hat 5 bis 8 Kapitel, nach Datum sortiert, Wiedervorlagen zuletzt
// - jedes Kapitel hat mindestens einen Beleg; ohne Beleg kein Kapitel
// - Titel höchstens 44 Zeichen, Kurztitel höchstens 26, Text höchstens 360 Zeichen
// - höchstens ein roter Stempel je Akte (der laute Moment der Seite bleibt der Hero)
// - jedes Bild hat Alt-Text, Unterschrift, Aufnahmedatum und die Angabe, woher die Daten stammen
// - jeder Abzug im Bündel steht auch in der Akte (in einem Kapitel oder als Bild der Ausgangslage)
// - ein Vermerk steht dort, wo sein Datum hingehört: in der Ausgangslage nur vor dem ersten Kapitel,
//   im Kapitel zwischen dem vorigen und dem nächsten
// - Wörter aus den Sperrlisten kommen nicht vor; die heiklen liegen außerhalb des Repos (astro.config.mjs)
import type { ImageMetadata } from "astro";

export type AkteId = "tennismehl" | "koch" | "saalzentrum";

/** So genau, wie es belegt ist: Tag, Monat oder Jahr */
export interface Zeitpunkt {
  iso: string; // "2026-07-28" | "2026-06" | "2023"
  genau: "tag" | "monat" | "jahr";
}

/** verlauf: Versionsgeschichte, zaehlung: gezählt in Daten oder Export, bild: Bildschirm,
 *  dokument: Vorlage oder Beschreibung, aussage: Julian selbst */
export type Belegart = "verlauf" | "zaehlung" | "bild" | "dokument" | "aussage";

export interface Beleg {
  art: Belegart;
  /** sichtbar, klein: „Versionsgeschichte des Portals“ */
  text: string;
  /** Monat der Erhebung, JJJJ-MM */
  stand: string;
}

export interface Kennzahl {
  /** fertig gesetzt: „2.187“, „1 Klick“ */
  wert: string;
  text: string;
  beleg: Beleg;
}

/** geschwaerzt: echte Daten, Namen und Beträge im Bild geschwärzt; zahlen: echte Daten ohne Namen
 *  und Beträge, einzelne Zähler und Kennzahlen geschwärzt; ausgeblendet: dazu eine Datenreihe
 *  unsichtbar gemacht; angaben: einzelne Angaben wie Name und Adresse geschwärzt;
 *  beispiel: echte Oberfläche mit erfundenen Musterdaten, beispielZaehler: dazu Zähler geschwärzt;
 *  oeffentlich: öffentliche Seite;
 *  teilgeschwaerzt: öffentliche Seite, einzelne Titel geschwärzt; anmeldeseite: nur die Anmeldung,
 *  nichts dahinter; foto: Foto aus dem Betrieb, ohne Personen */
export type Daten = "geschwaerzt" | "zahlen" | "ausgeblendet" | "angaben" | "beispiel" | "beispielZaehler" | "oeffentlich" | "teilgeschwaerzt" | "anmeldeseite" | "foto";

export interface Bild {
  art: "desktop" | "handy" | "foto";
  src: ImageMetadata;
  /** was zu sehen ist und worauf es ankommt */
  alt: string;
  /** kurz, z. B. „Wochenplanung“; Datenhinweis und Monat hängt Abzug.astro an */
  unterschrift: string;
  /** Aufnahmedatum, JJJJ-MM-TT; bei Fotos ohne belegtes Datum leer */
  aufgenommen: string;
  daten: Daten;
  /** object-position für den Abzug im Bündel, wenn nicht die Bildmitte gemeint ist */
  ausschnitt?: string;
}

/** Ein Rufplan als Zeichnung: Stationen von links nach rechts */
export interface Rufplan {
  schritte: string[];
  alt: string;
}

/** Aktenvermerk: Julians eigene Worte, wörtlich zitiert. Auslassungen mit „…“, eigene Einfügungen
 *  in [eckigen Klammern]; am: Tag der Aussage, JJJJ-MM-TT */
export interface Vermerk {
  text: string;
  am: string;
}

export interface Stempel {
  /** höchstens 12 Zeichen, Versalien */
  oben: string;
  /** höchstens 22 Zeichen */
  unten?: string;
  farbe: "tinte" | "rot";
}

export interface Kapitel {
  /** Anker: #akte-<akte>-<id> */
  id: string;
  datum: Zeitpunkt | "wiedervorlage";
  /** ruht: begonnen, aber seit einer Weile ohne Fortschritt */
  stand: "erledigt" | "laeuft" | "ruht" | "offen";
  titel: string;
  /** für Register und Weiter-Knopf */
  kurz: string;
  text: string;
  bilder?: [Bild] | [Bild, Bild];
  rufplan?: Rufplan;
  /** rosa Lasche: wie es vorher lief */
  vorher?: string;
  /** gelber Zettel, genau eine Zahl */
  notiz?: Kennzahl;
  stempel?: Stempel;
  vermerk?: Vermerk;
  /** Querverweis in eine andere Akte */
  verweis?: { akte: AkteId; kapitel: string; text: string };
  /** id einer Zusage aus „Ihr Betrieb danach“ (src/data/zusagen.ts), die das Kapitel belegt */
  zusage?: string;
  belege: [Beleg, ...Beleg[]];
}

export interface Akte {
  id: AkteId;
  nr: "01" | "02" | "03";
  name: string;
  rolle: string;
  kontext: string;
  /** ein Satz: von … zu … */
  wandel: string;
  /** Plakette auf dem Deckel: „In Betrieb seit 01/2026“ */
  status: string;
  /** nur Ergebnisse, nie Aufwand */
  kennzahlen: [Kennzahl] | [Kennzahl, Kennzahl];
  /** zwei bis drei Abzüge für das Bündel; der Klick führt dorthin, wo das Bild in der Akte steht */
  vorschau: [Bild, Bild] | [Bild, Bild, Bild];
  /** großer Abzug im Sichtfenster auf dem Deckel; muss in einem Kapitel stehen, der Klick führt dorthin */
  fenster?: Bild;
  ausgangslage: { text: string; vermerk?: Vermerk; belege: Beleg[]; bild?: Bild };
  vorher: { kopf: string; zeilen: string[] };
  kapitel: Kapitel[];
  bilanz: {
    vorher: string[];
    nachher: string[];
    naechstes?: string;
    faden?: { text: string; akte: AkteId; kapitel: string };
  };
  /** Bänder im Arbeitsprotokoll, z. B. die Liefersaison */
  saison?: { von: string; bis: string; text: string }[];
  /** zusätzliche Wörter, die in dieser Akte nicht vorkommen dürfen */
  sperrliste?: string[];
}

export interface Protokoll {
  stand: string;
  zaehlweise: string;
  /** Wochenbeginn (Montag, JJJJ-MM-TT) → Zahl der Änderungen */
  akten: Record<AkteId, Record<string, number>>;
}
