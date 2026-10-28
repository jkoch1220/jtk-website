/* Verbindung zu den KI-Demos (Abschnitt 07 „Ausprobieren“) ------------------------------------------------
   Spricht nur den Website-Dienst an: GET {kiUrl}/status und POST {kiUrl}/scanner | /roentgen | /telefon
   (Vertrag: website-dienst/API.md). Der Schlüssel für die KI liegt allein im Dienst.
   - Gesendet wird JSON per fetch, ohne Cookies, ohne Cache und ohne Aufruf-ID der Reichweitenmessung: So bleibt
     die KI-Nutzung von der Besuchsstatistik getrennt.
   - Die Antwort kommt als Server-Sent Events im Rumpf und wird mit getReader() und TextDecoder gelesen. Nie
     EventSource: Das kann kein POST, und Inhalte in der Adresse landeten in den Protokollen des Servers.
   - Fehler vor dem Stream (JSON { ok: false, code, fehler }) und im Stream (event: fehler) werden zu einem
     KiFehler mit Code und Satz. Verzweigt wird nach dem Code, nie nach dem Satz.
   - Drei Zeitlimits mit Grund, damit ein Anhalten durch Besucher von einer hängenden Leitung zu unterscheiden
     ist. Ein Turnstile-Token gilt nur einmal und wird nach jedem Senden zurückgesetzt, auch nach einem Abbruch.
   Nichts hiervon geht in die Messung oder in einen Browser-Speicher. */

import { turnstileToken, turnstileZuruecksetzen } from "../turnstile";
import { BROWSER_SAETZE, FEHLER_SAETZE, istKiFehlerCode, type KiFehlerCode } from "../../data/ki-demos";

export type DemoId = "scanner" | "roentgen" | "telefon";

export const DEMOS: readonly DemoId[] = ["scanner", "roentgen", "telefon"];

/** Bereich der Messung je Demo (nutzung.ts). Feste Namen, die Statistik führt sie über alle Module zusammen. */
export const MESSBEREICH = {
  scanner: "Auftrags-Scanner",
  roentgen: "Röntgenblick",
  telefon: "Telefonassistent",
} as const satisfies Record<DemoId, string>;

/* Unbekanntes JSON lesen, ohne any ------------------------------------------------------------------------
   Teilstände (event: stand) sind unvollständig: Felder fehlen oder sind noch leer. Was fehlt oder den falschen
   Typ hat, wird zum Ersatzwert, statt eine Ausnahme zu werfen. */

export const istObjekt = (wert: unknown): wert is Record<string, unknown> =>
  typeof wert === "object" && wert !== null && !Array.isArray(wert);

/** Feld eines Objekts als Objekt, sonst {} */
export function jsonObjekt(wert: unknown, feld: string): Record<string, unknown> {
  const inhalt = istObjekt(wert) ? wert[feld] : undefined;
  return istObjekt(inhalt) ? inhalt : {};
}

/** Feld als Zeichenkette, sonst "" */
export function jsonText(wert: unknown, feld: string): string {
  const inhalt = istObjekt(wert) ? wert[feld] : undefined;
  return typeof inhalt === "string" ? inhalt : "";
}

/** Feld als endliche Zahl, sonst null */
export function jsonZahl(wert: unknown, feld: string): number | null {
  const inhalt = istObjekt(wert) ? wert[feld] : undefined;
  return typeof inhalt === "number" && Number.isFinite(inhalt) ? inhalt : null;
}

/** Feld als Liste, sonst [] */
export function jsonListe(wert: unknown, feld: string): unknown[] {
  const inhalt = istObjekt(wert) ? wert[feld] : undefined;
  return Array.isArray(inhalt) ? inhalt : [];
}

/** Feld ist genau true */
export function jsonWahr(wert: unknown, feld: string): boolean {
  return istObjekt(wert) && wert[feld] === true;
}

function jsonLesen(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const ganzzahlOderNull = (wert: number | null): number | null => (wert === null ? null : Math.max(0, Math.round(wert)));

/* Fehler ----------------------------------------------------------------------------------------------- */

/** Codes des Dienstes (Vertrag: website-dienst/API.md; Liste in data/ki-demos.ts) */
export type DienstCode = KiFehlerCode;
/** Fälle, die nur der Browser kennt: kein Dienst hinter der Adresse, Stream abgerissen, angehalten, kiUrl leer */
export type BrowserCode = "nicht_erreichbar" | "abgerissen" | "abgebrochen" | "aus";
export type FehlerCode = DienstCode | BrowserCode;

const istDienstCode = istKiFehlerCode;

export interface KiFehler {
  code: FehlerCode;
  /** Satz für Besucher: der des Dienstes, sonst der Rückfall je Code. Immer nur als Text einsetzen. */
  satz: string;
  /** HTTP-Status einer Antwort ohne Stream, sonst null */
  status: number | null;
  /** dienst: abgelehnt vor dem Stream oder abgebrochen im Stream; browser: Netz, eigene Zeitlimits, Anhalten */
  quelle: "dienst" | "browser";
}

/** Rückfallsätze, falls der Dienst keinen schickt oder gar nicht erreichbar ist (Texte in data/ki-demos.ts) */
export const RUECKFALL: Record<FehlerCode, string> = {
  ...FEHLER_SAETZE,
  nicht_erreichbar: BROWSER_SAETZE.nichtErreichbar,
  abgerissen: BROWSER_SAETZE.abgerissen,
  abgebrochen: BROWSER_SAETZE.angehalten,
  aus: BROWSER_SAETZE.aus,
};

const fehler = (code: FehlerCode, quelle: KiFehler["quelle"] = "browser", status: number | null = null): KiFehler => ({
  code,
  satz: RUECKFALL[code],
  status,
  quelle,
});

// Ohne Code im Rumpf: aus dem Status schließen. 404 ohne Code kommt nicht von den KI-Routen (die nennen „sitzung“),
// sondern von einem Server, der /api/ki noch nicht kennt.
function codeAusStatus(status: number | null): FehlerCode {
  switch (status) {
    case 400:
      return "ungueltig";
    case 403:
      return "herkunft";
    case 413:
      return "zu_gross";
    case 429:
      return "limit";
    case 503:
      return "ueberlastet";
    case 404:
      return "nicht_erreichbar";
    default:
      return "ki_fehler";
  }
}

/** Fehler aus einem JSON-Rumpf (vor dem Stream) oder aus event: fehler (status null) */
function fehlerAusDaten(daten: unknown, status: number | null): KiFehler {
  // Nur ein Rumpf nach dem Vertrag ist ein Satz des Dienstes; eine Fehlerseite eines Proxys ist es nicht
  const vomDienst = istObjekt(daten) && (istDienstCode(daten.code) || daten.ok === false || status === null);
  if (!vomDienst) return fehler("nicht_erreichbar", "browser", status);
  const code: FehlerCode = istDienstCode(daten.code) ? daten.code : status === null ? "ki_fehler" : codeAusStatus(status);
  if (code === "nicht_erreichbar") return fehler(code, "browser", status);
  // Defensiv beide Feldnamen: Anfrage schreibt „fehler“, die Termine „error“
  const satz = (jsonText(daten, "fehler") || jsonText(daten, "error")).trim().slice(0, 400);
  return { code, satz: satz || RUECKFALL[code], status, quelle: "dienst" };
}

/** Feste Aktion der Messung bei einem Fehler: vor dem Stream abgelehnt, im Stream abgebrochen, Verbindung gescheitert */
export type FehlerAktion = `vom Dienst abgelehnt (${number})` | "vom Dienst abgebrochen" | "Verbindung gescheitert";

// Feste Wörter für detail, nie der Satz (der könnte sich ändern und gehört nicht in die Messung)
const MESS_DETAIL: Record<FehlerCode, string> = {
  herkunft: "Herkunft",
  nicht_eingerichtet: "nicht eingerichtet",
  budget: "Budget",
  ungueltig: "Eingabe",
  zu_gross: "zu groß",
  sicherheit: "Sicherheitsprüfung",
  sicherheit_nicht_erreichbar: "Sicherheitsprüfung nicht erreichbar",
  limit: "Limit",
  ueberlastet: "überlastet",
  sitzung: "Sitzung",
  zeit: "Zeitlimit",
  abgelehnt: "abgelehnt",
  unvollstaendig: "unvollständig",
  ki_fehler: "KI-Fehler",
  nicht_erreichbar: "Netz",
  abgerissen: "Netz",
  abgebrochen: "abgebrochen",
  aus: "aus",
};

/** Aktion und detail für nutzung() zu einem Fehler; null, wenn nichts gesendet wurde (kiUrl leer) */
export function fehlerMessung(f: KiFehler): { aktion: FehlerAktion; detail: string } | null {
  if (f.code === "aus") return null;
  const detail = MESS_DETAIL[f.code];
  if (f.quelle === "dienst" && f.status !== null) return { aktion: `vom Dienst abgelehnt (${f.status})`, detail };
  if (f.quelle === "dienst") return { aktion: "vom Dienst abgebrochen", detail };
  return { aktion: "Verbindung gescheitert", detail };
}

/* Adresse ---------------------------------------------------------------------------------------------- */

let basis: string | null = null;

/** Basisadresse aus data-ziel des Abschnitts (kiUrl aus data/kontakt.ts), ohne Schrägstrich am Ende; "" = aus */
export function kiZiel(): string {
  basis ??= (document.querySelector<HTMLElement>("[data-ki-labor]")?.dataset.ziel ?? "").trim().replace(/\/+$/, "");
  return basis;
}

/* Restliche Durchläufe ------------------------------------------------------------------------------------
   Eine Quelle für alle Anzeigen: Der Status füllt sie, jeder Lauf aktualisiert sie (start, fertig, limit). */

export interface DemoRest {
  rest: number;
  limit: number;
}

type RestBeobachter = (demo: DemoId, stand: DemoRest) => void;

const reste = new Map<DemoId, DemoRest>();
const restBeobachter = new Set<RestBeobachter>();

export function restVon(demo: DemoId): DemoRest | null {
  return reste.get(demo) ?? null;
}

/** Meldet jede Änderung; gibt eine Funktion zum Abmelden zurück */
export function restBeobachten(beobachter: RestBeobachter): () => void {
  restBeobachter.add(beobachter);
  return () => restBeobachter.delete(beobachter);
}

export function restSetzen(demo: DemoId, rest: number | null, limit?: number | null): void {
  if (rest === null) return;
  const bisher = reste.get(demo);
  const stand: DemoRest = { rest: Math.max(0, Math.round(rest)), limit: limit ?? bisher?.limit ?? Math.max(0, Math.round(rest)) };
  if (bisher && bisher.rest === stand.rest && bisher.limit === stand.limit) return;
  reste.set(demo, stand);
  for (const b of restBeobachter) {
    try {
      b(demo, stand);
    } catch {
      // Eine Anzeige weniger, der Lauf geht weiter
    }
  }
}

/* Status --------------------------------------------------------------------------------------------- */

export interface KiStatus {
  bereit: boolean;
  /** Warum nicht bereit; null, wenn bereit */
  code: "nicht_eingerichtet" | "budget" | "nicht_erreichbar" | "aus" | null;
  /** Satz für Besucher, wenn nicht bereit; sonst "" */
  meldung: string;
  /** Dienst im Attrappenmodus (nur Entwicklung): Die Seite zeigt eine kleine Marke „Attrappe“ */
  attrappe: boolean;
  /** Rest und Grenze je Demo, nur wenn bereit */
  demos: Partial<Record<DemoId, DemoRest>>;
  /** Höchstzahl der Züge eines Probeanrufs, falls der Dienst sie nennt */
  telefonZuege: number | null;
  /** Der Dienst kann die Antworten des Probeanrufs vertonen (eigene Stimme statt der Computerstimme des Geräts) */
  stimmeBereit: boolean;
}

// Wie die Terminbuchung (termin.ts): Wer länger wartet, sieht sonst ewig „Wird vorbereitet …“
const STATUS_ZEITLIMIT_MS = 8000;

let statusAnfrage: Promise<KiStatus> | null = null;

const nichtBereit = (code: Exclude<KiStatus["code"], null>, meldung: string = RUECKFALL[code]): KiStatus => ({
  bereit: false,
  code,
  meldung,
  attrappe: false,
  demos: {},
  telefonZuege: null,
  stimmeBereit: false,
});

async function statusLaden(): Promise<KiStatus> {
  const ziel = kiZiel();
  if (!ziel) return nichtBereit("aus");
  const abbruch = new AbortController();
  const uhr = window.setTimeout(() => abbruch.abort(), STATUS_ZEITLIMIT_MS);
  try {
    const antwort = await fetch(`${ziel}/status`, { credentials: "omit", cache: "no-store", signal: abbruch.signal });
    const daten: unknown = await antwort.json().catch(() => null);
    // Auch eine Ablehnung des Status (etwa seine Drossel) heißt: gerade nicht nutzbar
    if (!antwort.ok || !istObjekt(daten) || daten.ok !== true) return nichtBereit("nicht_erreichbar");
    const attrappe = daten.attrappe === true;
    if (daten.bereit !== true) {
      const code = daten.code === "budget" ? "budget" : "nicht_eingerichtet";
      return { ...nichtBereit(code, jsonText(daten, "meldung").trim().slice(0, 400) || RUECKFALL[code]), attrappe };
    }
    const demos: Partial<Record<DemoId, DemoRest>> = {};
    const alle = jsonObjekt(daten, "demos");
    for (const id of DEMOS) {
      const eintrag = jsonObjekt(alle, id);
      const rest = ganzzahlOderNull(jsonZahl(eintrag, "rest"));
      const limit = ganzzahlOderNull(jsonZahl(eintrag, "limit"));
      if (rest === null || limit === null) continue;
      demos[id] = { rest, limit };
      restSetzen(id, rest, limit);
    }
    const zuege = ganzzahlOderNull(jsonZahl(jsonObjekt(alle, "telefon"), "zuege"));
    const stimmeBereit = jsonWahr(jsonObjekt(daten, "stimme"), "bereit");
    return { bereit: true, code: null, meldung: "", attrappe, demos, telefonZuege: zuege, stimmeBereit };
  } catch {
    return nichtBereit("nicht_erreichbar");
  } finally {
    window.clearTimeout(uhr);
  }
}

/** Status der Demos, einmal je Seitenaufruf geladen; neu = true fragt erneut (nach „limit“, nach „Noch einmal“) */
export function kiStatus(neu = false): Promise<KiStatus> {
  if (!statusAnfrage || neu) statusAnfrage = statusLaden();
  return statusAnfrage;
}

/* Lauf ----------------------------------------------------------------------------------------------- */

export interface StartDaten {
  demo: string;
  /** Restliche Durchläufe (beim Probeanruf: Anrufe) nach diesem */
  rest: number | null;
  /** Probeanruf: Sitzungs-Token, nur beim ersten Zug; lebt nur im Speicher dieses Aufrufs */
  sitzung: string | null;
  /** Probeanruf: restliche Züge */
  zuegeRest: number | null;
}

export interface FertigDaten {
  /** Geprüftes, bereinigtes Ergebnis des Dienstes; maßgeblich, ersetzt jeden Teilstand */
  ergebnis: unknown;
  /** Rechnung des Dienstes (Scanner, Röntgenblick) oder null */
  rechnung: unknown;
  /** Gemessene Dauer im Dienst und bis zur ersten Ausgabe */
  dauerMs: number | null;
  ersteAusgabeMs: number | null;
  rest: number | null;
  zuegeRest: number | null;
  /** Probeanruf: Token für die vertonte Antwort dieses Zugs (kurz gültig, nur im Speicher), sonst null */
  stimme: string | null;
}

export type KiEreignis =
  | { art: "start"; start: StartDaten }
  /** Teilstand des Ergebnisses: nur zeichnen, nichts daran rechnen */
  | { art: "stand"; teil: unknown }
  /** Ein Ausweichmodell beginnt neu: die Vorschau verwerfen */
  | { art: "neu" };

export type LaufErgebnis = { ok: true; fertig: FertigDaten } | { ok: false; fehler: KiFehler };

export type LaufPhase = "prueft" | "sendet";

export interface LaufOptionen {
  /** Anhalten durch Besucher */
  signal?: AbortSignal;
  /** Formular mit [data-turnstile]: Token holen, mitsenden, danach zurücksetzen. Weglassen bei Folgezügen des
      Probeanrufs, die tragen die Sitzung statt eines Tokens. */
  formular?: HTMLFormElement | null;
  beiPhase?: (phase: LaufPhase) => void;
  beiEreignis?: (ereignis: KiEreignis) => void;
}

// Bis die Antwort beginnt: Der Dienst prüft vorher Turnstile (bis zu 8 s), Drossel und Budget
const ANTWORT_MS = 15_000;
// Stille im Stream: Der Dienst pingt alle 15 s; erst nach mehr als zwei ausgefallenen Pings aufgeben
const STILLE_MS = 35_000;
// Gesamt: Der Dienst bricht nach höchstens 55 s selbst ab und schickt dann event: fehler mit Satz. Wir warten
// etwas länger, damit sein Satz ankommt.
const GESAMT_MS = 70_000;

type Grund = "zeit" | "nutzer";

function startLesen(daten: unknown): StartDaten {
  return {
    demo: jsonText(daten, "demo"),
    rest: ganzzahlOderNull(jsonZahl(daten, "rest")),
    sitzung: jsonText(daten, "sitzung") || null,
    zuegeRest: ganzzahlOderNull(jsonZahl(daten, "zuegeRest")),
  };
}

function fertigLesen(daten: Record<string, unknown>): FertigDaten {
  const messung = jsonObjekt(daten, "messung");
  return {
    ergebnis: daten.ergebnis,
    rechnung: daten.rechnung ?? null,
    dauerMs: jsonZahl(messung, "dauerMs"),
    ersteAusgabeMs: jsonZahl(messung, "ersteAusgabeMs"),
    rest: ganzzahlOderNull(jsonZahl(daten, "rest")),
    zuegeRest: ganzzahlOderNull(jsonZahl(daten, "zuegeRest")),
    stimme: jsonText(daten, "stimme") || null,
  };
}

/** Ein Block bis zur Leerzeile: event und data (mehrere data-Zeilen mit \n verbunden); Kommentare (: ping) fallen weg */
function blockLesen(block: string): { event: string; data: string } | null {
  let event = "message";
  const daten: string[] = [];
  for (const zeile of block.split("\n")) {
    if (!zeile || zeile.startsWith(":")) continue;
    const trenner = zeile.indexOf(":");
    const feld = trenner < 0 ? zeile : zeile.slice(0, trenner);
    let wert = trenner < 0 ? "" : zeile.slice(trenner + 1);
    if (wert.startsWith(" ")) wert = wert.slice(1);
    if (feld === "event") event = wert;
    else if (feld === "data") daten.push(wert);
  }
  return daten.length ? { event, data: daten.join("\n") } : null;
}

let rueckrufFehlerGemeldet = false;

function weitergeben(o: LaufOptionen, ereignis: KiEreignis): void {
  try {
    o.beiEreignis?.(ereignis);
  } catch (f) {
    // Ein Fehler beim Zeichnen eines Teilstands darf den Lauf nicht abbrechen: Das Ergebnis kommt mit fertig
    // noch einmal vollständig. Einmal je Aufruf ins Protokoll der Entwicklerwerkzeuge, ohne Inhalte.
    if (!rueckrufFehlerGemeldet) {
      rueckrufFehlerGemeldet = true;
      console.error("KI-Demo: Teilstand nicht gezeichnet", f instanceof Error ? f.name : "");
    }
  }
}

/** Verarbeitet einen Block; liefert das Ende des Laufs (fertig oder fehler) oder null zum Weiterlesen */
function blockVerarbeiten(block: string, demo: DemoId, o: LaufOptionen): LaufErgebnis | null {
  const ereignis = blockLesen(block);
  if (!ereignis) return null;
  const daten = jsonLesen(ereignis.data);
  switch (ereignis.event) {
    case "start": {
      const start = startLesen(daten);
      restSetzen(demo, start.rest);
      weitergeben(o, { art: "start", start });
      return null;
    }
    case "stand":
      if (istObjekt(daten) && "teil" in daten) weitergeben(o, { art: "stand", teil: daten.teil });
      return null;
    case "neu":
      weitergeben(o, { art: "neu" });
      return null;
    case "fertig": {
      if (!istObjekt(daten)) return { ok: false, fehler: fehler("unvollstaendig", "dienst") };
      const fertig = fertigLesen(daten);
      restSetzen(demo, fertig.rest);
      return { ok: true, fertig };
    }
    case "fehler":
      return { ok: false, fehler: fehlerAusDaten(istObjekt(daten) ? daten : {}, null) };
    default:
      return null;
  }
}

// Zeilenenden vereinheitlichen. Ein \r ganz am Ende bleibt stehen, bis das nächste Stück zeigt, ob ein \n folgt;
// sonst entstünde aus einem geteilten \r\n eine falsche Leerzeile.
const zeilenenden = (text: string) => text.replace(/\r\n|\r(?!$)/g, "\n");

async function stromLesen(rumpf: ReadableStream<Uint8Array>, demo: DemoId, abbruch: AbortController, o: LaufOptionen): Promise<LaufErgebnis> {
  const leser = rumpf.getReader();
  const decoder = new TextDecoder();
  let puffer = "";
  let stille = 0;
  const stilleNeu = () => {
    window.clearTimeout(stille);
    stille = window.setTimeout(() => abbruch.abort("zeit" satisfies Grund), STILLE_MS);
  };
  // Ein hängendes read() endet sofort, wenn der Lauf abgebrochen wird
  const beenden = () => void leser.cancel().catch(() => {});
  abbruch.signal.addEventListener("abort", beenden, { once: true });
  try {
    stilleNeu();
    for (;;) {
      const { value, done } = await leser.read();
      if (done) break;
      // Jedes Stück zählt als Lebenszeichen, auch „: ping“
      stilleNeu();
      puffer = zeilenenden(puffer + decoder.decode(value, { stream: true }));
      // Mehrere Ereignisse in einem Stück sind normal, ein Proxy kann auch alles auf einmal liefern
      for (let ende = puffer.indexOf("\n\n"); ende >= 0; ende = puffer.indexOf("\n\n")) {
        const block = puffer.slice(0, ende);
        puffer = puffer.slice(ende + 2);
        const schluss = blockVerarbeiten(block, demo, o);
        if (schluss) return schluss;
      }
    }
    // Ein letzter Block ohne abschließende Leerzeile zählt noch
    const schluss = blockVerarbeiten(zeilenenden(puffer + decoder.decode()).replace(/\r$/, ""), demo, o);
    return schluss ?? { ok: false, fehler: fehler("abgerissen") };
  } finally {
    window.clearTimeout(stille);
    abbruch.signal.removeEventListener("abort", beenden);
    void leser.cancel().catch(() => {});
  }
}

/**
 * Ein Durchlauf: POST an {kiUrl}/{pfad}, Stream lesen, Ereignisse weitergeben. Wirft nie; das Ende steht im
 * Ergebnis (ok mit fertig oder Fehler mit Code und Satz). Aktualisiert den Rest (start, fertig, limit).
 */
export async function kiLauf(pfad: DemoId, body: Record<string, unknown>, o: LaufOptionen = {}): Promise<LaufErgebnis> {
  const ziel = kiZiel();
  if (!ziel) return { ok: false, fehler: fehler("aus") };
  if (o.signal?.aborted) return { ok: false, fehler: fehler("abgebrochen") };

  const abbruch = new AbortController();
  const vomBesucher = () => abbruch.abort("nutzer" satisfies Grund);
  o.signal?.addEventListener("abort", vomBesucher, { once: true });
  const uhren: number[] = [];
  const formular = o.formular ?? null;
  let token = "";
  let gesendet = false;

  try {
    if (formular) {
      o.beiPhase?.("prueft");
      token = await turnstileToken(formular);
      // Angehalten, während die Prüfung lief: nichts senden, das ungenutzte Token bleibt gültig
      if (abbruch.signal.aborted) return { ok: false, fehler: fehler("abgebrochen") };
    }
    o.beiPhase?.("sendet");
    uhren.push(window.setTimeout(() => abbruch.abort("zeit" satisfies Grund), GESAMT_MS));
    const antwortUhr = window.setTimeout(() => abbruch.abort("zeit" satisfies Grund), ANTWORT_MS);
    uhren.push(antwortUhr);
    gesendet = true;
    const antwort = await fetch(`${ziel}/${pfad}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formular ? { ...body, turnstile: token } : body),
      credentials: "omit",
      cache: "no-store",
      signal: abbruch.signal,
    });
    window.clearTimeout(antwortUhr);

    if (!antwort.ok) {
      const f = fehlerAusDaten(await antwort.json().catch(() => null), antwort.status);
      if (f.code === "limit") restSetzen(pfad, 0);
      return { ok: false, fehler: f };
    }
    // Liefert ein Proxy eine eigene Seite statt des Dienstes, ist die Demo nicht erreichbar
    const art = antwort.headers.get("Content-Type") ?? "";
    if (!antwort.body || !art.includes("text/event-stream")) {
      void antwort.body?.cancel().catch(() => {});
      return { ok: false, fehler: fehler("nicht_erreichbar", "browser", antwort.status) };
    }
    const ergebnis = await stromLesen(antwort.body, pfad, abbruch, o);
    // Lief der Stream bis zum Abbruch, entscheidet der Grund über den Code
    if (!ergebnis.ok && abbruch.signal.aborted && ergebnis.fehler.code === "abgerissen") {
      return { ok: false, fehler: fehler(abbruch.signal.reason === "zeit" ? "zeit" : "abgebrochen") };
    }
    return ergebnis;
  } catch {
    if (abbruch.signal.aborted) {
      return { ok: false, fehler: fehler(abbruch.signal.reason === "zeit" ? "zeit" : "abgebrochen") };
    }
    return { ok: false, fehler: fehler("nicht_erreichbar") };
  } finally {
    uhren.forEach((uhr) => window.clearTimeout(uhr));
    o.signal?.removeEventListener("abort", vomBesucher);
    // Ein Token gilt nur einmal: Der Dienst hat es beim Prüfen verbraucht, auch wenn danach etwas scheiterte
    if (gesendet && formular && token) turnstileZuruecksetzen(formular);
  }
}
