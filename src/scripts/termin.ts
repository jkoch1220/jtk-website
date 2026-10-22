/* Terminbuchung im Kontaktfenster (components/Anfrage.astro).
   Holt freie Zeiten aus dem Website-Dienst (GET {ziel}/frei) und bucht per POST {ziel}. Der Dienst
   prüft alles noch einmal und trägt den Termin in den Google-Kalender ein (Vertrag: website-dienst/API.md
   im Portal-Repo). Liefert er keine Zeiten, bleibt alles beim Anfrageformular aus seite.ts: Umschalter
   und Buchung bleiben unsichtbar. Nichts wird im Browser gespeichert. */

import { aufrufId, seitenStart } from "./tracking";
import { turnstileToken, turnstileVorbereiten, turnstileZuruecksetzen } from "./turnstile";

type TerminOrt = "meet" | "telefon";
type FreieZeit = { start: number; label: string };
type FreierTag = { tag: string; zeiten: FreieZeit[] };
type FreiAntwort = {
  aktiv: boolean;
  dauerMinuten: number;
  orte: TerminOrt[];
  zeitzone: string;
  tage: FreierTag[];
};
type BuchungAntwort = {
  ok?: boolean;
  termin?: { id: string; start: number; ende: number; ort: TerminOrt; meetLink: string | null };
  error?: string;
  fehler?: string;
};

const ZEITZONE = "Europe/Berlin";
const TAGE = 21;
const ZEITLIMIT_MS = 8000;
// Etwas mehr als die Mindestdauer im Dienst (3000 ms), sonst gilt die Buchung als Spam und verfällt still
const MINDESTDAUER_MS = 3200;
// Wie der Dienst (TELEFON_ZIFFERN_MIN in website-dienst/src/oeffentlich/termine.ts)
const TELEFON_ZIFFERN_MIN = 6;
// Wie der Server und das Anfrageformular in seite.ts
const emailMuster = /^[\p{L}\p{N}._+'-]+@(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?\.)+[\p{L}\p{N}-]{2,}$/u;

const datumLang = new Intl.DateTimeFormat("de-DE", {
  timeZone: ZEITZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const uhrzeit = new Intl.DateTimeFormat("de-DE", { timeZone: ZEITZONE, hour: "2-digit", minute: "2-digit" });
// Tagesknöpfe: Der Tag kommt als "YYYY-MM-DD", gerechnet wird mittags UTC, damit kein Zeitzonenwechsel stört
const wochentagKurz = new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", weekday: "short" });
const tagKurz = new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", day: "numeric", month: "short" });
const tagLang = new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

/** Heute in deutscher Zeit als "YYYY-MM-DD" */
function heute(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZEITZONE }).format(new Date());
}

function mittag(tag: string): Date {
  return new Date(`${tag}T12:00:00Z`);
}

/** "Dienstag, 4. November 2026, 08:25 Uhr" */
function zeitpunktText(start: number): string {
  return `${datumLang.format(start)}, ${uhrzeit.format(start)} Uhr`;
}

async function holen(adresse: string, optionen: RequestInit = {}): Promise<Response> {
  const abbruch = new AbortController();
  const zeitgeber = window.setTimeout(() => abbruch.abort(), ZEITLIMIT_MS);
  try {
    return await fetch(adresse, { ...optionen, credentials: "omit", cache: "no-store", signal: abbruch.signal });
  } finally {
    window.clearTimeout(zeitgeber);
  }
}

function terminEinrichten(): void {
  const bereich = document.querySelector<HTMLElement>("[data-termin]");
  const umschalter = document.querySelector<HTMLElement>("[data-termin-umschalter]");
  const anfrage = document.querySelector<HTMLFormElement>("form[data-anfrage]");
  const anfrageDanke = document.querySelector<HTMLElement>("[data-anfrage-danke]");
  const ziel = (bereich?.dataset.ziel ?? "").replace(/\/+$/, "");
  if (!bereich || !umschalter || !anfrage || !ziel) return;

  const formular = bereich.querySelector<HTMLFormElement>("[data-termin-formular]")!;
  const tageListe = bereich.querySelector<HTMLElement>("[data-termin-tage]")!;
  const zeitenListe = bereich.querySelector<HTMLElement>("[data-termin-zeiten]")!;
  const zeitenTitel = bereich.querySelector<HTMLElement>("[data-termin-zeiten-titel]")!;
  const dauerText = bereich.querySelector<HTMLElement>("[data-termin-dauer]")!;
  const orteFeld = bereich.querySelector<HTMLElement>("[data-termin-orte]")!;
  const telefonOptional = bereich.querySelector<HTMLElement>("[data-termin-telefon-optional]")!;
  const ausweg = bereich.querySelector<HTMLElement>("[data-termin-ausweg]")!;
  const auswegText = bereich.querySelector<HTMLElement>("[data-termin-ausweg-text]")!;
  const zumFormular = bereich.querySelector<HTMLButtonElement>("[data-termin-zum-formular]")!;
  const buchenKnopf = bereich.querySelector<HTMLButtonElement>("[data-termin-buchen]")!;
  const danke = bereich.querySelector<HTMLElement>("[data-termin-danke]")!;
  const status = document.querySelector<HTMLElement>("[data-anfrage-status]");
  const reiter = Array.from(umschalter.querySelectorAll<HTMLButtonElement>("[data-termin-modus]"));

  const feld = (name: string) => formular.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement;
  const name = feld("name");
  const firma = feld("firma");
  const mail = feld("email");
  const telefon = feld("telefon");
  const nachricht = feld("nachricht");
  const honig = feld("website");
  const ortKnoepfe = Array.from(formular.querySelectorAll<HTMLInputElement>('input[name="ort"]'));

  let tage: FreierTag[] = [];
  let dauerMinuten = 15;
  let gewaehlterTag = "";
  let gewaehlterStart = 0;
  let modus: "termin" | "nachricht" = "nachricht";
  let sendetGerade = false;
  let gebucht = false;

  const statusSetzen = (text: string) => {
    if (status) status.textContent = text;
  };

  const ort = (): TerminOrt => (ortKnoepfe.find((k) => k.checked)?.value as TerminOrt) ?? "meet";

  /* Umschalter ------------------------------------------------------------ */

  const modusSetzen = (neu: "termin" | "nachricht", fokus = false) => {
    modus = neu;
    reiter.forEach((r) => r.setAttribute("aria-pressed", String(r.dataset.terminModus === neu)));
    bereich.hidden = neu !== "termin";
    // Nach dem Absenden zeigt seite.ts den Dank statt des Formulars, das bleibt so
    anfrage.hidden = neu !== "nachricht" || !(anfrageDanke?.hidden ?? true);
    if (fokus) {
      const erstes =
        neu === "termin"
          ? tageListe.querySelector<HTMLButtonElement>('[aria-pressed="true"]') ?? name
          : (anfrage.elements.namedItem("name") as HTMLInputElement | null);
      erstes?.focus();
    }
  };

  // Hat seite.ts die Anfrage verschickt, gibt es nichts mehr umzuschalten
  let anfrageGesendet = false;
  if (anfrageDanke) {
    new MutationObserver(() => {
      if (!anfrageDanke.hidden) {
        anfrageGesendet = true;
        umschalter.hidden = true;
      }
    }).observe(anfrageDanke, { attributes: true, attributeFilter: ["hidden"] });
  }

  reiter.forEach((r) =>
    r.addEventListener("click", () => {
      const neu = r.dataset.terminModus === "termin" ? "termin" : "nachricht";
      if (neu !== modus) modusSetzen(neu);
    }),
  );

  // Pfeiltasten wie bei Reitern: links/rechts wechselt den Weg
  umschalter.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const jetzt = reiter.indexOf(document.activeElement as HTMLButtonElement);
    if (jetzt < 0) return;
    event.preventDefault();
    const naechster = reiter[(jetzt + (event.key === "ArrowRight" ? 1 : reiter.length - 1)) % reiter.length];
    naechster.focus();
    naechster.click();
  });

  /* Tage und Zeiten ------------------------------------------------------- */

  const knopf = (beschriftung: string, gedrueckt: boolean): HTMLButtonElement => {
    const k = document.createElement("button");
    k.type = "button";
    k.className = "termin__knopf";
    k.setAttribute("aria-pressed", String(gedrueckt));
    k.textContent = beschriftung;
    return k;
  };

  const zeitenZeigen = () => {
    zeitenListe.replaceChildren();
    zeitenListe.removeAttribute("aria-invalid");
    const tag = tage.find((t) => t.tag === gewaehlterTag);
    for (const zeit of tag?.zeiten ?? []) {
      const k = knopf(zeit.label, zeit.start === gewaehlterStart);
      k.dataset.start = String(zeit.start);
      k.setAttribute("aria-label", `${zeit.label} Uhr`);
      k.addEventListener("click", () => {
        gewaehlterStart = zeit.start;
        zeitenListe.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === k)));
        zeitenListe.removeAttribute("aria-invalid");
        statusSetzen(`${zeitpunktText(zeit.start)} gewählt`);
      });
      zeitenListe.append(k);
    }
  };

  const tageZeigen = () => {
    tageListe.replaceChildren();
    for (const tag of tage) {
      const datum = mittag(tag.tag);
      const k = knopf(wochentagKurz.format(datum).replace(/\.$/, ""), tag.tag === gewaehlterTag);
      const unter = document.createElement("small");
      unter.textContent = tagKurz.format(datum);
      k.append(unter);
      k.setAttribute("aria-label", tagLang.format(datum));
      k.addEventListener("click", () => {
        if (gewaehlterTag === tag.tag) return;
        gewaehlterTag = tag.tag;
        gewaehlterStart = 0;
        tageListe.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === k)));
        zeitenZeigen();
      });
      tageListe.append(k);
    }
    zeitenZeigen();
  };

  const orteZeigen = (orte: TerminOrt[]) => {
    for (const k of ortKnoepfe) {
      const erlaubt = orte.includes(k.value as TerminOrt);
      const label = orteFeld.querySelector<HTMLElement>(`[data-termin-ort="${k.value}"]`);
      if (label) label.hidden = !erlaubt;
      k.disabled = !erlaubt;
      if (!erlaubt) k.checked = false;
    }
    if (!ortKnoepfe.some((k) => k.checked)) {
      const erster = ortKnoepfe.find((k) => !k.disabled);
      if (erster) erster.checked = true;
    }
    // Nur ein Weg: keine Wahl anzeigen
    orteFeld.hidden = orte.length < 2;
    telefonPflicht();
  };

  const telefonPflicht = () => {
    const pflicht = ort() === "telefon";
    telefon.required = pflicht;
    telefonOptional.hidden = pflicht;
    if (!pflicht) telefon.removeAttribute("aria-invalid");
  };

  ortKnoepfe.forEach((k) => k.addEventListener("change", telefonPflicht));

  /** Lädt die freien Zeiten. false, wenn es nichts zu buchen gibt. */
  const laden = async (): Promise<boolean> => {
    try {
      const antwort = await holen(`${ziel}/frei?von=${heute()}&tage=${TAGE}`);
      if (!antwort.ok) return false;
      const daten = (await antwort.json()) as FreiAntwort;
      if (!daten?.aktiv || !Array.isArray(daten.tage) || !Array.isArray(daten.orte) || daten.orte.length === 0) {
        return false;
      }
      tage = daten.tage.filter((t) => Array.isArray(t.zeiten) && t.zeiten.length > 0);
      if (tage.length === 0) return false;
      if (Number(daten.dauerMinuten) > 0) dauerMinuten = Number(daten.dauerMinuten);
      dauerText.textContent = `Das Gespräch dauert ${dauerMinuten} Minuten, Uhrzeiten in deutscher Zeit.`;
      // Gewählten Tag und Zeit behalten, wenn es sie noch gibt
      if (!tage.some((t) => t.tag === gewaehlterTag)) gewaehlterTag = tage[0].tag;
      const tag = tage.find((t) => t.tag === gewaehlterTag);
      if (!tag?.zeiten.some((z) => z.start === gewaehlterStart)) gewaehlterStart = 0;
      orteZeigen(daten.orte);
      tageZeigen();
      return true;
    } catch {
      return false;
    }
  };

  /* Ausweg zum Formular --------------------------------------------------- */

  const auswegZeigen = (text: string) => {
    auswegText.textContent = text;
    ausweg.hidden = false;
  };

  // Eingetragenes mitnehmen, damit niemand zweimal tippen muss
  zumFormular.addEventListener("click", () => {
    const paare: [string, string][] = [
      ["name", name.value],
      ["firma", firma.value],
      ["email", mail.value],
      ["telefon", telefon.value],
      ["nachricht", nachricht.value],
    ];
    for (const [schluessel, wert] of paare) {
      const ziel = anfrage.elements.namedItem(schluessel) as HTMLInputElement | HTMLTextAreaElement | null;
      if (ziel && !ziel.value.trim() && wert.trim()) ziel.value = wert;
    }
    modusSetzen("nachricht", true);
  });

  /* Buchen ---------------------------------------------------------------- */

  const pruefen = (): HTMLElement | null => {
    [name, firma, mail, telefon, nachricht, ...ortKnoepfe].forEach((f) => f.removeAttribute("aria-invalid"));
    zeitenListe.removeAttribute("aria-invalid");
    if (!gewaehlterStart) {
      zeitenListe.setAttribute("aria-invalid", "true");
      statusSetzen("Bitte wählen Sie eine Uhrzeit.");
      return zeitenListe.querySelector<HTMLButtonElement>("button") ?? zeitenTitel;
    }
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
    if (ort() === "telefon") {
      const ziffern = telefon.value.replace(/\D/g, "").length;
      if (ziffern < TELEFON_ZIFFERN_MIN) {
        telefon.setAttribute("aria-invalid", "true");
        statusSetzen(
          ziffern === 0
            ? "Bitte tragen Sie Ihre Telefonnummer ein, damit ich Sie anrufen kann."
            : "Bitte prüfen Sie Ihre Telefonnummer.",
        );
        return telefon;
      }
    }
    return null;
  };

  /** Feld zu einer Feldmeldung des Dienstes (400), damit es markiert und fokussiert werden kann */
  const feldZurMeldung = (meldung: string): HTMLElement | null => {
    if (/Uhrzeit/.test(meldung)) return zeitenListe;
    if (/Meet oder Telefon/.test(meldung)) return ortKnoepfe.find((k) => !k.disabled) ?? null;
    if (/Firmen/.test(meldung)) return firma;
    if (/Telefon/.test(meldung)) return telefon;
    if (/E-Mail/.test(meldung)) return mail;
    if (/Nachricht/.test(meldung)) return nachricht;
    if (/Name/.test(meldung)) return name;
    return null;
  };

  const erfolg = (start: number, gewaehlterOrt: TerminOrt, meetLink: string | null) => {
    gebucht = true;
    const zeit = danke.querySelector<HTMLElement>("[data-termin-danke-zeit]");
    const wo = danke.querySelector<HTMLElement>("[data-termin-danke-ort]");
    const an = danke.querySelector<HTMLElement>("[data-termin-danke-mail]");
    if (zeit) zeit.textContent = `${zeitpunktText(start)} (${dauerMinuten} Minuten)`;
    if (wo) {
      wo.replaceChildren();
      if (gewaehlterOrt === "telefon") {
        wo.textContent = `Ich rufe Sie unter ${telefon.value.trim()} an.`;
      } else if (meetLink && /^https:\/\/meet\.google\.com\//.test(meetLink)) {
        wo.append("Google Meet: ");
        const link = document.createElement("a");
        link.href = meetLink;
        link.rel = "noopener";
        link.target = "_blank";
        link.textContent = meetLink.replace(/^https:\/\//, "");
        wo.append(link);
      } else {
        wo.textContent = "Den Link zu Google Meet finden Sie in der Kalendereinladung.";
      }
    }
    if (an) an.textContent = mail.value.trim();
    formular.hidden = true;
    umschalter.hidden = true;
    danke.hidden = false;
    danke.focus();
    statusSetzen("Gebucht");
  };

  const buchen = async () => {
    const start = gewaehlterStart;
    const gewaehlterOrt = ort();
    sendetGerade = true;
    buchenKnopf.disabled = true;
    ausweg.hidden = true;
    statusSetzen("Wird gebucht …");
    let token = "";
    try {
      // Wie im Anfrageformular: lieber kurz warten, als die Buchung als Spam verfallen zu lassen
      const wartezeit = MINDESTDAUER_MS - (Date.now() - seitenStart);
      if (wartezeit > 0) await new Promise((fertig) => window.setTimeout(fertig, wartezeit));
      token = await turnstileToken(formular);

      const antwort = await holen(ziel, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start,
          ort: gewaehlterOrt,
          name: name.value.trim(),
          firma: firma.value.trim(),
          email: mail.value.trim(),
          telefon: telefon.value.trim(),
          nachricht: nachricht.value.trim(),
          website: honig.value,
          // Ohne Query und Hash, wie beim Anfrageformular
          seite: window.location.origin + window.location.pathname,
          aufruf: aufrufId(),
          dauer: Date.now() - seitenStart,
          turnstile: token,
        }),
      });
      const daten = (await antwort.json().catch(() => null)) as BuchungAntwort | null;
      if (antwort.ok) {
        erfolg(daten?.termin?.start ?? start, daten?.termin?.ort ?? gewaehlterOrt, daten?.termin?.meetLink ?? null);
        return;
      }
      const roh = daten?.error ?? daten?.fehler;
      const meldung = typeof roh === "string" ? roh.trim() : "";
      if (antwort.status === 409) {
        gewaehlterStart = 0;
        const nochWas = await laden();
        statusSetzen(meldung || "Dieser Termin ist gerade vergeben worden – bitte wählen Sie einen anderen.");
        if (nochWas) {
          zeitenTitel.focus();
        } else {
          auswegZeigen("Gerade ist kein Termin mehr frei. Schreiben Sie mir gern eine Nachricht.");
          zumFormular.focus();
        }
      } else if (antwort.status === 400 && meldung) {
        statusSetzen(meldung);
        const betroffen = feldZurMeldung(meldung);
        if (betroffen) {
          betroffen.setAttribute("aria-invalid", "true");
          const fokus = betroffen === zeitenListe ? zeitenListe.querySelector("button") ?? zeitenTitel : betroffen;
          fokus.focus();
        }
      } else if (antwort.status === 429) {
        statusSetzen(meldung || "Gerade kommen zu viele Buchungen an.");
        auswegZeigen("Schreiben Sie mir stattdessen eine Nachricht, ich melde mich mit einem Termin.");
      } else {
        statusSetzen("Die Buchung hat nicht geklappt.");
        auswegZeigen(
          meldung || "Die Terminbuchung ist gerade nicht erreichbar – bitte schreiben Sie mir über das Formular.",
        );
      }
    } catch {
      statusSetzen("Die Buchung hat nicht geklappt, vielleicht ist die Verbindung weg.");
      auswegZeigen("Schreiben Sie mir stattdessen eine Nachricht, ich melde mich mit einem Termin.");
    } finally {
      // Das Token gilt nur einmal
      if (token) turnstileZuruecksetzen(formular);
      sendetGerade = false;
      buchenKnopf.disabled = false;
    }
  };

  formular.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sendetGerade || gebucht) return;
    const fehler = pruefen();
    if (fehler) {
      fehler.focus();
      return;
    }
    // Spam-Schutz: Dieses Feld füllen nur Programme aus
    if (honig.value) {
      erfolg(gewaehlterStart, ort(), null);
      return;
    }
    await buchen();
  });

  formular.addEventListener("input", (event) => {
    const element = event.target as HTMLElement;
    if (element.getAttribute("aria-invalid") === "true") element.removeAttribute("aria-invalid");
  });

  // Ergebnis aus dem Zeitfresser-Check: seite.ts füllt das Formular, hier dasselbe für die Buchung
  window.addEventListener("anfrage:vorbelegen", (event) => {
    const block = (event as CustomEvent<string>).detail;
    if (typeof block !== "string" || !block) return;
    const bisher = nachricht.value.replace(/Ergebnis aus dem Zeitfresser-Check:[\s\S]*?Stunden im Jahr\.\n*/u, "").trim();
    nachricht.value = bisher ? `${block}\n\n${bisher}` : block;
    if (modus !== "termin" || gebucht) return;
    // seite.ts scrollt zum Kontakt und will danach ins (hier verborgene) Formular; stattdessen zum Tag
    let erledigt = false;
    const fokus = () => {
      if (erledigt) return;
      erledigt = true;
      tageListe.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
    };
    window.addEventListener("scrollend", fokus, { once: true });
    window.setTimeout(fokus, 1600);
  });

  /* Start ----------------------------------------------------------------- */

  turnstileVorbereiten(formular);

  void laden().then((frei) => {
    // Hat jemand inzwischen schon das Formular abgeschickt oder angefangen, bleibt es dabei
    if (!frei || anfrageGesendet) return;
    const angefangen =
      anfrage.contains(document.activeElement) ||
      ["name", "email", "nachricht"].some((n) => {
        const f = anfrage.elements.namedItem(n) as HTMLInputElement | null;
        return Boolean(f?.value.trim());
      });
    umschalter.hidden = false;
    modusSetzen(angefangen ? "nachricht" : "termin");
  });
}

try {
  terminEinrichten();
} catch {
  // Ohne Buchung bleibt das Anfrageformular
}
