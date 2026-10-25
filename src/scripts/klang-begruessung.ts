/* Begrüßung „Kristall“ -------------------------------------------------------------------
   Eigene Komposition, zur Laufzeit synthetisiert (Säge, Puls, Sinus, FM, Rauschen). Stil der
   frühen 2000er: Es-Dur, plagale Wendung As(add9) → Es(add9), breite weiche Fläche, gläserne
   FM-Glocken (1:3,5) mit Celesta-Schicht, Oktav-Schimmer in der Hallfahne, langer Hall.
   Glockenfigur (eigenständig, gleichmäßige Achtel, kein punktierter Gestus):
     C6 (1,30 s) – F6 (1,56 s) – G6 (1,82 s) – Es6 (2,20 s) + B6 (2,23 s, gebrochener Zweiklang)
   Bringt Hall, matten Tiefpass und Schlussblende selbst mit; das Rezept „anmelden“ rendert es
   deshalb ohne Hall der Kette und mit 48 kHz, damit Glas und Celesta nicht wegfallen.
   Notennamen englisch: Bb = B, Eb = Es, Ab = As. */

import { dbg, hz } from "./klang-werk";

export const KRISTALL_DAUER = 4.9;

type Ton = {
  typ?: OscillatorType;
  db?: number;
  an?: number;
  halten?: number;
  tau?: number;
  cent?: number;
  pan?: number;
  weich?: boolean;
};

type Flaeche = {
  an: number;
  halten: number;
  tau: number;
  db: number;
  lpVon: number;
  lpBis: number;
  lpAuf: number;
  pegel: number[];
};

export function kristall(c: BaseAudioContext, ziel: AudioNode): void {
  const DAUER = KRISTALL_DAUER;
  // Ausgangspegel vor dem Normalisieren, Spitze zwischen 16 und 96 kHz unter 0,7
  const PEGEL = 0.53;
  const sr = c.sampleRate;
  const nyq = sr / 2;

  /* Helfer ------------------------------------------------------------------------- */

  // mulberry32: jedes Rendern klingt gleich
  let saat = 0x4b726973;
  const rng = (): number => {
    saat = (saat + 0x6d2b79f5) >>> 0;
    let t = saat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const bis = (t: number) => Math.min(t, DAUER);

  /** Knackfreie Hüllkurve: ab 0 linear oder weich hoch, halten, exponentiell gegen 0 (setTarget). */
  const huelle = (p: AudioParam, t: number, an: number, spitze: number, halten: number, tau: number, weich: boolean) => {
    p.setValueAtTime(0, 0);
    if (t > 0) p.setValueAtTime(0, t);
    if (weich) p.setTargetAtTime(spitze, t, an / 3);
    else p.linearRampToValueAtTime(spitze, t + an);
    p.setTargetAtTime(0, t + an + halten, tau);
    return t + an + halten + tau * 9;
  };

  const panZu = (knoten: AudioNode, pan: number): AudioNode => {
    if (!pan || typeof c.createStereoPanner !== "function") return knoten;
    const p = c.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(knoten);
    return p;
  };

  const tiefpass = (f: number, q: number) => {
    const b = c.createBiquadFilter();
    b.type = "lowpass";
    b.frequency.value = Math.min(f, nyq * 0.92);
    b.Q.value = q;
    return b;
  };

  /** Einzelton mit Hüllkurve; Töne nahe Nyquist entfallen. */
  const ton = (zielK: AudioNode, f: number, t: number, o: Ton = {}) => {
    if (f >= nyq * 0.9) return;
    const g = c.createGain();
    g.gain.value = 0;
    g.connect(panZu(zielK, o.pan ?? 0));
    const ende = bis(huelle(g.gain, t, o.an ?? 0.003, dbg(o.db ?? 0), o.halten ?? 0, o.tau ?? 0.3, o.weich ?? false));
    const osz = c.createOscillator();
    osz.type = o.typ ?? "sine";
    osz.frequency.value = f;
    osz.detune.value = o.cent ?? 0;
    osz.connect(g);
    osz.start(t);
    osz.stop(ende);
  };

  // Pulswelle mit 28 % Tastgrad für die Fläche
  const puls = (() => {
    const n = 40;
    const re = new Float32Array(n);
    const im = new Float32Array(n);
    for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.28);
    return c.createPeriodicWave(re, im);
  })();

  // Rauschpuffer (2 s, wird geschleift)
  const rauschen = (() => {
    const n = Math.ceil(2 * sr);
    const b = c.createBuffer(1, n, sr);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = rng() * 2 - 1;
    return b;
  })();

  /** Erzeugte Hall-Impulsantwort: dekorreliertes Rauschen, Abfall −60 dB bei t60, Höhen klingen
      schneller ab, weicher Einlauf (bei „bluete“ langsam, damit die Fahne aufblüht), Ende auf 0. */
  const hallIR = (t60: number, laenge: number, hell: number, bluete: number, vor: number) => {
    const n = Math.ceil(laenge * sr);
    const ir = c.createBuffer(2, n, sr);
    const start = Math.round(vor * sr);
    const einlauf = Math.max(1, Math.round(bluete * sr));
    const auslauf = Math.round(0.25 * sr);
    const fHell = Math.min(hell, nyq * 0.9);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let lp = 0;
      for (let s = start; s < n; s++) {
        const t = s / sr;
        const fc = 1100 + (fHell - 1100) * Math.max(0, 1 - t / t60);
        const a = 1 - Math.exp((-2 * Math.PI * fc) / sr);
        lp += a * (rng() * 2 - 1 - lp);
        const x = (s - start) / einlauf;
        const an = x >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * x);
        const aus = s > n - auslauf ? (n - s) / auslauf : 1;
        d[s] = lp * Math.exp((-6.9 * t) / t60) * an * aus;
      }
      // ein paar frühe Reflexionen, je Kanal anders
      for (let r = 0; r < 7; r++) {
        const p = Math.round((vor + 0.004 + rng() * 0.05) * sr);
        if (p < n) d[p]! += (rng() < 0.5 ? -1 : 1) * (0.12 + rng() * 0.18);
      }
    }
    return ir;
  };

  /* Ausgangskette -------------------------------------------------------------------- */

  const ausgang = c.createGain();
  ausgang.gain.value = PEGEL;
  ausgang.connect(ziel);

  // Langes, weiches Ausblenden am Schluss: Kosinus von 1 auf exakt 0 bei DAUER
  const blende = c.createGain();
  blende.connect(ausgang);
  const kurve = new Float32Array(96);
  for (let i = 0; i < kurve.length; i++) kurve[i] = 0.5 + 0.5 * Math.cos((Math.PI * i) / (kurve.length - 1));
  kurve[kurve.length - 1] = 0;
  blende.gain.setValueAtTime(1, 0);
  blende.gain.setValueCurveAtTime(kurve, DAUER - 1.3, 1.3);

  // Summe → leicht matter Klang (Tiefpass ~10 kHz) → trocken + Hall
  const summe = c.createGain();
  const matt = tiefpass(10000, 0.5);
  summe.connect(matt);
  const trocken = c.createGain();
  trocken.gain.value = 0.7;
  matt.connect(trocken);
  trocken.connect(blende);
  const hall = c.createConvolver();
  hall.normalize = true;
  hall.buffer = hallIR(3.6, 3.9, 7500, 0.03, 0.018);
  const nass = c.createGain();
  nass.gain.value = 0.56;
  matt.connect(hall);
  hall.connect(nass);
  nass.connect(blende);

  // Shimmer-Hall: Oktav-Schimmer, nur in der Hallfahne. Ein Vollweggleichrichter (|x|) hebt reine
  // Sinus-Saaten exakt um eine Oktave; dazu kommen leise Oktavtöne des Zielakkords. Beides läuft
  // ausschließlich in einen hellen, langsam aufblühenden Hall.
  const schimmerSaat = c.createGain();
  const gleichrichter = c.createWaveShaper();
  const gk = new Float32Array(4097);
  for (let j = 0; j < gk.length; j++) gk[j] = Math.abs((j / (gk.length - 1)) * 2 - 1);
  gleichrichter.curve = gk;
  schimmerSaat.connect(gleichrichter);
  const gleichHp = c.createBiquadFilter();
  gleichHp.type = "highpass";
  gleichHp.frequency.value = 420;
  gleichHp.Q.value = 0.7;
  gleichrichter.connect(gleichHp);
  const schimmerEin = c.createGain();
  gleichHp.connect(schimmerEin);
  const schimmerLp = tiefpass(9500, 0.5);
  schimmerEin.connect(schimmerLp);
  const schimmerHall = c.createConvolver();
  schimmerHall.normalize = true;
  schimmerHall.buffer = hallIR(4.2, 4.4, 9500, 0.35, 0.04);
  const schimmerNass = c.createGain();
  schimmerNass.gain.value = 0.5;
  schimmerLp.connect(schimmerHall);
  schimmerHall.connect(schimmerNass);
  schimmerNass.connect(blende);

  // Flächen-Bus mit Chorus (zwei modulierte Verzögerungen, links und rechts)
  const flaechenBus = c.createGain();
  flaechenBus.connect(summe);
  for (const [pan, zeit, rate] of [
    [-0.8, 0.013, 0.27],
    [0.8, 0.017, 0.39],
  ] as const) {
    const v = c.createDelay(0.05);
    v.delayTime.value = zeit;
    const lfo = c.createOscillator();
    lfo.frequency.value = rate;
    const tiefe = c.createGain();
    tiefe.gain.value = 0.0022;
    lfo.connect(tiefe);
    tiefe.connect(v.delayTime);
    lfo.start(0);
    lfo.stop(DAUER);
    const g = c.createGain();
    g.gain.value = 0.5;
    flaechenBus.connect(v);
    v.connect(g);
    g.connect(panZu(summe, pan));
  }

  const glockenBus = c.createGain();
  glockenBus.connect(summe);

  /* Instrumente --------------------------------------------------------------------- */

  const schicht = (typ: OscillatorType | PeriodicWave, f: number, cent: number, knoten: AudioNode, pegel: number, t: number, ende: number) => {
    const osz = c.createOscillator();
    if (typ instanceof PeriodicWave) osz.setPeriodicWave(typ);
    else osz.type = typ;
    osz.frequency.value = f;
    osz.detune.value = cent + (rng() - 0.5) * 3;
    const g = c.createGain();
    g.gain.value = pegel;
    osz.connect(g);
    g.connect(knoten);
    osz.start(t);
    osz.stop(ende);
  };

  /** Weiche, breite Fläche: je Note zwei verstimmte Sägen (links/rechts), ein Puls in der Mitte
      und ein Sinus als weicher Kern; gemeinsamer Tiefpass, der langsam öffnet und wieder schließt. */
  const flaeche = (noten: number[], t: number, o: Flaeche) => {
    const filt = c.createBiquadFilter();
    filt.type = "lowpass";
    filt.Q.value = 0.6;
    filt.frequency.setValueAtTime(o.lpVon, 0);
    filt.frequency.setValueAtTime(o.lpVon, t);
    filt.frequency.exponentialRampToValueAtTime(Math.min(o.lpBis, nyq * 0.9), t + o.lpAuf);
    filt.frequency.setTargetAtTime(o.lpVon * 1.3, t + o.an + o.halten, o.tau * 1.6);
    filt.connect(flaechenBus);
    const g = c.createGain();
    g.gain.value = 0;
    g.connect(filt);
    const ende = bis(huelle(g.gain, t, o.an, dbg(o.db) / Math.sqrt(noten.length), o.halten, o.tau, true));
    const links = panZu(g, -0.6);
    const rechts = panZu(g, 0.6);
    noten.forEach((f, i) => {
      const nd = dbg(o.pegel[i] ?? 0);
      schicht("sawtooth", f, -7, links, nd * 0.28, t, ende);
      schicht("sawtooth", f, 7, rechts, nd * 0.28, t, ende);
      schicht(puls, f, 2, g, nd * 0.2, t, ende);
      schicht("sine", f, 0, g, nd * 0.5, t, ende);
    });
  };

  /** Tiefer, warmer Bass: Sinus plus leises Dreieck eine Oktave höher, abgerundet. */
  const bass = (f: number, t: number, an: number, halten: number, tau: number, d: number) => {
    const lp = tiefpass(340, 0.6);
    lp.connect(summe);
    ton(lp, f, t, { db: d, an, halten, tau, weich: true });
    ton(lp, f * 2, t, { typ: "triangle", db: d - 11, an, halten, tau: tau * 0.8, weich: true });
  };

  /** Gläserne FM-Glocke (Träger : Modulator = 1 : 3,5), geringer Index für klaren Glasklang,
      dazu ein heller Glasteilton und eine reine Sinus-Saat für den Oktav-Schimmer. */
  const glocke = (f: number, t: number, pan: number, d: number, tau: number) => {
    const aus = panZu(glockenBus, pan);
    const fm = f * 3.5;
    const grenze = Math.max(0.4, (nyq * 0.8 - f) / fm - 0.5);
    const a0 = Math.min(1.6, grenze);
    const a1 = Math.max(Math.min(0.12, a0 * 0.5), 0.01);
    const mod = c.createOscillator();
    mod.frequency.value = fm;
    const idx = c.createGain();
    idx.gain.value = 0;
    idx.gain.setValueAtTime(a0 * fm, t);
    idx.gain.exponentialRampToValueAtTime(a1 * fm, t + 0.7);
    const tr = c.createOscillator();
    tr.frequency.value = f;
    mod.connect(idx);
    idx.connect(tr.frequency);
    const amp = c.createGain();
    amp.gain.value = 0;
    amp.connect(aus);
    const ende = bis(huelle(amp.gain, t, 0.004, dbg(d), 0, tau, false));
    tr.connect(amp);
    tr.start(t);
    mod.start(t);
    tr.stop(ende);
    mod.stop(ende);
    // Glas: Oktave und ein heller, leicht unharmonischer Teilton, kürzer
    ton(aus, f * 2, t, { db: d - 11, an: 0.002, tau: tau * 0.55, cent: 3 });
    ton(aus, f * 5.43, t, { db: d - 22, an: 0.0015, tau: tau * 0.18 });
    // Saat für den Shimmer-Hall (wird dort um eine Oktave gehoben)
    ton(schimmerSaat, f, t, { db: d - 6, an: 0.01, tau: tau * 1.1 });
  };

  /** Celesta-Schicht: eine Oktave über der Glocke, weich, minimal verzögert, gegenüber gepannt. */
  const celesta = (f: number, t: number, pan: number, d: number) => {
    const aus = panZu(glockenBus, pan);
    ton(aus, f, t, { db: d, an: 0.002, tau: 0.5 });
    ton(aus, f * 2, t, { db: d - 13, an: 0.0015, tau: 0.16 });
    ton(aus, f * 4, t, { db: d - 20, an: 0.001, tau: 0.06 });
  };

  /** Luft in den Höhen: leises, bandbegrenztes Rauschen, das mit dem Höhepunkt aufblüht. */
  const luft = (t: number, an: number, halten: number, tau: number, d: number) => {
    const q = c.createBufferSource();
    q.buffer = rauschen;
    q.loop = true;
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = Math.min(5200, nyq * 0.6);
    hp.Q.value = 0.5;
    const lp = tiefpass(9000, 0.5);
    const g = c.createGain();
    g.gain.value = 0;
    q.connect(hp);
    hp.connect(lp);
    lp.connect(g);
    g.connect(summe);
    const ende = bis(huelle(g.gain, t, an, dbg(d), halten, tau, true));
    q.start(t, rng() * 1.2);
    q.stop(ende);
  };

  /* Partitur ----------------------------------------------------------------------- */

  // 1) Anschwellen: As-Dur(add9), Fläche öffnet langsam, Bass As1
  flaeche([hz("Ab3"), hz("C4"), hz("Eb4"), hz("Bb4"), hz("Ab4")], 0.02, {
    an: 1.3, halten: 0.12, tau: 0.28, db: -15,
    lpVon: 320, lpBis: 1900, lpAuf: 1.35,
    pegel: [-1, 0, -1, -3, -5],
  });
  bass(hz("Ab1"), 0.02, 1.2, 0.2, 0.25, -9);

  // 2) Höhepunkt: Es-Dur(add9) blüht auf, Bass Es2
  flaeche([hz("Eb3"), hz("Bb3"), hz("Eb4"), hz("G4"), hz("Bb4"), hz("F5")], 1.4, {
    an: 0.5, halten: 0.95, tau: 0.85, db: -14,
    lpVon: 700, lpBis: 2300, lpAuf: 0.6,
    pegel: [-2, -1, 0, -1, -3, -6],
  });
  bass(hz("Eb2"), 1.42, 0.35, 1.0, 0.8, -8);

  // 3) Gläserne Glockenfigur mit Celesta darüber (eigene Melodie): Note, Zeit, Pan, dB, tau
  const MELODIE: [string, number, number, number, number][] = [
    ["C6", 1.3, -0.3, -10, 1.0],
    ["F6", 1.56, 0.15, -10, 1.0],
    ["G6", 1.82, -0.1, -10.5, 1.1],
    ["Eb6", 2.2, 0.3, -10, 1.6],
    ["Bb6", 2.23, -0.25, -13, 1.6],
  ];
  for (const [note, t, pan, d, tau] of MELODIE) {
    const f = hz(note);
    glocke(f, t, pan, d, tau);
    celesta(f * 2, t + 0.009, -pan, d - 11);
  }

  // 4) Schimmer: leise Oktavtöne des Zielakkords, nur im Shimmer-Hall, mit sanfter Schwebung
  ([
    ["Eb7", -4],
    ["Bb6", 4],
    ["G7", -3],
  ] as const).forEach(([note, cent], k) => {
    const f = hz(note);
    ton(schimmerEin, f, 1.95 + k * 0.12, { db: -30, an: 0.9, halten: 0.5, tau: 0.6, cent, weich: true });
    ton(schimmerEin, f, 1.95 + k * 0.12, { db: -32, an: 0.9, halten: 0.5, tau: 0.6, cent: -cent, weich: true });
  });

  // 5) Luft in den Höhen um den Höhepunkt
  luft(1.35, 0.7, 0.45, 0.6, -40);
}
