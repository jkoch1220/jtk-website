/* Klangwerk: Synthese, Rendern und Wiedergabe ------------------------------------------
   Wird erst nach „Ton an“ per import() aus klang.ts nachgeladen, ohne DOM-Zugriff. Jeder Klang
   entsteht aus einem Rezept (klang-rezepte.ts) einmal in einem OfflineAudioContext mit 22,05 kHz:
   nichts über 11 kHz, das ergibt den warmen, matten Klang jener Zeit. Danach wird er auf seinen
   Zielpegel gebracht und als Puffer wiederverwendet.

   Laufzeit: Quelle (Rate ± Cent) → Gain (± dB) → Panner → Bus (moment | meldung | mikro)
   → Nachtfilter → Master → Kompressor → weicher Begrenzer → Ausgang.
   Höchstens vier Stimmen gleichzeitig, ein Moment-Klang duckt die beiden anderen Busse. */

import type { KlangId, KlangOpt } from "./klang";
import { IDS, REZEPTE, type Ebene, type Hall } from "./klang-rezepte";

declare global {
  interface Window {
    webkitOfflineAudioContext?: typeof OfflineAudioContext;
  }
}

/** Abtastrate fürs Vorrendern */
const RATE = 22050;
const MAX_STIMMEN = 4;
const EBENEN: Ebene[] = ["moment", "meldung", "mikro"];
// Kleine Abweichung je Wiedergabe, damit Wiederholungen nicht mechanisch klingen
const JITTER: Record<Ebene, { cent: number; db: number }> = {
  moment: { cent: 0, db: 0 },
  meldung: { cent: 5, db: 1 },
  mikro: { cent: 10, db: 1.5 },
};

/* Kleine Helfer ------------------------------------------------------------------ */

// Die Helfer und Bausteine sind Funktionsdeklarationen: klang-rezepte.ts importiert sie zurück,
// und so stehen sie schon bereit, bevor dieses Modul ausgewertet ist.
export function dbg(db: number): number {
  return Math.pow(10, db / 20);
}
const NOTE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Notenname in Hz (A4 = 440). Englisch: Bb = dt. B, Eb = dt. Es, Ab = dt. As */
export function hz(name: string): number {
  const m = /^([A-G])(b|#)?(-?\d)$/.exec(name);
  if (!m) throw new Error("Unbekannte Note: " + name);
  const midi = 12 * (Number(m[3]) + 1) + (NOTE[m[1]!] ?? 0) + (m[2] === "b" ? -1 : m[2] === "#" ? 1 : 0);
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// FNV-1a, damit jede Variante bei jedem Rendern gleich klingt
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// mulberry32: deterministischer Zufall je Rezept und Variante
function zufall(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Bausteine ------------------------------------------------------------------------
   Arbeiten auf dem Render-Kontext. Die Werkbank trägt, was alle brauchen: Kontext, Zufall,
   nutzbare Nyquist-Frequenz, Kanalzahl und einen Rauschpuffer. */

export interface Werkbank {
  c: BaseAudioContext;
  rng: () => number;
  nyq: number;
  kanaele: number;
  rausch: AudioBuffer;
}

export type Filter = { typ: BiquadFilterType; f: number; q?: number };

type Huelle = { an?: number; spitze?: number; halten?: number; tau?: number; weich?: boolean };

/** Knackfreie Hüllkurve: Anstieg ab 0 (linear oder weich), Halten, exponentielles Ausklingen.
    Gibt das Ende zurück (etwa −78 dB). */
export function huelle(
  p: AudioParam,
  t: number,
  { an = 0.004, spitze = 1, halten = 0, tau = 0.3, weich = false }: Huelle = {},
): number {
  p.setValueAtTime(0, 0);
  p.setValueAtTime(0, t);
  if (weich) p.setTargetAtTime(spitze, t, an / 3);
  else p.linearRampToValueAtTime(spitze, t + an);
  p.setTargetAtTime(0, t + an + halten, tau);
  return t + an + halten + tau * 9;
}

export function panZu(w: Werkbank, ziel: AudioNode, pan: number): AudioNode {
  if (!pan || w.kanaele < 2 || !("createStereoPanner" in w.c)) return ziel;
  const p = w.c.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  p.connect(ziel);
  return p;
}

type TeiltonOpt = {
  typ?: OscillatorType;
  db?: number;
  an?: number;
  halten?: number;
  tau?: number;
  cent?: number;
  pan?: number;
  weich?: boolean;
};

/** Einzelner Teilton mit Hüllkurve. Teiltöne nahe Nyquist fallen weg. */
export function teilton(
  w: Werkbank,
  ziel: AudioNode,
  f: number,
  t: number,
  { typ = "sine", db = 0, an = 0.004, halten = 0, tau = 0.3, cent = 0, pan = 0, weich = false }: TeiltonOpt = {},
): void {
  if (f >= w.nyq * 0.92) return;
  const c = w.c;
  const g = c.createGain();
  g.connect(panZu(w, ziel, pan));
  const ende = huelle(g.gain, t, { an, halten, tau, spitze: dbg(db), weich });
  const o = c.createOscillator();
  o.type = typ;
  o.frequency.value = f;
  o.detune.value = cent;
  o.connect(g);
  o.start(t);
  o.stop(ende);
}

type GlockeOpt = {
  v?: number;
  i0?: number;
  i1?: number;
  tIdx?: number;
  tau?: number;
  an?: number;
  db?: number;
  pan?: number;
  celesta?: number | null;
};

/** FM-Glocke (Träger : Modulator = 1 : v), der Index fällt exponentiell von i0 auf i1. Er wird so
    begrenzt, dass die starken oberen Seitenbänder unter 82 % der Nyquist-Frequenz bleiben. */
export function glocke(
  w: Werkbank,
  ziel: AudioNode,
  f: number,
  t: number,
  { v = 3.5, i0 = 2.4, i1 = 0.2, tIdx = 0.9, tau = 0.6, an = 0.003, db = 0, pan = 0, celesta = -18 }: GlockeOpt = {},
): void {
  const c = w.c;
  const fm = f * v;
  const grenze = Math.max(0.5, (w.nyq * 0.82 - f) / fm - 0.5);
  const a0 = Math.min(i0, grenze);
  const a1 = Math.max(Math.min(i1, a0), 0.002);
  const aus = panZu(w, ziel, pan);
  const mod = c.createOscillator();
  mod.frequency.value = fm;
  const idx = c.createGain();
  idx.gain.setValueAtTime(a0 * fm, t);
  idx.gain.exponentialRampToValueAtTime(a1 * fm, t + tIdx);
  const tr = c.createOscillator();
  tr.frequency.value = f;
  mod.connect(idx);
  idx.connect(tr.frequency);
  const amp = c.createGain();
  amp.connect(aus);
  const ende = huelle(amp.gain, t, { an, tau, spitze: dbg(db) });
  tr.connect(amp);
  tr.start(t);
  mod.start(t);
  tr.stop(ende);
  mod.stop(ende);
  if (celesta !== null) teilton(w, aus, f * 4, t, { db: db + celesta, an: 0.002, tau: tau * 0.35 });
}

type MarimbaOpt = { tau?: number; db?: number; pan?: number; oberton?: number; cent?: number; klick?: number };

/** Marimba: Grundton, kurzer 4. Teilton und Schlägel-Klick */
export function marimba(
  w: Werkbank,
  ziel: AudioNode,
  f: number,
  t: number,
  { tau = 0.22, db = 0, pan = 0, oberton = -10, cent = 0, klick = -18 }: MarimbaOpt = {},
): void {
  const aus = panZu(w, ziel, pan);
  teilton(w, aus, f, t, { db, an: 0.0025, tau, cent });
  teilton(w, aus, f * 4, t, { db: db + oberton, an: 0.0015, tau: tau * 0.3, cent });
  rausch(w, aus, t, {
    filter: [{ typ: "bandpass", f: 3000, q: 1.2 }],
    an: 0.0008,
    halten: 0.002,
    tau: 0.002,
    db: db + klick,
  });
}

type VibraphonOpt = { tau?: number; db?: number; pan?: number; am?: number; tiefe?: number };

/** Vibraphon: Grundton und 4f, weicher Schlägel, Tremolo per Amplitudenmodulation */
export function vibraphon(
  w: Werkbank,
  ziel: AudioNode,
  f: number,
  t: number,
  { tau = 0.32, db = 0, pan = 0, am = 5.5, tiefe = 0.18 }: VibraphonOpt = {},
): void {
  const c = w.c;
  const trem = c.createGain();
  trem.gain.value = 1 - tiefe / 2;
  trem.connect(panZu(w, ziel, pan));
  const lfo = c.createOscillator();
  lfo.frequency.value = am;
  const lg = c.createGain();
  lg.gain.value = tiefe / 2;
  lfo.connect(lg);
  lg.connect(trem.gain);
  lfo.start(t);
  lfo.stop(t + tau * 9);
  teilton(w, trem, f, t, { db, an: 0.006, tau });
  teilton(w, trem, f * 4, t, { db: db - 9, an: 0.004, tau: tau * 0.45 });
  rausch(w, trem, t, {
    filter: [{ typ: "bandpass", f: 2000, q: 1 }],
    an: 0.001,
    halten: 0.002,
    tau: 0.003,
    db: db - 26,
  });
}

type PadOpt = { an?: number; halten?: number; tau?: number; db?: number; lp?: number; pegel?: number[] };

/** Pad: je Note drei Sinus (0, +6, −6 Cent, im Stereo leicht verteilt) und der 2. Teilton,
    gemeinsamer Tiefpass, weicher Anstieg. Gibt das Ende zurück. */
export function pad(
  w: Werkbank,
  ziel: AudioNode,
  noten: number[],
  t: number,
  { an = 0.5, halten = 0.5, tau = 0.4, db = 0, lp = 2400, pegel = [] }: PadOpt = {},
): number {
  const c = w.c;
  const filt = c.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = lp;
  filt.Q.value = 0.5;
  filt.connect(ziel);
  const g = c.createGain();
  g.connect(filt);
  const ende = huelle(g.gain, t, { an, halten, tau, spitze: dbg(db) / Math.sqrt(noten.length), weich: true });
  const ziele = [g, panZu(w, g, -0.35), panZu(w, g, 0.35)];
  noten.forEach((f, i) => {
    const nd = pegel[i] ?? 0;
    [0, 6, -6].forEach((cent, k) => {
      const o = c.createOscillator();
      o.frequency.value = f;
      o.detune.value = cent + (w.rng() - 0.5) * 2;
      const og = c.createGain();
      og.gain.value = (dbg(nd) / 3) * (k === 0 ? 1.2 : 0.9);
      o.connect(og);
      og.connect(ziele[k]!);
      o.start(t);
      o.stop(ende);
    });
    if (f * 2 < w.nyq * 0.9) {
      const o2 = c.createOscillator();
      o2.frequency.value = f * 2;
      const g2 = c.createGain();
      g2.gain.value = dbg(nd - 16);
      o2.connect(g2);
      g2.connect(g);
      o2.start(t);
      o2.stop(ende);
    }
  });
  return ende;
}

type RauschOpt = { filter?: Filter[]; an?: number; halten?: number; tau?: number; db?: number; pan?: number };

/** Rauschimpuls durch eine Filterkette (in Reihe) */
export function rausch(
  w: Werkbank,
  ziel: AudioNode,
  t: number,
  { filter = [], an = 0.001, halten = 0, tau = 0.01, db = 0, pan = 0 }: RauschOpt = {},
): void {
  const c = w.c;
  const q = c.createBufferSource();
  q.buffer = w.rausch;
  // Lange Rauschflächen (Grundrauschen des Druckers) dürfen nicht am Pufferende hart abreißen
  q.loop = true;
  let knoten: AudioNode = q;
  for (const fl of filter) {
    const b = c.createBiquadFilter();
    b.type = fl.typ;
    b.frequency.value = Math.min(fl.f, w.nyq * 0.95);
    b.Q.value = fl.q ?? 0.707;
    knoten.connect(b);
    knoten = b;
  }
  const g = c.createGain();
  knoten.connect(g);
  g.connect(panZu(w, ziel, pan));
  const ende = huelle(g.gain, t, { an, halten, tau, spitze: dbg(db) });
  q.start(t, w.rng() * (w.rausch.duration - 0.6));
  q.stop(ende);
}

function rauschPuffer(c: BaseAudioContext, rng: () => number): AudioBuffer {
  const n = Math.ceil(2 * c.sampleRate);
  const b = c.createBuffer(1, n, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = rng() * 2 - 1;
  return b;
}

/** Frequenzverlauf [Zeit, Hz] auf mehrere Parameter anwenden, je mit eigenem Faktor (etwa 1 und 2) */
export function gleiten(params: [AudioParam, number][], t: number, punkte: [number, number][]): void {
  const [start, ...rest] = punkte;
  if (!start) return;
  for (const [p, faktor] of params) {
    p.setValueAtTime(start[1] * faktor, t);
    for (const [z, f] of rest) p.exponentialRampToValueAtTime(f * faktor, t + z);
  }
}

/** Klick-Klack aus zwei Rauschimpulsen, für „klick“ und „umschalten“ */
export function klickBauen(w: Werkbank, a: AudioNode, variante: string, t: number): void {
  const bp = variante === "rast" ? 1800 : variante === "tief" ? 600 : 900;
  const impuls = (ti: number, db: number) => {
    rausch(w, a, ti, { filter: [{ typ: "bandpass", f: bp, q: 3 }], an: 0.0003, halten: 0.0025, tau: 0.0012, db });
    rausch(w, a, ti, {
      filter: [{ typ: "highpass", f: 3000, q: 0.7 }],
      an: 0.0003,
      halten: 0.0015,
      tau: 0.0012,
      db: db - 10,
    });
  };
  impuls(t, 0);
  if (variante !== "rast") impuls(t + 0.021, -4);
}

/* Hall und Ausgangskette im Render-Kontext ------------------------------------------ */

/** Erzeugter Faltungshall: dekorreliertes Rauschen mit exponentiellem Abfall (−60 dB bei T60),
    12 ms Vorverzögerung, ein paar frühe Reflexionen und ein schließender Tiefpass (7 kHz auf
    900 Hz), damit die Höhen schneller abklingen. */
function hallIR(c: BaseAudioContext, t60: number, rng: () => number, kanaele: number): AudioBuffer {
  const sr = c.sampleRate;
  const n = Math.ceil(t60 * sr);
  const k = kanaele >= 2 ? 2 : 1;
  const ir = c.createBuffer(k, n, sr);
  const vor = Math.round(0.012 * sr);
  const einlauf = Math.round(0.004 * sr);
  for (let ch = 0; ch < k; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let s = vor; s < n; s++) {
      const t = s / sr;
      const fc = 900 + 6100 * (1 - Math.min(1, t / t60));
      const a = 1 - Math.exp((-2 * Math.PI * fc) / sr);
      lp += a * (rng() * 2 - 1 - lp);
      const anstieg = Math.min(1, (s - vor) / einlauf);
      d[s] = lp * Math.exp((-6.9 * t) / t60) * anstieg;
    }
    for (let r = 0; r < 6; r++) {
      const s = Math.round((0.012 + rng() * 0.06) * sr);
      if (s < n) d[s] = (d[s] ?? 0) + (rng() < 0.5 ? -1 : 1) * (0.25 + rng() * 0.35);
    }
  }
  return ir;
}

/** Trocken plus Hall, im Rückfall auf 44,1 kHz zusätzlich ein Tiefpass bei 10 kHz */
function kette(w: Werkbank, hall: Hall | null, tiefpass: boolean): AudioNode {
  const c = w.c;
  const ein = c.createGain();
  let ziel: AudioNode = c.destination;
  if (tiefpass) {
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 10000;
    lp.Q.value = 0.6;
    lp.connect(c.destination);
    ziel = lp;
  }
  if (hall && hall.nass > 0) {
    const trocken = c.createGain();
    trocken.gain.value = 1 - hall.nass * 0.5;
    ein.connect(trocken);
    trocken.connect(ziel);
    const conv = c.createConvolver();
    conv.normalize = true;
    conv.buffer = hallIR(c, hall.t60, w.rng, w.kanaele);
    const nass = c.createGain();
    nass.gain.value = hall.nass;
    ein.connect(conv);
    conv.connect(nass);
    nass.connect(ziel);
  } else {
    ein.connect(ziel);
  }
  return ein;
}

/* Normalisieren ---------------------------------------------------------------------
   K-Gewichtung nach BS.1770 als zwei Biquads (RBJ), bei beliebiger Rate. */

type Koeff = [number, number, number, number, number];

function koeff(typ: "hochpass" | "hochregal", f0: number, q: number, gainDb: number, sr: number): Koeff {
  const w0 = (2 * Math.PI * f0) / sr;
  const cs = Math.cos(w0);
  const al = Math.sin(w0) / (2 * q);
  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
  if (typ === "hochpass") {
    b0 = (1 + cs) / 2;
    b1 = -(1 + cs);
    b2 = (1 + cs) / 2;
    a0 = 1 + al;
    a1 = -2 * cs;
    a2 = 1 - al;
  } else {
    const A = Math.pow(10, gainDb / 40);
    const sA = 2 * Math.sqrt(A) * al;
    b0 = A * (A + 1 + (A - 1) * cs + sA);
    b1 = -2 * A * (A - 1 + (A + 1) * cs);
    b2 = A * (A + 1 + (A - 1) * cs - sA);
    a0 = A + 1 - (A - 1) * cs + sA;
    a1 = 2 * (A - 1 - (A + 1) * cs);
    a2 = A + 1 - (A - 1) * cs - sA;
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}

function filtern(x: Float32Array, [b0, b1, b2, a1, a2]: Koeff): Float32Array {
  const y = new Float32Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i]!;
    const v = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = xi;
    y2 = y1;
    y1 = v;
    y[i] = v;
  }
  return y;
}

/** Ausklang am Pufferende, K-gewichtete Momentan-Lautheit (400 ms, Maximum), Verstärkung auf
    den Zielpegel in LUFS, die Spitze höchstens −3 dBFS. */
function normalisieren(buf: AudioBuffer, zielLufs: number): void {
  const sr = buf.sampleRate;
  const n = buf.length;
  const kan = buf.numberOfChannels;
  const fade = Math.max(1, Math.min(Math.round(0.25 * sr), Math.floor(n * 0.15)));
  const hp = koeff("hochpass", 38.13, 0.5003, 0, sr);
  const hs = koeff("hochregal", 1681.97, 0.7071, 4, sr);
  const kum = new Float64Array(n + 1);
  const quad = new Float64Array(n);
  let spitze = 0;
  for (let ch = 0; ch < kan; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < fade; i++) d[n - 1 - i]! *= i / fade;
    const k = filtern(filtern(d, hs), hp);
    for (let i = 0; i < n; i++) {
      quad[i]! += k[i]! * k[i]!;
      const a = Math.abs(d[i]!);
      if (a > spitze) spitze = a;
    }
  }
  for (let i = 0; i < n; i++) kum[i + 1] = kum[i]! + quad[i]!;
  const fenster = Math.round(0.4 * sr);
  const schritt = Math.round(0.05 * sr);
  let max = 0;
  if (n <= fenster) max = kum[n]! / fenster;
  else for (let s = 0; s + fenster <= n; s += schritt) max = Math.max(max, (kum[s + fenster]! - kum[s]!) / fenster);
  const roh = -0.691 + 10 * Math.log10(max + 1e-20);
  let g = dbg(zielLufs - roh);
  if (spitze * g > dbg(-3)) g = dbg(-3) / spitze;
  for (let ch = 0; ch < kan; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) d[i]! *= g;
  }
}

/* Rendern ---------------------------------------------------------------------------- */

const fertig = new Map<string, AudioBuffer>();
const laufend = new Map<string, Promise<AudioBuffer>>();

/** Rendert einen Klang einmal und hält ihn vor */
function rendern(id: KlangId, variante = ""): Promise<AudioBuffer> {
  const schluessel = id + "|" + variante;
  const da = fertig.get(schluessel);
  if (da) return Promise.resolve(da);
  const unterwegs = laufend.get(schluessel);
  if (unterwegs) return unterwegs;
  const r = REZEPTE[id];
  const p = (async () => {
    const sek = typeof r.sekunden === "function" ? r.sekunden(variante) : r.sekunden;
    const Offline = window.OfflineAudioContext ?? window.webkitOfflineAudioContext;
    if (!Offline) throw new Error("Kein OfflineAudioContext");
    let rate = RATE;
    let tiefpass = false;
    let off: OfflineAudioContext;
    try {
      off = new Offline(r.kanaele, Math.ceil(sek * rate), rate);
    } catch {
      // Rückfall, falls der Browser 22,05 kHz nicht zulässt
      rate = 44100;
      tiefpass = true;
      off = new Offline(r.kanaele, Math.ceil(sek * rate), rate);
    }
    const rng = zufall(hash(schluessel));
    const w: Werkbank = {
      c: off,
      rng,
      nyq: tiefpass ? 11025 : rate / 2,
      kanaele: r.kanaele,
      rausch: rauschPuffer(off, rng),
    };
    r.bauen(w, kette(w, r.hall, tiefpass), variante);
    // Ältere Safari-Versionen liefern kein Promise, sondern nur oncomplete
    const buf = await new Promise<AudioBuffer>((ok, nein) => {
      off.oncomplete = (e) => ok(e.renderedBuffer);
      try {
        const pr = off.startRendering() as Promise<AudioBuffer> | undefined;
        pr?.then(ok, nein);
      } catch (e) {
        nein(e);
      }
    });
    normalisieren(buf, r.ziel);
    fertig.set(schluessel, buf);
    laufend.delete(schluessel);
    return buf;
  })();
  laufend.set(schluessel, p);
  p.catch(() => laufend.delete(schluessel));
  return p;
}

/** Rendert im Leerlauf nacheinander die Standard- und Zufallsvarianten aller Klänge */
function vorrendern(ids: readonly KlangId[] = IDS): void {
  const liste: [KlangId, string][] = [];
  for (const id of ids) {
    const r = REZEPTE[id];
    liste.push([id, r.standard ?? r.zufall?.[0] ?? ""]);
    for (const v of r.zufall?.slice(1) ?? []) liste.push([id, v]);
  }
  const leerlauf = (f: () => void) => {
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(f, { timeout: 2000 });
    else setTimeout(f, 40);
  };
  const weiter = (): void => {
    const naechst = liste.shift();
    if (!naechst) return;
    leerlauf(() => {
      rendern(...naechst).then(weiter, weiter);
    });
  };
  weiter();
}

/* Laufzeit --------------------------------------------------------------------------- */

interface Laufzeit {
  ctx: AudioContext;
  master: GainNode;
  nachtLp: BiquadFilterNode;
  nachtG: GainNode;
  busse: Record<Ebene, GainNode>;
}

interface Stimme {
  id: KlangId;
  q: AudioBufferSourceNode;
  g: GainNode;
  beginn: number;
  ende: number;
}

let lauf: Laufzeit | null = null;
let stimmen: Stimme[] = [];
// Zählt jedes Ausblenden: Ein Klang, der währenddessen noch rendert, startet danach nicht mehr
let generation = 0;
const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)");
// Wahrnehmungsnahe Kurve: 0,6 ergibt etwa −4,8 dB
const pegel = (lautstaerke: number) => 1.6 * lautstaerke * lautstaerke;

function zielSetzen(c: AudioContext, p: AudioParam, wert: number, zeit = 0.03): void {
  const t = c.currentTime;
  p.cancelScheduledValues(t);
  p.setValueAtTime(p.value, t);
  p.setTargetAtTime(wert, t, zeit);
}

/** Baut den Wiedergabe-Graphen im Kontext der Fassade und rendert im Leerlauf vor */
export function vorbereiten(ctx: AudioContext, { lautstaerke = 0.6, nacht: dunkel = false } = {}): void {
  if (lauf?.ctx === ctx) return;
  const komp = ctx.createDynamicsCompressor();
  komp.threshold.value = -6;
  komp.knee.value = 0;
  komp.ratio.value = 20;
  komp.attack.value = 0.003;
  komp.release.value = 0.12;
  // Sicherheitsstufe hinter dem Kompressor, der kein harter Begrenzer ist (3 ms Anstieg,
  // automatischer Ausgleich). Bis 0,85 linear, darüber ein tanh-Knie gegen 0,99.
  const vor = ctx.createGain();
  vor.gain.value = 0.5; // die Kurve deckt Eingangsamplituden bis ±2 ab
  const sicher = ctx.createWaveShaper();
  const N = 4097;
  const kurve = new Float32Array(N);
  const knie = 0.85;
  const rest = 0.99 - knie;
  for (let i = 0; i < N; i++) {
    const x = (i / (N - 1)) * 4 - 2;
    const a = Math.abs(x);
    kurve[i] = Math.sign(x) * (a <= knie ? a : knie + rest * Math.tanh((a - knie) / rest));
  }
  sicher.curve = kurve;
  sicher.oversample = "2x";
  komp.connect(vor);
  vor.connect(sicher);
  sicher.connect(ctx.destination);
  const master = ctx.createGain();
  master.gain.value = pegel(lautstaerke);
  master.connect(komp);
  const nachtG = ctx.createGain();
  nachtG.connect(master);
  const nachtLp = ctx.createBiquadFilter();
  nachtLp.type = "lowpass";
  nachtLp.frequency.value = 10000;
  nachtLp.Q.value = 0.5;
  nachtLp.connect(nachtG);
  const bus = () => {
    const g = ctx.createGain();
    g.connect(nachtLp);
    return g;
  };
  lauf = { ctx, master, nachtLp, nachtG, busse: { moment: bus(), meldung: bus(), mikro: bus() } };
  stimmen = [];
  nacht(dunkel, true);
  vorrendern();
}

/** Nachtfärbung: Tiefpass 10 auf 6 kHz, −2 dB */
export function nacht(dunkel: boolean, sofort = false): void {
  if (!lauf) return;
  const zeit = sofort ? 0.001 : 0.15;
  zielSetzen(lauf.ctx, lauf.nachtLp.frequency, dunkel ? 6000 : 10000, zeit);
  zielSetzen(lauf.ctx, lauf.nachtG.gain, dunkel ? dbg(-2) : 1, zeit);
}

/** Blendet alle laufenden und geplanten Stimmen aus (s = Dauer) */
export function ausblenden(s = 0.08): void {
  generation++;
  if (!lauf) return;
  const t = lauf.ctx.currentTime;
  for (const st of stimmen) {
    st.g.gain.cancelScheduledValues(t);
    st.g.gain.setTargetAtTime(0, t, s / 3);
    try {
      st.q.stop(t + s * 2);
    } catch {
      // schon gestoppt
    }
  }
  stimmen = [];
}

/** Eine Stimme klingt ab `ab` in etwa 30 ms aus; eine noch geplante startet gar nicht */
function verklingen(alt: Stimme, ab: number): void {
  alt.g.gain.cancelScheduledValues(ab);
  alt.g.gain.setTargetAtTime(0, ab, 0.01);
  try {
    alt.q.stop(ab + 0.06);
  } catch {
    // schon gestoppt
  }
}

function stimmeAnmelden(c: AudioContext, st: Stimme, einzeln = false): void {
  stimmen = stimmen.filter((x) => x.ende > st.beginn);
  if (einzeln) {
    for (const alt of stimmen) if (alt.id === st.id) verklingen(alt, Math.max(c.currentTime, alt.beginn));
    stimmen = stimmen.filter((x) => x.id !== st.id);
  }
  while (stimmen.length >= MAX_STIMMEN) {
    const alt = stimmen.shift()!;
    // Die älteste Stimme macht Platz
    verklingen(alt, Math.max(c.currentTime, alt.beginn, st.beginn));
  }
  stimmen.push(st);
}

/** Ein Moment-Klang duckt meldung und mikro für seine Dauer um 6 dB */
function ducken(l: Laufzeit, beginn: number, dauer: number): void {
  for (const e of EBENEN) {
    if (e === "moment") continue;
    const p = l.busse[e].gain;
    p.cancelScheduledValues(beginn);
    p.setTargetAtTime(dbg(-6), beginn, 0.03);
    p.setTargetAtTime(1, beginn + dauer * 0.6, 0.25);
  }
}

/** Spielt einen Klang. Ein noch nicht gerenderter Klang wird sofort gerendert, nicht verworfen;
    die Verzögerung durchs Rendern wird vom geplanten Beginn abgezogen. */
export async function abspielen(id: KlangId, opt: KlangOpt = {}): Promise<void> {
  const l = lauf;
  if (!l) return;
  const r = REZEPTE[id];
  const c = l.ctx;
  const aufruf = c.currentTime;
  let v = opt.variante ?? r.standard ?? "";
  if (opt.variante == null && r.zufall) v = r.zufall[Math.floor(Math.random() * r.zufall.length)] ?? v;
  // An eine Animation gekoppelt: bei reduzierter Bewegung die Kurzfassung, sofern es eine gibt
  if (opt.anim && ruhig.matches && r.varianten?.includes("kurz")) v = "kurz";
  const gen = generation;
  const buf = fertig.get(id + "|" + v) ?? (await rendern(id, v));
  // Inzwischen ausgeschaltet: nicht mehr starten
  if (lauf !== l || gen !== generation) return;
  const j = r.jitter ?? JITTER[r.ebene];
  const rate = Math.pow(2, ((Math.random() * 2 - 1) * j.cent) / 1200);
  const q = c.createBufferSource();
  q.buffer = buf;
  q.playbackRate.value = rate;
  const g = c.createGain();
  g.gain.value = dbg(-(opt.db ?? 0) + (Math.random() * 2 - 1) * j.db);
  q.connect(g);
  let ziel: AudioNode = l.busse[r.ebene];
  if (opt.pan && "createStereoPanner" in c) {
    const p = c.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, opt.pan));
    p.connect(ziel);
    ziel = p;
  }
  g.connect(ziel);
  const beginn = Math.max(c.currentTime + 0.01, aufruf + 0.01 + (opt.in ?? 0));
  const dauer = buf.duration / rate;
  const st: Stimme = { id, q, g, beginn, ende: beginn + dauer };
  stimmeAnmelden(c, st, opt.einzeln);
  q.onended = () => {
    stimmen = stimmen.filter((x) => x !== st);
  };
  if (r.ebene === "moment") ducken(l, beginn, dauer);
  q.start(beginn);
}
