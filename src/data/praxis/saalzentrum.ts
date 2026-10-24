// Akte 03: Saalzentrum Düsseldorf, ehrenamtlich. Auf Julians Wunsch neutral beschrieben und ohne
// Link; einzelne Termintitel sind in den Bildern geschwärzt.
// Quellen: Versionsgeschichte von Website und Dienst, öffentlicher Belegungsplan (Zählungen),
// Julians eigene Aussagen beim Neubau im Oktober 2026.
import type { Akte, Bild } from "./typen";
import monat from "../../assets/praxis/saalzentrum/kalender-monat.webp";
import woche from "../../assets/praxis/saalzentrum/kalender-woche.webp";
import handy from "../../assets/praxis/saalzentrum/kalender-handy.webp";
import handyTag from "../../assets/praxis/saalzentrum/kalender-handy-tag.webp";
import kiosk from "../../assets/praxis/saalzentrum/kiosk.webp";
import ticket from "../../assets/praxis/saalzentrum/ticket.webp";
import wohnungen from "../../assets/praxis/saalzentrum/wohnungen-login.webp";

const AUFGENOMMEN = "2026-10-24";

const bilder = {
  monat: {
    art: "desktop",
    src: monat,
    alt: "Belegungsplan für Oktober 2026 in der Monatsansicht: an den belegten Tagen die Termine mit Raumfarbe, rechts die Liste für Dienstag, den 27. Oktober, mit vier Abendterminen in Saal 1 bis 3 und einem Nebenraum; einzelne Termintitel sind geschwärzt.",
    unterschrift: "Belegungsplan, Monat",
    aufgenommen: AUFGENOMMEN,
    daten: "teilgeschwaerzt",
  },
  woche: {
    art: "desktop",
    src: woche,
    alt: "Belegungsplan in der Wochenansicht: Montag bis Sonntag als Zeitraster von 8 bis 22 Uhr, die Termine mit Raumfarbe und Raumkürzel; ein Termintitel ist geschwärzt.",
    unterschrift: "Belegungsplan, Woche",
    aufgenommen: AUFGENOMMEN,
    daten: "teilgeschwaerzt",
    ausschnitt: "70% 50%",
  },
  handy: {
    art: "handy",
    src: handy,
    alt: "Belegungsplan am Handy: Oktober 2026 als Monatsraster, unter den belegten Tagen Punkte für die Belegungen, rote Punkte für Sondertermine.",
    unterschrift: "Monat am Handy",
    aufgenommen: AUFGENOMMEN,
    daten: "oeffentlich",
  },
  handyTag: {
    art: "handy",
    src: handyTag,
    alt: "Tagesseite am Handy für Dienstag, den 27. Oktober: vier Termine von 19 bis 21 Uhr mit Raum, darüber der Knopf „Zurück“.",
    unterschrift: "Ein Tag am Handy",
    aufgenommen: AUFGENOMMEN,
    daten: "oeffentlich",
  },
  kiosk: {
    art: "desktop",
    src: kiosk,
    alt: "Foyer-Ansicht am Sonntagvormittag: Saal 3 mit dem Pfeil „Treppe hoch links“ und Saal 4 mit „Treppe hoch rechts“, jeweils mit dem laufenden Termin um 10 Uhr und der Dauer, darunter die freien Nebenräume.",
    unterschrift: "Ansicht fürs Foyer",
    aufgenommen: AUFGENOMMEN,
    daten: "oeffentlich",
  },
  ticket: {
    art: "desktop",
    src: ticket,
    alt: "Dialog „Ticket eröffnen“ mit den Pflichtfeldern Name, E-Mail, Betreff und Beschreibung, dem Beispiel „Licht in Saal 2 defekt“ und dem Knopf „Fotos hochladen“.",
    unterschrift: "Mangel melden",
    aufgenommen: AUFGENOMMEN,
    daten: "oeffentlich",
  },
  wohnungen: {
    art: "handy",
    src: wohnungen,
    alt: "Anmeldeseite „Intern · Wohnungen“: Dieser Bereich ist nicht öffentlich, darunter das Feld für das Passwort.",
    unterschrift: "Anmeldung zum Wohnungskalender",
    aufgenommen: AUFGENOMMEN,
    daten: "anmeldeseite",
  },
} satisfies Record<string, Bild>;

export const saalzentrum: Akte = {
  id: "saalzentrum",
  nr: "03",
  name: "Saalzentrum Düsseldorf",
  rolle: "Ehrenamtlich, seit 2023",
  kontext: "Vier Säle und vier Nebenräume, belegt von Gruppen in 14 Sprachen",
  wandel: "Vom Kalender des Hauses zum Belegungsplan für alle, am Handy, am PC und als Ansicht fürs Foyer.",
  status: "In Betrieb seit 2023",
  kennzahlen: [
    {
      wert: "1.820",
      text: "Raumbuchungen im Jahr 2025",
      beleg: { art: "zaehlung", text: "Zählung im öffentlichen Belegungsplan", stand: "2026-10" },
    },
    {
      wert: "92 Min.",
      text: "vom Wunsch bis zum Meldeformular mit Fotos",
      beleg: { art: "verlauf", text: "Versionsgeschichte von Website und Dienst", stand: "2026-10" },
    },
  ],
  vorschau: [bilder.woche, bilder.kiosk, bilder.handy],
  ausgangslage: {
    text: "Ein Haus mit vier Sälen und vier Nebenräumen, das sich viele Gruppen teilen. Gebucht wird in einem zentralen Google-Kalender. Die Website hat seit 2023 genau zwei Aufgaben: zeigen, wann welcher Raum frei ist, und Mängel melden.",
    belege: [
      { art: "verlauf", text: "Versionsgeschichte von Website und Dienst", stand: "2026-10" },
      { art: "aussage", text: "Julian Koch beim Neubau des Kalenders", stand: "2026-10" },
    ],
  },
  vorher: {
    kopf: "Vorher · Durchschlag für die Akte",
    zeilen: [
      "Termine im Google-Kalender des Hauses, nicht öffentlich einsehbar",
      "die Seite bis Februar 2024 hinter einer Passwortabfrage",
      "Mängel über ein Meldefeld ohne Pflichtangaben",
    ],
  },
  kapitel: [
    {
      id: "start",
      datum: { iso: "2023-05", genau: "monat" },
      stand: "erledigt",
      titel: "Zwei Kacheln: Kalender und Tickets",
      kurz: "Start 2023",
      text: "Im Mai 2023 finden die Gruppen auf der ersten Startseite genau zwei Kacheln: Kalender und Tickets. Im Herbst holt ein eigener Dienst die Termine aus dem Google-Kalender des Hauses. Seit Februar 2024 sieht jeder den Plan, ohne sich anzumelden.",
      bilder: [bilder.monat],
      belege: [{ art: "verlauf", text: "Versionsgeschichte von Website und Dienst", stand: "2024-02" }],
    },
    {
      id: "handy",
      datum: { iso: "2024-06", genau: "monat" },
      stand: "erledigt",
      titel: "Der Plan kommt aufs Handy",
      kurz: "Handy",
      text: "Wer unterwegs nachsehen will, bekommt im Juni 2024 eine eigene Ansicht fürs Handy; 2025 kommen Wischen, ein Heute-Knopf und die Woche dazu.",
      bilder: [bilder.handy, bilder.handyTag],
      notiz: {
        wert: "35",
        text: "Raumbuchungen pro Woche im Jahr 2025",
        beleg: { art: "zaehlung", text: "Zählung im öffentlichen Belegungsplan", stand: "2026-10" },
      },
      belege: [
        { art: "verlauf", text: "Versionsgeschichte der Website", stand: "2025-09" },
      ],
    },
    {
      id: "foyer",
      datum: { iso: "2025-10", genau: "monat" },
      stand: "erledigt",
      titel: "Eine Ansicht fürs Foyer",
      kurz: "Foyer",
      text: "Gruppen und Gäste sollen ihren Saal ohne Suchen finden: Seit Oktober 2025 gibt es dafür eine Ansicht für den Eingang, im Dezember zugeschnitten auf einen 27-Zoll-Bildschirm im Foyer. Für jeden Saal zeigt sie, was gerade läuft und was als Nächstes kommt, mit großen Pfeilen wie „Treppe hoch links“. Alle fünf Minuten lädt sie neu.",
      bilder: [bilder.kiosk],
      belege: [{ art: "verlauf", text: "Versionsgeschichte der Website", stand: "2025-12" }],
    },
    {
      id: "tickets",
      datum: { iso: "2026-10-13", genau: "tag" },
      stand: "erledigt",
      titel: "Mängel melden, mit Foto",
      kurz: "Tickets",
      text: "Wer einen Mangel sieht, meldet ihn über ein eigenes Formular: Name und E-Mail sind Pflicht, bis zu fünf Fotos lassen sich hochladen, am Handy direkt aus der Kamera, und der Spamschutz braucht kein Bilderrätsel. Jede Meldung landet als Vorgang beim Team für die Instandhaltung.",
      bilder: [bilder.ticket],
      vorher: "Gemeldet wurde über ein eingebettetes Feld ohne Pflichtangaben. Oft war nicht klar, von wem eine Meldung kam.",
      notiz: {
        wert: "92 Min.",
        text: "vom Wunsch bis zum fertigen Formular",
        beleg: { art: "verlauf", text: "Versionsgeschichte von Website und Dienst", stand: "2026-10" },
      },
      belege: [
        { art: "verlauf", text: "Versionsgeschichte von Website und Dienst", stand: "2026-10" },
        { art: "aussage", text: "Julian Koch zu den alten Meldungen", stand: "2026-10" },
      ],
    },
    {
      id: "neubau",
      datum: { iso: "2026-10-14", genau: "tag" },
      stand: "erledigt",
      titel: "Wieder so einfach wie früher",
      kurz: "Neuer Kalender",
      text: "Alle Gruppen im Haus bekommen einen neu gebauten Kalender, eine Ansicht für Handy, Tablet und PC. Der erste Entwurf ist zu voll, also geht es zurück zum Einfachen: nur Monat und Woche, ein Raumfilter, ein Tag per Antippen. Vom Auftrag bis zum neuen Kalender im Netz vergehen 21 Stunden.",
      vermerk: {
        text: "… es ist noch zu überladen, besonders in der Mobilversion. Das benutzen viele alte Menschen … auch viele junge Menschen, alles durch die Bank weg. … Es muss viel einfacher zu bedienen sein, so wie es vorher war …",
        am: "2026-10-14",
      },
      vorher: "Über die Jahre waren zwei getrennte Fassungen für PC und Handy gewachsen, mit Fehlern wie einer abgeschnittenen Sonntagsspalte, falschen Kalenderwochen und einem Raumfilter, der belegte Räume als frei zeigte.",
      bilder: [bilder.woche],
      stempel: { oben: "LIVE", unten: "14.10.2026", farbe: "tinte" },
      belege: [
        { art: "verlauf", text: "Versionsgeschichte der Website", stand: "2026-10" },
        { art: "aussage", text: "Julian Koch zur ersten Fassung", stand: "2026-10" },
      ],
    },
    {
      id: "wohnungen",
      datum: { iso: "2026-10-14", genau: "tag" },
      stand: "erledigt",
      titel: "Ein Kalender, der nie öffentlich wird",
      kurz: "Wohnungen",
      text: "Für die zwei Wohnungen im Haus gibt es einen eigenen Kalender, nur mit Passwort und nirgends verlinkt. Gebucht wird wie bei den Sälen im Google-Kalender des Hauses. „Teilen“ gibt es dort bewusst nicht: Gastnamen gehören nicht in andere Apps.",
      bilder: [bilder.wohnungen],
      belege: [
        { art: "verlauf", text: "Versionsgeschichte der Website", stand: "2026-10" },
        { art: "dokument", text: "Einstellungen des Wohnungskalenders im Code", stand: "2026-10" },
      ],
    },
  ],
  bilanz: {
    vorher: [
      "Termine im Google-Kalender, nicht öffentlich einsehbar",
      "der Plan hinter einer Passwortabfrage",
      "Meldungen ohne Pflicht zu Name und E-Mail",
    ],
    nachher: [
      "ein Belegungsplan für alle, auf jedem Gerät",
      "eine Ansicht fürs Foyer, mit Pfeilen zu den Sälen",
      "Mängel mit Absender, auf Wunsch mit Foto",
      "ein eigener Kalender für die Wohnungen, nur intern",
    ],
    naechstes: "Vorgemerkt ist ein Plan, der zeigt, wer bei welchem Termin eingeteilt ist.",
  },
};
