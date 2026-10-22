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

  const beobachter = new IntersectionObserver(
    (eintraege) => {
      for (const e of eintraege) {
        if (!e.isIntersecting) continue;
        links.forEach((a, id) => a.classList.toggle("ist-aktiv", id === e.target.id));
      }
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

  const trigger = ScrollTrigger.create({
    start: 0,
    end: "max",
    onRefresh: messen,
    onUpdate: () => {
      const linie = window.scrollY + grenze();
      const jetzt = offen.filter((h) => (lagen.get(h) ?? Infinity) < linie);
      if (!jetzt.length) return;
      offen = offen.filter((h) => !jetzt.includes(h));
      jetzt.forEach(drucken);
      if (!offen.length) trigger.kill();
    },
  });
  messen();
}

/* Hero: die Durchschläge hängen beim Scrollen etwas nach --------------------- */

function kopienNachziehen(): void {
  const stapel = document.querySelector<HTMLElement>(".beleg__stapel");
  if (!stapel) return;
  const mm = gsap.matchMedia();
  mm.add("(min-width: 1100px)", () => {
    const trigger = ScrollTrigger.create({
      trigger: ".hero",
      start: "top top",
      end: "bottom top",
      onUpdate: (self) => stapel.style.setProperty("--lag", self.progress.toFixed(3)),
    });
    return () => {
      trigger.kill();
      stapel.style.removeProperty("--lag");
    };
  });
}

/* Problem: die Meldungen springen auf ------------------------------------ */

function meldungenAuftreten(): void {
  if (!document.querySelector(".schreibtisch")) return;
  gsap.from(".meldung:not(.meldung--leer)", {
    scale: 0.92,
    autoAlpha: 0,
    duration: 0.18,
    ease: "steps(3)",
    stagger: 0.12,
    clearProps: "transform,opacity,visibility",
    scrollTrigger: { trigger: ".schreibtisch", start: "top 70%", once: true },
  });
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

kopfEinrichten();
navigationEinrichten();

if (!ruhig) {
  ueberschriftenDrucken();
  kopienNachziehen();
  meldungenAuftreten();
  hauptbuchLinien();
  massliniePlanen();
}
