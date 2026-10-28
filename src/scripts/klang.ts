/* Ton: Klänge im Stil der frühen 2000er ---------------------------------------------
   Fassade im Hauptbundle, ohne Synthese-Code. Der Ton ist standardmäßig aus und es wird nichts
   gespeichert: Nach einem Seitenwechsel ist er wieder aus. Erst ein Klick auf einen
   [data-ton-schalter] erzeugt den AudioContext, synchron in der Geste (sonst bleibt iOS stumm),
   und lädt das Klangwerk (klang-werk.ts) nach. Solange der Ton aus ist, ist spiele() ein No-op.
   Den Kontext nutzt auch die Stimme des Probeanrufs; sie spielt nur bei eingeschaltetem Ton.
   Kein Ton trägt allein eine Information: Was klingt, ist auch sichtbar und wird angesagt. */

import { nutzung } from "./nutzung";

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export type KlangId =
  | "anmelden" | "abmelden" | "erfolg" // Momente
  | "hinweis" | "achtung" | "frage" | "stopp" | "ding" | "freiton" | "roentgen" // Meldungen
  | "stempel" | "papier" | "drucker" | "scanner" | "hoerer" // Rückmeldungen
  | "plopp" | "klick" | "umschalten" | "taste" | "tippen"; // Mikro

export interface KlangOpt {
  pan?: number; // −1 bis 1
  db?: number; // Abschwächung in dB (positiv = leiser)
  in?: number; // Verzögerung in s, sampelgenau im Zeitplan des AudioContext
  variante?: string; // etwa "tief", "hoch", "rast", "kurz", "dunkel", "hell", "ab", "auf", "besetzt", bei "taste" die Ziffer
  anim?: boolean; // an eine Animation gekoppelt: bei reduzierter Bewegung die Kurzfassung
  einzeln?: boolean; // laufende und geplante Stimmen desselben Klangs vorher ausblenden
}

type Werk = typeof import("./klang-werk");

// Mindestabstand je Klang in ms: Was schneller kommt, fällt weg
const DROSSEL: Partial<Record<KlangId, number>> = {
  klick: 60,
  plopp: 80,
  papier: 80,
  hinweis: 150,
  achtung: 150,
  frage: 300,
  ding: 250,
  stopp: 600,
  erfolg: 3000,
  anmelden: 3000,
  abmelden: 3000,
  tippen: 90, // Streaming: höchstens etwa elf Anschläge je Sekunde
  taste: 60, // Wählfolge im Abstand von 110 ms passt durch
  hoerer: 250,
  freiton: 900,
  scanner: 800,
  roentgen: 1500,
};
// Ein Folgeklang innerhalb dieser Zeit (ms) kommt 3 dB leiser
const FOLGE = 400;
// So lange nach einem Klick auf den Nachtmodus (ms) gilt ein theme-Event als vom Nutzer
const MODUS_FENSTER = 600;
// Knöpfe, die ohne eigenen Klang leise klicken; dazu die Reiter der KI-Programme (Abschnitt 07), sonst bliebe der
// Wechsel stumm
const KNOEPFE =
  ".retro-knopf, .knopf, .taskleiste__feierabend, .taskleiste__eintrag, [data-berge-neu], .ki-wahl__reiter";
// Nie generisch klicken: Schalter mit eigenem Klang, Absenden (das submit-Event und damit „ding“
// kommt erst nach dem Klick), Kopieren (der Plopp kommt erst nach dem await), das stille
// Zurücksetzen, das hängende Fenster, dessen Klicks verpuffen, und Knöpfe, deren Klang erst
// nach einem await kommt (data-klang-still)
const STILL =
  "[data-ton-schalter], [data-modus-schalter], [type=submit], [data-kopiere], [data-anfrage-kopieren], " +
  "[data-meldungen-zurueck], .meldung--haengt, [data-klang-still]";
const LAUTSTAERKE = 0.6;

let an = false;
let ctx: AudioContext | null = null;
let werk: Werk | null = null;
let laden: Promise<Werk> | null = null;
const zuletzt = new Map<KlangId, number>();
let spezifisch = -Infinity; // Zeitpunkt des letzten spezifischen Klangs
let modusKlick = -Infinity; // Klick auf den Nachtmodus (Capture-Flagge)

export const tonIstAn = (): boolean => an;

/** Spielt einen Klang, wenn der Ton an ist. Sonst passiert nichts. */
export function spiele(id: KlangId, o: KlangOpt = {}): void {
  const jetzt = performance.now();
  // Schon der Wunsch zählt: Ein gedrosselter spezifischer Klang unterdrückt trotzdem den Klick.
  // Tippen nicht: Beim Streaming kommt es laufend, jeder Knopfklick in dieser Zeit bliebe sonst stumm
  if (id !== "klick" && id !== "tippen") spezifisch = jetzt;
  if (!an || !ctx || ctx.state !== "running" || document.visibilityState !== "visible") return;
  // Gedrosselt wird nach dem geplanten Beginn, sonst bliebe von einer Folge (in: i · 0,07) nur der erste
  const soll = jetzt + (o.in ?? 0) * 1000;
  const vorher = zuletzt.get(id) ?? -Infinity;
  const abstand = Math.abs(soll - vorher);
  if (abstand < (DROSSEL[id] ?? 0)) return;
  zuletzt.set(id, soll);
  // Die Kurzfassung bei reduzierter Bewegung wählt das Werk, es kennt die Varianten
  const opt: KlangOpt = { ...o, db: (o.db ?? 0) + (abstand < FOLGE ? 3 : 0) };
  if (werk) void werk.abspielen(id, opt).catch(() => {});
  else void laden?.then((m) => (an ? m.abspielen(id, opt) : undefined)).catch(() => {});
}

function stilleAbspielen(c: AudioContext): void {
  try {
    const q = c.createBufferSource();
    q.buffer = c.createBuffer(1, 1, c.sampleRate);
    q.connect(c.destination);
    q.start();
  } catch {
    // dann eben ohne
  }
}

/**
 * Der eine AudioContext der Seite, SYNCHRON in einer Geste angelegt bzw. fortgesetzt (sonst bleibt iOS stumm).
 * Schaltet den Ton nicht ein. Auch die Stimme des Probeanrufs (ki/stimme.ts) spielt darüber, aber nur bei
 * eingeschaltetem Ton; das Vorlesen setzt den Kontext in seinem Klick fort.
 */
export function kontextImKlick(): AudioContext | null {
  const Kontext = window.AudioContext ?? window.webkitAudioContext;
  if (!Kontext) return null;
  try {
    // Stummschalter respektieren, NIE "playback". Vor dem ersten Ton, danach legt WebKit sich fest
    const sitzung = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (sitzung) sitzung.type = "ambient";
  } catch {
    // egal
  }
  if (!ctx) {
    try {
      ctx = new Kontext({ latencyHint: "interactive" });
    } catch {
      return null;
    }
  }
  void ctx.resume().catch(() => {});
  stilleAbspielen(ctx);
  return ctx;
}

/** Der AudioContext, falls ihn schon eine Geste angelegt hat (Ton- oder Vorlesen-Schalter), sonst null */
export const audioKontext = (): AudioContext | null => ctx;

function einschalten(): void {
  // SYNCHRON in der Geste, vor jedem await, sonst bleibt iOS stumm
  const c = kontextImKlick();
  if (!c) return;
  const bereit = c.resume().catch(() => {});
  an = true;
  zustandSetzen();
  if (!laden) {
    laden = import("./klang-werk").then((m) => {
      m.vorbereiten(c, { lautstaerke: LAUTSTAERKE, nacht: document.documentElement.dataset.theme === "dark" });
      werk = m;
      return m;
    });
    // Schlägt das Nachladen fehl (offline, neuer Deploy), geht der Schalter wieder auf aus.
    // Der nächste Klick versucht es dann erneut.
    laden.catch(() => {
      laden = null;
      if (an) ausschalten();
    });
  }
  // Willkommensklang, sobald Werk und Kontext bereit sind; die übrigen rendert das Werk im Leerlauf
  void Promise.all([laden, bereit]).then(() => spiele("anmelden"), () => {});
}

function ausschalten(): void {
  // Still, mit kurzer Ausblendung
  an = false;
  zustandSetzen();
  werk?.ausblenden(0.08);
  window.setTimeout(() => {
    if (!an) void ctx?.suspend().catch(() => {});
  }, 120);
}

function zustandSetzen(): void {
  for (const b of document.querySelectorAll("[data-ton-schalter]")) b.setAttribute("aria-pressed", String(an));
  document.dispatchEvent(new CustomEvent<"an" | "aus">("klang:zustand", { detail: an ? "an" : "aus" }));
}

function fortsetzen(): void {
  if (an && ctx && ctx.state !== "running" && document.visibilityState === "visible") {
    void ctx.resume().catch(() => {});
  }
}

export function klangEinrichten(): void {
  // Die Schalter erst zeigen, wenn der Browser Ton erzeugen kann
  if (!(window.AudioContext ?? window.webkitAudioContext)) return;
  for (const b of document.querySelectorAll<HTMLElement>("[data-ton-schalter]")) b.hidden = false;
  zustandSetzen();

  document.addEventListener("click", (e) => {
    const schalter = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-ton-schalter]") : null;
    if (!schalter) return;
    // Ort aus dem Markup (data-ton-schalter="Telefonassistent"); die beiden alten Schalter tragen keinen
    nutzung("Ton", an ? "ausgeschaltet" : "eingeschaltet", {
      detail: schalter.dataset.tonSchalter || (schalter.classList.contains("taskleiste__ton") ? "Taskleiste" : "Kopf"),
    });
    (an ? ausschalten : einschalten)();
  });

  // Capture: läuft vor dem Klick-Handler in Base.astro, der ohne Übergang `theme` synchron feuert.
  // Während des Umrasterns trifft der Klick <html>, auch das zählt.
  window.addEventListener(
    "click",
    (e) => {
      const html = document.documentElement;
      const t = e.target;
      if (
        (t instanceof Element && t.closest("[data-modus-schalter]")) ||
        (t === html && html.classList.contains("modus-wechsel"))
      ) {
        modusKlick = performance.now();
      }
    },
    true,
  );

  document.addEventListener("theme", (e) => {
    const thema = (e as CustomEvent<"dark" | "light">).detail;
    werk?.nacht(thema === "dark");
    // Nur nach einem Klick, nie bei einer Änderung der Systemeinstellung oder bei pageshow
    if (performance.now() - modusKlick < MODUS_FENSTER) {
      modusKlick = -Infinity;
      spiele("umschalten", { variante: thema === "dark" ? "dunkel" : "hell", anim: true });
    }
  });

  document.addEventListener("beleg:feierabend", () => spiele("erfolg", { in: 0.25 }));

  // Generischer Knopfklick: window in der Bubble-Phase läuft nach allen spezifischen Handlern.
  // Hat einer davon gerade einen Klang gewünscht, bleibt der Klick still.
  window.addEventListener("click", (e) => {
    if (!an || performance.now() - spezifisch < 30) return;
    const t = e.target;
    if (!(t instanceof Element) || t.closest(STILL)) return;
    if (t.closest(KNOEPFE)) spiele("klick");
  });

  // Verborgen hält der Kontext an, auch wenn ihn nur die Stimme des Probeanrufs angelegt hat; fortgesetzt wird nur
  // mit Ton, die Stimme setzt ihn selbst fort
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend().catch(() => {});
    else fortsetzen();
  });
  addEventListener("pagehide", () => {
    if (ctx?.state === "running") void ctx.suspend().catch(() => {});
  });
  addEventListener("pageshow", (e) => {
    if (e.persisted) fortsetzen();
  });
  // iOS „interrupted“ nach Anruf oder Siri: bei der nächsten Geste heilen. Bei Berührung gilt
  // erst pointerup als Nutzeraktivierung, pointerdown nur bei der Maus
  addEventListener("pointerdown", fortsetzen, true);
  addEventListener("pointerup", fortsetzen, true);
  addEventListener("keydown", fortsetzen, true);
}
