/* Stimme des Probeanrufs (Abschnitt 07) ---------------------------------------------------------------------
   Ist sie beim Dienst eingerichtet, spricht der Telefonassistent mit einer künstlich erzeugten Stimme statt mit der
   Computerstimme des Geräts. Das MP3 erzeugt ein externer Sprachdienst im Auftrag des Dienstes; dessen Schlüssel
   liegt nur dort. Die Seite fragt nie den Sprachdienst, sondern nur den eigenen Dienst:
   - GET {kiUrl}/telefon/begruessung?variante=<betrieb>-<variante> liefert die feste Begrüßung (beim Dienst einmal
     erzeugt und als Datei vorrätig, ohne Angaben von Besuchern);
   - POST {kiUrl}/telefon/stimme mit { stimme } liefert die Antwort eines Zugs. Das Token kommt mit event: fertig,
     gilt kurz und nur für diesen Zug; fremden Text nimmt der Dienst nicht an.
   Gespielt wird über den AudioContext der Seite (klang.ts): So verstummt die Stimme mit „Ton aus“ (bis der Ton
   zurückkommt, ruft sprache.ts hier nichts auf), und iOS spielt, weil der Ton-Schalter bzw. „Antworten vorlesen“ den
   Kontext in einem Klick angelegt hat. Eine Wiedergabe zur Zeit; Stoppen bricht auch den Abruf ab. Scheitert etwas
   (kein 200, kein MP3, Zeitlimit, kein Kontext), meldet stimmeAbspielen() das dem Aufrufer, und der liest mit der
   Computerstimme vor; Besucher sehen dazu keine Fehlermeldung.
   Nichts davon geht in die Messung oder in einen Browser-Speicher; eine schon geladene Begrüßung bleibt nur bis zum
   Neuladen der Seite im Arbeitsspeicher. */

import { audioKontext } from "../klang";
import type { BetriebId, Variante } from "../../data/ki-demos";
import { kiZiel } from "./verbindung";

/** Holt ein MP3 beim Dienst; abgebrochen wird über das Signal */
export type StimmeAbruf = (signal: AbortSignal) => Promise<Response>;

/** gesprochen: bis zum Ende gespielt; abgebrochen: gestoppt oder ersetzt; gescheitert: der Aufrufer liest selbst */
export type StimmeErgebnis = "gesprochen" | "abgebrochen" | "gescheitert";

// Bis das MP3 ganz da ist: Der Dienst wartet höchstens 15 s auf den Sprachdienst, dazu kommt die Übertragung
const LADEN_MS = 20_000;
// So lange darf ein angehaltener Kontext zum Weiterlaufen brauchen; danach spricht lieber die Computerstimme
const FORTSETZEN_MS = 400;
// Etwas leiser als geliefert: Sprachdienste liefern viel lauter als die Klänge der Seite (klang-rezepte.ts)
const PEGEL = 0.7;

const OHNE = { credentials: "omit", cache: "no-store" } as const satisfies RequestInit;

/** Die feste Begrüßung des Betriebs in der Variante, die beim Abheben gilt („haustechnik-offen“ usw.) */
export const begruessungAbruf =
  (betrieb: BetriebId, variante: Variante): StimmeAbruf =>
  (signal) =>
    fetch(`${kiZiel()}/telefon/begruessung?variante=${betrieb}-${variante}`, { ...OHNE, signal });

/** Die Antwort eines Zugs, zum Token aus event: fertig */
export const antwortAbruf =
  (token: string): StimmeAbruf =>
  (signal) =>
    fetch(`${kiZiel()}/telefon/stimme`, {
      ...OHNE,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stimme: token }),
      signal,
    });

interface Wiedergabe {
  abbruch: AbortController;
  quelle: AudioBufferSourceNode | null;
  laut: GainNode | null;
}

let laufend: Wiedergabe | null = null;
// Fertig entpackte Begrüßungen dieses Seitenaufrufs (je Betrieb und Variante), damit „Noch ein Anruf“ nicht neu lädt
const vorrat = new Map<string, AudioBuffer>();

/** Lädt oder spielt gerade eine Stimme? */
export const stimmeLaeuft = (): boolean => laufend !== null;

/** Beendet die laufende Wiedergabe sofort, kurz ausgeblendet gegen das Knacken, und bricht einen Abruf ab */
export function stimmeStoppen(): void {
  const w = laufend;
  laufend = null;
  if (!w) return;
  w.abbruch.abort();
  const ctx = audioKontext();
  if (!ctx || !w.quelle || !w.laut) return;
  const t = ctx.currentTime;
  w.laut.gain.cancelScheduledValues(t);
  w.laut.gain.setTargetAtTime(0, t, 0.015);
  try {
    w.quelle.stop(t + 0.08);
  } catch {
    // schon zu Ende
  }
}

// Als Funktion, damit der Zustand nach einem await neu gelesen wird
const laeuft = (ctx: BaseAudioContext): boolean => ctx.state === "running";

// Ältere Safari-Versionen kennen nur die Rückrufe, kein Promise
function entpacken(ctx: AudioContext, daten: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((ok, nein) => {
    try {
      const versprechen = ctx.decodeAudioData(daten, ok, nein) as Promise<AudioBuffer> | undefined;
      versprechen?.then(ok, nein);
    } catch (f) {
      nein(f);
    }
  });
}

/**
 * Holt ein MP3 und spielt es; eine neue Wiedergabe ersetzt die laufende. Das Ergebnis kommt, wenn sie vorbei ist.
 * merken: Schlüssel, unter dem das entpackte MP3 bis zum Neuladen bereitliegt (nur für die feste Begrüßung).
 */
export async function stimmeAbspielen(abruf: StimmeAbruf, o: { merken?: string } = {}): Promise<StimmeErgebnis> {
  stimmeStoppen();
  const ctx = audioKontext();
  if (!ctx || !kiZiel()) return "gescheitert";
  const w: Wiedergabe = { abbruch: new AbortController(), quelle: null, laut: null };
  laufend = w;
  // Gestoppt oder ersetzt ist kein Fehler; alles andere (auch das eigene Zeitlimit) lässt den Aufrufer vorlesen
  const ende = (): StimmeErgebnis => {
    if (laufend !== w) return "abgebrochen";
    laufend = null;
    return "gescheitert";
  };
  const uhr = window.setTimeout(() => w.abbruch.abort(), LADEN_MS);
  let puffer: AudioBuffer;
  try {
    const gemerkt = o.merken ? vorrat.get(o.merken) : undefined;
    if (gemerkt) puffer = gemerkt;
    else {
      const antwort = await abruf(w.abbruch.signal);
      // Nur ein MP3 des Dienstes; eine Fehlerseite eines Proxys oder JSON mit code ist keins
      if (antwort.status !== 200 || !(antwort.headers.get("Content-Type") ?? "").startsWith("audio/")) {
        void antwort.body?.cancel().catch(() => {});
        return ende();
      }
      const daten = await antwort.arrayBuffer();
      if (laufend !== w) return "abgebrochen";
      puffer = await entpacken(ctx, daten);
      if (o.merken) vorrat.set(o.merken, puffer);
    }
    if (laufend !== w) return "abgebrochen";
    // Bei verborgener Seite spielt nichts, auch nicht im Kontext, den klang.ts dafür angehalten hat
    if (document.visibilityState !== "visible") {
      laufend = null;
      return "abgebrochen";
    }
    // Etwa gleich nach „Ton an“ oder nach einer Unterbrechung (iOS) läuft der Kontext noch nicht; ohne Weiterlaufen
    // bliebe die Stimme stumm
    if (!laeuft(ctx)) {
      await Promise.race([ctx.resume().catch(() => {}), new Promise((weiter) => window.setTimeout(weiter, FORTSETZEN_MS))]);
      if (!laeuft(ctx)) return ende();
    }
  } catch {
    return ende();
  } finally {
    window.clearTimeout(uhr);
  }
  if (laufend !== w) return "abgebrochen";

  const quelle = ctx.createBufferSource();
  quelle.buffer = puffer;
  const laut = ctx.createGain();
  laut.gain.value = PEGEL;
  quelle.connect(laut);
  laut.connect(ctx.destination);
  w.quelle = quelle;
  w.laut = laut;
  return new Promise((fertig) => {
    quelle.onended = () => {
      quelle.disconnect();
      laut.disconnect();
      if (laufend !== w) {
        fertig("abgebrochen");
        return;
      }
      laufend = null;
      fertig("gesprochen");
    };
    try {
      quelle.start();
    } catch {
      fertig(ende());
    }
  });
}
