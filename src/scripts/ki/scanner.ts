/* Programm 1 im Abschnitt 07: Auftrags-Scanner ------------------------------------------------------------------
   Sie wählen eine Vorlage (Datei-Karten als Radiogruppe) oder fügen eigenen Text ein; POST {kiUrl}/scanner liefert
   den Auftrag erst als Teilstände (event: stand) und am Ende geprüft mit Rechnung (event: fertig, maßgeblich).
   Ein Lauf: Sobald der Dienst angenommen hat (start), fährt der Lichtbalken rund 1,1 s über die Vorlage, der Klang
   „scanner“ fährt mit. Erst danach wächst der Entwurf in drei Reitern: Auftrag (Kopf, Positionen, was zu klären
   ist), Antwort an den Kunden, zuletzt die Tafel „Was Sie das Abtippen kostet“, die der Regler mit den Richtwerten
   des Checks neu rechnet (data/richtwerte.ts, wie der Dienst). „Freigeben“ stempelt nur hier im Browser.
   Zustände, Statusleiste, Fehler je Code, Rest, Turnstile und Zeitlimits übernimmt demoSteuerung (anzeige.ts), die
   Texte stehen in data/ki-demos.ts. Was von der KI kommt, geht nur als Text ins DOM, nie als HTML oder Link.
   Gemessen wird nur mit festen Wörtern (README, „Nutzung der Seite“), nie Text, Antwort oder Länge. */

import { nutzung } from "../nutzung";
import { spiele } from "../klang";
import { ARBEITSWOCHEN, VORGAENGE_PRO_WOCHE, abtippKosten } from "../../data/richtwerte";
import { BROWSER_SAETZE, SCANNER, VORLAGEN, VORLAGE_EIGEN, istVorlageId, type Vorgang, type Vorlage, type VorlageId } from "../../data/ki-demos";
import { demoSteuerung, euro, ganzzahl, meldungVerbergen, meldungZeigen, ruhig, schreiben, sekunden, sofort } from "./anzeige";
import { MESSBEREICH, jsonListe, jsonObjekt, jsonText, jsonWahr, jsonZahl, type FertigDaten } from "./verbindung";

const BEREICH = MESSBEREICH.scanner;
type Aktion =
  | `Vorlage ${Vorlage["messname"]} gewählt`
  | "eigener Text begonnen"
  | "Auswertung gestartet"
  | "Auswertung fertig"
  | "Antwort-Mail kopiert";
// Nur feste Wörter; Wechselndes in detail (aus festen Listen) oder wert, nie Eingaben oder KI-Text
const melde = (aktion: Aktion, extra?: { wert?: number; detail?: string }) => nutzung(BEREICH, aktion, extra);

type Wahl = VorlageId | "eigen";
type Stempel = "entwurf" | "freigegeben";
type Spalte = "menge" | "einheit" | "artikel" | "artikelnummer" | "anmerkung";

// Der Lichtbalken braucht rund 1,1 s (das Rezept „scanner“ fährt von 0,04 bis 1,14 s); erst danach erscheint der
// Entwurf, damit es aussieht wie gelesen und dann getippt
const SCAN_MS = 1150;
// So lange steht „Kopiert“ im Knopf (wie beim Anfrageformular)
const RUECKMELDUNG_MS = 2200;
// Ansage der neuen Summe erst, wenn der Regler eine Weile ruht (wie die Tafel des Checks)
const ANSAGE_MS = 1500;

const SPALTEN: readonly Spalte[] = ["menge", "einheit", "artikel", "artikelnummer", "anmerkung"];
const DATUM = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

const istVorgang = (wert: string): wert is Vorgang => Object.hasOwn(SCANNER.vorgaenge, wert);

/** Text an einem Pfad wie „kunde.firma“; der Vorgang kommt als Wort aus der festen Liste, nie als Modelltext */
function pfadText(ergebnis: unknown, pfad: string): string {
  const [gruppe = "", feld] = pfad.split(".");
  if (feld) return jsonText(jsonObjekt(ergebnis, gruppe), feld);
  const text = jsonText(ergebnis, gruppe);
  if (gruppe !== "vorgang") return text;
  return istVorgang(text) ? SCANNER.vorgaenge[text] : "";
}

async function kopieren(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

interface Zeile {
  tr: HTMLTableRowElement;
  zellen: Record<Spalte, HTMLElement>;
  unklar: HTMLElement;
}

interface Punkt {
  li: HTMLLIElement;
  feld: HTMLElement;
  warum: HTMLElement;
}

export function einrichten(panel: HTMLElement): void {
  const pflicht = <T extends Element = HTMLElement>(auswahl: string): T => {
    const element = panel.querySelector<T>(auswahl);
    if (!element) throw new Error(`Auftrags-Scanner: ${auswahl} fehlt`);
    return element;
  };
  const feld = pflicht<HTMLTextAreaElement>("textarea[data-ki-eingabe]");
  const zaehler = pflicht("[data-ki-zaehler]");
  const karten = Array.from(panel.querySelectorAll<HTMLInputElement>("input[name='vorlage']"));
  const ansichten = Array.from(panel.querySelectorAll<HTMLElement>("[data-ki-ansicht]"));
  const vorschau = pflicht("[data-ki-scanner-vorschau]");
  const startKnopf = pflicht<HTMLButtonElement>("[data-ki-start]");
  const ausgang = pflicht("[data-ki-ausgang]");
  const leer = pflicht("[data-ki-leer]");
  const hinweisOrt = pflicht("[data-ki-hinweisort]");
  const ergebnisFlaeche = pflicht("[data-ki-ergebnis]");
  const reiterleiste = pflicht("[data-ki-reiterleiste]");
  const zeilenKoerper = pflicht<HTMLTableSectionElement>("[data-ki-positionen]");
  const offenListe = pflicht<HTMLUListElement>("[data-ki-offen]");
  const offenLeer = pflicht("[data-ki-offen-leer]");
  const freigabe = pflicht("[data-ki-freigabe]");
  const freigebenKnopf = pflicht<HTMLButtonElement>("[data-ki-freigeben]");
  const freigegebenNotiz = pflicht("[data-ki-freigegeben]");
  const stempel = pflicht<SVGSVGElement>("[data-ki-stempel]");
  const stempelWort = pflicht<SVGTextElement>("[data-ki-stempel-wort]");
  const stempelDatum = pflicht<SVGTextElement>("[data-ki-stempel-datum]");
  const stempelSatz = pflicht("[data-ki-stempel-text]");
  const kopierKnopf = pflicht<HTMLButtonElement>("[data-ki-kopieren]");
  const antwortWarten = pflicht("[data-ki-antwort-warten]");
  const kostenWarten = pflicht("[data-ki-kosten-warten]");
  const tafel = pflicht("[data-ki-tafel]");
  const euroOrt = pflicht("[data-ki-kosten-euro]");
  const unterOrt = pflicht("[data-ki-kosten-unter]");
  const regler = pflicht<HTMLInputElement>("[data-ki-regler]");
  const reglerZahl = pflicht("[data-ki-regler-zahl]");
  const reglerEinheit = pflicht("[data-ki-regler-einheit]");
  const rechenweg = pflicht("[data-ki-rechenweg]");
  const fussKi = pflicht("[data-ki-fuss-ki]");
  const fussMinuten = pflicht("[data-ki-fuss-minuten]");
  const weiter = pflicht("[data-ki-weiter]");
  const warnVorlage = pflicht<HTMLTemplateElement>("template[data-ki-warnzeichen]");
  // Werte im Auftrag und in der Antwort: der Pfad im Ergebnis steht am Platz, daneben ggf. die Marke „fehlt“
  const werte = Array.from(panel.querySelectorAll<HTMLElement>("[data-ki-wert]")).map((el) => ({
    el,
    pfad: el.dataset.kiWert ?? "",
    fehlt: el.parentElement?.querySelector<HTMLElement>("[data-ki-fehlt]") ?? null,
  }));
  const briefText = werte.find((w) => w.pfad === "antwort.text")?.el ?? null;
  const { textMin, textMax } = SCANNER.grenzen;

  const demo = demoSteuerung(panel, {
    demo: "scanner",
    laufText: SCANNER.liest,
    fertigText: SCANNER.fertig,
    // Nur ein eigener Text kann am Feld scheitern; bei Vorlagen bleibt der Fokus am Startknopf
    feldBeiFehler: () => (gewaehlt() === "eigen" ? feld : null),
  });

  /* Vorlagen ------------------------------------------------------------------------------------------------ */

  const gewaehlt = (): Wahl => {
    const wert = karten.find((k) => k.checked)?.value;
    return wert === "eigen" ? "eigen" : istVorlageId(wert) ? wert : "baustellen-mail";
  };

  const ansichtZeigen = (wahl: Wahl) => {
    for (const ansicht of ansichten) ansicht.hidden = ansicht.dataset.kiAnsicht !== wahl;
    // Ein Hinweis „zu kurz“ gilt nur für den eigenen Text
    if (wahl !== "eigen") feld.removeAttribute("aria-invalid");
  };

  for (const karte of karten) {
    karte.addEventListener("change", () => {
      if (!karte.checked) return;
      const wahl = gewaehlt();
      ansichtZeigen(wahl);
      spiele("papier");
      if (wahl !== "eigen") melde(`Vorlage ${VORLAGEN[wahl].messname} gewählt`);
    });
  }
  ansichtZeigen(gewaehlt());

  const zaehlen = () => {
    zaehler.textContent = SCANNER.eingabe.zaehler(ganzzahl(feld.value.length), ganzzahl(textMax));
  };
  let begonnen = false;
  feld.addEventListener("input", () => {
    zaehlen();
    if (begonnen) return;
    begonnen = true;
    melde("eigener Text begonnen");
  });
  zaehlen();

  /* Reiter im Ergebnis (Muster wie die Programmwahl in ki.ts) ------------------------------------------------- */

  const reiter = Array.from(reiterleiste.querySelectorAll<HTMLButtonElement>("[role='tab']"));

  const reiterWaehlen = (knopf: HTMLButtonElement | undefined, fokus = false) => {
    if (!knopf) return;
    for (const r of reiter) {
      const an = r === knopf;
      r.setAttribute("aria-selected", String(an));
      r.tabIndex = an ? 0 : -1;
      const ziel = r.getAttribute("aria-controls");
      const inhalt = ziel ? document.getElementById(ziel) : null;
      if (inhalt) inhalt.hidden = !an;
    }
    if (fokus) knopf.focus();
  };

  for (const r of reiter) {
    r.addEventListener("click", () => {
      // Leiser Klick wie bei der Programmwahl; der Reiter ist kein Retro-Knopf und klickt sonst nicht
      if (r.getAttribute("aria-selected") !== "true") spiele("klick");
      reiterWaehlen(r);
    });
  }
  reiterleiste.addEventListener("keydown", (event) => {
    const jetzt = reiter.findIndex((r) => r.getAttribute("aria-selected") === "true");
    let ziel = -1;
    if (event.key === "ArrowRight") ziel = (jetzt + 1) % reiter.length;
    else if (event.key === "ArrowLeft") ziel = (jetzt - 1 + reiter.length) % reiter.length;
    else if (event.key === "Home") ziel = 0;
    else if (event.key === "End") ziel = reiter.length - 1;
    if (ziel < 0) return;
    event.preventDefault();
    reiterWaehlen(reiter[ziel], true);
  });

  /* Auftrag zeichnen ---------------------------------------------------------------------------------------
     Jeder Teilstand ist der ganze bisherige Auftrag: Felder wachsen über die Schreibmaschine (anzeige.ts),
     Zeilen und offene Punkte kommen dazu, wenn die Liste wächst, und fallen weg, wenn sie schrumpft (Ausweichmodell).
     Erst das fertige Ergebnis setzt alles sofort und zeigt, was fehlt. */

  const warnzeichen = (): Node => warnVorlage.content.firstElementChild?.cloneNode(true) ?? document.createTextNode("");

  const zeilen: Zeile[] = [];
  const punkte: Punkt[] = [];

  const zeileAnhaengen = (nr: number): Zeile => {
    const tr = document.createElement("tr");
    tr.setAttribute("role", "row");
    const zelle = (spalte: keyof typeof SCANNER.positionen.spalten, rechts = false): HTMLElement => {
      const td = document.createElement("td");
      td.setAttribute("role", "cell");
      // Beschriftung für die Kartenansicht schmaler Fenster (CSS, attr())
      td.dataset.spalte = SCANNER.positionen.spalten[spalte];
      if (rechts) td.className = "rechts";
      tr.append(td);
      return td;
    };
    const textOrt = (td: HTMLElement): HTMLElement => td.appendChild(document.createElement("span"));
    zelle("pos", true).textContent = String(nr);
    const menge = textOrt(zelle("menge", true));
    const einheit = textOrt(zelle("einheit"));
    const artikel = textOrt(zelle("artikel"));
    const artikelnummer = textOrt(zelle("artikelnummer"));
    const hinweis = zelle("anmerkung");
    const unklar = document.createElement("span");
    unklar.className = "ki-tag ki-tag--gelb";
    unklar.hidden = true;
    unklar.append(warnzeichen(), SCANNER.positionen.unklar);
    hinweis.append(unklar);
    const anmerkung = textOrt(hinweis);
    zeilenKoerper.append(tr);
    const zeile: Zeile = { tr, zellen: { menge, einheit, artikel, artikelnummer, anmerkung }, unklar };
    zeilen.push(zeile);
    return zeile;
  };

  const punktAnhaengen = (): Punkt => {
    const li = document.createElement("li");
    const text = document.createElement("span");
    const feldOrt = document.createElement("strong");
    const warum = document.createElement("span");
    text.append(feldOrt, " ", warum);
    li.append(warnzeichen(), text);
    offenListe.append(li);
    const punkt: Punkt = { li, feld: feldOrt, warum };
    punkte.push(punkt);
    return punkt;
  };

  const zeichnen = (ergebnis: unknown, fertig: boolean) => {
    const setzen = fertig ? sofort : schreiben;
    for (const w of werte) {
      const text = pfadText(ergebnis, w.pfad);
      setzen(w.el, text);
      // „fehlt“ erst am Ende: Im Stream kann jedes Feld noch kommen
      if (w.fehlt) w.fehlt.hidden = !fertig || text.trim() !== "";
    }
    antwortWarten.hidden = pfadText(ergebnis, "antwort.text") !== "";

    const positionen = jsonListe(ergebnis, "positionen");
    positionen.forEach((p, i) => {
      const z = zeilen[i] ?? zeileAnhaengen(i + 1);
      const unklar = jsonWahr(p, "unklar");
      for (const spalte of SPALTEN) {
        const text = jsonText(p, spalte);
        // Leerwert der Tabelle erst am Ende; bei „unklar“ steht dort schon die Marke
        const leerWert = fertig && !text.trim() && !(spalte === "anmerkung" && unklar);
        setzen(z.zellen[spalte], leerWert ? SCANNER.positionen.leer : text);
        // Die Kartenansicht schmaler Fenster lässt leere Art.-Nr. und Hinweise weg
        z.zellen[spalte].parentElement?.toggleAttribute("data-ki-zelle-leer", leerWert);
      }
      z.unklar.hidden = !unklar;
    });
    zeilen.splice(positionen.length).forEach((z) => z.tr.remove());

    const fehlend = jsonListe(ergebnis, "fehlend");
    fehlend.forEach((f, i) => {
      const p = punkte[i] ?? punktAnhaengen();
      setzen(p.feld, jsonText(f, "feld"));
      setzen(p.warum, jsonText(f, "warum"));
    });
    punkte.splice(fehlend.length).forEach((p) => p.li.remove());
    offenLeer.hidden = !fertig || fehlend.length > 0;
  };

  const leeren = () => {
    for (const w of werte) {
      sofort(w.el, "");
      if (w.fehlt) w.fehlt.hidden = true;
    }
    zeilen.splice(0).forEach((z) => z.tr.remove());
    punkte.splice(0).forEach((p) => p.li.remove());
    offenLeer.hidden = true;
    antwortWarten.hidden = false;
  };

  /* Stempel ------------------------------------------------------------------------------------------------ */

  let freigegeben = false;

  const stempelSetzen = (art: Stempel, aufsetzen: boolean) => {
    const wort = SCANNER.stempel[art];
    const lang = wort.length > 8;
    // Kurze Wörter nicht auf volle Breite ziehen, lange wie FREIGEGEBEN kleiner und gestaucht (wie im Check)
    stempelWort.textContent = wort;
    stempelWort.setAttribute("font-size", lang ? "31" : "40");
    stempelWort.setAttribute("textLength", String(Math.min(214, wort.length * (lang ? 21 : 27))));
    const datum = DATUM.format(new Date());
    stempelDatum.textContent = datum;
    stempelDatum.setAttribute("textLength", String(Math.min(196, Math.round(datum.length * 10.4))));
    stempelSatz.textContent = SCANNER.stempelText[art];
    stempel.classList.toggle("ist-freigegeben", art === "freigegeben");
    stempel.classList.remove("ki-scanner--stempelt");
    if (!aufsetzen || ruhig()) return;
    // Klasse neu setzen, der Reflow dazwischen startet die Animation neu
    void stempel.getBoundingClientRect();
    stempel.classList.add("ki-scanner--stempelt");
  };

  freigebenKnopf.addEventListener("click", () => {
    if (freigegeben) return;
    freigegeben = true;
    stempelSetzen("freigegeben", true);
    spiele("stempel", { einzeln: true });
    // Fokus bleibt am Knopf (aria-disabled statt disabled), sonst fiele er auf body
    freigebenKnopf.setAttribute("aria-disabled", "true");
    freigegebenNotiz.hidden = false;
    demo.ansagen(SCANNER.ansagen.freigegeben);
  });

  /* Antwort kopieren ---------------------------------------------------------------------------------------- */

  let antwort = "";
  let rueckmeldungUhr = 0;

  const rueckmeldung = (text: string) => {
    kopierKnopf.textContent = text;
    window.clearTimeout(rueckmeldungUhr);
    rueckmeldungUhr = window.setTimeout(() => (kopierKnopf.textContent = SCANNER.antwort.kopieren), RUECKMELDUNG_MS);
  };

  kopierKnopf.addEventListener("click", async () => {
    if (!antwort) return;
    const ok = await kopieren(antwort);
    if (ok) {
      spiele("plopp");
      melde("Antwort-Mail kopiert");
    } else if (briefText) {
      // Ohne Zugriff auf die Zwischenablage: Text markieren, Strg+C bleibt
      window.getSelection()?.selectAllChildren(briefText);
    }
    rueckmeldung(ok ? SCANNER.antwort.kopiert : SCANNER.antwort.markiert);
    demo.ansagen(ok ? SCANNER.ansagen.kopiert : SCANNER.antwort.markiert);
  });

  /* Was Sie das Abtippen kostet ----------------------------------------------------------------------------
     Der Dienst rechnet mit 30 Vorgängen pro Woche (fertig.rechnung). Der Regler rechnet mit denselben Richtwerten
     neu; steht er auf dem Wert des Dienstes, gelten dessen Zahlen. */

  const kosten: { minuten: number; basis: number; vomDienst: { stundenProJahr: number; euroProJahr: number } | null } = {
    minuten: 0,
    basis: VORGAENGE_PRO_WOCHE,
    vomDienst: null,
  };
  let ansageUhr = 0;

  const kostenJetzt = () => {
    const { reglerMin, reglerMax } = SCANNER.kosten;
    const vorgaenge = Math.min(reglerMax, Math.max(reglerMin, Math.round(Number(regler.value)) || VORGAENGE_PRO_WOCHE));
    const k = vorgaenge === kosten.basis && kosten.vomDienst ? kosten.vomDienst : abtippKosten(kosten.minuten, vorgaenge);
    return { vorgaenge, ...k };
  };

  const kostenZeigen = () => {
    const k = kostenJetzt();
    euroOrt.textContent = euro(k.euroProJahr);
    unterOrt.textContent = SCANNER.kosten.darunter(k.vorgaenge, ganzzahl(k.stundenProJahr));
    reglerZahl.textContent = ganzzahl(k.vorgaenge);
    reglerEinheit.textContent = SCANNER.kosten.reglerEinheit(k.vorgaenge);
    regler.setAttribute("aria-valuetext", SCANNER.kosten.reglerWert(k.vorgaenge));
    const anteil = (k.vorgaenge - SCANNER.kosten.reglerMin) / (SCANNER.kosten.reglerMax - SCANNER.kosten.reglerMin);
    // Füllung der Spur wie bei den Reglern des Checks (CSSOM, kein style-Attribut im Markup)
    regler.style.setProperty("--anteil", `${(anteil * 100).toFixed(1)}%`);
    rechenweg.textContent = SCANNER.kosten.rechenweg(
      ganzzahl(k.vorgaenge),
      ganzzahl(kosten.minuten),
      ganzzahl(ARBEITSWOCHEN),
      ganzzahl(k.stundenProJahr),
      euro(k.euroProJahr),
    );
  };

  regler.addEventListener("input", kostenZeigen);
  regler.addEventListener("change", () => {
    window.clearTimeout(ansageUhr);
    ansageUhr = window.setTimeout(() => {
      const k = kostenJetzt();
      demo.ansagen(`${SCANNER.kosten.gross(euro(k.euroProJahr))} ${SCANNER.kosten.darunter(k.vorgaenge, ganzzahl(k.stundenProJahr))}`);
    }, ANSAGE_MS);
  });

  const tafelFuellen = (ergebnis: unknown, fertigDaten: FertigDaten) => {
    const rechnung = fertigDaten.rechnung;
    const minuten = jsonZahl(rechnung, "minutenVonHand") ?? jsonZahl(ergebnis, "minutenVonHand");
    // Ohne Minuten keine Rechnung; der Wartesatz wäre dann falsch, denn es kommt nichts mehr
    kostenWarten.hidden = true;
    if (minuten === null || minuten <= 0) return;
    kosten.minuten = minuten;
    kosten.basis = jsonZahl(rechnung, "vorgaengeProWoche") ?? VORGAENGE_PRO_WOCHE;
    const stundenProJahr = jsonZahl(rechnung, "stundenProJahr");
    const euroProJahr = jsonZahl(rechnung, "euroProJahr");
    kosten.vomDienst = stundenProJahr !== null && euroProJahr !== null ? { stundenProJahr, euroProJahr } : null;
    kostenZeigen();
    // Gemessen im Dienst; ohne Rechnung die Dauer aus fertig.messung
    const kiSekunden = jsonZahl(rechnung, "kiSekunden") ?? (fertigDaten.dauerMs ?? 0) / 1000;
    fussKi.textContent = SCANNER.kosten.fussKi(kiSekunden);
    const begruendung = jsonText(ergebnis, "begruendung").trim();
    fussMinuten.textContent = `${SCANNER.kosten.fussMinuten(ganzzahl(minuten))} ${begruendung}`.trim();
    tafel.hidden = false;
  };

  /* Ein Lauf ------------------------------------------------------------------------------------------------ */

  // Jeder Lauf hat eine Nummer: Was ein früherer Lauf noch vorhat (Uhren, späte Teilstände), fällt so weg
  let laufNr = 0;
  let scanEnde = 0;
  let wartend: unknown = null;
  let wartenUhr = 0;
  let begonnenImLauf = false;
  let gezeichnetImLauf = false;

  const wartenAbbrechen = () => {
    window.clearTimeout(wartenUhr);
    wartenUhr = 0;
    wartend = null;
  };

  const bisScanEnde = () =>
    new Promise<void>((weiter) => window.setTimeout(weiter, Math.max(0, scanEnde - performance.now())));

  // Ausgangslage: noch kein Ergebnis zu sehen
  const zuruecksetzen = () => {
    wartenAbbrechen();
    leeren();
    ergebnisFlaeche.hidden = true;
    meldungVerbergen(hinweisOrt);
    weiter.hidden = true;
    leer.hidden = false;
  };

  // Schmale Fenster: Steht die Ausgabe unter dem Bildschirm, während Besucher noch am Startknopf sind, holt der erste
  // Teilstand sie ins Bild. Wer inzwischen woanders liest, wird nicht weggezogen.
  const ausgangInsBild = () => {
    if (panel.hidden) return;
    const start = startKnopf.getBoundingClientRect();
    const amStart = start.bottom > 0 && start.top < window.innerHeight;
    if (amStart && ausgang.getBoundingClientRect().top > window.innerHeight * 0.8) {
      ausgang.scrollIntoView({ block: "start", behavior: ruhig() ? "auto" : "smooth" });
    }
  };

  // Beim ersten Bild eines Laufs, ob Teilstand oder (wenn alles auf einmal kam) gleich das Ergebnis
  const ersteZeichnung = () => {
    if (!gezeichnetImLauf) ausgangInsBild();
    gezeichnetImLauf = true;
  };

  const standZeichnen = (teil: unknown) => {
    zeichnen(teil, false);
    spiele("tippen");
    ersteZeichnung();
  };

  const beiStart = () => {
    laufNr += 1;
    begonnenImLauf = true;
    gezeichnetImLauf = false;
    // Erst jetzt hat der Dienst angenommen: Das vorige Ergebnis weicht dem neuen Entwurf
    wartenAbbrechen();
    leeren();
    leer.hidden = true;
    meldungVerbergen(hinweisOrt);
    ergebnisFlaeche.hidden = false;
    reiterWaehlen(reiter[0]);
    freigegeben = false;
    stempelSetzen("entwurf", false);
    freigabe.hidden = true;
    freigegebenNotiz.hidden = true;
    freigebenKnopf.removeAttribute("aria-disabled");
    antwort = "";
    kopierKnopf.hidden = true;
    tafel.hidden = true;
    kostenWarten.hidden = false;
    weiter.hidden = true;
    demo.ansagen(SCANNER.ansagen.start);

    // Lichtbalken: rund 1,1 s in Schritten; bei reduzierter Bewegung nur der kurze Klang
    spiele("scanner", { anim: true, einzeln: true });
    const dauer = ruhig() ? 0 : SCAN_MS;
    scanEnde = performance.now() + dauer;
    vorschau.classList.remove("ki-scanner--scannt");
    if (!dauer) return;
    void vorschau.offsetWidth;
    vorschau.classList.add("ki-scanner--scannt");
    const nr = laufNr;
    window.setTimeout(() => {
      if (nr === laufNr) vorschau.classList.remove("ki-scanner--scannt");
    }, dauer + 200);
  };

  const beiStand = (teil: unknown) => {
    const rest = scanEnde - performance.now();
    if (rest <= 0) {
      standZeichnen(teil);
      return;
    }
    // Während der Balken fährt, zählt nur der neueste Stand (jeder Stand ist der ganze bisherige Auftrag)
    wartend = teil;
    if (wartenUhr) return;
    const nr = laufNr;
    wartenUhr = window.setTimeout(() => {
      wartenUhr = 0;
      const t = wartend;
      wartend = null;
      if (nr === laufNr && t !== null) standZeichnen(t);
    }, rest);
  };

  // Ein Ausweichmodell setzt neu an: Vorschau leeren, der nächste Stand bringt den ganzen Auftrag
  const beiNeu = () => {
    wartenAbbrechen();
    leeren();
  };

  const auftragFertig = (ergebnis: unknown, fertigDaten: FertigDaten) => {
    zeichnen(ergebnis, true);
    stempelSetzen("entwurf", false);
    freigabe.hidden = false;
    antwort = pfadText(ergebnis, "antwort.text").trim();
    kopierKnopf.hidden = !antwort;
    tafelFuellen(ergebnis, fertigDaten);
    weiter.hidden = false;

    const positionen = jsonListe(ergebnis, "positionen");
    const offen = jsonListe(ergebnis, "fehlend").length;
    const warnungen = offen > 0 || positionen.some((p) => jsonWahr(p, "unklar"));
    melde("Auswertung fertig", {
      wert: sekunden(fertigDaten.dauerMs ?? 0),
      detail: warnungen ? "mit Warnhinweisen" : "vollständig",
    });
    // Einmal, nicht je Warnung
    spiele(warnungen ? "achtung" : "hinweis");
    demo.ansagen(SCANNER.ansagen.fertig(positionen.length, offen), true);
  };

  demo.formular.addEventListener("submit", async () => {
    const wahl = gewaehlt();
    let body: Record<string, unknown>;
    if (wahl === "eigen") {
      const text = feld.value.trim();
      if (text.length < textMin) {
        spiele("ding");
        demo.meldung({ art: "warnung", satz: BROWSER_SAETZE.zuKurz });
        feld.setAttribute("aria-invalid", "true");
        feld.focus();
        return;
      }
      // Grobe Prüfung auf echte Kontaktdaten nur beim eigenen Text; die Vorlagen sind erfunden
      if (!(await demo.eigenenTextPruefen(text, feld))) return;
      body = { art: "text", vorlage: null, text };
    } else {
      const vorlage = VORLAGEN[wahl];
      body = vorlage.art === "bild" ? { art: "bild", vorlage: vorlage.id } : { art: "text", vorlage: vorlage.id, text: vorlage.text };
    }
    melde("Auswertung gestartet", { detail: wahl === "eigen" ? VORLAGE_EIGEN.messname : VORLAGEN[wahl].messname });

    begonnenImLauf = false;
    const ergebnis = await demo.lauf(body, { beiStart, beiStand, beiNeu });
    // Abgelehnt vor dem Stream (400, 429 …): Das vorige Ergebnis bleibt stehen, die Steuerung zeigt den Grund
    if (!begonnenImLauf) return;
    const nr = laufNr;
    if (!ergebnis.ok) {
      wartenAbbrechen();
      const code = ergebnis.fehler.code;
      // Abgelehnt oder unvollständig: nichts davon zeigen. Sonst bleibt stehen, was schon da ist (die Meldung sagt,
      // dass es unvollständig ist), ohne Freigeben und Kopieren.
      if (code === "abgelehnt" || code === "unvollstaendig" || !gezeichnetImLauf) zuruecksetzen();
      else {
        // Es kommt nichts mehr: keine Wartesätze stehen lassen
        antwortWarten.hidden = true;
        kostenWarten.hidden = true;
      }
      return;
    }
    wartenAbbrechen();
    await bisScanEnde();
    if (nr !== laufNr) return;
    const daten = ergebnis.fertig.ergebnis;
    if (jsonWahr(daten, "themenfremd")) {
      // Kein Auftrag im Text: nur der Hinweis der KI, als Text
      leeren();
      ergebnisFlaeche.hidden = true;
      const hinweis = jsonText(daten, "hinweis").trim() || SCANNER.keinAuftrag;
      meldungZeigen(hinweisOrt, { art: "info", satz: hinweis });
      weiter.hidden = false;
      ersteZeichnung();
      spiele("hinweis");
      demo.ansagen(hinweis, true);
      return;
    }
    auftragFertig(daten, ergebnis.fertig);
    ersteZeichnung();
  });

  /* Weiter ------------------------------------------------------------------------------------------------- */

  pflicht<HTMLButtonElement>("[data-ki-andere]").addEventListener("click", () => {
    // Zur Radiogruppe: Pfeiltasten wählen die nächste Vorlage
    (karten.find((k) => k.checked) ?? karten[0])?.focus();
  });
  pflicht<HTMLButtonElement>("[data-ki-eigen]").addEventListener("click", () => {
    const eigen = karten.find((k) => k.value === "eigen");
    if (eigen && !eigen.checked) {
      eigen.checked = true;
      ansichtZeigen("eigen");
      spiele("papier");
    }
    feld.focus();
  });
}
