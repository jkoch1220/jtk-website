import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { aufrufId, checkErgebnis, seitenStart, type CheckErgebnis } from "./tracking";
import { turnstileToken, turnstileVorbereiten, turnstileZuruecksetzen } from "./turnstile";
import { zeitfresserEinrichten } from "./zeitfresser";

declare global {
  interface Window {
    __belegGestartet?: boolean;
  }
}

gsap.registerPlugin(ScrollTrigger);

const bewegungReduziert = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Weiches Scrollen. Lenis beachtet reduzierte Bewegung selbst und
   respektiert scroll-margin-top bei Ankerlinks. */
const lenis = new Lenis({ autoRaf: true, anchors: true });

/* Hilfsfunktionen ------------------------------------------------------------ */

async function kopieren(text: string, ausweich?: HTMLTextAreaElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (ausweich) {
      ausweich.value = text;
      ausweich.hidden = false;
      ausweich.focus();
      ausweich.select();
    }
    return false;
  }
}

function rueckmeldung(knopf: HTMLButtonElement, text: string): void {
  const vorher = knopf.dataset.text ?? knopf.textContent ?? "";
  knopf.dataset.text = vorher;
  knopf.textContent = text;
  window.setTimeout(() => {
    knopf.textContent = vorher;
  }, 2200);
}

/* Datum im Beleg auf heute setzen ------------------------------------------ */

function datumSetzen(): void {
  const heute = new Date();
  const datum = heute.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  const monate = ["JAN.", "FEB.", "MÄRZ", "APR.", "MAI", "JUNI", "JULI", "AUG.", "SEP.", "OKT.", "NOV.", "DEZ."];
  const stempel = `${heute.getDate()}. ${monate[heute.getMonth()]} ${heute.getFullYear()}`;

  document.querySelectorAll<HTMLElement>("[data-datum]").forEach((el) => (el.textContent = datum));
  document.querySelectorAll<HTMLElement>("[data-rechnungsnr]").forEach((el) => {
    el.textContent = `${heute.getFullYear()}-0418`;
  });
  document.querySelectorAll<SVGTextElement>("[data-stempel-datum]").forEach((el) => (el.textContent = stempel));
}

/* Hero: Rechnung füllt sich selbst aus ------------------------------------ */

function belegAnimieren(): void {
  const beleg = document.querySelector<HTMLElement>("[data-beleg]");
  const nochmal = document.querySelector<HTMLButtonElement>("[data-beleg-nochmal]");
  if (!beleg) return;

  window.__belegGestartet = true;

  if (bewegungReduziert) {
    document.documentElement.classList.remove("bewegung");
    return;
  }

  const werte = beleg.querySelectorAll<HTMLElement>("[data-wert]");
  const kopien = beleg.querySelectorAll<HTMLElement>(".beleg__kopie");
  const bogen = beleg.querySelector<HTMLElement>(".beleg__bogen");
  const stempel = beleg.querySelector<SVGSVGElement>(".stempel");

  // Endlage der Kopien aus dem CSS lesen. Die Klasse "bewegung" hält bis hierhin
  // den Startzustand; sie wird entfernt und im selben Takt durch Inline-Stile
  // ersetzt, damit nichts aufblitzt.
  document.documentElement.classList.remove("bewegung");
  const kopieZiele = Array.from(kopien).map((kopie) => {
    const m = new DOMMatrix(getComputedStyle(kopie).transform);
    return { x: m.e, y: m.f, rotation: (Math.atan2(m.b, m.a) * 180) / Math.PI };
  });

  gsap.set(werte, { clipPath: "inset(0 100% 0 0)" });
  gsap.set(kopien, { x: 0, y: 0, rotation: 0 });
  gsap.set(stempel, { autoAlpha: 0, scale: 1.45 });

  const zeitleiste = gsap.timeline({ paused: true });

  zeitleiste
    .to(werte, {
      clipPath: "inset(0 0% 0 0)",
      duration: 0.15,
      ease: "none",
      stagger: 0.07,
      delay: 0.35,
    })
    .to(
      kopien,
      {
        x: (i: number) => kopieZiele[i].x,
        y: (i: number) => kopieZiele[i].y,
        rotation: (i: number) => kopieZiele[i].rotation,
        duration: 0.5,
        ease: "power3.out",
        stagger: { each: 0.07, from: "end" },
      },
      "+=0.12",
    )
    .to(stempel, { autoAlpha: 1, scale: 1, duration: 0.13, ease: "power4.in" }, "-=0.12")
    .to(bogen, { y: 3, duration: 0.05, ease: "power1.out", yoyo: true, repeat: 1 });

  zeitleiste.play(0);

  if (nochmal) {
    nochmal.hidden = false;
    nochmal.addEventListener("click", () => zeitleiste.restart(false, false));
  }
}

/* Problem: Meldungen wegklicken -------------------------------------------- */

function meldungenEinrichten(): void {
  const bereich = document.querySelector<HTMLElement>("[data-meldungen]");
  if (!bereich) return;

  const meldungen = Array.from(bereich.querySelectorAll<HTMLElement>("[data-meldung]"));
  const leer = bereich.querySelector<HTMLElement>("[data-meldungen-leer]");
  const zurueck = bereich.querySelector<HTMLButtonElement>("[data-meldungen-zurueck]");

  const fokusWeitergeben = () => {
    const naechste = meldungen.find((m) => !m.hidden);
    if (naechste) {
      naechste.querySelector<HTMLButtonElement>(".meldung__knoepfe button")?.focus();
    } else if (leer) {
      leer.hidden = false;
      leer.querySelector<HTMLElement>("a, button")?.focus();
    }
  };

  const schliessen = (meldung: HTMLElement) => {
    const fertig = () => {
      meldung.hidden = true;
      gsap.set(meldung, { clearProps: "opacity,visibility,transform" });
      fokusWeitergeben();
    };
    if (bewegungReduziert) {
      fertig();
    } else {
      gsap.to(meldung, { scale: 0.92, autoAlpha: 0, duration: 0.16, ease: "power2.in", onComplete: fertig });
    }
  };

  meldungen.forEach((meldung) => {
    meldung.querySelectorAll<HTMLButtonElement>("[data-meldung-zu]").forEach((knopf) => {
      knopf.addEventListener("click", () => schliessen(meldung));
    });
  });

  zurueck?.addEventListener("click", () => {
    if (leer) leer.hidden = true;
    meldungen.forEach((m) => (m.hidden = false));
    meldungen[0]?.querySelector<HTMLButtonElement>(".meldung__knoepfe button")?.focus();
  });
}

/* Anfrageformular ---------------------------------------------------------- */

function anfrageEinrichten(): void {
  // Etwas mehr als die Mindestdauer im Server (3000 ms, Website-Dienst /api/anfrage)
  const MINDESTDAUER_MS = 3200;
  // Wie der Server: keine Zeichen, die in mailto-Links oder Kopfzeilen etwas bedeuten
  const emailMuster = /^[\p{L}\p{N}._+'-]+@(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?\.)+[\p{L}\p{N}-]{2,}$/u;

  const formular = document.querySelector<HTMLFormElement>("[data-anfrage]");
  if (!formular) return;

  const email = formular.dataset.email ?? "";
  const betreff = formular.dataset.betreff ?? "";
  const ziel = formular.dataset.ziel ?? "";
  const status = document.querySelector<HTMLElement>("[data-anfrage-status]");
  const danke = document.querySelector<HTMLElement>("[data-anfrage-danke]");
  const kopierKnopf = formular.querySelector<HTMLButtonElement>("[data-anfrage-kopieren]");
  const textfeld = formular.querySelector<HTMLTextAreaElement>("[data-anfrage-text]");

  const feld = (name: string) => formular.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement;
  const name = feld("name");
  const firma = feld("firma");
  const mail = feld("email");
  const telefon = feld("telefon");
  const nachricht = feld("nachricht");
  const honig = feld("website");
  turnstileVorbereiten(formular);

  const statusSetzen = (text: string) => {
    if (status) status.textContent = text;
  };

  const text = () => {
    const zeilen = [
      "Guten Tag Herr Koch,",
      "",
      nachricht.value.trim() || "ich interessiere mich für ein Erstgespräch.",
      "",
      "Viele Grüße",
      name.value.trim(),
    ];
    if (firma.value.trim()) zeilen.push(firma.value.trim());
    if (telefon.value.trim()) zeilen.push(`Telefon: ${telefon.value.trim()}`);
    if (mail.value.trim()) zeilen.push(mail.value.trim());
    return zeilen.join("\n");
  };

  const pruefen = (): HTMLElement | null => {
    [name, mail].forEach((f) => f.removeAttribute("aria-invalid"));
    if (!name.value.trim()) {
      name.setAttribute("aria-invalid", "true");
      statusSetzen("Bitte tragen Sie Ihren Namen ein.");
      return name;
    }
    if (!emailMuster.test(mail.value.trim())) {
      mail.setAttribute("aria-invalid", "true");
      statusSetzen("Bitte prüfen Sie Ihre E-Mail-Adresse.");
      return mail;
    }
    return null;
  };

  const erfolg = () => {
    formular.hidden = true;
    if (danke) {
      danke.hidden = false;
      danke.focus();
    }
    statusSetzen("Gesendet");
  };

  // Strukturiertes Ergebnis des Checks; zusätzlich zum Text in der Nachricht, für die Auswertung
  let checkUebernommen: CheckErgebnis | null = null;
  let sendetGerade = false;

  const senden = async () => {
    const umDirekt = `Bitte schreiben Sie direkt an ${email}.`;
    statusSetzen("Wird gesendet …");
    sendetGerade = true;
    try {
      // Der Server verwirft Anfragen, die schneller als 3 s nach dem Laden kommen (Spam-Schutz).
      // Mit wiederhergestellten oder automatisch ausgefüllten Feldern schaffen das auch Menschen,
      // deshalb hier kurz warten statt still zu verlieren.
      const wartezeit = MINDESTDAUER_MS - (Date.now() - seitenStart);
      if (wartezeit > 0) await new Promise((fertig) => window.setTimeout(fertig, wartezeit));

      const turnstile = await turnstileToken(formular);
      const antwort = await fetch(ziel, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.value.trim(),
          firma: firma.value.trim(),
          email: mail.value.trim(),
          telefon: telefon.value.trim(),
          nachricht: nachricht.value.trim(),
          // Ohne Query und Hash: Kampagnenparameter machen die Adresse sonst beliebig lang
          seite: window.location.origin + window.location.pathname,
          website: honig.value,
          check: checkErgebnis() ?? checkUebernommen,
          aufruf: aufrufId(),
          dauer: Date.now() - seitenStart,
          turnstile,
        }),
      });
      // Ein Token gilt nur einmal, auch wenn das Senden scheitert
      turnstileZuruecksetzen(formular);
      if (antwort.ok) {
        erfolg();
        return;
      }
      const daten = (await antwort.json().catch(() => null)) as { fehler?: string } | null;
      const meldung = typeof daten?.fehler === "string" ? daten.fehler.trim() : "";
      if (antwort.status === 429) {
        statusSetzen(`${meldung || "Gerade kommen zu viele Anfragen an."} ${umDirekt}`);
      } else if (antwort.status === 400 && meldung) {
        statusSetzen(`${meldung} Sonst erreichen Sie mich direkt unter ${email}.`);
      } else {
        statusSetzen(`Senden hat nicht geklappt. ${umDirekt}`);
      }
    } catch {
      statusSetzen(`Senden hat nicht geklappt, vielleicht ist die Verbindung weg. ${umDirekt}`);
    } finally {
      sendetGerade = false;
    }
  };

  formular.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sendetGerade) return;
    const fehler = pruefen();
    if (fehler) {
      fehler.focus();
      return;
    }

    // Spam-Schutz: Dieses Feld füllen nur Programme aus
    if (honig.value) {
      erfolg();
      return;
    }

    if (ziel) {
      await senden();
      return;
    }

    window.location.href = `mailto:${email}?subject=${encodeURIComponent(betreff)}&body=${encodeURIComponent(text())}`;
    statusSetzen("Ihr E-Mail-Programm sollte sich jetzt öffnen. Falls nicht: Text kopieren.");
  });

  formular.addEventListener("input", (event) => {
    const element = event.target as HTMLElement;
    if (element.getAttribute("aria-invalid") === "true") element.removeAttribute("aria-invalid");
  });

  kopierKnopf?.addEventListener("click", async () => {
    const ok = await kopieren(text(), textfeld);
    rueckmeldung(kopierKnopf, ok ? "Kopiert" : "Text unten markiert");
    statusSetzen(ok ? `Text kopiert. Bitte an ${email} schicken.` : "Text markiert. Bitte kopieren und per E-Mail schicken.");
  });

  // Ergebnis aus dem Zeitfresser-Check übernehmen
  window.addEventListener("anfrage:vorbelegen", (event) => {
    const block = (event as CustomEvent<string>).detail;
    checkUebernommen = checkErgebnis() ?? checkUebernommen;
    const bisher = nachricht.value.replace(/Ergebnis aus dem Zeitfresser-Check:[\s\S]*?Stunden im Jahr\.\n*/u, "").trim();
    nachricht.value = bisher ? `${block}\n\n${bisher}` : block;
    statusSetzen("Ergebnis aus dem Check übernommen");
    const abschnitt = document.querySelector<HTMLElement>("#kontakt");
    if (abschnitt) {
      lenis.scrollTo(abschnitt, {
        onComplete: () => name.focus({ preventScroll: true }),
      });
    }
  });
}

/* Persönliches Bild: Bergpanorama in Tinte-Tönen oder Foto im Zweifarb-Raster ---- */

const BAYER = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

// Farbnummern des Panoramas (Index in BERGFARBEN), LEER = durchsichtig
const BOGEN = 0;
const GELB = 1;
const T1 = 2;
const T4 = 5;
const T5 = 6;
const T6 = 7;
const LEER = 255;
const BERGFARBEN = [
  [255, 255, 255], // BOGEN: Papier, Schnee, freie Pixel in einer Silhouette
  [243, 230, 160], // GELB: Halo, Lichtstrahlen, Glitzern, Gegenlichtsaum
  [185, 184, 224], // T1: Wolken, Kette 0
  [157, 156, 204], // T2: Kette 1
  [124, 122, 179], // T3: Kette 2
  [93, 91, 153], // T4: Kette 3, Spiegelung
  [43, 42, 126], // T5: Kette 4, Sonne, Wanderer, Vögel
  [21, 20, 74], // T6: Kette 5, Vordergrund, See-Tiefe (= #15144a)
];
const FOTOFARBEN = [
  [255, 255, 255],
  [43, 42, 126],
];

const EBENEN = ["himmel", "fern", "mitte", "nah"] as const;
const UEBERSTAND = 24; // Kunstpixel über und unter den Ebenen, mindestens die größte Tiefe
const TIEFE = [16, 10, 5, 0]; // Parallax-Weg je Ebene in Kunstpixeln
const NAHT = 3; // unterste Zeilen, immer exakt T6 = #15144a

function zufall(startwert: number): () => number {
  let s = startwert;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Bergkamm per Mittelpunktverschiebung, Werte 0 (Tal) bis 1 (Gipfel)
function grat(rnd: () => number, rauheit: number, breite: number): Float32Array {
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

// Tonwerte per Bayer-Matrix auf Tinte (1) oder Papier (0) abbilden
function maske(ton: Float32Array, breite: number, hoehe: number): Uint8Array {
  const an = new Uint8Array(breite * hoehe);
  for (let y = 0; y < hoehe; y++) {
    for (let x = 0; x < breite; x++) {
      const i = y * breite + x;
      an[i] = ton[i] > (BAYER[y % 8][x % 8] + 0.5) / 64 ? 1 : 0;
    }
  }
  return an;
}

// Little-Endian-Pixelwert für die Uint32-Sicht auf ImageData
function farbwert([r, g, b]: number[], alpha = 255): number {
  return ((alpha << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

// Palette als Nachschlagetabelle: Farbnummer → Pixelwert, unbelegte Nummern durchsichtig
function palette(farben: number[][], leer: number | null): Uint32Array {
  const tabelle = new Uint32Array(256);
  farben.forEach((farbe, i) => (tabelle[i] = farbwert(farbe)));
  if (leer !== null) tabelle[LEER] = tabelle[leer];
  return tabelle;
}

const PANORAMA_DECKEND = palette(BERGFARBEN, BOGEN);
const PANORAMA_EBENE = palette(BERGFARBEN, null);
const FOTO_PALETTE = palette(FOTOFARBEN, null);

// Farbnummern direkt in einen Uint32-Puffer schreiben (LEER wird je nach Palette Papier oder durchsichtig)
function malen(ctx: CanvasRenderingContext2D, farben: Uint8Array, breite: number, hoehe: number, tabelle: Uint32Array): void {
  const bild = ctx.createImageData(breite, hoehe);
  const feld = new Uint32Array(bild.data.buffer);
  for (let i = 0; i < farben.length; i++) feld[i] = tabelle[farben[i]];
  ctx.putImageData(bild, 0, 0);
}

function rastern(ctx: CanvasRenderingContext2D, ton: Float32Array, breite: number, hoehe: number): void {
  malen(ctx, maske(ton, breite, hoehe), breite, hoehe, FOTO_PALETTE);
}

// Zeichenfläche des Fotos in ganzen Kunstpixeln anlegen, damit die Pixel gleich groß bleiben
function kunstFlaeche(canvas: HTMLCanvasElement, pixel: number, verhaeltnis: number): { B: number; H: number } {
  const verfuegbar = canvas.parentElement?.clientWidth || 360;
  const B = Math.max(40, Math.floor(verfuegbar / pixel));
  const H = Math.max(24, Math.round(B * verhaeltnis));
  canvas.width = B;
  canvas.height = H;
  canvas.style.width = `${B * pixel}px`;
  canvas.style.height = `${H * pixel}px`;
  const angabe = canvas.closest(".fenster")?.querySelector<HTMLElement>("[data-bild-groesse]");
  if (angabe) angabe.textContent = `${B} × ${H}, 2 Farben`;
  return { B, H };
}

/* Szene ------------------------------------------------------------------- */

interface Sperre {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface BergSzene {
  farbe: Uint8Array; // Gesamtbild B × H, Farbnummern
  ebene: Uint8Array; // Gesamtbild B × H, Ebene je Pixel (0 himmel … 3 nah)
  lagen: Uint8Array[]; // vier Ebenen je B × (H + 2U), LEER = durchsichtig
}

// Bergszene in Farbnummern. Die vier Ebenen reichen U Kunstpixel über und unter das Bild,
// das Gesamtbild ist ihr mittlerer Ausschnitt und deckt sich bei Versatz 0 pixelgenau.
// sperre: Bereich unter dem HUD (Szenenkoordinaten), dort stehen weder Sonne noch Figuren.
function bergeSzene(B: number, H: number, startwert: number, U: number, sperre: Sperre | null = null): BergSzene {
  const rnd = zufall(startwert);
  const G = H + 2 * U;
  const lagen = EBENEN.map(() => new Uint8Array(B * G).fill(LEER));
  lagen[0].fill(BOGEN); // der Himmel deckt vollständig

  // Jede Ebene hat ihre eigene Bayer-Phase, so entsteht beim Überlagern kein Moiré
  const schwelle = (e: number, x: number, y: number) =>
    (BAYER[(y + U + e * 3) % 8][(x + e * 5) % 8] + 0.5) / 64;
  const setze = (e: number, x: number, y: number, farbe: number) => {
    if (x >= 0 && x < B && y >= -U && y < H + U) lagen[e][(y + U) * B + x] = farbe;
  };
  const lies = (e: number, x: number, y: number) =>
    x >= 0 && x < B && y >= -U && y < H + U ? lagen[e][(y + U) * B + x] : LEER;
  // Sichtbare Farbe bei Versatz 0: vorderste deckende Ebene
  const oben = (x: number, y: number) => {
    for (let e = 3; e >= 0; e--) {
      const f = lies(e, x, y);
      if (f !== LEER) return f;
    }
    return BOGEN;
  };
  // Figur mit 1 Pixel Papierrand stempeln, damit sie sich vom Raster abhebt
  const stempel = (e: number, punkte: number[][], x: number, y: number, farbe: number) => {
    punkte.forEach(([dx, dy]) => {
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) setze(e, x + dx + a, y + dy + b, BOGEN);
    });
    punkte.forEach(([dx, dy]) => setze(e, x + dx, y + dy, farbe));
  };
  const gesperrt = (x: number, y: number, rand = 0) =>
    !!sperre && x >= sperre.x0 - rand && x <= sperre.x1 + rand && y >= sperre.y0 - rand && y <= sperre.y1 + rand;
  // Tanne mit gestuften Ästen, Fuß bei (x, fuss)
  const tanne = (e: number, x: number, fuss: number, g: number, farbe: number) => {
    if (g < 8) {
      for (let j = 0; j < g; j++) {
        const halb = Math.floor(j * 0.45);
        for (let dx = -halb; dx <= halb; dx++) setze(e, x + dx, fuss - g + j, farbe);
      }
      return;
    }
    const stamm = Math.max(1, Math.round(g / 9));
    const krone = g - stamm;
    const breite = g * 0.3;
    const stufen = Math.max(2, Math.round(krone / 5));
    const stufenHoehe = krone / stufen;
    for (let j = 0; j < krone; j++) {
      const inStufe = (j % stufenHoehe) / stufenHoehe;
      const halb = Math.round(((j + 1) / krone) * breite * (0.55 + 0.45 * inStufe));
      for (let dx = -halb; dx <= halb; dx++) setze(e, x + dx, fuss - g + j, farbe);
    }
    const dicke = g >= 16 ? 1 : 0;
    for (let j = krone; j < g + 1; j++) for (let dx = -dicke; dx <= 0; dx++) setze(e, x + dx, fuss - g + j, farbe);
  };

  const weiss = Math.ceil(H * 0.08); // die obersten Zeilen bleiben reines Papier
  const ufer = Math.round(H * 0.8); // darunter liegt der See

  /* 1. Himmel ------------------------------------------------------------ */

  // Sonne mal links, mal rechts, nie unter dem HUD
  let sonnenseite = rnd() < 0.5 ? 1 : -1;
  let sx = B * (0.5 + sonnenseite * (0.1 + rnd() * 0.18));
  const sy = H * (0.22 + rnd() * 0.06);
  const sr = Math.max(5, Math.min(H * 0.13, B * 0.06));
  const sonneGesperrt = () =>
    !!sperre && sx + sr + 2 >= sperre.x0 && sx - sr - 2 <= sperre.x1 && sy - sr - 2 <= sperre.y1 && sy + sr + 2 >= sperre.y0;
  if (sonneGesperrt()) {
    sx = B - sx;
    sonnenseite = -sonnenseite;
  }

  /* 2. Sechs Ketten, hinten hell und licht gerastert, vorne dunkel und dicht -- */

  const ketten = [
    { basis: 0.54, hoehe: 0.46, rauheit: 0.5, licht: 0.25, schatten: 0.5, nebel: 0.6, ebene: 1 },
    { basis: 0.6, hoehe: 0.36, rauheit: 0.53, licht: 0.3, schatten: 0.55, nebel: 0.8, ebene: 1 },
    { basis: 0.66, hoehe: 0.28, rauheit: 0.55, licht: 0.4, schatten: 0.65, nebel: 0.85, ebene: 2 },
    { basis: 0.71, hoehe: 0.2, rauheit: 0.57, licht: 0.55, schatten: 0.8, nebel: 0.9, ebene: 2 },
    { basis: 0.76, hoehe: 0.14, rauheit: 0.6, licht: 0.75, schatten: 1, nebel: 0, ebene: 3 },
    { basis: 0.8, hoehe: 0.08, rauheit: 0.62, licht: 1, schatten: 1, nebel: 0, ebene: 3 },
  ];
  const kaemme = ketten.map(() => new Int32Array(B));
  const sattel = 0.3 + rnd() * 0.55; // so tief taucht die Sonne ins Tal (in Sonnenradien unter der Mitte)
  const nebelTiefe = H * 0.16;
  const fenster = 3 + Math.round(B / 60);

  ketten.forEach((kette, k) => {
    const e = kette.ebene;
    const farbe = T1 + k;
    const profil = grat(rnd, kette.rauheit, B);
    // Sattel unter der Sonne: Die hinteren Ketten senken sich dort so weit, dass die
    // Sonne mit ihrer oberen Hälfte immer frei steht und in ein Tal hinein untergeht.
    if (k < 4) {
      const tal = sy + sr * sattel;
      const erlaubt = (kette.basis - tal / H) / kette.hoehe; // höchster Profilwert über der Sonne
      let spitze = 0;
      for (let x = Math.max(0, Math.floor(sx - sr)); x <= Math.min(B - 1, sx + sr); x++) spitze = Math.max(spitze, profil[x]);
      if (spitze > erlaubt) {
        const tiefe = 1 - Math.max(0, erlaubt) / spitze;
        const weite = sr * 2.4;
        for (let x = 0; x < B; x++) profil[x] *= 1 - tiefe * Math.exp(-(((x - sx) / weite) ** 2));
      }
    }
    let imSchatten: boolean;
    // Grund der Silhouette: hinten Papier, sonst der nächsthellere Ton. So rastert jede
    // Kette zwischen zwei benachbarten Tönen, das Bild wird satt statt fleckig.
    const grund = k === 0 ? BOGEN : farbe - 1;
    for (let x = 0; x < B; x++) {
      const kamm = Math.max(weiss, Math.round(H * (kette.basis - kette.hoehe * profil[x])));
      kaemme[k][x] = kamm;
      // Hänge, die von der Sonne wegzeigen, liegen im Schatten. Die Neigung wird über ein
      // breites Fenster gemessen und weich überblendet: ruhige Flanken statt harter Streifen.
      const neigung = (profil[Math.min(B - 1, x + fenster)] - profil[Math.max(0, x - fenster)]) * sonnenseite;
      const schatten = Math.min(1, Math.max(0, 0.5 + neigung * 5));
      imSchatten = schatten > 0.5;
      const schneeTief = k < 2 ? Math.max(0, H * 0.3 - kamm) * 0.7 + rnd() * 2 : 0;
      for (let y = kamm; y < H + U; y++) {
        const tiefe = y - kamm;
        // Deckkraft: oben voll, zum Fuß hin löst sich die Kette im Nebel auf
        const deckung = kette.nebel ? 1 - Math.min(1, Math.max(0, (tiefe - nebelTiefe * 0.3) / (nebelTiefe * 0.7))) : 1;
        let wert = kette.licht + (kette.schatten - kette.licht) * schatten;
        let frei = grund;
        if (tiefe < schneeTief) {
          wert = imSchatten ? 0.25 : 0;
          frei = BOGEN;
        }
        if (tiefe === 0) wert = 1;
        wert = Math.round(wert * 8) / 8; // feste Stufen ergeben ruhige Muster
        const s = schwelle(e, x, y);
        if (wert * deckung > s) setze(e, x, y, farbe);
        else if (deckung > s) setze(e, x, y, frei);
        // sonst durchsichtig: im Nebel am Fuß scheint die Ebene dahinter durch
      }
      // Gegenlichtsaum auf der Sonnenseite der hinteren Grate
      if (k < 2 && !imSchatten && kamm - 1 >= weiss && lies(e, x, kamm - 1) === LEER) setze(e, x, kamm - 1, GELB);
    }
    // Tannen auf den vorderen Ketten, mit Abstand, damit sie einzeln lesbar bleiben
    if (k >= 4) {
      const [klein, gross, farbeTanne] = k === 4 ? [4, 7, T5] : [6, 11, T6];
      for (let x = 2 + Math.floor(rnd() * 6); x < B - 2; x += 4 + Math.floor(rnd() * (k === 4 ? 9 : 12))) {
        const g = klein + Math.floor(rnd() * (gross - klein + 1));
        tanne(e, x, kaemme[k][x] + 1, g, farbeTanne);
      }
    }
  });

  /* Himmel hinter den Ketten: Strahlen, Halo, Wolken und Sonne enden knapp unter der
     Kammlinie. So scheint durch den Nebel am Fuß nur weißer Dunst, nie die Sonne. */

  const horizont = new Int32Array(B);
  for (let x = 0; x < B; x++) {
    let oberster = ufer;
    for (let k = 0; k < ketten.length; k++) oberster = Math.min(oberster, kaemme[k][x]);
    horizont[x] = oberster + 8; // Reserve für den Parallax-Versatz zwischen Himmel und Kette
  }

  // Lichtstrahlen und Halo: Gelb, gerastert, hinter allem anderen
  const strahlen = Array.from({ length: 7 }, (_, i) => ((-70 + (i * 140) / 6) * Math.PI) / 180);
  const keil = (1.25 * Math.PI) / 180;
  const strahlLaenge = Math.hypot(B, H) * 0.7;
  const haloRand = 3.2 * sr;
  for (let y = weiss; y < ufer; y++) {
    for (let x = 0; x < B; x++) {
      const dx = x - sx;
      const dy = y - sy;
      const d = Math.hypot(dx, dy);
      if (d <= sr + 1 || y >= horizont[x]) continue;
      let ton = d < haloRand ? (1 - d / haloRand) ** 1.6 : 0;
      if (dy > 0) {
        const winkel = Math.atan2(dx, dy); // 0 = senkrecht nach unten
        if (strahlen.some((s) => Math.abs(winkel - s) < keil)) ton = Math.max(ton, 0.22 * Math.max(0, 1 - d / strahlLaenge));
      }
      if (ton > schwelle(0, x, y)) setze(0, x, y, GELB);
    }
  }

  // Wolkenbänder: Linien, deren Abstand zum Horizont hin wächst, in Stücke zerlegt.
  // Das Profil läuft dreimal über die Breite, so entstehen Wolkenfetzen statt Drähte;
  // wo es besonders hoch ist, bekommt der Fetzen eine zweite Zeile obendrauf.
  for (let k = 0, y = weiss; y < ufer; k++, y += 2 + Math.round((k * H) / 75)) {
    const stuecke = grat(rnd, 0.6, B);
    const anfang = Math.floor(rnd() * B);
    const dichte = Math.min(1, Math.max(0, (y / H - 0.08) / 0.12));
    const versatz = k % 2;
    for (let x = 0; x < B; x++) {
      const wert = stuecke[(x * 3 + versatz + anfang) % B];
      if (y >= horizont[x]) continue;
      if (wert > 0.45 && dichte > schwelle(0, x, y)) setze(0, x, y, T1);
      if (wert > 0.72 && y - 1 >= weiss && dichte > schwelle(0, x, y - 1)) setze(0, x, y - 1, T1);
    }
  }

  // Sonne: volle Scheibe mit Schlitzen, die nach unten breiter werden
  for (let y = Math.floor(sy - sr - 3); y <= sy + sr + 3; y++) {
    for (let x = Math.floor(sx - sr - 3); x <= sx + sr + 3; x++) {
      const d = Math.hypot(x - sx, y - sy);
      if (d > sr + 1 || x < 0 || x >= B || y >= horizont[x]) continue;
      const reihe = Math.round(y - sy);
      const schlitz = reihe > 0 && reihe % 3 < (reihe / sr) * 2.4;
      setze(0, x, y, d <= sr && !schlitz ? T5 : BOGEN);
    }
  }

  /* 3. Wanderer auf dem höchsten freien Gipfel der hinteren Kette ---------- */

  let gipfelX = -1;
  let gipfelY = H;
  for (let x = Math.ceil(B * 0.12); x <= Math.floor(B * 0.88); x++) {
    const y = kaemme[0][x];
    if (Math.abs(x - sx) < sr + 8 || y - 10 < weiss || gesperrt(x, y - 9, 3)) continue;
    if (kaemme[1][x] - y < 10) continue; // die Kette davor darf ihn nicht verdecken
    let lokal = true;
    for (let d = -3; d <= 3; d++) if (kaemme[0][Math.min(B - 1, Math.max(0, x + d))] < y) lokal = false;
    if (lokal && y < gipfelY) {
      gipfelY = y;
      gipfelX = x;
    }
  }
  if (gipfelX >= 0) {
    stempel(
      1,
      [
        [0, -8],
        [0, -7], [-1, -6], [0, -6], [1, -6],
        [0, -5], [0, -4],
        [-1, -3], [1, -3], [-1, -2], [1, -2], [-1, -1], [1, -1],
        [2, -7], [2, -6], [2, -5], [2, -4], [2, -3], [2, -2], [2, -1],
      ],
      gipfelX,
      gipfelY,
      T5,
    );
    for (let dx = -3; dx <= 4; dx++) setze(1, gipfelX + dx, gipfelY, T1);
  }

  /* 4. Vordergrund-Rahmen: Hänge mit großen Tannen an beiden Bildrändern --- */

  const rahmenOben = H * 0.55;
  [1, -1].forEach((seite) => {
    const breite = Math.round(B * (0.14 + rnd() * 0.04));
    const profil = grat(rnd, 0.55, breite);
    const hang = new Int32Array(breite);
    for (let i = 0; i < breite; i++) {
      const t = i / (breite - 1);
      const anteil = (1 - t) ** 1.25 * (0.72 + 0.28 * profil[i]);
      hang[i] = Math.round(ufer - (ufer - rahmenOben) * anteil);
      const x = seite === 1 ? i : B - 1 - i;
      for (let y = hang[i]; y < H + U; y++) setze(3, x, y, T6);
    }
    // Große Tannen, außen am größten, nach innen kleiner
    for (let i = 1 + Math.floor(rnd() * 3); i < breite - 2; ) {
      const t = i / breite;
      const g = Math.round(14 + (1 - t) * 6 + rnd() * 2);
      const x = seite === 1 ? i : B - 1 - i;
      tanne(3, x, hang[i] + 2, g, T6);
      i += Math.max(4, Math.round(g * (0.35 + rnd() * 0.35)));
    }
  });

  /* 5. Figuren im freien Himmel (nach dem Rahmen, damit die Kammlinie bekannt ist) */

  const himmelBis = (x: number) => {
    const xi = Math.min(B - 1, Math.max(0, Math.round(x)));
    for (let y = weiss; y < ufer; y++) if (lies(1, xi, y) !== LEER || lies(2, xi, y) !== LEER || lies(3, xi, y) !== LEER) return y;
    return ufer;
  };
  const frei = (x: number, y: number, rand: number) =>
    x > 3 && x < B - 4 && y - rand >= weiss + 1 && y + rand < himmelBis(x) - 3 && !gesperrt(x, y, rand + 2) &&
    Math.hypot(x - sx, y - sy) > sr + rand + 4;

  // Sternschnuppe: Kopf mit Funkeln, Schweif wird nach hinten lückenhaft
  for (let versuch = 0; versuch < 12; versuch++) {
    const stx = Math.round(B * (0.5 - sonnenseite * (0.05 + rnd() * 0.3)));
    const sty = Math.round(H * (0.14 + rnd() * 0.1));
    // Kopf und Schweifende müssen beide im freien Himmel liegen
    if (!frei(stx, sty, 3) || !frei(stx - 15 * sonnenseite, sty - 7, 3)) continue;
    const schweif: number[][] = [];
    for (let i = 0; i < 16; i++) if (i < 7 || i % 2 === 0) schweif.push([-i * sonnenseite, -Math.round(i * 0.45)]);
    stempel(0, [...schweif, [sonnenseite, 0], [0, -1], [0, 1]], stx, sty, T5);
    break;
  }

  // Fünf Vögel, nur im freien Himmel
  for (let v = 0, versuch = 0; v < 5 && versuch < 60; versuch++) {
    const vx = Math.round(B * (0.5 - sonnenseite * (0.02 + rnd() * 0.42)));
    const vy = Math.round(H * (0.1 + rnd() * 0.16));
    if (!frei(vx, vy, 3)) continue;
    stempel(0, [[-2, -1], [-1, 0], [0, 1], [1, 0], [2, -1]], vx, vy, T5);
    v++;
  }

  /* 6. See: gestauchte Spiegelung, Glitzerspur, Grund läuft in Nacht-Tinte aus */

  const tiefBeginn = H * 0.86;
  const tiefEnde = H - NAHT;
  // Spiegelung aus dem Bild bei Versatz 0 lesen, bevor der See es überdeckt
  const ueberUfer = new Uint8Array(B * ufer);
  for (let y = 0; y < ufer; y++) for (let x = 0; x < B; x++) ueberUfer[y * B + x] = oben(x, y);
  for (let y = ufer; y < H + U; y++) {
    const d = y - ufer;
    const quelle = ufer - Math.round(d * 2.5);
    const welle = Math.round(Math.sin(d * 1.7) * 1.6);
    const grund = Math.min(1, Math.max(0, (y - tiefBeginn) / (tiefEnde - tiefBeginn)));
    const spur = Math.round(sr * 0.6 + d * 1.2);
    const glanz = Math.round(Math.sin(d * 2.3) * 2);
    for (let x = 0; x < B; x++) {
      let farbe = BOGEN;
      if (y === ufer || y >= tiefEnde) farbe = T6;
      else {
        if (d % 2 && quelle >= 0) {
          const q = ueberUfer[quelle * B + Math.min(B - 1, Math.max(0, x + welle))];
          if (q >= T5) farbe = T4;
        }
        const dx = x - Math.round(sx);
        // Glitzerspur: kurze Striche, zum Rand der Spur und zur Tiefe hin seltener
        const rand = Math.abs(dx) / (spur + 1);
        const strich = (dx + glanz * 3 + d * 5 + 700) % 7 < (d % 2 ? 3 : 2);
        const imGlanz = rand <= 1 && strich && (1 - rand * rand) * (1 - grund * 0.85) > schwelle(3, x, y);
        // Wechselnd Gelb und Tinte; im dunklen Grund leuchtet nur noch Gelb
        if (imGlanz) farbe = d % 2 || grund > 0.3 ? GELB : T5;
        else if (grund > schwelle(3, x, y)) farbe = T6;
      }
      setze(3, x, y, farbe);
    }
  }

  /* Gesamtbild: mittlerer Ausschnitt, je Pixel die vorderste deckende Ebene */

  const farbe = new Uint8Array(B * H);
  const ebene = new Uint8Array(B * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < B; x++) {
      const i = (y + U) * B + x;
      for (let e = 3; e >= 0; e--) {
        if (lagen[e][i] !== LEER) {
          farbe[y * B + x] = lagen[e][i];
          ebene[y * B + x] = e;
          break;
        }
      }
    }
  }
  return { farbe, ebene, lagen };
}

// Ebenen mit Versatz (Kunstpixel, positiv = nach unten) zu einem Gesamtbild B × H stapeln
function zusammensetzen(szene: BergSzene, B: number, H: number, versatz: number[]): Uint8Array {
  if (versatz.every((v) => v === 0)) return szene.farbe;
  const G = H + 2 * UEBERSTAND;
  const farbe = new Uint8Array(B * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < B; x++) {
      let f = BOGEN;
      for (let e = 3; e >= 0; e--) {
        const quelle = y + UEBERSTAND - versatz[e];
        if (quelle < 0 || quelle >= G) continue;
        const wert = szene.lagen[e][quelle * B + x];
        if (wert !== LEER) {
          f = wert;
          break;
        }
      }
      farbe[y * B + x] = f;
    }
  }
  return farbe;
}

/* Bühne: Messen, Zeichnen, Parallax, Auftritt, Wirbel ----------------------- */

interface Panorama {
  buehne: HTMLElement;
  bild: HTMLElement;
  gesamt: HTMLCanvasElement;
  ebenen: HTMLCanvasElement[];
  hud: HTMLElement | null;
  angabe: HTMLElement | null;
  startwert: number;
  px: number;
  B: number;
  H: number;
  sperre: Sperre | null;
  szene: BergSzene | null;
  ebenenAn: boolean;
  versatz: number[];
  text: string;
  laedt: boolean;
}

let bergFlug = 0;
let bergEinblenden: gsap.core.Timeline | null = null;

function bergeText(p: Panorama, text?: string): void {
  if (p.angabe) p.angabe.textContent = text ?? p.text;
}

// Kunstpixel und Rasterweite aus der Größe von .berge__bild; Canvas unten bündig, mittig
function bergeMessen(p: Panorama): void {
  const w = p.bild.clientWidth || 360;
  const h = p.bild.clientHeight || 240;
  p.px = w < 768 ? 3 : w < 2200 ? 4 : 5;
  p.B = Math.ceil(w / p.px);
  p.H = Math.ceil(h / p.px);
  const links = Math.floor((w - p.B * p.px) / 2);
  const ueber = p.H * p.px - h; // so viel ragt oben über und wird im weißen Himmel abgeschnitten
  p.gesamt.width = p.B;
  p.gesamt.height = p.H;
  [p.gesamt, ...p.ebenen].forEach((canvas) => {
    canvas.style.width = `${p.B * p.px}px`;
    canvas.style.left = `${links}px`;
  });
  p.gesamt.style.height = `${p.H * p.px}px`;
  p.ebenen.forEach((canvas) => {
    canvas.style.height = `${(p.H + 2 * UEBERSTAND) * p.px}px`;
    canvas.style.bottom = `${-UEBERSTAND * p.px}px`;
  });
  // Bereich unter dem schwebenden HUD in Kunstpixeln
  p.sperre = null;
  const hud = p.hud?.getBoundingClientRect();
  const rahmen = p.bild.getBoundingClientRect();
  if (hud && hud.width > 0 && hud.top < rahmen.bottom && hud.bottom > rahmen.top) {
    p.sperre = {
      x0: Math.floor((hud.left - rahmen.left - links) / p.px),
      x1: Math.ceil((hud.right - rahmen.left - links) / p.px),
      y0: Math.floor((hud.top - rahmen.top + ueber) / p.px),
      y1: Math.ceil((hud.bottom - rahmen.top + ueber) / p.px),
    };
  }
  p.text = `${p.B} × ${p.H}, 6 Farben`;
  if (!p.laedt) bergeText(p);
}

function ebenenMalen(p: Panorama): void {
  if (!p.szene) return;
  const G = p.H + 2 * UEBERSTAND;
  p.ebenen.forEach((canvas, e) => {
    canvas.width = p.B;
    canvas.height = G;
    const ctx = canvas.getContext("2d");
    if (ctx && p.szene) malen(ctx, p.szene.lagen[e], p.B, G, PANORAMA_EBENE);
  });
}

// Laufenden Wirbel und Einblenden abbrechen, Ebenen wieder deckend zeigen
function wirbelBeenden(p: Panorama): void {
  cancelAnimationFrame(bergFlug);
  bergEinblenden?.kill();
  bergEinblenden = null;
  gsap.set(p.ebenen, { opacity: 1 });
  p.buehne.removeAttribute("data-wirbel");
  if (!p.laedt) bergeText(p);
}

function bergeZeichnen(p: Panorama): void {
  wirbelBeenden(p);
  bergeMessen(p);
  p.szene = bergeSzene(p.B, p.H, p.startwert, UEBERSTAND, p.sperre);
  const ctx = p.gesamt.getContext("2d", { willReadFrequently: true });
  if (ctx) malen(ctx, p.szene.farbe, p.B, p.H, PANORAMA_DECKEND);
  if (p.ebenenAn) ebenenMalen(p);
}

// Neu zeichnen: Die farbigen Pixel des alten Bildes drehen sich in einen Wirbel, ballen sich
// in der Mitte zusammen und entfalten von innen nach außen das neue Bild.
function bergeNeuZeichnen(p: Panorama): void {
  const ctx = p.gesamt.getContext("2d", { willReadFrequently: true });
  if (bewegungReduziert || !ctx) {
    bergeZeichnen(p);
    return;
  }
  cancelAnimationFrame(bergFlug);
  bergEinblenden?.kill();

  // Liegen die Ebenen oben, zeigt das Gesamtbild zuerst genau ihren Stand
  if (p.ebenenAn && p.szene && !p.buehne.hasAttribute("data-wirbel")) {
    malen(ctx, zusammensetzen(p.szene, p.B, p.H, p.versatz), p.B, p.H, PANORAMA_DECKEND);
  }
  p.buehne.setAttribute("data-wirbel", "");
  if (p.ebenenAn) gsap.to(p.ebenen, { opacity: 0, duration: 0.12, overwrite: true });

  // Aktuellen Stand lesen, so setzt ein Klick mitten im Flug sauber an
  const altB = p.gesamt.width;
  const altH = p.gesamt.height;
  const alt = ctx.getImageData(0, 0, altB, altH).data;
  bergeMessen(p);
  const { B, H } = p;
  p.szene = bergeSzene(B, H, p.startwert, UEBERSTAND, p.sperre);
  const ziel = p.ebenenAn ? zusammensetzen(p.szene, B, H, p.versatz) : p.szene.farbe;

  // Lage als Winkel und Abstand zur Bildmitte (Bildellipse, Rand = 1); sortiert nach
  // Tortenstück und Abstand, so finden Nachbarn benachbarte Ziele. Schlüssel und Index
  // liegen gemeinsam in einer Zahl, damit das Sortieren ohne Vergleichsfunktion läuft.
  const ordnen = (anzahl: number, pixel: (j: number) => number, breite: number, hoehe: number) => {
    const schluessel = new Float64Array(anzahl);
    for (let j = 0; j < anzahl; j++) {
      const i = pixel(j);
      const u = ((i % breite) - breite / 2) / (breite / 2);
      const v = (Math.floor(i / breite) - hoehe / 2) / (hoehe / 2);
      const rang = Math.floor((Math.atan2(v, u) + Math.PI) * 10) * 1024 + Math.min(1023, Math.floor(Math.hypot(u, v) * 700));
      schluessel[j] = rang * 262144 + i;
    }
    schluessel.sort();
    const winkel = new Float32Array(anzahl);
    const abstand = new Float32Array(anzahl);
    const index = new Uint32Array(anzahl);
    for (let j = 0; j < anzahl; j++) {
      const i = schluessel[j] % 262144;
      const u = ((i % breite) - breite / 2) / (breite / 2);
      const v = (Math.floor(i / breite) - hoehe / 2) / (hoehe / 2);
      winkel[j] = Math.atan2(v, u);
      abstand[j] = Math.hypot(u, v);
      index[j] = i;
    }
    return { winkel, abstand, index };
  };

  // Quelle: alle nicht weißen Pixel, mit Schwelle, damit verrauschtes Auslesen nicht stört
  const quellen: number[] = [];
  // Die untersten Zeilen bleiben während des Flugs Nacht-Tinte (Naht zur Rasterkante)
  for (let i = 0; i < altB * (altH - NAHT); i++) {
    if (alt[i * 4] + alt[i * 4 + 1] + alt[i * 4 + 2] < 700) quellen.push(i);
  }
  const ziele: number[] = [];
  for (let i = 0; i < B * (H - NAHT); i++) if (ziel[i] !== BOGEN) ziele.push(i);
  if (!quellen.length || !ziele.length) {
    bergeZeichnen(p);
    return;
  }
  const von = ordnen(quellen.length, (j) => quellen[j], altB, altH);
  const nach = ordnen(ziele.length, (j) => ziele[j], B, H);

  const EINZUG = 0.8; // so eng ballt sich der Wirbel in der Mitte
  const FRUEH = 0.55; // Anteil der Dauer, nach dem die innersten Pixel landen
  const richtung = Math.random() < 0.5 ? 1 : -1;
  // Höchstens 90 000 Teilchen; mehr Pixel auf einer Seite: gleichmäßig ausdünnen oder doppelt belegen
  const n = Math.min(90_000, Math.max(von.index.length, nach.index.length));
  const winkel = new Float32Array(n);
  const drehung = new Float32Array(n);
  const abstand = new Float32Array(n);
  const abstandZiel = new Float32Array(n);
  const ende = new Float32Array(n);
  const farbe = new Uint32Array(n);
  let weitester = 0;
  for (let j = 0; j < nach.abstand.length; j++) weitester = Math.max(weitester, nach.abstand[j]);
  weitester ||= 1;
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i * von.index.length) / n);
    const z = Math.floor((i * nach.index.length) / n);
    const wa = von.winkel[a];
    const wz = nach.winkel[z];
    const weg = wz - wa - Math.round((wz - wa) / (2 * Math.PI)) * 2 * Math.PI;
    winkel[i] = wa;
    drehung[i] = weg + richtung * 2 * Math.PI;
    abstand[i] = von.abstand[a];
    abstandZiel[i] = nach.abstand[z];
    farbe[i] = PANORAMA_DECKEND[ziel[nach.index[z]]]; // jedes Teilchen trägt seine Zielfarbe
    // Innen landet zuerst, so entfaltet sich das neue Bild aus der Mitte
    ende[i] = FRUEH + (1 - FRUEH) * (abstandZiel[i] / weitester) * (0.85 + Math.random() * 0.15);
  }

  bergeText(p, `${n.toLocaleString("de-DE")} Pixel unterwegs`);

  const bild = ctx.createImageData(B, H);
  const feld = new Uint32Array(bild.data.buffer);
  const papier = PANORAMA_DECKEND[BOGEN];
  const dauer = 1900;
  let beginn = 0;

  const fertig = () => {
    const szene = p.szene as BergSzene;
    malen(ctx, p.ebenenAn ? zusammensetzen(szene, B, H, p.versatz) : szene.farbe, B, H, PANORAMA_DECKEND);
    bergeText(p);
    if (!p.ebenenAn) {
      p.buehne.removeAttribute("data-wirbel");
      return;
    }
    // Ebenen aus demselben Startwert, von hinten nach vorne eingeblendet
    ebenenMalen(p);
    bergEinblenden = gsap.timeline({
      onComplete: () => {
        p.buehne.removeAttribute("data-wirbel");
        bergEinblenden = null;
      },
    });
    p.ebenen.forEach((canvas, e) => {
      bergEinblenden?.fromTo(canvas, { opacity: 0 }, { opacity: 1, duration: 0.16, ease: "steps(2)" }, e * 0.09);
    });
  };

  const schritt = (jetzt: number) => {
    if (!beginn) beginn = jetzt;
    const t = (jetzt - beginn) / dauer;
    if (t >= 1) {
      fertig();
      return;
    }
    feld.fill(papier);
    feld.fill(PANORAMA_DECKEND[T6], B * (H - NAHT));
    const mitteX = B / 2;
    const mitteY = H / 2;
    for (let i = 0; i < n; i++) {
      const q = t / ende[i];
      const s = q < 1 ? q : 1;
      const e = s < 0.5 ? 4 * s * s * s : 1 - (-2 * s + 2) ** 3 / 2;
      const w = winkel[i] + drehung[i] * e;
      const r = (abstand[i] + (abstandZiel[i] - abstand[i]) * e) * (1 - EINZUG * Math.sin(Math.PI * e));
      const x = Math.round(mitteX + Math.cos(w) * r * mitteX);
      const y = Math.round(mitteY + Math.sin(w) * r * mitteY);
      if (x >= 0 && x < B && y >= 0 && y < H) feld[y * B + x] = farbe[i];
    }
    ctx.putImageData(bild, 0, 0);
    bergFlug = requestAnimationFrame(schritt);
  };
  bergFlug = requestAnimationFrame(schritt);
}

// Parallax: ein ScrollTrigger, die Ebenen rasten auf ganze Kunstpixel ein.
// Gezeichnet wird dabei nie, es ändert sich nur der transform der Ebenen-Canvas.
function parallaxEinrichten(p: Panorama): () => void {
  const setzer = p.ebenen.map((canvas) => gsap.quickSetter(canvas, "y", "px") as (wert: number) => void);
  const stand = { fortschritt: 0.5 };
  let px = 0;
  const anwenden = () => {
    const neuePixel = px !== p.px;
    px = p.px;
    p.ebenen.forEach((_, e) => {
      const v = Math.round((2 * stand.fortschritt - 1) * TIEFE[e]);
      if (v === p.versatz[e] && !neuePixel) return;
      p.versatz[e] = v;
      setzer[e](v * p.px);
    });
  };
  const tween = gsap.fromTo(
    stand,
    { fortschritt: 0 },
    {
      fortschritt: 1,
      ease: "none",
      onUpdate: anwenden,
      scrollTrigger: {
        trigger: p.bild,
        start: "top bottom",
        end: "bottom top",
        scrub: 0.6,
        onToggle: (self) => gsap.set(p.ebenen, { willChange: self.isActive ? "transform" : "auto" }),
      },
    },
  );
  anwenden();
  p.bild.addEventListener("berge:neu", anwenden);
  return () => {
    p.bild.removeEventListener("berge:neu", anwenden);
    tween.scrollTrigger?.kill();
    tween.kill();
    p.versatz = [0, 0, 0, 0];
    gsap.set(p.ebenen, { clearProps: "transform,willChange" });
  };
}

// Erster Auftritt: Das Bild baut sich zeilenweise auf wie eine BMP-Datei beim Laden
function auftrittEinrichten(p: Panorama): void {
  if (bewegungReduziert || p.bild.getBoundingClientRect().top <= window.innerHeight) return;
  gsap.set(p.bild, { clipPath: "inset(0 0 100% 0)" });
  p.laedt = true;
  bergeText(p, "Lädt … 0 %");
  ScrollTrigger.create({
    trigger: p.bild,
    start: "top 75%",
    once: true,
    onEnter: () => {
      const zeilen = Math.max(8, Math.round(p.bild.clientHeight / p.px / 2));
      const lauf: gsap.core.Tween = gsap.to(p.bild, {
        clipPath: "inset(0 0 0% 0)",
        duration: window.innerWidth < 768 ? 1 : 1.4,
        ease: `steps(${zeilen})`,
        onUpdate: () => bergeText(p, `Lädt … ${Math.round(lauf.ratio * 100)} %`),
        onComplete: () => {
          p.laedt = false;
          gsap.set(p.bild, { clearProps: "clipPath" });
          bergeText(p);
        },
      });
    },
  });
}

function fotoRastern(canvas: HTMLCanvasElement, bild: HTMLImageElement): void {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  const { B, H } = kunstFlaeche(canvas, 2, bild.naturalHeight / bild.naturalWidth);
  ctx.drawImage(bild, 0, 0, B, H);
  const pixel = ctx.getImageData(0, 0, B, H).data;

  // Helligkeit mit etwas mehr Kontrast, dann Fehlerdiffusion (Floyd-Steinberg)
  const hell = new Float32Array(B * H);
  for (let i = 0; i < B * H; i++) {
    const l = (0.299 * pixel[i * 4] + 0.587 * pixel[i * 4 + 1] + 0.114 * pixel[i * 4 + 2]) / 255;
    hell[i] = Math.min(1, Math.max(0, (l - 0.5) * 1.3 + 0.55));
  }
  const ton = new Float32Array(B * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < B; x++) {
      const i = y * B + x;
      const neu = hell[i] < 0.5 ? 0 : 1;
      const fehler = hell[i] - neu;
      ton[i] = neu === 0 ? 1 : 0;
      if (x + 1 < B) hell[i + 1] += (fehler * 7) / 16;
      if (y + 1 < H) {
        if (x > 0) hell[i + B - 1] += (fehler * 3) / 16;
        hell[i + B] += (fehler * 5) / 16;
        if (x + 1 < B) hell[i + B + 1] += fehler / 16;
      }
    }
  }
  rastern(ctx, ton, B, H);
}

// Neu zeichnen, sobald sich Breite oder Höhe (gerundet) ändern
function beiGroesse(element: Element, zeichnen: () => void): void {
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
    geplant = requestAnimationFrame(zeichnen);
  }).observe(element);
}

function persoenlichEinrichten(): void {
  const buehne = document.querySelector<HTMLElement>("[data-berge-buehne]");
  const bild = buehne?.querySelector<HTMLElement>("[data-berge-bild]");
  const gesamt = bild?.querySelector<HTMLCanvasElement>("[data-berge]");
  if (buehne && bild && gesamt) {
    const p: Panorama = {
      buehne,
      bild,
      gesamt,
      ebenen: EBENEN.map((name) => bild.querySelector<HTMLCanvasElement>(`[data-berge-ebene="${name}"]`) as HTMLCanvasElement),
      hud: buehne.querySelector<HTMLElement>(".berge__hud"),
      angabe: buehne.querySelector<HTMLElement>("[data-bild-groesse]"),
      startwert: 2026,
      px: 4,
      B: 0,
      H: 0,
      sperre: null,
      szene: null,
      ebenenAn: false,
      versatz: [0, 0, 0, 0],
      text: "6 Farben",
      laedt: false,
    };

    // Ebenen nur auf großen Bildschirmen und ohne reduzierte Bewegung
    const ebenenFrage = window.matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)");
    let parallaxAus: (() => void) | null = null;
    const umschalten = () => {
      const an = ebenenFrage.matches && p.ebenen.every(Boolean);
      if (an === p.ebenenAn && (an ? parallaxAus : true)) return;
      wirbelBeenden(p);
      p.ebenenAn = an;
      parallaxAus?.();
      parallaxAus = null;
      if (an) {
        buehne.dataset.ebenen = "an";
        if (p.szene) ebenenMalen(p);
        parallaxAus = parallaxEinrichten(p);
      } else {
        delete buehne.dataset.ebenen;
      }
    };

    auftrittEinrichten(p);
    beiGroesse(bild, () => {
      bergeZeichnen(p);
      if (!parallaxAus) umschalten();
      else bild.dispatchEvent(new Event("berge:neu"));
    });
    ebenenFrage.addEventListener("change", umschalten);
    buehne.querySelector<HTMLButtonElement>("[data-berge-neu]")?.addEventListener("click", () => {
      p.startwert = Math.floor(Math.random() * 1_000_000);
      bergeNeuZeichnen(p);
    });
  }

  const foto = document.querySelector<HTMLCanvasElement>("[data-foto]");
  if (foto?.dataset.foto && foto.parentElement) {
    const bild = new Image();
    bild.src = foto.dataset.foto;
    bild
      .decode()
      .then(() => beiGroesse(foto.parentElement as Element, () => fotoRastern(foto, bild)))
      .catch(() => foto.closest(".bild-fenster")?.setAttribute("hidden", ""));
  }
}

/* Kopier-Knöpfe für Adressen --------------------------------------------- */

function kopierKnoepfeEinrichten(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-kopiere]").forEach((knopf) => {
    knopf.addEventListener("click", async () => {
      const ok = await kopieren(knopf.dataset.kopiere ?? "");
      rueckmeldung(knopf, ok ? "Kopiert" : "Bitte markieren und kopieren");
    });
  });
}

datumSetzen();
belegAnimieren();
meldungenEinrichten();
zeitfresserEinrichten();
anfrageEinrichten();
persoenlichEinrichten();
kopierKnoepfeEinrichten();
