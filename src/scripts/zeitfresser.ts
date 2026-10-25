/* Zeitfresser-Check als kleines Spiel ------------------------------------------
   1. Karten sortieren: von Hand oder schon digital (Knöpfe, Pfeiltasten, Wischen).
   2. Werkbank: Regler je Aufgabe, die von Hand läuft, Schnellstart nach Teamgröße.
   3. Was durchrutscht: verpasste Anrufe und Angebote ohne Nachfassen.
   4. Wünsche, 5. Richtwerte, 6. Beleg als Beweisstück, auch als PDF.
   Das Ergebnis rechnet live mit und steht für Tracking und Anfrage als JSON in
   form[data-check].dataset.ergebnis, alle Angaben samt Sortierung (auch ohne Ergebnis) für die
   Statistik in dataset.angaben. Die Daten kommen aus Zeitfresser.astro. */

import { belegPdfErstellen, dateiAnbieten, type BelegDaten } from "./beleg-pdf";
import { spiele } from "./klang";
import {
  FLUGZEIT_MS,
  ploppen,
  stapelSpielEinrichten,
  type Sortierung,
  type Wechsel,
  type Wurf,
} from "./zeitfresser-stapel";

type Einheit = "Tag" | "Woche" | "Monat";
type Art = "vorgaenge" | "minuten" | "stunden";

type Aufgabe = {
  id: string;
  name: string;
  satz: string;
  einheit: Einheit;
  art: Art;
  minuten: number;
  presets: number[];
  max: number;
  schritt: string;
  einzahl: string;
  mehrzahl: string;
};

type Verlust = {
  id: string;
  name: string;
  einheit: Einheit;
  presets: number[];
  max: number;
  quote: number;
  einzahl: string;
  mehrzahl: string;
  artikel: string;
  schritt: string;
};

type Urteil = {
  kicker: string;
  titel: string;
  text: string;
  stempelOben: string;
  stempelUnten: string;
  telefon: string;
  schritt: string;
};

type Daten = {
  aufgaben: Aufgabe[];
  durchrutscher: Verlust[];
  teams: { wert: string; personen: number }[];
  teamStandard: number;
  auftragswerte: number[];
  stundensatz: number;
  urteile: Urteil[];
  kontakt: BelegDaten["kontakt"];
};

const ARBEITSTAGE = 220;
const ARBEITSWOCHEN = ARBEITSTAGE / 5;
const STUNDEN_PRO_TAG = 8;
const STUNDEN_VOLLZEIT = ARBEITSTAGE * STUNDEN_PRO_TAG;
// Monatliche Mengen laufen auch im Urlaub weiter, daher 12
const PRO_JAHR: Record<Einheit, number> = { Tag: ARBEITSTAGE, Woche: ARBEITSWOCHEN, Monat: 12 };
const ZEITRAUM: Record<Einheit, string> = { Tag: "Arbeitstage", Woche: "Wochen", Monat: "Monate" };
const PRO: Record<Einheit, string> = { Tag: "pro Tag", Woche: "pro Woche", Monat: "pro Monat" };
const HEBEL_MAX = 3;
const PUNKTE_MAX = 20;
const ZAEHLDAUER_MS = 400;
const DATEINAME = "Zeitfresser-Beleg-JTK.pdf";
const ANSAGE_PAUSE_MS = 1500;
// Ab diesen Kosten im Jahr wird das Urteil eine Stufe dringender. Wer schon alles digital macht,
// bekommt bis zu 50 % mehr Spielraum, unsortierte Karten zählen dabei wie von Hand.
const URTEIL_GRENZEN = [5000, 15000, 40000];
const URTEIL_SPIELRAUM = 0.5;
// Ab Stufe 2 ist der Anruf ernst gemeint, der Stempel wird rot
const URTEIL_ROT_AB = 2;
// Der Annahmedienst nimmt Stunden und Minuten nur bis 100.000 an
const STUNDEN_DECKEL = 100_000;

const ganzzahl = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
const kommazahl = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
// minimumFractionDigits ausdrücklich, ältere Safari werfen sonst einen RangeError
const euroFormat = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const euro = (betrag: number) => euroFormat.format(betrag);

// Auf 100 € gerundet, ab 10.000 € auf 1.000 €, alles andere wäre Scheingenauigkeit
function runden(betrag: number): number {
  const schritt = betrag >= 10000 ? 1000 : 100;
  return Math.round(betrag / schritt) * schritt;
}

// Nur Ziffern vor dem Komma zählen, so gehen „2.500“, „1.500,00“ oder „ca. 40“
function zahlAus(feld: HTMLInputElement | null | undefined): number {
  const wert = Number((feld?.value ?? "").split(",")[0].replace(/\D/g, ""));
  if (!Number.isFinite(wert)) return 0;
  // Richtwerte haben Grenzen, damit niemand aus Versehen mit 999 Minuten rechnet
  const max = Number(feld?.dataset.max);
  if (wert > 0 && max > 0 && wert > max) return max;
  const min = Number(feld?.dataset.min);
  if (wert > 0 && min > 0 && wert < min) return min;
  return wert;
}

function zufallsZeichen(anzahl: number): string {
  const zeichen = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(anzahl);
  try {
    crypto.getRandomValues(bytes);
  } catch {
    for (let i = 0; i < anzahl; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => zeichen[b % zeichen.length]).join("");
}

export function zeitfresserEinrichten(): void {
  const formular = document.querySelector<HTMLFormElement>("form[data-check]");
  const datenElement = formular?.querySelector<HTMLScriptElement>("script[data-check-daten]");
  if (!formular || !datenElement) return;

  let daten: Daten;
  try {
    daten = JSON.parse(datenElement.textContent ?? "") as Daten;
  } catch {
    return;
  }

  const bewegung = window.matchMedia("(prefers-reduced-motion: reduce)");
  const ruhig = () => bewegung.matches;

  const finde = <T extends Element = HTMLElement>(auswahl: string) => formular.querySelector<T>(auswahl);
  const alle = <T extends Element = HTMLElement>(auswahl: string) =>
    Array.from(formular.querySelectorAll<T>(auswahl));

  // Stapel
  const stapelBereich = finde("[data-stapel-bereich]");
  const stapelSpiel = finde("[data-stapel-spiel]");
  const stapel = finde("[data-stapel]");
  const karten = alle(".karte[data-karte]");
  const unter = alle("[data-stapel-unter]");
  const fortschritt = finde("[data-stapel-fortschritt]");
  const segmente = new Map(alle("[data-segment]").map((s) => [s.dataset.segment ?? "", s]));
  const zaehler = new Map(alle("[data-stapel-zahl]").map((z) => [z.dataset.stapelZahl ?? "", z]));
  const sortierKnoepfe = alle<HTMLButtonElement>("[data-sortieren]");
  const [zurueckKnopf, zurueckFertig] = alle<HTMLButtonElement>("[data-stapel-zurueck]");
  const restKnopf = finde<HTMLButtonElement>("[data-stapel-rest]");
  const fertigBox = finde("[data-stapel-fertig]");
  const bilanz = finde("[data-stapel-bilanz]");
  const neuKnopf = finde<HTMLButtonElement>("[data-stapel-neu]");
  const stapelAnsage = finde("[data-stapel-ansage]");

  // Werkbank und Durchrutscher
  const werkbank = finde("[data-werkbank]");
  const teamWahl = alle<HTMLInputElement>('input[name="team"]');
  const regler = new Map(
    alle<HTMLInputElement>("input[data-menge]").map((eingabe) => {
      const zeile = eingabe.closest<HTMLElement>("[data-regler]")!;
      return [
        eingabe.dataset.menge ?? "",
        {
          zeile,
          eingabe,
          zahl: zeile.querySelector<HTMLElement>("[data-regler-zahl]"),
          einheit: zeile.querySelector<HTMLElement>("[data-regler-einheit]"),
          rechnung: zeile.querySelector<HTMLElement>("[data-regler-rechnung]"),
        },
      ];
    }),
  );
  const rutscht = finde("[data-rutscht]");
  const verlustRegler = new Map(
    alle<HTMLInputElement>("input[data-verlust]").map((eingabe) => {
      const zeile = eingabe.closest<HTMLElement>("[data-verlust-zeile]")!;
      return [
        eingabe.dataset.verlust ?? "",
        {
          eingabe,
          zahl: zeile.querySelector<HTMLElement>("[data-regler-zahl]"),
          rechnung: zeile.querySelector<HTMLElement>("[data-regler-rechnung]"),
        },
      ];
    }),
  );
  const auftragswertFeld = finde<HTMLInputElement>("[data-auftragswert]");
  const rutschtErgebnis = finde("[data-rutscht-ergebnis]");
  const rutschtUebernehmen = finde<HTMLButtonElement>("[data-rutscht-uebernehmen]");
  const wuenscheBox = finde("[data-wuensche]");
  const wunschFelder = alle<HTMLInputElement>("input[data-wunsch]");

  // Richtwerte
  const richtwerteBox = finde<HTMLDetailsElement>("[data-richtwerte]");
  const stundensatzFeld = finde<HTMLInputElement>("[data-stundensatz]");
  const richtwertFelder = new Map(alle<HTMLInputElement>("[data-richtwert]").map((f) => [f.dataset.richtwert ?? "", f]));
  const quoteFelder = new Map(alle<HTMLInputElement>("[data-quote-fuer]").map((f) => [f.dataset.quoteFuer ?? "", f]));
  const richtwerteStandard = finde<HTMLButtonElement>("[data-richtwerte-standard]");

  // Ergebnis
  const tafel = finde("[data-ergebnis-tafel]");
  const euroAnzeige = finde("[data-ergebnis-euro]");
  const unterzeile = finde("[data-ergebnis-unter]");
  const raster = finde("[data-pixeljahr]");
  const zellen = raster ? Array.from(raster.children) as HTMLElement[] : [];
  const mal = finde("[data-pixeljahr-mal]");
  const pixelText = finde("[data-pixeljahr-text]");
  const vergleichListe = finde("[data-vergleich]");
  const umsatzZeile = finde("[data-ergebnis-umsatz]");
  const urteilBox = finde("[data-urteil]");
  const urteilKicker = finde("[data-urteil-kicker]");
  const urteilTitel = finde("[data-urteil-titel]");
  const urteilText = finde("[data-urteil-text]");
  const urteilTelefon = finde<HTMLAnchorElement>("[data-urteil-telefon]");
  const ausstellenKnopf = finde<HTMLButtonElement>("[data-beleg-ausstellen]");
  const besprechenKnoepfe = alle<HTMLButtonElement>("[data-check-besprechen]");
  const ansage = finde("[data-check-ansage]");
  const leiste = finde("[data-check-leiste]");
  const leisteEuro = finde("[data-leiste-euro]");
  const leisteText = finde("[data-leiste-text]");

  // Beleg
  const belegBereich = finde("[data-beleg-bereich]");
  const zettel = finde("[data-zettel]");
  const zettelTitel = finde("[data-zettel-titel]");
  const zettelNr = finde("[data-zettel-nr]");
  const zettelDatum = finde("[data-zettel-datum]");
  const zettelTeam = finde("[data-zettel-team]");
  const zettelZeilen = finde("[data-zettel-zeilen]");
  const zettelHandarbeit = finde("[data-zettel-handarbeit]");
  const zettelUmsatz = finde("[data-zettel-umsatz]");
  const zettelSumme = finde("[data-zettel-summe]");
  const zettelSummeTitel = finde("[data-zettel-summe-titel]");
  const zettelHinweis = finde("[data-zettel-hinweis]");
  const stempelOben = finde<SVGTextElement>("[data-stempel-oben]");
  const stempelUnten = finde<SVGTextElement>("[data-stempel-unten]");
  const stempelText = finde("[data-stempel-text]");
  const hebelListe = finde("[data-hebel-liste]");
  const hebelTitel = finde("[data-hebel-titel]");
  const pdfKnopf = finde<HTMLButtonElement>("[data-beleg-pdf]");
  const pdfStatus = finde("[data-pdf-status]");

  const stand = document.querySelector<HTMLElement>("[data-check-stand]");
  const satzAnzeige = document.querySelector<HTMLElement>("[data-check-satz]");

  const aufgabeNach = new Map(daten.aufgaben.map((a) => [a.id, a]));
  const anzahl = karten.length;

  /* Zustand ------------------------------------------------------------------- */

  const sortiert = new Map<string, Sortierung>();
  let index = 0;
  let sortierModus = true;
  // Ab der ersten Karte von Hand (oder nach dem Sortieren) geht es mit Werkbank und Co. weiter
  let begonnen = false;
  // Die Durchrutscher sind nur Vorschläge, bis der Besucher sie bewegt oder bestätigt
  let rutschtGeprueft = false;
  // Die Teamgröße zählt nur, wenn der Besucher die Auswahl auch gesehen hat
  let teamGesehen = false;
  // Für die Statistik: Was hat der Besucher selbst eingestellt und was ist nur ein Vorschlag?
  let teamAngeklickt = false;
  const eingestellt = new Set<string>();
  // modus: ob beim Schritt gerade sortiert wurde, damit Rückgängig dorthin zurückkehrt
  const verlauf: { aenderungen: [string, Sortierung | undefined][]; index: number; modus: boolean }[] = [];
  let belegNummer = "";

  const kartenId = (karte: HTMLElement | undefined) => karte?.dataset.karte ?? "";
  const einheitText = (a: Aufgabe, menge: number) => `${menge === 1 ? a.einzahl : a.mehrzahl} ${PRO[a.einheit]}`;
  const stundensatz = () => zahlAus(stundensatzFeld) || daten.stundensatz;
  // Bei Minuten und Stunden ist der Regler selbst die Zeit
  const minutenJe = (a: Aufgabe) =>
    a.art === "minuten" ? 1 : a.art === "stunden" ? 60 : zahlAus(richtwertFelder.get(a.id)) || a.minuten;
  const quote = (v: Verlust) => zahlAus(quoteFelder.get(v.id)) || v.quote;
  // Wer etwas einstellt, soll nicht „0 Std.“ lesen
  const jahresStunden = (a: Aufgabe, menge: number) =>
    menge > 0 ? Math.max(1, Math.round((menge * minutenJe(a) * PRO_JAHR[a.einheit]) / 60)) : 0;
  const team = () => {
    const gewaehlt = teamWahl.find((r) => r.checked);
    const i = gewaehlt ? Number(gewaehlt.dataset.team) : daten.teamStandard;
    return daten.teams[i] ?? daten.teams[daten.teamStandard];
  };

  const zustand = () => {
    const satz = stundensatz();
    const posten = daten.aufgaben
      .filter((a) => sortiert.get(a.id) === "hand")
      .map((a) => {
        const menge = Number(regler.get(a.id)?.eingabe.value ?? 0);
        const stunden = jahresStunden(a, menge);
        return { a, menge, minutenJe: minutenJe(a), stunden, euro: stunden * satz };
      })
      .filter((p) => p.menge > 0);

    const zaehltRutscht = begonnen && rutschtGeprueft;
    const auftragswert = zaehltRutscht ? zahlAus(auftragswertFeld) : 0;
    const verluste = zaehltRutscht
      ? daten.durchrutscher.map((v) => {
          const menge = Number(verlustRegler.get(v.id)?.eingabe.value ?? 0);
          const q = quote(v);
          const auftraege = (menge * PRO_JAHR[v.einheit]) / q;
          return { v, menge, quote: q, auftraege, umsatz: Math.round(auftraege * auftragswert) };
        })
      : [];

    const stunden = posten.reduce((s, p) => s + p.stunden, 0);
    const euroGenau = stunden * satz;
    const umsatzGenau = verluste.reduce((s, v) => s + v.umsatz, 0);
    return {
      satz,
      posten,
      verluste,
      auftragswert,
      stunden,
      euroGenau,
      euro: runden(euroGenau),
      umsatzGenau,
      umsatz: runden(umsatzGenau),
      stellen: stunden / STUNDEN_VOLLZEIT,
      team: team(),
      teamGewaehlt: teamGesehen,
      wuensche: wunschFelder.filter((f) => f.checked).map((f) => f.value),
    };
  };
  type Zustand = ReturnType<typeof zustand>;
  const hatErgebnis = (z: Zustand) => z.stunden > 0 || z.umsatz > 0;

  // Gerechnet mit den angezeigten, gerundeten Beträgen, damit Urteil und Tafel zusammenpassen
  const urteilStufe = (z: Zustand) => {
    const digital = Array.from(sortiert.values()).filter((s) => s === "digital").length;
    const spielraum = 1 + URTEIL_SPIELRAUM * (digital / (anzahl || 1));
    const kosten = z.euro + z.umsatz;
    return URTEIL_GRENZEN.filter((grenze) => kosten >= grenze * spielraum).length;
  };
  const urteil = (z: Zustand) => {
    const stufe = urteilStufe(z);
    return { stufe, ...(daten.urteile[stufe] ?? daten.urteile[daten.urteile.length - 1]) };
  };
  const urteilSatz = (z: Zustand, text: string) => text.replace("{betrag}", euro(z.euro + z.umsatz));

  // Alles, was der Besucher angegeben hat, auch ohne Ergebnis und auch, was schon digital läuft.
  // Format CheckStand aus website-dienst/API.md im Portal-Repo; Mengen nur für Karten von Hand.
  const standFuerStatistik = (z: Zustand) => {
    const verlust = (id: string) => z.verluste.find((v) => v.v.id === id);
    // Leere Felder rechnen mit dem Standard, also zählen sie auch hier nicht als geändert
    const abweichend = (f: HTMLInputElement) => (zahlAus(f) || Number(f.dataset.standard)) !== Number(f.dataset.standard);
    return {
      karten: daten.aufgaben.map((a) => {
        const sortierung = sortiert.get(a.id) ?? null;
        const vonHand = sortierung === "hand";
        const menge = vonHand ? Number(regler.get(a.id)?.eingabe.value ?? 0) : null;
        return {
          id: a.id,
          name: a.name,
          sortierung,
          einheit: a.einheit,
          art: a.art,
          menge,
          eingestellt: vonHand ? eingestellt.has(a.id) : null,
          minutenJe: vonHand ? minutenJe(a) : null,
          stunden: menge === null ? null : Math.min(STUNDEN_DECKEL, jahresStunden(a, menge)),
        };
      }),
      alleSortiert: daten.aufgaben.every((a) => sortiert.has(a.id)),
      teamgroesse: z.teamGewaehlt ? z.team.wert : null,
      teamGewaehlt: teamAngeklickt,
      stundensatz: z.satz,
      richtwerteGeaendert: [...richtwertFelder.values(), ...quoteFelder.values()].some(abweichend),
      durchrutscher:
        z.verluste.length > 0
          ? {
              verpassteAnrufeProWoche: verlust("verpasst")?.menge ?? 0,
              angeboteOhneNachfassenProMonat: verlust("nachfassen")?.menge ?? 0,
              auftragswert: z.auftragswert,
              quoteAnrufe: verlust("verpasst")?.quote ?? null,
              quoteAngebote: verlust("nachfassen")?.quote ?? null,
            }
          : null,
      wuensche: z.wuensche,
      ergebnis: hatErgebnis(z)
        ? { stunden: Math.min(STUNDEN_DECKEL, z.stunden), euro: z.euro, umsatz: z.umsatz, urteil: urteilStufe(z) }
        : null,
    };
  };

  // Programmatische Änderungen melden, wie es Regler und Checkboxen von selbst tun
  const geaendert = () => formular.dispatchEvent(new Event("change", { bubbles: true }));
  // Beim Sortieren spricht schon die Stapel-Ansage, das Ergebnis schweigt dann
  let stilleAenderung = false;
  const geaendertStill = () => {
    stilleAenderung = true;
    geaendert();
    stilleAenderung = false;
  };

  /* Texte --------------------------------------------------------------------- */

  // Im Dativ, passend zu „das entspricht …“
  const umfang = (z: Zustand) => {
    if (z.stellen >= 0.95 && z.stellen < 1.05) return "das entspricht etwa einer Vollzeitstelle";
    if (z.stellen >= 0.1) return `das entspricht etwa ${kommazahl.format(z.stellen)} Vollzeitstellen`;
    const tage = Math.max(1, Math.round(z.stunden / STUNDEN_PRO_TAG));
    return tage === 1 ? "das entspricht etwa einem Arbeitstag" : `das entspricht etwa ${tage} Arbeitstagen`;
  };

  const stellenText = (stellen: number) => {
    const text = kommazahl.format(stellen);
    return text === "1" ? "rund eine Vollzeitstelle" : `rund ${text} Vollzeitstellen`;
  };

  // Greifbare Vergleiche, ehrlich gerechnet. Höchstens zwei, sonst wird es eine Liste.
  const vergleiche = (z: Zustand): string[] => {
    if (z.stunden <= 0) return [];
    const liste: string[] = [];
    const personen = z.team.personen;
    const proKopfWoche = z.stunden / personen / ARBEITSWOCHEN;
    const bei = `Bei rund ${personen} Personen ist das, als`;
    if (z.stunden > personen * STUNDEN_VOLLZEIT) {
      liste.push(`Das ist mehr Arbeitszeit, als ${personen} Personen im ganzen Jahr haben. Prüfen Sie die Regler noch einmal.`);
    } else if (proKopfWoche >= 16) {
      liste.push(`${bei} hätte Ihr ganzes Team jede Woche zwei Tage bezahlt frei.`);
    } else if (proKopfWoche >= 8) {
      liste.push(`${bei} hätte Ihr ganzes Team jede Woche einen Tag bezahlt frei.`);
    } else if (proKopfWoche >= 1) {
      // Abgerundet, damit der Vergleich eher zu klein als zu groß ist
      const uhr = 16 - Math.floor(proKopfWoche);
      liste.push(`${bei} würde Ihr ganzes Team jeden Freitag schon um ${uhr} Uhr statt um 16 Uhr bezahlt nach Hause gehen.`);
    }
    if (z.stellen >= 0.95 && z.stellen < 1.05) {
      liste.push("Das ist eine Vollzeitstelle, die nur abtippt, sucht und telefoniert.");
    } else if (z.stellen >= 1.05) {
      liste.push(`Das sind ${stellenText(z.stellen)}, die nur abtippen, suchen und telefonieren.`);
    } else if (z.stellen >= 0.5) {
      liste.push("Das ist mehr als eine halbe Stelle, die nur abtippt, sucht und telefoniert.");
    }
    if (liste.length < 2) {
      // Angebote nur, wenn es höchstens doppelt so viele wären wie heute. Mehr Nachfrage hat kaum ein Betrieb.
      const angebot = aufgabeNach.get("angebote");
      const heute = z.posten.find((p) => p.a.id === "angebote");
      const proJahr = heute ? heute.menge * PRO_JAHR[heute.a.einheit] : 0;
      const minutenAngebot = angebot ? minutenJe(angebot) : 20;
      const angebote = Math.floor((z.stunden * 60) / minutenAngebot / 10) * 10;
      const wochenStunden = Math.floor(z.stunden / ARBEITSWOCHEN);
      if (angebote >= 10 && proJahr > 0 && angebote <= proJahr * 2) {
        liste.push(`Dafür könnten Sie rund ${ganzzahl.format(angebote)} Angebote mehr im Jahr schreiben.`);
      } else if (z.stellen < 0.5 && wochenStunden >= 2) {
        liste.push(`Das ist so viel Arbeit wie eine Teilzeitstelle mit rund ${wochenStunden} Stunden pro Woche, die nur abtippt, sucht und telefoniert.`);
      }
    }
    return liste.slice(0, 2);
  };

  // Erst ab 1,05 Stellen lohnt der Hinweis, sonst stünde dort „×1“
  const mehrAlsEineStelle = (z: Zustand) => z.stellen >= 1.05;

  const pixelSatz = (z: Zustand) => {
    const tage = z.stunden / STUNDEN_PRO_TAG;
    if (z.stunden <= 0) return "Noch kein Arbeitstag eingefärbt. Jedes Kästchen ist ein Arbeitstag einer Vollzeitkraft.";
    if (Math.round(tage) < 1) return "Weniger als ein Arbeitstag einer Vollzeitkraft geht für Handarbeit drauf.";
    if (tage <= ARBEITSTAGE + 0.5) {
      return `${ganzzahl.format(Math.round(tage))} von ${ARBEITSTAGE} Arbeitstagen einer Vollzeitkraft bezahlen Sie fürs Abtippen, Suchen und Telefonieren.`;
    }
    const alle = `Alle ${ARBEITSTAGE} Arbeitstage einer Vollzeitkraft bezahlen Sie fürs Abtippen, Suchen und Telefonieren`;
    if (!mehrAlsEineStelle(z)) return `${alle}.`;
    return `${alle}, und das reicht nicht: Die Handarbeit füllt ${stellenText(z.stellen)}.`;
  };

  const ansageText = (z: Zustand) => {
    if (!hatErgebnis(z)) return "";
    const teile: string[] = [];
    if (z.stunden > 0) teile.push(`Handarbeit kostet rund ${euro(z.euro)} im Jahr.`);
    if (z.umsatz > 0) teile.push(`Dazu entgehen rund ${euro(z.umsatz)} Umsatz.`);
    teile.push(`Urteil: ${urteil(z).titel}`);
    return teile.join(" ");
  };

  const quellenText = (z: Zustand) =>
    z.verluste
      .filter((v) => v.menge > 0)
      .map((v) => v.v.mehrzahl)
      .join(" und ");

  /* Anzeige: Regler ----------------------------------------------------------- */

  const anteil = (eingabe: HTMLInputElement) =>
    `${(Number(eingabe.value) / (Number(eingabe.max) || 1)) * 100}%`;

  const reglerAktualisieren = (z: Zustand) => {
    for (const a of daten.aufgaben) {
      const r = regler.get(a.id);
      if (!r) continue;
      const menge = Number(r.eingabe.value);
      const text = einheitText(a, menge);
      if (r.zahl) r.zahl.textContent = ganzzahl.format(menge);
      if (r.einheit) r.einheit.textContent = text;
      r.eingabe.setAttribute("aria-valuetext", `${ganzzahl.format(menge)} ${text}`);
      r.eingabe.style.setProperty("--anteil", anteil(r.eingabe));
      if (!r.rechnung) continue;
      if (menge === 0) {
        r.rechnung.textContent = "Steht auf null und zählt nicht mit.";
        continue;
      }
      const stunden = jahresStunden(a, menge);
      const weg =
        a.art === "vorgaenge"
          ? `${ganzzahl.format(menge)} ${PRO[a.einheit]} × ${minutenJe(a)} Min.`
          : `${ganzzahl.format(menge)} ${a.art === "minuten" ? "Min." : "Std."} ${PRO[a.einheit]}`;
      r.rechnung.textContent = `${weg} × ${PRO_JAHR[a.einheit]} ${ZEITRAUM[a.einheit]} = ${ganzzahl.format(stunden)} Std., rund ${euro(runden(stunden * z.satz))} im Jahr`;
    }

    const wert = zahlAus(auftragswertFeld);
    for (const v of daten.durchrutscher) {
      const r = verlustRegler.get(v.id);
      if (!r) continue;
      const menge = Number(r.eingabe.value);
      if (r.zahl) r.zahl.textContent = ganzzahl.format(menge);
      r.eingabe.setAttribute("aria-valuetext", `${menge} ${menge === 1 ? v.einzahl : v.mehrzahl} ${PRO[v.einheit]}`);
      r.eingabe.style.setProperty("--anteil", anteil(r.eingabe));
      if (!r.rechnung) continue;
      if (menge === 0) {
        r.rechnung.textContent = "Steht auf null und zählt nicht mit.";
        continue;
      }
      const q = quote(v);
      const auftraege = (menge * PRO_JAHR[v.einheit]) / q;
      // Kommazahl und gerundeter Umsatz, so geht die Rechnung auch beim Nachrechnen auf
      r.rechnung.textContent =
        `${menge} ${PRO[v.einheit]} × ${PRO_JAHR[v.einheit]} ${ZEITRAUM[v.einheit]}, davon ${v.artikel} ${q}. ein Auftrag: ${kommazahl.format(auftraege)} Aufträge` +
        (wert > 0 ? `, rund ${euro(runden(auftraege * wert))} Umsatz` : "");
    }

    if (rutschtErgebnis) {
      const mitMenge = z.verluste.some((v) => v.menge > 0);
      rutschtErgebnis.textContent = !rutschtGeprueft
        ? "Noch nicht eingerechnet. Stellen Sie die Regler auf Ihre Werte oder bestätigen Sie die Vorschläge."
        : z.umsatz > 0
          ? `Dazu entgehen Ihnen rund ${euro(z.umsatz)} Umsatz im Jahr.`
          : mitMenge && z.auftragswert === 0
            ? "Tragen Sie noch Ihren durchschnittlichen Auftragswert ein, dann sehen Sie, was Ihnen entgeht."
            : "Bei Ihnen rutscht nichts durch. Glückwunsch.";
    }
    if (rutschtUebernehmen) rutschtUebernehmen.hidden = rutschtGeprueft;
  };

  /* Anzeige: Zähler ----------------------------------------------------------- */

  let angezeigt = 0;
  let zielwert = 0;
  let zaehlRahmen = 0;

  const betragZeigen = (wert: number) => {
    const text = euro(wert);
    if (euroAnzeige) euroAnzeige.textContent = text;
    if (leisteEuro) leisteEuro.textContent = text;
  };

  const zaehlen = (ziel: number) => {
    if (ziel === zielwert) return;
    zielwert = ziel;
    window.cancelAnimationFrame(zaehlRahmen);
    if (ruhig()) {
      angezeigt = ziel;
      betragZeigen(ziel);
      return;
    }
    const start = angezeigt;
    const beginn = performance.now();
    const schritt = (jetzt: number) => {
      const t = Math.min(1, (jetzt - beginn) / ZAEHLDAUER_MS);
      const weich = 1 - Math.pow(1 - t, 3);
      angezeigt = start + (ziel - start) * weich;
      betragZeigen(t < 1 ? Math.round(angezeigt / 100) * 100 : ziel);
      if (t < 1) zaehlRahmen = window.requestAnimationFrame(schritt);
    };
    zaehlRahmen = window.requestAnimationFrame(schritt);
  };

  /* Anzeige: Pixeljahr -------------------------------------------------------- */

  let gefaerbt = 0;

  const pixelSetzen = (z: Zustand) => {
    const ziel = Math.min(zellen.length, Math.round(z.stunden / STUNDEN_PRO_TAG));
    if (ziel > gefaerbt) {
      const neu = ziel - gefaerbt;
      // Höchstens rund 350 ms für die ganze Welle
      const abstand = Math.min(14, 350 / neu);
      for (let i = gefaerbt; i < ziel; i++) {
        const zelle = zellen[i];
        zelle.classList.add("ist-weg");
        if (!ruhig()) {
          zelle.style.animationDelay = `${Math.round((i - gefaerbt) * abstand)}ms`;
          zelle.classList.add("brennt");
        }
      }
    } else {
      for (let i = ziel; i < gefaerbt; i++) zellen[i].classList.remove("ist-weg", "brennt");
    }
    gefaerbt = ziel;

    const satz = pixelSatz(z);
    if (pixelText) pixelText.textContent = satz;
    raster?.setAttribute("aria-label", `Arbeitsjahr einer Vollzeitkraft, 220 Kästchen. ${satz}`);
    if (mal) {
      const mehr = mehrAlsEineStelle(z);
      mal.hidden = !mehr;
      mal.textContent = mehr ? `×${kommazahl.format(z.stellen)}` : "";
    }
  };
  raster?.addEventListener("animationend", (event) => (event.target as HTMLElement).classList.remove("brennt"));

  /* Anzeige: Stapel ----------------------------------------------------------- */

  const ansagen = (ort: HTMLElement | null, text: string) => {
    if (ort) ort.textContent = text;
  };

  const stapelAnsicht = () => {
    if (stapelSpiel) stapelSpiel.hidden = !sortierModus;
    if (fertigBox) fertigBox.hidden = sortierModus;
  };

  // Was gerade noch durch die Luft fliegt, zählt erst, wenn es im Knopf gelandet ist
  const fliegend = new Map<string, Sortierung | undefined>();
  const sichtbarerStand = (id: string) => (fliegend.has(id) ? fliegend.get(id) : sortiert.get(id));

  // Balken und Zähler in den Knöpfen, immer aus sortiert abgeleitet
  const standZeigen = () => {
    const summe: Record<Sortierung, number> = { hand: 0, digital: 0 };
    karten.forEach((k, i) => {
      const id = kartenId(k);
      const s = sichtbarerStand(id);
      if (s) summe[s] += 1;
      const segment = segmente.get(id);
      if (!segment) return;
      segment.dataset.stand = s ?? "";
      segment.classList.toggle("ist-jetzt", sortierModus && i === index);
    });
    zaehler.forEach((z, art) => (z.textContent = String(summe[art as Sortierung] ?? 0)));
  };

  const bisherZeigen = (karte: HTMLElement | undefined) => {
    const marke = karte?.querySelector<HTMLElement>("[data-karte-bisher]");
    if (!karte || !marke) return;
    const bisher = sortiert.get(kartenId(karte));
    marke.hidden = !bisher;
    marke.textContent = bisher ? `Bisher: ${bisher === "hand" ? "von Hand" : "digital"}` : "";
  };

  const stapelZeigen = (wechsel: Wechsel = "ruhe", art?: Sortierung) => {
    const karte = karten[index];
    const darunter = karten[index + 1];
    // Wer den Stapel fokussiert, hört gleich, welche Karte oben liegt
    if (karte) stapel?.setAttribute("aria-describedby", `${karte.id} zf-stapel-hilfe`);
    // Plaketten nur für Karten, die in dieser Runde noch kommen. Alle liegen im selben Feld,
    // so bleibt die Stapelhöhe während der Runde gleich.
    karten.slice(index).forEach(bisherZeigen);
    spiel?.zeigen(karte, darunter, wechsel, art);
    // Die nächste Karte liegt sichtbar darunter, der Rand darunter deutet den Rest an
    const rest = anzahl - index - 1;
    unter.forEach((u) => (u.hidden = rest < Number(u.dataset.stapelUnter)));
    if (fortschritt) fortschritt.textContent = `${Math.min(index + 1, anzahl)} von ${anzahl}`;
    standZeigen();
    if (zurueckKnopf) {
      const warFokus = document.activeElement === zurueckKnopf;
      zurueckKnopf.disabled = verlauf.length === 0;
      if (warFokus && zurueckKnopf.disabled) stapel?.focus();
    }
    if (zurueckFertig) {
      const warFokus = document.activeElement === zurueckFertig;
      zurueckFertig.hidden = verlauf.length === 0;
      if (warFokus && zurueckFertig.hidden) fertigBox?.focus();
    }
    if (restKnopf) {
      const offen = karten.slice(index).some((k) => !sortiert.has(kartenId(k)));
      restKnopf.textContent =
        sortiert.size === 0 ? "Überspringen: alle von Hand" : offen ? "Alle übrigen: von Hand" : "Übrige so lassen";
    }
  };

  const bilanzSetzen = () => {
    if (!bilanz) return;
    const hand = Array.from(sortiert.values()).filter((s) => s === "hand").length;
    bilanz.textContent =
      hand === 0
        ? `Alle ${anzahl} Aufgaben laufen bei Ihnen schon digital. Stark. Schauen Sie trotzdem, was Ihnen durchrutscht.`
        : `Sortiert: ${hand} ${hand === 1 ? "Aufgabe läuft" : "Aufgaben laufen"} bei Ihnen von Hand, ${anzahl - hand} schon digital. Jetzt stellen Sie ein, wie oft das anfällt.`;
  };

  const ansichtAktualisieren = () => {
    const hand = Array.from(sortiert.values()).filter((s) => s === "hand").length;
    if (werkbank) werkbank.hidden = hand === 0;
    if (hand > 0) teamGesehen = true;
    if (!sortierModus) bilanzSetzen();
    regler.forEach((r, id) => (r.zeile.hidden = sortiert.get(id) !== "hand"));
    if (rutscht) rutscht.hidden = !begonnen;
    if (wuenscheBox) wuenscheBox.hidden = !begonnen;
    if (richtwerteBox) richtwerteBox.hidden = !begonnen;
    if (stand) {
      stand.textContent =
        sortiert.size === 0
          ? "Noch keine Karte sortiert"
          : sortierModus
            ? `${sortiert.size} von ${anzahl} Karten sortiert`
            : `${hand} von Hand, ${anzahl - hand} digital`;
    }
  };

  /* Anzeige: Beleg ------------------------------------------------------------ */

  const heute = () => new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  const neueNummer = () => {
    const d = new Date();
    const zwei = (n: number) => String(n).padStart(2, "0");
    return `ZF-${d.getFullYear()}${zwei(d.getMonth() + 1)}${zwei(d.getDate())}-${zufallsZeichen(4)}`;
  };

  const hinweisText = (z: Zustand) => {
    let text = `Vorsichtig gerechnet mit Ihren Angaben, ${z.satz} € pro Stunde, ${ARBEITSTAGE} Arbeitstagen. Beträge gerundet.`;
    if (z.umsatz > 0) {
      const [anrufe, angebote] = daten.durchrutscher.map((v) => quote(v));
      text += ` Beim Umsatz zählt nur jeder ${anrufe}. verpasste Anruf und jedes ${angebote}. Angebot ohne Nachfassen als Auftrag.`;
    }
    return text;
  };

  const ZAHLWORT = ["", "", "zwei", "drei"];
  const hebelUeberschrift = (anzahlHebel: number) =>
    anzahlHebel <= 1 ? "Ihr größter Hebel" : `Ihre ${ZAHLWORT[anzahlHebel] ?? anzahlHebel} größten Hebel`;

  const hebel = (z: Zustand) => {
    const liste = [...z.posten]
      .sort((a, b) => b.stunden - a.stunden)
      .slice(0, HEBEL_MAX)
      .map((p) => ({ titel: `${p.a.name}: rund ${euro(runden(p.euro))} im Jahr`, schritt: p.a.schritt }));
    if (liste.length < HEBEL_MAX) {
      liste.push(
        ...z.verluste
          .filter((v) => v.umsatz > 0)
          .sort((a, b) => b.umsatz - a.umsatz)
          .slice(0, HEBEL_MAX - liste.length)
          .map((v) => ({ titel: `${v.v.name}: rund ${euro(runden(v.umsatz))} Umsatz im Jahr`, schritt: v.v.schritt })),
      );
    }
    return liste;
  };

  const belegDaten = (z: Zustand): BelegDaten => ({
    nummer: belegNummer,
    datum: heute(),
    team: z.teamGewaehlt ? `${z.team.wert} Personen` : "nicht angegeben",
    // Überall dieselbe Rundung wie im Live-Zähler, sonst stehen für dieselbe Sache zwei Zahlen da
    zeilen: [...z.posten]
      .sort((a, b) => b.euro - a.euro)
      .map((p) => ({ aufgabe: p.a.name, stunden: p.stunden, euro: runden(p.euro) })),
    stunden: z.stunden,
    euroHandarbeit: z.euro,
    umsatz: z.umsatz,
    summe: z.euro + z.umsatz,
    // Umsatz ist kein Kostenposten, deshalb sagt die Summe dann ehrlich „und entgangen“
    summeTitel: z.umsatz > 0 ? "Verbrannt und entgangen pro Jahr" : "Verbrannt pro Jahr",
    hinweis: hinweisText(z),
    hebel: hebel(z),
    hebelTitel: hebelUeberschrift(hebel(z).length),
    stempel: (() => {
      const u = urteil(z);
      return { oben: u.stempelOben, unten: u.stempelUnten, rot: u.stufe >= URTEIL_ROT_AB };
    })(),
    schritt: urteil(z).schritt,
    kontakt: daten.kontakt,
  });

  let letzterBeleg = "";

  const belegFuellen = (z: Zustand) => {
    const d = belegDaten(z);
    const schluessel = JSON.stringify(d);
    if (schluessel === letzterBeleg) return;
    letzterBeleg = schluessel;

    if (zettelNr) zettelNr.textContent = d.nummer;
    if (zettelDatum) zettelDatum.textContent = d.datum;
    if (zettelTeam) zettelTeam.textContent = d.team;
    if (zettelZeilen) {
      const zelle = (text: string, klasse = "") => {
        const td = document.createElement("td");
        if (klasse) td.className = klasse;
        td.textContent = text;
        return td;
      };
      const zeilen = d.zeilen.map((zeile, i) => {
        const tr = document.createElement("tr");
        tr.append(
          zelle(String(i + 1), "zettel__pos"),
          zelle(zeile.aufgabe),
          zelle(ganzzahl.format(zeile.stunden), "rechts"),
          zelle(ganzzahl.format(zeile.euro), "rechts"),
        );
        return tr;
      });
      if (zeilen.length === 0) {
        const tr = document.createElement("tr");
        const td = zelle("Keine Handarbeit eingetragen");
        td.colSpan = 4;
        tr.append(td);
        zeilen.push(tr);
      }
      zettelZeilen.replaceChildren(...zeilen);
    }
    if (zettelHandarbeit) zettelHandarbeit.textContent = `${ganzzahl.format(d.stunden)} Std. · ${euro(d.euroHandarbeit)}`;
    if (zettelUmsatz) zettelUmsatz.textContent = euro(d.umsatz);
    if (zettelSumme) zettelSumme.textContent = euro(d.summe);
    if (zettelSummeTitel) zettelSummeTitel.textContent = d.summeTitel;
    if (hebelTitel) hebelTitel.textContent = hebelUeberschrift(d.hebel.length);
    if (zettelHinweis) zettelHinweis.textContent = d.hinweis;
    if (zettel) zettel.classList.toggle("stempel-blau", !d.stempel.rot);
    // Kurze Wörter nicht auf volle Breite ziehen, sonst stehen die Buchstaben weit auseinander
    if (stempelOben) {
      stempelOben.textContent = d.stempel.oben;
      stempelOben.setAttribute("textLength", String(Math.min(214, d.stempel.oben.length * 27)));
    }
    if (stempelUnten) {
      stempelUnten.textContent = d.stempel.unten;
      stempelUnten.setAttribute("textLength", String(Math.min(196, d.stempel.unten.length * 10.4)));
    }
    if (stempelText) {
      const ende = /[?.!]$/.test(d.stempel.unten) ? "" : ".";
      stempelText.textContent = `Stempel: ${d.stempel.oben}, ${d.stempel.unten}${ende}`;
    }
    if (hebelListe) {
      hebelListe.replaceChildren(
        ...d.hebel.map((h) => {
          const li = document.createElement("li");
          const titel = document.createElement("strong");
          titel.textContent = h.titel;
          const schritt = document.createElement("span");
          schritt.textContent = h.schritt;
          li.append(titel, schritt);
          return li;
        }),
      );
    }
  };

  /* Alles neu berechnen ------------------------------------------------------- */

  let letzteAnsage = "";
  let ansageWarten = 0;
  // Urteilsstufe der letzten Ansage: Nur ein Anstieg ins Ernste klingt
  let ansageStufe = 0;
  let mitErgebnis = false;
  let checkImBild = false;
  let tafelImBild = false;
  let belegImBild = false;

  const leisteSetzen = () => {
    if (!leiste) return;
    leiste.hidden = !(mitErgebnis && checkImBild && !tafelImBild && !belegImBild);
    // Solange die Leiste steht, hält das Scrollen zu fokussierten Feldern Abstand nach unten
    document.documentElement.classList.toggle("check-leiste-an", !leiste.hidden);
  };

  const aktualisieren = () => {
    const z = zustand();
    const fertig = hatErgebnis(z);
    mitErgebnis = fertig;
    tafel?.classList.toggle("ist-leer", !fertig);

    reglerAktualisieren(z);
    // Nur Umsatz, keine Handarbeit: dann steht der Umsatz groß da, nicht „Rund 0 €“
    const nurUmsatz = z.stunden <= 0 && z.umsatz > 0;
    zaehlen(nurUmsatz ? z.umsatz : z.euro);
    if (leisteText) leisteText.textContent = nurUmsatz ? "im Jahr entgangen" : "im Jahr verbrannt";
    pixelSetzen(z);

    if (unterzeile) {
      const handKarten = Array.from(sortiert.values()).some((s) => s === "hand");
      unterzeile.textContent = nurUmsatz
        ? "entgehen Ihnen an Umsatz, weil Anrufe und Angebote durchrutschen. Handarbeit ist keine eingetragen."
        : !begonnen
        ? "Sortieren Sie die erste Karte. Was von Hand läuft, landet hier auf der Rechnung."
        : z.stunden > 0
          ? `verbrennt Ihr Betrieb mit Handarbeit. Das sind rund ${ganzzahl.format(z.stunden)} Arbeitsstunden.`
          : handKarten
            ? "Alle Regler stehen auf null. Schieben Sie, was bei Ihnen anfällt."
            : "Von Hand läuft bei Ihnen nichts. Dann schauen Sie, was Ihnen durchrutscht.";
    }

    if (vergleichListe) {
      const liste = vergleiche(z);
      vergleichListe.hidden = liste.length === 0;
      const neu = liste.join("|");
      if (vergleichListe.dataset.stand !== neu) {
        vergleichListe.dataset.stand = neu;
        vergleichListe.replaceChildren(
          ...liste.map((text) => {
            const li = document.createElement("li");
            li.textContent = text;
            return li;
          }),
        );
      }
    }

    if (umsatzZeile) {
      umsatzZeile.hidden = z.umsatz <= 0 || nurUmsatz;
      if (z.umsatz > 0) {
        umsatzZeile.textContent = `Dazu entgehen Ihnen rund ${euro(z.umsatz)} Umsatz im Jahr durch ${quellenText(z)}.`;
      }
    }

    if (urteilBox) {
      // Ohne Betrag nur, wenn das 0 € wirklich stimmt: fertig sortiert, nichts von Hand, Durchrutscher geprüft.
      // Sonst stünde „Entwarnung“ da, bis die Vorschläge übernommen sind und das Urteil auf „sofort“ springt.
      const handKarten = Array.from(sortiert.values()).some((s) => s === "hand");
      urteilBox.hidden = !begonnen || (!fertig && (sortierModus || handKarten || !rutschtGeprueft));
      const u = urteil(z);
      urteilBox.dataset.stufe = String(u.stufe);
      if (urteilKicker) urteilKicker.textContent = u.kicker;
      if (urteilTitel) urteilTitel.textContent = u.titel;
      if (urteilText) urteilText.textContent = urteilSatz(z, u.text);
      if (urteilTelefon) {
        urteilTelefon.hidden = !u.telefon;
        urteilTelefon.textContent = u.telefon ? `${u.telefon}: ${daten.kontakt.telefonAnzeige}` : "";
      }
    }

    if (ausstellenKnopf) ausstellenKnopf.disabled = !fertig;
    besprechenKnoepfe.forEach((k) => (k.disabled = !fertig));
    if (satzAnzeige) satzAnzeige.textContent = `Gerechnet mit ${ARBEITSTAGE} Arbeitstagen und ${z.satz} € pro Stunde`;

    // Für Tracking und Anfrage: der aktuelle Stand als JSON, ohne Ergebnis kein Attribut
    if (fertig) {
      const menge = (id: string) => z.verluste.find((v) => v.v.id === id)?.menge ?? 0;
      formular.dataset.ergebnis = JSON.stringify({
        punkte: [...z.posten.map((p) => p.a.name), ...z.verluste.filter((v) => v.menge > 0).map((v) => v.v.name)].slice(
          0,
          PUNKTE_MAX,
        ),
        minuten: Math.min(STUNDEN_DECKEL, Math.round((z.stunden * 60) / ARBEITSTAGE)),
        stunden: Math.min(STUNDEN_DECKEL, z.stunden),
        euro: z.euro,
        umsatz: z.umsatz,
        posten: z.posten.map((p) => ({
          aufgabe: p.a.name,
          menge: p.menge,
          einheit: p.a.einheit,
          minutenJe: p.minutenJe,
          stunden: Math.min(STUNDEN_DECKEL, p.stunden),
        })),
        durchrutscher: {
          verpassteAnrufeProWoche: menge("verpasst"),
          angeboteOhneNachfassenProMonat: menge("nachfassen"),
          auftragswert: z.auftragswert,
        },
        wuensche: z.wuensche,
        // Ohne sichtbare Auswahl keine Teamgröße melden, die der Besucher nie gewählt hat
        teamgroesse: z.teamGewaehlt ? z.team.wert : undefined,
      });
    } else {
      delete formular.dataset.ergebnis;
    }
    // Immer, auch nach „alles rückgängig“: Gesendet wird ohnehin erst nach einer Änderung (tracking.ts)
    formular.dataset.angaben = JSON.stringify(standFuerStatistik(z));

    if (belegBereich && !belegBereich.hidden) {
      if (fertig) belegFuellen(z);
      else belegBereich.hidden = true;
    }

    leisteSetzen();
  };

  // Knapp und entprellt: erst wenn der Regler losgelassen ist, und nur der gerundete Betrag
  const ansageVormerken = () => {
    window.clearTimeout(ansageWarten);
    ansageWarten = window.setTimeout(() => {
      const fokus = document.activeElement;
      if (fokus instanceof HTMLInputElement && fokus.type === "range") return;
      const z = zustand();
      const text = ansageText(z);
      const stufe = urteilStufe(z);
      if (stufe >= URTEIL_ROT_AB && stufe > ansageStufe) spiele("achtung");
      ansageStufe = stufe;
      if (text && text !== letzteAnsage) {
        letzteAnsage = text;
        ansagen(ansage, text);
      }
    }, ANSAGE_PAUSE_MS);
  };

  /* Sortieren ----------------------------------------------------------------- */

  let ansichtWarten = 0;

  const sortierenBeenden = (verzoegerung = 0) => {
    sortierModus = false;
    begonnen = true;
    bilanzSetzen();
    stapelZeigen();
    window.clearTimeout(ansichtWarten);
    const umschalten = () => {
      if (sortierModus) return;
      const fokusHier =
        !document.activeElement ||
        document.activeElement === document.body ||
        (stapelBereich?.contains(document.activeElement) ?? false);
      spiele("hinweis");
      stapelAnsicht();
      if (fokusHier) fertigBox?.focus({ preventScroll: true });
    };
    // Die letzte Karte darf erst noch landen, dann kommt die Bilanz
    if (verzoegerung > 0) ansichtWarten = window.setTimeout(umschalten, verzoegerung);
    else umschalten();
  };

  // Laufende Würfe abbrechen, Zähler und Balken zeigen wieder genau sortiert
  const wuerfeAbbrechen = () => {
    window.clearTimeout(ansichtWarten);
    spiel?.aufraeumen();
    fliegend.clear();
  };

  const entscheiden = (art: Sortierung, wurf?: Wurf) => {
    if (!sortierModus) return;
    const karte = karten[index];
    if (!karte) return;
    const id = kartenId(karte);
    const vorher = sortiert.get(id);
    verlauf.push({ aenderungen: [[id, vorher]], index, modus: true });
    sortiert.set(id, art);
    if (art === "hand") begonnen = true;
    // Von Hand raschelt Papier, digital ploppt es hell
    if (art === "hand") spiele("papier");
    else spiele("plopp", { variante: "hoch" });
    if (spiel?.werfen(karte, art, wurf)) fliegend.set(id, vorher);
    index += 1;
    const name = aufgabeNach.get(id)?.name ?? "";
    const urteil = art === "hand" ? "von Hand" : "digital";
    if (index >= anzahl) {
      sortierenBeenden(fliegend.has(id) ? FLUGZEIT_MS : 0);
    } else {
      stapelZeigen("weiter");
      const naechste = aufgabeNach.get(kartenId(karten[index]))?.name ?? "";
      ansagen(stapelAnsage, `${name}: ${urteil}. Karte ${index + 1} von ${anzahl}: ${naechste}.`);
    }
    ansichtAktualisieren();
    geaendertStill();
  };

  const spiel = stapel
    ? stapelSpielEinrichten({
        stapel,
        karten,
        knoepfe: {
          hand: sortierKnoepfe.find((k) => k.dataset.sortieren === "hand"),
          digital: sortierKnoepfe.find((k) => k.dataset.sortieren === "digital"),
        },
        ruhig,
        bereit: () => sortierModus && index < anzahl,
        entscheiden,
        // Zählt die Zielseite jetzt wirklich eine mehr? Sonst kein „+1“ am Knopf
        gelandet: (id, art) => {
          if (!fliegend.has(id)) return null;
          const vorher = fliegend.get(id);
          fliegend.delete(id);
          standZeigen();
          ploppen(segmente.get(id), 1.7);
          // Inzwischen anders entschieden (Werkbank): keine Rückmeldung am Knopf
          if (sortiert.get(id) !== art) return null;
          return vorher === art ? "gleich" : "mehr";
        },
      })
    : null;

  const restUebernehmen = () => {
    // Nach der letzten Karte (Bilanz kommt gleich) gibt es keinen Rest mehr
    if (!sortierModus || index >= anzahl) return;
    wuerfeAbbrechen();
    const aenderungen: [string, Sortierung | undefined][] = [];
    for (let i = index; i < anzahl; i++) {
      const id = kartenId(karten[i]);
      if (!sortiert.has(id)) {
        aenderungen.push([id, undefined]);
        sortiert.set(id, "hand");
      }
    }
    verlauf.push({ aenderungen, index, modus: true });
    index = anzahl;
    sortierenBeenden();
    ansichtAktualisieren();
    geaendertStill();
  };

  const rueckgaengig = () => {
    const schritt = verlauf.pop();
    if (!schritt) return;
    wuerfeAbbrechen();
    const ersteId = schritt.aenderungen[0]?.[0];
    // Wohin die Karte geworfen wurde, von dort kommt sie zurück
    const warArt = ersteId ? sortiert.get(ersteId) : undefined;
    for (const [id, vorher] of schritt.aenderungen) {
      if (vorher) sortiert.set(id, vorher);
      else sortiert.delete(id);
    }
    index = schritt.index;
    sortierModus = schritt.modus;
    stapelAnsicht();
    const eineKarte = sortierModus && ersteId === kartenId(karten[index]);
    stapelZeigen(eineKarte && schritt.aenderungen.length === 1 ? "zurueck" : sortierModus ? "weiter" : "ruhe", warArt);
    if (eineKarte) {
      const name = aufgabeNach.get(kartenId(karten[index]))?.name ?? "";
      ansagen(stapelAnsage, `Rückgängig. Karte ${index + 1} von ${anzahl}: ${name}.`);
      // Der Knopf in der Fertig-Box ist jetzt weg, also weiter am Stapel
      if (fertigBox?.contains(document.activeElement) || document.activeElement === document.body) {
        stapel?.focus({ preventScroll: true });
      }
    } else if (schritt.aenderungen.length === 0) {
      // „Übrige so lassen“ zurückgenommen: Es geht am Stapel weiter
      const name = aufgabeNach.get(kartenId(karten[index]))?.name ?? "";
      ansagen(stapelAnsage, `Rückgängig. Karte ${index + 1} von ${anzahl}: ${name}.`);
    } else {
      const namen = schritt.aenderungen.map(([id]) => aufgabeNach.get(id)?.name ?? "").join(", ");
      ansagen(stapelAnsage, `Rückgängig. ${namen}: läuft wieder von Hand.`);
    }
    ansichtAktualisieren();
    geaendertStill();
  };

  sortierKnoepfe.forEach((knopf) => {
    knopf.addEventListener("click", () => entscheiden(knopf.dataset.sortieren === "digital" ? "digital" : "hand"));
  });
  zurueckKnopf?.addEventListener("click", rueckgaengig);
  zurueckFertig?.addEventListener("click", rueckgaengig);
  restKnopf?.addEventListener("click", restUebernehmen);
  neuKnopf?.addEventListener("click", () => {
    // Neue Runde, neuer Verlauf: Rückgängig springt sonst in die alte Runde
    wuerfeAbbrechen();
    verlauf.length = 0;
    index = 0;
    sortierModus = true;
    stapelAnsicht();
    stapelZeigen("weiter");
    ansichtAktualisieren();
    // Das Urteil hängt am Sortiermodus, also neu rechnen, ohne das Ergebnis anzusagen
    geaendertStill();
    stapel?.focus({ preventScroll: true });
    ansagen(stapelAnsage, `Karte 1 von ${anzahl}: ${aufgabeNach.get(kartenId(karten[0]))?.name ?? ""}.`);
  });

  // Wischen steckt in zeitfresser-stapel.ts, die Pfeiltasten werfen genauso
  stapel?.addEventListener("keydown", (event) => {
    if (event.target !== stapel || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    // Gedrückt halten sortiert nicht aus Versehen den ganzen Stapel
    if (!event.repeat) entscheiden(event.key === "ArrowLeft" ? "hand" : "digital");
  });

  /* Werkbank ------------------------------------------------------------------ */

  const presetsSetzen = (stufe: number) => {
    // Ab jetzt stehen überall wieder Vorschläge, nichts mehr selbst eingestellt
    eingestellt.clear();
    for (const a of daten.aufgaben) {
      const r = regler.get(a.id);
      if (r) r.eingabe.value = String(a.presets[stufe] ?? 0);
    }
    for (const v of daten.durchrutscher) {
      const r = verlustRegler.get(v.id);
      if (r) r.eingabe.value = String(v.presets[stufe] ?? 0);
    }
    if (auftragswertFeld) auftragswertFeld.value = ganzzahl.format(daten.auftragswerte[stufe] ?? 0);
  };

  werkbank?.addEventListener("click", (event) => {
    const knopf = (event.target as Element).closest<HTMLButtonElement>("[data-regler-weg]");
    if (!knopf) return;
    const id = knopf.dataset.reglerWeg ?? "";
    const sichtbar = Array.from(regler.values()).filter((r) => !r.zeile.hidden);
    const stelle = sichtbar.findIndex((r) => r.zeile.contains(knopf));
    verlauf.push({ aenderungen: [[id, sortiert.get(id)]], index, modus: sortierModus });
    sortiert.set(id, "digital");
    ansichtAktualisieren();
    stapelZeigen();
    geaendertStill();
    const naechste = sichtbar[stelle + 1] ?? sichtbar[stelle - 1];
    if (naechste && !naechste.zeile.hidden) naechste.eingabe.focus();
    else (sortierModus ? stapel : fertigBox)?.focus();
    ansagen(stapelAnsage, `${aufgabeNach.get(id)?.name ?? ""}: läuft schon digital und zählt nicht mehr mit.`);
  });

  /* Richtwerte ---------------------------------------------------------------- */

  const feldAufraeumen = (feld: HTMLInputElement) => {
    const wert = zahlAus(feld);
    if (feld.hasAttribute("data-auftragswert")) {
      feld.value = wert > 0 ? ganzzahl.format(wert) : "";
    } else if (feld.dataset.standard !== undefined) {
      // Leer oder 0 heißt: Standard verwenden
      feld.value = String(wert || feld.dataset.standard);
    }
  };

  richtwerteStandard?.addEventListener("click", () => {
    alle<HTMLInputElement>("[data-richtwerte] input[data-standard]").forEach((f) => (f.value = f.dataset.standard ?? ""));
    geaendert();
  });

  /* Beleg --------------------------------------------------------------------- */

  let druckEnde = 0;

  ausstellenKnopf?.addEventListener("click", () => {
    const z = zustand();
    if (!hatErgebnis(z) || !belegBereich) return;
    belegNummer = neueNummer();
    letzterBeleg = "";
    belegBereich.hidden = false;
    belegFuellen(z);
    if (pdfStatus) pdfStatus.textContent = "";
    // Ohne Bewegung druckt der Klang nur eine Zeile (das Werk wählt die Kurzfassung)
    if (zettel) spiele("drucker", { anim: true, einzeln: true });
    if (zettel && !ruhig()) {
      zettel.classList.remove("wird-gedruckt");
      void zettel.offsetWidth;
      zettel.classList.add("wird-gedruckt");
      window.clearTimeout(druckEnde);
      druckEnde = window.setTimeout(() => zettel.classList.remove("wird-gedruckt"), 2000);
    }
    // Der Stempel landet mit dem Ende des Drucks (global.css), ohne Bewegung gleich
    spiele("stempel", { in: ruhig() ? 0.15 : 1.2, einzeln: true });
    ausstellenKnopf.textContent = "Neuen Beleg ausstellen";
    zettelTitel?.focus({ preventScroll: true });
    belegBereich.scrollIntoView({ block: "start", behavior: ruhig() ? "auto" : "smooth" });
  });

  // Kein disabled während der Erzeugung, sonst landet der Tastaturfokus auf body
  let pdfLaeuft = false;
  pdfKnopf?.addEventListener("click", async () => {
    const z = zustand();
    if (pdfLaeuft || !hatErgebnis(z)) return;
    if (!belegNummer) belegNummer = neueNummer();
    pdfLaeuft = true;
    pdfKnopf.setAttribute("aria-disabled", "true");
    if (pdfStatus) pdfStatus.textContent = "Ihr Beleg wird erstellt …";
    try {
      const datei = await belegPdfErstellen(belegDaten(z));
      dateiAnbieten(datei, DATEINAME);
      spiele("hinweis");
      if (pdfStatus) pdfStatus.textContent = "Fertig. Ihr Beleg liegt als PDF bereit, heben Sie das Beweisstück gut auf.";
    } catch {
      spiele("stopp");
      if (pdfStatus) {
        pdfStatus.textContent = "Das PDF hat leider nicht geklappt. Ein Bildschirmfoto vom Beleg tut es auch.";
      }
    } finally {
      pdfLaeuft = false;
      pdfKnopf.removeAttribute("aria-disabled");
    }
  });

  /* Anfrage vorbelegen -------------------------------------------------------- */

  const besprechenText = (z: Zustand) => {
    // Nur die letzte Zeile darf auf „Stunden im Jahr.“ enden, das Anfrageformular ersetzt den Block daran
    const zeilen = ["Ergebnis aus dem Zeitfresser-Check:"];
    for (const p of z.posten) {
      zeilen.push(
        `- ${p.a.name}: ${ganzzahl.format(p.menge)} ${einheitText(p.a, p.menge)}, rund ${ganzzahl.format(p.stunden)} Std. im Jahr, rund ${euro(runden(p.euro))}`,
      );
    }
    if (z.umsatz > 0) {
      const quellen = z.verluste
        .filter((v) => v.menge > 0)
        .map((v) => `${v.menge} ${v.menge === 1 ? v.v.einzahl : v.v.mehrzahl} ${PRO[v.v.einheit]}`)
        .join(", ");
      zeilen.push(`Umsatz, der durchrutscht: rund ${euro(z.umsatz)} im Jahr (${quellen}, Auftragswert ${euro(z.auftragswert)}).`);
    }
    if (z.wuensche.length > 0) zeilen.push(`Wünsche: ${z.wuensche.join(", ")}.`);
    if (z.teamGewaehlt) zeilen.push(`Teamgröße: ${z.team.wert} Personen.`);
    if (z.stunden > 0) zeilen.push(`Gegenwert: rund ${euro(z.euro)} im Jahr bei ${z.satz} € pro Stunde, ${umfang(z)}.`);
    zeilen.push(
      z.stunden > 0
        ? `Zeitaufwand im Team: rund ${ganzzahl.format(z.stunden)} Stunden im Jahr.`
        : "Zeitaufwand im Team: nicht eingetragen, 0 Stunden im Jahr.",
    );
    return zeilen.join("\n");
  };

  besprechenKnoepfe.forEach((knopf) =>
    knopf.addEventListener("click", () => {
      const z = zustand();
      if (!hatErgebnis(z)) return;
      window.dispatchEvent(new CustomEvent<string>("anfrage:vorbelegen", { detail: besprechenText(z) }));
    }),
  );

  /* Ereignisse ---------------------------------------------------------------- */

  // Wer einen Durchrutscher-Regler oder den Auftragswert anfasst, meint seine eigenen Zahlen
  const rutschtGeaendert = (feld: EventTarget | null) => {
    if (feld instanceof HTMLInputElement && (feld.hasAttribute("data-verlust") || feld.hasAttribute("data-auftragswert"))) {
      rutschtGeprueft = true;
    }
  };

  formular.addEventListener("change", (event) => {
    const feld = event.target;
    rutschtGeaendert(feld);
    if (feld instanceof HTMLInputElement) {
      if (feld.name === "team") {
        teamAngeklickt = true;
        presetsSetzen(Number(feld.dataset.team));
      }
      if (feld.type === "text") feldAufraeumen(feld);
    }
    aktualisieren();
    if (!stilleAenderung) ansageVormerken();
  });
  // Regler verlassen: jetzt darf das Ergebnis angesagt werden
  formular.addEventListener("focusout", (event) => {
    const feld = event.target;
    if (feld instanceof HTMLInputElement && feld.type === "range") ansageVormerken();
  });

  rutschtUebernehmen?.addEventListener("click", () => {
    rutschtGeprueft = true;
    geaendert();
    rutschtErgebnis?.focus({ preventScroll: true });
  });

  // Fokus unter der festen Leiste: ein Stück hochscrollen, falls der Browser das nicht selbst tut
  formular.addEventListener("focusin", (event) => {
    if (!leiste || leiste.hidden || !(event.target instanceof HTMLElement)) return;
    const unten = event.target.getBoundingClientRect().bottom;
    const leisteOben = leiste.getBoundingClientRect().top;
    if (unten > leisteOben - 8) window.scrollBy({ top: unten - leisteOben + 24, behavior: "auto" });
  });

  // Regler sofort, Textfelder kurz gebündelt
  let tippen = 0;
  formular.addEventListener("input", (event) => {
    const feld = event.target;
    rutschtGeaendert(feld);
    if (feld instanceof HTMLInputElement && feld.dataset.menge) eingestellt.add(feld.dataset.menge);
    window.clearTimeout(tippen);
    if (feld instanceof HTMLInputElement && feld.type === "range") aktualisieren();
    else tippen = window.setTimeout(aktualisieren, 250);
  });
  formular.addEventListener("submit", (event) => event.preventDefault());

  // Mobile Leiste nur, solange der Check im Bild ist und das Ergebnis nicht
  if ("IntersectionObserver" in window && tafel) {
    const beobachter = new IntersectionObserver(
      (eintraege) => {
        for (const e of eintraege) {
          if (e.target === formular) checkImBild = e.isIntersecting;
          else if (e.target === belegBereich) belegImBild = e.isIntersecting;
          else tafelImBild = e.isIntersecting;
        }
        leisteSetzen();
      },
      { rootMargin: "0px 0px -72px 0px" },
    );
    beobachter.observe(formular);
    beobachter.observe(tafel);
    if (belegBereich) beobachter.observe(belegBereich);
  }

  stapelAnsicht();
  stapelZeigen();
  ansichtAktualisieren();
  aktualisieren();
}
