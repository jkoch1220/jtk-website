// Übergänge für „Neu zeichnen“: Das alte Bild zerfällt in Teilchen, die in einer Choreografie zum neuen
// Bild fliegen. Kein DOM, darum in Node prüfbar. Solange der Flug läuft, gehört ihm die Ausgabe; der Renderer
// ruft schritt() je Bild auf und malt danach wieder selbst.
//
// Aufbau jeder Choreografie: Jedes alte Pixel (Quelle) wird einem neuen Pixel (Ziel) zugeordnet, ein
// Teilchen trägt es hinüber. Vor seinem Start liegt das Pixel noch im alten Bild, nach seiner Ankunft schon
// im neuen. So bleibt das Bild in jedem Moment vollständig, und das letzte Bild ist exakt das Ziel.
//
// Die Vorbereitung (Paaren, Sortieren, Zeiten) läuft nicht im Klick, sondern in Raten in den ersten Bildern
// des Flugs: Jede Choreografie ist ein Generator, der in seinen großen Schleifen kurz abgibt. So friert der
// Klick nicht ein, auch nicht auf langsamen Geräten; bis alles bereitliegt, steht das alte Bild still.
//
// Farben sind intern vorzeichenbehaftete 32-Bit-Zahlen (Int32-Sichten auf die RGBA-Puffer). Deckende Farben
// sind damit kleine negative Zahlen, die V8 ohne Umweg über den Speicher rechnet; als Uint32 lägen sie über
// 2^31 und würden in kaltem Code je Pixel als Objekt angelegt.

import { BAYER, NAHT, type Sperre } from "./berge-szene";

export interface FlugEingabe {
  alt: { B: number; H: number; rgba: Uint32Array }; // was gerade zu sehen ist
  neu: { B: number; H: number; farbe: Uint8Array; tabelle: Uint32Array; vorn: Uint8Array }; // neues Standbild (t = 0)
  himmel: number; // RGBA von BOGEN im aktuellen Thema
  grund: number; // RGBA von T6 im aktuellen Thema
  fest: number; // nachtAb(neu.H): ab hier steht die Nacht-Tinte, sie fliegt nicht
  ursprung: { x: number; y: number } | null; // Kunstpixel, Lage des Knopfs „Neu zeichnen“ (kann außerhalb liegen)
  vorher: string | null; // Name der vorigen Choreografie
  zeiger: () => { x: number; y: number } | null; // aktuelle Mauslage in Kunstpixeln oder null
  status: (text: string) => void;
  // Ergänzung: das schwebende HUD (Szenenkoordinaten). Der Urknall weicht ihm aus. undefined = unbekannt,
  // dann wird es aus der Lage des Knopfs geschätzt; null = kein HUD (Handy).
  sperre?: Sperre | null;
  // Ergänzung: Farbzahl, die die Statuszeile nach der Landung zeigt (die Bühne nimmt szene.farbAnzahl.light).
  // Der Druckvermerk der Farbsortierung nennt dieselbe Zahl, damit nach der Landung nichts springt. Ohne
  // Angabe zählt der Flug selbst, und nur bei Tag (nachts zählte er die Nachtpalette und spränge).
  farbZahl?: number;
}

export interface Flug {
  name: string;
  schritt(jetzt: number, ausgabe: Uint32Array): boolean; // jetzt in ms; false = fertig, ausgabe ist das Ziel
}

export const CHOREOGRAFIEN: readonly string[] = [
  "wirbel",
  "urknall",
  "sandsturm",
  "schwerkraft",
  "farbsortierung",
  "druckzeile",
  "lawine",
  "umblaettern",
];

// Mehr Teilchen bremsen den Schritt über 6 ms; größere Bilder werden gleichmäßig ausgedünnt
const HOECHSTENS = 90_000;
// Kopie-Gelb aus den Durchschlägen: Lichtblitz, Funken, Düse des Druckkopfs
const GELB = farbe(243, 230, 160);
// Kopie-Rosa, der zweite Durchschlag: Saum des Lichtblitzes bei Tag
const ROSA = farbe(242, 205, 213);
// Gelb mit Bogenweiß: Glanz der Funken bei Nacht
const GLANZ = farbe(249, 242, 208);
// Mondcreme der Nachtpalette: der Lichtblitz bei Nacht
const MONDCREME = farbe(244, 231, 178);
// Tinte und Tinten-Abstufungen der Marke
const TINTE = farbe(43, 42, 126);
const TINTE_FERNE = farbe(185, 184, 224);
const TINTE_DUNST = farbe(141, 140, 192);
// Unter der oberen Naht dünnen Flugpixel und Effekte über so viele Zeilen gerastert aus
const SAUM = 5;
// Spätestens hier sind alle Teilchen gelandet; der Rest der Dauer ist Ruhe vor dem exakten Schlussbild
const LANDUNG = 0.965;
// Zeiger: Radius des Wirbels (Anteil der kürzeren Bildseite) und Abklingen der Ablenkung je 1/60 s
const ZEIGER_RADIUS = 0.12;
const ZEIGER_ABKLINGEN = 0.94;
// Vorbereitung in Raten: so viele ms je Bild, und nach so vielen Durchläufen einer großen Schleife wird
// nachgesehen, ob die Rate verbraucht ist (Maske, 4096 Durchläufe ≈ 0,1–0,3 ms ungedrosselt)
const RATE_MS = 5;
const TAKT = 0xfff;

/* Hilfen -------------------------------------------------------------------- */

// Ein Generator, der in seinen Schleifen abgibt und am Ende T liefert
type Bau<T> = Generator<void, T, void>;

function farbe(r: number, g: number, b: number): number {
  return (255 << 24) | (b << 16) | (g << 8) | r;
}

// Zwei RGBA-Werte mischen (k = 0: a, k = 1: b)
function mischen(a: number, b: number, k: number): number {
  const r = (a & 255) + ((b & 255) - (a & 255)) * k;
  const g = ((a >>> 8) & 255) + (((b >>> 8) & 255) - ((a >>> 8) & 255)) * k;
  const bl = ((a >>> 16) & 255) + (((b >>> 16) & 255) - ((a >>> 16) & 255)) * k;
  return farbe(Math.round(r), Math.round(g), Math.round(bl));
}

function helligkeit(v: number): number {
  return 0.299 * (v & 255) + 0.587 * ((v >>> 8) & 255) + 0.114 * ((v >>> 16) & 255);
}

// Int32-Sicht auf einen RGBA-Puffer (teilt den Speicher, kopiert nichts)
const alsInt = (u: Uint32Array) => new Int32Array(u.buffer, u.byteOffset, u.length);

// Uhr für die Raten der Vorbereitung; performance gibt es im Browser und in Node
const uhr = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

const klemm = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ein2 = (s: number) => s * s;
const ein3 = (s: number) => s * s * s;
const aus2 = (s: number) => 1 - (1 - s) * (1 - s);
const aus3 = (s: number) => 1 - (1 - s) ** 3;
const aus4 = (s: number) => 1 - (1 - s) ** 4;
const einAus3 = (s: number) => (s < 0.5 ? 4 * s * s * s : 1 - (-2 * s + 2) ** 3 / 2);
// Ausholen, dann ohne Überschwingen ankommen: erste Hälfte „back in“, zweite Hälfte weiches Auslaufen.
// Die Steigungen treffen sich in der Mitte (Exponent = Ausholen + 3), darum kein Knick.
const AUSHOLEN = 0.9;
const ausholen = (s: number) =>
  s < 0.5
    ? ((AUSHOLEN + 1) * (2 * s) ** 3 - AUSHOLEN * (2 * s) ** 2) / 2
    : 0.5 + (1 - (1 - (2 * s - 1)) ** (AUSHOLEN + 3)) / 2;

// Sinustafel: 90 000 Teilchen mit je zwei Winkelfunktionen wären sonst der teuerste Teil des Schritts
const TAFEL = 4096;
const SINUS = new Float32Array(TAFEL);
for (let i = 0; i < TAFEL; i++) SINUS[i] = Math.sin((i / TAFEL) * 2 * Math.PI);
const ZU_TAFEL = TAFEL / (2 * Math.PI);
const sinus = (w: number) => SINUS[Math.floor(w * ZU_TAFEL) & (TAFEL - 1)];
const kosinus = (w: number) => SINUS[(Math.floor(w * ZU_TAFEL) + TAFEL / 4) & (TAFEL - 1)];

// Vorrat: Die großen Felder (je Teilchen, je Pixel) leben über den Flug hinaus und werden beim nächsten
// Klick wiederverwendet, statt jedes Mal einige MB anzulegen und wegzuwerfen. Es läuft immer nur ein Flug;
// der Renderer verwirft den alten, bevor er einen neuen startet. Jeder Name steht für genau ein Feld.
type Feld = Uint32Array | Int32Array | Float32Array | Float64Array | Int16Array | Uint8Array | Int8Array;
const VORRAT = new Map<string, Feld>();
function vorrat<T extends Feld>(name: string, Art: { new (n: number): T }, n: number, leeren = true): T {
  let f = VORRAT.get(name) as T | undefined;
  if (!f || f.length < n || f.constructor !== Art) {
    f = new Art(n);
    VORRAT.set(name, f);
    return f; // frisch angelegt ist schon leer
  }
  const teil = f.subarray(0, n) as T;
  if (leeren) teil.fill(0);
  return teil;
}

// Geglättetes Rauschen 0 … 1, etwa für versetzte Zeilen im Sandsturm (klein: je Spalte oder Zeile)
function rauschen(n: number, radius: number): Float32Array {
  let a = new Float32Array(n).map(() => Math.random());
  for (let durchgang = 0; durchgang < 2; durchgang++) {
    const b = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let summe = 0;
      let zahl = 0;
      for (let k = -radius; k <= radius; k++) {
        const j = i + k;
        if (j >= 0 && j < n) {
          summe += a[j];
          zahl++;
        }
      }
      b[i] = summe / zahl;
    }
    a = b;
  }
  let min = Infinity;
  let max = -Infinity;
  for (const v of a) {
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  return a.map((v) => (v - min) / (max - min || 1));
}

// Geglättetes 2D-Rauschen 0 … 1 (Wertrauschen, zwei Oktaven) über B × H. Nachbarpixel bekommen ähnliche
// Werte: Daraus abgeleitete Startzeiten lassen das Bild in Schollen reißen statt als Pixelstaub zerfallen.
function* flaeche(name: string, B: number, H: number, zelle: number): Bau<Float32Array> {
  const aus = vorrat(name, Float32Array, B * H);
  for (const [z0, gewicht] of [
    [Math.max(2, zelle), 0.72],
    [Math.max(2, zelle / 2.7), 0.28],
  ]) {
    const z = z0;
    const gx = Math.ceil(B / z) + 2;
    const gy = Math.ceil(H / z) + 2;
    const g = new Float32Array(gx * gy).map(() => Math.random());
    for (let y = 0; y < H; y++) {
      const fy = y / z;
      const iy = fy | 0;
      let ty = fy - iy;
      ty = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < B; x++) {
        const fx = x / z;
        const ix = fx | 0;
        let tx = fx - ix;
        tx = tx * tx * (3 - 2 * tx);
        const o = iy * gx + ix;
        const a = g[o];
        const b = g[o + 1];
        const c = g[o + gx];
        const d = g[o + gx + 1];
        aus[y * B + x] += gewicht * (a + (b - a) * tx + (c - a + (d - c - b + a) * tx) * ty);
      }
      if ((y & 15) === 15) yield;
    }
  }
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < aus.length; i++) {
    const v = aus[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const k = 1 / (max - min || 1);
  for (let i = 0; i < aus.length; i++) aus[i] = (aus[i] - min) * k;
  yield;
  return aus;
}

// Rangfolge nach ganzzahligem Schlüssel (0 … 2^32): stabile Radixsortierung in Stufen zu 11 Bit. Linear statt
// n·log n und ohne Vergleichsfunktion; zwischen den Stufen und innerhalb großer Stufen gibt sie ab. Das
// Ergebnis liegt im Vorratsfeld name (die Zwischenfelder teilen sich alle Aufrufe).
const ZAEHLER = new Uint32Array(2048);
function* rangfolge(schluessel: Uint32Array, name: string): Bau<Uint32Array> {
  const n = schluessel.length;
  let kA = vorrat("rang.kA", Uint32Array, n, false);
  let kB = vorrat("rang.kB", Uint32Array, n, false);
  let iA = vorrat("rang.iA", Uint32Array, n, false);
  let iB = vorrat("rang.iB", Uint32Array, n, false);
  let max = 0;
  for (let i = 0; i < n; i++) {
    const k = schluessel[i];
    kA[i] = k;
    iA[i] = i;
    if (k > max) max = k;
  }
  for (let stufe = 0; stufe < 32 && (stufe === 0 || max >>> stufe > 0); stufe += 11) {
    ZAEHLER.fill(0);
    for (let i = 0; i < n; i++) ZAEHLER[(kA[i] >>> stufe) & 2047]++;
    let summe = 0;
    for (let d = 0; d < 2048; d++) {
      const z = ZAEHLER[d];
      ZAEHLER[d] = summe;
      summe += z;
    }
    if (n > 30_000) yield;
    for (let i = 0; i < n; i++) {
      const k = kA[i];
      const ziel = ZAEHLER[(k >>> stufe) & 2047]++;
      kB[ziel] = k;
      iB[ziel] = iA[i];
    }
    [kA, kB] = [kB, kA];
    [iA, iB] = [iB, iA];
    yield;
  }
  const aus = vorrat(name, Uint32Array, n, false);
  aus.set(iA);
  return aus;
}

/* Bühne: gemeinsame Daten und Malwerkzeuge aller Choreografien ---------------- */

type Schluessel = (x: number, y: number, p: number) => number;

class Buehne {
  B: number;
  H: number;
  fest: number;
  weiss: number; // obere Naht: so viele Zeilen gehören dem Papier
  F: number; // Pixel oberhalb der Nacht-Tinte
  himmel: number;
  grund: number;
  dunkel: boolean;
  alt: Int32Array; // altes Bild, auf die neue Größe gebracht
  neu: Int32Array = new Int32Array(0); // Zielbild als RGBA
  vorn: Uint8Array;
  quellen: Uint32Array = new Uint32Array(0); // Pixelindizes des alten Bilds, die fliegen (nicht Himmel, oberhalb von fest)
  ziele: Uint32Array = new Uint32Array(0);
  n = 0;
  // je Teilchen (nur für Choreografien mit Teilchen angelegt)
  q: Uint32Array = new Uint32Array(0);
  z: Uint32Array = new Uint32Array(0);
  qx: Int16Array = new Int16Array(0);
  qy: Int16Array = new Int16Array(0);
  zx: Int16Array = new Int16Array(0);
  zy: Int16Array = new Int16Array(0);
  fa: Int32Array = new Int32Array(0); // Farbe im alten Bild
  fn: Int32Array = new Int32Array(0); // Farbe im neuen Bild
  start: Float32Array = new Float32Array(0); // verlässt das alte Bild (Anteil der Dauer)
  ende: Float32Array = new Float32Array(0); // ist im neuen Bild angekommen
  ox: Float32Array = new Float32Array(0); // Ablenkung durch den Zeiger
  oy: Float32Array = new Float32Array(0);
  // je Pixel oberhalb von fest
  altZeit: Float32Array = new Float32Array(0);
  neuZeit: Float32Array = new Float32Array(0);
  letzte = 0; // spätester Anteil, zu dem noch ein Pixel ankommt
  saum: Float32Array; // Rasterschwelle je Zeile im Saum unter der oberen Naht (64 = voll sichtbar)
  // je Bild
  aus: Int32Array = new Int32Array(0);
  private ausU: Uint32Array | null = null;
  zeigerAn = false;
  mx = 0;
  my = 0;
  radius: number;
  radius2: number;
  zug = 0;
  abkling = 1;
  dt = 0;

  // Nur das Nötigste, damit das alte Bild sofort gezeigt werden kann; der Rest kommt in aufbauen()
  constructor(e: FlugEingabe) {
    const { B, H } = e.neu;
    this.B = B;
    this.H = H;
    this.fest = Math.max(0, Math.min(Math.round(e.fest), H - NAHT));
    this.weiss = Math.min(this.fest, Math.ceil(0.08 * H));
    this.F = B * this.fest;
    this.himmel = e.himmel | 0;
    this.grund = e.grund | 0;
    this.dunkel = helligkeit(this.himmel) < 128;
    this.radius = Math.max(10, Math.round(Math.min(B, H) * ZEIGER_RADIUS));
    this.radius2 = this.radius * this.radius;
    this.vorn = e.neu.vorn;

    // Altes Bild auf die neue Größe (nächster Nachbar): Die Bühne ist am Bildschirm gleich groß geblieben.
    // Gleich groß (der Normalfall) wird es nur gelesen, nicht kopiert.
    const { B: aB, H: aH, rgba } = e.alt;
    if (aB === B && aH === H && rgba.length >= B * H) this.alt = alsInt(rgba).subarray(0, B * H);
    else {
      const alt = vorrat("alt", Int32Array, B * H, false);
      const quelle = alsInt(rgba);
      if (aB > 0 && aH > 0 && rgba.length >= aB * aH) {
        const spalte = new Uint32Array(B);
        for (let x = 0; x < B; x++) spalte[x] = Math.min(aB - 1, Math.floor(((x + 0.5) * aB) / B));
        for (let y = 0; y < H; y++) {
          const zeile = Math.min(aH - 1, Math.floor(((y + 0.5) * aH) / H)) * aB;
          for (let x = 0; x < B; x++) alt[y * B + x] = quelle[zeile + spalte[x]];
        }
      } else alt.fill(this.himmel);
      this.alt = alt;
    }

    // Über der Naht nichts, darunter wächst die Deckung Zeile für Zeile bis voll
    this.saum = new Float32Array(this.fest);
    for (let y = 0; y < this.fest; y++) this.saum[y] = y < this.weiss ? 0 : Math.min(64, ((y - this.weiss + 1) * 64) / (SAUM + 1));
  }

  // Zielbild, fliegende Pixel und Felder. teilchen = false: Die Choreografie malt ohne Teilchen (Druckzeile,
  // Umblättern) und braucht nur die Zahl für den Druckvermerk.
  *aufbauen(e: FlugEingabe, teilchen: boolean): Bau<void> {
    const { B, H, F } = this;
    const neu = vorrat("neu", Int32Array, B * H, false);
    const nummern = e.neu.farbe;
    const tabelle = alsInt(e.neu.tabelle);
    for (let i = 0; i < B * H; i++) {
      neu[i] = tabelle[nummern[i]];
      if ((i & 0x7fff) === 0x7fff) yield;
    }
    this.neu = neu;

    // Himmel fliegt nicht mit: Er ist in beiden Bildern dieselbe Papierfarbe
    const { alt, himmel } = this;
    const qAlle = vorrat("quellen", Uint32Array, F, false);
    const zAlle = vorrat("ziele", Uint32Array, F, false);
    let S = 0;
    let T = 0;
    for (let p = 0; p < F; p++) {
      if (alt[p] !== himmel) qAlle[S++] = p;
      if (neu[p] !== himmel) zAlle[T++] = p;
    }
    yield;
    // Leeres altes oder neues Bild: Dann starten bzw. enden die Teilchen unsichtbar am anderen Ort
    this.quellen = S ? qAlle.subarray(0, S) : zAlle.subarray(0, T);
    this.ziele = T ? zAlle.subarray(0, T) : qAlle.subarray(0, S);
    const n = Math.min(HOECHSTENS, Math.max(this.quellen.length, this.ziele.length));
    this.n = n;
    this.altZeit = vorrat("altZeit", Float32Array, F, false);
    this.neuZeit = vorrat("neuZeit", Float32Array, F, false);
    if (!teilchen || !n) return;
    this.q = vorrat("q", Uint32Array, n, false);
    this.z = vorrat("z", Uint32Array, n, false);
    this.qx = vorrat("qx", Int16Array, n, false);
    this.qy = vorrat("qy", Int16Array, n, false);
    this.zx = vorrat("zx", Int16Array, n, false);
    this.zy = vorrat("zy", Int16Array, n, false);
    this.fa = vorrat("fa", Int32Array, n, false);
    this.fn = vorrat("fn", Int32Array, n, false);
    this.start = vorrat("start", Float32Array, n);
    this.ende = vorrat("ende", Float32Array, n);
    this.ox = vorrat("ox", Float32Array, n);
    this.oy = vorrat("oy", Float32Array, n);
    yield;
  }

  // Rangfolge einer Pixelliste nach Schlüssel(x, y, Pixelindex), Ergebnis im Vorratsfeld name
  *ordnen(liste: Uint32Array, schluessel: Schluessel, name: string): Bau<Uint32Array> {
    const { B } = this;
    const werte = vorrat("ordnen.werte", Uint32Array, liste.length, false);
    for (let r = 0; r < liste.length; r++) {
      const p = liste[r];
      const x = p % B;
      const k = schluessel(x, (p - x) / B, p);
      werte[r] = k > 0 ? Math.floor(k) : 0;
      if ((r & TAKT) === TAKT) yield;
    }
    return yield* rangfolge(werte, name);
  }

  // Teilchen i trägt die Quelle mit Rang ⌊i·S/n⌋: mehr Teilchen als Quellen teilen sich ein Pixel,
  // weniger dünnen gleichmäßig aus
  quellenVerteilen(ordnung: Uint32Array): void {
    const { n, quellen, B, alt } = this;
    const S = quellen.length;
    for (let i = 0; i < n; i++) {
      const p = quellen[ordnung[Math.floor((i * S) / n)]];
      const x = p % B;
      this.q[i] = p;
      this.qx[i] = x;
      this.qy[i] = (p - x) / B;
      this.fa[i] = alt[p];
    }
  }

  // reihe: in welcher Folge die Teilchen die sortierten Ziele erhalten (ohne: Teilchen i bekommt Rang i)
  zieleVerteilen(ordnung: Uint32Array, reihe?: Uint32Array): void {
    const { n, ziele, B, neu } = this;
    const T = ziele.length;
    for (let k = 0; k < n; k++) {
      const i = reihe ? reihe[k] : k;
      const p = ziele[ordnung[Math.floor((k * T) / n)]];
      const x = p % B;
      this.z[i] = p;
      this.zx[i] = x;
      this.zy[i] = (p - x) / B;
      this.fn[i] = neu[p];
    }
  }

  *paaren(schluesselQ: Schluessel, schluesselZ: Schluessel): Bau<void> {
    this.quellenVerteilen(yield* this.ordnen(this.quellen, schluesselQ, "ordnungQ"));
    yield;
    this.zieleVerteilen(yield* this.ordnen(this.ziele, schluesselZ, "ordnungZ"));
    yield;
  }

  // Aus den Teilchenzeiten die Pixelzeiten: Ein altes Pixel bleibt, bis sein letztes Teilchen gestartet ist,
  // ein neues erscheint, sobald das erste angekommen ist. Unbelegte Pixel (nur bei Ausdünnung) erben die
  // Zeit des Nachbarn in derselben Zeile.
  *zeitenFestlegen(): Bau<void> {
    const { altZeit, neuZeit, n, F, B, start, ende, q, z } = this;
    const OFFEN = -2;
    altZeit.fill(-1);
    neuZeit.fill(Infinity);
    for (let r = 0; r < this.quellen.length; r++) altZeit[this.quellen[r]] = OFFEN;
    for (let r = 0; r < this.ziele.length; r++) neuZeit[this.ziele[r]] = OFFEN;
    yield;
    let letzte = 0;
    for (let i = 0; i < n; i++) {
      const s = Math.max(0, start[i]);
      const e = Math.min(LANDUNG, ende[i]);
      ende[i] = e;
      if (e > letzte) letzte = e;
      if (altZeit[q[i]] < s) altZeit[q[i]] = s;
      const zi = z[i];
      if (neuZeit[zi] === OFFEN || e < neuZeit[zi]) neuZeit[zi] = e;
      if ((i & TAKT) === TAKT) yield;
    }
    this.letzte = letzte;
    if (n >= Math.max(this.quellen.length, this.ziele.length)) return;
    this.letzte = LANDUNG;
    for (const feld of [altZeit, neuZeit]) {
      for (let p0 = 0; p0 < F; p0 += B) {
        let letzte = OFFEN;
        for (let p = p0; p < p0 + B; p++) if (feld[p] !== OFFEN && feld[p] >= 0) letzte = feld[p];
        for (let p = p0; p < p0 + B; p++) {
          if (feld[p] === OFFEN) feld[p] = letzte === OFFEN ? (feld === altZeit ? 0 : LANDUNG) : letzte;
          else if (feld[p] >= 0) letzte = feld[p];
        }
      }
      yield;
    }
  }

  // Vor jedem Bild: Ausgabe, Zeigerlage und Abklingen der Ablenkung (bildratenunabhängig)
  rahmen(ausgabe: Uint32Array, dt: number, zeiger: { x: number; y: number } | null): void {
    if (ausgabe !== this.ausU) {
      this.ausU = ausgabe;
      this.aus = alsInt(ausgabe);
    }
    this.zeigerAn = !!zeiger && zeiger.x > -this.radius && zeiger.x < this.B + this.radius && zeiger.y > -this.radius && zeiger.y < this.H + this.radius;
    if (zeiger) {
      this.mx = zeiger.x;
      this.my = zeiger.y;
    }
    this.dt = dt;
    this.zug = 1 - Math.pow(0.55, dt * 60);
    this.abkling = Math.pow(ZEIGER_ABKLINGEN, dt * 60);
  }

  // Solange die Vorbereitung läuft: das alte Bild, mit exakten Nähten (es kann umskaliert sein)
  altZeigen(ausgabe: Uint32Array): void {
    const aus = alsInt(ausgabe);
    const { B, H, alt } = this;
    aus.set(alt.length <= aus.length ? alt : alt.subarray(0, aus.length));
    aus.fill(this.himmel, 0, B * this.weiss);
    aus.fill(this.grund, this.F, Math.min(aus.length, B * H));
  }

  // Hintergrund: Himmel, liegende alte Pixel, angekommene neue Pixel, darunter die Nacht-Tinte.
  // rx verschiebt das alte Bild waagrecht (Beben vor dem Einsturz).
  grundMalen(t: number, rx = 0): void {
    const { aus, alt, neu, altZeit, neuZeit, himmel, F, B } = this;
    if (rx === 0) {
      for (let p = 0; p < F; p++) aus[p] = t >= neuZeit[p] ? neu[p] : t < altZeit[p] ? alt[p] : himmel;
    } else {
      for (let p0 = 0; p0 < F; p0 += B) {
        for (let x = 0; x < B; x++) {
          const p = p0 + x;
          const xa = x - rx;
          const pa = p0 + (xa < 0 ? 0 : xa >= B ? B - 1 : xa);
          aus[p] = t >= neuZeit[p] ? neu[p] : t < altZeit[pa] ? alt[pa] : himmel;
        }
      }
    }
    aus.fill(this.grund, F, B * this.H);
  }

  // Ein fliegendes Teilchen setzen. Der Zeiger ist ein Strudel im Teilchenstrom: Innen drückt eine Feder
  // zum Rand des Zeigerkreises, in einem weiteren Ring schiebt ein Drehanteil die Teilchen um ihn herum. Die
  // Ablenkung klingt langsam ab, so ziehen die Teilchen als gekrümmte Schleppe davon. frei (0 … 1) blendet
  // sie zur Landung hin aus, damit jedes Teilchen auf ganzen Pixeln einrastet.
  setzen(i: number, x: number, y: number, f: number, frei: number): void {
    let dx = this.ox[i];
    let dy = this.oy[i];
    if (this.zeigerAn && frei > 0) {
      const rx = x + dx - this.mx;
      const ry = y + dy - this.my;
      const d2 = rx * rx + ry * ry;
      if (d2 < this.radius2 * 2.56) {
        const d = Math.sqrt(d2) + 0.01;
        if (d < this.radius) {
          const k = ((this.radius - d) / d) * this.zug;
          dx += rx * k;
          dy += ry * k;
        }
        const ring = 1 - d / (this.radius * 1.6);
        const dreh = (this.radius * 0.2 * ring * ring * this.zug) / d;
        dx -= ry * dreh;
        dy += rx * dreh;
      }
    }
    dx *= this.abkling;
    dy *= this.abkling;
    this.ox[i] = dx;
    this.oy[i] = dy;
    this.punkt(Math.floor(x + dx * frei + 0.5), Math.floor(y + dy * frei + 0.5), f);
  }

  // Schweif hinter einem Teilchen, das eben gesetzt wurde: zwei Pixel entgegen der Flugrichtung (dx, dy)
  spur(i: number, x: number, y: number, dx: number, dy: number, f1: number, f2: number, frei: number): void {
    const bx = x + this.ox[i] * frei;
    const by = y + this.oy[i] * frei;
    this.punkt(Math.floor(bx - dx * 0.5 + 0.5), Math.floor(by - dy * 0.5 + 0.5), f1);
    this.punkt(Math.floor(bx - dx + 0.5), Math.floor(by - dy + 0.5), f2);
  }

  // Ein Teilchen ruht unsichtbar (im Feld, ausgeweht): Seine Ablenkung verfällt, sonst spränge es beim
  // Wiederauftauchen um den alten Versatz
  ruhen(i: number): void {
    this.ox[i] = 0;
    this.oy[i] = 0;
  }

  // Liegt (x, y) im malbaren Bereich? Über der oberen Naht nie, im Saum darunter gerastert ausgedünnt, ab
  // fest nie (die Nacht-Tinte bleibt unberührt).
  sichtbar(x: number, y: number): boolean {
    if (x < 0 || x >= this.B || y < 0 || y >= this.fest) return false;
    const s = this.saum[y];
    return s >= 64 || BAYER[y & 7][x & 7] < s;
  }

  // Effektpixel (Blitz, Druckkopf, Falz) ohne Ablenkung
  punkt(x: number, y: number, f: number): void {
    if (this.sichtbar(x, y)) this.aus[y * this.B + x] = f;
  }

  // Feste Teile (Druckkopf, Schiene) ohne Saum: nur die Naht oben und die Nacht-Tinte sind tabu
  hart(x: number, y: number, f: number): void {
    if (x >= 0 && x < this.B && y >= this.weiss && y < this.fest) this.aus[y * this.B + x] = f;
  }

  // Obere Naht: Die obersten weiss Zeilen gehören exakt dem Papier. Flugpixel und Effekte kommen dort ohnehin
  // nicht hin (sichtbar); das füllt auch, was das alte Bild selbst an Störung mitbrachte.
  nahtOben(): void {
    this.aus.fill(this.himmel, 0, this.B * this.weiss);
  }

  // Ursprung des Knopfs ins Bild geholt; ohne Knopf die Bildmitte
  mitte(e: FlugEingabe): { x: number; y: number } {
    const u = e.ursprung;
    const x = u ? u.x : this.B / 2;
    const y = u ? u.y : this.fest * 0.5;
    return {
      x: Math.round(Math.max(3, Math.min(this.B - 4, x))),
      y: Math.round(Math.max(3, Math.min(this.fest - 4, y))),
    };
  }
}

// Liegt der Knopf rechts? Meist ja (er sitzt dort im HUD bzw. unter dem Bild), darum gilt die Richtung vom
// Knopf nur in zwei von drei Fällen; sonst wird gewürfelt, damit wiederholtes Klicken nicht gleich aussieht.
function knopfRechts(e: FlugEingabe, B: number): boolean {
  if (e.ursprung && Math.random() < 0.65) return e.ursprung.x > B / 2;
  return Math.random() < 0.5;
}

// Das HUD in Szenenkoordinaten. Ohne Angabe (undefined) aus der Lage des Knopfs geschätzt: Sitzt er oben
// rechts im Bild, liegt er im HUD (bei 1440 px etwa 0,16·B links und 0,05·B rechts von ihm).
function hudSperre(e: FlugEingabe, B: number, fest: number): Sperre | null {
  if (e.sperre !== undefined) return e.sperre;
  const u = e.ursprung;
  if (!u || u.y < 0 || u.y > fest * 0.3 || u.x < B * 0.6 || u.x > B) return null;
  return { x0: u.x - B * 0.17, x1: u.x + B * 0.06, y0: 0, y1: u.y + Math.max(3, fest * 0.05) };
}

interface Ablauf {
  dauer: number; // ms
  // Ab diesem Anteil bewegt sich nichts mehr (alle gelandet, Effekte aus): Dann endet der Flug sofort, damit
  // das neue Bild nicht eingefroren dasteht, sondern das Leben übernimmt
  schluss: number;
  bild(t: number, b: Buehne): void; // malt den Zwischenstand bei t (Anteil der Dauer 0 … 1)
  vermerk?(t: number): string | null; // Druckvermerk für die Statuszeile, einmal je neuem Text
}

/* Wirbel ------------------------------------------------------------------
   Das alte Bild holt kurz gegen die Drehrichtung aus, wird zu einem Strudel in die Bildmitte gesogen und
   entfaltet sich als neues Bild von innen nach außen. Lage als Winkel und Abstand zur Bildmitte (Ellipse,
   Rand = 1), nach Tortenstück und Abstand sortiert: So finden Nachbarn benachbarte Ziele. */

function* wirbel(b: Buehne): Bau<Ablauf> {
  const { B, fest, n } = b;
  const mx = B / 2;
  const my = fest / 2;
  const winkelVon = (x: number, y: number) => Math.atan2((y - my) / my, (x - mx) / mx);
  const abstandVon = (x: number, y: number) => {
    const u = (x - mx) / mx;
    const v = (y - my) / my;
    return Math.sqrt(u * u + v * v);
  };
  const schluessel = (x: number, y: number) =>
    Math.floor((winkelVon(x, y) + Math.PI) * 10) * 1024 + Math.min(1023, Math.floor(abstandVon(x, y) * 700));
  yield* b.paaren(schluessel, schluessel);

  const EINZUG = 0.82; // so eng ballt sich der Strudel in der Mitte
  const FRUEH = 0.5; // Anteil der Dauer, nach dem die innersten Pixel landen
  const richtung = Math.random() < 0.5 ? 1 : -1;
  const winkel = vorrat("wirbel.winkel", Float32Array, n, false);
  const drehung = vorrat("wirbel.drehung", Float32Array, n, false);
  const abstand = vorrat("wirbel.abstand", Float32Array, n, false);
  const abstandZiel = vorrat("wirbel.abstandZiel", Float32Array, n, false);
  const umfaerben = vorrat("wirbel.umfaerben", Float32Array, n, false);
  // Zusammenhängende Schollen statt Einzelpixel-Zufall: Nachbarn drehen gleich schnell und färben gemeinsam um
  const nf = yield* flaeche("nf", B, fest, Math.max(6, B / 28));
  let weitester = 0;
  for (let i = 0; i < n; i++) {
    const vonW = winkelVon(b.qx[i], b.qy[i]);
    const nachW = winkelVon(b.zx[i], b.zy[i]);
    const nachA = abstandVon(b.zx[i], b.zy[i]);
    const weg = nachW - vonW - Math.round((nachW - vonW) / (2 * Math.PI)) * 2 * Math.PI;
    winkel[i] = vonW;
    drehung[i] = weg + richtung * 2 * Math.PI;
    abstand[i] = abstandVon(b.qx[i], b.qy[i]);
    abstandZiel[i] = nachA;
    if (nachA > weitester) weitester = nachA;
    if ((i & TAKT) === TAKT) yield;
  }
  weitester ||= 1;
  for (let i = 0; i < n; i++) {
    b.start[i] = 0;
    // Innen landet zuerst, so entfaltet sich das neue Bild aus der Mitte
    b.ende[i] = FRUEH + (LANDUNG - FRUEH) * (abstandZiel[i] / weitester) * (0.86 + nf[b.z[i]] * 0.12 + Math.random() * 0.02);
    umfaerben[i] = 0.38 + nf[b.q[i]] * 0.2 + Math.random() * 0.04;
  }
  yield* b.zeitenFestlegen();

  return {
    dauer: 2100,
    schluss: b.letzte,
    bild(t, b) {
      b.grundMalen(t);
      const { start, ende, fa, fn } = b;
      for (let i = 0; i < n; i++) {
        if (t < start[i] || t >= ende[i]) continue;
        const s = t / ende[i];
        const ew = ausholen(s);
        const er = einAus3(s);
        const w = winkel[i] + drehung[i] * ew;
        const r = (abstand[i] + (abstandZiel[i] - abstand[i]) * er) * (1 - EINZUG * sinus(Math.PI * er));
        b.setzen(i, mx + kosinus(w) * r * mx, my + sinus(w) * r * my, er < umfaerben[i] ? fa[i] : fn[i], klemm((1 - s) * 5));
      }
    },
  };
}

/* Urknall -----------------------------------------------------------------
   Das alte Bild atmet kurz ein und zittert, dann stürzt es Kette für Kette in einen Punkt am Knopf, der zu
   einem dunklen Kern verdichtet. Der Knall ist ein Lichtblitz: Das Papier blitzt kurz gelb auf, eine
   gerasterte Lichtkugel dehnt sich vom Punkt aus, innen Kopie-Gelb, außen ein rosa Saum und eine
   Tintenlinie als Druckwelle; sie verglimmt von innen nach außen. Bei Nacht leuchtet sie in Mondcreme mit
   gelbem Saum. Die neuen Pixel schießen als Funken mit Schweif in Strahlen hinaus, nahe zuerst. */

function* urknall(b: Buehne, e: FlugEingabe): Bau<Ablauf> {
  const { n, B, fest, weiss, dunkel } = b;
  // Knopf unter dem Bild: Der Punkt rückt so weit herauf, dass der Blitz noch Platz hat
  const P = b.mitte(e);
  const unten = Math.round(fest - Math.max(6, fest * 0.16));
  P.y = Math.max(Math.min(P.y, unten), Math.min(unten, weiss + 6));
  // Knopf im HUD: Der Höhepunkt soll nicht unter dem Fenster verpuffen. Der Punkt rückt links unter das
  // HUD, so weit, dass Kern, Funkelkreuz und dessen Diagonalen ganz frei liegen.
  const arm = Math.round(2 + Math.min(B, fest) * 0.26);
  const sperre = hudSperre(e, B, fest);
  if (sperre) {
    const abstand = Math.round(arm * 0.45) + 4;
    if (P.x > sperre.x0 - abstand && P.x < sperre.x1 + abstand && P.y > sperre.y0 - abstand && P.y < sperre.y1 + abstand) {
      P.x = Math.round(Math.max(3, Math.min(B - 4, sperre.x0 - abstand)));
      P.y = Math.round(Math.max(3, Math.min(unten, sperre.y1 + abstand)));
    }
  }
  const winkelSchluessel = (x: number, y: number, dreh: number) => {
    const dx = x - P.x;
    const dy = y - P.y;
    let w = Math.atan2(dy, dx) + dreh;
    if (w < 0) w += 2 * Math.PI;
    if (w >= 2 * Math.PI) w -= 2 * Math.PI;
    return Math.floor(w * 4000) * 4096 + Math.min(4095, Math.floor(Math.sqrt(dx * dx + dy * dy) * 8));
  };
  yield* b.paaren(
    (x, y) => winkelSchluessel(x, y, 0),
    (x, y) => winkelSchluessel(x, y, Math.PI),
  );

  const BLITZ = 0.42;
  const WELLE = 0.3; // so lange läuft die Lichtkugel
  const AUFBLITZ = 0.045; // so lange blitzt das ganze Papier auf (Anteil der Welle, gut zwei Bilder)
  let weitQ = 1;
  let weitZ = 1;
  // Helligkeit der alten Farbe, 0 … 1: Ketten haben je einen Ton, so stürzt das Bild Kette für Kette
  let hMin = 255;
  let hMax = 0;
  const hell = vorrat("urknall.hell", Float32Array, n, false);
  for (let i = 0; i < n; i++) {
    const qx = b.qx[i] - P.x;
    const qy = b.qy[i] - P.y;
    const zx = b.zx[i] - P.x;
    const zy = b.zy[i] - P.y;
    weitQ = Math.max(weitQ, qx * qx + qy * qy);
    weitZ = Math.max(weitZ, zx * zx + zy * zy);
    const h = helligkeit(b.fa[i]);
    hell[i] = h;
    if (h < hMin) hMin = h;
    if (h > hMax) hMax = h;
  }
  weitQ = Math.sqrt(weitQ);
  weitZ = Math.sqrt(weitZ);
  const nf = yield* flaeche("nf", B, fest, Math.max(6, B / 26));
  // Strahlen: je Richtung eine eigene Geschwindigkeit, die Front der Funken wird ein Stern
  const STRAHLEN = 256;
  const strahl = rauschen(STRAHLEN, 2);
  const sog = vorrat("urknall.sog", Float32Array, n, false); // Beginn des Sturzes
  const ankunft = vorrat("urknall.ankunft", Float32Array, n, false); // im Punkt
  const knall = vorrat("urknall.knall", Float32Array, n, false); // Beginn der Explosion
  const kx = vorrat("urknall.kx", Float32Array, n, false); // Kontrollpunkt der Flugkurve
  const ky = vorrat("urknall.ky", Float32Array, n, false);
  const zittern = vorrat("urknall.zittern", Uint8Array, n, false);
  const drall = (Math.random() < 0.5 ? 1 : -1) * 0.9;
  const hSpanne = 1 / Math.max(1, hMax - hMin);
  for (let i = 0; i < n; i++) {
    const ax = b.qx[i] - P.x;
    const ay = b.qy[i] - P.y;
    const vx = b.zx[i] - P.x;
    const vy = b.zy[i] - P.y;
    const dq = Math.sqrt(ax * ax + ay * ay) / weitQ;
    const dz = Math.sqrt(vx * vx + vy * vy) / weitZ;
    const h = (hell[i] - hMin) * hSpanne;
    // Helle, ferne Ketten zuerst, Nahes vor Fernem, dazu Schollen; der Einzelpixel-Zufall nur als feine Kante
    sog[i] = 0.06 + 0.035 * (1 - dq) + 0.035 * (1 - h) + 0.03 * nf[b.q[i]] + Math.random() * 0.006;
    ankunft[i] = 0.25 + 0.16 * Math.pow(dq, 0.8) + Math.random() * 0.012;
    // Bis zum Sturz liegt das Pixel im alten Bild; das Einatmen malt darüber, Lücken bleiben so gefüllt
    b.start[i] = sog[i];
    const w = Math.atan2(vy, vx);
    // Starke Richtungen zünden zuerst und fliegen am schnellsten: Der erste Ausbruch ist ein Stern aus
    // Strahlen, die schwachen Richtungen füllen erst danach auf
    const st = klemm((strahl[Math.floor(((w + Math.PI) / (2 * Math.PI)) * STRAHLEN) & (STRAHLEN - 1)] - 0.3) / 0.45);
    knall[i] = BLITZ + 0.01 + 0.075 * (1 - st) * (1 - st) + Math.random() * 0.006;
    b.ende[i] = knall[i] + 0.12 + 0.36 * Math.pow(dz, 0.8) * (0.6 + 0.55 * (1 - st)) + Math.random() * 0.015;
    const quer = (Math.random() - 0.5) * 0.4;
    kx[i] = P.x + vx * 0.55 - vy * quer;
    ky[i] = P.y + vy * 0.55 + vx * quer;
    zittern[i] = Math.random() < 0.3 ? 1 : 0;
    if ((i & TAKT) === TAKT) yield;
  }
  yield* b.zeitenFestlegen();

  const reichweite = Math.max(B, fest) * 0.85;
  // Lichtkugel: bei Tag Kopie-Gelb auf dem Papier mit rosa Saum, bei Nacht Mondcreme mit gelbem Saum
  // (nachts nur eine schmale gelbe Kante: breit gerastert mischte sich Gelb mit dem Nachthimmel zu Oliv)
  const licht = dunkel ? MONDCREME : GELB;
  const lichtSaum = dunkel ? GELB : ROSA;
  // Das Aufblitzen des ganzen Papiers: nachts gedämpft, das Auge ist dort auf Dunkel eingestellt
  const blitzStaerke = dunkel ? 0.25 : 0.42;
  // Funkenkopf und Schweif
  const heiss = dunkel ? GLANZ : GELB;
  const schweif1 = GELB;
  const schweif2 = dunkel ? mischen(GELB, b.himmel, 0.5) : ROSA;
  // Glühender Kern: innen Papierweiß bzw. Glanz, dann Gelb, außen Rosa
  const glutInnen = dunkel ? GLANZ : farbe(255, 255, 255);
  const glutAussen = dunkel ? mischen(GELB, b.himmel, 0.35) : ROSA;
  // Ring und Kreuz: auf dunklem Grund Gelb, auf Papier Tinte (der Ring bleibt so auch bei Tag sichtbar)
  const lichtAuf = (p: number, aufDunkel: number) => (!dunkel && helligkeit(b.aus[p]) > 150 ? TINTE : aufDunkel);

  return {
    dauer: 2300,
    schluss: Math.max(b.letzte, BLITZ + WELLE),
    bild(t, b) {
      b.grundMalen(t);
      const { qx, qy, zx, zy, fa, fn, ende, aus, saum } = b;

      // Lichtkugel: dehnt sich schnell aus (aus3), innen verglimmt sie zuerst, die Front leuchtet am
      // längsten. Bayer-gerastert, das Raster wandert leicht, damit es flimmert statt zu stehen.
      const fw = (t - BLITZ) / WELLE;
      const rb = fw > 0 ? aus3(klemm(fw)) * reichweite : 0;
      if (fw >= 0 && fw < 0.62) {
        // Außen verglimmt die Kugel, bevor sie als stehendes Punktraster über dem neuen Bild liegen bliebe
        const kraft = (1 - fw) ** 1.2 * klemm((0.62 - fw) / 0.3);
        const saumBreite = dunkel ? 1.5 : Math.max(2, rb * 0.12);
        const blitz = fw < AUFBLITZ ? 1 - fw / AUFBLITZ : 0;
        const schub = Math.floor(t * 40) & 7;
        const rb2 = rb * rb;
        const kehr2 = 1 / Math.max(1, rb2);
        // Ab hier (Abstand²) beginnt der Saum; ohne Wurzel je Pixel
        const saum2 = Math.max(0, rb - saumBreite) ** 2;
        // Dichte über q = (Abstand / Radius)²: innen dünn, zur Front hin voll
        const innen = dunkel ? 0 : 64 * kraft * 0.18;
        const front = dunkel ? 64 * kraft * kraft * 0.45 : 64 * kraft;
        const blitzDichte = 64 * blitzStaerke * blitz;
        const hoechst = Math.max(innen + front, blitzDichte);
        for (let y = weiss; y < fest; y++) {
          const reihe = BAYER[(y + schub * 3) & 7];
          const s = Math.min(saum[y], hoechst);
          const dy = y - P.y;
          const dy2 = dy * dy;
          let xa = 0;
          let xb = -1;
          // Ganz kurz das ganze Papier: der Blitz selbst
          if (blitz > 0) {
            xa = 0;
            xb = B - 1;
          } else if (dy2 < rb2) {
            const halb = Math.sqrt(rb2 - dy2);
            xa = Math.max(0, Math.ceil(P.x - halb));
            xb = Math.min(B - 1, Math.floor(P.x + halb));
          }
          for (let x = xa, p = y * B + xa; x <= xb; x++, p++) {
            const schwelle = reihe[(x + schub) & 7];
            if (schwelle >= s) continue; // hier deckt die Kugel nirgends
            const dx = x - P.x;
            const d2 = dx * dx + dy2;
            let dichte = blitzDichte;
            let f = licht;
            if (d2 < rb2) {
              const q = d2 * kehr2;
              const kugel = innen + front * q * (0.35 + 0.65 * q);
              if (kugel > dichte) dichte = kugel;
              if (d2 > saum2) f = lichtSaum;
            }
            if (schwelle < dichte) aus[p] = f;
          }
        }
      }

      const takt = Math.floor(t * 60) & 1; // Zittern im Takt, nicht je Bild zufällig
      for (let i = 0; i < n; i++) {
        if (t >= ende[i]) continue;
        const ax = qx[i] - P.x;
        const ay = qy[i] - P.y;
        if (t < sog[i]) {
          // Einatmen: leicht vom Punkt weg, dazu ein Zittern, das zum Sturz hin stärker wird
          const s = t / sog[i];
          const atem = 0.035 * sinus(Math.PI * s);
          const z = zittern[i] && s > 0.45 && takt ? 1 : 0;
          b.setzen(i, qx[i] + ax * atem + z, qy[i] + ay * atem, fa[i], 1);
        } else if (t < knall[i]) {
          // Sturz: beschleunigt (ein³) und mit Drall in den Punkt
          const s = klemm((t - sog[i]) / (ankunft[i] - sog[i]));
          if (s >= 1) continue; // im Kern
          const k = 1 - ein3(s);
          const w = drall * ein2(s);
          const c = kosinus(w);
          const sn = sinus(w);
          b.setzen(i, P.x + (ax * c - ay * sn) * k, P.y + (ax * sn + ay * c) * k, fa[i], 1 - s);
        } else {
          // Explosion auf einer Bézierkurve, schnell hinaus, weich hinein. Nur ganz kurz weißglühend, dazu ein
          // Schweif entgegen der Flugrichtung: So entstehen Strahlen statt eines Flecks.
          const s = (t - knall[i]) / (ende[i] - knall[i]);
          const u = aus4(s);
          const v = 1 - u;
          const x = v * v * P.x + 2 * v * u * kx[i] + u * u * zx[i];
          const y = v * v * P.y + 2 * v * u * ky[i] + u * u * zy[i];
          const frei = klemm((1 - s) * 4);
          b.setzen(i, x, y, s < 0.05 ? heiss : fn[i], frei);
          // Schweif nur an jedem zweiten Funken: Die Strahlen bleiben dicht genug, der Schritt unter 6 ms
          if (s < 0.3 && (i & 1) === 0) {
            const u2 = aus4(Math.max(0, s - 0.05));
            const v2 = 1 - u2;
            let dx = x - (v2 * v2 * P.x + 2 * v2 * u2 * kx[i] + u2 * u2 * zx[i]);
            let dy = y - (v2 * v2 * P.y + 2 * v2 * u2 * ky[i] + u2 * u2 * zy[i]);
            const l = Math.abs(dx) + Math.abs(dy);
            if (l > 1.2) {
              const k = Math.min(3, l) / l;
              dx *= k;
              dy *= k;
              b.spur(i, x, y, dx, dy, schweif1, s < 0.16 ? schweif2 : fn[i], frei);
            }
          }
        }
      }

      // Der Punkt verdichtet sich: dunkler Kern, der wächst und am Rand glimmt
      if (t > 0.2 && t < BLITZ + 0.015) {
        const rk = 0.6 + 2.8 * ein2(klemm((t - 0.2) / (BLITZ - 0.2)));
        const glimmt = Math.floor(t * 90) % 2 === 0;
        for (let dy = -4; dy <= 4; dy++) {
          for (let dx = -4; dx <= 4; dx++) {
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d <= rk) b.hart(P.x + dx, P.y + dy, d > rk - 1 && glimmt ? GELB : b.grund);
          }
        }
      }
      if (fw < 0 || fw >= 1) return;

      // Glut: ein kleiner Kern mit radialem Abfall, der schnell verglimmt (kein flaches Punktgitter)
      const gf = (t - BLITZ) / 0.2;
      if (gf < 1) {
        const rg = Math.max(4, arm * 0.75) * (0.55 + 0.45 * aus2(klemm(gf / 0.25)));
        const staerke = 64 * 1.6 * (1 - gf) ** 1.3;
        const schub = Math.floor(t * 40) & 7; // das Raster flimmert, statt zu stehen
        const y0 = Math.max(weiss, Math.floor(P.y - rg));
        const y1 = Math.min(fest - 1, Math.ceil(P.y + rg));
        for (let y = y0; y <= y1; y++) {
          const reihe = BAYER[(y + schub * 3) & 7];
          for (let x = Math.max(0, Math.floor(P.x - rg)); x <= Math.min(B - 1, Math.ceil(P.x + rg)); x++) {
            const d = Math.sqrt((x - P.x) * (x - P.x) + (y - P.y) * (y - P.y)) / rg;
            if (d >= 1) continue;
            const dichte = staerke * (1 - d) * (1 - d);
            if (reihe[(x + schub) & 7] >= dichte || !b.sichtbar(x, y)) continue;
            aus[y * B + x] = d < 0.3 ? glutInnen : d < 0.62 ? GELB : glutAussen;
          }
        }
      }

      // Funkelkreuz: lange Arme in Gelb, kurze Diagonalen, Kern weiß glühend
      if (fw < 0.5) {
        const lang = Math.round(2 + (arm - 2) * Math.sin((Math.PI * fw) / 0.5));
        for (let k = -lang; k <= lang; k++) {
          const a = Math.abs(k);
          if (a < lang * 0.85 || a % 2 === 0) {
            for (let achse = 0; achse < 2; achse++) {
              const x = achse ? P.x : P.x + k;
              const y = achse ? P.y + k : P.y;
              if (!b.sichtbar(x, y)) continue;
              const p = y * B + x;
              aus[p] = a < 2 ? glutInnen : lichtAuf(p, a % 2 ? heiss : GELB);
            }
          }
          if (a <= lang / 3) {
            b.punkt(P.x + k, P.y + k, GELB);
            b.punkt(P.x + k, P.y - k, GELB);
          }
        }
      }

      // Druckwelle: eine Linie knapp außerhalb der Lichtkugel, die nach außen ausdünnt; auf dem Papier Tinte
      const dicke = 1.5 + 2.5 * (1 - fw);
      const d0 = 64 * (1 - fw) ** 1.4;
      const dichte = d0 < 4 ? 0 : d0; // darunter bliebe nur ein stehendes Punktgitter
      if (dichte <= 0) return;
      const r = rb + dicke;
      const schub = Math.floor(t * 40) & 7;
      const y0 = Math.max(weiss, Math.floor(P.y - r));
      const y1 = Math.min(fest - 1, Math.ceil(P.y + r));
      for (let y = y0; y <= y1; y++) {
        const dy = y - P.y;
        const aussen = Math.sqrt(Math.max(0, r * r - dy * dy));
        const drin = Math.sqrt(Math.max(0, rb * rb - dy * dy));
        const reihe = BAYER[(y + schub * 3) & 7];
        const s = Math.min(dichte, saum[y]);
        // links und rechts je ein Bogenstück
        const la = Math.max(0, Math.round(P.x - aussen));
        const lb = Math.min(B - 1, Math.round(P.x - drin));
        for (let x = la; x <= lb; x++) if (reihe[(x + schub) & 7] < s) aus[y * B + x] = lichtAuf(y * B + x, GELB);
        const ra = Math.max(Math.max(0, lb + 1), Math.round(P.x + drin));
        const rr = Math.min(B - 1, Math.round(P.x + aussen));
        for (let x = ra; x <= rr; x++) if (reihe[(x + schub) & 7] < s) aus[y * B + x] = lichtAuf(y * B + x, GELB);
      }
    },
  };
}

/* Sandsturm ---------------------------------------------------------------
   Eine Böenfront fegt quer über das Bild. Vorab heben sich einzelne Körner, dann reißt der Wind das alte
   Bild zeilenweise versetzt davon. Was hinten hinausweht, kommt auf der Luvseite als neues Bild wieder
   herein, bremst ab und setzt sich, die Front läuft in dieselbe Richtung. */

function* sandsturm(b: Buehne, e: FlugEingabe): Bau<Ablauf> {
  const { n, B, fest } = b;
  // Der Wind bläst meist vom Knopf weg
  const richtung = knopfRechts(e, B) ? -1 : 1;
  const luv = (x: number) => (richtung > 0 ? x : B - 1 - x);
  yield* b.paaren(
    (x, y) => y * 1024 + luv(x),
    (x, y) => y * 1024 + luv(x),
  );
  const boeAus = rauschen(fest, 3);
  const boeEin = rauschen(fest, 4);
  const phase = vorrat("sand.phase", Float32Array, n, false);
  const weit = vorrat("sand.weit", Float32Array, n, false);
  const hub = vorrat("sand.hub", Float32Array, n, false);
  const flug1 = vorrat("sand.flug1", Float32Array, n, false);
  const flug2 = vorrat("sand.flug2", Float32Array, n, false);
  const anflug = vorrat("sand.anflug", Float32Array, n, false);
  // Der Wind reißt Fetzen entlang von Rauschkonturen ab; ein Fetzen fliegt als Ganzes (Weite, Hub, Welle)
  const nf = yield* flaeche("nf", B, fest, Math.max(6, B / 24));
  const nf2 = yield* flaeche("nf2", B, fest, Math.max(5, B / 40));
  for (let i = 0; i < n; i++) {
    const xa = luv(b.qx[i]);
    const xz = luv(b.zx[i]);
    const r = nf[b.q[i]];
    const r2 = nf2[b.q[i]];
    let s = 0.05 + 0.27 * (xa / B) + 0.07 * boeAus[b.qy[i]] + 0.08 * r + Math.random() * 0.01;
    if (Math.random() < 0.015) s = Math.max(0, s - 0.14); // einzelne Körner heben früh ab: die Vorahnung
    b.start[i] = s;
    flug1[i] = 0.17 + 0.05 * r2 + Math.random() * 0.015;
    weit[i] = B - xa + 6 + B * 0.3 * (0.75 * r2 + 0.25 * Math.random());
    hub[i] = 2 + 6 * r + Math.random();
    phase[i] = r2 * 12.566 + Math.random() * 0.6;
    const rz = nf[b.z[i]];
    b.ende[i] = 0.45 + 0.37 * (xz / B) + 0.06 * boeEin[b.zy[i]] + 0.05 * rz + Math.random() * 0.012;
    flug2[i] = 0.2 + 0.05 * nf2[b.z[i]] + Math.random() * 0.015;
    anflug[i] = xz + 8 + B * 0.25 * (0.75 * rz + 0.25 * Math.random());
    if ((i & TAKT) === TAKT) yield;
  }
  yield* b.zeitenFestlegen();

  return {
    dauer: 2300,
    schluss: b.letzte,
    bild(t, b) {
      b.grundMalen(t);
      const { qx, qy, zx, zy, fa, fn, start, ende } = b;
      // Böe: Die Strömung pulsiert, das gibt der Bewegung das Stoßweise
      const boe = 1 + 0.12 * Math.sin(t * 31);
      for (let i = 0; i < n; i++) {
        if (t >= ende[i]) continue;
        const beginn2 = ende[i] - flug2[i];
        if (t < beginn2) {
          if (t < start[i]) continue;
          const s = (t - start[i]) / flug1[i];
          if (s >= 1) {
            b.ruhen(i); // ausgeweht, unterwegs zur anderen Seite
            continue;
          }
          const weg = weit[i] * ein2(s) * boe;
          const welle = sinus(phase[i] + weg * 0.09 + t * 9) * (1.5 + 3 * s);
          b.setzen(i, qx[i] + richtung * weg, qy[i] - hub[i] * aus2(s) + welle, fa[i], 1);
        } else {
          const s = (t - beginn2) / flug2[i];
          const rest = 1 - aus3(s);
          const welle = sinus(phase[i] + rest * 7 + t * 8) * 3.5 * rest * rest;
          b.setzen(i, zx[i] - richtung * anflug[i] * rest, zy[i] - hub[i] * 0.6 * rest + welle, fn[i], klemm((1 - s) * 4));
        }
      }
    },
  };
}

/* Schwerkraft -------------------------------------------------------------
   Das Bild bebt, dann sackt es von unten her in sich zusammen. Die Pixel fallen mit Erdbeschleunigung und
   rutschen zu einem Sandhügel über der Nacht-Tinte (dichter gepackt als das Bild). Dann trägt eine Fontäne
   die Körner von der Hügelkuppe aus wieder hoch, jedes genau bis zum Scheitelpunkt seines neuen Platzes. */

function* schwerkraft(b: Buehne): Bau<Ablauf> {
  const { n, B, fest } = b;
  const DAUER = 2500;
  // Unten fällt zuerst und liegt zuunterst: Der Hügel zeigt die Zeilen des alten Bilds als Schichten
  b.quellenVerteilen(yield* b.ordnen(b.quellen, (x, y) => (1023 - y) * 1024 + x, "ordnungQ"));
  yield;

  // Hügelform: breite Glocke um den Schwerpunkt, dazu ein Rest der alten Massenverteilung
  const masse = new Float32Array(B);
  let schwer = 0;
  for (let i = 0; i < n; i++) {
    masse[b.qx[i]]++;
    schwer += b.qx[i];
  }
  schwer /= n || 1;
  const glatt = rauschenGlaetten(masse, Math.max(3, Math.round(B / 14)));
  let glattMax = 0;
  for (const v of glatt) glattMax = Math.max(glattMax, v);
  const sigma = B * 0.24;
  const form = new Float32Array(B);
  let formMax = 0;
  let formSumme = 0;
  for (let x = 0; x < B; x++) {
    form[x] = Math.exp(-(((x - schwer) / sigma) ** 2) / 2) + (0.35 * glatt[x]) / (glattMax || 1);
    formMax = Math.max(formMax, form[x]);
  }
  for (const v of form) formSumme += v;
  // Höchstens 40 % der Bildhöhe; was nicht passt, packt sich dichter (mehrere Körner je Platz)
  const kuppe = fest * 0.4;
  const volumen = Math.min(n / 1.4, (formSumme / formMax) * kuppe);
  const hoehe = new Int32Array(B);
  let plaetze = 0;
  for (let x = 0; x < B; x++) {
    hoehe[x] = Math.min(fest - 1, Math.round((form[x] / formSumme) * volumen));
    plaetze += hoehe[x];
  }
  plaetze ||= 1;
  if (!hoehe.some((h) => h > 0)) hoehe[Math.round(schwer)] = 1;
  const platzX = vorrat("schwer.platzX", Int16Array, plaetze);
  const platzY = vorrat("schwer.platzY", Int16Array, plaetze);
  const platzTiefe = vorrat("schwer.platzTiefe", Int16Array, plaetze);
  let k = 0;
  let hoechste = 0;
  for (const h of hoehe) hoechste = Math.max(hoechste, h);
  for (let h = 0; h < hoechste; h++) {
    for (let x = 0; x < B; x++) {
      if (hoehe[x] <= h) continue;
      platzX[k] = x;
      platzY[k] = fest - 1 - h;
      platzTiefe[k] = hoehe[x] - 1 - h; // 0 = Oberfläche
      k++;
    }
  }
  yield;

  const hx = vorrat("schwer.hx", Int16Array, n, false);
  const hy = vorrat("schwer.hy", Int16Array, n, false);
  const fall = vorrat("schwer.fall", Float32Array, n, false);
  const wurf = vorrat("schwer.wurf", Float32Array, n, false);
  const abschuss = vorrat("schwer.abschuss", Uint32Array, n, false);
  // Das Bild bricht in Schollen: dunkle, vordere Ketten zuerst, dazu ein geglättetes Rauschen
  const nf = yield* flaeche("nf", B, fest, Math.max(6, B / 26));
  let hMin = 255;
  let hMax = 0;
  for (let i = 0; i < n; i++) {
    const h = helligkeit(b.fa[i]);
    if (h < hMin) hMin = h;
    if (h > hMax) hMax = h;
  }
  for (let i = 0; i < n; i++) {
    const p = Math.min(plaetze - 1, Math.floor((i * plaetze) / n));
    hx[i] = platzX[p];
    hy[i] = platzY[p];
    // Unten gibt das Bild zuerst nach, oben folgt es
    const hell = (helligkeit(b.fa[i]) - hMin) / Math.max(1, hMax - hMin);
    b.start[i] = 0.11 + 0.06 * (1 - b.qy[i] / fest) + 0.035 * hell + 0.045 * nf[b.q[i]] + Math.random() * 0.006;
    fall[i] = 0.06 + 0.17 * Math.sqrt(Math.max(0, hy[i] - b.qy[i]) / fest);
    abschuss[i] = (platzTiefe[p] + Math.floor(Math.random() * 3)) * 1024 + platzX[p];
    if ((i & TAKT) === TAKT) yield;
  }
  // Die Oberfläche fliegt zuerst ab und trägt die obersten Ziele, links nach links, rechts nach rechts
  const reihe = yield* rangfolge(abschuss, "schwer.reihe");
  b.zieleVerteilen(yield* b.ordnen(b.ziele, (x, y) => y * 1024 + x, "ordnungZ"), reihe);
  yield;
  for (let r = 0; r < n; r++) {
    const i = reihe[r];
    wurf[i] = 0.47 + 0.26 * (r / n) + Math.random() * 0.015;
    const d = Math.abs(hy[i] - b.zy[i]);
    b.ende[i] = wurf[i] + 0.07 + 0.15 * Math.sqrt(d / fest);
  }
  yield* b.zeitenFestlegen();

  return {
    dauer: DAUER,
    schluss: b.letzte,
    bild(t, b) {
      // Beben: das alte Bild zittert waagrecht, erst sacht (jeder zweite Takt), dann heftiger
      const ms = t * DAUER;
      const beben = t < 0.13 ? (Math.floor(ms / 45) % 2 ? 1 : -1) * (t > 0.06 ? 1 : Math.floor(ms / 90) % 2) : 0;
      b.grundMalen(t, beben);
      const { qx, qy, zx, zy, fa, fn, start, ende } = b;
      for (let i = 0; i < n; i++) {
        if (t < start[i] || t >= ende[i]) continue;
        if (t < wurf[i]) {
          const s = klemm((t - start[i]) / fall[i]);
          b.setzen(i, qx[i] + (hx[i] - qx[i]) * einAus3(s), qy[i] + (hy[i] - qy[i]) * ein2(s), fa[i], 1);
        } else {
          const s = (t - wurf[i]) / (ende[i] - wurf[i]);
          const y = zy[i] < hy[i] ? zy[i] + (hy[i] - zy[i]) * (1 - s) * (1 - s) : hy[i] + (zy[i] - hy[i]) * s * s;
          b.setzen(i, hx[i] + (zx[i] - hx[i]) * s, y, fn[i], klemm((1 - s) * 4));
        }
      }
    },
  };
}

// Gleitender Mittelwert mit Randausgleich (am Rand zählt nur, was im Bild liegt), dreimal: fast eine Glocke
function glaetten(werte: Float32Array, radius: number): Float32Array {
  let a = werte;
  const n = werte.length;
  for (let durchgang = 0; durchgang < 3; durchgang++) {
    const b = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let summe = 0;
      const lo = Math.max(0, i - radius);
      const hi = Math.min(n - 1, i + radius);
      for (let k = lo; k <= hi; k++) summe += a[k];
      b[i] = summe / (hi - lo + 1);
    }
    a = b;
  }
  return a;
}

function rauschenGlaetten(werte: Float32Array, radius: number): Float32Array {
  let a = werte;
  for (let durchgang = 0; durchgang < 3; durchgang++) {
    const b = new Float32Array(a.length);
    let summe = 0;
    for (let i = -radius; i < a.length + radius; i++) {
      const rein = i + radius;
      const raus = i - radius - 1;
      if (rein >= 0 && rein < a.length) summe += a[rein];
      if (raus >= 0 && raus < a.length) summe -= a[raus];
      if (i >= 0 && i < a.length) b[i] = summe / (2 * radius + 1);
    }
    a = b;
  }
  return a;
}

/* Farbsortierung ----------------------------------------------------------
   Sortieren wie in einer Visualisierung von Sortierverfahren: Erst sortiert sich jede Spalte nach
   Helligkeit (dunkel unten, ein Balkendiagramm). Dann gleiten die Pixel Farbe für Farbe, dunkel zuerst, in
   die Felder eines Druckkontrollstreifens über der Nacht-Tinte: je Farbe ein gleich breites Feld, oben
   Vollton, unten Rasterton, 1 px Papier dazwischen. Eine gelbe Abtastzeile fährt über den Streifen und
   druckt ihn mit der Palette des neuen Bildes neu. Dann läuft alles rückwärts: Felder, Säulen, Bild. */

function* farbsortierung(b: Buehne, e: FlugEingabe): Bau<Ablauf> {
  const { n, B, fest, weiss } = b;
  // Töne nach Helligkeit und je Pixel sein Rang darin. Nachbarpixel haben meist dieselbe Farbe, darum
  // wird die Tabelle nur beim Farbwechsel befragt.
  // Fast gleich helle Töne (nachts etwa zehn Violettgrau-Stufen) teilen sich ein Feld, sonst wird der
  // Streifen matschig; das Feld zeigt den häufigsten Ton seiner Gruppe.
  const raenge = (liste: Uint32Array, bild: Int32Array, name: string) => {
    const menge = new Map<number, number>();
    let letzt = 0;
    let lauf = 0;
    for (let r = 0; r < liste.length; r++) {
      const v = bild[liste[r]];
      if (lauf > 0 && v === letzt) {
        lauf++;
        continue;
      }
      if (lauf > 0) menge.set(letzt, (menge.get(letzt) ?? 0) + lauf);
      letzt = v;
      lauf = 1;
    }
    if (lauf > 0) menge.set(letzt, (menge.get(letzt) ?? 0) + lauf);
    const sortiert = [...menge.keys()].sort((u, v) => helligkeit(u) - helligkeit(v));
    const tafel = new Map<number, number>();
    const toene: number[] = [];
    let gruppeHell = -Infinity;
    let besteZahl = 0;
    for (const v of sortiert) {
      const h = helligkeit(v);
      if (h - gruppeHell >= 6) {
        gruppeHell = h;
        toene.push(v);
        besteZahl = 0;
      }
      const k = toene.length - 1;
      tafel.set(v, k);
      const zahl = menge.get(v) ?? 0;
      if (zahl > besteZahl) {
        besteZahl = zahl;
        toene[k] = v;
      }
    }
    // Nur die Plätze der Liste werden gelesen, darum muss das Feld nicht geleert werden
    const rang = vorrat(name, Uint8Array, bild.length, false);
    let rl = 0;
    for (let r = 0; r < liste.length; r++) {
      const p = liste[r];
      const v = bild[p];
      if (r === 0 || v !== letzt) rl = tafel.get((letzt = v)) ?? 0;
      rang[p] = rl;
    }
    return { toene, rang, anzahl: toene.length };
  };
  const alt = raenge(b.quellen, b.alt, "farb.rangA");
  yield;
  const neu = raenge(b.ziele, b.neu, "farb.rangN");
  yield;
  // Für den Druckvermerk dieselbe Zahl wie die Bühne nach der Landung (siehe FlugEingabe.farbZahl)
  let farbZahl = e.farbZahl ?? null;
  if (farbZahl === null && !b.dunkel) {
    const rolle = new Uint8Array(256);
    const nummern = e.neu.farbe;
    for (let p = 0; p < b.B * b.H; p++) rolle[nummern[p]] = 1;
    const alleFarben = new Set<number>();
    rolle.forEach((da, f) => da && alleFarben.add(e.neu.tabelle[f] >>> 0));
    farbZahl = alleFarben.size;
  }
  // Nach Farbe, innerhalb einer Farbe untere Zeilen zuerst, dann von links nach rechts. Zählsortierung statt
  // Vergleichen: Die Liste ist schon nach Pixelindex geordnet, also genügt es, die Zeilen von unten her in
  // die Fächer der Farben zu verteilen.
  const ordnungNachRang = (liste: Uint32Array, rang: Uint8Array, K: number, name: string) => {
    const fach = new Int32Array(K + 1);
    for (let r = 0; r < liste.length; r++) fach[rang[liste[r]] + 1]++;
    for (let k = 0; k < K; k++) fach[k + 1] += fach[k];
    const ordnung = vorrat(name, Uint32Array, liste.length, false);
    let ende = liste.length;
    while (ende > 0) {
      const zeile = (liste[ende - 1] / B) | 0;
      let anfang = ende - 1;
      while (anfang > 0 && ((liste[anfang - 1] / B) | 0) === zeile) anfang--;
      for (let r = anfang; r < ende; r++) ordnung[fach[rang[liste[r]]]++] = r;
      ende = anfang;
    }
    return ordnung;
  };
  b.quellenVerteilen(ordnungNachRang(b.quellen, alt.rang, alt.anzahl, "ordnungQ"));
  yield;
  b.zieleVerteilen(ordnungNachRang(b.ziele, neu.rang, neu.anzahl, "ordnungZ"));
  yield;
  // Säulen: je Spalte nach Helligkeit gestapelt, von unten. Die Teilchen liegen schon nach Farbe und Zeile
  // sortiert vor (Quelle und Ziel), ein Zähler je Spalte genügt. Zu volle Spalten stauchen sich, damit sie
  // unter der oberen Naht bleiben.
  const platz = Math.max(1, fest - weiss - 1);
  const saeulen = (xs: Int16Array, name: string) => {
    const zahl = new Int32Array(B);
    for (let i = 0; i < n; i++) zahl[xs[i]]++;
    const hoehe = new Int32Array(B);
    const sy = vorrat(name, Int16Array, n, false);
    for (let i = 0; i < n; i++) {
      const x = xs[i];
      const h = hoehe[x]++;
      sy[i] = fest - 1 - (zahl[x] > platz ? Math.floor((h * platz) / zahl[x]) : h);
    }
    return sy;
  };
  const saeuleAlt = saeulen(b.qx, "farb.saeuleAlt");
  const saeuleNeu = saeulen(b.zx, "farb.saeuleNeu");
  yield;

  // Kontrollstreifen: K gleich breite Felder, mittig, 2 Zeilen Papier über der Nacht-Tinte
  const feldHoehe = Math.max(4, Math.round((fest - weiss) * 0.24));
  const feldOben = fest - 2 - feldHoehe;
  const vollBis = feldOben + Math.round(feldHoehe * 0.62); // darunter der Rasterton
  const streifen = (K: number) => {
    const rand = Math.max(2, Math.round(B * 0.04));
    const spalt = (B - 2 * rand) / Math.max(1, K) >= 3 ? 1 : 0;
    const breite = Math.max(1, Math.floor((B - 2 * rand - (K - 1) * spalt) / Math.max(1, K)));
    const links = Math.max(0, Math.round((B - (K * breite + (K - 1) * spalt)) / 2));
    // Feld je Spalte (−1 = Papier)
    const feld = new Int16Array(B).fill(-1);
    for (let k = 0; k < K; k++) for (let c = 0; c < breite; c++) {
      const x = links + k * (breite + spalt) + c;
      if (x < B) feld[x] = k;
    }
    return { breite, links, spalt, feld };
  };
  const SA = streifen(alt.anzahl);
  const SN = streifen(neu.anzahl);
  const ka = vorrat("farb.ka", Int16Array, n, false); // Feld im alten, im neuen Streifen
  const kn = vorrat("farb.kn", Int16Array, n, false);
  const sx = vorrat("farb.sx", Int16Array, n, false); // Platz im alten Feld
  const sy = vorrat("farb.sy", Int16Array, n, false);
  const tx = vorrat("farb.tx", Int16Array, n, false); // Platz im neuen Feld
  const ty = vorrat("farb.ty", Int16Array, n, false);
  const gesamtA = new Int32Array(alt.anzahl);
  const gesamtN = new Int32Array(neu.anzahl);
  // Platz des j-ten Teilchens einer Farbe in ihrem Feld, zeilenweise von unten; volle Felder stapeln doppelt
  const flaecheA = SA.breite * feldHoehe;
  const flaecheN = SN.breite * feldHoehe;

  // Ankunft im Feld k (frühestens) und Aufbruch aus ihm; die Zufallsstreuung ist gleichverteilt, darum ist
  // die Deckung eines Feldes zur Zeit t einfach der Anteil der Streuung, der schon vorbei ist
  const STREUUNG_EIN = 0.012;
  const STREUUNG_AUS = 0.008;
  const einFeld = (k: number) => 0.35 + 0.08 * (k / Math.max(1, alt.anzahl));
  const ausFeld = (k: number) => 0.59 + 0.07 * (k / Math.max(1, neu.anzahl));
  const a1 = vorrat("farb.a1", Float32Array, n, false); // Säule steht
  const b0 = vorrat("farb.b0", Float32Array, n, false); // Aufbruch ins Feld
  const b1 = vorrat("farb.b1", Float32Array, n, false); // im Feld
  const c0 = vorrat("farb.c0", Float32Array, n, false); // Aufbruch aus dem neuen Feld
  const c1 = vorrat("farb.c1", Float32Array, n, false); // neue Säule steht
  const d0 = vorrat("farb.d0", Float32Array, n, false); // Aufbruch zum Platz
  for (let i = 0; i < n; i++) {
    ka[i] = alt.rang[b.q[i]];
    kn[i] = neu.rang[b.z[i]];
    const ra = gesamtA[ka[i]]++ % flaecheA;
    sx[i] = SA.links + ka[i] * (SA.breite + SA.spalt) + (ra % SA.breite);
    sy[i] = fest - 3 - Math.floor(ra / SA.breite);
    const rn = gesamtN[kn[i]]++ % flaecheN;
    tx[i] = SN.links + kn[i] * (SN.breite + SN.spalt) + (rn % SN.breite);
    ty[i] = fest - 3 - Math.floor(rn / SN.breite);
    // Die Sortierung wandert als Welle durch die Spalten
    b.start[i] = 0.03 + 0.07 * (b.qx[i] / B) + Math.random() * 0.02;
    a1[i] = b.start[i] + 0.12;
    // Feld für Feld, dunkel zuerst: der Streifen füllt sich von links
    b0[i] = einFeld(ka[i]) - 0.1 + Math.random() * STREUUNG_EIN;
    b1[i] = b0[i] + 0.1;
    // zurück ebenso der Reihe nach, kaum Zufall: die Säulen wachsen geordnet und bleiben kurz stehen
    c0[i] = ausFeld(kn[i]) + Math.random() * STREUUNG_AUS;
    c1[i] = c0[i] + 0.11;
    d0[i] = Math.max(c1[i] + 0.03, 0.8 + 0.05 * (b.zx[i] / B) + Math.random() * 0.008);
    b.ende[i] = d0[i] + 0.12;
    if ((i & TAKT) === TAKT) yield;
  }
  yield* b.zeitenFestlegen();

  // Abtastzeile über den Streifen
  const SCAN0 = 0.45;
  const SCAN1 = 0.56;
  const zeile = GELB;
  // Passerkreuze links und rechts des Streifens, wie am Rand eines Druckbogens
  const passer = b.dunkel ? mischen(b.himmel, farbe(185, 184, 224), 0.5) : mischen(b.himmel, b.grund, 0.55);
  const passerY = Math.round(feldOben + feldHoehe / 2);
  const passerAbstand = Math.min(SA.links, SN.links);
  const deckA = new Float32Array(alt.anzahl);
  const deckN = new Float32Array(neu.anzahl);

  return {
    dauer: 2800,
    schluss: Math.max(b.letzte, 0.7),
    bild(t, b) {
      b.grundMalen(t);
      const { qx, qy, zx, zy, fa, fn, start, ende, aus } = b;
      for (let i = 0; i < n; i++) {
        if (t < start[i] || t >= ende[i]) continue;
        // Im Feld ruhen die Teilchen unsichtbar: das Feld selbst wird unten flächig gedruckt
        if (t >= b1[i] && t < c0[i]) {
          b.ruhen(i);
          continue;
        }
        let x: number;
        let y: number;
        let f = fa[i];
        let frei = 1;
        if (t < b0[i]) {
          // Spalte sortiert sich: nur senkrecht
          x = qx[i];
          y = qy[i] + (saeuleAlt[i] - qy[i]) * einAus3(klemm((t - start[i]) / (a1[i] - start[i])));
        } else if (t < b1[i]) {
          // von der Säule ins Feld: erst zur Seite, dann hinab
          const s = (t - b0[i]) / (b1[i] - b0[i]);
          x = qx[i] + (sx[i] - qx[i]) * einAus3(klemm(s / 0.7));
          y = saeuleAlt[i] + (sy[i] - saeuleAlt[i]) * einAus3(klemm((s - 0.3) / 0.7));
        } else if (t < d0[i]) {
          // aus dem neuen Feld in die neue Säule: erst an die Zeile, dann zur Seite
          f = fn[i];
          const s = klemm((t - c0[i]) / (c1[i] - c0[i]));
          y = ty[i] + (saeuleNeu[i] - ty[i]) * einAus3(klemm(s / 0.6));
          x = tx[i] + (zx[i] - tx[i]) * einAus3(klemm((s - 0.25) / 0.75));
        } else {
          // die Säule entfaltet sich zum Bild
          f = fn[i];
          const s = (t - d0[i]) / (ende[i] - d0[i]);
          x = zx[i];
          y = saeuleNeu[i] + (zy[i] - saeuleNeu[i]) * einAus3(s);
          frei = klemm((1 - s) * 4);
        }
        b.setzen(i, x, y, f, frei);
      }
      // Kontrollstreifen: links der Abtastzeile schon neu gedruckt, rechts noch alt. Jedes Feld deckt so
      // weit, wie seine Teilchen gerade darin liegen.
      for (let k = 0; k < alt.anzahl; k++) deckA[k] = klemm((t - einFeld(k)) / STREUUNG_EIN);
      for (let k = 0; k < neu.anzahl; k++) deckN[k] = 1 - klemm((t - ausFeld(k)) / STREUUNG_AUS);
      const welle = t < SCAN0 ? -1 : t >= SCAN1 ? B : Math.floor(((t - SCAN0) / (SCAN1 - SCAN0)) * (B + 1));
      for (let x = 0; x < B; x++) {
        const neuDa = x < welle;
        const k = (neuDa ? SN : SA).feld[x];
        if (k < 0) continue;
        const deckung = neuDa ? deckN[k] : deckA[k];
        if (deckung <= 0) continue;
        const f = (neuDa ? neu : alt).toene[k];
        for (let y = feldOben; y < fest - 2; y++) {
          const schwelle = 64 * deckung * (y < vollBis ? 1 : 0.5);
          if (BAYER[y & 7][x & 7] < schwelle) aus[y * B + x] = f;
        }
      }
      // Die Passerkreuze stehen, solange der Streifen steht, gerastert ein- und ausgeblendet
      const passerDichte = 64 * klemm(Math.min((t - 0.27) / 0.06, (0.7 - t) / 0.06));
      if (passerDichte > 0 && passerAbstand >= 5) {
        for (const px of [Math.floor(passerAbstand / 2), B - 1 - Math.floor(passerAbstand / 2)]) {
          for (let k = -2; k <= 2; k++) {
            if (BAYER[passerY & 7][(px + k) & 7] < passerDichte) b.punkt(px + k, passerY, passer);
            if (BAYER[(passerY + k) & 7][px & 7] < passerDichte) b.punkt(px, passerY + k, passer);
          }
        }
      }
      if (welle >= 0 && welle < B) {
        for (let y = feldOben - 3; y < fest - 1; y++) b.punkt(welle, y, zeile);
        b.punkt(welle - 1, feldOben - 3, zeile);
        b.punkt(welle + 1, feldOben - 3, zeile);
      }
    },
    vermerk: (t) => (farbZahl !== null && t >= SCAN0 && t < 0.7 ? `${farbZahl} Farben` : null),
  };
}

/* Druckzeile --------------------------------------------------------------
   Ein Tintenstrahldrucker druckt das neue Bild Bahn für Bahn über das alte. Zwei Führungsschienen fassen
   die Bahn ein, der Schlitten (Gehäuse in Tinte, oben die beiden Durchschlag-Patronen Gelb und Rosa, an der
   Hinterkante die Düsenreihe) fährt hin und her: vor ihm liegt noch das alte Bild, direkt hinter seiner
   Düsenreihe steht schon das neue, ohne Lücke dazwischen. Am Rand gleitet er mit den Schienen eine Bahn
   tiefer (Zeilenvorschub) und kehrt um. Die frischen Pixel sprühen kurz aus der Düse an ihren Platz. */

function* druckzeile(b: Buehne, e: FlugEingabe): Bau<Ablauf> {
  const { B, fest, weiss, altZeit, neuZeit, neu, himmel } = b;
  // Die erste Bahn läuft meist vom Knopf weg
  const richtung = knopfRechts(e, B) ? -1 : 1;
  const R = Math.max(1, fest - weiss);
  const hb = Math.max(3, Math.round(R / 8)); // Höhe einer Bahn (so lang ist die Düsenreihe)
  const K = Math.ceil(R / hb);
  const kb = Math.max(5, Math.round(hb * 0.9)); // Breite des Schlittens (ohne Rand)
  const D0 = 0.07; // Schienen und Schlitten erscheinen, dann beginnt die erste Bahn
  const D1 = 0.9;
  const sd = (D1 - D0) / K; // je Bahn
  const lauf = sd * 0.84; // davon Fahrt, der Rest ist Zeilenvorschub
  const weg = B + kb; // so weit fährt die Vorderkante je Bahn
  const bahn = (k: number) => (k & 1 ? -richtung : richtung);
  const TROPF = 0.014; // so lange sprüht ein frisches Pixel

  // Zeiten je Pixel: Erreicht die Vorderkante des Schlittens das Pixel, verschwindet das alte darunter; hat
  // die Hinterkante (Düsenreihe) es passiert, steht das neue. Dazwischen deckt der Schlitten.
  for (let y = 0; y < fest; y++) {
    const p0 = y * B;
    if (y < weiss) {
      altZeit.fill(-1, p0, p0 + B);
      neuZeit.fill(0, p0, p0 + B);
      continue;
    }
    const k = Math.min(K - 1, Math.floor((y - weiss) / hb));
    const s0 = D0 + k * sd;
    const r = bahn(k);
    for (let x = 0; x < B; x++) {
      const xs = r > 0 ? x : B - 1 - x;
      altZeit[p0 + x] = s0 + (lauf * xs) / weg;
      neuZeit[p0 + x] = s0 + (lauf * (xs + 1 + kb)) / weg;
    }
    if ((y & 15) === 15) yield;
  }
  const fertig = D0 + (K - 1) * sd + lauf;
  const AUS = 0.05; // danach blendet der Schlitten aus

  // Farben: bei Tag ein Gehäuse in Nacht-Tinte, bei Nacht im Mondlicht aufgehellt
  const schiene = b.dunkel ? mischen(b.himmel, TINTE_FERNE, 0.55) : TINTE_DUNST;
  const kopf = b.dunkel ? mischen(b.grund, TINTE_FERNE, 0.55) : b.grund;
  const kante = b.dunkel ? mischen(b.grund, TINTE_FERNE, 0.85) : TINTE_DUNST;
  const tief = b.dunkel ? mischen(b.grund, TINTE_FERNE, 0.3) : TINTE;

  // Pseudozufall je Pixel (fest, damit nichts flackert): welches frische Pixel wie weit sprüht
  const streu = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) & 7;

  return {
    dauer: 2700,
    schluss: fertig + AUS,
    bild(t, b) {
      b.grundMalen(t);
      const { aus } = b;
      // Wo steht der Schlitten? Bahn k, Vorderkante c in Fahrtrichtung, Vorschub zwischen den Bahnen
      const k = Math.max(0, Math.min(K - 1, Math.floor((t - D0) / sd)));
      const s0 = D0 + k * sd;
      const u = (t - s0) / lauf;
      const c = klemm(u) * weg;
      const r = bahn(k);
      const px = (xs: number) => (r > 0 ? xs : B - 1 - xs);
      let oben = weiss + k * hb;
      if (u > 1 && k < K - 1) oben = Math.round(oben + hb * einAus3(klemm((u - 1) / ((sd - lauf) / lauf))));
      const hoehe = Math.max(1, Math.min(hb, fest - oben));
      const deckung = 64 * Math.min(klemm(t / D0), klemm((fertig + AUS - t) / AUS));

      // Sprühnebel: Pixel, die eben gedruckt wurden, fliegen noch aus der Düse an ihren Platz
      if (u > 0 && u < 1 + TROPF / lauf) {
        const cVor = Math.max(0, c - (TROPF / lauf) * weg);
        const bandOben = weiss + k * hb;
        const bandUnten = Math.min(fest, bandOben + hb);
        for (let xs = Math.max(0, Math.floor(cVor - kb)); xs <= Math.min(B - 1, Math.floor(c - 1 - kb)); xs++) {
          const x = px(xs);
          for (let y = bandOben; y < bandUnten; y++) {
            const p = y * B + x;
            const f = neu[p];
            if (f === himmel) continue;
            const s = (t - neuZeit[p]) / TROPF;
            if (s < 0 || s >= 1) continue;
            const z = streu(x, y);
            if (z > 4) continue;
            const d = Math.round((1 - s) * (1 - s) * (1 + z));
            b.hart(px(xs + d), y, f);
          }
        }
      }

      if (deckung <= 0) return;
      // Führungsschienen: oben eine durchgehende Stange, auf der der Schlitten läuft, unten eine gepunktete
      const schienen = [oben - 2, oben + hoehe + 1];
      for (let j = 0; j < 2; j++) {
        const y = schienen[j];
        if (y < weiss || y >= fest) continue;
        const reihe = BAYER[y & 7];
        for (let x = 0; x < B; x++) if (reihe[x & 7] < deckung && (j === 0 || (x & 1) === 0)) aus[y * B + x] = schiene;
      }
      // Schlitten in Bahnkoordinaten lo … hi (Hinterkante lo), am Rand halb hinausgeschoben geparkt. Unten
      // das Gehäuse über der Bahn mit der Düsenreihe, oben auf der Stange die beiden Patronen.
      const mitte = Math.max(0, Math.min(B - 1, c - (kb + 1) / 2));
      const lo = Math.floor(mitte - (kb + 1) / 2);
      const hi = lo + kb + 2;
      const y0 = oben - 1;
      const y1 = oben + hoehe;
      const kappe = oben - 2 - Math.max(2, Math.round(hb * 0.3)); // Oberkante der Patronen
      const teilung = lo + 1 + ((hi - lo) >> 1); // zwischen Gelb und Rosa
      const blinkt = Math.floor(t * 110) & 1;
      for (let y = kappe; y <= y1; y++) {
        const reihe = BAYER[y & 7];
        const gehaeuse = y >= y0;
        for (let xs = lo; xs <= hi; xs++) {
          const x = px(xs);
          if (x < 0 || x >= B || reihe[x & 7] >= deckung) continue;
          let f = kopf;
          if (gehaeuse) {
            if (y === y1 && (xs === lo || xs === hi)) continue; // runde Ecken unten
            if (xs === lo && y > y0 && y < y1) {
              // Düsenreihe an der Hinterkante: jede zweite Düse glimmt, im Takt versetzt
              f = ((y - oben + blinkt) & 1) === 0 ? GELB : tief;
            } else if (xs === hi || y === y0) f = kante; // Licht auf Vorder- und Oberkante
            else if (y === y1) f = tief;
          } else {
            // Patronen: schmaler als das Gehäuse, Tintenrand, innen Kopie-Gelb und Kopie-Rosa
            if (xs === lo || xs === hi) continue;
            if (y === kappe && (xs === lo + 1 || xs === hi - 1)) continue;
            const innen = y > kappe && y < oben - 2 && xs > lo + 1 && xs < hi - 1 && xs !== teilung;
            if (innen) f = (xs < teilung) === r > 0 ? ROSA : GELB;
          }
          b.hart(x, y, f);
        }
      }
    },
  };
}

/* Lawine ------------------------------------------------------------------
   Erst sinkt alles über dem Hang ein (Himmel, ferne Ketten), dann bricht am Gipfel der markantesten Kette
   eine Lawine los. Die Front läuft vom Gipfel aus den Grat entlang beide Flanken hinab und zugleich den Hang
   hinunter, eine brodelnde Staubwolke mit Schattenkante reißt das alte Bild als Pulver mit in die Tiefe, die
   neuen Hänge rutschen bergab nach. */

function* lawine(b: Buehne): Bau<Ablauf> {
  const { n, B, fest, weiss } = b;
  yield* b.paaren(
    (x, y) => x * 1024 + y,
    (x, y) => x * 1024 + y,
  );
  // Gelände: Kammlinie je Ebene (oberstes Pixel dieser Ebene oder weiter vorn); genommen wird die Kette mit
  // dem größten Relief, die vorderen leicht bevorzugt. So läuft die Lawine über einen echten Berg.
  const kammFuer = (ebene: number) => {
    const k = new Float32Array(B).fill(fest - 1);
    for (let x = 0; x < B; x++) {
      for (let y = weiss; y < fest; y++) {
        const p = y * B + x;
        if (b.vorn[p] >= ebene && b.neu[p] !== b.himmel) {
          k[x] = y;
          break;
        }
      }
    }
    return k;
  };
  let kammF = kammFuer(1);
  let glatt = glaetten(kammF, Math.max(2, Math.round(B / 45)));
  let bestes = -1;
  for (let ebene = 1; ebene <= 3; ebene++) {
    const k = kammFuer(ebene);
    const g = glaetten(k, Math.max(2, Math.round(B / 45)));
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of g) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    const relief = (hi - lo) * (1 + 0.25 * ebene);
    if (relief > bestes) {
      bestes = relief;
      kammF = k;
      glatt = g;
    }
    yield;
  }
  const kamm = Int16Array.from(kammF);
  let gMin = Infinity;
  let gMax = -Infinity;
  for (const v of glatt) {
    gMin = Math.min(gMin, v);
    gMax = Math.max(gMax, v);
  }
  // Gipfel: der höchste Punkt, dazu bis zu zwei weitere deutliche Spitzen mit Abstand
  const kandidaten = Array.from({ length: B }, (_, x) => x).sort((a, c) => glatt[a] - glatt[c]);
  const fenster = Math.max(3, Math.round(B / 10));
  const gipfel: number[] = [];
  for (const x of kandidaten) {
    if (gipfel.length >= 3 || glatt[x] - gMin > 0.4 * (gMax - gMin) + 1) break;
    if (gipfel.some((g) => Math.abs(g - x) < B / 5)) continue;
    let spitze = true;
    for (let k = Math.max(0, x - fenster); k <= Math.min(B - 1, x + fenster); k++) if (glatt[k] < glatt[x]) spitze = false;
    if (spitze || gipfel.length === 0) gipfel.push(x);
  }
  // Ankunft der Front am Kamm: Weglänge entlang des Grats vom nächsten Gipfel, der Hauptgipfel zuerst
  const roh = new Float32Array(B).fill(Infinity);
  const hang = new Int8Array(B);
  gipfel.forEach((gx, rang) => {
    const vorsprung = rang * B * 0.12;
    for (const seite of [-1, 1]) {
      let weg = vorsprung;
      for (let x = gx; x >= 0 && x < B; x += seite) {
        if (x !== gx) weg += Math.hypot(1, glatt[x] - glatt[x - seite]);
        if (weg < roh[x]) {
          roh[x] = weg;
          hang[x] = x === gx ? 1 : seite; // bergab heißt: vom Gipfel weg
        }
      }
    }
  });
  let rMin = Infinity;
  let rMax = -Infinity;
  for (const v of roh) {
    rMin = Math.min(rMin, v);
    rMax = Math.max(rMax, v);
  }
  const anriss = rauschen(B, 3);
  const tKamm = new Float32Array(B);
  for (let x = 0; x < B; x++) tKamm[x] = 0.25 + 0.26 * ((roh[x] - rMin) / Math.max(1, rMax - rMin)) + 0.02 * anriss[x];
  const LAUF = 0.32; // so lange braucht die Front vom Kamm bis in die Tiefe
  const front = (x: number, y: number) => tKamm[x] + LAUF * klemm((y - kamm[x]) / Math.max(4, fest - kamm[x]));

  const nf = yield* flaeche("nf", B, fest, Math.max(6, B / 26));
  const rutsch = vorrat("lawine.rutsch", Float32Array, n, false);
  const seit = vorrat("lawine.seit", Float32Array, n, false);
  const flug = vorrat("lawine.flug", Float32Array, n, false);
  const ankunft = vorrat("lawine.ankunft", Float32Array, n, false);
  const staub = vorrat("lawine.staub", Uint8Array, n, false);
  const sturz = vorrat("lawine.sturz", Float32Array, n, false);
  const drueber = vorrat("lawine.drueber", Uint8Array, n, false); // altes Pixel über dem neuen Kamm: es vergeht an Ort und Stelle
  for (let i = 0; i < n; i++) {
    const zx = b.zx[i];
    const zy = b.zy[i];
    const rz = nf[b.z[i]];
    if (zy < kamm[zx]) {
      // Himmel, Sonne, ferne Ketten: sinken von oben nach unten sacht an ihren Platz, noch vor der Lawine
      b.ende[i] = 0.17 + 0.09 * (zy / Math.max(1, kamm[zx])) + 0.07 * rz + Math.random() * 0.01;
      flug[i] = 0.15;
      rutsch[i] = 2 + 4 * rz;
      seit[i] = 0;
    } else {
      // Direkt hinter der Staubwolke rutscht der neue Hang nach, ohne leeres Papier dazwischen
      b.ende[i] = front(zx, zy) + 0.06 + 0.025 * rz;
      flug[i] = 0.12 + 0.04 * rz + Math.random() * 0.01;
      rutsch[i] = Math.min(zy - kamm[zx] + 2, 10 + 14 * rz);
      seit[i] = hang[zx] * rutsch[i] * 0.45;
    }
    ankunft[i] = b.ende[i] - flug[i];
    const qx = b.qx[i];
    const qy = b.qy[i];
    const rq = nf[b.q[i]];
    // Das alte Bild bricht ab, kurz bevor die Front es erreicht; was über dem neuen Kamm liegt, früher
    drueber[i] = qy < kamm[qx] ? 1 : 0;
    b.start[i] = drueber[i] ? 0.04 + 0.12 * (qy / Math.max(1, kamm[qx])) + 0.08 * rq : front(qx, qy) - 0.03;
    staub[i] = Math.random() < 0.55 ? 1 : 0;
    sturz[i] = drueber[i] ? 0.09 + 0.04 * rq : 0.17 + 0.07 * rq + Math.random() * 0.02;
    if ((i & TAKT) === TAKT) yield;
  }
  yield* b.zeitenFestlegen();
  let tMax = 0;
  for (const v of tKamm) tMax = Math.max(tMax, v);

  // Pulverschnee: Körper in tinte-ferne mit weißen Kappen, die Unterkante als Schatten in tinte-dunst.
  // Nachts im Mondlicht dieselben Töne gegen den dunklen Himmel.
  const pulver = TINTE_FERNE;
  const pulverLicht = b.dunkel ? mischen(TINTE_FERNE, farbe(255, 255, 255), 0.45) : farbe(255, 255, 255);
  const pulverSchatten = b.dunkel ? mischen(TINTE_FERNE, b.grund, 0.45) : TINTE_DUNST;

  return {
    dauer: 2300,
    schluss: Math.max(b.letzte, tMax + 1.3 * LAUF),
    bild(t, b) {
      b.grundMalen(t);
      const { qx, qy, zx, zy, fa, fn, start, ende } = b;
      for (let i = 0; i < n; i++) {
        if (t >= ende[i]) continue;
        // Der Anflug hängt nicht am Aufbruch: Die Paarung läuft spaltenweise, ein früh einsinkender Himmel
        // kann so eine Quelle tief im Hang haben, die erst mit der Front aufbricht
        if (t < ankunft[i]) {
          if (t < start[i]) continue;
          const s = (t - start[i]) / sturz[i];
          if (s >= 1) {
            b.ruhen(i);
            continue;
          }
          if (drueber[i]) {
            // vergeht in Schollen wie Nebel, während der neue Himmel einsinkt (Absacken zöge senkrechte Schlieren)
            b.ruhen(i);
            continue;
          }
          // Staub: kurz aufwirbeln, dann bergab stürzen und in der Tiefe verschwinden
          const auf = 4 * Math.sin(Math.PI * Math.min(1, s / 0.45));
          const y = qy[i] - auf + (fest + 4 - qy[i]) * ein2(klemm((s - 0.25) / 0.75));
          const x = qx[i] + hang[qx[i]] * 9 * s + sinus(i + t * 20) * 1.5;
          const f = staub[i] ? (s < 0.5 ? pulver : pulverSchatten) : fa[i];
          b.setzen(i, x, y, f, 1);
        } else {
          const s = (t - ankunft[i]) / flug[i];
          const rest = 1 - aus3(s);
          b.setzen(i, zx[i] - seit[i] * rest, zy[i] - rutsch[i] * rest, fn[i], klemm((1 - s) * 4));
        }
      }
      // Staubwolke an der Front: oben ausfransend und brodelnd, mit weißen Kappen, unten eine Schattenkante;
      // sie neigt sich bergab und zerstiebt in der Tiefe
      const schub = Math.floor(t * 40);
      for (let x = 0; x < B; x++) {
        const lauf = (t - tKamm[x]) / LAUF;
        if (lauf < 0 || lauf > 1.3) continue;
        const yf = kamm[x] + Math.min(1, lauf) * (fest - kamm[x]);
        const dicht = lauf < 0.08 ? lauf / 0.08 : lauf > 1 ? 1 - (lauf - 1) / 0.3 : 1;
        const hoehe = 4 + Math.min(B, fest) * 0.13 * (0.5 + 0.25 * sinus(x * 0.23 + t * 14) + 0.25 * sinus(x * 0.071 - t * 9)) * Math.min(1, lauf * 3);
        const y0 = Math.max(0, Math.floor(yf - hoehe));
        const y1 = Math.min(fest - 1, Math.floor(yf + 1));
        for (let y = y0; y <= y1; y++) {
          const tief = (y - (yf - hoehe)) / (hoehe + 1);
          const schwelle = BAYER[y & 7][(x + schub) & 7];
          if (schwelle >= 64 * Math.min(1, tief * 1.5) * dicht) continue;
          const f = y >= yf - 1 ? pulverSchatten : tief < 0.5 && BAYER[(y + 3) & 7][(x + schub + 5) & 7] < 40 * (1 - tief * 2) ? pulverLicht : pulver;
          b.punkt(x, y, f);
        }
      }
    },
  };
}

/* Umblättern --------------------------------------------------------------
   Das alte Bild ist ein Bogen Papier. Eine Ecke hebt sich an und zögert, dann wird der Bogen umgeschlagen:
   Die Klappe zeigt ihre Rückseite (Papier, durch das das Bild gespiegelt schimmert), darunter liegt das neue
   Bild. Falzkante und Schlagschatten gerastert. Der Zeiger zieht die Klappe zu sich. */

function* umblaettern(b: Buehne, e: FlugEingabe): Bau<Ablauf> {
  const { B, fest, weiss } = b;
  // Der Bogen ist die Bildfläche unter dem Papierrand der oberen Naht; was die Klappe darüber hinausträgt,
  // verschwindet hinter dem Rand
  const rechts = knopfRechts(e, B);
  const C = { x: rechts ? B : 0, y: fest };
  // Eher quer als diagonal: so liest es sich als umgeschlagene Seite
  const grundWinkel = Math.atan2(-fest * 0.55, rechts ? -B : B);
  let winkel = grundWinkel;
  const ecken = [
    [0, weiss],
    [B, weiss],
    [0, fest],
    [B, fest],
  ];
  const ruecken = b.dunkel ? mischen(b.himmel, farbe(185, 184, 224), 0.1) : mischen(b.himmel, b.grund, 0.045);
  const falz = mischen(b.himmel, b.grund, b.dunkel ? 0.0 : 0.45);
  const falzHell = b.dunkel ? mischen(b.himmel, farbe(185, 184, 224), 0.45) : falz;
  // Durchscheinendes gespiegeltes Bild auf der Rückseite: wenige Töne, gerastert
  const scheinCache = new Map<number, number>();
  const schein = (v: number) => {
    let c = scheinCache.get(v);
    if (c === undefined) {
      c = mischen(ruecken, v, 0.22);
      scheinCache.set(v, c);
    }
    return c;
  };
  const schattenCache = new Map<number, number>();
  const schatten = (v: number) => {
    let c = schattenCache.get(v);
    if (c === undefined) {
      c = mischen(v, b.grund, b.dunkel ? 0.5 : 0.3);
      schattenCache.set(v, c);
    }
    return c;
  };
  // Alle Töne vorab mischen: Ein Map-Treffer mitten im Bild kostet sonst im ersten Bild mehrere ms.
  // Nachbarn haben meist dieselbe Farbe, darum nur bei Farbwechsel nachsehen.
  for (const bild of [b.alt, b.neu]) {
    let letzt = 0;
    let erst = true;
    for (let p = 0; p < b.F; p++) {
      const v = bild[p];
      if (!erst && v === letzt) continue;
      erst = false;
      letzt = v;
      if (bild === b.alt) schein(v);
      schatten(v);
    }
    yield;
  }
  const verlauf = (t: number, L: number) => {
    // anheben, zögern, umschlagen
    if (t < 0.18) return 0.07 * L * aus3(t / 0.18);
    if (t < 0.3) return L * (0.07 + 0.015 * ((t - 0.18) / 0.12));
    return L * (0.085 + 0.93 * einAus3(klemm((t - 0.3) / 0.6)));
  };

  return {
    dauer: 1800,
    schluss: 0.81,
    bild(t, b) {
      const { aus, alt, neu, himmel, F } = b;
      // Der Zeiger lenkt die Falzrichtung zu sich (geglättet)
      let ziel = grundWinkel;
      if (b.zeigerAn) {
        const w = Math.atan2(b.my - C.y, b.mx - C.x);
        let d = w - grundWinkel;
        d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
        ziel = grundWinkel + Math.max(-0.5, Math.min(0.5, d * 0.6));
      }
      winkel += (ziel - winkel) * (1 - Math.pow(0.88, b.dt * 60));
      const Dx = Math.cos(winkel);
      const Dy = Math.sin(winkel);
      let L = 0;
      for (const [x, y] of ecken) L = Math.max(L, (x - C.x) * Dx + (y - C.y) * Dy);
      const f = verlauf(t, L + 2);
      const breiteSchatten = 2 + Math.min(B, fest) * 0.02;
      for (let y = weiss; y < fest; y++) {
        const reihe = BAYER[y & 7];
        for (let x = 0; x < B; x++) {
          const p = y * B + x;
          const d = (x + 0.5 - C.x) * Dx + (y + 0.5 - C.y) * Dy;
          if (d < f) {
            // aufgedeckt: neues Bild, nahe der Falz im Schatten der Klappe
            const v = neu[p];
            aus[p] = f - d < breiteSchatten && reihe[x & 7] < 40 * (1 - (f - d) / breiteSchatten) ? schatten(v) : v;
            continue;
          }
          // gespiegelter Punkt auf dem Bogen: liegt er noch auf dem Papier, deckt die Klappe dieses Pixel
          const w = 2 * (d - f);
          const sx = Math.floor(x + 0.5 - w * Dx);
          const sy = Math.floor(y + 0.5 - w * Dy);
          if (d - f < 1.2) {
            aus[p] = sx >= 0 && sx < B && sy >= weiss && sy < fest ? falzHell : alt[p];
            continue;
          }
          if (sx >= 0 && sx < B && sy >= weiss && sy < fest) {
            const v = alt[sy * B + sx];
            // Rückseite: Papier, das Bild schimmert spiegelverkehrt durch; zur Falz hin etwas dunkler
            const nah = d - f < 4 && reihe[x & 7] < 24;
            aus[p] = nah ? falz : v !== himmel && reihe[x & 7] < 28 ? schein(v) : ruecken;
            // Klappenrand
            const rx = Math.floor(x + 0.5 - (w + 1.5) * Dx);
            const ry = Math.floor(y + 0.5 - (w + 1.5) * Dy);
            if (rx < 0 || rx >= B || ry < weiss || ry >= fest) aus[p] = falz;
          } else {
            // noch flach liegender Bogen, mit Schlagschatten unter dem Klappenrand
            let v = alt[p];
            const sx2 = Math.floor(x + 0.5 - (w - 2.5) * Dx);
            const sy2 = Math.floor(y + 0.5 - (w - 2.5) * Dy);
            if (sx2 >= 0 && sx2 < B && sy2 >= weiss && sy2 < fest && reihe[x & 7] < 28) v = schatten(v);
            aus[p] = v;
          }
        }
      }
      aus.fill(b.grund, F, B * b.H);
    },
  };
}

/* Start ------------------------------------------------------------------- */

const ENTWUERFE: Record<string, (b: Buehne, e: FlugEingabe) => Bau<Ablauf>> = {
  wirbel,
  urknall,
  sandsturm,
  schwerkraft,
  farbsortierung,
  druckzeile,
  lawine,
  umblaettern,
};
// Diese malen ohne Teilchen; die Felder je Teilchen werden für sie nicht angelegt
const OHNE_TEILCHEN = new Set(["druckzeile", "umblaettern"]);

// Tausender mit schmalem Leerzeichen, wie im Druckvermerk „48 210 Pixel unterwegs“
function zahl(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function flugStarten(e: FlugEingabe, wahl?: string): Flug {
  const moeglich = CHOREOGRAFIEN.filter((name) => name !== e.vorher);
  const name = wahl && wahl in ENTWUERFE ? wahl : moeglich[Math.floor(Math.random() * moeglich.length)];
  // Im Klick nur das Nötigste; Paaren, Sortieren und Zeiten laufen in Raten in den ersten Bildern
  const b = new Buehne(e);
  const bau = (function* (): Bau<Ablauf | null> {
    yield* b.aufbauen(e, !OHNE_TEILCHEN.has(name));
    if (!b.n) return null;
    if (name !== "umblaettern") e.status(`${zahl(b.n)} Pixel unterwegs`);
    return yield* ENTWUERFE[name](b, e);
  })();
  let ablauf: Ablauf | null = null;
  let bereit = false;
  let beginn = -1;
  let letzt = 0;
  let fertig = false;
  let vermerkt = "";
  // Ein kurzer Rest nach der letzten Landung (gut 40 ms): Das letzte Flugbild zeigt dann schon alles an seinem
  // Platz, und der Wechsel zum exakten Ziel springt nicht
  let schluss = 0;

  // Eine Rate der Vorbereitung: weiter, bis sie fertig oder die Zeit des Bilds verbraucht ist
  const vorbereiten = () => {
    const bis = uhr() + RATE_MS;
    for (;;) {
      const r = bau.next();
      if (r.done) {
        ablauf = r.value;
        bereit = true;
        fertig = !ablauf;
        if (ablauf) schluss = Math.min(1, ablauf.schluss + 45 / ablauf.dauer);
        return;
      }
      if (uhr() >= bis) return;
    }
  };

  return {
    name,
    schritt(jetzt, ausgabe) {
      if (!bereit) {
        vorbereiten();
        if (!bereit) {
          // Noch nicht so weit: Das alte Bild steht still, der Flug beginnt erst mit allen Daten
          b.altZeigen(ausgabe);
          return true;
        }
      }
      if (beginn < 0) {
        beginn = jetzt;
        letzt = jetzt;
      }
      const t = ablauf ? (jetzt - beginn) / ablauf.dauer : 1;
      if (fertig || !ablauf || t >= schluss) {
        const neu = b.neu;
        const ziel = alsInt(ausgabe);
        ziel.set(neu.length <= ziel.length ? neu : neu.subarray(0, ziel.length));
        fertig = true;
        return false;
      }
      const dt = Math.max(0, Math.min(0.05, (jetzt - letzt) / 1000));
      letzt = jetzt;
      b.rahmen(ausgabe, dt, e.zeiger());
      ablauf.bild(Math.max(0, t), b);
      b.nahtOben();
      const text = ablauf.vermerk?.(t);
      if (text && text !== vermerkt) {
        vermerkt = text;
        e.status(text);
      }
      return true;
    },
  };
}
