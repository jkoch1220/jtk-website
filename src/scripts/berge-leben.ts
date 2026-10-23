// Leben im Bergbild, im Geist von Mark Ferraris „Living Worlds“: Palettenzyklen lassen Sonne, Sterne,
// Wasser, Wiese und Nebel atmen, Wolkenschatten und Nebelschwaden ziehen über die Hänge, dazu echte
// Sprites (Vögel, Dohlen, Bussard, Gämse, Fledermaus, Gondel, Gleitschirm …) und ein Wind, der in Böen
// über das Bild zieht und Tannen wie Gras biegt. Alles schreibt Farbnummern in das schon
// zusammengesetzte Bild; die Palette macht erst danach Tag oder Nacht daraus. Ruhig im Ruhezustand:
// wenige Frames, ganze Pixel, gestufte Bewegung. Kein DOM, darum auch in Node prüfbar.
import {
  BAYER,
  BOGEN,
  DUNST,
  EIS,
  FELS,
  FELS_LICHT,
  FENSTER,
  GELB,
  GISCHT,
  GLUT,
  GLITZER,
  GLITZER_HELL,
  HOF_RAND,
  HOLZ,
  LAMPE,
  LEER,
  MOND,
  NEBEL,
  NEBEL_TIEF,
  RAUCH,
  SAUM,
  SCHNEE,
  SCHNEE_SCHATTEN,
  SCHNUPPE,
  SEIL,
  STERN,
  STERN_MATT,
  STRAHL,
  T1,
  T2,
  T3,
  T4,
  T5,
  T6,
  TIEFE,
  UEBERSTAND,
  VOGEL,
  WAND,
  WAND_HELL,
  WANDERER,
  WASSERFALL,
  WIESE,
  WIESE_LICHT,
  WOLKE,
  WOLKE_LICHT,
  WOLKE_SCHATTEN,
  BLUETE_ROSA,
  ZYKLUS_EIS,
  ZYKLUS_FLUSS,
  ZYKLUS_GISCHT,
  ZYKLUS_GLITZER,
  ZYKLUS_HOF,
  ZYKLUS_NEBEL,
  ZYKLUS_SCHEIBE,
  ZYKLUS_STERN,
  ZYKLUS_STRAHL,
  ZYKLUS_WASSERFALL,
  ZYKLUS_WIESE,
  nachtAb,
  type BergSzene,
  type Figur,
  type Sperre,
  type Thema,
} from "./berge-szene";

export interface Leben {
  // Schreibt den Zustand zur Zeit t (Sekunden seit Bildbeginn) in bild (Farbnummern B × H, schon mit Versatz
  // zusammengesetzt). vorn aus zusammensetzen. Bei t = 0 ein ruhiges Standbild: Die Figuren stehen an ihren
  // Startplätzen, nichts bewegt sich, nichts wird fortgeschrieben.
  zeichnen(bild: Uint8Array, vorn: Uint8Array, t: number, versatz: readonly number[], thema: Thema): void;
  zeiger(x: number, y: number): void; // Kunstpixel; Vögel weichen aus, Tiere reagieren
  weg(): void;
  stoss(x: number, y: number): void; // Klick: Vögel fliegen auf, Gämse springt, Ringe im See …
}

/* Metadaten, die die Szene für das Leben ergänzt ------------------------------------------------- */

interface SonnenMasse {
  hof: number; // Radius des Hofs
  stauchung: number; // Stauchung des Hofs nach oben
  innen: number; // innerer Hof (dort liegen die Hof-Zyklen)
  strahlLaenge: number;
  strahlen: number;
}
interface WolkenDaten {
  index: Uint32Array;
  farbe: Uint8Array;
  unter: Uint8Array;
}
interface SeeFlaeche {
  y0: number;
  y1: number;
  maske: Uint8Array;
}

const U = UEBERSTAND;
const KANTE = 3; // Rasterzeilen unter der weißen Kante: Dort schreibt das Leben nie

// Ganzzahliges Rauschen 0–1: dieselben Eingaben ergeben immer dieselbe Zahl (Funkeln ohne Gedächtnis)
function hash(a: number, b: number): number {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// Glattes Rauschen 0–1 entlang einer Achse, je Kanal anders
function rauschen(x: number, kanal: number): number {
  const i = Math.floor(x);
  const u = x - i;
  const s = u * u * (3 - 2 * u);
  return hash(i, kanal) * (1 - s) + hash(i + 1, kanal) * s;
}
const klemme = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const schwelle = (x: number, y: number) => (BAYER[y & 7][x & 7] + 0.5) / 64;
// Dieselben Schwellen flach, Index (y & 7) · 8 + (x & 7): für Schleifen über viele Pixel
const SCHWELLE = Float32Array.from({ length: 64 }, (_, n) => (BAYER[n >> 3][n & 7] + 0.5) / 64);

/* Sprites ------------------------------------------------------------------------------------------- */

// Sprite aus Zeichenreihen: "x" = Pixel. Fuß- bzw. Bezugspunkt ist (ox, unterste Zeile).
function sprite(zeilen: string[], ox: number): number[] {
  const p: number[] = [];
  const h = zeilen.length;
  zeilen.forEach((z, r) => {
    for (let c = 0; c < z.length; c++) if (z[c] !== ".") p.push(c - ox, r - (h - 1));
  });
  return p;
}
// Papierrand um ein Sprite: alle Nachbarn (auch schräg), die nicht selbst zum Sprite gehören. Stehende
// Figuren bekommen keinen Rand unter den Füßen.
function randVon(p: number[], stehend: boolean): number[] {
  const da = new Set<number>();
  for (let k = 0; k < p.length; k += 2) da.add((p[k] + 64) * 256 + p[k + 1] + 64);
  const rand: number[] = [];
  const gesehen = new Set<number>();
  for (let k = 0; k < p.length; k += 2)
    for (let a = -1; a <= 1; a++)
      for (let b = -1; b <= 1; b++) {
        const x = p[k] + a;
        const y = p[k + 1] + b;
        const s = (x + 64) * 256 + y + 64;
        if (da.has(s) || gesehen.has(s) || (stehend && y >= 0)) continue;
        gesehen.add(s);
        rand.push(x, y);
      }
  return rand;
}
interface Form {
  p: number[];
  r: number[];
}
const form = (zeilen: string[], ox: number, stehend: boolean): Form => {
  const p = sprite(zeilen, ox);
  return { p, r: randVon(p, stehend) };
};

// Vögel: drei Flügelstellungen, oben – gleiten – unten. Klein für die Ferne, groß (Dohle) näher. Der
// kleine Vogel gleitet als flaches Möwen-V; ein gerader Strich läse sich nicht als Vogel.
const VOGEL_KLEIN = [form(["x.x", ".x."], 1, false), form(["x.x", ".x."], 1, false), form([".x.", "x.x"], 1, false)];
const VOGEL_GROSS = [
  form(["x...x", ".x.x.", "..x.."], 2, false),
  form(["xx.xx", "..x.."], 2, false),
  form(["..x..", ".x.x.", "x...x"], 2, false),
];
// Bussard: breite, gefingerte Schwingen, meist im Gleitflug, selten ein Flügelschlag
const BUSSARD = [form([".xxx...xxx.", "x...xxx...x", ".....x....."], 5, false), form(["x.........x", ".xxx...xxx.", "....xxx....", ".....x....."], 5, false)];
// Fledermaus: Ohren, gezackte Schwingen, hektischer Flügelschlag (klein für schmale Bilder)
const FLEDERMAUS = [
  form(["x.......x", ".x.x.x.x.", "..xxxxx..", "....x...."], 4, false),
  form(["...x.x...", "x..xxx..x", "xxxxxxxxx", ".x..x..x."], 4, false),
  form(["...x.x...", "..xxxxx..", ".xxx.xxx.", "x.......x"], 4, false),
];
const FLEDERMAUS_KLEIN = [
  form(["x.....x", ".xx.xx.", "..xxx.."], 3, false),
  form(["..x.x..", "xxxxxxx", ".x.x.x."], 3, false),
  form(["..x.x..", ".xxxxx.", "x.....x"], 3, false),
];
// Steinbock, nach rechts schauend, Fuß in der Mitte: stehen, Schritt, äsen, sichern. Die Hörner schwingen
// im Bogen nach hinten und bleiben in jeder Haltung sichtbar: Sie machen das Tier lesbar. Die Beine stehen
// als zwei Paare (hinten, vorn) mit Lücke dazwischen; vier gleich verteilte Beine läsen sich als Kamm.
// Beim Äsen senkt sich der Kopf unter die Rückenlinie, das Horn krümmt sich darüber.
const BOCK = {
  stehen: form(["......xx..", ".....x..x.", "........x.", "......xxxx", ".xxxxxxx..", "xxxxxxxx..", ".xx...xx..", ".x.x..x.x."], 4, true),
  schritt: form(["......xx..", ".....x..x.", "........x.", "......xxxx", ".xxxxxxx..", "xxxxxxxx..", ".xx..x.x..", "x..x.x..x."], 4, true),
  aesen: form(["........xx.", ".......x..x", ".xxxxxx...x", "xxxxxxxx.x.", ".xx...xxx..", ".x.x..x.xx."], 4, true),
  sichern: form([".....xx...", "....x..x..", "......xx..", "......xxx.", ".xxxxxx...", "xxxxxxx...", ".xx...xx..", ".x.x..x.x."], 4, true),
};
const BOCK_KLEIN = {
  stehen: form(["....x..", "...x.x.", ".....xx", ".xxxxx.", "xxxxx..", ".x..x.."], 3, true),
  schritt: form(["....x..", "...x.x.", ".....xx", ".xxxxx.", "xxxxx..", "x.x.x.x"], 3, true),
  aesen: form(["....xx.", ".xxx..x", "xxxxx.x", ".x..xx."], 3, true),
  sichern: form(["...x...", "..x.x..", "....xx.", ".xxxxx.", "xxxxx..", ".x..x.."], 3, true),
};
// Mondlicht-Saum: die Randpunkte direkt über dem Tier (Rücken, Hörner). Nachts silbern statt Papier,
// damit die dunkle Silhouette vor dem dunklen Hang steht.
const saumVon = (fo: Form): number[] => {
  const da = new Set<number>();
  for (let k = 0; k < fo.p.length; k += 2) da.add((fo.p[k] + 64) * 256 + fo.p[k + 1] + 64);
  const saum: number[] = [];
  for (let k = 0; k < fo.r.length; k += 2) if (da.has((fo.r[k] + 64) * 256 + fo.r[k + 1] + 65)) saum.push(fo.r[k], fo.r[k + 1]);
  return saum;
};
const BOCK_SAUM = new Map<Form, number[]>();
for (const f of [...Object.values(BOCK), ...Object.values(BOCK_KLEIN)]) BOCK_SAUM.set(f, saumVon(f));

// Wanderer wie in der Szene (Kopf = Stirnlampe, Stock vorn), zwei Schrittstellungen, nach rechts gehend.
// Punkte dx, dy (Fuß bei dy = 0); der erste Punkt ist der Kopf.
const WANDERER_KOERPER = [0, -7, 0, -6, -1, -5, 0, -5, 1, -5, 0, -4, 0, -3, 2, -6, 2, -5, 2, -4, 2, -3, 2, -2, 2, -1, 2, 0];
const WANDERER_GEHT = [
  [...WANDERER_KOERPER, -1, -2, 1, -2, -1, -1, 1, -1, -1, 0, 1, 0],
  [...WANDERER_KOERPER, 0, -2, 0, -1, -1, 0, 0, 0],
];
const WANDERER_RAND = WANDERER_GEHT.map((p) => randVon(p, true));

// Gleitschirm: Punkte dx, dy, Farbe; Bezug ist die Mitte der Kappe. Flache, breite Kappe in Rosa mit
// Tintenrand, die Leinen laufen zum Piloten zusammen.
const SCHIRM_ZEILEN = [
  "...xxxxxxx...",
  ".xxpppppppxx.",
  "x...........x",
  ".m.........m.",
  "..m.......m..",
  "...m.....m...",
  "....m...m....",
  ".....m.m.....",
  "......x......",
  "......x......",
];
const SCHIRM: number[] = (() => {
  const farbe: Record<string, number> = { x: WANDERER, p: BLUETE_ROSA, m: T4 };
  const p: number[] = [];
  SCHIRM_ZEILEN.forEach((z, r) => {
    for (let c = 0; c < z.length; c++) if (farbe[z[c]] !== undefined) p.push(c - 6, r - 1, farbe[z[c]]);
  });
  return p;
})();
// Gondel: Kabine mit Dach, zwei Fenstern und Boden am Gehänge; die Kabine mit Papierrand. Ein Quadrat mit
// einem Loch läse sich als Vorhängeschloss. Bezug ist die Mitte des Dachs, "o" sind Fenster.
const KABINE_GROSS = ["xxxxx", "xoxox", "xxxxx", ".xxx."];
const KABINE_KLEIN = ["xxxx", "xoox", "xxxx"];
const kabine = (zeilen: string[]) => {
  const ox = (zeilen[0].length - 1) >> 1;
  const p: number[] = [];
  const fenster: number[] = [];
  zeilen.forEach((z, r) => {
    for (let c = 0; c < z.length; c++) if (z[c] !== ".") (z[c] === "o" ? fenster : p).push(c - ox, r);
  });
  return { p, fenster, rand: randVon([...p, ...fenster], false), hoehe: zeilen.length };
};

// Farbe eine Stufe dunkler (Wolkenschatten) bzw. heller (Wellen im See); geprüft je Palette
const DUNKEL_PAARE = [
  [T1, T2],
  [T2, T3],
  [T3, T4],
  [T4, T5],
  [T5, T6],
  [SCHNEE, SCHNEE_SCHATTEN],
  [FELS_LICHT, FELS],
  [FELS, T3],
  [WIESE_LICHT, WIESE],
  [WIESE, T3],
  [WAND_HELL, WAND],
  [EIS, T1],
  [GLUT, T3],
  [NEBEL, NEBEL_TIEF],
  [WOLKE_LICHT, WOLKE_SCHATTEN],
  [WOLKE, WOLKE_SCHATTEN],
];
const HELL_PAARE = [
  [T6, T5],
  [T5, T4],
  [T4, T3],
  [T3, T2],
  [T2, T1],
  [GLITZER, GLITZER_HELL],
];

/* Figuren für den Wind einordnen -------------------------------------------------------------------- */

// Alle Figuren liegen hintereinander in gemeinsamen Feldern (Figur n: Punkte fAb[n] bis fAb[n + 1]), je
// Figur nach Biegsamkeit sortiert (Spitze zuerst). Ein Waldtal hat gut 2 000 Tannen mit 130 000 Punkten:
// Eigene kleine Felder je Figur kosteten beim Erwecken über 5 ms. Die Arbeit steht bewusst in kleinen
// Funktionen außerhalb von lebenErwecken, damit die Engine sie schon nach wenigen Figuren optimiert (als
// Schleife im großen Rumpf lief sie im ersten Waldtal ungeübt und brauchte im Browser ein Vielfaches).
interface FigurFelder {
  oben: Int16Array; // oberste Figur je Stelle der Ebenen (4 × B × G)
  fAb: Int32Array;
  fArt: Uint8Array; // 0 fest, 1 biegt sich, 2 Fahne, 3 Boot, 4 Rauch
  fX: Float64Array;
  fEbene: Uint8Array;
  pX: Int16Array;
  pY: Int16Array;
  pFarbe: Uint8Array;
  pUnter: Uint8Array;
  pB: Float32Array; // Versatz bei voller Böe
  pSpitze: Uint8Array; // Fahne: flatternder Zipfel
}
// Hilfsfelder für die Sortierung, einmal für die größte Figur angelegt
interface FigurHilfe {
  bRoh: Float32Array;
  schluessel: Int32Array;
  folge: Int32Array;
  zaehler: Int32Array;
  biegung: Float64Array; // Biegung je ganzzahliger Höhe der aktuellen Figur
}
function figurenEinordnen(figuren: Figur[], B: number, H: number, windRichtung: number): FigurFelder {
  const fn = figuren.length;
  const G = H + 2 * U;
  const fAb = new Int32Array(fn + 1);
  let mMax = 1;
  for (let n = 0; n < fn; n++) {
    const m = figuren[n].farben.length;
    fAb[n + 1] = fAb[n] + m;
    if (m > mMax) mMax = m;
  }
  const punkteF = fAb[fn];
  const ff: FigurFelder = {
    oben: new Int16Array(4 * B * G).fill(-1),
    fAb,
    fArt: new Uint8Array(fn),
    fX: new Float64Array(fn),
    fEbene: new Uint8Array(fn),
    pX: new Int16Array(punkteF),
    pY: new Int16Array(punkteF),
    pFarbe: new Uint8Array(punkteF),
    pUnter: new Uint8Array(punkteF),
    pB: new Float32Array(punkteF),
    pSpitze: new Uint8Array(punkteF),
  };
  const hilfe: FigurHilfe = {
    bRoh: new Float32Array(mMax),
    schluessel: new Int32Array(mMax),
    folge: new Int32Array(mMax),
    zaehler: new Int32Array(64),
    biegung: new Float64Array(64),
  };
  for (let n = 0; n < fn; n++) figurEinordnen(ff, hilfe, figuren[n], n, B, H, windRichtung);
  return ff;
}
function figurEinordnen(ff: FigurFelder, hilfe: FigurHilfe, f: Figur, n: number, B: number, H: number, windRichtung: number): void {
  const { bRoh, schluessel, folge } = hilfe;
  const m = f.farben.length;
  const pk = f.punkte;
  const hoehe = Math.max(1, f.hoehe);
  const staerke = f.art === "tanne" ? hoehe / 11 : f.art === "baum" ? hoehe / 13 : f.art === "gras" ? Math.max(1.3, hoehe / 4) : 0;
  const art = staerke ? 1 : f.art === "fahne" ? 2 : f.art === "boot" ? 3 : f.art === "rauch" ? 4 : 0;
  ff.fArt[n] = art;
  ff.fX[n] = f.x;
  ff.fEbene[n] = f.ebene;
  // Biegsamkeit wächst mit der Höhe über dem Fuß (oberhalb 1,15 Figurhöhen nicht mehr). Gleiche Höhe,
  // gleiche Biegung: Als Schlüssel genügt die ganzzahlige Höhe, gekappt wie die Biegung selbst (−1 für
  // gekappt). Die Biegung wird je Höhe nur einmal gerechnet, nicht je Punkt.
  let kMax = 0;
  for (let k = 0; k < m; k++) {
    const r = -pk[2 * k + 1] / hoehe;
    const s = r < 0 || r === 0 ? 0 : r >= 1.15 ? -1 : -pk[2 * k + 1];
    schluessel[k] = s;
    if (s > kMax) kMax = s;
  }
  if (staerke) {
    if (hilfe.biegung.length < kMax + 1) hilfe.biegung = new Float64Array(kMax + 1);
    const biegung = hilfe.biegung;
    for (let s = 0; s <= kMax; s++) biegung[s] = staerke * (s / hoehe) ** 1.5 * windRichtung;
    const gekappt = staerke * 1.15 ** 1.5 * windRichtung;
    for (let k = 0; k < m; k++) bRoh[k] = schluessel[k] < 0 ? gekappt : biegung[schluessel[k]];
  } else bRoh.fill(0, 0, m);
  if (art === 1) {
    // Stabil absteigend nach Biegsamkeit sortieren (Zählsortierung: die Höhen sind kleine ganze Zahlen)
    const oberst = kMax + 1;
    for (let k = 0; k < m; k++) if (schluessel[k] < 0) schluessel[k] = oberst;
    if (hilfe.zaehler.length < oberst + 2) hilfe.zaehler = new Int32Array(oberst + 2);
    const zaehler = hilfe.zaehler;
    zaehler.fill(0, 0, oberst + 2);
    for (let k = 0; k < m; k++) zaehler[oberst - schluessel[k] + 1]++;
    for (let s = 1; s <= oberst + 1; s++) zaehler[s] += zaehler[s - 1];
    for (let k = 0; k < m; k++) folge[zaehler[oberst - schluessel[k]]++] = k;
  } else for (let k = 0; k < m; k++) folge[k] = k;
  let weit = 0;
  for (let k = 0; k < m; k++) weit = Math.max(weit, Math.abs(pk[2 * k]));
  const { pX, pY, pFarbe, pUnter, pB, pSpitze, oben } = ff;
  const a = ff.fAb[n];
  const G = H + 2 * U;
  const ebeneAb = f.ebene * B * G;
  for (let j = 0; j < m; j++) {
    const k = folge[j];
    const x = f.x + pk[2 * k];
    const y = f.y + pk[2 * k + 1];
    pX[a + j] = x;
    pY[a + j] = y;
    pFarbe[a + j] = f.farben[k];
    pUnter[a + j] = f.unter[k];
    pB[a + j] = bRoh[k];
    pSpitze[a + j] = Math.abs(pk[2 * k]) >= weit - 1 ? 1 : 0;
    if (x >= 0 && x < B && y >= -U && y < H + U) oben[ebeneAb + (y + U) * B + x] = n;
  }
}

/* Leben --------------------------------------------------------------------------------------------- */

interface Vogel {
  x: number; // Himmelskoordinaten (Ebene 0 bei Versatz 0)
  y: number;
  vx: number;
  vy: number;
  ox: number; // Platz im Schwarm relativ zum Leittier
  oy: number;
  gross: boolean;
  takt: number; // Flügelschlag
  gleiten: number; // Zeit bis zum Wechsel Schlagen/Gleiten
  schlaegt: boolean;
  schreck: number; // Sekunden aufgeschreckt
  vorne: boolean; // aus den Bäumen aufgeflogen: vor allem; sonst fern, hinter Graten verdeckt
}
interface Schwarm {
  richtung: number;
  x: number;
  y: number;
  ziel: number; // Flughöhe
  tempo: number;
  fort: boolean; // verlässt das Bild
  voegel: Vogel[];
  route: Float32Array | null; // Höhe je Spalte; aufgeschreckt ohne Route
  ebene: number; // 0 im freien Himmel, 1–2 vor fernen Graten (Koordinaten dieser Ebene bei Versatz 0)
  frei: Uint8Array; // freie Bahn dieser Ebene
}
interface Teilchen {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alter: number;
  dauer: number;
  saat: number;
}
interface Kreiser {
  phase: number;
  radius: number; // Anteil am Bahnradius
  hub: number; // Auf und Ab
  takt: number;
  gleiten: number;
  schlaegt: boolean;
}

export function lebenErwecken(szene: BergSzene, zufallsquelle?: () => number): Leben {
  const rnd = zufallsquelle ?? Math.random;
  const { B, H, welt, lagen } = szene;
  const N = B * H;
  const weiss = welt.weiss;
  const yMin = weiss + KANTE; // erste Zeile, in die das Leben schreiben darf
  const nacht = nachtAb(H);
  const sperre = (welt.sperre as Sperre | null | undefined) ?? null;
  const sonne = welt.sonne as SonnenMasse | undefined;
  const wolken = welt.wolken as WolkenDaten | undefined;
  const see = welt.see as SeeFlaeche | null | undefined;
  const horizont = welt.horizont as Int16Array | undefined;
  const licht = welt.licht;
  const winter = !!welt.schneefall;
  const eisSee = !!welt.eis;
  const windRichtung = -szene.sonnenseite; // Rauch und Gras neigen sich von der Sonne weg
  const skala = B / 360; // Tempo in Kunstpixeln wächst mit der Bildbreite
  const sx = licht.x;
  const sy = licht.y;
  const sr = licht.r;

  // Abstand zur HUD-Box (Bildkoordinaten; das HUD liegt fest über dem Bild)
  const hud2 = (x: number, y: number): number => {
    if (!sperre) return 1e9;
    const dx = Math.max(sperre.x0 - x, 0, x - sperre.x1);
    const dy = Math.max(sperre.y0 - y, 0, y - sperre.y1);
    return dx * dx + dy * dy;
  };
  // Bildpixel unter dem HUD (mit einem Pixel Rand): Dort bleibt das Standbild, wie es ist
  const unterHud = new Uint8Array(N);
  if (sperre) {
    for (let y = Math.max(0, Math.floor(sperre.y0) - 1); y <= Math.min(H - 1, Math.ceil(sperre.y1) + 1); y++) {
      for (let x = Math.max(0, Math.floor(sperre.x0) - 1); x <= Math.min(B - 1, Math.ceil(sperre.x1) + 1); x++) unterHud[y * B + x] = 1;
    }
  }
  // Vorderste Ebene bei Versatz 0 (für die Wahl von Orten, an denen Tiere sein können)
  const vorn0 = new Uint8Array(N);
  {
    const l1 = lagen[1];
    const l2 = lagen[2];
    const l3 = lagen[3];
    for (let i = 0, j = U * B; i < N; i++, j++) vorn0[i] = l3[j] !== LEER ? 3 : l2[j] !== LEER ? 2 : l1[j] !== LEER ? 1 : 0;
  }
  // Helligkeit je Rolle (für Schneeflocken, Rauch und die Stufen dunkler/heller)
  const hell: Record<Thema, Float32Array> = { light: new Float32Array(256), dark: new Float32Array(256) };
  const dunkler: Record<Thema, Uint8Array> = { light: new Uint8Array(256), dark: new Uint8Array(256) };
  const heller: Record<Thema, Uint8Array> = { light: new Uint8Array(256), dark: new Uint8Array(256) };
  const heller2: Record<Thema, Uint8Array> = { light: new Uint8Array(256), dark: new Uint8Array(256) };
  (["light", "dark"] as Thema[]).forEach((th) => {
    const p = szene.paletten[th];
    const h = hell[th];
    for (let f = 0; f < 256; f++) h[f] = (p[f] & 255) * 0.3 + ((p[f] >>> 8) & 255) * 0.59 + ((p[f] >>> 16) & 255) * 0.11;
    for (let f = 0; f < 256; f++) dunkler[th][f] = heller[th][f] = f;
    for (const [a, b] of DUNKEL_PAARE) if (h[b] < h[a] - 4) dunkler[th][a] = b;
    for (const [a, b] of HELL_PAARE) if (h[b] > h[a] + 4) heller[th][a] = b;
    for (let f = 0; f < 256; f++) heller2[th][f] = heller[th][heller[th][f]];
  });

  // Himmel für Vögel: Ebene 0 sichtbar, nicht an der Sonnenscheibe (der Hof bleibt offen: Vögel vor dem
  // Hof sind schön), nicht am HUD, nicht in der weißen Kante. Um zwei Pixel geschrumpft, damit die
  // Sprites nicht an Grate stoßen (getrennt nach Zeilen und Spalten: schnell auch bei großen Bildern).
  // Hinter der Scheibe dürfen Schwärme durchziehen (sie verschwinden dort kurz), unter dem HUD nie.
  const scheibe2 = (sr + 3) ** 2;
  const hudFern = (x: number, y: number, rand: number) => hud2(x, y) >= rand && hud2(x, y - 8) >= rand && hud2(x, y + 8) >= rand;
  const passierbar = new Uint8Array(N); // Durchflug erlaubt, auch hinter Graten und hinter der Scheibe
  const anScheibe = new Uint8Array(N);
  const passOben = Math.max(0, yMin + 2); // nur in diesen Zeilen ist überhaupt etwas passierbar
  const passUnten = Math.min(H, Math.round(H * 0.7));
  for (let y = passOben; y < passUnten; y++)
    for (let x = 0; x < B; x++) {
      if (!hudFern(x, y, 81)) continue;
      passierbar[y * B + x] = 1;
      if ((x - sx) ** 2 + (y - sy) ** 2 < scheibe2) anScheibe[y * B + x] = 1;
    }
  // Freie Bahn für Sprites der Ebene e: Dort ist bei Versatz 0 nichts davor (vorn ≤ e). Ebene 0 ist der
  // freie Himmel; Schwärme der Ebenen 1 und 2 ziehen vor fernen Graten her (erst bei Bedarf gerechnet).
  const freiE: (Uint8Array | null)[] = [null, null, null];
  const freiFuer = (e: number): Uint8Array => {
    const fertig = freiE[e];
    if (fertig) return fertig;
    const f = new Uint8Array(N);
    const quer = new Uint8Array(N);
    // Erst je Pixel, dann je fünf Nachbarn in der Zeile (am Bildrand zählt der Randpixel mehrfach)
    // (außerhalb der passierbaren Zeilen bleibt alles 0)
    const ok = new Uint8Array(N);
    for (let i = passOben * B; i < passUnten * B; i++) ok[i] = vorn0[i] <= e && passierbar[i] && !anScheibe[i] ? 1 : 0;
    for (let y = passOben; y < passUnten; y++) {
      const z0 = y * B;
      for (let x = 0; x < B; x++)
        quer[z0 + x] =
          x >= 2 && x < B - 2
            ? ok[z0 + x - 2] & ok[z0 + x - 1] & ok[z0 + x] & ok[z0 + x + 1] & ok[z0 + x + 2]
            : ok[z0 + klemme(x - 2, 0, B - 1)] & ok[z0 + klemme(x - 1, 0, B - 1)] & ok[z0 + x] & ok[z0 + klemme(x + 1, 0, B - 1)] & ok[z0 + klemme(x + 2, 0, B - 1)];
    }
    for (let y = Math.max(2, passOben + 2); y < Math.min(H - 2, passUnten - 2); y++)
      for (let x = 0; x < B; x++) {
        const i = y * B + x;
        f[i] = quer[i - 2 * B] & quer[i - B] & quer[i] & quer[i + B] & quer[i + 2 * B];
      }
    freiE[e] = f;
    return f;
  };
  const frei = freiFuer(0);
  const istFreiIn = (f: Uint8Array, x: number, y: number): boolean => {
    const yi = Math.round(y);
    if (yi < 0 || yi >= H) return false;
    return f[yi * B + klemme(Math.round(x), 0, B - 1)] === 1;
  };
  const istFrei = (x: number, y: number): boolean => istFreiIn(frei, x, y);
  // Oberkante des Geländes (Median über die Spalten): darunter ziehen Wolkenschatten
  const gelaendeOben = (() => {
    const ys: number[] = [];
    for (let x = 0; x < B; x += 2) {
      let y = yMin;
      while (y < nacht && vorn0[y * B + x] === 0) y++;
      ys.push(y);
    }
    ys.sort((a, b) => a - b);
    return ys[ys.length >> 1];
  })();

  /* Palettenzyklen vorbereiten ------------------------------------------------------------------- */

  const z = welt.zyklen;
  const zn = z.index.length;
  const zBasis = new Int32Array(zn); // Bildindex bei Versatz 0
  const zx = new Int16Array(zn);
  const zy = new Int16Array(zn);
  const zStart = new Float32Array(zn); // Ab hier lebt der Pixel: Das Bild erwacht allmählich
  const zA = new Float32Array(zn); // Hilfswerte je Art (Intensität, Strahl, Reihe …)
  const zB = new Float32Array(zn);
  const zC = new Uint8Array(zn);
  const strahlNummer = new Map<number, number>();
  for (let s = 15; s >= 0; s--) strahlNummer.set((s * 37) & 255, s);
  const nebelStelle = new Set<number>();
  for (let k = 0; k < zn; k++) if (z.art[k] === ZYKLUS_NEBEL) nebelStelle.add(z.ebene[k] * 1e7 + z.index[k]);
  const sternStelle = new Set<number>();
  for (let k = 0; k < zn; k++) if (z.art[k] === ZYKLUS_STERN && z.farbe[k] === STERN) sternStelle.add(z.index[k]);
  // Mitte eines Funkelkreuzes: ein Stern mit drei oder vier Sternnachbarn
  const istMitte = (j: number) =>
    sternStelle.has(j) && (sternStelle.has(j - 1) ? 1 : 0) + (sternStelle.has(j + 1) ? 1 : 0) + (sternStelle.has(j - B) ? 1 : 0) + (sternStelle.has(j + B) ? 1 : 0) >= 3;
  for (let k = 0; k < zn; k++) {
    const x = z.index[k] % B;
    const ys = Math.floor(z.index[k] / B) - U;
    zx[k] = x;
    zy[k] = ys;
    zBasis[k] = ys * B + x;
    const art = z.art[k];
    // Das Bild erwacht Pixel für Pixel; die Sonnenscheibe und jeder Strahl als Ganzes, sonst zerfielen
    // ihre Linien in den ersten Sekunden
    zStart[k] = art === ZYKLUS_SCHEIBE ? 0.6 : art === ZYKLUS_STRAHL ? 0.3 + hash(z.phase[k], 7) * 2.2 : 0.3 + hash(k, 1) * 2.2;
    const s0 = schwelle(x, ys + U); // Bayer-Schwelle der Himmelsebene
    if (art === ZYKLUS_GLITZER) {
      // Stelle im Strichmuster (Periode 7) und wie viele Stellen leuchten: so wandern die Striche
      if (szene.landschaft === "wald") {
        zC[k] = (x + ((ys * 3) % 7) + 700) % 7;
        zB[k] = 2;
      } else {
        zC[k] = Math.round((z.phase[k] * 7) / 256) % 7;
        zB[k] = (ys - welt.ufer) % 2 ? 3 : 2;
      }
    } else if (art === ZYKLUS_STERN) {
      // Funkelkreuz: Mitte mit drei Nachbarn, Arme neben einer Mitte. Alle Arme eines Kreuzes schalten
      // gemeinsam (Phase der Mitte), sonst entstünden halbe Kreuze, die wie Ziffern aussehen.
      const i = z.index[k];
      const nb = (j: number) => (sternStelle.has(j) ? 1 : 0);
      const n = nb(i - 1) + nb(i + 1) + nb(i - B) + nb(i + B);
      zC[k] = z.farbe[k] === STERN_MATT ? 0 : n >= 3 ? 2 : n === 1 ? 3 : 1;
      zA[k] = hash(k, 2) * 9;
      if (zC[k] === 3) {
        const mitte = [i - 1, i + 1, i - B, i + B].find(istMitte);
        zA[k] = hash(mitte ?? i, 5) * 9;
      }
    } else if (art === ZYKLUS_STRAHL) {
      const d = Math.hypot(x - sx, ys - sy);
      const laenge = sonne?.strahlLaenge ?? Math.hypot(B, H) * 0.7;
      zA[k] = 0.36 * Math.max(0, 1 - d / laenge) ** 0.8;
      zB[k] = s0;
      zC[k] = strahlNummer.get(z.phase[k]) ?? 0;
    } else if (art === ZYKLUS_HOF) {
      const dx = x - sx;
      const dy = ys - sy;
      const rand = sonne?.hof ?? sr * 3.2;
      const dh = dy < 0 ? Math.hypot(dx, dy * (sonne?.stauchung ?? 1)) : Math.hypot(dx, dy);
      zA[k] = dh < rand ? (1 - dh / rand) ** 1.6 : 0;
      zB[k] = s0;
      zC[k] = Math.round(((Math.atan2(dy, dx) / (2 * Math.PI)) * 256 + 256) & 255);
    } else if (art === ZYKLUS_SCHEIBE) {
      const reihe = Math.round((z.phase[k] * sr) / 255);
      zA[k] = reihe;
      zB[k] = (reihe / sr) * 2.4;
    } else if (art === ZYKLUS_NEBEL) {
      // Zeile unter der Nebelkante: wie viele Nebel-Zyklen liegen direkt darüber
      let u = 0;
      while (u < 3 && nebelStelle.has(z.ebene[k] * 1e7 + z.index[k] - (u + 1) * B)) u++;
      zC[k] = u;
    }
  }

  /* Figuren, die der Wind biegt ---------------------------------------------------------------- */

  // Jede Figur mit absoluten Punkten, die Punkte nach Biegsamkeit sortiert (Spitze zuerst): So reicht es,
  // je Bild nur die Punkte anzufassen, die sich wirklich verschieben (siehe figurenEinordnen)
  const figuren = welt.figuren;
  const fn = figuren.length;
  const G = H + 2 * U;
  const { oben, fAb, fArt, fX, fEbene, pX, pY, pFarbe, pUnter, pB, pSpitze } = figurenEinordnen(figuren, B, H, windRichtung);
  const anzahlF = new Int32Array(fn); // so viele Punkte (von vorn) bewegen sich in diesem Bild
  const staerkeF = new Float32Array(fn);

  /* Wind: Böen ziehen über das Bild ----------------------------------------------------------- */

  interface Boe {
    x: number;
    tempo: number;
    breite: number;
    staerke: number;
  }
  const boeen: Boe[] = [];
  let naechsteBoe = 1 + rnd() * 2;
  const windSpalte = new Float32Array(B);

  /* Wasser: Wellenzeilen über den ganzen See, Ringe, wo ein Fisch steigt -------------------------- */

  const seeIndex: number[] = [];
  if (see && see.maske.length && !eisSee) {
    for (let y = Math.max(see.y0, yMin); y < Math.min(see.y1, nacht); y++)
      for (let x = 0; x < B; x++) if (see.maske[(y - see.y0) * B + x]) seeIndex.push(y * B + x);
  }
  const seePixel = Int32Array.from(seeIndex);
  const seeStart = new Float32Array(seePixel.length);
  for (let k = 0; k < seePixel.length; k++) seeStart[k] = 0.4 + hash(seePixel[k], 21) * 2.4;
  // Je Zeile ein eigener Wellengang: nahe Zeilen haben längere Striche und ziehen schneller
  const wPeriode = new Uint8Array(H);
  const wLaenge = new Uint8Array(H);
  const wTempo = new Float32Array(H);
  const wPhase = new Uint8Array(H);
  if (see) {
    for (let y = see.y0; y < see.y1 && y < H; y++) {
      const tiefe = klemme((y - see.y0) / Math.max(1, see.y1 - see.y0), 0, 1);
      wPeriode[y] = Math.round(10 + hash(y, 11) * 10 + tiefe * 8);
      wLaenge[y] = 1 + Math.round(tiefe * 2.5 + hash(y, 12));
      wTempo[y] = windRichtung * (0.5 + hash(y, 13) * 1.1) * (0.5 + tiefe) * Math.max(0.6, skala);
      wPhase[y] = Math.floor(hash(y, 14) * 200);
    }
  }
  const wellenSeg = new Uint8Array(H * (Math.ceil(B / 8) + 1)); // wo gerade Wellen laufen (Stücke je 8 px)
  const ringe: { x: number; y: number; start: number; gross: number }[] = [];
  let naechsterRing = 2 + rnd() * 4;
  const istSee = (x: number, y: number): boolean =>
    !!see && y >= see.y0 && y < see.y1 && x >= 0 && x < B && see.maske[(y - see.y0) * B + x] === 1;

  /* Wolkenschatten und Nebelschwaden ------------------------------------------------------------ */

  // Wolkenschatten ziehen über die Hänge, tags wie im Mondlicht: Fels und Wiese dunkeln je eine Stufe
  // ab, die Ränder im Raster. Im Nebel gibt es keine Schatten.
  interface Schatten {
    x: number;
    y: number;
    tempo: number;
    teile: number[]; // je Wolke drei Ellipsen: dx, dy, rx, ry
    breite: number;
    hoehe: number;
    // Maske relativ zur gerundeten Mitte, einmal gerechnet: Lage und Dichte der Schattenpixel. Der
    // Schatten ändert seine Form nicht, er zieht nur; so kostet ein Bild nur noch das Durchlaufen.
    mx: Int16Array;
    my: Int16Array;
    dichte: Float32Array;
  }
  const schattenAn = !welt.nebel && nacht - gelaendeOben > 12;
  const schattenNeu = (x: number): Schatten => {
    const breite = B * (0.16 + rnd() * 0.12);
    const hoehe = (nacht - gelaendeOben) * (0.14 + rnd() * 0.14);
    const teile: number[] = [];
    for (let n = 0; n < 3; n++)
      teile.push((n - 1) * breite * (0.25 + rnd() * 0.12), (rnd() - 0.5) * hoehe * 0.6, breite * (0.4 + rnd() * 0.2), hoehe * (0.55 + rnd() * 0.4));
    const mx: number[] = [];
    const my: number[] = [];
    const dichte: number[] = [];
    const rx = Math.ceil(breite * 1.3);
    const ry = Math.ceil(hoehe * 1.2);
    for (let dy = -ry; dy <= ry; dy++)
      for (let dx = -rx; dx <= rx; dx++) {
        let m = 0;
        for (let k = 0; k < 12; k += 4) {
          const nx = (dx - teile[k]) / teile[k + 2];
          const ny = (dy - teile[k + 1]) / teile[k + 3];
          const q = 1 - nx * nx - ny * ny;
          if (q > 0) m += q; // Die Teile verschmelzen zu einer Wolke
        }
        if (m <= 0) continue;
        mx.push(dx);
        my.push(dy);
        // Im Kern dicht, aber nie ganz geschlossen: Der Schatten bleibt ein Hauch, kein Loch
        dichte.push(Math.min(0.88, m * 2));
      }
    return {
      x,
      y: gelaendeOben + 2 + rnd() * Math.max(1, nacht - gelaendeOben - hoehe * 0.5 - 4),
      tempo: (B / 110) * (0.8 + rnd() * 0.4),
      teile,
      breite,
      hoehe,
      mx: Int16Array.from(mx),
      my: Int16Array.from(my),
      dichte: Float32Array.from(dichte),
    };
  };
  const schatten: Schatten[] = [];
  if (schattenAn) {
    const zahl = B >= 250 ? 2 : 1;
    for (let n = 0; n < zahl; n++) schatten.push(schattenNeu(B * ((n + 0.2 + rnd() * 0.6) / zahl)));
  }
  // Nebelschwaden: Wo die Szene Nebel hat, ziehen lange, gerasterte Bänder langsam vor den Hängen her
  interface Schwade {
    x: number;
    y: number;
    breite: number;
    hoehe: number;
    tempo: number;
    saat: number;
  }
  const schwaden: Schwade[] = [];
  let nebelOben = -1;
  let nebelUnten = -1;
  if (welt.nebel) {
    for (let y = yMin; y < nacht; y++) {
      let n = 0;
      for (let x = 0; x < B; x++) {
        const f = szene.farbe[y * B + x];
        if (f === NEBEL || f === NEBEL_TIEF) n++;
      }
      if (n >= B * 0.06) {
        if (nebelOben < 0) nebelOben = y;
        nebelUnten = y;
      }
    }
    if (nebelOben >= 0) {
      const zahl = B >= 250 ? 5 : 3;
      for (let n = 0; n < zahl; n++) {
        schwaden.push({
          x: rnd() * B,
          // Die meisten lösen sich unten aus der Nebelbank und ziehen vor den Hängen, einige oben
          y: n % 3 === 2 ? nebelOben - rnd() * H * 0.03 : nebelUnten - H * 0.01 + rnd() * Math.max(3, (nacht - nebelUnten) * 0.3),
          breite: B * (0.12 + rnd() * 0.16),
          hoehe: Math.max(2, H * (0.012 + rnd() * 0.018)),
          tempo: windRichtung * (0.5 + rnd() * 1.1) * Math.max(0.6, skala),
          saat: rnd() * 100,
        });
      }
    }
  }

  /* Sprites und Teilchen ------------------------------------------------------------------------ */

  // Gämse
  const gratPfade = welt.pfade.filter((p) => p.art === "gaemse");
  const bockKlein = B < 220;
  const boecke = gratPfade.slice(0, rnd() < 0.5 ? 2 : 1).map((p, n) => ({
    pfad: p,
    s: (p.punkte.length / 2 - 1) * (0.2 + rnd() * 0.6),
    richtung: rnd() < 0.5 ? 1 : -1,
    zustand: n === 0 ? "gehen" : "aesen",
    bis: 1 + rnd() * 3,
    blick: 0,
    sprung: -1, // Startzeit eines Sprungs
    takt: 0,
  }));
  // Gondel der Seilbahn
  const seil = welt.pfade.find((p) => p.art === "seilbahn");
  const kabineForm = kabine(B < 220 ? KABINE_KLEIN : KABINE_GROSS);
  const gondel = seil ? { s: rnd() * (seil.punkte.length / 2 - 1), richtung: rnd() < 0.5 ? 1 : -1, warten: 1 + rnd() * 3 } : null;
  // Wanderer auf Fußweg und Hängebrücke: tritt aus der Hütte, geht ein Stück und kehrt um; über die
  // Brücke geht er von einem Ende zum anderen
  const wanderer = welt.pfade
    .filter((p) => p.art === "weg" || p.art === "bruecke")
    .slice(0, 1)
    .map((p) => ({
      pfad: p,
      s: p.art === "weg" ? 0 : rnd() < 0.5 ? 0 : p.punkte.length / 2 - 1,
      richtung: 1,
      warten: 3 + rnd() * 6,
      takt: 0,
    }));
  for (const w of wanderer) if (w.s > 0) w.richtung = -1;
  // Gleitschirm: nicht bei Föhn; an den Enden der Bahn wird er langsamer und wendet weich
  const schirmPfad = szene.stimmung === "foehn" ? undefined : welt.pfade.find((p) => p.art === "gleitschirm");
  const schirm = schirmPfad ? { s: (schirmPfad.punkte.length / 2 - 1) * (0.2 + rnd() * 0.6), richtung: rnd() < 0.5 ? 1 : -1, warten: 0 } : null;
  // Rauch: aus jeder Rauchfigur steigt eine Fahne aus Teilchen
  const kamine = figuren.filter((f) => f.art === "rauch").map((f) => ({ f, teilchen: [] as Teilchen[], takt: 0 }));
  const rauchTempo = Math.max(2.2, H * 0.022);
  const rauchSchritt = (k: (typeof kamine)[number], dt: number, wind: number) => {
    if (dt <= 0) return;
    k.takt -= dt;
    while (k.takt <= 0) {
      k.takt += 0.13 + rnd() * 0.08;
      k.teilchen.push({
        x: k.f.x + (rnd() - 0.5) * 0.8,
        y: k.f.y - 1,
        vx: 0,
        vy: -rauchTempo * (0.85 + rnd() * 0.3),
        alter: 0,
        dauer: (k.f.hoehe / rauchTempo) * (1 + rnd() * 0.35),
        saat: rnd() * 6.28,
      });
    }
    let n = 0;
    for (const p of k.teilchen) {
      p.alter += dt;
      const a = p.alter / p.dauer;
      p.x += (windRichtung * (0.5 + a * 1.6) * (0.6 + wind * 1.8) + Math.sin(p.alter * 1.7 + p.saat) * 0.5) * dt;
      p.y += p.vy * (1 - a * 0.35) * dt;
      if (p.alter < p.dauer) k.teilchen[n++] = p;
    }
    k.teilchen.length = n;
  };
  // Die Fahne steht schon, wenn das Leben beginnt
  for (const k of kamine) for (let n = 0; n < 60; n++) rauchSchritt(k, 0.1, 0.2);

  // Schneefall im Winter
  const flocken = winter ? Math.round((B * H) / 260) : 0;
  const fx = new Float32Array(flocken);
  const fy = new Float32Array(flocken);
  const fv = new Float32Array(flocken);
  const fp = new Float32Array(flocken);
  for (let k = 0; k < flocken; k++) {
    fx[k] = rnd() * B;
    fy[k] = yMin + rnd() * (nacht - yMin);
    const nah = rnd();
    fv[k] = (3 + nah * nah * 9) * Math.max(0.6, H / 165);
    fp[k] = rnd() * 6.28;
  }
  // Glühwürmchen in warmen Nächten über Wiese, Wald und Ufer
  const warm =
    !winter &&
    ["sommer", "mittag", "alpengluehen"].includes(szene.stimmung) &&
    szene.landschaft !== "gipfelgrat" &&
    szene.landschaft !== "gletscher";
  const gluehen: Teilchen[] = [];
  if (warm) {
    const zahl = klemme(Math.round(B / 34), 3, 14);
    for (let n = 0, versuch = 0; n < zahl && versuch < 400; versuch++) {
      const x = 2 + rnd() * (B - 4);
      const y = welt.ufer - H * 0.12 + rnd() * (nacht - welt.ufer + H * 0.1);
      const i = Math.round(y) * B + Math.round(x);
      if (y < yMin + 4 || y >= nacht - 2 || vorn0[i] !== 3 || hud2(x, y) < 64) continue;
      gluehen.push({ x, y, vx: 0, vy: 0, alter: rnd() * 4, dauer: 2.4 + rnd() * 2.2, saat: rnd() * 6.28 });
      n++;
    }
  }

  /* Kreisende Vögel: Dohlen um die Felstürme, ein Bussard über dem Tal ---------------------------- */

  // Die Bahn ist eine flache Ellipse. Auf der vorderen Hälfte fliegen die Dohlen vor dem Turm, auf der
  // hinteren hinter ihm: So entsteht Tiefe, ohne dass sich etwas überschneidet.
  interface Kreis {
    cx: number;
    cy: number;
    rx: number;
    ry: number;
    e: number; // Ebene des Turms (Bahn in deren Szenenkoordinaten)
    omega: number;
    bussard: boolean;
    voegel: Kreiser[];
    schreck: number; // aufgeschreckt: weitere, schnellere Kreise
    gross: boolean;
  }
  // Die Bahn samt Spielraum für Drift, Streuung und Schreck (bis knapp das Doppelte) bleibt fern von
  // Sonne und HUD; im Bild und unter der Kante muss nur die Grundbahn liegen
  const bahnPasst = (cx: number, cy: number, rx: number, ry: number, rand: number): boolean => {
    for (let n = 0; n < 24; n++) {
      const a = (n / 24) * Math.PI * 2;
      const x = cx + Math.cos(a) * rx * 1.15;
      const y = cy + Math.sin(a) * ry * 1.15;
      if (x < 4 || x > B - 5 || y < yMin + 4 || y > H * 0.72) return false;
      const xw = cx + Math.cos(a) * rx * 1.95;
      const yw = cy + Math.sin(a) * ry * 1.95;
      if ((xw - sx) ** 2 + (yw - sy) ** 2 < (sr + rand) ** 2 || !hudFern(xw, yw, 100)) return false;
    }
    return true;
  };
  let kreis: Kreis | null = null;
  const dohlenLand = ["dolomiten", "gipfelgrat", "gletscher", "klamm"].includes(szene.landschaft);
  if (dohlenLand) {
    // Der höchste Turm (Kamm mit Spitze), der eine Bahn ringsum zulässt
    const rx = klemme(B * 0.045, 7, 24);
    const ry = rx * 0.4;
    const spitzen: { x: number; y: number; e: number }[] = [];
    for (const k of welt.kaemme) {
      if (k.ebene < 1) continue;
      for (let x = Math.round(B * 0.1); x < B * 0.9; x++) {
        const y = k.y[x];
        let spitze = true;
        for (let d = -6; d <= 6 && spitze; d++) if (d && k.y[klemme(x + d, 0, B - 1)] < y) spitze = false;
        if (spitze && y > yMin + 6 && vorn0[klemme(y, 0, H - 1) * B + x] === k.ebene) spitzen.push({ x, y, e: k.ebene });
      }
    }
    spitzen.sort((a, b) => a.y - b.y);
    for (const p of spitzen) {
      const cy = p.y + 1;
      if (!bahnPasst(p.x, cy, rx, ry, 4)) continue;
      const zahl = 2 + Math.floor(rnd() * 3);
      kreis = { cx: p.x, cy, rx, ry, e: p.e, omega: ((rnd() < 0.5 ? 1 : -1) * Math.PI * 2) / (11 + rnd() * 4), bussard: false, voegel: [], schreck: 0, gross: B > 300 };
      for (let n = 0; n < zahl; n++)
        kreis.voegel.push({ phase: (n / zahl) * Math.PI * 2 + rnd() * 0.8, radius: 0.8 + rnd() * 0.35, hub: rnd() * 6.28, takt: rnd() * 4, gleiten: rnd() * 2, schlaegt: rnd() < 0.5 });
      break;
    }
  } else if (rnd() < 0.8) {
    // Ein Bussard zieht hoch über dem Tal seine Kreise
    const rx = klemme(B * 0.06, 9, 30);
    const ry = rx * 0.3;
    for (let versuch = 0; versuch < 30; versuch++) {
      const cx = B * (0.18 + rnd() * 0.64);
      const cy = yMin + ry + 4 + rnd() * Math.max(1, gelaendeOben - yMin - ry * 2 - 6);
      if (!bahnPasst(cx, cy, rx, ry, 6)) continue;
      let sichtbar = 0;
      for (let n = 0; n < 16; n++) if (istFrei(cx + Math.cos((n / 16) * 6.28) * rx, cy + Math.sin((n / 16) * 6.28) * ry)) sichtbar++;
      if (sichtbar < 13) continue;
      kreis = { cx, cy, rx, ry, e: 1, omega: ((rnd() < 0.5 ? 1 : -1) * Math.PI * 2) / (17 + rnd() * 6), bussard: true, voegel: [], schreck: 0, gross: B >= 250 };
      kreis.voegel.push({ phase: rnd() * 6.28, radius: 1, hub: 0, takt: 0, gleiten: 4 + rnd() * 4, schlaegt: false });
      break;
    }
  }

  /* Vögel, Fledermaus, Sternschnuppe, Funkeln an der Sonne -------------------------------------- */

  let schwarm: Schwarm | null = null;
  let naechsterSchwarm = 1.5 + rnd() * 2.5; // der erste Schwarm kommt bald
  const vogelTempo = Math.max(5, B / 22);
  // Flugroute quer durch den Himmel: je Spalte eine Höhe, höchstens ein Pixel Steigung auf vier Spalten.
  // Kürzeste Bahn (dynamische Programmierung auf einem Raster von vier Spalten) nahe einer Wunschhöhe,
  // die sanft schwingt. Hinter Graten darf sie nur ungern verlaufen; danach wird sie geglättet. Ist sie
  // zu oft verdeckt, gibt es diesmal keinen Schwarm.
  const RS = 4;
  const RC = Math.ceil((B - 1) / RS) + 1;
  // Je Ebene ein grobes Raster: 0 gesperrt, 1 verdeckt passierbar, 2 freie Bahn
  const zellen: (Uint8Array | null)[] = [null, null, null];
  const zelleFuer = (e: number): Uint8Array => {
    const fertig = zellen[e];
    if (fertig) return fertig;
    const fe = freiFuer(e);
    const zelle = new Uint8Array(RC * H);
    for (let c = 0; c < RC; c++) {
      const xm = Math.min(B - 1, c * RS);
      for (let y = 0; y < H; y++) {
        let w = 2;
        for (let x = Math.max(0, xm - 2); x <= Math.min(B - 1, xm + 2) && w; x++) {
          const i = y * B + x;
          if (!passierbar[i]) w = 0;
          else if (!fe[i]) w = 1;
        }
        zelle[c * H + y] = w;
      }
    }
    zellen[e] = zelle;
    return zelle;
  };
  const kosten = new Float32Array(RC * H);
  const zurueck = new Int8Array(RC * H);
  const grob = new Float32Array(RC);
  const routeBauen = (richtung: number, y0: number, e: number, mindestens: number): Float32Array | null => {
    const zelle = zelleFuer(e);
    const welle = rnd() * 6.28;
    const spalte = (n: number) => (richtung === 1 ? n : RC - 1 - n);
    kosten.fill(Infinity);
    for (let y = 1; y < H - 1; y++) {
      const w = zelle[spalte(0) * H + y];
      if (w) kosten[y] = Math.abs(y - y0) * 0.3 + (w === 1 ? 60 : 0);
    }
    for (let n = 1; n < RC; n++) {
      const c = spalte(n);
      const wunsch = y0 + Math.sin(n * RS * 0.012 + welle) * H * 0.035;
      let erreichbar = false;
      for (let y = 1; y < H - 1; y++) {
        const w = zelle[c * H + y];
        if (!w) continue;
        let best = Infinity;
        let wahl = 0;
        for (let d = -1; d <= 1; d++) {
          const k = kosten[(n - 1) * H + y + d] + (d ? 0.6 : 0);
          if (k < best) {
            best = k;
            wahl = d;
          }
        }
        if (best === Infinity) continue;
        kosten[n * H + y] = best + Math.abs(y - wunsch) * 0.08 + (w === 1 ? 60 : 0);
        zurueck[n * H + y] = wahl;
        erreichbar = true;
      }
      if (!erreichbar) return null;
    }
    let y = -1;
    for (let yy = 0, best = Infinity; yy < H; yy++)
      if (kosten[(RC - 1) * H + yy] < best) {
        best = kosten[(RC - 1) * H + yy];
        y = yy;
      }
    if (y < 0) return null;
    for (let n = RC - 1; n >= 0; n--) {
      grob[spalte(n)] = y;
      if (n) y += zurueck[n * H + y];
    }
    // Je Spalte zwischen den Rasterpunkten mitteln, dann zweimal glätten: weiche Bögen statt Knicke
    let route = new Float32Array(B);
    for (let x = 0; x < B; x++) {
      const c = Math.min(RC - 2, Math.floor(x / RS));
      const u = Math.min(1, (x - c * RS) / Math.max(1, Math.min(B - 1, (c + 1) * RS) - c * RS));
      route[x] = grob[c] * (1 - u) + grob[c + 1] * u;
    }
    for (let durchgang = 0; durchgang < 2; durchgang++) {
      const glatt = new Float32Array(B);
      for (let x = 0; x < B; x++) {
        let s = 0;
        let n = 0;
        for (let d = -8; d <= 8; d++) {
          const xx = x + d;
          if (xx < 0 || xx >= B) continue;
          s += route[xx];
          n++;
        }
        glatt[x] = s / n;
      }
      route = glatt;
    }
    // Die Bahn muss großteils zu sehen sein; Lücken hinter Graten oder der Scheibe sind erlaubt
    const fe = freiFuer(e);
    let sichtbar = 0;
    for (let x = 0; x < B; x++) if (istFreiIn(fe, x, route[x])) sichtbar++;
    return sichtbar >= B * mindestens ? route : null;
  };
  const vogelNeu = (x: number, y: number, ox: number, oy: number, gross: boolean): Vogel => ({
    x,
    y,
    vx: 0,
    vy: 0,
    ox,
    oy,
    gross,
    takt: rnd() * 4,
    gleiten: rnd() * 2,
    schlaegt: true,
    schreck: 0,
    vorne: false,
  });
  // Wunschhöhe für einen Schwarm der Ebene e: eine Zeile mit viel freier Bahn
  const wunschHoehe = (e: number): number => {
    const fe = freiFuer(e);
    const unten = e ? H * 0.62 : H * 0.45;
    let best = -1;
    let y0 = Math.round(yMin + 3 + rnd() * (unten - yMin));
    for (let n = 0; n < 14; n++) {
      const y = Math.round(yMin + 3 + rnd() * (unten - yMin));
      let z = 0;
      for (let x = 0; x < B; x += 3) z += fe[y * B + x];
      if (z > best) {
        best = z;
        y0 = y;
      }
      if (z * 3 >= B * 0.5) break;
    }
    return y0;
  };
  // Ein Schwarm zieht am liebsten durch den freien Himmel; ist der zu schmal (Sonne, HUD, hohe Tannen),
  // fliegt er weiter vorn, vor den fernen Graten. Erst zuletzt reicht eine Bahn, die nur zur Hälfte oder
  // zu einem Drittel zu sehen ist (der Schwarm taucht hinter Felsen ab und wieder auf). So fliegen in
  // jeder Tagesszene Vögel.
  const schwarmStarten = (): boolean => {
    let richtung = rnd() < 0.5 ? 1 : -1;
    let route: Float32Array | null = null;
    let ebene = 0;
    const ebenen = rnd() < 0.65 ? [0, 1, 2] : [1, 0, 2];
    const MINDESTENS = [0.72, 0.5, 0.35];
    for (let stufe = 0; stufe < 3 && !route; stufe++)
      for (const e of ebenen) {
        for (let versuch = 0; versuch < 3 && !route; versuch++) {
          if (versuch === 1) richtung = -richtung;
          route = routeBauen(richtung, wunschHoehe(e), e, MINDESTENS[stufe]);
        }
        if (route) {
          ebene = e;
          break;
        }
      }
    if (!route) return false;
    const zahl = 2 + Math.floor(rnd() * (B > 250 ? 6 : 3));
    const x = richtung === 1 ? -8 : B + 8;
    const y = route[richtung === 1 ? 0 : B - 1];
    const voegel: Vogel[] = [];
    const keil = rnd() < 0.6; // Keil oder lockerer Trupp
    // Jeder Vogel hält Abstand zu den anderen: Klumpen läsen sich als Krakel, nicht als Schwarm
    const weit = B > 250 ? 7 : 5;
    for (let n = 0; n < zahl; n++) {
      const reihe = Math.ceil(n / 2);
      const seite = n % 2 ? 1 : -1;
      let ox = 0;
      let oy = 0;
      for (let versuch = 0; versuch < 12; versuch++) {
        ox = -(keil ? reihe * (weit + 1) : rnd() * (weit * 4)) + (rnd() - 0.5) * 2;
        oy = keil ? seite * reihe * (weit * 0.55) : (rnd() - 0.5) * weit * 2.4;
        if (voegel.every((a) => Math.abs(a.ox - ox) >= weit || Math.abs(a.oy - oy) >= weit * 0.6)) break;
      }
      const b = vogelNeu(x + richtung * ox, y + oy, ox, oy, B > 250 && rnd() < 0.45);
      b.vx = richtung * vogelTempo;
      voegel.push(b);
    }
    schwarm = { richtung, x, y, ziel: y, tempo: vogelTempo * (0.85 + rnd() * 0.3), fort: false, voegel, route, ebene, frei: freiFuer(ebene) };
    return true;
  };

  interface Fledermaus {
    x: number;
    y: number;
    vx: number;
    vy: number;
    wechsel: number;
    ziele: number[]; // x, y, x, y …: Wegpunkte, zuletzt der nähere Rand
    ende: number; // spätestens dann ist sie fort
    takt: number;
    fort: boolean;
  }
  let fledermaus: Fledermaus | null = null;
  let naechsteFledermaus = 6 + rnd() * 10;
  let schnuppe: { x: number; y: number; dx: number; dy: number; start: number; dauer: number; laenge: number; weite: number } | null = null;
  let naechsteSchnuppe = 4 + rnd() * 10;
  let schnuppeBei = -1; // ein Klick in der Nacht wünscht sich eine Sternschnuppe bei dieser Spalte
  const funkeln: { x: number; y: number; start: number; gross: number }[] = [];
  let naechstesFunkeln = 0.6 + rnd() * 0.8;
  // Rand der Sonnenscheibe (Himmelskoordinaten): obere Hälfte, ein bis zwei Pixel breit
  const randGlanz: number[] = [];
  if (sr >= 4)
    for (let y = Math.floor(sy - sr - 1); y <= Math.ceil(sy); y++)
      for (let x = Math.floor(sx - sr - 1); x <= Math.ceil(sx + sr + 1); x++) {
        const d = Math.hypot(x - sx, y - sy);
        if (d <= sr + 0.2 && d > sr - (sr >= 12 ? 2.2 : 1.3) && x >= 0 && x < B && y >= 0) randGlanz.push(x, y);
      }
  // Glanzpunkte auf dem Wasser: Stellen der Glitzerspur
  const glitzerStellen: number[] = [];
  for (let k = 0; k < zn; k++) if (z.art[k] === ZYKLUS_GLITZER) glitzerStellen.push(k);
  const glanz: { x: number; y: number; e: number; start: number; gross: number }[] = [];
  let naechsterGlanz = 1 + rnd();

  let zeigerX = -1e9;
  let zeigerY = -1e9;
  let tAlt = 0;
  let jetzt = 0;
  let themaAlt: Thema | null = null;
  const zeile = new Uint8Array(B);
  const glitzerReihe = new Int8Array(H);
  const strahlM = new Float32Array(16);
  const v = [0, 0, 0, 0]; // Versatz je Ebene in diesem Bild
  let bild: Uint8Array = new Uint8Array(0); // Bild und vorn des laufenden Aufrufs
  let vorn: Uint8Array = new Uint8Array(0);
  let thema: Thema = "light";

  // Ein Pixel eines Sprites der Ebene e: sichtbar, wo vorn ≤ e (streng: vorn < e, hinter dem eigenen Kamm)
  const setze = (x: number, y: number, f: number, e: number, hudMin = 4, streng = false): boolean => {
    if (x < 0 || x >= B || y < yMin || y >= nacht) return false;
    const i = y * B + x;
    if ((streng ? vorn[i] >= e : vorn[i] > e) || unterHud[i] || hud2(x, y) < hudMin) return false;
    bild[i] = f;
    return true;
  };
  // Ein Sprite mit Papierrand. nurGelaende: Rand nur vor Gelände, damit Hof und Wolken heil bleiben
  const stempeln = (fo: Form, x: number, y: number, spiegel: number, farbe: number, e: number, hudMin: number, streng: boolean, nurGelaende: boolean): void => {
    const r = fo.r;
    for (let k = 0; k < r.length; k += 2) {
      const xx = x + r[k] * spiegel;
      const yy = y + r[k + 1];
      if (xx < 0 || xx >= B || yy < yMin || yy >= nacht) continue;
      if (nurGelaende && vorn[yy * B + xx] === 0) continue;
      setze(xx, yy, BOGEN, e, hudMin, streng);
    }
    const p = fo.p;
    for (let k = 0; k < p.length; k += 2) setze(x + p[k] * spiegel, y + p[k + 1], farbe, e, hudMin, streng);
  };

  // Läuft t zurück (ein neuer Bildbeginn für dasselbe Leben), rücken alle Zeitgeber mit
  const zeitVerschieben = (d: number): void => {
    naechsteBoe += d;
    naechsterSchwarm += d;
    naechsteFledermaus += d;
    naechsteSchnuppe += d;
    naechstesFunkeln += d;
    naechsterGlanz += d;
    for (const g of glanz) g.start += d;
    naechsterRing += d;
    for (const b of boecke) {
      b.bis += d;
      if (b.sprung >= 0) b.sprung += d;
    }
    if (schnuppe) schnuppe.start += d;
    if (fledermaus) fledermaus.ende += d;
    for (const f of funkeln) f.start += d;
    for (const r of ringe) r.start += d;
  };

  /* Zeichnen ------------------------------------------------------------------------------------- */

  function zeichnen(bildEin: Uint8Array, vornEin: Uint8Array, t: number, versatz: readonly number[], themaEin: Thema): void {
    if (!(t >= 0) || !Number.isFinite(t)) return;
    if (t < tAlt - 0.5) zeitVerschieben(t - tAlt);
    let dt = t - tAlt;
    if (dt < 0) dt = 0;
    dt = Math.min(dt, 0.1);
    tAlt = t;
    jetzt = t;
    bild = bildEin;
    vorn = vornEin;
    thema = themaEin;
    // Ein Themenwechsel: Was nur zu Tag oder Nacht gehört, verschwindet, statt eingefroren zu warten
    if (themaAlt !== null && themaAlt !== thema) {
      schwarm = null;
      fledermaus = null;
      schnuppe = null;
      funkeln.length = 0;
      glanz.length = 0;
    }
    themaAlt = thema;
    const nachts = thema === "dark";
    const anlauf = Math.min(1, t / 2.5);
    for (let e = 0; e < 4; e++) {
      const roh = versatz[e];
      v[e] = klemme(Math.round(Number.isFinite(roh) ? roh : 0), -TIEFE[e], TIEFE[e]);
    }

    /* Wind ---------------------------------------------------------------------------------- */
    if (t >= naechsteBoe) {
      naechsteBoe = t + 3 + rnd() * 6;
      const breite = B * (0.08 + rnd() * 0.1);
      boeen.push({ x: windRichtung === 1 ? -breite * 2 : B + breite * 2, tempo: B / (5 + rnd() * 4), breite, staerke: 0.45 + rnd() * 0.5 });
    }
    for (const b of boeen) b.x += windRichtung * b.tempo * dt;
    for (let n = boeen.length - 1; n >= 0; n--) if (boeen[n].x < -B * 0.5 || boeen[n].x > B * 1.5) boeen.splice(n, 1);
    for (let x = 0; x < B; x++) {
      let w = 0.16 + 0.1 * Math.sin(t * 0.37 + x * 0.013);
      for (const b of boeen) {
        const d = (x - b.x) / b.breite;
        if (d > -3 && d < 3) w += b.staerke * Math.exp(-d * d);
      }
      windSpalte[x] = w * anlauf;
    }

    /* Palettenzyklen ------------------------------------------------------------------------ */
    // Jede Zeile der Glitzerspur zittert für sich: Die Striche tanzen, statt gemeinsam zu wandern
    for (let y = 0; y < H; y++) glitzerReihe[y] = Math.round((rauschen(t * 1.1 + y * 0.37, y) - 0.5) * 4.4);
    const nStrahlen = Math.max(1, sonne?.strahlen ?? 7);
    for (let s = 0; s < 16; s++) {
      // Ein Lichtschein wandert langsam von Strahl zu Strahl: Die Strahlen scheinen zu kreisen
      const m = 0.55 + 0.45 * Math.cos(2 * Math.PI * (t / 14 - s / nStrahlen)) + 0.08 * Math.sin(t * 0.9 + s);
      strahlM[s] = Math.min(1, Math.round(m * 8) / 8);
    }
    const hofT = Math.floor(t * 4) / 4;
    const hofAtem = 0.08 * Math.sin(hofT * 1.1);
    const scheibe = Math.floor(t / 1.8) % 3;
    const fallSchritt = Math.floor(t * 9);
    const flussSchritt = Math.floor(t * 8);
    const funkelSchritt = Math.floor(t * 7);
    const nebelT = Math.floor(t * 3) / 3;
    for (let k = 0; k < zn; k++) {
      if (t < zStart[k]) continue;
      const e = z.ebene[k];
      const y = zy[k] + v[e];
      if (y < yMin || y >= nacht) continue;
      const i = zBasis[k] + v[e] * B;
      if (vorn[i] !== e || unterHud[i]) continue;
      const art = z.art[k];
      let f = z.grund[k];
      if (art === ZYKLUS_GLITZER) {
        const stelle = (((zC[k] + glitzerReihe[zy[k]]) % 7) + 7) % 7;
        if (stelle < zB[k]) f = z.farbe[k];
        else if (hash(k, funkelSchritt) < 0.018) f = GLITZER_HELL;
      } else if (art === ZYKLUS_STERN) {
        if (!nachts) continue;
        const typ = zC[k];
        const ph = zA[k];
        if (typ === 0) {
          if (hash(k, Math.floor(t * 1.3 + ph)) > 0.1) f = z.farbe[k];
          if (hash(k + 7919, Math.floor(t * 2 + ph)) < 0.012) f = STERN;
        } else if (typ === 1) f = hash(k, Math.floor(t * 2.5 + ph)) < 0.14 ? STERN_MATT : STERN;
        else if (typ === 2) f = STERN;
        else f = Math.sin(t * 0.8 + ph) > -0.25 ? STERN : z.grund[k];
      } else if (art === ZYKLUS_STRAHL) {
        if (nachts) continue;
        f = zA[k] * strahlM[zC[k]] > zB[k] ? STRAHL : BOGEN;
      } else if (art === ZYKLUS_HOF) {
        // Sechs hellere Fächer kreisen langsam um die Sonne (ein Umlauf in rund einer halben Minute)
        const m = 1 + 0.3 * Math.sin((zC[k] / 256) * Math.PI * 12 - hofT * 1.3) + hofAtem;
        const hof = zA[k] * m;
        const aus = z.grund[k] === GELB || z.grund[k] === HOF_RAND ? BOGEN : z.grund[k];
        f = hof > zB[k] ? (hof * Math.min(1, (zy[k] - weiss) / (H * 0.06)) > zB[k] ? GELB : HOF_RAND) : aus;
      } else if (art === ZYKLUS_SCHEIBE) {
        const reihe = zA[k];
        f = reihe > 0 && (((reihe - scheibe) % 3) + 3) % 3 < zB[k] ? BOGEN : MOND;
      } else if (art === ZYKLUS_WASSERFALL) {
        f = ((z.phase[k] - fallSchritt * 23) & 255) % 51 < 20 ? GISCHT : WASSERFALL;
        if (hash(k, funkelSchritt) < 0.04) f = GISCHT;
      } else if (art === ZYKLUS_GISCHT) {
        f = hash(k, Math.floor(t * 6 + z.phase[k] / 40)) < 0.55 ? z.farbe[k] : z.grund[k];
      } else if (art === ZYKLUS_WIESE) {
        if (windSpalte[zx[k]] > 0.34 + 0.5 * hash(k, 3)) f = z.farbe[k];
      } else if (art === ZYKLUS_FLUSS) {
        if (((z.phase[k] - flussSchritt * 9) & 255) < 22 && hash(zx[k] >> 1, zy[k]) < 0.7) f = z.farbe[k];
      } else if (art === ZYKLUS_EIS) {
        if (hash(k, Math.floor(t * 2.5 + z.phase[k] / 30)) < 0.035) f = z.farbe[k];
      } else if (art === ZYKLUS_NEBEL) {
        const x = zx[k];
        const stand =
          1.5 + 1.25 * Math.sin(x * 0.07 + nebelT * 0.35 + e) * Math.sin(x * 0.023 - nebelT * 0.21) + 0.3 * Math.sin(nebelT * 0.5);
        if (zC[k] >= 3 - Math.round(stand)) f = z.farbe[k];
      } else continue;
      bild[i] = f;
    }

    /* Wolken ziehen langsam mit dem Wind -------------------------------------------------- */
    if (wolken && wolken.index.length && horizont) {
      const sekunden = 1.6 * Math.sqrt(512 / B);
      const weg = Math.floor(t / sekunden) * windRichtung;
      const dx = ((weg % B) + B) % B;
      if (dx) {
        const { index, farbe, unter } = wolken;
        const v0 = v[0] * B;
        const sperrR = (sr + 1.5) ** 2;
        for (let k = 0; k < index.length; k++) {
          const j = index[k] - U * B; // Bildindex bei Versatz 0
          const y = (j / B) | 0;
          if (y + v[0] < yMin || y + v[0] >= nacht) continue;
          const i = j + v0;
          if (vorn[i] === 0 && !unterHud[i]) bild[i] = unter[k];
        }
        for (let k = 0; k < index.length; k++) {
          const j = index[k] - U * B;
          const y = (j / B) | 0;
          const x = (j - y * B + dx) % B;
          const yb = y + v[0];
          if (yb < yMin || yb >= nacht || y >= horizont[x] || hud2(x, y) < 9 || hud2(x, yb) < 9) continue;
          if ((x - sx) * (x - sx) + (y - sy) * (y - sy) <= sperrR) continue;
          const i = yb * B + x;
          if (vorn[i] === 0 && !unterHud[i]) bild[i] = farbe[k];
        }
      }
    }

    /* Der See: Die Spiegelung zittert, Wellenzeilen ziehen, Ringe breiten sich aus ------------ */
    if (see && see.maske.length) {
      const schritt = Math.floor(t * 5) / 5;
      for (let y = Math.max(see.y0, yMin); y < Math.min(see.y1, nacht); y++) {
        const o = Math.round(0.95 * Math.sin(y * 0.83 + schritt * 1.6) * Math.sin(schritt * 0.37 + y * 0.21) * anlauf);
        if (!o) continue;
        const r = y * B;
        const m = (y - see.y0) * B;
        zeile.set(bild.subarray(r, r + B));
        for (let x = Math.max(0, -o); x < Math.min(B, B - o); x++) {
          if (see.maske[m + x] && see.maske[m + x + o]) bild[r + x] = zeile[x + o];
        }
      }
    }
    if (seePixel.length && t > 0) wellenZeichnen(t);
    if (ringe.length || (seePixel.length && t >= naechsterRing)) ringeZeichnen(t);
    if (glitzerStellen.length && t > 0) wasserFunkeln(t);

    /* Figuren: Tannen und Gras wiegen sich, die Fahne flattert, das Boot schaukelt ---------- */
    if (fn) figurenBewegen(t);

    /* Wolkenschatten und Nebelschwaden ziehen über die Hänge ------------------------------- */
    if (schatten.length) schattenZeichnen(dt, anlauf);
    if (schwaden.length) schwadenZeichnen(t, dt, anlauf);

    /* Rauch ------------------------------------------------------------------------------- */
    // Je Pixel die Rauchfarbe, die sich vom Grund abhebt: eine Stufe dunkler als die Ferne vor Schnee und
    // hellem Himmel, hell vor dem Wald. Jedes Teilchen ist ein kleiner Bausch, der mit dem Alter wächst
    // und im Raster ausdünnt.
    const hl = hell[thema];
    for (const k of kamine) {
      rauchSchritt(k, dt, windSpalte[klemme(k.f.x, 0, B - 1)]);
      const e = k.f.ebene;
      for (const p of k.teilchen) {
        const a = p.alter / p.dauer;
        const r = 0.9 + a * 2.1;
        const dichte = 1.25 - a * 1.05;
        const px = p.x;
        const py = p.y + v[e];
        for (let y = Math.round(py - r); y <= Math.round(py + r); y++) {
          if (y < yMin || y >= nacht) continue;
          for (let x = Math.round(px - r); x <= Math.round(px + r); x++) {
            if (x < 0 || x >= B) continue;
            const d = ((x - px) ** 2 + (y - py) ** 2) / (r * r);
            if (d > 1 || dichte * (1 - d * 0.6) <= schwelle(x, y)) continue;
            const g = hl[bild[y * B + x]];
            let f = T2;
            if (Math.abs(hl[T2] - g) < 60) {
              f = Math.abs(hl[RAUCH] - g) >= 60 ? RAUCH : Math.abs(hl[RAUCH] - g) >= Math.abs(hl[T3] - g) ? RAUCH : T3;
            }
            setze(x, y, f, e);
          }
        }
      }
    }

    /* Tiere und Fahrzeuge in der Landschaft ------------------------------------------------ */
    if (nachts && boecke.length) gratSaumZeichnen();
    for (const bock of boecke) bockZeichnen(bock, t, dt);
    if (gondel && seil) {
      const n = seil.punkte.length / 2;
      if (gondel.warten > 0) gondel.warten -= dt;
      else {
        gondel.s += gondel.richtung * Math.max(1, 2 * skala) * dt;
        if (gondel.s <= 0 || gondel.s >= n - 1) {
          gondel.s = klemme(gondel.s, 0, n - 1);
          gondel.richtung *= -1;
          gondel.warten = 4 + rnd() * 4;
        }
      }
      const j = Math.round(gondel.s);
      const e = seil.ebene;
      const x = seil.punkte[2 * j];
      const y = seil.punkte[2 * j + 1] + v[e];
      // Laufwerk: zwei Rollen auf dem Seil, darunter der Bügel bis zum Dach
      for (const d of [-1, 1]) {
        const jj = klemme(j + d, 0, seil.punkte.length / 2 - 1);
        setze(seil.punkte[2 * jj], seil.punkte[2 * jj + 1] + v[e] - 1, SEIL, e, 9);
      }
      const buegel = kabineForm.hoehe > 3 ? 3 : 2;
      for (let d = 1; d < buegel; d++) setze(x, y + d, SEIL, e, 9);
      const y0 = y + buegel; // Dachzeile
      const { p, fenster, rand } = kabineForm;
      for (let k = 0; k < rand.length; k += 2) if (rand[k + 1] >= 0) setze(x + rand[k], y0 + rand[k + 1], BOGEN, e, 9);
      for (let k = 0; k < p.length; k += 2) setze(x + p[k], y0 + p[k + 1], HOLZ, e, 9);
      for (let k = 0; k < fenster.length; k += 2) setze(x + fenster[k], y0 + fenster[k + 1], FENSTER, e, 9);
    }
    for (const w of wanderer) wandererZeichnen(w, dt);
    if (schirm && schirmPfad && !nachts) {
      const n = schirmPfad.punkte.length / 2;
      if (schirm.warten > 0) schirm.warten -= dt;
      else {
        // Zu den Enden hin langsamer, dort ein kurzes Innehalten und eine weiche Wende
        const rest = Math.min(schirm.s, n - 1 - schirm.s);
        const tempo = Math.max(1.2, 3 * skala) * (0.35 + 0.65 * Math.min(1, rest / 12));
        schirm.s += schirm.richtung * tempo * dt;
        if (schirm.s <= 0 || schirm.s >= n - 1) {
          schirm.s = klemme(schirm.s, 0, n - 1);
          schirm.richtung *= -1;
          schirm.warten = 0.8 + rnd() * 0.8;
        }
      }
      const j = Math.round(schirm.s);
      const x = schirmPfad.punkte[2 * j];
      const y = schirmPfad.punkte[2 * j + 1] + v[0] + (Math.floor(t / 2.2) % 2);
      for (let k = 0; k < SCHIRM.length; k += 3) setze(x + SCHIRM[k], y + SCHIRM[k + 1], SCHIRM[k + 2], 0, 6);
    }

    /* Schneefall -------------------------------------------------------------------------- */
    if (flocken) {
      const sichtbar = Math.round(flocken * anlauf);
      for (let k = 0; k < flocken; k++) {
        const wind = windSpalte[klemme(Math.round(fx[k]), 0, B - 1)];
        fy[k] += fv[k] * dt;
        fx[k] += (windRichtung * wind * 9 * (fv[k] / 8) + Math.cos(t * 1.3 + fp[k]) * 1.6) * dt;
        if (fy[k] >= nacht) {
          fy[k] = yMin;
          fx[k] = rnd() * B;
        }
        if (fx[k] < 0) fx[k] += B;
        if (fx[k] >= B) fx[k] -= B;
        if (k >= sichtbar) continue;
        const x = Math.floor(fx[k]);
        const y = Math.floor(fy[k]);
        if (y < yMin || y >= nacht || hud2(x, y) < 4) continue;
        const i = y * B + x;
        const g = hl[bild[i]];
        bild[i] = Math.abs(hl[SCHNEE] - g) >= Math.abs(hl[SCHNEE_SCHATTEN] - g) ? SCHNEE : SCHNEE_SCHATTEN;
      }
    }

    /* Glühwürmchen ------------------------------------------------------------------------ */
    if (nachts && gluehen.length) {
      for (const p of gluehen) {
        p.alter += dt;
        p.vx += (rnd() - 0.5) * 6 * dt;
        p.vy += (rnd() - 0.5) * 4 * dt;
        p.vx = klemme(p.vx, -1.2, 1.2) * 0.98;
        p.vy = klemme(p.vy, -0.8, 0.8) * 0.98;
        const nx = p.x + p.vx * dt;
        const ny = p.y + p.vy * dt;
        const ni = Math.round(ny) * B + Math.round(nx);
        if (nx > 1 && nx < B - 2 && ny > yMin + 3 && ny < nacht - 2 && vorn0[ni] === 3) {
          p.x = nx;
          p.y = ny;
        } else {
          p.vx = -p.vx;
          p.vy = -p.vy;
        }
        const ph = (p.alter + p.saat) % p.dauer;
        if (ph < 0.9 * anlauf) setze(Math.round(p.x), Math.round(p.y), LAMPE, 3);
      }
    }

    /* Himmel: Vögel bei Tag, nachts Fledermaus und Sternschnuppe, Funkeln an der Sonne -------- */
    if (!nachts) {
      if (kreis) kreisZeichnen(kreis, t, dt);
      if (t > 0) vogelSchritt(dt, t);
      const s = schwarm as Schwarm | null;
      if (s) for (const b of s.voegel) vogelZeichnen(b, s.ebene);
      funkelnZeichnen(t);
    } else if (t > 0) {
      fledermausSchritt(dt, t);
      schnuppeZeichnen(t);
    }

    // Die Nähte bleiben exakt, was auch geschieht
    bild.fill(BOGEN, 0, weiss * B);
    bild.fill(T6, nacht * B);
  }

  /* See ----------------------------------------------------------------------------------------- */

  // Wellenzeilen: kurze, hellere Striche, die je Zeile mit eigenem Tempo ziehen; ein langsames Rauschen
  // entscheidet, in welchen Stücken der Zeile gerade Wellen laufen
  function wellenZeichnen(t: number): void {
    const s = see as SeeFlaeche;
    const segs = Math.ceil(B / 8) + 1;
    const y0 = Math.max(s.y0, yMin);
    const y1 = Math.min(s.y1, nacht);
    const tz = Math.floor(t * 2) / 2;
    for (let y = y0; y < y1; y++)
      for (let g = 0; g < segs; g++) wellenSeg[y * segs + g] = rauschen(g * 0.55 + tz * 0.09 * (1 + (y % 3)), y * 3 + 1) > 0.52 ? 1 : 0;
    const hz = heller[thema];
    for (let k = 0; k < seePixel.length; k++) {
      if (t < seeStart[k]) continue;
      const i = seePixel[k];
      const y = (i / B) | 0;
      const x = i - y * B;
      const p = wPeriode[y];
      const stelle = (((x + wPhase[y] - Math.floor(t * wTempo[y])) % p) + p) % p;
      if (stelle >= wLaenge[y] || !wellenSeg[y * segs + (x >> 3)]) continue;
      const f = bild[i];
      if (f === GLITZER || f === GLITZER_HELL) continue;
      bild[i] = hz[f];
    }
  }

  function ringeZeichnen(t: number): void {
    if (t >= naechsterRing && seePixel.length) {
      naechsterRing = t + 3 + rnd() * 6;
      if (ringe.length < 3) {
        const i = seePixel[Math.floor(rnd() * seePixel.length)];
        ringe.push({ x: i % B, y: (i / B) | 0, start: t, gross: (3 + rnd() * 3) * Math.max(1, Math.sqrt(skala)) });
      }
    }
    const h2 = heller2[thema];
    for (let n = ringe.length - 1; n >= 0; n--) {
      const r = ringe[n];
      // Zwei Ringe, der zweite folgt dem ersten
      let lebt = false;
      for (let welle = 0; welle < 2; welle++) {
        const a = (t - r.start - welle * 0.5) / 2.8;
        if (a < 0 || a >= 1) {
          if (a < 0) lebt = true;
          continue;
        }
        lebt = true;
        const rad = 1 + a * r.gross * (welle ? 0.75 : 1);
        const ry = Math.max(0.6, rad * 0.3);
        const dichte = a < 0.45 ? 1 : (1 - a) / 0.55;
        const schritte = Math.ceil(rad * 7) + 6;
        for (let k = 0; k < schritte; k++) {
          const w = (k / schritte) * Math.PI * 2;
          const x = Math.round(r.x + Math.cos(w) * rad);
          const y = Math.round(r.y + Math.sin(w) * ry);
          if (!istSee(x, y) || y < yMin || y >= nacht) continue;
          if (hash(x * 7 + welle, y) > dichte) continue;
          const i = y * B + x;
          bild[i] = h2[bild[i]];
        }
      }
      if (!lebt) ringe.splice(n, 1);
    }
  }

  /* Wolkenschatten und Nebelschwaden ------------------------------------------------------------ */

  function schattenZeichnen(dt: number, anlauf: number): void {
    const dz = dunkler[thema];
    for (let n = 0; n < schatten.length; n++) {
      let s = schatten[n];
      s.x += windRichtung * s.tempo * dt;
      const rand = s.breite * 1.3;
      if ((windRichtung > 0 && s.x - rand > B) || (windRichtung < 0 && s.x + rand < 0)) {
        s = schatten[n] = schattenNeu(windRichtung > 0 ? -rand : B + rand);
      }
      const cx = Math.round(s.x);
      const cy = Math.round(s.y);
      const { mx, my, dichte } = s;
      for (let k = 0; k < mx.length; k++) {
        const x = cx + mx[k];
        const y = cy + my[k];
        if (x < 0 || x >= B || y < yMin || y >= nacht) continue;
        const i = y * B + x;
        if (vorn[i] === 0 || unterHud[i] || dichte[k] * anlauf <= SCHWELLE[((y & 7) << 3) | (x & 7)]) continue;
        bild[i] = dz[bild[i]];
      }
    }
  }

  function schwadenZeichnen(t: number, dt: number, anlauf: number): void {
    for (const s of schwaden) {
      s.x += s.tempo * dt;
      if (s.x > B + s.breite) s.x -= B + 2 * s.breite;
      if (s.x < -s.breite) s.x += B + 2 * s.breite;
      const cx = Math.round(s.x);
      const ya = Math.max(yMin, Math.floor(s.y - s.hoehe));
      const yb = Math.min(nacht - 1, Math.ceil(s.y + s.hoehe));
      const x0 = Math.max(0, cx - Math.ceil(s.breite));
      const x1 = Math.min(B - 1, cx + Math.ceil(s.breite));
      const atem = 0.85 + 0.15 * Math.sin(Math.floor(t * 2) * 0.13 + s.saat);
      for (let y = ya; y <= yb; y++) {
        const ny = (y - s.y) / s.hoehe;
        const qy = 1 - ny * ny;
        if (qy <= 0) continue;
        for (let x = x0; x <= x1; x++) {
          const i = y * B + x;
          if (vorn[i] === 0 || unterHud[i]) continue;
          const nx = (x - cx) / s.breite;
          const qx = 1 - nx * nx;
          if (qx <= 0) continue;
          // Ausgefranst: ein Rauschen längs der Schwade lässt Lücken
          const d = Math.sqrt(qx) * qy * anlauf * atem * (0.45 + 0.55 * rauschen(x * 0.09 + s.saat, y));
          if (d <= schwelle(x, y)) continue;
          const f = bild[i];
          if (f !== NEBEL && f !== SCHNEE) bild[i] = NEBEL;
        }
      }
    }
  }

  /* Figuren ---------------------------------------------------------------------------------- */

  // Farbe hinter Ebene e an einer Bildstelle (für Figurpunkte über durchsichtigem Grund)
  function hinter(e: number, x: number, y: number): number {
    for (let n = e - 1; n >= 0; n--) {
      const f = lagen[n][(y - v[n] + U) * B + x];
      if (f !== LEER) return f;
    }
    return BOGEN;
  }

  function figurenBewegen(t: number): void {
    const flatter = Math.floor(t * 5) & 1;
    const schaukel = Math.floor(t / 1.6) % 2 === 1 && t > 1;
    let irgendwas = false;
    for (let n = 0; n < fn; n++) {
      const art = fArt[n];
      const a = fAb[n];
      const m = fAb[n + 1] - a;
      let zahl = 0;
      if (art === 1) {
        // In der Böe neigt sich die Figur, dazu ein leichtes Nachfedern
        const s = Math.max(0, windSpalte[klemme(fX[n], 0, B - 1)] - 0.12) * (0.8 + 0.2 * Math.sin(t * 2.3 + fX[n] * 0.37));
        staerkeF[n] = s;
        while (zahl < m && Math.abs(s * pB[a + zahl]) >= 0.5) zahl++;
      } else if (art === 2) zahl = flatter && windSpalte[klemme(fX[n], 0, B - 1)] > 0.3 ? m : 0;
      else if (art === 3) zahl = schaukel ? m : 0;
      else if (art === 4) zahl = m;
      anzahlF[n] = zahl;
      if (zahl) irgendwas = true;
    }
    if (!irgendwas) return;
    const BG = B * G;
    // Erst den Untergrund zurückschreiben, wo die Figur oben liegt …
    for (let n = fn - 1; n >= 0; n--) {
      const zahl = anzahlF[n];
      if (!zahl) continue;
      const e = fEbene[n];
      const a = fAb[n];
      for (let k = a; k < a + zahl; k++) {
        const x = pX[k];
        const ys = pY[k];
        if (x < 0 || x >= B || ys < -U || ys >= H + U) continue;
        if (oben[e * BG + (ys + U) * B + x] !== n) continue;
        const y = ys + v[e];
        if (y < yMin || y >= nacht) continue;
        const i = y * B + x;
        if (vorn[i] !== e || unterHud[i]) continue;
        const u = pUnter[k];
        bild[i] = u === LEER ? hinter(e, x, y) : u;
      }
    }
    // … dann gebogen neu stempeln, unter allem, was später auf derselben Ebene gemalt wurde
    for (let n = 0; n < fn; n++) {
      const zahl = anzahlF[n];
      if (!zahl) continue;
      const art = fArt[n];
      if (art === 4) continue; // statt der gemalten Fahne steigen Teilchen auf
      const e = fEbene[n];
      const s = staerkeF[n];
      const a = fAb[n];
      for (let k = a; k < a + zahl; k++) {
        let x = pX[k];
        let ys = pY[k];
        if (art === 1) x += Math.round(s * pB[k]);
        else if (art === 3 || pSpitze[k]) ys += 1;
        if (x < 0 || x >= B || ys < -U || ys >= H + U) continue;
        if (oben[e * BG + (ys + U) * B + x] > n) continue;
        const y = ys + v[e];
        if (y < yMin || y >= nacht) continue;
        const i = y * B + x;
        if (vorn[i] > e || unterHud[i]) continue;
        bild[i] = pFarbe[k];
      }
    }
  }

  /* Wanderer ------------------------------------------------------------------------------------- */

  type Geher = (typeof wanderer)[number];
  function wandererZeichnen(w: Geher, dt: number): void {
    const p = w.pfad;
    const n = p.punkte.length / 2;
    const weg = p.art === "weg";
    const ende = weg ? Math.floor((n - 1) * 0.5) : n - 1;
    if (w.warten > 0) {
      w.warten -= dt;
      return; // in der Hütte bzw. noch nicht auf der Brücke
    }
    w.s += w.richtung * Math.max(0.9, 1.6 * skala) * dt;
    w.takt += dt;
    if (w.s >= ende || w.s <= 0) {
      w.s = klemme(w.s, 0, ende);
      if (weg && w.s <= 0) {
        w.richtung = 1;
        w.warten = 18 + rnd() * 20; // wieder in der Hütte
      } else if (weg) w.richtung = -1;
      else {
        w.richtung *= -1;
        w.warten = 15 + rnd() * 25;
      }
      return;
    }
    const j = Math.round(w.s);
    const e = p.ebene;
    const x = p.punkte[2 * j];
    const y = p.punkte[2 * j + 1] + v[e] + (weg ? 0 : 1);
    // Blickrichtung: auf dem Weg nach der Seite, in die er sich bewegt
    const j2 = klemme(j + w.richtung * 3, 0, n - 1);
    const dx = p.punkte[2 * j2] - x;
    const blick = dx === 0 ? (weg ? 1 : w.richtung) : Math.sign(dx);
    const nr = Math.floor(w.takt / 0.32) & 1;
    const rand = WANDERER_RAND[nr];
    for (let k = 0; k < rand.length; k += 2) setze(x + rand[k] * blick, y + rand[k + 1], BOGEN, e, 0);
    const fo = WANDERER_GEHT[nr];
    for (let k = 0; k < fo.length; k += 2) setze(x + fo[k] * blick, y + fo[k + 1], k === 0 ? LAMPE : WANDERER, e, 0);
  }

  /* Gämse ---------------------------------------------------------------------------------------- */

  type Bock = (typeof boecke)[number];
  function bockZeichnen(bock: Bock, t: number, dt: number): void {
    const p = bock.pfad;
    const n = p.punkte.length / 2;
    const e = p.ebene;
    const tempo = Math.max(1.1, 2.4 * skala);
    const j0 = Math.round(bock.s);
    const bx = p.punkte[2 * j0];
    const byPfad = p.punkte[2 * j0 + 1];
    // Der Zeiger in der Nähe: Die Gämse bleibt stehen und schaut hin
    const nah = Math.hypot(zeigerX - bx, zeigerY - (byPfad + v[e] - 4));
    if (dt > 0 && bock.zustand !== "flucht" && nah < 22 + 10 * skala) {
      if (bock.zustand !== "sichern") bock.bis = t + 1.5;
      bock.zustand = "sichern";
      bock.blick = zeigerX > bx ? 1 : -1;
    }
    bock.takt += dt;
    if (dt > 0 && t >= bock.bis) {
      const r = rnd();
      if (bock.zustand === "flucht") {
        bock.zustand = "sichern";
        bock.bis = t + 2 + rnd() * 2;
      } else if (bock.zustand === "gehen") {
        bock.zustand = r < 0.45 ? "aesen" : r < 0.75 ? "stehen" : "sichern";
        bock.bis = t + 1.5 + rnd() * 3;
        bock.blick = rnd() < 0.5 ? 1 : -1;
      } else {
        bock.zustand = r < 0.65 ? "gehen" : "aesen";
        bock.bis = t + 2 + rnd() * 4;
        if (rnd() < 0.3) bock.richtung *= -1;
      }
    }
    const geht = bock.zustand === "gehen" || bock.zustand === "flucht";
    if (geht) {
      bock.s += bock.richtung * tempo * (bock.zustand === "flucht" ? 4 : 1) * dt;
      if (bock.s <= 0 || bock.s >= n - 1) {
        bock.s = klemme(bock.s, 0, n - 1);
        bock.richtung *= -1;
        if (bock.zustand === "gehen") {
          bock.zustand = "stehen";
          bock.bis = t + 1 + rnd() * 2;
        }
      }
    }
    const j = Math.round(bock.s);
    const x = p.punkte[2 * j];
    let y = p.punkte[2 * j + 1] + v[e];
    if (bock.sprung >= 0) {
      const a = (t - bock.sprung) / 0.45;
      if (a >= 1 || a < 0) bock.sprung = -1;
      else y -= Math.round(Math.sin(a * Math.PI) * 3);
    }
    const formen = bockKlein ? BOCK_KLEIN : BOCK;
    const schritt = Math.floor(bock.takt / (bock.zustand === "flucht" ? 0.1 : 0.28)) & 1;
    const fo =
      bock.zustand === "aesen"
        ? formen.aesen
        : bock.zustand === "sichern"
          ? formen.sichern
          : geht && schritt
            ? formen.schritt
            : formen.stehen;
    const blick = bock.zustand === "sichern" ? bock.blick : bock.richtung;
    // Die Gämse steht hinter dem Kamm ihrer eigenen Ebene: nur dort sichtbar, wo er nicht deckt
    stempeln(fo, x, y, blick, WANDERER, e, 16, true, false);
    if (thema === "dark") {
      // Nachts fängt der Rücken das Mondlicht: ein silberner Saum über Rücken und Hörnern
      const saum = BOCK_SAUM.get(fo) as number[];
      for (let k = 0; k < saum.length; k += 2) setze(x + saum[k] * blick, y + saum[k + 1], SAUM, e, 16, true);
    }
  }

  // Nachts liegt Mondlicht auf dem Grat, über den die Gämsen ziehen: Sonst liefen sie als dunkle Schatten
  // mitten durch die dunkle Flanke. Ein silberner Saum, zu den Enden des Pfads hin im Raster ausgedünnt.
  function gratSaumZeichnen(): void {
    for (const p of gratPfade.slice(0, boecke.length)) {
      const e = p.ebene;
      const n = p.punkte.length / 2;
      const rand = Math.max(3, n * 0.25);
      for (let j = 0; j < n; j++) {
        const x = p.punkte[2 * j];
        const y = p.punkte[2 * j + 1] + 1 + v[e];
        if (x < 0 || x >= B || y < yMin || y >= nacht) continue;
        const i = y * B + x;
        if (vorn[i] !== e || unterHud[i]) continue;
        const d = 0.8 * Math.min(1, (j + 1) / rand, (n - j) / rand);
        if (d > schwelle(x, y)) bild[i] = SAUM;
      }
    }
  }

  /* Vögel ---------------------------------------------------------------------------------------- */

  function vogelSchritt(dt: number, t: number): void {
    if (!schwarm && t >= naechsterSchwarm) {
      // Der nächste Schwarm folgt 20–35 s nach diesem, frühestens ein paar Sekunden, nachdem er das Bild
      // verlassen hat. Findet sich keine Bahn, versucht es der nächste bald.
      naechsterSchwarm = t + (schwarmStarten() ? 20 + rnd() * 15 : 3 + rnd() * 4);
    }
    const s = schwarm;
    if (!s) return;
    const ve = v[s.ebene];
    const zx = zeigerX;
    const zy = zeigerY - ve; // Zeiger in Koordinaten der Ebene des Schwarms
    // Leittier: folgt der Route; aufgeschreckt steigt der Schwarm und zieht davon, in der Höhe ausweichend
    if (!s.route) {
      const voraus = s.x + s.richtung * 16;
      if (!istFreiIn(s.frei, voraus, s.ziel)) {
        for (let d = 2; d < 50; d += 2) {
          if (istFreiIn(s.frei, voraus, s.ziel - d)) {
            s.ziel -= d;
            break;
          }
          if (istFreiIn(s.frei, voraus, s.ziel + d)) {
            s.ziel += d;
            break;
          }
        }
      }
    }
    s.x += s.richtung * s.tempo * dt;
    const route = s.route;
    const routeY = (x: number) => (route ? route[klemme(Math.round(x), 0, B - 1)] : s.ziel);
    s.y += klemme(routeY(s.x) - s.y, -s.tempo * 0.3 * dt, s.tempo * 0.3 * dt);
    let alleDraussen = true;
    for (const b of s.voegel) {
      const zielX = s.x + s.richtung * b.ox;
      let zielY = (route && !s.fort ? routeY(zielX) : s.y) + b.oy;
      const pi = klemme(Math.round(zielY), 0, H - 1) * B + klemme(Math.round(zielX), 0, B - 1);
      if (!s.fort && !(zielY >= 0 && zielY < H && passierbar[pi])) zielY = routeY(zielX);
      const ax = (zielX - b.x) * 1.6 - b.vx * 0.9 + s.richtung * s.tempo * 0.9;
      const ay = (zielY - b.y) * 1.6 - b.vy * 1.2;
      b.vx += ax * dt;
      b.vy += ay * dt;
      // Dem Zeiger ausweichen
      const dx = b.x - zx;
      const dy = b.y - zy;
      const d = Math.hypot(dx, dy);
      const radius = 14 + 8 * skala;
      if (d < radius && d > 0.01) {
        const k = ((radius - d) / radius) * 90 * dt;
        b.vx += (dx / d) * k;
        b.vy += (dy / d) * k;
        b.schreck = Math.max(b.schreck, 0.5);
      }
      if (b.schreck > 0) b.schreck -= dt;
      const grenze = s.tempo * (b.schreck > 0 ? 3 : 1.4);
      const tempo = Math.hypot(b.vx, b.vy);
      if (tempo > grenze) {
        b.vx *= grenze / tempo;
        b.vy *= grenze / tempo;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.takt += dt / (b.schreck > 0 ? 0.06 : b.gross ? 0.13 : 0.1);
      b.gleiten -= dt;
      if (b.gleiten <= 0) {
        b.schlaegt = !b.schlaegt || b.schreck > 0;
        b.gleiten = b.schlaegt ? 0.8 + rnd() * 1.2 : 1 + rnd() * 2;
      }
      if (b.x > -12 && b.x < B + 12 && b.y + ve > -12) alleDraussen = false;
    }
    if (alleDraussen && (s.fort || s.x < -40 || s.x > B + 40)) {
      schwarm = null;
      naechsterSchwarm = Math.max(naechsterSchwarm, t + 3 + rnd() * 5);
    }
  }

  const FOLGE = [0, 1, 2, 1];
  // Liegt eine Bildstelle auf der Sonnenscheibe (samt Schlitzen)? Die Scheibe zieht mit der Himmelsebene.
  const aufScheibe = (x: number, y: number): boolean => (x - sx) ** 2 + (y - v[0] - sy) ** 2 <= (sr + 0.7) ** 2;
  // Ein Vogel, der sich vom Grund abhebt: Tinte vor hellem Grund, Papier vor dunklem (für so kleine
  // Sprites liest sich das besser als ein Papierrand, der den Vogel zur Wolke machte)
  function kontrastVogel(p: number[], x: number, y: number, e: number, streng: boolean): void {
    const hl = hell[thema];
    for (let k = 0; k < p.length; k += 2) {
      const xx = x + p[k];
      const yy = y + p[k + 1];
      if (xx < 0 || xx >= B || yy < yMin || yy >= nacht) continue;
      const g = hl[bild[yy * B + xx]];
      if (aufScheibe(xx, yy)) continue; // die Scheibe liegt davor: Der Vogel zieht dahinter durch
      setze(xx, yy, Math.abs(hl[VOGEL] - g) < 70 ? BOGEN : VOGEL, e, 9, streng);
    }
  }
  function vogelZeichnen(b: Vogel, e: number): void {
    const formen = b.gross ? VOGEL_GROSS : VOGEL_KLEIN;
    const nr = b.schlaegt || b.schreck > 0 ? FOLGE[Math.floor(b.takt) & 3] : 1;
    const x = Math.round(b.x);
    const y = Math.round(b.y) + v[e];
    if (b.vorne || e > 0) {
      // Aus den Bäumen aufgeflogen: vor allem; vor dunklem Wald hell wie Papier. Ein Schwarm vor den
      // fernen Graten hebt sich ebenso ab, verschwindet aber hinter allem, was näher liegt.
      kontrastVogel(formen[nr].p, x, y, b.vorne ? 3 : e, false);
      return;
    }
    const p = formen[nr].p;
    for (let k = 0; k < p.length; k += 2) {
      const xx = x + p[k];
      const yy = y + p[k + 1];
      if (aufScheibe(xx, yy)) continue;
      setze(xx, yy, VOGEL, 0, 9);
    }
  }

  // Dohlen bzw. Bussard auf ihrer Bahn
  function kreisZeichnen(k: Kreis, t: number, dt: number): void {
    k.schreck = Math.max(0, k.schreck - dt);
    const wild = 1 + Math.min(1, k.schreck) * 0.4;
    const cx = k.cx + Math.sin(t * 0.031) * k.rx * 0.35;
    const cy = k.cy + Math.sin(t * 0.047 + 1) * k.ry * 0.3;
    const zx = zeigerX;
    const zy = zeigerY - v[k.e];
    for (const b of k.voegel) {
      b.phase += k.omega * wild * dt;
      b.takt += dt / (k.schreck > 0 ? 0.06 : k.bussard ? 0.22 : 0.1);
      b.gleiten -= dt;
      if (b.gleiten <= 0) {
        b.schlaegt = k.bussard ? !b.schlaegt && rnd() < 0.5 : !b.schlaegt;
        b.gleiten = b.schlaegt ? (k.bussard ? 0.7 : 0.6 + rnd()) : k.bussard ? 4 + rnd() * 5 : 1 + rnd() * 2;
      }
      let x = cx + Math.cos(b.phase) * k.rx * b.radius * wild;
      let y = cy + Math.sin(b.phase) * k.ry * b.radius * wild + Math.sin(t * 0.7 + b.hub) * 1.2;
      // Der Zeiger drängt sie ein Stück von der Bahn
      const d = Math.hypot(x - zx, y - zy);
      const radius = 10 + 6 * skala;
      if (d < radius && d > 0.01) {
        x += ((x - zx) / d) * (radius - d) * 0.8;
        y += ((y - zy) / d) * (radius - d) * 0.8;
      }
      const xi = Math.round(x);
      const yi = Math.round(y) + v[k.e];
      const schlag = b.schlaegt || k.schreck > 0;
      if (k.bussard) {
        const fo = k.gross ? BUSSARD[schlag && Math.floor(b.takt) & 1 ? 1 : 0] : VOGEL_GROSS[schlag ? FOLGE[Math.floor(b.takt) & 3] : 1];
        kontrastVogel(fo.p, xi, yi, 1, false);
        continue;
      }
      // Vordere Hälfte der Bahn vor dem Turm, hintere dahinter
      const vorne = Math.sin(b.phase) > 0;
      const formen = k.gross ? VOGEL_GROSS : VOGEL_KLEIN;
      kontrastVogel(formen[schlag ? FOLGE[Math.floor(b.takt) & 3] : 1].p, xi, yi, k.e, !vorne);
    }
  }

  /* Funkeln an der Sonne -------------------------------------------------------------------------- */

  // Die Sonne funkelt: Kleine Lichtsterne blühen versetzt im Hof auf (nie mehr als zwei Pixel Arm: lange
  // dünne Strahlen läsen sich als Fadenkreuz), und von Zeit zu Zeit läuft ein gelber Glanz über den Rand
  // der Scheibe. Auf dem Wasser blitzen einzelne Glanzpunkte in der Glitzerspur.
  function funkelnZeichnen(t: number): void {
    if (t > 0 && t >= naechstesFunkeln) {
      naechstesFunkeln = t + 0.22 + rnd() * 0.55;
      if (funkeln.length < 4)
        for (let versuch = 0; versuch < 6; versuch++) {
          const winkel = rnd() * Math.PI * 2;
          const r = sr + 2.5 + rnd() * Math.max(3, (sonne?.hof ?? sr * 2) * 0.42 - sr);
          const x = Math.round(sx + Math.cos(winkel) * r);
          const y = Math.round(sy + Math.sin(winkel) * r * 0.9);
          if (y - 3 <= yMin || y >= nacht || x < 2 || x >= B - 2 || hud2(x, y) < 64 || vorn0[y * B + x] !== 0) continue;
          if (funkeln.some((f) => Math.abs(f.x - x) + Math.abs(f.y - y) < 6)) continue;
          // Groß nur, wo die Sonne groß ist; die meisten bleiben klein
          funkeln.push({ x, y, start: t, gross: sr >= 9 && rnd() < 0.45 ? 2 : 1 });
          break;
        }
    }
    const punkt = (x: number, y: number, f: number) => {
      if (x < 0 || x >= B || y < yMin || y >= nacht) return;
      const i = y * B + x;
      if (vorn[i] !== 0 || unterHud[i] || aufScheibe(x, y)) return;
      bild[i] = f;
    };
    for (let n = funkeln.length - 1; n >= 0; n--) {
      const f = funkeln[n];
      // Blüht in Stufen auf und vergeht: Punkt, Stern, (großer Stern), Stern, Punkt
      const schritt = Math.floor((t - f.start) / 0.09);
      const folge = f.gross === 2 ? [0, 1, 2, 2, 1, 0] : [0, 1, 1, 0];
      if (schritt >= folge.length) {
        funkeln.splice(n, 1);
        continue;
      }
      const stufe = folge[schritt];
      const y0 = f.y + v[0];
      // In der Tinte der Scheibe; zur vollen Größe glüht die Mitte gelb auf
      if (stufe >= 1) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) punkt(f.x + a, y0 + b, MOND);
      if (stufe === 2) for (const [a, b] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) punkt(f.x + a, y0 + b, MOND);
      punkt(f.x, y0, stufe === 2 ? GELB : MOND);
    }
    // Glanz über den Rand der Scheibe: ein kurzer Bogen, der am oberen Rand entlangläuft
    if (randGlanz.length && t > 2) {
      const periode = 7;
      const a = (t % periode) / 1.6;
      if (a < 1) {
        const runde = Math.floor(t / periode);
        const richtung = runde % 2 ? 1 : -1;
        const mitte = -Math.PI / 2 + richtung * (a - 0.5) * Math.PI * 1.1;
        const breite = 0.32;
        for (let k = 0; k < randGlanz.length; k += 2) {
          const x = randGlanz[k];
          const y = randGlanz[k + 1];
          let d = Math.atan2(y - sy, x - sx) - mitte;
          d = Math.abs(((d + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          if (d > breite) continue;
          const yb = y + v[0];
          if (yb < yMin || yb >= nacht) continue;
          const i = yb * B + x;
          if (vorn[i] !== 0 || unterHud[i] || bild[i] !== MOND) continue;
          bild[i] = d < breite * 0.5 || (x + y) & 1 ? GELB : bild[i];
        }
      }
    }
  }

  // Glanzpunkte auf dem Wasser: in der Glitzerspur blitzt hier und da ein kleiner Stern auf
  function wasserFunkeln(t: number): void {
    if (t >= naechsterGlanz) {
      naechsterGlanz = t + 0.18 + rnd() * 0.5;
      if (glanz.length < 3) {
        const k = glitzerStellen[Math.floor(rnd() * glitzerStellen.length)];
        glanz.push({ x: zx[k], y: zy[k], e: z.ebene[k], start: t, gross: B >= 250 && rnd() < 0.4 ? 1 : 0 });
      }
    }
    for (let n = glanz.length - 1; n >= 0; n--) {
      const g = glanz[n];
      const schritt = Math.floor((t - g.start) / 0.08);
      if (schritt >= 4) {
        glanz.splice(n, 1);
        continue;
      }
      // Punkt, Stern (waagrecht gestreckt wie Licht auf Wellen), Punkt
      const stern = schritt === 1 || schritt === 2;
      const y = g.y + v[g.e];
      const ein = (dx: number, dy: number, f: number) => {
        const xx = g.x + dx;
        const yy = y + dy;
        if (xx < 0 || xx >= B || yy < yMin || yy >= nacht) return;
        const i = yy * B + xx;
        if (vorn[i] !== g.e || unterHud[i]) return;
        bild[i] = f;
      };
      ein(0, 0, GLITZER_HELL);
      if (stern) {
        ein(-1, 0, GLITZER_HELL);
        ein(1, 0, GLITZER_HELL);
        ein(0, -1, GLITZER_HELL);
        ein(0, 1, GLITZER_HELL);
        ein(-2, 0, GLITZER);
        ein(2, 0, GLITZER);
        if (g.gross && schritt === 2) {
          ein(-3, 0, GLITZER);
          ein(3, 0, GLITZER);
        }
      }
    }
  }

  /* Nacht: Fledermaus, Sternschnuppe -------------------------------------------------------------- */

  function fledermausSchritt(dt: number, t: number): void {
    if (winter) return; // im Winter schlafen auch die Fledermäuse
    if (!fledermaus && t >= naechsteFledermaus) {
      naechsteFledermaus = t + 28 + rnd() * 26;
      fledermausStarten(t, rnd() < 0.5);
    }
    const f = fledermaus;
    if (!f) return;
    const tempo = vogelTempo * (f.fort ? 1.5 : 1.1);
    // Nächster Wegpunkt; danach der nähere Rand
    if (!f.fort && f.ziele.length && Math.hypot(f.ziele[0] - f.x, (f.ziele[1] - f.y) * 1.6) < 6) f.ziele.splice(0, 2);
    if (!f.fort && !f.ziele.length) {
      f.fort = true;
      f.ziele.push(f.x < B / 2 ? -14 : B + 14, f.y);
    }
    if (t > f.ende) f.fort = true;
    f.wechsel -= dt;
    if (f.wechsel <= 0) {
      // Zickzack: alle paar Zehntelsekunden eine neue Richtung, im Ganzen zum Ziel
      f.wechsel = 0.15 + rnd() * 0.3;
      const zielX = f.ziele.length ? f.ziele[0] : f.x < B / 2 ? -14 : B + 14;
      const zielY = f.ziele.length ? f.ziele[1] : f.y;
      const a = Math.atan2(zielY - f.y, zielX - f.x) + (rnd() - 0.5) * (f.fort ? 1 : 1.8);
      f.vx = Math.cos(a) * tempo;
      f.vy = Math.sin(a) * tempo * 0.7;
    }
    // Vor dem Gelände weicht sie zur nächsten freien Höhe aus, nach oben oder unten
    const vorX = f.x + f.vx * 0.3;
    if (!f.fort && !istFrei(vorX, f.y + f.vy * 0.3)) {
      for (let d = 2; d < 40; d += 2) {
        if (istFrei(vorX, f.y + d)) {
          f.vy = tempo * 0.6;
          break;
        }
        if (istFrei(vorX, f.y - d)) {
          f.vy = -tempo * 0.6;
          break;
        }
      }
    }
    const zy = zeigerY - v[0];
    const dz = Math.hypot(f.x - zeigerX, f.y - zy);
    if (dz < 16 && dz > 0.01) {
      f.vx += ((f.x - zeigerX) / dz) * 60 * dt;
      f.vy += ((f.y - zy) / dz) * 60 * dt;
    }
    f.x += f.vx * dt;
    f.y = Math.max(yMin + 5 - v[0], f.y + f.vy * dt);
    f.takt += dt;
    if (f.x < -10 || f.x > B + 10 || t > f.ende + 6) {
      fledermaus = null;
      return;
    }
    const formen = B < 250 ? FLEDERMAUS_KLEIN : FLEDERMAUS;
    const x = Math.round(f.x);
    const y = Math.round(f.y) + v[0];
    // Nur vor dem Himmel; vor dem Mond steht sie als scharfe Silhouette
    const p = formen[Math.floor(f.takt / 0.07) % 3].p;
    for (let k = 0; k < p.length; k += 2) setze(x + p[k], y + p[k + 1], WANDERER, 0, 9);
  }
  // Start an einem Bildrand; Wegpunkte im freien Himmel, oft quer vor dem Mond
  function fledermausStarten(t: number, links: boolean, vonX?: number, vonY?: number): void {
    for (let versuch = 0; versuch < 30; versuch++) {
      const y = vonY ?? yMin + 6 + rnd() * (welt.ufer - yMin);
      const x = vonX ?? (links ? -4 : B + 3);
      if (vonX === undefined && !istFrei(links ? 2 : B - 3, y)) continue;
      const ziele: number[] = [];
      const zahl = 2 + Math.floor(rnd() * 2);
      const zumMond = rnd() < 0.55 && istFrei(sx, sy + sr + 4);
      for (let n = 0; n < zahl; n++) {
        if (zumMond && n === 1) {
          ziele.push(sx + (rnd() - 0.5) * sr, sy + (rnd() - 0.3) * sr * 0.8);
          continue;
        }
        for (let w = 0; w < 20; w++) {
          const zx = B * (0.1 + rnd() * 0.8);
          const zy = yMin + 6 + rnd() * (welt.ufer - yMin - 6);
          if (istFrei(zx, zy)) {
            ziele.push(zx, zy);
            break;
          }
        }
      }
      fledermaus = { x, y, vx: (links ? 1 : -1) * vogelTempo, vy: 0, wechsel: 0, ziele, ende: t + 8 + rnd() * 5, takt: 0, fort: false };
      return;
    }
  }

  function schnuppeZeichnen(t: number): void {
    if (!schnuppe && t >= naechsteSchnuppe) {
      // Hoch am Himmel, flach geneigt, und die Bahn liegt zum großen Teil im freien Himmel. Passt keine
      // Bahn, wird es bald noch einmal versucht (ein Klick wartet nicht eine halbe Minute).
      naechsteSchnuppe = t + 1.5;
      for (let versuch = 0; versuch < 60; versuch++) {
        const weite = Math.max(24, B * (versuch < 30 ? 0.3 : 0.2));
        const x = schnuppeBei >= 0 && versuch % 2 === 0 ? schnuppeBei + (rnd() - 0.5) * B * 0.4 : B * (0.05 + rnd() * 0.9);
        const y = yMin + 2 + rnd() * H * 0.18;
        const richtung = rnd() < 0.5 ? 1 : -1;
        const a = 0.18 + rnd() * 0.3;
        const dx = richtung * Math.cos(a);
        const dy = Math.sin(a);
        let gut = 0;
        for (let n = 0; n <= 10; n++) {
          const px = Math.round(x + (dx * weite * n) / 10);
          const py = Math.round(y + (dy * weite * n) / 10);
          if (px >= 0 && px < B && py >= 0 && py < H && welt.himmelFrei[py * B + px]) gut++;
        }
        if (gut < 8) continue;
        schnuppe = { x, y, dx, dy, start: t, dauer: 0.7 + rnd() * 0.4, laenge: Math.round(7 + rnd() * 5 + skala * 4), weite };
        naechsteSchnuppe = t + 14 + rnd() * 26;
        schnuppeBei = -1;
        break;
      }
    }
    const s = schnuppe;
    if (!s) return;
    const a = (t - s.start) / s.dauer;
    if (a >= 1 || a < 0) {
      schnuppe = null;
      return;
    }
    const weg = a * s.weite;
    // Gegen Ende verglüht sie: der Schweif wird kürzer
    const laenge = Math.round(s.laenge * (a < 0.7 ? 1 : (1 - a) / 0.3));
    for (let j = 0; j <= laenge; j++) {
      const x = Math.round(s.x + s.dx * (weg - j));
      const ys = Math.round(s.y + s.dy * (weg - j));
      const y = ys + v[0];
      if (x < 0 || x >= B || ys < 0 || ys >= H || y < yMin || y >= nacht) continue;
      const i = y * B + x;
      if (!welt.himmelFrei[ys * B + x] || vorn[i] !== 0 || unterHud[i]) continue;
      if (j === 0) bild[i] = SCHNUPPE;
      else if (j < laenge * 0.45) bild[i] = STERN;
      else if (j % 2 === 0) bild[i] = STERN_MATT;
    }
  }

  /* Ereignisse ------------------------------------------------------------------------------------ */

  return {
    zeichnen,
    zeiger(x: number, y: number) {
      zeigerX = x;
      zeigerY = y;
    },
    weg() {
      zeigerX = -1e9;
      zeigerY = -1e9;
    },
    stoss(x: number, y: number) {
      const nachts = themaAlt === "dark";
      const hy = y - v[0]; // Klick in Himmelskoordinaten
      // Ein Klick auf den See: Ringe breiten sich aus
      const xi = Math.round(x);
      const yi = Math.round(y);
      if (seePixel.length && istSee(xi, yi)) {
        ringe.push({ x: xi, y: yi, start: jetzt, gross: (9 + rnd() * 4) * Math.max(1, Math.sqrt(skala)) });
        if (ringe.length > 4) ringe.shift();
      }
      if (nachts) {
        // Nachts: Die Fledermaus schießt davon, oder eine flattert aus dem Wald auf; dazu zieht bald
        // eine Sternschnuppe über den Himmel
        if (fledermaus) {
          fledermaus.fort = true;
          fledermaus.ziele = [fledermaus.x < x ? -14 : B + 14, fledermaus.y];
          fledermaus.wechsel = 0;
        } else if (!winter && jetzt > 0 && istFrei(x, hy - 8)) fledermausStarten(jetzt, x < B / 2, x, hy - 8);
        if (!schnuppe) {
          naechsteSchnuppe = Math.min(naechsteSchnuppe, jetzt + 0.4 + rnd() * 0.5);
          schnuppeBei = x;
        }
      } else {
        // Dohlen und Bussard stieben auf und ziehen weitere Kreise
        if (kreis) {
          const kx = kreis.cx;
          const ky = kreis.cy + v[kreis.e];
          if (Math.hypot(kx - x, ky - y) < kreis.rx * 1.5 + 30 * Math.max(1, skala)) kreis.schreck = 2.5;
        }
        // Vögel stieben auf und verlassen das Bild
        const s = schwarm;
        if (s) {
          let getroffen = false;
          const ky = y - v[s.ebene]; // Klick in Koordinaten der Ebene des Schwarms
          for (const b of s.voegel) {
            const dx = b.x - x;
            const dy = b.y - ky;
            const d = Math.max(1, Math.hypot(dx, dy));
            if (d > 60 + 20 * skala) continue;
            getroffen = true;
            b.vx += (dx / d) * s.tempo * 2.5;
            b.vy += (dy / d) * s.tempo * 2.5 - s.tempo;
            b.schreck = 1.6;
            b.schlaegt = true;
          }
          if (getroffen) {
            s.fort = true;
            s.richtung = s.x < x ? -1 : 1;
            s.ziel = Math.max(yMin + 4, s.y - 20);
            s.route = null;
          }
        } else if (jetzt > 0) {
          // Kein Schwarm am Himmel: Aus den Bäumen nahe dem Klick fliegen ein paar Vögel auf
          const baeume = figuren.filter(
            (f) => (f.art === "tanne" || f.art === "baum") && Math.abs(f.x - x) < 40 + 20 * skala && f.hoehe >= 8,
          );
          if (baeume.length) {
            const richtung = x < B / 2 ? -1 : 1;
            const voegel: Vogel[] = [];
            const zahl = 3 + Math.floor(rnd() * 4);
            for (let n = 0; n < zahl; n++) {
              const f = baeume[Math.floor(rnd() * baeume.length)];
              const b = vogelNeu(f.x + (rnd() - 0.5) * 3, f.y - f.hoehe - 1 + v[f.ebene] - v[0], (rnd() - 0.5) * 16, -rnd() * 8, B > 250 && rnd() < 0.5);
              b.vx = richtung * vogelTempo * (0.5 + rnd());
              b.vy = -vogelTempo * (1 + rnd());
              b.schreck = 1.6;
              b.vorne = true;
              voegel.push(b);
            }
            schwarm = {
              richtung,
              x,
              y: Math.max(yMin + 6, hy - 30),
              ziel: Math.max(yMin + 6, hy - 30),
              tempo: vogelTempo * 1.4,
              fort: true,
              voegel,
              route: null,
              ebene: 0,
              frei,
            };
            naechsterSchwarm = Math.max(naechsterSchwarm, jetzt + 15);
          }
        }
      }
      // Die Gämse erschrickt, springt und flieht
      for (const bock of boecke) {
        const j = Math.round(bock.s);
        const bx = bock.pfad.punkte[2 * j];
        const by = bock.pfad.punkte[2 * j + 1] + v[bock.pfad.ebene];
        if (Math.hypot(bx - x, by - 4 - y) > 40 + 20 * skala) continue;
        bock.zustand = "flucht";
        bock.richtung = bx >= x ? 1 : -1;
        bock.bis = jetzt + 1.4 + rnd() * 1.2;
        bock.sprung = jetzt;
      }
    },
  };
}
