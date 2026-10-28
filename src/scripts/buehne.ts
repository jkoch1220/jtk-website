// Bühne: Kopfzeile, aktiver Abschnitt und die ruhigen Scroll-Momente der Startseite.
// Der CSS-Zustand ist immer der Endzustand; Startzustände setzt nur dieses Skript,
// und nur ohne reduzierte Bewegung. Jede Animation läuft einmal, danach ruht die Seite.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const ruhig = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Kopfzeile schwebt, sobald die Seite gescrollt ist ----------------------- */

function kopfEinrichten(): void {
  const kopf = document.querySelector<HTMLElement>(".kopf");
  if (!kopf) return;
  let geplant = false;
  const pruefen = () => {
    geplant = false;
    kopf.classList.toggle("kopf--schwebt", window.scrollY > 40);
  };
  window.addEventListener(
    "scroll",
    () => {
      if (geplant) return;
      geplant = true;
      requestAnimationFrame(pruefen);
    },
    { passive: true },
  );
  pruefen();
}

/* Aktiver Abschnitt in der Navigation (rein visuell) ---------------------- */

function navigationEinrichten(): void {
  const links = new Map<string, HTMLAnchorElement>();
  document.querySelectorAll<HTMLAnchorElement>(".kopf__nav a[href*='#']").forEach((a) => {
    links.set(a.hash.slice(1), a);
  });
  const abschnitte = Array.from(document.querySelectorAll<HTMLElement>("main section[id]"));
  if (!links.size || !abschnitte.length) return;

  // Merkt sich, welche Abschnitte gerade im Streifen in Bildmitte liegen. Liegt keiner darin
  // (Hero ganz oben, auch nach einem Sprung ohne Zwischenstände), ist nichts markiert.
  const imStreifen = new Set<string>();
  const beobachter = new IntersectionObserver(
    (eintraege) => {
      for (const e of eintraege) {
        if (e.isIntersecting) imStreifen.add(e.target.id);
        else imStreifen.delete(e.target.id);
      }
      const aktiv = abschnitte.filter((s) => imStreifen.has(s.id)).pop()?.id;
      links.forEach((a, id) => a.classList.toggle("ist-aktiv", id === aktiv));
    },
    { rootMargin: "-45% 0px -50% 0px" },
  );
  abschnitte.forEach((s) => beobachter.observe(s));
}

/* Überschriften werden gedruckt, von links in wenigen Schritten ------------- */

// Ein einziger Trigger für alle Überschriften: Er vergleicht die Scrollposition mit den
// beim Refresh gemessenen Lagen. So erscheinen auch Überschriften, über die ein
// Ankersprung hinweggeht, und pro Scroll-Frame entsteht keine Layout-Arbeit.
function ueberschriftenDrucken(): void {
  const grenze = () => window.innerHeight * 0.85;
  let offen = Array.from(document.querySelectorAll<HTMLElement>("main h2")).filter(
    (h) => h.getBoundingClientRect().top > grenze(),
  );
  if (!offen.length) return;

  gsap.set(offen, { clipPath: "inset(0 100% 0 -0.1em)" });
  let lagen = new Map<HTMLElement, number>();
  const messen = () => {
    lagen = new Map(offen.map((h) => [h, h.getBoundingClientRect().top + window.scrollY]));
  };
  const drucken = (h: HTMLElement) =>
    gsap.to(h, { clipPath: "inset(0 0% 0 -0.1em)", duration: 0.5, ease: "steps(14)", clearProps: "clipPath" });

  const pruefen = (self: ScrollTrigger) => {
    const linie = window.scrollY + grenze();
    const jetzt = offen.filter((h) => (lagen.get(h) ?? Infinity) < linie);
    if (!jetzt.length) return;
    offen = offen.filter((h) => !jetzt.includes(h));
    jetzt.forEach(drucken);
    if (!offen.length) self.kill();
  };
  // Nach jedem Messen einmal prüfen: Ein Aufruf mit Anker (/#kontakt, /datenschutz/#ki-demos) springt ohne
  // Scroll-Ereignis an die Stelle, sonst bliebe die Überschrift dort verdeckt, bis jemand scrollt. Im nächsten Bild,
  // damit der Trigger nicht mitten im Refresh endet.
  ScrollTrigger.create({
    start: 0,
    end: "max",
    onRefresh: (self) => {
      messen();
      requestAnimationFrame(() => pruefen(self));
    },
    onUpdate: pruefen,
  });
  messen();
}

/* Hero: die Durchschläge hängen beim Scrollen etwas nach --------------------- */

// --lag sitzt direkt an den drei Kopien: So rechnet der Browser pro Bild nur deren Stil neu,
// nicht den ganzen Stapel samt Inhalt. Den Weg legt das CSS fest (translate mit --lag);
// transform gehört der Ausfüll-Animation in seite.ts.
function kopienNachziehen(): void {
  const kopien = Array.from(document.querySelectorAll<HTMLElement>(".beleg__stapel .beleg__kopie"));
  if (!kopien.length) return;
  const mm = gsap.matchMedia();
  mm.add("(min-width: 1100px)", () => {
    // GSAP schreibt beim ersten Lesen der Transformation inline "translate: none" (CSSPlugin,
    // für unabhängige Transformationen). Danach rührt es translate nicht mehr an; ohne diese
    // Zeile bliebe das Nachhängen aus dem CSS wirkungslos.
    kopien.forEach((kopie) => kopie.style.removeProperty("translate"));
    const trigger = ScrollTrigger.create({
      trigger: ".hero",
      start: "top top",
      end: "bottom top",
      onUpdate: (self) => {
        const lag = self.progress.toFixed(3);
        kopien.forEach((kopie) => kopie.style.setProperty("--lag", lag));
      },
    });
    return () => {
      trigger.kill();
      kopien.forEach((kopie) => kopie.style.removeProperty("--lag"));
    };
  });
}

/* Problem: die Meldungen springen auf ------------------------------------ */

// Nur Deckkraft und Größe: Die Fenster bleiben fokussierbar und für Screenreader lesbar,
// auch bevor sie aufgesprungen sind. Kommt der Tastaturfokus früher, stehen sie sofort da.
function meldungenAuftreten(): void {
  const tisch = document.querySelector<HTMLElement>(".schreibtisch");
  if (!tisch) return;
  const auftritt = gsap.from(".meldung:not(.meldung--leer)", {
    scale: 0.92,
    opacity: 0,
    duration: 0.18,
    ease: "steps(3)",
    stagger: 0.12,
    clearProps: "transform,opacity",
    scrollTrigger: { trigger: tisch, start: "top 70%", once: true },
  });
  tisch.addEventListener(
    "focusin",
    () => {
      auftritt.scrollTrigger?.kill();
      auftritt.progress(1);
    },
    { once: true },
  );
}

/* Leistungen: die Linien des Hauptbuchs werden gezogen -------------------- */

function hauptbuchLinien(): void {
  const zeilen = document.querySelectorAll<HTMLElement>(".leistungen > div");
  if (!zeilen.length) return;
  gsap.fromTo(
    zeilen,
    { "--strich": 0 },
    {
      "--strich": 1,
      duration: 0.6,
      ease: "power2.out",
      stagger: 0.08,
      scrollTrigger: { trigger: ".leistungen", start: "top 80%", once: true },
    },
  );
}

/* Ablauf: die Maßlinie läuft, die Ziffern füllen sich ---------------------- */

function massliniePlanen(): void {
  const liste = document.querySelector<HTMLElement>(".ablauf");
  const strich = document.querySelector<SVGElement>(".ablauf__strich");
  if (!liste || !strich) return;
  const schritte = Array.from(liste.querySelectorAll<HTMLElement>(":scope > li"));
  const mm = gsap.matchMedia();

  // Breit: Linie waagerecht, jede Ziffer füllt sich, wenn die Linie sie erreicht
  mm.add("(min-width: 861px)", () => {
    liste.classList.add("ist-vorbereitet");
    const r = strich.getBoundingClientRect();
    const marken = schritte.map((li) => {
      const l = li.getBoundingClientRect();
      return (l.left + l.width * 0.12 - r.left) / r.width;
    });
    const tween = gsap.fromTo(
      strich,
      { scaleX: 0 },
      {
        scaleX: 1,
        duration: 0.9,
        ease: "power2.out",
        transformOrigin: "left center",
        scrollTrigger: { trigger: liste, start: "top 75%", once: true },
        onUpdate() {
          const p = this.progress() as number;
          const anteil = gsap.parseEase("power2.out")(p);
          schritte.forEach((li, i) => li.classList.toggle("ist-erreicht", anteil >= marken[i]));
        },
        onComplete: () => schritte.forEach((li) => li.classList.add("ist-erreicht")),
      },
    );
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
      gsap.set(strich, { clearProps: "transform" });
      liste.classList.remove("ist-vorbereitet");
      schritte.forEach((li) => li.classList.remove("ist-erreicht"));
    };
  });

  // Schmal: die Ziffern füllen sich nacheinander, sobald die Liste im Bild ist
  mm.add("(max-width: 860px)", () => {
    liste.classList.add("ist-vorbereitet");
    const trigger = ScrollTrigger.create({
      trigger: liste,
      start: "top 75%",
      once: true,
      onEnter: () =>
        schritte.forEach((li, i) => gsap.delayedCall(0.25 * i, () => li.classList.add("ist-erreicht"))),
    });
    return () => {
      trigger.kill();
      liste.classList.remove("ist-vorbereitet");
      schritte.forEach((li) => li.classList.remove("ist-erreicht"));
    };
  });
}

/* Start- und Endpunkte neu messen, wenn sich die Seitenhöhe ändert ---------- */

// ScrollTrigger misst nur beim Laden und bei Größenänderung des Fensters. Der Zeitfresser-Check
// macht die Seite beim Benutzen aber um Tausende Pixel länger, weggeklickte Meldungen machen
// sie kürzer. Ein Beobachter auf <main> misst dann neu (gilt für alle Trigger der Seite, auch
// für Parallax und Auftritt des Bergbilds).
// refresh(true) wartet gedrosselt (0,2 s) und, solange gescrollt wird, bis zum Ende des Scrollens:
// Ein Refresh springt kurz an den Seitenanfang und zurück und würde ein laufendes sanftes
// Scrollen abbrechen, etwa den Weg zum gerade ausgestellten Beleg.
function hoeheBeobachten(): void {
  const inhalt = document.querySelector("main");
  if (!inhalt || !("ResizeObserver" in window)) return;
  let hoehe = Math.round(inhalt.getBoundingClientRect().height);
  new ResizeObserver(() => {
    const neu = Math.round(inhalt.getBoundingClientRect().height);
    if (neu === hoehe) return;
    hoehe = neu;
    ScrollTrigger.refresh(true);
  }).observe(inhalt);
}

kopfEinrichten();
navigationEinrichten();
hoeheBeobachten();

if (!ruhig) {
  ueberschriftenDrucken();
  kopienNachziehen();
  meldungenAuftreten();
  hauptbuchLinien();
  massliniePlanen();
}
