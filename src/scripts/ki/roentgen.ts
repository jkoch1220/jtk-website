/* Programm 2 im Abschnitt 07: Büro-Röntgenblick ---------------------------------------------------------------
   Beschreibung (getippt, gesprochen oder als Beispiel) an POST {kiUrl}/roentgen. Bis zum ersten Teilstand läuft
   der Leuchtschirm (Klang „roentgen“, Blitz mit dem Zap bei rund 0,75 s), danach füllt der Teilstand die
   vorgezeichnete Ergebnisfläche; fertig ist maßgeblich und zeichnet alles neu. Kosten und Stufe kommen nur aus
   fertig.rechnung: Der Dienst rechnet mit den Richtwerten des Checks, die Seite zeigt sie nur. Danach gibt es den
   Befund als Beleg (wie im Check, Stempel „KI-BEFUND“ und die Stufe), als PDF (befund-pdf.ts, erst beim Klick
   geladen) und „Termin mit dieser Problembeschreibung buchen“ (anfrage:vorbelegen, Block nach vorbelegen.ts).
   Zustände, Fehler, Rest, Turnstile und Zeitlimits übernimmt demoSteuerung (anzeige.ts), die Spracheingabe
   sprache.ts, alle Texte data/ki-demos.ts. Was von der KI oder vom Besucher kommt, geht nur über textContent ins
   DOM. Gemessen werden nur feste Wörter, nie Text, Antwort oder Länge. */

import { nutzung } from "../nutzung";
import { spiele } from "../klang";
import { KOPF_ROENTGEN } from "../vorbelegen";
import { URTEIL_ROT_AB } from "../../data/richtwerte";
import { BEFUND, BROWSER_SAETZE, ROENTGEN, ROENTGEN_BEISPIELE, STUFEN } from "../../data/ki-demos";
import { demoSteuerung, euro, ganzzahl, kommazahl, ruhig, schreiben, sofort, textSetzen } from "./anzeige";
import type { BefundDaten } from "./befund-pdf";
import { spracheEinrichten } from "./sprache";
import { MESSBEREICH, jsonListe, jsonObjekt, jsonText, jsonWahr, jsonZahl } from "./verbindung";

const BEREICH = MESSBEREICH.roentgen;
type Aktion =
  | "Beispiel gewählt"
  | "Beschreibung begonnen"
  | "Diagnose gestartet"
  | "Diagnose fertig"
  | "Befund ausgestellt"
  | "Befund als PDF geladen"
  | "PDF gescheitert"
  | "Termin mit Befund gewünscht";
// Nur feste Wörter; Wechselndes in detail (aus festen Listen) oder wert, nie Eingaben oder KI-Text
const melde = (aktion: Aktion, extra?: { wert?: number; detail?: string }) => nutzung(BEREICH, aktion, extra);

// So lange bleibt der Leuchtschirm mindestens stehen: bis der Blitz (mit dem Zap bei rund 0,75 s) vorbei ist. Ein
// schneller erster Teilstand wartet so lange; er wird nur gezeichnet, nicht gerechnet.
const SCHIRM_MS = 1100;
const SCHRITTE = 3;
// Belegnummern ohne Verwechsler (0/O, 1/I) wie die des Checks
const ZEICHEN = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type Stufe = 0 | 1 | 2 | 3;

interface Befund {
  diagnose: string;
  bleibt: string;
  davor: string;
  ist: { schritt: string; bremse: string }[];
  soll: { schritt: string; hebel: string }[];
  hebel: string;
  fazit: string;
}

/** Rechnung des Dienstes (Vertrag: website-dienst/API.md), schon gerundet wie im Check */
interface Rechnung {
  stundenProWoche: number;
  stundenProJahr: number;
  euroProJahr: number;
  stundensatz: number;
  wochen: number;
  stufe: Stufe;
}

const istStufe = (zahl: number | null): zahl is Stufe => zahl === 0 || zahl === 1 || zahl === 2 || zahl === 3;

/** Ergebnis oder Teilstand lesen; was fehlt, wird "" (ein Teilstand ist unvollständig) */
function befundLesen(wert: unknown): Befund {
  const alt = jsonObjekt(wert, "altsystem");
  return {
    diagnose: jsonText(wert, "diagnose"),
    bleibt: jsonText(alt, "bleibt"),
    davor: jsonText(alt, "davor"),
    ist: jsonListe(wert, "ist")
      .slice(0, SCHRITTE)
      .map((s) => ({ schritt: jsonText(s, "schritt"), bremse: jsonText(s, "bremse") })),
    soll: jsonListe(wert, "soll")
      .slice(0, SCHRITTE)
      .map((s) => ({ schritt: jsonText(s, "schritt"), hebel: jsonText(s, "hebel") })),
    hebel: jsonText(wert, "hebel"),
    fazit: jsonText(wert, "fazit"),
  };
}

/** Fehlt etwas an der Rechnung, zeigt die Seite keine Zahlen und keine Stufe, statt selbst zu rechnen */
function rechnungLesen(wert: unknown): Rechnung | null {
  const stundenProWoche = jsonZahl(wert, "stundenProWoche");
  const stundenProJahr = jsonZahl(wert, "stundenProJahr");
  const euroProJahr = jsonZahl(wert, "euroProJahr");
  const stundensatz = jsonZahl(wert, "stundensatz");
  const wochen = jsonZahl(wert, "wochen");
  const stufe = jsonZahl(wert, "stufe");
  if (stundenProWoche === null || stundenProJahr === null || euroProJahr === null) return null;
  if (stundensatz === null || wochen === null || !istStufe(stufe)) return null;
  return { stundenProWoche, stundenProJahr, euroProJahr, stundensatz, wochen, stufe };
}

// Wie linksEntfernen im Dienst: Mailadressen und Links (mit Schema, mit www. oder als nackte Domain mit bekannter
// Endung). Was die Seite verlässt (Block für die Terminbuchung, Beleg, PDF), trägt so keine Adressen weiter, auch
// nicht aus der eigenen Beschreibung.
const MAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu;
const URL_MIT_SCHEMA = /\b(?:https?|ftp):\/\/[^\s<>"'«»]*[^\s<>"'«».,;:!?)]/giu;
const WWW = /\bwww\.[^\s<>"'«»]*[^\s<>"'«».,;:!?)]/giu;
const DOMAIN =
  /\b(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+(?:de|com|net|org|eu|info|io|at|ch|nl|be|fr|it|es|uk|co|biz|app|dev|shop|online|site|xyz|me|tv|ai|nrw|koeln|berlin|ruhr)\b(?:\/(?:[^\s<>"'«»]*[^\s<>"'«».,;:!?)])?)?/giu;

/** Eine Zeile ohne Umbrüche und Adressen, höchstens max Zeichen (sonst mit „…“); leer wird „–“ */
function einzeilig(text: string, max: number): string {
  const ohne = text.replace(MAIL, "").replace(URL_MIT_SCHEMA, "").replace(WWW, "").replace(DOMAIN, "");
  // Nach Zeichen, nicht nach UTF-16-Einheiten: Ein Emoji wird nie halbiert
  const zeichen = Array.from(ohne.replace(/\s+/g, " ").trim());
  if (zeichen.length === 0) return "–";
  return zeichen.length > max ? `${zeichen.slice(0, max - 1).join("").trimEnd()}…` : zeichen.join("");
}

/** Block für „Worum geht es?“: Kopfzeile plus genau vier Zeilen (vorbelegen.ts erkennt und ersetzt ihn daran) */
function befundBlock(b: Befund, r: Rechnung, beschreibung: string): string {
  const v = ROENTGEN.vorbelegen;
  return [
    `${KOPF_ROENTGEN} ${v.kopfZusatz}`,
    `${v.ablauf} ${einzeilig(beschreibung, ROENTGEN.grenzen.beschreibungMax)}`,
    `${v.flaschenhals} ${einzeilig(b.diagnose, 300)}`,
    `${v.bleibt} ${einzeilig(b.bleibt, 200)}`,
    v.schaetzung(kommazahl(r.stundenProWoche), r.stundenProWoche, euro(r.euroProJahr)),
  ].join("\n");
}

function neueNummer(): string {
  const d = new Date();
  const zwei = (n: number) => String(n).padStart(2, "0");
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const zufall = Array.from(bytes, (b) => ZEICHEN[b % ZEICHEN.length]).join("");
  return `${BEFUND.nummer.praefix}-${d.getFullYear()}${zwei(d.getMonth() + 1)}${zwei(d.getDate())}-${zufall}`;
}

const heute = () => new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

export function einrichten(panel: HTMLElement): void {
  const feld = panel.querySelector<HTMLTextAreaElement>("textarea[data-ki-eingabe]");
  if (!feld) return;
  const finde = <T extends Element = HTMLElement>(auswahl: string) => panel.querySelector<T>(auswahl);
  const alle = <T extends Element = HTMLElement>(auswahl: string) => Array.from(panel.querySelectorAll<T>(auswahl));
  const ort = (name: string) => finde(`[data-ki-feld="${name}"]`);
  const zeile = (name: string) => finde(`[data-ki-zeile="${name}"]`);

  const zaehler = finde("[data-ki-zaehler]");
  const brancheFeld = finde<HTMLInputElement>("[data-roentgen-branche]");
  const teamFeld = finde<HTMLInputElement>("[data-roentgen-team]");
  const leer = finde("[data-ki-leer]");
  const schirm = finde("[data-roentgen-schirm]");
  const befundOrt = finde("[data-ki-vorschau]");
  const urteil = finde("[data-roentgen-urteil]");
  const knoepfe = finde("[data-roentgen-knoepfe]");
  const ausstellenKnopf = finde<HTMLButtonElement>("[data-befund-ausstellen]");
  const terminKnoepfe = alle<HTMLButtonElement>("[data-roentgen-termin]");
  const belegBereich = finde("[data-befund-bereich]");
  const zettel = finde("[data-befund-zettel]");
  const pdfKnopf = finde<HTMLButtonElement>("[data-befund-pdf]");
  const pdfStatus = finde("[data-befund-pdf-status]");
  const { beschreibungMin, beschreibungMax } = ROENTGEN.grenzen;

  const demo = demoSteuerung(panel, {
    demo: "roentgen",
    laufText: ROENTGEN.durchleuchtet,
    fertigText: () => ROENTGEN.fertig,
    // Feldfehler des Dienstes nennen das Feld im Satz (wie feldZurMeldung in termin.ts)
    feldBeiFehler: (f) => (/Teamgröße/.test(f.satz) ? teamFeld : /Branche/.test(f.satz) ? brancheFeld : feld),
  });

  /* Eingabe --------------------------------------------------------------------------------------------- */

  const zaehlen = () =>
    textSetzen(zaehler, `${ROENTGEN.eingabe.hilfe} ${ROENTGEN.eingabe.zaehler(ganzzahl(feld.value.length), ganzzahl(beschreibungMax))}`);
  let begonnen = false;
  feld.addEventListener("input", () => {
    zaehlen();
    // Leer getippt: Was jetzt kommt, ist nicht mehr gesprochen (detail von „Diagnose gestartet“)
    if (!feld.value.trim()) sprache?.zuruecksetzen();
    if (begonnen) return;
    begonnen = true;
    melde("Beschreibung begonnen");
  });
  zaehlen();

  const mikrofon = finde<HTMLButtonElement>("[data-ki-sprache]");
  const hinweisOrt = finde("[data-ki-sprache-hinweis]");
  const sprache =
    mikrofon && hinweisOrt
      ? spracheEinrichten({ demo: "roentgen", knopf: mikrofon, feld, hinweisOrt, zeile: finde("[data-ki-sprache-zeile]"), beiText: zaehlen })
      : null;

  for (const knopf of alle<HTMLButtonElement>("[data-roentgen-beispiel]")) {
    knopf.addEventListener("click", () => {
      const beispiel = ROENTGEN_BEISPIELE.find((b) => b.id === knopf.dataset.roentgenBeispiel);
      if (!beispiel) return;
      sprache?.stoppen();
      // Nur .value: kein input-Ereignis, also kein „Beschreibung begonnen“ für Text, den niemand getippt hat
      feld.value = beispiel.text;
      feld.removeAttribute("aria-invalid");
      sprache?.zuruecksetzen();
      zaehlen();
      melde("Beispiel gewählt", { detail: beispiel.id });
      demo.ansagen(ROENTGEN.beispielEingesetzt(beispiel.knopf));
    });
  }

  /* Ergebnisfläche ------------------------------------------------------------------------------------------ */

  let aktuell: { befund: Befund; rechnung: Rechnung | null; beschreibung: string } | null = null;
  let laufBegonnen = false;
  let gezeichnet = false;
  let schirmBis = 0;
  let schirmUhr = 0;
  let wartenderStand: unknown = undefined;

  const schirmAus = () => {
    window.clearTimeout(schirmUhr);
    schirmUhr = 0;
    schirmBis = 0;
    if (schirm) schirm.hidden = true;
  };

  const befundZeigen = () => {
    schirmAus();
    if (leer) leer.hidden = true;
    if (befundOrt) befundOrt.hidden = false;
  };

  // Alles leer, Platzhalter wieder an: Der Stream füllt die vorgezeichnete Fläche
  const leeren = () => {
    for (const element of alle("[data-ki-feld]")) sofort(element, "");
    for (const z of alle("[data-ki-zeile]")) z.hidden = false;
    befundOrt?.classList.remove("ki-roentgen__befund--fertig");
    urteil?.removeAttribute("data-stufe");
    if (knoepfe) knoepfe.hidden = true;
  };

  // Nichts Brauchbares da (Fehler ohne Teilstand, abgelehnt, unvollständig, themenfremd): wieder die leere Fläche
  const zurueckAufLeer = () => {
    schirmAus();
    leeren();
    gezeichnet = false;
    if (befundOrt) befundOrt.hidden = true;
    if (leer) leer.hidden = false;
  };

  const zeichnen = (b: Befund) => {
    gezeichnet = true;
    schreiben(ort("diagnose"), b.diagnose);
    schreiben(ort("bleibt"), b.bleibt);
    schreiben(ort("davor"), b.davor);
    for (let i = 0; i < SCHRITTE; i++) {
      schreiben(ort(`ist-${i}-schritt`), b.ist[i]?.schritt ?? "");
      schreiben(ort(`ist-${i}-bremse`), b.ist[i]?.bremse ?? "");
      schreiben(ort(`soll-${i}-schritt`), b.soll[i]?.schritt ?? "");
      schreiben(ort(`soll-${i}-hebel`), b.soll[i]?.hebel ?? "");
    }
    schreiben(ort("hebel"), b.hebel);
    schreiben(ort("fazit"), b.fazit);
  };

  const laufBeginnt = () => {
    // Erst jetzt leeren: Lehnt der Dienst vorher ab (400, 429), bleibt das vorige Ergebnis stehen
    laufBegonnen = true;
    aktuell = null;
    belegVerbergen();
    leeren();
    gezeichnet = false;
    wartenderStand = undefined;
    spiele("roentgen", { anim: true, einzeln: true });
    demo.ansagen(ROENTGEN.durchleuchtet);
    if (ruhig() || !schirm) {
      // Ohne Bewegung kein Leuchtschirm (der Klang ist dann nur der kurze Zap), gleich die vorgezeichnete Fläche
      befundZeigen();
      return;
    }
    if (leer) leer.hidden = true;
    if (befundOrt) befundOrt.hidden = true;
    // Aus hidden heraus starten die Animationen von vorn (Strahl, Blitz, Fund)
    schirm.hidden = false;
    schirmBis = performance.now() + SCHIRM_MS;
  };

  const standZeigen = (teil: unknown) => {
    const warten = schirmBis - performance.now();
    if (warten > 0) {
      wartenderStand = teil;
      schirmUhr ||= window.setTimeout(() => {
        befundZeigen();
        spiele("tippen");
        zeichnen(befundLesen(wartenderStand));
      }, warten);
      return;
    }
    befundZeigen();
    spiele("tippen");
    zeichnen(befundLesen(teil));
  };

  // Ausweichmodell: Vorschau leeren, der nächste Teilstand bringt sofort den vollständigen Stand
  const neuBeginnen = () => {
    wartenderStand = undefined;
    if (gezeichnet) leeren();
  };

  // Leere Zusatzzeilen verschwinden mit dem Ergebnis; Platzhalter gibt es nur, solange der Stream läuft
  const zeileZeigen = (name: string, text: string | undefined) => {
    const z = zeile(name);
    if (z) z.hidden = !text?.trim();
  };

  const zahlenZeigen = (r: Rechnung | null) => {
    const stufe = r ? STUFEN[r.stufe] : null;
    sofort(ort("stunden"), r ? ROENTGEN.kacheln.stunden(kommazahl(r.stundenProWoche), r.stundenProWoche) : "");
    sofort(ort("kosten"), r ? ROENTGEN.kacheln.euro(euro(r.euroProJahr)) : "");
    sofort(
      ort("rechenweg"),
      r ? ROENTGEN.kacheln.euroUnterzeile(kommazahl(r.stundenProWoche), ganzzahl(r.wochen), ganzzahl(r.stundensatz)) : "",
    );
    sofort(ort("dachzeile"), stufe?.dachzeile ?? "");
    sofort(ort("stufentitel"), stufe?.titel ?? "");
    if (r) urteil?.setAttribute("data-stufe", String(r.stufe));
    // Ohne Rechnung keine Kacheln: Die Seite rechnet nicht selbst nach
    const kacheln = zeile("kacheln");
    if (kacheln) kacheln.hidden = !r;
  };

  const ergebnisZeigen = (befund: Befund, rechnung: Rechnung | null) => {
    befundZeigen();
    zeichnen(befund);
    for (let i = 0; i < SCHRITTE; i++) {
      zeileZeigen(`ist-${i}-bremse`, befund.ist[i]?.bremse);
      zeileZeigen(`soll-${i}-hebel`, befund.soll[i]?.hebel);
    }
    zeileZeigen("bleibt", befund.bleibt);
    zeileZeigen("davor", befund.davor);
    zeileZeigen("altsystem", befund.bleibt || befund.davor);
    zeileZeigen("hebel", befund.hebel);
    befundOrt?.classList.add("ki-roentgen__befund--fertig");
    zahlenZeigen(rechnung);
    // Ehrlich auch nach unten: ab Stufe 2 ist der Termin der volle Knopf, darunter der Beleg
    const ernst = rechnung !== null && rechnung.stufe >= URTEIL_ROT_AB;
    if (ausstellenKnopf) {
      ausstellenKnopf.hidden = !rechnung;
      ausstellenKnopf.textContent = ROENTGEN.ausstellen;
      ausstellenKnopf.classList.toggle("retro-knopf--voll", !ernst);
    }
    for (const knopf of terminKnoepfe) {
      knopf.hidden = !rechnung;
      knopf.classList.toggle("retro-knopf--voll", ernst);
    }
    if (knoepfe) knoepfe.hidden = false;
  };

  /* Durchlauf ------------------------------------------------------------------------------------------------- */

  demo.formular.addEventListener("submit", async () => {
    sprache?.stoppen();
    const text = feld.value.trim();
    if (text.length < beschreibungMin) {
      spiele("ding");
      demo.meldung({ art: "warnung", satz: BROWSER_SAETZE.zuKurz });
      demo.ansagen(BROWSER_SAETZE.zuKurz);
      feld.setAttribute("aria-invalid", "true");
      feld.focus();
      return;
    }
    const branche = brancheFeld?.value.trim() ?? "";
    const team = teamFeld?.value.trim() ?? "";
    if (!(await demo.eigenenTextPruefen(branche ? `${text}\n${branche}` : text, feld))) return;
    const quelle = sprache?.benutzt() ? "Spracheingabe" : ROENTGEN_BEISPIELE.some((b) => b.text === text) ? "Beispiel" : "eigener Text";
    melde("Diagnose gestartet", { detail: quelle });
    laufBegonnen = false;
    const ergebnis = await demo.lauf(
      // Ob die Teamgröße passt (ganze Zahl, 1 bis 10.000), prüft der Dienst und nennt das Feld im Satz
      { beschreibung: text, branche: branche || null, teamgroesse: team ? Number(team) : null },
      { beiStart: laufBeginnt, beiStand: standZeigen, beiNeu: neuBeginnen },
    );
    if (!ergebnis.ok) {
      if (!laufBegonnen) return;
      // Abgelehnt oder unvollständig: Vorschau verwerfen. Sonst bleibt stehen, was schon da ist (Satz im Kasten).
      const code = ergebnis.fehler.code;
      if (code === "abgelehnt" || code === "unvollstaendig" || !gezeichnet) zurueckAufLeer();
      else schirmAus();
      return;
    }
    const roh = ergebnis.fertig.ergebnis;
    if (jsonWahr(roh, "themenfremd")) {
      zurueckAufLeer();
      const hinweis = jsonText(roh, "hinweis").trim() || BROWSER_SAETZE.themenfremd;
      demo.meldung({ art: "info", satz: hinweis });
      demo.ansagen(hinweis, true);
      return;
    }
    const befund = befundLesen(roh);
    const rechnung = rechnungLesen(ergebnis.fertig.rechnung);
    aktuell = { befund, rechnung, beschreibung: text };
    ergebnisZeigen(befund, rechnung);
    melde("Diagnose fertig", rechnung ? { wert: Math.min(40, Math.max(0, Math.round(rechnung.stundenProWoche))) } : undefined);
    spiele(rechnung && rechnung.stufe >= URTEIL_ROT_AB ? "achtung" : "hinweis");
    const kosten = rechnung ? ROENTGEN.kacheln.euro(euro(rechnung.euroProJahr)) : "";
    const titel = rechnung ? STUFEN[rechnung.stufe].titel : "";
    demo.ansagen([kosten ? `${ROENTGEN.fertig}: ${kosten}.` : `${ROENTGEN.fertig}.`, befund.diagnose, titel].filter(Boolean).join(" "), true);
  });

  finde<HTMLButtonElement>("[data-roentgen-nochmal]")?.addEventListener("click", () => {
    feld.focus();
    feld.select();
  });

  /* Termin mit Befund --------------------------------------------------------------------------------------- */

  // Nur feste Wörter an die Messung; den Text liest allein das Formular (seite.ts, termin.ts)
  const terminWuenschen = () => {
    if (!aktuell?.rechnung) return;
    melde("Termin mit Befund gewünscht");
    const block = befundBlock(aktuell.befund, aktuell.rechnung, aktuell.beschreibung);
    window.dispatchEvent(new CustomEvent<string>("anfrage:vorbelegen", { detail: block }));
  };
  for (const knopf of terminKnoepfe) knopf.addEventListener("click", terminWuenschen);

  /* Befund als Beleg und PDF ------------------------------------------------------------------------------- */

  let beleg: { nummer: string; datum: string } | null = null;
  let druckEnde = 0;
  let pdfLaeuft = false;

  function belegVerbergen(): void {
    beleg = null;
    window.clearTimeout(druckEnde);
    zettel?.classList.remove("wird-gedruckt");
    textSetzen(pdfStatus, "");
    if (belegBereich) belegBereich.hidden = true;
  }

  const belegFuellen = (befund: Befund, r: Rechnung, b: { nummer: string; datum: string }, beschreibung: string) => {
    const stufe = STUFEN[r.stufe];
    textSetzen(finde("[data-befund-nr]"), b.nummer);
    textSetzen(finde("[data-befund-datum]"), b.datum);
    textSetzen(finde("[data-befund-diagnose]"), befund.diagnose);
    const zelle = (text: string, zusatz: string, wort: string) => {
      const td = document.createElement("td");
      td.textContent = text;
      if (zusatz) {
        const klein = document.createElement("span");
        klein.className = "ki-roentgen__zusatz";
        klein.textContent = `${wort}: ${zusatz}`;
        td.append(klein);
      }
      return td;
    };
    finde("[data-befund-zeilen]")?.replaceChildren(
      ...Array.from({ length: SCHRITTE }, (_, i) => {
        const tr = document.createElement("tr");
        const nr = document.createElement("td");
        nr.className = "zettel__pos";
        nr.textContent = String(i + 1);
        tr.append(
          nr,
          zelle(befund.ist[i]?.schritt ?? "", befund.ist[i]?.bremse ?? "", ROENTGEN.ergebnis.bremse),
          zelle(befund.soll[i]?.schritt ?? "", befund.soll[i]?.hebel ?? "", ROENTGEN.ergebnis.hebel),
        );
        return tr;
      }),
    );
    // Rot ab Stufe 2 wie im Check, sonst Tinte; kurze Wörter nicht auf volle Breite ziehen
    zettel?.classList.toggle("stempel-blau", r.stufe < URTEIL_ROT_AB);
    finde<SVGTextElement>("[data-befund-stempel-oben]")?.setAttribute(
      "textLength",
      String(Math.min(214, BEFUND.stempelOben.length * 27)),
    );
    const unten = finde<SVGTextElement>("[data-befund-stempel-unten]");
    if (unten) {
      unten.textContent = stufe.stempelUnten;
      unten.setAttribute("textLength", String(Math.min(196, stufe.stempelUnten.length * 10.4)));
    }
    textSetzen(finde("[data-befund-stempel-text]"), BEFUND.stempelText(BEFUND.stempelOben, stufe.stempelUnten));
    textSetzen(finde("[data-befund-stunden]"), BEFUND.stunden(kommazahl(r.stundenProWoche)));
    textSetzen(finde("[data-befund-stundenjahr]"), BEFUND.stunden(ganzzahl(r.stundenProJahr)));
    textSetzen(finde("[data-befund-summe]"), euro(r.euroProJahr));
    textSetzen(finde("[data-befund-hinweis]"), BEFUND.hinweis(ganzzahl(r.stundensatz), ganzzahl(r.wochen)));
    textSetzen(finde("[data-befund-beschreibung]"), BEFUND.beschreibung(einzeilig(beschreibung, BEFUND.beschreibungMax)));
    textSetzen(finde("[data-befund-fusszeile]"), BEFUND.fusszeile(b.datum));
  };

  ausstellenKnopf?.addEventListener("click", () => {
    const a = aktuell;
    if (!a?.rechnung || !belegBereich) return;
    beleg = { nummer: neueNummer(), datum: heute() };
    belegFuellen(a.befund, a.rechnung, beleg, a.beschreibung);
    melde("Befund ausgestellt");
    belegBereich.hidden = false;
    textSetzen(pdfStatus, "");
    // Ohne Bewegung druckt der Klang nur eine Zeile (das Werk wählt die Kurzfassung)
    spiele("drucker", { anim: true, einzeln: true });
    if (zettel && !ruhig()) {
      zettel.classList.remove("wird-gedruckt");
      void zettel.offsetWidth;
      zettel.classList.add("wird-gedruckt");
      window.clearTimeout(druckEnde);
      druckEnde = window.setTimeout(() => zettel.classList.remove("wird-gedruckt"), 2000);
    }
    // Der Stempel landet mit dem Ende des Drucks (global.css), ohne Bewegung gleich
    spiele("stempel", { in: ruhig() ? 0.15 : 1.2, einzeln: true });
    ausstellenKnopf.textContent = ROENTGEN.neuAusstellen;
    finde("[data-befund-titel]")?.focus({ preventScroll: true });
    belegBereich.scrollIntoView({ block: "start", behavior: ruhig() ? "auto" : "smooth" });
    demo.ansagen(`${BEFUND.ausgestellt} ${BEFUND.stempelText(BEFUND.stempelOben, STUFEN[a.rechnung.stufe].stempelUnten)}`);
  });

  const befundDaten = (befund: Befund, r: Rechnung, b: { nummer: string; datum: string }, beschreibung: string): BefundDaten => ({
    nummer: b.nummer,
    datum: b.datum,
    diagnose: befund.diagnose,
    ist: befund.ist,
    soll: befund.soll,
    bleibt: befund.bleibt,
    davor: befund.davor,
    hebel: befund.hebel,
    fazit: befund.fazit,
    beschreibung: einzeilig(beschreibung, BEFUND.beschreibungMax),
    stufe: r.stufe,
    stundenWoche: kommazahl(r.stundenProWoche),
    stundenJahr: ganzzahl(r.stundenProJahr),
    euroJahr: euro(r.euroProJahr),
    stundensatz: ganzzahl(r.stundensatz),
    wochen: ganzzahl(r.wochen),
  });

  // Kein disabled während der Erzeugung, sonst landet der Tastaturfokus auf body
  pdfKnopf?.addEventListener("click", async () => {
    const a = aktuell;
    if (pdfLaeuft || !a?.rechnung || !beleg) return;
    pdfLaeuft = true;
    pdfKnopf.setAttribute("aria-disabled", "true");
    textSetzen(pdfStatus, BEFUND.pdf.wirdErstellt);
    try {
      const { befundPdfSpeichern } = await import("./befund-pdf");
      await befundPdfSpeichern(befundDaten(a.befund, a.rechnung, beleg, a.beschreibung));
      melde("Befund als PDF geladen");
      spiele("hinweis");
      textSetzen(pdfStatus, BEFUND.pdf.fertig);
    } catch {
      melde("PDF gescheitert");
      spiele("stopp");
      textSetzen(pdfStatus, BEFUND.pdf.fehler);
    } finally {
      pdfLaeuft = false;
      pdfKnopf.removeAttribute("aria-disabled");
    }
  });
}
