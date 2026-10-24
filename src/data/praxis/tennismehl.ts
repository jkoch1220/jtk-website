// Akte 01: Tennismehl GmbH, Julians eigenes Unternehmen (Freigabe mit Zahlen, Bildern und Namen).
// Quellen: Versionsgeschichte von Portal und Backend, Mosaik-Export, Rechnungsexport 2026,
// Einarbeitungsunterlagen und Julians eigene Aussagen. Bilder aus dem laufenden Portal,
// Vereinsnamen, Orte, Beträge und Personen im Bild geschwärzt; die Fahrer-Seite mit Musterauftrag.
import type { Akte, Bild } from "./typen";
import kanban from "../../assets/praxis/tennismehl/kanban.webp";
import uebersicht from "../../assets/praxis/tennismehl/uebersicht.webp";
import statistik from "../../assets/praxis/tennismehl/statistik.webp";
import mosaik from "../../assets/praxis/tennismehl/mosaik.webp";
import liefernachweis from "../../assets/praxis/tennismehl/liefernachweis.webp";
import wochenplanung from "../../assets/praxis/tennismehl/wochenplanung.webp";
import datev from "../../assets/praxis/tennismehl/datev.webp";
import werk from "../../assets/praxis/tennismehl/werk.webp";

const AUFGENOMMEN = "2026-10-24";

const bilder = {
  werk: {
    art: "foto",
    src: werk,
    alt: "Werkshof der Tennismehl GmbH: ein roter Radlader mit einer Schaufel voller Ziegelbruch auf dem ziegelrot bestaubten Hof, links eine Halde, rechts die grüne Halle mit dem Aufgabebunker.",
    unterschrift: "Werkshof mit Radlader und Ziegelbruch",
    aufgenommen: "",
    daten: "foto",
  },
  kanban: {
    art: "desktop",
    src: kanban,
    alt: "Auftragstafel (Kanban) der Projektverwaltung: Spalten von Angebot über Auftragsbestätigung, Lieferschein und Rechnung bis Bezahlt. Jede Karte ist ein Vorgang mit seinen Belegnummern; Vereinsnamen, Kundennummern und Preise sind geschwärzt.",
    unterschrift: "Auftragstafel, eine Karte je Vorgang",
    aufgenommen: AUFGENOMMEN,
    daten: "geschwaerzt",
    ausschnitt: "70% 75%",
  },
  uebersicht: {
    art: "desktop",
    src: uebersicht,
    alt: "Übersicht „So läuft ein Auftrag durch unsere Tools“: links die Eingänge Onlineshop, Anfragen, Platzbauer, Massen-Angebote, E-Mail und Telefon, in der Mitte das Kanban-Board mit 619 Projekten der Saison 2026, rechts Disposition, Lieferanten und offene Forderungen, ganz rechts die Auswertung.",
    unterschrift: "So läuft ein Auftrag durch das Portal",
    aufgenommen: AUFGENOMMEN,
    daten: "geschwaerzt",
    ausschnitt: "40% 22%",
  },
  statistik: {
    art: "desktop",
    src: statistik,
    alt: "Auswertung der Saison 2026: 619 Projekte, 605 Angebote, 401 Rechnungen; Erfolgsquote, Umsatz, offene Rechnungen, Tonnen und zwei Menüpunkte sind geschwärzt. Darunter die Dokumente pro Monat als Balken für Angebote, Lieferscheine und Rechnungen, mit der Spitze im März und April; die Reihe der Auftragsbestätigungen ist ausgeblendet.",
    unterschrift: "Auswertung der Saison 2026",
    aufgenommen: AUFGENOMMEN,
    daten: "ausgeblendet",
  },
  mosaik: {
    art: "desktop",
    src: mosaik,
    alt: "Werkzeug Mosaik-Migration: Import der Exportdateien aus dem alten Access-Programm, eine Automatik-Pipeline mit Trockendurchlauf und die Zähler Neu 70, Prüfen 11, Angelegt 2106, Fehler 0.",
    unterschrift: "Übernahme aus dem alten Programm",
    aufgenommen: AUFGENOMMEN,
    daten: "geschwaerzt",
    ausschnitt: "60% 30%",
  },
  liefernachweis: {
    art: "handy",
    src: liefernachweis,
    alt: "Handy-Seite „Lieferung bestätigen“ mit einem Musterauftrag: Verein, Lieferadresse, Lieferschein-Nummer, Ladung 8 Tonnen Tennismehl, ein Feld für den Namen des Fahrers, der große Knopf „Abgeladen“ und der Hinweis, den Wiegeschein bereitzuhalten.",
    unterschrift: "Lieferung bestätigen, am Handy des Fahrers",
    aufgenommen: AUFGENOMMEN,
    daten: "beispiel",
  },
  wochenplanung: {
    art: "desktop",
    src: wochenplanung,
    alt: "Wochenplanung für KW 43: links der Pool „Muss raus“, rechts die Tage untereinander mit Zeilen für Schüttgut, Paletten und Abholer im Werk. Im Oktober ist noch nichts geplant, die Saison beginnt Ende Februar.",
    unterschrift: "Wochenplanung statt Excel",
    aufgenommen: AUFGENOMMEN,
    daten: "geschwaerzt",
  },
  datev: {
    art: "desktop",
    src: datev,
    alt: "Übermittlung an DATEV: das dritte Quartal 2026 mit 31 Belegen, davon 30 bei DATEV, die Knöpfe „Fehlende an DATEV senden“ und „als ZIP herunterladen“, darunter die Belegliste; Kunden, Beträge und Mandantennummer geschwärzt.",
    unterschrift: "Ausgangsrechnungen eines Quartals an DATEV",
    aufgenommen: AUFGENOMMEN,
    daten: "geschwaerzt",
  },
} satisfies Record<string, Bild>;

export const tennismehl: Akte = {
  id: "tennismehl",
  nr: "01",
  name: "Tennismehl GmbH",
  rolle: "Mein eigenes Unternehmen",
  kontext: "Ziegelmehl für Tennisplätze, Giebelstadt",
  wandel: "Vom Access-Programm und der Tourenplanung in Excel zum eigenen Portal.",
  status: "In Betrieb seit 01/2026",
  kennzahlen: [
    {
      wert: "2.106",
      text: "Altkunden mit Bestellhistorie übernommen",
      beleg: { art: "bild", text: "Bilanz der Übernahme im Portal", stand: "2026-10" },
    },
    {
      wert: "1 Klick",
      text: "für die Rechnungen einer Lieferwoche",
      beleg: { art: "verlauf", text: "Versionsgeschichte des Portals", stand: "2026-08" },
    },
  ],
  vorschau: [bilder.uebersicht, bilder.werk, bilder.liefernachweis],
  fenster: bilder.kanban,
  ausgangslage: {
    text: "Zum 1. Januar 2026 übernimmt die neue GmbH einen Saisonbetrieb. Kunden und Bestellungen seit 2001 liegen in einem Access-Programm, in dem zwei Leute im Büro Angebote und Rechnungen schreiben; die Touren stehen in einer Excel-Datei. In der Saison, von Ende Februar bis Mitte Mai, fallen die Spitzen bei Telefon, Touren und Rechnungen zusammen.",
    belege: [
      { art: "aussage", text: "Julian Koch zum Ablauf vor 2026", stand: "2026-10" },
      { art: "zaehlung", text: "Bestellhistorie im Export aus dem alten Programm", stand: "2026-06" },
      { art: "dokument", text: "Einarbeitungsunterlagen für den Innendienst", stand: "2026-08" },
    ],
    bild: bilder.werk,
  },
  vorher: {
    kopf: "Vorher · Durchschlag für die Akte",
    zeilen: [
      "Mosaik, eine Access-Datei mit 650 MB",
      "Tourenplanung in Excel, je Kalenderwoche ein Blatt",
      "Lieferschein auf Papier, unterschrieben zurück ins Büro",
      "Angebote und Rechnungen per Outlook",
      "Anfragen per Mail im Postfach",
    ],
  },
  kapitel: [
    {
      id: "erste-rechnung",
      datum: { iso: "2025-11-24", genau: "tag" },
      stand: "erledigt",
      titel: "Vom Kostenrechner zur ersten Rechnung",
      kurz: "Erste Rechnung",
      text: "Am 24. November 2025, um 0:57 Uhr, beginnt es mit einer Frage: Was kostet uns eine Tonne Ziegelmehl? Zwei Wochen später hängen Angebot, Auftragsbestätigung, Lieferschein und Rechnung als Reiter an einem Vorgang. Am späten Abend des 16. Januar 2026 entsteht die erste Rechnung im eigenen Portal, kurz nach 23 Uhr fällt auf: Das Logo stimmt noch nicht.",
      bilder: [bilder.kanban],
      notiz: {
        wert: "16.01.2026",
        text: "erste Rechnung im eigenen Portal",
        beleg: { art: "zaehlung", text: "Rechnungsexport der Saison 2026", stand: "2026-05" },
      },
      belege: [
        { art: "verlauf", text: "Versionsgeschichte des Portals", stand: "2026-01" },
        { art: "zaehlung", text: "Rechnungsexport der Saison 2026", stand: "2026-05" },
      ],
    },
    {
      id: "eingaenge",
      datum: { iso: "2026-01", genau: "monat" },
      stand: "erledigt",
      titel: "Jeder Eingang wird ein Vorgang",
      kurz: "Eingänge",
      text: "Ab Ende Januar findet das Büro Formularanfragen aus dem Postfach im Portal, ein Klick macht daraus Vorgang und Angebot. Als die Erkennung aus 8 Tonnen 14 macht, steht 15 Minuten später die Korrektur. Shop-Bestellungen kommen seit März von selbst, beim Lieferanten bestellt das Büro per Klick. Seit dem 19. Oktober schreibt das Webformular direkt ins Portal.",
      bilder: [bilder.uebersicht],
      vorher: "Anfragen kamen als Mail ins Postfach. Wer nachfassen wollte, suchte die Telefonnummer später in der Original-Mail.",
      notiz: {
        wert: "10 Min.",
        text: "höchstens, bis eine Shop-Bestellung im Portal steht",
        beleg: { art: "dokument", text: "Abgleich der Shop-Schnittstelle im Backend", stand: "2026-03" },
      },
      zusage: "anfragen",
      belege: [
        { art: "verlauf", text: "Versionsgeschichte von Portal und Backend", stand: "2026-10" },
        { art: "dokument", text: "Tagesbericht der Postfächer", stand: "2026-08" },
      ],
    },
    {
      id: "saison",
      datum: { iso: "2026-03", genau: "monat" },
      stand: "erledigt",
      titel: "Die erste Saison im eigenen Portal",
      kurz: "Saison 2026",
      text: "In der ersten Saison bringt das Büro 351 Aufträge bis zur Rechnung durchs Portal. Bis zum 18. Mai schreibt es 433 Rechnungsdokumente, Neuausstellungen mitgezählt, 391 davon im März und April. Gebaut wird in diesen Wochen weiter, aber weniger als im Winter.",
      bilder: [bilder.statistik],
      notiz: {
        wert: "90 %",
        text: "der Rechnungen entstehen im März und April",
        beleg: { art: "zaehlung", text: "Rechnungsexport der Saison 2026", stand: "2026-05" },
      },
      belege: [
        { art: "zaehlung", text: "Rechnungsexport der Saison 2026", stand: "2026-05" },
        { art: "verlauf", text: "Versionsgeschichte des Portals", stand: "2026-04" },
      ],
    },
    {
      id: "kunden",
      datum: { iso: "2026-06", genau: "monat" },
      stand: "erledigt",
      titel: "25 Jahre Kundendaten ziehen um",
      kurz: "Kunden ziehen um",
      text: "Im Portal soll das Büro alle 2.187 Kunden aus Access wiederfinden, mit 5.320 Ansprechpartnern und Bestellungen seit 2001. Der erste Versuch bricht nach 1.947 Kunden ab, weil die Datenbank nicht so schnell schreibt. Der zweite läuft langsamer und überschreibt nie etwas: Erst prüfen feste Regeln, im Graubereich hilft eine KI, Grenzfälle entscheidet das Büro.",
      bilder: [bilder.mosaik],
      vorher: "Im alten Programm waren Liefer- und Rechnungsadresse eines Vereins zwei getrennte Kunden. Daher stammen viele der Dubletten, die heute zusammengeführt werden.",
      notiz: {
        wert: "2.106",
        text: "von 2.187 Kunden übernommen, über 81 entscheidet noch das Büro",
        beleg: { art: "bild", text: "Bilanz der Übernahme im Portal", stand: "2026-10" },
      },
      stempel: { oben: "ÜBERNOMMEN", unten: "MOSAIK · 06/2026", farbe: "rot" },
      zusage: "ki",
      belege: [
        { art: "zaehlung", text: "Export aus dem alten Programm", stand: "2026-06" },
        { art: "verlauf", text: "Versionsgeschichte des Portals", stand: "2026-06" },
      ],
    },
    {
      id: "liefernachweis",
      datum: { iso: "2026-07-28", genau: "tag" },
      stand: "erledigt",
      titel: "Der Fahrer quittiert am Handy",
      kurz: "Liefernachweis",
      text: "Am 27. Juli kommt die Idee, die Unterschrift auf Papier zu ersetzen, am Tag darauf trägt der Lieferschein einen QR-Code. Der Fahrer scannt, tippt „Abgeladen“ und fotografiert die Ware, seit dem 11. August auch den Wiegeschein: Nach dessen Menge wird abgerechnet. Die Bilderkennung schlägt sie vor, gültig wird sie erst, wenn ein Mensch sie bestätigt.",
      bilder: [bilder.liefernachweis],
      vermerk: { text: "In diesem Spaghettihaufen, wie wir’s bisher haben, soll Ordnung reinkommen. Klare, strukturierte Ordnung …", am: "2026-07-27" },
      vorher: "Der Lieferschein wurde zweimal gedruckt. Einer kam mit Unterschrift über den Fahrer zurück ins Büro.",
      notiz: {
        wert: "1 Tag",
        text: "von der Idee bis zum Liefernachweis",
        beleg: { art: "verlauf", text: "Gesprächsverlauf und Versionsgeschichte", stand: "2026-07" },
      },
      zusage: "ki",
      belege: [
        { art: "verlauf", text: "Versionsgeschichte des Portals", stand: "2026-08" },
        { art: "aussage", text: "Julian Koch zum Ablauf mit Papier", stand: "2026-07" },
      ],
    },
    {
      id: "dispo",
      datum: { iso: "2026-08-06", genau: "tag" },
      stand: "laeuft",
      titel: "Die Touren ziehen aus Excel ins Portal",
      kurz: "Wochenplanung",
      text: "Ab der Saison 2027 plant das Büro die Touren im Portal statt in Excel, auf einem 49-Zoll-Bildschirm: die Tage neben- oder untereinander, Touren mit echten Straßenkilometern, Aufträge per Ziehen und Ablegen. Das Babyblau, mit dem eine fertig geplante Woche abgehakt wurde und das in keiner Legende stand, heißt jetzt „Fertig geplant“.",
      bilder: [bilder.wochenplanung],
      vermerk: { text: "… in der Excel-Datei ist alles babyblau, das war sehr befriedigend, als ich diese Touren geplant habe, alles babyblau am Ende zu färben.", am: "2026-08-06" },
      vorher: "„ORIGINAL Dispo 2026.xlsx“: ein Blatt je Woche, Tonnen und Kilometer von Hand getippt, Touren verschoben mit Strg+X und Strg+V.",
      notiz: {
        wert: "437",
        text: "babyblaue Zellen in der alten Excel-Datei, heute ein Status",
        beleg: { art: "zaehlung", text: "Füllfarben der Excel-Vorlage gezählt", stand: "2026-08" },
      },
      stempel: { oben: "SAISON 2027", unten: "ERSTER EINSATZ", farbe: "tinte" },
      belege: [
        { art: "verlauf", text: "Versionsgeschichte des Portals", stand: "2026-08" },
        { art: "aussage", text: "Julian Koch zur Arbeit mit der Excel-Tabelle", stand: "2026-08" },
      ],
    },
    {
      id: "telefon",
      datum: { iso: "2026-08-18", genau: "tag" },
      stand: "erledigt",
      titel: "Der Verein steht im Display",
      kurz: "Telefonanlage",
      text: "Seit dem 18. August telefoniert das Büro über eine Cloud-Telefonanlage. Am 1. September kommen 879 Kontakte aus dem Portal ins Adressbuch, alle 952 Nummern in derselben Schreibweise, denn die Anlage erkennt nur exakte Treffer. Ruft ein Verein von einer dieser Nummern an, sieht das Büro im Display den Verein, wo hinterlegt auch den Ansprechpartner.",
      vorher: "Sieben Rufnummern hingen an einer FRITZ!Box. Im Adressbuch der neuen Anlage stand anfangs genau ein Kontakt.",
      rufplan: {
        schritte: ["Verein ruft an", "Telefonanlage in der Cloud", "Adressbuch aus dem Portal", "Display zeigt den Verein", "Anruf in der Kundenakte notieren"],
        alt: "Rufplan: Ein Verein ruft an, die Telefonanlage in der Cloud schlägt im Adressbuch nach, das aus dem Portal gefüllt wird, das Display zeigt den Verein, und das Büro notiert das Gespräch von Hand in der Kundenakte.",
      },
      notiz: {
        wert: "52 Min.",
        text: "vom Auftrag bis zum vollen Adressbuch",
        beleg: { art: "verlauf", text: "Protokoll des ersten Abgleichs", stand: "2026-09" },
      },
      verweis: { akte: "koch", kapitel: "telefon", text: "Die gleiche Telefonanlage läuft auch bei der Immobilienverwaltung KOCH" },
      belege: [
        { art: "verlauf", text: "Protokoll des ersten Abgleichs", stand: "2026-09" },
        { art: "dokument", text: "Bestätigung des Anbieterwechsels", stand: "2026-07" },
      ],
    },
    {
      id: "lieferwoche",
      datum: { iso: "2026-08-21", genau: "tag" },
      stand: "erledigt",
      titel: "Eine Lieferwoche, ein Klick",
      kurz: "Rechnungslauf",
      text: "Seit dem 21. August schreibt das Büro die Rechnungen einer ganzen Lieferwoche mit einem Klick. Fehlt ein Wiegeschein, bleibt der Auftrag mit Grund in der Liste stehen: Eine Liste, die ihn wegfiltert, sähe nach Feierabend aus und wäre keiner. Seit dem 19. Oktober gehen die Ausgangsrechnungen eines Quartals per Knopf an DATEV, nie von selbst.",
      bilder: [bilder.datev],
      vorher: "Jede Rechnung entstand einzeln: Vorgang öffnen, Positionen prüfen, speichern, zurück, nächster Vorgang.",
      notiz: {
        wert: "1 Klick",
        text: "für die Rechnungen einer Lieferwoche",
        beleg: { art: "verlauf", text: "Versionsgeschichte des Portals", stand: "2026-08" },
      },
      zusage: "rechnungen",
      belege: [
        { art: "verlauf", text: "Versionsgeschichte des Portals", stand: "2026-10" },
        { art: "zaehlung", text: "Versandprotokoll an DATEV", stand: "2026-10" },
      ],
    },
  ],
  bilanz: {
    vorher: [
      "Kundendaten in einer Access-Datei",
      "Touren in Excel, verschoben mit Strg+X",
      "Anfragen per Mail im Postfach",
      "Lieferscheine auf Papier zurück ins Büro",
      "Angebote und Rechnungen per Outlook",
    ],
    nachher: [
      "ein Portal für Anfragen, Shop und Rechnungen, die Tourenplanung ab der Saison 2027",
      "2.106 Altkunden mit Bestellhistorie übernommen, 81 noch offen",
      "Lieferschein mit QR-Code und Foto",
      "1 Klick je Lieferwoche, 1 Knopf je Quartal",
      "das Telefon zeigt bei 879 Kontakten, wer anruft",
      "im Werk: die Absackanlage für 40-kg-Säcke, programmierbar gesteuert statt rein pneumatisch",
    ],
    naechstes:
      "Die echte Prüfung ist die Saison 2027, wenn QR-Lieferschein, Rechnungslauf und Wochenplanung zum ersten Mal unter voller Last laufen. Eine Grenze ist schon bekannt: Google rechnet die Routen mit Pkw-Wegen und kennt keine Lkw-Sperren. Danach soll eine KI Angebotsannahmen vorbereiten; ob zuerst im Postfach oder am Telefon, ist noch offen.",
    faden: { text: "Läuft in zwei Betrieben: die Telefonanlage", akte: "koch", kapitel: "telefon" },
  },
  saison: [{ von: "2026-02-23", bis: "2026-05-17", text: "Saison 2026" }],
  sperrliste: ["E-Rechnung", "ZUGFeRD"],
};
