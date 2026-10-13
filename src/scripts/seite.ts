import { gsap } from "gsap";
import Lenis from "lenis";

declare global {
  interface Window {
    __belegGestartet?: boolean;
  }
}

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

/* Zeitfresser-Check ---------------------------------------------------------- */

const ARBEITSTAGE = 220;
const STUNDEN_PRO_WOCHE = 40;

function zeitfresserEinrichten(): void {
  const formular = document.querySelector<HTMLFormElement>("[data-check]");
  if (!formular) return;

  const boxen = Array.from(formular.querySelectorAll<HTMLInputElement>('input[name="punkt"]'));
  const zeiten = Array.from(formular.querySelectorAll<HTMLInputElement>('input[name="zeit"]'));
  const ergebnis = formular.querySelector<HTMLElement>(".check__ergebnis");
  const zahl = formular.querySelector<HTMLElement>("[data-ergebnis-zahl]");
  const erklaerung = formular.querySelector<HTMLElement>("[data-ergebnis-text]");
  const knopf = formular.querySelector<HTMLButtonElement>("[data-check-besprechen]");
  const stand = document.querySelector<HTMLElement>("[data-check-stand]");

  const ganzzahl = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
  const kommazahl = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

  const zustand = () => {
    const punkte = boxen.filter((b) => b.checked).map((b) => b.value);
    const gewaehlt = zeiten.find((z) => z.checked);
    const minuten = Number(gewaehlt?.value ?? 0);
    const stunden = Math.round((minuten * ARBEITSTAGE) / 60);
    return {
      punkte,
      minuten,
      stunden,
      wochen: stunden / STUNDEN_PRO_WOCHE,
      zeitText: gewaehlt?.labels?.[0]?.textContent?.trim() ?? "",
    };
  };

  const aktualisieren = () => {
    const z = zustand();
    const fertig = z.punkte.length > 0 && z.minuten > 0;

    if (stand) {
      stand.textContent =
        z.punkte.length > 0 ? `${z.punkte.length} von ${boxen.length} angekreuzt` : "Noch nichts angekreuzt";
    }

    ergebnis?.classList.toggle("ist-fertig", fertig);

    if (zahl && erklaerung) {
      if (fertig) {
        zahl.textContent = `Rund ${ganzzahl.format(z.stunden)} Stunden im Jahr`;
        erklaerung.textContent = `Das sind etwa ${kommazahl.format(z.wochen)} Arbeitswochen, die Ihr Team jedes Jahr mit Handarbeit verbringt.`;
      } else if (z.punkte.length > 0) {
        zahl.textContent = "Fast geschafft";
        erklaerung.textContent = "Wählen Sie noch, wie viel Zeit das pro Tag kostet.";
      } else if (z.minuten > 0) {
        zahl.textContent = "Fast geschafft";
        erklaerung.textContent = "Kreuzen Sie noch an, was bei Ihnen von Hand läuft.";
      } else {
        zahl.textContent = "Ihr Ergebnis erscheint hier";
        erklaerung.textContent = "Zum Vergleich: 30 Minuten am Tag sind rund 110 Stunden im Jahr.";
      }
    }

    if (knopf) knopf.disabled = !fertig;
  };

  knopf?.addEventListener("click", () => {
    const z = zustand();
    const text = [
      "Ergebnis aus dem Zeitfresser-Check:",
      ...z.punkte.map((p) => `- ${p}`),
      `Zeitaufwand im Team: ${z.zeitText} pro Tag, rund ${ganzzahl.format(z.stunden)} Stunden im Jahr.`,
    ].join("\n");
    window.dispatchEvent(new CustomEvent<string>("anfrage:vorbelegen", { detail: text }));
  });

  formular.addEventListener("change", aktualisieren);
  formular.addEventListener("submit", (event) => event.preventDefault());
  aktualisieren();
}

/* Anfrageformular ---------------------------------------------------------- */

function anfrageEinrichten(): void {
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail.value.trim())) {
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

  formular.addEventListener("submit", async (event) => {
    event.preventDefault();
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
      statusSetzen("Wird gesendet …");
      try {
        const antwort = await fetch(ziel, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.value.trim(),
            firma: firma.value.trim(),
            email: mail.value.trim(),
            telefon: telefon.value.trim(),
            nachricht: nachricht.value.trim(),
            seite: window.location.href,
          }),
        });
        if (!antwort.ok) throw new Error(String(antwort.status));
        erfolg();
      } catch {
        statusSetzen(`Senden hat nicht geklappt. Bitte schreiben Sie direkt an ${email}.`);
      }
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

/* Persönliches Bild: Berge oder Foto, im Zweifarb-Raster ------------------- */

const TINTE = [43, 42, 126];
const PAPIER = [255, 255, 255];
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
    const v = h[Math.round((x / (breite - 1)) * n)];
    profil[x] = (v - min) / (max - min || 1);
  }
  return profil;
}

function rastern(ctx: CanvasRenderingContext2D, ton: Float32Array, breite: number, hoehe: number): void {
  const bild = ctx.createImageData(breite, hoehe);
  for (let y = 0; y < hoehe; y++) {
    for (let x = 0; x < breite; x++) {
      const i = y * breite + x;
      const an = ton[i] > (BAYER[y % 8][x % 8] + 0.5) / 64;
      const farbe = an ? TINTE : PAPIER;
      bild.data[i * 4] = farbe[0];
      bild.data[i * 4 + 1] = farbe[1];
      bild.data[i * 4 + 2] = farbe[2];
      bild.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(bild, 0, 0);
}

// Zeichenfläche in ganzen Kunstpixeln anlegen, damit die Pixel gleich groß bleiben
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

function bergeZeichnen(canvas: HTMLCanvasElement, startwert: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { B, H } = kunstFlaeche(canvas, 3, 0.625);
  const rnd = zufall(startwert);
  const ton = new Float32Array(B * H); // 0 = Papier, 1 = Tinte, dazwischen gerastert
  const setze = (x: number, y: number, wert: number) => {
    if (x >= 0 && x < B && y >= 0 && y < H) ton[y * B + x] = wert;
  };

  // Sonne als Ring
  const sx = B * (0.66 + rnd() * 0.2);
  const sy = H * (0.17 + rnd() * 0.07);
  const sr = Math.max(5, B * 0.05);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < B; x++) {
      const d = Math.hypot(x - sx, y - sy);
      if (d >= sr - 1 && d <= sr) ton[y * B + x] = 1;
    }
  }

  // Zwei Vögel
  for (let v = 0; v < 2; v++) {
    const vx = Math.round(B * (0.14 + rnd() * 0.32));
    const vy = Math.round(H * (0.1 + rnd() * 0.14));
    [[-2, -1], [-1, 0], [0, 1], [1, 0], [2, -1]].forEach(([dx, dy]) => setze(vx + dx, vy + dy, 1));
  }

  // Drei Bergketten: hinten mit Schnee, Mitte dunkler, vorne voll
  const ketten = [
    { basis: 0.64, hoehe: 0.5, rauheit: 0.55, ton: 0.5, schnee: true },
    { basis: 0.8, hoehe: 0.28, rauheit: 0.58, ton: 0.78, schnee: false },
    { basis: 0.97, hoehe: 0.14, rauheit: 0.5, ton: 1, schnee: false },
  ];

  let gipfelX = Math.round(B / 2);
  let gipfelY = H;

  ketten.forEach((kette, k) => {
    const profil = grat(rnd, kette.rauheit, B);
    for (let x = 0; x < B; x++) {
      const kamm = Math.round(H * (kette.basis - kette.hoehe * profil[x]));
      const schneegrenze = H * 0.42 + Math.sin(x * 0.9) * 1.5 + rnd() * 2;
      for (let y = Math.max(0, kamm); y < H; y++) {
        let wert = kette.ton;
        if (kette.schnee && y < schneegrenze) wert = 0;
        if (y === kamm) wert = 1;
        ton[y * B + x] = wert;
      }
      if (k === 0 && x > B * 0.2 && x < B * 0.8 && kamm < gipfelY) {
        gipfelY = kamm;
        gipfelX = x;
      }
    }
  });

  // Wanderer mit Stock auf dem höchsten Gipfel
  [
    [0, -8],
    [0, -7], [-1, -6], [0, -6], [1, -6],
    [0, -5], [0, -4],
    [-1, -3], [1, -3], [-1, -2], [1, -2], [-1, -1], [1, -1],
    [2, -7], [2, -6], [2, -5], [2, -4], [2, -3], [2, -2], [2, -1],
  ].forEach(([dx, dy]) => setze(gipfelX + dx, gipfelY + dy, 1));

  rastern(ctx, ton, B, H);
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

function beiGroesse(element: Element, zeichnen: () => void): void {
  let breite = 0;
  let geplant = 0;
  new ResizeObserver((eintraege) => {
    const neu = Math.round(eintraege[0].contentRect.width);
    if (neu === breite) return;
    breite = neu;
    cancelAnimationFrame(geplant);
    geplant = requestAnimationFrame(zeichnen);
  }).observe(element);
}

function persoenlichEinrichten(): void {
  const berge = document.querySelector<HTMLCanvasElement>("[data-berge]");
  if (berge?.parentElement) {
    let startwert = 2026;
    beiGroesse(berge.parentElement, () => bergeZeichnen(berge, startwert));
    document.querySelector<HTMLButtonElement>("[data-berge-neu]")?.addEventListener("click", () => {
      startwert = Math.floor(Math.random() * 1_000_000);
      bergeZeichnen(berge, startwert);
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
