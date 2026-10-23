// Maus-Physik für das Bergbild. Jedes Kunstpixel hängt an einer Feder über seiner Ruhelage. Der Zeiger drückt
// es weg und schiebt einen Wulst vor sich her, lose Krümel stieben auf, eine grobe Strömung reißt Pixel mit und
// dreht Wirbel hinter dem Zeiger, gehaltene Maustaste saugt in einen Strudel, Loslassen schleudert alles fort,
// ein Klick schickt eine Lichtwelle über die Ketten, einen Druckring über das Bild und lässt an der Stelle
// Pixel aufspritzen. Im Himmel wirbelt der Zeiger Staub aus Tinte (nachts aus Mondlicht) auf, den die
// Strömung mitnimmt; nachts fangen Schneise, Wulst und Krümel das Mondlicht.
// DOM-frei und darum in Node prüfbar. Gerechnet wird nur über die aktive Teilmenge; ruht alles, bleibt pro
// Bild nur der Blick in die Farbtabelle.
// Farben laufen intern als Int32 (Sicht auf dieselben Puffer): Deckende RGBA-Werte 0xFFxxxxxx sind als Int32
// kleine negative Zahlen und damit Smis. Als Uint32 lägen sie über 2^30, und jeder Zugriff in noch nicht
// optimiertem Code legte eine HeapNumber an (rund 16 MB/s Müll beim ersten Mauskontakt).
import { BAYER, BOGEN, GELB, GLITZER, GLITZER_HELL, MOND, NAHT, T1, T2, T3, T4, T5, T6, nachtAb } from "./berge-szene";

export interface Spiel {
  zeiger(x: number, y: number, jetzt: number): void; // Kunstpixel (Fließkomma), jetzt in ms
  druck(an: boolean): void; // Maustaste gehalten: Sog
  weg(): void; // Zeiger hat das Bild verlassen
  stoss(x: number, y: number, staerke?: number): void; // Klick/Tipp: Druckwelle
  // Ein Schritt (dt in s, höchstens 1/20 s) und das fertige RGBA-Bild in ausgabe. Rückgabe false: alles ruht,
  // ausgabe ist dann exakt tabelle[bild[i]].
  schritt(dt: number, bild: Uint8Array, hinten: Uint8Array, vorn: Uint8Array, tabelle: Uint32Array, ausgabe: Uint32Array): boolean;
  // Etwas bewegt sich oder der Zeiger wirkt gerade auf das Bild. Ein Zeiger, der still über dem Bild steht,
  // wirkt nur noch kurz nach (rund 1,7 s); danach ist aktiv() false, damit das Bild ruhen darf.
  aktiv(): boolean;
  groesse(B: number, H: number, fest?: number): void; // neue Bildgröße: alles zurücksetzen
  unterwegs(): number; // Pixel, die gerade nicht an ihrem Platz sind (für die Statuszeile)
}

// Die Tinten von hell nach dunkel: Aus ihnen entsteht die Schattenstufe für den Wulst
const TINTEN = [BOGEN, T1, T2, T3, T4, T5, T6];

// Beweglichkeit je Ebene (himmel, fern, mitte, nah): Vorn gibt am meisten nach, das ergibt Tiefe
const MOB = [0.24, 0.42, 0.68, 1];
// Was im Himmel steht (Wolken, Sterne, Hof, Strahlen, Dunst), ist leicht und wirbelt weit; nur die Scheibe von
// Sonne und Mond bleibt schwer (MOB[0])
const MOB_HIMMEL = 0.85;
const FEDER = 70; // 1/s², Eigenfrequenz ≈ 1,3 Hz
const DAEMPFUNG = 4.2; // 1/s, Dämpfungsgrad ≈ 0,25: Ein Pixel federt zwei-, dreimal nach
const KOPPLUNG = 4; // 1/s, wie stark die Strömung ein Pixel mitnimmt
const STROEMUNG_ABKLINGEN = 2.4; // 1/s
const WIRBEL = 5; // Wirbelverstärkung der Strömung
const DRUCK_SCHRITTE = 10; // Jacobi-Schritte für die inkompressible Strömung
const SOG_ZUG = 420; // 1/s², Steifigkeit, mit der der Strudel ein Pixel auf seiner Bahn hält
const DREHUNG = 7; // 1/s, Winkelgeschwindigkeit am Außenrand des Strudels
// Ein Pixel zeigt seine Verschiebung erst ab 1,1 px und kehrt erst unter 0,45 px sichtbar heim. Ohne diese
// Hysterese springt das Bayer-Raster unter sanft verschobenen Flächen streifenweise (Moiré-Schraffur).
const ZEIGEN_AB2 = 1.1 * 1.1;
const ZEIGEN_BIS2 = 0.45 * 0.45;
// Ein Loch gilt als geschlossen, wenn ein Nachbar bis auf 1,2 px hier gelandet wäre: Dann füllt es sich mit
// dessen Farbe. Erst wo wirklich niemand hinkommt, öffnet sich der Blick nach hinten.
const LOCH_TOLERANZ2 = 1.2 * 1.2;
const GLAETTEN = 0.025; // s, der Zeiger gleitet: Auch seltene Mausmeldungen ergeben eine fließende Spur
const STILL_NACH = 0.12; // s: So lange drückt ein stehender Zeiger noch voll …
const STILL_ABKLINGEN = 0.4; // s: … danach lässt er nach, die Delle schließt sich und das Spiel ruht
const LOSE_RATE = 1.6; // 1/s, Anteil der Pixel unter dem Zeiger, die als Krümel aufstieben
const SOG_HOECHSTENS = 8; // s, dann löst sich der Strudel von selbst
const SOG_OHNE_ZEIGER = 3; // s
const SOG_AB = 0.12; // s gehalten, bevor der Strudel zu ziehen beginnt
const KNALL_AB = 0.25; // s gehalten, bevor das Loslassen knallt (ein Klick dauert 80–150 ms)

// Nachts fängt, was sich bewegt, das Mondlicht: um so viel Helligkeit heben die Glanzstufen 0–3 eine Farbe
const GLANZ_HUB = [50, 85, 125, 175];
// Am Rand der Schneise (wenig verschoben) liegt nachts die Silberkante, tiefer drinnen hellere Tinte
const LOCHRAND = 0.42;
// Staub im Himmel: Teilchen, die der Zeiger aufwirbelt und die Strömung mitnimmt
const STAUB_MAX = 1800;
const RING_MAX = 4; // gleichzeitige Druckringe

// Bits in zustand
const GEZEIGT = 1; // Verschiebung ist gerade sichtbar (Hysterese)
const LOSE = 2; // loser Krümel: schwächere Feder, fliegt weit und funkelt früher
// Nur von der Strömung bewegt: Solche Pixel ziehen in großen, gleichmäßigen Flächen. Ein Pixel Versatz zeigte
// dort nur das Raster als Schraffur, darum erscheinen sie erst ab 2,2 px und kehren schon unter 1 px heim.
const STROM = 4;
const STROM_AB2 = 2.2 * 2.2;
const STROM_BIS2 = 1;

// Bayer-Schwellen flach, (Wert + 0,5) / 64, Index (y & 7) · 8 + (x & 7): billiger als die verschachtelte Matrix
const SCHWELLE = new Float32Array(64);
for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) SCHWELLE[y * 8 + x] = (BAYER[y][x] + 0.5) / 64;

// Pseudozufall je Pixel, fest über die Zeit: Bahnradius im Strudel, Wurfweite der Explosion. Voll gemischt
// (Murmur-Finalizer): Ein bloßes Vielfaches des Index läge in der Fläche als Gitter und zeigte, als Schwelle
// genommen, eine diagonale Schraffur.
function streu(i: number, salz: number): number {
  let h = (i ^ Math.imul(salz, 0x27d4eb2d)) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 8) / 16777216;
}
// Helligkeit eines RGBA-Werts (little endian: R im untersten Byte); gilt für Int32 wie für Uint32
const hell = (c: number) => (c & 255) * 0.3 + ((c >>> 8) & 255) * 0.59 + ((c >>> 16) & 255) * 0.11;

// Das Ruhebild: je Pixel ein Blick in die Tabelle. Eigene kleine Funktion, damit V8 sie früh und für sich
// optimiert und ein Deopt im großen Schritt sie nicht mitreißt.
function grundbild(bild: Uint8Array, tab: Int32Array, aus: Int32Array, n: number): void {
  for (let i = 0; i < n; i++) aus[i] = tab[bild[i]];
}

interface Welle {
  x: number;
  y: number;
  r: number; // bisher erreichter Radius
  staerke: number;
  ende: number; // Abstand zur fernsten Ecke
}

interface Spritzer {
  x: number;
  y: number;
  staerke: number;
}

export function spielErstellen(B0: number, H0: number, fest0: number): Spiel {
  let B = 0;
  let H = 0;
  let N = 0;
  let fest = 0; // ab dieser Zeile steht die Nacht-Tinte still, dort wird nie gemalt
  let oben = 0; // die obersten Zeilen sind die Naht zum Papier: dort wird nie gemalt
  let R = 7; // Zeigerradius in Kunstpixeln

  // Pixelzustand: Verschiebung und Geschwindigkeit, nur für Pixel in der aktiven Liste ungleich null
  let vx = new Float32Array(0);
  let vy = new Float32Array(0);
  let dx = new Float32Array(0);
  let dy = new Float32Array(0);
  let marke = new Uint8Array(0); // 1 aktiv, 2 im Strudel gefangen
  let zustand = new Uint8Array(0); // GEZEIGT, LOSE
  let dicht = new Uint8Array(0); // je Zielpixel: Zahl der Landungen, Bit 0x80 = eigenes Pixel ist fort
  let liste = new Int32Array(0);
  let anzahl = 0;
  let verschoben = 0;
  // Malliste je Bild: Zielindex, Quelle, Farbe, Ebene, Wulst-Anteil; dazu die nach Ebenen sortierte Folge
  let qZiel = new Int32Array(0);
  let qQuelle = new Int32Array(0);
  let qFarbe = new Int32Array(0);
  let qEbene = new Uint8Array(0);
  let qWulst = new Float32Array(0);
  let qFolge = new Int32Array(0);
  const zaehl = new Int32Array(4); // Malliste je Ebene

  // Grobe Strömung auf einem Gitter mit Zellweite Z (Geschwindigkeit in Kunstpixeln/s)
  let Z = 2;
  let GW = 0;
  let GH = 0;
  let su = new Float32Array(0);
  let sv = new Float32Array(0);
  let su2 = new Float32Array(0);
  let sv2 = new Float32Array(0);
  let sdruck = new Float32Array(0);
  let squelle = new Float32Array(0);
  let swirbel = new Float32Array(0);
  let zelleWach = new Uint8Array(0);
  let zieht = new Uint8Array(0); // 1 = Zelle zieht Pixel mit (Tempo über der Totzone)
  let stroemt = false;
  let stroemMax = 0; // größtes Tempo² im Gitter beim letzten Schritt

  // Zeiger: roh gemeldet (zx, zy) und geglättet (gx, gy); gerechnet wird mit dem geglätteten
  let zda = false;
  let zx = 0;
  let zy = 0;
  let gx = 0;
  let gy = 0;
  let zvx = 0;
  let zvy = 0;
  let zZeit = -1e9;
  let zNeu = false;
  let zSprung = true;
  let zRegt = false; // seit dem letzten Schritt wirklich bewegt
  let zBewegt = -1e9; // uhr der letzten Bewegung
  let zAnkerX = 0; // Lage der letzten wirksamen Bewegung
  let zAnkerY = 0;
  let spurX = 0; // Lage beim letzten Schritt: Der Zeiger wirkt entlang der ganzen Strecke
  let spurY = 0;

  // Größen des laufenden Schritts, die mehrere Teilschritte lesen
  let zTempo = 0;
  let wirk = 0; // wie stark der Zeiger gerade drückt (0 … 1)
  let sx0 = 0; // Strecke des Zeigers seit dem letzten Schritt: Start, Weg, Länge
  let sy0 = 0;
  let lx = 0;
  let ly = 0;
  let l2 = 0;
  let strecke = 0;
  let halten = 0; // s, seit der Strudel zieht
  let sogWirkt = false;
  let fangR = 0;

  // Sog
  let sog = false;
  let sogSeit = 0;
  let sogDreh = 1;
  let gefangenZahl = 0;
  // Mehr Gefangene fasst die Scheibe sichtbar nicht; darüber hinaus pflügt der Strudel nur noch
  let FANG_MAX = 0;
  let BEIWERK_MAX = 0;

  let wellen: Welle[] = [];
  let spritzer: Spritzer[] = [];
  let uhr = 0;
  let bildNr = 0;

  // Druckringe der Klicks: Mitte, Alter, Stärke
  const ringX = new Float32Array(RING_MAX);
  const ringY = new Float32Array(RING_MAX);
  const ringT = new Float32Array(RING_MAX);
  const ringS = new Float32Array(RING_MAX);
  let ringZahl = 0;

  // Staub im Himmel: Lage, Tempo, Alter, Lebensdauer, Art (0 Tinte bzw. Mondlicht, 1 warm)
  const stX = new Float32Array(STAUB_MAX);
  const stY = new Float32Array(STAUB_MAX);
  const stVX = new Float32Array(STAUB_MAX);
  const stVY = new Float32Array(STAUB_MAX);
  const stAlter = new Float32Array(STAUB_MAX);
  const stDauer = new Float32Array(STAUB_MAX);
  const stWarm = new Uint8Array(STAUB_MAX);
  let staubZahl = 0;
  let staubGemalt = 0;
  let staubSchub = 0; // Staubknall, der im nächsten Schritt aufgeht (Klick oder Loslassen im Himmel)
  let staubSchubX = 0;
  let staubSchubY = 0;

  // Farben, die aus der aktuellen Tabelle folgen (neu bei anderer Tabelle): Schattenstufe je Farbnummer (eine
  // Tinte dunkler, nachts eine heller), nachts die Glanzstufen, Staub nach Abstand zum Papier, warmes Licht
  const schatten = new Int32Array(256);
  const glanz = new Int32Array(4 * 256);
  const staubFarbe = new Int32Array(4);
  let staubWarm = 0;
  let ringDunkel = 0;
  let ringHell = 0;
  let nachts = false;
  let farbenVon: Int32Array | null = null;
  let farbenSumme = -1;
  // Int32-Sichten auf Tabelle und Ausgabe, nur neu, wenn der Renderer einen anderen Puffer reicht
  let tabQuelle: Uint32Array | null = null;
  let tabI = new Int32Array(0);
  let ausQuelle: Uint32Array | null = null;
  let ausI = new Int32Array(0);

  // Maße, die mit dem Zeigerradius wachsen: Dann wirkt das Spiel auf dem Handy wie auf 2560 px
  let FEDER_MAX = 0; // Höchstbeschleunigung der Feder: Weit Geschleuderte fließen gleichmäßig heim
  let DRUECKEN = 0;
  let V_MAX = 0;
  let FUNKEN_AB = 0;
  let FUNKEN_VOLL = 0;
  let LOSE_AB = 0;
  let LOSE_VOLL = 0;
  let WURF = 0;
  let WELLE_TEMPO = 0;
  let WELLE_HOCH = 0; // Hub der vorderen Kette
  let klein = 0; // 0 ab 300 Kunstpixeln Breite, 1 bis 120 (Handy)
  let WELLE_LAENGE = 0;
  let WELLE_AUS = 0; // so weit hinter der Front schwingt es noch
  let WELLE_BAND = 0;
  // Hub der Wellen je Spalte und Ebene (negativ = nach oben), und ob eine Spalte gerade im Wellenzug liegt
  let wu = new Float32Array(0);
  let wZug = new Uint8Array(0);
  let wuBelegt = false;

  function groesse(Bn: number, Hn: number, festN?: number): void {
    B = Math.max(1, Math.round(Bn));
    H = Math.max(1, Math.round(Hn));
    N = B * H;
    fest = Math.min(Math.max(0, H - NAHT), Math.max(0, Math.round(festN ?? nachtAb(H))));
    oben = Math.min(fest, Math.ceil(H * 0.08));
    // Auf kleinen Bildern (Handy) ist der Zeiger ein Finger: Er greift relativ weiter, sonst bewegte er
    // dort nur ein paar Pixel
    R = Math.max(7, 0.045 * B, Math.min(14, 0.08 * B));
    vx = new Float32Array(N);
    vy = new Float32Array(N);
    dx = new Float32Array(N);
    dy = new Float32Array(N);
    marke = new Uint8Array(N);
    zustand = new Uint8Array(N);
    dicht = new Uint8Array(N);
    liste = new Int32Array(N);
    qZiel = new Int32Array(N);
    qQuelle = new Int32Array(N);
    qFarbe = new Int32Array(N);
    qEbene = new Uint8Array(N);
    qWulst = new Float32Array(N);
    qFolge = new Int32Array(N);
    anzahl = 0;
    verschoben = 0;

    Z = Math.max(2, Math.round(R / 4));
    GW = Math.ceil(B / Z) + 1;
    GH = Math.ceil(H / Z) + 1;
    const G = GW * GH;
    su = new Float32Array(G);
    sv = new Float32Array(G);
    su2 = new Float32Array(G);
    sv2 = new Float32Array(G);
    sdruck = new Float32Array(G);
    squelle = new Float32Array(G);
    swirbel = new Float32Array(G);
    zelleWach = new Uint8Array(G);
    zieht = new Uint8Array(G);
    stroemt = false;
    stroemMax = 0;

    zda = false;
    zvx = zvy = 0;
    zSprung = true;
    zRegt = false;
    zBewegt = -1e9;
    sog = false;
    sogWirkt = false;
    wellen = [];
    spritzer = [];
    ringZahl = 0;
    staubZahl = 0;
    staubGemalt = 0;
    staubSchub = 0;

    FEDER_MAX = 60 * R;
    DRUECKEN = 120 * R;
    V_MAX = 26 * R;
    FUNKEN_AB = 5 * R;
    FUNKEN_VOLL = 13 * R;
    LOSE_AB = 2.4 * R;
    WECK2 = Math.max(9, 0.45 * R) ** 2;
    LOSE_VOLL = 7 * R;
    WURF = 13 * R;
    FANG_MAX = Math.max(1500, 14 * R * R);
    // Obergrenze für Pixel, die Strömung und Spritzer zusätzlich wecken (ein Sechstel des Bildes): Sie hält
    // den Schritt auch bei wildem Klicken unter 3 ms; was der Zeiger selbst berührt, bewegt sich immer
    BEIWERK_MAX = Math.max(4000, Math.round(N / 6));
    gefangenZahl = 0;
    WELLE_TEMPO = 0.45 * Math.max(B, 1.6 * H);
    klein = Math.min(1, Math.max(0, (300 - B) / 180));
    WELLE_HOCH = 0.28 * R * (1 + 0.4 * klein);
    WELLE_LAENGE = 4 * R;
    WELLE_AUS = 1.75 * WELLE_LAENGE;
    WELLE_BAND = Math.max(1.5, 0.008 * B + 0.5);
    wu = new Float32Array(B * 4);
    wZug = new Uint8Array(B);
    wuBelegt = false;
  }

  // Während eines Schritts: die Tabelle und die Farbe des Papiers. Ob ein Pixel Himmel ist, entscheidet die
  // sichtbare Farbe, nicht die Rolle: Tagsüber sind Sterne und Dunst Papier und sollen ruhen.
  let tab = new Int32Array(0);
  let papier = 0;
  const himmel = (i: number, bild: Uint8Array, vorn: Uint8Array) => vorn[i] === 0 && tab[bild[i]] === papier;
  // Beweglichkeit eines Pixels: nach Ebene, im Himmel leicht, nur die Scheibe schwer
  const beweglich = (i: number, bild: Uint8Array, vorn: Uint8Array) => {
    const e = vorn[i] & 3;
    return e !== 0 ? MOB[e] : bild[i] === MOND ? MOB[0] : MOB_HIMMEL;
  };

  function wecken(i: number): void {
    if (marke[i] === 0) {
      marke[i] = 1;
      liste[anzahl++] = i;
    }
  }

  // Ein loser Krümel: fliegt mit (vx0, vy0) los, an einer weichen Feder
  function loesen(i: number, vx0: number, vy0: number): void {
    wecken(i);
    vx[i] = vx0;
    vy[i] = vy0;
    zustand[i] = (zustand[i] | LOSE) & ~STROM;
  }

  function sichten(tabelle: Uint32Array, ausgabe: Uint32Array): void {
    if (tabelle !== tabQuelle) {
      tabQuelle = tabelle;
      tabI = new Int32Array(tabelle.buffer, tabelle.byteOffset, tabelle.length);
    }
    if (ausgabe !== ausQuelle) {
      ausQuelle = ausgabe;
      ausI = new Int32Array(ausgabe.buffer, ausgabe.byteOffset, ausgabe.length);
    }
  }

  // Alle Farben, die das Spiel aus der Tabelle ableitet. Gewählt wird nur unter den Farben der Tabelle selbst
  // (Tinten, Silber, Kopie-Gelb, Mischungen) und nach Helligkeit, nicht nach Rolle: So passt es zu jeder
  // Stimmung und zu beiden Themen.
  function farbenBauen(t: Int32Array): void {
    let summe = 0;
    const n = Math.min(t.length, 64);
    for (let r = 0; r < n; r++) summe = (Math.imul(summe, 31) + t[r]) | 0;
    if (t === farbenVon && summe === farbenSumme) return;
    farbenVon = t;
    farbenSumme = summe;
    const tags = hell(t[BOGEN]) > 128;
    nachts = !tags;
    for (let r = 0; r < 256; r++) {
      const c = r < t.length ? t[r] : t[BOGEN];
      const L = hell(c);
      let best = c;
      let bestD = 1e9;
      for (const rolle of TINTEN) {
        const k = t[rolle];
        const d = tags ? L - hell(k) : hell(k) - L;
        if (d > 10 && d < bestD) {
          bestD = d;
          best = k;
        }
      }
      schatten[r] = best;
    }
    // Kalte Töne (Tinte, Silber, Mondlicht) und warme (Kopie-Gelb, Creme), je nach Helligkeit sortiert
    const kalt: number[] = [];
    const warm: number[] = [];
    for (let r = 0; r < n; r++) {
      const c = t[r];
      if (c >>> 24 !== 255) continue;
      const rot = c & 255;
      const blau = (c >>> 16) & 255;
      // Kalt heißt hier: im Farbwinkel der Tinte (deutlich blau), nicht bloß grau; Grau und Mauve sähen nachts
      // im Mondlicht schmutzig aus
      if (blau >= rot + 15) kalt.push(c);
      else if (rot > blau + 30) warm.push(c);
    }
    kalt.sort((a, b) => hell(a) - hell(b));
    const kaltL = kalt.map(hell);
    const Lp = hell(t[BOGEN]);
    // Glanz: die kalte Farbe, die der gewünschten Hebung am nächsten kommt, aber mindestens die halbe Hebung
    for (let r = 0; r < 256; r++) {
      const c = r < t.length ? t[r] : t[BOGEN];
      const L = hell(c);
      for (let k = 0; k < 4; k++) {
        const hub = GLANZ_HUB[k];
        let best = c;
        let bestD = 1e9;
        for (let j = 0; j < kalt.length; j++) {
          const Lf = kaltL[j];
          if (Lf < L + 0.5 * hub) continue;
          const d = Math.abs(Lf - L - hub);
          if (d < bestD) {
            bestD = d;
            best = kalt[j];
          }
        }
        if (bestD === 1e9 && kalt.length && kaltL[kalt.length - 1] > L) best = kalt[kalt.length - 1];
        glanz[k * 256 + r] = best;
      }
    }
    // Staub: vom Papier deutlich abgesetzt bis kaum noch zu sehen (tags dunkler, nachts heller als das Papier)
    const ABSTAND = [150, 112, 76, 42];
    for (let k = 0; k < 4; k++) {
      let best = tags ? t[T4] : t[GLITZER_HELL];
      let bestD = 1e9;
      for (const f of kalt) {
        const a = tags ? Lp - hell(f) : hell(f) - Lp;
        if (a < 20) continue;
        const d = Math.abs(a - ABSTAND[k]);
        if (d < bestD) {
          bestD = d;
          best = f;
        }
      }
      staubFarbe[k] = best;
    }
    // Warmes Licht: das hellste Gelb bzw. Creme der Tabelle
    staubWarm = staubFarbe[1];
    let wl = -1;
    for (const f of warm) {
      const L = hell(f);
      if (L > wl) {
        wl = L;
        staubWarm = f;
      }
    }
    // Druckring: über Hellem dunkle Tinte, über Dunklem Licht
    ringDunkel = staubFarbe[0];
    ringHell = tags ? staubWarm : glanz[3 * 256 + T6];
  }

  /* Strömung --------------------------------------------------------------- */

  // Zellen um (x, y) im Radius r zur Geschwindigkeit (u, v) hinziehen; anteil = Stärke in der Mitte
  function einruehren(x: number, y: number, r: number, u: number, v: number, anteil: number): void {
    const cgx = x / Z - 0.5;
    const cgy = y / Z - 0.5;
    const rz = r / Z;
    const x0 = Math.max(0, Math.ceil(cgx - rz));
    const x1 = Math.min(GW - 1, Math.floor(cgx + rz));
    const y0 = Math.max(0, Math.ceil(cgy - rz));
    const y1 = Math.min(GH - 1, Math.floor(cgy + rz));
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const ex = cx - cgx;
        const ey = cy - cgy;
        const d = Math.sqrt(ex * ex + ey * ey) / rz;
        if (d >= 1) continue;
        const w = (1 - d) * (1 - d) * anteil;
        const k = cy * GW + cx;
        su[k] += (u - su[k]) * w;
        sv[k] += (v - sv[k]) * w;
      }
    }
    stroemt = true;
  }

  // Strudel: kreisende, leicht nach innen ziehende Strömung um (x, y)
  function strudeln(x: number, y: number, r: number, tempo: number, anteil: number): void {
    const cgx = x / Z - 0.5;
    const cgy = y / Z - 0.5;
    const rz = r / Z;
    const x0 = Math.max(0, Math.ceil(cgx - rz));
    const x1 = Math.min(GW - 1, Math.floor(cgx + rz));
    const y0 = Math.max(0, Math.ceil(cgy - rz));
    const y1 = Math.min(GH - 1, Math.floor(cgy + rz));
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const ex = cx - cgx;
        const ey = cy - cgy;
        const d = Math.sqrt(ex * ex + ey * ey);
        const q = d / rz;
        if (q >= 1 || d < 1e-3) continue;
        const w = (1 - q) * anteil;
        const t = tempo * Math.min(1, d / (0.3 * rz));
        const u = ((-ey * sogDreh) / d) * t - (ex / d) * t * 0.35;
        const v = ((ex * sogDreh) / d) * t - (ey / d) * t * 0.35;
        const k = cy * GW + cx;
        su[k] += (u - su[k]) * w;
        sv[k] += (v - sv[k]) * w;
      }
    }
    stroemt = true;
  }

  function stroemungLeeren(): void {
    su.fill(0);
    sv.fill(0);
    sdruck.fill(0);
    zelleWach.fill(0);
    zieht.fill(0);
    stroemt = false;
    stroemMax = 0;
  }

  // Ein Strömungsschritt: Selbstmitnahme, Wirbelverstärkung, Druckausgleich (inkompressibel), Abklingen.
  // Jeder Durchgang ist eine eigene Funktion mit einer einzigen Schleife über das Gitter (Spalte und Zeile
  // laufen als Zähler mit): Verschachtelte Schleifen ließ V8 nur per OSR optimieren und warf den Code beim
  // Verlassen der inneren Schleife jedes Mal wieder weg.
  function stroemen(dt: number): void {
    mitnehmen(dt / Z);
    let t = su;
    su = su2;
    su2 = t;
    t = sv;
    sv = sv2;
    sv2 = t;
    wirbelMessen();
    wirbelStaerken(WIRBEL * dt);
    quellenMessen();
    for (let n = 0; n < DRUCK_SCHRITTE; n++) druckGlaetten();
    const max = druckAbziehen(Math.exp(-STROEMUNG_ABKLINGEN * dt));
    stroemMax = max;
    // Abgeklungen: Gitter leeren, damit das Spiel wieder billig wird
    if (max < 2.25) stroemungLeeren();
  }

  // Selbstmitnahme (semi-Lagrange): Jede Zelle holt ihre Geschwindigkeit von dort, wo sie herkam
  function mitnehmen(f: number): void {
    const gw = GW;
    const gwm = GW - 1;
    const ghm = GH - 1;
    const G = GW * GH;
    const u0 = su;
    const v0 = sv;
    const u2 = su2;
    const v2 = sv2;
    for (let k = 0, cx = 0, cy = 0; k < G; k++) {
      let x = cx - u0[k] * f;
      let y = cy - v0[k] * f;
      x = x < 0 ? 0 : x > gwm ? gwm : x;
      y = y < 0 ? 0 : y > ghm ? ghm : y;
      const x0 = x | 0;
      const y0 = y | 0;
      const x1 = x0 < gwm ? x0 + 1 : x0;
      const y1 = y0 < ghm ? y0 + 1 : y0;
      const ax = x - x0;
      const ay = y - y0;
      const a = y0 * gw;
      const b = y1 * gw;
      u2[k] = (u0[a + x0] * (1 - ax) + u0[a + x1] * ax) * (1 - ay) + (u0[b + x0] * (1 - ax) + u0[b + x1] * ax) * ay;
      v2[k] = (v0[a + x0] * (1 - ax) + v0[a + x1] * ax) * (1 - ay) + (v0[b + x0] * (1 - ax) + v0[b + x1] * ax) * ay;
      if (++cx === gw) {
        cx = 0;
        cy++;
      }
    }
  }

  // Wirbelstärke im Inneren
  function wirbelMessen(): void {
    const gw = GW;
    const G = GW * GH;
    const u = su;
    const v = sv;
    const w = swirbel;
    for (let k = gw, cx = 0; k < G - gw; k++) {
      if (cx > 0 && cx < gw - 1) w[k] = 0.5 * (v[k + 1] - v[k - 1] - u[k + gw] + u[k - gw]);
      if (++cx === gw) cx = 0;
    }
  }

  // Wirbelverstärkung (vorticity confinement): hält die Wirbel hinter dem Zeiger am Leben
  function wirbelStaerken(eps: number): void {
    const gw = GW;
    const G = GW * GH;
    const u = su;
    const v = sv;
    const s = swirbel;
    for (let k = 2 * gw, cx = 0; k < G - 2 * gw; k++) {
      const w = s[k];
      if (cx >= 2 && cx < gw - 2 && w !== 0) {
        const nx = Math.abs(s[k + 1]) - Math.abs(s[k - 1]);
        const ny = Math.abs(s[k + gw]) - Math.abs(s[k - gw]);
        const l = Math.sqrt(nx * nx + ny * ny) + 1e-5;
        u[k] += eps * (ny / l) * w;
        v[k] -= eps * (nx / l) * w;
      }
      if (++cx === gw) cx = 0;
    }
  }

  // Quellen (Divergenz), am Rand gespiegelt
  function quellenMessen(): void {
    const gw = GW;
    const gwm = GW - 1;
    const ghm = GH - 1;
    const G = GW * GH;
    const u = su;
    const v = sv;
    const q = squelle;
    for (let k = 0, cx = 0, cy = 0; k < G; k++) {
      const ul = cx > 0 ? u[k - 1] : -u[k];
      const ur = cx < gwm ? u[k + 1] : -u[k];
      const vo = cy > 0 ? v[k - gw] : -v[k];
      const vu = cy < ghm ? v[k + gw] : -v[k];
      q[k] = 0.5 * (ur - ul + vu - vo);
      if (++cx === gw) {
        cx = 0;
        cy++;
      }
    }
  }

  // Ein Jacobi-Schritt für den Druck
  function druckGlaetten(): void {
    const gw = GW;
    const gwm = GW - 1;
    const ghm = GH - 1;
    const G = GW * GH;
    const d = sdruck;
    const q = squelle;
    for (let k = 0, cx = 0, cy = 0; k < G; k++) {
      const p = d[k];
      const l = cx > 0 ? d[k - 1] : p;
      const r = cx < gwm ? d[k + 1] : p;
      const o = cy > 0 ? d[k - gw] : p;
      const un = cy < ghm ? d[k + gw] : p;
      d[k] = (l + r + o + un - q[k]) * 0.25;
      if (++cx === gw) {
        cx = 0;
        cy++;
      }
    }
  }

  // Druckgefälle abziehen (macht die Strömung quellenfrei) und abklingen lassen. Rückgabe: größtes Tempo²
  function druckAbziehen(abkl: number): number {
    const gw = GW;
    const gwm = GW - 1;
    const ghm = GH - 1;
    const G = GW * GH;
    const d = sdruck;
    const u = su;
    const v = sv;
    const z = zieht;
    const weck2 = WECK2;
    let max = 0;
    for (let k = 0, cx = 0, cy = 0; k < G; k++) {
      const p = d[k];
      const l = cx > 0 ? d[k - 1] : p;
      const r = cx < gwm ? d[k + 1] : p;
      const o = cy > 0 ? d[k - gw] : p;
      const un = cy < ghm ? d[k + gw] : p;
      const a = (u[k] - 0.5 * (r - l)) * abkl;
      const b = (v[k] - 0.5 * (un - o)) * abkl;
      u[k] = a;
      v[k] = b;
      const q = a * a + b * b;
      if (q > max) max = q;
      z[k] = q > weck2 ? 1 : 0;
      d[k] *= 0.9;
      if (++cx === gw) {
        cx = 0;
        cy++;
      }
    }
    return max;
  }

  // Zellen, in denen die Strömung merklich zieht, wecken ihre Pixel (nur beim Anspringen der Zelle)
  // Erst ab diesem Tempo nimmt die Strömung Pixel mit: Leises Driften um einen Bruchteil eines Pixels brächte
  // nur Schraffuren ins Raster
  let WECK2 = 49;
  function zellenWecken(bild: Uint8Array, vorn: Uint8Array): void {
    // Die Strömung ist Beiwerk: Sind schon sehr viele Pixel unterwegs, weckt sie keine weiteren
    if (anzahl >= BEIWERK_MAX) return;
    // Eine Schleife über die Zellen (Spalte und Zeile als Zähler), die Pixel einer Zelle in eigener Funktion:
    // so optimiert V8 beides für sich, ohne OSR in verschachtelten Schleifen
    const gw = GW;
    const G = Math.min(GW * GH, Math.ceil(fest / Z) * GW);
    const weck2 = WECK2;
    for (let k = 0, cx = 0, cy = 0; k < G; k++) {
      const q = su[k] * su[k] + sv[k] * sv[k];
      if (q < weck2) zelleWach[k] = 0;
      else if (zelleWach[k] === 0) {
        zelleWach[k] = 1;
        zelleWecken(cx * Z, cy * Z, q, bild, vorn);
      }
      if (++cx === gw) {
        cx = 0;
        cy++;
      }
    }
  }

  function zelleWecken(px0: number, py0: number, q: number, bild: Uint8Array, vorn: Uint8Array): void {
    const px1 = Math.min(B, px0 + Z);
    const py1 = Math.min(fest, py0 + Z);
    for (let y = py0; y < py1; y++) {
      for (let x = px0; x < px1; x++) {
        const i = y * B + x;
        if (marke[i] !== 0 || himmel(i, bild, vorn)) continue;
        const m = beweglich(i, bild, vorn);
        if (m * m * q < WECK2) continue;
        marke[i] = 1;
        liste[anzahl++] = i;
        zustand[i] |= STROM;
      }
    }
  }

  // Strömung an einer Stelle (bilinear), in su0/sv0
  let su0 = 0;
  let sv0 = 0;
  function stroemungBei(px: number, py: number): void {
    let qx = px / Z - 0.5;
    let qy = py / Z - 0.5;
    const gwm = GW - 1;
    const ghm = GH - 1;
    qx = qx < 0 ? 0 : qx > gwm ? gwm : qx;
    qy = qy < 0 ? 0 : qy > ghm ? ghm : qy;
    const x0 = qx | 0;
    const y0 = qy | 0;
    const x1 = x0 < gwm ? x0 + 1 : x0;
    const y1 = y0 < ghm ? y0 + 1 : y0;
    const bx = qx - x0;
    const by = qy - y0;
    const a = y0 * GW;
    const b = y1 * GW;
    su0 = (su[a + x0] * (1 - bx) + su[a + x1] * bx) * (1 - by) + (su[b + x0] * (1 - bx) + su[b + x1] * bx) * by;
    sv0 = (sv[a + x0] * (1 - bx) + sv[a + x1] * bx) * (1 - by) + (sv[b + x0] * (1 - bx) + sv[b + x1] * bx) * by;
  }

  /* Wellen ----------------------------------------------------------------- */

  // Alle Pixel im Ring r0 ≤ d < r1 um (x, y) besuchen, Zeile für Zeile nur die beiden Bogenstücke
  function ring(x: number, y: number, r0: number, r1: number, besuch: (i: number, px: number, py: number, d: number) => void): void {
    const a2 = r0 * r0;
    const b2 = r1 * r1;
    const ya = Math.max(oben, Math.ceil(y - r1));
    const yb = Math.min(fest - 1, Math.floor(y + r1));
    for (let py = ya; py <= yb; py++) {
      const ey = py - y;
      const rest1 = b2 - ey * ey;
      if (rest1 < 0) continue;
      const xa = Math.sqrt(rest1);
      const rest0 = a2 - ey * ey;
      const xi = rest0 > 0 ? Math.sqrt(rest0) : -1;
      for (let seite = 0; seite < 2; seite++) {
        let lo: number;
        let hi: number;
        if (xi < 0) {
          if (seite === 1) break;
          lo = Math.ceil(x - xa);
          hi = Math.floor(x + xa);
        } else if (seite === 0) {
          lo = Math.ceil(x - xa);
          hi = Math.floor(x - xi) + 1;
        } else {
          lo = Math.ceil(x + xi) - 1;
          hi = Math.floor(x + xa);
        }
        if (lo < 0) lo = 0;
        if (hi > B - 1) hi = B - 1;
        for (let px = lo; px <= hi; px++) {
          const ex = px - x;
          const d2 = ex * ex + ey * ey;
          if (d2 < a2 || d2 >= b2) continue;
          besuch(py * B + px, px, py, Math.sqrt(d2));
        }
      }
    }
  }

  // Alle Spalten im Abstand r0 ≤ |x − w.x| < r1 links und rechts der Klickstelle
  function spalten(w: Welle, r0: number, r1: number, besuch: (x: number, d: number) => void): void {
    for (let x = Math.max(0, Math.floor(w.x - r1) + 1); x <= Math.min(B - 1, Math.floor(w.x - r0)); x++) besuch(x, w.x - x);
    for (let x = Math.max(0, Math.ceil(w.x + r0)); x <= Math.min(B - 1, Math.ceil(w.x + r1) - 1); x++) besuch(x, x - w.x);
  }

  // Die Welle läuft von der Klickstelle nach links und rechts die Ketten entlang: ein Wellenzug aus Berg und
  // Tal, der jede Spalte einmal kurz schwingen lässt, wie eine Wasseroberfläche. Der Hub ist vorgegeben, nicht
  // gerechnet, und hebt die ganze Spalte samt allen Ketten gemeinsam; nur der Himmel bleibt stehen. So dehnt
  // sich nichts, keine Kette löst sich von der nächsten, es reißt kein Spalt, und hinter dem Zug liegt das
  // Raster sofort wieder heil. (Je Ebene gestaffelt sah es tiefer aus, ließ aber den Himmel durch die Ketten
  // tropfen.)
  function wellenRechnen(dt: number): void {
    wu.fill(0);
    wZug.fill(0);
    wuBelegt = true;
    const k = (2 * Math.PI) / WELLE_LAENGE;
    let n = 0;
    for (const w of wellen) {
      w.r += WELLE_TEMPO * dt;
      const hoch = (WELLE_HOCH * w.staerke) / (1 + w.r / (0.5 * B));
      spalten(w, Math.max(0, w.r - WELLE_AUS), w.r, (x, d) => {
        const s = w.r - d;
        const huelle = 1 - s / WELLE_AUS;
        const g = Math.sin(k * s) * huelle * Math.sqrt(huelle) * hoch;
        wu[x * 4 + 1] -= g;
        wu[x * 4 + 2] -= g;
        wu[x * 4 + 3] -= g;
        wZug[x] = 1;
      });
      // durchgelaufene Wellen fallen heraus (an Ort und Stelle, ohne neues Feld)
      if (w.r - WELLE_AUS < w.ende) wellen[n++] = w;
    }
    wellen.length = n;
  }

  // Grundbild der Spalten im Wellenzug: Alles außer dem Himmel rückt um den Hub der Spalte. Das kostet je
  // Pixel nur einen Blick; die Physik rechnet nur, was der Zeiger zusätzlich bewegt.
  function wellenMalen(bild: Uint8Array, vorn: Uint8Array, aus: Int32Array): number {
    let bewegt = 0;
    for (let x = 0; x < B; x++) {
      if (!wZug[x]) continue;
      const k = Math.round(wu[x * 4 + 1]);
      if (k !== 0) bewegt += spalteRuecken(x, k, bild, vorn, aus);
    }
    return bewegt;
  }

  function spalteRuecken(x: number, k: number, bild: Uint8Array, vorn: Uint8Array, aus: Int32Array): number {
    let bewegt = 0;
    const t = tab;
    const tinte = t[T6];
    for (let y = oben, o = oben * B + x; y < fest; y++, o += B) {
      const sy = y - k;
      let farbe: number;
      if (sy >= fest) farbe = tinte; // von unten rückt die Nacht-Tinte nach
      else if (sy < 0) continue;
      else {
        const q = sy * B + x;
        // Himmel und was in ihm steht (Sonne, Wolken) bleibt; Land rückt, auch über den Himmel
        if (vorn[q] === 0 && vorn[o] === 0) continue;
        farbe = t[bild[q]];
      }
      if (aus[o] !== farbe) bewegt++;
      aus[o] = farbe;
    }
    return bewegt;
  }

  // Licht auf den Wellenbergen: Wo der Zug die Grate hebt, glänzen ihre Kanten, an der Front blitzt es kurz.
  // Tags Gelb und Weiß, nachts Creme und Silber, gerastert und mit dem Weg schwächer. Gemalt wird an der
  // gehobenen Stelle und nur, wo die Kante auch zu sehen ist (nicht hinter einer näheren Kette).
  function welleLeuchten(w: Welle, bild: Uint8Array, vorn: Uint8Array, aus: Int32Array, licht: number, lichtHell: number): void {
    const einlauf = Math.min(1, (w.r + 1) / (1.5 * R));
    const I = Math.min(1.2, 0.5 + 0.55 * w.staerke) * Math.pow(Math.max(0, 1 - w.r / w.ende), 0.7) * einlauf;
    if (I < 0.04) return;
    const v = bildNr & 7;
    const k = (2 * Math.PI) / WELLE_LAENGE;
    const t = tab;
    spalten(w, Math.max(0, w.r - 0.5 * WELLE_LAENGE), w.r, (x, d) => {
      const s = w.r - d;
      // Front: kurzer Blitz; danach Glanz, solange der Grat oben ist
      const front = s < WELLE_BAND ? 1 - (0.5 * s) / WELLE_BAND : 0;
      const berg = Math.max(0, Math.sin(k * s));
      const glanzW = I * Math.max(front, 0.8 * berg);
      if (glanzW < 0.03) return;
      let unter = 0;
      let stufeGrat = 0;
      for (let i = x, y = 0; y < fest; y++, i += B) {
        const e = vorn[i] & 3;
        if (e === 0) {
          unter = 0;
          continue;
        }
        // Nur echte Kanten: darüber Fernes, darunter dieselbe Kette (ein gerastertes Ende glänzt nicht)
        const grat = (y === 0 || (vorn[i - B] & 3) < e) && y + 1 < fest && (vorn[i + B] & 3) === e;
        let stufe: number;
        if (grat) {
          stufeGrat = glanzW * (0.6 + 0.4 * MOB[e]);
          stufe = stufeGrat;
          unter = 1;
        } else if (unter > 0 && unter <= 2) {
          stufe = stufeGrat * (unter === 1 ? 0.5 : 0.2);
          unter++;
        } else continue;
        const ty = y + Math.round(wu[x * 4 + e]);
        if (ty < oben || ty >= fest) continue;
        const z = ty * B + x;
        if (aus[z] !== t[bild[i]]) continue;
        const schwelle = SCHWELLE[((ty + v) & 7) * 8 + ((x + v * 5) & 7)];
        if (stufe > schwelle) aus[z] = grat && stufe > schwelle + 0.35 ? lichtHell : licht;
      }
    });
  }

  // An der Klickstelle springen Pixel auf wie Wasser, in das ein Stein fällt: Innen fliegt fast alles als
  // Krümel hoch und öffnet einen Krater, außen werden sie fortgestoßen
  function spritzen(s: Spritzer, bild: Uint8Array, vorn: Uint8Array): void {
    // Auf kleinen Bildern ist der Tipp die einzige Geste (Handy): Dort spritzt es weiter
    const st = Math.min(1.5, s.staerke);
    // Sind schon viele Pixel unterwegs (wildes Klicken), wird der Krater kleiner statt den Schritt zu sprengen
    const frei = BEIWERK_MAX - anzahl;
    if (frei <= 0) return;
    const rs = Math.min(R * (1.05 + 0.3 * Math.min(1, st)) * (1 + 0.3 * klein), Math.max(0.6 * R, Math.sqrt(frei / Math.PI)));
    const k = 0.75 + 0.45 * st;
    ring(s.x, s.y, 0, rs, (i, px, py, d) => {
      if (himmel(i, bild, vorn)) return;
      const q = 1 - d / rs;
      const ex = (px - s.x) / (d + 1e-3);
      const ey = (py - s.y) / (d + 1e-3);
      const m = beweglich(i, bild, vorn);
      if (Math.random() < (q > 0.3 ? 0.95 : 0.2)) {
        const auf = (3.5 + 7.5 * Math.random()) * R * k * m;
        const seit = (1.5 + 3.5 * Math.random()) * R * k * m;
        loesen(i, ex * seit + (Math.random() - 0.5) * 1.5 * R, ey * seit * 0.5 - auf);
      } else {
        wecken(i);
        zustand[i] &= ~STROM;
        vx[i] += ex * 3.5 * R * q * m;
        vy[i] += ey * 3.5 * R * q * m;
      }
    });
  }

  function welleStarten(x: number, y: number, staerke: number, mitSpritzer: boolean): void {
    if (N === 0 || !Number.isFinite(x) || !Number.isFinite(y)) return;
    // Weit außerhalb liefe die Welle endlos: auf das Bild samt Rand begrenzen
    x = Math.max(-R, Math.min(B + R, x));
    y = Math.max(-R, Math.min(H + R, y));
    const st = Math.max(0, Math.min(3, Number.isFinite(staerke) ? staerke : 1));
    const ende = Math.max(x, B - x) + 1;
    wellen.push({ x, y, r: 0, staerke: st, ende });
    if (wellen.length > 6) wellen.shift();
    if (mitSpritzer && st > 0) {
      spritzer.push({ x, y, staerke: st });
      if (spritzer.length > 4) spritzer.shift();
      // Druckring und Staubknall an der Klickstelle
      if (ringZahl === RING_MAX) {
        for (let k = 1; k < RING_MAX; k++) {
          ringX[k - 1] = ringX[k];
          ringY[k - 1] = ringY[k];
          ringT[k - 1] = ringT[k];
          ringS[k - 1] = ringS[k];
        }
        ringZahl--;
      }
      ringX[ringZahl] = x;
      ringY[ringZahl] = y;
      ringT[ringZahl] = 0;
      ringS[ringZahl] = Math.min(1.5, st);
      ringZahl++;
      staubSchub = Math.max(staubSchub, 0.6 + 0.5 * Math.min(1.5, st));
      staubSchubX = x;
      staubSchubY = y;
    }
  }

  /* Staub im Himmel -------------------------------------------------------- */

  function staubSetzen(x: number, y: number, vx0: number, vy0: number, warm: boolean, dauer: number): void {
    let k = staubZahl;
    if (k >= STAUB_MAX) {
      // voll: ein zufälliges Teilchen ersetzen, dann bleibt die Spur auch bei wildem Wischen gleichmäßig
      k = (Math.random() * STAUB_MAX) | 0;
    } else staubZahl++;
    stX[k] = x;
    stY[k] = y;
    stVX[k] = vx0;
    stVY[k] = vy0;
    stAlter[k] = 0;
    stDauer[k] = dauer;
    stWarm[k] = warm ? 1 : 0;
  }

  // Ein Teilchen entsteht nur im freien Himmel: Was dort steht (Wolke, Hof, Stern), gibt ihm seinen Ton
  function staubFrei(x: number, y: number, vorn: Uint8Array): number {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || px >= B || py <= oben || py >= fest) return -1;
    const i = py * B + px;
    return vorn[i] === 0 ? i : -1;
  }
  const warmBei = (i: number, bild: Uint8Array) => {
    const c = tab[bild[i]];
    return (c & 255) > ((c >>> 16) & 255) + 30;
  };

  // Der Zeiger wirbelt entlang seiner Strecke Staub auf; im Strudel zieht der Rand Staub nach innen;
  // ein Klick oder ein Knall im Himmel lässt einen Kranz aufgehen
  function staubAufwirbeln(bild: Uint8Array, vorn: Uint8Array): void {
    if (zda && wirk > 0.05 && !sogWirkt && strecke > 0.15) {
      const zahl = Math.min(90, Math.round(strecke * 0.16 * R * (0.4 + 0.6 * Math.min(1, zTempo / (5 * R)))));
      for (let n = 0; n < zahl; n++) {
        const a = Math.random();
        const w = Math.random() * 2 * Math.PI;
        const r = Math.sqrt(Math.random()) * 0.9 * R;
        const x = sx0 + lx * a + Math.cos(w) * r;
        const y = sy0 + ly * a + Math.sin(w) * r;
        const i = staubFrei(x, y, vorn);
        if (i < 0) continue;
        const v = (0.5 + 1.6 * Math.random()) * R * (r / R + 0.3);
        staubSetzen(x, y, Math.cos(w) * v + zvx * 0.3, Math.sin(w) * v + zvy * 0.3 - 0.3 * R, warmBei(i, bild) || Math.random() < 0.1, 0.7 + 0.9 * Math.random());
      }
    }
    if (sogWirkt && zda) {
      // Im Strudel: Staub vom Rand der Scheibe, er kreist hinein
      for (let n = 0; n < 10; n++) {
        const w = Math.random() * 2 * Math.PI;
        const r = fangR * (1.3 + 1.2 * Math.random());
        const x = gx + Math.cos(w) * r;
        const y = gy + Math.sin(w) * r;
        const i = staubFrei(x, y, vorn);
        if (i < 0) continue;
        const v = DREHUNG * r * 0.6;
        staubSetzen(x, y, -Math.sin(w) * v * sogDreh, Math.cos(w) * v * sogDreh, warmBei(i, bild) || Math.random() < 0.15, 1.2 + 0.8 * Math.random());
      }
    }
    if (staubSchub > 0) {
      const zahl = Math.round(140 * staubSchub * (R / 16));
      for (let n = 0; n < zahl; n++) {
        const w = Math.random() * 2 * Math.PI;
        const r = Math.random() * 0.5 * R;
        const x = staubSchubX + Math.cos(w) * r;
        const y = staubSchubY + Math.sin(w) * r;
        const i = staubFrei(x, y, vorn);
        if (i < 0) continue;
        const v = (0.35 + 0.65 * Math.random()) * WURF * 0.55 * staubSchub;
        staubSetzen(x, y, Math.cos(w) * v, Math.sin(w) * v, warmBei(i, bild) || Math.random() < 0.2, 0.6 + 0.8 * Math.random());
      }
      staubSchub = 0;
    }
  }

  // Staub folgt der Strömung, weicht dem Zeiger, kreist im Strudel und sinkt nicht: Er schwebt aus
  function staubBewegen(dt: number): void {
    const druecktNoch = zda && wirk > 0.02 && !sogWirkt;
    const R2 = R * R;
    const reib = Math.exp(-2.2 * dt);
    const mit = Math.min(1, 3.5 * dt);
    const druckS = DRUECKEN * 0.35 * wirk;
    let n = staubZahl;
    for (let k = 0; k < n; k++) {
      let x = stX[k];
      let y = stY[k];
      let u = stVX[k];
      let v = stVY[k];
      if (stroemt) {
        stroemungBei(x, y);
        u += (su0 - u) * mit;
        v += (sv0 - v) * mit;
      }
      if (druecktNoch) {
        const ex = x - gx;
        const ey = y - gy;
        const d2 = ex * ex + ey * ey;
        if (d2 < R2 && d2 > 1e-4) {
          const d = Math.sqrt(d2);
          const s = druckS * (1 - d / R) * dt;
          u += (ex / d) * s;
          v += (ey / d) * s;
        }
      }
      if (sogWirkt && zda) {
        // auf einer Spirale hinein, innen schneller
        const ex = gx - x;
        const ey = gy - y;
        const d = Math.sqrt(ex * ex + ey * ey) + 1e-3;
        const soll = DREHUNG * Math.min(d, 3 * fangR) * Math.sqrt(fangR / Math.max(d, 0.3 * fangR));
        const tu = (-ey / d) * sogDreh * soll + (ex / d) * soll * 0.3;
        const tv = (ex / d) * sogDreh * soll + (ey / d) * soll * 0.3;
        u += (tu - u) * Math.min(1, 6 * dt);
        v += (tv - v) * Math.min(1, 6 * dt);
        // In der Mitte verschluckt
        if (d < 0.35 * fangR) stAlter[k] = stDauer[k];
      }
      u *= reib;
      v *= reib;
      x += u * dt;
      y += v * dt;
      const alter = stAlter[k] + dt;
      if (alter >= stDauer[k] || x < 0 || x > B - 1 || y < oben || y > fest - 1) {
        // ausbuchen: das letzte Teilchen rückt auf diesen Platz
        n--;
        stX[k] = stX[n];
        stY[k] = stY[n];
        stVX[k] = stVX[n];
        stVY[k] = stVY[n];
        stAlter[k] = stAlter[n];
        stDauer[k] = stDauer[n];
        stWarm[k] = stWarm[n];
        k--;
        continue;
      }
      stX[k] = x;
      stY[k] = y;
      stVX[k] = u;
      stVY[k] = v;
      stAlter[k] = alter;
    }
    staubZahl = n;
  }

  // Staub liegt im Himmel hinter den Bergen: gemalt wird nur, wo unbewegter Himmel zu sehen ist. Er beginnt
  // kräftig und verblasst gerastert; warmer Staub leuchtet erst gelb (nachts Creme). Nachts funkelt er.
  function staubMalen(bild: Uint8Array, vorn: Uint8Array, aus: Int32Array): number {
    const t = tab;
    const v = bildNr & 7;
    const flirr = bildNr >> 1;
    let gemalt = 0;
    for (let k = 0; k < staubZahl; k++) {
      const px = Math.round(stX[k]);
      const py = Math.round(stY[k]);
      if (py < oben || py >= fest || px < 0 || px >= B) continue;
      const z = py * B + px;
      if (vorn[z] !== 0 || aus[z] !== t[bild[z]]) continue;
      const a = stAlter[k] / stDauer[k];
      const schwelle = SCHWELLE[((py + v) & 7) * 8 + ((px + v * 3) & 7)];
      if (a > 0.6 && (a - 0.6) * 2.5 > schwelle) continue;
      let farbe: number;
      if (stWarm[k] && a < 0.55) farbe = staubWarm;
      else farbe = staubFarbe[a < 0.25 ? 0 : a < 0.5 ? 1 : a < 0.75 ? 2 : 3];
      if (nachts && streu(k, flirr) < 0.12) farbe = glanz[3 * 256 + bild[z]];
      if (farbe === aus[z]) continue;
      aus[z] = farbe;
      gemalt++;
    }
    return gemalt;
  }

  // Druckring: Vom Klick läuft ein gerasterter Ring nach außen, über Hellem in Tinte, über Dunklem in Licht
  const RING_DAUER = 0.55;
  function ringeMalen(dt: number, aus: Int32Array): number {
    let gemalt = 0;
    let n = 0;
    const v = bildNr & 7;
    for (let k = 0; k < ringZahl; k++) {
      const alt = ringT[k] + dt;
      if (alt >= RING_DAUER) continue;
      ringX[n] = ringX[k];
      ringY[n] = ringY[k];
      ringS[n] = ringS[k];
      ringT[n] = alt;
      n++;
      const u = alt / RING_DAUER;
      const rmax = R * (2.3 + 0.9 * ringS[k]) * (1 + 0.3 * klein);
      const r = rmax * (1 - (1 - u) * (1 - u) * (1 - u));
      const breite = 0.8 + 1.4 * (1 - u);
      const dichte = (1 - u) * (0.75 + 0.25 * Math.min(1, ringS[k]));
      ring(ringX[k], ringY[k], Math.max(0, r - breite), r + breite, (i, px, py, d) => {
        const kante = 1 - Math.abs(d - r) / breite;
        if (kante * dichte <= SCHWELLE[((py + v) & 7) * 8 + ((px + v * 5) & 7)]) return;
        aus[i] = hell(aus[i]) > 140 ? ringDunkel : ringHell;
        gemalt++;
      });
    }
    ringZahl = n;
    return gemalt;
  }

  /* Ereignisse ------------------------------------------------------------- */

  function zeiger(x: number, y: number, jetzt: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (!zda || jetzt - zZeit > 120) {
      zvx = zvy = 0;
      zSprung = true;
    } else {
      const zt = Math.max(4, jetzt - zZeit) / 1000;
      zvx += ((x - zx) / zt - zvx) * 0.6;
      zvy += ((y - zy) / zt - zvy) * 0.6;
      const v = Math.sqrt(zvx * zvx + zvy * zvy);
      if (v > V_MAX) {
        zvx *= V_MAX / v;
        zvy *= V_MAX / v;
      }
    }
    // Bewegt hat sich der Zeiger erst, wenn er ein halbes Kunstpixel von der zuletzt wirksamen Lage abrückt.
    // Meldungen ohne Bewegung (aufliegende Hand, Sensorrauschen, Chromes pointermove nach dem Scrollen) wecken
    // das Spiel nicht, sonst drückte die Delle immer wieder neu und das Bild käme nie zur Ruhe.
    if (!zda || Math.abs(x - zAnkerX) + Math.abs(y - zAnkerY) > 0.5) {
      zRegt = true;
      zAnkerX = x;
      zAnkerY = y;
    }
    zx = x;
    zy = y;
    zZeit = jetzt;
    zda = true;
    zNeu = true;
  }

  function druck(an: boolean): void {
    if (an) {
      if (sog) return;
      sog = true;
      sogSeit = uhr;
      // Der Strudel dreht in die Richtung, in die der Zeiger zuletzt zog
      sogDreh = zvx < -1 ? -1 : 1;
      return;
    }
    if (!sog) return;
    sog = false;
    sogWirkt = false;
    gefangenZahl = 0;
    const gehalten = uhr - sogSeit;
    // Erst bewusstes Halten knallt, und die Wucht blendet von dort weich ein. Ohne Zeiger (der Strudel löst
    // sich von selbst) gibt es keinen Knall, die Pixel fließen nur heim.
    const knall = gehalten > KNALL_AB && zda;
    const wucht = 0.25 + 0.75 * Math.min(1, (gehalten - KNALL_AB) / 0.6);
    for (let k = 0; k < anzahl; k++) {
      const i = liste[k];
      if (marke[i] !== 2) continue;
      marke[i] = 1;
      if (!knall) continue;
      const y = (i / B) | 0;
      const ex = i - y * B + dx[i] - gx;
      const ey = y + dy[i] - gy;
      const d = Math.sqrt(ex * ex + ey * ey) + 1e-3;
      const v = WURF * wucht * (0.35 + 0.9 * streu(i, 0x51ed));
      vx[i] = vx[i] * 0.4 + (ex / d) * v;
      vy[i] = vy[i] * 0.4 + (ey / d) * v;
      // Ein Teil fliegt als loser Krümel weiter hinaus: Das gibt der Explosion Tiefe
      if (streu(i, 0x1f3) < 0.22 * wucht) zustand[i] |= LOSE;
    }
    if (knall) {
      welleStarten(gx, gy, 0.5 + 0.9 * wucht, false);
      // Der Staub, der im Strudel kreist, fliegt mit fort, und ein neuer Kranz geht auf
      for (let k = 0; k < staubZahl; k++) {
        const ex = stX[k] - gx;
        const ey = stY[k] - gy;
        const d = Math.sqrt(ex * ex + ey * ey) + 1e-3;
        const v = WURF * wucht * (0.4 + 0.6 * streu(k, 0x3a7));
        stVX[k] = (ex / d) * v;
        stVY[k] = (ey / d) * v;
        stAlter[k] = 0;
      }
      staubSchub = Math.max(staubSchub, 0.8 * wucht + 0.3);
      staubSchubX = gx;
      staubSchubY = gy;
      // Druck nach außen auch in der Strömung: Die Umgebung weicht der Explosion
      const r = 2.4 * R;
      for (let a = 0; a < 12; a++) {
        const w = (a / 12) * Math.PI * 2;
        einruehren(gx + Math.cos(w) * r * 0.6, gy + Math.sin(w) * r * 0.6, r * 0.6, Math.cos(w) * WURF * 0.5 * wucht, Math.sin(w) * WURF * 0.5 * wucht, 0.6);
      }
    }
  }

  function weg(): void {
    if (sog) druck(false);
    zda = false;
    zvx = zvy = 0;
  }

  function stoss(x: number, y: number, staerke = 1): void {
    welleStarten(x, y, staerke, true);
  }

  // Ein stehender Zeiger drückt nur kurz nach; dann lässt er los und das Bild darf ruhen
  const zeigerWirkt = () => zda && (zRegt || uhr - zBewegt < STILL_NACH + 4 * STILL_ABKLINGEN);

  function aktiv(): boolean {
    return sog || anzahl > 0 || stroemt || wellen.length > 0 || spritzer.length > 0 || staubZahl > 0 || ringZahl > 0 || staubSchub > 0 || zeigerWirkt();
  }

  function zuruecksetzen(): void {
    for (let k = 0; k < anzahl; k++) {
      const i = liste[k];
      dx[i] = dy[i] = vx[i] = vy[i] = 0;
      marke[i] = zustand[i] = dicht[i] = 0;
    }
    anzahl = 0;
    verschoben = 0;
    wellen = [];
    spritzer = [];
    ringZahl = 0;
    staubZahl = 0;
    staubSchub = 0;
    sog = false;
    sogWirkt = false;
    gefangenZahl = 0;
    zda = false;
    if (stroemt) stroemungLeeren();
  }

  /* Schritt ---------------------------------------------------------------- */

  // Zeiger geglättet nachführen; ohne neue Meldung bleibt er stehen, sein Tempo klingt rasch ab. Dazu die
  // Strecke seit dem letzten Schritt, entlang der er wirkt, und der Strudel.
  function zeigerNachfuehren(dt: number): void {
    if (zda) {
      if (zSprung) {
        gx = spurX = zx;
        gy = spurY = zy;
        zSprung = false;
      } else {
        const a = 1 - Math.exp(-dt / GLAETTEN);
        gx += (zx - gx) * a;
        gy += (zy - gy) * a;
      }
    }
    if (zRegt) {
      zBewegt = uhr;
      zRegt = false;
    }
    if (!zNeu) {
      const a = Math.exp(-14 * dt);
      zvx *= a;
      zvy *= a;
    }
    zNeu = false;
    zTempo = Math.sqrt(zvx * zvx + zvy * zvy);
    const still = uhr - zBewegt - STILL_NACH;
    wirk = zda ? (still > 0 ? Math.exp(-still / STILL_ABKLINGEN) : 1) : 0;

    // Die Strecke seit dem letzten Schritt: Der Zeiger wirkt entlang der ganzen Strecke, auch bei schnellem Wisch
    sx0 = spurX;
    sy0 = spurY;
    lx = gx - sx0;
    ly = gy - sy0;
    l2 = lx * lx + ly * ly;
    strecke = Math.sqrt(l2);
    // Strömung anstoßen, ebenfalls entlang der Strecke; die Strömung folgt dem Zeiger mit halbem Tempo
    if (zda && zTempo > 2 * R) {
      const teile = Math.max(1, Math.ceil(strecke / Math.max(1, 0.5 * R)));
      for (let s = 1; s <= teile; s++) {
        const a = s / teile;
        einruehren(sx0 + lx * a, sy0 + ly * a, 1.25 * R, zvx * 0.5, zvy * 0.5, 0.55 / Math.sqrt(teile));
      }
    }
    spurX = gx;
    spurY = gy;
    // Der Strudel setzt erst nach einem Augenblick ein: Ein gewöhnlicher Klick wirkt so immer gleich, nur
    // bewusstes Halten zieht ihn auf
    halten = uhr - sogSeit - SOG_AB;
    sogWirkt = sog && halten > 0;
    fangR = sogWirkt ? R * (1.1 + 1.9 * Math.min(1, halten / 1.4)) : 0;
    // Die Strömung des Strudels bleibt nah am Fangkreis: Weiter draußen verschöbe sie nur große gerasterte
    // Flächen um ein Pixel, und das Raster zeigte eine Schraffur
    if (sogWirkt && zda) strudeln(gx, gy, fangR * 1.3, 5 * R, 0.12);
  }

  // Unter der Strecke wecken; im Sog den Fangkreis einfangen, nach außen gerastert ausdünnend. Bei Fahrt
  // stieben einzelne Pixel als lose Krümel auf, auch bei langsamem Streichen.
  function unterStreckeWecken(dt: number, bild: Uint8Array, vorn: Uint8Array): void {
    const r = sogWirkt ? Math.max(R, fangR) : R;
    const r2 = r * r;
    const loseP = sogWirkt ? 0 : LOSE_RATE * dt * Math.min(1, zTempo / (4 * R)) * wirk;
    const ax = sx0;
    const ay = sy0;
    const bx = lx;
    const by = ly;
    const bb = l2;
    const ya = Math.max(0, Math.ceil(Math.min(gy, ay) - r));
    const yb = Math.min(fest - 1, Math.floor(Math.max(gy, ay) + r));
    const xa = Math.max(0, Math.ceil(Math.min(gx, ax) - r));
    const xb = Math.min(B - 1, Math.floor(Math.max(gx, ax) + r));
    if (yb < ya || xb < xa) return;
    // Eine Schleife über das Rechteck, Spalte und Zeile als Zähler (siehe stroemen)
    const breite = xb - xa + 1;
    const flaeche = breite * (yb - ya + 1);
    for (let n = 0, x = xa, y = ya; n < flaeche; n++, x++) {
      if (x > xb) {
        x = xa;
        y++;
      }
      let ex = x - ax;
      let ey = y - ay;
      if (bb > 1e-6) {
        let t = (ex * bx + ey * by) / bb;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        ex -= t * bx;
        ey -= t * by;
      }
      const d2 = ex * ex + ey * ey;
      if (d2 >= r2) continue;
      const i = y * B + x;
      if (himmel(i, bild, vorn)) continue;
      // Im Sog: innen alles, zum Rand hin immer weniger; der Rest kreist nur in der Strömung mit
      const fangen = sogWirkt && marke[i] !== 2 && gefangenZahl < FANG_MAX && streu(i, 0x77) < 1.15 - 0.95 * Math.sqrt(d2 / r2);
      // Was im Fangkreis nicht gefangen wird, treibt nur in der Strömung des Strudels mit
      if (!sogWirkt || fangen) zustand[i] &= ~STROM;
      else if (marke[i] === 0) zustand[i] |= STROM;
      if (marke[i] === 0) {
        liste[anzahl++] = i;
        marke[i] = fangen ? 2 : 1;
        if (fangen) gefangenZahl++;
      } else if (fangen) {
        marke[i] = 2;
        gefangenZahl++;
      }
      if (loseP > 0 && marke[i] === 1 && (zustand[i] & LOSE) === 0) {
        const d = Math.sqrt(d2);
        if (Math.random() < loseP * (1 - d / r)) {
          // Weg vom Zeiger, mit seinem Schwung, ein wenig nach oben
          const m = beweglich(i, bild, vorn);
          const v = (2.2 + 4 * Math.random()) * R * m;
          const nx = d > 1e-3 ? ex / d : Math.random() - 0.5;
          const ny = d > 1e-3 ? ey / d : Math.random() - 0.5;
          loesen(i, nx * v + zvx * 0.45 + (Math.random() - 0.5) * R, ny * v + zvy * 0.45 - (0.8 + Math.random()) * R * m);
        }
      }
    }
  }

  // Physik in Teilschritten, damit schnelle Würfe bei 20 Bildern/s stabil bleiben
  function physik(dt: number, bild: Uint8Array, vorn: Uint8Array): void {
    const teile = dt > 1 / 40 ? 2 : 1;
    for (let teil = 0; teil < teile; teil++) physikLauf(dt / teile, bild, vorn);
  }

  // Ein Teilschritt über alle aktiven Pixel (eine Schleife, eigene Funktion: siehe stroemen)
  function physikLauf(h: number, bild: Uint8Array, vorn: Uint8Array): void {
    const R2 = R * R;
    // Ein Pixel spürt den Zeiger so lange, wie er wirklich nahe war (Verweildauer, siehe unten). Ein schneller
    // Wisch bekommt so viel Wucht zurück, wie ihm die kurze Verweildauer nimmt: Die Spur bleibt gleichmäßig.
    const druckStark = DRUECKEN * wirk * (1 + Math.min(2, zTempo / (12 * R)));
    const streckeVoll = Math.max(1, strecke / (1.5 * R));
    const ax0 = sx0;
    const ay0 = sy0;
    const bx = lx;
    const by = ly;
    const bb = l2;
    const lang = strecke;
    const zgx = gx;
    const zgy = gy;
    let vorX = 0;
    let vorY = 0;
    if (lang > 0.05) {
      vorX = bx / lang;
      vorY = by / lang;
    } else if (zTempo > 1) {
      vorX = zvx / zTempo;
      vorY = zvy / zTempo;
    }
    const bug = 0.3 * Math.min(1, zTempo / (8 * R));
    const seitlich = Math.min(1, zTempo / (4 * R));
    const druecktNoch = zda && wirk > 0.02;
    const kern = 0.9 * R;
    const fangZiel = sogWirkt ? Math.min(1, halten / 0.35) : 0;
    const gwm = GW - 1;
    const ghm = GH - 1;
    const loseFeder = 0.45 * FEDER_MAX;
    const boden = fest - 1;
    const decke = oben;
    const stroemtJetzt = stroemt;
    for (let k = 0; k < anzahl; k++) {
      const i = liste[k];
      const ry = (i / B) | 0;
      const rx = i - ry * B;
      const m = beweglich(i, bild, vorn);
      let ux = dx[i];
      let uy = dy[i];
      let gvx = vx[i];
      let gvy = vy[i];
      const px = rx + ux;
      const py = ry + uy;
      const gefangen = marke[i] === 2;
      const lose = (zustand[i] & LOSE) !== 0;

      // Feder zur Ruhelage, gedeckelt: Weit Geschleuderte fließen gleichmäßig zurück, lose Krümel weicher
      let fx = -FEDER * ux;
      let fy = -FEDER * uy;
      const fmax = lose ? loseFeder : FEDER_MAX;
      const f2 = fx * fx + fy * fy;
      if (f2 > fmax * fmax) {
        const s = fmax / Math.sqrt(f2);
        fx *= s;
        fy *= s;
      }
      let ax: number;
      let ay: number;
      if (gefangen) {
        // Strudel: straff zum Zeiger hin auf eine eigene Bahn (gleichmäßig über die Scheibe verteilt), dort
        // kreisend; innen dreht es schneller. Der Zug ist so steif, dass die Fliehkraft die Bahn kaum weitet.
        const sx = zgx - px;
        const sy = zgy - py;
        const d = Math.sqrt(sx * sx + sy * sy) + 1e-3;
        // Die Bahn folgt dem Abstand, aus dem das Pixel kommt: Nahes kreist innen, Fernes außen. So bleibt die
        // Landschaft als Ringe erkennbar, und weil innen schneller dreht, wickelt sie sich zu Spiralarmen.
        const hx = rx - zgx;
        const hy = ry - zgy;
        const herkunft = Math.sqrt(hx * hx + hy * hy) / (3 * R);
        const bahn = kern * (0.24 + 0.76 * (herkunft < 1 ? herkunft : 1)) * (0.94 + 0.12 * streu(i, 0x2b7));
        const zmax = 3 * FEDER_MAX;
        let zug = SOG_ZUG * (d - bahn) * fangZiel;
        if (zug > zmax) zug = zmax;
        else if (zug < -zmax) zug = -zmax;
        const tx = (-sy / d) * sogDreh;
        const ty = (sx / d) * sogDreh;
        const soll = d * DREHUNG * Math.sqrt(kern / Math.max(d, 0.25 * kern)) * fangZiel;
        const tang = gvx * tx + gvy * ty;
        const rad = (gvx * sx + gvy * sy) / d;
        const halt = zug - rad * 16 * fangZiel;
        ax = fx * (1 - fangZiel * 0.97) + (sx / d) * halt + tx * (soll - tang) * 6 - gvx * 0.6;
        ay = fy * (1 - fangZiel * 0.97) + (sy / d) * halt + ty * (soll - tang) * 6 - gvy * 0.6;
      } else {
        const daempf = lose ? 2 : DAEMPFUNG;
        ax = fx - daempf * gvx;
        ay = fy - daempf * gvy;
        // Der Zeiger drückt als Kapsel entlang der ganzen Strecke seit dem letzten Bild, mit weichem Rand.
        // Die Richtung kommt vom nächsten Punkt der Strecke (seitlich weg, an den Enden rund), die Stärke von
        // der Verweildauer: dem Stück der Strecke, auf dem der Zeiger näher als R war. Feste Druckpunkte
        // entlang der Strecke stanzten bei schnellem Wisch eine Kette runder Löcher.
        if (druecktNoch && !lose) {
          let sx = px - ax0;
          let sy = py - ay0;
          let laengs = 0;
          if (bb > 1e-6) {
            laengs = (sx * bx + sy * by) / lang;
            const t = laengs < 0 ? 0 : laengs > lang ? 1 : laengs / lang;
            sx -= t * bx;
            sy -= t * by;
          }
          const d2 = sx * sx + sy * sy;
          if (d2 < R2) {
            const d = Math.sqrt(d2);
            const qq = 1 - d / R;
            let gewicht = qq * Math.sqrt(qq);
            if (lang > 1e-3) {
              const sehne = Math.sqrt(R2 - d2);
              const lo = laengs - sehne > 0 ? laengs - sehne : 0;
              const hi = laengs + sehne < lang ? laengs + sehne : lang;
              gewicht *= hi > lo ? ((hi - lo) / lang) * streckeVoll : 0;
            }
            // Richtung: vom Zeiger fort; wer nah an der Linie liegt, weicht zu seiner Seite und ein wenig nach
            // vorn aus, wie Sand vor einem Finger: Die Spur teilt sich sauber statt zu stieben
            let nx: number;
            let ny: number;
            // Nur bei Fahrt: Ein fast stehender Zeiger drückt rein radial, sonst trieben die seitlichen Anteile
            // die Pixel in der Delle im Kreis
            const nah = 1 - (1 - Math.min(1, d / (0.3 * R))) * seitlich;
            if (nah >= 1 && d > 1e-4) {
              nx = sx / d;
              ny = sy / d;
            } else if (vorX === 0 && vorY === 0) {
              // Genau unter einem ruhenden Zeiger: in eine je Pixel feste Richtung
              const w = streu(i, 0x5e1) * 2 * Math.PI;
              nx = Math.cos(w);
              ny = Math.sin(w);
            } else {
              const kreuz = vorX * sy - vorY * sx;
              const seite = kreuz > 0.05 ? 1 : kreuz < -0.05 ? -1 : streu(i, 0x5e1) < 0.5 ? -1 : 1;
              const fx0 = vorX * 0.45 - vorY * seite * 0.9;
              const fy0 = vorY * 0.45 + vorX * seite * 0.9;
              nx = fx0 * (1 - nah) + (d > 1e-4 ? (sx / d) * nah : 0);
              ny = fy0 * (1 - nah) + (d > 1e-4 ? (sy / d) * nah : 0);
            }
            // Bugwelle: Bei Fahrt schiebt der Zeiger zusätzlich in seine Richtung
            nx += vorX * bug;
            ny += vorY * bug;
            // Leicht verwackelt je Pixel: Der Rand der Delle franst aus wie Sand, nicht wie ausgestanzt
            const s = druckStark * gewicht * m * (0.85 + 0.3 * streu(i, 0x3c1));
            ax += nx * s;
            ay += ny * s;
          }
        }
      }
      // Strömung nimmt mit (bilinear auf dem Gitter)
      if (stroemtJetzt) {
        let qx = px / Z - 0.5;
        let qy = py / Z - 0.5;
        qx = qx < 0 ? 0 : qx > gwm ? gwm : qx;
        qy = qy < 0 ? 0 : qy > ghm ? ghm : qy;
        const x0 = qx | 0;
        const y0 = qy | 0;
        const x1 = x0 < gwm ? x0 + 1 : x0;
        const y1 = y0 < ghm ? y0 + 1 : y0;
        const cx = qx - x0;
        const cy = qy - y0;
        const a = y0 * GW;
        const b = y1 * GW;
        // Totzone: Leise Strömung nimmt nichts mit. Sie verschöbe weite Flächen um ein Pixel, und das Raster
        // zeigte an jeder Grenze eine Schraffur. Nur kräftige Strömung zieht, um ihren Überschuss. Sind alle
        // vier Ecken leise, ist es auch die Mitte: Dann spart der Blick auf die Marken das Interpolieren.
        if (zieht[a + x0] | zieht[a + x1] | zieht[b + x0] | zieht[b + x1]) {
          const u = (su[a + x0] * (1 - cx) + su[a + x1] * cx) * (1 - cy) + (su[b + x0] * (1 - cx) + su[b + x1] * cx) * cy;
          const v = (sv[a + x0] * (1 - cx) + sv[a + x1] * cx) * (1 - cy) + (sv[b + x0] * (1 - cx) + sv[b + x1] * cx) * cy;
          const fl2 = u * u + v * v;
          const kk = fl2 > WECK2 ? KOPPLUNG * m * (1 - Math.sqrt(WECK2 / fl2)) : 0;
          ax += kk * (u - gvx);
          ay += kk * (v - gvy);
        }
      }
      gvx += ax * h;
      gvy += ay * h;
      ux += gvx * h;
      uy += gvy * h;
      // Rand des Bildes, Naht oben und Boden über der Nacht-Tinte: Freie Pixel prallen ab, statt zu verschwinden
      if (!gefangen) {
        const nx = rx + ux;
        const ny = ry + uy;
        if (nx < 0) {
          ux = -rx;
          gvx = -gvx * 0.5;
        } else if (nx > B - 1) {
          ux = B - 1 - rx;
          gvx = -gvx * 0.5;
        }
        if (ny < decke && ry >= decke) {
          uy = decke - ry;
          gvy = -gvy * 0.5;
        } else if (ny > boden) {
          uy = boden - ry;
          gvy = -gvy * 0.4;
        }
      }
      // Ein Krümel, der fast daheim ist und kaum noch fliegt, hängt wieder an der straffen Feder
      if (lose && ux * ux + uy * uy < 0.16 * R2 && gvx * gvx + gvy * gvy < 9 * R2) zustand[i] &= ~LOSE;
      dx[i] = ux;
      dy[i] = uy;
      vx[i] = gvx;
      vy[i] = gvy;
    }
  }

  // Ruhende ausbuchen, Löcher schließen oder öffnen und die Malliste füllen. Rückgabe: Länge der Malliste.
  function ausbuchen(bild: Uint8Array, hinten: Uint8Array, vorn: Uint8Array, aus: Int32Array): number {
    const t = tab;
    let w = 0;
    let q = 0;
    zaehl[0] = zaehl[1] = zaehl[2] = zaehl[3] = 0;
    const funkeln = t[GLITZER] >>> 24 ? t[GLITZER] : t[GELB];
    const funkelnHell = t[GLITZER_HELL] >>> 24 ? t[GLITZER_HELL] : funkeln;
    // Fliegende Pixel funkeln nachts in Silber; Creme bleibt dem Mondlicht und den Wellenkanten
    const nacht = nachts;
    const funke = nacht ? funkelnHell : funkeln;
    const funkeHell = nacht ? funkeln : funkelnHell;
    // Nachts funkeln mehr Pixel: dunkel auf dunkel sähe man sonst nur einen grauen Fleck
    const funkAnteil = nacht ? 0.45 : 0.3;
    const funkAnteilLose = nacht ? 0.22 : 0.14;
    const flirr = bildNr >> 1;
    const glitzerSalz = bildNr >> 3;
    const fa2 = FUNKEN_AB * FUNKEN_AB;
    const fspanne = 1 / (FUNKEN_VOLL - FUNKEN_AB);
    const la2 = LOSE_AB * LOSE_AB;
    const lspanne = 1 / (LOSE_VOLL - LOSE_AB);
    const versatzB = bildNr & 7;
    const bm = B - 1;
    const fm = fest - 1;
    const tempoFort2 = 9 * R * R;
    const R2 = R * R;
    const mondAb2 = 16 * R2; // ab 4 R/s glimmt ein bewegtes Pixel nachts voll
    const wulstAn = zda && wirk > 0.3 && !sogWirkt;
    const wulstInnen2 = 0.75 * 0.75 * R2;
    const wulstAussen2 = 1.5 * 1.5 * R2;
    const zgx = gx;
    const zgy = gy;
    const zwirk = wirk;
    const tinte = t[T6];
    // Was die Schneise freilegt: tags die Lage dahinter, nachts dieselbe im Mondlicht. Am Rand (wenig
    // verschoben) eine Silberkante, tiefer drinnen hellere Tinte mit vereinzeltem Glitzern.
    const freilegen = (i: number, tiefe: number): number => {
      const h = hinten[i];
      if (!nacht) return t[h];
      if (streu(i, glitzerSalz) < 0.05) return glanz[3 * 256 + h];
      return glanz[(tiefe < LOCHRAND ? 2 : 1) * 256 + h];
    };
    verschoben = 0;
    for (let k = 0; k < anzahl; k++) {
      const i = liste[k];
      const ry = (i / B) | 0;
      const rx = i - ry * B;
      const ux = dx[i];
      // Verschiebung = Physik + Hub der Welle (der Hub ist vorgegeben und steht nicht in dy)
      const uyP = dy[i];
      const uy = uyP + wu[rx * 4 + (vorn[i] & 3)];
      const gvx = vx[i];
      const gvy = vy[i];
      const t2 = gvx * gvx + gvy * gvy;
      const u2 = ux * ux + uy * uy;
      // in Ruhe (oder numerisch entgleist): exakt zurück an den Platz.
      // Unsichtbar Nachzitterndes zählt als Ruhe: Wer nicht gezeigt wird, kaum verschoben ist und kaum noch
      // fliegt, sieht daheim genauso aus.
      // Ruhe zählt ohne den Hub der Welle: Den malt das Grundbild der Spalte.
      const u2P = ux * ux + uyP * uyP;
      const strom = (zustand[i] & STROM) !== 0;
      const still = (zustand[i] & GEZEIGT) === 0 ? u2P < (strom ? STROM_BIS2 : ZEIGEN_BIS2) && t2 < 16 : u2P < 0.06 && t2 < 2;
      if ((marke[i] === 1 && still) || !(t2 < 1e12 && u2 < 1e12)) {
        dx[i] = dy[i] = vx[i] = vy[i] = 0;
        marke[i] = zustand[i] = 0;
        continue;
      }
      liste[w++] = i;
      // Hysterese: erst ab 1,1 px zeigen, erst unter 0,45 px wieder heim (nur Strömung: 2,2 und 1 px)
      const zeigt = (zustand[i] & GEZEIGT) !== 0 ? u2 >= (strom ? STROM_BIS2 : ZEIGEN_BIS2) : u2 >= (strom ? STROM_AB2 : ZEIGEN_AB2);
      let tx = rx;
      let ty = ry;
      if (zeigt) {
        tx = Math.round(rx + ux);
        ty = Math.round(ry + uy);
        zustand[i] |= GEZEIGT;
      } else zustand[i] &= ~GEZEIGT;
      const daheim = tx === rx && ty === ry;
      const lose = (zustand[i] & LOSE) !== 0;
      if (!daheim) {
        // Loch: Wer landet ungefähr hier? Zwei Schritte der Rückrechnung s = o − u(s). Passt es, schließt der
        // Nachbar das Loch (auch bei großer, aber gleichmäßiger Verschiebung, etwa unter der Welle). Sonst ist
        // die Stelle wirklich frei: gerastert zwischen der eigenen Farbe und der Lage dahinter, nach Tiefe.
        let sx = Math.round(rx - ux);
        let sy = Math.round(ry - uy);
        const vonUnten = sy >= fest; // die Nacht-Tinte darunter rückt nach, wenn sich der Vordergrund hebt
        sx = sx < 0 ? 0 : sx > bm ? bm : sx;
        sy = sy < 0 ? 0 : sy > fm ? fm : sy;
        const j1 = sy * B + sx;
        if (vonUnten) aus[i] = tinte;
        else if (marke[i] === 2 || lose || t2 > tempoFort2) {
          // Im Strudel Gefangene, lose Krümel und schnell Fliegende sind wirklich fort: Kein Nachbar schließt
          // diese Stelle, die Rückrechnung kann man sich sparen.
          aus[i] = SCHWELLE[(ry & 7) * 8 + (rx & 7)] < 0.85 ? freilegen(i, 1) : t[bild[i]];
        } else if (j1 !== i && vorn[j1] === 0 && t[bild[j1]] === papier) {
          // Himmel bewegt sich nie, gilt hier aber als mitgewandert: Hebt sich ein Grat, rückt darunter sauber
          // Himmel nach, und ein gerastertes Ende einer Kette verschiebt sich als Ganzes.
          aus[i] = t[bild[j1]];
        } else {
          const wj = wu[sx * 4 + (vorn[j1] & 3)];
          // Landet schon der erste Nachbar hier (gleichmäßig verschobene Fläche), ist der zweite Schritt unnötig
          const gx1 = sx + dx[j1] - rx;
          const gy1 = sy + dy[j1] + wj - ry;
          if (j1 !== i && gx1 * gx1 + gy1 * gy1 <= LOCH_TOLERANZ2) aus[i] = t[bild[j1]];
          else {
            sx = Math.round(rx - dx[j1]);
            sy = Math.round(ry - dy[j1] - wj);
            sx = sx < 0 ? 0 : sx > bm ? bm : sx;
            sy = sy < 0 ? 0 : sy > fm ? fm : sy;
            const j = sy * B + sx;
            const fx = sx + dx[j] - rx;
            const fy = sy + dy[j] + wu[sx * 4 + (vorn[j] & 3)] - ry;
            const f2 = j === i ? 1e9 : fx * fx + fy * fy; // das eigene Pixel ist ja gerade fort
            if (f2 <= LOCH_TOLERANZ2) aus[i] = t[bild[j]];
            else {
              // höchstens 85 %: Auch mitten in der Delle bleiben ein paar Krümel, das Bild dünnt aus statt zu
              // reißen
              const tiefe = Math.min(0.85, (Math.sqrt(Math.min(f2, u2)) - 1.2) / 2.6);
              aus[i] = tiefe > SCHWELLE[(ry & 7) * 8 + (rx & 7)] ? freilegen(i, tiefe) : t[bild[j === i ? j1 : j]];
            }
          }
        }
        dicht[i] |= 0x80;
        verschoben++;
      }
      // Nie in die Naht oben und nie in die Nacht-Tinte malen
      if (tx < 0 || tx >= B || ty < oben || ty >= fest) continue;
      let farbe = t[bild[i]];
      let wulst = 0;
      const ab2 = lose ? la2 : fa2;
      let funkelt = false;
      if (t2 > ab2) {
        // Schnelle Pixel funkeln: Raster nach Tempo, mit dem Bildzähler verschoben, damit es flirrt. Jedes
        // Pixel blitzt aber nur ab und zu für zwei Bilder auf; die übrigen fliegen in ihrer eigenen Farbe, so
        // sieht man die Berge zerstieben statt Konfetti.
        const stufe = (Math.sqrt(t2) - (lose ? LOSE_AB : FUNKEN_AB)) * (lose ? lspanne : fspanne);
        const schwelle = SCHWELLE[((ty + versatzB) & 7) * 8 + ((tx + versatzB * 3) & 7)];
        if (stufe > schwelle && streu(i, flirr) < (lose || marke[i] === 2 ? funkAnteilLose : funkAnteil) + 0.12 * Math.min(1, stufe)) {
          farbe = stufe > schwelle + 0.75 ? funkeHell : funke;
          funkelt = true;
        } else if (daheim) continue;
        else if (nacht) {
          // Nachts fängt, was fliegt, das Mondlicht: lose Krümel nach Tempo hell, die übrigen eine Stufe
          const g = lose ? (stufe > 0.7 ? 3 : stufe > 0.3 ? 2 : 1) : 0;
          farbe = glanz[g * 256 + bild[i]];
          funkelt = true;
        }
      } else if (daheim) continue;
      else if (nacht && lose) {
        farbe = glanz[256 + bild[i]];
        funkelt = true;
      } else if (nacht && t2 > mondAb2 * SCHWELLE[((ty + versatzB) & 7) * 8 + ((tx + versatzB * 3) & 7)]) {
        // Nachts glimmt, was sich zügig bewegt, gerastert nach Tempo; was zur Ruhe kommt, wird wieder dunkel.
        // So bleibt die Kante der Schneise ausgefranst statt als glatte, leuchtende Röhre.
        farbe = glanz[bild[i]];
      }
      // Wulst: Was der Zeiger vor sich her nach außen schiebt und sich am Rand der Delle auf andere türmt,
      // wirft einen Schatten (nachts eine Silberkante). Nur dort, als Ring um den Zeiger, solange er drückt;
      // anderswo (im Nachlauf, im Wirbel) läse sich derselbe Schatten als Schmutz.
      if (wulstAn && !funkelt && !lose && marke[i] === 1 && u2 > 1.44 && t2 < 9 * R2) {
        const ex = tx - zgx;
        const ey = ty - zgy;
        const e2 = ex * ex + ey * ey;
        if (e2 > wulstInnen2 && e2 < wulstAussen2 && ux * ex + uy * ey > 0.6 * Math.sqrt(u2 * e2)) {
          wulst = Math.min(1, (Math.sqrt(u2) - 1.2) / 2.2) * zwirk;
        }
      }
      const eb = vorn[i] & 3;
      qZiel[q] = ty * B + tx;
      qQuelle[q] = i;
      qFarbe[q] = farbe;
      qEbene[q] = eb;
      qWulst[q] = wulst;
      zaehl[eb]++;
      const z = ty * B + tx;
      if ((dicht[z] & 0x7f) < 0x7f) dicht[z]++;
      q++;
    }
    anzahl = w;
    return q;
  }

  // Bewegte über ruhende, hintere Ebenen zuerst (Zählsortierung nach Ebene)
  function malen(q: number, bild: Uint8Array, vorn: Uint8Array, aus: Int32Array): void {
    let start0 = 0;
    let start1 = zaehl[0];
    let start2 = start1 + zaehl[1];
    let start3 = start2 + zaehl[2];
    for (let k = 0; k < q; k++) {
      const e = qEbene[k];
      qFolge[e === 0 ? start0++ : e === 1 ? start1++ : e === 2 ? start2++ : start3++] = k;
    }
    // Nachts hebt der Wulst die Farbe ins Mondlicht (Silberkante), tags dunkelt er sie ab
    const wulstFarben = nachts ? glanz : schatten;
    const wulstVersatz = nachts ? 256 * 2 : 0;
    for (let f = 0; f < q; f++) {
      const k = qFolge[f];
      const t = qZiel[k];
      let c = qFarbe[k];
      const wl = qWulst[k];
      if (wl > 0) {
        // Gedrängt: mehr als ein Pixel will auf diese Stelle (die Stelle selbst zählt, wenn ihr Pixel da ist)
        const da = (dicht[t] & 0x80) === 0 && !himmel(t, bild, vorn) ? 1 : 0;
        const gedraengt = (dicht[t] & 0x7f) + da;
        if (gedraengt >= 2) {
          const ty = (t / B) | 0;
          const tx = t - ty * B;
          const anteil = gedraengt >= 3 ? wl : 0.75 * wl;
          if (anteil > SCHWELLE[(ty & 7) * 8 + (tx & 7)]) c = wulstFarben[wulstVersatz + bild[qQuelle[k]]];
        }
      }
      aus[t] = c;
    }
    for (let k = 0; k < q; k++) dicht[qZiel[k]] = 0;
    for (let k = 0; k < anzahl; k++) dicht[liste[k]] = 0;
  }

  // Im Sog öffnet sich in der Mitte ein Kern aus Nacht-Tinte, gerastert am Rand. Um ihn liegt ein feiner
  // Lichtring (tags Gelb, nachts Silber) mit einer hellen Stelle, die mit der Scheibe umläuft: Auf der Seite,
  // die auf den Betrachter zudreht, leuchtet ein Schwarzes Loch heller.
  function sogKern(aus: Int32Array): void {
    const auf = Math.min(1, Math.max(0, (halten - 0.1) / 0.8));
    const rk = 0.2 * R * auf;
    if (rk <= 0.6) return;
    const t = tab;
    const funkeln = t[GLITZER] >>> 24 ? t[GLITZER] : t[GELB];
    const funkelnHell = t[GLITZER_HELL] >>> 24 ? t[GLITZER_HELL] : funkeln;
    const funke = nachts ? funkelnHell : funkeln;
    const funkeHell = nachts ? funkeln : funkelnHell;
    const versatzB = bildNr & 7;
    const rr = rk + 1.4;
    const aussen = rr + 1.2;
    const ya = Math.max(oben, Math.ceil(gy - aussen));
    const yb = Math.min(fest - 1, Math.floor(gy + aussen));
    const tinte = t[T6];
    const lauf = uhr * DREHUNG * 0.35 * sogDreh;
    const glanzS = Math.min(1, Math.max(0, (halten - 0.4) / 0.6));
    for (let y = ya; y <= yb; y++) {
      for (let x = Math.max(0, Math.ceil(gx - aussen)); x <= Math.min(B - 1, Math.floor(gx + aussen)); x++) {
        const ex = x - gx;
        const ey = y - gy;
        const d = Math.sqrt(ex * ex + ey * ey);
        const schwelle = SCHWELLE[(y & 7) * 8 + (x & 7)];
        if (rk - d + 0.5 > schwelle) {
          aus[y * B + x] = tinte;
          continue;
        }
        const band = 1 - Math.abs(d - rr) / 0.9;
        if (band <= 0 || glanzS <= 0) continue;
        const seite = 0.5 + 0.5 * Math.cos(Math.atan2(ey, ex) - lauf);
        const stufe = band * glanzS * (0.35 + 0.65 * seite);
        const flimmer = SCHWELLE[((y + versatzB) & 7) * 8 + ((x + versatzB * 3) & 7)];
        if (stufe > flimmer * 0.9) aus[y * B + x] = stufe > 0.72 ? funkeHell : funke;
      }
    }
  }

  function schritt(
    dtRoh: number,
    bild: Uint8Array,
    hinten: Uint8Array,
    vorn: Uint8Array,
    tabelle: Uint32Array,
    ausgabe: Uint32Array,
  ): boolean {
    // Grundbild: genau das Ruhebild. Ruht alles, ist das schon die ganze Arbeit.
    sichten(tabelle, ausgabe);
    const aus = ausI;
    grundbild(bild, tabI, aus, Math.min(bild.length, aus.length));
    if (bild.length !== N || vorn.length < N || hinten.length < N || aus.length < N) {
      // Passt das Bild nicht zur Größe, ist jeder Zustand wertlos: verwerfen, bis groesse() kommt
      if (anzahl || stroemt || sog || wellen.length || spritzer.length || staubZahl || ringZahl) zuruecksetzen();
      return false;
    }
    if (!aktiv()) return false;

    const dt = dtRoh > 0 ? Math.min(dtRoh, 1 / 20) : 1 / 60;
    uhr += dt;
    bildNr++;
    tab = tabI;
    papier = tabI[BOGEN];
    farbenBauen(tabI);

    // Der Strudel löst sich von selbst, wenn niemand mehr loslässt
    if (sog && (uhr - sogSeit > SOG_HOECHSTENS || (!zda && uhr - sogSeit > SOG_OHNE_ZEIGER))) druck(false);

    zeigerNachfuehren(dt);

    if (stroemt) {
      stroemen(dt);
      if (stroemt) zellenWecken(bild, vorn);
    }

    // Wellen weiterlaufen lassen, Spritzer auslösen
    if (wellen.length) wellenRechnen(dt);
    else if (wuBelegt) {
      // Der letzte Zug ist durch: Hub einmal leeren, danach kostet es nichts mehr
      wu.fill(0);
      wZug.fill(0);
      wuBelegt = false;
    }
    if (spritzer.length) {
      for (const s of spritzer) spritzen(s, bild, vorn);
      spritzer.length = 0;
    }

    if (zda && (wirk > 0.02 || sogWirkt)) unterStreckeWecken(dt, bild, vorn);
    staubAufwirbeln(bild, vorn);

    physik(dt, bild, vorn);
    if (staubZahl) staubBewegen(dt);

    const wellig = wuBelegt ? wellenMalen(bild, vorn, aus) : 0;
    const q = ausbuchen(bild, hinten, vorn, aus);
    malen(q, bild, vorn, aus);

    // Lichtkanten der Wellen über allem, was sich bewegt
    if (wellen.length) {
      const funkeln = tabI[GLITZER] >>> 24 ? tabI[GLITZER] : tabI[GELB];
      const funkelnHell = tabI[GLITZER_HELL] >>> 24 ? tabI[GLITZER_HELL] : funkeln;
      for (const w of wellen) welleLeuchten(w, bild, vorn, aus, funkeln, funkelnHell);
    }
    const geringt = ringZahl ? ringeMalen(dt, aus) : 0;
    staubGemalt = staubZahl ? staubMalen(bild, vorn, aus) : 0;
    if (sogWirkt && zda) sogKern(aus);
    // Für die Statuszeile zählt auch, was die Welle hebt, der Ring färbt und der Staub zeigt
    verschoben += wellig + geringt + staubGemalt;

    // Unsichtbarer Nachlauf: Ruht jedes Pixel und weckt die Strömung keines mehr, ist sie vorbei
    if (stroemt && anzahl === 0 && !sog && stroemMax < WECK2) stroemungLeeren();

    return aktiv();
  }

  groesse(B0, H0, fest0);

  return {
    zeiger,
    druck,
    weg,
    stoss,
    schritt,
    aktiv,
    groesse,
    unterwegs: () => verschoben,
  };
}
