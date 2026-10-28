/* Abschnitt 07 „Ausprobieren“: Programmwahl und Nachladen der drei KI-Programme ---------------------------
   Die Leiste ist eine Reiterleiste nach ARIA (Pfeile laufen rundum, Pos1, Ende; die Auswahl folgt dem Fokus wie
   im Kontaktfenster). Jedes Programm ist ein eigenes Modul mit einrichten(panel) und wird erst geladen, wenn der
   Abschnitt näher als 800 px kommt (im Leerlauf, nur das gewählte, dazu der Status des Dienstes) oder wenn sein
   Reiter gewählt wird. Dieses Modul importiert deshalb nichts von den Programmen, ihren gemeinsamen Teilen
   (anzeige.ts, verbindung.ts) oder ihren Texten (data/ki-demos.ts): Solange niemand hinscrollt, kostet der Abschnitt
   fast nichts. Das Promise je Programm wird gemerkt; scheitert das Laden oder das Einrichten, steht eine Meldung im
   Panel, der Rest der Seite läuft weiter. Rest-Zeile und Marke „Attrappe“ füllt die Steuerung der Programme.
   Ohne Skript zeigt ki.css alle Programme untereinander (@media (scripting: none)), dazu der noscript-Hinweis.
   Läuft in einem verborgenen Panel gerade ein Durchlauf, läuft er weiter: bezahlt ist bezahlt. */

import { nutzung } from "../nutzung";

type DemoId = "scanner" | "roentgen" | "telefon";
type Programm = { einrichten(panel: HTMLElement): void };

// Feste Pfade, damit der Bundler je Programm eine eigene Datei baut
const LADER: Record<DemoId, () => Promise<Programm>> = {
  scanner: () => import("./scanner"),
  roentgen: () => import("./roentgen"),
  telefon: () => import("./telefon"),
};

const istDemo = (wert: string | undefined): wert is DemoId => wert === "scanner" || wert === "roentgen" || wert === "telefon";

// Arbeit für ruhige Momente; ohne requestIdleCallback (Safari) ein kurzer Aufschub
const imLeerlauf = (arbeit: () => void) => {
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(arbeit, { timeout: 1500 });
  else window.setTimeout(arbeit, 150);
};

// Ein einmal gescheiterter Abruf eines Moduls lässt sich in derselben Ansicht nicht wiederholen. Die Meldung steht
// hier und nicht in data/ki-demos.ts, damit dieses Modul klein bleibt; Aussehen wie die Meldungen der Programme.
function ladefehler(panel: HTMLElement, fehler: unknown): void {
  // Ohne Inhalte ins Protokoll der Entwicklerwerkzeuge, wie berge.bmp in berge-buehne.ts
  console.error("KI-Demo nicht geladen:", fehler instanceof Error ? fehler.message : fehler);
  const stand = panel.querySelector<HTMLElement>("[data-ki-stand]");
  if (stand) stand.textContent = "Nicht geladen";
  const ort = panel.querySelector<HTMLElement>("[data-ki-meldung]");
  if (!ort) return;
  const kasten = document.createElement("div");
  kasten.className = "ki-fehler ki-fehler--rot";
  const inhalt = document.createElement("div");
  inhalt.className = "ki-fehler__inhalt";
  const satz = document.createElement("p");
  satz.className = "ki-fehler__satz";
  satz.textContent = "Dieses Programm konnte nicht geladen werden. Bitte laden Sie die Seite neu.";
  const knopf = document.createElement("button");
  knopf.type = "button";
  knopf.className = "retro-knopf";
  knopf.textContent = "Seite neu laden";
  knopf.addEventListener("click", () => window.location.reload());
  const leiste = document.createElement("div");
  leiste.className = "ki-fehler__knoepfe";
  leiste.append(knopf);
  inhalt.append(satz, leiste);
  kasten.append(inhalt);
  ort.replaceChildren(kasten);
  ort.hidden = false;
}

function einrichten(): void {
  const labor = document.querySelector<HTMLElement>("[data-ki-labor]");
  const leiste = labor?.querySelector<HTMLElement>("[data-ki-wahl]");
  if (!labor || !leiste) return;

  const reiter = Array.from(leiste.querySelectorAll<HTMLButtonElement>("[data-ki-reiter]"));
  const panels = new Map<DemoId, HTMLElement>();
  for (const panel of labor.querySelectorAll<HTMLElement>("[data-ki-programm]")) {
    const id = panel.dataset.kiProgramm;
    if (istDemo(id)) panels.set(id, panel);
  }
  const restZeile = labor.querySelector<HTMLElement>("[data-ki-rest-zeile]");

  const gewaehlt = reiter.find((r) => r.getAttribute("aria-selected") === "true")?.dataset.kiReiter;
  let aktiv: DemoId = istDemo(gewaehlt) ? gewaehlt : "scanner";

  /* Programme laden ------------------------------------------------------------------------------------ */

  const geladen = new Map<DemoId, Promise<void>>();

  const programmLaden = (id: DemoId): Promise<void> => {
    const vorhanden = geladen.get(id);
    if (vorhanden) return vorhanden;
    const panel = panels.get(id);
    if (!panel) return Promise.resolve();
    const laden = LADER[id]().then(
      (modul) => {
        try {
          modul.einrichten(panel);
        } catch (fehler) {
          ladefehler(panel, fehler);
        }
      },
      (fehler: unknown) => {
        geladen.delete(id);
        ladefehler(panel, fehler);
      },
    );
    geladen.set(id, laden);
    return laden;
  };

  /* Reiter ---------------------------------------------------------------------------------------------- */

  const waehlen = (id: DemoId, o: { fokus?: boolean } = {}) => {
    const wechsel = id !== aktiv;
    aktiv = id;
    for (const r of reiter) {
      const an = r.dataset.kiReiter === id;
      r.setAttribute("aria-selected", String(an));
      r.tabIndex = an ? 0 : -1;
      if (an && o.fokus) r.focus();
    }
    for (const [pid, panel] of panels) panel.hidden = pid !== id;
    if (wechsel) {
      // Die Rest-Zeile gehört zum gewählten Programm; dessen Steuerung zeigt sie gleich wieder
      if (restZeile) restZeile.hidden = true;
      // Für Programme, die beim Verbergen etwas beenden (Mikrofon, Vorlesen) oder die Rest-Zeile übernehmen
      document.dispatchEvent(new CustomEvent<DemoId>("ki:programm", { detail: id }));
      nutzung("Ausprobieren", "Programm gewechselt", { detail: id });
    }
    void programmLaden(id);
  };

  for (const r of reiter) {
    const id = r.dataset.kiReiter;
    if (!istDemo(id)) continue;
    r.addEventListener("click", () => waehlen(id));
    // Wer mit der Maus über einen Reiter fährt, will ihn vermutlich gleich: Programm schon laden
    r.addEventListener("pointerenter", () => void programmLaden(id), { once: true });
  }

  leiste.addEventListener("keydown", (event) => {
    const jetzt = reiter.findIndex((r) => r.dataset.kiReiter === aktiv);
    let ziel = -1;
    if (event.key === "ArrowRight") ziel = (jetzt + 1) % reiter.length;
    else if (event.key === "ArrowLeft") ziel = (jetzt - 1 + reiter.length) % reiter.length;
    else if (event.key === "Home") ziel = 0;
    else if (event.key === "End") ziel = reiter.length - 1;
    if (ziel < 0) return;
    event.preventDefault();
    const id = reiter[ziel]?.dataset.kiReiter;
    if (istDemo(id)) waehlen(id, { fokus: true });
  });

  /* Status und Vorladen ---------------------------------------------------------------------------------- */

  const vorladen = () => {
    // Status gleich mitfragen, parallel zum Programm (Ergebnis gemerkt in verbindung.ts, nie gespeichert)
    void import("./verbindung").then((v) => v.kiStatus()).catch(() => {});
    imLeerlauf(() => void programmLaden(aktiv));
  };

  if ("IntersectionObserver" in window) {
    const beobachter = new IntersectionObserver(
      (eintraege) => {
        if (!eintraege.some((e) => e.isIntersecting)) return;
        beobachter.disconnect();
        vorladen();
      },
      { rootMargin: "800px 0px" },
    );
    beobachter.observe(labor);
  } else {
    vorladen();
  }
}

try {
  einrichten();
} catch (fehler) {
  // Der Abschnitt ist verzichtbar, der Rest der Seite nicht
  console.error("KI-Demos nicht eingerichtet:", fehler instanceof Error ? fehler.message : fehler);
}
