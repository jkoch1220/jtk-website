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
  malen(ctx, maske(ton, breite, hoehe), breite, hoehe);
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

// Bergszene als Tonwerte: 0 = Papier, 1 = Tinte, dazwischen gerastert
function bergeSzene(B: number, H: number, startwert: number): Float32Array {
  const rnd = zufall(startwert);
  const ton = new Float32Array(B * H);
  const setze = (x: number, y: number, wert: number) => {
    if (x >= 0 && x < B && y >= 0 && y < H) ton[y * B + x] = wert;
  };
  // Figur mit 1 Pixel Papierrand stempeln, damit sie sich vom Raster abhebt
  const stempel = (punkte: number[][], x: number, y: number) => {
    punkte.forEach(([dx, dy]) => {
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) setze(x + dx + a, y + dy + b, 0);
    });
    punkte.forEach(([dx, dy]) => setze(x + dx, y + dy, 1));
  };
  const ufer = Math.round(H * 0.8); // darunter liegt der See

  // Himmel: waagerechte Linien, die zum Horizont hin auseinanderlaufen
  for (let k = 0, y = 0; y < ufer; k++, y += 2 + Math.round((k * H) / 75)) {
    for (let x = 0; x < B; x++) ton[y * B + x] = 1;
  }

  // Sonne: volle Scheibe mit Schlitzen, die nach unten breiter werden
  const sonnenseite = rnd() < 0.5 ? 1 : -1; // Sonne mal rechts, mal links
  const sx = B * (0.5 + sonnenseite * (0.12 + rnd() * 0.22));
  const sy = H * (0.2 + rnd() * 0.06);
  const sr = Math.max(7, H * 0.15);
  for (let y = Math.floor(sy - sr - 3); y <= sy + sr + 3; y++) {
    for (let x = Math.floor(sx - sr - 3); x <= sx + sr + 3; x++) {
      const d = Math.hypot(x - sx, y - sy);
      if (d > sr + 2.5) continue;
      const reihe = Math.round(y - sy);
      const schlitz = reihe > 0 && reihe % 3 < (reihe / sr) * 2.4;
      setze(x, y, d <= sr && !schlitz ? 1 : 0);
    }
  }

  // Vier Bergketten: hinten hell mit Schnee, vorne dunkel, an den Füßen Nebel
  const ketten = [
    { basis: 0.62, hoehe: 0.5, rauheit: 0.55, licht: 0.25, schatten: 0.5, nebel: 0.5 },
    { basis: 0.7, hoehe: 0.3, rauheit: 0.58, licht: 0.25, schatten: 0.5, nebel: 0.9 },
    { basis: 0.76, hoehe: 0.2, rauheit: 0.55, licht: 0.5, schatten: 0.75, nebel: 0.9 },
    { basis: 0.8, hoehe: 0.1, rauheit: 0.5, licht: 1, schatten: 1, nebel: 0 },
  ];
  let gipfelX = Math.round(B / 2);
  let gipfelY = H;
  let vorneKamm = new Int32Array(B);
  let hintenKamm = new Int32Array(B);

  ketten.forEach((kette, k) => {
    const profil = grat(rnd, kette.rauheit, B);
    const kaemme = new Int32Array(B);
    let imSchatten = false;
    for (let x = 0; x < B; x++) {
      const kamm = Math.round(H * (kette.basis - kette.hoehe * profil[x]));
      kaemme[x] = kamm;
      // Hänge, die von der Sonne wegzeigen, liegen im Schatten; Hysterese gegen Flackern
      const neigung = (profil[Math.min(B - 1, x + 4)] - profil[Math.max(0, x - 4)]) * sonnenseite;
      if (Math.abs(neigung) > 0.04) imSchatten = neigung > 0;
      const schneeTief = Math.max(0, H * 0.3 - kamm) * 0.7 + rnd() * 2;
      for (let y = Math.max(0, kamm); y < ufer; y++) {
        const nebel = Math.min(1, (y - kamm) / (H * 0.16 + 2)) * kette.nebel;
        let wert = (imSchatten ? kette.schatten : kette.licht) * (1 - nebel);
        if (k === 0 && y - kamm < schneeTief) wert = imSchatten ? 0.25 : 0;
        if (y === kamm) wert = 1;
        ton[y * B + x] = Math.round(wert * 4) / 4; // feste Stufen ergeben ruhige Muster
      }
    }
    // Höchster echter Gipfel der hinteren Kette, mit Abstand zur Sonne
    if (k === 0) {
      for (let x = Math.ceil(B * 0.12); x <= Math.floor(B * 0.88); x++) {
        if (Math.abs(x - sx) < sr + 7) continue;
        let lokal = true;
        for (let d = -3; d <= 3; d++) {
          if (kaemme[Math.min(B - 1, Math.max(0, x + d))] < kaemme[x]) lokal = false;
        }
        if (lokal && kaemme[x] < gipfelY) {
          gipfelY = kaemme[x];
          gipfelX = x;
        }
      }
      hintenKamm = kaemme;
    }
    vorneKamm = kaemme;
  });

  // Tannen auf der vordersten Kette, mit Abstand, damit sie einzeln lesbar bleiben
  for (let bx = 2 + Math.floor(rnd() * 6); bx < B - 2; bx += 5 + Math.floor(rnd() * 9)) {
    const groesse = 4 + Math.floor(rnd() * 5);
    const fuss = vorneKamm[bx];
    for (let j = 0; j < groesse; j++) {
      const halb = Math.floor(j * 0.45);
      for (let dx = -halb; dx <= halb; dx++) setze(bx + dx, fuss - groesse + j, 1);
    }
  }

  // See: Silhouetten gestaucht gespiegelt, jede zweite Zeile frei, Glitzern unter der Sonne
  for (let y = ufer + 1; y < H; y++) {
    const d = y - ufer;
    const quelle = ufer - d * 2;
    const welle = Math.round(Math.sin(d * 1.7) * 1.5);
    for (let x = 0; x < B; x++) {
      const q = quelle >= 0 ? ton[quelle * B + Math.min(B - 1, Math.max(0, x + welle))] : 0;
      ton[y * B + x] = d % 2 && q > 0.7 ? 1 : 0;
    }
    const spur = Math.round(sr * 0.3 + d * 0.6);
    const versatz = Math.round(Math.sin(d * 2.3) * 2);
    for (let dx = -spur; dx <= spur; dx++) {
      if ((dx + versatz + 40) % 5 < 3) setze(Math.round(sx) + dx, y, d % 2 ? 0 : 1);
    }
  }
  for (let x = 0; x < B; x++) ton[ufer * B + x] = 1;

  // Sternschnuppe: Kopf mit Funkeln, Schweif wird nach hinten lückenhaft
  const stx = Math.round(B * (0.5 - sonnenseite * (0.05 + rnd() * 0.3)));
  const sty = Math.max(8, Math.min(Math.round(H * (0.12 + rnd() * 0.08)), hintenKamm[stx] - 4));
  const schweif: number[][] = [];
  for (let i = 0; i < 16; i++) if (i < 7 || i % 2 === 0) schweif.push([-i * sonnenseite, -Math.round(i * 0.45)]);
  stempel([...schweif, [sonnenseite, 0], [0, -1], [0, 1]], stx, sty);

  // Drei Vögel, nur im freien Himmel
  for (let v = 0; v < 3; v++) {
    const vx = Math.round(B * (0.5 - sonnenseite * (0.02 + rnd() * 0.4)));
    const vy = Math.max(2, Math.min(Math.round(H * (0.08 + rnd() * 0.14)), hintenKamm[vx] - 4));
    stempel([[-2, -1], [-1, 0], [0, 1], [1, 0], [2, -1]], vx, vy);
  }

  // Wanderer mit Stock auf dem höchsten Gipfel abseits der Sonne
  stempel(
    [
      [0, -8],
      [0, -7], [-1, -6], [0, -6], [1, -6],
      [0, -5], [0, -4],
      [-1, -3], [1, -3], [-1, -2], [1, -2], [-1, -1], [1, -1],
      [2, -7], [2, -6], [2, -5], [2, -4], [2, -3], [2, -2], [2, -1],
    ],
    gipfelX,
    gipfelY,
  );
  for (let dx = -3; dx <= 4; dx++) setze(gipfelX + dx, gipfelY, 1);

  return ton;
}

let bergFlug = 0;

function bergeZeichnen(canvas: HTMLCanvasElement, startwert: number): void {
  cancelAnimationFrame(bergFlug);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  const { B, H } = kunstFlaeche(canvas, 3, 0.625);
  malen(ctx, maske(bergeSzene(B, H, startwert), B, H), B, H);
}

// Little-Endian-Pixelwert für die Uint32-Sicht auf ImageData
function farbwert([r, g, b]: number[]): number {
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

// Neu zeichnen: Die Tintenpixel des alten Bildes drehen sich in einen Wirbel, ballen sich
// in der Mitte zusammen und entfalten von innen nach außen das neue Bild.
function bergeNeuZeichnen(canvas: HTMLCanvasElement, startwert: number): void {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (bewegungReduziert || !ctx) {
    bergeZeichnen(canvas, startwert);
    return;
  }
  cancelAnimationFrame(bergFlug);

  // Aktuellen Stand lesen, so setzt ein Klick mitten im Flug sauber an
  const altB = canvas.width;
  const altH = canvas.height;
  const alt = ctx.getImageData(0, 0, altB, altH).data;
  const { B, H } = kunstFlaeche(canvas, 3, 0.625);
  const ziel = maske(bergeSzene(B, H, startwert), B, H);

  // Lage als Winkel und Abstand zur Bildmitte, bezogen auf die Bildellipse (Rand = 1)
  const polar = (i: number, breite: number, hoehe: number): [number, number] => {
    const u = ((i % breite) - breite / 2) / (breite / 2);
    const v = (Math.floor(i / breite) - hoehe / 2) / (hoehe / 2);
    return [Math.atan2(v, u), Math.hypot(u, v)];
  };
  // Nach Tortenstück und Abstand sortiert, so finden Nachbarn benachbarte Ziele
  const rang = ([winkel, abstand]: [number, number]) => Math.floor((winkel + Math.PI) * 10) * 10 + abstand;
  const ordnen = (liste: [number, number][]) => liste.sort((p, q) => rang(p) - rang(q));

  const von: [number, number][] = [];
  // Rotkanal mit Schwelle statt exakt, damit verrauschtes Auslesen (Fingerprinting-Schutz) nicht stört
  for (let i = 0; i < altB * altH; i++) {
    if (alt[i * 4] < 128) von.push(polar(i, altB, altH));
  }
  const nach: [number, number][] = [];
  ziel.forEach((an, i) => {
    if (an) nach.push(polar(i, B, H));
  });
  if (!von.length || !nach.length) {
    malen(ctx, ziel, B, H);
    return;
  }
  ordnen(von);
  ordnen(nach);

  const EINZUG = 0.8; // so eng ballt sich der Wirbel in der Mitte
  const FRUEH = 0.55; // Anteil der Dauer, nach dem die innersten Pixel landen
  const richtung = Math.random() < 0.5 ? 1 : -1;
  const n = Math.max(von.length, nach.length);
  const winkel = new Float32Array(n);
  const drehung = new Float32Array(n);
  const abstand = new Float32Array(n);
  const abstandZiel = new Float32Array(n);
  const ende = new Float32Array(n);
  const weitester = nach.reduce((max, [, r]) => Math.max(max, r), 0) || 1;
  for (let i = 0; i < n; i++) {
    // Mehr Pixel auf einer Seite: anteilig doppelt belegen statt von außen holen
    const [wa, ra] = von[Math.floor((i * von.length) / n)];
    const [wz, rz] = nach[Math.floor((i * nach.length) / n)];
    const weg = wz - wa - Math.round((wz - wa) / (2 * Math.PI)) * 2 * Math.PI;
    winkel[i] = wa;
    drehung[i] = weg + richtung * 2 * Math.PI;
    abstand[i] = ra;
    abstandZiel[i] = rz;
    // Innen landet zuerst, so entfaltet sich das neue Bild aus der Mitte
    ende[i] = FRUEH + (1 - FRUEH) * (rz / weitester) * (0.85 + Math.random() * 0.15);
  }

  const angabe = canvas.closest(".fenster")?.querySelector<HTMLElement>("[data-bild-groesse]");
  const fertigText = angabe?.textContent ?? "";
  if (angabe) angabe.textContent = `${n} Pixel unterwegs`;

  const bild = ctx.createImageData(B, H);
  const feld = new Uint32Array(bild.data.buffer);
  const tinte = farbwert(TINTE);
  const papier = farbwert(PAPIER);
  const dauer = 1900;
  let beginn = 0;

  const schritt = (jetzt: number) => {
    if (!beginn) beginn = jetzt;
    const t = (jetzt - beginn) / dauer;
    if (t >= 1) {
      malen(ctx, ziel, B, H);
      if (angabe) angabe.textContent = fertigText;
      return;
    }
    feld.fill(papier);
    for (let i = 0; i < n; i++) {
      const p = Math.min(1, t / ende[i]);
      const e = p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
      const w = winkel[i] + drehung[i] * e;
      const r = (abstand[i] + (abstandZiel[i] - abstand[i]) * e) * (1 - EINZUG * Math.sin(Math.PI * e));
      const x = Math.round(B / 2 + (Math.cos(w) * r * B) / 2);
      const y = Math.round(H / 2 + (Math.sin(w) * r * H) / 2);
      if (x >= 0 && x < B && y >= 0 && y < H) feld[y * B + x] = tinte;
    }
    ctx.putImageData(bild, 0, 0);
    bergFlug = requestAnimationFrame(schritt);
  };
  bergFlug = requestAnimationFrame(schritt);
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
      bergeNeuZeichnen(berge, startwert);
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
