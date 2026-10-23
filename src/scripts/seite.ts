import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { aufrufId, checkErgebnis, seitenStart, type CheckErgebnis } from "./tracking";
import { turnstileToken, turnstileVorbereiten, turnstileZuruecksetzen } from "./turnstile";
import { BAYER, palette } from "./berge-szene";
import { panoramaEinrichten } from "./berge-buehne";
import { meldungenEinrichten } from "./meldungen";
import { zeitfresserEinrichten } from "./zeitfresser";

declare global {
  interface Window {
    __belegGestartet?: boolean;
  }
}

gsap.registerPlugin(ScrollTrigger);

const bewegungReduziert = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Weiches Scrollen. Lenis beachtet reduzierte Bewegung selbst und
   rechnet bei Ankerlinks scroll-padding-top (html) ein. */
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

/* Problem: Meldungen wegklicken steht in ./meldungen ------------------------ */

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

/* Persönliches Bild: Bergpanorama (berge-buehne.ts) oder Foto im Zweifarb-Raster ---- */

// Foto-Abzug: Papier und Tinte. Nachts liegt der Abzug als Papierinsel unter der Lampe (--insel-bogen).
const FOTO_PALETTE = {
  light: palette(
    [
      [255, 255, 255],
      [43, 42, 126],
    ],
    null,
  ),
  dark: palette(
    [
      [233, 232, 241],
      [43, 42, 126],
    ],
    null,
  ),
};

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

// Gedruckt wird der Abzug immer hell, auch im Dunkelmodus
let fotoDruckt = false;

function rastern(ctx: CanvasRenderingContext2D, ton: Float32Array, breite: number, hoehe: number): void {
  const tabelle = FOTO_PALETTE[!fotoDruckt && document.documentElement.dataset.theme === "dark" ? "dark" : "light"];
  const farben = maske(ton, breite, hoehe);
  const bild = ctx.createImageData(breite, hoehe);
  const feld = new Uint32Array(bild.data.buffer);
  for (let i = 0; i < farben.length; i++) feld[i] = tabelle[farben[i]];
  ctx.putImageData(bild, 0, 0);
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
  panoramaEinrichten(bewegungReduziert);

  const foto = document.querySelector<HTMLCanvasElement>("[data-foto]");
  if (foto?.dataset.foto && foto.parentElement) {
    const bild = new Image();
    bild.src = foto.dataset.foto;
    bild
      .decode()
      .then(() => {
        beiGroesse(foto.parentElement as Element, () => fotoRastern(foto, bild));
        document.addEventListener("theme", () => fotoRastern(foto, bild));
        window.addEventListener("beforeprint", () => {
          fotoDruckt = true;
          fotoRastern(foto, bild);
        });
        window.addEventListener("afterprint", () => {
          fotoDruckt = false;
          fotoRastern(foto, bild);
        });
      })
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
