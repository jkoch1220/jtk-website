/* Reichweitenmessung ohne Cookies. Nichts wird im Browser gespeichert: Die
   Aufruf-ID lebt nur im Speicher dieser Seite und ist beim nächsten Laden neu.
   Einzige Ausnahme ist der Abschalter (?nicht-zaehlen), siehe unten.
   Ziel ist /api/e auf derselben Domain (Koch-Plattform, siehe README).
   Fehler hier dürfen die Seite nie stören, deshalb ist alles abgefangen.
   Bewusst sparsam: keine Geräteeigenschaften wie Sprache oder Bildschirmbreite, die Sprache
   leitet der Server aus dem ohnehin gesendeten Accept-Language-Kopf ab. Was Besucher auf der Seite
   tun, melden die Teile selbst über nutzung.ts; hier wird nur gezählt und gebündelt. */

import type { Nutzung } from "./nutzung";

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
  abschnitteAnhalten();
  // Wer gleich nach der letzten Änderung geht, soll seinen Stand trotzdem dalassen
  checkMelden();
  nutzungMelden();
  abschnittZeitMelden();
  endeMelden();
  leeren();
}

/* Nutzung der Seite (nutzung.ts) -------------------------------------------- */
// Je Aufruf ein Stand mit Zählern je „Bereich: Aktion“ statt eines Ereignisses je Klick: Ein
// Stempel-Marathon oder ein langes Spiel im Bergbild verbraucht so weder die Drossel des Dienstes
// (300 je Stunde) noch sein Kontingent je Aufruf.

type Nutzungswert = { n: number; ab: number; wert?: number; detail?: string };
const nutzungen = new Map<string, Nutzungswert>();
// „ab“ zählt ab dem Ereignis aufruf, nicht ab dem Laden: Der Dienst stempelt den Aufruf beim Empfang, so
// stehen die Aktionen im Besuch an der richtigen Stelle zwischen den übrigen Ereignissen
const aufrufStart = performance.now();
// Der Dienst nimmt höchstens 80 Einträge an; 60 halten den Stand sicher unter 8 kB je Sendung, auch mit
// Umlauten und Zusätzen (ein normaler Besuch hat kaum 20)
const NUTZUNG_MAX = 60;
let nutzungOffen = false;
let nutzungZeitgeber = 0;

function nutzungMelden(): void {
  window.clearTimeout(nutzungZeitgeber);
  if (!nutzungOffen) return;
  nutzungOffen = false;
  // Immer der ganze Stand; ein noch nicht gesendeter älterer fliegt aus dem Stapel
  stapel = stapel.filter((e) => e.t !== "nutzung");
  melden("nutzung", { daten: Object.fromEntries(nutzungen) });
}

function nutzungZaehlen(d: Partial<Nutzung> | null | undefined): void {
  if (!d || typeof d.bereich !== "string" || typeof d.aktion !== "string") return;
  const schluessel = `${d.bereich}: ${d.aktion}`;
  let eintrag = nutzungen.get(schluessel);
  if (!eintrag) {
    if (nutzungen.size >= NUTZUNG_MAX) return;
    // ab: Millisekunden seit dem Aufruf beim ersten Mal
    eintrag = { n: 0, ab: Math.max(0, Math.round(performance.now() - aufrufStart)) };
    nutzungen.set(schluessel, eintrag);
  }
  eintrag.n += 1;
  if (typeof d.wert === "number" && Number.isFinite(d.wert) && d.wert >= 0) eintrag.wert = Math.max(eintrag.wert ?? 0, d.wert);
  if (typeof d.detail === "string" && d.detail) eintrag.detail = d.detail.slice(0, 80);
  nutzungOffen = true;
  // Gebündelt: 5 s nach der letzten Aktion, spätestens alle 30 s und beim Verlassen der Seite
  window.clearTimeout(nutzungZeitgeber);
  nutzungZeitgeber = window.setTimeout(nutzungMelden, 5000);
}

/* Sichtbare Zeit je Abschnitt ----------------------------------------------- */
// Läuft, solange ein Abschnitt 40 % seiner Fläche oder den halben Bildschirm füllt (wie „gesehen“)
// und die Seite sichtbar ist. Gesendet beim Verlassen und alle zwei Minuten, nur bei einer Änderung.

const abschnittBisher = new Map<string, number>();
const abschnittSeit = new Map<string, number>();
const abschnittImBild = new Set<string>();
let abschnittGesendet = "";

function abschnittStoppen(id: string, jetzt: number): void {
  const seit = abschnittSeit.get(id);
  if (seit === undefined) return;
  abschnittBisher.set(id, (abschnittBisher.get(id) ?? 0) + jetzt - seit);
  abschnittSeit.delete(id);
}

function abschnitteAnhalten(): void {
  const jetzt = performance.now();
  for (const id of [...abschnittSeit.keys()]) abschnittStoppen(id, jetzt);
}

function abschnitteFortsetzen(): void {
  const jetzt = performance.now();
  for (const id of abschnittImBild) if (!abschnittSeit.has(id)) abschnittSeit.set(id, jetzt);
}

function abschnittZeitMelden(): void {
  const jetzt = performance.now();
  const daten: Record<string, number> = {};
  for (const id of new Set([...abschnittBisher.keys(), ...abschnittSeit.keys()])) {
    const seit = abschnittSeit.get(id);
    const ms = Math.round((abschnittBisher.get(id) ?? 0) + (seit === undefined ? 0 : jetzt - seit));
    if (ms >= 1000) daten[id] = ms;
  }
  // Auf Sekunden verglichen: Ein offener Tab ohne Bewegung schickt nicht ständig dasselbe
  const vergleich = JSON.stringify(Object.entries(daten).map(([id, ms]) => [id, Math.round(ms / 1000)]));
  if (vergleich === abschnittGesendet || Object.keys(daten).length === 0) return;
  abschnittGesendet = vergleich;
  stapel = stapel.filter((e) => e.t !== "abschnitt_zeit");
  melden("abschnitt_zeit", { daten });
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

// Wo ein Knopf oder Link steht, als Bereich der Nutzung: „Erstgespräch vereinbaren“ gibt es im Hero und im
// Ablauf, die Klickziele allein unterscheiden das nicht
const BEREICHE: Record<string, string> = {
  problem: "Problem",
  check: "Check",
  leistungen: "Leistungen",
  "ueber-mich": "Über mich",
  projekte: "Akten",
  ablauf: "Ablauf",
  kontakt: "Kontakt",
};

function bereichVon(element: Element): string {
  if (element.closest("header")) return "Kopf";
  if (element.closest("footer")) return "Fuß";
  const abschnitt = element.closest<HTMLElement>("main > section");
  if (!abschnitt) return "Seite";
  if (abschnitt.classList.contains("hero")) return "Hero";
  return BEREICHE[abschnitt.id] ?? (abschnitt.id || "Seite");
}

// Sichtbarer Text, kurz: Knöpfe und Links der Seite sind feste Wörter, keine Eingaben
const sichtbarerText = (element: Element) => (element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 50);

function klickAktion(ziel: string | null, element: Element): string | null {
  if (ziel === "telefon") return "Telefonnummer angeklickt";
  if (ziel === "email") return "E-Mail-Adresse angeklickt";
  const text = sichtbarerText(element);
  if (ziel?.startsWith("cta:")) return text ? `Knopf „${text}“` : null;
  if (element.tagName === "A") return text ? `Link „${text}“` : null;
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

// Gesendet wird entprellt nach der letzten Änderung, spätestens beim Verlassen der Seite
let checkOffen = false;
let ergebnisZuletzt = "";
let angabenZuletzt = "";

/** Angaben (check_stand, auch ohne Ergebnis) und Ergebnis (check_fertig) melden, wenn sie neu sind */
function checkMelden(): void {
  if (!checkOffen) return;
  checkOffen = false;
  const angaben = document.querySelector<HTMLFormElement>("form[data-check]")?.dataset.angaben;
  if (angaben && angaben !== angabenZuletzt) {
    try {
      const daten: unknown = JSON.parse(angaben);
      angabenZuletzt = angaben;
      // Es zählt nur der neueste Stand: Ein noch nicht gesendeter älterer fliegt aus dem Stapel
      stapel = stapel.filter((e) => e.t !== "check_stand");
      melden("check_stand", { daten });
    } catch {
      // ignorieren
    }
  }
  const daten = checkErgebnis();
  const json = JSON.stringify(daten);
  if (!daten || json === ergebnisZuletzt) return;
  ergebnisZuletzt = json;
  melden("check_fertig", { daten });
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

// Google Ads hängt an jeden Anzeigenklick eine Klick-Kennung (gclid, auf iOS gbraid/wbraid). Gemeldet wird
// nur, dass der Besuch aus einer Anzeige kommt, nie die Kennung selbst. Eigene utm-Angaben haben Vorrang.
function ausAnzeige(p: URLSearchParams): boolean {
  return !p.has("utm_source") && (p.has("gclid") || p.has("gbraid") || p.has("wbraid"));
}

function starten(): void {
  const adresse = new URL(window.location.href);
  const p = adresse.searchParams;
  const anzeige = ausAnzeige(p);
  melden("aufruf", {
    pfad: adresse.pathname,
    referrer: herkunft(),
    utm: {
      quelle: anzeige ? "google" : (p.get("utm_source") ?? ""),
      medium: anzeige ? "cpc" : (p.get("utm_medium") ?? ""),
      kampagne: p.get("utm_campaign") ?? "",
    },
  });
  // Der Aufruf muss vor allen anderen Ereignissen ankommen
  leeren();

  window.addEventListener("scroll", scrollMessen, { passive: true });

  document.addEventListener("visibilitychange", () => {
    try {
      if (document.visibilityState === "hidden") verstecken();
      else {
        if (sichtbarSeit === null) sichtbarSeit = performance.now();
        abschnitteFortsetzen();
      }
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
  let takt = 0;
  window.setInterval(() => {
    try {
      if (document.visibilityState === "visible") {
        nutzungMelden();
        // Abschnittszeiten nur jede vierte Runde (2 Minuten), beim Verlassen ohnehin
        takt += 1;
        if (takt % 4 === 0) abschnittZeitMelden();
        endeMelden();
        leeren();
      }
    } catch {
      // ignorieren
    }
  }, 30_000);

  document.addEventListener("nutzung", (event) => {
    try {
      nutzungZaehlen((event as CustomEvent<Partial<Nutzung>>).detail);
    } catch {
      // ignorieren
    }
  });

  // Einzelne Elemente „gesehen“ (data-gesehen="Bereich: Aktion"), einmal je Aufruf, wenn die Hälfte davon
  // oder der halbe Bildschirm gefüllt ist — feiner als die Abschnitte, etwa das Bergbild im Abschnitt „Über mich“
  if ("IntersectionObserver" in window) {
    const blick = new IntersectionObserver(
      (eintraege) => {
        for (const e of eintraege) {
          if (!e.isIntersecting) continue;
          if (e.intersectionRatio < 0.5 && e.intersectionRect.height < window.innerHeight * 0.5) continue;
          blick.unobserve(e.target);
          const [bereich, ...aktion] = ((e.target as HTMLElement).dataset.gesehen ?? "").split(": ");
          if (bereich && aktion.length) nutzungZaehlen({ bereich, aktion: aktion.join(": ") });
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    document.querySelectorAll<HTMLElement>("[data-gesehen]").forEach((el) => blick.observe(el));
  }

  // Abschnitte: „gesehen“ einmal je ID, wenn 40 % davon oder halber Bildschirm abgedeckt; solange das
  // so bleibt und die Seite sichtbar ist, läuft die Zeit des Abschnitts
  if ("IntersectionObserver" in window) {
    const gesehen = new Set<string>();
    const beobachter = new IntersectionObserver(
      (eintraege) => {
        const jetzt = performance.now();
        for (const e of eintraege) {
          const ziel = (e.target as HTMLElement).id;
          const imBild =
            e.isIntersecting && (e.intersectionRatio >= 0.4 || e.intersectionRect.height >= window.innerHeight * 0.5);
          if (!imBild) {
            abschnittImBild.delete(ziel);
            abschnittStoppen(ziel, jetzt);
            continue;
          }
          abschnittImBild.add(ziel);
          if (document.visibilityState === "visible" && !abschnittSeit.has(ziel)) abschnittSeit.set(ziel, jetzt);
          if (!gesehen.has(ziel)) {
            gesehen.add(ziel);
            melden("abschnitt", { ziel });
          }
        }
      },
      { threshold: Array.from({ length: 21 }, (_, i) => i / 20) },
    );
    // Nur die Abschnitte der Seite, nicht Bereiche in ihnen (etwa in den Akten)
    document.querySelectorAll<HTMLElement>("main > section[id]").forEach((s) => beobachter.observe(s));
  }

  let heroGestempelt = false;
  document.addEventListener(
    "beleg:feierabend",
    () => {
      melden("klick", { ziel: "Hero: alle Akten abgelegt" });
    },
    { once: true },
  );

  // Akteneinsicht (06): als Klickziel je Aufruf einmal je Akte. Blättern, Lesezeit, Lupe und Schließen
  // meldet der Lesetisch selbst als Nutzung (praxis-lesetisch.ts, Bereich „Akten“).
  const praxis = (ereignis: string, ziel: (d: Record<string, string>) => string) =>
    document.addEventListener(ereignis, (e) => melden("klick", { ziel: ziel((e as CustomEvent<Record<string, string>>).detail ?? {}) }));
  praxis("praxis:aufgeschlagen", (d) => `Praxis: Akte ${d.nr} aufgeschlagen`);
  praxis("praxis:ende", (d) => `Praxis: Akte ${d.nr} bis zum Ende`);
  praxis("praxis:lupe", () => "Praxis: Bild groß");
  praxis("praxis:verweis", (d) => `Praxis: Querverweis nach Akte ${d.nr}`);

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
        // Hero-Stempel: nur der erste je Aufruf, sonst wäre jede Akte ein eigener Klick
        if (start.closest("[data-beleg-stempeln]")) {
          if (!heroGestempelt) {
            heroGestempelt = true;
            melden("klick", { ziel: "Hero: erste Akte gestempelt" });
          }
          return;
        }
        // Akteneinsicht: Erstgespräch mit Aktennummer; Aufschlagen, Blättern und Lupe meldet der
        // Lesetisch selbst (praxis:* und nutzung), Klicks im Dialog zählen sonst nicht
        const erstgespraech = start.closest<HTMLElement>("[data-erstgespraech]");
        if (erstgespraech) {
          melden("klick", { ziel: `Praxis: Erstgespräch aus Akte ${erstgespraech.dataset.erstgespraech}` });
          nutzungZaehlen({ bereich: "Akten", aktion: `Erstgespräch aus Akte ${erstgespraech.dataset.erstgespraech}` });
          return;
        }
        if (start.closest("[data-praxis-dialog], [data-akte-oeffnen], .akte__abzug, .akte__fenster")) return;
        // Nachtmodus: Base.astro schaltet erst nach diesem Capture-Handler um, data-theme ist noch der alte Wert
        if (start.closest("[data-modus-schalter]")) {
          const dunkel = document.documentElement.dataset.theme === "dark";
          nutzungZaehlen({ bereich: "Design", aktion: dunkel ? "hell geschaltet" : "dunkel geschaltet" });
          return;
        }
        // Problem-Schreibtisch: Seine Knöpfe zählt meldungen.ts selbst, nur wirksame (nicht die auf hängende
        // Fenster); als Klickziel wäre jedes „OK“ ein eigenes Ereignis. Links (zum Check) zählen wie überall.
        if (start.closest("[data-meldungen]") && !start.closest("a")) return;
        // Was seine Nutzung selbst meldet: Ton, Neu zeichnen, Termin- und Anfrageformular
        if (start.closest("[data-ton-schalter], [data-berge-neu], [data-termin], form[data-anfrage]")) {
          const element = start.closest("a, button");
          const ziel = element ? klickZiel(element) : null;
          if (ziel) melden("klick", { ziel });
          return;
        }
        const element = start.closest("a, button");
        if (!element) return;
        const ziel = klickZiel(element);
        if (ziel) melden("klick", { ziel });
        const aktion = klickAktion(ziel, element);
        if (aktion) nutzungZaehlen({ bereich: bereichVon(element), aktion });
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
    check.addEventListener("change", () => {
      try {
        if (!begonnen) {
          begonnen = true;
          melden("check_start");
        }
        checkOffen = true;
        window.clearTimeout(entprellen);
        entprellen = window.setTimeout(checkMelden, 1500);
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
