/* Hero: Aktenstapel zum Abstempeln ------------------------------------------------
   Die oberste Akte füllt sich selbst aus. Über dem Bogen nimmt der Mauszeiger den Stempel vom
   Kissen in die Hand; ein Klick (Tippen, Enter, Leertaste) drückt ihn genau dort auf, und die
   Akte fliegt samt Durchschlägen in die Ablage. Darunter liegt schon die nächste und druckt sich
   aus. Nach der letzten liegt die Tagesübersicht oben und bekommt von selbst „Feierabend“.

   Geworfen wird wie im Kartenstapel des Zeitfresser-Checks eine Kopie (Geist), der echte Stapel
   ist sofort die nächste Akte. Die Kopien im echten Stapel bewegt GSAP nur über transform, nie
   über translate: Das gehört dem Nachhängen beim Scrollen (buehne.ts).
   Bedient wird über einen echten Knopf, der deckungsgleich über dem Bogen liegt. Der Bogen selbst
   bleibt Bild (aria-hidden), Beschriftung und Ansage tragen die Bedeutung. */

import { gsap } from "gsap";
import { FEIERABEND, STEMPEL_ZEICHEN_MAX, mitJahr } from "../data/akten";
import { spiele } from "./klang";
import { nutzung } from "./nutzung";
import { ploppen } from "./zeitfresser-stapel";

declare global {
  interface Window {
    __belegGestartet?: boolean;
  }
}

type Punkt = { x: number; y: number };
// druckt: Werte erscheinen gerade (ein Klick zieht den Druck vor), stempelt: gesperrt bis zum Wurf
type Zustand = "druckt" | "bereit" | "stempelt" | "fertig";
// Lage des Bogens, einmal je Stempel gemessen: Mitte am Bildschirm, Größe ungedreht, Drehung
type Lage = { mitte: Punkt; w: number; h: number; cos: number; sin: number; figur: DOMRect };

// Auf dem Kissen steht der Stempel kleiner und schräg
const PARK_SKALA = 0.45;
const PARK_DREHUNG = -10;
// Am Tagesende liegt er etwas weiter gekippt
const FEIERABEND_DREHUNG = -16;
// So hoch schwebt der Stempel in der Hand über dem Papier (px)
const HUB = -16;
// Neigung in Bewegungsrichtung: Grad je px/s, höchstens ±9°
const NEIGUNG_JE_TEMPO = 0.006;
const NEIGUNG_MAX = 9;
// Nachlauf des Stempels (Zeitkonstante in s): folgen, Anflug, Drehung und Größe
const NACHLAUF = 0.055;
const NACHLAUF_DREHUNG = 0.1;
// Abdruck wie .stempel im CSS: 37 % der Bogenbreite, Seitenverhältnis des SVG, Grundlage links unten
const ABDRUCK_BREITE = 0.37;
const ABDRUCK_SEITEN = 104 / 260;
const ABDRUCK_LINKS = 0.055;
const ABDRUCK_UNTEN = 0.125;
const RAND = 0.03;
const TINTEN = ["stempel-tinte", "stempel-tinte-2", "stempel-tinte-3"];

const begrenzt = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const zufall = (min: number, max: number) => min + Math.random() * (max - min);
// ERLEDIGT → Erledigt, für Ansage und Beschriftung
const wort = (text: string) => text.charAt(0) + text.slice(1).toLowerCase();
const ZAHLWORTE = ["null", "eine", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn"];

function vibrieren(): void {
  try {
    navigator.vibrate?.(10);
  } catch {
    // dann eben nur sichtbar
  }
}

export function belegEinrichten(ruhig: boolean): void {
  const wurzel = document.documentElement;
  const figur = document.querySelector<HTMLElement>("[data-beleg-figur]");
  const stapel = figur?.querySelector<HTMLElement>("[data-beleg]");
  const bogen = stapel?.querySelector<HTMLElement>(".beleg__bogen");
  const knopf = stapel?.querySelector<HTMLButtonElement>("[data-beleg-stempeln]");
  const abschluss = bogen?.querySelector<HTMLElement>("[data-akte-abschluss]");
  const vorlage = bogen?.querySelector<SVGSVGElement>(".stempel--vorlage");
  const griff = figur?.querySelector<HTMLElement>("[data-stempelgriff]");
  const koerper = griff?.querySelector<HTMLElement>("[data-griff-koerper]");
  const schatten = griff?.querySelector<HTMLElement>("[data-griff-schatten]");
  const tisch = figur?.querySelector<HTMLElement>("[data-beleg-tisch]");
  const kissen = tisch?.querySelector<HTMLElement>("[data-stempelkissen]");
  const ablage = tisch?.querySelector<HTMLElement>("[data-ablage]");
  const blaetter = tisch?.querySelector<HTMLElement>("[data-ablage-blaetter]");
  if (
    !figur || !stapel || !bogen || !knopf || !abschluss || !vorlage || !griff || !koerper || !schatten ||
    !tisch || !kissen || !ablage || !blaetter
  ) {
    wurzel.classList.remove("bewegung", "stempeln");
    return;
  }

  window.__belegGestartet = true;

  const kopien = Array.from(stapel.querySelectorAll<HTMLElement>(".beleg__kopie"));
  const akten = Array.from(bogen.querySelectorAll<HTMLElement>(".beleg__akte[data-akte]"));
  const griffText = griff.querySelector<SVGTextElement>("[data-griff-text]");
  const zaehler = tisch.querySelector<HTMLElement>("[data-ablage-zaehler]");
  const hinweis = figur.querySelector<HTMLElement>("[data-beleg-hinweis]");
  const unterschrift = figur.querySelector<HTMLElement>("[data-beleg-unterschrift]");
  const kontakt = figur.querySelector<HTMLElement>("[data-beleg-kontakt]");
  const nochmal = figur.querySelector<HTMLButtonElement>("[data-beleg-nochmal]");
  const kurz = figur.querySelector<HTMLElement>("[data-beleg-kurz]");
  const ansage = figur.querySelector<HTMLElement>("[data-beleg-ansage]");
  const feinerZeiger = window.matchMedia("(hover: hover) and (pointer: fine)");
  const jahr = new Date().getFullYear();
  const anzahl = akten.length;

  const daten = (akte: HTMLElement, schluessel: string) => mitJahr(akte.dataset[schluessel] ?? "", jahr);
  const aktive = () => akten[index] ?? null;

  /* Start: Endlage der Kopien lesen ---------------------------------------- */

  // Die Klasse "bewegung" hält bis hierhin den Startzustand; sie wird entfernt und im selben
  // Takt durch Inline-Stile ersetzt, damit nichts aufblitzt. "ist-stempelbar" versteckt den
  // statischen Stempel, bevor "stempeln" (Base.astro) ihn freigibt.
  figur.classList.add("ist-stempelbar");
  wurzel.classList.remove("bewegung", "stempeln");
  const kopieZiele = kopien.map((kopie) => {
    const m = new DOMMatrix(getComputedStyle(kopie).transform);
    return { x: m.e, y: m.f, rotation: (Math.atan2(m.b, m.a) * 180) / Math.PI };
  });

  // Der Knopf trägt jetzt die Bedeutung, der Stapel ist kein Bild mehr
  stapel.removeAttribute("role");
  stapel.removeAttribute("aria-label");
  knopf.hidden = false;
  tisch.hidden = false;
  griff.hidden = false;
  if (hinweis) hinweis.hidden = false;

  let zustand: Zustand = "druckt";
  let index = 0;
  let erledigt = 0;
  let gestempelt = false;
  let druck: gsap.core.Timeline | null = null;
  let tinte = 0;
  // Laufende Abläufe, die „Stapel neu auflegen“ abbricht
  const laufend = new Set<gsap.core.Animation>();
  const merken = <T extends gsap.core.Animation>(a: T): T => {
    laufend.forEach((b) => b.progress() === 1 && laufend.delete(b));
    laufend.add(a);
    return a;
  };

  /* Ansage und Beschriftung --------------------------------------------------- */

  let ansageZeitgeber = 0;
  const ansagen = (text: string) => {
    if (!ansage) return;
    // Erst leeren, damit auch derselbe Text noch einmal angesagt wird; eine neue Ansage ersetzt
    // eine noch nicht gesetzte
    window.clearTimeout(ansageZeitgeber);
    ansage.textContent = "";
    ansageZeitgeber = window.setTimeout(() => (ansage.textContent = text), 120);
  };

  // Verglichen wird mit dem Ziel, nicht mit dem DOM: Beim Ausblenden steht dort noch der alte Text
  let unterschriftZiel = unterschrift?.textContent ?? "";
  const unterschriftSetzen = (text: string) => {
    if (!unterschrift || unterschriftZiel === text) return;
    unterschriftZiel = text;
    if (ruhig) {
      unterschrift.textContent = text;
      return;
    }
    gsap.to(unterschrift, {
      opacity: 0,
      duration: 0.15,
      overwrite: true,
      onComplete: () => {
        unterschrift.textContent = text;
        gsap.to(unterschrift, { opacity: 1, duration: 0.2, overwrite: true });
      },
    });
  };

  const aktivieren = (akte: HTMLElement) => {
    [...akten, abschluss].forEach((a) => a.toggleAttribute("data-aktiv", a === akte));
    if (akte === abschluss) return;
    const i = akten.indexOf(akte);
    const stempel = akte.dataset.stempel ?? "";
    knopf.setAttribute("aria-label", `${daten(akte, "name")} abstempeln: ${wort(stempel)}`);
    if (kurz) kurz.textContent = `${daten(akte, "kurz")} Beispielakte ${i + 1} von ${anzahl}.`;
    if (griffText) griffText.textContent = stempel;
    unterschriftSetzen(daten(akte, "bildunterschrift"));
  };

  /* Druck: Werte erscheinen wie vom Drucker gesetzt, die Kopien fächern auf ---- */

  const drucken = (akte: HTMLElement, start = false, verzoegerung = 0): gsap.core.Timeline => {
    const werte = akte.querySelectorAll<HTMLElement>("[data-wert]");
    const zeitleiste = gsap.timeline({ delay: verzoegerung });
    if (ruhig) {
      gsap.set(werte, { clearProps: "clipPath" });
      return zeitleiste;
    }
    gsap.set(werte, { clipPath: "inset(0 100% 0 0)" });
    gsap.set(kopien, { x: 0, y: 0, rotation: 0 });
    zeitleiste
      .to(werte, {
        clipPath: "inset(0 0% 0 0)",
        duration: start ? 0.15 : 0.1,
        ease: "none",
        stagger: start ? 0.07 : 0.03,
        delay: start ? 0.35 : 0,
      })
      .to(
        kopien,
        {
          x: (i: number) => kopieZiele[i].x,
          y: (i: number) => kopieZiele[i].y,
          rotation: (i: number) => kopieZiele[i].rotation,
          duration: start ? 0.5 : 0.4,
          ease: "power3.out",
          stagger: { each: 0.07, from: "end" },
        },
        start ? "+=0.12" : "-=0.2",
      );
    return zeitleiste;
  };

  const druckStarten = (akte: HTMLElement, start = false, verzoegerung = 0, danach?: () => void) => {
    druck?.kill();
    zustand = akte === abschluss ? "fertig" : "druckt";
    const zeitleiste = drucken(akte, start, verzoegerung);
    druck = zeitleiste;
    const fertig = () => {
      if (druck === zeitleiste) druck = null;
      if (zustand === "druckt") zustand = "bereit";
      danach?.();
    };
    if (ruhig) {
      fertig();
      return;
    }
    zeitleiste.eventCallback("onComplete", fertig);
  };

  /* Lage: Bildschirm, Bogen (ungedreht) und Figur ------------------------------ */

  const lageMessen = (): Lage => {
    const r = bogen.getBoundingClientRect();
    // Drehung des Stapels aus dem CSS (−1,2° bzw. −0,6° je nach Breite)
    const m = new DOMMatrix(getComputedStyle(stapel).transform);
    const winkel = Math.atan2(m.b, m.a);
    return {
      mitte: { x: r.left + r.width / 2, y: r.top + r.height / 2 },
      w: bogen.offsetWidth,
      h: bogen.offsetHeight,
      cos: Math.cos(winkel),
      sin: Math.sin(winkel),
      figur: figur.getBoundingClientRect(),
    };
  };

  // Bildschirmpunkt → Punkt auf dem ungedrehten Bogen (px ab oben links)
  const aufBogen = (l: Lage, p: Punkt): Punkt => {
    const dx = p.x - l.mitte.x;
    const dy = p.y - l.mitte.y;
    return { x: l.cos * dx + l.sin * dy + l.w / 2, y: -l.sin * dx + l.cos * dy + l.h / 2 };
  };

  // Punkt auf dem Bogen → Punkt in der Figur (dort lebt der Stempel)
  const inFigur = (l: Lage, p: Punkt): Punkt => {
    const dx = p.x - l.w / 2;
    const dy = p.y - l.h / 2;
    return {
      x: l.mitte.x + l.cos * dx - l.sin * dy - l.figur.left,
      y: l.mitte.y + l.sin * dx + l.cos * dy - l.figur.top,
    };
  };

  // Der Abdruck bleibt ganz auf dem Blatt
  const aufsBlatt = (l: Lage, p: Punkt): Punkt => {
    const halbB = (ABDRUCK_BREITE * l.w) / 2;
    const halbH = halbB * ABDRUCK_SEITEN;
    return {
      x: begrenzt(p.x, halbB + RAND * l.w, l.w - halbB - RAND * l.w),
      y: begrenzt(p.y, halbH + RAND * l.h, l.h - halbH - RAND * l.h),
    };
  };

  // Ohne Zeigerpunkt (Tastatur, Feierabend): das freie Feld links neben den Summen
  const grundStelle = (l: Lage): Punkt => ({
    x: l.w * (ABDRUCK_LINKS + ABDRUCK_BREITE / 2),
    y: l.h * (1 - ABDRUCK_UNTEN) - (ABDRUCK_BREITE * l.w * ABDRUCK_SEITEN) / 2,
  });

  /* Der Stempel in der Hand ---------------------------------------------------
     Eigene kleine Schleife: Lage, Drehung und Größe laufen dem Ziel mit einer Zeitkonstante
     nach, die Neigung kommt aus dem Tempo. Sie läuft nur, solange sich etwas bewegt.
     Heben, Drücken und Wiegen macht GSAP am Körper darin. */

  const g = { x: 0, y: 0, r: PARK_DREHUNG, s: PARK_SKALA, neigung: 0 };
  const ziel = { x: 0, y: 0, r: PARK_DREHUNG, s: PARK_SKALA };
  let rahmen = 0;
  let zuletzt = 0;
  // folgt: der Stempel hängt am Zeiger; zeigerDrin: Maus über dem Bogen; drueckt: Ablauf beim Klick
  let folgt = false;
  let zeigerDrin = false;
  let drueckt = false;
  let schwebt = false;
  let zeiger: Punkt | null = null;
  let letzterZeiger = "";
  // Ecke der Figur am Bildschirm; gemessen beim Betreten, Scrollen und neuer Größe, nicht je Frame
  let figurEcke: Punkt = { x: 0, y: 0 };
  const figurMessen = () => {
    const f = figur.getBoundingClientRect();
    figurEcke = { x: f.left, y: f.top };
  };
  // Wackler aus stupsen(): Heben und Aufsetzen beenden ihn, sonst setzt sein letzter Schritt
  // den Körper später wieder aufs Papier
  let wackler: gsap.core.Timeline | null = null;
  const wacklerBeenden = () => {
    wackler?.kill();
    wackler = null;
  };

  const zeichnen = () => {
    griff.style.transform =
      `translate3d(${g.x.toFixed(2)}px, ${g.y.toFixed(2)}px, 0) ` +
      `rotate(${(g.r + g.neigung).toFixed(2)}deg) scale(${g.s.toFixed(3)})`;
  };

  const schritt = (jetzt: number) => {
    const dt = Math.min(0.05, Math.max(0.001, (jetzt - zuletzt) / 1000));
    zuletzt = jetzt;
    const k = ruhig ? 1 : 1 - Math.exp(-dt / NACHLAUF);
    const kd = ruhig ? 1 : 1 - Math.exp(-dt / NACHLAUF_DREHUNG);
    const schrittX = (ziel.x - g.x) * k;
    g.x += schrittX;
    g.y += (ziel.y - g.y) * k;
    g.r += (ziel.r - g.r) * kd;
    g.s += (ziel.s - g.s) * kd;
    const neigungZiel = ruhig || !folgt ? 0 : begrenzt((schrittX / dt) * NEIGUNG_JE_TEMPO, -NEIGUNG_MAX, NEIGUNG_MAX);
    g.neigung += (neigungZiel - g.neigung) * kd;
    zeichnen();
    // Der Mauszeiger verschwindet erst, wenn der Stempel unter ihm angekommen ist
    if (folgt && Math.hypot(ziel.x - g.x, ziel.y - g.y) < 24) figur.classList.add("ist-folgt");
    const ruht =
      Math.abs(ziel.x - g.x) < 0.1 &&
      Math.abs(ziel.y - g.y) < 0.1 &&
      Math.abs(ziel.r - g.r) < 0.05 &&
      Math.abs(ziel.s - g.s) < 0.002 &&
      Math.abs(g.neigung) < 0.05;
    rahmen = ruht ? 0 : requestAnimationFrame(schritt);
  };

  const anstossen = () => {
    if (rahmen) return;
    zuletzt = performance.now();
    rahmen = requestAnimationFrame(schritt);
  };

  const springen = () => {
    g.x = ziel.x;
    g.y = ziel.y;
    g.r = ziel.r;
    g.s = ziel.s;
    g.neigung = 0;
    zeichnen();
  };

  const dauer = (s: number) => (ruhig ? 0 : s);

  // Über dem Papier: angehoben, der Schatten liegt weit weg und blass
  const heben = (s = 0.18) => {
    wacklerBeenden();
    gsap.to(koerper, { y: HUB, scaleX: 1, scaleY: 1, opacity: 1, duration: dauer(s), ease: "power3.out", overwrite: "auto" });
    gsap.to(schatten, { x: 10, y: 9, scale: 1.12, opacity: 0.2, duration: dauer(s), ease: "power3.out", overwrite: "auto" });
  };

  // Auf dem Kissen oder dem Papier: Schatten eng und dunkel
  const aufsetzen = (s = 0.3) => {
    wacklerBeenden();
    gsap.to(koerper, { y: 0, scaleX: 1, scaleY: 1, rotation: 0, duration: dauer(s), ease: "power2.inOut", overwrite: "auto" });
    gsap.to(schatten, { x: 0, y: 0, scale: 0.92, opacity: 0.5, duration: dauer(s), ease: "power2.inOut", overwrite: "auto" });
  };

  const kissenStelle = (): Punkt => {
    const f = figur.getBoundingClientRect();
    const k = kissen.getBoundingClientRect();
    return { x: k.left + k.width / 2 - f.left, y: k.top + k.height * 0.45 - f.top };
  };

  const parken = (sofort = false) => {
    folgt = false;
    schwebt = false;
    figur.classList.remove("ist-folgt");
    const p = kissenStelle();
    Object.assign(ziel, { x: p.x, y: p.y, r: zustand === "fertig" ? FEIERABEND_DREHUNG : PARK_DREHUNG, s: PARK_SKALA });
    aufsetzen(sofort ? 0 : 0.3);
    if (sofort) springen();
    else anstossen();
  };

  const zeigerFolgen = () => {
    if (!folgt || !zeiger) return;
    ziel.x = zeiger.x - figurEcke.x;
    ziel.y = zeiger.y - figurEcke.y;
    anstossen();
  };

  let geplant = false;
  const planen = (pruefen = false) => {
    if (geplant) return;
    geplant = true;
    requestAnimationFrame(() => {
      geplant = false;
      // Nach dem Scrollen liegt der Zeiger womöglich nicht mehr über dem Bogen
      if (pruefen && zeiger) {
        figurMessen();
        const r = knopf.getBoundingClientRect();
        if (zeiger.x < r.left || zeiger.x > r.right || zeiger.y < r.top || zeiger.y > r.bottom) {
          zeigerDrin = false;
          if (!drueckt) parken();
          return;
        }
      }
      zeigerFolgen();
    });
  };

  const aufnehmen = () => {
    if (zustand === "fertig" || drueckt) return;
    folgt = true;
    schwebt = false;
    figurMessen();
    ziel.r = 0;
    ziel.s = 1;
    zeigerFolgen();
    heben();
  };

  // Tastatur: Der Stempel schwebt über der Stelle, an der er aufsetzen wird
  const schweben = () => {
    if (zustand === "fertig" || drueckt || folgt) return;
    schwebt = true;
    const l = lageMessen();
    Object.assign(ziel, inFigur(l, grundStelle(l)), { r: 0, s: 1 });
    heben(0.24);
    anstossen();
  };

  /* Abdruck ----------------------------------------------------------------- */

  const abdruckSetzen = (akte: HTMLElement, stelle: Punkt, l: Lage, text: string, neigung: number, unterzeile?: string) => {
    const abdruck = vorlage.cloneNode(true) as SVGSVGElement;
    abdruck.classList.remove("stempel--vorlage");
    abdruck.classList.add("stempel--abdruck");
    const haupt = abdruck.querySelector<SVGTextElement>("[data-stempel-text]");
    if (haupt) {
      haupt.textContent = text;
      // Lange Wörter wie FREIGEGEBEN passen gestaucht in den Rahmen
      if (text.length > STEMPEL_ZEICHEN_MAX) {
        haupt.setAttribute("font-size", String(Math.round((44 * STEMPEL_ZEICHEN_MAX) / text.length + 4)));
        haupt.setAttribute("textLength", "216");
        haupt.setAttribute("lengthAdjust", "spacingAndGlyphs");
      }
    }
    const zeile = abdruck.querySelector<SVGTextElement>("[data-stempel-datum]");
    if (zeile && unterzeile) zeile.textContent = unterzeile;
    abdruck.querySelector("g")?.setAttribute("filter", `url(#${TINTEN[tinte++ % TINTEN.length]})`);
    abdruck.style.left = `${((stelle.x / l.w) * 100).toFixed(3)}%`;
    abdruck.style.top = `${((stelle.y / l.h) * 100).toFixed(3)}%`;
    akte.append(abdruck);
    // Kein Abdruck wie der andere: Drehung, Größe und Tintendichte streuen, die Hand neigt mit
    const skala = zufall(0.97, 1.03);
    gsap.set(abdruck, { xPercent: -50, yPercent: -50, rotation: -8 + zufall(-5, 5) + neigung * 0.6, scale: skala });
    return { abdruck, skala };
  };

  const abdrueckeEntfernen = (wo: ParentNode) => wo.querySelectorAll(".stempel--abdruck").forEach((a) => a.remove());

  /* Aufdrücken: ausholen, senken, Kontakt, wiegen, heben ------------------------ */

  type Druck = { akte: HTMLElement; punkt: Punkt | null; text: string; unterzeile?: string; touch?: boolean };

  // Gibt zurück, nach wie vielen Sekunden der Stempel das Papier berührt
  const aufdruecken = (d: Druck, danach: () => void): number => {
    drueckt = true;
    const l = lageMessen();
    const stelle = aufsBlatt(l, d.punkt ? aufBogen(l, d.punkt) : grundStelle(l));
    const ort = inFigur(l, stelle);
    const anflug = !folgt && !schwebt;
    const warVorher = folgt;
    // Die Neigung beim Klick, bevor die Hand sich zum Aufdrücken gerade richtet
    const neigung = g.neigung;
    folgt = false;
    schwebt = false;
    Object.assign(ziel, ort, { r: 0, s: 1 });
    anstossen();

    const kontakt = () => {
      // Vor dem ruhig-Abbruch: Der Stempel klingt auch ohne Bewegung
      spiele("stempel");
      // Genau unter dem Gummi, auch wenn die Hand am Rand nach innen korrigiert hat
      springen();
      const { abdruck, skala } = abdruckSetzen(d.akte, stelle, l, d.text, neigung, d.unterzeile);
      if (ruhig) {
        gsap.fromTo(abdruck, { opacity: 0 }, { opacity: zufall(0.84, 0.95), duration: 0.15 });
        return;
      }
      gsap.fromTo(abdruck, { opacity: 0 }, { opacity: zufall(0.82, 0.95), duration: 0.04, ease: "none" });
      gsap.fromTo(abdruck, { scale: skala * 1.05 }, { scale: skala, duration: 0.14, ease: "power4.out" });
      // Das Papier gibt unter dem Druck kurz nach
      gsap.fromTo(
        bogen,
        { scale: 1, y: 0 },
        {
          scale: 0.996,
          y: 2.5,
          duration: 0.06,
          ease: "power1.out",
          yoyo: true,
          repeat: 1,
          transformOrigin: `${stelle.x.toFixed(1)}px ${stelle.y.toFixed(1)}px`,
        },
      );
      if (d.touch) vibrieren();
    };

    const fertig = () => {
      drueckt = false;
      danach();
      // Mit der Maus folgt der Stempel wieder, sonst geht er zurück aufs Kissen
      if (warVorher && zeigerDrin && zustand !== "fertig") {
        aufnehmen();
      } else if (document.activeElement === knopf && knopf.matches(":focus-visible") && zustand !== "fertig") {
        schweben();
      } else {
        parken();
      }
    };

    if (ruhig) {
      // Ohne Flug und ohne Wiegen: der Abdruck erscheint, der Stempel bleibt, wo er ist
      if (!anflug) springen();
      kontakt();
      merken(gsap.delayedCall(0.2, fertig));
      return 0;
    }

    const vorlauf = anflug ? 0.26 : 0.06;
    if (anflug) heben(0.2);
    gsap.set(schatten, { opacity: 0.2 });
    const ablauf = gsap.timeline();
    ablauf
      .to(koerper, { y: HUB - 6, scaleX: 1.04, scaleY: 1.04, duration: 0.07, ease: "power2.out" }, Math.max(0, vorlauf - 0.07))
      .to(koerper, { y: 0, scaleX: 1.02, scaleY: 0.94, duration: 0.09, ease: "power4.in" }, vorlauf)
      .to(schatten, { x: 0, y: 0, scale: 0.9, opacity: 0.5, duration: 0.09, ease: "power4.in" }, vorlauf)
      .call(kontakt, [], vorlauf + 0.09)
      // Halten und leicht abrollen, wie eine Hand, die fest aufdrückt
      .to(koerper, { rotation: 1.5, scaleX: 1, scaleY: 0.97, duration: 0.05, ease: "sine.out" }, vorlauf + 0.09)
      .to(koerper, { rotation: -1, duration: 0.05, ease: "sine.inOut" })
      .to(koerper, { rotation: 0, duration: 0.04, ease: "sine.in" })
      .to(koerper, { y: HUB, scaleX: 1, scaleY: 1, duration: 0.22, ease: "power3.out" })
      .to(schatten, { x: 10, y: 9, scale: 1.12, opacity: 0.2, duration: 0.22, ease: "power3.out" }, "<")
      .call(fertig, [], "-=0.12");
    merken(ablauf);
    return vorlauf + 0.09;
  };

  /* Ablage ------------------------------------------------------------------ */

  const blattAblegen = () => {
    const blatt = document.createElement("span");
    blatt.className = "ablage__blatt";
    blatt.style.setProperty("--i", String(blaetter.children.length));
    blatt.style.setProperty("--dreh", `${zufall(-3, 3).toFixed(1)}deg`);
    blaetter.append(blatt);
    if (!ruhig) {
      blatt.animate([{ opacity: 0, translate: "0 -10px" }, { opacity: 1, translate: "0 0" }], {
        duration: 180,
        easing: "ease-out",
      });
    }
  };

  const abgelegt = (akte: HTMLElement, zahl: number) =>
    `Gestempelt: ${wort(akte.dataset.stempel ?? "")}. ${daten(akte, "name")} abgelegt, ${zahl} von ${anzahl}.`;

  const landen = (akte: HTMLElement, naechste: HTMLElement) => {
    erledigt += 1;
    if (zaehler) zaehler.textContent = String(erledigt);
    blattAblegen();
    if (!ruhig) {
      ploppen(zaehler, 1.4);
      gsap.fromTo(ablage, { y: 0 }, { y: 3, duration: 0.07, ease: "power1.out", yoyo: true, repeat: 1 });
    }
    // Die letzte Ablage sagt der Feierabend-Stempel in einem Zug mit an
    if (naechste === abschluss) return;
    ansagen(`${abgelegt(akte, erledigt)} Als Nächstes: ${daten(naechste, "name")}.`);
  };

  /* Wegsortieren: der Geist fliegt, der echte Stapel ist schon die nächste Akte ---- */

  const wegsortieren = (akte: HTMLElement) => {
    const naechste = akten[index + 1] ?? abschluss;
    // Die Akte löst sich vom Satz, leiser als der Stempel davor
    spiele("papier", { db: 6 });

    if (ruhig) {
      // Ruhig: alte Akte blendet aus, die nächste ein, ohne Flug und ohne Druck
      const wechsel = gsap.timeline();
      wechsel
        .to(akte, { opacity: 0, duration: 0.25, delay: 0.45 })
        .call(() => {
          abdrueckeEntfernen(akte);
          gsap.set(akte, { clearProps: "opacity" });
          weiterschalten(naechste, 0);
          landen(akte, naechste);
        })
        .fromTo(naechste, { opacity: 0 }, { opacity: 1, duration: 0.25, clearProps: "opacity" });
      merken(wechsel);
      return;
    }

    // Einmal messen, danach wird nur noch geschrieben
    const l = lageMessen();
    const b = bogen.getBoundingClientRect();
    const z = blaetter.getBoundingClientRect();
    const dxSchirm = z.left + z.width / 2 - (b.left + b.width / 2);
    const dySchirm = z.top + z.height * 0.35 - (b.top + b.height / 2);
    // Der Geist liegt im gedrehten Stapel: Weg in dessen Achsen umrechnen
    const dx = l.cos * dxSchirm + l.sin * dySchirm;
    const dy = -l.sin * dxSchirm + l.cos * dySchirm;
    const s = Math.max(0.08, (z.width * 0.9) / l.w);

    const geist = document.createElement("div");
    geist.className = "beleg__geist";
    geist.setAttribute("aria-hidden", "true");
    kopien.forEach((kopie) => geist.append(kopie.cloneNode(true)));
    const bogenKlon = bogen.cloneNode(true) as HTMLElement;
    bogenKlon.style.removeProperty("transform");
    bogenKlon.style.removeProperty("transform-origin");
    // Nur die geworfene Akte fliegt mit; die Höhe hielten bisher die verborgenen
    bogenKlon.querySelectorAll(".beleg__akte:not([data-aktiv])").forEach((a) => a.remove());
    bogenKlon.style.height = `${l.h}px`;
    geist.append(bogenKlon);
    stapel.append(geist);

    // Echter Stapel: sofort die nächste Akte, noch ungedruckt, Kopien liegen darunter
    abdrueckeEntfernen(akte);
    weiterschalten(naechste, 0.22);

    const flug = gsap.timeline({ onComplete: () => geist.remove() });
    flug
      .set(geist, { transformOrigin: `${(l.w / 2).toFixed(1)}px ${(l.h / 2).toFixed(1)}px` })
      // Anheben: das Blatt löst sich vom Satz
      .to(geist, { y: -14, rotation: 1.5, scale: 1.02, duration: 0.14, ease: "power2.out" })
      // Schwung in die Ablage: erst seitwärts, dann hinein fallend
      .to(geist, { x: dx, duration: 0.44, ease: "power2.out" }, 0.14)
      .to(geist, { y: dy, duration: 0.44, ease: "power2.in" }, 0.14)
      .to(geist, { rotation: zufall(10, 16), duration: 0.44, ease: "power1.inOut" }, 0.14)
      .to(geist, { scale: s, duration: 0.44, ease: "power2.in" }, 0.14)
      // Landen: flach plumpsen und im Korb verschwinden
      .to(geist, { rotation: zufall(-3, 3), scaleY: s * 0.9, duration: 0.06, ease: "power1.out" }, 0.58)
      .to(geist, { opacity: 0, duration: 0.08, ease: "none" }, 0.58)
      .call(() => landen(akte, naechste), [], 0.6);
    merken(flug);
  };

  /* Nächste Akte, Feierabend, neu auflegen ------------------------------------- */

  const weiterschalten = (naechste: HTMLElement, verzoegerung: number) => {
    gsap.set(bogen, { clearProps: "transform" });
    if (naechste === abschluss) {
      tagesende();
      return;
    }
    index += 1;
    aktivieren(naechste);
    knopf.removeAttribute("aria-disabled");
    druckStarten(naechste, false, verzoegerung);
  };

  const tagesende = () => {
    index = akten.length;
    folgt = false;
    figur.classList.remove("ist-folgt");
    aktivieren(abschluss);
    zustand = "fertig";
    // Mit der Tastatur den Fokus nicht verlieren, wenn der Stempelknopf verschwindet; nach Klick
    // oder Tippen bleibt die Seite, wo sie ist
    if (document.activeElement === knopf && knopf.matches(":focus-visible")) nochmal?.focus({ preventScroll: true });
    knopf.hidden = true;
    knopf.removeAttribute("aria-disabled");
    zeigerDrin = false;
    unterschriftSetzen("Alles abgelegt. Feierabend.");
    druckStarten(abschluss, false, 0.25, feierabendStempeln);
  };

  const feierabendStempeln = () => {
    const jetzt = new Date();
    const uhrzeit = `${String(jetzt.getHours()).padStart(2, "0")}:${String(jetzt.getMinutes()).padStart(2, "0")} UHR`;
    if (griffText) griffText.textContent = FEIERABEND;
    aufdruecken({ akte: abschluss, punkt: null, text: FEIERABEND, unterzeile: uhrzeit }, () => {
      if (kontakt) kontakt.hidden = false;
      ansagen(
        `${abgelegt(akten[anzahl - 1], anzahl)} Alle ${ZAHLWORTE[anzahl] ?? anzahl} Beispielakten abgelegt. Feierabend.`,
      );
      document.dispatchEvent(new CustomEvent("beleg:feierabend"));
      nutzung("Hero", "alle Akten abgelegt");
    });
  };

  const neuAuflegen = () => {
    laufend.forEach((a) => a.kill());
    laufend.clear();
    druck?.kill();
    druck = null;
    drueckt = false;
    stapel.querySelectorAll(".beleg__geist").forEach((geist) => geist.remove());
    abdrueckeEntfernen(bogen);
    gsap.set([...akten, abschluss], { clearProps: "opacity" });
    gsap.set(bogen, { clearProps: "transform" });

    const alte = Array.from(blaetter.children);
    if (ruhig) alte.forEach((blatt) => blatt.remove());
    else gsap.to(alte, { opacity: 0, duration: 0.2, stagger: 0.04, onComplete: () => alte.forEach((blatt) => blatt.remove()) });
    erledigt = 0;
    if (zaehler) zaehler.textContent = "0";
    if (kontakt) kontakt.hidden = true;

    index = 0;
    const erste = akten[0];
    aktivieren(erste);
    knopf.hidden = false;
    knopf.removeAttribute("aria-disabled");
    druckStarten(erste);
    parken();
    if (nochmal && document.activeElement === nochmal && nochmal.matches(":focus-visible")) knopf.focus({ preventScroll: true });
    ansagen(`Stapel neu aufgelegt. Oben liegt ${daten(erste, "name")}.`);
  };

  /* Stempeln ----------------------------------------------------------------- */

  const stempeln = (punkt: Punkt | null, touch: boolean) => {
    // Ein Klick während des Druckens zieht ihn vor, dann wird sofort gestempelt
    if (zustand === "druckt") druck?.progress(1);
    if (zustand === "druckt") zustand = "bereit";
    const akte = aktive();
    if (zustand !== "bereit" || !akte) return;
    zustand = "stempelt";
    knopf.setAttribute("aria-disabled", "true");
    nutzung("Hero", "Akte gestempelt", { detail: punkt === null ? "Tastatur" : touch ? "Touch" : "Maus" });
    if (!gestempelt) {
      gestempelt = true;
      if (hinweis) hinweis.hidden = true;
      if (nochmal) nochmal.hidden = false;
    }
    const kontakt = aufdruecken({ akte, punkt, text: akte.dataset.stempel ?? "", touch }, () => {});
    // Kurz wirken lassen, dann wegsortieren
    merken(gsap.delayedCall(kontakt + (ruhig ? 0.2 : 0.42), () => wegsortieren(akte)));
  };

  /* Bedienung ---------------------------------------------------------------- */

  const maus = (e: PointerEvent) => (e.pointerType === "mouse" || e.pointerType === "pen") && feinerZeiger.matches;

  let inDerHand = false;
  knopf.addEventListener("pointerenter", (e) => {
    if (!maus(e)) return;
    // Einmal je Aufruf: Der Stempel springt bei jedem Überqueren in die Hand
    if (!inDerHand) {
      inDerHand = true;
      nutzung("Hero", "Stempel in die Hand genommen");
    }
    zeigerDrin = true;
    zeiger = { x: e.clientX, y: e.clientY };
    aufnehmen();
  });

  knopf.addEventListener("pointermove", (e) => {
    if (!maus(e)) return;
    zeigerDrin = true;
    zeiger = { x: e.clientX, y: e.clientY };
    if (folgt) planen();
    else if (!drueckt) aufnehmen();
  });

  knopf.addEventListener("pointerleave", (e) => {
    if (!maus(e)) return;
    zeigerDrin = false;
    if (!drueckt && zustand !== "fertig") parken();
  });

  knopf.addEventListener("pointerdown", (e) => {
    letzterZeiger = e.pointerType;
    // Ausholen; gestempelt wird erst beim Klick, so löst ein abgebrochener Zug nichts aus
    if (maus(e) && folgt && e.button === 0 && !ruhig) {
      gsap.to(koerper, { y: HUB - 6, scaleX: 1.04, scaleY: 1.04, duration: 0.07, ease: "power2.out", overwrite: "auto" });
    }
  });

  knopf.addEventListener("pointercancel", () => {
    if (folgt && !drueckt) heben(0.12);
  });

  knopf.addEventListener("click", (e) => {
    if (knopf.getAttribute("aria-disabled") === "true" && zustand !== "druckt") return;
    // Enter und Leertaste lösen einen Klick ohne Zeigerpunkt aus (detail 0)
    const tastatur = e.detail === 0;
    stempeln(tastatur ? null : { x: e.clientX, y: e.clientY }, !tastatur && letzterZeiger === "touch");
  });

  knopf.addEventListener("focus", () => {
    if (knopf.matches(":focus-visible")) schweben();
  });

  knopf.addEventListener("blur", () => {
    if (schwebt && !drueckt) parken();
  });

  nochmal?.addEventListener("click", () => {
    spiele("papier");
    nutzung("Hero", "Stapel neu aufgelegt");
    neuAuflegen();
  });

  // Scrollt die Seite unter der stillstehenden Maus, wandert der Stempel mit
  window.addEventListener(
    "scroll",
    () => {
      if (folgt) planen(true);
    },
    { passive: true },
  );

  // Neue Größe des Stapels (Breite, oder Höhe etwa nach dem Laden der Schrift): Der Tisch rückt
  // mit, der Stempel steht wieder auf dem Kissen bzw. über seiner Stelle.
  // Der erste Aufruf kommt sofort beim Beobachten und misst nur
  let groesse = "";
  new ResizeObserver((eintraege) => {
    const { width, height } = eintraege[0].contentRect;
    const neu = `${Math.round(width)}x${Math.round(height)}`;
    const erstes = groesse === "";
    if (neu === groesse) return;
    groesse = neu;
    figurMessen();
    if (erstes) return;
    if (drueckt || folgt) return;
    if (schwebt) {
      schwebt = false;
      schweben();
    } else {
      parken(true);
    }
  }).observe(stapel);

  // Steht der Stapel zwei Sekunden unberührt im Bild, wackelt der Stempel einmal
  const stupsen = () => {
    if (!("IntersectionObserver" in window)) return;
    let zeitgeber = 0;
    const beobachter = new IntersectionObserver(
      (eintraege) => {
        window.clearTimeout(zeitgeber);
        if (!eintraege[0].isIntersecting) return;
        zeitgeber = window.setTimeout(() => {
          beobachter.disconnect();
          if (gestempelt || folgt || schwebt || drueckt) return;
          wackler = gsap
            .timeline({ onComplete: () => (wackler = null) })
            .to(koerper, { y: -8, duration: 0.14, ease: "power2.out" })
            .to(koerper, { rotation: 4, duration: 0.075, ease: "sine.inOut", yoyo: true, repeat: 5 }, 0.05)
            .to(koerper, { y: 0, rotation: 0, duration: 0.2, ease: "bounce.out" });
        }, 2000);
      },
      { threshold: 0.6 },
    );
    beobachter.observe(stapel);
  };

  /* Los geht's --------------------------------------------------------------- */

  aktivieren(akten[0]);
  parken(true);
  // Am Ende des Ausfüllens landet der Stempel auf dem Kissen; wer ihn vorher nimmt, hat ihn schon
  if (!ruhig) {
    gsap.set(koerper, { y: -22, opacity: 0 });
    gsap.set(schatten, { opacity: 0 });
  }
  druckStarten(akten[0], true, 0, () => {
    if (ruhig) return;
    if (!folgt && !schwebt && !drueckt && zustand !== "fertig") {
      gsap.to(koerper, { y: 0, opacity: 1, duration: 0.24, ease: "back.out(1.6)" });
      gsap.to(schatten, { opacity: 0.5, duration: 0.24 });
    }
    stupsen();
  });
}
