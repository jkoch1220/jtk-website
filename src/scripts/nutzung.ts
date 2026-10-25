/* Nutzung der Seite melden ------------------------------------------------------
   Jeder Teil der Seite (Hero, Bergbild, Akten, Buchung …) meldet hier, was Besucher tun. Ohne
   Abhängigkeit vom Tracking: Es ist nur ein DOM-Ereignis, tracking.ts zählt es und schickt je
   Aufruf einen Stand mit Zählern (Ereignis nutzung, siehe website-dienst/SPEC.md).

   Bereich und Aktion sind feste, lesbare Wörter („Berge“, „Flug gestartet“). Was wechselt,
   gehört in detail oder wert, sonst entstehen in der Statistik unzählige Zeilen. Nie Eingaben
   von Besuchern (Name, E-Mail, Nachricht …) melden, nur Schritte und Feldnamen. */

export type Nutzung = { bereich: string; aktion: string; wert?: number; detail?: string };

/** Meldet eine Aktion. `wert`: Zahl dazu (Punkte, Level, Sekunden), es zählt der größte; `detail`: kurzer Zusatz, es zählt der letzte. */
export function nutzung(bereich: string, aktion: string, extra: { wert?: number; detail?: string } = {}): void {
  try {
    document.dispatchEvent(new CustomEvent<Nutzung>("nutzung", { detail: { bereich, aktion, ...extra } }));
  } catch {
    // Messung ist verzichtbar
  }
}
