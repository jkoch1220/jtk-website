/* Klangrezepte ------------------------------------------------------------------------
   Herkunftsnachweis: Alle zwanzig Klänge sind eigene Kompositionen, zur Laufzeit aus Sinus,
   Dreieck, Säge, Rechteck, FM und Rauschen erzeugt. Es stecken keine fremden Aufnahmen,
   Ausschnitte oder Melodiezitate darin, nur der Stil der frühen 2000er (Es-Dur, plagale Wendung,
   Glocke, Pad, Hall, 22,05 kHz). Freiton, Besetztzeichen und Tastentöne folgen den Normsignalen
   (425 Hz nach ITU-T E.180, DTMF nach ITU-T Q.23); das sind technische Signale, keine Werke,
   sie werden ebenfalls synthetisiert. Die ersten vierzehn (bis „umschalten“) abgehört und
   festgeschrieben im Oktober 2026; die Begrüßung „Kristall“ (klang-begruessung.ts) im selben
   Monat aus vier eigenen Entwürfen ausgewählt, ihre Glockenfigur gegen die bekannten Starttöne
   jener Zeit auf Abstand geprüft. Die sechs Klänge der KI-Demos (ab „freiton“) sind gerendert
   und vermessen, aber noch nicht abgehört.

   Je Rezept: Ebene (Bus), Kanäle, Länge, Hall, Zielpegel (Momentan-Maximum in LUFS,
   K-gewichtet) und die Varianten. „zufall“ wählt bei jeder Wiedergabe eine davon,
   „standard“ gilt, wenn der Aufruf keine nennt. Notennamen englisch: Bb = B, Eb = Es, Ab = As. */

import type { KlangId } from "./klang";
import { KRISTALL_DAUER, kristall } from "./klang-begruessung";
import {
  dbg,
  glocke,
  huelle,
  hz,
  klickBauen,
  marimba,
  pad,
  panZu,
  rausch,
  teilton,
  vibraphon,
  gleiten,
  type Werkbank,
} from "./klang-werk";

export type Ebene = "moment" | "meldung" | "mikro";
export type Hall = { t60: number; nass: number };

export interface Rezept {
  ebene: Ebene;
  kanaele: 1 | 2;
  sekunden: number | ((variante: string) => number);
  hall: Hall | null;
  // Abtastrate fürs Vorrendern, sonst 22,05 kHz
  rate?: number;
  ziel: number;
  varianten?: readonly string[];
  zufall?: readonly string[];
  standard?: string;
  jitter?: { cent: number; db: number };
  beschreibung: string;
  bauen(w: Werkbank, a: AudioNode, variante: string): void;
}

const H = hz;

/* Telefon: Normsignale statt Komposition -----------------------------------------------
   Freiton und Besetztzeichen (425 Hz, Takt nach ITU-T E.180 für Deutschland) und Tastentöne
   (DTMF, ITU-T Q.23) sind technische Signale, keine Werke; sie entstehen wie alle Klänge zur Laufzeit.
   Tabelle und Helfer stehen über REZEPTE, weil das Objekt sie schon beim Auswerten liest. */

// Tastenwahl: Zeilenton (tief) und Spaltenton (hoch) in Hz
const DTMF: Record<string, [number, number]> = {
  "1": [697, 1209], "2": [697, 1336], "3": [697, 1477],
  "4": [770, 1209], "5": [770, 1336], "6": [770, 1477],
  "7": [852, 1209], "8": [852, 1336], "9": [852, 1477],
  "*": [941, 1209], "0": [941, 1336], "#": [941, 1477],
};
const ZIFFERN = Object.keys(DTMF);

/** Telefonband 300 bis 3400 Hz vor `a` (Hochpass, Tiefpass); gibt den Eingang zurück */
function hoererBand(w: Werkbank, a: AudioNode): AudioNode {
  const hp = w.c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 300;
  hp.Q.value = 0.7;
  const lp = w.c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 3400;
  lp.Q.value = 0.7;
  hp.connect(lp);
  lp.connect(a);
  return hp;
}

export const REZEPTE: Record<KlangId, Rezept> = {
  anmelden: {
    ebene: "moment",
    kanaele: 2,
    sekunden: KRISTALL_DAUER,
    // eigener Hall in klang-begruessung.ts; 48 kHz, sonst fallen Glas und Celesta weg
    hall: null,
    rate: 48000,
    ziel: -20,
    beschreibung: "Willkommen „Kristall“: Fläche As add9 auf Es add9, gläserne Glocken C6-F6-G6-Es6/B6, Schimmer-Hall",
    bauen(w, a) {
      kristall(w.c, a);
    },
  },
  abmelden: {
    ebene: "moment",
    kanaele: 2,
    sekunden: 3.0,
    hall: { t60: 2.5, nass: 0.35 },
    ziel: -20,
    beschreibung: "Feierabend: Glocke Es6-C6-B5-G5/Es5 fallend, Pad As auf leere Es-Quinte add9",
    bauen(w, a) {
      const j = () => (w.rng() - 0.5) * 0.03; // ±15 ms
      pad(w, a, [H("Ab2"), H("Ab3"), H("C4"), H("Eb4")], 0.01, { an: 0.3, halten: 0.45, tau: 0.1, db: -12, pegel: [-3, -1, 0, -2] });
      pad(w, a, [H("Eb2"), H("Bb2"), H("Eb3"), H("Bb4"), H("F5")], 0.75, { an: 0.25, halten: 0.55, tau: 0.45, db: -12, pegel: [-3, -2, -1, 0, -7] });
      glocke(w, a, H("Eb6"), 0.02 + j(), { db: -3, pan: 0.25 });
      glocke(w, a, H("C6"), 0.26 + j(), { db: -3.5, pan: 0.1 });
      glocke(w, a, H("Bb5"), 0.52 + j(), { db: -3.5, pan: -0.1 });
      glocke(w, a, H("G5"), 0.78 + j(), { db: -5, tau: 1.0, pan: -0.25 });
      glocke(w, a, H("Eb5"), 0.78 + j(), { db: -6, tau: 1.0, pan: 0.2 });
    },
  },
  erfolg: {
    ebene: "moment",
    kanaele: 2,
    sekunden: 1.5,
    hall: { t60: 1.2, nass: 0.25 },
    ziel: -22,
    beschreibung: "Geschafft: Marimba Es5-G5-B5 im Abstand von 55 ms, Glocken-Dyade F6+B6, leises Pad",
    bauen(w, a) {
      marimba(w, a, H("Eb5"), 0.01, { pan: -0.4, tau: 0.25 });
      marimba(w, a, H("G5"), 0.065, { pan: 0, tau: 0.25 });
      marimba(w, a, H("Bb5"), 0.12, { pan: 0.4, tau: 0.27 });
      glocke(w, a, H("F6"), 0.18, { i0: 1.8, i1: 0.1, tau: 0.7, db: -4, pan: -0.2 });
      glocke(w, a, H("Bb6"), 0.18, { i0: 1.8, i1: 0.1, tau: 0.7, db: -7, pan: 0.2 });
      pad(w, a, [H("Eb3"), H("Bb3"), H("G4")], 0.01, { an: 0.06, halten: 0.25, tau: 0.35, db: -10 });
    },
  },
  hinweis: {
    ebene: "meldung",
    kanaele: 1,
    sekunden: 0.8,
    hall: { t60: 0.6, nass: 0.12 },
    ziel: -30,
    beschreibung: "Marimba-Zweiklang mit Vorschlag B6: Es5+B5, dann G5+Es6",
    bauen(w, a) {
      const t = 0.03;
      marimba(w, a, H("Bb6"), t - 0.025, { db: -14, tau: 0.08 });
      marimba(w, a, H("Eb5"), t, { tau: 0.22 });
      marimba(w, a, H("Bb5"), t, { db: -5, tau: 0.2 });
      marimba(w, a, H("G5"), t + 0.18, { db: -2, tau: 0.24, cent: 8 });
      marimba(w, a, H("Eb6"), t + 0.18, { db: -4, tau: 0.22, cent: 8 });
    },
  },
  achtung: {
    ebene: "meldung",
    kanaele: 1,
    sekunden: 1.0,
    hall: { t60: 0.8, nass: 0.15 },
    ziel: -28,
    beschreibung: "Vibraphon Es6, dann As5+C6, Tremolo 5,5 Hz",
    bauen(w, a) {
      vibraphon(w, a, H("Eb6"), 0.01, { db: -1 });
      vibraphon(w, a, H("Ab5"), 0.1, { db: -2 });
      vibraphon(w, a, H("C6"), 0.1, { db: -3 });
    },
  },
  frage: {
    ebene: "meldung",
    kanaele: 1,
    sekunden: 0.6,
    hall: { t60: 0.6, nass: 0.15 },
    ziel: -27,
    beschreibung: "Schwebender sus2-Cluster Es5/F5/B5 mit leiser Glocke F6",
    bauen(w, a) {
      const t = 0.01;
      const cluster: [string, number][] = [["Eb5", 0], ["F5", -2], ["Bb5", -1]];
      for (const [n, db] of cluster) {
        teilton(w, a, H(n), t, { db, an: 0.02, halten: 0.04, tau: 0.16 });
        teilton(w, a, H(n) * 2, t, { db: db - 14, an: 0.02, tau: 0.1 });
      }
      glocke(w, a, H("F6"), t + 0.015, { i0: 1, i1: 0.01, tIdx: 0.3, tau: 0.25, db: -14, celesta: null });
    },
  },
  stopp: {
    ebene: "meldung",
    kanaele: 1,
    sekunden: 0.9,
    hall: { t60: 0.8, nass: 0.18 },
    ziel: -19,
    beschreibung: "Gestrichene leere Quinten G2/C3/G3/C4, Tiefpass öffnet, FM-Akzent auf G5",
    bauen(w, a) {
      const c = w.c;
      const t = 0.01;
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.Q.value = 0.7;
      lp.frequency.setValueAtTime(600, t);
      lp.frequency.linearRampToValueAtTime(1200, t + 0.12);
      lp.frequency.setTargetAtTime(750, t + 0.24, 0.2);
      lp.connect(a);
      const g = c.createGain();
      g.connect(lp);
      const ende = huelle(g.gain, t, { an: 0.12, halten: 0.12, tau: 0.13 });
      const quinten: [string, number][] = [["G2", 0], ["C3", -1], ["G3", -3], ["C4", -5]];
      for (const [n, db] of quinten) {
        for (const cent of [0, 7, -7]) {
          const o = c.createOscillator();
          o.type = "sawtooth";
          o.frequency.value = H(n);
          o.detune.value = cent;
          const og = c.createGain();
          og.gain.value = dbg(db) * 0.22;
          o.connect(og);
          og.connect(g);
          o.start(t);
          o.stop(ende);
        }
      }
      glocke(w, a, H("G5"), t + 0.01, { v: 1.4, i0: 3, i1: 0.01, tIdx: 0.25, tau: 0.18, db: -12, celesta: null });
    },
  },
  ding: {
    ebene: "meldung",
    kanaele: 1,
    sekunden: 0.45,
    hall: { t60: 0.3, nass: 0.06 },
    ziel: -26,
    beschreibung: "Rundes Ding auf A3 (220 Hz), FM 1:3, AM 10 Hz",
    bauen(w, a) {
      const c = w.c;
      const t = 0.01;
      const tiefe = 0.25;
      const trem = c.createGain();
      trem.gain.value = 1 - tiefe / 2;
      trem.connect(a);
      const lfo = c.createOscillator();
      lfo.frequency.value = 10;
      const lg = c.createGain();
      lg.gain.value = tiefe / 2;
      lfo.connect(lg);
      lg.connect(trem.gain);
      lfo.start(t);
      lfo.stop(0.45);
      glocke(w, trem, 220, t, { v: 3, i0: 0.6, i1: 0.1, tIdx: 0.25, an: 0.06, tau: 0.085, celesta: null });
      teilton(w, trem, 660, t, { db: -20, an: 0.05, tau: 0.06 });
      teilton(w, trem, 880, t, { db: -24, an: 0.05, tau: 0.05 });
    },
  },
  stempel: {
    ebene: "mikro",
    kanaele: 1,
    sekunden: 0.22,
    hall: { t60: 0.25, nass: 0.08 },
    ziel: -24,
    varianten: ["a", "b"],
    zufall: ["a", "b"],
    jitter: { cent: 100, db: 1.5 },
    beschreibung: "Gummistempel auf Holz: Sinus 140 auf 55 Hz, Holz-Bandpass, Papier-Hochpass",
    bauen(w, a, v) {
      const c = w.c;
      const b = v === "b";
      const t = 0.005;
      const o = c.createOscillator();
      o.frequency.setValueAtTime(b ? 150 : 140, t);
      o.frequency.exponentialRampToValueAtTime(b ? 60 : 55, t + 0.07);
      const g = c.createGain();
      g.connect(a);
      const ende = huelle(g.gain, t, { an: 0.0015, tau: b ? 0.055 : 0.06 });
      o.connect(g);
      o.start(t);
      o.stop(ende);
      rausch(w, a, t, { filter: [{ typ: "bandpass", f: b ? 330 : 400, q: 2 }], an: 0.001, halten: 0.01, tau: 0.007, db: -6 });
      rausch(w, a, t + (b ? 0.006 : 0.008), {
        filter: [{ typ: "highpass", f: 2000, q: 0.7 }],
        an: 0.002,
        halten: 0.012,
        tau: 0.012,
        db: -14,
      });
    },
  },
  papier: {
    ebene: "mikro",
    kanaele: 1,
    sekunden: 0.4,
    hall: null,
    ziel: -34,
    varianten: ["1", "2", "3"],
    zufall: ["1", "2", "3"],
    beschreibung: "Vier Rauschkörner mit Bandpass 1,4 bis 4,3 kHz plus Knistern",
    bauen(w, a) {
      for (const basis of [0, 0.09, 0.15, 0.24]) {
        const t = 0.02 + basis + (w.rng() - 0.5) * 0.03;
        const len = 0.025 + w.rng() * 0.025;
        const db = -w.rng() * 5;
        rausch(w, a, t, {
          filter: [{ typ: "bandpass", f: 1400 + w.rng() * 2900, q: 1.5 }],
          an: 0.002,
          halten: len * 0.5,
          tau: 0.012,
          db,
        });
        const k = 2 + Math.floor(w.rng() * 2);
        for (let i = 0; i < k; i++) {
          rausch(w, a, t + w.rng() * len, {
            filter: [{ typ: "highpass", f: 3500, q: 0.7 }],
            an: 0.0005,
            halten: 0.001,
            tau: 0.0015,
            db: db - 8,
          });
        }
      }
    },
  },
  drucker: {
    ebene: "mikro",
    kanaele: 2,
    sekunden: (v) => (v === "kurz" ? 0.16 : 1.05),
    hall: null,
    ziel: -30,
    varianten: ["", "kurz"],
    beschreibung: "Nadeldrucker: 10 Zeilen à 18 Nadelimpulse, Pan abwechselnd, Vorschub-Klack",
    bauen(w, a, v) {
      const c = w.c;
      const zeilen = v === "kurz" ? 1 : 10;
      rausch(w, a, 0.01, { filter: [{ typ: "bandpass", f: 180, q: 0.8 }], an: 0.03, halten: zeilen * 0.1 - 0.06, tau: 0.03, db: -20 });
      for (let z = 0; z < zeilen; z++) {
        const t = 0.01 + z * 0.1;
        const aus = panZu(w, a, z % 2 ? 0.3 : -0.3);
        const q = c.createBufferSource();
        q.buffer = w.rausch;
        const tor = c.createGain();
        tor.gain.setValueAtTime(0, 0);
        for (let i = 0; i < 18; i++) {
          const ti = t + i * (0.07 / 18);
          const amp = 0.6 + 0.4 * w.rng();
          tor.gain.setValueAtTime(0, ti);
          tor.gain.linearRampToValueAtTime(amp, ti + 0.0003);
          tor.gain.linearRampToValueAtTime(0, ti + 0.0015);
        }
        const bp1 = c.createBiquadFilter();
        bp1.type = "bandpass";
        bp1.frequency.value = 2600;
        bp1.Q.value = 4;
        const bp2 = c.createBiquadFilter();
        bp2.type = "bandpass";
        bp2.frequency.value = 1100;
        bp2.Q.value = 4;
        const g2 = c.createGain();
        g2.gain.value = dbg(-6);
        q.connect(tor);
        tor.connect(bp1);
        bp1.connect(aus);
        tor.connect(bp2);
        bp2.connect(g2);
        g2.connect(aus);
        q.start(t, w.rng() * (w.rausch.duration - 0.2));
        q.stop(t + 0.08);
        rausch(w, a, t + 0.078, { filter: [{ typ: "bandpass", f: 500, q: 2 }], an: 0.0008, halten: 0.003, tau: 0.003, db: -2 });
      }
    },
  },
  plopp: {
    ebene: "mikro",
    kanaele: 1,
    sekunden: 0.11,
    hall: null,
    ziel: -36,
    varianten: ["", "tief", "hoch"],
    beschreibung: "Sprechblasen-Plopp: Sinus 700 auf 880 auf 790 Hz, Dreieck 2f",
    bauen(w, a, v) {
      const c = w.c;
      const t = 0.005;
      const o = c.createOscillator();
      const o2 = c.createOscillator();
      o2.type = "triangle";
      let punkte: [number, number][] = [[0, 700], [0.012, 880], [0.03, 790]];
      if (v === "hoch") punkte = punkte.map(([z, f]): [number, number] => [z, f * 1.5]);
      if (v === "tief") punkte = [[0, 900], [0.04, 500]];
      gleiten([[o.frequency, 1], [o2.frequency, 2]], t, punkte);
      const g = c.createGain();
      g.connect(a);
      const g2 = c.createGain();
      g2.connect(a);
      const tau = v === "tief" ? 0.02 : 0.015;
      const ende = huelle(g.gain, t, { an: 0.002, tau });
      huelle(g2.gain, t, { an: 0.002, tau, spitze: dbg(-18) });
      o.connect(g);
      o2.connect(g2);
      o.start(t);
      o2.start(t);
      o.stop(ende);
      o2.stop(ende);
      if (v === "hoch") teilton(w, a, 2600, t + 0.02, { typ: "square", db: -16, an: 0.001, halten: 0.006, tau: 0.002 });
    },
  },
  klick: {
    ebene: "mikro",
    kanaele: 1,
    sekunden: 0.06,
    hall: null,
    ziel: -42,
    varianten: ["", "rast", "tief"],
    beschreibung: "Klick-Klack: zwei Rauschimpulse (0 und 21 ms), Bandpass 900 Hz und Hochpass 3 kHz",
    bauen(w, a, v) {
      klickBauen(w, a, v, 0.004);
    },
  },
  umschalten: {
    ebene: "mikro",
    kanaele: 1,
    sekunden: (v) => (v === "kurz" ? 0.07 : 0.6),
    hall: { t60: 0.4, nass: 0.1 },
    ziel: -38,
    varianten: ["dunkel", "hell", "kurz"],
    standard: "dunkel",
    beschreibung: "Klick und 8 Dreieck-Zupfer im 60-ms-Raster (nach dunkel abwärts, nach hell aufwärts)",
    bauen(w, a, v) {
      klickBauen(w, a, "", 0.004);
      if (v === "kurz") return;
      const folge = ["Eb6", "C6", "Bb5", "G5", "F5", "Eb5", "C5", "Bb4"];
      if (v === "hell") folge.reverse();
      const lp = w.c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 3000;
      lp.Q.value = 0.6;
      lp.connect(a);
      folge.forEach((n, i) => {
        teilton(w, lp, H(n), 0.02 + i * 0.06, { typ: "triangle", an: 0.002, tau: 0.04, db: -4 - (6 * i) / 7 });
      });
    },
  },

  /* KI-Demos: Telefon, Scanner, Röntgenblick, Streaming ------------------------------- */

  freiton: {
    ebene: "meldung",
    kanaele: 1,
    sekunden: (v) => (v === "besetzt" ? 1.75 : 1.3),
    hall: null,
    ziel: -32,
    varianten: ["", "besetzt"],
    // Normton: keine Zufallsverstimmung
    jitter: { cent: 0, db: 0 },
    beschreibung: "Freiton 425 Hz, ein Takt (1 s an), Telefonband, leises Leitungsrauschen; „besetzt“: 2 × 0,48 s an, 0,48 s aus",
    bauen(w, a, v) {
      const band = hoererBand(w, a);
      // Der echte Freiton-Takt (1 s an, 4 s aus) wäre zu lang: ein Takt, dann hebt der Assistent ab
      const takte: [number, number][] = v === "besetzt" ? [[0.01, 0.48], [0.97, 0.48]] : [[0.01, 1]];
      for (const [t, dauer] of takte) {
        teilton(w, band, 425, t, { an: 0.008, halten: dauer - 0.008, tau: 0.006 });
        // Die Leitung färbt: leiser zweiter Teilton
        teilton(w, band, 850, t, { db: -26, an: 0.008, halten: dauer - 0.008, tau: 0.006 });
      }
      const ende = v === "besetzt" ? 1.45 : 1.01;
      rausch(w, band, 0.005, { filter: [{ typ: "bandpass", f: 1000, q: 0.5 }], an: 0.05, halten: ende - 0.05, tau: 0.04, db: -40 });
    },
  },
  roentgen: {
    ebene: "meldung",
    kanaele: 1,
    sekunden: (v) => (v === "kurz" ? 0.35 : 1.3),
    hall: { t60: 0.5, nass: 0.1 },
    ziel: -30,
    varianten: ["", "kurz"],
    beschreibung: "Durchleuchten: Netzbrummen schwillt an, Aufladeton 300 auf 1200 Hz, Zap (Rechteck 1800 auf 140 Hz), Relais; „kurz“ nur der Zap",
    bauen(w, a, v) {
      const c = w.c;
      const zap = v === "kurz" ? 0.02 : 0.75;
      if (v !== "kurz") {
        const brummen: [number, number][] = [[50, -6], [100, 0], [150, -8], [200, -14]];
        for (const [f, db] of brummen) teilton(w, a, f, 0.01, { db, an: 0.5, halten: 0.3, tau: 0.12, weich: true });
        const o = c.createOscillator();
        gleiten([[o.frequency, 1]], 0.05, [[0, 300], [zap - 0.05, 1200]]);
        const g = c.createGain();
        g.connect(a);
        const ende = huelle(g.gain, 0.05, { an: zap - 0.1, halten: 0.02, tau: 0.02, spitze: dbg(-14), weich: true });
        o.connect(g);
        o.start(0.05);
        o.stop(ende);
      }
      const z = c.createOscillator();
      z.type = "square";
      gleiten([[z.frequency, 1]], zap, [[0, 1800], [0.07, 140]]);
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 900;
      bp.Q.value = 0.7;
      bp.connect(a);
      const zg = c.createGain();
      zg.connect(bp);
      const zEnde = huelle(zg.gain, zap, { an: 0.002, halten: 0.03, tau: 0.03, spitze: dbg(-4) });
      z.connect(zg);
      z.start(zap);
      z.stop(zEnde);
      klickBauen(w, a, "tief", Math.max(0.005, zap - 0.01)); // Relais
      rausch(w, a, zap, { filter: [{ typ: "highpass", f: 3000, q: 0.7 }], an: 0.001, halten: 0.02, tau: 0.03, db: -14 });
    },
  },
  scanner: {
    ebene: "mikro",
    kanaele: 2,
    sekunden: (v) => (v === "kurz" ? 0.35 : 1.5),
    hall: null,
    ziel: -32,
    varianten: ["", "kurz"],
    beschreibung: "Flachbettscanner: Anlauf-Klack, Schrittmotor (Säge 120 bis 185 Hz), Rauschen, Pfeifen 2,1 kHz, Fahrt links nach rechts, Anschlag",
    bauen(w, a, v) {
      const c = w.c;
      const t = 0.04;
      const dauer = v === "kurz" ? 0.12 : 1.1;
      klickBauen(w, a, "tief", 0.005);
      // Fahrt: Panorama von links nach rechts, wie der Lichtbalken im Bild
      let fahrt: AudioNode = a;
      if (w.kanaele >= 2 && "createStereoPanner" in c) {
        const p = c.createStereoPanner();
        p.pan.setValueAtTime(-0.6, t);
        p.pan.linearRampToValueAtTime(0.6, t + dauer);
        p.connect(a);
        fahrt = p;
      }
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 900;
      lp.Q.value = 0.8;
      lp.connect(fahrt);
      const g = c.createGain();
      g.connect(lp);
      const ende = huelle(g.gain, t, { an: 0.06, halten: Math.max(0, dauer - 0.12), tau: 0.03 });
      const o = c.createOscillator();
      o.type = "sawtooth";
      gleiten([[o.frequency, 1]], t, [[0, 120], [0.06, 180], [Math.max(0.07, dauer - 0.06), 185], [dauer, 110]]);
      o.connect(g);
      o.start(t);
      o.stop(ende);
      rausch(w, fahrt, t, { filter: [{ typ: "bandpass", f: 2500, q: 0.7 }], an: 0.05, halten: Math.max(0, dauer - 0.1), tau: 0.04, db: -24 });
      teilton(w, fahrt, 2100, t + 0.05, { db: -26, an: 0.05, halten: Math.max(0, dauer - 0.2), tau: 0.05 });
      klickBauen(w, a, "", t + dauer + 0.02); // Anschlag
    },
  },
  hoerer: {
    ebene: "mikro",
    kanaele: 1,
    sekunden: 0.4,
    hall: { t60: 0.2, nass: 0.05 },
    ziel: -32,
    varianten: ["ab", "auf"],
    standard: "ab",
    beschreibung: "Hörer: „ab“ Gabel springt, Plastik, kurz die Leitung im Telefonband; „auf“ dumpfer Rums 120 auf 60 Hz, Plastik, Gabelklick",
    bauen(w, a, v) {
      const c = w.c;
      if (v === "auf") {
        // Hörer fällt auf die Gabel: Körper wie beim Stempel, nur weicher
        const o = c.createOscillator();
        o.frequency.setValueAtTime(120, 0.005);
        o.frequency.exponentialRampToValueAtTime(60, 0.06);
        const g = c.createGain();
        g.connect(a);
        const ende = huelle(g.gain, 0.005, { an: 0.002, tau: 0.04, spitze: dbg(-4) });
        o.connect(g);
        o.start(0.005);
        o.stop(ende);
        // Das Plastik trägt den Klang auf Handy-Lautsprechern, die den Rums kaum wiedergeben
        rausch(w, a, 0.005, { filter: [{ typ: "bandpass", f: 700, q: 1.2 }], an: 0.001, halten: 0.008, tau: 0.01 });
        klickBauen(w, a, "tief", 0.03); // Gabelschalter
        return;
      }
      klickBauen(w, a, "", 0.005); // Gabel springt hoch
      rausch(w, a, 0.01, { filter: [{ typ: "bandpass", f: 400, q: 1 }], an: 0.003, halten: 0.01, tau: 0.02, db: -10 });
      // Die Leitung öffnet: kurzes, leises Rauschen im Telefonband
      rausch(w, hoererBand(w, a), 0.06, { filter: [{ typ: "bandpass", f: 1500, q: 0.6 }], an: 0.02, halten: 0.12, tau: 0.04, db: -22 });
    },
  },
  taste: {
    ebene: "mikro",
    kanaele: 1,
    sekunden: 0.14,
    hall: null,
    ziel: -34,
    varianten: ZIFFERN,
    // Ohne Angabe eine beliebige Taste; so werden auch alle zwölf vorgerendert
    zufall: ZIFFERN,
    // Normtöne: nicht verstimmen, nur der Pegel schwankt leicht
    jitter: { cent: 0, db: 0.5 },
    beschreibung: "Tastenton (DTMF): Zeilen- und Spaltenton, 85 ms, hohe Gruppe 2 dB lauter, Telefonband",
    bauen(w, a, v) {
      const [tief, hoch] = DTMF[v] ?? [770, 1336];
      const band = hoererBand(w, a);
      teilton(w, band, tief, 0.005, { db: -2, an: 0.004, halten: 0.08, tau: 0.004 });
      teilton(w, band, hoch, 0.005, { an: 0.004, halten: 0.08, tau: 0.004 });
    },
  },
  tippen: {
    ebene: "mikro",
    kanaele: 1,
    sekunden: 0.05,
    hall: null,
    // Leiser als „klick“ (−42): Beim Streaming klingt es laufend, es soll nur mitlaufen
    ziel: -46,
    varianten: ["1", "2", "3"],
    zufall: ["1", "2", "3"],
    beschreibung: "Schreibmaschinen-Anschlag, sehr leise: Typenhebel (Rauschimpuls, Bandpass 2,2/2,6/3 kHz) und Walze (Bandpass 350 Hz)",
    bauen(w, a, v) {
      const hell = v === "1" ? 2200 : v === "2" ? 2600 : 3000;
      rausch(w, a, 0.004, { filter: [{ typ: "bandpass", f: hell, q: 2.5 }], an: 0.0004, halten: 0.002, tau: 0.003 });
      rausch(w, a, 0.005, { filter: [{ typ: "bandpass", f: 350, q: 1.5 }], an: 0.001, halten: 0.003, tau: 0.008, db: -8 });
    },
  },
};

export const IDS = Object.keys(REZEPTE) as KlangId[];
