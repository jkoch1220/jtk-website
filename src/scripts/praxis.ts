// Abschnitt 06 „Akteneinsicht“: öffnet den Lesetisch beim Klick auf eine Mappe, einen Abzug im
// Bündel oder das Sichtfenster und bei einem Tiefenlink (#akte-tennismehl-kunden). Der Lesetisch
// ist fest eingebunden: Ein nachgeladenes Modul, dessen Abruf einmal scheitert, ließe sich in
// derselben Seitenansicht nicht erneut laden. Startet das Skript gar nicht, klappt die Geschichte
// unter der Mappe auf wie ohne Skript (Praxis.astro).
import { oeffnen } from "./praxis-lesetisch";

declare global {
  interface Window {
    __praxisGestartet?: boolean;
  }
}

const AKTE_IDS = ["tennismehl", "koch", "saalzentrum"];

function einrichten(): void {
  const abschnitt = document.querySelector<HTMLElement>(".praxis");
  const tisch = abschnitt?.querySelector<HTMLElement>(".praxis__tisch");
  if (!abschnitt || !tisch) return;
  window.__praxisGestartet = true;

  tisch.addEventListener("click", (e) => {
    const ziel = e.target as Element;
    const knopf = ziel.closest<HTMLElement>("[data-akte-oeffnen]");
    const abzug = ziel.closest<HTMLElement>(".akte__abzug, .akte__fenster");
    const akte = (knopf ?? abzug)?.closest<HTMLElement>("[data-akte]")?.dataset.akte;
    if (!akte) return;
    e.preventDefault();
    const zurueck = knopf ?? abzug?.closest(".akte__mappe")?.querySelector<HTMLElement>("[data-akte-oeffnen]") ?? undefined;
    // e.detail ist bei Maus und Finger 1, bei Enter oder Leertaste 0: Nur nach der Tastatur zeigt der
    // Titel im Lesetisch einen Fokusrahmen
    oeffnen(akte, abzug?.dataset.kapitel, zurueck, "klick", e.detail > 0);
  });

  // Tiefenlink: #akte-<id> oder #akte-<id>-<kapitel>
  const ziel = decodeURIComponent(location.hash.slice(1)).match(/^akte-([a-z]+)(?:-([a-z0-9-]+))?$/);
  if (ziel && AKTE_IDS.includes(ziel[1]) && ziel[2] !== "inhalt") oeffnen(ziel[1], ziel[2], undefined, "tiefenlink");
}

einrichten();

export {};
