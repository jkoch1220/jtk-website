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
new Lenis({ autoRaf: true, anchors: true });

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

  const startzustand = () => {
    gsap.set(werte, { clipPath: "inset(0 100% 0 0)" });
    gsap.set(kopien, { x: 0, y: 0, rotation: 0 });
    gsap.set(stempel, { autoAlpha: 0, scale: 1.45 });
  };
  startzustand();

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

/* Checkliste: angekreuzte Punkte werden zur E-Mail -------------------------- */

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

function checklisteEinrichten(): void {
  const formular = document.querySelector<HTMLFormElement>("[data-checkliste]");
  if (!formular) return;

  const email = formular.dataset.email ?? "";
  const betreff = formular.dataset.betreff ?? "";
  const boxen = Array.from(formular.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
  const stand = formular.querySelector<HTMLElement>("[data-stand]");
  const senden = formular.querySelector<HTMLAnchorElement>("[data-senden]");
  const kopierKnopf = formular.querySelector<HTMLButtonElement>("[data-kopieren]");
  const textfeld = formular.querySelector<HTMLTextAreaElement>("[data-text]");

  const angekreuzt = () => boxen.filter((b) => b.checked).map((b) => b.value);

  const nachricht = (punkte: string[]) =>
    [
      "Guten Tag Herr Koch,",
      "",
      "in unserem Betrieb läuft noch von Hand:",
      ...punkte.map((p) => `- ${p}`),
      "",
      "Können wir darüber sprechen?",
      "",
      "Unternehmen:",
      "Telefon:",
      "",
    ].join("\n");

  const aktualisieren = () => {
    const punkte = angekreuzt();
    const anzahl = punkte.length;

    if (stand) {
      stand.textContent = anzahl === 0 ? "Noch nichts angekreuzt" : `${anzahl} von ${boxen.length} angekreuzt`;
    }

    if (senden) {
      if (anzahl > 0) {
        senden.href = `mailto:${email}?subject=${encodeURIComponent(betreff)}&body=${encodeURIComponent(
          nachricht(punkte),
        )}`;
        senden.removeAttribute("aria-disabled");
      } else {
        senden.href = `mailto:${email}`;
        senden.setAttribute("aria-disabled", "true");
      }
    }

    if (kopierKnopf) kopierKnopf.disabled = anzahl === 0;
    if (textfeld && !textfeld.hidden) textfeld.value = nachricht(punkte);
  };

  senden?.addEventListener("click", (event) => {
    if (senden.getAttribute("aria-disabled") === "true") event.preventDefault();
  });

  kopierKnopf?.addEventListener("click", async () => {
    const ok = await kopieren(nachricht(angekreuzt()), textfeld);
    rueckmeldung(kopierKnopf, ok ? "Kopiert" : "Text unten markiert");
  });

  formular.addEventListener("change", aktualisieren);
  formular.addEventListener("submit", (event) => event.preventDefault());
  aktualisieren();
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
checklisteEinrichten();
kopierKnoepfeEinrichten();
