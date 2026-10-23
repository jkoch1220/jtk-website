/* Reichweitenmessung ohne Cookies. Nichts wird im Browser gespeichert: Die
   Aufruf-ID lebt nur im Speicher dieser Seite und ist beim nächsten Laden neu.
   Einzige Ausnahme ist der Abschalter (?nicht-zaehlen), siehe unten.
   Ziel ist /api/e auf derselben Domain (Koch-Plattform, siehe README).
   Fehler hier dürfen die Seite nie stören, deshalb ist alles abgefangen.
   Bewusst sparsam: keine Geräteeigenschaften wie Sprache oder Bildschirmbreite, die Sprache
   leitet der Server aus dem ohnehin gesendeten Accept-Language-Kopf ab. */

const ZIEL = "/api/e";
const STAPEL_MAX = 20;
// Der Server nimmt höchstens 8 kB je Sendung an
const BYTES_MAX = 7500;

function zufallsId(): string {
  const bytes = new Uint8Array(16);
  try {
    crypto.getRandomValues(bytes);
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const id = zufallsId();

/* Eigene Besuche nicht zählen ------------------------------------------------
   ?nicht-zaehlen schaltet die Messung für diesen Browser ab, ?zaehlen wieder an. Gemerkt wird das
   als einziger Eintrag im localStorage — nur auf ausdrücklichen Wunsch, sonst bleibt der Speicher leer. */

const AUS_SCHLUESSEL = "kc-nicht-zaehlen";

function hinweisZeigen(text: string): void {
  const kasten = document.createElement("div");
  kasten.textContent = text;
  kasten.setAttribute("role", "status");
  kasten.style.cssText =
    "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;max-width:calc(100% - 32px);" +
    "padding:10px 16px;border-radius:8px;background:#111;color:#fff;font:14px/1.4 system-ui,sans-serif;" +
    "box-shadow:0 4px 16px rgba(0,0,0,.25)";
  const zeigen = () => {
    document.body.appendChild(kasten);
    window.setTimeout(() => kasten.remove(), 6000);
  };
  if (document.body) zeigen();
  else document.addEventListener("DOMContentLoaded", zeigen, { once: true });
}

function messungAbgeschaltet(): boolean {
  try {
    const adresse = new URL(window.location.href);
    const p = adresse.searchParams;
    if (p.has("nicht-zaehlen") || p.has("zaehlen")) {
      const aus = p.has("nicht-zaehlen");
      if (aus) window.localStorage.setItem(AUS_SCHLUESSEL, "1");
      else window.localStorage.removeItem(AUS_SCHLUESSEL);
      // Schalter aus der Adresse nehmen, damit ein geteilter Link niemanden mit abschaltet
      p.delete("nicht-zaehlen");
      p.delete("zaehlen");
      const rest = p.toString();
      window.history.replaceState(window.history.state, "", adresse.pathname + (rest ? `?${rest}` : "") + adresse.hash);
      hinweisZeigen(
        aus
          ? "Ihre Besuche werden in diesem Browser nicht mehr gezählt."
          : "Ihre Besuche werden in diesem Browser wieder gezählt.",
      );
    }
    return window.localStorage.getItem(AUS_SCHLUESSEL) === "1";
  } catch {
    // Ohne Speicher (privates Fenster, gesperrt) gilt der Wunsch nur für diesen Aufruf
    return new URLSearchParams(window.location.search).has("nicht-zaehlen");
  }
}

const abgeschaltet = messungAbgeschaltet();

/** Zeitpunkt des Seitenstarts in ms seit 1970 */
export const seitenStart: number = Math.round(performance.timeOrigin || Date.now() - performance.now());

/** Zufällige ID dieses Seitenaufrufs (22 Zeichen, base64url) */
export function aufrufId(): string {
  return id;
}

type Ereignis = { t: string; [feld: string]: unknown };

let stapel: Ereignis[] = [];
let zeitgeber = 0;

function senden(ereignisse: Ereignis[]): void {
  const json = JSON.stringify({ ereignisse });
  // Zu groß: halbieren, damit nichts am Größenlimit scheitert
  if (json.length > BYTES_MAX && ereignisse.length > 1) {
    const mitte = Math.ceil(ereignisse.length / 2);
    senden(ereignisse.slice(0, mitte));
    senden(ereignisse.slice(mitte));
    return;
  }
  try {
    // text/plain löst keinen CORS-Vorabcheck aus
    const blob = new Blob([json], { type: "text/plain" });
    if (navigator.sendBeacon?.(ZIEL, blob)) return;
  } catch {
    // weiter mit fetch
  }
  try {
    fetch(ZIEL, {
      method: "POST",
      body: json,
      headers: { "Content-Type": "text/plain" },
      keepalive: true,
      credentials: "omit",
    }).catch(() => {});
  } catch {
    // Ohne Messung geht es auch
  }
}

function leeren(): void {
  window.clearTimeout(zeitgeber);
  zeitgeber = 0;
  if (stapel.length === 0) return;
  const raus = stapel;
  stapel = [];
  senden(raus);
}

function melden(t: string, felder: Record<string, unknown> = {}): void {
  if (abgeschaltet) return;
  try {
    stapel.push({ t, id, ...felder });
    if (stapel.length >= STAPEL_MAX) leeren();
    else if (!zeitgeber) zeitgeber = window.setTimeout(leeren, 4000);
  } catch {
    // ignorieren
  }
}

/* Sichtbare Zeit und Scrolltiefe ------------------------------------------- */

let sichtbarBisher = 0;
let sichtbarSeit: number | null = document.visibilityState === "visible" ? performance.now() : null;
let scrollMax = 0;

function sichtbareZeit(): number {
  return Math.round(sichtbarBisher + (sichtbarSeit === null ? 0 : performance.now() - sichtbarSeit));
}

function scrollMessen(): void {
  const hoehe = document.documentElement.scrollHeight;
  if (!hoehe) return;
  const anteil = Math.round(((window.scrollY + window.innerHeight) / hoehe) * 100);
  scrollMax = Math.max(scrollMax, Math.min(100, Math.max(0, anteil)));
}

function endeMelden(): void {
  scrollMessen();
  melden("ende", { dauer: sichtbareZeit(), scroll: scrollMax });
}

function verstecken(): void {
  if (sichtbarSeit !== null) {
    sichtbarBisher += performance.now() - sichtbarSeit;
    sichtbarSeit = null;
  }
  endeMelden();
  leeren();
}

/* Klicks -------------------------------------------------------------------- */

function kuerzel(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

function klickZiel(element: Element): string | null {
  const href = element.getAttribute("href") ?? "";
  if (href.startsWith("tel:")) return "telefon";
  if (href.startsWith("mailto:")) return "email";
  // Schaltflächen vor Ankern: "Erstgespräch vereinbaren" sagt mehr als "#kontakt"
  if (
    element.classList.contains("knopf") ||
    element.classList.contains("retro-knopf") ||
    element.classList.contains("kopf__kontakt")
  ) {
    const slug = kuerzel(element.textContent ?? "");
    return slug ? `cta:${slug}` : null;
  }
  // Anker auf dieser Seite, auch in der Form "/#check" (Kopfzeile)
  if (href.includes("#")) {
    try {
      const ziel = new URL(href, location.href);
      if (ziel.origin === location.origin && ziel.pathname === location.pathname && ziel.hash.length > 1) {
        return `nav:${ziel.hash}`;
      }
    } catch {
      return null;
    }
  }
  return null;
}

/* Zeitfresser-Check --------------------------------------------------------- */

export type CheckErgebnis = { punkte: string[]; minuten: number; stunden: number; [weitere: string]: unknown };

/** Aktueller Stand des Checks, null solange nichts Auswertbares eingetragen ist */
export function checkErgebnis(): CheckErgebnis | null {
  const formular = document.querySelector<HTMLFormElement>("form[data-check]");
  if (!formular) return null;
  // Neuer Check: schreibt seinen Stand als JSON nach data-ergebnis
  const roh = formular.dataset.ergebnis;
  if (roh) {
    try {
      const daten = JSON.parse(roh) as CheckErgebnis;
      return Array.isArray(daten.punkte) && daten.punkte.length > 0 &&
        (daten.minuten > 0 || daten.stunden > 0 || Number(daten.umsatz) > 0)
        ? daten
        : null;
    } catch {
      return null;
    }
  }
  // Alter Check mit Kreuzen und Zeitstufe
  const punkte = Array.from(formular.querySelectorAll<HTMLInputElement>('input[name="punkt"]:checked')).map(
    (b) => b.value,
  );
  const minuten = Number(formular.querySelector<HTMLInputElement>('input[name="zeit"]:checked')?.value ?? 0);
  if (punkte.length === 0 || !(minuten > 0)) return null;
  return { punkte, minuten, stunden: Math.round((minuten * 220) / 60) };
}

/* Start --------------------------------------------------------------------- */

// Von der Herkunftsseite nur Schema und Domain, nie Pfad oder Suchbegriffe
function herkunft(): string {
  try {
    return document.referrer ? new URL(document.referrer).origin : "";
  } catch {
    return "";
  }
}

function starten(): void {
  const adresse = new URL(window.location.href);
  const p = adresse.searchParams;
  melden("aufruf", {
    pfad: adresse.pathname,
    referrer: herkunft(),
    utm: {
      quelle: p.get("utm_source") ?? "",
      medium: p.get("utm_medium") ?? "",
      kampagne: p.get("utm_campaign") ?? "",
    },
  });
  // Der Aufruf muss vor allen anderen Ereignissen ankommen
  leeren();

  window.addEventListener("scroll", scrollMessen, { passive: true });

  document.addEventListener("visibilitychange", () => {
    try {
      if (document.visibilityState === "hidden") verstecken();
      else if (sichtbarSeit === null) sichtbarSeit = performance.now();
    } catch {
      // ignorieren
    }
  });
  window.addEventListener("pagehide", () => {
    try {
      verstecken();
    } catch {
      // ignorieren
    }
  });
  window.setInterval(() => {
    try {
      if (document.visibilityState === "visible") {
        endeMelden();
        leeren();
      }
    } catch {
      // ignorieren
    }
  }, 30_000);

  // Abschnitte: einmal je ID, wenn 40 % davon oder halber Bildschirm abgedeckt
  if ("IntersectionObserver" in window) {
    const gesehen = new Set<string>();
    const beobachter = new IntersectionObserver(
      (eintraege) => {
        for (const e of eintraege) {
          const ziel = (e.target as HTMLElement).id;
          if (!e.isIntersecting || gesehen.has(ziel)) continue;
          if (e.intersectionRatio >= 0.4 || e.intersectionRect.height >= window.innerHeight * 0.5) {
            gesehen.add(ziel);
            beobachter.unobserve(e.target);
            melden("abschnitt", { ziel });
          }
        }
      },
      { threshold: Array.from({ length: 21 }, (_, i) => i / 20) },
    );
    document.querySelectorAll<HTMLElement>("section[id]").forEach((s) => beobachter.observe(s));
  }

  document.addEventListener(
    "click",
    (event) => {
      try {
        const start = event.target as Element | null;
        if (!start?.closest) return;
        if (start.closest("[data-check-besprechen]")) {
          melden("check_besprechen");
          return;
        }
        // Im Check zählen nur die beiden Beleg-Knöpfe, sonst wäre jedes Antippen ein Klick
        if (start.closest("[data-beleg-ausstellen]")) {
          melden("klick", { ziel: "Zeitfresser: Beleg ausstellen" });
          return;
        }
        if (start.closest("[data-beleg-pdf]")) {
          melden("klick", { ziel: "Zeitfresser: Beleg als PDF" });
          return;
        }
        if (start.closest("form[data-check]")) return;
        const element = start.closest("a, button");
        const ziel = element ? klickZiel(element) : null;
        if (ziel) melden("klick", { ziel });
      } catch {
        // ignorieren
      }
    },
    { capture: true, passive: true },
  );

  const check = document.querySelector<HTMLFormElement>("form[data-check]");
  if (check) {
    let begonnen = false;
    let entprellen = 0;
    let zuletzt = "";
    check.addEventListener("change", () => {
      try {
        if (!begonnen) {
          begonnen = true;
          melden("check_start");
        }
        window.clearTimeout(entprellen);
        entprellen = window.setTimeout(() => {
          const daten = checkErgebnis();
          const json = JSON.stringify(daten);
          if (!daten || json === zuletzt) return;
          zuletzt = json;
          melden("check_fertig", { daten });
        }, 1500);
      } catch {
        // ignorieren
      }
    });
  }

  const anfrage = document.querySelector<HTMLFormElement>("form[data-anfrage]");
  anfrage?.addEventListener(
    "input",
    () => {
      melden("formular_start");
    },
    { once: true },
  );
}

try {
  starten();
} catch {
  // Messung ist verzichtbar
}
