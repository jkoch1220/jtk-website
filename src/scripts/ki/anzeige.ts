/* Gemeinsame Anzeige der drei KI-Programme (Abschnitt 07 „Ausprobieren“) ----------------------------------
   Text sicher setzen, Schreibmaschine, Ansagen, Zahlen wie im Zeitfresser-Check, Meldungen im Fenster, die grobe
   Prüfung auf echte Kontaktdaten und die Steuerung eines Durchlaufs (demoSteuerung): Zustände, Statusleiste,
   Startknopf, Anhalten, Fehleranzeige je Code, Rest. So verhalten sich alle drei Programme gleich.
   Regeln:
   - Was von der KI oder von Besuchern kommt, geht nur über textContent ins DOM, nie als HTML, nie als Link.
   - Die Ausgabefläche ist nicht live (aria-busy während des Laufs). Zustandswechsel sagt die eine
     .sr-only-Region des Abschnitts an, und nur für das sichtbare Programm.
   - Kein Browser-Speicher. In die Messung gehen nur feste Wörter, nie Eingaben oder Antworten der KI. */

import { nutzung } from "../nutzung";
import { spiele } from "../klang";
import { turnstileToken, turnstileVorbereiten } from "../turnstile";
import { runden } from "../../data/richtwerte";
import { AUSWEGE, HINWEISE, PROGRAMME } from "../../data/ki-demos";
import {
  MESSBEREICH,
  RUECKFALL,
  fehlerMessung,
  kiLauf,
  kiStatus,
  restBeobachten,
  restSetzen,
  restVon,
  type DemoId,
  type DemoRest,
  type KiFehler,
  type KiStatus,
  type LaufErgebnis,
  type StartDaten,
} from "./verbindung";

/** Wunsch nach reduzierter Bewegung, bei jedem Aufruf neu gefragt (die Einstellung kann sich ändern) */
export const ruhig = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Text sicher setzen (nie als HTML) */
export function textSetzen(element: Element | null | undefined, text: string): void {
  if (element) element.textContent = text;
}

/* Zahlen wie im Zeitfresser-Check (zeitfresser.ts) ------------------------------------------------------ */

const ganzzahlFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
const kommazahlFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
// minimumFractionDigits ausdrücklich, ältere Safari werfen sonst einen RangeError
const euroFormat = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export const ganzzahl = (zahl: number): string => ganzzahlFormat.format(zahl);
export const kommazahl = (zahl: number): string => kommazahlFormat.format(zahl);
/** „9.900 €“ mit geschütztem Leerzeichen vor dem Zeichen */
export const euro = (betrag: number): string => euroFormat.format(betrag);
/** „rund 9.900 €“, gerundet wie der Check: auf 100 €, ab 10.000 € auf 1.000 € */
export const rundEuro = (betrag: number): string => `rund ${euro(runden(betrag))}`;

/** Ganze Sekunden, mindestens 1 */
export const sekunden = (ms: number): number => Math.max(1, Math.round(ms / 1000));
/** „6 Sekunden“, „1 Sekunde“ */
export const sekundenText = (s: number): string => `${ganzzahl(s)}\u00a0${s === 1 ? "Sekunde" : "Sekunden"}`;
/** Dauer als „1:48“ (Minuten:Sekunden) */
export const minutenUhr = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/* Schreibmaschine ----------------------------------------------------------------------------------------
   Für Strings, die im Stream wachsen: Der sichtbare Text holt den Stand in wenigen Bildern ein, je mehr aufläuft,
   desto schneller. Weicht ein neuer Stand vom sichtbaren ab (Ausweichmodell, Korrektur), geht es vom gemeinsamen
   Anfang weiter. Bei reduzierter Bewegung und im Hintergrund steht der Text sofort da. Das Element muss ein
   reiner Textbehälter sein (textContent ersetzt seinen Inhalt). Der Cursor ist .ki-cursor aus ki.css. */

const schreibend = new Map<HTMLElement, string>();
const cursorUhren = new WeakMap<HTMLElement, number>();
let schreibBild = 0;

function gemeinsamerAnfang(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return a.slice(0, i);
}

function cursorAus(element: HTMLElement, verzug = 0): void {
  window.clearTimeout(cursorUhren.get(element));
  if (!verzug) {
    element.classList.remove("ki-cursor");
    return;
  }
  // Kurz stehen lassen: Zwischen zwei Teilständen soll der Cursor nicht flackern
  cursorUhren.set(
    element,
    window.setTimeout(() => {
      if (!schreibend.has(element)) element.classList.remove("ki-cursor");
    }, verzug),
  );
}

function schreibSchritt(): void {
  schreibBild = 0;
  for (const [element, ziel] of schreibend) {
    const sichtbar = element.textContent ?? "";
    const offen = ziel.length - sichtbar.length;
    if (offen <= 0 || !element.isConnected) {
      schreibend.delete(element);
      cursorAus(element, 600);
      continue;
    }
    let bis = sichtbar.length + Math.max(2, Math.ceil(offen / 10));
    // Kein halbes Zeichen außerhalb der Grundebene (Ersatzpaar) zeigen
    const code = ziel.charCodeAt(bis - 1);
    if (code >= 0xd800 && code <= 0xdbff) bis += 1;
    element.textContent = ziel.slice(0, bis);
  }
  if (schreibend.size) schreibBild = requestAnimationFrame(schreibSchritt);
}

/** Schreibt text nach und nach in das Element (wachsende Strings aus event: stand) */
export function schreiben(element: HTMLElement | null | undefined, text: string): void {
  if (!element) return;
  const sichtbar = element.textContent ?? "";
  if (ruhig() || document.visibilityState !== "visible") {
    sofort(element, text);
    return;
  }
  if (sichtbar === text) return;
  if (!text.startsWith(sichtbar)) element.textContent = gemeinsamerAnfang(sichtbar, text);
  schreibend.set(element, text);
  window.clearTimeout(cursorUhren.get(element));
  element.classList.add("ki-cursor");
  if (!schreibBild) schreibBild = requestAnimationFrame(schreibSchritt);
}

/** Setzt den Text sofort und beendet ein laufendes Schreiben (etwa mit dem Ergebnis aus fertig) */
export function sofort(element: HTMLElement | null | undefined, text: string): void {
  if (!element) return;
  schreibend.delete(element);
  element.textContent = text;
  cursorAus(element);
}

/* Ansagen ----------------------------------------------------------------------------------------------- */

let ansageUhr = 0;

/**
 * Sagt einen Zustandswechsel an (.sr-only[role=status] des Abschnitts). Erst leeren, dann mit Verzug setzen, damit
 * auch derselbe Satz noch einmal angesagt wird. vonKi: beginnt mit „Antwort der KI:“ (KI-Verordnung Art. 50).
 * Mit panel nur, solange dieses Programm sichtbar ist: Ein Lauf im verborgenen Reiter läuft still weiter.
 */
export function ansagen(text: string, o: { panel?: HTMLElement | null; vonKi?: boolean } = {}): void {
  if (o.panel?.hidden) return;
  const ort = document.querySelector<HTMLElement>("[data-ki-ansage]");
  if (!ort) return;
  const satz = o.vonKi ? `${HINWEISE.ansage} ${text}` : text;
  window.clearTimeout(ansageUhr);
  ort.textContent = "";
  ansageUhr = window.setTimeout(() => (ort.textContent = satz), 120);
}

/* Meldung im Fenster ---------------------------------------------------------------------------------------
   Symbol, Satz, Knöpfe und Auswege in einem Kasten (.ki-fehler aus ki.css). Gebaut per createElement, damit jedes
   Programm nur einen leeren Ort braucht: <div data-ki-meldung hidden></div>. Symbole wie PixelIcon.astro. */

export interface MeldungKnopf {
  text: string;
  aktion: () => void;
  voll?: boolean;
}

export interface Meldung {
  art: "info" | "warnung" | "fehler";
  /** Fette erste Zeile, optional */
  titel?: string;
  satz: string;
  knoepfe?: MeldungKnopf[];
  /** Feste Auswege auf der Seite (#check, #kontakt) oder in die Datenschutzerklärung, nie Adressen aus Antworten der KI */
  links?: { text: string; href: string }[];
}

// Nur Anker dieser Seite und die Datenschutzerklärung: Ein anderes Ziel wird gar nicht erst ein Link
const ERLAUBTES_ZIEL = /^(#[a-z0-9-]+|\/datenschutz\/(#[a-z0-9-]+)?)$/;

const SVG = "http://www.w3.org/2000/svg";

function svgTeil(name: string, attribute: Record<string, string>): SVGElement {
  const teil = document.createElementNS(SVG, name);
  for (const [schluessel, wert] of Object.entries(attribute)) teil.setAttribute(schluessel, wert);
  return teil;
}

function symbol(art: Meldung["art"]): SVGElement {
  const svg = svgTeil("svg", {
    class: "pixel-icon",
    viewBox: "0 0 16 16",
    "shape-rendering": "crispEdges",
    "aria-hidden": "true",
    focusable: "false",
  });
  if (art === "info") {
    svg.append(
      svgTeil("circle", { cx: "8", cy: "8", r: "7.5", fill: "var(--rahmen)" }),
      svgTeil("rect", { x: "7", y: "3", width: "2", height: "2", fill: "var(--auf-rahmen)" }),
      svgTeil("rect", { x: "7", y: "6", width: "2", height: "7", fill: "var(--auf-rahmen)" }),
    );
  } else if (art === "warnung") {
    svg.append(
      svgTeil("polygon", { points: "8,0.5 15.5,15 0.5,15", fill: "var(--kopie-gelb)", stroke: "var(--auf-gelb)", "stroke-width": "1" }),
      svgTeil("rect", { x: "7", y: "5", width: "2", height: "5", fill: "var(--auf-gelb)" }),
      svgTeil("rect", { x: "7", y: "11", width: "2", height: "2", fill: "var(--auf-gelb)" }),
    );
  } else {
    svg.append(
      svgTeil("circle", { cx: "8", cy: "8", r: "7.5", fill: "var(--stempel-flaeche)" }),
      svgTeil("rect", { x: "4", y: "7", width: "8", height: "2", fill: "var(--auf-rahmen)", transform: "rotate(45 8 8)" }),
      svgTeil("rect", { x: "4", y: "7", width: "8", height: "2", fill: "var(--auf-rahmen)", transform: "rotate(-45 8 8)" }),
    );
  }
  return svg;
}

/** Zeigt eine Meldung im Ort (ersetzt eine vorige). fokus: der Kasten bekommt den Fokus (tabindex -1). */
export function meldungZeigen(ort: HTMLElement, m: Meldung, o: { fokus?: boolean } = {}): void {
  const kasten = document.createElement("div");
  kasten.className = `ki-fehler${m.art === "fehler" ? " ki-fehler--rot" : m.art === "warnung" ? " ki-fehler--gelb" : ""}`;
  kasten.tabIndex = -1;
  const inhalt = document.createElement("div");
  inhalt.className = "ki-fehler__inhalt";
  if (m.titel) {
    const titel = document.createElement("p");
    titel.className = "ki-fehler__titel";
    titel.textContent = m.titel;
    inhalt.append(titel);
  }
  const satz = document.createElement("p");
  satz.className = "ki-fehler__satz";
  satz.textContent = m.satz;
  inhalt.append(satz);
  if (m.knoepfe?.length || m.links?.length) {
    const leiste = document.createElement("div");
    leiste.className = "ki-fehler__knoepfe";
    for (const k of m.knoepfe ?? []) {
      const knopf = document.createElement("button");
      knopf.type = "button";
      knopf.className = k.voll ? "retro-knopf retro-knopf--voll" : "retro-knopf";
      knopf.textContent = k.text;
      knopf.addEventListener("click", k.aktion);
      leiste.append(knopf);
    }
    for (const l of m.links ?? []) {
      if (!ERLAUBTES_ZIEL.test(l.href)) continue;
      const link = document.createElement("a");
      link.className = "ki-fehler__link";
      link.href = l.href;
      link.textContent = l.text;
      leiste.append(link);
    }
    inhalt.append(leiste);
  }
  kasten.append(symbol(m.art), inhalt);
  ort.replaceChildren(kasten);
  ort.hidden = false;
  if (o.fokus) kasten.focus({ preventScroll: true });
}

/** Leert den Ort. Saß der Fokus darin, geht er an ersatz, damit er nie auf body fällt. */
export function meldungVerbergen(ort: HTMLElement, ersatz?: HTMLElement | null): void {
  const hatteFokus = ort.contains(document.activeElement);
  ort.replaceChildren();
  ort.hidden = true;
  if (hatteFokus) ersatz?.focus({ preventScroll: true });
}

/* Echte Kontaktdaten? -------------------------------------------------------------------------------------
   Grobe Prüfung vor dem Senden eigener Texte (E-Mail, Telefonnummer, IBAN). Gefunden wird nur, gemeldet oder
   gespeichert wird nichts. Erfundenes aus den Vorlagen bleibt erlaubt: Beispiel-Domains und die Filmrufnummern
   der Bundesnetzagentur (0221 4710…, 0171 39200…, 0176 04069…). */

const MAIL = /[\p{L}\p{N}._%+-]+@((?:[\p{L}\p{N}-]+\.)+[\p{L}]{2,})/gu;
const BEISPIEL_DOMAIN = /(^|\.)example\.(com|org|net)$/i;
// Mit + oder 0 beginnend, Ziffern mit Leerzeichen, Klammern, Schrägstrich oder Strich; Punkte nicht (Datum)
const TELEFON = /(?:\+|\b0)[\d ()/–-]{5,}\d/g;
const FILMNUMMERN = ["02214710", "017139200", "017604069"];
const IBAN = /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]){12,30}\b/g;

export function kontaktdatenGefunden(text: string): boolean {
  for (const treffer of text.matchAll(MAIL)) {
    if (!BEISPIEL_DOMAIN.test(treffer[1])) return true;
  }
  for (const treffer of text.matchAll(TELEFON)) {
    let ziffern = treffer[0].replace(/\D/g, "");
    if (treffer[0].startsWith("+49")) ziffern = `0${ziffern.slice(2)}`;
    if (ziffern.length < 7 || ziffern.length > 15) continue;
    if (!FILMNUMMERN.some((anfang) => ziffern.startsWith(anfang))) return true;
  }
  for (const treffer of text.matchAll(IBAN)) {
    if ((treffer[0].match(/\d/g) ?? []).length >= 14) return true;
  }
  return false;
}

/* Rest ------------------------------------------------------------------------------------------------- */

/** „Auftrags-Scanner: Heute noch 4 Durchläufe.“ für die Hinweiszeile des Abschnitts */
export const restSatz = (demo: DemoId, stand: DemoRest): string => `${PROGRAMME[demo].reiter}: ${HINWEISE.rest(stand.rest)}`;

/* Steuerung eines Durchlaufs -------------------------------------------------------------------------------
   Markup im Programmfenster (Gerüste in components/ki/):
     form[data-turnstile-aktion]  mit [data-turnstile] (Site-Key), method="post", ohne action
     [data-ki-start]              Startknopf (type=submit); anfangs disabled, bis der Status da ist
     [data-ki-anhalten]           „Anhalten“, hidden; sichtbar während des Laufs
     [data-ki-stand]              linker Teil der Statusleiste (kein role=status, die Sekunden laufen)
     [data-ki-meldung]            leerer Ort für Meldungen, hidden
     [data-ki-ausgang]            Ausgabefläche, bekommt aria-busy
     [data-ki-rest]               optional: Rest im Fenster
   Das Panel trägt den Zustand als data-ki-zustand (für CSS der Programme). */

export type DemoZustand = "laedt" | "aus" | "bereit" | "prueft" | "laeuft" | "fertig" | "fehler" | "gesperrt";

export interface SteuerungOptionen {
  demo: DemoId;
  /** Statusleiste während des Laufs, etwa „Liest …“ */
  laufText: string;
  /** Sekunden an den Lauftext hängen („Liest … 3 s“); Standard ja */
  sekundenZeigen?: boolean;
  /** Statusleiste nach dem Lauf; Standard „Fertig nach 6 Sekunden“ */
  fertigText?: (s: number) => string;
  /** Feld, das bei ungueltig oder zu_gross markiert wird und den Fokus bekommt */
  feldBeiFehler?: (fehler: KiFehler) => HTMLElement | null;
  /** „Noch einmal versuchen“; Standard: das Formular mit dem Startknopf erneut absenden */
  nochmal?: () => void;
}

export interface LaufRueckrufe {
  beiStart?: (start: StartDaten) => void;
  /** Teilstand: nur zeichnen (schreiben()), nichts rechnen; Felder können fehlen */
  beiStand?: (teil: unknown) => void;
  /** Ein Ausweichmodell beginnt neu: Vorschau leeren */
  beiNeu?: () => void;
}

export interface DemoSteuerung {
  readonly panel: HTMLElement;
  readonly formular: HTMLFormElement;
  readonly ausgang: HTMLElement | null;
  zustand(): DemoZustand;
  /** Darf jetzt ein Lauf beginnen? Ein Absenden zu anderen Zeiten fängt die Steuerung selbst ab. */
  kannStarten(): boolean;
  /**
   * Ein Durchlauf mit allem Drumherum: Turnstile (turnstile: false bei Folgezügen des Probeanrufs), Zustände,
   * Sekunden, Anhalten, Zeitlimits, Fehleranzeige je Code samt Klang und Messung, Rest. Wirft nie.
   */
  lauf(body: Record<string, unknown>, rueckrufe?: LaufRueckrufe, o?: { turnstile?: boolean }): Promise<LaufErgebnis>;
  anhalten(): void;
  /** Eigenen Text in die Statusleiste schreiben (etwa „Verbunden · 0:42“) */
  stand(text: string): void;
  ansagen(text: string, vonKi?: boolean): void;
  /** Vor dem Senden eigener Texte: false, wenn Besucher nach dem Hinweis auf Kontaktdaten lieber ändern */
  eigenenTextPruefen(text: string, feld?: HTMLElement | null): Promise<boolean>;
  /** Eigene Meldung im selben Kasten (null verbirgt ihn) */
  meldung(m: Meldung | null, o?: { fokus?: boolean }): void;
}

const STAND_TEXT: Partial<Record<DemoZustand, string>> = {
  laedt: "Wird vorbereitet …",
  bereit: HINWEISE.bereit,
  prueft: HINWEISE.prueft,
  fehler: "Nicht geklappt",
  gesperrt: "Für heute aufgebraucht",
};

const AUSWEG_CHECK = { text: AUSWEGE.check.text, href: AUSWEGE.check.ziel };
const AUSWEG_KONTAKT = { text: AUSWEGE.erstgespraech.text, href: AUSWEGE.erstgespraech.ziel };

const fertigStandard = (s: number) => `Fertig nach ${sekundenText(s)}`;

/** Richtet die gemeinsame Steuerung für ein Programm ein (panel: das Reiter-Panel [data-ki-programm]) */
export function demoSteuerung(panel: HTMLElement, optionen: SteuerungOptionen): DemoSteuerung {
  const formular = panel.querySelector<HTMLFormElement>("form[data-turnstile-aktion]") ?? panel.querySelector("form");
  if (!formular) throw new Error(`KI-Demo ${optionen.demo}: kein Formular`);
  const standOrt = panel.querySelector<HTMLElement>("[data-ki-stand]");
  const anhaltenKnopf = panel.querySelector<HTMLButtonElement>("[data-ki-anhalten]");
  const ausgang = panel.querySelector<HTMLElement>("[data-ki-ausgang]");
  const restOrt = panel.querySelector<HTMLElement>("[data-ki-rest]");
  const startKnoepfe = () => Array.from(panel.querySelectorAll<HTMLButtonElement>("[data-ki-start]"));
  const bereich = MESSBEREICH[optionen.demo];

  let meldungOrt = panel.querySelector<HTMLElement>("[data-ki-meldung]");
  if (!meldungOrt) {
    // Rückfall: vor den Knöpfen anlegen, falls ein Programm den Ort vergisst
    meldungOrt = document.createElement("div");
    meldungOrt.hidden = true;
    (startKnoepfe()[0]?.parentElement ?? formular).before(meldungOrt);
  }
  const ort = meldungOrt;

  let zustand: DemoZustand = "laedt";
  let ausCode: KiStatus["code"] = null;
  let abbruch: AbortController | null = null;
  let markiert: HTMLElement | null = null;
  let sekundenUhr = 0;
  let laufBeginn = 0;
  let offeneFrage: ((weiter: boolean) => void) | null = null;
  let nichtVerfuegbarGemeldet = false;
  let turnstileAngestossen = false;

  const kannStarten = () => zustand === "bereit" || zustand === "fertig" || zustand === "fehler";
  const ersterStart = () => startKnoepfe().find((k) => !k.hidden) ?? null;

  const standSetzen = (text: string) => textSetzen(standOrt, text);

  // Während der Arbeit behält ein fokussierter Knopf den Fokus (aria-disabled statt disabled), sonst fiele er auf body
  const startSperren = (gesperrt: boolean, verbergen = false) => {
    for (const knopf of startKnoepfe()) {
      knopf.hidden = verbergen;
      if (gesperrt && document.activeElement === knopf && !verbergen) {
        knopf.disabled = false;
        knopf.setAttribute("aria-disabled", "true");
      } else {
        knopf.disabled = gesperrt;
        knopf.removeAttribute("aria-disabled");
      }
    }
  };

  const sekundenStoppen = () => {
    window.clearInterval(sekundenUhr);
    sekundenUhr = 0;
  };

  const zustandSetzen = (neu: DemoZustand, text?: string) => {
    const vorher = zustand;
    zustand = neu;
    panel.dataset.kiZustand = neu;
    const laeuft = neu === "prueft" || neu === "laeuft";
    if (ausgang) ausgang.setAttribute("aria-busy", String(neu === "laeuft"));
    startSperren(!kannStarten(), neu === "aus");
    if (anhaltenKnopf) {
      const hatteFokus = document.activeElement === anhaltenKnopf;
      anhaltenKnopf.hidden = !laeuft;
      if (hatteFokus && !laeuft) ersterStart()?.focus({ preventScroll: true });
    }
    if (neu === "laeuft" && vorher !== "laeuft") {
      laufBeginn = performance.now();
      const mitSekunden = optionen.sekundenZeigen !== false;
      const zeigen = () =>
        standSetzen(mitSekunden ? `${optionen.laufText} ${ganzzahl(Math.floor((performance.now() - laufBeginn) / 1000))} s` : optionen.laufText);
      zeigen();
      sekundenStoppen();
      if (mitSekunden) sekundenUhr = window.setInterval(zeigen, 1000);
      return;
    }
    if (neu !== "laeuft") sekundenStoppen();
    standSetzen(text ?? STAND_TEXT[neu] ?? "");
  };

  const meldungAus = () => meldungVerbergen(ort, ersterStart());

  const markierungLoesen = () => {
    markiert?.removeAttribute("aria-invalid");
    markiert = null;
  };

  // Rest im Fenster (falls das Programm [data-ki-rest] hat) und in der Hinweiszeile des Abschnitts. Die Zeile gehört
  // dem sichtbaren Programm: ki.ts verbirgt sie beim Wechsel, die Steuerung des neuen Programms zeigt sie wieder.
  const restZeile = document.querySelector<HTMLElement>("[data-ki-rest-zeile]");
  const restZeigen = () => {
    const stand = restVon(optionen.demo);
    const zeigen = stand !== null && zustand !== "aus";
    if (restOrt) {
      restOrt.hidden = !zeigen;
      if (stand) restOrt.textContent = HINWEISE.rest(stand.rest);
    }
    if (restZeile && !panel.hidden) {
      restZeile.hidden = !zeigen;
      if (stand) restZeile.textContent = restSatz(optionen.demo, stand);
    }
  };
  restBeobachten((demo) => {
    if (demo === optionen.demo) restZeigen();
  });
  document.addEventListener("ki:programm", () => {
    if (!panel.hidden) restZeigen();
  });

  // Nicht bereit: Meldung statt Startknopf, mit Ausweg. Nicht erreichbar: noch einmal fragen.
  const ausSetzen = (code: Exclude<KiStatus["code"], null>, satz: string, fokus = false) => {
    ausCode = code;
    zustandSetzen("aus", code === "nicht_erreichbar" ? "Nicht erreichbar" : "Ausgeschaltet");
    meldungZeigen(
      ort,
      code === "nicht_erreichbar"
        ? { art: "info", satz, knoepfe: [{ text: AUSWEGE.nochmal, aktion: statusNeu }] }
        : { art: "info", satz, links: code === "budget" ? [AUSWEG_CHECK, AUSWEG_KONTAKT] : [AUSWEG_CHECK] },
      { fokus },
    );
    restZeigen();
  };

  const statusAnwenden = (s: KiStatus) => {
    // Marke „Attrappe“ in der Hinweiszeile (nur Entwicklung); jede Steuerung darf sie setzen, sie sagt dasselbe
    const attrappe = document.querySelector<HTMLElement>("[data-ki-attrappe]");
    if (attrappe) attrappe.hidden = !s.attrappe;
    if (zustand !== "laedt") return;
    if (s.bereit) {
      ausCode = null;
      meldungAus();
      zustandSetzen("bereit");
      restZeigen();
    } else {
      ausSetzen(s.code ?? "nicht_eingerichtet", s.meldung);
    }
  };

  function statusNeu(): void {
    meldungAus();
    zustandSetzen("laedt");
    void kiStatus(true).then(statusAnwenden);
  }

  const nochmal = () => {
    if (optionen.nochmal) optionen.nochmal();
    else formular.requestSubmit(ersterStart() ?? undefined);
  };

  async function fehlerZeigen(f: KiFehler): Promise<void> {
    const messung = fehlerMessung(f);
    if (messung) nutzung(bereich, messung.aktion, { detail: messung.detail });
    const melden = (m: Meldung, zustandNeu: DemoZustand = "fehler") => {
      zustandSetzen(zustandNeu);
      meldungZeigen(ort, m);
      ansagen(f.satz, { panel });
    };
    switch (f.code) {
      case "abgebrochen":
        // Kein Fehlerklang: Besucher haben es selbst so gewollt
        zustandSetzen("fehler", RUECKFALL.abgebrochen);
        ansagen(RUECKFALL.abgebrochen, { panel });
        return;
      case "aus":
      case "nicht_eingerichtet":
      case "budget":
        spiele("stopp");
        ausSetzen(f.code, f.satz, true);
        ansagen(f.satz, { panel });
        return;
      case "limit": {
        spiele("stopp");
        // „limit“ heißt Tagesgrenze, Versuchsdrossel oder globale Grenze; der Status sagt, ob heute noch etwas geht
        const s = await kiStatus(true);
        const stand = s.demos[optionen.demo];
        const aufgebraucht = !s.bereit || !stand || stand.rest <= 0;
        if (aufgebraucht) restSetzen(optionen.demo, 0);
        melden(
          {
            art: "fehler",
            satz: f.satz,
            knoepfe: aufgebraucht ? [] : [{ text: AUSWEGE.nochmal, aktion: nochmal }],
            links: [AUSWEG_CHECK, AUSWEG_KONTAKT],
          },
          aufgebraucht ? "gesperrt" : "fehler",
        );
        return;
      }
      case "ungueltig":
      case "zu_gross": {
        spiele("ding");
        melden({ art: "warnung", satz: f.satz });
        const feld = optionen.feldBeiFehler?.(f) ?? null;
        if (feld) {
          markiert = feld;
          feld.setAttribute("aria-invalid", "true");
          feld.focus();
        }
        return;
      }
      case "sicherheit":
        spiele("stopp");
        melden({ art: "fehler", satz: f.satz, knoepfe: [{ text: AUSWEGE.neuLaden, aktion: () => window.location.reload() }] });
        return;
      case "abgelehnt":
      case "herkunft":
      case "sitzung":
        // Dieselbe Eingabe noch einmal hilft hier nicht; der Probeanruf bietet bei „sitzung“ einen neuen Anruf an
        spiele("stopp");
        melden({ art: "fehler", satz: f.satz });
        return;
      default:
        spiele("stopp");
        melden({ art: "fehler", satz: f.satz, knoepfe: [{ text: AUSWEGE.nochmal, aktion: nochmal }] });
    }
  }

  async function lauf(body: Record<string, unknown>, r: LaufRueckrufe = {}, o: { turnstile?: boolean } = {}): Promise<LaufErgebnis> {
    if (!kannStarten()) {
      return { ok: false, fehler: { code: "abgebrochen", satz: "", status: null, quelle: "browser" } };
    }
    offeneFrage?.(false);
    offeneFrage = null;
    meldungAus();
    markierungLoesen();
    const eigenerAbbruch = new AbortController();
    abbruch = eigenerAbbruch;
    const ergebnis = await kiLauf(optionen.demo, body, {
      signal: eigenerAbbruch.signal,
      formular: o.turnstile === false ? null : formular,
      beiPhase: (phase) => zustandSetzen(phase === "prueft" ? "prueft" : "laeuft"),
      beiEreignis: (e) => {
        if (e.art === "start") r.beiStart?.(e.start);
        else if (e.art === "stand") r.beiStand?.(e.teil);
        else r.beiNeu?.();
      },
    });
    abbruch = null;
    if (ergebnis.ok) {
      const ms = ergebnis.fertig.dauerMs ?? performance.now() - laufBeginn;
      zustandSetzen("fertig", (optionen.fertigText ?? fertigStandard)(sekunden(ms)));
      return ergebnis;
    }
    await fehlerZeigen(ergebnis.fehler);
    return ergebnis;
  }

  function eigenenTextPruefen(text: string, feld?: HTMLElement | null): Promise<boolean> {
    if (!kontaktdatenGefunden(text)) return Promise.resolve(true);
    offeneFrage?.(false);
    const satz = HINWEISE.kontaktdaten.frage;
    return new Promise<boolean>((weiter) => {
      const antworten = (ja: boolean) => {
        if (offeneFrage !== antworten) return;
        offeneFrage = null;
        meldungVerbergen(ort, ja ? ersterStart() : (feld ?? ersterStart()));
        weiter(ja);
      };
      offeneFrage = antworten;
      meldungZeigen(
        ort,
        {
          art: "warnung",
          satz,
          knoepfe: [
            { text: HINWEISE.kontaktdaten.trotzdem, aktion: () => antworten(true) },
            { text: HINWEISE.kontaktdaten.aendern, voll: true, aktion: () => antworten(false) },
          ],
        },
        { fokus: true },
      );
      ansagen(satz, { panel });
    });
  }

  // Nie wirklich absenden (ohne action ginge es an die Seite selbst); außerhalb von „bereit“ gar nicht weiterreichen.
  // Capture am Formular: läuft vor dem Handler des Programms.
  formular.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      if (!kannStarten()) event.stopImmediatePropagation();
    },
    { capture: true },
  );
  formular.addEventListener("input", (event) => {
    const feld = event.target;
    if (feld instanceof HTMLElement && feld.getAttribute("aria-invalid") === "true") {
      feld.removeAttribute("aria-invalid");
      if (markiert === feld) markiert = null;
    }
  });
  anhaltenKnopf?.addEventListener("click", () => abbruch?.abort());

  turnstileVorbereiten(formular);
  // Safari fokussiert Knöpfe beim Klick nicht: Ohne focusin lüde die Prüfung erst beim Absenden
  formular.addEventListener("pointerdown", () => {
    if (turnstileAngestossen || zustand === "aus" || zustand === "laedt") return;
    turnstileAngestossen = true;
    void turnstileToken(formular);
  });

  // Einmal je Aufruf melden, dass jemand eine ausgeschaltete Demo bedienen wollte
  const nichtVerfuegbar = () => {
    if (zustand !== "aus" || nichtVerfuegbarGemeldet || ausCode === "nicht_erreichbar" || ausCode === null) return;
    nichtVerfuegbarGemeldet = true;
    nutzung(bereich, "nicht verfügbar", { detail: ausCode === "budget" ? "pause" : "aus" });
  };
  panel.addEventListener("pointerdown", nichtVerfuegbar);
  panel.addEventListener("focusin", nichtVerfuegbar);

  zustandSetzen("laedt");
  void kiStatus().then(statusAnwenden);

  return {
    panel,
    formular,
    ausgang,
    zustand: () => zustand,
    kannStarten,
    lauf,
    anhalten: () => abbruch?.abort(),
    stand: standSetzen,
    ansagen: (text, vonKi = false) => ansagen(text, { panel, vonKi }),
    eigenenTextPruefen,
    meldung: (m, o = {}) => (m ? meldungZeigen(ort, m, o) : meldungAus()),
  };
}
