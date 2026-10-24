// Lesetisch: die aufgeschlagene Akte als Dialog (eingebunden von praxis.ts).
// Die .geschichte einer Akte wird aus ihrem <details> in den Dialog umgehängt und beim Zuklappen
// zurückgelegt; so gibt es jeden Text und jede id nur einmal. Ab 1280 × 780 px liegt sie als
// Doppelseite (eine Seite sichtbar, Register rechts), sonst im Fluss untereinander.
// Ereignisse für die Statistik (tracking.ts): praxis:aufgeschlagen und praxis:ende mit { akte, nr },
// praxis:lupe mit { akte }, praxis:verweis mit { von, nach, nr }. Für das weiche Scrollen (seite.ts):
// praxis:tisch mit { offen }.
import { spiele } from "./klang";

const ruhig = matchMedia("(prefers-reduced-motion: reduce)");
const doppelseiteMoeglich = matchMedia("(min-width: 1280px) and (min-height: 780px)");

const dialog = document.getElementById("lesetisch") as HTMLDialogElement;
const blatt = dialog.querySelector<HTMLElement>("[data-blatt]")!;
const titelNr = dialog.querySelector<HTMLElement>("[data-titel-nr]")!;
const titelName = dialog.querySelector<HTMLElement>("[data-titel-name]")!;
const zaehler = dialog.querySelector<HTMLElement>("[data-zaehler]")!;
const register = dialog.querySelector<HTMLOListElement>("[data-register]")!;
const zurueckKnopf = dialog.querySelector<HTMLButtonElement>("[data-zurueck]")!;
const weiterKnopf = dialog.querySelector<HTMLButtonElement>("[data-weiter]")!;
const zurueckWohin = dialog.querySelector<HTMLElement>("[data-zurueck-wohin]")!;
const weiterWohin = dialog.querySelector<HTMLElement>("[data-weiter-wohin]")!;
const stelle = dialog.querySelector<HTMLElement>("[data-stelle]")!;
const ansage = dialog.querySelector<HTMLElement>("[data-ansage]")!;
const hilfe = dialog.querySelector<HTMLElement>("[data-hilfe]")!;

const lupe = document.getElementById("lupe") as HTMLDialogElement;
const lupeBild = lupe.querySelector<HTMLImageElement>("[data-lupe-bild]")!;
const lupeTitel = lupe.querySelector<HTMLElement>("[data-lupe-titel]")!;
const lupeText = lupe.querySelector<HTMLElement>("[data-lupe-text]")!;
const lupeAnsage = lupe.querySelector<HTMLElement>("[data-lupe-ansage]")!;
const lupeMassstabKnopf = lupe.querySelector<HTMLButtonElement>("[data-lupe-massstab]")!;
const lupeFlaeche = lupe.querySelector<HTMLElement>("[data-lupe-flaeche]")!;

interface Offen {
  akte: string;
  geschichte: HTMLElement;
  heimat: HTMLElement;
  seiten: HTMLElement[];
  index: number;
  ausloeser: HTMLElement | null;
  /** Scrollposition der Seite beim Aufschlagen; dort steht sie still, bis der Lesetisch zuklappt */
  y: number;
}

let offen: Offen | null = null;
let beobachter: IntersectionObserver | null = null;

/* History ------------------------------------------------------------------------- */

// Was zu sehen ist, steht im History-Eintrag:
// - praxis: diese Akte ist offen. tiefe: so viele Akten-Einträge hat der Lesetisch angelegt (Klick,
//   Querverweis, nächste Akte); so weit geht er beim Zuklappen zurück. y: Stelle der Seite beim
//   Aufschlagen; nach Neu laden und Vor gilt sie, denn der Browser stellt die Seite erst nach und nach her.
// - lupe: dieses Bild ist groß (Adresse des Abzugs), blatt: wo Blatt und Seitenhälften dabei standen.
// - ziel: Eintrag für einen Link aus der Akte.
// - schritt: laufende Nummer; der Vergleich beim popstate zeigt, ob es zurück oder vor ging.
// Geht der Lesetisch selbst zurück, erwartet er das folgende popstate (erwartePop).
type Zustand = {
  praxis?: string;
  tiefe?: number;
  y?: number;
  lupe?: string;
  blatt?: { blatt: number; haelften: number[] };
  ziel?: boolean;
  schritt?: number;
};

/** Scrollpositionen der Seite, des Blatts (Fluss) und der Seitenhälften (Doppelseite) */
interface Stand {
  y: number;
  blatt?: number;
  haelften?: [HTMLElement, number][];
}

// Nach dem eigenen Schritt zurück: Fokus und Stand; danach: Der Lesetisch ging mit demselben Escape zu
// und räumt seine Einträge erst ab, wenn dieser Schritt angekommen ist
type Rueckweg = { fokus?: HTMLElement | null; stand?: Stand; ohneRahmen?: boolean };
let erwartePop: (Rueckweg & { danach?: Rueckweg }) | null = null;
const zustand = (): Zustand => history.state ?? {};
let schrittJetzt = zustand().schritt ?? 0;

function eintragen(z: Zustand, adresse: string): void {
  schrittJetzt = (zustand().schritt ?? 0) + 1;
  history.pushState({ ...z, schritt: schrittJetzt } satisfies Zustand, "", adresse);
}

// Was vom Eintrag bleibt, wenn er wieder die Seite ohne Akte zeigt
const ohneAkte = (z: Zustand) => {
  const { praxis: _p, tiefe: _t, y: _y, lupe: _l, blatt: _b, ziel: _z, ...rest } = z;
  return Object.keys(rest).length ? rest : null;
};

const haelftenJetzt = () => (offen ? Array.from(offen.seiten[offen.index].querySelectorAll<HTMLElement>(".seite__text, .seite__beleg")) : []);

// Die Seite steht, solange der Lesetisch offen ist, dort, wo er aufgeschlagen wurde
function standMerken(): Stand {
  return { y: offen?.y ?? scrollY, blatt: blatt.scrollTop, haelften: haelftenJetzt().map((h): [HTMLElement, number] => [h, h.scrollTop]) };
}

// Ohne Rahmen nach Zeiger: Safari fokussiert Knöpfe beim Klicken nicht und wertet den Fokus, den das
// Skript danach setzt, sonst als Tastaturfokus
const fokussieren = (el: HTMLElement | null | undefined, ohneRahmen = false) =>
  el?.focus(ohneRahmen ? { preventScroll: true, focusVisible: false } : { preventScroll: true });

// Nach einem Schritt in der History stellt der Browser Scrollpositionen her: die des Ziel-Eintrags,
// bei einem Anker (#check, ein Kapitel im Blatt) dessen Stelle; Safari schon vor popstate, Chrome erst
// danach. Gehalten wird die Stelle, die gelten soll, einige Bilder und mindestens 250 ms lang, außer
// jemand scrollt oder tippt vorher selbst.
function stelleHalten(stand: Stand): void {
  const beginn = performance.now();
  const eingaben = ["wheel", "touchstart", "pointerdown", "keydown"];
  let bilder = 0;
  let vorbei = false;
  const aufhoeren = () => {
    vorbei = true;
    eingaben.forEach((typ) => removeEventListener(typ, aufhoeren, true));
  };
  eingaben.forEach((typ) => addEventListener(typ, aufhoeren, { capture: true, passive: true }));
  const halten = () => {
    if (vorbei) return;
    if (Math.abs(scrollY - stand.y) > 1) scrollTo({ top: stand.y, behavior: "instant" });
    if (stand.blatt !== undefined && Math.abs(blatt.scrollTop - stand.blatt) > 1) blatt.scrollTo({ top: stand.blatt, behavior: "instant" });
    stand.haelften?.forEach(([h, oben]) => {
      if (Math.abs(h.scrollTop - oben) > 1) h.scrollTo({ top: oben, behavior: "instant" });
    });
    if (++bilder < 4 || performance.now() - beginn < 250) requestAnimationFrame(halten);
    else aufhoeren();
  };
  halten();
}

const gemeldet = new Set<string>();
const gelesen = new Set<string>();

const melden = (name: string, detail: Record<string, string>) => document.dispatchEvent(new CustomEvent(name, { detail }));

function einmalMelden(name: string, detail: Record<string, string>, schluessel: string): void {
  if (gemeldet.has(schluessel)) return;
  gemeldet.add(schluessel);
  melden(name, detail);
}

function ansagen(ziel: HTMLElement, text: string): void {
  ziel.textContent = "";
  requestAnimationFrame(() => (ziel.textContent = text));
}

const istDoppelseite = () => dialog.dataset.modus === "doppelseite";

// Die Seite hinter dem Dialog steht still: Die Breite der Scrollleiste wird als Rand ausgeglichen,
// damit nichts zur Seite rückt, und das weiche Scrollen hält an, auch mitten in einer Fahrt
function seiteFesthalten(an: boolean): void {
  const html = document.documentElement;
  if (an) html.style.setProperty("--leiste", `${Math.max(0, innerWidth - html.clientWidth)}px`);
  html.classList.toggle("praxis-offen", an);
  document.dispatchEvent(new CustomEvent("praxis:tisch", { detail: { offen: an } }));
}

/* Seiten ------------------------------------------------------------------------ */

function seitenTitel(i: number): string {
  if (!offen) return "";
  const s = offen.seiten[i];
  const n = offen.seiten.length - 2;
  if (s.dataset.seite === "aufschlag") return "Ausgangslage";
  if (s.dataset.seite === "bilanz") return "Bilanz";
  return `Kapitel ${i} von ${n}, ${s.dataset.wann}: ${s.dataset.titel}`;
}

const indexVon = (kapitel?: string) => (offen && kapitel ? Math.max(0, offen.seiten.findIndex((s) => s.dataset.seite === kapitel)) : 0);

function hashVon(i: number): string {
  if (!offen) return location.pathname + location.search;
  const id = offen.seiten[i]?.dataset.seite;
  return `#akte-${offen.akte}${id && id !== "aufschlag" ? `-${id}` : ""}`;
}

// Ohne Scrollen: Doppelseite und Fluss bringen die Seite selbst ins Bild, ein Sprung des Browsers
// würde das weiche Scrollen im Fluss abbrechen. ohneRahmen: Kam die Akte nicht über die Tastatur
// (Zeiger, Tiefenlink, Zurück des Browsers), zeigt der Titel keinen Fokusrahmen, bis jemand tippt.
function fokusTitel(seite: HTMLElement, ohneRahmen = false): void {
  fokussieren(seite.querySelector<HTMLElement>(".seite__titel"), ohneRahmen);
}

// Chrome und Safari lösen den Fokus, wenn sie zu einem Anker springen (Tiefenlink beim Laden) oder
// auf einen Eintrag mit Anker zurückgehen; liegt er danach nicht mehr im Dialog, geht er auf den
// Seitentitel, bei offener Lupe auf deren Titel
function fokusSichern(): void {
  requestAnimationFrame(() => {
    if (lupe.open) {
      if (!lupe.contains(document.activeElement)) lupeTitel.focus({ preventScroll: true });
    } else if (offen && dialog.open && !dialog.contains(document.activeElement)) {
      fokusTitel(offen.seiten[offen.index], true);
    }
  });
}

function vorladen(i: number): void {
  for (const j of [i, i + 1, i - 1]) {
    offen?.seiten[j]?.querySelectorAll<HTMLImageElement>("img[loading='lazy']").forEach((img) => (img.loading = "eager"));
  }
}

function registerAufbauen(): void {
  if (!offen) return;
  const n = offen.seiten.length - 2;
  register.replaceChildren(
    ...offen.seiten.map((s, i) => {
      const li = document.createElement("li");
      const knopf = document.createElement("button");
      knopf.type = "button";
      knopf.className = "lesetisch__reiter";
      knopf.dataset.ziel = String(i);
      const aussen = s.dataset.seite === "aufschlag" ? "A" : s.dataset.seite === "bilanz" ? "B" : "";
      knopf.textContent = aussen || String(i);
      // Der Buchstabe auf dem Reiter steht vorn im Namen, damit Sprachsteuerung ihn trifft
      knopf.setAttribute("aria-label", aussen ? `${aussen}: ${seitenTitel(i)}` : `Kapitel ${i} von ${n}: ${s.dataset.titel}, ${s.dataset.wann}`);
      li.append(knopf);
      return li;
    }),
  );
}

// Doppelseite: Läuft eine Seitenhälfte über, blendet sie am Rand aus, an dem es weitergeht
function mehrPruefen(): void {
  if (!offen || !istDoppelseite()) return;
  offen.seiten[offen.index]?.querySelectorAll<HTMLElement>(".seite__text, .seite__beleg").forEach((h) => {
    // Die Belegseite mit Lasche scrollt nicht; ihre Mehrhöhe ist nur die eingeschobene Lasche
    const scrollt = getComputedStyle(h).overflowY !== "hidden";
    h.toggleAttribute("data-mehr-oben", scrollt && h.scrollTop > 2);
    h.toggleAttribute("data-mehr-unten", scrollt && h.scrollTop + h.clientHeight < h.scrollHeight - 2);
  });
}

let mehrGeplant = 0;
const mehrPruefenBald = () => {
  cancelAnimationFrame(mehrGeplant);
  mehrGeplant = requestAnimationFrame(mehrPruefen);
};

// Kopf, Fuß, Register, Passermarke und Adresse an die aktuelle Seite anpassen
function anzeigen(i: number, still = false): void {
  if (!offen) return;
  const { seiten, geschichte, akte } = offen;
  const s = seiten[i];
  const n = seiten.length - 2;
  const id = s.dataset.seite;
  zaehler.textContent = id === "aufschlag" ? "Ausgangslage" : id === "bilanz" ? "Bilanz" : `Kapitel ${i} von ${n}`;
  stelle.textContent = id === "aufschlag" ? "Ausgangslage" : id === "bilanz" ? "Bilanz" : `${i} / ${n}`;
  register.querySelectorAll<HTMLButtonElement>(".lesetisch__reiter").forEach((r, j) => {
    if (j === i) r.setAttribute("aria-current", "step");
    else r.removeAttribute("aria-current");
  });
  // Ist von einem Kapitel nur das Jahr bekannt, hat es keine Lage auf der Spur: Die Marke blendet aus
  const passer = geschichte.querySelector<HTMLElement>("[data-passer]");
  if (passer) {
    passer.toggleAttribute("data-ohne", !s.dataset.pos);
    if (s.dataset.pos) passer.style.setProperty("--pos", s.dataset.pos);
  }

  // Wird „Zurück“ an der Ausgangslage abgeschaltet, während es den Fokus hat, geht er auf den Seitentitel
  if (i === 0 && document.activeElement === zurueckKnopf) fokusTitel(s);
  zurueckKnopf.disabled = i === 0;
  zurueckWohin.textContent = i > 0 ? `: ${seiten[i - 1].dataset.kurz}` : "";
  const naechste = geschichte.querySelector<HTMLAnchorElement>("[data-naechste]");
  if (i < seiten.length - 1) {
    weiterWohin.textContent = `: ${seiten[i + 1].dataset.kurz}`;
    delete weiterKnopf.dataset.naechste;
  } else {
    weiterWohin.textContent = naechste ? `: ${naechste.textContent?.replace(/^Nächste Akte:\s*/, "")}` : "";
    weiterKnopf.dataset.naechste = naechste?.dataset.naechste ?? "";
  }
  vorladen(i);
  if (!still) history.replaceState(history.state, "", hashVon(i));
  if (id === "bilanz") {
    gelesen.add(akte);
    gelesenZeigen(akte);
    einmalMelden("praxis:ende", { akte, nr: geschichte.dataset.nr ?? "" }, `ende:${akte}`);
  }
  mehrPruefen();
}

function gehe(i: number, o: { sofort?: boolean; fokus?: boolean; still?: boolean } = {}): void {
  if (!offen) return;
  const { seiten } = offen;
  const ziel = Math.max(0, Math.min(seiten.length - 1, i));
  const alt = offen.index;
  offen.index = ziel;
  const seite = seiten[ziel];
  let fokusVerschoben = false;
  if (istDoppelseite()) {
    const fokusWeg = seiten.some((s, j) => j !== ziel && s.contains(document.activeElement));
    seiten.forEach((s, j) => {
      s.hidden = j !== ziel;
      s.removeAttribute("data-umblaettern");
    });
    seite.querySelectorAll<HTMLElement>(".seite__text, .seite__beleg").forEach((h) => (h.scrollTop = 0));
    if (!o.sofort && alt !== ziel) {
      spiele("papier");
      if (!ruhig.matches) {
        seite.dataset.umblaettern = ziel > alt ? "vor" : "zurueck";
        window.setTimeout(() => seite.removeAttribute("data-umblaettern"), 420);
      }
    }
    fokusVerschoben = !!(o.fokus || fokusWeg);
  } else {
    if (o.sofort && ziel === 0) blatt.scrollTop = 0;
    else seite.scrollIntoView({ block: "start", behavior: o.sofort || ruhig.matches ? "auto" : "smooth" });
    fokusVerschoben = !!o.fokus;
  }
  if (fokusVerschoben) fokusTitel(seite);
  anzeigen(ziel, o.sofort);
  // Wandert der Fokus auf den Seitentitel, liest der Screenreader ihn ohnehin vor; das gilt auch, wenn
  // anzeigen() ihn vom abgeschalteten „Zurück“ dorthin geholt hat
  const titelHatFokus = document.activeElement === seite.querySelector(".seite__titel");
  if (!o.still && !o.sofort && !fokusVerschoben && !titelHatFokus) ansagen(ansage, seitenTitel(ziel));
}

const weiterBlaettern = (fokus = false) => {
  if (!offen) return;
  if (offen.index < offen.seiten.length - 1) gehe(offen.index + 1, { fokus });
  else if (weiterKnopf.dataset.naechste) wechseln(weiterKnopf.dataset.naechste);
};
const zurueckBlaettern = (fokus = false) => offen && offen.index > 0 && gehe(offen.index - 1, { fokus });

/* Modus: Doppelseite oder Fluss --------------------------------------------------- */

const flussAmEnde = () => blatt.scrollTop + blatt.clientHeight >= blatt.scrollHeight - 4;

function modusSetzen(): void {
  if (!offen) return;
  const doppelseite = doppelseiteMoeglich.matches;
  dialog.dataset.modus = doppelseite ? "doppelseite" : "fluss";
  hilfe.textContent = doppelseite
    ? "Mit den Pfeiltasten blättern, Escape klappt die Akte zu."
    : "Die Kapitel stehen untereinander. Die Pfeiltasten springen von Kapitel zu Kapitel, Escape klappt die Akte zu.";
  beobachter?.disconnect();
  beobachter = null;
  if (doppelseite) {
    offen.seiten.forEach((s, j) => (s.hidden = j !== offen!.index));
    return;
  }
  offen.seiten.forEach((s) => (s.hidden = false));
  // Im Fluss bestimmt die Seite im oberen Viertel Kopf, Fuß und Passermarke; ganz unten ist es die
  // letzte, auch wenn sie zu kurz ist, um das obere Viertel zu erreichen
  beobachter = new IntersectionObserver(
    (eintraege) => {
      if (!offen) return;
      for (const e of eintraege) {
        if (!e.isIntersecting) continue;
        const i = flussAmEnde() ? offen.seiten.length - 1 : offen.seiten.indexOf(e.target as HTMLElement);
        if (i >= 0 && i !== offen.index) {
          offen.index = i;
          anzeigen(i);
        }
      }
    },
    { root: blatt, rootMargin: "-25% 0px -70% 0px" },
  );
  offen.seiten.forEach((s) => beobachter!.observe(s));
}

function flussEndePruefen(): void {
  if (!offen || istDoppelseite() || !flussAmEnde()) return;
  const letzte = offen.seiten.length - 1;
  if (offen.index !== letzte) {
    offen.index = letzte;
    anzeigen(letzte);
  }
}

/* Öffnen, wechseln, schließen ------------------------------------------------------ */

function einhaengen(akte: string, ausloeser: HTMLElement | null, y: number): Offen | null {
  const heimat = document.getElementById(`akte-${akte}-inhalt`);
  const geschichte = heimat?.querySelector<HTMLElement>(":scope > .geschichte");
  if (!heimat || !geschichte) return null;
  blatt.append(geschichte);
  const neu: Offen = {
    akte,
    geschichte,
    heimat,
    seiten: Array.from(geschichte.querySelectorAll<HTMLElement>(":scope > .geschichte__seiten > .seite")),
    index: 0,
    ausloeser: ausloeser ?? document.querySelector<HTMLElement>(`[data-akte-oeffnen="${akte}"]`),
    y,
  };
  offen = neu;
  titelNr.textContent = `Akte ${geschichte.dataset.nr}`;
  titelName.textContent = geschichte.dataset.name ?? "";
  dialog.setAttribute("aria-label", `Akte ${geschichte.dataset.nr}: ${geschichte.dataset.name}`);
  geschichte.querySelectorAll<HTMLButtonElement>("[data-vorher]").forEach((b) => (b.hidden = false));
  registerAufbauen();
  return neu;
}

// Die Geschichte geht in ihr <details> zurück, ohne Spuren des Lesetischs
function zuruecklegen(): void {
  if (!offen) return;
  const { geschichte, heimat } = offen;
  beobachter?.disconnect();
  beobachter = null;
  geschichte.querySelectorAll<HTMLElement>(".seite").forEach((s) => {
    s.hidden = false;
    s.removeAttribute("data-umblaettern");
  });
  geschichte.querySelectorAll<HTMLElement>("[data-mehr-oben], [data-mehr-unten]").forEach((h) => {
    h.removeAttribute("data-mehr-oben");
    h.removeAttribute("data-mehr-unten");
  });
  geschichte.querySelectorAll<HTMLElement>(".durchschlag--lasche[data-offen]").forEach((l) => l.removeAttribute("data-offen"));
  geschichte.querySelectorAll<HTMLButtonElement>("[data-vorher]").forEach((b) => {
    b.hidden = true;
    b.textContent = "Vorher ansehen";
  });
  heimat.append(geschichte);
}

/** art: klick (neuer History-Eintrag), tiefenlink (Adresse beim Laden), historie (Zurück oder Vor
 *  des Browsers auf einen Akten-Eintrag, der schon besteht); zeiger: der Klick kam von Maus oder Finger */
export function oeffnen(akte: string, kapitel?: string, ausloeser?: HTMLElement, art: "klick" | "tiefenlink" | "historie" = "klick", zeiger = false): void {
  if (offen) {
    if (offen.akte !== akte) wechseln(akte, kapitel);
    else gehe(indexVon(kapitel), { fokus: true });
    return;
  }
  const z = zustand();
  // Ohne Klick gilt die Stelle aus dem Eintrag, sofern er eine kennt: Beim Laden und beim Schritt durch
  // die History stellt der Browser die Seite erst nach und nach her
  const y = art !== "klick" && typeof z.y === "number" ? z.y : scrollY;
  const o = einhaengen(akte, ausloeser ?? null, y);
  if (!o) return;
  seiteFesthalten(true);
  dialog.showModal();
  const i = indexVon(kapitel);
  o.index = i;
  modusSetzen();
  gehe(i, { sofort: true, still: true });
  // Der Fokus liegt auf der Seite selbst: Pfeile, Bild ab und Leertaste scrollen sie dann sofort
  fokusTitel(o.seiten[i], art !== "klick" || zeiger);
  if (art === "klick") {
    eintragen({ praxis: akte, tiefe: 1, y }, hashVon(i));
  } else if (art === "tiefenlink") {
    history.replaceState({ ...z, praxis: akte, y } satisfies Zustand, "", hashVon(i));
    // Der Sprung zum Anker nach dem Laden löst den Fokus; danach wird er neu gesetzt
    if (document.readyState === "complete") fokusSichern();
    else {
      addEventListener("DOMContentLoaded", () => setTimeout(fokusSichern), { once: true });
      addEventListener("load", fokusSichern, { once: true });
    }
  } else {
    fokusSichern();
  }
  // Neu laden oder Vor in einen Lupen-Eintrag: Der Eintrag sagt, welches Bild groß war
  if (art !== "klick" && z.lupe) lupeWiederOeffnen(z.lupe, z.blatt);
  spiele("papier");
  einmalMelden("praxis:aufgeschlagen", { akte, nr: o.geschichte.dataset.nr ?? "" }, `auf:${akte}`);
}

/** verweis: über einen Querverweis; historie: Zurück oder Vor des Browsers in den Eintrag einer
 *  anderen Akte, der schon besteht. Sonst bekommt jede Akte einen eigenen Eintrag. */
function wechseln(akte: string, kapitel?: string, o: { verweis?: boolean; historie?: boolean } = {}): void {
  if (!offen) return oeffnen(akte, kapitel);
  const { akte: von, ausloeser, y } = offen;
  zuruecklegen();
  // Beim Zuklappen geht der Fokus dorthin zurück, wo die erste Akte aufgeschlagen wurde
  const neu = einhaengen(akte, ausloeser, y);
  if (!neu) return;
  const i = indexVon(kapitel);
  neu.index = i;
  modusSetzen();
  gehe(i, { sofort: true, still: true });
  fokusTitel(neu.seiten[i], o.historie);
  // Der Seitentitel kommt mit dem Fokus; anzusagen bleibt, dass es eine andere Akte ist
  ansagen(ansage, `Akte ${neu.geschichte.dataset.nr}, ${neu.geschichte.dataset.name}`);
  if (o.historie) fokusSichern();
  else eintragen({ praxis: akte, tiefe: (zustand().tiefe ?? 0) + 1, y }, hashVon(i));
  spiele("papier");
  const nr = neu.geschichte.dataset.nr ?? "";
  if (o.verweis) einmalMelden("praxis:verweis", { von, nach: akte, nr }, `verweis:${von}:${akte}`);
  einmalMelden("praxis:aufgeschlagen", { akte, nr }, `auf:${akte}`);
}

type Grund = "knopf" | "escape" | "daneben" | "ziel" | "historie" | "vor";

// ziel: Abschnitt der Seite, zu dem ein Link aus der Akte führt (Erstgespräch, Zusagen).
// historie: Zurück des Browsers auf die Seite; vor: Vor des Browsers aus der Akte hinaus.
// ohneRahmen: per Zeiger zugeklappt, der Fokus kommt ohne Rahmen an.
function schliessen(grund: Grund, ziel?: HTMLElement | null, ohneRahmen = false): void {
  if (!offen) return;
  const { ausloeser, y } = offen;
  lupeSchliessen(true);
  zuruecklegen();
  offen = null;
  dialog.close();
  seiteFesthalten(false);
  const z = zustand();
  const hinaus = grund === "ziel" || grund === "vor";
  // Zugeklappt wird, wo die Mappe liegt. Safari stellt beim Schritt zurück schon vor popstate die
  // Stelle des Ziel-Eintrags her, bei einem Anker (#check) dessen Stelle.
  if (!hinaus && Math.abs(scrollY - y) > 1) scrollTo({ top: y, behavior: "instant" });
  if (ziel) {
    // Lenis scrollt weich dorthin, beim Vor stellt der Browser die Stelle her; der Fokus geht mit,
    // damit Tab dort weitermacht
    if (!ziel.hasAttribute("tabindex")) ziel.tabIndex = -1;
    fokussieren(ziel, ohneRahmen);
  } else if (ausloeser) {
    // Liegt der Knopf nicht im Bild (Tiefenlink, Sprung in eine andere Akte), erst hinscrollen
    const lage = ausloeser.getBoundingClientRect();
    if (!hinaus && (lage.bottom < 0 || lage.top > innerHeight)) ausloeser.scrollIntoView({ block: "center" });
    fokussieren(ausloeser, ohneRahmen);
    // Nach Zurück des Browsers löst Chrome den Fokus noch einmal, wenn der Eintrag einen Anker hat
    if (grund === "historie" || grund === "vor") requestAnimationFrame(() => ausloeser.focus({ preventScroll: true }));
  }
  const stand: Stand = { y: scrollY };
  if (grund === "ziel") {
    // Ein Link aus der Akte wird ein neuer Eintrag wie jeder Anker: Zurück schlägt die Akte an
    // derselben Stelle wieder auf, Vor führt wieder zum Ziel
    eintragen({ ziel: true }, ziel ? `#${ziel.id}` : location.pathname + location.search);
  } else if (grund === "vor") {
    // Liegt das Ziel nicht im Bild, wenn der Browser fertig ist, geht es selbst dorthin
    if (ziel) {
      window.setTimeout(() => {
        const lage = ziel.getBoundingClientRect();
        if (lage.bottom < 0 || lage.top > innerHeight) ziel.scrollIntoView({ block: "start" });
      }, 300);
    }
  } else if (grund === "historie") {
    stelleHalten(stand);
  } else if (erwartePop) {
    // Ein eigener Schritt zurück ist schon unterwegs: Ohne Nutzereingabe (nach Neu laden oder Vor)
    // schließt ein Escape Lupe und Lesetisch zugleich. Abgeräumt wird erst, wenn dieser Schritt da
    // ist; zwei Sprünge auf einmal führten in Chrome aus der Seite hinaus.
    erwartePop.danach = { fokus: ausloeser, stand, ohneRahmen };
  } else {
    // Eigene Einträge wieder abräumen (Lupe, Akten); kam die Akte per Tiefenlink, gibt es davor keinen
    // Eintrag dieser Seite, dann wird ihr Eintrag zur Seite ohne Anker
    const zurueck = (z.lupe ? 1 : 0) + (z.tiefe ?? 0);
    if (zurueck) {
      erwartePop = { fokus: ausloeser, stand, ohneRahmen };
      history.go(-zurueck);
    } else {
      history.replaceState(ohneAkte(z), "", location.pathname + location.search);
    }
  }
  spiele("papier");
}

function gelesenZeigen(akte: string): void {
  const mappe = document.getElementById(`akte-${akte}`);
  const vermerk = mappe?.querySelector<HTMLElement>(".akte__gelesen");
  if (vermerk) vermerk.hidden = false;
  const leer = document.querySelector<HTMLElement>("[data-akte-leertext]");
  if (leer && gelesen.size >= 3) {
    leer.textContent = "Drei Akten gelesen, die vierte ist Ihre. Blatt\u00a01 ist ein Gespräch von 15\u00a0Minuten, kostenlos und unverbindlich.";
  }
}

/* Vorher-Lasche ------------------------------------------------------------------ */

// Die Beschriftung sagt, was der Knopf als Nächstes tut; den Vorher-Text lesen Screenreader ohnehin
function vorherUmschalten(knopf: HTMLButtonElement): void {
  const lasche = knopf.closest<HTMLElement>(".durchschlag--lasche");
  if (!lasche) return;
  const auf = !lasche.hasAttribute("data-offen");
  lasche.toggleAttribute("data-offen", auf);
  knopf.textContent = auf ? "Heute ansehen" : "Vorher ansehen";
  spiele("papier");
}

/* Lupe --------------------------------------------------------------------------- */

let lupeListe: HTMLAnchorElement[] = [];
let lupeIndex = 0;
let lupeAusloeser: HTMLAnchorElement | null = null;
let lupeLadung = 0;
let lupeStand: Stand | undefined;

const bildVon = (link: HTMLAnchorElement) => link.getAttribute("href") ?? "";

function lupeMassstab(an: boolean, punkt?: { x: number; y: number }): void {
  const vorher = lupeBild.getBoundingClientRect();
  lupe.dataset.massstab = an ? "1" : "0";
  lupeMassstabKnopf.setAttribute("aria-pressed", String(an));
  // Die Fläche ist nur zum Verschieben ein Tab-Stopp
  lupeFlaeche.tabIndex = an ? 0 : -1;
  // Eingepasst: Ragt das Bild über die Seiten (Handy hochkant), steht seine Mitte im Bild
  if (!an) return lupeFlaeche.scrollTo((lupeFlaeche.scrollWidth - lupeFlaeche.clientWidth) / 2, 0);
  // Der angeklickte Punkt (über den Knopf: die Bildmitte) bleibt beim Vergrößern an seiner Stelle
  const flaeche = lupeFlaeche.getBoundingClientRect();
  const fx = punkt ? (punkt.x - vorher.left) / vorher.width : 0.5;
  const fy = punkt ? (punkt.y - vorher.top) / vorher.height : 0.5;
  const zielX = punkt ? punkt.x : flaeche.left + flaeche.width / 2;
  const zielY = punkt ? punkt.y : flaeche.top + flaeche.height / 2;
  const nachher = lupeBild.getBoundingClientRect();
  lupeFlaeche.scrollTo(
    lupeFlaeche.scrollLeft + nachher.left + fx * nachher.width - zielX,
    lupeFlaeche.scrollTop + nachher.top + fy * nachher.height - zielY,
  );
  // Danach verschieben die Pfeiltasten das Bild
  lupeFlaeche.focus({ preventScroll: true });
}

function lupeZeigen(): void {
  const link = lupeListe[lupeIndex];
  if (!link) return;
  const vorlage = link.closest("figure")?.querySelector<HTMLImageElement>("img");
  // Sofort das Bild aus dem Abzug, wenn es schon geladen ist; die große Fassung ersetzt es, sobald sie
  // da ist. Sonst bleibt die Fläche leer, bis das Bild da ist: Der Browser zeigte so lange das vorige.
  const ladung = ++lupeLadung;
  const sofort = vorlage?.complete && vorlage.naturalWidth ? vorlage.currentSrc : "";
  lupeBild.toggleAttribute("data-laedt", !sofort);
  lupeBild.src = sofort || link.href;
  lupeBild.alt = vorlage?.alt ?? "";
  const breite = Number(link.dataset.breite) || 0;
  const hoehe = Number(link.dataset.hoehe) || 0;
  lupeBild.width = breite;
  lupeBild.height = hoehe;
  if (breite && hoehe) {
    lupeBild.style.setProperty("--sv", String(breite / hoehe));
    lupeBild.style.setProperty("--breite", `${breite}px`);
  }
  lupeTitel.textContent = `Bild ${lupeIndex + 1} von ${lupeListe.length}`;
  lupeText.textContent = link.dataset.lupeText ?? "";
  lupeMassstab(false);
  if (!sofort) {
    const fertig = () => ladung === lupeLadung && lupeBild.removeAttribute("data-laedt");
    lupeBild.decode().then(fertig, fertig);
  } else if (lupeBild.src !== link.href) {
    const gross = new Image();
    gross.src = link.href;
    gross.decode().then(
      () => {
        if (ladung === lupeLadung && lupe.open) lupeBild.src = link.href;
      },
      () => {},
    );
  }
}

// neuerEintrag: false, wenn Vor des Browsers oder Neu laden in einen Lupen-Eintrag führt, der schon besteht
function lupeOeffnen(link: HTMLAnchorElement, neuerEintrag = true): void {
  const bereich = offen?.geschichte ?? document;
  lupeListe = Array.from(bereich.querySelectorAll<HTMLAnchorElement>("a[data-lupe]"));
  lupeIndex = Math.max(0, lupeListe.indexOf(link));
  lupeAusloeser = link;
  // Geschlossen wird mit einem Schritt zurück; dabei bleiben Seite, Blatt und Seitenhälften stehen
  lupeStand = standMerken();
  lupe.showModal();
  lupeZeigen();
  lupeTitel.focus({ preventScroll: true });
  if (neuerEintrag) {
    const gemerkt = { blatt: lupeStand.blatt ?? 0, haelften: (lupeStand.haelften ?? []).map(([, oben]) => oben) };
    eintragen({ ...zustand(), lupe: bildVon(link), blatt: gemerkt }, location.href);
  }
  einmalMelden("praxis:lupe", { akte: offen?.akte ?? "" }, "lupe");
}

// Vor in einen Lupen-Eintrag oder Neu laden bei offener Lupe: dasselbe Bild wieder groß, auf seiner
// Seite. Blatt und Seitenhälften stehen, wo sie beim Öffnen der Lupe standen; der Browser hat sie
// inzwischen womöglich zum Kapitelanker geschoben.
function lupeWiederOeffnen(bild: string, gemerkt?: Zustand["blatt"]): void {
  if (!offen) return;
  const link = Array.from(offen.geschichte.querySelectorAll<HTMLAnchorElement>("a[data-lupe]")).find((a) => bildVon(a) === bild);
  if (!link) return fokusSichern();
  const seite = offen.seiten.findIndex((s) => s.contains(link));
  if (seite >= 0 && seite !== offen.index) {
    if (istDoppelseite()) gehe(seite, { sofort: true, still: true });
    else {
      offen.index = seite;
      anzeigen(seite, true);
    }
  }
  if (gemerkt) {
    blatt.scrollTo({ top: gemerkt.blatt, behavior: "instant" });
    haelftenJetzt().forEach((h, j) => h.scrollTo({ top: gemerkt.haelften[j] ?? 0, behavior: "instant" }));
  } else if (!istDoppelseite()) {
    link.scrollIntoView({ block: "nearest" });
  }
  lupeOeffnen(link, false);
  if (lupeStand) stelleHalten(lupeStand);
}

// ohneRahmen: per Zeiger geschlossen (× oder Klick daneben)
function lupeSchliessen(still = false, ohneRahmen = false): void {
  if (!lupe.open) return;
  lupe.close();
  if (!still && zustand().lupe) {
    erwartePop = { fokus: lupeAusloeser, stand: lupeStand, ohneRahmen };
    history.back();
  }
  fokussieren(lupeAusloeser, ohneRahmen);
}

function lupeBlaettern(schritt: number): void {
  if (!lupeListe.length) return;
  lupeIndex = (lupeIndex + schritt + lupeListe.length) % lupeListe.length;
  lupeZeigen();
  // Der Fokus bleibt auf dem Knopf; was jetzt zu sehen ist, sagt die Ansage
  ansagen(lupeAnsage, `${lupeTitel.textContent}: ${lupeText.textContent}`);
}

/* Bedienung -------------------------------------------------------------------- */

// Zugeklappt wird nur bei einem Klick auf den Grund, nicht wenn eine Textauswahl dort endet
let druckAufGrund = false;
dialog.addEventListener("pointerdown", (e) => (druckAufGrund = e.target === dialog));

dialog.addEventListener("click", (e) => {
  const ziel = e.target as Element;
  if (ziel === dialog) {
    if (druckAufGrund) schliessen("daneben", null, true);
    return;
  }
  const knopf = ziel.closest<HTMLButtonElement>("button");
  if (knopf) {
    if (knopf.matches("[data-zuklappen]")) return schliessen("knopf", null, e.detail > 0);
    if (knopf.matches("[data-weiter]")) return weiterBlaettern();
    if (knopf.matches("[data-zurueck]")) return void zurueckBlaettern();
    if (knopf.matches(".lesetisch__reiter")) return gehe(Number(knopf.dataset.ziel), { fokus: true });
    if (knopf.matches("[data-vorher]")) return vorherUmschalten(knopf);
    return;
  }
  const link = ziel.closest<HTMLAnchorElement>("a[href]");
  if (!link) return;
  e.preventDefault();
  if (link.matches("[data-lupe]")) {
    e.stopPropagation();
    return lupeOeffnen(link);
  }
  if (link.dataset.blaettern) {
    e.stopPropagation();
    return gehe(indexVon(link.dataset.blaettern), { fokus: true });
  }
  if (link.dataset.verweis) {
    e.stopPropagation();
    const [akte, kapitel] = link.dataset.verweis.split(":");
    return wechseln(akte, kapitel, { verweis: true });
  }
  if (link.dataset.naechste) {
    e.stopPropagation();
    return wechseln(link.dataset.naechste);
  }
  // Ein Anker auf die Seite (Erstgespräch, Zusagen): zuklappen und den Fokus zum Ziel mitnehmen; das
  // Klick-Ereignis läuft danach weiter bis zum Fenster, wo Lenis wie überall weich zum Ziel scrollt
  schliessen("ziel", document.getElementById(decodeURIComponent(link.hash.slice(1))), e.detail > 0);
});

dialog.addEventListener("keydown", (e) => {
  if (!offen || e.altKey || e.metaKey || e.ctrlKey) return;
  const ziel = e.target as Element;
  if (ziel.closest("input, textarea, select")) return;
  const doppel = istDoppelseite();
  const letzte = offen.seiten.length - 1;
  const imBlatt = blatt.contains(ziel);
  // Im Fluss nehmen die Pfeiltasten den Fokus mit auf die neue Seite, außer er liegt auf Weiter oder Zurück
  const fokusMit = !doppel && !ziel.closest(".lesetisch__fuss");
  if (e.key === "ArrowRight" || (doppel && e.key === "PageDown")) {
    e.preventDefault();
    weiterBlaettern(fokusMit);
  } else if (e.key === "ArrowLeft" || (doppel && e.key === "PageUp")) {
    e.preventDefault();
    zurueckBlaettern(fokusMit);
  } else if ((doppel || !imBlatt) && (e.key === "Home" || e.key === "End")) {
    e.preventDefault();
    gehe(e.key === "Home" ? 0 : letzte, { fokus: true });
  } else if (!doppel && !imBlatt && (e.key === "PageDown" || e.key === "PageUp")) {
    // Fokus im Kopf oder Fuß: Bild ab und Bild auf scrollen trotzdem das Blatt
    e.preventDefault();
    blatt.scrollBy({ top: (e.key === "PageDown" ? 0.85 : -0.85) * blatt.clientHeight, behavior: ruhig.matches ? "auto" : "smooth" });
  } else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !(doppel ? ziel.closest(".seite__text, .seite__beleg") : imBlatt)) {
    // Fokus im Kopf oder auf den Knöpfen: ↑ und ↓ scrollen die Textseite bzw. das Blatt
    const scroller = doppel ? offen.seiten[offen.index].querySelector<HTMLElement>(".seite__text") : blatt;
    if (scroller && scroller.scrollHeight > scroller.clientHeight) {
      e.preventDefault();
      scroller.scrollBy({ top: e.key === "ArrowDown" ? 80 : -80, behavior: ruhig.matches ? "auto" : "smooth" });
    }
  }
});

// Scrollen in den Seitenhälften (Doppelseite) und im Blatt (Fluss); scroll steigt nicht auf, daher capture
dialog.addEventListener(
  "scroll",
  (e) => {
    if (e.target === blatt) flussEndePruefen();
    else if ((e.target as Element).matches?.(".seite__text, .seite__beleg")) mehrPruefenBald();
  },
  { capture: true, passive: true },
);
// Bilder, die nachladen, ändern die Höhe der Seite
dialog.addEventListener("load", mehrPruefenBald, true);
window.addEventListener("resize", () => offen && mehrPruefenBald(), { passive: true });

// Escape kommt als cancel: selbst zuklappen, damit die Geschichte zurückgelegt wird
dialog.addEventListener("cancel", (e) => {
  e.preventDefault();
  schliessen("escape");
});

// Schließt der Browser den Dialog selbst (Zurück-Geste unter Android), aufräumen wie mit Escape
dialog.addEventListener("close", () => {
  if (offen) schliessen("escape");
});

lupe.addEventListener("click", (e) => {
  const ziel = e.target as Element;
  // e.detail ist bei Maus und Finger 1, bei Enter oder Leertaste 0
  if (ziel === lupe) return lupeSchliessen(false, e.detail > 0);
  if (ziel.closest("[data-lupe-zu]")) return lupeSchliessen(false, e.detail > 0);
  if (ziel.closest("[data-lupe-weiter]")) return lupeBlaettern(1);
  if (ziel.closest("[data-lupe-zurueck]")) return lupeBlaettern(-1);
  if (ziel.closest("[data-lupe-massstab]")) return lupeMassstab(lupe.dataset.massstab !== "1");
  if (ziel === lupeBild) return lupeMassstab(lupe.dataset.massstab !== "1", { x: e.clientX, y: e.clientY });
});

lupe.addEventListener("keydown", (e) => {
  if (e.altKey || e.metaKey || e.ctrlKey) return;
  if (lupe.dataset.massstab === "1" && e.target === lupeFlaeche) return; // Pfeile verschieben das Bild
  if (e.key === "ArrowRight") {
    e.preventDefault();
    lupeBlaettern(1);
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    lupeBlaettern(-1);
  }
});

lupe.addEventListener("cancel", (e) => {
  e.preventDefault();
  if (lupe.dataset.massstab === "1") lupeMassstab(false);
  else lupeSchliessen();
});

// Schließt der Browser die Lupe selbst (Zurück-Geste unter Android), geht ihr Eintrag mit
lupe.addEventListener("close", () => {
  if (offen && !erwartePop && zustand().lupe) {
    erwartePop = { fokus: lupeAusloeser, stand: lupeStand };
    history.back();
  }
});

const adresseLesen = () => decodeURIComponent(location.hash.slice(1)).match(/^akte-([a-z]+)(?:-([a-z0-9-]+))?$/);

// Zurück und Vor des Browsers: Der Eintrag sagt, was zu sehen ist (siehe Zustand)
// Nach einem Schritt zurück: Stelle halten und Fokus setzen; Chrome löst ihn erst nach popstate
function ankommen({ fokus, stand, ohneRahmen }: Rueckweg): void {
  if (stand) stelleHalten(stand);
  if (fokus) requestAnimationFrame(() => fokussieren(fokus, ohneRahmen));
}

window.addEventListener("popstate", () => {
  const z = zustand();
  const vor = (z.schritt ?? 0) > schrittJetzt;
  schrittJetzt = z.schritt ?? 0;
  if (erwartePop) {
    // Unser eigener Schritt zurück: Die Ansicht stimmt schon
    const { danach, ...rueckweg } = erwartePop;
    erwartePop = null;
    if (danach) {
      // Der Lesetisch ging mit derselben Eingabe zu (siehe schliessen): jetzt seine Einträge abräumen
      const zurueck = z.praxis ? (z.tiefe ?? 0) : 0;
      if (zurueck) {
        erwartePop = danach;
        history.go(-zurueck);
        return;
      }
      if (z.praxis) history.replaceState(ohneAkte(z), "", location.pathname + location.search);
      return ankommen(danach);
    }
    // Kam die Akte per Tiefenlink, landet das Zuklappen auf ihrem Eintrag; er wird zur Seite
    if (z.praxis && !offen) history.replaceState(ohneAkte(z), "", location.pathname + location.search);
    // Die Lupe ging auf einen Eintrag zurück, der inzwischen die Seite zeigt (die Akte war schon
    // einmal zugeklappt): Er nennt wieder die offene Akte
    else if (!z.praxis && offen) history.replaceState({ ...z, praxis: offen.akte, y: offen.y } satisfies Zustand, "", hashVon(offen.index));
    return ankommen(rueckweg);
  }
  if (!z.praxis) {
    // Zurück auf die Seite: zuklappen, wo die Mappe liegt. Vor in einen Link aus der Akte: zum Ziel.
    if (offen) schliessen(vor ? "vor" : "historie", vor && z.ziel ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null);
    return;
  }
  const adresse = adresseLesen();
  const kapitel = adresse?.[1] === z.praxis ? adresse[2] : undefined;
  if (!offen) {
    // Vor in eine Akte oder Zurück von einem Link aus ihr: dieselbe Stelle wieder aufschlagen
    if (adresse?.[1] === z.praxis) oeffnen(z.praxis, kapitel, undefined, "historie");
    return;
  }
  if (z.praxis !== offen.akte) {
    // Zurück oder Vor über einen Querverweis, auch mehrere Schritte auf einmal: Eine offene Lupe gehört
    // zur vorigen Akte und geht ohne Halten zu; dann die andere Akte an der Stelle aus der Adresse
    lupeSchliessen(true);
    wechseln(z.praxis, kapitel, { historie: true });
    if (z.lupe) lupeWiederOeffnen(z.lupe, z.blatt);
    return;
  }
  if (!z.lupe && lupe.open) {
    lupeSchliessen(true);
    ankommen({ fokus: lupeAusloeser, stand: lupeStand });
  } else if (z.lupe && !lupe.open) {
    lupeWiederOeffnen(z.lupe, z.blatt);
  } else {
    fokusSichern();
  }
});

doppelseiteMoeglich.addEventListener("change", () => {
  if (!offen) return;
  const i = offen.index;
  modusSetzen();
  gehe(i, { sofort: true, still: true });
  // Reiter und Laschenknopf gibt es nur in der Doppelseite; lag der Fokus dort, geht er auf den Seitentitel
  const aktiv = document.activeElement as HTMLElement | null;
  if (!aktiv || !dialog.contains(aktiv) || !aktiv.getClientRects().length) fokusTitel(offen.seiten[offen.index]);
});
