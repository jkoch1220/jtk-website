import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  BOGEN,
  T6,
  TIEFE,
  bergeSzene,
  entwurf,
  nachtAb,
  zusammensetzen,
  type BergSzene,
  type Sperre,
  type Stapel,
  type Thema,
  type Wahl,
} from "./berge-szene";
import { lebenErwecken, type Leben } from "./berge-leben";
import { spielErstellen, type Spiel } from "./berge-spiel";
import { flugStarten, type Flug } from "./berge-flug";
import { spiele } from "./klang";
import { nutzung } from "./nutzung";

/* Bühne des Bergbilds: ein Canvas, eine Schleife. Jedes Bild entsteht aus der Szene (Ebenen mit
   Parallax-Versatz), dem Leben (Palettenzyklen, Tiere, Wind), der Maus (Pixel wegdrücken) und beim
   Neuzeichnen aus einer Flug-Choreografie. Die Schleife läuft nur, solange das Bild zu sehen ist.
   Die nächste Szene entsteht schon vorher im Hintergrund (berge-werk.ts), damit der Klick sofort fliegt. */

gsap.registerPlugin(ScrollTrigger);

// Startbild der Seite: das gewohnte Panorama mit See zur Mittagszeit
const START = 2026;
const START_WAHL: Wahl = { stimmung: "mittag", landschaft: "see" };
const LEBEN_TAKT = 1000 / 30; // ruhiges Leben braucht keine 60 Bilder
const SCHNELL_TAKT = 1000 / 60; // Maus, Flug, Parallax: auch auf 120-Hz-Schirmen höchstens 60 Bilder
// Größtes Bild in Kunstpixeln: Für diese Größe gelten alle Leistungsbudgets (Leben, Spiel, Flug)
const MAX_B = 520;
const MAX_H = 260;
// Ein Finger tippt nur, wenn er kurz und fast ohne Weg aufliegt; sonst beginnt er eine Scrollgeste
const TIPP_WEG = 10; // CSS-Pixel
const TIPP_DAUER = 450; // ms
// Nur für die Statistik: ab so langem Halten knallt es (berge-spiel.ts), ab so viel Mausweg spielt jemand
const KNALL_AB_MS = 250;
const MAUS_SPIELT = 600; // CSS-Pixel

// Wirksame Darstellung: setzt das Inline-Skript im Kopf vor dem ersten Bild. Gedruckt wird immer hell.
let druckt = false;
const thema = (): Thema => (!druckt && document.documentElement.dataset.theme === "dark" ? "dark" : "light");

// Tausender mit schmalem geschütztem Leerzeichen, wie im Druckvermerk „48 210 Pixel unterwegs“
const SCHMAL = " ";
const zahl = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, SCHMAL);
// Vermerke anderer Module auf dieselbe Schreibweise bringen (Punkt oder Leerzeichen als Trenner)
const einheitlich = (text: string) => text.replace(/(\d)[ . ](?=\d{3}(?!\d))/g, `$1${SCHMAL}`);

interface Panorama {
  buehne: HTMLElement;
  bild: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  hud: HTMLElement | null;
  angabe: HTMLElement | null;
  ansage: HTMLElement | null;
  knopf: HTMLButtonElement | null;
  px: number;
  B: number;
  H: number;
  sperre: Sperre | null;
  startwert: number;
  wahl: Wahl | undefined;
  szene: BergSzene | null;
  stapel: Stapel | null;
  stapelVersatz: string; // Versatz, zu dem stapel passt
  versatz: number[]; // Versatz, der gerade zu sehen ist
  soll: number[]; // Versatz laut Scrollstand; versatz folgt ihm um höchstens 1 Kunstpixel je Bild
  leben: Leben | null;
  spiel: Spiel | null;
  flug: Flug | null;
  flugName: string | null;
  bildDaten: ImageData | null;
  ausgabe: Uint32Array;
  bild8: Uint8Array; // Farbnummern des aktuellen Bilds (Standbild plus Leben)
  // Zweitpuffer für das Flugziel: Ein laufender Flug liest noch die alten, während das nächste Ziel entsteht
  reserve8: Uint8Array;
  reserveStapel: Stapel | null;
  altPuffer: Uint32Array; // Kopie dessen, was beim Klick zu sehen war
  laedt: boolean;
  zeiger: { x: number; y: number } | null;
}

// Maße in Kunstpixeln, noch nicht angewandt (die Vorbereitung eines Klicks misst, ohne das Bild zu leeren)
interface Mass {
  px: number;
  B: number;
  H: number;
  links: number;
  sperre: Sperre | null;
}

const massSchluessel = (B: number, H: number, sperre: Sperre | null) =>
  `${B}×${H}|${sperre ? `${sperre.x0},${sperre.y0},${sperre.x1},${sperre.y1}` : "-"}`;

function bergeText(p: Panorama, text?: string): void {
  if (!p.angabe) return;
  // Druckvermerk wie im Druck: unabhängig vom Thema immer die Farbzahl des hellen Abzugs
  p.angabe.textContent =
    text !== undefined ? einheitlich(text) : p.szene ? `${p.B} × ${p.H}, ${p.szene.farbAnzahl.light} Farben` : "";
}

// Die Seite erfährt, wo die Sonne steht (für den Klebestreifen am Brief)
function szeneMelden(p: Panorama, statusFrei: boolean): void {
  if (!p.szene) return;
  p.buehne.dataset.sonne = p.szene.sonnenseite > 0 ? "rechts" : "links";
  p.canvas.setAttribute("aria-label", p.szene.beschreibung[thema()]);
  if (statusFrei && !p.laedt && !p.flug) bergeText(p);
}

// Screenreader hören nach „Neu zeichnen“ einmal, was jetzt zu sehen ist. Erst leeren, dann schreiben:
// So wird auch eine gleichlautende Beschreibung erneut angesagt.
function ansagen(p: Panorama): void {
  const ziel = p.ansage;
  if (!ziel || !p.szene) return;
  const text = p.szene.beschreibung[thema()];
  ziel.textContent = "";
  setTimeout(() => (ziel.textContent = text), 80);
}

// Kunstpixel und Rasterweite aus der Größe von .berge__bild; Canvas unten bündig, mittig
function messen(p: Panorama): Mass {
  const w = p.bild.clientWidth || 360;
  const h = p.bild.clientHeight || 240;
  // Grobe Pixel auf großen Schirmen, aber nie mehr als MAX_B × MAX_H Kunstpixel
  const px = Math.max(w < 768 ? 3 : w < 2200 ? 4 : 5, Math.ceil(w / MAX_B), Math.ceil(h / MAX_H));
  const B = Math.ceil(w / px);
  const H = Math.ceil(h / px);
  const links = Math.floor((w - B * px) / 2);
  const ueber = H * px - h; // so viel ragt oben über und wird im Himmel abgeschnitten
  // Bereich unter dem schwebenden HUD in Kunstpixeln
  let sperre: Sperre | null = null;
  const hud = p.hud?.getBoundingClientRect();
  const rahmen = p.bild.getBoundingClientRect();
  if (hud && hud.width > 0 && hud.top < rahmen.bottom && hud.bottom > rahmen.top) {
    sperre = {
      x0: Math.floor((hud.left - rahmen.left - links) / px),
      x1: Math.ceil((hud.right - rahmen.left - links) / px),
      y0: Math.floor((hud.top - rahmen.top + ueber) / px),
      y1: Math.ceil((hud.bottom - rahmen.top + ueber) / px),
    };
  }
  return { px, B, H, links, sperre };
}

function massAnwenden(p: Panorama, m: Mass): void {
  p.px = m.px;
  p.B = m.B;
  p.H = m.H;
  p.sperre = m.sperre;
  // Nur bei geänderter Größe neu anlegen: Jede Zuweisung leert das Canvas
  if (p.canvas.width !== m.B) p.canvas.width = m.B;
  if (p.canvas.height !== m.H) p.canvas.height = m.H;
  p.canvas.style.width = `${m.B * m.px}px`;
  p.canvas.style.height = `${m.H * m.px}px`;
  p.canvas.style.left = `${m.links}px`;
}

// Puffer passend zur Bildgröße
function puffer(p: Panorama): void {
  if (p.bildDaten?.width !== p.B || p.bildDaten.height !== p.H) {
    p.bildDaten = p.ctx.createImageData(p.B, p.H);
    p.ausgabe = new Uint32Array(p.bildDaten.data.buffer);
  }
  if (p.bild8.length !== p.B * p.H) {
    p.bild8 = new Uint8Array(p.B * p.H);
    p.stapel = null;
  }
}

// Szene zum aktuellen Startwert rechnen; Leben und Spiel passen sich an. Das Leben entsteht auch bei
// reduzierter Bewegung: Es malt dann einmal das ruhige Standbild von t = 0 (Gämse, Vögel an ihren Plätzen).
function szeneRechnen(p: Panorama, bewegt: boolean): void {
  p.szene = bergeSzene(p.B, p.H, p.startwert, p.sperre, p.wahl);
  p.stapel = null;
  p.leben = lebenErwecken(p.szene);
  if (bewegt) {
    if (p.spiel) p.spiel.groesse(p.B, p.H, nachtAb(p.H));
    else p.spiel = spielErstellen(p.B, p.H, nachtAb(p.H));
  }
}

// Standbild plus Leben zur Zeit t als Farbnummern in p.bild8
function bildRechnen(p: Panorama, t: number): void {
  const szene = p.szene as BergSzene;
  const schluessel = p.versatz.join();
  if (!p.stapel || p.stapelVersatz !== schluessel) {
    p.stapel = zusammensetzen(szene, p.versatz, p.stapel ?? undefined);
    p.stapelVersatz = schluessel;
  }
  p.bild8.set(p.stapel.farbe);
  if (p.leben) p.leben.zeichnen(p.bild8, p.stapel.vorn, t, p.versatz, thema());
}

function abbilden(p: Panorama): void {
  const tabelle = (p.szene as BergSzene).paletten[thema()];
  const { bild8, ausgabe } = p;
  for (let i = 0; i < bild8.length; i++) ausgabe[i] = tabelle[bild8[i]];
}

function zeigen(p: Panorama): void {
  if (p.bildDaten) p.ctx.putImageData(p.bildDaten, 0, 0);
}

// Ohne Bewegung: einmal das Standbild malen (t = 0, nichts läuft weiter)
function standbild(p: Panorama): void {
  if (!p.szene) return;
  puffer(p);
  bildRechnen(p, 0);
  abbilden(p);
  zeigen(p);
}

// Arbeit für ruhige Momente; ohne requestIdleCallback (Safari) ein kurzer Aufschub
const imLeerlauf = (arbeit: () => void) => {
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(arbeit, { timeout: 1500 });
  else setTimeout(arbeit, 150);
};

// Ein Bild abwarten und dann in einer eigenen Aufgabe weiterarbeiten: Dazwischen lebt das Bild weiter.
// Läuft gerade kein Bild (Tab im Hintergrund), geht es nach kurzer Zeit trotzdem weiter, damit ein Klick
// nie hängen bleibt.
const atem = () =>
  new Promise<void>((weiter) => {
    let fertig = false;
    const los = () => {
      if (fertig) return;
      fertig = true;
      setTimeout(weiter, 0);
    };
    requestAnimationFrame(los);
    setTimeout(los, 120);
  });

// Fehler der Schleife nur einmal melden: Sie läuft weiter, auch wenn ein Bild misslingt
let gemeldeterFehler = "";
function stoerung(fehler: unknown): void {
  const text = String(fehler);
  if (text === gemeldeterFehler) return;
  gemeldeterFehler = text;
  console.error("berge.bmp:", fehler);
}

export function panoramaEinrichten(bewegungReduziert: boolean): void {
  const buehne = document.querySelector<HTMLElement>("[data-berge-buehne]");
  const bild = buehne?.querySelector<HTMLElement>("[data-berge-bild]");
  const canvas = bild?.querySelector<HTMLCanvasElement>("[data-berge]");
  const ctx = canvas?.getContext("2d", { willReadFrequently: true });
  if (!buehne || !bild || !canvas || !ctx) return;

  const p: Panorama = {
    buehne,
    bild,
    canvas,
    ctx,
    hud: buehne.querySelector<HTMLElement>(".berge__hud"),
    angabe: buehne.querySelector<HTMLElement>("[data-bild-groesse]"),
    ansage: buehne.querySelector<HTMLElement>("[data-berge-ansage]"),
    knopf: buehne.querySelector<HTMLButtonElement>("[data-berge-neu]"),
    px: 4,
    B: 0,
    H: 0,
    sperre: null,
    startwert: START,
    wahl: START_WAHL,
    szene: null,
    stapel: null,
    stapelVersatz: "",
    versatz: [0, 0, 0, 0],
    soll: [0, 0, 0, 0],
    leben: null,
    spiel: null,
    flug: null,
    flugName: null,
    bildDaten: null,
    ausgabe: new Uint32Array(0),
    bild8: new Uint8Array(0),
    reserve8: new Uint8Array(0),
    reserveStapel: null,
    altPuffer: new Uint32Array(0),
    laedt: false,
    zeiger: null,
  };

  /* Schleife ----------------------------------------------------------------- */

  let laeuft = 0;
  let sichtbar = false;
  let lebenStart = performance.now();
  let letztes = 0; // Zeitpunkt des letzten gemalten Bilds
  let lebenUm = -Infinity; // Zeitpunkt, zu dem das Leben zuletzt gerechnet wurde
  let spielLief = false; // das Spiel hat im letzten Bild noch gemalt
  let eiligBis = 0; // bis dahin 60 Bilder (Parallax beim Scrollen, Maus)
  let bereitet = false; // ein Klick auf „Neu zeichnen“ wird gerade vorbereitet (bis der Flug startet)
  let ansageFaellig = false; // nach der Landung die neue Bildbeschreibung ansagen

  const flugBeenden = () => {
    p.flug = null;
    if (!bereitet) p.buehne.removeAttribute("data-wirbel");
    lebenStart = performance.now();
    lebenUm = -Infinity;
    szeneMelden(p, !bereitet);
    // Landet ein Flug, während schon der nächste Klick vorbereitet wird, kommt die Ansage erst nach diesem
    if (ansageFaellig && !bereitet) {
      ansageFaellig = false;
      ansagen(p);
    }
    // Eine Maus, die während des Flugs über dem Bild steht, wirkt sofort auf das gelandete Bild
    if (p.zeiger) p.spiel?.zeiger(p.zeiger.x, p.zeiger.y, performance.now());
    leerlaufPlanen();
  };

  // Während die Maus spielt, zählt die Statuszeile die Pixel mit, die gerade unterwegs sind
  let gemeldet = false;
  let gemeldetUm = 0;
  const spielMelden = (jetzt: number) => {
    if (p.laedt || bereitet || !p.spiel || jetzt - gemeldetUm < 120) return;
    gemeldetUm = jetzt;
    const unterwegs = p.spiel.unterwegs();
    if (unterwegs > 0) {
      bergeText(p, `${zahl(unterwegs)} Pixel unterwegs`);
      gemeldet = true;
    } else if (gemeldet) {
      gemeldet = false;
      bergeText(p);
    }
  };

  // Der sichtbare Versatz folgt dem Scrollstand um höchstens 1 Kunstpixel je Ebene und Bild. So rucken
  // die Ebenen nicht, wenn während eines Flugs gescrollt wurde und der Flug landet.
  const versatzNachfuehren = () => {
    let geaendert = false;
    for (let e = 0; e < 4; e++) {
      const d = p.soll[e] - p.versatz[e];
      if (d !== 0) {
        p.versatz[e] += Math.sign(d);
        geaendert = true;
      }
    }
    return geaendert;
  };

  const bildMalen = (jetzt: number, erzwingen = false) => {
    if (!p.szene) return;
    puffer(p);
    if (p.flug) {
      let weiter = false;
      try {
        weiter = p.flug.schritt(jetzt, p.ausgabe);
      } finally {
        // Auch ein Fehler im Flug beendet ihn: Das Bild darf nie im Wirbel hängen bleiben
        if (!weiter) flugBeenden();
      }
      zeigen(p);
      return;
    }
    const verschoben = versatzNachfuehren();
    if (verschoben) eiligBis = Math.max(eiligBis, jetzt + 120);
    // Das Leben läuft mit 30 Bildern; schneller nur, wenn sich der Versatz ändert
    const neu = erzwingen || verschoben || jetzt - lebenUm >= LEBEN_TAKT - 2;
    if (neu) {
      bildRechnen(p, (jetzt - lebenStart) / 1000);
      lebenUm = jetzt;
    }
    const dt = Math.min(0.05, Math.max(0.001, (jetzt - letztes) / 1000));
    if (p.spiel?.aktiv() && p.stapel) {
      const tabelle = p.szene.paletten[thema()];
      p.spiel.schritt(dt, p.bild8, p.stapel.hinten, p.stapel.vorn, tabelle, p.ausgabe);
      spielMelden(jetzt);
      spielLief = true;
      zeigen(p);
    } else if (neu || spielLief) {
      spielLief = false;
      abbilden(p);
      if (gemeldet && !bereitet) {
        gemeldet = false;
        if (!p.laedt) bergeText(p);
      }
      zeigen(p);
    }
  };

  // Steht die Maus still, während die Seite scrollt, meldet der Browser keine Bewegung. Die Bühne rechnet
  // die Lage darum aus der letzten Mausposition selbst nach: Das Bild gleitet unter dem Zeiger durch und
  // die Pixel weichen aus, ohne dass jemand die Maus bewegt.
  let maus: { x: number; y: number } | null = null; // letzte Mauslage im Fenster (clientX/Y)
  let zeigerPruefen = false;
  const zeigerNachfuehren = (jetzt: number) => {
    zeigerPruefen = false;
    if (!maus || bewegungReduziert) return;
    const ziel = document.elementFromPoint(maus.x, maus.y);
    if (ziel && p.bild.contains(ziel)) {
      const { x, y } = kunstLage(maus.x, maus.y);
      zeigerSetzen(x, y, jetzt);
    } else if (p.zeiger) verlassen();
  };

  const takt = (jetzt: number) => {
    laeuft = 0;
    if (!sichtbar || document.hidden) return;
    try {
      if (zeigerPruefen) zeigerNachfuehren(jetzt);
      const schnell = !!p.flug || !!p.spiel?.aktiv() || jetzt < eiligBis;
      if (jetzt - letztes >= (schnell ? SCHNELL_TAKT : LEBEN_TAKT) - 2) {
        bildMalen(jetzt);
        letztes = jetzt;
      }
    } catch (fehler) {
      letztes = jetzt;
      stoerung(fehler);
    } finally {
      laeuft = requestAnimationFrame(takt);
    }
  };

  const wecken = () => {
    if (!bewegungReduziert && !laeuft && sichtbar && !document.hidden) laeuft = requestAnimationFrame(takt);
  };

  /* Vorrat: die nächste Szene, im Hintergrund vorausgerechnet ------------------------- */

  // Neuer Startwert für ein wirklich anderes Bild: Die Landschaft war unter den letzten drei Bildern
  // nicht dabei, die Stimmung nicht unter den letzten zwei. Gelingt das nicht, reicht ein anderes Paar.
  const verlauf: { stimmung: string; landschaft: string }[] = [];
  const neuerStartwert = () => {
    if (p.szene) verlauf.unshift({ stimmung: p.szene.stimmung, landschaft: p.szene.landschaft });
    verlauf.length = Math.min(verlauf.length, 3);
    const passt = (e: { stimmung: string; landschaft: string }, streng: boolean) =>
      streng
        ? verlauf.every((v) => v.landschaft !== e.landschaft) && verlauf.slice(0, 2).every((v) => v.stimmung !== e.stimmung)
        : !verlauf[0] || (verlauf[0].landschaft !== e.landschaft && verlauf[0].stimmung !== e.stimmung);
    let wert = Math.floor(Math.random() * 1_000_000);
    for (let versuch = 0; versuch < 200 && !passt(entwurf(wert), versuch < 120); versuch++) {
      wert = Math.floor(Math.random() * 1_000_000);
    }
    return wert;
  };

  interface Vorrat {
    startwert: number;
    schluessel: string; // Größe und Sperre, zu denen szene passt
    szene: BergSzene | null;
    leben: Leben | null;
    auftrag: number; // laufender Auftrag an den Hilfsarbeiter (0 = keiner)
  }
  let vorrat: Vorrat | null = null;
  let auftraege = 0;

  // Der Hilfsarbeiter rechnet Szenen ohne den Hauptfaden. Geht er nicht (alter Browser, Fehler), rechnet
  // die Bühne selbst, aber nur im Leerlauf und nie während eines Flugs.
  let werk: Worker | null | undefined; // undefined: noch nicht gestartet
  const werkHolen = (): Worker | null => {
    if (werk !== undefined) return werk;
    try {
      werk = new Worker(new URL("./berge-werk.ts", import.meta.url), { type: "module" });
    } catch {
      werk = null;
      return null;
    }
    const w = werk;
    const aufgeben = () => {
      w.terminate();
      werk = null;
      if (vorrat) vorrat.auftrag = 0;
      leerlaufPlanen();
    };
    w.onmessage = (e: MessageEvent<{ nr: number; szene?: BergSzene; fehler?: string }>) => {
      const { nr, szene } = e.data;
      if (!szene) return aufgeben();
      if (!vorrat || vorrat.auftrag !== nr) return; // veraltet: Größe oder Sperre haben sich geändert
      vorrat.auftrag = 0;
      vorrat.szene = szene;
      leerlaufPlanen();
    };
    w.onerror = (e) => {
      e.preventDefault();
      aufgeben();
    };
    return w;
  };

  // Bewegte Arbeit läuft: Dann wartet der Vorrat, bis sie vorbei ist (flugBeenden, Auftritt, Klick)
  const beschaeftigt = () => !!p.flug || bereitet || p.laedt;

  const vorbestellen = () => {
    if (bewegungReduziert || !p.szene) return;
    if (!vorrat) vorrat = { startwert: neuerStartwert(), schluessel: "", szene: null, leben: null, auftrag: 0 };
    const schluessel = massSchluessel(p.B, p.H, p.sperre);
    if (vorrat.schluessel !== schluessel) {
      // Größe oder Sperre haben sich geändert: Der Startwert bleibt, die Szene wird neu gerechnet
      vorrat.schluessel = schluessel;
      vorrat.szene = null;
      vorrat.leben = null;
      vorrat.auftrag = 0;
    }
    if (vorrat.szene || vorrat.auftrag) return leerlaufPlanen();
    const w = werkHolen();
    if (w) {
      vorrat.auftrag = ++auftraege;
      w.postMessage({ nr: vorrat.auftrag, B: p.B, H: p.H, startwert: vorrat.startwert, sperre: p.sperre });
    } else leerlaufPlanen();
  };

  // Im Leerlauf je Aufruf ein Arbeitsschritt: Szene (nur ohne Hilfsarbeiter), dann das Leben dazu
  let leerGeplant = false;
  const leerlauf = () => {
    leerGeplant = false;
    const v = vorrat;
    if (!p.szene) return;
    // Bestellt wird erst, wenn das Bild in Sicht ist: Wer nie dorthin scrollt, lädt auch keinen Hilfsarbeiter
    if (!v) return sichtbar ? vorbestellen() : undefined;
    if (v.schluessel !== massSchluessel(p.B, p.H, p.sperre)) return vorbestellen();
    if (beschaeftigt()) return;
    // Spielt gerade jemand mit der Maus, würde ein langer Schritt ruckeln: etwas später nochmal
    if (p.spiel?.aktiv()) {
      setTimeout(leerlaufPlanen, 400);
      return;
    }
    if (!v.szene) {
      if (v.auftrag || werk) return;
      v.szene = bergeSzene(p.B, p.H, v.startwert, p.sperre);
      leerlaufPlanen();
      return;
    }
    if (!v.leben) v.leben = lebenErwecken(v.szene);
  };
  function leerlaufPlanen(): void {
    if (leerGeplant || bewegungReduziert) return;
    leerGeplant = true;
    imLeerlauf(leerlauf);
  }

  /* Zeichnen, Neuzeichnen ------------------------------------------------------ */

  // Lage eines Elements in Kunstpixeln des Canvas (kann außerhalb liegen, etwa das HUD auf dem Handy)
  const kunstLage = (x: number, y: number) => {
    const r = p.canvas.getBoundingClientRect();
    return { x: ((x - r.left) / r.width) * p.B, y: ((y - r.top) / r.height) * p.H };
  };

  const zeichnen = () => {
    p.flug = null;
    if (!bereitet) p.buehne.removeAttribute("data-wirbel");
    massAnwenden(p, messen(p));
    puffer(p);
    szeneRechnen(p, !bewegungReduziert);
    p.versatz = p.soll.slice();
    lebenStart = performance.now();
    lebenUm = -Infinity;
    if (bewegungReduziert) standbild(p);
    else bildMalen(lebenStart, true);
    szeneMelden(p, !bereitet);
    // Ein Klick ohne Flug (reduzierte Bewegung, Größenwechsel im Flug) wird hier angesagt
    if (ansageFaellig && !bereitet) {
      ansageFaellig = false;
      ansagen(p);
    }
    wecken();
    // Ein Vorrat zur alten Größe taugt nicht mehr; ohne Vorrat beginnt hier die erste Bestellung
    leerlaufPlanen();
  };

  let lauf = 0; // ein neuer Klick macht ältere, noch geplante Schritte ungültig

  // „Neu zeichnen“: Die Arbeit verteilt sich auf mehrere Aufgaben mit je einem Bild dazwischen, das alte
  // Bild lebt währenddessen weiter. Liegt die Szene schon im Vorrat (der Normalfall), bleiben nur das
  // Flugziel und der Aufbau der Choreografie.
  const neuZeichnen = async () => {
    // Ein Klick wird schon vorbereitet: Er zeigt gleich das neue Bild, ein zweiter würde ihn nur verwerfen
    if (bereitet) return;
    nutzung("Berge", "neu gezeichnet");
    const meinLauf = ++lauf;
    const naechst: Vorrat = vorrat ?? { startwert: neuerStartwert(), schluessel: "", szene: null, leben: null, auftrag: 0 };
    vorrat = null;
    ansageFaellig = true;
    if (bewegungReduziert) {
      p.startwert = naechst.startwert;
      p.wahl = undefined;
      zeichnen();
      return;
    }
    bereitet = true;
    p.buehne.setAttribute("data-wirbel", "");
    bergeText(p, "Zeichnet neu …");
    let gestartet = false;
    try {
      // Erst nach dem nächsten Bild rechnen: Der Klick wird sofort sichtbar
      await atem();
      if (meinLauf !== lauf) return;
      let m = messen(p);
      let schluessel = massSchluessel(m.B, m.H, m.sperre);
      let szene = naechst.schluessel === schluessel ? naechst.szene : null;
      let leben = szene ? naechst.leben : null;
      if (!szene) {
        // Vorrat noch nicht fertig: Die Szene entsteht jetzt, in einer eigenen Aufgabe
        szene = bergeSzene(m.B, m.H, naechst.startwert, m.sperre);
        await atem();
        if (meinLauf !== lauf) return;
      }
      if (!leben) {
        leben = lebenErwecken(szene);
        await atem();
        if (meinLauf !== lauf) return;
      }
      // Ziel des Flugs: Standbild mit Leben bei t = 0, im Versatz, der gerade zu sehen ist. Es entsteht in
      // den Zweitpuffern, denn ein laufender Flug liest noch sein eigenes Ziel.
      const versatz = p.versatz.slice();
      const n = szene.B * szene.H;
      const stapel = zusammensetzen(szene, versatz, p.reserveStapel?.farbe.length === n ? p.reserveStapel : undefined);
      const ziel8 = p.reserve8.length === n ? p.reserve8 : new Uint8Array(n);
      ziel8.set(stapel.farbe);
      leben.zeichnen(ziel8, stapel.vorn, 0, versatz, thema());
      await atem();
      if (meinLauf !== lauf) return;
      // Hat sich die Größe inzwischen geändert, passt das Ziel nicht mehr: dann ohne Flug neu zeichnen
      m = messen(p);
      schluessel = massSchluessel(m.B, m.H, m.sperre);
      if (m.B !== szene.B || m.H !== szene.H) {
        p.startwert = naechst.startwert;
        p.wahl = undefined;
        bereitet = false;
        zeichnen();
        gestartet = true;
        return;
      }
      // Was gerade zu sehen ist, fliegt los (auch mitten in einem laufenden Flug)
      if (p.altPuffer.length !== p.ausgabe.length) p.altPuffer = new Uint32Array(p.ausgabe.length);
      p.altPuffer.set(p.ausgabe);
      const alt = { B: p.B, H: p.H, rgba: p.altPuffer };
      const groesser = m.B !== p.B || m.H !== p.H;
      massAnwenden(p, m);
      puffer(p);
      const tabelle = szene.paletten[thema()];
      const knopf = p.knopf?.getBoundingClientRect();
      const flug = flugStarten({
        alt,
        neu: { B: m.B, H: m.H, farbe: ziel8, tabelle, vorn: stapel.vorn },
        himmel: tabelle[BOGEN],
        grund: tabelle[T6],
        fest: nachtAb(m.H),
        ursprung: knopf ? kunstLage(knopf.left + knopf.width / 2, knopf.top + knopf.height / 2) : null,
        vorher: p.flugName,
        sperre: p.sperre,
        zeiger: () => p.zeiger,
        status: (text) => bergeText(p, text),
        // Dieselbe Zahl, die die Statuszeile nach der Landung zeigt (bergeText): kein Sprung, auch nachts
        farbZahl: szene.farbAnzahl.light,
      });
      // Ab hier gehört das Bild der neuen Szene; die alten Puffer werden zur Reserve
      p.startwert = naechst.startwert;
      p.wahl = undefined;
      p.szene = szene;
      p.leben = leben;
      p.reserveStapel = p.stapel;
      p.stapel = stapel;
      p.stapelVersatz = versatz.join();
      p.reserve8 = p.bild8;
      p.bild8 = ziel8;
      p.versatz = versatz;
      if (p.spiel) p.spiel.groesse(m.B, m.H, nachtAb(m.H));
      else p.spiel = spielErstellen(m.B, m.H, nachtAb(m.H));
      p.flug = flug;
      p.flugName = flug.name;
      gestartet = true;
      bereitet = false;
      letztes = 0; // das erste Flugbild kommt ohne Bremse
      // Ein geleertes Canvas (neue Größe) sofort füllen, sonst blitzt es einen Augenblick weiß
      if (groesser) {
        bildMalen(performance.now());
        letztes = performance.now();
      }
      wecken();
      // Der Hilfsarbeiter rechnet schon während des Flugs am nächsten Bild
      vorbestellen();
    } catch (fehler) {
      stoerung(fehler);
    } finally {
      bereitet = false;
      if (!gestartet && meinLauf === lauf) {
        // Etwas ist schiefgegangen: Das alte Bild bleibt, der Wirbel endet, der Vermerk kehrt zurück
        ansageFaellig = false;
        if (!p.flug) p.buehne.removeAttribute("data-wirbel");
        bergeText(p);
        wecken();
        vorbestellen();
      }
    }
  };

  /* Parallax: Der Scrollfortschritt verschiebt die Ebenen in ganzen Kunstpixeln ---- */

  const ebenenFrage = window.matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)");
  let parallax: gsap.core.Tween | null = null;
  const stand = { fortschritt: 0.5 };
  const versatzSetzen = () => {
    const an = ebenenFrage.matches;
    let geaendert = false;
    for (let e = 0; e < 4; e++) {
      const v = an ? Math.round((2 * stand.fortschritt - 1) * TIEFE[e]) : 0;
      if (v !== p.soll[e]) {
        p.soll[e] = v;
        geaendert = true;
      }
    }
    if (geaendert) {
      eiligBis = performance.now() + 250;
      wecken();
    }
  };
  const parallaxSchalten = () => {
    if (ebenenFrage.matches && !parallax) {
      parallax = gsap.fromTo(
        stand,
        { fortschritt: 0 },
        {
          fortschritt: 1,
          ease: "none",
          onUpdate: versatzSetzen,
          scrollTrigger: { trigger: p.bild, start: "top bottom", end: "bottom top", scrub: 0.6 },
        },
      );
    } else if (!ebenenFrage.matches && parallax) {
      parallax.scrollTrigger?.kill();
      parallax.kill();
      parallax = null;
    }
    versatzSetzen();
  };

  /* Maus und Finger ------------------------------------------------------------ */

  // Während der Vorbereitung und des Flugs gehört das Bild dem Übergang: Die Lage des Zeigers zählt
  // (der Flug weicht ihm aus), aber das Spiel ruht und bekommt erst nach der Landung wieder Eingaben.
  function zeigerSetzen(x: number, y: number, zeit: number): void {
    p.zeiger = { x, y };
    if (!p.flug) p.spiel?.zeiger(x, y, zeit);
    p.leben?.zeiger(x, y);
    wecken();
  }
  function verlassen(): void {
    p.spiel?.druck(false);
    p.zeiger = null;
    p.spiel?.weg();
    p.leben?.weg();
  }

  if (!bewegungReduziert) {
    const lage = (e: PointerEvent) => kunstLage(e.clientX, e.clientY);
    // Der Finger auf dem Bild: Erst sein Weg entscheidet, ob er tippt, waagerecht wischt (Pixel schieben)
    // oder senkrecht scrollt (dann bleiben die Pixel in Ruhe)
    let finger: { id: number; x: number; y: number; t: number; weg: boolean; frei: boolean } | null = null;
    // Für die Statistik: Wie lange die Maustaste gedrückt war (ab 250 ms knallt es), und wie weit die Maus
    // über dem Bild gewandert ist. Erst echtes Bewegen zählt als Spielen, beim Scrollen schickt der
    // Browser auch Zeigerereignisse, nur ohne Weg.
    let gedruecktSeit: number | null = null;
    let mausWeg = 0;
    let letzteMaus: { x: number; y: number } | null = null;

    document.addEventListener(
      "pointermove",
      (e) => {
        if (e.pointerType === "mouse") maus = { x: e.clientX, y: e.clientY };
      },
      { passive: true },
    );
    // Maus hat das Fenster verlassen
    document.addEventListener("pointerout", (e) => {
      if (e.pointerType === "mouse" && !e.relatedTarget) maus = null;
    });
    window.addEventListener(
      "scroll",
      () => {
        if (!maus) return;
        zeigerPruefen = true;
        wecken();
      },
      { passive: true },
    );

    bild.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse" && finger?.id === e.pointerId && !finger.frei) {
        const dx = e.clientX - finger.x;
        const dy = e.clientY - finger.y;
        if (Math.hypot(dx, dy) <= TIPP_WEG) return;
        finger.weg = true;
        if (Math.abs(dy) > Math.abs(dx)) return;
        finger.frei = true;
        nutzung("Berge", "Pixel gewischt");
      }
      if (e.pointerType === "mouse" && mausWeg < MAUS_SPIELT) {
        if (letzteMaus) mausWeg += Math.abs(e.clientX - letzteMaus.x) + Math.abs(e.clientY - letzteMaus.y);
        letzteMaus = { x: e.clientX, y: e.clientY };
        if (mausWeg >= MAUS_SPIELT) nutzung("Berge", "Pixel mit der Maus verschoben");
      }
      const { x, y } = lage(e);
      zeigerSetzen(x, y, e.timeStamp);
    });
    // Gleitet das Bild beim Scrollen unter die ruhende Maus, kommt nur pointerenter, kein pointermove
    bild.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse") return;
      maus = { x: e.clientX, y: e.clientY };
      const { x, y } = lage(e);
      zeigerSetzen(x, y, e.timeStamp);
    });
    // Drücken schlägt eine Welle, Halten zieht einen Strudel auf, Loslassen schleudert ihn fort.
    // Der Finger löst nur die Welle aus, und erst beim Loslassen eines echten Tipps: Wer auf dem Bild
    // eine Scrollgeste beginnt, lässt es nicht aufstieben. Halten bleibt dem Scrollen und dem Kontextmenü.
    bild.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      finger = null;
      // Im Übergang verpufft ein Klick, statt sich aufzustauen und nach der Landung loszugehen
      if (p.flug || bereitet) return;
      const { x, y } = lage(e);
      if (e.pointerType === "mouse") {
        nutzung("Berge", "ins Bild geklickt");
        gedruecktSeit = e.timeStamp;
        zeigerSetzen(x, y, e.timeStamp);
        spiele("plopp", { pan: (x / p.B) * 2 - 1 });
        p.spiel?.stoss(x, y, 0.8);
        p.leben?.stoss(x, y);
        p.canvas.setPointerCapture(e.pointerId);
        p.spiel?.druck(true);
      } else finger = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, weg: false, frei: false };
      wecken();
    });
    bild.addEventListener("pointerup", (e) => {
      p.spiel?.druck(false);
      if (gedruecktSeit !== null && e.pointerType === "mouse" && e.timeStamp - gedruecktSeit >= KNALL_AB_MS) {
        nutzung("Berge", "Strudel zum Knall gebracht");
      }
      gedruecktSeit = null;
      const f = finger;
      finger = null;
      if (
        f &&
        f.id === e.pointerId &&
        !f.weg &&
        e.timeStamp - f.t < TIPP_DAUER &&
        Math.hypot(e.clientX - f.x, e.clientY - f.y) <= TIPP_WEG &&
        !p.flug &&
        !bereitet
      ) {
        const { x, y } = lage(e);
        nutzung("Berge", "ins Bild getippt");
        zeigerSetzen(x, y, e.timeStamp);
        spiele("plopp", { pan: (x / p.B) * 2 - 1 });
        p.spiel?.stoss(x, y, 0.8);
        p.leben?.stoss(x, y);
      }
      wecken();
    });
    bild.addEventListener("pointerleave", verlassen);
    bild.addEventListener("pointercancel", () => {
      finger = null;
      verlassen();
    });
  }

  /* Auftritt: Das Bild baut sich zeilenweise auf wie eine BMP-Datei beim Laden ---- */

  if (!bewegungReduziert && p.bild.getBoundingClientRect().top > window.innerHeight) {
    gsap.set(p.bild, { clipPath: "inset(0 0 100% 0)" });
    p.laedt = true;
    bergeText(p, "Lädt … 0 %");
    ScrollTrigger.create({
      trigger: p.bild,
      start: "top 75%",
      once: true,
      onEnter: () => {
        const zeilen = Math.max(8, Math.round(p.bild.clientHeight / p.px / 2));
        const auftritt: gsap.core.Tween = gsap.to(p.bild, {
          clipPath: "inset(0 0 0% 0)",
          duration: window.innerWidth < 768 ? 1 : 1.4,
          ease: `steps(${zeilen})`,
          onUpdate: () => bergeText(p, `Lädt … ${Math.round(auftritt.ratio * 100)} %`),
          onComplete: () => {
            p.laedt = false;
            gsap.set(p.bild, { clearProps: "clipPath" });
            if (!bereitet && !p.flug) bergeText(p);
            leerlaufPlanen();
          },
        });
      },
    });
  }

  /* Größe, Sichtbarkeit, Thema ---------------------------------------------------- */

  let breite = 0;
  let hoehe = 0;
  let geplant = 0;
  new ResizeObserver((eintraege) => {
    const neuBreite = Math.round(eintraege[0].contentRect.width);
    const neuHoehe = Math.round(eintraege[0].contentRect.height);
    if (neuBreite === breite && neuHoehe === hoehe) return;
    breite = neuBreite;
    hoehe = neuHoehe;
    cancelAnimationFrame(geplant);
    geplant = requestAnimationFrame(() => {
      if (!bewegungReduziert) parallaxSchalten();
      zeichnen();
    });
  }).observe(bild);

  if (!bewegungReduziert) {
    ebenenFrage.addEventListener("change", parallaxSchalten);
    new IntersectionObserver(
      (eintraege) => {
        sichtbar = eintraege[0].isIntersecting;
        if (!sichtbar) return;
        wecken();
        // Kommt das Bild in Sicht, beginnt die Arbeit an der nächsten Szene
        leerlaufPlanen();
      },
      { rootMargin: "100px 0px" },
    ).observe(bild);
    document.addEventListener("visibilitychange", wecken);
  }

  p.knopf?.addEventListener("click", () => void neuZeichnen());

  // Hell/dunkel: synchron neu malen, ohne die Szene neu zu rechnen. Der Übergang der Seite nimmt
  // den neuen Schnappschuss sofort; ein laufender Flug springt ans Ziel.
  const umfaerben = () => {
    if (!p.szene) return;
    if (p.flug) flugBeenden();
    if (bewegungReduziert) standbild(p);
    else bildMalen(performance.now(), true);
    szeneMelden(p, !bereitet);
  };
  document.addEventListener("theme", umfaerben);
  // Druck im Dunkelmodus: Das Papier zeigt das Tagbild, danach gilt wieder das Thema der Seite
  window.addEventListener("beforeprint", () => {
    druckt = true;
    umfaerben();
  });
  window.addEventListener("afterprint", () => {
    druckt = false;
    umfaerben();
  });
}
