// Bergpanorama als reine Rechnung: eine Werkstatt für Pixel-Kunstwerke. Jede Szene ist eine Landschaft
// (Blickpunkt und Aufbau) in einer Stimmung (Licht, Wetter, Jahreszeit), gemalt in Farbnummern. Die
// Nummern sind Rollen; erst die Palette der Stimmung macht daraus Tag- oder Nachtfarben. Kein DOM, darum
// auch in Node ausführbar (Vorschau-Skripte). Alles folgt deterministisch aus dem Startwert.

export const BAYER = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

/* Farbnummern (Rollen) ----------------------------------------------------------------------------- */

// 0–22 wie in der Dunkelmodus-Spezifikation (Abschnitt 6.2), ab 23 die Rollen der neuen Landschaften.
// Die Szene ist für Tag und Nacht dieselbe; die Palette der Stimmung entscheidet. LEER = durchsichtig.
export const BOGEN = 0; // Himmel, Papier im Raster, Rand um Figuren
export const GELB = 1; // Sonnenhof, nachts Mondhof
export const T1 = 2; // Kette 0
export const T2 = 3; // Kette 1
export const T3 = 4; // Kette 2
export const T4 = 5; // Kette 3, Uferlinie
export const T5 = 6; // Kette 4, Tannen
export const T6 = 7; // Kette 5, Vordergrund, See-Grund; Naht unten
export const STRAHL = 8; // Lichtstrahlen (nachts keine)
export const SAUM = 9; // Gegenlichtsaum am Grat
export const GLITZER = 10; // Glitzerspur
export const GLITZER_HELL = 11; // Glitzerspur, jede dritte Zeile
export const SCHNEE = 12; // Schnee im Licht
export const MOND = 13; // Sonnenscheibe, nachts Vollmond
export const WOLKE = 14; // Wolken
export const VOGEL = 15; // Vögel (zeichnet das Leben; nachts schlafen sie)
export const SCHNUPPE = 16; // Sternschnuppe (zeichnet das Leben)
export const WANDERER = 17; // Wanderer, nachts Silhouette
export const LAMPE = 18; // Kopf des Wanderers: nachts die Stirnlampe
export const STERN = 19; // heller Stern (tags Himmel)
export const STERN_MATT = 20; // matter Stern (tags Himmel)
export const DUNST = 21; // Dunst zum Horizont
export const HOF_RAND = 22; // Hof an der 8-%-Linie: tags Gelb, nachts Himmel
export const GLUT = 23; // Alpenglühen auf sonnenseitigen Hängen
export const SCHNEE_SCHATTEN = 24; // Schnee im Schatten
export const NEBEL = 25; // Nebel, Wolkenmeer im Licht
export const NEBEL_TIEF = 26; // Nebel im Schatten
export const EIS = 27; // Gletschereis, gefrorener See
export const SPALTE = 28; // Gletscherspalte, Riss im Eis
export const GISCHT = 29; // Wasserfall hell, Gischt
export const WASSERFALL = 30; // Wasserfall dunkler
export const FELS_LICHT = 31; // Fels im Licht (Dolomitwände)
export const FELS = 32; // Fels im Halbschatten
export const WIESE = 33; // Almwiese
export const WIESE_LICHT = 34; // Almwiese im Licht, Grashalme
export const BLUETE_GELB = 35; // Almblumen gelb
export const BLUETE_ROSA = 36; // Almblumen rosa
export const HOLZ = 37; // Hütte, Zaun, Kreuz, Brücke
export const DACH = 38; // Hüttendach
export const FENSTER = 39; // Hüttenfenster: nachts brennt Licht
export const RAUCH = 40; // Rauch aus dem Kamin
export const SEIL = 41; // Seil der Bahn, Seile der Hängebrücke
export const WASSER = 42; // Fluss, Bach, Gletschersee
export const WOLKE_LICHT = 43; // Wolke, Lichtseite
export const WOLKE_SCHATTEN = 44; // Wolke, Schattenseite
export const WAND_HELL = 45; // Felswand im Licht (Klamm): nachts im Mondlicht deutlich heller als die Ketten
export const WAND = 46; // Felswand im Halblicht
export const ROLLEN = 47; // Zahl der Rollen
export const LEER = 255;

/* Farben ------------------------------------------------------------------------------------------- */

type Rgb = number[];
// Die Töne der Marke: eine violettblaue Tinte auf Papier, dazu die zwei Durchschlagfarben
const PAPIER: Rgb = [255, 255, 255];
const FERNE: Rgb = [185, 184, 224]; // tinte-ferne
const BLASS: Rgb = [157, 156, 204];
const DUNSTIG: Rgb = [141, 140, 192]; // tinte-dunst
const MITTEL: Rgb = [124, 122, 179];
const MATT: Rgb = [93, 91, 153]; // tinte-matt
const TINTE: Rgb = [43, 42, 126];
const TIEF: Rgb = [31, 30, 99]; // tinte-tief
const NACHT: Rgb = [21, 20, 74]; // tinte-nacht = #15144a
const KGELB: Rgb = [243, 230, 160]; // kopie-gelb
const KROSA: Rgb = [242, 205, 213]; // kopie-rosa
// Neue Töne entstehen nur als Mischung dieser Farben
const mische = (a: Rgb, b: Rgb, t: number): Rgb => a.map((v, i) => Math.round(v + (b[i] - v) * t));

// Die acht Grundfarben des früheren Panoramas (Tag)
export const BERGFARBEN = [PAPIER, KGELB, FERNE, BLASS, MITTEL, MATT, TINTE, NACHT];

// Tagesfarben aller Rollen (Stimmung „mittag“); 0–22 wie TAG_ROLLE der Spezifikation
const TAG_BASIS: Rgb[] = [
  PAPIER, KGELB, FERNE, BLASS, MITTEL, MATT, TINTE, NACHT,
  KGELB, // STRAHL
  KGELB, // SAUM
  KGELB, // GLITZER
  PAPIER, // GLITZER_HELL
  PAPIER, // SCHNEE
  TINTE, // MOND: die Sonnenscheibe in Tinte
  FERNE, // WOLKE
  TINTE, // VOGEL
  TINTE, // SCHNUPPE
  TINTE, // WANDERER
  TINTE, // LAMPE
  PAPIER, // STERN
  PAPIER, // STERN_MATT
  PAPIER, // DUNST
  KGELB, // HOF_RAND
  mische(KROSA, BLASS, 0.3), // GLUT
  PAPIER, // SCHNEE_SCHATTEN: wie früher Papier im Raster der Kette
  PAPIER, // NEBEL
  mische(PAPIER, FERNE, 0.5), // NEBEL_TIEF
  mische(PAPIER, FERNE, 0.45), // EIS
  MATT, // SPALTE
  PAPIER, // GISCHT
  FERNE, // WASSERFALL
  mische(PAPIER, FERNE, 0.35), // FELS_LICHT
  BLASS, // FELS
  BLASS, // WIESE
  FERNE, // WIESE_LICHT
  KGELB, // BLUETE_GELB
  KROSA, // BLUETE_ROSA
  TINTE, // HOLZ
  TIEF, // DACH
  FERNE, // FENSTER: tags spiegelt das Glas den Himmel
  FERNE, // RAUCH
  TINTE, // SEIL
  FERNE, // WASSER
  PAPIER, // WOLKE_LICHT
  BLASS, // WOLKE_SCHATTEN
  MITTEL, // WAND_HELL
  MATT, // WAND
];

// Nachtfarben aller Rollen; 0–22 exakt wie NACHTFARBEN der Spezifikation. Himmel = --bogen dunkel
// #252339, T6 = --tinte-nacht dunkel #0e091c (Nähte zur Seite).
const N_HIMMEL: Rgb = [37, 35, 57];
const N_T6: Rgb = [14, 9, 28];
const NACHT_BASIS: Rgb[] = [
  N_HIMMEL, [58, 55, 85], [62, 60, 89], [50, 48, 76], [40, 38, 64], [31, 28, 53], [22, 19, 40], N_T6,
  N_HIMMEL, // STRAHL: nachts keine Strahlen
  [196, 196, 226], // SAUM: Mondlicht auf dem Grat
  [240, 224, 164], // GLITZER: Mondbahn im See
  [214, 214, 236], // GLITZER_HELL
  [176, 177, 204], // SCHNEE im Mondlicht
  [244, 231, 178], // MOND
  [50, 48, 75], // WOLKE
  N_HIMMEL, // VOGEL: Die Vögel schlafen
  [246, 240, 222], // SCHNUPPE
  N_T6, // WANDERER: Silhouette
  [250, 222, 140], // LAMPE: Stirnlampe
  [244, 238, 220], // STERN
  [128, 126, 160], // STERN_MATT
  [44, 42, 67], // DUNST: Der Nachthimmel hellt zum Horizont hin auf
  N_HIMMEL, // HOF_RAND
  [116, 115, 146], // GLUT: Mondlicht auf den Hängen
  [104, 104, 138], // SCHNEE_SCHATTEN
  [74, 72, 104], // NEBEL im Mondlicht
  [54, 52, 82], // NEBEL_TIEF
  [138, 138, 174], // EIS
  [22, 19, 40], // SPALTE
  [176, 177, 204], // GISCHT
  [92, 91, 128], // WASSERFALL
  [96, 95, 132], // FELS_LICHT
  [48, 46, 74], // FELS
  [31, 28, 53], // WIESE
  [42, 40, 66], // WIESE_LICHT
  [92, 86, 92], // BLUETE_GELB: schlafende Blüten
  [90, 80, 102], // BLUETE_ROSA
  N_T6, // HOLZ
  [31, 28, 53], // DACH
  [250, 222, 140], // FENSTER: In der Hütte brennt Licht
  [62, 60, 89], // RAUCH
  N_T6, // SEIL
  [48, 46, 74], // WASSER
  [74, 72, 102], // WOLKE_LICHT
  [44, 42, 67], // WOLKE_SCHATTEN
  [86, 84, 122], // WAND_HELL: Mondlicht auf der Wand
  [60, 58, 90], // WAND
];

// Little-Endian-Pixelwert für die Uint32-Sicht auf ImageData
export function farbwert([r, g, b]: number[], alpha = 255): number {
  return ((alpha << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

// Palette als Nachschlagetabelle: Farbnummer → Pixelwert, unbelegte Nummern durchsichtig
export function palette(farben: number[][], leer: number | null): Uint32Array {
  const tabelle = new Uint32Array(256);
  farben.forEach((farbe, i) => (tabelle[i] = farbwert(farbe)));
  if (leer !== null) tabelle[LEER] = tabelle[leer];
  return tabelle;
}

/* Feste Größen und Nähte ---------------------------------------------------------------------------- */

export const EBENEN = ["himmel", "fern", "mitte", "nah"] as const;
export const UEBERSTAND = 24; // Kunstpixel über und unter den Ebenen, mindestens die größte Tiefe
export const TIEFE = [16, 10, 5, 0]; // Parallax-Weg je Ebene in Kunstpixeln
export const NAHT = 3; // unterste Zeilen, immer exakt T6 (Tag #15144a, Nacht #0e091c)
// Erste Zeile der vollen Nacht-Tinte am unteren Rand: darauf liegt der Brief, darunter die Rasterkante
export const nachtAb = (H: number) => Math.min(H - NAHT, Math.round(H * 0.84));
// Die obersten Zeilen bleiben reines Papier (Naht zum Band darüber)
const weissBis = (H: number) => Math.ceil(H * 0.08);
// Unter der weißen Kante läuft alles in drei Rasterzeilen aus: Auch weit verschobene Ebenen enden
// dort nie linealgerade
const KANTE = 3;

const U = UEBERSTAND;
// Startwert des ersten Bilds der Seite (siehe berge-buehne.ts): Es bleibt im gewohnten Blick
const STARTBILD = 2026;

export function zufall(startwert: number): () => number {
  return strom(startwert);
}

// Zufallsstrom mit Gabel: gabel() liefert einen zweiten Strom ab dem aktuellen Stand
type Strom = (() => number) & { gabel: () => Strom };
function strom(startwert: number): Strom {
  let s = startwert | 0;
  const f = (() => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }) as Strom;
  f.gabel = () => strom(s);
  return f;
}

// Bergkamm per Mittelpunktverschiebung, Werte 0 (Tal) bis 1 (Gipfel)
export function grat(rnd: () => number, rauheit: number, breite: number): Float32Array {
  const n = 256;
  const h = new Float32Array(n + 1);
  h[0] = rnd();
  h[n] = rnd();
  let schritt = n;
  let ausschlag = 1;
  while (schritt > 1) {
    const halb = schritt / 2;
    for (let i = halb; i < n; i += schritt) {
      h[i] = (h[i - halb] + h[i + halb]) / 2 + (rnd() * 2 - 1) * ausschlag;
    }
    ausschlag *= rauheit;
    schritt = halb;
  }
  let min = Infinity;
  let max = -Infinity;
  h.forEach((v) => {
    min = Math.min(min, v);
    max = Math.max(max, v);
  });
  const profil = new Float32Array(breite);
  for (let x = 0; x < breite; x++) {
    const v = h[Math.round((x / Math.max(1, breite - 1)) * n)];
    profil[x] = (v - min) / (max - min || 1);
  }
  return profil;
}

// Ganzzahliges Rauschen 0–1 aus zwei Koordinaten und einem Kanal (für Texturen ohne Raster-Muster)
function zahl(a: number, b: number, c: number): number {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// Glattes Rauschen 0–1 entlang einer Achse (Wertrauschen, weich überblendet); verbraucht keinen
// Zufallsstrom, darum bleiben alle übrigen Formen einer Szene unberührt
function rauschen(x: number, kanal: number): number {
  const i = Math.floor(x);
  const t = x - i;
  const u = t * t * (3 - 2 * t);
  return zahl(i, kanal, 77) * (1 - u) + zahl(i + 1, kanal, 77) * u;
}
// Dasselbe in der Fläche: weiche Flecken statt Salz und Pfeffer
function flecken(x: number, y: number, kanal: number): number {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const u = x - i;
  const v = y - j;
  const su = u * u * (3 - 2 * u);
  const sv = v * v * (3 - 2 * v);
  const a = zahl(i, j, kanal) * (1 - su) + zahl(i + 1, j, kanal) * su;
  const b = zahl(i, j + 1, kanal) * (1 - su) + zahl(i + 1, j + 1, kanal) * su;
  return a * (1 - sv) + b * sv;
}
const klemme = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const sanft = (t: number) => {
  const u = klemme(t, 0, 1);
  return u * u * (3 - 2 * u);
};
// Tonleiter mit Raster: v (0–1) wählt eine Stufe, Zwischenwerte mischt die Bayer-Schwelle s
function leiter(farben: readonly number[], v: number, s: number): number {
  const p = klemme(v, 0, 1) * (farben.length - 1);
  const i = Math.floor(p);
  if (i >= farben.length - 1) return farben[farben.length - 1];
  return p - i > s ? farben[i + 1] : farben[i];
}

/* Schnittstelle -------------------------------------------------------------------------------------- */

export interface Sperre {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export type Thema = "light" | "dark";
export interface Wahl {
  stimmung?: string;
  landschaft?: string;
}
export interface Entwurf {
  stimmung: string;
  landschaft: string;
}

// Fest gebackene Figur, die das Leben bewegen darf (Baum wiegt, Rauch zieht …). Die Figuren stehen in
// Zeichenreihenfolge; wer mehrere bewegt, schreibt unter in umgekehrter Reihenfolge zurück und stempelt
// danach vorwärts, dann bleiben Überlappungen sauber.
export interface Figur {
  art: string; // "tanne", "baum", "gras", "fahne", "rauch", "wanderer", "kreuz", "boot", …
  ebene: number;
  x: number; // Bezugspunkt (Fuß), Szenenkoordinaten bei Versatz 0
  y: number;
  punkte: Int16Array; // dx, dy, dx, dy … relativ zu (x, y)
  farben: Uint8Array; // Farbnummer je Punkt
  unter: Uint8Array; // Farbe der eigenen Ebene an dieser Stelle vor dem Stempeln (LEER möglich)
  hoehe: number; // für die Biegung: oben biegt stärker
}

// Arten der Palettenzyklen (Zyklen.art). Jeder markierte Pixel hat eine Leuchtfarbe (farbe) und eine
// Grundfarbe (grund); in lagen steht der Zustand bei t = 0. phase (0–255) verteilt den Zyklus über die
// Pixel: Läuft die Phase mit der Zeit weiter (phase + Tempo · t, modulo 256), wandern Wellen und Funkeln
// über die Fläche, statt im Gleichtakt zu blinken.
export const ZYKLUS_GLITZER = 1; // Glitzerspur im See: Striche ziehen mit dem Wellengang (bei t = 0 leuchten etwa phase < 100)
export const ZYKLUS_STERN = 2; // Stern: nachts Funkeln zwischen farbe und grund (Himmel); tags unsichtbar. phase zufällig
export const ZYKLUS_STRAHL = 3; // Lichtstrahl: phase = Nummer des Strahls (ein Strahl schwillt als Ganzes an und ab); grund Himmel
export const ZYKLUS_HOF = 4; // innerer Sonnenhof: phase = Winkel um die Sonne; ein umlaufendes Muster lässt sie funkeln
export const ZYKLUS_SCHEIBE = 5; // Schlitze der Sonnenscheibe: phase = Abstand zur Mitte; die Schlitze sinken langsam
export const ZYKLUS_WASSERFALL = 6; // fallendes Wasser: phase steigt nach unten; farbe GISCHT, grund WASSERFALL
export const ZYKLUS_GISCHT = 7; // Gischt am Fuß des Wasserfalls und an Felsen: blitzt kurz auf, phase zufällig
export const ZYKLUS_WIESE = 8; // Wind über die Wiese: phase = Lage in Windrichtung; helle Wellen laufen durchs Gras
export const ZYKLUS_FLUSS = 9; // fließendes Wasser: Wellenlinien wandern flussabwärts (phase steigt in Fließrichtung)
export const ZYKLUS_EIS = 10; // Funken auf Eis und Schnee: selten, kurz, phase zufällig
export const ZYKLUS_NEBEL = 11; // Nebelkante: wogt langsam zwischen Nebel (farbe) und dem, was dahinter liegt (grund)

export interface Zyklen {
  ebene: Uint8Array;
  index: Uint32Array; // Index in lagen[ebene] (Zeile y + UEBERSTAND)
  art: Uint8Array; // ZYKLUS_*
  phase: Uint8Array; // 0–255
  farbe: Uint8Array; // Leuchtfarbe (Ergänzung zum Bauplan)
  grund: Uint8Array; // Farbe im Ruhezustand ohne Leuchten (Ergänzung zum Bauplan)
}

// Pfad für Sprites. Bei Graten ("gaemse") liegen die Punkte eine Zeile über dem obersten Fels: Dort
// stehen die Füße. "seilbahn": Punkte auf dem Seil, die Gondel hängt darunter. "gleitschirm": Flugbahn
// im freien Himmel (Mitte des Schirms). "weg": Fußweg auf der Wiese. Punkte je ganze Spalte, x laufend.
export interface Pfad {
  art: string;
  ebene: number;
  punkte: Int16Array; // x, y, x, y …
}

export interface Welt {
  weiss: number; // Zeilen
  ufer: number;
  licht: { x: number; y: number; r: number }; // Sonne bzw. Mond
  kaemme: { ebene: number; y: Int16Array }[]; // Kammlinie je Kette (y je x), hinten zuerst
  himmelFrei: Uint8Array; // B × H, 1 = freier Himmel (Ebene 0 sichtbar, Abstand zu HUD/Sonne)
  figuren: Figur[];
  zyklen: Zyklen;
  wasser: { y0: number; y1: number; spurX: number } | null; // See/Fluss, Glitzerspur unter dem Licht
  pfade: Pfad[];
  [weiteres: string]: unknown; // schneefall, nebel, huette, wasserfall …
}

export interface BergSzene {
  B: number;
  H: number;
  stimmung: string;
  landschaft: string;
  lagen: Uint8Array[]; // 4 Ebenen je B × (H + 2·UEBERSTAND), LEER = durchsichtig, Ebene 0 deckt voll
  farbe: Uint8Array; // Gesamtbild B × H bei Versatz 0 (Standbild ohne Leben)
  paletten: Record<Thema, Uint32Array>; // Rolle → RGBA; LEER → Farbe von BOGEN
  farbAnzahl: Record<Thema, number>; // tatsächlich vorkommende sichtbare Farben
  sonnenseite: 1 | -1;
  beschreibung: Record<Thema, string>;
  welt: Welt;
}

export interface Stapel {
  farbe: Uint8Array;
  vorn: Uint8Array;
  hinten: Uint8Array;
}

/* Stimmungen ------------------------------------------------------------------------------------------ */

type Wolkenart = "baender" | "linsen" | "haufen" | "schleier";
interface Stimmung {
  tag: Record<number, Rgb>; // Abweichungen von TAG_BASIS
  nacht: Record<number, Rgb>; // Abweichungen von NACHT_BASIS
  sonne: { hoehe: [number, number]; groesse: number; strahlen: number; hof: number };
  wolken: Wolkenart;
  wolkenMenge: number;
  nebel: number; // Nebelmeer zwischen den Ketten (0 keins)
  schnee: number; // 0: Schnee nur auf den Gipfeln, 1: bis ins Tal
  blumen: number; // Dichte der Almblumen
  glut: boolean; // Alpenglühen auf den sonnenseitigen Hängen
  eis: boolean; // Seen gefroren, Wasserfälle erstarrt
  dunst: number; // Dunst zum Horizont
  dunstAb?: number; // ab dieser Höhe (Anteil von H) beginnt der Dunst, sonst 0.3
  text: Record<Thema, string>;
}

const STIMMUNG: Record<string, Stimmung> = {
  // Das gewohnte Bild: klare Mittagssonne, Strahlen, Wolkenbänder
  mittag: {
    tag: {},
    nacht: {},
    sonne: { hoehe: [0.22, 0.28], groesse: 1, strahlen: 7, hof: 1 },
    wolken: "baender",
    wolkenMenge: 1,
    nebel: 0,
    schnee: 0,
    blumen: 0,
    glut: false,
    eis: false,
    dunst: 1,
    text: { light: "im Mittagslicht", dark: "in einer klaren Mondnacht" },
  },
  // Blasse Sonne über einem Nebelmeer zwischen den Ketten; alles Ferne ist ins Papier verblasst
  morgennebel: {
    tag: {
      [GELB]: mische(PAPIER, KGELB, 0.55),
      [HOF_RAND]: mische(PAPIER, KGELB, 0.55),
      [STRAHL]: mische(PAPIER, KGELB, 0.4),
      [MOND]: mische(FERNE, PAPIER, 0.25),
      [T1]: mische(PAPIER, FERNE, 0.55),
      [T2]: mische(FERNE, BLASS, 0.35),
      [T3]: BLASS,
      [T4]: DUNSTIG,
      [T5]: MATT,
      [SAUM]: mische(PAPIER, KGELB, 0.6),
      [WOLKE]: mische(PAPIER, FERNE, 0.5),
      [DUNST]: mische(PAPIER, FERNE, 0.3),
      [NEBEL_TIEF]: mische(PAPIER, FERNE, 0.4),
      [GLITZER]: mische(PAPIER, KGELB, 0.7),
      [WASSER]: mische(PAPIER, FERNE, 0.6),
    },
    nacht: {
      [MOND]: [226, 220, 196],
      [NEBEL]: [80, 78, 110],
      [NEBEL_TIEF]: [60, 58, 88],
      [DUNST]: [50, 48, 74],
      [T1]: [70, 68, 98],
    },
    sonne: { hoehe: [0.24, 0.32], groesse: 0.9, strahlen: 5, hof: 0.8 },
    wolken: "schleier",
    wolkenMenge: 0.6,
    nebel: 1,
    schnee: 0.1,
    blumen: 0,
    glut: false,
    eis: false,
    dunst: 1.6,
    text: { light: "am Morgen über einem Nebelmeer", dark: "in einer Mondnacht über einem Nebelmeer" },
  },
  // Tiefe, große Sonne; die sonnenseitigen Hänge und der Schnee glühen in Rosa
  alpengluehen: {
    tag: {
      [GELB]: KROSA,
      [HOF_RAND]: KROSA,
      [STRAHL]: mische(KROSA, PAPIER, 0.3),
      [SAUM]: KROSA,
      [MOND]: mische(TINTE, KROSA, 0.18),
      [T1]: mische(FERNE, KROSA, 0.4),
      [T2]: mische(BLASS, KROSA, 0.28),
      [T3]: mische(MITTEL, KROSA, 0.15),
      [SCHNEE]: KROSA,
      [SCHNEE_SCHATTEN]: mische(PAPIER, FERNE, 0.4),
      [GLUT]: mische(KROSA, BLASS, 0.28),
      [FELS_LICHT]: mische(KROSA, PAPIER, 0.15),
      [FELS]: mische(BLASS, KROSA, 0.35),
      [WOLKE]: mische(KROSA, FERNE, 0.45),
      [WOLKE_LICHT]: KROSA,
      [WOLKE_SCHATTEN]: mische(FERNE, KROSA, 0.2),
      [GLITZER]: KROSA,
      [DUNST]: mische(PAPIER, KROSA, 0.45),
      [NEBEL]: mische(PAPIER, KROSA, 0.55),
      [NEBEL_TIEF]: mische(FERNE, KROSA, 0.3),
      [WASSER]: mische(FERNE, KROSA, 0.4),
      [EIS]: mische(PAPIER, KROSA, 0.5),
      [WIESE_LICHT]: mische(FERNE, KROSA, 0.3),
      [WAND_HELL]: mische(MITTEL, KROSA, 0.3),
      [WAND]: mische(MATT, KROSA, 0.15),
    },
    nacht: {
      [SAUM]: [206, 194, 222],
      [GLUT]: [122, 110, 146],
      [SCHNEE]: [184, 176, 206],
      [NEBEL]: [80, 72, 104],
    },
    sonne: { hoehe: [0.36, 0.44], groesse: 1.3, strahlen: 9, hof: 1.15 },
    wolken: "baender",
    wolkenMenge: 0.8,
    nebel: 0,
    schnee: 0.15,
    blumen: 0,
    glut: true,
    eis: false,
    dunst: 1.4,
    text: { light: "im Alpenglühen", dark: "in einer Mondnacht nach dem Alpenglühen" },
  },
  // Schnee bis ins Tal, verschneite Tannen, gefrorene Seen, blasse Wintersonne
  winter: {
    tag: {
      [GELB]: mische(PAPIER, KGELB, 0.6),
      [HOF_RAND]: mische(PAPIER, KGELB, 0.6),
      [STRAHL]: mische(PAPIER, KGELB, 0.5),
      [SAUM]: mische(PAPIER, KGELB, 0.7),
      [T1]: mische(FERNE, PAPIER, 0.25),
      [T2]: mische(BLASS, FERNE, 0.3),
      [SCHNEE_SCHATTEN]: mische(PAPIER, FERNE, 0.55),
      [WOLKE]: mische(PAPIER, FERNE, 0.6),
      [EIS]: mische(PAPIER, FERNE, 0.35),
      [WIESE]: mische(PAPIER, FERNE, 0.5),
      [WIESE_LICHT]: PAPIER,
      [DACH]: PAPIER,
      [WASSER]: mische(PAPIER, FERNE, 0.5),
      [DUNST]: mische(PAPIER, FERNE, 0.2),
    },
    nacht: {
      [SCHNEE]: [200, 201, 226],
      [SCHNEE_SCHATTEN]: [120, 120, 158],
      [T1]: [70, 68, 100],
      [EIS]: [150, 150, 186],
      [WIESE]: [120, 120, 158],
      [WIESE_LICHT]: [176, 177, 204],
      [DACH]: [176, 177, 204],
    },
    sonne: { hoehe: [0.26, 0.32], groesse: 0.85, strahlen: 5, hof: 0.85 },
    wolken: "schleier",
    wolkenMenge: 1,
    nebel: 0,
    schnee: 1,
    blumen: 0,
    glut: false,
    eis: true,
    dunst: 1,
    text: { light: "im Winter", dark: "in einer verschneiten Winternacht" },
  },
  // Föhn: klare, harte Kontraste, dunkle Ketten, Föhnfische am Himmel
  foehn: {
    tag: {
      [T1]: BLASS,
      [T2]: MITTEL,
      [T3]: MATT,
      [T4]: TINTE,
      [T5]: TIEF,
      [WOLKE]: FERNE,
      [WOLKE_SCHATTEN]: BLASS,
      [SCHNEE_SCHATTEN]: FERNE,
      [FELS]: MITTEL,
      [WIESE]: MITTEL,
      [WIESE_LICHT]: BLASS,
      [WASSER]: BLASS,
      [WAND_HELL]: MATT,
      [WAND]: TINTE,
    },
    nacht: {
      [T1]: [70, 68, 100],
      [T2]: [52, 50, 80],
      [SAUM]: [214, 214, 238],
      [WOLKE]: [60, 58, 88],
      [WOLKE_LICHT]: [96, 94, 126],
    },
    sonne: { hoehe: [0.2, 0.26], groesse: 0.95, strahlen: 0, hof: 0.9 },
    wolken: "linsen",
    wolkenMenge: 1,
    nebel: 0,
    schnee: 0.05,
    blumen: 0,
    glut: false,
    eis: false,
    dunst: 0,
    text: { light: "bei Föhn mit Linsenwolken", dark: "in einer klaren Föhnnacht mit Linsenwolken" },
  },
  // Hochsommer: hoch stehende, große Sonne, warmer Dunst in Kopie-Gelb bis an die Ketten, Schnee nur
  // noch auf den höchsten Graten, Haufenwolken mit gelbem Sonnenrand, Almblumen in Gelb und Rosa
  sommer: {
    tag: {
      [DUNST]: mische(PAPIER, KGELB, 0.55),
      [HOF_RAND]: mische(PAPIER, KGELB, 0.7),
      [STRAHL]: mische(PAPIER, KGELB, 0.75),
      [T1]: mische(FERNE, KGELB, 0.32),
      [T2]: mische(BLASS, KGELB, 0.2),
      [T3]: mische(MITTEL, KGELB, 0.12),
      [SAUM]: KGELB,
      [SCHNEE_SCHATTEN]: mische(PAPIER, KGELB, 0.35),
      [GLITZER]: KGELB,
      [WIESE]: mische(BLASS, KGELB, 0.3),
      [WIESE_LICHT]: mische(FERNE, KGELB, 0.55),
      [WASSER]: mische(FERNE, KGELB, 0.3),
      [FELS_LICHT]: mische(PAPIER, KGELB, 0.4),
      [FELS]: mische(BLASS, KGELB, 0.25),
      [EIS]: mische(PAPIER, FERNE, 0.35),
      [WAND_HELL]: mische(MITTEL, KGELB, 0.25),
      [WOLKE]: mische(FERNE, PAPIER, 0.25),
      [WOLKE_LICHT]: mische(PAPIER, KGELB, 0.22),
      [WOLKE_SCHATTEN]: mische(BLASS, FERNE, 0.35),
      [NEBEL]: mische(PAPIER, KGELB, 0.3),
    },
    nacht: {
      // Warme Sommernacht: ein Hauch Gelb im Dunst am Horizont. Die Haufenwolken stehen als Körper im
      // Mondlicht da; nur leise heller als der Himmel blieben von ihnen bloß die Silbersäume übrig
      [DUNST]: [52, 48, 66],
      [T1]: [70, 66, 92],
      [WIESE_LICHT]: [46, 44, 70],
      [WOLKE]: [56, 54, 82],
      [WOLKE_LICHT]: [74, 72, 102],
      [WOLKE_SCHATTEN]: [46, 44, 70],
    },
    sonne: { hoehe: [0.16, 0.22], groesse: 1.15, strahlen: 9, hof: 1.2 },
    wolken: "haufen",
    wolkenMenge: 1,
    nebel: 0,
    schnee: -0.25,
    blumen: 1,
    glut: false,
    eis: false,
    dunst: 1.6,
    dunstAb: 0.12,
    text: { light: "im Hochsommer", dark: "in einer warmen Sommernacht" },
  },
};

/* Landschaften (Aufbau weiter unten) --------------------------------------------------------------- */

interface Landschaft {
  bauen: (w: Werk) => void;
  text: string; // für die Beschreibung
  sonneX?: [number, number]; // Abstand der Sonne zur Bildmitte (Anteil der Breite)
  nacht?: Record<number, Rgb>; // Nachtfarben, die diese Landschaft braucht (die Stimmung geht vor)
  sonneHoehe?: number; // Verschiebung der Sonnenhöhe (Anteil der Höhe)
}

// Paare, die nicht zusammenpassen: Föhn und Wolkenmeer schließen sich aus
const MEIDEN = new Set(["foehn/gipfelgrat"]);

/* Werkstatt ------------------------------------------------------------------------------------------- */

interface Kammlinie {
  ebene: number;
  y: Int16Array;
}

class Werk {
  B: number;
  H: number;
  G: number;
  weiss: number;
  nacht: number;
  ufer: number;
  lagen: Uint8Array[];
  rnd: Strom; // Gestalt der Landschaft
  rv: Strom; // Varianten (Figuren, Aufbau)
  rh: Strom; // Himmel (Wolken)
  rk: Strom; // Blickpunkt: Spiegelung, Horizont, Nah- oder Fernsicht (eigener Strom, die übrigen bleiben unberührt)
  // Das Startbild der Seite behält seinen gewohnten Blick: ungespiegelt, Sonne wie früher
  klassisch: boolean;
  spiegel: boolean; // gebaut wird spiegelverkehrt (mit gespiegelter Sperre), am Ende kippt das Bild
  sperre: Sperre | null;
  sperreEcht: Sperre | null;
  st: Stimmung;
  name: string;
  startwert: number;
  seite: 1 | -1 = 1;
  sx = 0;
  sy = 0;
  sr = 5;
  horizont: Int32Array;
  figuren: Figur[] = [];
  z = { ebene: [] as number[], index: [] as number[], art: [] as number[], phase: [] as number[], farbe: [] as number[], grund: [] as number[] };
  pfade: Pfad[] = [];
  kaemme: Kammlinie[] = [];
  wasser: { y0: number; y1: number; spurX: number } | null = null;
  extra: Record<string, unknown> = {};
  spaeter: (() => void)[] = [];
  dinge: string[] = []; // für die Beschreibung
  karte = new Int16Array(4096).fill(-1); // Arbeitsgitter für figur()
  folge = new Int32Array(4096);
  wolkenRoh = new Map<number, [number, number]>(); // Index in Ebene 0 → [Himmel darunter, Wolkenfarbe]
  seeRoh: { y0: number; y1: number; werte: Uint8Array } | null = null; // was seeMalen gemalt hat

  constructor(B: number, H: number, startwert: number, sperre: Sperre | null, st: Stimmung, name: string) {
    this.B = B;
    this.H = H;
    this.G = H + 2 * U;
    this.weiss = weissBis(H);
    this.nacht = nachtAb(H);
    this.ufer = Math.round(H * 0.72);
    this.lagen = EBENEN.map(() => new Uint8Array(B * this.G).fill(LEER));
    this.rnd = strom(startwert);
    this.rv = strom((Math.imul(startwert, 0x2c1b3c6d) ^ 0x297a2d40) | 0);
    this.rh = strom((startwert ^ 0x51c1d0e5) | 0);
    this.rk = strom((Math.imul(startwert ^ 0x7f4a7c15, 0x5bd1e995) + 0x1b873593) | 0);
    this.klassisch = startwert === STARTBILD;
    this.spiegel = !this.klassisch && this.rk() < 0.5;
    this.sperreEcht = sperre;
    this.sperre = sperre && this.spiegel ? { x0: B - 1 - sperre.x1, y0: sperre.y0, x1: B - 1 - sperre.x0, y1: sperre.y1 } : sperre;
    this.st = st;
    this.name = name;
    this.startwert = startwert;
    this.horizont = new Int32Array(B);
  }

  setze(e: number, x: number, y: number, f: number): void {
    if (x >= 0 && x < this.B && y >= -U && y < this.H + U) this.lagen[e][(y + U) * this.B + x] = f;
  }
  lies(e: number, x: number, y: number): number {
    return x >= 0 && x < this.B && y >= -U && y < this.H + U ? this.lagen[e][(y + U) * this.B + x] : LEER;
  }
  // Sichtbare Farbe bei Versatz 0: vorderste deckende Ebene
  oben(x: number, y: number): number {
    const i = (y + U) * this.B + x;
    for (let e = 3; e >= 0; e--) if (this.lagen[e][i] !== LEER) return this.lagen[e][i];
    return BOGEN;
  }
  // Liegt vor Ebene e an dieser Stelle etwas Deckendes?
  verdeckt(e: number, x: number, y: number): boolean {
    for (let n = e + 1; n < 4; n++) if (this.lies(n, x, y) !== LEER) return true;
    return false;
  }
  // Jede Ebene hat ihre eigene Bayer-Phase, so entsteht beim Überlagern kein Moiré
  schwelle(e: number, x: number, y: number): number {
    return (BAYER[(y + U + e * 3) & 7][(x + e * 5) & 7] + 0.5) / 64;
  }
  // Grobes Raster aus 2 × 2-Zellen: für helle Flecken auf dunklem Grund (Schnee, Eis). Im feinen Raster
  // stünden sie nachts als einzelne Lichtpunkte da und flimmerten wie Salz und Pfeffer.
  grob(e: number, x: number, y: number): number {
    return this.schwelle(e, x >> 1, y >> 1);
  }
  // Abstand zur HUD-Box in Kunstpixeln: 0 darunter, ohne HUD unendlich
  hud(x: number, y: number): number {
    const s = this.sperre;
    return s ? Math.hypot(Math.max(s.x0 - x, 0, x - s.x1), Math.max(s.y0 - y, 0, y - s.y1)) : Infinity;
  }
  zyklus(e: number, x: number, y: number, art: number, phase: number, farbe: number, grund: number): void {
    if (x < 0 || x >= this.B || y < this.weiss || y >= this.nacht) return;
    this.z.ebene.push(e);
    this.z.index.push((y + U) * this.B + x);
    this.z.art.push(art);
    this.z.phase.push(phase & 255);
    this.z.farbe.push(farbe);
    this.z.grund.push(grund);
  }
  // Figur stempeln und mit dem Untergrund merken. rand: 1 Pixel Papierrand (nicht unter dem Fuß)
  figur(art: string, e: number, x: number, y: number, punkte: number[], farben: number[], hoehe: number, rand = false): void {
    // Kleines Gitter um die Figur statt einer Map: Jede Stelle zählt einmal, in der Reihenfolge, in
    // der sie zuerst belegt wurde; der Papierrand kommt zuerst, die Punkte malen darüber
    let ax = Infinity;
    let bx = -Infinity;
    let ay = Infinity;
    let by = -Infinity;
    for (let i = 0; i < punkte.length; i += 2) {
      if (punkte[i] < ax) ax = punkte[i];
      if (punkte[i] > bx) bx = punkte[i];
      if (punkte[i + 1] < ay) ay = punkte[i + 1];
      if (punkte[i + 1] > by) by = punkte[i + 1];
    }
    if (!punkte.length) return;
    ax--;
    ay--;
    bx++;
    by++;
    const gw = bx - ax + 1;
    const groesse = gw * (by - ay + 1);
    if (this.karte.length < groesse) this.karte = new Int16Array(groesse * 2).fill(-1);
    const karte = this.karte; // wiederverwendet; nach Gebrauch wieder auf −1
    const folge = this.folge.length < groesse ? (this.folge = new Int32Array(groesse * 2)) : this.folge;
    let n = 0;
    if (rand) {
      for (let i = 0; i < punkte.length; i += 2) {
        for (let a = -1; a <= 1; a++) {
          for (let b = -1; b <= 1; b++) {
            const dy = punkte[i + 1] + b;
            if (dy >= 0) continue;
            const c = (dy - ay) * gw + punkte[i] + a - ax;
            if (karte[c] < 0) folge[n++] = c;
            karte[c] = BOGEN;
          }
        }
      }
    }
    for (let i = 0; i < punkte.length; i += 2) {
      const c = (punkte[i + 1] - ay) * gw + punkte[i] - ax;
      if (karte[c] < 0) folge[n++] = c;
      karte[c] = farben[i >> 1];
    }
    const p = new Int16Array(n * 2);
    const f = new Uint8Array(n);
    const u = new Uint8Array(n);
    let m = 0;
    const L = this.lagen[e];
    for (let k = 0; k < n; k++) {
      const c = folge[k];
      const farbe = karte[c];
      karte[c] = -1;
      const dx = (c % gw) + ax;
      const dy = ((c / gw) | 0) + ay;
      const px = x + dx;
      const py = y + dy;
      if (px < 0 || px >= this.B || py < -U || py >= this.H + U) continue;
      const i = (py + U) * this.B + px;
      p[2 * m] = dx;
      p[2 * m + 1] = dy;
      f[m] = farbe;
      u[m] = L[i];
      L[i] = farbe;
      m++;
    }
    if (m) {
      this.figuren.push({ art, ebene: e, x, y, punkte: m < n ? p.slice(0, 2 * m) : p, farben: m < n ? f.slice(0, m) : f, unter: m < n ? u.slice(0, m) : u, hoehe });
    }
  }
  pfad(art: string, e: number, punkte: number[]): void {
    if (punkte.length >= 8) this.pfade.push({ art, ebene: e, punkte: Int16Array.from(punkte) });
  }
}

/* Bausteine ---------------------------------------------------------------------------------------- */

// Tanne mit gestuften Ästen, Fuß bei (0, 0). Verschneit tragen die Astkanten Schnee.
// kappe: Schnee nur als geschlossene Haube auf der Spitze (dichte Baumreihen, sonst Salz-und-Pfeffer)
function tannePunkte(g: number, farbe: number, schnee: boolean, kappe = false): { p: number[]; f: number[] } {
  const p: number[] = [];
  const f: number[] = [];
  if (g < 8) {
    // Kleine Tannen: eine Haube aus Spitze und nächster Zeile, keine einzelnen Astpunkte
    const haube = schnee && g >= 4 ? 2 : 0;
    for (let j = 0; j < g; j++) {
      const halb = Math.floor(j * 0.45);
      for (let dx = -halb; dx <= halb; dx++) {
        p.push(dx, -g + j);
        f.push(j < haube ? SCHNEE : farbe);
      }
    }
    return { p, f };
  }
  if (kappe) {
    const { p, f } = tannePunkte(g, farbe, false);
    const haube = schnee ? Math.max(2, Math.round(g * 0.12)) : 0;
    for (let i = 0; i < f.length; i++) if (p[i * 2 + 1] < -g + haube) f[i] = SCHNEE;
    return { p, f };
  }
  const stamm = Math.max(1, Math.round(g / 9));
  const krone = g - stamm;
  const breite = g * 0.3;
  const stufen = Math.max(2, Math.round(krone / 5));
  const stufenHoehe = krone / stufen;
  let vorher = -1;
  let stufeVorher = -1;
  let polster = false; // trägt die Zeile darüber noch Schnee am Rand?
  for (let j = 0; j < krone; j++) {
    const inStufe = (j % stufenHoehe) / stufenHoehe;
    const stufe = Math.floor(j / stufenHoehe);
    const halb = Math.round(((j + 1) / krone) * breite * (0.55 + 0.45 * inStufe));
    // Schnee liegt als Polster auf jeder Aststufe: die oberste Zeile der Stufe ganz, darunter die
    // Schultern, solange sie Zeile für Zeile weiter hinausragen. Reißt die Kette ab, bleibt der Rest
    // grün; so entstehen zusammenhängende Kappen statt einzelner Lichtpunkte (nachts Salz und Pfeffer).
    const oben = j === 0 || stufe !== stufeVorher;
    const waechst = halb > vorher;
    // Die Spitze (eine Spalte breit) trägt ihre Haube ganz, sonst stünde dort ein einzelner Punkt
    const spitze = halb === 0;
    polster = oben || (polster && (waechst || spitze) && inStufe < 0.6);
    for (let dx = -halb; dx <= halb; dx++) {
      p.push(dx, -g + j);
      const schulter = Math.abs(dx) > vorher;
      f.push(schnee && polster && (oben || schulter || spitze) ? SCHNEE : farbe);
    }
    vorher = halb;
    stufeVorher = stufe;
  }
  const dicke = g >= 16 ? 1 : 0;
  for (let j = krone; j < g + 1; j++) for (let dx = -dicke; dx <= 0; dx++) {
    p.push(dx, -g + j);
    f.push(farbe);
  }
  return { p, f };
}

function tanne(w: Werk, e: number, x: number, fuss: number, g: number, farbe: number, alsFigur = true): void {
  const { p, f } = tannePunkte(g, farbe, w.st.schnee >= 0.5);
  if (alsFigur && g >= 4) w.figur("tanne", e, x, fuss, p, f, g);
  else for (let i = 0; i < p.length; i += 2) w.setze(e, x + p[i], fuss + p[i + 1], f[i >> 1]);
}

// Laubbaum oder Zirbe: runde, zerzauste Krone mit Lichtseite, kurzer Stamm
function baum(w: Werk, e: number, x: number, fuss: number, g: number, farbe: number, licht: number): void {
  const p: number[] = [];
  const f: number[] = [];
  const r = Math.max(2, g * 0.34);
  const cy = -g + r;
  const schnee = w.st.schnee >= 0.5;
  const rx = Math.ceil(r + 1);
  const ry = Math.ceil(r);
  const krone = (dx: number, dy: number) => {
    const d = Math.hypot(dx / 1.1, dy) / r;
    const zaus = (BAYER[(dy + 64) & 7][(dx + 64) & 7] / 64) * 0.35;
    return d <= 1 - zaus * 0.5 + 0.12;
  };
  // Schnee als geschlossene Haube: in jeder oberen Spalte die beiden obersten Kronenpixel, statt eines
  // Schachbretts, das nachts als Salz und Pfeffer flimmert
  const haube = new Int8Array(rx * 2 + 1).fill(-128);
  if (schnee) {
    for (let dx = -rx; dx <= rx; dx++) {
      for (let dy = -ry; dy <= ry; dy++) {
        if (!krone(dx, dy)) continue;
        if (dy < -r * 0.2) haube[dx + rx] = dy + 1;
        break;
      }
    }
  }
  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      if (!krone(dx, dy)) continue;
      const lichtSeite = (dx * w.seite + -dy * 0.7) / r;
      let farbeHier = farbe;
      if (dy <= haube[dx + rx]) farbeHier = SCHNEE;
      else if (lichtSeite > 0.55 && (BAYER[(dy + 64) & 7][(dx + 64) & 7] + 0.5) / 64 < 0.5) farbeHier = licht;
      p.push(dx, Math.round(cy + dy));
      f.push(farbeHier);
    }
  }
  for (let dy = Math.round(cy + r * 0.6); dy <= 0; dy++) {
    p.push(0, dy);
    f.push(farbe);
  }
  w.figur("baum", e, x, fuss, p, f, g);
}

// Wanderer, Fuß bei (x, y); nachts brennt die Stirnlampe
function wanderer(w: Werk, e: number, x: number, y: number, blick: number): void {
  const form = [
    [0, -8], [0, -7], [-1, -6], [0, -6], [1, -6], [0, -5], [0, -4],
    [-1, -3], [1, -3], [-1, -2], [1, -2], [-1, -1], [1, -1],
    [2, -7], [2, -6], [2, -5], [2, -4], [2, -3], [2, -2], [2, -1],
  ];
  const p: number[] = [];
  const f: number[] = [];
  form.forEach(([dx, dy]) => {
    p.push(dx * blick, dy);
    f.push(dy === -8 ? LAMPE : WANDERER);
  });
  w.figur("wanderer", e, x, y, p, f, 9, true);
}

// Gipfelkreuz mit kleiner Fahne, die im Wind flattern darf
function gipfelkreuz(w: Werk, e: number, x: number, y: number, g: number): void {
  const p: number[] = [];
  const f: number[] = [];
  for (let dy = -g; dy < 0; dy++) {
    p.push(0, dy);
    f.push(HOLZ);
  }
  const arm = Math.max(2, Math.round(g * 0.3));
  const hoeheArm = -g + Math.max(2, Math.round(g * 0.28));
  for (let dx = -arm; dx <= arm; dx++) {
    p.push(dx, hoeheArm);
    f.push(HOLZ);
  }
  w.figur("kreuz", e, x, y, p, f, g, true);
  // Fahne am Querbalken, zur Schattenseite hin
  const fp: number[] = [];
  const ff: number[] = [];
  const s = -w.seite;
  [[1, 1], [2, 1], [3, 1], [1, 2], [2, 2]].forEach(([dx, dy]) => {
    fp.push((arm + dx - 1) * s, dy - 1);
    ff.push(dx === 3 ? GELB : WOLKE_SCHATTEN);
  });
  w.figur("fahne", e, x, y + hoeheArm, fp, ff, 3);
}

// Steinmann: flache Steine aufeinander, unten breit, nach oben kleiner und leicht versetzt. Jeder Stein
// hat eine helle Oberseite und eine dunkle Fuge darunter; ohne Papierrand, damit er nicht wie ein Zelt
// aus dem Hang sticht.
function steinmann(w: Werk, e: number, x: number, y: number, g: number): void {
  const p: number[] = [];
  const f: number[] = [];
  let dy = -1;
  for (let n = 0; dy >= -g; n++) {
    const halb = Math.max(0, Math.round((1 - (-dy - 1) / g) * 2.4 - 0.3));
    const dicke = halb >= 2 ? 2 : 1;
    const versatz = n % 3 === 1 ? w.seite : 0;
    for (let j = 0; j < dicke && dy >= -g; j++, dy--) {
      for (let dx = -halb; dx <= halb; dx++) {
        p.push(dx + versatz, dy);
        f.push(j === dicke - 1 ? (dx * w.seite >= 0 ? FELS : T4) : dx === -halb * w.seite ? T6 : T5);
      }
    }
  }
  w.figur("steinmann", e, x, y, p, f, g);
}

// Grasbüschel: zwei bis vier Halme, die sich zur Windseite neigen; oben biegsam
function gras(w: Werk, e: number, x: number, y: number, g: number, farbe: number, wind: number): void {
  const p: number[] = [];
  const f: number[] = [];
  const halme = 2 + ((x * 7 + y * 3) % 3);
  for (let h = 0; h < halme; h++) {
    const lage = h - (halme - 1) / 2;
    const laenge = Math.max(1, g - (Math.abs(lage) > 1 ? 1 : 0) - ((x + h) % 3 === 0 ? 1 : 0));
    const neigung = wind * (0.25 + ((x * 3 + h * 5) % 4) * 0.12) + lage * 0.25;
    for (let j = 1; j <= laenge; j++) {
      p.push(Math.round(lage + neigung * (j * j) / laenge), -j);
      f.push(farbe);
    }
  }
  w.figur("gras", e, x, y, p, f, g);
}

// Rauchfahne: lockere Pünktchen, die schräg aufsteigen und ausdünnen
function rauch(w: Werk, e: number, x: number, y: number, laenge: number): void {
  const p: number[] = [];
  const f: number[] = [];
  const zug = -w.seite;
  for (let j = 0; j < laenge; j++) {
    const t = j / laenge;
    const dx = Math.round(zug * (j * 0.55 + Math.sin(j * 0.7) * 1.2));
    const breite = 1 + Math.floor(t * 2.5);
    for (let b = 0; b < breite; b++) {
      if ((BAYER[j & 7][b & 7] + 0.5) / 64 < t * 0.75) continue;
      // Die Fahne endet vor dem HUD, statt darunter zu ziehen
      if (w.hud(x + dx + b - (breite >> 1), y - j) < 4) continue;
      p.push(dx + b - (breite >> 1), -j);
      f.push(RAUCH);
    }
  }
  w.figur("rauch", e, x, y, p, f, laenge);
}

/* Ketten -------------------------------------------------------------------------------------------- */

interface KetteDef {
  ebene: number;
  farbe: number;
  grund: number; // Raster zwischen den Tönen: hinten Papier, sonst der nächsthellere Ton
  basis: number;
  hoehe: number;
  rauheit: number;
  licht: number;
  schatten: number;
  profil?: Float32Array;
  sattel?: number; // Sattel unter der Sonne (Tiefe in Sonnenradien unter der Mitte)
  schnee?: number; // Schneelinie (Zeile); zieht je Spalte eine Zufallszahl
  schneeTiefe?: number; // Faktor für die Tiefe des Schneefelds
  saum?: boolean;
  glut?: number; // Tiefe des Alpenglühens in Zeilen
  nebel?: number | Float32Array; // Nebellinie (Zeile), darunter löst sich die Kette auf
  meer?: boolean; // Nebelmeer: unter der Nebellinie deckender Nebel statt Durchsicht
  tannen?: { klein: number; gross: number; farbe: number; abstand: number };
  aus?: (x: number, y: number) => boolean; // hier bleibt die Kette offen (etwas Gemaltes liegt darin)
}

// Eine Bergkette: Der Kamm steht in vollem Ton, die Flanken rastern nur leicht zum helleren Nachbarton.
// Hänge, die von der Sonne wegzeigen, liegen im Schatten. Am Fuß löst sie sich in Nebel auf.
function kette(w: Werk, k: KetteDef): Int16Array {
  const { B, H, weiss, rnd } = w;
  const e = k.ebene;
  const profil = k.profil ?? grat(rnd, k.rauheit, B);
  // Sattel unter der Sonne: Die Kette senkt sich dort so weit, dass die Sonne mit ihrer oberen
  // Hälfte immer frei steht und in ein Tal hinein untergeht.
  if (k.sattel !== undefined) {
    const tal = w.sy + w.sr * k.sattel;
    const erlaubt = (k.basis - tal / H) / k.hoehe;
    let spitze = 0;
    for (let x = Math.max(0, Math.floor(w.sx - w.sr)); x <= Math.min(B - 1, w.sx + w.sr); x++) spitze = Math.max(spitze, profil[x]);
    if (spitze > erlaubt) {
      const tiefe = 1 - Math.max(0, erlaubt) / spitze;
      const weite = w.sr * 2.4;
      for (let x = 0; x < B; x++) profil[x] *= 1 - tiefe * Math.exp(-(((x - w.sx) / weite) ** 2));
    }
  }
  const kamm = new Int16Array(B);
  const fenster = 3 + Math.round(B / 60);
  const kern = Math.max(3, Math.round(H * 0.035)); // so tief bleibt die Kette unter dem Kamm deckend
  const nebelLaenge = Math.max(4, H * 0.05);
  const L = w.lagen[e];
  const oberste = weiss + KANTE + 1;
  // Licht und Schatten folgen der Neigung des Kamms, über ein breites Fenster geglättet: So kippt eine
  // Flanke allmählich ins Licht, statt an einer Spaltenkante umzuschlagen
  const roh = new Float32Array(B);
  for (let x = 0; x < B; x++) roh[x] = (profil[Math.min(B - 1, x + fenster)] - profil[Math.max(0, x - fenster)]) * w.seite;
  const schattenSpalte = new Float32Array(B);
  {
    let summe = 0;
    const r = fenster;
    for (let x = -r; x < B; x++) {
      if (x + r < B) summe += roh[x + r];
      if (x - r - 1 >= 0) summe -= roh[x - r - 1];
      if (x >= 0) schattenSpalte[x] = klemme(0.5 + (summe / (Math.min(B - 1, x + r) - Math.max(0, x - r) + 1)) * 4.5, 0, 1);
    }
  }
  const winter = w.st.schnee >= 0.5;
  const kanal = Math.round(k.basis * 1000 + k.hoehe * 100);
  for (let x = 0; x < B; x++) {
    let y0 = Math.round(H * (k.basis - k.hoehe * profil[x]));
    // Gipfel nahe der weißen Kante weich stauchen, nie hineinragen lassen
    if (y0 < oberste + 6) y0 = Math.max(oberste, Math.round(oberste + 6 - (oberste + 6 - y0) * 0.45));
    kamm[x] = y0;
    const schatten = schattenSpalte[x];
    const imSchatten = schatten > 0.5;
    // Schneefeld am Kamm; höchstens ein gutes Stück tief, darunter liegt Schnee nur im Raster
    const schneeRoh = k.schnee !== undefined ? Math.max(0, k.schnee - y0) * (k.schneeTiefe ?? 0.6) + rnd() * 2 : 0;
    // Die Grenze des Schneefelds wandert weich; Rinnen ziehen Schneezungen tief hinab, Rippen bleiben
    // aper. So endet das Feld nie an einer waagerechten Linie.
    const wandern = 0.62 + 0.38 * Math.sin(x * 0.19 + k.basis * 50) * Math.sin(x * 0.053 + k.hoehe * 30);
    const deckel = H * (0.11 + w.st.schnee * 0.07) * (winter ? wandern : 0.75 + 0.25 * wandern);
    const rinne = Math.max(0, rauschen(x / 3, kanal) - 0.66) * 3.2 * rauschen(x / 13, kanal + 3);
    const rippe = Math.max(0, 0.4 - rauschen(x / 6, kanal + 1)) * 1.2;
    const schneeTief = schneeRoh > 0 ? Math.min(schneeRoh, deckel) * (1 + rinne - rippe) : 0;
    const linie = k.nebel === undefined ? Infinity : typeof k.nebel === "number" ? k.nebel : k.nebel[x];
    // Im Nebelmeer liegt der Nebel vor allem, was tiefer als seine Oberkante liegt
    const nebelAb = k.meer ? linie : Math.max(linie, y0 + kern);
    const glutTief = k.glut ? k.glut * (1 - schatten * 1.6) : 0;
    // Die Grenze zwischen Licht- und Schattenflanke läuft vom Gipfel schräg nach vorn hinab, wie ein
    // Grat, der auf den Betrachter zukommt, statt senkrecht unter dem Gipfel
    const kipp = w.seite * (0.3 + 0.5 * rauschen(x / 23, kanal + 2));
    for (let y = y0; y < H + U; y++) {
      const tiefe = y - y0;
      const nebel = (y - nebelAb) / (k.meer ? 2 : nebelLaenge);
      if (nebel >= 1 && !k.meer) break; // darunter bleibt die Kette durchsichtig
      const hier = tiefe < 2 ? schatten : schattenSpalte[klemme(Math.round(x - tiefe * kipp), 0, B - 1)];
      let ton = Math.round((k.licht + (k.schatten - k.licht) * hier) * 32) / 32;
      // Im Winter rastert die ganze Flanke grob (Zellen 2 × 2): Schnee liegt dann in Flecken statt in
      // einzelnen Lichtpunkten, die nachts auf dunklem Fels als Salz und Pfeffer flimmern
      const s = winter ? w.grob(e, x, y) : w.schwelle(e, x, y);
      let sFels = s; // Schwelle zwischen Fels und Schnee
      // Die Lichtseite geht im Raster in die Schattenseite über, ohne harte Spaltenkante
      const schattig = hier > 0.3 + s * 0.4;
      // Im Winter ist auch die Schattenseite verschneit: kein Himmel scheint durch
      let frei = winter ? (schattig ? SCHNEE_SCHATTEN : SCHNEE) : k.grund;
      const saumTiefe = Math.min(4, 1 + schneeTief * 0.3);
      if (tiefe < schneeTief || (schneeTief > 1.5 && tiefe < schneeTief + saumTiefe && ((schneeTief + saumTiefe - tiefe) / saumTiefe) * 0.75 > s)) {
        ton = schattig ? 0.25 + Math.max(0, hier - 0.75) * 0.8 : 0;
        frei = schattig ? SCHNEE_SCHATTEN : SCHNEE;
      } else if (tiefe < glutTief && !schattig) {
        ton *= 0.45;
        frei = GLUT;
      } else if (winter) {
        ton = Math.max(0.4, ton - 0.25);
        // Unter der Schneekappe liegt der Schnee in unregelmäßigen Flecken auf dem Fels, nicht als
        // gleichmäßiges Schachbrett: weiche Flecken, deren Ränder das grobe Raster zerfasert
        sFels = s * 0.55 + flecken(x / 6, y / 3, 90 + e) * 0.45;
      }
      if (tiefe === 0) ton = 1;
      const i = (y + U) * B + x;
      if (k.aus && k.aus(x, y)) continue;
      if (nebel <= 0) L[i] = ton > sFels ? k.farbe : frei;
      else if (!k.meer) {
        if (ton * (1 - nebel) > s) L[i] = k.farbe;
        // sonst durchsichtig: im Nebel scheint die Ebene dahinter durch
      } else {
        // Nebelmeer: helle Oberkante, darunter ein weicher Schatten unter den Ballen, tiefer wieder hell
        const unterKante = y - nebelAb;
        const schattenBand = unterKante < 2 ? 0 : unterKante < 9 ? 0.55 * Math.sin(((unterKante - 2) / 7) * Math.PI) : 0.1;
        const nebelFarbe = schattenBand > s ? NEBEL_TIEF : NEBEL;
        L[i] = nebel < 1 && ton * (1 - nebel) > s ? k.farbe : nebelFarbe;
        if (unterKante >= 0 && unterKante < 3) w.zyklus(e, x, y, ZYKLUS_NEBEL, x * 3 + unterKante * 40, NEBEL, k.farbe);
      }
    }
    // Gegenlichtsaum auf der Sonnenseite des Grats
    if (k.saum && !imSchatten && y0 - 1 >= oberste && L[(y0 - 1 + U) * B + x] === LEER) L[(y0 - 1 + U) * B + x] = SAUM;
  }
  if (k.tannen) {
    const t = k.tannen;
    for (let x = 2 + Math.floor(rnd() * 6); x < B - 2; x += 4 + Math.floor(rnd() * t.abstand)) {
      const g = t.klein + Math.floor(rnd() * (t.gross - t.klein + 1));
      tanne(w, e, x, kamm[x] + 1, g, t.farbe);
    }
  }
  w.kaemme.push({ ebene: e, y: kamm });
  return kamm;
}

// Fläche von einer Oberkante bis zum unteren Rand füllen; farbe(x, y, tiefe) liefert die Farbnummer
function flaeche(w: Werk, e: number, oben: ArrayLike<number>, farbe: (x: number, y: number, tiefe: number) => number): void {
  const { B, H } = w;
  const L = w.lagen[e];
  for (let x = 0; x < B; x++) {
    const y0 = Math.max(-U, Math.round(oben[x]));
    for (let y = y0; y < H + U; y++) L[(y + U) * B + x] = farbe(x, y, y - y0);
  }
}

// Weiche Oberkante aus Zufall: Mittelwert ± Ausschlag, Rauheit klein = sanft
function welle(rnd: () => number, B: number, rauheit: number): Float32Array {
  return grat(rnd, rauheit, B);
}

// Oberkante eines Nebelmeers: flache Ballen, die sich aneinanderreihen
function nebelLinie(w: Werk, y: number, ballen: number): Float32Array {
  const r = grat(w.rv, 0.5, w.B);
  const linie = new Float32Array(w.B);
  for (let x = 0; x < w.B; x++) {
    linie[x] = y - Math.abs(Math.sin((x / w.B) * ballen * Math.PI + r[x] * 2)) * w.H * 0.018 - r[x] * w.H * 0.02;
  }
  return linie;
}

/* Himmel ---------------------------------------------------------------------------------------------- */

// Sonne setzen: mal links, mal rechts. Sie hält samt Hof Abstand zum HUD, sonst wechselt sie die Seite.
function sonneSetzen(w: Werk, L: Landschaft): void {
  const { B, H, rnd, st, weiss } = w;
  const [weg0, weg1] = L.sonneX ?? [0.1, 0.28];
  w.sr = Math.max(5, Math.min(H * 0.13, B * 0.06)) * st.sonne.groesse;
  const [h0, h1] = st.sonne.hoehe;
  w.sy = H * (h0 + rnd() * (h1 - h0) + (L.sonneHoehe ?? 0));
  w.sy = Math.max(w.sy, weiss + KANTE + w.sr + 3);
  w.seite = rnd() < 0.5 ? 1 : -1;
  w.sx = B * (0.5 + w.seite * (weg0 + rnd() * (weg1 - weg0)));
  if (w.klassisch) {
    // Das Startbild wie früher: Liegt die Sonne samt Hof am HUD, wechselt sie die Seite
    const hof = w.sr * 2.4;
    if (w.hud(w.sx, w.sy) < hof && w.hud(B - w.sx, w.sy) > w.hud(w.sx, w.sy)) {
      w.sx = B - w.sx;
      w.seite = w.seite === 1 ? -1 : 1;
    }
    return;
  }
  // Sonst bleibt die Seite, wie sie gewürfelt ist, damit das Licht bei jedem Neuzeichnen wirklich
  // wechseln kann. Liegt das HUD im Weg, rückt die Sonne zur Bildmitte (höchstens bis 2 % daneben),
  // der äußere Hof endet dann am HUD. Erst wenn auch das nicht reicht, wechselt sie die Seite.
  const abstand = w.sr * 1.9;
  if (w.hud(w.sx, w.sy) < abstand) {
    const innen = B * (0.5 + w.seite * 0.02);
    let x = w.sx;
    while ((x - innen) * w.seite > 0 && w.hud(x, w.sy) < abstand) x -= w.seite;
    if (w.hud(x, w.sy) >= abstand) w.sx = x - w.seite * w.rk() * B * 0.03;
    else {
      w.sx = B - w.sx;
      w.seite = w.seite === 1 ? -1 : 1;
    }
  }
}

// Freier Himmel für Figuren: genug Abstand zu Kante, Gelände, HUD und Sonne
function himmelFrei(w: Werk, x: number, y: number, rand: number): boolean {
  const xi = Math.round(x);
  return (
    xi > 3 && xi < w.B - 4 && y - rand >= w.weiss + KANTE + 1 && y + rand < w.horizont[xi] - 11 &&
    w.hud(x, y) > rand + 20 && Math.hypot(x - w.sx, y - w.sy) > w.sr * 1.6 + rand + 4
  );
}

function himmel(w: Werk): void {
  const { B, H, weiss, st, sx, sy, sr } = w;
  const L0 = w.lagen[0];
  L0.fill(BOGEN); // der Himmel deckt vollständig
  const oberste = weiss + KANTE;

  // Dunst: Der Himmel hellt zum Horizont hin auf (in den meisten Tagpaletten Papier, also unsichtbar)
  if (st.dunst > 0) {
    for (let y = 0; y < H + U; y++) {
      const ab = st.dunstAb ?? 0.3;
      const dunst = Math.min(0.6 * Math.min(1.2, st.dunst), Math.max(0, (y / H - ab) / (0.75 - ab)) * 0.6 * st.dunst);
      if (dunst <= 0) continue;
      for (let x = 0; x < B; x++) if (dunst > (BAYER[(y + U + 1) % 8][(x + 2) % 8] + 0.5) / 64) L0[(y + U) * B + x] = DUNST;
    }
  }

  // Himmel hinter dem Gelände: Hof, Strahlen, Wolken und Sonne enden knapp unter der obersten
  // Kammlinie. So scheint durch den Nebel am Fuß nur Dunst, nie die Sonne.
  const horizont = w.horizont;
  let tiefster = 0;
  for (let x = 0; x < B; x++) {
    let y = oberste;
    while (y < H + U && w.lagen[1][(y + U) * B + x] === LEER && w.lagen[2][(y + U) * B + x] === LEER && w.lagen[3][(y + U) * B + x] === LEER) y++;
    horizont[x] = Math.min(H + U, y + 8); // Reserve für den Parallax-Versatz zwischen Himmel und Gelände
    tiefster = Math.max(tiefster, horizont[x]);
  }

  // Hof und Strahlen. Nach oben ist der Hof gestaucht und läuft rund vor der weißen Kante aus.
  const n = st.sonne.strahlen;
  const strahlen = Array.from({ length: n }, (_, i) => ((-70 + (i * 140) / Math.max(1, n - 1)) * Math.PI) / 180);
  const keil = (1.25 * Math.PI) / 180;
  const strahlLaenge = Math.hypot(B, H) * 0.7;
  const haloRand = 3.2 * sr * st.sonne.hof;
  const nachOben = Math.max(sr + 3, sy - oberste - 2);
  const stauchung = haloRand / Math.min(haloRand, nachOben);
  const innen = sr * 1.75;
  // Für das Leben: Mit diesen Maßen rechnet es Hof und Strahlen genau so nach, wie sie hier entstehen
  w.extra.sonne = { hof: haloRand, stauchung, innen, strahlLaenge, strahlen: n };
  // Nur wo Hof oder ein Strahl liegen kann: um die Sonne im Hofradius, darunter je Strahl ein schmaler
  // Streifen. Der genaue Test bleibt derselbe, er läuft nur nicht mehr über jedes Pixel.
  const tanKeil = strahlen.map((a) => [Math.tan(a - keil), Math.tan(a + keil)]);
  const spalten = new Uint8Array(B);
  for (let y = oberste; y < Math.min(tiefster, H); y++) {
    const dyZeile = y - sy;
    let a0 = Math.max(0, Math.floor(sx - haloRand - 1));
    let a1 = Math.min(B - 1, Math.ceil(sx + haloRand + 1));
    spalten.fill(0);
    for (let x = a0; x <= a1; x++) spalten[x] = 1;
    if (dyZeile > 0 && n) {
      for (const [t0, t1] of tanKeil) {
        const xa = Math.max(0, Math.floor(sx + dyZeile * t0) - 1);
        const xb = Math.min(B - 1, Math.ceil(sx + dyZeile * t1) + 1);
        for (let x = xa; x <= xb; x++) spalten[x] = 1;
        if (xa < a0) a0 = xa;
        if (xb > a1) a1 = xb;
      }
    }
    for (let x = a0; x <= a1; x++) {
      if (!spalten[x] || y >= horizont[x]) continue;
      const dx = x - sx;
      const dy = y - sy;
      const d = Math.hypot(dx, dy);
      if (d <= sr + 1 || w.hud(x, y) < 4) continue;
      const dh = dy < 0 ? Math.hypot(dx, dy * stauchung) : d;
      const hof = dh < haloRand ? (1 - dh / haloRand) ** 1.6 : 0;
      let strahl = 0;
      let welcher = 0;
      if (dy > 0 && n) {
        const winkel = Math.atan2(dx, dy); // 0 = senkrecht nach unten
        for (let s = 0; s < n; s++) {
          if (Math.abs(winkel - strahlen[s]) < keil) {
            strahl = 0.22 * Math.max(0, 1 - d / strahlLaenge);
            welcher = s;
          }
        }
      }
      // Hof vor Strahl. Nachts läuft der Hof unter der 8-%-Linie aus.
      const s0 = w.schwelle(0, x, y);
      const i = (y + U) * B + x;
      if (hof > s0) {
        L0[i] = hof * Math.min(1, (y - weiss) / (H * 0.06)) > s0 ? GELB : HOF_RAND;
        if (dh < innen) w.zyklus(0, x, y, ZYKLUS_HOF, (Math.atan2(dy, dx) / (2 * Math.PI)) * 256 + 256, L0[i], L0[i] === GELB ? BOGEN : L0[i]);
      } else if (strahl > s0) {
        L0[i] = STRAHL;
        w.zyklus(0, x, y, ZYKLUS_STRAHL, welcher * 37, STRAHL, BOGEN);
      } else if (dh < innen) {
        w.zyklus(0, x, y, ZYKLUS_HOF, (Math.atan2(dy, dx) / (2 * Math.PI)) * 256 + 256, GELB, L0[i]);
      }
    }
  }

  wolken(w);

  // Sonne: volle Scheibe mit Schlitzen, die nach unten breiter werden
  for (let y = Math.floor(sy - sr - 3); y <= sy + sr + 3; y++) {
    for (let x = Math.floor(sx - sr - 3); x <= sx + sr + 3; x++) {
      const d = Math.hypot(x - sx, y - sy);
      if (d > sr + 1 || x < 0 || x >= B || y >= horizont[x]) continue;
      const reihe = Math.round(y - sy);
      const schlitz = reihe > 0 && reihe % 3 < (reihe / sr) * 2.4;
      w.setze(0, x, y, d <= sr && !schlitz ? MOND : BOGEN);
      if (d <= sr && reihe > 0) w.zyklus(0, x, y, ZYKLUS_SCHEIBE, (reihe / sr) * 255, MOND, BOGEN);
    }
  }

  // Sterne: eigener Zufallsstrom, nur auf freiem Himmel der Himmelsebene. Tagsüber Papier.
  const rs = zufall(w.startwert ^ 0x5eed);
  const hofFrei = haloRand + 2;
  for (let y = weiss; y < w.ufer; y++) {
    const dichte = 0.018 * Math.min(1, (y - weiss) / (H * 0.1)) * Math.max(0, 1 - y / (H * 0.6));
    for (let x = 0; x < B; x++) {
      const z = rs();
      if (z >= dichte || y < oberste) continue;
      const f = L0[(y + U) * B + x];
      if (f !== BOGEN && f !== DUNST) continue;
      if (y >= horizont[x] - 6 || w.hud(x, y) < 6 || Math.hypot(x - sx, y - sy) < hofFrei) continue;
      const hell = z < dichte * 0.25;
      L0[(y + U) * B + x] = hell ? STERN : STERN_MATT;
      w.zyklus(0, x, y, ZYKLUS_STERN, rs() * 256, hell ? STERN : STERN_MATT, f);
    }
  }
  // Drei Funkelsterne als Kreuz aus fünf Pixeln
  const kreuz = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let k = 0, versuch = 0; k < 3 && versuch < 60; versuch++) {
    const x = Math.round(B * (0.06 + rs() * 0.88));
    const y = Math.round(H * (0.12 + rs() * 0.2));
    if (!himmelFrei(w, x, y, 3) || Math.hypot(x - sx, y - sy) < hofFrei + 4) continue;
    if (kreuz.some(([a, b]) => ![BOGEN, DUNST, STERN_MATT].includes(w.lies(0, x + a, y + b)))) continue;
    kreuz.forEach(([a, b]) => {
      const vorher = w.lies(0, x + a, y + b);
      w.setze(0, x + a, y + b, STERN);
      w.zyklus(0, x + a, y + b, ZYKLUS_STERN, k * 85 + (a || b ? 128 : 0), STERN, vorher === STERN_MATT ? BOGEN : vorher);
    });
    k++;
  }
}

function wolken(w: Werk): void {
  const { B, H, weiss, st, rh } = w;
  const oberste = weiss + KANTE + 1;
  const horizont = w.horizont;
  const ende = Math.min(w.ufer, H);

  // Für das Leben: Jedes Wolkenpixel merkt sich den Himmel darunter, damit die Wolken ziehen können
  const roh = w.wolkenRoh;
  const setzeWolke = (x: number, y: number, f: number) => {
    if (x < 0 || x >= B || y < oberste || y >= horizont[x] || w.hud(x, y) < 3) return;
    if (Math.hypot(x - w.sx, y - w.sy) <= w.sr + 1) return;
    const i = (y + U) * B + x;
    const alt = roh.get(i);
    roh.set(i, alt ? [alt[0], f] : [w.lagen[0][i], f]);
    w.lagen[0][i] = f;
  };

  if (st.wolken === "baender") {
    // Linien, deren Abstand zum Horizont hin wächst, in Stücke zerlegt. Das Profil läuft dreimal über
    // die Breite, so entstehen Fetzen statt Drähte; wo es besonders hoch ist, kommt eine zweite Zeile dazu.
    for (let k = 0, y = weiss; y < w.ufer; k++, y += 2 + Math.round((k * H) / 75)) {
      const stuecke = grat(rh, 0.6, B);
      const anfang = Math.floor(rh() * B);
      const dichte = Math.min(1, Math.max(0, (y / H - 0.08) / 0.12)) * st.wolkenMenge;
      const versatz = k % 2;
      for (let x = 0; x < B; x++) {
        const wert = stuecke[(x * 3 + versatz + anfang) % B];
        if (wert > 0.45 && dichte > w.schwelle(0, x, y)) setzeWolke(x, y, WOLKE);
        if (wert > 0.72 && dichte > w.schwelle(0, x, y - 1)) setzeWolke(x, y - 1, WOLKE);
      }
    }
    return;
  }

  if (st.wolken === "schleier") {
    // Zirren: lange, schräge Schleier hoch oben, locker gerastert
    const zahl = Math.round((2 + rh() * 3) * st.wolkenMenge);
    for (let n = 0; n < zahl; n++) {
      const cx = rh() * B;
      const cy = H * (0.12 + rh() * 0.16);
      const laenge = B * (0.12 + rh() * 0.22);
      const neigung = (rh() - 0.5) * 0.18;
      const dicke = 1.5 + rh() * 2.5;
      for (let x = Math.floor(cx - laenge); x <= cx + laenge; x++) {
        const t = (x - cx) / laenge;
        const mitte = cy + (x - cx) * neigung + Math.sin(t * 5 + n) * 1.2;
        const staerke = (1 - t * t) * 0.55;
        for (let y = Math.floor(mitte - dicke); y <= mitte + dicke; y++) {
          const q = staerke * (1 - Math.abs(y - mitte) / (dicke + 0.5));
          // Fasern: jede zweite Spalte ein wenig versetzt
          if (q > w.schwelle(0, x, y) && ((x + Math.round(y * 2.5)) & 3) !== 0) setzeWolke(x, y, WOLKE);
        }
      }
    }
    return;
  }

  if (st.wolken === "linsen") {
    // Föhnmauer: eine Wolkenbank sitzt auf dem höchsten Abschnitt der Kette und quillt über den Grat,
    // oben im Licht, nach oben im Raster ausfransend
    // Die Mauer liegt auf dem Kamm selbst, nicht auf dem, was darauf steht: schmale Spitzen (Gipfelkreuz,
    // Turm, Felsnadel, Baum) schneidet ein Öffnen der Horizontlinie ab. Sonst stünde über einem Kreuz eine
    // schmale Wolkensäule, die mit dem Linsenstapel darüber eine Pilzwolke ergibt.
    const glatt = new Int32Array(B);
    {
      const r = Math.max(3, Math.round(B * 0.025));
      const tief = new Int32Array(B);
      for (let x = 0; x < B; x++) {
        let m = 0;
        for (let d = -r; d <= r; d++) m = Math.max(m, horizont[klemme(x + d, 0, B - 1)]);
        tief[x] = m;
      }
      for (let x = 0; x < B; x++) {
        let m = H + U;
        for (let d = -r; d <= r; d++) m = Math.min(m, tief[klemme(x + d, 0, B - 1)]);
        glatt[x] = m;
      }
    }
    const mauerBreite = B * (0.25 + rh() * 0.12);
    let besteX = -1;
    let besteY = H;
    for (let x = Math.round(mauerBreite / 2); x < B - mauerBreite / 2; x += 2) {
      if (Math.abs(x - w.sx) < w.sr * 1.5 + mauerBreite / 2) continue;
      let hudFrei = true;
      for (let d = -0.5; d <= 0.5 && hudFrei; d += 0.25) {
        const xx = Math.round(x + d * mauerBreite);
        hudFrei = w.hud(xx, glatt[klemme(xx, 0, B - 1)] - 8 - H * 0.06) >= 4;
      }
      if (!hudFrei) continue;
      if (glatt[x] < besteY) {
        besteY = glatt[x];
        besteX = x;
      }
    }
    if (besteX >= 0) {
      const mauerHoch = Math.max(3, Math.round(H * (0.045 + rh() * 0.025)));
      const welle = grat(rh, 0.5, B);
      for (let x = Math.floor(besteX - mauerBreite / 2); x <= besteX + mauerBreite / 2; x++) {
        if (x < 0 || x >= B) continue;
        const t = Math.abs(x - besteX) / (mauerBreite / 2);
        const dicke = mauerHoch * Math.sqrt(Math.max(0, 1 - t * t)) * (0.7 + welle[x] * 0.6);
        const fuss = glatt[x] - 6; // horizont liegt 8 Zeilen unter dem Grat
        for (let j = 1; j <= dicke + 2; j++) {
          const y = fuss - j;
          const rand = j > dicke - 1;
          if (rand && (j - dicke + 1) / 3 > w.schwelle(0, x, y)) continue;
          // Körper im Wolkenton, damit er sich vom hellen Grat abhebt; nur die Oberkante im Licht
          setzeWolke(x, y, rand ? WOLKE : j > dicke - 2 ? WOLKE_LICHT : j <= 1 ? WOLKE_SCHATTEN : WOLKE);
        }
      }
    }
    // Föhnfische: gestapelte Linsen, die größte steht über dem höchsten Gipfel, oben im Licht mit einem
    // Saum zur Sonne, unten mit Schattenkante
    let gipfelX = -1;
    let gipfelY = H;
    for (let x = Math.round(B * 0.12); x < B * 0.88; x += 2) {
      if (Math.abs(x - w.sx) < w.sr * 2.4 || w.hud(x, horizont[x] - H * 0.12) < 10) continue;
      if (horizont[x] < gipfelY) {
        gipfelY = horizont[x];
        gipfelX = x;
      }
    }
    const zahl = 3 + Math.floor(rh() * 3);
    let gesetzt = 0;
    for (let versuch = 0; versuch < 80 && gesetzt < zahl; versuch++) {
      const gross = gesetzt === 0;
      const laenge = B * (gross ? 0.13 + rh() * 0.08 : 0.05 + rh() * 0.07);
      const ueberGipfel = gross && gipfelX >= 0 && versuch < 20;
      let cx = ueberGipfel ? gipfelX + (rh() - 0.5) * B * 0.04 : B * (0.1 + rh() * 0.8);
      let platten = gross ? 3 + Math.floor(rh() * 3) : 1 + Math.floor(rh() * 2);
      const dicke = Math.max(2, Math.round(H * (gross ? 0.022 : 0.016)));
      // Über einem hohen Gipfel ist weniger Himmel: dann eben weniger Platten
      if (ueberGipfel) platten = Math.max(2, Math.min(platten, Math.floor((gipfelY - 12 - oberste) / (dicke + 1))));
      const hoeheGesamt = platten * (dicke + 1);
      if (ueberGipfel) {
        // Steht die Sonne nah am Gipfel, rückt der Stapel von ihr weg, bleibt aber über dem Gipfel
        const fehlt = w.sr * 1.3 + hoeheGesamt + laenge + 3 - Math.abs(cx - w.sx);
        if (fehlt > 0) cx += Math.sign(cx - w.sx || 1) * Math.min(fehlt, laenge * 0.7);
      }
      const cy = ueberGipfel
        ? gipfelY - 8 - 3 - rh() * H * 0.05
        : oberste + hoeheGesamt + 2 + rh() * H * 0.16;
      if (cy - hoeheGesamt < oberste + 1) continue;
      // Platz prüfen: frei von HUD und Sonne, die Mitte über dem Gelände (die Spitzen dürfen hinter Gipfel tauchen)
      const mitteFrei = cy + 2 < horizont[klemme(Math.round(cx), 0, B - 1)] - (ueberGipfel ? 1 : 6);
      let frei = mitteFrei;
      for (let x = Math.floor(cx - laenge - 2); x <= cx + laenge + 2 && frei; x += 2) {
        if (w.hud(x, cy - hoeheGesamt) < 6 || w.hud(x, cy) < 6) frei = false;
        if (Math.hypot(x - w.sx, cy - hoeheGesamt / 2 - w.sy) < w.sr * 1.3 + hoeheGesamt) frei = false;
      }
      if (!frei) continue;
      for (let pl = 0; pl < platten; pl++) {
        const l = laenge * (1 - pl * 0.17) * (0.9 + rh() * 0.2);
        const mx = cx + (rh() - 0.5) * laenge * 0.2;
        const unten = Math.round(cy - pl * (dicke + 1));
        for (let x = Math.floor(mx - l); x <= mx + l; x++) {
          const t = Math.abs(x - mx) / l;
          const h = Math.round(dicke * Math.sqrt(Math.max(0, 1 - t * t)) * 1.15);
          if (h <= 0) {
            if (t < 1.02 && (x & 1) === 0) setzeWolke(x, unten, WOLKE);
            continue;
          }
          const zurSonne = (x - mx) * w.seite <= 0 ? false : true;
          for (let j = 0; j < h; j++) {
            const y = unten - j;
            const f = j === h - 1 ? (zurSonne && t > 0.25 && t < 0.85 ? SAUM : WOLKE_LICHT) : j === 0 ? WOLKE_SCHATTEN : WOLKE;
            // die Spitzen laufen im Raster aus
            if (t > 0.82 && (t - 0.82) * 5.5 > w.schwelle(0, x, y)) continue;
            setzeWolke(x, y, f);
          }
        }
      }
      gesetzt++;
    }
    return;
  }

  // Haufenwolken: türmen sich hinter den Gipfeln. Ein Rand rundum (zur Sonne ein Saum in Kopie-Gelb,
  // nachts in Mondsilber), die Lichtseite hell, der flache Boden im Schatten. Die Schattenseite franst im
  // Raster aus, damit die Wolke nachts nicht als Felsklotz steht.
  const zahl = 2 + Math.floor(rh() * 3);
  let gesetzt = 0;
  for (let versuch = 0; versuch < 40 && gesetzt < zahl; versuch++) {
    const cx = B * (0.05 + rh() * 0.9);
    const xi = klemme(Math.round(cx), 0, B - 1);
    const boden = horizont[xi] - 8 + Math.round(rh() * 6);
    // Auf kleinen Bildern (Handy) flacher und breiter: Sonst bleibt von der Wolke eine runde Scheibe, die
    // neben Sonne oder Mond wie ein zweites Gestirn aussieht
    const klein = B < 200;
    const hoch = Math.min(H * (klein ? 0.08 + rh() * 0.06 : 0.1 + rh() * 0.1), boden - oberste - 4);
    const breite = Math.max(B * (0.05 + rh() * 0.07), hoch * (klein ? 1.6 : 1.15));
    if (hoch < 6 || boden > ende) continue;
    if (w.hud(cx, boden - hoch) < breite * 0.5 + 8) continue;
    if (Math.abs(cx - w.sx) < breite + w.sr * 1.4 && boden - hoch < w.sy + w.sr * 1.6) continue;
    // Auch nicht dicht neben Sonne oder Mond (dieselbe Größe, dieselbe Höhe: ein Doppelgestirn)
    if (Math.abs(cx - w.sx) < breite * 1.6 + w.sr * 2.2 && Math.abs(boden - hoch * 0.6 - w.sy) < hoch * 0.6 + w.sr * 1.5) continue;
    const ballen: number[][] = [];
    const nb = 4 + Math.floor(rh() * 4);
    for (let b = 0; b < nb; b++) {
      const t = b / (nb - 1) - 0.5;
      const r = hoch * (0.35 + (1 - Math.abs(t) * 1.6) * 0.45) * (0.8 + rh() * 0.3);
      ballen.push([cx + t * breite * 2, boden - r * 0.85, Math.max(2, r)]);
    }
    const x0 = Math.floor(cx - breite * 1.6) - 1;
    const y0 = Math.floor(boden - hoch * 1.3) - 1;
    const bw = Math.ceil(breite * 3.2) + 3;
    const bh = Math.round(boden) - y0 + 1;
    // Maske: welcher Ballen deckt (vorderster = größter Innenabstand), −1 = frei
    const wer = new Int8Array(bw * bh).fill(-1);
    for (let j = 0; j < bh; j++) {
      for (let i = 0; i < bw; i++) {
        let innen = 0;
        ballen.forEach(([bx, by, r], n) => {
          const d = 1 - Math.hypot(x0 + i - bx, (y0 + j - by) * 1.1) / r;
          if (d > innen) {
            innen = d;
            wer[j * bw + i] = n;
          }
        });
      }
    }
    const frei = (i: number, j: number) => i < 0 || j < 0 || i >= bw || j >= bh || wer[j * bw + i] < 0;
    for (let j = 0; j < bh; j++) {
      for (let i = 0; i < bw; i++) {
        const n = wer[j * bw + i];
        if (n < 0) continue;
        const x = x0 + i;
        const y = y0 + j;
        const [bx, by, r] = ballen[n];
        const s = w.schwelle(0, x, y);
        // Lage zur Sonne: Normale des Ballens gegen die Richtung zur Sonne
        // Normale: überwiegend die der ganzen Wolke, ein wenig die des Ballens (sonst Streifen je Ballen)
        const nx = ((x - cx) / (breite * 1.6)) * 0.7 + ((x - bx) / r) * 0.3;
        const ny = ((y - (boden - hoch * 0.5)) / hoch) * 0.7 + ((y - by) / r) * 0.3;
        const lx = w.sx - x;
        const ly = w.sy - y;
        const ll = Math.hypot(lx, ly) || 1;
        const licht = (nx * lx + ny * ly) / ll;
        const unten = (y - (boden - hoch * 0.45)) / (hoch * 0.45);
        const rand = j < bh - 1 && (frei(i - 1, j) || frei(i + 1, j) || frei(i, j - 1));
        let f: number;
        if (rand) {
          // Der Saum liegt nur auf der Oberkante: an den Flanken hinab liefe er nachts als silberne
          // Krakellinie über den Himmel, um eine runde Wolke als Sichel
          if (licht > 0.15) f = frei(i, j - 1) ? SAUM : WOLKE_LICHT;
          else if (licht < -0.1 && 0.5 < s) continue; // die Schattenseite franst aus
          else f = WOLKE;
        } else if (unten > 0.25 && (unten - 0.25) * 1.4 > s) f = WOLKE_SCHATTEN;
        else if (licht > 0.05) f = WOLKE_LICHT;
        else f = licht + 0.45 > s ? WOLKE_LICHT : WOLKE;
        setzeWolke(x, y, f);
      }
    }
    gesetzt++;
  }
}

/* Wasser ----------------------------------------------------------------------------------------- */

// Spiegelung im See: alles eine bis zwei Stufen dunkler. DUNKLER ist die Zeile dazwischen, eine Stufe
// tiefer: So entstehen die Wellenlinien. Index ist die Tagesgrundfarbe der Rolle (GRUNDTON).
export const SPIEGEL = [T3, T3, T3, T4, T4, T5, T5, T6];
export const DUNKLER = [T4, T4, T4, T4, T5, T5, T6, T6];
// Grundton jeder Rolle für die Spiegelung (0 Papier … 7 Nacht-Tinte)
const GRUNDTON = [
  0, 1, 2, 3, 4, 5, 6, 7, // Grundfarben
  1, 1, 1, 0, 0, 6, 2, 6, 6, 6, 6, 0, 0, 0, 1, // 8–22 wie TAG_ROLLE
  2, 0, 0, 2, 2, 5, 0, 2, 2, 3, 3, 2, 1, 1, 6, 7, 2, 2, 6, 2, 0, 3, // 23–44
  4, 5, // 45–46
];

// See von der Uferzeile bis zum Bildende: gestauchte, gewellte Spiegelung des Bilds darüber, Glitzerspur
// unter der Sonne, nach unten volle Nacht-Tinte. Gefroren: Eis mit Rissen und Schneeflecken.
function seeMalen(w: Werk, e: number, ufer: number, links: number, rechts: number): void {
  const { B, H, nacht, sx, sr } = w;
  const ueberUfer = new Uint8Array(B * ufer);
  for (let y = 0; y < ufer; y++) for (let x = 0; x < B; x++) ueberUfer[y * B + x] = w.oben(x, y);
  const lichtkante = grat(w.rnd, 0.6, B); // helle Uferlinie, in Stücke zerlegt
  const seeGrund = ufer + (nacht - ufer) * 0.55; // ab hier dunkelt der Grund nach
  const eis = w.st.eis;
  const riss = eis ? grat(w.rv, 0.7, B) : null;
  const L = w.lagen[e];
  // Für das Leben: die Wasserfläche, deren Spiegelung zittern darf (ohne Uferlinie)
  const seeRoh = { y0: ufer + 1, y1: nacht, werte: new Uint8Array(B * Math.max(0, nacht - ufer - 1)).fill(LEER) };
  for (let y = ufer; y < H + U; y++) {
    const d = y - ufer;
    const quelle = ufer - 1 - Math.round(d * 2.5);
    const welle = eis ? 0 : Math.round(Math.sin(d * 1.7) * 1.6) * (d % 2 ? 1 : -1);
    const grund = Math.min(1, Math.max(0, (y - seeGrund) / (nacht - seeGrund)));
    const spur = Math.round(sr * 0.6 + d * 1.2);
    const glanz = Math.round(Math.sin(d * 2.3) * 2);
    for (let x = links; x < rechts; x++) {
      const s = w.schwelle(3, x, y);
      let farbe = T6;
      if (y < nacht && d === 0) farbe = lichtkante[x] > 0.3 && x % 29 > 2 ? T4 : T6;
      else if (y < nacht) {
        const q = quelle >= 0 ? GRUNDTON[ueberUfer[quelle * B + Math.min(B - 1, Math.max(0, x + welle))]] ?? 7 : 0;
        const dx = x - Math.round(sx);
        const rand = Math.abs(dx) / (spur + 1);
        if (eis && riss) {
          // Eis: hell, die Spiegelung nur als leiser Schatten, dunkle Risse und Schneeflecken
          const dunkel = q >= 5 ? 0.35 : q >= 3 ? 0.15 : 0;
          farbe = dunkel > s ? SCHNEE_SCHATTEN : EIS;
          const r = riss[(x * 3 + d * 7) % B];
          if (Math.abs(r - 0.5) < 0.012 + d * 0.0006) farbe = T4;
          if (riss[(x + d * 13) % B] > 0.82 && d % 4 < 2) farbe = SCHNEE;
          const sg = w.grob(e, x, y);
          if (grund > sg) farbe = grund > 0.6 + sg * 0.4 ? T6 : T5;
          else if (rand <= 1 && (1 - rand * rand) * 0.12 > s) {
            w.zyklus(e, x, y, ZYKLUS_EIS, (x * 37 + d * 91) & 255, GLITZER_HELL, farbe);
          }
        } else {
          const spiegel = d % 2 ? SPIEGEL[q] : DUNKLER[q];
          const ruhe = grund > s ? T6 : spiegel;
          farbe = ruhe;
          // Glitzerspur: kurze Striche, zum Rand der Spur und zur Tiefe hin seltener
          if (rand <= 1 && (1 - rand * rand) * (1 - grund * 0.85) > s) {
            const stelle = (dx + glanz * 3 + d * 5 + 700) % 7;
            const leucht = d % 3 ? GLITZER : GLITZER_HELL;
            if (stelle < (d % 2 ? 3 : 2)) farbe = leucht;
            w.zyklus(e, x, y, ZYKLUS_GLITZER, (stelle * 256) / 7, leucht, ruhe);
          }
        }
      }
      L[(y + U) * B + x] = farbe;
      if (y > ufer && y < nacht) seeRoh.werte[(y - ufer - 1) * B + x] = farbe;
    }
  }
  w.seeRoh = seeRoh;
  w.wasser = { y0: ufer, y1: nacht, spurX: Math.round(sx) };
}

/* Landschaft: Bergsee (das gewohnte Bild) ------------------------------------------------------- */

function see(w: Werk): void {
  const { B, H, rnd, rv, st, weiss } = w;
  // Blickpunkt: Horizont höher oder tiefer, Berge näher oder ferner, Rahmen höher (nicht im Startbild)
  const blick = w.klassisch ? { ufer: 0.72, hoehe: 1, rahmen: 0.4 } : { ufer: 0.66 + w.rk() * 0.1, hoehe: 0.8 + w.rk() * 0.32, rahmen: 0.34 + w.rk() * 0.14 };
  const ufer = (w.ufer = Math.round(H * blick.ufer));
  // Varianten: Gipfelkreuz statt Wanderer, Rahmen nur auf einer Seite, Insel, Boot
  const mitKreuz = rv() < 0.28;
  const rahmenWahl = rv();
  const rahmenSeiten = rahmenWahl < 0.72 ? [1, -1] : rahmenWahl < 0.86 ? [1] : [-1];
  const mitInsel = rv() < 0.3;
  const mitBoot = rv() < 0.4;

  // Sechs Ketten: Die hinteren vier lösen sich am Fuß in waagerechten Nebelbändern auf, aus denen die
  // nächste Kette aufsteigt. Im Morgennebel liegt dort ein deckendes Nebelmeer.
  const ketten = [
    { basis: 0.46, hoehe: 0.36, rauheit: 0.5, licht: 0.5, schatten: 0.875, ebene: 1 },
    { basis: 0.52, hoehe: 0.28, rauheit: 0.53, licht: 0.625, schatten: 1, ebene: 1 },
    { basis: 0.575, hoehe: 0.21, rauheit: 0.55, licht: 0.75, schatten: 1, ebene: 2 },
    { basis: 0.625, hoehe: 0.15, rauheit: 0.57, licht: 0.75, schatten: 1, ebene: 2 },
    { basis: 0.67, hoehe: 0.105, rauheit: 0.6, licht: 0.875, schatten: 1, ebene: 3 },
    { basis: 0.715, hoehe: 0.06, rauheit: 0.62, licht: 1, schatten: 1, ebene: 3 },
  ];
  const sattel = 0.3 + rnd() * 0.55;
  const schneeLinie = H * (0.27 + st.schnee * 0.45);
  const kaemme = ketten.map((k, i) => {
    const kb = (k.basis * blick.ufer) / 0.72;
    const kh = k.hoehe * blick.hoehe;
    const nebel = i >= 4 ? undefined : st.nebel ? nebelLinie(w, H * (kb - kh * 0.4), B / 26) : H * (kb - kh * 0.2);
    const glut = st.glut && i < 3 ? H * (0.1 - i * 0.025) : undefined;
    return kette(w, {
      ...k,
      basis: kb,
      hoehe: kh,
      farbe: T1 + i,
      grund: i === 0 ? BOGEN : T1 + i - 1,
      sattel: i < 4 ? sattel : undefined,
      schnee: i < 2 || st.schnee >= 0.5 ? schneeLinie : undefined,
      schneeTiefe: st.schnee >= 0.5 ? 0.9 : 0.6,
      saum: i < 2,
      glut,
      nebel,
      meer: st.nebel > 0 && i < 4,
      tannen: i >= 4 ? (i === 4 ? { klein: 4, gross: 7, farbe: T5, abstand: 9 } : { klein: 6, gross: 11, farbe: T6, abstand: 12 }) : undefined,
    });
  });

  // Der Himmel übernimmt den Zufallsstrom an der Stelle, an der früher die Wolken gezogen wurden:
  // So bleibt das Startbild dem gewohnten nahe.
  w.rh = rnd.gabel();
  for (let k = 0, y = weiss; y < ufer; k++, y += 2 + Math.round((k * H) / 75)) for (let n = 0; n < 258; n++) rnd();

  // Wanderer oder Gipfelkreuz auf dem höchsten freien Gipfel der hinteren Kette
  let gipfelX = -1;
  let gipfelY = H;
  for (let x = Math.ceil(B * 0.12); x <= Math.floor(B * 0.88); x++) {
    const y = kaemme[0][x];
    if (Math.abs(x - w.sx) < w.sr + 8 || y - 10 < weiss + KANTE || w.hud(x, y - 9) < 24) continue;
    if (kaemme[1][x] - y < 10) continue; // die Kette davor darf ihn nicht verdecken
    let lokal = true;
    for (let d = -3; d <= 3; d++) if (kaemme[0][Math.min(B - 1, Math.max(0, x + d))] < y) lokal = false;
    if (lokal && y < gipfelY) {
      gipfelY = y;
      gipfelX = x;
    }
  }
  if (gipfelX >= 0) {
    for (let dx = -3; dx <= 4; dx++) w.setze(1, gipfelX + dx, gipfelY, T1);
    if (mitKreuz) {
      gipfelkreuz(w, 1, gipfelX, gipfelY, 9);
      w.dinge.push("einem Gipfelkreuz");
    } else {
      wanderer(w, 1, gipfelX, gipfelY, 1);
      w.dinge.push("einem Wanderer am Gipfel");
    }
  }

  // Vordergrund-Rahmen: hohe Hänge mit großen Tannen an den Bildrändern
  const rahmenOben = H * blick.rahmen;
  const rahmenBreite = [0, 0];
  [1, -1].forEach((seite, n) => {
    const breite = Math.round(B * (0.15 + rnd() * 0.05));
    const profil = grat(rnd, 0.55, breite);
    if (!rahmenSeiten.includes(seite)) {
      // statt des Hangs ein flaches Ufer mit kleinen Tannen
      for (let i = 0; i < breite * 0.6; i++) {
        const x = seite === 1 ? i : B - 1 - i;
        const t = i / (breite * 0.6);
        const y = Math.round(ufer - 2 - (1 - t) * 4 * profil[i]);
        for (let yy = y; yy < ufer + 1; yy++) w.setze(3, x, yy, T6);
      }
      for (let i = 1; i < breite * 0.5; i += 3 + Math.floor(rnd() * 3)) {
        const x = seite === 1 ? i : B - 1 - i;
        tanne(w, 3, x, ufer - 1, 6 + Math.floor(rnd() * 6), T6);
      }
      return;
    }
    rahmenBreite[n] = breite;
    const hang = new Int32Array(breite);
    for (let i = 0; i < breite; i++) {
      const t = i / (breite - 1);
      const anteil = (1 - t) ** 1.6 * (0.78 + 0.22 * profil[i]);
      hang[i] = Math.round(ufer - (ufer - rahmenOben) * anteil);
      const x = seite === 1 ? i : B - 1 - i;
      for (let y = hang[i]; y < H + U; y++) w.setze(3, x, y, T6);
    }
    // Große Tannen, außen am größten, nach innen kleiner; keine ragt unter das HUD
    for (let i = 1 + Math.floor(rnd() * 3); i < breite - 2; ) {
      const t = i / breite;
      const x = seite === 1 ? i : B - 1 - i;
      let g = Math.round(16 + (1 - t) * 14 + rnd() * 3);
      while (g > 8 && w.hud(x, hang[i] + 2 - g) < 4) g--;
      // Bei sehr kleinen Bildern bleibt die Spitze unter der weißen Kante
      g = Math.min(g, hang[i] + 2 - (weiss + KANTE + 1));
      if (g >= 6) tanne(w, 3, x, hang[i] + 2, g, T6);
      i += Math.max(4, Math.round(g * (0.3 + rnd() * 0.3)));
    }
    // Zwischen zwei Kronen eingeschlossene Löcher schließen: oben zu und seitlich nah begrenzt, sonst
    // blitzt der Himmel als heller Fleck (eine „9“) durch die Tannengruppe
    {
      const L3 = w.lagen[3];
      const dunkel = (x: number, y: number) => x >= 0 && x < B && L3[(y + U) * B + x] === T6;
      const x0 = seite === 1 ? 0 : B - breite;
      const x1 = seite === 1 ? breite - 1 : B - 1;
      for (let y = Math.max(weiss + KANTE + 1, Math.round(rahmenOben) - 40); y < ufer; y++) {
        // Läufe leerer Pixel, links und rechts von Krone begrenzt, höchstens 5 breit, oben überwiegend zu
        for (let x = x0 + 1; x < x1; x++) {
          if (L3[(y + U) * B + x] !== LEER || !dunkel(x - 1, y)) continue;
          let e = x;
          while (e <= x1 && e - x < 6 && L3[(y + U) * B + e] === LEER) e++;
          if (e - x > 5 || !dunkel(e, y)) continue;
          let zu = 0;
          for (let k = x; k < e; k++) if (dunkel(k, y - 1)) zu++;
          if (zu * 2 >= e - x) for (let k = x; k < e; k++) L3[(y + U) * B + k] = T6;
          x = e;
        }
      }
    }
    // Im Sommer blühen am Hangfuß Blumen
    if (st.blumen) {
      for (let i = 2; i < breite - 1; i++) {
        const x = seite === 1 ? i : B - 1 - i;
        for (let y = hang[i] + 3; y < ufer - 1; y++) {
          const z = (BAYER[(x * 3) & 7][(y * 5) & 7] + ((x * 13 + y * 7) % 11)) % 23;
          if (z === 0 && y > hang[i] + 4) w.setze(3, x, y, (x + y) % 3 ? BLUETE_GELB : BLUETE_ROSA);
        }
      }
    }
  });
  w.dinge.push("Tannen");

  w.spaeter.push(() => {
    seeMalen(w, 3, ufer, 0, B);
    // Rahmenhänge reichen bis ins Wasser: dort, wo sie stehen, bleibt der Hang
    w.dinge.push(st.eis ? "einem zugefrorenen See" : "einem See");
    const tiefe = w.nacht - ufer;
    // Insel mit ein paar Tannen
    if (mitInsel && tiefe > 10) {
      const breite = Math.round(B * (0.04 + rv() * 0.04));
      const ix = Math.round(B * (0.5 + (rv() - 0.5) * 0.5));
      const iy = ufer + Math.round(tiefe * 0.22);
      if (Math.abs(ix - w.sx) > breite + 4) {
        for (let dx = -breite; dx <= breite; dx++) {
          const h = Math.round(Math.sqrt(1 - (dx / (breite + 0.5)) ** 2) * 3);
          for (let y = iy - h; y <= iy; y++) w.setze(3, ix + dx, y, T6);
          // dunkle Spiegelung der Insel
          for (let y = iy + 1; y <= iy + h + 1; y++) if ((y + dx) % 2 === 0) w.setze(3, ix + dx, y, T6);
        }
        for (let n = 0, x = ix - breite + 2; x <= ix + breite - 2; n++, x += 2 + Math.floor(rv() * 3)) {
          tanne(w, 3, x, iy - 1, 5 + Math.floor(rv() * 5), T6);
        }
        w.dinge.push("einer kleinen Insel");
      }
    }
    // Ruderboot auf der Glitzerspur
    if (mitBoot && tiefe > 12) {
      const by = ufer + Math.round(tiefe * (0.3 + rv() * 0.25));
      const bx = Math.round(w.sx + (rv() - 0.5) * w.sr * 2);
      if (bx > 8 && bx < B - 8 && !w.verdeckt(3, bx, by)) {
        const p: number[] = [];
        const f: number[] = [];
        for (let dx = -3; dx <= 3; dx++) {
          p.push(dx, 0);
          f.push(HOLZ);
        }
        for (let dx = -2; dx <= 2; dx++) {
          p.push(dx, 1);
          f.push(HOLZ);
        }
        [[0, -1], [0, -2], [0, -3], [-1, -2], [1, -1], [2, -1]].forEach(([dx, dy]) => {
          p.push(dx, dy);
          f.push(dy === -3 ? LAMPE : WANDERER);
        });
        w.figur("boot", 3, bx, by, p, f, 4);
        w.dinge.push("einem Ruderboot");
      }
    }
  });
}

/* Landschaft: Alm ------------------------------------------------------------------------------- */

function alm(w: Werk): void {
  const { B, H, rnd, rv, st, nacht } = w;
  const hoch: 1 | -1 = rv() < 0.5 ? 1 : -1; // Seite, auf der die Wiese hoch ansteigt
  const mitSeilbahn = rv() < 0.3;
  const mitBaum = rv() < 0.65;
  const winter = st.schnee >= 0.5;

  // Ferne Ketten mit Schnee
  const schneeLinie = H * (0.3 + st.schnee * 0.5);
  const sattel = 0.4 + rnd() * 0.4;
  const fern = [
    { basis: 0.44, hoehe: 0.3, rauheit: 0.52, licht: 0.5, schatten: 0.875 },
    { basis: 0.5, hoehe: 0.22, rauheit: 0.55, licht: 0.625, schatten: 1 },
  ];
  fern.forEach((k, i) => {
    kette(w, {
      ...k,
      ebene: 1,
      farbe: T1 + i,
      grund: i === 0 ? BOGEN : T1,
      sattel,
      schnee: schneeLinie,
      schneeTiefe: 0.7,
      saum: true,
      glut: st.glut ? H * 0.08 : undefined,
      nebel: st.nebel ? nebelLinie(w, H * (k.basis - k.hoehe * 0.35), B / 24) : H * (k.basis - k.hoehe * 0.15),
      meer: st.nebel > 0,
    });
  });

  // Sanfte Hügel in der Mitte mit Waldinseln
  [0.6, 0.65].forEach((basis, i) => {
    const profil = welle(rnd, B, 0.38);
    const oben = new Float32Array(B);
    for (let x = 0; x < B; x++) oben[x] = H * (basis - 0.1 * profil[x] + (i ? 0.02 : 0));
    const farben = i === 0 ? [T2, T3, T3] : [T3, T4, T4];
    const nebelAb = st.nebel ? H * (basis + 0.01) : Infinity;
    flaeche(w, 2, oben, (x, y, t) => {
      const s = w.schwelle(2, x, y);
      if (y > nebelAb + 2) return (y - nebelAb) * 0.15 > s ? NEBEL : leiter(farben, t / (H * 0.08), s);
      if (winter && t > 0 && 0.55 > s) return SCHNEE;
      return t === 0 ? farben[1] : leiter(farben, t / (H * 0.12), s);
    });
    const kamm = new Int16Array(B);
    for (let x = 0; x < B; x++) kamm[x] = Math.round(oben[x]);
    w.kaemme.push({ ebene: 2, y: kamm });
    // Waldinseln: dichte Gruppen kleiner Tannen
    const inseln = 2 + Math.floor(rnd() * 3);
    for (let n = 0; n < inseln; n++) {
      const cx = Math.floor(rnd() * B);
      const breite = 5 + Math.floor(rnd() * B * 0.07);
      for (let x = cx - breite; x < cx + breite; x += 2 + Math.floor(rnd() * 2)) {
        if (x < 1 || x >= B - 1) continue;
        const nahMitte = 1 - Math.abs(x - cx) / breite;
        const g = 3 + Math.floor(rnd() * 2 + nahMitte * (i ? 5 : 3));
        if (w.hud(x, kamm[x] - g) < 4) continue;
        tanne(w, 2, x, kamm[x] + 2 + Math.floor(rnd() * 3), g, i ? T5 : T4, g >= 6);
      }
    }
  });

  // Die Wiese vorn: steigt zu einer Seite an, oben hell im Licht, nach vorn dunkel
  const profil = welle(rnd, B, 0.4);
  const wiese = new Float32Array(B);
  const wieseHub = (w.rk() - 0.5) * 0.08; // Blickpunkt: mal mehr Wiese, mal mehr Berge
  for (let x = 0; x < B; x++) {
    const t = hoch === -1 ? x / (B - 1) : 1 - x / (B - 1); // 0 an der hohen Seite
    wiese[x] = H * (0.43 + wieseHub + 0.25 * sanft(t * 1.1) + (profil[x] - 0.5) * 0.025);
  }
  const farbenWiese = winter ? [WIESE_LICHT, WIESE_LICHT, WIESE, T3, T4, T5, T6] : [WIESE_LICHT, WIESE, T3, T4, T5, T6];
  flaeche(w, 3, wiese, (x, y, t) => {
    if (y >= nacht) return T6;
    const v = (t / (nacht - wiese[x] + 1)) ** 1.25;
    // Im Winter steht helle Wiese gegen dunkle Tinte: grobes Raster, sonst flimmern nachts Einzelpunkte
    return leiter(farbenWiese, v, winter ? w.grob(3, x, y) : w.schwelle(3, x, y));
  });
  const wiesenKamm = new Int16Array(B);
  for (let x = 0; x < B; x++) wiesenKamm[x] = Math.round(wiese[x]);
  w.kaemme.push({ ebene: 3, y: wiesenKamm });
  // Windwellen über die helle Wiese
  for (let x = 0; x < B; x++) {
    for (let y = wiesenKamm[x] + 1; y < Math.min(nacht - 4, wiese[x] + H * 0.14); y++) {
      const f = w.lies(3, x, y);
      if ((f === WIESE || f === WIESE_LICHT) && ((x + y * 3) & 3) === 0) {
        w.zyklus(3, x, y, ZYKLUS_WIESE, x * 4 - y * 2, f === WIESE ? WIESE_LICHT : WIESE, f);
      }
    }
  }

  // Almhütte auf der Schulter der Wiese: Balkenwände, flaches Dach mit Überstand, zwei Fenster
  const hb = klemme(Math.round(B * 0.075), 13, 36);
  const tHuette = 0.16 + rv() * 0.14;
  let hx = Math.round(hoch === -1 ? tHuette * B : (1 - tHuette) * B);
  // Die Hütte steht nie unter der Sonnenscheibe: sonst rückt sie zur Bildmitte hin an ihr vorbei
  if (Math.abs(hx - w.sx) < w.sr + hb * 0.8 + 3) hx = Math.round(w.sx + (hx < B / 2 ? 1 : -1) * (w.sr + hb * 0.8 + 4));
  hx = klemme(hx, hb, B - 1 - hb);
  const x0 = Math.round(hx - hb / 2);
  const x1 = x0 + hb;
  let fuss = 0;
  for (let x = x0; x <= x1; x++) fuss = Math.max(fuss, wiesenKamm[klemme(x, 0, B - 1)]);
  fuss += 1;
  const wand = Math.max(5, Math.round(hb * 0.36));
  const dachH = Math.max(4, Math.round(hb * 0.3));
  // Fundament aus Steinen bis in die Wiese
  for (let x = x0; x <= x1; x++) for (let y = wiesenKamm[klemme(x, 0, B - 1)] - 1; y <= fuss; y++) w.setze(3, x, y, (x + y) % 3 ? T5 : T4);
  for (let y = fuss - wand; y < fuss; y++) {
    for (let x = x0; x <= x1; x++) {
      const balken = (fuss - y) % 2 === 0;
      w.setze(3, x, y, x === x0 || x === x1 ? HOLZ : balken ? T5 : HOLZ);
    }
  }
  // Fenster mit Kreuz und Tür
  const fw = hb >= 20 ? 3 : 2;
  const fensterY = fuss - wand + Math.max(1, Math.floor(wand / 4));
  const tuer = Math.round(hx + hoch * hb * 0.18);
  const fensterPos = [x0 + 2, x1 - 1 - fw, Math.round(hx - hoch * hb * 0.12 - fw / 2)].filter((fx) => Math.abs(fx + fw / 2 - tuer) > fw + 1);
  fensterPos.slice(0, 2).forEach((fx) => {
    for (let dy = 0; dy < fw; dy++) for (let dx = 0; dx < fw; dx++) w.setze(3, fx + dx, fensterY + dy, FENSTER);
    if (fw === 3) {
      w.setze(3, fx + 1, fensterY + 1, HOLZ);
    }
  });
  for (let y = fuss - Math.min(wand - 1, Math.max(3, Math.round(wand * 0.7))); y < fuss; y++) {
    w.setze(3, tuer, y, T6);
    if (hb >= 20) w.setze(3, tuer + 1, y, T6);
  }
  // Dach: von vorn gesehen ein flaches Trapez, die Traufe steht über
  for (let j = 0; j < dachH; j++) {
    const halb = Math.round(hb / 2 + 2 - (dachH - 1 - j) * 1.4);
    const y = fuss - wand - dachH + j;
    for (let dx = -halb; dx <= halb; dx++) {
      const kante = j === dachH - 1 || j === 0 || Math.abs(dx) >= halb;
      const f = kante ? HOLZ : winter ? SCHNEE : (j + (dx >> 1)) % 4 === 0 ? T5 : DACH;
      w.setze(3, Math.round(hx + dx), y, winter && j === 0 ? SCHNEE : f);
    }
  }
  // Kamin mit Rauch
  const kx = Math.round(hx - hoch * hb * 0.25);
  const ky = fuss - wand - dachH;
  for (let y = ky - 2; y <= ky; y++) {
    w.setze(3, kx, y, HOLZ);
    w.setze(3, kx + 1, y, HOLZ);
  }
  if (w.hud(kx, ky - 14) > 6) rauch(w, 3, kx, ky - 3, Math.max(8, Math.round(H * 0.09)));
  w.extra.huette = { x: hx, y: fuss, fenster: fensterPos.slice(0, 2).map((fx) => [fx, fensterY]), breite: fw };
  w.dinge.push("einer Almhütte mit rauchendem Kamin");

  // Zaun: von der Hütte schräg die Wiese hinab nach vorn, Pfosten werden nach vorn höher
  const richtung = -hoch;
  const start = richtung === 1 ? x1 + 3 : x0 - 3;
  let zaunLaenge = 0;
  for (let i = 0, x = start; x >= 0 && x < B; i++, x += richtung) {
    const weg = Math.abs(x - start);
    const y = Math.round(wiesenKamm[x] + 2 + weg * 0.12);
    if (y > nacht - 4 || weg > B * 0.2) break;
    const groesse = 3 + Math.round(weg * 0.03);
    const abstand = 3 + Math.round(weg * 0.04);
    if (i % abstand === 0) for (let dy = -groesse; dy <= 0; dy++) w.setze(3, x, y + dy, HOLZ);
    w.setze(3, x, y - groesse + 1, HOLZ);
    w.setze(3, x, y - Math.round(groesse * 0.45), HOLZ);
    zaunLaenge++;
  }
  if (zaunLaenge > 8) w.dinge.push("einem Zaun");

  // Fußweg: von der Tür in Schlaufen nach vorn, heller Trampelpfad
  const weg: number[] = [];
  {
    let x = tuer;
    for (let y = fuss + 1; y < nacht - 2; y++) {
      const t = (y - fuss) / (nacht - fuss);
      x = tuer + Math.sin(t * 3.2) * B * 0.06 * (0.3 + t) * hoch + t * t * B * 0.12 * -hoch;
      const breite = 1 + Math.round(t * 2.5);
      for (let b = 0; b < breite; b++) {
        const xx = Math.round(x) + b;
        if (xx < 0 || xx >= B || w.lies(3, xx, y) === HOLZ) continue;
        if ((xx + y) % 3 !== 0 || t < 0.3) w.setze(3, xx, y, winter ? SCHNEE_SCHATTEN : t < 0.5 ? WIESE_LICHT : WIESE);
      }
      weg.push(Math.round(x), y);
    }
    w.pfad("weg", 3, weg);
  }

  // Baum neben der Hütte, Tannengruppe am tiefen Rand
  if (mitBaum) {
    const bx = Math.round(hoch === -1 ? x0 - hb * 0.4 - 3 : x1 + hb * 0.4 + 3);
    if (bx > 2 && bx < B - 2) {
      const g = Math.round(H * (0.13 + rv() * 0.06));
      if (w.hud(bx, wiesenKamm[bx] - g) > 4) {
        if (rv() < 0.5) baum(w, 3, bx, wiesenKamm[bx] + 2, g, T5, T4);
        else tanne(w, 3, bx, wiesenKamm[bx] + 2, g, T5);
      }
    }
  }
  for (let n = 0; n < 6; n++) {
    const xi = hoch === -1 ? B - 2 - n * 4 - Math.floor(rnd() * 2) : 1 + n * 4 + Math.floor(rnd() * 2);
    let g = Math.round(H * (0.2 - n * 0.025) + rnd() * 3);
    while (g > 6 && w.hud(xi, wiesenKamm[xi] + 3 - g) < 4) g--;
    if (xi > 0 && xi < B) tanne(w, 3, xi, wiesenKamm[xi] + 3, g, T6);
  }

  // Grashalme: kleine Büschel auf dem Wiesenkamm, vorn ein dunkler Saum hoher Halme vor der Wiese
  for (let x = 2; x < B - 2; x += 3 + Math.floor(rnd() * 5)) {
    if (w.lies(3, x, wiesenKamm[x] - 1) !== LEER) continue;
    gras(w, 3, x, wiesenKamm[x] + 1, 2 + Math.floor(rnd() * 2), farbenWiese[1], -w.seite);
  }
  for (let x = 1; x < B - 1; x += 1 + Math.floor(rnd() * 3)) {
    const y = nacht - Math.floor(rnd() * 2);
    const g = Math.round(H * (0.03 + rnd() * 0.05));
    gras(w, 3, x, y, g, rnd() < 0.7 ? T6 : T5, -w.seite);
  }
  w.dinge.push("Gras");

  // Almblumen: hinten Pünktchen, vorn zwei Pixel hoch
  if (st.blumen) {
    for (let x = 0; x < B; x++) {
      for (let y = wiesenKamm[x] + 2; y < nacht - 1; y++) {
        const z = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ w.startwert) >>> 0;
        const zahl = (z % 1000) / 1000;
        const nah = (y - wiesenKamm[x]) / (nacht - wiesenKamm[x]);
        if (zahl > 0.012 + nah * 0.03) continue;
        const f = zahl * 1000 < 7 + nah * 10 ? BLUETE_GELB : BLUETE_ROSA;
        const da = w.lies(3, x, y);
        if (da === HOLZ || da === T6 && nah < 0.9 || da === FENSTER) continue;
        w.setze(3, x, y, f);
        if (nah > 0.5) w.setze(3, x, y - 1, f);
      }
    }
    w.dinge.push("Almblumen");
  }

  // Seilbahn zum fernen Gipfel
  if (mitSeilbahn) seilbahn(w);
}

// Seilbahn auf der fernen Kette: Bergstation am Grat, Talstation tiefer an der Flanke (noch über dem
// Dunst), dazwischen Trag- und Zugseil mit zwei A-Masten. Alles in derselben Ebene wie der Berg, damit
// beim Versatz nichts vom Hang abreißt.
function seilbahn(w: Werk): void {
  const { B, H, rv } = w;
  const kaemmeFern = w.kaemme.filter((k) => k.ebene === 1);
  const fern = kaemmeFern[0];
  if (!fern) return;
  const kammBei = (x: number) => {
    // oberste Kante der fernen Ebene an dieser Spalte (vordere Kette kann höher liegen)
    let y = H;
    for (const k of kaemmeFern) y = Math.min(y, k.y[klemme(x, 0, B - 1)]);
    return y;
  };
  // Bergstation: hoher Punkt der fernen Kette, nicht unter der Sonne und nicht unter dem HUD
  let bx = -1;
  let by = H;
  for (let x = Math.round(B * 0.15); x < B * 0.85; x++) {
    const y = fern.y[x];
    if (Math.abs(x - w.sx) < w.sr * 2 || w.hud(x, y - 8) < 10 || w.verdeckt(1, x, y - 2)) continue;
    if (y < by) {
      by = y;
      bx = x;
    }
  }
  if (bx < 0) return;
  // Talwärts zur Bildmitte hin, außer das Seil liefe dort durch die Sonnen- oder Mondscheibe
  const gipfelX = bx;
  const nebelUnten = H * 0.44;
  const spannweite = B * (0.2 + rv() * 0.1);
  let richtung: 1 | -1 = bx < B / 2 ? 1 : -1;
  let tx = 0;
  let ty = 0;
  let passt = false;
  for (let versuch = 0; versuch < 2 && !passt; versuch++) {
    if (versuch) richtung = richtung === 1 ? -1 : 1;
    // Bergstation ein Stück unter dem Gipfel auf der Talseite, damit sie im Grat sitzt
    bx = gipfelX + richtung * 3;
    by = kammBei(bx);
    // Talstation: weiter unten an der Flanke, wo die Kette noch deckt
    tx = klemme(Math.round(bx + richtung * spannweite), 6, B - 7);
    ty = Math.round(Math.min(nebelUnten, kammBei(tx) + H * 0.12));
    for (let n = 0; n < 40 && (w.lies(1, tx, ty + 2) === LEER || w.verdeckt(1, tx, ty - 3)); n++) ty--;
    if (ty - kammBei(tx) < 3 || ty - by < H * 0.05) continue;
    passt = true;
    for (let x = Math.min(bx, tx); x <= Math.max(bx, tx) && passt; x++) {
      const y = by - 3 + ((ty - by) * (x - bx)) / (tx - bx);
      if (Math.hypot(x - w.sx, y - w.sy) < w.sr + 4) passt = false;
    }
  }
  if (!passt) return;
  const L = w.lagen[1];
  const setze = (x: number, y: number, f: number) => {
    if (x >= 0 && x < B && y >= w.weiss + KANTE) L[(y + U) * B + x] = f;
  };
  // Seile: oben das Tragseil, eine Zeile darunter das Zugseil
  const oben = by - 3;
  const unten = ty - 3;
  const durchhang = Math.max(2, Math.abs(tx - bx) * 0.05);
  const seilY = (x: number) => {
    const t = (x - bx) / (tx - bx);
    return oben + (unten - oben) * t + durchhang * 4 * t * (1 - t);
  };
  const punkte: number[] = [];
  const von = Math.min(bx, tx);
  const bis = Math.max(bx, tx);
  for (let x = von; x <= bis; x++) {
    const y = Math.round(seilY(x));
    setze(x, y, SEIL);
    if ((x - von) % 2 === 0 || Math.abs(x - bx) < 4 || Math.abs(x - tx) < 4) setze(x, y + 1, SEIL);
    if (y >= w.weiss + KANTE + 2 && y < w.nacht - 6 && w.hud(x, y) > 9) punkte.push(x, y);
  }
  // Zwei A-Maste: von den Seilen schräg gespreizt bis auf den Hang, oben ein Querträger
  for (const t of [0.36, 0.7]) {
    const mx = Math.round(bx + (tx - bx) * t);
    const my = Math.round(seilY(mx));
    const hoch = Math.max(5, Math.round(H * 0.05));
    for (let d = -1; d <= 1; d++) setze(mx + d, my - 1, SEIL);
    for (let j = 1; j <= hoch; j++) {
      const spreiz = Math.floor(j / 4);
      setze(mx - spreiz, my + j, SEIL);
      setze(mx + spreiz, my + j, SEIL);
    }
  }
  // Stationen: Satteldach (7, 5, 3 breit), Holzwand mit dunkler Einfahrt zur Seilseite; eine Zeile im Fels
  const station = (sx: number, fuss: number, breit: number) => {
    const halb = breit >> 1;
    const wand = breit > 7 ? 3 : 2;
    for (let dx = -halb; dx <= halb; dx++) {
      setze(sx + dx, fuss + 1, HOLZ); // Fundament im Fels
      for (let j = 0; j <= wand - 1; j++) setze(sx + dx, fuss - j, dx * richtung >= halb - 1 && j < wand - 1 ? T6 : HOLZ);
    }
    // Fensterreihe zur Talseite
    for (let dx = -halb + 1; dx < halb - 1; dx += 2) if (dx * richtung < halb - 2) setze(sx - richtung * Math.abs(dx), fuss - 1, FENSTER);
    // Satteldach mit einem Pixel Überstand, First als helle Kante
    const dach = halb + 1;
    for (let j = 0; j <= dach; j++) {
      const r = dach - j;
      if (r < 0) break;
      for (let dx = -r; dx <= r; dx++) setze(sx + dx, fuss - wand - j, r === 0 || (j > 0 && Math.abs(dx) === r) ? HOLZ : DACH);
      if (j >= 2) break;
    }
  };
  const gross = B >= 300 ? 9 : 7;
  station(bx, by, gross);
  station(tx, ty, gross);
  // Von der Talstation zur Bergstation
  const folge: number[] = [];
  const n = punkte.length / 2;
  for (let i = 0; i < n; i++) {
    const j = tx < bx ? i : n - 1 - i;
    // Die Gondel fährt nur bis zur ersten Lücke (HUD oder Kante): kein Sprung im Weg
    if (folge.length && Math.abs(punkte[j * 2] - folge[folge.length - 2]) > 1) break;
    folge.push(punkte[j * 2], punkte[j * 2 + 1]);
  }
  // Die Gondel hält vor den Stationen
  w.pfad("seilbahn", 1, folge.slice(8, Math.max(8, folge.length - 8)));
  w.extra.seilbahn = { x: bx, y: by };
  w.dinge.push("einer Seilbahn");
}

/* Landschaft: Klamm ---------------------------------------------------------------------------- */

// Blick in eine Schlucht: Die Wände laufen zu einem Fluchtpunkt zusammen, oben ein Keil Himmel mit fernen
// Gipfeln, unten der Bach, der nach vorn breiter wird. Ein Wasserfall stürzt von der Kante, eine
// Hängebrücke spannt sich über den Spalt.
function klamm(w: Werk): void {
  const { B, H, rnd, rv, st, nacht, weiss } = w;
  // Fluchtpunkt frei von der Sonne: Sie steht seitlich über den Wänden, nicht hinter der Brücke
  // Blickpunkt: Lage und Tiefe des Spalts, Weite der Schlucht und Höhe der Wände wechseln
  const vx = Math.round(B * klemme(0.5 + (rv() - 0.5) * 0.24 - w.seite * 0.05 + (w.rk() - 0.5) * 0.24, 0.3, 0.7));
  const vy = Math.round(H * (0.58 + rv() * 0.05 + (w.rk() - 0.5) * 0.08));
  const weite = 0.8 + w.rk() * 0.5;
  const hub = (w.rk() - 0.5) * 0.1;
  const mitBruecke = rv() < 0.75;
  let fallSeite = rv() < 0.5 ? -1 : 1;
  const zurSonneLinks = w.seite === 1; // die linke Wand schaut nach rechts, zur Sonne
  const winter = st.schnee >= 0.5;

  // Ferne Berge im Spalt
  kette(w, {
    ebene: 1, farbe: T1, grund: BOGEN, basis: (vy - H * 0.06) / H, hoehe: 0.26, rauheit: 0.5, licht: 0.5, schatten: 0.875,
    schnee: H * (0.4 + st.schnee * 0.5), schneeTiefe: 0.8, saum: true, glut: st.glut ? H * 0.08 : undefined,
    nebel: st.nebel ? nebelLinie(w, vy - H * 0.1, B / 30) : vy - H * 0.06, meer: st.nebel > 0, sattel: 0.6,
  });
  kette(w, {
    ebene: 1, farbe: T2, grund: T1, basis: (vy - H * 0.02) / H, hoehe: 0.14, rauheit: 0.55, licht: 0.625, schatten: 1,
    nebel: st.nebel ? nebelLinie(w, vy - H * 0.05, B / 22) : vy, meer: st.nebel > 0,
  });

  // Grund der Schlucht: Geröll und Bach in der mittleren Ebene, vorn in der nahen
  const bachHalb = (y: number) => (y - vy) * 0.45 + 1;
  const schwung = rv() * 6;
  const bachMitte = (y: number) => vx + Math.sin((y - vy) * 0.12 + schwung) * (y - vy) * 0.18;
  const grundMalen = (e: number, ab: number) => {
    for (let y = ab; y < H + U; y++) {
      const halb = bachHalb(y);
      const tief = (y - vy) / (nacht - vy);
      for (let x = 0; x < B; x++) {
        const s = w.schwelle(e, x, y);
        const d = Math.abs(x - bachMitte(y));
        let f: number;
        if (d < halb) {
          f = (y + Math.round(d * 0.4)) % 3 === 0 ? T3 : WASSER;
          if (st.eis) f = (x + y) % 5 === 0 ? SCHNEE_SCHATTEN : EIS;
          if (tief > 0.55 && (tief - 0.55) * 2.2 > s) f = T6;
          if (!st.eis && f !== T6 && y < nacht) w.zyklus(e, x, y, ZYKLUS_FLUSS, y * 18 - d * 6, GLITZER_HELL, f);
        } else if (d < halb + 1.5) f = winter ? SCHNEE : T4; // Uferkiesel
        else f = winter && s < 0.3 ? SCHNEE_SCHATTEN : leiter([T4, T5, T6], tief * 1.2 + 0.2, s);
        w.setze(e, x, y, f);
      }
    }
  };
  grundMalen(2, vy);

  // Wände: drei Paare, vorn das größte. Oberkante fällt vom Bildrand zum Spalt hin ab, die Innenkante
  // läuft zum Fluchtpunkt und weicht unterhalb davon zurück.
  const paare = [
    { ebene: 3, aussen: 0.46, innen: 0.2, spalt: 0.15 + rv() * 0.05, fuss: H + U, schatten: [WAND, T4, T5], licht: [WAND_HELL, WAND, T5], kante: FELS_LICHT },
    { ebene: 2, aussen: 0.5, innen: 0.33, spalt: 0.095, fuss: H * 0.76, schatten: [T3, T4, T5], licht: [T2, WAND_HELL, WAND], kante: T1 },
    { ebene: 2, aussen: 0.52, innen: 0.43, spalt: 0.05, fuss: H * 0.68, schatten: [T2, T3, T4], licht: [T1, T2, T3], kante: FELS_LICHT },
  ];
  // Pfeilerlage nach dem Abstand zur Innenkante (Viertelpixel), einmal vorab statt je Pixel
  const logTafel = new Float32Array(B * 4 + 8);
  for (let i = 0; i < logTafel.length; i++) logTafel[i] = Math.log(1 + i / 40) * 2.6;
  // Die vordere Wand einer Seite steht höher: Die Schlucht ist nie spiegelgleich
  const schief = (rv() - 0.5) * 0.1;
  type Wand = { ebene: number; links: Float32Array; rechts: Float32Array; oben: Float32Array };
  const waende: Wand[] = [];
  for (let k = paare.length - 1; k >= 0; k--) {
    const p = paare[k];
    const e = p.ebene;
    const rand = welle(rnd, B, 0.62);
    const zacken = welle(rnd, H + 2 * U, 0.66);
    const zackenR = welle(rnd, H + 2 * U, 0.66);
    const yInnen = H * (p.innen + hub);
    const spalt = B * p.spalt * weite;
    const innenL = new Float32Array(H + 2 * U);
    const innenR = new Float32Array(H + 2 * U);
    for (let y = -U; y < H + U; y++) {
      const t = klemme((y - yInnen) / Math.max(1, vy - yInnen), 0, 1);
      const enge = y < vy ? spalt * (1 - t ** 0.8 * 0.72) : spalt * 0.28 + (y - vy) * 0.9;
      // Felsstufen: die Kante springt in Absätzen
      const stufe = (Math.floor((y + 64) / (3 + k)) % 3) - 1;
      innenL[y + U] = vx - enge - (zacken[y + U] - 0.5) * B * 0.035 + stufe;
      innenR[y + U] = vx + enge + (zackenR[y + U] - 0.5) * B * 0.035 - stufe;
    }
    const oben = new Float32Array(B);
    for (let x = 0; x < B; x++) {
      // Von der Kante am Spalt fällt die Wand nach außen ab: Dort zeigt sich die Ferne über ihr
      const d = klemme((Math.abs(x - vx) - spalt * 0.9) / (B * 0.5 - spalt * 0.9), 0, 1);
      const seiteHoeher = (x < vx ? -schief : schief) * (k === 0 ? 1 : 0.4);
      oben[x] = H * (p.innen + hub + seiteHoeher * 0.5 + (p.aussen - p.innen - hub * 0.5 + seiteHoeher * 0.5) * d ** 0.75) + (rand[x] - 0.5) * H * (k === 0 ? 0.07 : 0.04);
      // Sattel unter der Sonne: Die Wand senkt sich dort, die Sonne geht nie ganz dahinter unter
      oben[x] += Math.max(0, w.sy + w.sr * 0.5 - oben[x]) * Math.exp(-(((x - w.sx) / (w.sr * 1.8)) ** 2));
      if (e === 3) oben[x] = Math.max(oben[x], weiss + KANTE + 2);
    }
    waende.push({ ebene: e, links: innenL, rechts: innenR, oben });
    const L = w.lagen[e];
    const schicht = Math.max(3, H * (e === 3 ? 0.05 : 0.038));
    for (let x = 0; x < B; x++) {
      for (let y = Math.round(oben[x]); y < Math.min(H + U, p.fuss); y++) {
        const il = innenL[y + U];
        const ir = innenR[y + U];
        const links = x <= il;
        if (!links && x < ir) continue;
        const ab = links ? il - x : x - ir; // Abstand zur Innenkante
        const s = w.schwelle(e, x, y);
        const zurSonne = links === zurSonneLinks;
        const farben = zurSonne ? p.licht : p.schatten;
        // Blockfels: senkrechte Klüfte teilen die Wand in Pfeiler, nach außen (näher am Betrachter)
        // breiter; waagerechte Schichten laufen in der Wand auf den Fluchtpunkt zu. Jeder Block hat
        // seinen eigenen Ton, oben eine Lichtkante, darunter den Schatten des Überhangs.
        const q = logTafel[Math.min(logTafel.length - 1, Math.floor(ab * 4))];
        const pfeiler = Math.floor(q);
        const fr = q - pfeiler;
        const qPixel = 2.6 / (10 + ab); // ein Pixel in Pfeilereinheiten
        // Ein Pixel in Schichteinheiten. Die Schichten liegen parallel und fallen nur leicht zum Spalt
        // hin ein; liefen sie auf den Fluchtpunkt zu, stünde ein Fächer (über und unter dem Auge als
        // Fischgrät) in der Wand. Nach außen, näher am Betrachter, werden sie etwas dicker.
        const zeile = 1 / (schicht * (1 + Math.min(ab, B * 0.4) / (B * 0.8)));
        const lv = (y + ab * 0.12) * zeile + (zahl(pfeiler, k, links ? 3 : 4) - 0.5) * 2 * zeile; // je Pfeiler höchstens 1 px versetzt
        const band = Math.floor(lv);
        const fl = lv - band;
        const blockTon = (zahl(pfeiler, k, links ? 7 : 8) - 0.5) * 0.36 + (zahl(pfeiler, band, k + (links ? 5 : 6)) - 0.5) * 0.18;
        const absatz = zahl(pfeiler, band, k + 11) < 0.6; // nicht jeder Block hat einen Absatz
        const aussen = Math.min(0.22, ab / (B * 0.5));
        let ton = (zurSonne ? 0.18 : 0.3) + aussen + blockTon;
        if (ab < 2) ton = zurSonne ? 0 : 0.2;
        let f = leiter(farben, ton, s);
        if (ab > 2) {
          const ueberhang = zeile < 0.2 ? 3 : 2;
          if (fl < zeile && absatz) f = winter && (band & 1) === 0 && ab < B * 0.2 ? SCHNEE : zurSonne ? p.kante : farben[0];
          else if (fl < zeile * ueberhang && absatz) f = farben[2];
          else if (fr < qPixel && ab > 4) f = farben[2]; // Kluft
          else if (fr < qPixel * 2 && ab > 4) f = zurSonne ? p.kante : farben[0]; // Lichtkante daneben
        }
        if (zurSonne && ab < 1 && k === 0 && y < vy) f = SAUM;
        // Oberkante: Grasnarbe bzw. Schnee
        const unterRand = y - oben[x];
        if (unterRand < 1.5) f = winter ? SCHNEE : zurSonne ? p.kante : farben[0];
        else if (winter && unterRand < 3 && 0.5 > s) f = SCHNEE;
        L[(y + U) * B + x] = f;
      }
      // Mond- und Sonnenlicht auf der Kante der zugewandten Wand
      const y0 = Math.round(oben[x]);
      const links = x <= innenL[y0 + U];
      if (links === zurSonneLinks && y0 - 1 > weiss + KANTE && L[(y0 - 1 + U) * B + x] === LEER && (links || x >= innenR[y0 + U])) L[(y0 - 1 + U) * B + x] = SAUM;
    }
    // Die vorderen Wände stehen im Wasser: davor der nahe Bachgrund
    if (k === 1) grundMalen(3, Math.round(p.fuss));
    // Tannen auf dem Rand der Schlucht und an Absätzen
    const tGross = e === 3 ? [5, 11] : [3, 6];
    for (let x = 1; x < B - 1; x += 3 + Math.floor(rnd() * 5)) {
      const y = Math.round(oben[x]);
      if (x > innenL[y + U] - 1 && x < innenR[y + U] + 1) continue;
      // Spitzen bleiben unter der weißen Kante, sonst würden sie dort gekappt
      const g = Math.min(tGross[0] + Math.floor(rnd() * (tGross[1] - tGross[0] + 1)), y - (weiss + KANTE + 2));
      if (g < 3 || w.hud(x, y - g) < 4) continue;
      if (Math.abs(x - w.sx) < w.sr * 1.3 && y - g < w.sy + w.sr) continue; // keine Tanne vor der Sonne
      tanne(w, e, x, y + 1, g, p.schatten[e === 3 ? 2 : 1], g >= 5);
    }
    const kammLinie = new Int16Array(B);
    for (let x = 0; x < B; x++) {
      const y = Math.round(oben[x]);
      kammLinie[x] = x > innenL[y + U] && x < innenR[y + U] ? H : y;
    }
    w.kaemme.push({ ebene: e, y: kammLinie });
  }
  const vorn = waende[waende.length - 1];

  // Wasserfall: stürzt nahe der Innenkante über den Rand der vorderen Wand bis auf den Grund
  {
    let fx = -1;
    let fy = 0;
    // Bevorzugte Seite; liegt dort das HUD, fällt das Wasser auf der anderen Seite
    for (const seite of [fallSeite, -fallSeite]) {
      for (let x = vx; x > 0 && x < B - 1; x += seite) {
        const y = Math.round(vorn.oben[x]);
        if (seite === -1 ? x <= vorn.links[y + U] - 4 : x >= vorn.rechts[y + U] + 4) {
          if (w.hud(x, y) > 8) {
            fx = x;
            fy = y;
            fallSeite = seite;
          }
          break;
        }
      }
      if (fx >= 0) break;
    }
    if (fx > 2 && fx < B - 3) {
      // Das Band folgt der Felskante in Kaskaden bis in den Bach
      const breite = Math.max(2, Math.round(B / 110));
      const kanteBei = (y: number) => (fallSeite === -1 ? vorn.links[y + U] : vorn.rechts[y + U]);
      const abstand = Math.abs(fx - kanteBei(fy));
      let unten = fy;
      let x = fx;
      for (let y = fy; y < Math.min(nacht - 2, vy + 4); y++) {
        // Stufenweise der Kante nach: Das Wasser springt von Absatz zu Absatz
        const ziel = Math.round(kanteBei(y) - fallSeite * Math.max(1, abstand * (1 - (y - fy) / (vy - fy + 1))));
        if ((y - fy) % 4 === 0) x = ziel;
        for (let b = 0; b < breite; b++) {
          const xx = x - fallSeite * b;
          const f = st.eis ? ((y + b) % 3 ? EIS : SCHNEE) : (y * 2 + b * 3) % 5 < 2 ? GISCHT : WASSERFALL;
          w.setze(3, xx, y, f);
          if (!st.eis) w.zyklus(3, xx, y, ZYKLUS_WASSERFALL, y * 23 + b * 50, GISCHT, WASSERFALL);
        }
        // Rand des Falls: dunkle Wand daneben, damit das Band sich abhebt
        w.setze(3, x - fallSeite * breite, y, T6);
        unten = y;
      }
      fx = x;
      // Gischt am Fuß
      const gischt = Math.max(6, Math.round(B * 0.02));
      for (let n = 0; n < gischt * 6; n++) {
        const a = rv() * Math.PI;
        const r = rv() * gischt;
        const x = Math.round(fx + Math.cos(a) * r);
        const y = Math.round(unten - Math.sin(a) * r * 0.45);
        if (y >= nacht) continue;
        const vorher = w.lies(3, x, y);
        w.setze(3, x, y, st.eis ? SCHNEE : GISCHT);
        if (!st.eis) w.zyklus(3, x, y, ZYKLUS_GISCHT, rv() * 256, GISCHT, vorher === LEER ? T5 : vorher);
      }
      w.extra.wasserfall = { x: fx, y0: fy, y1: unten, gefroren: st.eis };
      w.dinge.push(st.eis ? "einem gefrorenen Wasserfall" : "einem Wasserfall");
    }
  }

  // Hängebrücke über den Spalt, wo er weder zu weit noch zu eng ist
  if (mitBruecke) {
    // Mögliche Höhen: Der Spalt ist weder zu weit noch zu eng, die Brücke hängt unter den Kanten, sie
    // kreuzt weder Sonne noch HUD. Welche davon, entscheidet der Zufall: mal hoch oben, mal tief im Spalt.
    const moeglich: number[] = [];
    for (let y = Math.round(H * 0.24); y < vy - 6; y++) {
      const l = vorn.links[y + U];
      const r = vorn.rechts[y + U];
      const weite = r - l;
      if (weite >= B * 0.34 || weite <= 12) continue;
      if (y <= Math.max(vorn.oben[klemme(Math.round(l), 0, B - 1)], vorn.oben[klemme(Math.round(r), 0, B - 1)]) + 3) continue;
      let frei = true;
      for (let x = Math.round(l) - 2; x <= r + 2 && frei; x += 2) {
        if (Math.hypot(x - w.sx, Math.max(0, Math.abs(y - 3 - w.sy) - 4)) < w.sr + 4 || w.hud(x, y - 6) < 6) frei = false;
      }
      if (frei) moeglich.push(y);
    }
    const by = moeglich.length ? moeglich[Math.floor(rv() * moeglich.length * 0.85)] : -1;
    if (by > 0) {
      const l = Math.round(vorn.links[by + U]) - 1;
      const r = Math.round(vorn.rechts[by + U]) + 1;
      const durch = Math.max(2, (r - l) * 0.07);
      const deck: number[] = [];
      for (let x = l; x <= r; x++) {
        const t = (x - l) / (r - l);
        const y = Math.round(by + durch * 4 * t * (1 - t));
        const seil = Math.round(by - 4 + durch * 0.5 * 4 * t * (1 - t));
        w.setze(3, x, y, HOLZ);
        w.setze(3, x, seil, SEIL);
        if ((x - l) % 3 === 0) for (let yy = seil + 1; yy < y; yy++) w.setze(3, x, yy, SEIL);
        // Der Weg für Sprites endet vor dem HUD, auch wenn die Brücke darunter weiterläuft
        if (deck.length === 2 * (x - l) && w.hud(x, y - 11) > 4) deck.push(x, y - 1);
      }
      // Pfeiler an beiden Enden
      for (const [x, s] of [[l, -1], [r, 1]]) for (let yy = by - 5; yy <= by + 1; yy++) w.setze(3, x + s, yy, HOLZ);
      w.pfad("bruecke", 3, deck);
      if (rv() < 0.6) {
        const wx = Math.round(l + (r - l) * (0.3 + rv() * 0.4));
        const t = (wx - l) / (r - l);
        wanderer(w, 3, wx, Math.round(by + durch * 4 * t * (1 - t)), w.seite);
        w.dinge.push("einem Wanderer auf der Brücke");
      }
      w.dinge.push("einer Hängebrücke");
    }
  }
  w.dinge.push("steilen Felswänden");
  w.wasser = { y0: vy, y1: nacht, spurX: vx };
  w.ufer = vy;
}

/* Landschaft: Gipfelgrat -------------------------------------------------------------------------- */

// Wolkenmeer aus Ballen: Jeder Ballen hat eine Lichtseite zur Sonne und einen Schatten darunter
function wolkenmeer(w: Werk, e: number, y0: number, groesse: number): void {
  const { B, H, rnd } = w;
  const ballen: number[][] = [];
  for (let x = -H * 0.05; x < B + H * 0.05; ) {
    const r = H * groesse * (0.7 + rnd() * 0.6);
    ballen.push([x, y0 + (rnd() - 0.5) * H * 0.02, r]);
    x += r * (1.1 + rnd() * 0.7);
  }
  const oben = new Float32Array(B).fill(y0 + H * 0.02);
  const besitzer = new Int16Array(B).fill(-1);
  ballen.forEach(([bx, by, r], n) => {
    for (let x = Math.max(0, Math.floor(bx - r)); x <= Math.min(B - 1, bx + r); x++) {
      const y = by - Math.sqrt(Math.max(0, r * r - (x - bx) ** 2)) * 0.8;
      if (y < oben[x]) {
        oben[x] = y;
        besitzer[x] = n;
      }
    }
  });
  const L = w.lagen[e];
  for (let x = 0; x < B; x++) {
    const y0x = Math.round(oben[x]);
    const b = besitzer[x] >= 0 ? ballen[besitzer[x]] : null;
    for (let y = y0x; y < H + U; y++) {
      const s = w.schwelle(e, x, y);
      const t = y - y0x;
      let f = NEBEL;
      if (t === 0) f = WOLKE_LICHT;
      else if (b && y < b[1] + b[2] * 0.25) {
        const licht = ((x - b[0]) / b[2]) * w.seite * 0.7 - ((y - b[1]) / b[2]) * 0.7;
        if (licht < -0.2 && 0.55 > s) f = NEBEL_TIEF;
      } else {
        // Schattenfuge unter den Ballen, tiefer nur noch feine Schlieren
        const unter = b ? (y - (b[1] + b[2] * 0.25)) / Math.max(2, b[2] * 0.7) : (t / (H * 0.03));
        if (unter < 1 && (1 - unter) * 0.5 > s) f = NEBEL_TIEF;
        else if ((y + (x >> 3)) % 6 === 0 && s < 0.22) f = NEBEL_TIEF;
      }
      L[(y + U) * B + x] = f;
      if (t < 2) w.zyklus(e, x, y, ZYKLUS_NEBEL, x * 2 + t * 60, NEBEL, f);
    }
  }
}

// Man steht oben: ein felsiger Grat mit Gipfelkreuz, darunter ein Wolkenmeer, aus dem Gipfel ragen
function gipfelgrat(w: Werk): void {
  const { B, H, rnd, rv, st, nacht } = w;
  let seite: 1 | -1 = rv() < 0.5 ? -1 : 1; // auf dieser Seite steht der Gipfel
  // Kreuz und Wanderer stehen nie vor der Sonne: Liegt der Gipfel auf ihrer Seite und nah an ihr,
  // wechselt er auf die andere
  const gipfelBei = (sei: number) => B * (sei === -1 ? 0.26 : 0.74);
  if (Math.abs(gipfelBei(seite) - w.sx) < w.sr + B * 0.12) seite = seite === 1 ? -1 : 1;
  // Blick: Wolkenmeer höher oder tiefer, der Gipfel näher oder weiter weg
  const meerY = H * (0.58 + rv() * 0.05 + (w.rk() - 0.5) * 0.08);
  const gipfelHub = (w.rk() - 0.5) * 0.08;
  const winter = st.schnee >= 0.5;

  // Ferne Gipfel ragen aus dem Wolkenmeer
  const schneeLinie = H * (0.4 + st.schnee * 0.4);
  [0, 1].forEach((i) => {
    kette(w, {
      ebene: 1, farbe: T1 + i, grund: i ? T1 : BOGEN, basis: (meerY / H) - 0.04 + i * 0.03, hoehe: 0.26 - i * 0.06,
      rauheit: 0.56, licht: 0.5 + i * 0.125, schatten: 0.875 + i * 0.125, schnee: schneeLinie, schneeTiefe: 0.8, saum: true,
      glut: st.glut ? H * 0.06 : undefined, sattel: 0.5,
    });
  });
  wolkenmeer(w, 1, meerY - H * 0.035, 0.03);
  // Mittlere Gipfel im Wolkenmeer, dunkler
  const mittel = 1 + Math.floor(rv() * 3);
  for (let n = 0; n < mittel; n++) {
    const cx = B * (0.5 - seite * (0.05 + rv() * 0.4));
    const breite = B * (0.07 + rv() * 0.08);
    const hoehe = H * (0.1 + rv() * 0.1);
    const profil = welle(rnd, B, 0.62);
    const kamm = new Int16Array(B).fill(H);
    for (let x = 0; x < B; x++) {
      const t = Math.abs(x - cx) / breite;
      if (t >= 1) continue;
      const oben = meerY - hoehe * (1 - t) ** 1.2 * (0.7 + 0.3 * profil[x]);
      kamm[x] = Math.round(oben);
      const lichtSeite = (x - cx) * w.seite > 0;
      for (let y = kamm[x]; y < meerY + 6; y++) {
        const tt = y - kamm[x];
        const s = w.schwelle(2, x, y);
        let f = lichtSeite ? (tt < 1 ? T2 : 0.55 > s ? T3 : T2) : tt < 1 ? T4 : 0.8 > s ? T4 : T5;
        if (tt < H * 0.035 * (1 + st.schnee * 2) && (lichtSeite ? 0.8 : 0.35) > s) f = lichtSeite ? SCHNEE : SCHNEE_SCHATTEN;
        if (st.glut && lichtSeite && tt >= 1 && tt < H * 0.06 && 0.6 > s) f = GLUT;
        w.setze(2, x, y, f);
      }
    }
    w.kaemme.push({ ebene: 2, y: kamm });
  }
  wolkenmeer(w, 2, meerY + H * 0.025, 0.05);

  // Der Grat vorn: steigt auf einer Seite zum Gipfel, fällt auf der anderen als zackiger Grat mit
  // Felstürmchen ins Wolkenmeer ab; unten liegen auf ganzer Breite Felsen
  let gx = Math.round(seite === -1 ? B * (0.2 + rv() * 0.12) : B * (0.8 - rv() * 0.12));
  const gy = Math.round(H * (0.36 + rv() * 0.07 + gipfelHub));
  // Notfalls rückt der Gipfel weiter von der Sonne ab, bis Kreuz, Fahne und Wanderer Abstand halten
  {
    const kreuzOben = gy - Math.max(8, Math.round(H * 0.075)) - 2;
    const weg = gx < w.sx ? -1 : 1;
    const abstand = (x: number) => {
      const nx = klemme(w.sx, x - 12, x + 12);
      const ny = klemme(w.sy, kreuzOben, gy);
      return Math.hypot(w.sx - nx, w.sy - ny);
    };
    for (let n = 0; n < B * 0.3 && abstand(gx) < w.sr + 6; n++) {
      if (gx + weg < 14 || gx + weg > B - 15) break;
      gx += weg;
    }
  }
  const zacken = welle(rnd, B, 0.74);
  const grob = welle(rnd, B, 0.5);
  const fels = new Float32Array(B);
  for (let x = 0; x < B; x++) {
    const d = (x - gx) * -seite; // positiv: zur Bildmitte hin
    let y: number;
    if (d < 0) y = gy + (-d / (B * 0.25)) ** 1.15 * H * 0.2; // kurz zum Rand
    else y = gy + Math.min(1, d / (B * 0.6)) ** 0.8 * (H * 0.8 - gy); // langer Grat hinab
    const gegen = H * 0.79 - Math.max(0, (d - B * 0.5) / (B * 0.5)) * H * 0.12; // Gegenhang
    y = Math.min(y, gegen);
    fels[x] = y + (zacken[x] - 0.5) * H * 0.045 + (grob[x] - 0.5) * H * 0.03 + (zahl(x, 0, 9) - 0.5) * 1.5;
  }
  // Felstürmchen auf dem Grat
  const tuerme = 2 + Math.floor(rv() * 3);
  for (let n = 0; n < tuerme; n++) {
    const tx = Math.round(gx - seite * B * (0.12 + rv() * 0.4));
    const th = 3 + rv() * H * 0.04;
    const tb = 2 + rv() * 3;
    for (let x = Math.floor(tx - tb); x <= tx + tb; x++) if (x >= 0 && x < B) fels[x] -= th * Math.max(0, 1 - Math.abs(x - tx) / (tb + 0.5)) ** 0.6;
  }
  for (let dx = -2; dx <= 2; dx++) if (gx + dx >= 0 && gx + dx < B) fels[gx + dx] = Math.min(fels[gx + dx], gy + Math.abs(dx) * 0.5);
  const felsKamm = new Int16Array(B);
  for (let x = 0; x < B; x++) felsKamm[x] = Math.round(fels[x]);
  // Rippen und Rinnen laufen von den Zacken des Grats schräg die Flanke hinab: Ihre Lichtseite
  // ergibt sich aus der Neigung der Kammlinie, ein Stück versetzt
  const rippe = (x: number, t: number) => {
    const q = klemme(Math.round(x + t * 0.35 * seite), 1, B - 2);
    return (fels[q + 1] - fels[q - 1]) * w.seite < 0;
  };
  flaeche(w, 3, fels, (x, y, t) => {
    if (y >= nacht) return T6;
    const s = w.schwelle(3, x, y);
    const lichtSeite = t < 3 ? (fels[Math.min(B - 1, x + 2)] - fels[Math.max(0, x - 2)]) * w.seite < 0 : rippe(x, t);
    if (t === 0) return lichtSeite ? T3 : T4;
    if (winter && t < 9 && zahl(x >> 3, y >> 2, 3) < (lichtSeite ? 0.8 : 0.45) - t * 0.05) return lichtSeite ? SCHNEE : SCHNEE_SCHATTEN;
    if (t < 3) return lichtSeite ? (0.55 > s ? T3 : T4) : T5;
    // Bänder quer zur Flanke, dazu Rippen im Licht, nach unten alles dunkler
    const band = (t + Math.round(grob[x] * 9)) % 9 === 0 && zahl(x >> 3, t >> 3, 4) < 0.5;
    if (band) return T6;
    if (st.blumen && t > 6 && zahl(x, y, 6) < 0.008) return zahl(x, y, 7) < 0.5 ? BLUETE_GELB : BLUETE_ROSA;
    const tief = t / (H * 0.2);
    return leiter(lichtSeite ? [T3, T4, T5, T6] : [T5, T6, T6], tief + (lichtSeite ? 0.1 : 0), s);
  });
  w.kaemme.push({ ebene: 3, y: felsKamm });

  // Gipfelkreuz, daneben ein Wanderer, weiter unten ein Steinmann
  const kreuzG = Math.max(8, Math.round(H * 0.075));
  if (w.hud(gx, gy - kreuzG) > 8) {
    gipfelkreuz(w, 3, gx, felsKamm[gx] + 1, kreuzG);
    w.dinge.push("einem Gipfelkreuz");
  }
  const wxi = klemme(Math.round(gx - seite * Math.max(7, kreuzG * 0.6)), 2, B - 3);
  if (w.hud(wxi, felsKamm[wxi] - 10) > 8) {
    wanderer(w, 3, wxi, felsKamm[wxi] + 1, seite);
    w.dinge.push("einem Wanderer");
  }
  const smx = klemme(Math.round(gx + seite * B * 0.07), 3, B - 4);
  if (felsKamm[smx] < nacht - 8 && w.hud(smx, felsKamm[smx] - 6) > 6) steinmann(w, 3, smx, felsKamm[smx] + 1, 4 + Math.floor(rv() * 2));
  w.dinge.push("einem Wolkenmeer");
  w.extra.wolkenmeer = { y: Math.round(meerY) };
  w.ufer = Math.round(meerY);
}

/* Landschaft: Dolomiten --------------------------------------------------------------------------- */

// Senkrechte Felstürme mit Zacken, Rissen und Bändern, davor Schuttkegel und ein Lärchenwald
function dolomiten(w: Werk): void {
  const { B, H, rnd, rv, st, nacht } = w;
  const winter = st.schnee >= 0.5;
  kette(w, {
    ebene: 1, farbe: T1, grund: BOGEN, basis: 0.5, hoehe: 0.22, rauheit: 0.55, licht: 0.5, schatten: 0.875,
    schnee: H * (0.35 + st.schnee * 0.4), saum: true, nebel: st.nebel ? nebelLinie(w, H * 0.44, B / 26) : H * 0.46,
    meer: st.nebel > 0, sattel: 0.5,
  });

  // Blick: näher (größere Türme, tieferer Fuß) oder weiter weg
  const nah = 0.88 + w.rk() * 0.26;
  const basisY = H * (0.62 + rv() * 0.03 + (nah - 1) * 0.12);
  // Türme stehen in Gruppen (Massive) mit dem höchsten Turm in der Mitte
  const zahlTuerme = klemme(Math.round(B / (24 + rv() * 14)), 5, 16);
  const gruppen = 1 + Math.floor(rv() * 3);
  const mitten = Array.from({ length: gruppen }, (_, g) => B * (0.18 + ((g + 0.3 + rv() * 0.4) / gruppen) * 0.64));
  const gruppenBreite = (B * (0.32 + rv() * 0.15)) / gruppen;
  type Turm = { x: number; b: number; h: number; spitz: number; kopf: number; neig: number; hinten: boolean; risse: number[]; baender: number[] };
  const tuerme: Turm[] = [];
  for (let n = 0; n < zahlTuerme; n++) {
    const g = n % gruppen;
    const lage = (rv() + rv() - 1) * 1.1; // −1 … 1, zur Mitte gehäuft
    const x = mitten[g] + lage * gruppenBreite;
    const hinten = rv() < 0.4;
    const hoch = (1 - Math.abs(lage) * 0.75) * (g === 0 ? 1 : 0.8 + rv() * 0.2);
    tuerme.push({
      x,
      b: B * (0.012 + rv() * 0.024) * (hinten ? 1.3 : 1) * nah,
      h: Math.min(basisY - w.weiss - KANTE - 4, H * (0.12 + hoch * 0.32 + rv() * 0.06) * (hinten ? 0.85 : 1) * nah),
      spitz: 1 + Math.floor(rv() * 3),
      kopf: 0.15 + rv() * 0.35,
      neig: (rv() - 0.5) * 0.25 - lage * 0.08,
      hinten,
      risse: Array.from({ length: 1 + Math.floor(rv() * 3) }, () => rv() * 1.6 - 0.8),
      baender: Array.from({ length: 1 + Math.floor(rv() * 3) }, () => rv() * 0.7 + 0.15),
    });
  }
  const mitte = mitten[0];
  const L = w.lagen[2];
  const kante = welle(rnd, H + 2 * U, 0.7);
  const kante2 = welle(rnd, H + 2 * U, 0.7);
  const naht = welle(rnd, H + 2 * U, 0.6);
  // Hinten zuerst, vorn deckt
  [...tuerme.filter((t) => t.hinten), ...tuerme.filter((t) => !t.hinten)].forEach((t, n) => {
    const oben = basisY - t.h;
    const fussY = basisY + H * 0.05;
    for (let y = Math.floor(oben); y < fussY; y++) {
      const u = klemme((basisY - y) / t.h, 0, 1); // 1 oben, 0 am Fuß
      const halb = t.b * (t.kopf + (1 - t.kopf) * (1 - u) ** 0.7);
      const cx = t.x + t.neig * u * t.h;
      const zeile = Math.floor((y + 64) / 3) * 3 - 64 + U + n * 7;
      const links = cx - halb * (1 + (kante[klemme(zeile, 0, H + 2 * U - 1)] - 0.5) * 0.5);
      const rechts = cx + halb * (1 + (kante2[klemme(zeile, 0, H + 2 * U - 1)] - 0.5) * 0.5);
      for (let x = Math.floor(links); x <= rechts; x++) {
        if (x < 0 || x >= B) continue;
        const ux = (x - cx) / Math.max(1, halb);
        // Krone: Spitzen und Scharten
        const zacke = Math.abs(Math.sin((ux + 1) * Math.PI * 0.5 * t.spitz)) * t.h * 0.14 * (t.spitz > 1 ? 1 : 0.6);
        const krone = oben + zacke + (t.spitz === 1 ? Math.abs(ux) * t.h * 0.08 : 0);
        if (y < krone) continue;
        const s = w.schwelle(2, x, y);
        const lichtSeite = ux * w.seite > (naht[klemme(y + U, 0, H + 2 * U - 1)] - 0.5) * 0.7 - 0.05;
        let f: number;
        if (lichtSeite) f = 0.85 > s ? (st.glut ? GLUT : FELS_LICHT) : FELS;
        else f = t.hinten ? (0.6 > s ? FELS : T3) : 0.65 > s ? T3 : T4;
        // Risse: senkrecht, leicht wandernd, mit Unterbrechungen
        for (const r of t.risse) {
          const lage = r + (naht[klemme(y + U + 30, 0, H + 2 * U - 1)] - 0.5) * 0.2;
          if (Math.abs(ux - lage) < 0.7 / Math.max(1, halb) && zahl(x, y >> 2, n) > 0.25) f = lichtSeite ? FELS : T4;
        }
        // Bänder: kurze Absätze, im Winter mit Schnee
        for (const bnd of t.baender) {
          const yb = Math.round(basisY - t.h * bnd);
          if (y === yb && zahl(x >> 1, n, 3) < 0.7) f = T4;
          if (y === yb - 1 && zahl(x >> 1, n, 3) < 0.7) f = winter ? SCHNEE : lichtSeite ? FELS_LICHT : FELS;
        }
        if (y - krone < 1.5) f = winter ? SCHNEE : lichtSeite ? (st.glut ? GLUT : FELS_LICHT) : T3;
        if (!lichtSeite && (x === Math.floor(links) || x === Math.floor(rechts))) f = T4;
        L[(y + U) * B + x] = f;
      }
    }
  });
  // Sockel: zusammenhängender Fels unter den Türmen, zum Fuß hin im Dunst
  const sockel = welle(rnd, B, 0.6);
  for (let x = 0; x < B; x++) {
    const rand = Math.min(1, Math.min(x, B - 1 - x) / (B * 0.2));
    const y0 = Math.round(basisY - H * 0.04 * rand - sockel[x] * H * 0.035);
    for (let y = y0; y < H + U; y++) {
      const s = w.schwelle(2, x, y);
      const unten = (y - basisY) / (H * 0.08);
      if (L[(y + U) * B + x] !== LEER && unten < 0) continue;
      let f = (x + Math.round(y * 0.5)) % 4 === 0 ? FELS : 0.5 > s ? T2 : FELS;
      if (y === y0) f = st.glut ? GLUT : FELS_LICHT;
      if (unten > 0) f = unten > s ? T4 : f;
      L[(y + U) * B + x] = f;
    }
  }
  const kamm = new Int16Array(B);
  for (let x = 0; x < B; x++) {
    let y = w.weiss;
    while (y < H && L[(y + U) * B + x] === LEER) y++;
    kamm[x] = y;
    if (y - 1 > w.weiss + KANTE && !st.glut && (x - mitte) * w.seite > -B * 0.5 && L[(y + U) * B + x] === FELS_LICHT) L[(y - 1 + U) * B + x] = SAUM;
  }
  w.kaemme.push({ ebene: 2, y: kamm });
  // Schuttkegel unter den Scharten
  const sortiert = [...tuerme].sort((a, b) => a.x - b.x);
  for (let n = 0; n + 1 < sortiert.length; n++) {
    if (sortiert[n + 1].x - sortiert[n].x > B * 0.12) continue; // nur in engen Scharten
    const sx = Math.round((sortiert[n].x + sortiert[n + 1].x) / 2 + (rv() - 0.5) * 4);
    const spitze = basisY - H * 0.07;
    const fuss = basisY + H * 0.06;
    const breite = B * 0.025 + rv() * B * 0.02;
    for (let y = Math.round(spitze); y < fuss; y++) {
      const t = (y - spitze) / (fuss - spitze);
      // Hohl geschwungen wie echter Schutt: oben schmal aus der Rinne, unten flach ausgebreitet
      const halb = breite * t ** 0.75;
      for (let x = Math.floor(sx - halb); x <= sx + halb; x++) {
        const s = w.schwelle(2, x, y);
        const rand = Math.abs(x - sx) / (halb + 0.5);
        if (rand > 0.7 && (rand - 0.7) * 3.3 > s) continue;
        const streifen = zahl(x, y >> 1, 11) < 0.25;
        // Eine Hälfte liegt im Schatten; im Winter nur eine dünne Schneedecke mit Steinen darin
        const licht = (x - sx) * w.seite > 0;
        const f = winter
          ? streifen ? FELS : (licht ? 0.55 : 0.2) > (licht ? s : w.grob(2, x, y)) ? SCHNEE : SCHNEE_SCHATTEN
          : streifen ? FELS : licht ? (0.45 > s ? T1 : FELS_LICHT) : 0.6 > s ? FELS : T2;
        w.setze(2, x, y, f);
      }
    }
  }
  w.dinge.push("senkrechten Felstürmen", "Schuttkegeln");

  // Vorn: Waldrücken mit Lärchen und Tannen, nach unten dunkel
  const profil = welle(rnd, B, 0.45);
  const wald = new Float32Array(B);
  for (let x = 0; x < B; x++) wald[x] = H * (0.7 + (profil[x] - 0.5) * 0.06 + (x / B - 0.5) * 0.04 * w.seite);
  flaeche(w, 3, wald, (x, y, t) => {
    if (y >= nacht) return T6;
    const s = w.schwelle(3, x, y);
    if (winter && t < 4 && 0.6 > w.grob(3, x, y)) return SCHNEE;
    return leiter([T4, T5, T6, T6], t / (nacht - wald[x] + 1), s);
  });
  const waldKamm = new Int16Array(B);
  for (let x = 0; x < B; x++) waldKamm[x] = Math.round(wald[x]);
  w.kaemme.push({ ebene: 3, y: waldKamm });
  for (let x = 1; x < B - 1; x += 2 + Math.floor(rnd() * 3)) {
    const g = 5 + Math.floor(rnd() * Math.max(4, H * 0.06));
    if (w.hud(x, waldKamm[x] - g) < 4) continue;
    if (rnd() < 0.3) baum(w, 3, x, waldKamm[x] + 2, g, T5, T4);
    else tanne(w, 3, x, waldKamm[x] + 2 + Math.floor(rnd() * 3), g, rnd() < 0.5 ? T5 : T6);
  }
  if (st.blumen) {
    for (let x = 0; x < B; x++) for (let y = waldKamm[x] + 6; y < nacht - 2; y++) {
      if (zahl(x, y, 21) < 0.012) w.setze(3, x, y, zahl(x, y, 22) < 0.5 ? BLUETE_GELB : BLUETE_ROSA);
    }
  }
  w.dinge.push("einem Lärchenwald");
  w.ufer = Math.round(basisY);
}

/* Landschaft: Gletscher -------------------------------------------------------------------------- */

// Blick ein Gletschertal hinauf: Unter dem Kamm hängen zwei oder drei Kare voller Firn, getrennt von
// dunklen Felsrippen. Sie fließen zu einer Zunge zusammen, die sich im S-Bogen durchs Tal legt und nach
// vorn schmaler wird. Quer über das Eis laufen talwärts gewölbte Spaltenbögen, an der Steilstufe ein
// Eisbruch; Mittelmoränen ziehen als dunkle Linien die Zunge hinab, Seitenmoränen säumen sie. Vorn
// endet sie mit einem flachen Gletschertor über dem Gletschersee oder einer Schotterebene.
function gletscher(w: Werk): void {
  const { B, H, rnd, rv, rk, st, nacht } = w;
  const winter = st.schnee >= 0.5;
  const zahlKare = rv() < 0.55 ? 2 : 3;
  // Talschluss: Lage der Kare; die Zunge biegt im S-Bogen zur Bildmitte hin
  // Der Talschluss liegt der Sonne gegenüber, damit sie nicht hinter den Gipfeln versinkt
  const gx0 = klemme(w.sx - w.seite * B * (0.28 + rv() * 0.08), B * 0.3, B * 0.7);
  const richtung = Math.abs(gx0 - B / 2) < B * 0.04 ? (rk() < 0.5 ? 1 : -1) : gx0 < B / 2 ? 1 : -1;
  const ausschlag = B * (0.11 + rk() * 0.06) * richtung;
  const karAbstand = B * (zahlKare === 2 ? 0.15 + rv() * 0.04 : 0.12 + rv() * 0.03);
  const kare = Array.from({ length: zahlKare }, (_, i) => gx0 + (i - (zahlKare - 1) / 2) * karAbstand);
  const mitSee = true;

  // Kamm des Talschlusses: Gipfel auf den Rippen, dazwischen hängt er über jedem Kar im Bogen durch.
  // Außen fällt er von den äußeren Gipfeln ab und geht in die zufällige Kette über.
  const roh = grat(rnd, 0.55, B);
  const rippenX = Array.from({ length: zahlKare + 1 }, (_, j) => gx0 + (j - zahlKare / 2) * karAbstand);
  const gipfelY = rippenX.map(() => H * (0.13 + rk() * 0.1));
  const basis = 0.47;
  const hoehe = 0.32;
  const profil = new Float32Array(B);
  for (let x = 0; x < B; x++) {
    let y: number;
    if (x <= rippenX[0] || x >= rippenX[zahlKare]) {
      const j = x <= rippenX[0] ? 0 : zahlKare;
      // Von den äußeren Gipfeln fällt der Kamm ab, bis er die (stets tiefere) Kette erreicht
      const zufall = Math.max(H * (basis - hoehe * (0.35 + roh[x] * 0.5)), gipfelY[j] + H * 0.09);
      y = Math.min(zufall, gipfelY[j] + Math.abs(x - rippenX[j]) * (0.42 + roh[x] * 0.25));
    } else {
      const j = Math.min(zahlKare - 1, Math.floor((x - rippenX[0]) / karAbstand));
      const u = (x - rippenX[j]) / karAbstand;
      const durchhang = karAbstand * (0.2 + 0.1 * rauschen(j * 3.7, 74));
      y = gipfelY[j] + (gipfelY[j + 1] - gipfelY[j]) * u + durchhang * Math.sin(Math.PI * u) ** 0.8 + (roh[x] - 0.5) * H * 0.02;
    }
    profil[x] = (basis - y / H) / hoehe;
  }
  const kamm = kette(w, {
    ebene: 1, farbe: T1, grund: BOGEN, basis, hoehe, rauheit: 0.55, licht: 0.5, schatten: 0.875, profil,
    schnee: H * (0.28 + st.schnee * 0.2), schneeTiefe: 0.7, saum: true, glut: st.glut ? H * 0.08 : undefined, sattel: 0.5,
    nebel: H * 0.6,
  });

  // Höhen: oberster Gipfel, Zusammenfluss, Stirn
  let karOben = H;
  let karUnten = 0;
  for (let x = Math.max(0, Math.round(rippenX[0])); x <= Math.min(B - 1, rippenX[zahlKare]); x++) {
    karOben = Math.min(karOben, kamm[x]);
    karUnten = Math.max(karUnten, kamm[x]);
  }
  const yZus = Math.max(H * (0.41 + rk() * 0.04), karUnten + H * 0.12);
  const y1 = Math.min(nacht - H * 0.13, Math.max(H * (0.63 + rk() * 0.05), yZus + H * 0.18));
  const stufe = yZus + (y1 - yZus) * (0.38 + rk() * 0.1); // Steilstufe mit Eisbruch
  const lappen = Math.max(2, H * 0.028);
  const tZunge = (y: number) => klemme((y - yZus) / (y1 - yZus), 0, 1);
  // Mittellinie: ein S-Bogen, der mit voller Breite im Tal liegt
  const mitte = (y: number) => {
    const t = tZunge(y);
    return gx0 + ausschlag * (sanft(t) + 0.22 * Math.sin(t * Math.PI * 2));
  };
  const breite0 = B * (zahlKare === 3 ? 0.062 : 0.056);
  // Halbe Breite: nach vorn schmaler, die Stirn rundet sich
  const halb = (y: number) => {
    let h = breite0 * (1 - 0.36 * tZunge(y));
    if (y > y1 - lappen) h *= Math.sqrt(Math.max(0, 1 - ((y - (y1 - lappen)) / lappen) ** 2));
    return h;
  };
  const gx1 = mitte(y1);
  // Kare je Zeile: [links, rechts]. Oben reichen sie von Rippe zu Rippe (die Rippe selbst ist ein
  // schmaler Grat), nach unten schnüren sie sich zu Rinnen zusammen, die nebeneinander in die Zunge münden.
  const karHalb = karAbstand * 0.4;
  const rinneHalb = breite0 / zahlKare;
  // Je Kar: Mulde voll breit bis ein Stück unter den tiefsten Punkt des Kamms darüber, dann rundet sie
  // sich zur Karschwelle; darunter führt eine Rinne zum Zusammenfluss
  const karMulde = kare.map((k) => kamm[klemme(Math.round(k), 0, B - 1)] + 3);
  const karSchwelle = karMulde.map((y0) => y0 + (yZus - y0) * 0.66);
  const karLippe = (y: number, i: number) => klemme((y - karMulde[i]) / (karSchwelle[i] - karMulde[i]), 0, 1); // 1 an der Karschwelle
  const karSpannen = (y: number): number[][] =>
    kare.map((k, i) => {
      const f = sanft(karLippe(y, i));
      const g = sanft((y - karSchwelle[i]) / (yZus - karSchwelle[i]));
      const schlitz = mitte(yZus) - breite0 + ((i + 0.5) * 2 * breite0) / zahlKare;
      const c = k + (schlitz - k) * g;
      const h = karHalb + (rinneHalb * 0.8 - karHalb) * f + rinneHalb * 0.2 * g;
      return [c - h, c + h];
    });
  // Oberkante des Firns: die Wand unter dem Kamm ist 1 bis 4 Pixel hoch, Felsbänder springen vor
  const wandTief = (x: number) => 1 + Math.round(rauschen(x / 3, 75) * 3);

  const L1 = w.lagen[1];
  const setze1 = (x: number, y: number, f: number) => {
    if (x >= 0 && x < B) L1[(y + U) * B + x] = f;
  };

  // 1. Das Massiv: Unter dem Kamm wird die ganze Bergflanke dunkler Fels; zwischen den Karen stehen
  // Rippen, deren sonnenseitige Hälfte im Licht liegt. Zu den Seiten läuft das Massiv im Raster in die
  // helle Kette aus, nach unten wird es dunkler.
  const massivL = rippenX[0] - karAbstand * 0.5;
  const massivR = rippenX[zahlKare] + karAbstand * 0.5;
  const ausblenden = B * 0.09;
  const felsBis = Math.round(H * 0.6);
  for (let x = Math.max(0, Math.floor(massivL - ausblenden)); x <= Math.min(B - 1, Math.ceil(massivR + ausblenden)); x++) {
    const aussen = Math.max(massivL - x, x - massivR, 0) / ausblenden;
    for (let y = kamm[x] + 1; y < felsBis; y++) {
      const i = (y + U) * B + x;
      const da = L1[i];
      if (da === LEER || (y < kamm[x] + 3 && (da === SCHNEE || da === SCHNEE_SCHATTEN || da === GLUT))) continue;
      const s = w.schwelle(1, x, y);
      // Der Übergang zur Kette im groben Raster: im Winter läge sonst Schnee in Einzelpunkten auf dem Fels
      if (aussen > (winter ? w.grob(1, x, y) : s)) continue;
      const sp = karSpannen(y);
      // Neigung der Felsfläche: in einer Rippe zwischen zwei Karen, sonst die Außenflanke des Massivs
      let licht: boolean;
      if (x < sp[0][0]) licht = w.seite === -1;
      else if (x > sp[zahlKare - 1][1]) licht = w.seite === 1;
      else {
        let u = 0.5;
        for (let n = 0; n + 1 < zahlKare; n++) if (x >= sp[n][1] && x <= sp[n + 1][0]) u = (x - sp[n][1]) / Math.max(1, sp[n + 1][0] - sp[n][1]);
        licht = (u - 0.5) * w.seite > 0;
      }
      const tief = (y - kamm[x]) / (felsBis - kamm[x]);
      let f = licht ? leiter([T1, T2, T3], tief * 0.9 + 0.25, s) : leiter([T2, T3, T4], tief * 0.8 + 0.3, s);
      // Schneebänder auf den Felsabsätzen, im Winter mehr
      if (winter && zahl(x >> 3, y >> 1, 61) < 0.3 * (1 - tief) && (y & 1) === 0 && licht) f = SCHNEE;
      L1[i] = f;
    }
  }

  // 2. Firn in den Karen: oben an der Wand unter dem Kamm, darunter der Bergschrund als dunkle Linie;
  // die Mulde liegt bis auf ihren Schattenrand im Licht
  const schrund = Math.max(2, Math.round(H * 0.022));
  // Der Bergschrund folgt dem geglätteten Kamm, nicht jedem Felsband
  const glatt = (x: number) => {
    let summe = 0;
    for (let d = -3; d <= 3; d++) summe += kamm[klemme(x + d, 0, B - 1)];
    return Math.round(summe / 7) + 4;
  };
  for (let y = karOben; y < Math.round(yZus) + 2; y++) {
    const sp = karSpannen(y);
    sp.forEach(([l, r], n) => {
      const c = (l + r) / 2;
      const h = (r - l) / 2;
      for (let x = Math.max(0, Math.ceil(l)); x <= Math.min(B - 1, Math.floor(r)); x++) {
        const top = kamm[x] + wandTief(x) + 1;
        if (y < top) continue;
        const q = (x - c) / Math.max(1, h);
        const s = w.schwelle(1, x, y);
        const dt = y - top;
        const schatten = q * w.seite - 0.35;
        let f = schatten > 0 && schatten * 2.2 > s ? EIS : SCHNEE;
        if (schatten > 0.45 && 0.5 > s) f = T1;
        if (y === glatt(x) + schrund && Math.abs(q) < 0.8) f = SPALTE;
        if (x === Math.ceil(l) || x === Math.floor(r)) f = q * w.seite > 0 ? T2 : SCHNEE; // Kontur zum Fels
        // Rinne: wenige flache Spaltenbögen zeigen, dass das Eis hier fließt
        if (karLippe(y, n) >= 1 && Math.abs(q) < 0.7 && !winter) {
          const v = y - (1 - q * q) * h * 0.5;
          if (((Math.floor(v) % 5) + 5) % 5 === 0 && zahl(n, Math.floor(v / 5), 62) < 0.6) f = SPALTE;
        }
        setze1(x, y, f);
        if (f === SCHNEE && zahl(x, y, 32) < 0.015) w.zyklus(1, x, y, ZYKLUS_EIS, zahl(x, y, 33) * 256, GLITZER_HELL, f);
      }
    });
  }

  // 3. Die Zunge mit Seitenmoränen, Spaltenbögen, Eisbruch und Mittelmoränen
  const seitenWall = Math.max(2, Math.round(B * 0.008));
  const yEnde = Math.round(y1);
  const stirn = new Int16Array(B).fill(-1);
  const mm = Array.from({ length: zahlKare - 1 }, () => [NaN] as number[]); // letzte x je Mittelmoräne
  for (let y = Math.round(yZus) - 1; y <= yEnde; y++) {
    const m = mitte(y);
    const h = halb(y);
    const t = tZunge(y);
    if (h < 0.5) continue;
    for (let x = Math.max(0, Math.floor(m - h - seitenWall - 1)); x <= Math.min(B - 1, Math.ceil(m + h + seitenWall + 1)); x++) {
      const rel = x - m;
      const ab = Math.abs(rel) - h;
      const s = w.schwelle(1, x, y);
      if (ab >= 0) {
        // Seitenmoräne: helle Krone, dunkler Wall nach außen
        if (y > y1 - lappen) continue;
        if (ab < 1) setze1(x, y, winter ? T3 : FELS_LICHT);
        else if (ab < seitenWall + 1) setze1(x, y, ab < 2 ? T4 : 0.5 > s ? T3 : T4);
        continue;
      }
      const q = rel / h;
      const licht = q * w.seite > -0.1 + (s - 0.5) * 0.3; // gewölbte Zunge: die Seite zur Sonne hell
      let f = winter ? SCHNEE : EIS;
      if (!licht) f = winter ? (0.5 > s ? EIS : SCHNEE) : 0.4 > s ? T1 : EIS;
      // Spaltenbögen: talwärts gewölbt und durchgehend; die Enden schwanken von Bogen zu Bogen
      const v = y - (1 - q * q) * h * 0.24;
      const nahStufe = Math.abs(y - stufe) < Math.max(3, H * 0.03);
      if (nahStufe) {
        // Eisbruch: dicht gedrängte Bögen, jede zweite Zeile ein Spalt, die Grate zerbrochen
        const reihe = Math.floor(v / 2);
        if (Math.abs(q) < 0.9 && v - reihe * 2 < 1) f = zahl(x >> 2, reihe, 65) < 0.25 ? SCHNEE : winter ? EIS : SPALTE;
        else if (Math.abs(q) < 0.9) f = SCHNEE;
      } else if (t > 0.04 && t < 0.88) {
        const abstand = Math.max(4, Math.round(H * (y < stufe ? 0.045 : 0.038)));
        const nummer = Math.floor((v - yZus) / abstand);
        const ph = v - yZus - nummer * abstand;
        const ende = 0.78 + zahl(nummer, 0, 63) * 0.14;
        if (Math.abs(q) < ende) {
          if (ph < 1) f = winter ? (nummer & 1 ? EIS : SCHNEE_SCHATTEN) : SPALTE;
          else if (ph >= abstand - 1 && !winter) f = SCHNEE;
        }
      } else if (t >= 0.88 && !winter && (x + y) % 5 === 0 && Math.abs(q) < 0.8) f = T1; // Schmelzrinnen vor der Stirn
      setze1(x, y, f);
      if (y > stirn[x]) stirn[x] = y;
      if ((f === EIS || f === SCHNEE) && zahl(x, y, 32) < 0.02) w.zyklus(1, x, y, ZYKLUS_EIS, zahl(x, y, 33) * 256, GLITZER_HELL, f);
    }
    // Mittelmoränen: wo die Kare zusammenflossen, eine dunkle Linie ohne Lücken die Zunge hinab
    for (let k = 1; k < zahlKare; k++) {
      if (y > y1 - lappen * 1.5) break;
      const x = Math.round(m + (-1 + (2 * k) / zahlKare) * h + (rauschen(y / 9, 70 + k) - 0.5) * 1.6);
      const vorher = mm[k - 1][0];
      const a = Number.isNaN(vorher) ? x : Math.min(vorher, x);
      const b = Number.isNaN(vorher) ? x : Math.max(vorher, x);
      for (let xx = a; xx <= b; xx++) {
        setze1(xx, y, winter ? T3 : T4);
        if (B >= 240) setze1(xx - w.seite, y, winter ? SCHNEE_SCHATTEN : T3);
      }
      mm[k - 1][0] = x;
    }
  }
  // Stirn: kurze Eiswand mit Rinnen, in der Mitte ein flaches Gletschertor
  const torX = Math.round(gx1);
  const torB = Math.max(2, Math.round(halb(y1 - lappen) * 0.28));
  const torH = Math.max(1, Math.round(torB * 0.5));
  const wand = Math.max(2, Math.round(H * 0.02));
  for (let x = 0; x < B; x++) {
    if (stirn[x] < 0) continue;
    for (let j = 1; j <= wand; j++) {
      const s = w.schwelle(1, x, stirn[x] + j);
      setze1(x, stirn[x] + j, zahl(x, 0, 36) < 0.28 ? T3 : j === wand && 0.5 > s ? T2 : winter ? SCHNEE_SCHATTEN : EIS);
    }
    const dt = Math.abs(x - torX);
    if (dt <= torB) {
      // flacher Bogen: dunkle Höhle, darüber ein Bogen aus Eis
      const hoch = Math.round(Math.sqrt(Math.max(0, 1 - (dt / (torB + 0.5)) ** 2)) * torH);
      const fuss = stirn[x] + wand;
      for (let j = 0; j < hoch; j++) setze1(x, fuss - j, SPALTE);
      setze1(x, fuss - hoch, dt === torB ? T3 : winter ? SCHNEE : EIS);
    }
  }
  w.extra.gletschertor = { x: torX, y: Math.round(y1) };
  w.dinge.push(`${zahlKare} Karen voller Firn`, "einer Gletscherzunge mit Spalten und Eisbruch");

  // 4. Talgrund unter und neben der Zunge (deckend, damit beim Versatz nie Himmel durchscheint):
  // Schotter, aus dem Tor fließt der Gletscherbach
  const grundAb = Math.round(yZus);
  for (let y = grundAb; y < H + U; y++) {
    for (let x = 0; x < B; x++) {
      const i = (y + U) * B + x;
      if (L1[i] !== LEER && !(y > yEnde + wand && Math.abs(x - gx1) < breite0 * 2.4)) continue;
      const s = w.schwelle(1, x, y);
      L1[i] = zahl(x >> 1, y, 64) < 0.12 ? T4 : 0.55 > s ? T3 : T2;
    }
  }
  const bachVon = yEnde + wand + 1;
  const seeY = Math.round(Math.min(nacht - H * 0.1, y1 + wand + (mitSee ? Math.max(3, H * 0.03) : H * 0.09)));
  {
    let x = torX;
    for (let y = bachVon; y < seeY + (mitSee ? 1 : H * 0.2); y++) {
      x += Math.round((rauschen(y / 4, 71) - 0.5) * 1.6);
      const b = 1 + Math.floor((y - bachVon) / Math.max(3, H * 0.04));
      for (let d = 0; d < b; d++) {
        const xx = x + d - (b >> 1);
        const e = y < seeY ? 1 : 3;
        if (xx < 0 || xx >= B) continue;
        w.setze(e, xx, y, st.eis ? EIS : WASSER);
        if (!st.eis) w.zyklus(e, xx, y, ZYKLUS_FLUSS, y * 18 + d * 40, GLITZER_HELL, WASSER);
      }
    }
  }

  // Talflanken (Ebene 2): fallen zur Zunge hin tief ab und legen sich über die Seitenmoränen
  const flanke = grat(rnd, 0.58, B);
  const mitteFlanke = mitte(yZus + (y1 - yZus) * 0.55);
  for (let x = 0; x < B; x++) {
    const v = Math.min(1, Math.abs(x - mitteFlanke) / (B * 0.5));
    flanke[x] = 0.3 + 0.7 * v ** 0.9 * (0.72 + 0.28 * flanke[x]);
  }
  kette(w, {
    ebene: 2, farbe: T3, grund: T2, basis: 0.66, hoehe: 0.36, rauheit: 0.58, licht: 0.5, schatten: 1, profil: flanke,
    schnee: H * (0.42 + st.schnee * 0.3), schneeTiefe: 0.7, saum: false, glut: st.glut ? H * 0.06 : undefined,
    aus: (x, y) => {
      if (y < yZus - 2) return false;
      if (y <= y1 + wand) {
        const sporn = (rauschen(y / 5, 50 + (x < mitte(y) ? 0 : 1)) - 0.3) * 3;
        return Math.abs(x - mitte(y)) < halb(Math.min(y, y1 - lappen)) + seitenWall + 2 + Math.max(0, 2 - sporn);
      }
      return y < seeY + 2 && Math.abs(x - gx1) < breite0 * (1.3 + (y - y1) / Math.max(4, seeY - y1));
    },
  });

  // Vorn: Gletschersee oder Schotterebene, Moränenhügel an den Seiten
  const huegel = welle(rnd, B, 0.6);
  const vorn = new Float32Array(B);
  const breiteSee = B * (0.3 + rv() * 0.12);
  for (let x = 0; x < B; x++) {
    const r = Math.abs(x - gx1) / breiteSee;
    vorn[x] = r < 1 ? H + U : H * (0.8 - Math.min(1, r - 1) * 0.22) - huegel[x] * H * 0.06;
  }
  w.spaeter.push(() => {
    if (mitSee) {
      seeMalen(w, 3, seeY, 0, B);
      // Eisschollen
      for (let n = 0; n < 7; n++) {
        const ex = Math.round(gx1 + (rv() - 0.5) * breiteSee);
        const ey = Math.round(seeY + 2 + rv() * (nacht - seeY) * 0.4);
        const l = 1 + Math.floor(rv() * 3);
        for (let dx = -l; dx <= l; dx++) {
          w.setze(3, ex + dx, ey, SCHNEE);
          if (Math.abs(dx) < l) w.setze(3, ex + dx, ey - 1, EIS);
          w.setze(3, ex + dx, ey + 1, T5);
        }
      }
      w.dinge.push(st.eis ? "einem zugefrorenen Gletschersee" : "einem Gletschersee");
    } else {
      // Schotterebene (Sander): helle Kiesbänke, dazwischen verzweigte Bacharme
      const L3 = w.lagen[3];
      for (let y = seeY; y < H + U; y++) {
        const tief = klemme((y - seeY) / Math.max(1, nacht - seeY), 0, 1);
        for (let x = 0; x < B; x++) {
          const s = w.schwelle(3, x, y);
          const arme = Math.abs(Math.sin((x - gx1) / (B * 0.035 * (1 + tief * 2)) + rauschen(y / 6, 72) * 3));
          let f = leiter([T2, T3, T4, T5, T6], tief * 1.1 + 0.1, s);
          if (arme < 0.14 + tief * 0.1 && y < nacht) {
            f = st.eis ? EIS : WASSER;
            if (!st.eis) w.zyklus(3, x, y, ZYKLUS_FLUSS, y * 18 + x * 2, GLITZER_HELL, f);
          } else if (arme < 0.24 + tief * 0.1) f = winter ? SCHNEE : T1; // Kiesrand
          else if (winter && flecken(x / 7, y / 3, 73) > 0.6) f = SCHNEE_SCHATTEN;
          L3[(y + U) * B + x] = f;
        }
      }
      w.dinge.push("einer Schotterebene mit Gletscherbach");
    }
    // Moräne: Blöcke mit heller Oberkante und Schatten darunter; im Winter eine geschlossene Schneehaube
    flaeche(w, 3, vorn, (x, y, t) => {
      if (y >= nacht) return T6;
      const s = w.schwelle(3, x, y);
      if (t === 0) return winter ? SCHNEE : T4;
      const gr = 3 + Math.floor(t / 6); // Blöcke nach vorn größer
      const bx = Math.floor((x + zahl(Math.floor(y / gr), 0, 37) * gr) / gr);
      const by = Math.floor(y / gr);
      const block = zahl(bx, by, 35) < 0.4;
      const innen = (y % gr) / gr;
      if (winter) {
        if (t < 3) return SCHNEE;
        if (block && innen < 0.34) return SCHNEE;
        if (block && innen > 0.75) return T5;
        return leiter([SCHNEE_SCHATTEN, SCHNEE_SCHATTEN, T4], t / (H * 0.14), s);
      }
      if (block && innen < 0.3) return t < H * 0.1 ? T3 : T4;
      if (block && innen > 0.75) return T6;
      return leiter([T5, T6, T6], t / (H * 0.1), s);
    });
    const kammVorn = new Int16Array(B);
    for (let x = 0; x < B; x++) kammVorn[x] = Math.round(Math.min(H, vorn[x]));
    w.kaemme.push({ ebene: 3, y: kammVorn });
    // Steinmann auf der Moräne
    const sx = Math.round(gx1 + (gx1 < B / 2 ? 1 : -1) * (breiteSee + B * 0.08));
    if (sx > 3 && sx < B - 4 && vorn[sx] < nacht - 8 && w.hud(sx, kammVorn[sx] - 6) > 6) steinmann(w, 3, sx, kammVorn[sx] + 1, 5);
  });
  w.wasser = mitSee ? null : { y0: seeY, y1: nacht, spurX: Math.round(w.sx) };
  w.ufer = seeY;
}

/* Landschaft: Waldtal --------------------------------------------------------------------------- */

// Blick über bewaldete Rücken in ein Tal, durch das sich ein Fluss nach vorn windet
function wald(w: Werk): void {
  const { B, H, rnd, rv, st, nacht } = w;
  const winter = st.schnee >= 0.5;
  // Blick: Horizont höher oder tiefer, alle Ebenen gemeinsam
  const hub = (w.rk() - 0.5) * 0.08;
  // Ferne Ketten
  [0, 1].forEach((i) => {
    kette(w, {
      ebene: 1, farbe: T1 + i, grund: i ? T1 : BOGEN, basis: 0.46 + i * 0.05 + hub, hoehe: 0.26 - i * 0.06, rauheit: 0.54,
      licht: 0.5 + i * 0.125, schatten: 0.875 + i * 0.125, schnee: H * (0.3 + st.schnee * 0.5), saum: true,
      glut: st.glut ? H * 0.07 : undefined,
      nebel: st.nebel ? nebelLinie(w, H * (0.4 + i * 0.05 + hub), B / 26) : H * (0.44 + i * 0.05 + hub), meer: st.nebel > 0, sattel: 0.5,
    });
  });
  // Bewaldete Rücken, nach vorn dunkler; die Täler dazwischen im Dunst
  const ruecken = [
    { basis: 0.55, farbe: T2, baum: T3, gross: 4 },
    { basis: 0.6, farbe: T3, baum: T4, gross: 5 },
    { basis: 0.65, farbe: T4, baum: T5, gross: 7 },
  ];
  ruecken.forEach((r, i) => {
    const profil = welle(rnd, B, 0.45);
    const oben = new Float32Array(B);
    const kippen = (rv() - 0.5) * 0.08;
    for (let x = 0; x < B; x++) oben[x] = H * (r.basis + hub - profil[x] * 0.07 + (x / B - 0.5) * kippen);
    const nebelAb = H * (r.basis + hub + 0.03);
    const L = w.lagen[2];
    for (let x = 0; x < B; x++) {
      for (let y = Math.round(oben[x]); y < H + U; y++) {
        const s = w.schwelle(2, x, y);
        const nebel = (y - nebelAb) / (H * 0.04);
        if (nebel >= 1) {
          if (st.nebel) L[(y + U) * B + x] = NEBEL;
          else break;
          continue;
        }
        // Waldtextur: Wipfel im Raster, im Winter verschneit
        const wipfel = zahl(x >> 1, y >> 1, 40 + i) < 0.3;
        // Im Winter liegen Lichtungen und verschneite Kronen als Flecken im Wald, nicht als Pünktchen
        const schneeFleck = winter && flecken(x / 6, y / 3, 43 + i) > 0.64 - (1 - s) * 0.08;
        const tex = schneeFleck ? SCHNEE : wipfel ? r.baum : r.farbe;
        L[(y + U) * B + x] = nebel > s ? (st.nebel ? NEBEL : LEER) : tex;
      }
    }
    const kamm = new Int16Array(B);
    for (let x = 0; x < B; x++) kamm[x] = Math.round(oben[x]);
    w.kaemme.push({ ebene: 2, y: kamm });
    // Dichter Saum aus Tannenspitzen
    for (let x = 0; x < B; x += 2 + Math.floor(rnd() * 2)) {
      const g = 2 + Math.floor(rnd() * r.gross);
      if (w.hud(x, kamm[x] - g) < 4) continue;
      tanne(w, 2, x, kamm[x] + 2, g, r.baum, i === 2 && g >= 6);
    }
  });

  // Talboden vorn: Wald, der nach vorn größer und dunkler wird; der Fluss windet sich hindurch
  const yOben = Math.round(H * (0.64 + rv() * 0.03 + hub));
  const fx0 = B * (0.5 + (rv() - 0.5) * 0.3);
  const schwung = B * (0.07 + rv() * 0.07);
  const phase = rv() * Math.PI * 2;
  const flussMitte = (y: number) => {
    const t = (y - yOben) / (nacht - yOben);
    return fx0 + Math.sin(phase + t * 4.2) * schwung * (0.3 + t);
  };
  const flussHalb = (y: number) => 1 + ((y - yOben) / (nacht - yOben)) ** 1.5 * B * 0.11;
  const profil = welle(rnd, B, 0.5);
  const boden = new Float32Array(B);
  for (let x = 0; x < B; x++) {
    const rand = Math.abs(x - B / 2) / (B / 2);
    boden[x] = H * (0.67 + hub - rand * rand * 0.14) - profil[x] * H * 0.03;
  }
  flaeche(w, 3, boden, (x, y, t) => {
    if (y >= nacht) return T6;
    const s = w.schwelle(3, x, y);
    const tief = Math.max(0, (y - H * 0.55) / (nacht - H * 0.55));
    // Waldboden bleibt dunkel: Schneeflecken zwischen den Stämmen wären nur Salz und Pfeffer
    if (winter && tief < 0.05 && flecken(x / 9, y / 4, 44) > 0.7 + s * 0.06) return SCHNEE_SCHATTEN;
    return leiter([T5, T6, T6], tief * 1.2 + t * 0.004, s);
  });
  const bodenKamm = new Int16Array(B);
  for (let x = 0; x < B; x++) bodenKamm[x] = Math.round(boden[x]);
  w.kaemme.push({ ebene: 3, y: bodenKamm });
  // Tanne mit Lichtkante auf der Sonnenseite, damit sich die Reihen voneinander abheben
  const lichtTanne = (x: number, fuss: number, g: number, farbe: number, licht: number) => {
    // Im dichten Wald ohne Schnee: bei überlappenden Reihen wären selbst Hauben nur Salz und Pfeffer.
    // Den Winter tragen Ränder, Ufer, Randtannen und die verschneiten Rücken dahinter.
    const { p, f } = tannePunkte(g, farbe, false);
    // äußerster Punkt je Zeile auf der Sonnenseite (die Punkte liegen bei dy −g … 0)
    const rand = new Int16Array(g + 2).fill(-32768);
    for (let i = 0; i < p.length; i += 2) {
      const k = p[i] * w.seite;
      if (k > rand[p[i + 1] + g]) rand[p[i + 1] + g] = k;
    }
    for (let i = 0; i < p.length; i += 2) if (f[i >> 1] === farbe && p[i] * w.seite === rand[p[i + 1] + g] && p[i] !== 0) f[i >> 1] = licht;
    if (g >= 7) w.figur("tanne", 3, x, fuss, p, f, g);
    else for (let i = 0; i < p.length; i += 2) w.setze(3, x + p[i], fuss + p[i + 1], f[i >> 1]);
  };
  // Der Fluss zuerst: spiegelt den Himmel, Wellenlinien, Glitzer unter der Sonne, vorn im Dunkel. Die
  // Tannen davor stehen näher und decken ihn mit ihren Kronen.
  for (let y = yOben; y < nacht; y++) {
    const m = flussMitte(y);
    const h = flussHalb(y);
    const tief = (y - yOben) / (nacht - yOben);
    for (let x = Math.floor(m - h - 1); x <= m + h + 1; x++) {
      if (x < 0 || x >= B) continue;
      const d = Math.abs(x - m);
      const s = w.schwelle(3, x, y);
      if (d >= h) {
        w.setze(3, x, y, winter ? SCHNEE : T4); // Ufer
        continue;
      }
      let f: number;
      if (st.eis) f = zahl(x, y, 45) < 0.12 ? SCHNEE_SCHATTEN : tief > 0.7 && (tief - 0.7) * 3 > s ? T5 : EIS;
      else {
        f = (y + Math.round(d * 0.3)) % 3 === 0 ? T3 : WASSER;
        // Spiegelbild der Ufertannen an den Rändern
        if (d > h - 1 - h * 0.35 * (0.5 + 0.5 * Math.sin(y * 1.7 + x * 0.3)) && (y + x) % 2 === 0) f = T4;
        if (tief > 0.6 && (tief - 0.6) * 2 > s) f = (y & 1) ? T5 : T4;
      }
      w.setze(3, x, y, f);
      if (st.eis) {
        if (zahl(x, y, 46) < 0.04) w.zyklus(3, x, y, ZYKLUS_EIS, zahl(x, y, 47) * 256, GLITZER_HELL, f);
        continue;
      }
      const naheSonne = Math.abs(x - w.sx) < h + 6;
      w.zyklus(3, x, y, naheSonne ? ZYKLUS_GLITZER : ZYKLUS_FLUSS, y * 20 + x * 3, naheSonne ? GLITZER : GLITZER_HELL, f);
    }
  }
  // Baumreihen von hinten nach vorn
  // Der Fluss kommt hinter einer Baumreihe hervor: sein oberstes Stück dürfen Tannen zudecken, sonst
  // beginnt er mitten im Wald mit einem runden Kopf
  const quelle = yOben + (nacht - yOben) * 0.16;
  const imFluss = (x: number, y: number, rand: number) => y >= quelle && Math.abs(x - flussMitte(Math.max(y, yOben))) < flussHalb(Math.max(y, yOben)) + rand;
  for (let y = Math.round(H * 0.5); y < nacht - 1; y += 2 + Math.floor(((y - H * 0.5) / H) * 10)) {
    const tief = Math.max(0, (y - H * 0.55) / (nacht - H * 0.55));
    const g0 = 3 + Math.round(tief * H * 0.08);
    const farbe = tief < 0.3 ? T4 : tief < 0.65 ? T5 : T6;
    const licht = farbe === T4 ? T3 : farbe === T5 ? T4 : T5;
    for (let x = Math.floor(rnd() * 3); x < B; x += 2 + Math.floor(rnd() * (2 + tief * 4))) {
      if (y < bodenKamm[x] + 1) continue;
      if (imFluss(x, y, 2 + tief * 4)) continue;
      const g = g0 + Math.floor(rnd() * 4);
      // Die Krone darf den Fluss weiter hinten nicht zudecken, sonst verschwindet er im Wald
      let deckt = false;
      for (let j = 2; j <= g && !deckt; j += 2) deckt = imFluss(x, y - j, 1 + g * 0.3 * (1 - j / (g + 1)));
      if (deckt) continue;
      if (w.hud(x, y - g) < 4) continue;
      lichtTanne(x, y, g, farbe, licht);
    }
  }
  // Große Randtannen
  [0, 1].forEach((n) => {
    for (let i = 0; i < 3; i++) {
      const x = n ? B - 2 - i * Math.round(B * 0.03) : 1 + i * Math.round(B * 0.03);
      let g = Math.round(Math.min(H * 0.34, B * 0.17) * (1 - i * 0.2));
      const fuss = Math.min(nacht - 1, bodenKamm[x] + Math.round(H * 0.14));
      while (g > 8 && w.hud(x, fuss - g) < 4) g--;
      tanne(w, 3, x, fuss, g, T6);
    }
  });
  w.wasser = { y0: yOben, y1: nacht, spurX: Math.round(w.sx) };
  w.ufer = yOben;
  w.dinge.push("dichtem Tannenwald", st.eis ? "einem zugefrorenen Fluss" : "einem gewundenen Fluss");
}

const LANDSCHAFT: Record<string, Landschaft> = {
  see: { bauen: see, text: "Bergsee" },
  alm: { bauen: alm, text: "Alm" },
  // Nachts im Mondlicht: Die Schattenwand bleibt als Fels lesbar, statt im Schwarz zu versinken
  klamm: { bauen: klamm, text: "Klamm", sonneX: [0.14, 0.3], sonneHoehe: -0.03, nacht: { [T4]: [46, 44, 72], [T5]: [34, 31, 56], [WAND]: [70, 68, 102], [WAND_HELL]: [98, 96, 136] } },
  gipfelgrat: { bauen: gipfelgrat, text: "Gipfelgrat über den Wolken", sonneHoehe: 0.04 },
  dolomiten: { bauen: dolomiten, text: "Felstürme", sonneHoehe: -0.02 },
  gletscher: { bauen: gletscher, text: "Gletschertal" },
  wald: { bauen: wald, text: "Waldtal" },
};

export const STIMMUNGEN: readonly string[] = Object.keys(STIMMUNG);
export const LANDSCHAFTEN: readonly string[] = Object.keys(LANDSCHAFT);

// Billig (keine Szene rechnen): welche Stimmung und Landschaft ein Startwert ergibt
export function entwurf(startwert: number): Entwurf {
  const r = strom((Math.imul(startwert, 0x45d9f3b) ^ 0x3c6ef372) | 0);
  r();
  const stimmung = STIMMUNGEN[Math.floor(r() * STIMMUNGEN.length)];
  const passend = LANDSCHAFTEN.filter((l) => !MEIDEN.has(`${stimmung}/${l}`));
  const landschaft = passend[Math.floor(r() * passend.length)];
  return { stimmung, landschaft };
}

/* Metadaten für das Leben --------------------------------------------------------------------------- */

// Pfade auf Graten, auf denen eine Gämse laufen kann: flach genug, frei von HUD, Sonne und Figuren,
// über dem Fels freier Himmel (nichts Näheres verdeckt sie)
function gratPfade(w: Werk): void {
  const { B, H } = w;
  const kandidaten: { e: number; von: number; bis: number; kamm: Int16Array; wert: number }[] = [];
  const minLaenge = Math.max(14, Math.round(B * 0.07));
  const besetzt = new Uint8Array(B);
  w.figuren.forEach((f) => {
    if (f.art === "tanne" && f.hoehe < 10) return;
    for (let dx = -4; dx <= 4; dx++) if (f.x + dx >= 0 && f.x + dx < B && f.art !== "gras") besetzt[f.x + dx] = 1;
  });
  w.kaemme.forEach((k) => {
    if (k.ebene === 0) return;
    let von = -1;
    const ok = (x: number) => {
      const y = k.y[x];
      if (y >= H * 0.8 || y - 9 < w.weiss + KANTE + 2) return false;
      if (w.lies(k.ebene, x, y) === LEER || w.lies(k.ebene, x, y - 1) !== LEER) return false;
      if (x > 0 && Math.abs(k.y[x] - k.y[x - 1]) > 2) return false;
      if (w.hud(x, y - 8) < 8 || Math.hypot(x - w.sx, y - 4 - w.sy) < w.sr + 6) return false;
      for (let dy = 1; dy <= 8; dy++) if (w.verdeckt(k.ebene, x, y - dy) || w.lies(k.ebene, x, y - dy) !== LEER) return false;
      return !besetzt[x];
    };
    for (let x = 0; x <= B; x++) {
      const gut = x < B && ok(x);
      if (gut && von < 0) von = x;
      if (!gut && von >= 0) {
        if (x - von >= minLaenge) {
          let steigung = 0;
          for (let i = von + 1; i < x; i++) steigung += Math.abs(k.y[i] - k.y[i - 1]);
          const laenge = x - von;
          // Sichtbare Grate in der Mitte des Bildes bevorzugt, nicht zu flach, nicht zu steil
          const wert = laenge * (k.ebene === 2 ? 1.3 : k.ebene === 3 ? 1.1 : 1) * (0.6 + Math.min(1, steigung / laenge) * 0.6);
          kandidaten.push({ e: k.ebene, von, bis: x, kamm: k.y, wert });
        }
        von = -1;
      }
    }
  });
  kandidaten.sort((a, b) => b.wert - a.wert);
  kandidaten.slice(0, 2).forEach((c) => {
    const punkte: number[] = [];
    for (let x = c.von; x < c.bis; x++) punkte.push(x, c.kamm[x] - 1);
    w.pfad("gaemse", c.e, punkte);
  });
}

// Flugbahn für einen Gleitschirm: ein flacher Bogen durch freien Himmel
function schirmPfad(w: Werk, frei: Uint8Array): void {
  const { B, H, rv } = w;
  for (let versuch = 0; versuch < 12; versuch++) {
    const y0 = H * (0.16 + rv() * 0.16);
    const x0 = B * (0.08 + rv() * 0.3);
    const x1 = Math.min(B - 6, x0 + B * (0.25 + rv() * 0.3));
    const bogen = H * (0.03 + rv() * 0.05);
    const punkte: number[] = [];
    let gut = true;
    for (let x = Math.round(x0); x <= x1 && gut; x++) {
      const t = (x - x0) / (x1 - x0);
      const y = Math.round(y0 + bogen * Math.sin(t * Math.PI) + t * H * 0.04);
      for (let dy = -5; dy <= 6 && gut; dy += 2) for (let dx = -4; dx <= 4; dx += 4) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || xx >= B || yy < 0 || yy >= H || !frei[yy * B + xx]) gut = false;
      }
      punkte.push(x, y);
    }
    if (gut && punkte.length > 40) {
      if (rv() < 0.5) {
        const umgekehrt: number[] = [];
        for (let i = punkte.length - 2; i >= 0; i -= 2) umgekehrt.push(punkte[i], punkte[i + 1]);
        w.pfad("gleitschirm", 0, umgekehrt);
      } else w.pfad("gleitschirm", 0, punkte);
      return;
    }
  }
}

/* Aufräumen ---------------------------------------------------------------------------------------- */

// Nach dem Malen: Was nach dem Stempeln einer Figur übermalt wurde (Fluss über Tannen, Wand über
// Bäume der Wand dahinter, die Naht unten …), gehört nicht mehr zur Figur. Sonst schriebe das Leben
// beim Bewegen alte Farben zurück, und es blieben Geisterbilder. Dabei zählt jede Stelle als Kette der
// Figuren, die dort nacheinander gestempelt haben: Passt das unter einer Figur nicht zur Farbe der
// vorigen, wurde dazwischen gemalt, und die vorigen Punkte fallen weg.
function figurenBereinigen(w: Werk): void {
  const { B, G } = w;
  const N = B * G;
  const F = w.figuren;
  let gesamt = 0;
  const anfang = F.map((f) => ((gesamt += f.farben.length), gesamt - f.farben.length));
  const zuletzt = new Int32Array(4 * N); // letzter Punkt (global) je Stelle, um 1 versetzt (0 = keiner)
  const vorig = new Int32Array(gesamt).fill(-1); // Punkt davor an derselben Stelle
  const stelle = new Int32Array(gesamt);
  const weg = new Uint8Array(gesamt);
  const farbeVon = new Uint8Array(gesamt);
  const kettenEnde = (p: number) => {
    for (let q = p; q >= 0 && !weg[q]; q = vorig[q]) weg[q] = 1;
  };
  F.forEach((f, n) => {
    for (let k = 0; k < f.farben.length; k++) {
      const p = anfang[n] + k;
      const i = f.ebene * N + (f.y + f.punkte[2 * k + 1] + U) * B + f.x + f.punkte[2 * k];
      stelle[p] = i;
      farbeVon[p] = f.farben[k];
      const davor = zuletzt[i] - 1;
      if (davor >= 0 && farbeVon[davor] !== f.unter[k]) kettenEnde(davor);
      vorig[p] = davor;
      zuletzt[i] = p + 1;
    }
  });
  for (let p = 0; p < gesamt; p++) {
    const i = stelle[p];
    if (zuletzt[i] !== p + 1) continue;
    if (w.lagen[(i / N) | 0][i % N] !== farbeVon[p]) kettenEnde(p);
  }
  w.figuren = F.flatMap((f, n) => {
    const behalten: number[] = [];
    for (let k = 0; k < f.farben.length; k++) if (!weg[anfang[n] + k]) behalten.push(k);
    if (!behalten.length) return [];
    if (behalten.length === f.farben.length) return [f];
    const punkte = new Int16Array(behalten.length * 2);
    behalten.forEach((k, j) => {
      punkte[2 * j] = f.punkte[2 * k];
      punkte[2 * j + 1] = f.punkte[2 * k + 1];
    });
    return [{ ...f, punkte, farben: Uint8Array.from(behalten, (k) => f.farben[k]), unter: Uint8Array.from(behalten, (k) => f.unter[k]) }];
  });
}

// Zyklen behalten nur Pixel, die noch ihre Leucht- oder Grundfarbe tragen und auf keiner Figur liegen;
// je Stelle zählt der zuletzt gesetzte Zyklus
function zyklenBereinigen(w: Werk): Zyklen {
  const { B, G } = w;
  const N = B * G;
  const belegt = new Uint8Array(4 * N);
  w.figuren.forEach((f) => {
    for (let k = 0; k < f.farben.length; k++) belegt[f.ebene * N + (f.y + f.punkte[2 * k + 1] + U) * B + f.x + f.punkte[2 * k]] = 1;
  });
  const z = w.z;
  const behalten: number[] = [];
  for (let k = z.index.length - 1; k >= 0; k--) {
    const i = z.ebene[k] * N + z.index[k];
    if (belegt[i]) continue;
    belegt[i] = 1;
    const ist = w.lagen[z.ebene[k]][z.index[k]];
    if (ist === z.farbe[k] || ist === z.grund[k]) behalten.push(k);
  }
  behalten.reverse();
  const nimm = (a: number[]) => behalten.map((k) => a[k]);
  return {
    ebene: Uint8Array.from(nimm(z.ebene)),
    index: Uint32Array.from(nimm(z.index)),
    art: Uint8Array.from(nimm(z.art)),
    phase: Uint8Array.from(nimm(z.phase)),
    farbe: Uint8Array.from(nimm(z.farbe)),
    grund: Uint8Array.from(nimm(z.grund)),
  };
}

/* Spiegeln ---------------------------------------------------------------------------------------- */

// Blick von der anderen Seite: Die Szene wurde mit gespiegelter HUD-Sperre gebaut, jetzt kippt alles
// waagerecht, Ebenen samt Metadaten. Danach gilt wieder die echte Sperre.
function spiegeln(w: Werk): void {
  const { B } = w;
  const kipp = (x: number) => B - 1 - x;
  const kippIndex = (i: number) => {
    const x = i % B;
    return i - x + kipp(x);
  };
  for (const L of w.lagen) for (let o = 0; o < L.length; o += B) L.subarray(o, o + B).reverse();
  w.figuren = w.figuren.map((f) => {
    const punkte = Int16Array.from(f.punkte);
    for (let i = 0; i < punkte.length; i += 2) punkte[i] = -punkte[i];
    return { ...f, x: kipp(f.x), punkte };
  });
  w.z.index = w.z.index.map(kippIndex);
  w.kaemme.forEach((k) => k.y.reverse());
  w.pfade = w.pfade.map((p) => {
    const n = p.punkte.length / 2;
    const punkte = new Int16Array(p.punkte.length);
    // Wege, die von links nach rechts liefen, tun das weiter (Grat, Brücke)
    const umdrehen = p.art === "gaemse" || p.art === "bruecke";
    for (let k = 0; k < n; k++) {
      const q = umdrehen ? n - 1 - k : k;
      punkte[2 * k] = kipp(p.punkte[2 * q]);
      punkte[2 * k + 1] = p.punkte[2 * q + 1];
    }
    return { ...p, punkte };
  });
  if (w.wasser) w.wasser = { ...w.wasser, spurX: kipp(w.wasser.spurX) };
  w.sx = kipp(w.sx);
  w.seite = w.seite === 1 ? -1 : 1;
  w.horizont.reverse();
  const roh = new Map<number, [number, number]>();
  w.wolkenRoh.forEach((v, i) => roh.set(kippIndex(i), v));
  w.wolkenRoh = roh;
  if (w.seeRoh) for (let o = 0; o < w.seeRoh.werte.length; o += B) w.seeRoh.werte.subarray(o, o + B).reverse();
  // Zusatzangaben mit x-Lage
  for (const name of ["wasserfall", "seilbahn", "gletschertor"]) {
    const d = w.extra[name] as { x: number } | undefined;
    if (d) w.extra[name] = { ...d, x: kipp(d.x) };
  }
  const huette = w.extra.huette as { x: number; y: number; fenster: number[][]; breite?: number } | undefined;
  if (huette) {
    const fw = huette.breite ?? 2;
    w.extra.huette = { ...huette, x: kipp(huette.x), fenster: huette.fenster.map(([fx, fy]) => [B - fx - fw, fy]) };
  }
  w.sperre = w.sperreEcht;
}

/* Szene ------------------------------------------------------------------------------------------- */

// Bergszene in Farbnummern. Die vier Ebenen reichen UEBERSTAND Kunstpixel über und unter das Bild; das
// Gesamtbild ist ihr mittlerer Ausschnitt. sperre: Bereich unter dem HUD (Szenenkoordinaten). Sonne samt
// Hof, Wolken und Figuren halten Abstand davon. wahl legt Stimmung und Landschaft fest, sonst entscheidet
// der Startwert (wie entwurf()).
export function bergeSzene(B: number, H: number, startwert: number, sperre: Sperre | null = null, wahl?: Wahl): BergSzene {
  const plan = entwurf(startwert);
  const stimmung = wahl?.stimmung && STIMMUNG[wahl.stimmung] ? wahl.stimmung : plan.stimmung;
  let landschaft = wahl?.landschaft && LANDSCHAFT[wahl.landschaft] ? wahl.landschaft : plan.landschaft;
  // Nur die Stimmung gewählt: Passt die Landschaft des Entwurfs nicht dazu, nimmt sie die nächste passende
  if (!(wahl?.landschaft && LANDSCHAFT[wahl.landschaft]) && MEIDEN.has(`${stimmung}/${landschaft}`)) {
    const i = LANDSCHAFTEN.indexOf(landschaft);
    for (let n = 1; n < LANDSCHAFTEN.length; n++) {
      const l = LANDSCHAFTEN[(i + n) % LANDSCHAFTEN.length];
      if (!MEIDEN.has(`${stimmung}/${l}`)) {
        landschaft = l;
        break;
      }
    }
  }
  const st = STIMMUNG[stimmung];
  const L = LANDSCHAFT[landschaft];
  const w = new Werk(B, H, startwert, sperre, st, landschaft);

  sonneSetzen(w, L);
  L.bauen(w);
  himmel(w);
  w.spaeter.forEach((f) => f());
  if (w.spiegel) spiegeln(w);

  // Naht unten: Ab nachtAb liegt in der nahen Ebene nur volle Nacht-Tinte
  const L3 = w.lagen[3];
  L3.fill(T6, (w.nacht + U) * B);
  figurenBereinigen(w);
  const zyklen = zyklenBereinigen(w);

  // Für das Leben: Wolkenpixel, die noch sichtbar ihre Farbe tragen, mit dem Himmel darunter
  const wolkenIndex: number[] = [];
  const wolkenFarbe: number[] = [];
  const wolkenUnter: number[] = [];
  w.wolkenRoh.forEach(([unter, farbe], i) => {
    if (w.lagen[0][i] !== farbe) return;
    wolkenIndex.push(i);
    wolkenFarbe.push(farbe);
    wolkenUnter.push(unter);
  });
  // Für das Leben: Maske der Seefläche, die noch so aussieht, wie seeMalen sie gemalt hat (ohne Insel,
  // Boot, Moräne, Naht)
  let seeFlaeche: { y0: number; y1: number; maske: Uint8Array } | null = null;
  if (w.seeRoh) {
    const { y0, y1, werte } = w.seeRoh;
    const maske = new Uint8Array(werte.length);
    for (let k = 0; k < werte.length; k++) maske[k] = werte[k] !== LEER && L3[(y0 + U) * B + k] === werte[k] ? 1 : 0;
    w.figuren.forEach((f) => {
      if (f.ebene !== 3) return;
      for (let k = 0; k < f.farben.length; k++) {
        const y = f.y + f.punkte[2 * k + 1];
        const x = f.x + f.punkte[2 * k];
        if (y >= y0 && y < y1 && x >= 0 && x < B) maske[(y - y0) * B + x] = 0;
      }
    });
    seeFlaeche = { y0, y1, maske };
  }

  const szene: BergSzene = {
    B,
    H,
    stimmung,
    landschaft,
    lagen: w.lagen,
    farbe: new Uint8Array(B * H),
    paletten: {
      light: palette(TAG_BASIS.map((f, i) => st.tag[i] ?? f), BOGEN),
      dark: palette(NACHT_BASIS.map((f, i) => st.nacht[i] ?? L.nacht?.[i] ?? f), BOGEN),
    },
    farbAnzahl: { light: 0, dark: 0 },
    sonnenseite: w.seite,
    beschreibung: { light: "", dark: "" },
    welt: {
      weiss: w.weiss,
      ufer: w.ufer,
      licht: { x: Math.round(w.sx), y: Math.round(w.sy), r: w.sr },
      kaemme: w.kaemme,
      himmelFrei: new Uint8Array(B * H),
      figuren: w.figuren,
      zyklen,
      wasser: w.wasser,
      pfade: w.pfade,
      ...w.extra,
      horizont: Int16Array.from(w.horizont),
      schneefall: st.schnee >= 0.5,
      nebel: st.nebel > 0,
      // Ergänzungen für das Leben (berge-leben.ts)
      sperre: w.sperre,
      wolken: { index: Uint32Array.from(wolkenIndex), farbe: Uint8Array.from(wolkenFarbe), unter: Uint8Array.from(wolkenUnter) },
      see: seeFlaeche,
      blumen: st.blumen > 0,
      eis: st.eis,
    },
  };
  const stapel = zusammensetzen(szene, [0, 0, 0, 0]);
  szene.farbe = stapel.farbe;

  // Freier Himmel: Ebene 0 sichtbar, Abstand zur Kante, zum HUD und zur Sonne
  const frei = szene.welt.himmelFrei;
  const sonnenAbstand = w.sr * 1.6 + 2;
  for (let y = w.weiss + KANTE + 1; y < H; y++) {
    for (let x = 0; x < B; x++) {
      const i = y * B + x;
      if (stapel.vorn[i] !== 0 || w.hud(x, y) < 6 || Math.hypot(x - w.sx, y - w.sy) < sonnenAbstand) continue;
      frei[i] = 1;
    }
  }
  gratPfade(w);
  schirmPfad(w, frei);

  // Farben zählen
  (["light", "dark"] as Thema[]).forEach((thema) => {
    const tabelle = szene.paletten[thema];
    const gesehen = new Set<number>();
    const rolle = new Uint8Array(256);
    for (let i = 0; i < stapel.farbe.length; i++) rolle[stapel.farbe[i]] = 1;
    rolle.forEach((da, f) => da && gesehen.add(tabelle[f]));
    szene.farbAnzahl[thema] = gesehen.size;
  });

  // Beschreibung für Screenreader
  const dinge = [...new Set(w.dinge)];
  const liste = dinge.length > 1 ? `${dinge.slice(0, -1).join(", ")} und ${dinge[dinge.length - 1]}` : dinge[0] ?? "";
  szene.beschreibung = {
    light: `Gezeichnete Berglandschaft: ${L.text} ${st.text.light}, mit Sonne${liste ? `, ${liste}` : ""}`,
    dark: `Gezeichnete Berglandschaft: ${L.text} ${st.text.dark}, mit Mond, Sternen${liste ? `, ${liste}` : ""}`,
  };
  return szene;
}

/* Zusammensetzen ------------------------------------------------------------------------------------ */

// Ebenen mit Versatz (Kunstpixel, positiv = nach unten) zu einem Gesamtbild stapeln. vorn = Ebene der
// vordersten deckenden Lage je Pixel, hinten = Farbe der nächsten deckenden Lage dahinter (für Ebene 0:
// BOGEN). Die weißen Zeilen oben sind immer Papier; darunter läuft alles in KANTE Rasterzeilen aus.
export function zusammensetzen(szene: BergSzene, versatz: readonly number[], ziel?: Stapel): Stapel {
  const { B, H, lagen } = szene;
  const n = B * H;
  const st: Stapel = ziel && ziel.farbe.length === n ? ziel : { farbe: new Uint8Array(n), vorn: new Uint8Array(n), hinten: new Uint8Array(n) };
  const { farbe, vorn, hinten } = st;
  const v = TIEFE.map((t, e) => {
    const roh = versatz[e];
    return klemme(Math.round(Number.isFinite(roh) ? roh : 0), -t, t);
  });
  const weiss = szene.welt.weiss;
  const [L0, L1, L2, L3] = lagen;
  farbe.fill(BOGEN, 0, weiss * B);
  vorn.fill(0, 0, weiss * B);
  hinten.fill(BOGEN, 0, weiss * B);
  for (let y = weiss; y < H; y++) {
    const o0 = (y + U - v[0]) * B;
    const o1 = (y + U - v[1]) * B;
    const o2 = (y + U - v[2]) * B;
    const o3 = (y + U - v[3]) * B;
    const kante = y - weiss < KANTE ? (y - weiss + 1) / (KANTE + 1) : 2;
    const bayer = BAYER[y & 7];
    for (let x = 0, i = y * B; x < B; x++, i++) {
      let f = L3[o3 + x];
      let e = 3;
      let h = BOGEN;
      if (f === LEER) {
        f = L2[o2 + x];
        e = 2;
        if (f === LEER) {
          f = L1[o1 + x];
          e = 1;
          if (f === LEER) {
            f = L0[o0 + x];
            e = 0;
          } else h = L0[o0 + x];
        } else {
          h = L1[o1 + x];
          if (h === LEER) h = L0[o0 + x];
        }
      } else {
        h = L2[o2 + x];
        if (h === LEER) h = L1[o1 + x];
        if (h === LEER) h = L0[o0 + x];
      }
      if (kante < 1 && f !== BOGEN && kante <= (bayer[x & 7] + 0.5) / 64) {
        f = BOGEN;
        e = 0;
        h = BOGEN;
      }
      farbe[i] = f;
      vorn[i] = e;
      hinten[i] = e === 0 ? BOGEN : h;
    }
  }
  return st;
}
