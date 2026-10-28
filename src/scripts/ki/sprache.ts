/* Spracheingabe und Vorlesen für die KI-Programme (Abschnitt 07) ------------------------------------------
   Beides macht der Browser, nicht die Seite und nicht der Dienst; nur die Stimme des Probeanrufs kann vom Dienst
   kommen (unten).
   Spracheingabe (Web Speech API):
   - Den Knopf gibt es nur, wenn der Browser Spracherkennung kann (Firefox: nein). Gestartet wird nur im Klick.
   - Zuerst die Erkennung auf dem Gerät (available() mit processLocally, Chrome am Computer): Dann bleiben Ton
     und Text auf dem Gerät. Sonst schickt der Browser die Aufnahme an seinen Hersteller; davor steht im Fenster
     ein Hinweis mit Zustimmung. Die Zustimmung lebt nur in einer Variablen dieses Seitenaufrufs (die
     Datenschutzerklärung verspricht, dass nichts im Browser gespeichert wird). Kein install() von Sprachpaketen.
   - Das Erkannte landet nur im Eingabefeld, nie in der Messung.
   Vorlesen (SpeechSynthesis, beim Probeanruf auch die Stimme des Dienstes):
   - Eigener Schalter, anfangs aus. Nur lokale deutsche Stimmen (localService); Netzstimmen schicken den Text an
     den Hersteller. Gibt es keine und auch keine Stimme des Dienstes, bleibt der Schalter verborgen.
   - Bietet der Dienst seine künstlich erzeugte Stimme an (stimme.ts), steht neben dem Schalter statt des Hinweises
     zur Computerstimme einer zum Sprachdienst, und erst mit dem Einschalten geht Antworttext dorthin. Scheitert die
     Stimme, liest die Computerstimme, ohne Meldung.
   - Verstummt beim Verstecken der Seite, beim Verlassen, beim Wechsel des Programms, bei „Ton aus“ und auf Wunsch
     des Programms (Gesprächsende); bei verborgener Seite und in einem anderen Programm beginnt es auch nicht neu.
   - „Ton aus“ heißt Stille: Solange der Ton der Seite aus ist, liest keine Stimme vor, auch nicht die des Geräts,
     und es geht keine Anfrage an die Stimme des Dienstes. Kommt der Ton zurück, spricht die nächste Antwort wieder;
     nachgeholt wird nichts. */

import { nutzung } from "../nutzung";
import { audioKontext, kontextImKlick, tonIstAn } from "../klang";
import { SPRACHE } from "../../data/ki-demos";
import { ansagen, meldungVerbergen, meldungZeigen } from "./anzeige";
import { stimmeAbspielen, stimmeLaeuft, stimmeStoppen, type StimmeAbruf } from "./stimme";
import { MESSBEREICH, kiStatus, type DemoId } from "./verbindung";

/* Spracheingabe ----------------------------------------------------------------------------------------- */

// Die DOM-Typen kennen die Klasse selbst nicht (nur ihre Ereignisse), deshalb hier das Nötige
interface Erkennung {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  processLocally?: boolean;
  onresult: ((ereignis: SpeechRecognitionEvent) => void) | null;
  onerror: ((ereignis: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface ErkennungKlasse {
  new (): Erkennung;
  available?: (optionen: { langs: string[]; processLocally: boolean }) => Promise<string>;
}

const fenster = window as Window & { SpeechRecognition?: ErkennungKlasse; webkitSpeechRecognition?: ErkennungKlasse };
const Klasse: ErkennungKlasse | undefined = fenster.SpeechRecognition ?? fenster.webkitSpeechRecognition;

/** Kann dieser Browser Sprache erkennen? Ohne gibt es keinen Mikrofon-Knopf. */
export const spracheMoeglich = (): boolean => Klasse !== undefined;

// Nur für diesen Seitenaufruf, für alle Programme gemeinsam
let zustimmungHersteller = false;
// Erkennung auf dem Gerät möglich? null, solange die Antwort aussteht; dann gilt „nein“, damit der Start im Klick bleibt
let aufDemGeraet: boolean | null = null;
let geraetGefragt: Promise<void> | null = null;

// Gefragt wird erst, wenn jemand zum Mikrofon greift (Zeiger darüber, Fokus, Klick), nicht schon beim Einrichten:
// available() ist noch experimentell, und die abgespeckte Chromium-Fassung für automatische Tests stürzt daran ab.
function geraetFragen(): Promise<void> {
  geraetGefragt ??= (async () => {
    try {
      // „downloadable“ (Sprachpaket fehlt) zählt wie „nicht auf dem Gerät“: kein install() ohne ausdrücklichen Wunsch
      aufDemGeraet = Klasse?.available ? (await Klasse.available({ langs: ["de-DE"], processLocally: true })) === "available" : false;
    } catch {
      aufDemGeraet = false;
    }
  })();
  return geraetGefragt;
}

// Feste Wörter für die Messung (detail), nie die Meldung des Browsers
const FEHLER_DETAIL: Partial<Record<SpeechRecognitionErrorCode, string>> = {
  "not-allowed": "not-allowed",
  "service-not-allowed": "not-allowed",
  "no-speech": "no-speech",
  "audio-capture": "audio-capture",
  network: "network",
};

// Die beiden häufigsten Sätze stehen in data/ki-demos.ts; die übrigen Fälle sind selten und nur hier bekannt
const FEHLER_SATZ: Partial<Record<SpeechRecognitionErrorCode, string>> = {
  "not-allowed": SPRACHE.gesperrt,
  "service-not-allowed": "Ihr Browser lässt die Spracheingabe hier nicht zu. Tippen geht genauso.",
  "no-speech": SPRACHE.nichtVerstanden,
  "audio-capture": "Ihr Browser findet kein Mikrofon. Tippen geht genauso.",
  network: "Die Spracherkennung Ihres Browsers ist gerade nicht erreichbar. Tippen geht genauso.",
};
const ALLGEMEIN = "Die Spracheingabe klappt hier gerade nicht. Tippen geht genauso.";

export interface SpracheOptionen {
  /** Für die Messung („Spracheingabe gestartet“, „Spracheingabe nicht möglich“ mit festen Wörtern) */
  demo: DemoId;
  /** Mikrofon-Knopf, anfangs hidden. Beschriftung in [data-ki-sprache-text] oder im Knopf selbst. */
  knopf: HTMLButtonElement;
  /** Ziel des Erkannten; maxlength gilt */
  feld: HTMLInputElement | HTMLTextAreaElement;
  /** Leerer Ort (hidden) für Zustimmung und Hinweise, im Fenster am Knopf; kein modaler Dialog */
  hinweisOrt: HTMLElement;
  /** Zeile am Knopf: wo erkannt wird, während der Aufnahme „Aufnahme läuft …“ */
  zeile?: HTMLElement | null;
  /** Nach jeder Änderung des Felds durch die Erkennung (Zähler, Knöpfe; es gibt kein input-Ereignis) */
  beiText?: (text: string) => void;
}

export interface Spracheingabe {
  /** Laufende Aufnahme beenden (etwa beim Absenden) */
  stoppen(): void;
  laeuft(): boolean;
  /** Kam Text aus der Spracheingabe ins Feld, seit dem letzten zuruecksetzen()? (Messung: „Spracheingabe“) */
  benutzt(): boolean;
  zuruecksetzen(): void;
}

/** Richtet den Mikrofon-Knopf ein; null (und Knopf bleibt verborgen), wenn der Browser keine Spracherkennung kann */
export function spracheEinrichten(o: SpracheOptionen): Spracheingabe | null {
  if (!Klasse) {
    o.knopf.hidden = true;
    return null;
  }
  const Erkenner = Klasse;
  const bereich = MESSBEREICH[o.demo];
  const beschriftung = o.knopf.querySelector<HTMLElement>("[data-ki-sprache-text]") ?? o.knopf;
  const ruheText = beschriftung.textContent?.trim() || SPRACHE.knopf;
  const panel = o.knopf.closest<HTMLElement>("[data-ki-programm]");

  let erkennung: Erkennung | null = null;
  let lokalBeimStart = false;
  let hatText = false;
  let ausSprache = false;
  let fehlerGemeldet = false;

  const zeileSetzen = () => {
    if (!o.zeile) return;
    o.zeile.textContent = erkennung ? SPRACHE.aufnahme : aufDemGeraet ? SPRACHE.aufDemGeraet : SPRACHE.hinweis;
  };

  const knopfSetzen = () => {
    beschriftung.textContent = erkennung ? SPRACHE.fertig : ruheText;
    o.knopf.toggleAttribute("data-ki-aufnahme", erkennung !== null);
    zeileSetzen();
  };

  o.knopf.hidden = false;
  const fragen = () => void geraetFragen().then(zeileSetzen);
  o.knopf.addEventListener("pointerenter", fragen, { once: true });
  o.knopf.addEventListener("focus", fragen, { once: true });
  zeileSetzen();

  const hinweis = (satz: string) => {
    meldungZeigen(o.hinweisOrt, { art: "info", satz });
    ansagen(satz, { panel });
  };

  function starten(lokal: boolean): void {
    meldungVerbergen(o.hinweisOrt, o.knopf);
    const neu = new Erkenner();
    neu.lang = "de-DE";
    neu.continuous = false;
    neu.interimResults = true;
    neu.maxAlternatives = 1;
    // Erzwingt die Erkennung auf dem Gerät: Ton und Text verlassen es nicht
    if (lokal) neu.processLocally = true;
    const basis = o.feld.value.trimEnd();
    hatText = false;
    fehlerGemeldet = false;
    lokalBeimStart = lokal;

    neu.onresult = (ereignis) => {
      let erkannt = "";
      for (let i = 0; i < ereignis.results.length; i++) erkannt += ereignis.results[i][0]?.transcript ?? "";
      erkannt = erkannt.replace(/\s+/g, " ").trim();
      if (!erkannt) return;
      hatText = true;
      ausSprache = true;
      let text = basis ? `${basis} ${erkannt}` : erkannt;
      if (o.feld.maxLength > 0) text = text.slice(0, o.feld.maxLength);
      o.feld.value = text;
      o.beiText?.(text);
    };

    neu.onerror = (ereignis) => {
      if (ereignis.error === "aborted") return;
      // Sprachpaket auf dem Gerät fehlt doch: weiter wie ohne Gerät, also mit Hinweis und Zustimmung
      if (ereignis.error === "language-not-supported" && lokalBeimStart) {
        // Kein „Nichts verstanden“ beim folgenden onend, der Hinweis hier ersetzt ihn
        fehlerGemeldet = true;
        aufDemGeraet = false;
        zeileSetzen();
        // Neu starten geht nur in einer Geste, also mit dem nächsten Klick auf den Knopf
        if (zustimmungHersteller) hinweis(`Auf Ihrem Gerät klappt die Erkennung gerade nicht. „${ruheText}“ startet sie über Ihren Browser.`);
        else zustimmungZeigen();
        return;
      }
      fehlerGemeldet = true;
      nutzung(bereich, "Spracheingabe nicht möglich", { detail: FEHLER_DETAIL[ereignis.error] ?? "nicht unterstützt" });
      hinweis(FEHLER_SATZ[ereignis.error] ?? ALLGEMEIN);
      if (ereignis.error === "not-allowed" || ereignis.error === "service-not-allowed") o.feld.focus();
    };

    neu.onend = () => {
      if (erkennung !== neu) return;
      erkennung = null;
      knopfSetzen();
      if (!hatText && !fehlerGemeldet) hinweis(SPRACHE.nichtVerstanden);
      else if (hatText) ansagen("Aufnahme beendet. Der erkannte Text steht im Feld.", { panel });
    };

    try {
      neu.start();
    } catch {
      nutzung(bereich, "Spracheingabe nicht möglich", { detail: "nicht unterstützt" });
      hinweis(ALLGEMEIN);
      return;
    }
    erkennung = neu;
    knopfSetzen();
    nutzung(bereich, "Spracheingabe gestartet", { detail: lokal ? "auf dem Gerät" : "über den Browser-Dienst" });
    ansagen(`Aufnahme läuft. Mit „${SPRACHE.fertig}“ beenden.`, { panel });
  }

  function zustimmungZeigen(): void {
    meldungZeigen(
      o.hinweisOrt,
      {
        art: "info",
        titel: SPRACHE.zustimmung.titel,
        satz: SPRACHE.zustimmung.text,
        links: [{ text: SPRACHE.zustimmung.link.text, href: SPRACHE.zustimmung.link.ziel }],
        knoepfe: [
          {
            text: SPRACHE.zustimmung.ja,
            voll: true,
            // Der Klick ist die Geste, in der die Aufnahme starten darf
            aktion: () => {
              zustimmungHersteller = true;
              starten(false);
            },
          },
          { text: SPRACHE.zustimmung.nein, aktion: () => meldungVerbergen(o.hinweisOrt, o.feld) },
        ],
      },
      { fokus: true },
    );
    ansagen(`${SPRACHE.zustimmung.titel}. ${SPRACHE.zustimmung.text}`, { panel });
  }

  o.knopf.addEventListener("click", () => {
    if (erkennung) {
      erkennung.stop();
      return;
    }
    // Synchron im Klick: Steht die Antwort zum Gerät noch aus, gilt „nicht auf dem Gerät“
    fragen();
    const lokal = aufDemGeraet === true;
    if (!lokal && !zustimmungHersteller) {
      zustimmungZeigen();
      return;
    }
    starten(lokal);
  });

  const abbrechen = () => {
    const laufend = erkennung;
    erkennung = null;
    laufend?.abort();
    knopfSetzen();
  };
  // Wechsel des Programms (ki.ts) oder verborgene Seite: Das Mikrofon geht aus
  document.addEventListener("ki:programm", () => {
    if (panel?.hidden) abbrechen();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) abbrechen();
  });

  return {
    stoppen: abbrechen,
    laeuft: () => erkennung !== null,
    benutzt: () => ausSprache,
    zuruecksetzen: () => (ausSprache = false),
  };
}

/* Vorlesen ---------------------------------------------------------------------------------------------- */

export interface Vorlesen {
  /**
   * Liest vor, wenn der Schalter und der Ton an sind; eine neue Äußerung ersetzt die laufende. Mit abruf und
   * eingeschalteter Stimme des Dienstes spricht diese (stimme.ts), sonst und wenn sie scheitert die Computerstimme
   * des Geräts.
   */
  sprechen(text: string, abruf?: StimmeAbruf | null, o?: { merken?: string }): void;
  stoppen(): void;
  an(): boolean;
  /**
   * Soll die Stimme des Dienstes die nächste Antwort sprechen (Vorlesen mit ihr an, Ton an)? Nur dann fordert der
   * Probeanruf sie im Telefonzug an, und nur dann hält der Dienst den Antworttext dafür bereit.
   */
  dienstStimme(): boolean;
  /** Spricht gerade eine Stimme, oder lädt die des Dienstes noch? */
  spricht(): boolean;
}

export interface VorlesenOptionen {
  demo: DemoId;
  /**
   * Die beiden Hinweise am Schalter: Computerstimme des Geräts bzw. Stimme des Dienstes (künstlich erzeugt, Text
   * geht an einen Sprachdienst, Link zur Datenschutzerklärung). Nur mit ihnen bietet der Schalter die Stimme des
   * Dienstes an, sobald dessen Status sie meldet.
   */
  hinweise?: { geraet: HTMLElement; dienst: HTMLElement } | null;
}

// Netzstimmen („Google Deutsch“ in Chrome, „… Online (Natural)“ in Edge) schicken den Text an den Hersteller
function lokaleDeutscheStimme(): SpeechSynthesisVoice | null {
  if (!("speechSynthesis" in window)) return null;
  const stimmen = window.speechSynthesis.getVoices().filter((s) => s.localService && s.lang.toLowerCase().startsWith("de"));
  return stimmen.find((s) => s.default) ?? stimmen[0] ?? null;
}

/**
 * Richtet einen Vorlesen-Schalter ein (button mit aria-pressed, anfangs hidden und aus). Sichtbar ist er, wenn das
 * Gerät eine lokale deutsche Stimme hat (die Liste kommt oft erst mit voiceschanged) oder der Dienst seine Stimme
 * anbietet. Welche Stimme spricht, legt der Klick fest, der das Vorlesen einschaltet: die des Dienstes nur, wenn
 * daneben schon ihr Hinweis stand. Ein später eintreffender Status schaltet nichts still um.
 */
export function vorlesenEinrichten(schalter: HTMLButtonElement, o: VorlesenOptionen): Vorlesen | null {
  const geraet = "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined" ? window.speechSynthesis : null;
  const hinweise = o.hinweise ?? null;
  if (!geraet && !hinweise) {
    schalter.hidden = true;
    return null;
  }
  const bereich = MESSBEREICH[o.demo];
  const panel = schalter.closest<HTMLElement>("[data-ki-programm]");
  let istAn = false;
  // Bietet der Dienst seine Stimme an (Status), und gilt sie für das jetzige Einschalten?
  let dienstBereit = false;
  let mitDienst = false;
  // Zählt die Äußerungen: Der Rückfall auf die Computerstimme gilt nur, solange seine Äußerung die letzte ist
  let nummer = 0;
  schalter.setAttribute("aria-pressed", "false");

  const stoppen = () => {
    nummer += 1;
    stimmeStoppen();
    try {
      geraet?.cancel();
    } catch {
      // nichts zu tun
    }
  };

  // Aus: der Hinweis zu dem, was beim Einschalten gälte; an: der zu dem, was gerade gilt
  const hinweisZeigen = () => {
    if (!hinweise) return;
    const dienst = istAn ? mitDienst : dienstBereit;
    hinweise.geraet.hidden = dienst;
    hinweise.dienst.hidden = !dienst;
  };

  const pruefen = () => {
    const vorhanden = lokaleDeutscheStimme() !== null || dienstBereit;
    schalter.hidden = !vorhanden;
    if (!vorhanden && istAn) {
      istAn = false;
      mitDienst = false;
      schalter.setAttribute("aria-pressed", "false");
      stoppen();
    }
    hinweisZeigen();
  };
  pruefen();
  geraet?.addEventListener("voiceschanged", pruefen);
  if (hinweise) {
    void kiStatus().then((s) => {
      dienstBereit = s.stimmeBereit;
      pruefen();
    });
  }

  const aeussern = (text: string, lautstaerke = 1) => {
    const stimme = lokaleDeutscheStimme();
    // Lieber stumm als über eine Netzstimme
    if (!geraet || !stimme) return;
    const aeusserung = new SpeechSynthesisUtterance(text);
    // Immer setzen, sonst nimmt der Browser seine Vorgabe, und die kann eine Netzstimme sein
    aeusserung.voice = stimme;
    aeusserung.lang = stimme.lang;
    aeusserung.volume = lautstaerke;
    geraet.speak(aeusserung);
  };

  schalter.addEventListener("click", () => {
    istAn = !istAn;
    mitDienst = istAn && dienstBereit;
    schalter.setAttribute("aria-pressed", String(istAn));
    hinweisZeigen();
    nutzung(bereich, istAn ? "Vorlesen eingeschaltet" : "Vorlesen ausgeschaltet");
    stoppen();
    if (!istAn) {
      // Ohne Ton braucht den Kontext jetzt niemand: anhalten wie klang.ts beim Ausschalten, nach dem Ausblenden
      window.setTimeout(() => {
        if (!istAn && !tonIstAn()) void audioKontext()?.suspend().catch(() => {});
      }, 120);
      return;
    }
    // iOS spielt erst, wenn der Ton in einer Geste beginnt. Deshalb im Klick: der AudioContext für die Stimme des
    // Dienstes und eine stille Äußerung für die Computerstimme (sie springt auch ein, wenn die andere scheitert). Bei
    // Ton aus braucht den Kontext niemand; den legt dann der Ton-Schalter in seinem Klick an
    if (mitDienst && tonIstAn()) kontextImKlick();
    aeussern(" ", 0);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stoppen();
  });
  window.addEventListener("pagehide", stoppen);
  document.addEventListener("ki:programm", () => {
    if (panel?.hidden) stoppen();
  });
  // Ton aus: Was gerade spricht, verstummt sofort, und bis der Ton zurückkommt, beginnt nichts Neues (sprechen()). Das
  // Vorlesen bleibt eingeschaltet. Weil klang.ts zuerst `an` umstellt und dann dieses Ereignis schickt, startet auch
  // in den 120 ms bis zum Anhalten des Kontexts keine Stimme mehr, die dabei einfrieren könnte
  document.addEventListener("klang:zustand", (e) => {
    if ((e as CustomEvent<"an" | "aus">).detail === "aus") stoppen();
  });

  return {
    sprechen: (text, abruf, opt) => {
      // Ton aus, verborgene Seite oder anderes Programm: nicht vorlesen und nichts nachholen, der Text steht im
      // Verlauf. Bei Ton aus geht damit auch keine Anfrage an die Stimme des Dienstes
      if (!istAn || !tonIstAn() || !text.trim() || document.hidden || panel?.hidden) return;
      stoppen();
      if (!mitDienst || !abruf) {
        aeussern(text);
        return;
      }
      const diese = nummer;
      void stimmeAbspielen(abruf, opt).then((ergebnis) => {
        // Ohne Meldung an Besucher: Dann liest eben die Computerstimme, sofern das Gerät eine hat
        if (ergebnis === "gescheitert" && diese === nummer && istAn && tonIstAn()) aeussern(text);
      });
    },
    stoppen,
    an: () => istAn,
    dienstStimme: () => istAn && mitDienst && tonIstAn(),
    spricht: () => istAn && (stimmeLaeuft() || (geraet !== null && (geraet.speaking || geraet.pending))),
  };
}
