/* Problem: der Schreibtisch als alter Büro-PC ------------------------------------
   Ohne Script liegen drei Beispielmeldungen still auf dem Band. Mit Script wird daraus
   ein Desktop: Fenster lassen sich an der Titelleiste ziehen, holen sich beim Anklicken
   nach vorn, und jedes weggeklickte Fenster zieht ein oder zwei neue nach sich.
   Unten läuft eine Taskleiste mit Notausgang („Feierabend“), Zähler und Uhr.
   Neue Fenster entstehen aus den <template data-meldung-vorlage> in Problem.astro,
   damit Markup und Optik genau den Startfenstern entsprechen. */

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { spiele } from "./klang";

type Zeichen = "info" | "warnung" | "fehler";
// Klang zum Symbol einer neuen Meldung (bei ausgeschaltetem Ton passiert nichts)
const SYMBOLKLANG = { info: "hinweis", warnung: "achtung", fehler: "stopp" } as const;

type Aktion =
  | { art: "zu" } // Fenster schließen, zählt als Schließung (es kommen neue)
  | { art: "kette"; ziel: string } // Fenster wird durch ein Folgefenster ersetzt
  | { art: "warten"; ziel: string; text: string; bis: number } // Fortschritt, dann Folgefenster
  | { art: "spaeter"; ziel?: string }; // schließen, nach kurzer Zeit kommt die Erinnerung

type Knopf = { text: string; aktion: Aktion };

type Meldung = {
  id: string;
  titel: string;
  symbol: Zeichen;
  text: string;
  knoepfe: Knopf[];
  datei?: string; // Dateiname im Titel: Das × fragt erst, ob gespeichert werden soll
  stark?: boolean; // kommt in jedem Durchgang unter den ersten fünf
};

const NBSP = " ";
const zu = (text = "OK"): Knopf => ({ text, aktion: { art: "zu" } });
// Die offene Rechnung ist 94 Tage alt: Ihre Nummer trägt das Jahr von vor 94 Tagen
const RECHNUNGSJAHR = new Date(Date.now() - 94 * 86_400_000).getFullYear();

/* Ketten der drei Startfenster (die Texte der Startfenster stehen in Problem.astro) */
const KETTEN: Meldung[] = [
  { id: "A1", titel: "Lagerprogramm", symbol: "fehler", text: "", knoepfe: [{ text: "OK", aktion: { art: "kette", ziel: "A2" } }] },
  {
    id: "A2",
    titel: "Lagerprogramm (Keine Rückmeldung)",
    symbol: "fehler",
    text: "Das Programm reagiert nicht mehr. Wenn Sie es jetzt beenden, sind die Bestellungen von heute weg.",
    knoepfe: [
      { text: "Warten", aktion: { art: "warten", ziel: "A3", text: "Lagerprogramm wird wiederhergestellt …", bis: 97 } },
      { text: "Programm beenden", aktion: { art: "kette", ziel: "A3" } },
    ],
  },
  {
    id: "A3",
    titel: "Sicherheitswarnung",
    symbol: "warnung",
    text: `Für Windows${NBSP}XP gibt es seit April 2014 keine regulären Sicherheitsupdates mehr. Der Rechner im Lager hängt trotzdem am Netz.`,
    knoepfe: [zu("Verstanden")],
  },
  {
    id: "B1",
    titel: "Kundenliste_FINAL_2.xlsx",
    symbol: "warnung",
    text: "",
    datei: "Kundenliste_FINAL_2.xlsx",
    knoepfe: [{ text: "Warten", aktion: { art: "warten", ziel: "B2", text: "Kundenliste_FINAL_2.xlsx wird geöffnet …", bis: 99 } }],
  },
  {
    id: "B2",
    titel: "Kundenliste_FINAL_2.xlsx",
    symbol: "warnung",
    text: "Ihr Kollege hat zuerst gespeichert. Ihre Änderungen der letzten Stunde sind weg. Eine Kopie liegt jetzt unter Kundenliste_FINAL_3_neu.xlsx.",
    datei: "Kundenliste_FINAL_2.xlsx",
    knoepfe: [zu()],
  },
  { id: "C1", titel: "E-Rechnung", symbol: "info", text: "", knoepfe: [{ text: "Später erinnern", aktion: { art: "spaeter", ziel: "C2" } }] },
  {
    id: "C2",
    titel: "Erinnerung: E-Rechnung",
    symbol: "info",
    text: "Sie wollten erinnert werden. E-Rechnungen von anderen Firmen müssen Sie übrigens schon seit dem 1. Januar 2025 annehmen können.",
    knoepfe: [{ text: "Später erinnern", aktion: { art: "spaeter", ziel: "C3" } }, zu()],
  },
  {
    id: "C3",
    titel: "3. Erinnerung: E-Rechnung",
    symbol: "warnung",
    text: "Diese Erinnerung lässt sich nicht weiter verschieben.",
    knoepfe: [zu()],
  },
  /* Folgefenster der Pool-Meldungen */
  {
    id: "P2b",
    titel: "Suche abgeschlossen",
    symbol: "fehler",
    text: `3 von 7 Fundstellen gefunden. Bei solchen Verstößen drohen nach der DSGVO Bußgelder bis 20${NBSP}Millionen${NBSP}€ oder 4${NBSP}% des weltweiten Jahresumsatzes, je nachdem, was höher ist.`,
    knoepfe: [zu()],
  },
  { id: "P3b", titel: "Vorlage nicht gefunden", symbol: "fehler", text: "Die Datei Mahnung_alt.doc wurde verschoben oder gelöscht.", knoepfe: [zu()] },
  { id: "P6b", titel: "Sicherung fehlgeschlagen", symbol: "fehler", text: "Das Ziellaufwerk ist voll.", knoepfe: [zu()] },
  { id: "P7b", titel: "Rückruf", symbol: "info", text: "Die Nummer wurde unterdrückt.", knoepfe: [zu()] },
  { id: "P9b", titel: "Belege", symbol: "warnung", text: "11 von 38 Belegen gefunden.", knoepfe: [zu()] },
  { id: "P11b", titel: "Aufräumen", symbol: "info", text: "Geschätzte Dauer: 3 Stunden.", knoepfe: [zu()] },
];

/* Pool: daraus kommen die Folgemeldungen, höchstens POOL_JE_DURCHGANG pro Durchgang */
const POOL: Meldung[] = [
  {
    id: "P1",
    titel: "Belegarchiv",
    symbol: "info",
    stark: true,
    text: `Rechnungen und Buchungsbelege müssen Sie 8${NBSP}Jahre aufbewahren, Bücher und Jahresabschlüsse sogar 10${NBSP}Jahre. Der Ordner von 2019 steht im Keller. Der Keller ist feucht.`,
    knoepfe: [zu()],
  },
  {
    id: "P2",
    titel: "Auskunftsersuchen",
    symbol: "warnung",
    stark: true,
    text: "Ein Kunde will wissen, welche Daten Sie über ihn gespeichert haben. Nach der DSGVO haben Sie dafür einen Monat Zeit. Seine Daten stehen in vier Excel-Listen, zwei Postfächern und auf einem USB-Stick.",
    knoepfe: [{ text: "Suche starten", aktion: { art: "warten", ziel: "P2b", text: "Durchsuche 4 Listen und 2 Postfächer …", bis: 99 } }],
  },
  {
    id: "P3",
    titel: "Offene Posten",
    symbol: "warnung",
    stark: true,
    text: `Rechnung ${RECHNUNGSJAHR}-0412 ist seit 94${NBSP}Tagen offen. Gemahnt hat niemand. Forderungen verjähren in der Regel nach drei Jahren, gerechnet ab Ende des Jahres, in dem sie entstanden sind.`,
    knoepfe: [
      { text: "Mahnung schreiben", aktion: { art: "kette", ziel: "P3b" } },
      { text: "Später", aktion: { art: "spaeter" } },
    ],
  },
  {
    id: "P4",
    titel: "Krankmeldung",
    symbol: "info",
    text: "Krankmeldungen kommen seit 2023 in der Regel nicht mehr auf Papier. Sie müssen sie selbst bei der Krankenkasse abrufen. Für drei Leute fehlt die Meldung noch.",
    knoepfe: [zu()],
  },
  {
    id: "P5",
    titel: "Arbeitszeit",
    symbol: "warnung",
    text: "Seit dem Beschluss des Bundesarbeitsgerichts vom September 2022 müssen Sie die Arbeitszeit Ihrer Leute erfassen. Die Stundenzettel von letzter Woche liegen im Transporter.",
    knoepfe: [zu()],
  },
  {
    id: "P6",
    titel: "Datensicherung",
    symbol: "fehler",
    text: "Letzte Datensicherung: vor 412 Tagen. Ziel: USB-Stick (nicht gefunden).",
    knoepfe: [
      { text: "Jetzt sichern", aktion: { art: "kette", ziel: "P6b" } },
      { text: "Später", aktion: { art: "spaeter" } },
    ],
  },
  {
    id: "P7",
    titel: "Verpasste Anrufe (3)",
    symbol: "warnung",
    stark: true,
    text: "Ein Kunde wollte bestellen und hat dreimal angerufen. Jetzt hat er beim Wettbewerber bestellt.",
    knoepfe: [{ text: "Zurückrufen", aktion: { art: "kette", ziel: "P7b" } }, zu()],
  },
  {
    id: "P8",
    titel: "Kassenbuch.xlsx",
    symbol: "warnung",
    datei: "Kassenbuch.xlsx",
    text: "Ein Kassenbuch in Excel gilt bei einer Betriebsprüfung in der Regel nicht als ordnungsgemäß, weil sich jede Zahl nachträglich ändern lässt.",
    knoepfe: [zu()],
  },
  {
    id: "P9",
    titel: "Steuerberater",
    symbol: "info",
    text: "Ihr Steuerberater fragt zum dritten Mal nach den Belegen für das dritte Quartal.",
    knoepfe: [
      {
        text: "Belege suchen",
        aktion: { art: "warten", ziel: "P9b", text: "Durchsuche Postfach, Handschuhfach, Jackentaschen …", bis: 97 },
      },
    ],
  },
  {
    id: "P10",
    titel: "Urlaubsvertretung",
    symbol: "warnung",
    text: "Die Kollegin aus der Buchhaltung ist zwei Wochen im Urlaub. Nur sie weiß, wie die Lohnabrechnung geht.",
    knoepfe: [zu()],
  },
  {
    id: "P11",
    titel: "Postfach voll",
    symbol: "fehler",
    text: "Ihr Postfach ist voll. Neue Anfragen kommen nicht mehr an, und Sie merken es nicht.",
    knoepfe: [
      { text: "Aufräumen", aktion: { art: "kette", ziel: "P11b" } },
      { text: "Später", aktion: { art: "spaeter" } },
    ],
  },
  {
    id: "P12",
    titel: "Auftrag 4711",
    symbol: "warnung",
    text: "Der Auftrag steht in drei Programmen. In jedem mit einer anderen Menge.",
    knoepfe: [zu()],
  },
  { id: "P13", titel: "Drucker", symbol: "fehler", text: "Papierstau in Fach 2. Ihr Drucker hat kein Fach 2.", knoepfe: [zu()] },
  {
    id: "P14",
    titel: "Bankprogramm",
    symbol: "warnung",
    text: "Das Passwort stand auf einem Zettel am Monitor. Der Zettel ist weg.",
    knoepfe: [zu()],
  },
  {
    id: "P15",
    titel: "Angebot_v7_final_korrigiert.docx",
    symbol: "info",
    datei: "Angebot_v7_final_korrigiert.docx",
    text: "Zuletzt geändert von: unbekannt. Es gibt übrigens auch eine v8.",
    knoepfe: [zu()],
  },
];

const ALLE = new Map([...KETTEN, ...POOL].map((m) => [m.id, m]));

const POOL_JE_DURCHGANG = 10;
const MAX_OFFEN = 7;
const MAX_OFFEN_SCHMAL = 4;
const ERINNERUNG_MS = 2500;
const HAENGT_MS = 1500;
const GREIFEN = 96; // so viel Titelleiste bleibt beim Ziehen mindestens im Bild
const SCHRITT = 10;
const SCHRITT_GROSS = 40;
const SPERRE_MS = 320;

type Art = "meldung" | "dialog" | "fortschritt" | "abschluss";

type Fenster = {
  el: HTMLElement;
  titelleiste: HTMLElement;
  titeltext: HTMLElement;
  art: Art;
  titel: string;
  meldung: Meldung | null;
  start: boolean; // Startfenster aus dem HTML: wird versteckt statt entfernt
  eintrag: HTMLButtonElement | null;
  dialog: Fenster | null; // offener Dialog über diesem Fenster
  eltern: Fenster | null; // bei Dialogen: das Fenster darunter
  antwort: ((wahl: string) => void) | null;
  haengt: boolean;
  weg: boolean;
  bereitAb: number; // frisch aufgeploppt: Ein Doppelklick davor verpufft
};

type Lage = { x: number; y: number };

function mischen<T>(liste: T[]): T[] {
  const a = [...liste];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Die starken Meldungen kommen unter den ersten fünf, der Rest leicht gemischt dahinter
function poolMischen(): Meldung[] {
  const stark = mischen(POOL.filter((m) => m.stark));
  const rest = mischen(POOL.filter((m) => !m.stark));
  const vorn = mischen([...stark, ...rest.splice(0, 5 - stark.length)]);
  return [...vorn, ...rest].slice(0, POOL_JE_DURCHGANG);
}

function dauerText(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000));
  const min = Math.floor(s / 60);
  const sek = s % 60;
  const sekText = `${sek}${NBSP}${sek === 1 ? "Sekunde" : "Sekunden"}`;
  if (!min) return sekText;
  const minText = `${min}${NBSP}${min === 1 ? "Minute" : "Minuten"}`;
  return sek ? `${minText} ${sekText}` : minText;
}

const begrenzen = (wert: number, min: number, max: number) => Math.min(Math.max(wert, min), Math.max(min, max));

export function meldungenEinrichten(): void {
  const tisch = document.querySelector<HTMLElement>("[data-meldungen]");
  if (!tisch) return;
  const leerEl = tisch.querySelector<HTMLElement>("[data-meldungen-leer]");
  const leiste = tisch.querySelector<HTMLElement>("[data-taskleiste]");
  const leisteFenster = tisch.querySelector<HTMLElement>("[data-taskleiste-fenster]");
  const zaehler = tisch.querySelector<HTMLElement>("[data-taskleiste-zaehler]");
  const uhr = tisch.querySelector<HTMLTimeElement>("[data-taskleiste-uhr]");
  const feierabendKnopf = tisch.querySelector<HTMLButtonElement>("[data-feierabend]");
  const ansage = tisch.querySelector<HTMLElement>("[data-meldungen-ansage]");
  const bilanz = tisch.querySelector<HTMLElement>("[data-meldungen-bilanz]");
  const vorlagen = new Map<string, HTMLTemplateElement>();
  tisch.querySelectorAll<HTMLTemplateElement>("template[data-meldung-vorlage]").forEach((v) => {
    vorlagen.set(v.dataset.meldungVorlage ?? "", v);
  });
  if (!leerEl || !leiste || !leisteFenster || !vorlagen.size) return;

  const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)");
  const schmal = window.matchMedia("(max-width: 639px)");
  const breit = window.matchMedia("(min-width: 1280px)");
  const mittel = window.matchMedia("(min-width: 900px)");
  const bewegung = () => !ruhig.matches;

  /* Zustand */
  const register = new WeakMap<HTMLElement, Fenster>();
  let offene: Fenster[] = []; // Stapel: das letzte liegt oben
  let pool: Meldung[] = poolMischen();
  let ausstehend = 0; // Fenster, die gleich noch aufploppen
  let schliessungen = 0;
  let letzteAnzahl = 0;
  let weggeklickt = 0;
  let startZeit: number | null = null;
  let interagiert = false;
  let tischSichtbar = !("IntersectionObserver" in window);
  let nummer = 0;
  const timer = new Set<number>();

  const spaeter = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timer.delete(id);
      fn();
    }, ms);
    timer.add(id);
  };

  const timerAufraeumen = () => {
    timer.forEach((id) => window.clearTimeout(id));
    timer.clear();
  };

  /* Ansagen für Screenreader, gesammelt, damit zwei Fenster auf einmal beide ankommen */
  let ansageText: string[] = [];
  let ansageGeplant = false;
  const ansagen = (text: string) => {
    if (!ansage) return;
    ansageText.push(text);
    if (ansageGeplant) return;
    ansageGeplant = true;
    window.setTimeout(() => {
      ansage.textContent = ansageText.join(" ");
      ansageText = [];
      ansageGeplant = false;
    }, 120);
  };

  // Darf ein Fenster den Fokus nehmen? Nur wenn der Schreibtisch im Bild ist und der Fokus
  // schon darin liegt oder gerade mit dem entfernten Fenster verloren ging (dann steht er auf body).
  const imTisch = () => {
    if (!tischSichtbar) return false;
    const aktiv = document.activeElement;
    if (aktiv && tisch.contains(aktiv)) return true;
    return interagiert && (!aktiv || aktiv === document.body);
  };

  /* Geometrie */
  const leisteHoehe = () => (leiste.hidden ? 0 : leiste.offsetHeight);
  const flaeche = () => ({ b: tisch.clientWidth, h: tisch.clientHeight - leisteHoehe() });
  const lage = (f: Fenster): Lage => ({ x: f.el.offsetLeft, y: f.el.offsetTop });

  const setzen = (f: Fenster, x: number, y: number) => {
    f.el.style.left = `${Math.round(x)}px`;
    f.el.style.top = `${Math.round(y)}px`;
  };

  // Gezogen: Die Titelleiste bleibt greifbar
  const einklemmen = (f: Fenster, x: number, y: number) => {
    const { b, h } = flaeche();
    const w = f.el.offsetWidth;
    const titel = f.titelleiste.offsetHeight || 34;
    setzen(f, begrenzen(x, Math.min(0, GREIFEN - w), b - GREIFEN), begrenzen(y, 0, h - titel));
  };

  // Neu: komplett im Bild
  const hineinsetzen = (f: Fenster, x: number, y: number) => {
    const { b, h } = flaeche();
    setzen(f, begrenzen(x, 0, b - f.el.offsetWidth), begrenzen(y, 0, h - f.el.offsetHeight));
  };

  /* Stapel und Fokus */
  const taskleisteAktualisieren = () => {
    const oben = offene[offene.length - 1];
    const aktiv = oben?.eltern ?? oben;
    offene.forEach((f) => {
      f.eintrag?.setAttribute("aria-pressed", String(f === aktiv));
    });
    if (zaehler) {
      const n = offene.filter((f) => f.art === "meldung" || f.art === "fortschritt").length;
      zaehler.textContent = `Offen: ${n}`;
    }
  };

  const stapeln = () => {
    offene.forEach((f, i) => {
      f.el.style.zIndex = String(i + 2);
      f.el.classList.toggle("meldung--aktiv", i === offene.length - 1);
    });
    taskleisteAktualisieren();
  };

  const aktivieren = (f: Fenster) => {
    if (f.weg) return;
    const ziel = f.dialog ?? f;
    offene = offene.filter((o) => o !== f && o !== ziel);
    if (ziel !== f) offene.push(f);
    offene.push(ziel);
    stapeln();
  };

  // Neues Fenster in den Stapel: Liegt gerade ein Dialog oben, schiebt es sich darunter
  // und nimmt ihm weder Platz noch Fokus. Gibt zurück, ob es oben liegt.
  const einreihen = (f: Fenster): boolean => {
    const n = offene.length;
    const oben = offene[n - 1];
    if (oben?.art !== "dialog") {
      offene.push(f);
      stapeln();
      return true;
    }
    const i = oben.eltern && offene[n - 2] === oben.eltern ? n - 2 : n - 1;
    offene.splice(i, 0, f);
    stapeln();
    return false;
  };

  const fokusZiel =(f: Fenster): HTMLElement =>
    f.el.querySelector<HTMLElement>(".meldung__knoepfe button, .meldung__knoepfe a") ?? f.titeltext;

  const fokussieren = (f: Fenster | undefined) => {
    if (f) fokusZiel(f.dialog ?? f).focus({ preventScroll: true });
    else tisch.focus({ preventScroll: true });
  };

  const blinken = (f: Fenster) => {
    spiele("ding"); // auch bei reduzierter Bewegung
    if (!bewegung()) return;
    f.el.classList.remove("meldung--blinkt");
    void f.el.offsetWidth;
    f.el.classList.add("meldung--blinkt");
  };

  /* Fenster anlegen */
  const titelSetzen = (f: Fenster, titel: string) => {
    f.titel = titel;
    f.titeltext.textContent = titel;
    if (f.eintrag) {
      f.eintrag.setAttribute("aria-label", titel);
      f.eintrag.title = titel;
      const text = f.eintrag.querySelector("span");
      if (text) text.textContent = titel;
    }
  };

  const eintragAnlegen = (f: Fenster) => {
    const knopf = document.createElement("button");
    knopf.type = "button";
    knopf.className = "taskleiste__eintrag";
    const icon = f.el.querySelector(".pixel-icon");
    if (icon) knopf.append(icon.cloneNode(true));
    const text = document.createElement("span");
    knopf.append(text);
    knopf.addEventListener("click", () => {
      aktivieren(f);
      fokussieren(f);
    });
    leisteFenster.append(knopf);
    f.eintrag = knopf;
  };

  const anmelden = (el: HTMLElement, art: Art, meldung: Meldung | null, start = false): Fenster => {
    const titelleiste = el.querySelector<HTMLElement>(".fenster__titel")!;
    const titeltext = el.querySelector<HTMLElement>(".fenster__titeltext")!;
    titeltext.id ||= `meldung-titel-${++nummer}`;
    // Der Tabstopp zum Verschieben sitzt auf dem Titeltext, nicht auf der ganzen Leiste:
    // Sonst steckte der Schließen-Knopf in einem anderen Bedienelement. Sein Name bleibt
    // der sichtbare Titel, damit aria-labelledby der Dialoge den Titel liefert.
    titeltext.tabIndex = 0;
    titeltext.setAttribute("role", "button");
    titeltext.setAttribute("aria-roledescription", "verschiebbare Titelleiste");
    titeltext.setAttribute("aria-describedby", "meldungen-zieh-hinweis");
    titelleiste.dataset.lenisPreventTouch = "";
    // Den Meldungstext mit vorlesen, wenn der Fokus ins Fenster kommt
    if (art !== "dialog") {
      const text = el.querySelector<HTMLElement>(".meldung__text p");
      if (text) {
        text.id ||= `meldung-text-${++nummer}`;
        el.setAttribute("aria-describedby", text.id);
      }
    }
    const f: Fenster = {
      el,
      titelleiste,
      titeltext,
      art,
      titel: titeltext.textContent ?? "",
      meldung,
      start,
      eintrag: null,
      dialog: null,
      eltern: null,
      antwort: null,
      haengt: false,
      weg: false,
      bereitAb: 0,
    };
    register.set(el, f);
    if (art !== "dialog") eintragAnlegen(f);
    titelSetzen(f, f.titel);
    return f;
  };

  const klonen = (vorlage: string): HTMLElement => {
    const v = vorlagen.get(vorlage) ?? vorlagen.get("info")!;
    return (v.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement;
  };

  const knopfAnlegen = (text: string, daten: Record<string, string>, voll = false) => {
    const knopf = document.createElement("button");
    knopf.type = "button";
    knopf.className = voll ? "retro-knopf retro-knopf--voll" : "retro-knopf";
    knopf.textContent = text;
    knopf.setAttribute("data-meldung-zu", "");
    Object.assign(knopf.dataset, daten);
    return knopf;
  };

  const aufploppen = (f: Fenster) => {
    if (!bewegung()) return;
    gsap.fromTo(
      f.el,
      { scale: 0.55, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.34, ease: "back.out(2.4)", clearProps: "transform,opacity,visibility" },
    );
  };

  const wackeln = () => {
    if (!bewegung()) return;
    gsap.fromTo(
      tisch,
      { x: 0 },
      { keyframes: { x: [-7, 6, -5, 4, -2, 0] }, duration: 0.36, ease: "none", clearProps: "transform" },
    );
  };

  type Platz = { nahe?: Lage; ersetzt?: Lage; versatz?: number; ueber?: Fenster };

  const platzieren = (f: Fenster, platz: Platz) => {
    const { b, h } = flaeche();
    const w = f.el.offsetWidth;
    const hh = f.el.offsetHeight;
    if (platz.ueber) {
      const p = lage(platz.ueber);
      hineinsetzen(f, p.x + (platz.ueber.el.offsetWidth - w) / 2, p.y + 44);
    } else if (platz.ersetzt) {
      hineinsetzen(f, platz.ersetzt.x + 8 - Math.random() * 16, platz.ersetzt.y + 6 - Math.random() * 12);
    } else if (platz.nahe && Math.random() < 0.6) {
      const stufe = (platz.versatz ?? 0) + 1;
      const rx = Math.random() < 0.5 ? -1 : 1;
      hineinsetzen(f, platz.nahe.x + rx * stufe * 34, platz.nahe.y + stufe * 30);
    } else {
      hineinsetzen(f, Math.random() * Math.max(0, b - w), Math.random() * Math.max(0, h - hh));
    }
  };

  const meldungOeffnen = (m: Meldung, platz: Platz = {}, titel = m.titel, erinnerung = false): Fenster => {
    const el = klonen(m.symbol);
    el.classList.add("meldung--neu");
    el.dataset.meldungId = m.id;
    el.style.visibility = "hidden";
    const text = el.querySelector<HTMLElement>(".meldung__text p");
    if (text) text.textContent = m.text;
    const knoepfe = el.querySelector<HTMLElement>(".meldung__knoepfe");
    m.knoepfe.forEach((k, i) => knoepfe?.append(knopfAnlegen(k.text, { knopf: String(i) })));
    tisch.append(el);
    const f = anmelden(el, "meldung", m);
    titelSetzen(f, titel);
    el.setAttribute("aria-label", `Beispielmeldung: ${titel}`);
    platzieren(f, platz);
    el.style.visibility = "";
    f.bereitAb = performance.now() + SPERRE_MS;
    const oben = einreihen(f);
    aufploppen(f);
    // Kommt auch per Timer (Eskalation, Erinnerung): Nur wer den Schreibtisch sieht, hört ihn
    if (tischSichtbar) spiele(erinnerung ? "plopp" : SYMBOLKLANG[m.symbol]);
    if (m.symbol === "fehler") wackeln();
    const fokus = oben && imTisch();
    // Bekommt das Fenster den Fokus, liest der Screenreader den Text über aria-describedby
    ansagen(fokus ? `Neue Meldung: ${titel}` : `Neue Meldung: ${titel}. ${m.text}`);
    if (fokus) fokussieren(f);
    return f;
  };

  /* Fenster entfernen */
  let zug: { f: Fenster; ende: () => void } | null = null; // laufendes Ziehen

  const entfernen = (f: Fenster, animiert = true) => {
    if (f.weg) return;
    f.weg = true;
    // Verschwindet das Fenster unter dem Finger (Fortschritt fertig), endet auch das Ziehen
    if (zug?.f === f) zug.ende();
    offene = offene.filter((o) => o !== f);
    f.eintrag?.remove();
    f.eintrag = null;
    if (f.dialog) entfernen(f.dialog, false);
    if (f.eltern) f.eltern.dialog = null;
    f.el.classList.remove("meldung--aktiv");
    const fertig = () => {
      gsap.set(f.el, { clearProps: "opacity,visibility,transform" });
      if (f.start || f.art === "abschluss") {
        f.el.hidden = true;
        f.el.style.zIndex = "";
      } else {
        f.el.remove();
      }
    };
    if (animiert && bewegung()) {
      f.el.style.pointerEvents = "none";
      gsap.to(f.el, {
        scale: 0.9,
        autoAlpha: 0,
        duration: 0.14,
        ease: "power2.in",
        onComplete: () => {
          f.el.style.pointerEvents = "";
          fertig();
        },
      });
    } else {
      fertig();
    }
    stapeln();
  };

  const offenZahl = () => offene.filter((f) => f.art === "meldung" || f.art === "fortschritt").length;
  const maxOffen = () => (schmal.matches ? MAX_OFFEN_SCHMAL : MAX_OFFEN);

  const fokusNachSchliessen = (warImTisch: boolean) => {
    if (!warImTisch) return;
    fokussieren(offene[offene.length - 1]);
  };

  /* Keine Rückmeldung: Bei vielen offenen Fenstern hängt gelegentlich eins */
  const vielleichtHaengen = () => {
    if (offenZahl() < 4 || Math.random() > 0.5) return;
    spaeter(() => {
      const kandidaten = offene.filter((f) => f.art === "meldung" && !f.haengt && !f.titel.includes("Keine Rückmeldung"));
      const f = kandidaten[Math.floor(Math.random() * kandidaten.length)];
      if (!f) return;
      const vorher = f.titel;
      f.haengt = true;
      f.titeltext.textContent = `${vorher} (Keine Rückmeldung)`;
      f.el.classList.add("meldung--haengt");
      f.el.setAttribute("aria-busy", "true");
      tisch.classList.add("schreibtisch--wartet");
      // Wer gerade in diesem Fenster ist, erfährt, warum seine Klicks verpuffen
      if (f.el.contains(document.activeElement)) ansagen(`${vorher} reagiert nicht.`);
      spaeter(() => {
        f.haengt = false;
        f.titeltext.textContent = vorher;
        f.el.classList.remove("meldung--haengt");
        f.el.removeAttribute("aria-busy");
        if (!offene.some((o) => o.haengt)) tisch.classList.remove("schreibtisch--wartet");
      }, HAENGT_MS);
    }, 700);
  };

  /* Eskalation: Jede Schließung zieht ein oder zwei neue Meldungen nach sich */
  const eskalieren = (nahe: Lage) => {
    schliessungen++;
    let anzahl = schliessungen === 1 ? 1 : letzteAnzahl === 1 ? 2 : Math.random() < 0.55 ? 2 : 1;
    letzteAnzahl = anzahl;
    anzahl = Math.min(anzahl, maxOffen() - offenZahl() - ausstehend, pool.length);
    for (let i = 0; i < anzahl; i++) {
      const m = pool.shift()!;
      ausstehend++;
      spaeter(
        () => {
          ausstehend--;
          meldungOeffnen(m, { nahe, versatz: i });
          if (i === anzahl - 1) vielleichtHaengen();
        },
        240 + i * 220,
      );
    }
  };

  const endePruefen = () => {
    if (offenZahl() > 0 || ausstehend > 0) return;
    if (pool.length) {
      // Sicherheitsnetz: Solange der Pool nicht leer ist, bleibt der Schreibtisch nie leer
      eskalieren({ x: 0, y: 0 });
      return;
    }
    abschlussZeigen();
  };

  // Fenster ist weg, ohne Nachfolger: zählt als Schließung
  const schliessen = (f: Fenster) => {
    const warImTisch = imTisch();
    const p = lage(f);
    if (f.art === "meldung") weggeklickt++;
    entfernen(f);
    eskalieren(p);
    fokusNachSchliessen(warImTisch);
    endePruefen();
  };

  // Fenster wird durch ein anderes ersetzt (Kette, Fortschritt)
  const ersetzen = (f: Fenster, oeffnen: (p: Lage) => Fenster) => {
    const p = lage(f);
    const hatteFokus = f.el.contains(document.activeElement);
    if (f.art === "meldung") weggeklickt++;
    entfernen(f, false);
    const neu = oeffnen(p);
    // Der Fokus lag im ersetzten Fenster: Er geht mit, statt auf body zu fallen
    if (hatteFokus && !tisch.contains(document.activeElement)) fokussieren(offene[offene.length - 1] ?? neu);
  };

  const erinnern = (m: Meldung, titel: string) => {
    ausstehend++;
    const versuchen = () => {
      if (offenZahl() >= maxOffen()) {
        spaeter(versuchen, ERINNERUNG_MS);
        return;
      }
      ausstehend--;
      meldungOeffnen(m, {}, titel, true);
    };
    spaeter(versuchen, ERINNERUNG_MS);
  };

  /* Fortschritt: zäh bis 97 oder 99 Prozent, kurz hängen, dann die Folgemeldung */
  const fortschrittOeffnen = (text: string, bis: number, ziel: Meldung, p: Lage): Fenster => {
    const el = klonen("fortschritt");
    el.classList.add("meldung--neu");
    el.style.visibility = "hidden";
    const textEl = el.querySelector<HTMLElement>(".meldung__text p");
    if (textEl) {
      textEl.textContent = text;
      textEl.id = `meldung-text-${++nummer}`;
    }
    const balken = el.querySelector<HTMLElement>(".fortschritt");
    if (balken && textEl) balken.setAttribute("aria-labelledby", textEl.id);
    const kaesten = Array.from(el.querySelectorAll<HTMLElement>(".fortschritt span"));
    const zahl = el.querySelector<HTMLElement>(".fortschritt__zahl");
    tisch.append(el);
    const f = anmelden(el, "fortschritt", null);
    titelSetzen(f, "Bitte warten …");
    el.setAttribute("aria-label", `Bitte warten: ${text}`);
    platzieren(f, { ersetzt: p });
    el.style.visibility = "";
    f.bereitAb = performance.now() + SPERRE_MS;
    const oben = einreihen(f);
    aufploppen(f);
    if (oben && imTisch()) fokussieren(f);

    let wert = 0;
    const zeigen = () => {
      const voll = Math.round((wert / 100) * kaesten.length);
      kaesten.forEach((k, i) => k.classList.toggle("voll", i < voll));
      balken?.setAttribute("aria-valuenow", String(wert));
      if (zahl) zahl.textContent = `${wert}${NBSP}%`;
    };
    const weiter = () => {
      if (f.weg) return;
      if (wert >= bis) {
        spaeter(() => {
          if (f.weg) return;
          ersetzen(f, (q) => meldungOeffnen(ziel, { ersetzt: q }));
        }, bewegung() ? 1300 : 250);
        return;
      }
      const schritt = wert < 55 ? 5 + Math.random() * 9 : wert < 85 ? 2 + Math.random() * 5 : 1 + Math.random() * 1.5;
      wert = Math.min(bis, Math.round(wert + (bewegung() ? schritt : 25)));
      zeigen();
      const pause = bewegung() ? (Math.random() < 0.15 ? 900 : 120 + Math.random() * 300) : 60;
      spaeter(weiter, pause);
    };
    zeigen();
    spaeter(weiter, bewegung() ? 400 : 60);
    return f;
  };

  /* Dialoge (Speichern?, Feierabend?) */
  type Wahl = { text: string; wahl: string; voll?: boolean };
  const dialogOeffnen = (
    titel: string,
    text: string,
    wahlen: Wahl[],
    abbruch: string,
    antwort: (wahl: string) => void,
    eltern: Fenster | null,
  ): Fenster => {
    const el = klonen("warnung");
    el.classList.add("meldung--neu", "meldung--dialog");
    el.style.visibility = "hidden";
    el.setAttribute("role", "alertdialog");
    el.removeAttribute("data-meldung");
    const textEl = el.querySelector<HTMLElement>(".meldung__text p")!;
    textEl.textContent = text;
    textEl.id = `meldung-text-${++nummer}`;
    const knoepfe = el.querySelector<HTMLElement>(".meldung__knoepfe");
    wahlen.forEach((w) => knoepfe?.append(knopfAnlegen(w.text, { wahl: w.wahl }, w.voll)));
    tisch.append(el);
    const f = anmelden(el, "dialog", null);
    titelSetzen(f, titel);
    el.removeAttribute("aria-label");
    el.setAttribute("aria-labelledby", f.titeltext.id);
    el.setAttribute("aria-describedby", textEl.id);
    f.el.dataset.abbruch = abbruch;
    f.antwort = antwort;
    f.eltern = eltern;
    if (eltern) eltern.dialog = f;
    if (eltern) platzieren(f, { ueber: eltern });
    else {
      const { b, h } = flaeche();
      hineinsetzen(f, (b - el.offsetWidth) / 2, (h - el.offsetHeight) / 2);
    }
    el.style.visibility = "";
    f.bereitAb = performance.now() + SPERRE_MS;
    offene.push(f);
    stapeln();
    aufploppen(f);
    spiele("frage");
    ansagen(`Neue Meldung: ${titel}`);
    fokussieren(f);
    return f;
  };

  const speichernFragen = (f: Fenster) => {
    const datei = f.meldung?.datei ?? f.titel;
    dialogOeffnen(
      "Speichern?",
      `Möchten Sie die Änderungen an ${datei} speichern?`,
      [
        { text: "Ja", wahl: "ja", voll: true },
        { text: "Nein", wahl: "nein" },
        { text: "Abbrechen", wahl: "abbrechen" },
      ],
      "abbrechen",
      (wahl) => {
        const dialog = f.dialog;
        if (dialog) entfernen(dialog, false);
        if (wahl === "abbrechen") {
          if (imTisch()) fokussieren(f);
          return;
        }
        schliessen(f);
      },
      f,
    );
  };

  let feierabendDialog: Fenster | null = null;

  const allesZu = () => {
    const warImTisch = imTisch();
    timerAufraeumen();
    ausstehend = 0;
    pool = [];
    tisch.classList.remove("schreibtisch--wartet");
    const zuSchliessen = [...offene].filter((f) => f.art !== "abschluss").reverse();
    zuSchliessen.forEach((f) => {
      if (f.art === "meldung") weggeklickt++;
      f.haengt = false;
      f.el.classList.remove("meldung--haengt");
      f.el.removeAttribute("aria-busy");
    });
    const zeigen = () => {
      abschlussZeigen();
      if (warImTisch) fokussieren(abschluss);
    };
    if (!bewegung() || !zuSchliessen.length) {
      zuSchliessen.forEach((f) => entfernen(f, false));
      zeigen();
      return;
    }
    // Kaskade: von oben nach unten klappt ein Fenster nach dem anderen zu
    zuSchliessen.forEach((f) => {
      f.weg = true;
      f.eintrag?.remove();
      f.el.style.pointerEvents = "none";
    });
    offene = offene.filter((f) => f.art === "abschluss");
    stapeln();
    if (warImTisch) tisch.focus({ preventScroll: true });
    // Zu jedem zuklappenden Fenster ein tiefer Klick, im Takt des stagger (höchstens acht)
    zuSchliessen.slice(0, 8).forEach((_, i) => spiele("klick", { variante: "tief", in: i * 0.07 }));
    gsap.to(
      zuSchliessen.map((f) => f.el),
      {
        scale: 0.8,
        y: 24,
        autoAlpha: 0,
        duration: 0.16,
        ease: "power2.in",
        stagger: 0.07,
        onComplete: () => {
          zuSchliessen.forEach((f) => {
            f.weg = false;
            f.el.style.pointerEvents = "";
            entfernen(f, false);
          });
          zeigen();
        },
      },
    );
  };

  const feierabend = () => {
    if (feierabendDialog && !feierabendDialog.weg) {
      aktivieren(feierabendDialog);
      blinken(feierabendDialog);
      fokussieren(feierabendDialog);
      return;
    }
    feierabendDialog = dialogOeffnen(
      "Feierabend?",
      "Die Rechnungen von heute sind noch nicht raus. Trotzdem Feierabend machen?",
      [
        { text: "Ja, alles zu", wahl: "ja", voll: true },
        { text: "Nein", wahl: "nein" },
      ],
      "nein",
      (wahl) => {
        const d = feierabendDialog;
        feierabendDialog = null;
        if (d) entfernen(d, false);
        if (wahl === "ja") allesZu();
        else feierabendKnopf?.focus({ preventScroll: true });
      },
      null,
    );
  };

  /* Abschlussfenster */
  const abschluss = anmelden(leerEl, "abschluss", null, false);
  abschluss.eintrag?.remove();
  abschluss.eintrag = null;

  const abschlussZeigen = () => {
    const dauer = startZeit === null ? 0 : performance.now() - startZeit;
    const n = weggeklickt;
    // Alles weggeklickt, während „Feierabend?“ noch offen war: Die Frage hat sich erledigt
    if (feierabendDialog && !feierabendDialog.weg) entfernen(feierabendDialog, false);
    feierabendDialog = null;
    if (bilanz) {
      bilanz.textContent = `Sie haben gerade ${n}${NBSP}${n === 1 ? "Meldung" : "Meldungen"} weggeklickt, in ${dauerText(dauer)}. In Ihrem Büro kommen die jeden Tag. Nur ohne Knopf zum Wegklicken.`;
    }
    if (!offene.includes(abschluss)) {
      abschluss.weg = false;
      leerEl.hidden = false;
      eintragAnlegen(abschluss);
      titelSetzen(abschluss, abschluss.titel);
      const { b, h } = flaeche();
      hineinsetzen(abschluss, (b - leerEl.offsetWidth) / 2, Math.max(0, (h - leerEl.offsetHeight) / 2.4));
      offene.push(abschluss);
      aufploppen(abschluss);
      spiele("abmelden");
      ansagen(bilanz?.textContent ?? "Alle Meldungen weggeklickt.");
    }
    aktivieren(abschluss);
    if (imTisch()) fokussieren(abschluss);
  };

  /* Startfenster */
  const startEls = Array.from(tisch.querySelectorAll<HTMLElement>("[data-meldung]")).filter(
    (el) => !el.closest("template") && el.parentElement === tisch,
  );
  const startIds = ["A1", "B1", "C1"];

  // Auf großen Bildschirmen liegen die Fenster schon frei: Diese Lage wird übernommen
  const gemessen: (Lage & { anteil: number })[] = [];
  if (breit.matches) {
    const b = tisch.clientWidth || 1;
    startEls.forEach((el) => gemessen.push({ x: el.offsetLeft, y: el.offsetTop, anteil: el.offsetLeft / b }));
  }

  tisch.classList.add("schreibtisch--desktop");
  tisch.tabIndex = -1;
  tisch.setAttribute("role", "region");
  tisch.setAttribute("aria-label", "Schreibtisch mit Beispielmeldungen");
  leiste.hidden = false;

  const startFenster = startEls.map((el, i) => {
    el.dataset.meldungId = startIds[i] ?? `S${i}`;
    const m = ALLE.get(el.dataset.meldungId) ?? null;
    el.querySelectorAll<HTMLButtonElement>(".meldung__knoepfe button").forEach((k, j) => (k.dataset.knopf = String(j)));
    return anmelden(el, "meldung", m, true);
  });

  const startLagen = (): Lage[] => {
    const b = tisch.clientWidth;
    const breiten = startFenster.map((f) => f.el.offsetWidth);
    if (breit.matches) {
      if (gemessen.length === startFenster.length) return gemessen.map((g) => ({ x: g.anteil * b, y: g.y }));
      return [
        { x: 0, y: 0 },
        { x: b * 0.31, y: 104 },
        { x: b - (breiten[2] ?? 0), y: 28 },
      ];
    }
    if (mittel.matches) {
      return [
        { x: 0, y: 16 },
        { x: b * 0.3, y: 112 },
        { x: b - (breiten[2] ?? 0), y: 40 },
      ];
    }
    // Schmal: kaskadiert, jede Titelleiste bleibt sichtbar
    return startFenster.map((f, i) => ({ x: i * Math.min(40, (b - f.el.offsetWidth) / 2), y: i * 52 }));
  };

  const hoehen = new Map<Fenster, number>();
  let hoeheGesetzt = "";
  const hoeheAnpassen = () => {
    const lagen = startLagen();
    let noetig = 0;
    startFenster.forEach((f, i) => {
      if (!f.el.hidden) hoehen.set(f, f.el.offsetHeight);
      noetig = Math.max(noetig, (lagen[i]?.y ?? 0) + (hoehen.get(f) ?? 0));
    });
    noetig += leiste.offsetHeight + 16;
    const grund = mittel.matches ? Math.min(640, Math.max(520, window.innerWidth * 0.42)) : 480;
    const wert = `${Math.ceil(Math.max(grund, noetig))}px`;
    if (wert === hoeheGesetzt) return false;
    hoeheGesetzt = wert;
    tisch.style.setProperty("--desktop-hoehe", wert);
    return true;
  };

  const startAufstellen = () => {
    startFenster.forEach((f) => {
      f.el.hidden = false;
      f.weg = false;
      f.haengt = false;
      if (!f.eintrag) eintragAnlegen(f);
      titelSetzen(f, f.meldung?.titel ?? f.titel);
    });
    hoeheAnpassen();
    const lagen = startLagen();
    startFenster.forEach((f, i) => hineinsetzen(f, lagen[i].x, lagen[i].y));
    offene = [...startFenster];
    // Breit liegt das mittlere Fenster oben wie im ruhigen Layout, schmal das letzte der Kaskade
    const oben = mittel.matches ? startFenster[1] : startFenster[startFenster.length - 1];
    if (oben) aktivieren(oben);
    else stapeln();
    return oben;
  };

  startAufstellen();

  /* Bedienung: Knöpfe */
  const aktionAusfuehren = (f: Fenster, knopf: Knopf) => {
    const a = knopf.aktion;
    if (a.art === "zu") {
      schliessen(f);
    } else if (a.art === "kette") {
      const ziel = ALLE.get(a.ziel);
      if (ziel) ersetzen(f, (p) => meldungOeffnen(ziel, { ersetzt: p }));
      else schliessen(f);
    } else if (a.art === "warten") {
      const ziel = ALLE.get(a.ziel);
      if (ziel) ersetzen(f, (p) => fortschrittOeffnen(a.text, a.bis, ziel, p));
      else schliessen(f);
    } else {
      const warImTisch = imTisch();
      const ziel = a.ziel ? ALLE.get(a.ziel) : f.meldung;
      if (f.art === "meldung") weggeklickt++;
      entfernen(f);
      if (ziel) {
        const titel = a.ziel ? ziel.titel : `Erinnerung: ${ziel.titel.replace(/^Erinnerung: /, "")}`;
        erinnern(ziel, titel);
      }
      fokusNachSchliessen(warImTisch);
      endePruefen();
    }
  };

  const zuKnopf = (f: Fenster) => {
    if (f.art === "dialog") {
      f.antwort?.(f.el.dataset.abbruch ?? "abbrechen");
    } else if (f.meldung?.datei) {
      speichernFragen(f);
    } else if (f.art === "meldung") {
      schliessen(f);
    }
  };

  const verpufft = new WeakMap<Fenster, number>(); // letztes „ding“ je hängendem Fenster

  tisch.addEventListener("click", (e) => {
    const knopf = (e.target as Element).closest<HTMLElement>("button");
    const el = knopf?.closest<HTMLElement>(".meldung");
    const f = el ? register.get(el) : undefined;
    if (!knopf || !f || f.weg) return;
    merken();
    if (knopf.hasAttribute("data-meldungen-zurueck")) {
      zuruecksetzen();
      return;
    }
    if (f.haengt) {
      // Keine Rückmeldung: Klicks verpuffen, mit leisem „ding“ höchstens alle 1,5 s je Fenster
      const jetzt = performance.now();
      if (jetzt - (verpufft.get(f) ?? -Infinity) >= 1500) {
        verpufft.set(f, jetzt);
        spiele("ding", { db: 8 });
      }
      return;
    }
    // Gerade erst aufgeploppt: Der zweite Klick eines Doppelklicks trifft nicht gleich den nächsten Knopf
    if (performance.now() < f.bereitAb) return;
    if (f.dialog) {
      // Ein Dialog liegt darüber: Erst der Dialog, dann das Fenster
      aktivieren(f);
      blinken(f.dialog);
      fokussieren(f.dialog);
      return;
    }
    if (knopf.classList.contains("fenster__zu")) {
      zuKnopf(f);
    } else if (knopf.dataset.wahl) {
      f.antwort?.(knopf.dataset.wahl);
    } else if (knopf.dataset.knopf && f.meldung) {
      const k = f.meldung.knoepfe[Number(knopf.dataset.knopf)];
      if (k) aktionAusfuehren(f, k);
    }
  });

  feierabendKnopf?.addEventListener("click", feierabend);

  /* Bedienung: nach vorn holen, Fokus merken */
  const merken = () => {
    interagiert = true;
    startZeit ??= performance.now();
  };

  tisch.addEventListener("pointerdown", (e) => {
    merken();
    const el = (e.target as Element).closest<HTMLElement>(".meldung");
    const f = el ? register.get(el) : undefined;
    if (f) aktivieren(f);
  });

  tisch.addEventListener("focusin", (e) => {
    // Der Desktop schneidet ab (overflow: clip). Falls ein Browser ihn doch verschoben hat: zurück
    tisch.scrollTop = 0;
    tisch.scrollLeft = 0;
    const ziel = e.target as HTMLElement;
    const el = ziel.closest<HTMLElement>(".meldung");
    const f = el ? register.get(el) : undefined;
    if (!f) return;
    if (offene[offene.length - 1] !== (f.dialog ?? f)) aktivieren(f);
    // Liegt das fokussierte Element außerhalb des Bildes (Fenster halb hinausgezogen),
    // holt der Fokus das ganze Fenster herein
    const { b, h } = flaeche();
    const r = ziel.getBoundingClientRect();
    const t = tisch.getBoundingClientRect();
    const x = r.left - t.left - tisch.clientLeft;
    const y = r.top - t.top - tisch.clientTop;
    if (x < 0 || y < 0 || x + r.width > b || y + r.height > h) {
      const p = lage(f);
      hineinsetzen(f, p.x, p.y);
    }
  });

  document.addEventListener(
    "pointerdown",
    (e) => {
      if (!tisch.contains(e.target as Node)) interagiert = false;
    },
    true,
  );
  document.addEventListener("focusin", (e) => {
    if (!tisch.contains(e.target as Node)) interagiert = false;
  });

  /* Tastatur: Escape schließt, Pfeiltasten verschieben */
  tisch.addEventListener("keydown", (e) => {
    merken();
    const el = (e.target as Element).closest<HTMLElement>(".meldung");
    const f = el ? register.get(el) : undefined;
    if (!f || f.weg) return;
    if (e.key === "Escape") {
      const zuEl = f.el.querySelector<HTMLButtonElement>(".fenster__zu");
      if (zuEl) {
        e.preventDefault();
        zuEl.click();
      }
      return;
    }
    if (e.target !== f.titeltext) return;
    if (e.key === "Enter" || e.key === " ") {
      // Die Titelleiste ist ein Knopf: Er holt das Fenster nach vorn
      e.preventDefault();
      aktivieren(f);
      if (f.dialog) {
        blinken(f.dialog);
        fokussieren(f.dialog);
      }
      return;
    }
    const schritt = e.shiftKey ? SCHRITT_GROSS : SCHRITT;
    const versatz: Record<string, [number, number]> = {
      ArrowLeft: [-schritt, 0],
      ArrowRight: [schritt, 0],
      ArrowUp: [0, -schritt],
      ArrowDown: [0, schritt],
    };
    const v = versatz[e.key];
    if (!v) return;
    e.preventDefault();
    if (f.dialog) {
      // Solange „Speichern?“ offen ist, bleibt das Fenster darunter stehen
      blinken(f.dialog);
      fokussieren(f.dialog);
      return;
    }
    const p = lage(f);
    einklemmen(f, p.x + v[0], p.y + v[1]);
  });

  /* Ziehen an der Titelleiste, mit Maus, Stift und Finger */
  tisch.addEventListener("pointerdown", (e) => {
    const leisteEl = (e.target as Element).closest<HTMLElement>(".fenster__titel");
    if (!leisteEl || (e.target as Element).closest(".fenster__zu")) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const el = leisteEl.closest<HTMLElement>(".meldung");
    const f = el ? register.get(el) : undefined;
    if (!f || f.weg) return;
    if (f.dialog) {
      // Ein Dialog hängt an diesem Fenster: erst antworten, dann verschieben.
      // Fokus erst nach dem Mausklick setzen, sonst landet er gleich wieder auf dem Titel
      const dialog = f.dialog;
      blinken(dialog);
      requestAnimationFrame(() => {
        if (!dialog.weg) fokussieren(dialog);
      });
      return;
    }
    zug?.ende();
    // Kein preventDefault: Die Maus fokussiert den Titeltext wie gewohnt (ohne Fokusring),
    // Markieren verhindert user-select im CSS
    const start = lage(f);
    const sx = e.clientX;
    const sy = e.clientY;
    leisteEl.setPointerCapture(e.pointerId);
    tisch.classList.add("schreibtisch--zieht");
    const bewegen = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      einklemmen(f, start.x + ev.clientX - sx, start.y + ev.clientY - sy);
    };
    const ende = () => {
      if (zug?.f === f) zug = null;
      tisch.classList.remove("schreibtisch--zieht");
      leisteEl.removeEventListener("pointermove", bewegen);
      leisteEl.removeEventListener("pointerup", loslassen);
      leisteEl.removeEventListener("pointercancel", loslassen);
      leisteEl.removeEventListener("lostpointercapture", loslassen);
      if (leisteEl.hasPointerCapture(e.pointerId)) leisteEl.releasePointerCapture(e.pointerId);
    };
    const loslassen = (ev: PointerEvent) => {
      if (ev.pointerId === e.pointerId) ende();
    };
    zug = { f, ende };
    leisteEl.addEventListener("pointermove", bewegen);
    leisteEl.addEventListener("pointerup", loslassen);
    leisteEl.addEventListener("pointercancel", loslassen);
    leisteEl.addEventListener("lostpointercapture", loslassen);
  });

  /* Zurücksetzen */
  const zuruecksetzen = () => {
    timerAufraeumen();
    gsap.killTweensOf(Array.from(tisch.querySelectorAll(".meldung")));
    tisch.classList.remove("schreibtisch--wartet");
    [...offene].forEach((f) => {
      if (!f.start) entfernen(f, false);
    });
    tisch.querySelectorAll<HTMLElement>(".meldung--neu").forEach((el) => el.remove());
    entfernen(abschluss, false);
    feierabendDialog = null;
    pool = poolMischen();
    ausstehend = 0;
    schliessungen = 0;
    letzteAnzahl = 0;
    weggeklickt = 0;
    startZeit = performance.now();
    startFenster.forEach((f) => {
      f.dialog = null;
      f.el.classList.remove("meldung--haengt");
      f.el.removeAttribute("aria-busy");
    });
    // Fokus auf das Fenster, das oben liegt, damit der Stapel wie beim ersten Laden aussieht
    const oben = startAufstellen();
    if (!bewegung()) {
      fokussieren(oben);
      return;
    }
    gsap.fromTo(
      startFenster.map((f) => f.el),
      { scale: 0.6, opacity: 0 },
      {
        scale: 1,
        opacity: 1,
        duration: 0.3,
        ease: "back.out(2.2)",
        stagger: 0.1,
        clearProps: "transform,opacity,visibility",
      },
    );
    fokussieren(oben);
  };

  /* Größenänderung: Höhe neu, alle Fenster wieder einklemmen */
  let letzteBreite = tisch.clientWidth;
  const groesse = new ResizeObserver(() => {
    const b = tisch.clientWidth;
    if (b === letzteBreite) return;
    letzteBreite = b;
    const geaendert = hoeheAnpassen();
    if (startZeit === null) {
      // Noch niemand hat etwas angefasst: Die Startfenster neu aufstellen
      const lagen = startLagen();
      startFenster.forEach((f, i) => hineinsetzen(f, lagen[i].x, lagen[i].y));
    } else {
      // Was hineinpasst, kommt ganz herein; größere Fenster behalten ihre greifbare Titelleiste
      const { b: fb, h: fh } = flaeche();
      offene.forEach((f) => {
        const p = lage(f);
        if (f.el.offsetWidth <= fb && f.el.offsetHeight <= fh) hineinsetzen(f, p.x, p.y);
        else einklemmen(f, p.x, p.y);
      });
    }
    if (geaendert) ScrollTrigger.refresh();
  });
  groesse.observe(tisch);

  // Die Pixelschrift kommt später: Höhen dann einmal nachmessen
  document.fonts?.ready.then(() => {
    if (hoeheAnpassen()) ScrollTrigger.refresh();
  });

  /* Uhr: läuft nur, solange der Schreibtisch im Bild ist. Derselbe Beobachter sagt imTisch(),
     ob neue Fenster den Fokus nehmen dürfen. */
  let uhrTimer = 0;
  const uhrText = (jetzt: Date) => {
    if (!uhr) return;
    uhr.textContent = jetzt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    uhr.dateTime = uhr.textContent;
  };
  uhrText(new Date());
  const uhrStellen = () => {
    if (!uhr) return;
    const jetzt = new Date();
    uhrText(jetzt);
    uhrTimer = window.setTimeout(uhrStellen, 60_000 - (jetzt.getSeconds() * 1000 + jetzt.getMilliseconds()) + 50);
  };
  const uhrStoppen = () => {
    window.clearTimeout(uhrTimer);
    uhrTimer = 0;
  };
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((eintraege) => {
      const e = eintraege[eintraege.length - 1];
      tischSichtbar = !!e?.isIntersecting;
      if (tischSichtbar) {
        if (!uhrTimer) uhrStellen();
      } else {
        uhrStoppen();
      }
    }).observe(tisch);
  } else {
    uhrStellen();
  }
}
