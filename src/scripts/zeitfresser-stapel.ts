/* Kartenstapel im Zeitfresser-Check: Ziehen, Federn, Werfen ----------------------
   Die oberste Karte folgt dem Finger, rastet über der Schwelle ein und fliegt beim
   Loslassen mit Schwung raus. Nach links knüllt sie sich zur Papierkugel und landet
   in der Ablage, nach rechts zerfällt sie in Zeichen und zischt als Datenzeile in die
   Datenbank. Darunter liegt die nächste Karte sichtbar bereit und rückt beim Ziehen
   nach. Zustand und Verlauf bleiben in zeitfresser.ts, hier geht es nur um Bewegung.
   Geworfen wird immer eine Kopie (Geist), die echte nächste Karte ist sofort bedienbar. */

export type Sortierung = "hand" | "digital";
// ruhe: ohne Bewegung, weiter: die nächste Karte rückt nach, zurueck: Karte kommt von der Seite
export type Wechsel = "ruhe" | "weiter" | "zurueck";
type Lage = { x: number; y: number; r: number };
// Lage beim Loslassen, s ist die Anhebung, Tempo in px/ms
export type Wurf = Lage & { s: number; vx: number; vy: number };

// So lange fliegt ein Geist, bis er im Knopf landet
export const FLUGZEIT_MS = 680;

const ARTEN: Sortierung[] = ["hand", "digital"];
const RUHE: Lage = { x: 0, y: 0, r: 0 };
const UNTEN: Lage = { x: 7, y: 8, r: 0 };
const TIEFER: Lage = { x: 14, y: 16, r: 0 };

// Schwelle: gut ein Viertel der Kartenbreite, mindestens 60 px
const SCHWELLE_ANTEIL = 0.28;
const SCHWELLE_MIN = 60;
// Flick: in den letzten 90 ms schneller als 0,5 px/ms, nach mindestens 20 px
const FLICK_TEMPO = 0.5;
const FLICK_STRECKE = 20;
const FLICK_FENSTER_MS = 90;
const START_STRECKE = 6;
const DREHUNG_JE_PX = 0.07;
const DREHUNG_MAX = 16;
const DREHPUNKT = 260;
const HUB = 1.03;
// Senkrecht folgt die Karte dem Finger nur gedämpft, das gilt auch für den Schwung beim Loslassen
const SENKRECHT = 0.2;
const GEISTER_MAX = 4;
const KUGEL = 56;
// Feder leicht unterdämpft (ζ ≈ 0,53): schwingt einmal spürbar über
const STEIF = 560;
const DAEMPFUNG = 25;
const TEMPO_MAX = 800;

const ZEICHEN = "0101010110ABCDEF0123456789#/<>";

const KUGEL_SVG =
  '<svg viewBox="0 0 64 64" focusable="false">' +
  '<path class="papierkugel__form" d="M30 3 45 6 57 17 61 32 56 48 43 59 27 61 12 53 4 38 6 21 16 9Z"/>' +
  '<path class="papierkugel__dunkel" d="M30 3 26 22 6 21 16 9ZM26 22 38 37 27 61 12 53 4 38Z M45 6 57 17 61 32 38 37Z"/>' +
  '<path class="papierkugel__hell" d="M30 3 45 6 38 37 26 22ZM38 37 56 48 43 59Z"/>' +
  '<path class="papierkugel__falte" d="M26 22 30 3M26 22 6 21M26 22 38 37 45 6M38 37 61 32M38 37 56 48M38 37 27 61M26 22 4 38M12 53 24 41"/>' +
  "</svg>";

const px = (n: number) => n.toFixed(2);
const lageText = (l: Lage) => `translate3d(${px(l.x)}px, ${px(l.y)}px, 0) rotate(${px(l.r)}deg)`;
// Für Keyframes immer dieselbe Liste, so interpoliert der Browser jede Funktion für sich
const formText = (x: number, y: number, r: number, sx = 1, sy = sx) =>
  `translate3d(${px(x)}px, ${px(y)}px, 0) rotate(${px(r)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
const begrenzt = (n: number, grenze: number) => Math.max(-grenze, Math.min(grenze, n));
const zufall = () => ZEICHEN[Math.floor(Math.random() * ZEICHEN.length)];

// Kurzes Aufploppen, etwa für Zähler und Balkensegmente
export function ploppen(element: Element | null | undefined, groesse = 1.5): void {
  element?.animate(
    [{ transform: "scale(1)" }, { transform: `scale(${groesse})`, offset: 0.3 }, { transform: "scale(1)" }],
    { duration: 320, easing: "ease-out" },
  );
}

type Feder = { stop: () => void };

// Gedämpfte Feder für mehrere Werte, Tempo in Einheiten pro Sekunde
function federn(
  von: number[],
  nach: number[],
  tempo: number[],
  zeichnen: (werte: number[]) => void,
  fertig: () => void,
): Feder {
  const werte = [...von];
  const v = [...tempo];
  let zuletzt = performance.now();
  let rahmen = 0;
  const schritt = (jetzt: number) => {
    let dt = Math.min(0.05, Math.max(0, (jetzt - zuletzt) / 1000));
    zuletzt = jetzt;
    // Kleine Teilschritte halten die Feder auch bei ruckelnden Frames stabil
    while (dt > 0) {
      const h = Math.min(dt, 1 / 240);
      dt -= h;
      for (let i = 0; i < werte.length; i++) {
        v[i] += (-STEIF * (werte[i] - nach[i]) - DAEMPFUNG * v[i]) * h;
        werte[i] += v[i] * h;
      }
    }
    if (werte.every((w, i) => Math.abs(w - nach[i]) < 0.2 && Math.abs(v[i]) < 8)) {
      zeichnen(nach);
      fertig();
      return;
    }
    zeichnen(werte);
    rahmen = requestAnimationFrame(schritt);
  };
  rahmen = requestAnimationFrame(schritt);
  return { stop: () => cancelAnimationFrame(rahmen) };
}

type Optionen = {
  stapel: HTMLElement;
  karten: HTMLElement[];
  knoepfe: Partial<Record<Sortierung, HTMLElement | null>>;
  ruhig: () => boolean;
  // Darf gerade sortiert werden?
  bereit: () => boolean;
  entscheiden: (art: Sortierung, wurf: Wurf) => void;
  // Der Geist ist im Knopf angekommen, erst jetzt zählen Zähler und Balken.
  // mehr: Die Zielseite zählt jetzt eine mehr. gleich: Die Karte lag schon dort.
  gelandet: (id: string, art: Sortierung) => "mehr" | "gleich" | null;
};

type Teile = Record<Sortierung, HTMLElement | null> & { knitter: HTMLElement | null; raster: HTMLElement | null };
type Probe = { t: number; x: number; y: number };
type Zug = {
  id: number;
  karte: HTMLElement;
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  basis: Lage;
  griff: number;
  aktiv: boolean;
  proben: Probe[];
};
type Geist = { huelle: HTMLElement; animationen: Animation[]; rahmen: number; erledigt: boolean; landen: () => void };
type Punkt = { x: number; y: number };

export function stapelSpielEinrichten(o: Optionen) {
  const { stapel, karten, knoepfe, ruhig } = o;
  const lagen = new WeakMap<HTMLElement, Lage>();
  const laufend = new Map<HTMLElement, Feder>();
  const geister: Geist[] = [];
  let oben: HTMLElement | undefined;
  let unten: HTMLElement | undefined;
  let teile: Teile | null = null;
  // Beim Greifen gemessen, damit im Zug kein Layout gelesen wird
  let breite = 0;

  stapel.classList.add("ist-bereit");

  /* Lage und Feder ---------------------------------------------------------- */

  const setzen = (karte: HTMLElement, l: Lage) => {
    lagen.set(karte, l);
    karte.style.transform = l.x === 0 && l.y === 0 && l.r === 0 ? "" : lageText(l);
  };

  const anhalten = (karte: HTMLElement): Lage => {
    laufend.get(karte)?.stop();
    laufend.delete(karte);
    karte.classList.remove("ist-federnd");
    return lagen.get(karte) ?? RUHE;
  };

  const bewegen = (
    karte: HTMLElement,
    nach: Lage,
    von: Lage,
    tempo = [0, 0, 0],
    zeichnen = (l: Lage) => setzen(karte, l),
    fertig = () => {},
  ) => {
    anhalten(karte);
    const gleich = von.x === nach.x && von.y === nach.y && von.r === nach.r;
    if (ruhig() || (gleich && tempo.every((t) => t === 0))) {
      zeichnen(nach);
      fertig();
      return;
    }
    // Startlage sofort, sonst steht die Karte ein Bild lang am falschen Ort
    zeichnen(von);
    const feder = federn(
      [von.x, von.y, von.r],
      [nach.x, nach.y, nach.r],
      tempo,
      (w) => zeichnen({ x: w[0], y: w[1], r: w[2] }),
      () => {
        laufend.delete(karte);
        karte.classList.remove("ist-federnd");
        fertig();
      },
    );
    laufend.set(karte, feder);
    // Solange sie unterwegs ist, liegt die Karte über den Marginalien (CSS)
    karte.classList.add("ist-federnd");
  };

  const einblenden = (karte: HTMLElement) =>
    karte.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease-out" });

  /* Richtung zeigen --------------------------------------------------------- */

  const schwelle = () => Math.max(SCHWELLE_MIN, (breite || stapel.clientWidth) * SCHWELLE_ANTEIL);

  let ziel: Sortierung | null = null;
  let gerastet = false;

  const zielZeigen = (neuesZiel: Sortierung | null, rast: boolean) => {
    if (neuesZiel === ziel && rast === gerastet) return;
    for (const art of ARTEN) {
      knoepfe[art]?.classList.toggle("ist-ziel", neuesZiel === art);
      knoepfe[art]?.classList.toggle("ist-eingerastet", neuesZiel === art && rast);
    }
    if (oben) {
      oben.classList.toggle("ist-eingerastet", rast);
      if (neuesZiel) oben.dataset.richtung = neuesZiel;
      else delete oben.dataset.richtung;
    }
    // Einrasten spürbar machen, wo das Gerät es kann
    if (rast && !gerastet) {
      try {
        navigator.vibrate?.(8);
      } catch {
        // dann eben nur sichtbar
      }
    }
    ziel = neuesZiel;
    gerastet = rast;
  };

  const markenLoesen = (karte: HTMLElement) => {
    karte.classList.remove("wird-gezogen", "ist-eingerastet");
    delete karte.dataset.richtung;
    karte
      .querySelectorAll<HTMLElement>(".karte__marke, .karte__knitter, .karte__raster")
      .forEach((t) => t.removeAttribute("style"));
  };

  const zugLoesen = () => {
    zielZeigen(null, false);
    if (oben) markenLoesen(oben);
  };

  // Zeichnet die oberste Karte samt Stempel, Vorschau und Unterkarte. rasten nur beim Ziehen.
  const zugZeichnen = (l: Lage, rasten: boolean) => {
    if (!oben) return;
    setzen(oben, l);
    const p = Math.min(1, Math.abs(l.x) / schwelle());
    const richtung: Sortierung | null = Math.abs(l.x) < 1 ? null : l.x < 0 ? "hand" : "digital";
    if (teile) {
      for (const art of ARTEN) {
        const marke = teile[art];
        if (!marke) continue;
        const an = richtung === art ? p : 0;
        marke.style.opacity = an.toFixed(3);
        marke.style.scale = (0.7 + 0.3 * an).toFixed(3);
      }
      // Vorgeschmack: Knitterfalten nach links, Bildschirmraster nach rechts
      if (teile.knitter) teile.knitter.style.opacity = richtung === "hand" ? (p * 0.55).toFixed(3) : "0";
      if (teile.raster) teile.raster.style.opacity = richtung === "digital" ? (p * 0.6).toFixed(3) : "0";
    }
    if (unten && !ruhig()) setzen(unten, { x: UNTEN.x * (1 - p), y: UNTEN.y * (1 - p), r: 0 });
    zielZeigen(richtung && p > 0.15 ? richtung : null, rasten && p >= 1);
  };

  const zurueckfedern = (von: Lage, vx = 0, vy = 0) => {
    const karte = oben;
    if (!karte) return;
    const tempo = [begrenzt(vx * 1000, TEMPO_MAX), begrenzt(vy * SENKRECHT * 1000, TEMPO_MAX), 0];
    bewegen(karte, RUHE, von, tempo, (l) => zugZeichnen(l, false), () => {
      zugLoesen();
      if (unten) setzen(unten, UNTEN);
    });
  };

  /* Ziehen ------------------------------------------------------------------ */

  let zug: Zug | null = null;
  let zugRahmen = 0;

  const lageAusZug = (z: Zug): Lage => {
    const x = z.basis.x + z.dx;
    // Oben gegriffen kippt die Karte mit der Bewegung, unten gegriffen dagegen
    const hebel = z.griff < 0.6 ? 1 : -0.7;
    const r = ruhig() ? 0 : begrenzt(x * DREHUNG_JE_PX * hebel, DREHUNG_MAX);
    // Gedreht wird um einen Punkt weit unter (bzw. über) der Karte: Sie schwingt im Bogen weg
    // und gibt die nächste Karte früher frei
    const seite = Math.sign(hebel) * DREHPUNKT;
    const bogen = (r * Math.PI) / 180;
    return { x: x + seite * Math.sin(bogen), y: z.basis.y + z.dy * SENKRECHT + seite * (1 - Math.cos(bogen)), r };
  };

  const tempoAus = (proben: Probe[]) => {
    const neu = proben[proben.length - 1];
    if (!neu) return { vx: 0, vy: 0 };
    let alt = neu;
    for (let i = proben.length - 1; i >= 0 && neu.t - proben[i].t <= FLICK_FENSTER_MS; i--) alt = proben[i];
    const dt = neu.t - alt.t;
    return dt > 0 ? { vx: (neu.x - alt.x) / dt, vy: (neu.y - alt.y) / dt } : { vx: 0, vy: 0 };
  };

  const zugBeenden = (z: Zug) => {
    zug = null;
    cancelAnimationFrame(zugRahmen);
    zugRahmen = 0;
    try {
      if (z.karte.hasPointerCapture(z.id)) z.karte.releasePointerCapture(z.id);
    } catch {
      // schon frei
    }
    if (z.aktiv) z.karte.classList.remove("wird-gezogen");
  };

  // Übergibt die aktuelle Lage der Karte, etwa wenn mitten im Zug eine Taste entscheidet
  const lageAbgeben = (karte: HTMLElement): Wurf => {
    if (zug && zug.karte === karte) {
      const z = zug;
      zugBeenden(z);
      if (z.aktiv) {
        anhalten(karte);
        return { ...lageAusZug(z), s: HUB, vx: 0, vy: 0 };
      }
    }
    return { ...anhalten(karte), s: 1, vx: 0, vy: 0 };
  };

  stapel.addEventListener("pointerdown", (event) => {
    if (zug || !oben || !o.bereit() || event.button !== 0 || !event.isPrimary) return;
    const karte = (event.target as Element).closest<HTMLElement>(".karte");
    if (karte !== oben) return;
    const kasten = karte.getBoundingClientRect();
    breite = karte.offsetWidth;
    // Die Maus hat keinen impliziten Griff: Ohne ihn ginge ein schneller Flick über den
    // Stapelrand verloren, bevor der Zug überhaupt aktiv wird
    if (event.pointerType === "mouse") {
      try {
        karte.setPointerCapture(event.pointerId);
      } catch {
        // dann eben über das Fenster
      }
    }
    zug = {
      id: event.pointerId,
      karte,
      x0: event.clientX,
      y0: event.clientY,
      dx: 0,
      dy: 0,
      basis: RUHE,
      griff: (event.clientY - kasten.top) / (kasten.height || 1),
      aktiv: false,
      proben: [{ t: event.timeStamp, x: event.clientX, y: event.clientY }],
    };
  });

  // Am Fenster, damit auch Bewegungen neben dem Stapel ankommen
  window.addEventListener("pointermove", (event) => {
    if (!zug || event.pointerId !== zug.id) return;
    // Maus woanders losgelassen: wie ein Abbruch behandeln, sonst klebt die Karte am Zeiger
    if (event.pointerType === "mouse" && event.buttons === 0) {
      zugEnde(event, true);
      return;
    }
    const dx = event.clientX - zug.x0;
    const dy = event.clientY - zug.y0;
    if (!zug.aktiv) {
      // Erst senkrecht bewegt: Das ist Scrollen, kein Wischen
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        zugBeenden(zug);
        return;
      }
      if (Math.abs(dx) < START_STRECKE || Math.abs(dx) < Math.abs(dy)) return;
      zug.aktiv = true;
      // Federt die Karte noch, greift der Finger sie genau dort
      // (ohne den Bogen, den lageAusZug wieder dazurechnet)
      const jetzt = anhalten(zug.karte);
      const seite = (zug.griff < 0.6 ? 1 : -1) * DREHPUNKT;
      const bogen = (jetzt.r * Math.PI) / 180;
      zug.basis = { ...jetzt, x: jetzt.x - seite * Math.sin(bogen), y: jetzt.y - seite * (1 - Math.cos(bogen)) };
      if (unten) anhalten(unten);
      zug.karte.classList.add("wird-gezogen");
      try {
        zug.karte.setPointerCapture(event.pointerId);
      } catch {
        // geht auch ohne
      }
    }
    zug.dx = dx;
    zug.dy = dy;
    zug.proben.push({ t: event.timeStamp, x: event.clientX, y: event.clientY });
    while (zug.proben.length > 2 && event.timeStamp - zug.proben[0].t > 150) zug.proben.shift();
    // Gebündelt pro Bild, so liest und schreibt der Zug nichts doppelt
    if (!zugRahmen) {
      zugRahmen = requestAnimationFrame(() => {
        zugRahmen = 0;
        if (zug?.aktiv) zugZeichnen(lageAusZug(zug), true);
      });
    }
  });

  const zugEnde = (event: PointerEvent, abgebrochen: boolean) => {
    if (!zug || event.pointerId !== zug.id) return;
    const z = zug;
    zugBeenden(z);
    if (!z.aktiv) return;
    if (!abgebrochen) {
      z.dx = event.clientX - z.x0;
      z.dy = event.clientY - z.y0;
      z.proben.push({ t: event.timeStamp, x: event.clientX, y: event.clientY });
    }
    const l = lageAusZug(z);
    const { vx, vy } = tempoAus(z.proben);
    const weit = Math.abs(l.x) >= schwelle();
    const flick = Math.abs(vx) >= FLICK_TEMPO && Math.abs(l.x) >= FLICK_STRECKE;
    const seite: Sortierung = l.x < 0 ? "hand" : "digital";
    let art: Sortierung | null = null;
    // Abgebrochen (Browser übernimmt, Finger am Rand): zählt, was schon über der Schwelle war
    if (abgebrochen) art = weit ? seite : null;
    // Flick in Zugrichtung entscheidet, ein Flick zurück zur Mitte bricht ab
    else if (flick) art = Math.sign(vx) === Math.sign(l.x) ? seite : null;
    else if (weit) art = seite;
    if (art && z.karte === oben && o.bereit()) {
      o.entscheiden(art, { ...l, s: HUB, vx, vy });
      return;
    }
    zurueckfedern(l, vx, vy);
  };

  // Am Fenster lauschen, damit auch ein Loslassen neben dem Stapel den Zug beendet
  window.addEventListener("pointerup", (event) => zugEnde(event, false));
  window.addEventListener("pointercancel", (event) => zugEnde(event, true));
  // Nur der eigene Griff zählt, nicht der implizite Griff eines Kindelements beim Tippen
  stapel.addEventListener("lostpointercapture", (event) => {
    if (zug?.aktiv && event.target === zug.karte) zugEnde(event, true);
  });

  /* Geister: Knüllen und Digitalisieren -------------------------------------- */

  // Stehen die Knöpfe untereinander, steigt die Zeile nicht in den Knopf darüber, sondern
  // gleitet neben der Plakette zur Seite
  const untereinander = () => {
    const { hand, digital } = knoepfe;
    return !!hand && !!digital && Math.abs(hand.offsetTop - digital.offsetTop) > 4;
  };

  const logZeigen = (knopf: HTMLElement, art: Sortierung, text: string) => {
    const plakette = knopf.querySelector<HTMLElement>(".stapel__zahl") ?? knopf;
    const seitlich = untereinander();
    const log = document.createElement("span");
    log.className = seitlich ? "stapel__log stapel__log--seitlich" : "stapel__log";
    log.setAttribute("aria-hidden", "true");
    log.textContent = text;
    plakette.append(log);
    const d = art === "hand" ? 1 : -1;
    const animation = log.animate(
      seitlich
        ? [
            { transform: `translateX(${-6 * d}px)`, opacity: 0 },
            { transform: "translateX(0)", opacity: 1, offset: 0.2 },
            { transform: `translateX(${14 * d}px)`, opacity: 0 },
          ]
        : [
            { transform: "translateY(6px)", opacity: 0 },
            { transform: "translateY(0)", opacity: 1, offset: 0.2 },
            { transform: "translateY(-18px)", opacity: 0 },
          ],
      { duration: 800, easing: "ease-out" },
    );
    animation.onfinish = () => log.remove();
    animation.oncancel = () => log.remove();
  };

  const landen = (art: Sortierung, id: string) => {
    const stand = o.gelandet(id, art);
    const knopf = knoepfe[art];
    if (!knopf || ruhig()) return;
    // Lag die Karte schon hier (zweite Runde), wackelt der Knopf nur, die Zahl bleibt.
    // Nur die Ziffer ploppt, die Log-Zeile an der Plakette bleibt ruhig.
    if (stand === "mehr") ploppen(knopf.querySelector("[data-stapel-zahl]"), 1.6);
    // Einzelne Eigenschaften, damit Wackeln und gedrückter Knopf sich nicht stören
    knopf.animate(
      art === "hand"
        ? [{ rotate: "0deg" }, { rotate: "-2.5deg" }, { rotate: "2deg" }, { rotate: "-1deg" }, { rotate: "0deg" }]
        : [{ scale: "1" }, { scale: "1.035" }, { scale: "1" }],
      { duration: 360, easing: "ease-out" },
    );
    if (stand === "mehr") logZeigen(knopf, art, art === "hand" ? "+1 Zettel" : "INSERT OK");
    else if (stand === "gleich") logZeigen(knopf, art, art === "hand" ? "lag schon da" : "SCHON DRIN");
  };

  const geistEnde = (g: Geist, landet: boolean) => {
    if (g.erledigt) return;
    g.erledigt = true;
    cancelAnimationFrame(g.rahmen);
    g.animationen.forEach((a) => a.cancel());
    g.huelle.remove();
    geister.splice(geister.indexOf(g), 1);
    if (landet) g.landen();
  };

  // Text zerfällt Zeichen für Zeichen in Nullen, Einsen und Hex
  const zerfallen = (g: Geist, felder: HTMLElement[], dauer: number) => {
    const texte = felder.map((f) => Array.from(f.textContent ?? ""));
    const schwellen = texte.map((t) => t.map(() => Math.random() * 0.85));
    const beginn = performance.now();
    let zuletzt = 0;
    const schritt = (jetzt: number) => {
      const t = Math.min(1, (jetzt - beginn) / dauer);
      if (jetzt - zuletzt >= 40 || t === 1) {
        zuletzt = jetzt;
        felder.forEach((f, i) => {
          f.textContent = texte[i].map((c, j) => (/\s/.test(c) ? c : t >= schwellen[i][j] ? zufall() : c)).join("");
        });
      }
      if (t < 1) g.rahmen = requestAnimationFrame(schritt);
    };
    g.rahmen = requestAnimationFrame(schritt);
  };

  const knuellen = (g: Geist, blatt: HTMLElement, w: Wurf, ziel: Punkt, kasten: DOMRect) => {
    const d = -1;
    // Der Schwung vom Loslassen trägt die Karte weiter, während sie zerknüllt
    const schwung = Math.min(2.2, Math.max(0.6, Math.abs(w.vx))) * d;
    const x1 = w.x + schwung * 70;
    const y1 = w.y + begrenzt(w.vy, 1) * 40 - 4;
    const x2 = w.x + schwung * 120;
    const y2 = y1 - 8;
    const kx = KUGEL / (kasten.width || KUGEL);
    const ky = KUGEL / (kasten.height || KUGEL);
    g.animationen.push(
      blatt.animate(
        [
          // Erst knicken, dann zusammenstauchen, zuletzt zur Kugel
          { transform: formText(w.x, w.y, w.r, w.s), borderRadius: "0px", opacity: 1, easing: "ease-out" },
          { transform: formText(x1, y1, w.r + d * 5, 0.93, 0.86), borderRadius: "4px", opacity: 1, offset: 0.35 },
          { transform: formText(x2, y2, w.r + d * 28, 0.42, 0.5), borderRadius: "30% 42% 36% 46%", opacity: 1, offset: 0.7 },
          { transform: formText(x2 + d * 6, y2, w.r + d * 60, kx, ky), borderRadius: "50%", opacity: 0 },
        ],
        { duration: 340, fill: "forwards" },
      ),
    );
    const knitter = blatt.querySelector<HTMLElement>(".karte__knitter");
    if (knitter) {
      g.animationen.push(
        knitter.animate([{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 1 }], { duration: 340, fill: "forwards" }),
      );
    }

    // Die Kugel übernimmt, wo das Blatt klein geworden ist, und fliegt im Bogen in die Ablage
    const kugel = document.createElement("span");
    kugel.className = "papierkugel";
    kugel.innerHTML = KUGEL_SVG;
    g.huelle.append(kugel);
    const p1 = { x: (x2 + ziel.x) / 2, y: Math.min(y2, ziel.y) - 110 };
    const bilder: Keyframe[] = [];
    const schritte = 12;
    for (let i = 0; i <= schritte; i++) {
      const t = i / schritte;
      const u = 1 - t;
      const x = u * u * x2 + 2 * u * t * p1.x + t * t * ziel.x;
      const y = u * u * y2 + 2 * u * t * p1.y + t * t * ziel.y;
      const s = t < 0.15 ? 0.55 + (t / 0.15) * 0.45 : 1 - (t - 0.15) * 0.35;
      bilder.push({ transform: formText(x, y, w.r + d * (60 + t * 420), s), opacity: t === 0 || t === 1 ? 0 : 1, offset: t });
    }
    const flug = kugel.animate(bilder, { duration: 420, delay: 230, easing: "cubic-bezier(.3,.1,.6,1)", fill: "both" });
    flug.onfinish = () => geistEnde(g, true);
    g.animationen.push(flug);
  };

  const digitalisieren = (g: Geist, blatt: HTMLElement, w: Wurf, ziel: Punkt, kasten: DOMRect, id: string) => {
    const d = 1;
    // Erst gerade gerückt: digital heißt geordnet
    const schwung = Math.min(2, Math.max(0.5, Math.abs(w.vx))) * d;
    const x1 = w.x + schwung * 70;
    const y1 = w.y * 0.5;
    blatt.classList.add("wird-digital");
    g.animationen.push(
      blatt.animate(
        [
          { transform: formText(w.x, w.y, w.r, w.s), opacity: 1, easing: "cubic-bezier(.2,.8,.3,1)" },
          { transform: formText(x1, y1, 0, 1), opacity: 1, offset: 0.4 },
          { transform: formText(x1, y1, 0, 1, 1), opacity: 1, offset: 0.68, easing: "cubic-bezier(.6,0,.4,1)" },
          { transform: formText(x1, y1, 0, 0.94, 0.08), opacity: 1, offset: 0.9 },
          { transform: formText(x1, y1, 0, 0.94, 0.04), opacity: 0 },
        ],
        { duration: 380, fill: "forwards" },
      ),
    );
    const raster = blatt.querySelector<HTMLElement>(".karte__raster");
    if (raster) {
      g.animationen.push(
        raster.animate([{ opacity: 0 }, { opacity: 1, offset: 0.5 }, { opacity: 1 }], { duration: 380, fill: "forwards" }),
      );
    }
    zerfallen(g, Array.from(blatt.querySelectorAll<HTMLElement>(".karte__titel, .karte__satz")), 260);

    // Aus dem flachen Blatt wird eine Datenzeile, die in die Datenbank zischt
    const zeile = document.createElement("span");
    zeile.className = "datenzeile";
    g.huelle.append(zeile);
    // Auf schmalen Karten die kürzere Fassung, die id soll ganz zu sehen sein
    for (const text of [`INSERT INTO digital VALUES ('${id}')`, `INSERT '${id}'`, `+ ${id}`]) {
      zeile.textContent = text;
      if (zeile.scrollWidth <= zeile.clientWidth) break;
    }
    // Die Zeile schrumpft zur rechten Kante hin, die soll im Ziel landen
    const halbe = (kasten.width * 0.92) / 2;
    const zisch = zeile.animate(
      [
        { transform: formText(x1, y1, 0, 0.94, 0.3), opacity: 0 },
        { transform: formText(x1, y1, 0, 1, 1), opacity: 1, offset: 0.18 },
        { transform: formText(x1, y1, 0, 1, 1), opacity: 1, offset: 0.4, easing: "cubic-bezier(.55,0,.8,.3)" },
        { transform: formText(ziel.x - halbe, ziel.y, 0, 0.05, 0.7), opacity: 0.5 },
      ],
      { duration: 360, delay: 300, fill: "both" },
    );
    zisch.onfinish = () => geistEnde(g, true);
    g.animationen.push(zisch);
  };

  // Eine Kopie fliegt, die echte Karte ist sofort wieder frei. false: ruhig, ohne Flug.
  const werfen = (karte: HTMLElement, art: Sortierung, wurf?: Wurf): boolean => {
    const roh = wurf ?? lageAbgeben(karte);
    // Die Anhebung (CSS scale) wirkt auch auf den Versatz, in der Kopie steckt sie im transform
    const w: Wurf = { ...roh, x: roh.x * roh.s, y: roh.y * roh.s };
    anhalten(karte);
    zugLoesen();
    if (ruhig() || !stapel.isConnected) return false;
    while (geister.length >= GEISTER_MAX) geistEnde(geister[0], true);

    const id = karte.dataset.karte ?? "";
    const huelle = document.createElement("div");
    huelle.className = `stapel__geist stapel__geist--${art}`;
    huelle.setAttribute("aria-hidden", "true");
    huelle.inert = true;
    const blatt = karte.cloneNode(true) as HTMLElement;
    for (const name of ["id", "data-karte", "aria-hidden", "inert", "style"]) blatt.removeAttribute(name);
    blatt.className = "karte karte--geist";
    markenLoesen(blatt);
    const marke = blatt.querySelector<HTMLElement>(`.karte__marke--${art}`);
    if (marke) marke.style.opacity = "1";
    huelle.append(blatt);
    stapel.append(huelle);

    // Einmal messen, danach läuft alles über transform und opacity
    const kasten = huelle.getBoundingClientRect();
    const knopf = knoepfe[art];
    const zielElement = knopf?.querySelector<HTMLElement>(".stapel__zahl") ?? knopf;
    const zielKasten = zielElement?.getBoundingClientRect();
    const ziel: Punkt =
      zielKasten && zielKasten.width > 0
        ? {
            x: zielKasten.left + zielKasten.width / 2 - (kasten.left + kasten.width / 2),
            y: zielKasten.top + zielKasten.height / 2 - (kasten.top + kasten.height / 2),
          }
        : { x: (art === "hand" ? -1 : 1) * kasten.width, y: 40 };

    const g: Geist = { huelle, animationen: [], rahmen: 0, erledigt: false, landen: () => landen(art, id) };
    geister.push(g);
    if (art === "hand") knuellen(g, blatt, w, ziel, kasten);
    else digitalisieren(g, blatt, w, ziel, kasten, id);
    return true;
  };

  // Alle Geister weg, ohne Landung (Rückgängig, neue Runde)
  const aufraeumen = () => {
    [...geister].forEach((g) => geistEnde(g, false));
  };

  /* Stapel zeigen ------------------------------------------------------------ */

  const teileVon = (karte: HTMLElement): Teile => ({
    hand: karte.querySelector(".karte__marke--hand"),
    digital: karte.querySelector(".karte__marke--digital"),
    knitter: karte.querySelector(".karte__knitter"),
    raster: karte.querySelector(".karte__raster"),
  });

  const zeigen = (neuOben?: HTMLElement, neuUnten?: HTMLElement, wechsel: Wechsel = "ruhe", art?: Sortierung) => {
    const altOben = oben;
    const altUnten = unten;
    if (zug && zug.karte !== neuOben) lageAbgeben(zug.karte);
    if (neuOben !== altOben) zugLoesen();
    const still = wechsel === "ruhe" || ruhig();

    for (const karte of karten) {
      const rolle = karte === neuOben ? "oben" : karte === neuUnten ? "unten" : "";
      karte.hidden = false;
      karte.classList.toggle("ist-oben", rolle === "oben");
      karte.classList.toggle("ist-unten", rolle === "unten");
      // Nur die oberste Karte ist für Screenreader und Fokus da
      karte.inert = rolle !== "oben";
      if (rolle === "oben") karte.removeAttribute("aria-hidden");
      else karte.setAttribute("aria-hidden", "true");
      if (!rolle && (karte === altOben || karte === altUnten)) {
        anhalten(karte);
        setzen(karte, RUHE);
        markenLoesen(karte);
      }
    }
    oben = neuOben;
    unten = neuUnten;
    teile = oben ? teileVon(oben) : null;

    if (neuOben && neuOben !== altOben) {
      markenLoesen(neuOben);
      if (still) {
        anhalten(neuOben);
        setzen(neuOben, RUHE);
        if (wechsel !== "ruhe") einblenden(neuOben);
      } else if (wechsel === "zurueck") {
        // Zurück von der Seite, auf die sie geworfen wurde
        const d = art === "hand" ? -1 : 1;
        bewegen(neuOben, RUHE, { x: d * stapel.clientWidth * 0.8, y: -18, r: d * 12 });
      } else {
        // Ohne Sprung: Die Unterkarte steht schon dort, wohin das Ziehen sie gehoben hat
        bewegen(neuOben, RUHE, neuOben === altUnten ? (lagen.get(neuOben) ?? UNTEN) : UNTEN);
      }
    }
    if (neuUnten && neuUnten !== altUnten) {
      if (still) {
        anhalten(neuUnten);
        setzen(neuUnten, UNTEN);
      } else {
        bewegen(neuUnten, UNTEN, neuUnten === altOben ? (lagen.get(neuUnten) ?? RUHE) : TIEFER);
      }
    }
  };

  return { zeigen, werfen, aufraeumen };
}
