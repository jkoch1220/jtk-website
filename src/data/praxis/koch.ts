// Akte 02: Immobilienverwaltung KOCH, die Firma von Julians Bruder (Name ja, kein Link).
// Quellen: Versionsgeschichte der Dienste-Plattform und der Objekt-App, die Word-Vorlage
// für Begehungen, öffentliche Seiten der Dienste und Julians Aussage zur Telefonanlage.
// Fotos im Logo und Banner der Verwaltung sind unkenntlich, Beispieladressen erfunden.
import type { Akte, Bild } from "./typen";
import begehung from "../../assets/praxis/koch/begehung.webp";
import formular from "../../assets/praxis/koch/admin-formular.webp";
import energie from "../../assets/praxis/koch/energie.webp";
import uebersicht from "../../assets/praxis/koch/admin-uebersicht.webp";

const AUFGENOMMEN = "2026-10-24";

const bilder = {
  begehung: {
    art: "handy",
    src: begehung,
    alt: "Objekt-App am iPhone, Bildschirm „Neue Begehung“: Begehungsplanung, Grunddaten mit Objektauswahl und Termin, darunter Teilnehmer wie der Eigentümervertreter; Name und Adresse des Testobjekts sind geschwärzt.",
    unterschrift: "Neue Begehung in der Objekt-App",
    aufgenommen: "2025-09-18",
    daten: "angaben",
  },
  formular: {
    art: "desktop",
    src: formular,
    alt: "Backoffice der Verwaltung, Reiter Verwaltung: „Neues Formular erstellen“ mit WEG-Nummer, Frist, Bezeichnung und Adresse der Gemeinschaft, darunter die Einladungs-Mail an die Eigentümer; mit Beispielangaben, die Zähler der Reiter sind geschwärzt, die Fotos im Logo unkenntlich.",
    unterschrift: "Neue Stammdaten-Abfrage anlegen",
    aufgenommen: AUFGENOMMEN,
    daten: "beispielZaehler",
    ausschnitt: "50% 40%",
  },
  energie: {
    art: "desktop",
    src: energie,
    alt: "Startseite des Energieservice: „Schluss mit zu viel bezahlen.“, daneben das Formular mit Name, E-Mail, Art des Vertrags und dem Hochladen der letzten Jahresrechnung.",
    unterschrift: "Energieservice",
    aufgenommen: AUFGENOMMEN,
    daten: "oeffentlich",
    ausschnitt: "35% 40%",
  },
  uebersicht: {
    art: "desktop",
    src: uebersicht,
    alt: "Überblick im Backoffice: Kacheln für Verwaltung, Energie-Leads, Angebotsanfragen, Besucher und Einstellungen; die Zähler mit ihren Plaketten und die Fotos im Logo sind unkenntlich.",
    unterschrift: "Ein Backoffice für alle Dienste",
    aufgenommen: AUFGENOMMEN,
    daten: "zahlen",
  },
} satisfies Record<string, Bild>;

export const koch: Akte = {
  id: "koch",
  nr: "02",
  name: "Immobilienverwaltung KOCH",
  rolle: "Die Firma meines Bruders",
  kontext: "Verwaltung von Eigentümergemeinschaften und Mietshäusern",
  wandel: "Vom Microsoft-Formular zur eigenen Plattform, die heute der Verwaltung gehört.",
  status: "In Betrieb seit 07/2026",
  kennzahlen: [
    {
      wert: "15.10.2026",
      text: "seit diesem Tag gehört der Code der Verwaltung",
      beleg: { art: "verlauf", text: "Versionsgeschichte der Plattform", stand: "2026-10" },
    },
    {
      wert: "3",
      text: "Dienste auf einer Plattform, ein Backoffice",
      beleg: { art: "bild", text: "Backoffice der Verwaltung", stand: "2026-10" },
    },
  ],
  vorschau: [bilder.formular, bilder.energie, bilder.begehung],
  ausgangslage: {
    text: "Übernimmt die Verwaltung eine Eigentümergemeinschaft, braucht sie von allen Eigentümern Stammdaten, Bankverbindung und ein SEPA-Mandat; die Einladung dazu heißt „Verwalterwechsel + Abgleich Stammdaten“. Vorbild war ein Microsoft-Formular der Verwaltung.",
    belege: [
      { art: "dokument", text: "Vorbild der Einladung, im Code vermerkt", stand: "2026-07" },
      { art: "dokument", text: "Formular-Entwurf der Angebotsanfrage", stand: "2026-07" },
      { art: "dokument", text: "Word-Vorlage für das Begehungsprotokoll", stand: "2025-10" },
    ],
  },
  vorher: {
    kopf: "Vorher · Durchschlag für die Akte",
    zeilen: [
      "Vorbild der Einladung: ein Microsoft-Formular",
      "Angebotsanfrage Buchhaltung: nur ein Formular-Entwurf",
      "Vorlage fürs Begehungsprotokoll: eine Word-Tabelle der Verwaltung (10/2025)",
    ],
  },
  kapitel: [
    {
      id: "begehung",
      datum: { iso: "2025-09", genau: "monat" },
      stand: "ruht",
      titel: "Die Begehung auf iPad und iPhone, als Beta",
      kurz: "Begehung (Beta)",
      text: "Für die Objektbegehungen der Verwaltung entsteht im September 2025 eine App: Prüfpunkte je Objekt und Mängel mit Fotos. Ende Oktober gibt die Verwaltung ihre Word-Vorlage fürs Protokoll vor, vier Tage später erzeugt die App ihr PDF nach diesem Muster; im November kommt das Markieren auf Fotos dazu. Seit Februar 2026 ruht die App als Beta auf Testgeräten.",
      bilder: [bilder.begehung],
      vorher: "Die Vorlage der Verwaltung: eine Word-Tabelle mit Objekt, Datum, Teilnehmern, einem Kästchen je Prüfpunkt und drei Kästen für Mängel.",
      notiz: {
        wert: "4 Tage",
        text: "von der Word-Vorlage bis zum PDF aus der App",
        beleg: { art: "verlauf", text: "Word-Vorlage und Versionsgeschichte der App", stand: "2025-11" },
      },
      stempel: { oben: "BETA", unten: "TESTGERÄTE", farbe: "tinte" },
      belege: [
        { art: "verlauf", text: "Versionsgeschichte der Objekt-App", stand: "2025-11" },
        { art: "verlauf", text: "Gesprächsverlauf zur App", stand: "2026-02" },
        { art: "dokument", text: "Word-Vorlage für das Begehungsprotokoll", stand: "2025-10" },
      ],
    },
    {
      id: "stammdaten",
      datum: { iso: "2026-07-07", genau: "tag" },
      stand: "erledigt",
      titel: "Ein eigener Link für jeden Eigentümer",
      kurz: "Stammdaten",
      text: "Seit dem 8. Juli 2026 bekommt jeder Eigentümer einen eigenen Link, der nach dem Absenden verfällt. Die erste Fassung entsteht am Tag zuvor in zwei Stunden, gezählt ab dem Anlegen des Projekts: ein Formular je Eigentümergemeinschaft, eine IBAN-Prüfung, die Bank und BIC selbst findet, und eine Einladung mit QR-Code fürs Handy.",
      bilder: [bilder.formular],
      notiz: {
        wert: "3.430",
        text: "Bankleitzahlen kennt die IBAN-Prüfung",
        beleg: { art: "zaehlung", text: "Bankleitzahlen-Verzeichnis der Bundesbank im Code", stand: "2026-07" },
      },
      belege: [
        { art: "verlauf", text: "Versionsgeschichte der Plattform", stand: "2026-07" },
        { art: "dokument", text: "Prüfregeln im Formular", stand: "2026-08" },
      ],
    },
    {
      id: "angebote",
      datum: { iso: "2026-07-08", genau: "tag" },
      stand: "erledigt",
      titel: "Zwei neue Dienste, ein Backoffice",
      kurz: "Neue Dienste",
      text: "Am 8. und 9. Juli bekommt die Verwaltung zwei neue Dienste auf derselben Plattform: einen Energieservice, bei dem ein Foto der Jahresrechnung genügt, und einen Buchhaltungsservice mit Angebotsanfrage in zehn Minuten. Die Anfragen aus beiden sieht sie im selben Backoffice, Energie-Anfragen gehen gebündelt an den Partner.",
      bilder: [bilder.energie],
      vorher: "Die Angebotsanfrage für die Buchhaltung gab es nur als Entwurf im Formularbaukasten.",
      zusage: "anfragen",
      belege: [
        { art: "verlauf", text: "Versionsgeschichte der Plattform", stand: "2026-07" },
        { art: "bild", text: "öffentliche Seiten der Dienste", stand: "2026-10" },
      ],
    },
    {
      id: "telefon",
      datum: { iso: "2026-09", genau: "monat" },
      stand: "erledigt",
      titel: "Das Telefon zieht in die Cloud",
      kurz: "Telefonanlage",
      text: "Seit September 2026 telefoniert die Verwaltung über die gleiche Cloud-Telefonanlage wie Tennismehl: Rufnummern und Weiterleitungen aus einer Hand, und Anrufe kommen auch in der App am Handy an.",
      rufplan: {
        schritte: ["Eigentümer ruft an", "Telefonanlage in der Cloud", "Weiterleitung", "App am Handy"],
        alt: "Rufplan: Ein Eigentümer ruft an, die Telefonanlage in der Cloud leitet weiter, das Gespräch kommt in der App am Handy an.",
      },
      verweis: { akte: "tennismehl", kapitel: "telefon", text: "Wie das Telefon bei Tennismehl Vereine im Display zeigt" },
      belege: [{ art: "aussage", text: "Julian Koch zur Telefonanlage", stand: "2026-10" }],
    },
    {
      id: "uebergabe",
      datum: { iso: "2026-10-15", genau: "tag" },
      stand: "erledigt",
      titel: "Eigener Server, Übergabe an die Verwaltung",
      kurz: "Übergabe",
      text: "Am 15. Oktober übernimmt die Verwaltung ihre Plattform. An einem Vormittag zieht diese von zwei Cloud-Diensten auf einen eigenen Server, die alten Links funktionieren weiter; seitdem gehört der Code der Verwaltung. Eine Anleitung erklärt ihrem eigenen KI-Assistenten das System, damit die Verwaltung selbst weiterbauen kann.",
      vermerk: {
        text: "Mein Bruder muss dann befähigt werden, mit [seinem eigenen KI-Assistenten] ans Arbeiten zu kommen.",
        am: "2026-10-15",
      },
      vorher: "Die Plattform lief bei zwei Cloud-Diensten, der Code gehörte noch nicht der Verwaltung.",
      bilder: [bilder.uebersicht],
      notiz: {
        wert: "100 %",
        text: "gleiche Daten im Probelauf der Übernahme",
        beleg: { art: "zaehlung", text: "Abgleich Feld für Feld im Probelauf", stand: "2026-10" },
      },
      stempel: { oben: "ÜBERGEBEN", unten: "15.10.2026", farbe: "rot" },
      belege: [
        { art: "verlauf", text: "Versionsgeschichte der Plattform", stand: "2026-10" },
        { art: "dokument", text: "Anleitung für den KI-Assistenten", stand: "2026-10" },
        { art: "aussage", text: "Julian Koch am Tag der Übergabe", stand: "2026-10" },
      ],
    },
  ],
  bilanz: {
    vorher: [
      "Vorbild: ein Microsoft-Formular der Verwaltung",
      "Angebotsanfrage Buchhaltung: nur ein Entwurf",
      "Protokoll-Vorlage in Word",
    ],
    nachher: [
      "ein persönlicher Link je Eigentümer, mit IBAN-Prüfung und SEPA-Mandat",
      "Energie- und Buchhaltungsservice mit eigenem Auftritt",
      "ein Backoffice für alle Eingänge",
      "eine Begehungs-App als Beta, sie ruht auf Testgeräten",
      "eigener Server, der Code gehört der Verwaltung",
    ],
    naechstes:
      "Die beiden alten Cloud-Dienste der Plattform gehen nach einer letzten Datenübernahme vom Netz. Kleine Änderungen soll die Verwaltung künftig selbst machen, mit ihrem eigenen KI-Assistenten.",
    faden: { text: "Läuft in zwei Betrieben: die Telefonanlage", akte: "tennismehl", kapitel: "telefon" },
  },
};
