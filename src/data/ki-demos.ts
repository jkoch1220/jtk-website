// Inhalte der drei KI-Demos in Abschnitt 07 „Ausprobieren“ (components/ki/, scripts/ki/): Vorlagen des
// Auftrags-Scanners, Schnellauswahl des Büro-Röntgenblicks, die zwei Betriebe des Probeanrufs und alle festen
// Beschriftungen (Stempel, Fußzeilen, KI-Hinweise, Fehlersätze).
//
// Feste Beschriftungen stehen hier und kommen nie aus der Modellausgabe: KI-Hinweise, Stempel, Fußzeile und die
// Begrüßung am Telefon kann die KI so nicht verändern (Kennzeichnungspflicht nach Art. 50 KI-Verordnung). Keine
// Zeile hier nennt den KI-Anbieter; das tut nur die Datenschutzerklärung.
//
// Alle Firmen, Personen, Adressen und Nummern sind erfunden. Telefonnummern stammen nur aus den Filmrufnummern der
// Bundesnetzagentur (Köln 0221 4710000 bis 0221 4710999, mobil 0171 3920000 bis 0171 3920099 und 0176 04069000 bis
// 0176 04069099), Mailadressen nur von example.com. Die rohen Vorlagen (Mail, Export, Zettel) bilden die echte Welt
// ab: Gerade Anführungszeichen, Tippfehler, „!!“ und Dialekt sind dort Absicht. Alle anderen Texte folgen der
// Typografie der Seite (geschütztes Leerzeichen zwischen Zahl und Einheit, „…“, keine Pfeile).
//
// Funktionen bekommen Zahlen schon formatiert (scripts/ki/anzeige.ts formatiert wie der Zeitfresser-Check); nur wo
// die Grammatik an der Anzahl hängt, kommt die Zahl selbst.
//
// Der Dienst (website-dienst/src/lib/server/ki/telefon.ts) kennt dieselben Betriebe, Begrüßungen (wortgleich) und
// Öffnungszeiten: Sein System-Prompt erzählt, wie der Anruf angenommen wurde. Welche Begrüßung galt
// (begruessungsVariante), schickt der Probeanruf im ersten Zug mit (variante). Ändert sich hier etwas daran, dort
// mitziehen.

export type ProgrammId = "scanner" | "roentgen" | "telefon";

/** Verweis mit festem Ziel auf der Seite */
export interface Verweis {
  text: string;
  ziel: string;
}

/* Abschnitt ------------------------------------------------------------------------------------- */

export const KI_LABOR = {
  nr: "07",
  rand: "Ausprobieren",
  dachzeile: "07 · Ausprobieren",
  ueberschrift: "Sie probieren es aus, bevor Sie sich festlegen",
  lead:
    "Sie wollen sehen, was KI im Büro wirklich kann, bevor Sie mit jemandem sprechen. Hier probieren Sie es selbst: " +
    "mit einer wirren Kundenmail, einem Zettel vom Monteur, einem alten Export oder Ihrem eigenen Ablauf. Alles läuft " +
    "live, Fehler inklusive. Die KI bereitet vor, Sie entscheiden.",
  // Hinweiszeile unter den Programmen; die Rest-Durchläufe hängt das Skript an (HINWEISE.rest)
  hinweiszeile: {
    text: "Hier antwortet eine KI, kein Mensch. Bitte keine echten Kundendaten eingeben. Was mit Ihren Eingaben passiert:",
    link: { text: "Datenschutz", ziel: "/datenschutz/#ki-demos" } satisfies Verweis,
  },
  noscript: "Die KI-Demos brauchen JavaScript. Schreiben Sie mir sonst einfach über das Formular unten.",
  // Kleine Marke, wenn der Dienst im Attrappenmodus antwortet (nur lokal)
  attrappe: "Attrappe",
} as const;

/* Programme ------------------------------------------------------------------------------------- */

export interface Programm {
  id: ProgrammId;
  /** Reiter der Programmwahl */
  reiter: string;
  /** Titelleiste: „KI“ steht als Text darin (dauerhafte Kennzeichnung) */
  fenstertitel: string;
  /** Zwischenüberschrift (h3) und ein Satz darunter */
  titel: string;
  einleitung: string;
  /** Eigener KI-Hinweis direkt am Eingabefeld: Ein Sammelhinweis für den Abschnitt reicht nicht */
  kiHinweis: string;
  /** Turnstile-Aktion, prüft der Dienst exakt */
  aktion: "ki-scanner" | "ki-roentgen" | "ki-telefon";
}

export const PROGRAMM_REIHENFOLGE: readonly ProgrammId[] = ["scanner", "roentgen", "telefon"];

export const PROGRAMME: Record<ProgrammId, Programm> = {
  scanner: {
    id: "scanner",
    reiter: "Auftrags-Scanner",
    fenstertitel: "Auftrags-Scanner · KI",
    titel: "Sie tippen die Mail nicht mehr ab",
    einleitung:
      "Sie wählen eine Vorlage oder fügen eigenen Text ein, die KI macht daraus einen Auftrag für Ihre Warenwirtschaft, markiert, was fehlt, und schreibt die Antwort vor.",
    kiHinweis: "Eine KI liest den Text und füllt den Auftrag aus. Ergebnisse können Fehler enthalten, bitte prüfen.",
    aktion: "ki-scanner",
  },
  roentgen: {
    id: "roentgen",
    reiter: "Büro-Röntgenblick",
    fenstertitel: "Büro-Röntgenblick · KI",
    titel: "Sie sehen, wo Ihr Ablauf hakt",
    einleitung:
      "Sie beschreiben in ein, zwei Sätzen, was Sie im Büro am meisten nervt, und sehen, wo es hakt, was bleiben darf und was es Sie im Jahr kostet. Ehrlich, auch wenn die Antwort lautet: Dafür brauchen Sie niemanden.",
    kiHinweis:
      "Die Diagnose schreibt eine KI aus Ihrer Beschreibung. Julian Koch hat sie nicht gesehen. Zahlen sind grobe Schätzungen.",
    aktion: "ki-roentgen",
  },
  telefon: {
    id: "telefon",
    reiter: "Probeanruf",
    fenstertitel: "Probeanruf · KI",
    titel: "Sie verpassen keinen Anruf mehr",
    // „sehen“ statt „hören“: Vorlesen ist aus, bis der Besucher es einschaltet
    einleitung:
      "Sie rufen bei einem erfundenen Betrieb an und sehen, wie ein KI-Telefonassistent das Gespräch führt. Daneben entsteht die Telefonnotiz, so wie sie in Ihrem System landen würde.",
    kiHinweis:
      "Simulation: Am Telefon ist eine KI, kein Mensch. Der Betrieb ist erfunden, bitte erfundene Namen und Nummern verwenden.",
    aktion: "ki-telefon",
  },
};

/* Hinweise für alle drei Programme -------------------------------------------------------------- */

export const HINWEISE = {
  /** Über jeder Eingabe */
  keineEchtenDaten: "Bitte keine echten Kundendaten eingeben. Ein ausgedachtes Beispiel reicht.",
  /** Unter jedem Ergebnis (Hinweispflicht: Aussagen der KI ungeprüft nicht verlässlich) */
  unterErgebnis: "Die KI kann sich irren. Bitte prüfen Sie die Angaben.",
  /** Statusleiste rechts, solange ein Ergebnis steht */
  statusleiste: "KI-Entwurf · Sie entscheiden",
  /** Einmal im Abschnitt, etwa unter dem Lead */
  live: "Alles läuft live. Die KI irrt sich manchmal, genau deshalb entscheidet am Ende ein Mensch.",
  /** Ansagen für Screenreader beginnen damit, sobald die KI spricht */
  ansage: "Antwort der KI:",
  /** Grobe Prüfung eigener Texte vor dem Senden: nichts davon wird gemeldet oder gespeichert */
  kontaktdaten: {
    frage: "Das sieht nach echten Kontaktdaten aus. Für die Demo reichen erfundene.",
    trotzdem: "Trotzdem senden",
    aendern: "Ändern",
  },
  /** Zustände, die alle Programme haben */
  bereit: "Bereit",
  prueft: "Sicherheitsprüfung …",
  /** Rest der Durchläufe heute (aus /api/ki/status bzw. dem letzten Lauf) */
  rest(anzahl: number): string {
    if (anzahl <= 0) return "Für heute sind die Durchläufe aufgebraucht.";
    return anzahl === 1 ? "Heute noch 1\u00a0Durchlauf." : `Heute noch ${anzahl}\u00a0Durchläufe.`;
  },
} as const;

/* Auftrags-Scanner: Vorlagen -------------------------------------------------------------------- */

export type VorlageId = "baustellen-mail" | "werkstatt-zettel" | "altsystem-csv";

interface VorlageGemeinsam {
  id: VorlageId;
  /** Dateiname auf der Karte (Pixelschrift). Erfunden: Die Vorlage ist keine Datei zum Herunterladen */
  dateiname: string;
  kurzname: string;
  unterzeile: string;
  /** Wort für die Messung („Vorlage … gewählt“, detail bei „Auswertung gestartet“) */
  messname: "Baustellen-Mail" | "Werkstatt-Zettel" | "Altsystem-CSV";
}

/** Text-Vorlage: Der Browser schickt den Text mit ({ art: "text", vorlage, text }) */
export interface TextVorlage extends VorlageGemeinsam {
  art: "text";
  text: string;
}

/** Bild-Vorlage: Das Bild liegt im Dienst, der Browser schickt nur { art: "bild", vorlage }. Angezeigt wird
 *  src/assets/ki/werkstatt-zettel.webp (dieselbe Datei, Import in der Komponente über astro:assets). */
export interface BildVorlage extends VorlageGemeinsam {
  art: "bild";
  alt: string;
  /** Beschriftung des aufklappbaren Textes unter dem Bild */
  abschriftTitel: string;
  /** Volle Abschrift für Screenreader und als Beweis, dass die KI nichts erfindet */
  abschrift: string;
}

export type Vorlage = TextVorlage | BildVorlage;

// Bauleiter bestellt beim Baustoffhandel. Absichtlich: Artikelnummer fehlt („wie beim letzten
// Mal“), keine Hausnummer, keine Postleitzahl, keine Handynummer, „Mülheim“ ist in NRW doppeldeutig, Mengen
// schwanken, Termin relativ, Sie und du gemischt, Zusatzleistung im PS.
const BAUSTELLEN_MAIL = `Von: Kalle <bauleitung@example.com>
Betreff: AW: AW: Material für Mülheim!!

Tach zusammen,

wie mit Ihrem Kollegen am Telefon besprochen (der Junge, Name weiß ich grad nich), brauchen wir für die Baustelle in Mülheim nächste Woche nochmal Material. Wichtig: Der Kran is nur Donnerstag von 7 bis 10 Uhr da, danach is der weg. Also bitte pünktlich, sonst stehen meine Jungs dumm rum.

- Kalksandsteine, die gleichen wie beim letzten Mal, so 6 oder 7 Paletten, eher 7
- Mörtel, 40 Sack, oder lieber 50, wat ihr halt dahabt
- Stürze 1,25 m, 8 Stück
- dat Dichtzeug im gelben Eimer, 3 Eimer

Lieferung bitte an die Baustelle Musterstraße Ecke Beispielweg, Hausnummer weiß ich nich, da steht ein Bauschild. Zufahrt von hinten, vorne is Halteverbot.

Rechnung wie immer an uns. Wenn wat is, ruf mich aufm Handy an, die Nummer habt ihr ja.

PS: Nehmt die leeren Paletten vom letzten Mal wieder mit, die stehen im Weg.

Gruß
Kalle

--
Musterbau Rhein GmbH
Bauleitung`;

// Export einer alten Warenwirtschaft der Beispiel Baustoffe KG, Semikolon, Datum JJMMTT.
// Die Umlaute sind echte Mojibake (UTF-8 als cp1252 gelesen: „ß“ wird „ÃŸ“ mit U+0178, kein Steuerzeichen, das
// der Dienst entfernen würde). Absichtlich: Position 3 von A26-4471 doppelt, Liefertermin 000000 (offen),
// Retoure mit negativer Menge, Nullpreis, Storno. A26-4471 ist die Bestellung aus der Baustellen-Mail, so wie sie
// im alten Programm landete. Legende nur für Tests, die KI bekommt sie nicht: SA Satzart (A Auftrag, R Retoure,
// S Storno), PS Position, MG Menge, ME Einheit, EPR Einzelpreis netto, RB Rabatt in %, LA Lieferart (K mit
// Kranentladung, A Abholung, F frei Baustelle).
const ALTSYSTEM_CSV = `SA;KDNR;KDKURZ;AUFNR;AUFDT;LFDT;PS;ARTNR;ARTBEZ;MG;ME;EPR;RB;LA;LFADR
A;10482;MUSTERBAU RHEIN;A26-4471;261027;261105;1;400117;KS L 2DF 240 12-1,4;7;PAL;189,00;12;K;Bst. MusterstraÃŸe/Ecke Beispielweg, KÃ¶ln-MÃ¼lheim
A;10482;MUSTERBAU RHEIN;A26-4471;261027;261105;2;400311;MOE MG IIA 40KG;50;SCK;6,85;12;K;
A;10482;MUSTERBAU RHEIN;A26-4471;261027;261105;3;400905;KS-STURZ FL 125;8;STK;24,10;12;K;
A;10482;MUSTERBAU RHEIN;A26-4471;261027;261105;3;400905;KS-STURZ FL 125;8;STK;24,10;12;K;
A;20931;BEISPIEL DACH KG;A26-4472;261027;000000;1;710042;BRECHSAND 0/2 LOSE;2400;KG;0,04;0;A;
R;20931;BEISPIEL DACH KG;A26-4472;261027;000000;2;990001;EUROPAL TAUSCH;-6;STK;12,50;0;A;
A;30077;GALABAU MUSTER;A26-4469;261026;261029;1;520188;PFL BET GR 20/10/8;3;PAL;0,00;0;F;BeispielstraÃŸe 8, 50999 KÃ¶ln
S;30077;GALABAU MUSTER;A26-4469;261026;261029;2;520190;PFL BET ANTH 20/10/8;2;PAL;139,40;5;F;`;

// Was auf dem Werkstatt-Zettel steht, Zeile für Zeile wie auf dem Bild. In eckigen Klammern,
// was die Abschrift nur beschreiben kann. Die fehlende Ziffer liegt im Filmrufnummern-Block (0221 4710103 bis
// 0221 4710193). Das Bild erzeugt ein Werkzeug außerhalb des Repos (Handschrift-Schrift, Karopapier, Kaffeerand).
const WERKSTATT_ZETTEL_ABSCHRIFT = `Di. 9:40
Fr. Mustermann (Hausverw. Musterfrau weiß Bescheid)
Musterstr. 14, 2. OG li.
Klingel geht nich [Pfeil] Nachbarin unten
Tel. 0221 / 47 10 1[Ziffer unter Kaffeefleck]3     ab 17 h

Bad:
- Spülkasten läuft nach, Füllventil def.
- Eckventil WT tropft, 3/8" ?
- Siphon WT 1 1/4" verkalkt, tauschen
- Dusche: Dichtung unten 88 cm (Glas 8 mm)
Küche: Spüle läuft schlecht ab,
evtl. Rohr reinigen

Mat.: Füllventil (Typ? [Pfeil] Foto), Eckventil,
Siphon 1 1/4", Dichtung 88
Arb.-Zeit ca. 1,5 Std. + Anfahrt
Kd. will KVA vorher !! [doppelt unterstrichen]
nä. Termin: [durchgestrichen: Mi.] Do. od. Fr. vorm. [eingekreist]
[Kürzel]`;

export const VORLAGEN_REIHENFOLGE: readonly VorlageId[] = ["baustellen-mail", "werkstatt-zettel", "altsystem-csv"];

export const VORLAGEN = {
  "baustellen-mail": {
    id: "baustellen-mail",
    art: "text",
    dateiname: "baustelle_dringend.eml",
    kurzname: "Baustellen-Mail",
    unterzeile: "Bauleiter bestellt zwischen Tür und Angel.",
    messname: "Baustellen-Mail",
    text: BAUSTELLEN_MAIL,
  },
  "werkstatt-zettel": {
    id: "werkstatt-zettel",
    art: "bild",
    dateiname: "zettel_monteur.jpg",
    kurzname: "Werkstatt-Zettel",
    unterzeile: "Handschrift, Kaffeerand, eine Ziffer fehlt.",
    messname: "Werkstatt-Zettel",
    alt: "Handgeschriebener Notizzettel eines Monteurs auf Karopapier, blauer Kugelschreiber, leicht schräg. Ein Kaffeerand verdeckt eine Ziffer der Telefonnummer.",
    abschriftTitel: "Zettel als Text",
    abschrift: WERKSTATT_ZETTEL_ABSCHRIFT,
  },
  "altsystem-csv": {
    id: "altsystem-csv",
    art: "text",
    // 8.3-Großschreibung: Schon am Namen sieht man, wie alt das Programm ist
    dateiname: "AUFEXP01.CSV",
    kurzname: "Alter Export",
    unterzeile: "Semikolons, Kürzel, kaputte Umlaute.",
    messname: "Altsystem-CSV",
    text: ALTSYSTEM_CSV,
  },
} satisfies Record<VorlageId, Vorlage>;

/** Vierte Karte: eigener Text (vorlage: null) */
export const VORLAGE_EIGEN = {
  kurzname: "Eigener Text",
  unterzeile: "Ausgedachtes Beispiel einfügen.",
  messname: "eigener Text",
} as const;

export const istVorlageId = (wert: unknown): wert is VorlageId =>
  typeof wert === "string" && (VORLAGEN_REIHENFOLGE as readonly string[]).includes(wert);

/* Auftrags-Scanner: Oberfläche ------------------------------------------------------------------ */

export type Vorgang = "bestellung" | "angebotsanfrage" | "reklamation" | "lieferabruf" | "sonstiges";

export const SCANNER = {
  // Gleiche Grenzen wie die Prüfung im Dienst (Zeichen nach Bereinigung)
  grenzen: { textMin: 20, textMax: 3000 },
  /** Schritttitel im Fenster (h4) */
  schritte: { eingang: "Was bei Ihnen reinkommt", ausgang: "Was die KI daraus macht" },
  vorlagenLegende: "Vorlage wählen",
  /** Name der eigenen Scrollfläche einer Vorlage (für Screenreader) */
  vorschau: (kurzname: string) => `Vorlage: ${kurzname}`,
  eingabe: {
    label: "Ihr Text",
    platzhalter: "Fügen Sie eine Mail, eine Notiz oder einen Export ein. Namen und Nummern bitte erfinden.",
    /** „312 von 3.000 Zeichen“ */
    zaehler: (anzahl: string, hoechstens: string) => `${anzahl} von ${hoechstens}\u00a0Zeichen`,
  },
  start: "Auftrag daraus machen",
  anhalten: "Anhalten",
  liest: "Liest …",
  /** Statusleiste nach dem Lauf, mit gemessener Dauer */
  fertig: (sekunden: number) => `Fertig nach ${sekundenText(sekunden)} · KI-Entwurf`,
  reiter: {
    auftrag: "Auftrag (Entwurf)",
    antwort: "Antwort an den Kunden (Entwurf)",
    kosten: "Was Sie das Abtippen kostet",
  },
  /** Kleine Marke über jeder Ausgabe */
  kiMarke: "Von der KI erstellt",
  /** Dieselbe Marke über der Antwort */
  antwortMarke: "Antwortentwurf der KI",
  /** Ausgabefläche vor dem ersten Lauf */
  leer: "Hier steht gleich der Auftrag, den die KI daraus macht.",
  /** Name der Reiterleiste über dem Ergebnis (für Screenreader) */
  ergebnisReiter: "Ergebnis der KI",
  /** Solange die KI noch am Auftrag schreibt */
  antwortWarten: "Die Antwort schreibt die KI, sobald der Auftrag steht.",
  vorgang: "Vorgang",
  vorgaenge: {
    bestellung: "Bestellung",
    angebotsanfrage: "Angebotsanfrage",
    reklamation: "Reklamation",
    lieferabruf: "Lieferabruf",
    sonstiges: "Sonstiges",
  } satisfies Record<Vorgang, string>,
  // Felder in der Reihenfolge des Ergebnisses (kunde, lieferung)
  kopf: {
    firma: "Kunde",
    ansprechpartner: "Ansprechpartner",
    telefon: "Telefon",
    email: "E-Mail",
    kundennummer: "Kunden-Nr.",
    adresse: "Lieferadresse",
    termin: "Liefertermin",
    hinweise: "Hinweise zur Lieferung",
  },
  positionen: {
    titel: "Positionen",
    spalten: { pos: "Pos.", menge: "Menge", einheit: "Einheit", artikel: "Artikel", artikelnummer: "Art.-Nr.", anmerkung: "Hinweis" },
    unklar: "unklar",
    /** Leere Zelle, wenn die KI fertig ist */
    leer: "–",
  },
  /** Leeres Feld im Auftrag */
  fehlt: "fehlt",
  offen: "Was Sie noch klären müssen",
  /** Die KI nennt nichts, was offen ist */
  offenLeer: "Die KI findet nichts, was fehlt. Prüfen Sie trotzdem jede Zeile.",
  antwort: {
    betreff: "Betreff",
    kopieren: "Antwort kopieren",
    kopiert: "Kopiert",
    markiert: "Text unten markiert",
  },
  stempel: { entwurf: "ENTWURF", freigegeben: "FREIGEGEBEN" },
  /** Der Stempel als Satz für Screenreader (das SVG ist versteckt) */
  stempelText: { entwurf: "Stempel: Entwurf.", freigegeben: "Stempel: Freigegeben." },
  freigeben: "Freigeben",
  /** Nach dem Freigeben: Die Freigabe bleibt in der Demo, gesendet wird nichts */
  freigegeben: "Freigegeben, nur hier auf der Seite. Gesendet wird nichts.",
  /** Ansagen für Screenreader; was von der KI kommt, bekommt davor HINWEISE.ansage */
  ansagen: {
    start: "Die KI liest mit und füllt den Auftrag aus.",
    /** „Auftrag fertig: 5 Positionen, 4 Punkte zu klären.“ */
    fertig: (positionen: number, offen: number) =>
      `Auftrag fertig: ${positionen === 1 ? "1 Position" : `${positionen} Positionen`}, ${
        offen === 0 ? "nichts zu klären" : offen === 1 ? "1 Punkt zu klären" : `${offen} Punkte zu klären`
      }.`,
    freigegeben: "Auftrag freigegeben. Gesendet wird nichts.",
    kopiert: "Antwort kopiert.",
  },
  andereVorlage: "Andere Vorlage",
  eigenerText: "Eigenen Text probieren",
  cta: "Meinen Fall besprechen",
  /** Steckt im Text kein Auftrag (Rückfall, wenn die KI keinen eigenen Satz liefert) */
  keinAuftrag: "Darin findet die KI keinen Auftrag. Nehmen Sie eine Vorlage oder eine Bestellung mit erfundenen Namen.",
  kosten: {
    /** Kleine Marke über der Tafel */
    marke: "Grobe Schätzung",
    /** Solange die KI noch schreibt */
    warten: "Die Rechnung steht hier, sobald die KI fertig ist.",
    regler: "Wie oft kommt so etwas bei Ihnen rein?",
    reglerMin: 1,
    reglerMax: 100,
    reglerStart: 30,
    reglerWert: (vorgaenge: number) => (vorgaenge === 1 ? "1\u00a0Vorgang pro Woche" : `${vorgaenge}\u00a0Vorgänge pro Woche`),
    /** Große Zeile: „Rund 9.900 € im Jahr“ */
    gross: (euro: string) => `Rund ${euro} im Jahr`,
    /** Dieselbe Zeile in Teilen, der Betrag dazwischen groß wie auf der Tafel des Checks */
    vor: "Rund",
    nach: "im Jahr",
    /** Neben der großen Zahl am Regler */
    reglerEinheit: (vorgaenge: number) => (vorgaenge === 1 ? "Vorgang pro Woche" : "Vorgänge pro Woche"),
    darunter: (vorgaenge: number, stunden: string) =>
      `kostet Sie das Abtippen bei ${vorgaenge === 1 ? "einem solchen Vorgang" : `${vorgaenge} solchen Vorgängen`} pro Woche. Das sind rund ${stunden} Arbeitsstunden.`,
    /** „30 pro Woche × 12 Min. × 44 Wochen = 264 Std., rund 11.880 € im Jahr“ */
    rechenweg: (vorgaenge: string, minuten: string, wochen: string, stunden: string, euro: string) =>
      `${vorgaenge} pro Woche × ${minuten}\u00a0Min. × ${wochen}\u00a0Wochen = ${stunden}\u00a0Std., rund ${euro} im Jahr`,
    fussKi: (sekunden: number) =>
      `Die KI hat ${sekundenText(sekunden)} gebraucht. Prüfen und freigeben bleibt Ihre Sache, das kostet weiter ein paar Minuten.`,
    fussMinuten: (minuten: string) => `Von Hand dauert so ein Vorgang rund ${minuten}\u00a0Minuten (Schätzung der KI).`,
    fussGrundlage: (stundensatz: string, wochen: string) =>
      `Gerechnet mit ${stundensatz}\u00a0€ pro Stunde und ${wochen} Arbeitswochen, wie im Zeitfresser-Check.`,
  },
} as const;

function sekundenText(sekunden: number): string {
  const s = Math.max(1, Math.round(sekunden));
  return s === 1 ? "1\u00a0Sekunde" : `${s}\u00a0Sekunden`;
}

/* Büro-Röntgenblick: Schnellauswahl ------------------------------------------------------------- */

export type BeispielId = "zettel" | "angebote" | "telefon";

export interface Beispiel {
  /** Auch detail der Messung „Beispiel gewählt“ */
  id: BeispielId;
  knopf: string;
  /** So spricht ein Inhaber; der Text landet im Textfeld */
  text: string;
}

// Plausible Antworten zum Prüfen der Prompts: Zettel 3 bis 6 Std./Woche (Stufe 1), Angebote 4 bis 8 (Stufe 1 oder 2),
// Telefon 5 bis 8 (Stufe 1; „nach 16 Uhr“ darf im Fazit auf den Probeanruf zeigen)
export const ROENTGEN_BEISPIELE: readonly Beispiel[] = [
  {
    id: "zettel",
    knopf: "Zettelwirtschaft Monteure",
    text: "Meine Monteure schreiben Stunden und Material auf Zettel, die irgendwann im Transporter oder auf meinem Schreibtisch landen. Freitags sitzt das Büro stundenlang dran, das abzutippen, und die Hälfte kann keiner lesen.",
  },
  {
    id: "angebote",
    knopf: "Excel-Chaos bei Angeboten",
    text: "Für jedes Angebot kopieren wir eine alte Excel-Datei und suchen die Preise zusammen, das dauert fast eine halbe Stunde. Welche Version beim Kunden liegt, weiß hinterher keiner, und nachgefasst wird nur, wenn einer dran denkt.",
  },
  {
    id: "telefon",
    knopf: "Telefon klingelt ständig",
    text: "Bei uns klingelt den ganzen Tag das Telefon, meistens wegen „Wann kommt meine Lieferung?“. Wer rangeht, kommt zu nichts anderem, und nach 16 Uhr geht keiner mehr ran.",
  },
];

/* Büro-Röntgenblick: Oberfläche ----------------------------------------------------------------- */

export const ROENTGEN = {
  // Gleiche Grenzen wie die Prüfung im Dienst
  grenzen: { beschreibungMin: 15, beschreibungMax: 600, brancheMax: 60, teamMin: 1, teamMax: 10_000 },
  eingabe: {
    /** Schritttitel über dem Feld */
    titel: "Ihr Ablauf",
    label: "Was nervt Sie im Büro am meisten?",
    platzhalter: "Zum Beispiel: Unsere Monteure schreiben Stunden auf Zettel, und freitags tippt sie jemand ab.",
    hilfe: "Ein, zwei Sätze reichen.",
    zaehler: (anzahl: string, hoechstens: string) => `${anzahl} von ${hoechstens}\u00a0Zeichen`,
  },
  branche: { label: "Branche", optional: "(optional)", platzhalter: "Zum Beispiel: Sanitär und Heizung" },
  team: { label: "Teamgröße", optional: "(optional)", einheit: "Personen" },
  beispiele: "Oder nehmen Sie ein Beispiel:",
  /** Ansage, nachdem ein Beispiel ins Feld gesetzt wurde (der Fokus bleibt auf dem Knopf) */
  beispielEingesetzt: (knopf: string) => `Beispiel „${knopf}“ steht im Feld.`,
  start: "Ablauf durchleuchten",
  anhalten: "Anhalten",
  durchleuchtet: "Durchleuchtet …",
  fertig: "Befund fertig",
  /** Statusleiste rechts */
  grundlage: (stundensatz: string) => `Geschätzt mit ${stundensatz}\u00a0€ pro Stunde`,
  ergebnis: {
    ueberschrift: "KI-Befund",
    /** Leere Ergebnisfläche vor dem ersten Lauf */
    leer: "Hier steht gleich der Befund: wo es hakt, was bleiben darf, was es kostet.",
    diagnose: "Der Flaschenhals",
    // Im Code heißt es altsystem, in der Oberfläche „alte Programme“
    bleibt: "Darf bleiben",
    davor: "Davor kommt",
    ist: "So läuft es heute",
    bremse: "Bremse",
    soll: "So könnte es laufen",
    hebel: "Hebel",
    // Verbindung der SOLL-Spalte zu dem, was bleiben darf
    schnittstelle: "Schnittstelle zum alten Programm",
    groessterHebel: "Größter Hebel",
    fazit: "Ehrliches Fazit",
  },
  kacheln: {
    /** „rund 6 Stunden pro Woche gehen dafür drauf“; anzahl nur für die Einzahl */
    stunden: (stunden: string, anzahl: number) =>
      anzahl === 1 ? "rund 1\u00a0Stunde pro Woche geht dafür drauf" : `rund ${stunden}\u00a0Stunden pro Woche gehen dafür drauf`,
    stundenUnterzeile: "Schätzung der KI aus Ihrer Beschreibung",
    euro: (euro: string) => `rund ${euro} im Jahr kostet Sie das`,
    /** „6 Std. × 44 Wochen × 45 €“ */
    euroUnterzeile: (stunden: string, wochen: string, stundensatz: string) =>
      `${stunden}\u00a0Std. × ${wochen}\u00a0Wochen × ${stundensatz}\u00a0€`,
    fuss: "Vorsichtig geschätzt, kein Versprechen. Wie viel davon wegfällt, zeigt erst ein genauer Blick.",
  },
  /** Unter einer Rückfrage der KI, wenn sie den Ablauf nicht erkennt */
  zuUngenau: "Ein Satz mehr hilft.",
  ausstellen: "Befund als Beleg ausstellen",
  neuAusstellen: "Neuen Befund ausstellen",
  pdf: "Als PDF speichern",
  termin: "Termin mit dieser Problembeschreibung buchen",
  nochmal: "Anderen Ablauf durchleuchten",
  // Block für „Worum geht es?“ bei Termin und Anfrage: Kopfzeile plus genau vier einzeilige Zeilen, ohne Links und
  // Mailadressen. Die Kopfzeile beginnt mit KOPF_ROENTGEN aus scripts/vorbelegen.ts; daran erkennt das Formular
  // den Block und ersetzt ihn beim nächsten Klick, statt ihn zu doppeln.
  vorbelegen: {
    kopfZusatz: "(KI-Schätzung, nicht geprüft):",
    ablauf: "Ablauf:",
    flaschenhals: "Flaschenhals laut KI:",
    bleibt: "Darf bleiben:",
    schaetzung: (stunden: string, anzahl: number, euro: string) =>
      `Grobe Schätzung: rund ${stunden}\u00a0${anzahl === 1 ? "Stunde" : "Stunden"} pro Woche, rund ${euro} im Jahr.`,
  },
} as const;

/* Büro-Röntgenblick: Stufen (die Seite zeigt die Stufe aus rechnung, Grenzen in richtwerte.ts) ------ */

export type StufeSchluessel = "entwarnung" | "kein_muss" | "lohnt_sich" | "dringend";

export interface Stufe {
  schluessel: StufeSchluessel;
  dachzeile: string;
  titel: string;
  /** Unten im Befund-Stempel (oben steht immer BEFUND.stempelOben), höchstens 20 Zeichen; Wörter des Checks */
  stempelUnten: string;
  /** „Nächster Schritt“ im PDF, höchstens rund 60 Zeichen */
  naechsterSchritt: string;
}

// Index = Stufe (Anzahl der Grenzen, die der Betrag erreicht). Ehrlich auch nach unten: Wer gut aufgestellt ist,
// soll das hören, das macht die hohen Stufen glaubwürdig.
export const STUFEN: readonly [Stufe, Stufe, Stufe, Stufe] = [
  {
    schluessel: "entwarnung",
    dachzeile: "Entwarnung",
    titel: "Dafür brauchen Sie keinen Koch.",
    stempelUnten: "ENTWARNUNG",
    naechsterSchritt: "Keiner. Probieren Sie den Tipp aus dem Fazit.",
  },
  {
    schluessel: "kein_muss",
    dachzeile: "Läuft",
    titel: "Läuft. Ein paar Handgriffe reichen.",
    stempelUnten: "LÄUFT",
    naechsterSchritt: "Die Handgriffe aus dem Fazit selbst angehen.",
  },
  {
    schluessel: "lohnt_sich",
    dachzeile: "Lohnt sich vielleicht",
    titel: "Ein Gespräch kann sich lohnen. Kein Muss.",
    stempelUnten: "VORMERKEN",
    naechsterSchritt: "Wenn Sie mögen: Erstgespräch, 15\u00a0Minuten, unverbindlich.",
  },
  {
    schluessel: "dringend",
    dachzeile: "Bald angehen",
    titel: "Diesen Ablauf sollten Sie bald angehen.",
    stempelUnten: "DRINGEND",
    naechsterSchritt: "Kostenloses Erstgespräch, 15\u00a0Minuten, am besten heute.",
  },
];

/* Büro-Röntgenblick: Befund als Beleg und PDF ---------------------------------------------------- */

// Kein Sachverständigen-Ton, keine Unterschrift, nicht im Namen von Julian Koch: Der Befund sagt überall, dass eine
// KI ihn gemacht und noch kein Mensch draufgeschaut hat.
export const BEFUND = {
  kopf: "Büro-Röntgenblick · erstellt vom KI-Assistenten von JTK Consulting",
  titel: ["Befund:", "Wo Ihr Ablauf hakt"] as const,
  nummer: { label: "Befund-Nr.", praefix: "RB" },
  datum: "Datum",
  geprueft: { label: "Geprüft", wert: "noch niemand" },
  spalten: { schritt: "Schritt", ist: "So läuft es heute", soll: "So könnte es laufen" },
  /** Unsichtbare Beschriftung der Tabelle für Screenreader */
  tabellenTitel: "Ihr Ablauf heute und wie er laufen könnte, Schritt für Schritt",
  zeileStunden: "Geht pro Woche drauf",
  // Stunden im Jahr aus der Rechnung des Dienstes; die Seite rechnet nichts selbst um (etwa in Arbeitstage)
  zeileStundenJahr: "Stunden im Jahr",
  /** Wert in den Summen: „4 Std.“ (in Tabellen ohne „rund“, der Hinweis sagt „Beträge gerundet“) */
  stunden: (stunden: string) => `${stunden}\u00a0Std.`,
  summe: "Verbrannt pro Jahr",
  hinweis: (stundensatz: string, wochen: string) =>
    `KI-Entwurf aus Ihrer Beschreibung, von keinem Menschen geprüft. Geschätzt mit ${stundensatz}\u00a0€ pro Stunde und ${wochen} Arbeitswochen. Beträge gerundet.`,
  /** Ihre Beschreibung, gekürzt auf beschreibungMax Zeichen (mit „…“) */
  beschreibung: (text: string) => `Ihre Beschreibung: „${text}“`,
  beschreibungMax: 300,
  fussleiste: "Büro-Röntgenblick",
  naechsterSchritt: "Nächster Schritt",
  kontakt: "Besprechen Sie das Ergebnis mit Julian Koch im Erstgespräch:",
  /** Oben im Stempel, höchstens 10 Zeichen; unten steht die Stufe (STUFEN[n].stempelUnten) */
  stempelOben: "KI-BEFUND",
  /** Der Stempel als Satz für Screenreader (das Bild ist aria-hidden) und die Ansage nach dem Ausstellen */
  stempelText: (oben: string, unten: string) => `Stempel: ${oben}, ${unten}.`,
  ausgestellt: "Befund als Beleg ausgestellt.",
  fusszeile: (datum: string) =>
    `Automatisch erstellt von einer KI für JTK Consulting am ${datum}. Nicht von Julian Koch geprüft. Schätzwerte, keine Beratung.`,
  pdf: {
    // Nur ASCII: pdfText() in beleg-pdf.ts wirft alles außerhalb von 0x20 bis 0x7E weg
    titel: (nummer: string) => `Roentgenblick-Befund ${nummer}`,
    dateiname: "Roentgenblick-Befund-JTK.pdf",
    autor: "KI-Assistent von JTK Consulting",
    betreff: "KI-generierter Befund, nicht von einem Menschen geprueft",
    stichwoerter: "KI-generiert; AI-generated; JTK Consulting",
    wirdErstellt: "Ihr Befund wird erstellt …",
    fertig: "Fertig. Ihr Befund liegt als PDF bereit.",
    fehler: "Das PDF hat leider nicht geklappt. Ein Bildschirmfoto vom Befund tut es auch.",
  },
} as const;

/* Probeanruf: Betriebe -------------------------------------------------------------------------- */

export type BetriebId = "haustechnik" | "baustoff";

/** offen: Bürozeit bzw. Öffnungszeit; geschlossen: nach Feierabend, am Wochenende */
export type Variante = "offen" | "geschlossen";

/** 1 = Montag … 7 = Sonntag */
export type Wochentag = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Zeitfenster in Minuten seit Mitternacht, Ortszeit Europe/Berlin; bis ist ausgeschlossen */
export interface Zeitfenster {
  tage: readonly Wochentag[];
  von: number;
  bis: number;
}

export type SatzId =
  | "rohr-tropft"
  | "heizung-kalt"
  | "monteur-wann"
  | "bad-erneuern"
  | "haustechnik-name"
  | "haustechnik-nummer"
  | "haustechnik-adresse"
  | "haustechnik-schluss"
  | "zement-morgen"
  | "lieferung-wann"
  | "samstag-offen"
  | "paletten-kaputt"
  | "baustoff-name"
  | "baustoff-nummer"
  | "baustoff-adresse"
  | "baustoff-schluss";

export interface Satz {
  /** Fest und über beide Betriebe eindeutig; auch detail der Messung „Satz gewählt“ */
  id: SatzId;
  text: string;
  /** Zeile neben dem Gespräch, wenn dieser Satz gewählt ist */
  hinweis?: string;
}

export interface Betrieb {
  id: BetriebId;
  name: string;
  kurzname: string;
  art: string;
  ort: string;
  /** Wird beim Wählen angezeigt */
  nummer: string;
  oeffnungszeiten: readonly Zeitfenster[];
  /** Spricht die Seite selbst, fest und mit dem KI-Satz („Ich bin eine KI“), egal was das Modell tut */
  begruessung: Record<Variante, string>;
  /** Fuß der Telefonnotiz */
  notizFuss: Record<Variante, string>;
  /** Vier Anfänge, danach vier Folgesätze */
  saetze: readonly Satz[];
  folgesaetze: readonly Satz[];
}

const uhr = (stunde: number, minute = 0) => stunde * 60 + minute;

export const BETRIEB_REIHENFOLGE: readonly BetriebId[] = ["haustechnik", "baustoff"];

export const BETRIEBE: Record<BetriebId, Betrieb> = {
  // Dieselbe erfundene Firma wie im Hero (data/akten.ts): Musterweg 3, 40878 Ratingen
  haustechnik: {
    id: "haustechnik",
    name: "Muster Haustechnik GmbH",
    kurzname: "Muster Haustechnik",
    art: "Sanitär-Notdienst",
    ort: "Ratingen",
    nummer: "0171 3920050",
    // Bürozeit Montag bis Freitag 7:30 bis 16:30 Uhr
    oeffnungszeiten: [{ tage: [1, 2, 3, 4, 5], von: uhr(7, 30), bis: uhr(16, 30) }],
    begruessung: {
      offen:
        "Muster Haustechnik, guten Tag. Sie sprechen mit dem KI-Telefonassistenten. Ich bin eine KI, nehme Ihr Anliegen auf und gebe es direkt an unser Team weiter. Worum geht es?",
      geschlossen:
        "Muster Haustechnik, guten Tag. Sie sprechen mit dem KI-Telefonassistenten. Ich bin eine KI. Das Büro ist gerade nicht besetzt, bei einem Notfall gebe ich Ihr Anliegen sofort an die Bereitschaft. Worum geht es?",
    },
    notizFuss: { offen: "Während der Bürozeit angenommen.", geschlossen: "Nach Feierabend angenommen." },
    // Erwartung: Notfall (zuerst Hauptwasserhahn), dringend (ohne Frost kein Notfall), normal (keine Uhrzeit
    // zusagen, Rückrufregel), normal als Neuanfrage (Angebot erst nach Besichtigung)
    saetze: [
      { id: "rohr-tropft", text: "Hallo, bei uns im Keller tropft ein Rohr! Da steht schon Wasser auf dem Boden." },
      { id: "heizung-kalt", text: "Guten Tag, unsere Heizung ist seit heute Morgen kalt. Wir haben ein kleines Kind im Haus." },
      { id: "monteur-wann", text: "Ich wollte nur fragen, wann Ihr Monteur am Donnerstag ungefähr kommt." },
      { id: "bad-erneuern", text: "Wir möchten unser Bad erneuern lassen. Können Sie mal vorbeikommen?" },
    ],
    folgesaetze: [
      { id: "haustechnik-name", text: "Erika Mustermann." },
      { id: "haustechnik-nummer", text: "Meine Nummer ist 0176 04069012." },
      { id: "haustechnik-adresse", text: "Musterstraße 14 in Ratingen." },
      { id: "haustechnik-schluss", text: "Nein, das war alles." },
    ],
  },
  baustoff: {
    id: "baustoff",
    name: "Beispiel Baustoffe KG",
    kurzname: "Beispiel Baustoffe",
    art: "Baustoffhandel",
    ort: "Köln-Porz",
    nummer: "0221 4710300",
    // Öffnungszeiten Montag bis Freitag 6:30 bis 17 Uhr, Samstag 8 bis 12 Uhr
    oeffnungszeiten: [
      { tage: [1, 2, 3, 4, 5], von: uhr(6, 30), bis: uhr(17) },
      { tage: [6], von: uhr(8), bis: uhr(12) },
    ],
    begruessung: {
      offen:
        "Beispiel Baustoffe, guten Tag. Sie sprechen mit dem KI-Telefonassistenten. Ich bin eine KI und nehme Bestellungen, Lieferfragen und Rückrufwünsche auf. Was kann ich für Sie tun?",
      geschlossen:
        "Beispiel Baustoffe, guten Tag. Sie sprechen mit dem KI-Telefonassistenten. Ich bin eine KI. Der Verkauf ist gerade nicht da, ich nehme Ihr Anliegen auf, und er ruft Sie zurück. Was kann ich für Sie tun?",
    },
    notizFuss: { offen: "Während der Öffnungszeit angenommen.", geschlossen: "Außerhalb der Öffnungszeit angenommen." },
    // Erwartung: dringend (Tag nicht zusagen, die Disposition bestätigt), normal (sieht keinen Lieferstatus),
    // Routine aus den Betriebsdaten (samstags 8 bis 12 Uhr), normal als Reklamation (Fotos, Verkauf meldet sich)
    saetze: [
      { id: "zement-morgen", text: "Ich brauche 10 Paletten Zement, am besten morgen früh auf die Baustelle." },
      {
        id: "lieferung-wann",
        text: "Wann kommt denn meine Lieferung? Die Auftragsnummer hab ich grad nicht zur Hand.",
        hinweis: "Mit angebundener Warenwirtschaft sagt der Assistent den Liefertermin direkt an.",
      },
      { id: "samstag-offen", text: "Habt ihr samstags auf? Ich würde gern Rindenmulch abholen." },
      { id: "paletten-kaputt", text: "Ich habe gestern Pflastersteine bekommen, und zwei Paletten sind kaputt." },
    ],
    folgesaetze: [
      { id: "baustoff-name", text: "Max Mustermann von der Musterbau Rhein." },
      { id: "baustoff-nummer", text: "Meine Nummer ist 0221 4710456." },
      { id: "baustoff-adresse", text: "Baustelle Musterstraße, Ecke Beispielweg, in Köln-Mülheim." },
      { id: "baustoff-schluss", text: "Nein, danke, das war’s." },
    ],
  },
};

export const istBetriebId = (wert: unknown): wert is BetriebId =>
  typeof wert === "string" && (BETRIEB_REIHENFOLGE as readonly string[]).includes(wert);

/** Wochentag und Minute des Tages in Europe/Berlin, egal in welcher Zeitzone der Besucher sitzt */
export function ortszeit(jetzt: Date = new Date()): { wochentag: Wochentag; minute: number } {
  const teile = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(jetzt);
  const zahl = (art: Intl.DateTimeFormatPartTypes) => Number(teile.find((t) => t.type === art)?.value ?? 0);
  // Wochentag aus dem Berliner Datum, nicht aus der Uhr des Geräts
  const tag = new Date(Date.UTC(zahl("year"), zahl("month") - 1, zahl("day"))).getUTCDay();
  return { wochentag: (tag === 0 ? 7 : tag) as Wochentag, minute: zahl("hour") * 60 + zahl("minute") };
}

/** Welche Begrüßung gilt jetzt? Feiertage kennt die Regel nicht, für die Demo reicht der Wochenplan. */
export function begruessungsVariante(betrieb: Betrieb, jetzt: Date = new Date()): Variante {
  const { wochentag, minute } = ortszeit(jetzt);
  const offen = betrieb.oeffnungszeiten.some((f) => f.tage.includes(wochentag) && minute >= f.von && minute < f.bis);
  return offen ? "offen" : "geschlossen";
}

/* Probeanruf: Oberfläche ------------------------------------------------------------------------ */

export const TELEFON = {
  // Gleiche Grenzen wie der Dienst: Zeichen je Satz, Züge je Gespräch
  grenzen: { textMin: 2, textMax: 300, zuege: 5 },
  wahl: "Wen rufen Sie an?",
  /** Karte je Betrieb: „Muster Haustechnik · Sanitär-Notdienst, Ratingen“ */
  karte: (betrieb: Betrieb) => `${betrieb.kurzname} · ${betrieb.art}, ${betrieb.ort}`,
  anrufen: "Anrufen",
  /** Titelleiste nach der Wahl */
  fenstertitel: (betrieb: Betrieb) => `Probeanruf: ${betrieb.kurzname} · KI`,
  // Die Nummer bricht nicht in der Mitte um (geschütztes Leerzeichen nach der Vorwahl)
  waehlt: (nummer: string) => `Wählt ${nummer.replaceAll(" ", "\u00a0")} …`,
  klingelt: "Es klingelt …",
  /** „Verbunden · 0:42“ */
  verbunden: (dauer: string) => `Verbunden · ${dauer}`,
  /** Ansage beim Abheben, davor die feste Begrüßung */
  verbundenAnsage: "Verbunden. Der KI-Telefonassistent sagt:",
  /** LED neben dem Hörer */
  leitung: "Leitung 1: Anruf aktiv",
  /** Unter der Leitung: „Muster Haustechnik · 0171 3920050“ */
  anschluss: (betrieb: Betrieb) => `${betrieb.kurzname} · ${betrieb.nummer.replaceAll(" ", "\u00a0")}`,
  // „KI-“ an jeder Sprechblase: Auch wer mitten im Verlauf einsteigt, sieht, dass hier eine KI spricht
  sprecher: { assistent: "KI-Assistent", besucher: "Sie" },
  verlauf: "Gesprächsverlauf",
  eingabe: { label: "Was sagen Sie?", platzhalter: "Sagen Sie, worum es geht.", senden: "Sagen" },
  /** Weniger als zwei Zeichen; derselbe Satz wie im Dienst */
  zuKurz: "Bitte sagen Sie, worum es geht.",
  saetze: "Oder sagen Sie:",
  auflegen: "Auflegen",
  anhalten: "Anhalten",
  /** Statusleiste, solange der Assistent antwortet */
  antwortet: "Der Assistent antwortet …",
  aufgelegtVorher: "Aufgelegt, bevor der Assistent abgenommen hat.",
  /** Ansage, wenn der Assistent das Gespräch beendet; danach kommt das Besetztzeichen */
  assistentAufgelegt: "Der Assistent hat aufgelegt.",
  grenze: "Der Probeanruf endet nach fünf Antworten.",
  /** „Zug 2 von 5“ */
  zug: (nummer: number, von: number) => `Zug\u00a0${nummer} von ${von}`,
  /** „Aufgelegt · 1:48 Min.“ */
  aufgelegt: (dauer: string) => `Aufgelegt · ${dauer}\u00a0Min.`,
  ende:
    "Aufgelegt. So landet der Anruf bei Ihnen: als fertige Telefonnotiz, auch nach Feierabend. In echt hängt der Assistent an Ihrer Telefonanlage und Ihrem Programm, und Sie legen fest, was er sagen darf.",
  // Werte des Zeitfresser-Checks: jeder 20. verpasste Anruf wird ein Auftrag, 8 pro Woche, 2.500 € Auftragswert,
  // 44 Wochen. 8 × 44 / 20 = 17,6 Aufträge × 2.500 € = 44.000 €. Umsatz ist kein Kostenposten.
  rechnung:
    "Vorsichtig gerechnet: Von 20 verpassten Anrufen wird einer ein Auftrag. Bei 8 verpassten Anrufen pro Woche und 2.500\u00a0€ Auftragswert entgehen Ihnen so rund 44.000\u00a0€ Umsatz im Jahr. Das ist Umsatz, kein Gewinn.",
  zusage: { text: "Gehört zu Zusage 4.2: Sie verpassen keinen Anruf mehr", ziel: "#zusage-anrufe" } satisfies Verweis,
  ctaHinweis:
    "So verpassen Sie keinen Anruf mehr, auch nach Feierabend. Welche Technik zu Ihrem Betrieb passt, klären wir im Erstgespräch.",
  cta: "Telefonassistenten für meinen Betrieb anfragen",
  nochmal: "Noch ein Anruf",
  hinweis: "Erfundener Betrieb, echte KI. Der Assistent sagt Ihnen gleich am Anfang, dass er eine KI ist.",
  // Nur „Ton“: Der Schalter schaltet den Ton der ganzen Seite, nicht nur den des Telefons (klang.ts)
  tonSchalter: "Ton",
} as const;

export type Kategorie = "notfall" | "auftrag" | "angebot" | "reklamation" | "frage" | "sonstiges";
export type Dringlichkeit = "notfall" | "dringend" | "normal" | "offen";
export type TicketStatus = "unvollstaendig" | "erfasst";

export interface TelefonStempel {
  oben: string;
  unten: string;
  /** Rot nur beim Notfall: neben dem Hero-Stempel der einzige laute Moment */
  rot: boolean;
}

// Nach dem Vorbild der Telefonnotiz im Hero (data/akten.ts). Felder in der Reihenfolge des Ergebnisses.
export const TELEFONNOTIZ = {
  titel: "Telefonnotiz",
  ueberschrift: "Telefonnotiz (von der KI ausgefüllt)",
  absender: "Aufgenommen vom KI-Telefonassistenten",
  plakette: "Probeanruf",
  /** Vorgangsnummer, „{jahr}“ wie in data/akten.ts (mitJahr); setzt die Nummern des Heros fort */
  vorgang: "A-{jahr}-0232",
  meta: { vorgang: "Vorgang", anrufAm: "Anruf am", uhrzeit: "Uhrzeit", dauer: "Dauer" },
  /** Datum und Uhrzeit, solange niemand angerufen hat */
  ohneWert: "–",
  /** „1:48 Min.“ */
  dauerWert: (dauer: string) => `${dauer}\u00a0Min.`,
  felder: {
    anrufer: "Anrufer",
    rueckruf: "Rückrufnummer",
    adresse: "Adresse",
    anliegen: "Anliegen",
    kategorie: "Kategorie",
    dringlichkeit: "Dringlichkeit",
    naechsterSchritt: "Nächster Schritt",
    status: "Status",
  },
  /** Leeres Feld während des Gesprächs */
  leer: "noch offen",
  kategorien: {
    notfall: "Notfall",
    auftrag: "Auftrag",
    angebot: "Angebot",
    reklamation: "Reklamation",
    frage: "Frage",
    sonstiges: "Sonstiges",
  } satisfies Record<Kategorie, string>,
  // Immer als Wort, nie nur über die Farbe
  dringlichkeiten: {
    notfall: "NOTFALL",
    dringend: "DRINGEND",
    normal: "NORMAL",
    offen: "noch offen",
  } satisfies Record<Dringlichkeit, string>,
  status: { unvollstaendig: "wird aufgenommen", erfasst: "erfasst" } satisfies Record<TicketStatus, string>,
  // Bei status „erfasst“. Oben steht „PROBEANRUF“, damit der Stempel selbst zeigt, dass es eine Simulation ist
  // (oben höchstens 10, unten höchstens 20 Zeichen wie der Stempel des Checks)
  stempel: {
    notfall: { oben: "PROBEANRUF", unten: "AN BEREITSCHAFT", rot: true },
    sonst: { oben: "PROBEANRUF", unten: "IM SYSTEM ANGELEGT", rot: false },
  } satisfies Record<"notfall" | "sonst", TelefonStempel>,
  /** Für Screenreader, der Stempel selbst ist ein Bild */
  stempelText: (stempel: TelefonStempel) => `Stempel: ${stempel.oben}, ${stempel.unten}.`,
} as const;

/* Spracheingabe und Vorlesen (scripts/ki/sprache.ts) -------------------------------------------- */

export const SPRACHE = {
  knopf: "Lieber sprechen",
  knopfAria: "Spracheingabe starten",
  hoertZu: "Ich höre zu …",
  fertig: "Fertig",
  aufnahme: "Aufnahme läuft …",
  hinweis: "Die Spracheingabe übernimmt Ihr Browser. Manche Browser schicken die Aufnahme dafür an ihren Hersteller.",
  aufDemGeraet: "Die Spracherkennung läuft auf Ihrem Gerät. Es wird nichts übertragen.",
  // Vor der ersten Aufnahme, wenn nicht auf dem Gerät erkannt wird; die Zustimmung gilt nur für diesen Aufruf
  zustimmung: {
    titel: "Spracheingabe über Ihren Browser",
    text: "Ihr Browser wandelt Ihre Sprache in Text um. Dazu schickt er die Aufnahme an seinen Hersteller: Chrome an Google, Edge an Microsoft, Safari je nach Gerät an Apple, auch in die USA. Ich bekomme nur den erkannten Text.",
    link: { text: "Mehr dazu in der Datenschutzerklärung.", ziel: "/datenschutz/#ki-demos" } satisfies Verweis,
    ja: "Einverstanden, Mikrofon an",
    nein: "Lieber tippen",
  },
  gesperrt: "Ihr Browser lässt das Mikrofon nicht zu. Tippen geht genauso.",
  nichtVerstanden: "Nichts verstanden. Noch einmal, oder lieber tippen?",
  vorlesen: {
    schalter: "Antworten vorlesen",
    // Nur Stimmen, die auf dem Gerät laufen: Netzstimmen schicken den Text an den Hersteller
    hinweis: "Vorlesen übernimmt die Computerstimme Ihres Geräts, sobald der Ton an ist.",
    // Stattdessen, sobald der Dienst eine eigene Stimme anbietet. Der Satz steht neben dem Schalter, bevor etwas
    // übertragen wird; erst mit dem Einschalten geht Text an den Sprachdienst. Den Anbieter nennt nur die
    // Datenschutzerklärung.
    // Nur das eine Wort als Link: Es bricht nicht um und bekommt auf dem Handy eine Trefferfläche von 44 px
    extern: {
      hinweis:
        "Die Stimme ist künstlich erzeugt und spricht, sobald der Ton an ist. Dafür geht der Antworttext an einen externen Sprachdienst, auch was Sie im Gespräch genannt haben.",
      mehr: "Mehr dazu in der",
      link: { text: "Datenschutzerklärung", ziel: "/datenschutz/#vorlesen" } satisfies Verweis,
    },
  },
} as const;

/* Fehler ---------------------------------------------------------------------------------------- */

/** Codes des Dienstes, vor dem Stream als JSON, im Stream als event: fehler */
export const KI_FEHLER_CODES = [
  "herkunft",
  "nicht_eingerichtet",
  "budget",
  "ungueltig",
  "zu_gross",
  "sicherheit",
  "sicherheit_nicht_erreichbar",
  "limit",
  "ueberlastet",
  "sitzung",
  "zeit",
  "abgelehnt",
  "unvollstaendig",
  "ki_fehler",
] as const;

export type KiFehlerCode = (typeof KI_FEHLER_CODES)[number];

export const istKiFehlerCode = (wert: unknown): wert is KiFehlerCode =>
  typeof wert === "string" && (KI_FEHLER_CODES as readonly string[]).includes(wert);

// Rückfall, wenn der Dienst keinen Satz mitschickt. Muster der Seite: was passiert ist, dann ein Weg. Wo Julian
// einen Ausweg anbietet, spricht er als „ich“.
export const FEHLER_SAETZE: Record<KiFehlerCode, string> = {
  herkunft: "Die Demos funktionieren nur direkt auf jtkconsulting.de. Bitte laden Sie die Seite neu.",
  nicht_eingerichtet: "Diese Demo ist gerade ausgeschaltet. Den Zeitfresser-Check können Sie trotzdem machen.",
  // Ohne „morgen früh“: Auch das Monatsbudget kann aufgebraucht sein
  budget: "Die KI hat für heute Feierabend. Den Zeitfresser-Check können Sie trotzdem machen.",
  ungueltig: "Mit dieser Eingabe kann die Demo nichts anfangen. Bitte prüfen Sie den Text und versuchen Sie es noch einmal.",
  zu_gross: "Der Text ist zu lang für die Demo. Bitte kürzen Sie ihn.",
  sicherheit: "Die Sicherheitsprüfung ist fehlgeschlagen – bitte laden Sie die Seite neu.",
  sicherheit_nicht_erreichbar: "Die Sicherheitsprüfung ist gerade nicht erreichbar – bitte versuchen Sie es gleich noch einmal.",
  limit:
    "Sie haben die Demos heute schon oft ausprobiert. Morgen geht es wieder, oder Sie erzählen mir Ihren Fall im Erstgespräch.",
  ueberlastet: "Gerade probieren sehr viele gleichzeitig – bitte versuchen Sie es gleich noch einmal.",
  sitzung: "Das Gespräch ist beendet oder abgelaufen. Rufen Sie einfach noch einmal an.",
  zeit: "Die KI braucht gerade zu lange. Versuchen Sie es gleich noch einmal, gern mit einem kürzeren Text.",
  abgelehnt:
    "Dazu kann diese Demo nichts sagen. Sie hilft nur bei Büroabläufen: Anfragen, Angebote, Aufträge, Rechnungen und Telefon.",
  unvollstaendig: "Die KI ist nicht sauber fertig geworden. Versuchen Sie es gleich noch einmal, gern mit einem kürzeren Text.",
  ki_fehler: "Da ist etwas schiefgegangen. Versuchen Sie es gleich noch einmal.",
};

/** Fälle, die nur der Browser kennt */
export const BROWSER_SAETZE = {
  /** Netzfehler oder 404 (etwa ohne Weiterleitung von /api/ki): Die Seite bleibt heil */
  nichtErreichbar: "Die Demo ist gerade nicht erreichbar. Bitte versuchen Sie es später noch einmal.",
  /** Stream bricht mittendrin ab */
  abgerissen: "Die Verbindung ist abgerissen, bevor die KI fertig war. Was bis hier steht, ist unvollständig.",
  /** Eigenes Zeitlimit im Browser */
  zeit: FEHLER_SAETZE.zeit,
  /** Besucher hat „Anhalten“ gedrückt: kein Fehlerklang */
  angehalten: "Angehalten.",
  /** kiUrl leer: Demos auf dieser Fassung der Seite abgeschaltet */
  aus: "Die KI-Demos sind gerade ausgeschaltet. Den Zeitfresser-Check können Sie trotzdem machen.",
  zuKurz: "Ein paar Wörter mehr braucht die KI schon. Ein, zwei Sätze reichen.",
  zuLang: (hoechstens: string) => `Der Text ist zu lang für die Demo. Bitte kürzen Sie ihn auf höchstens ${hoechstens}\u00a0Zeichen.`,
  /** themenfremd ohne eigenen Satz der KI */
  themenfremd: FEHLER_SAETZE.abgelehnt,
} as const;

/** Auswege unter einer Fehlermeldung */
export const AUSWEGE = {
  nochmal: "Noch einmal versuchen",
  neuLaden: "Seite neu laden",
  check: { text: "Zum Zeitfresser-Check", ziel: "#check" } satisfies Verweis,
  erstgespraech: { text: "Erstgespräch vereinbaren", ziel: "#kontakt" } satisfies Verweis,
} as const;

/** Satz für eine Fehlermeldung: der des Dienstes, sonst der Rückfall zum Code (unbekannte Codes wie ki_fehler) */
export function fehlerSatz(code: unknown, satzVomDienst?: unknown): string {
  if (typeof satzVomDienst === "string" && satzVomDienst.trim()) return satzVomDienst.trim();
  return FEHLER_SAETZE[istKiFehlerCode(code) ? code : "ki_fehler"];
}
