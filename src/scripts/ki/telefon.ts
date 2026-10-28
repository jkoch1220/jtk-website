/* Programm 3 im Abschnitt 07: Probeanruf -----------------------------------------------------------------------
   Besucher rufen bei einem erfundenen Betrieb an: Wählen, Klingeln, Abheben, dann führt ein KI-Telefonassistent das
   Gespräch (höchstens fünf Antworten), daneben füllt sich die Telefonnotiz.
   - Wählen und Klingeln spielt nur die Seite, ohne Aufruf. Beim Abheben wird einmal festgelegt, welche Begrüßung gilt
     (begruessungsVariante, Ortszeit Europe/Berlin). Genau diese Variante geht im ersten Zug an den Dienst: Sein
     System-Prompt erzählt, wie der Anruf angenommen wurde, und muss zur gezeigten Begrüßung passen, auch wenn das
     Gespräch über 16:30 Uhr hinaus dauert.
   - Die Begrüßung mit dem KI-Satz steht fest in data/ki-demos.ts und kommt nie vom Modell.
   - Vorlesen (sprache.ts): Bietet der Dienst seine Stimme an und ist sie beim Einschalten angekündigt, spricht sie
     die Begrüßung und jede Antwort, zu der event: fertig ein Token bringt (stimme.ts); sonst und bei jedem Fehler die
     Computerstimme des Geräts. Bei Ton aus spricht keine von beiden.
   - Erster Zug { betrieb, variante, text } mit Turnstile, weitere { sitzung, text } ohne. Das Token aus event: start
     lebt nur in dieser Variable, nie im Browser-Speicher. Soll die Stimme des Dienstes die Antwort sprechen (Vorlesen
     mit ihr an, Ton an), steht im Zug zusätzlich vorlesen: true; nur dann hält der Dienst den Antworttext bereit und
     schickt ein Token.
   - Ein gescheiterter Zug steht beim Dienst nicht im Verlauf. Deshalb verschwinden auch hier seine Sprechblasen, der
     Satz steht wieder im Feld, und die Notiz zeigt wieder den letzten fertigen Stand.
   - Zustände, Fehler, Zeitlimits, Rest und Anhalten übernimmt demoSteuerung (anzeige.ts). Dieses Modul folgt ihr über
     data-ki-zustand am Panel; die Phase des Anrufs steht als data-ki-telefon am Fenster, ki-telefon.css blendet
     danach ein und aus.
   - Gemessen werden nur feste Wörter (README, „Nutzung der Seite“), nie Sätze, Antworten oder Felder der Notiz. */

import { nutzung } from "../nutzung";
import { spiele } from "../klang";
import { mitJahr } from "../../data/akten";
import {
  BETRIEBE,
  HINWEISE,
  TELEFON,
  TELEFONNOTIZ,
  begruessungsVariante,
  istBetriebId,
  type BetriebId,
  type Dringlichkeit,
  type Kategorie,
  type Satz,
  type TicketStatus,
  type Variante,
} from "../../data/ki-demos";
import { demoSteuerung, minutenUhr, ruhig, schreiben, sofort } from "./anzeige";
import { spracheEinrichten, vorlesenEinrichten } from "./sprache";
import { antwortAbruf, begruessungAbruf } from "./stimme";
import { MESSBEREICH, jsonObjekt, jsonText, jsonWahr, kiStatus, type FehlerCode } from "./verbindung";

const BEREICH = MESSBEREICH.telefon;
type Aktion = "Anruf gestartet" | "Satz gewählt" | "eigener Satz gesendet" | "Ticket fertig" | "Gespräch beendet";
type Ende = "aufgelegt" | "Höchstzahl erreicht" | "vom Assistenten beendet";
// Nur feste Wörter; Wechselndes in detail (aus festen Listen) oder wert, nie Sätze, Antworten oder Felder der Notiz
const melde = (aktion: Aktion, extra?: { wert?: number; detail?: string }) => nutzung(BEREICH, aktion, extra);

// detail von „Ticket fertig“ aus der Dringlichkeit des Dienstes; „offen“ meldet keins
const TICKET_DETAIL: Partial<Record<Dringlichkeit, string>> = { notfall: "Notfall", dringend: "dringend", normal: "normal" };

/** Phasen des Anrufs, am Fenster als data-ki-telefon */
type Phase = "frei" | "waehlt" | "klingelt" | "verbunden" | "ende";

// Wählfolge im Abstand der Tastentöne, dann ein Takt Freiton (Ton 0,01 bis 1,01 s, klang-rezepte.ts); erst danach
// hebt der Assistent ab
const TASTE_S = 0.11;
const VOR_DEM_KLINGELN_MS = 300;
const FREITON_MS = 1200;
// Nach dem letzten Satz des Assistenten: so lange stehen lassen, bevor er auflegt; mit Vorlesen, bis die Stimme
// fertig ist, aber nicht ewig
const AUSKLANG_MS = 1200;
const VORLESEN_HOECHSTENS_MS = 30_000;

// Der System-Prompt des Dienstes lässt Telefonnummern normal schreiben und sagt dem Modell, dass die Seite sie fürs
// Vorlesen trennt. Ziffernfolgen ab sechs Ziffern spricht die Stimme deshalb Ziffer für Ziffer, Gruppen mit kurzer
// Pause („0 1 7 6, 0 4 0 6 …“), statt „vier Millionen …“. Angezeigt wird die Antwort unverändert. Für seine eigene
// Stimme bereitet der Dienst den Text nach derselben Regel auf; ändert sie sich hier, dort mitziehen.
const fuersVorlesen = (text: string): string =>
  text.replace(/\d[\d ]{4,}\d/g, (folge) =>
    folge.replace(/ /g, "").length < 6
      ? folge
      : folge
          .split(/ +/)
          .map((gruppe) => gruppe.split("").join(" "))
          .join(", "),
  );

interface Notiz {
  anrufer: string;
  rueckruf: string;
  adresse: string;
  anliegen: string;
  kategorie: Kategorie;
  dringlichkeit: Dringlichkeit;
  naechsterSchritt: string;
  status: TicketStatus;
}

const TEXTFELDER = ["anrufer", "rueckruf", "adresse", "anliegen", "naechsterSchritt"] as const;
type TextFeld = (typeof TEXTFELDER)[number];

const LEERE_NOTIZ: Notiz = {
  anrufer: "",
  rueckruf: "",
  adresse: "",
  anliegen: "",
  kategorie: "sonstiges",
  dringlichkeit: "offen",
  naechsterSchritt: "",
  status: "unvollstaendig",
};

/** Schlüssel einer festen Liste, sonst null (halbe Wörter aus einem Teilstand, Unbekanntes) */
function schluessel<T extends string>(liste: Record<T, string>, wert: unknown): T | null {
  if (typeof wert !== "string") return null;
  return (Object.keys(liste) as T[]).find((k) => k === wert) ?? null;
}

/**
 * Ticket aus einem Ergebnis über den bisherigen Stand legen. Der Dienst schickt jedes Mal das ganze Ticket; im
 * Teilstand fehlen Felder noch oder stehen halb da. Fehlt ein Feld, gilt der bisherige Wert, ebenso für halbe Wörter
 * in den Listenfeldern.
 */
function notizLesen(ergebnis: unknown, basis: Notiz): Notiz {
  const t = jsonObjekt(ergebnis, "ticket");
  const text = (feld: TextFeld): string => {
    const wert = t[feld];
    return typeof wert === "string" ? wert : basis[feld];
  };
  return {
    anrufer: text("anrufer"),
    rueckruf: text("rueckruf"),
    adresse: text("adresse"),
    anliegen: text("anliegen"),
    kategorie: schluessel(TELEFONNOTIZ.kategorien, t.kategorie) ?? basis.kategorie,
    dringlichkeit: schluessel(TELEFONNOTIZ.dringlichkeiten, t.dringlichkeit) ?? basis.dringlichkeit,
    naechsterSchritt: text("naechsterSchritt"),
    status: schluessel(TELEFONNOTIZ.status, t.status) ?? basis.status,
  };
}

// Datum und Uhrzeit des Anrufs in der Ortszeit des Betriebs, wie die Begrüßung
const DATUM = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });
const UHRZEIT = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const jahrInBerlin = (zeit: Date): number =>
  Number(DATUM.formatToParts(zeit).find((t) => t.type === "year")?.value ?? zeit.getFullYear());

interface Anruf {
  betrieb: BetriebId;
  /** Beim Abheben festgelegt, gilt für das ganze Gespräch */
  variante: Variante;
  /** Aus event: start des ersten Zugs; null, solange der Dienst noch kein Gespräch kennt */
  sitzung: string | null;
  /** Nummer des zuletzt begonnenen Zugs, wie der Dienst zählt (auch gescheiterte Züge zählen) */
  zug: number;
  zuegeRest: number | null;
  /** Fertige Antworten des Assistenten */
  antworten: number;
  beginn: number;
  /** Letzter fertiger Stand der Notiz; Teilstände zeichnen nur darüber */
  notiz: Notiz;
  stempel: "notfall" | "sonst" | null;
  notfallGemeldet: boolean;
  ticketGemeldet: boolean;
  benutzt: Set<string>;
  /** Der Assistent hat sich verabschiedet oder die Höchstzahl ist erreicht: gleich wird aufgelegt */
  endet: Ende | null;
  vorbei: boolean;
  /** Statusleiste und Ansage nach dem Auflegen (die Steuerung überschreibt sie beim Anhalten eines Zugs) */
  endStand: string;
  endAnsage: string;
}

export function einrichten(panel: HTMLElement): void {
  const pflicht = <T extends Element>(wahl: string): T => {
    const element = panel.querySelector<T>(wahl);
    if (!element) throw new Error(`Probeanruf: ${wahl} fehlt im Markup`);
    return element;
  };
  const fenster = pflicht<HTMLElement>("[data-ki-telefon]");
  const feld = pflicht<HTMLInputElement>("input[data-ki-eingabe]");
  const anrufenKnopf = pflicht<HTMLButtonElement>("[data-ki-telefon-anrufen]");
  const auflegenKnopf = pflicht<HTMLButtonElement>("[data-ki-telefon-auflegen]");
  const sagenKnopf = pflicht<HTMLButtonElement>("[data-ki-start]");
  const nochmalKnopf = pflicht<HTMLButtonElement>("[data-ki-telefon-nochmal]");
  const verlauf = pflicht<HTMLOListElement>("[data-ki-verlauf]");
  const zeileOrt = pflicht<HTMLElement>("[data-ki-telefon-zeile]");
  const anschlussOrt = pflicht<HTMLElement>("[data-ki-telefon-anschluss]");
  const satzHinweis = pflicht<HTMLElement>("[data-ki-telefon-satzhinweis]");
  const endText = pflicht<HTMLElement>("[data-ki-telefon-endtext]");
  const grenzeOrt = pflicht<HTMLElement>("[data-ki-telefon-grenze]");
  const vorgangOrt = pflicht<HTMLElement>("[data-ki-notiz-vorgang]");
  const datumOrt = pflicht<HTMLElement>("[data-ki-notiz-datum]");
  const uhrzeitOrt = pflicht<HTMLElement>("[data-ki-notiz-uhrzeit]");
  const dauerZeile = pflicht<HTMLElement>("[data-ki-notiz-dauer]");
  const dauerOrt = pflicht<HTMLElement>("[data-ki-notiz-dauerwert]");
  const fussOrt = pflicht<HTMLElement>("[data-ki-notiz-fuss]");
  const stempel = pflicht<SVGSVGElement>("[data-ki-notiz-stempel]");
  const stempelOben = pflicht<SVGTextElement>("[data-ki-stempel-oben]");
  const stempelUnten = pflicht<SVGTextElement>("[data-ki-stempel-unten]");
  const stempelText = pflicht<HTMLElement>("[data-ki-stempel-text]");
  const zuegeOrt = panel.querySelector<HTMLElement>("[data-ki-zuege]");
  const betriebe = Array.from(panel.querySelectorAll<HTMLInputElement>('input[name="betrieb"]'));
  const chips = Array.from(panel.querySelectorAll<HTMLButtonElement>("[data-ki-satz]"));
  const feldOrte = new Map<string, HTMLElement>();
  for (const ort of panel.querySelectorAll<HTMLElement>("[data-ki-notiz-feld]")) {
    if (ort.dataset.kiNotizFeld) feldOrte.set(ort.dataset.kiNotizFeld, ort);
  }

  let phase: Phase = "frei";
  let anruf: Anruf | null = null;
  let uhren: number[] = [];
  let sekundenUhr = 0;
  let perTastatur = false;
  let gewaehlterSatz: Satz | null = null;
  // Was in den Feldern der Notiz steht (Ziel des Schreibens), je Feld
  const gezeigt = new Map<string, string>();
  let zuegeGesamt: number = TELEFON.grenzen.zuege;

  const dauerSekunden = (a: Anruf) => (performance.now() - a.beginn) / 1000;
  const verbundenText = () => (anruf && phase === "verbunden" ? TELEFON.verbunden(minutenUhr(dauerSekunden(anruf))) : HINWEISE.bereit);

  const demo = demoSteuerung(panel, {
    demo: "telefon",
    laufText: TELEFON.antwortet,
    sekundenZeigen: false,
    // Die Statusleiste zeigt während des Gesprächs dessen Dauer (statusZeigen), nicht die Zeit eines Zugs
    fertigText: () => verbundenText(),
    feldBeiFehler: () => feld,
  });

  const sprache = spracheEinrichten({
    demo: "telefon",
    knopf: pflicht<HTMLButtonElement>("[data-ki-sprache]"),
    feld,
    hinweisOrt: pflicht<HTMLElement>("[data-ki-sprache-hinweis]"),
    zeile: panel.querySelector<HTMLElement>("[data-ki-sprache-zeile]"),
  });
  const vorlesenSchalter = panel.querySelector<HTMLButtonElement>("[data-ki-vorlesen]");
  const vorlesen = vorlesenSchalter
    ? vorlesenEinrichten(vorlesenSchalter, {
        demo: "telefon",
        hinweise: {
          geraet: pflicht<HTMLElement>("[data-ki-vorlesen-geraet]"),
          dienst: pflicht<HTMLElement>("[data-ki-vorlesen-dienst]"),
        },
      })
    : null;

  void kiStatus().then((s) => (zuegeGesamt = s.telefonZuege ?? zuegeGesamt));

  /* Anzeige ------------------------------------------------------------------------------------------------- */

  // Liegt der Fokus im Fenster (oder ist er mit einem verborgenen Teil auf body gefallen), darf ihn ein Phasenwechsel
  // weitergeben; sonst bleibt er, wo Besucher ihn hingesetzt haben
  const fokusHier = () => document.activeElement === document.body || fenster.contains(document.activeElement);

  // Ein fokussierter Knopf wird nur als gesperrt markiert, sonst fiele der Fokus auf body
  const sperren = (knopf: HTMLButtonElement, gesperrt: boolean) => {
    if (gesperrt && document.activeElement === knopf) {
      knopf.disabled = false;
      knopf.setAttribute("aria-disabled", "true");
    } else {
      knopf.disabled = gesperrt;
      knopf.removeAttribute("aria-disabled");
    }
  };

  const statusZeigen = () => {
    if (phase !== "verbunden") return;
    const zustand = demo.zustand();
    // Sicherheitsprüfung und Fehler sagt die Steuerung selbst an
    if (zustand === "bereit" || zustand === "laeuft" || zustand === "fertig") demo.stand(verbundenText());
  };

  // Folgt der Steuerung: Anrufen und Sätze nur, wenn ein Lauf beginnen darf; Statusleiste mit der Dauer
  const oberflaeche = () => {
    const zustand = demo.zustand();
    const darf = demo.kannStarten();
    anrufenKnopf.hidden = zustand === "aus";
    sperren(anrufenKnopf, !(darf && phase === "frei"));
    const saetzeAn = darf && phase === "verbunden" && anruf !== null && anruf.endet === null;
    for (const chip of chips) chip.setAttribute("aria-disabled", String(!saetzeAn));
    verlauf.setAttribute("aria-busy", String(zustand === "laeuft"));
    statusZeigen();
  };

  const phaseSetzen = (neu: Phase) => {
    phase = neu;
    fenster.dataset.kiTelefon = neu;
    if (neu !== "verbunden") {
      window.clearInterval(sekundenUhr);
      sekundenUhr = 0;
    }
    oberflaeche();
  };

  const zuegeZeigen = () => {
    if (zuegeOrt) zuegeOrt.textContent = anruf && anruf.zug > 0 ? TELEFON.zug(anruf.zug, zuegeGesamt) : "";
  };

  const uhrenStoppen = () => {
    uhren.forEach((uhr) => window.clearTimeout(uhr));
    uhren = [];
  };
  const spaeter = (ms: number, arbeit: () => void) => {
    uhren.push(window.setTimeout(arbeit, ms));
  };

  /* Verlauf ------------------------------------------------------------------------------------------------ */

  // Am Ende bleiben, solange Besucher nicht selbst nach oben gescrollt haben; auch während eine Antwort wächst.
  // Als Hochscrollen zählt nur ein kleinerer Scrollstand kurz nach einer Bedienung im Verlauf (Rad, Finger, Zeiger,
  // Taste). Das Ereignis zum eigenen Sprung ans Ende kommt oft erst, wenn die Antwort schon weiter gewachsen ist, und
  // WebKit setzt den Stand gelegentlich selbst zurück (wenn der Schreibcursor verschwindet); beides heftet wieder an.
  let amEnde = true;
  let letzterStand = 0;
  let bedient = -Infinity;
  const ansEnde = () => {
    if (amEnde) verlauf.scrollTop = verlauf.scrollHeight;
  };
  const wachsen = new ResizeObserver(ansEnde);
  for (const art of ["wheel", "touchstart", "pointerdown", "keydown"] as const) {
    verlauf.addEventListener(art, () => (bedient = performance.now()), { passive: true });
  }
  verlauf.addEventListener(
    "scroll",
    () => {
      const stand = verlauf.scrollTop;
      if (stand < letzterStand - 2) {
        if (performance.now() - bedient < 1500) amEnde = false;
        else if (amEnde) {
          verlauf.scrollTop = verlauf.scrollHeight;
          letzterStand = verlauf.scrollTop;
          return;
        }
      }
      if (verlauf.scrollHeight - stand - verlauf.clientHeight < 32) amEnde = true;
      letzterStand = stand;
    },
    { passive: true },
  );

  /** Neue Sprechblase; gibt den Textbehälter zurück */
  const sprechblase = (wer: "assistent" | "besucher", text: string): HTMLElement => {
    const eintrag = document.createElement("li");
    eintrag.className = `ki-telefon__zug ki-telefon__zug--${wer === "assistent" ? "ki" : "sie"}`;
    const kopf = document.createElement("span");
    kopf.className = "ki-telefon__wer";
    kopf.textContent = TELEFON.sprecher[wer];
    // Vorleser machen sonst aus Sprecher und Satz ein Wort
    const trenner = document.createElement("span");
    trenner.className = "sr-only";
    trenner.textContent = ":";
    kopf.append(trenner);
    const blase = document.createElement("p");
    blase.className = "ki-telefon__blase ki-text";
    blase.textContent = text;
    eintrag.append(kopf, blase);
    verlauf.append(eintrag);
    verlauf.hidden = false;
    wachsen.observe(eintrag);
    amEnde = true;
    ansEnde();
    return blase;
  };

  const blaseEntfernen = (blase: HTMLElement) => {
    const eintrag = blase.closest("li");
    if (!eintrag) return;
    wachsen.unobserve(eintrag);
    eintrag.remove();
  };

  /* Sätze -------------------------------------------------------------------------------------------------- */

  const satzVon = (id: string | undefined): Satz | null => {
    if (!anruf || !id) return null;
    const b = BETRIEBE[anruf.betrieb];
    return [...b.saetze, ...b.folgesaetze].find((s) => s.id === id) ?? null;
  };

  // Vor der ersten Antwort die vier Anfänge, danach die Folgesätze; Gesagtes verschwindet
  const saetzeZeigen = () => {
    const art = anruf && anruf.antworten > 0 ? "folge" : "anfang";
    const fokus = document.activeElement;
    let fokusWeg = false;
    for (const chip of chips) {
      const zeigen =
        anruf !== null &&
        chip.dataset.kiBetrieb === anruf.betrieb &&
        chip.dataset.kiSatzart === art &&
        !anruf.benutzt.has(chip.dataset.kiSatz ?? "");
      if (!zeigen && chip === fokus) fokusWeg = true;
      chip.hidden = !zeigen;
    }
    if (fokusWeg) feld.focus({ preventScroll: true });
  };

  /* Telefonnotiz ------------------------------------------------------------------------------------------- */

  const leerZeigen = (ort: HTMLElement) => {
    sofort(ort, TELEFONNOTIZ.leer);
    ort.classList.add("ki-telefon__offen");
    ort.classList.remove("ki-telefon__frisch");
  };

  // Einmal gelb hinterlegen (CSS, endlich) und leise einrasten lassen
  const neuGefuellt = (ort: HTMLElement) => {
    ort.classList.remove("ki-telefon__frisch");
    void ort.offsetWidth;
    ort.classList.add("ki-telefon__frisch");
    spiele("klick", { variante: "rast" });
  };

  const textfeld = (name: TextFeld, wert: string, endgueltig: boolean) => {
    const ort = feldOrte.get(name);
    if (!ort) return;
    const bisher = gezeigt.get(name) ?? "";
    // fertig ist maßgeblich: eine noch laufende Schreibmaschine springt ans Ziel
    if (endgueltig && wert === bisher && wert && ort.textContent !== wert) sofort(ort, wert);
    // Jeder Zug schreibt das ganze Ticket neu. Was schon dasteht, bleibt stehen, statt bei jedem Zug von vorn zu
    // wachsen; erst ein abweichender oder längerer Stand ersetzt es, fertig immer
    if (wert === bisher || (!endgueltig && bisher.startsWith(wert))) return;
    gezeigt.set(name, wert);
    if (!wert) {
      leerZeigen(ort);
      return;
    }
    if (!bisher) {
      ort.classList.remove("ki-telefon__offen");
      sofort(ort, "");
      neuGefuellt(ort);
    }
    if (endgueltig) sofort(ort, wert);
    else schreiben(ort, wert);
  };

  const listenfeld = (name: "kategorie" | "status", text: string, markieren: boolean) => {
    const ort = feldOrte.get(name);
    if (!ort || gezeigt.get(name) === text) return;
    const bisher = gezeigt.get(name) ?? "";
    gezeigt.set(name, text);
    if (!text) {
      leerZeigen(ort);
      return;
    }
    ort.classList.remove("ki-telefon__offen");
    sofort(ort, text);
    if (!bisher && markieren) neuGefuellt(ort);
  };

  // Immer als Wort, nie nur über die Farbe; NOTFALL rot und blinkend (CSS), dazu einmal je Anruf „achtung“
  const dringlichkeitZeigen = (stufe: Dringlichkeit) => {
    const ort = feldOrte.get("dringlichkeit");
    if (!ort || gezeigt.get("dringlichkeit") === stufe) return;
    gezeigt.set("dringlichkeit", stufe);
    if (stufe === "offen") {
      leerZeigen(ort);
      return;
    }
    const marke = document.createElement("span");
    marke.className = `ki-tag ki-telefon__stufe${stufe === "notfall" ? " ki-tag--rot" : stufe === "dringend" ? " ki-tag--gelb" : ""}`;
    marke.textContent = TELEFONNOTIZ.dringlichkeiten[stufe];
    ort.classList.remove("ki-telefon__offen", "ki-telefon__frisch");
    ort.replaceChildren(marke);
    if (stufe === "notfall" && anruf && !anruf.notfallGemeldet) {
      anruf.notfallGemeldet = true;
      spiele("achtung");
    }
  };

  const notizZeigen = (n: Notiz, endgueltig: boolean) => {
    for (const name of TEXTFELDER) textfeld(name, n[name], endgueltig);
    // „Sonstiges“ ohne Anliegen ist nur der Anfangswert des Dienstes
    const kategorieBekannt = n.anliegen !== "" || n.kategorie !== "sonstiges";
    listenfeld("kategorie", kategorieBekannt ? TELEFONNOTIZ.kategorien[n.kategorie] : "", true);
    dringlichkeitZeigen(n.dringlichkeit);
    listenfeld("status", TELEFONNOTIZ.status[n.status], false);
  };

  const stempelSetzen = (a: Anruf, art: "notfall" | "sonst" | null) => {
    if (art === a.stempel) return;
    a.stempel = art;
    if (!art) {
      stempel.setAttribute("hidden", "");
      stempelText.textContent = "";
      return;
    }
    const s = TELEFONNOTIZ.stempel[art];
    stempelOben.textContent = s.oben;
    stempelUnten.textContent = s.unten;
    stempel.classList.toggle("ki-telefon__stempel--rot", s.rot);
    stempel.removeAttribute("hidden");
    // Neu setzen, damit der Stempel auch beim zweiten Mal landet (stempeln aus global.css)
    stempel.classList.remove("ki-telefon__gestempelt");
    void stempel.getBoundingClientRect();
    stempel.classList.add("ki-telefon__gestempelt");
    stempelText.textContent = TELEFONNOTIZ.stempelText(s);
    spiele("stempel", { in: ruhig() ? 0 : 0.2, einzeln: true });
  };

  const notizLeeren = () => {
    for (const ort of feldOrte.values()) leerZeigen(ort);
    gezeigt.clear();
    vorgangOrt.textContent = mitJahr(TELEFONNOTIZ.vorgang, jahrInBerlin(new Date()));
    datumOrt.textContent = TELEFONNOTIZ.ohneWert;
    uhrzeitOrt.textContent = TELEFONNOTIZ.ohneWert;
    dauerZeile.hidden = true;
    dauerOrt.textContent = "";
    fussOrt.textContent = "";
    stempel.setAttribute("hidden", "");
    stempel.classList.remove("ki-telefon__gestempelt", "ki-telefon__stempel--rot");
    stempelText.textContent = "";
  };

  // Ein neuer Anruf ist ein neuer Vorgang: Verlauf und Notiz des letzten Gesprächs gehen weg
  const allesLeeren = () => {
    uhrenStoppen();
    wachsen.disconnect();
    verlauf.replaceChildren();
    verlauf.hidden = true;
    amEnde = true;
    letzterStand = 0;
    satzHinweis.hidden = true;
    satzHinweis.textContent = "";
    zeileOrt.textContent = "";
    anschlussOrt.textContent = "";
    grenzeOrt.hidden = true;
    notizLeeren();
    if (zuegeOrt) zuegeOrt.textContent = "";
    for (const chip of chips) chip.hidden = true;
  };

  const freiZeigen = () => {
    phaseSetzen("frei");
    // Fehler und Sperren stehen in der Statusleiste der Steuerung; sonst wieder „Bereit“
    if (demo.kannStarten()) demo.stand(HINWEISE.bereit);
  };

  const ersteWahl = () => betriebe.find((b) => b.checked) ?? betriebe[0];

  /* Anruf ------------------------------------------------------------------------------------------------- */

  const gewaehlterBetrieb = (): BetriebId => {
    const wert = betriebe.find((b) => b.checked)?.value;
    return istBetriebId(wert) ? wert : "haustechnik";
  };

  function anrufen(): void {
    if (phase !== "frei" || !demo.kannStarten() || anrufenKnopf.getAttribute("aria-disabled") === "true") return;
    const betrieb = BETRIEBE[gewaehlterBetrieb()];
    const fokus = fokusHier();
    allesLeeren();
    demo.meldung(null);
    anruf = {
      betrieb: betrieb.id,
      variante: "offen",
      sitzung: null,
      zug: 0,
      zuegeRest: null,
      antworten: 0,
      beginn: 0,
      notiz: LEERE_NOTIZ,
      stempel: null,
      notfallGemeldet: false,
      ticketGemeldet: false,
      benutzt: new Set(),
      endet: null,
      vorbei: false,
      endStand: "",
      endAnsage: "",
    };
    melde("Anruf gestartet");
    phaseSetzen("waehlt");
    anschlussOrt.textContent = TELEFON.karte(betrieb);
    const voll = TELEFON.waehlt(betrieb.nummer);
    demo.stand(voll);
    demo.ansagen(voll);
    // Die Nummer erscheint im Takt der Tastentöne, bei reduzierter Bewegung gleich ganz
    let ziffer = 0;
    [...betrieb.nummer].forEach((zeichen, i) => {
      if (!/\d/.test(zeichen)) return;
      spiele("taste", { variante: zeichen, in: ziffer * TASTE_S });
      const teil = TELEFON.waehlt(betrieb.nummer.slice(0, i + 1));
      if (!ruhig()) spaeter(ziffer * TASTE_S * 1000, () => (zeileOrt.textContent = teil));
      ziffer += 1;
    });
    if (ruhig()) zeileOrt.textContent = voll;
    const klingeln = ziffer * TASTE_S * 1000 + VOR_DEM_KLINGELN_MS;
    spaeter(klingeln, () => {
      phaseSetzen("klingelt");
      zeileOrt.textContent = TELEFON.klingelt;
      demo.stand(TELEFON.klingelt);
      demo.ansagen(TELEFON.klingelt);
      spiele("freiton", { einzeln: true });
    });
    spaeter(klingeln + FREITON_MS, abheben);
    // Der Knopf „Anrufen“ verschwindet; Auflegen ist jetzt der Weg zurück
    if (fokus) auflegenKnopf.focus({ preventScroll: true });
  }

  function abheben(): void {
    const dieser = anruf;
    if (!dieser || phase !== "klingelt") return;
    const betrieb = BETRIEBE[dieser.betrieb];
    // Einmal hier festgelegt: Diese Begrüßung steht im Verlauf, und dieselbe Variante geht im ersten Zug an den
    // Dienst. Beim Absenden neu gerechnet, könnten Anzeige und System-Prompt um 16:30 Uhr auseinanderlaufen.
    dieser.variante = begruessungsVariante(betrieb);
    dieser.beginn = performance.now();
    const jetzt = new Date();
    const fokus = fokusHier();
    phaseSetzen("verbunden");
    spiele("hoerer", { variante: "ab" });
    zeileOrt.textContent = TELEFON.leitung;
    anschlussOrt.textContent = TELEFON.anschluss(betrieb);
    vorgangOrt.textContent = mitJahr(TELEFONNOTIZ.vorgang, jahrInBerlin(jetzt));
    datumOrt.textContent = DATUM.format(jetzt);
    uhrzeitOrt.textContent = UHRZEIT.format(jetzt);
    fussOrt.textContent = betrieb.notizFuss[dieser.variante];
    notizZeigen(LEERE_NOTIZ, true);
    const begruessung = betrieb.begruessung[dieser.variante];
    schreiben(sprechblase("assistent", ""), begruessung);
    // Auch vorgelesen genau die gezeigte Begrüßung: Die Stimme des Dienstes holt sie zu Betrieb und Variante
    vorlesen?.sprechen(begruessung, begruessungAbruf(betrieb.id, dieser.variante), {
      merken: `${betrieb.id}|${dieser.variante}`,
    });
    saetzeZeigen();
    sekundenUhr = window.setInterval(statusZeigen, 1000);
    statusZeigen();
    demo.ansagen(`${TELEFON.verbundenAnsage} ${begruessung}`);
    // Wer per Tastatur angerufen hat, spricht gleich los; am Touchscreen soll keine Tastatur aufspringen
    if (fokus && perTastatur) feld.focus({ preventScroll: true });
  }

  /** Beendet den Anruf. art: was gemeldet wird (null bei einem Fehler, den die Steuerung schon gemeldet hat). */
  function anrufBeenden(dieser: Anruf, art: Ende | null, o: { besetzt?: boolean; ansage?: string } = {}): void {
    if (dieser.vorbei) return;
    dieser.vorbei = true;
    const fokus = fokusHier();
    uhrenStoppen();
    sprache?.stoppen();
    // Die letzte Antwort ist schon ausgesprochen (ausklingen); was jetzt noch läuft, gehört nicht mehr zum Gespräch
    vorlesen?.stoppen();
    if (art) {
      melde("Gespräch beendet", { wert: dieser.zug, detail: art });
      // Eine offene Rückfrage oder ein „Noch einmal“ für dieses Gespräch hat sich erledigt. Bei art null bleibt die
      // Meldung der Steuerung stehen, sie erklärt, warum das Gespräch vorbei ist.
      demo.meldung(null);
    }
    const dauer = minutenUhr(dauerSekunden(dieser));
    dieser.endStand = TELEFON.aufgelegt(dauer);
    dieser.endAnsage = o.ansage ?? TELEFON.aufgelegt(dauer);
    if (o.besetzt) {
      spiele("hoerer", { variante: "auf" });
      spiele("freiton", { variante: "besetzt", in: 0.4 });
    }
    if (dieser.antworten === 0) {
      // Ohne eine einzige Antwort gibt es nichts nachzulesen: zurück zur Wahl, eine Meldung der Steuerung bleibt
      anruf = null;
      allesLeeren();
      freiZeigen();
      if (art) {
        demo.stand(dieser.endStand);
        demo.ansagen(dieser.endAnsage);
      }
      if (fokus) (anrufenKnopf.hidden || anrufenKnopf.disabled ? ersteWahl() : anrufenKnopf)?.focus({ preventScroll: true });
      return;
    }
    phaseSetzen("ende");
    zeileOrt.textContent = dieser.endStand;
    dauerOrt.textContent = TELEFONNOTIZ.dauerWert(dauer);
    dauerZeile.hidden = false;
    grenzeOrt.hidden = art !== "Höchstzahl erreicht";
    if (art) {
      demo.stand(dieser.endStand);
      demo.ansagen(dieser.endAnsage);
    }
    if (fokus) endText.focus({ preventScroll: true });
  }

  // Erst ausreden lassen: ohne Vorlesen kurz zum Lesen, mit Vorlesen bis die Stimme fertig ist (die des Dienstes
  // zählt schon, solange sie lädt), höchstens VORLESEN_HOECHSTENS_MS
  const ausklingen = (dieser: Anruf) => {
    const beginn = performance.now();
    const sprichtNoch = () => vorlesen?.spricht() === true;
    const pruefen = () => {
      if (dieser.vorbei) return;
      if (sprichtNoch() && performance.now() - beginn < VORLESEN_HOECHSTENS_MS) {
        spaeter(250, pruefen);
        return;
      }
      const art = dieser.endet ?? "Höchstzahl erreicht";
      anrufBeenden(dieser, art, {
        besetzt: true,
        ansage: art === "vom Assistenten beendet" ? TELEFON.assistentAufgelegt : TELEFON.grenze,
      });
    };
    spaeter(AUSKLANG_MS, pruefen);
  };

  function auflegen(o: { still?: boolean } = {}): void {
    const dieser = anruf;
    if (!dieser || dieser.vorbei) return;
    if (!o.still) spiele("hoerer", { variante: "auf" });
    if (phase === "waehlt" || phase === "klingelt") {
      // Noch nicht abgenommen: kein Gespräch, keine Notiz, zurück zur Wahl
      dieser.vorbei = true;
      const fokus = fokusHier();
      melde("Gespräch beendet", { wert: 0, detail: "aufgelegt" });
      anruf = null;
      allesLeeren();
      freiZeigen();
      demo.stand(TELEFON.aufgelegtVorher);
      if (!o.still) demo.ansagen(TELEFON.aufgelegtVorher);
      if (fokus) anrufenKnopf.focus({ preventScroll: true });
      return;
    }
    const zustand = demo.zustand();
    if (zustand === "laeuft" || zustand === "prueft") demo.anhalten();
    // Hat sich der Assistent schon verabschiedet, bleibt es bei seinem Ende
    anrufBeenden(dieser, dieser.endet ?? "aufgelegt");
  }

  /* Ein Zug ------------------------------------------------------------------------------------------------ */

  function zugGescheitert(dieser: Anruf, code: FehlerCode, text: string, besucher: HTMLElement, antwort: HTMLElement): void {
    blaseEntfernen(besucher);
    blaseEntfernen(antwort);
    // Nicht überschreiben, was Besucher während des Zugs schon neu getippt haben
    if (!feld.value.trim()) feld.value = text;
    notizZeigen(dieser.notiz, true);
    // Sitzung weg (abgelaufen, Dienst neu gestartet), Demo gesperrt oder der fünfte Zug gescheitert: Der Dienst
    // kennt dieses Gespräch nicht mehr. Die Meldung der Steuerung erklärt es, der Weg führt zum neuen Anruf.
    if (code === "sitzung" || !demo.kannStarten()) {
      anrufBeenden(dieser, null);
      return;
    }
    if (dieser.sitzung !== null && dieser.zuegeRest === 0) {
      anrufBeenden(dieser, "Höchstzahl erreicht", { ansage: TELEFON.grenze });
      return;
    }
    oberflaeche();
  }

  async function zugSenden(): Promise<void> {
    const dieser = anruf;
    if (!dieser || phase !== "verbunden" || dieser.endet !== null) return;
    sprache?.stoppen();
    const text = feld.value.trim();
    const satz = gewaehlterSatz && gewaehlterSatz.text === text ? gewaehlterSatz : null;
    gewaehlterSatz = null;
    if (text.length < TELEFON.grenzen.textMin) {
      spiele("ding");
      demo.meldung({ art: "warnung", satz: TELEFON.zuKurz });
      feld.setAttribute("aria-invalid", "true");
      feld.focus();
      return;
    }
    // Vorgegebene Sätze enthalten nur Filmrufnummern, die Rückfrage gilt eigenen Sätzen
    if (!satz && !(await demo.eigenenTextPruefen(text, feld))) return;
    if (anruf !== dieser || phase !== "verbunden" || dieser.endet !== null) return;
    // Wer spricht, unterbricht den Assistenten, wie am Telefon
    vorlesen?.stoppen();

    const ersterZug = dieser.sitzung === null;
    const naechster = dieser.zug + 1;
    if (satz) melde("Satz gewählt", { wert: naechster, detail: satz.id });
    else melde("eigener Satz gesendet", { wert: naechster });
    if (satz?.hinweis) {
      satzHinweis.textContent = satz.hinweis;
      satzHinweis.hidden = false;
    }
    const besucherBlase = sprechblase("besucher", text);
    spiele("plopp", { variante: "tief" });
    feld.value = "";
    feld.removeAttribute("aria-invalid");
    const antwortOrt = sprechblase("assistent", "");
    antwortOrt.classList.add("ki-cursor");
    let ersteWorte = true;
    const worte = () => {
      if (!ersteWorte) return;
      ersteWorte = false;
      spiele("plopp");
    };

    // Datensparsam: Den Antworttext für die Stimme des Dienstes nur anfordern, wenn sie ihn auch sprechen soll
    const stimmeAngefordert = vorlesen?.dienstStimme() === true;
    const anforderung = stimmeAngefordert ? { vorlesen: true } : {};
    const ergebnis = await demo.lauf(
      ersterZug
        ? { betrieb: dieser.betrieb, variante: dieser.variante, text, ...anforderung }
        : { sitzung: dieser.sitzung, text, ...anforderung },
      {
        beiStart: (start) => {
          if (anruf !== dieser) return;
          if (start.sitzung) dieser.sitzung = start.sitzung;
          if (start.zuegeRest !== null) {
            dieser.zuegeRest = start.zuegeRest;
            dieser.zug = Math.max(1, zuegeGesamt - start.zuegeRest);
          }
          zuegeZeigen();
        },
        beiStand: (teil) => {
          if (anruf !== dieser) return;
          const antwort = jsonText(teil, "antwort");
          if (antwort) {
            worte();
            schreiben(antwortOrt, antwort);
          }
          notizZeigen(notizLesen(teil, dieser.notiz), false);
        },
        beiNeu: () => {
          if (anruf !== dieser) return;
          // Ausweichmodell: Vorschau verwerfen, der nächste Teilstand bringt sofort den ganzen Stand
          sofort(antwortOrt, "");
          antwortOrt.classList.add("ki-cursor");
          notizZeigen(dieser.notiz, true);
        },
      },
      // Folgezüge tragen die Sitzung statt eines Tokens
      { turnstile: ersterZug },
    );

    if (dieser.vorbei) {
      // Während des Zugs aufgelegt. Der abgebrochene Zug gehört nicht zum Gespräch (wie beim Dienst), und die
      // Steuerung meldet „Angehalten.“, gemeint war Auflegen. Bei anruf null ging es ohne Antwort zurück zur Wahl;
      // ein inzwischen neuer Anruf behält seine Anzeige.
      if (anruf === dieser) {
        if (!ergebnis.ok) {
          blaseEntfernen(besucherBlase);
          blaseEntfernen(antwortOrt);
          notizZeigen(dieser.notiz, true);
        }
        demo.stand(dieser.endStand);
        demo.ansagen(dieser.endAnsage);
      } else if (anruf === null && dieser.endStand) {
        demo.stand(dieser.endStand);
        demo.ansagen(dieser.endAnsage);
      }
      return;
    }
    if (anruf !== dieser) return;
    if (!ergebnis.ok) {
      zugGescheitert(dieser, ergebnis.fehler.code, text, besucherBlase, antwortOrt);
      return;
    }

    // fertig ist maßgeblich: Antwort und Notiz neu zeichnen
    const fertig = ergebnis.fertig;
    const antwort = jsonText(fertig.ergebnis, "antwort");
    worte();
    sofort(antwortOrt, antwort || "…");
    dieser.antworten += 1;
    if (fertig.zuegeRest !== null) dieser.zuegeRest = fertig.zuegeRest;
    dieser.notiz = notizLesen(fertig.ergebnis, dieser.notiz);
    notizZeigen(dieser.notiz, true);
    const erfasst = dieser.notiz.status === "erfasst";
    stempelSetzen(dieser, erfasst ? (dieser.notiz.dringlichkeit === "notfall" ? "notfall" : "sonst") : null);
    if (erfasst && !dieser.ticketGemeldet) {
      dieser.ticketGemeldet = true;
      const detail = TICKET_DETAIL[dieser.notiz.dringlichkeit];
      melde("Ticket fertig", detail ? { wert: dieser.zug, detail } : { wert: dieser.zug });
    }
    if (satz) dieser.benutzt.add(satz.id);
    saetzeZeigen();
    demo.ansagen(antwort, true);
    // Mit Token spricht die Stimme des Dienstes (sie bereitet den Text dort genauso auf), sonst die des Geräts. Läuft
    // gerade die Spracheingabe, schweigt die Antwort (sie steht im Verlauf); sonst hörte die Erkennung sie mit. Kam die
    // Stimme des Dienstes erst während des Zugs dazu (Ton oder Vorlesen eben eingeschaltet), hat der Dienst diese
    // Antwort nicht bereitgehalten: Dann spricht erst die nächste, statt still die Stimme zu wechseln
    const erstJetzt = !stimmeAngefordert && vorlesen?.dienstStimme() === true;
    if (!sprache?.laeuft() && !erstJetzt) vorlesen?.sprechen(fuersVorlesen(antwort), fertig.stimme ? antwortAbruf(fertig.stimme) : null);
    const beendet = jsonWahr(fertig.ergebnis, "beendet");
    if (beendet || dieser.zuegeRest === 0) {
      dieser.endet = beendet ? "vom Assistenten beendet" : "Höchstzahl erreicht";
      oberflaeche();
      ausklingen(dieser);
    }
  }

  /* Bedienung ---------------------------------------------------------------------------------------------- */

  // Zum Mikrofon greifen unterbricht den Assistenten; sonst hörte die Spracherkennung seine Stimme mit
  panel.querySelector<HTMLButtonElement>("[data-ki-sprache]")?.addEventListener("click", () => vorlesen?.stoppen());

  anrufenKnopf.addEventListener("click", (event) => {
    // detail 0: per Tastatur ausgelöst
    perTastatur = event.detail === 0;
    anrufen();
  });
  auflegenKnopf.addEventListener("click", () => auflegen());

  nochmalKnopf.addEventListener("click", () => {
    if (phase !== "ende") return;
    vorlesen?.stoppen();
    anruf = null;
    allesLeeren();
    demo.meldung(null);
    freiZeigen();
    ersteWahl()?.focus({ preventScroll: true });
  });

  for (const chip of chips) {
    chip.addEventListener("click", () => {
      if (chip.getAttribute("aria-disabled") === "true" || phase !== "verbunden" || !anruf || anruf.endet !== null) return;
      const satz = satzVon(chip.dataset.kiSatz);
      if (!satz) return;
      feld.value = satz.text;
      gewaehlterSatz = satz;
      demo.formular.requestSubmit(sagenKnopf);
    });
  }

  // Die Steuerung verhindert das echte Absenden und blockt außerhalb von bereit, fertig und fehler. Vor dem Anruf
  // ruft die Eingabetaste in der Wahl an, im Gespräch sagt sie den Satz.
  demo.formular.addEventListener("submit", () => {
    if (phase === "frei") {
      perTastatur = true;
      anrufen();
      return;
    }
    void zugSenden();
  });

  // Wechsel zu einem anderen Programm, während es noch klingelt: auflegen, ein Gespräch ohne Zuhörer braucht keiner
  document.addEventListener("ki:programm", () => {
    if (panel.hidden && (phase === "waehlt" || phase === "klingelt")) auflegen({ still: true });
  });

  new MutationObserver(oberflaeche).observe(panel, { attributes: true, attributeFilter: ["data-ki-zustand"] });
  vorgangOrt.textContent = mitJahr(TELEFONNOTIZ.vorgang, jahrInBerlin(new Date()));
  oberflaeche();
}
