/* Vorbelegen von „Worum geht es?“ (Buchung in termin.ts, Anfrage in seite.ts) ------------------------------
   Zeitfresser-Check und Büro-Röntgenblick schicken je einen Textblock über das window-Ereignis
   „anfrage:vorbelegen“ (detail: string). Die feste erste Zeile verrät die Quelle; ein neuer Block ersetzt nur den
   alten derselben Quelle, alles andere im Feld bleibt stehen. Gesetzt wird nur .value, nie ein input-Ereignis:
   Sonst zählte die Statistik ein begonnenes Formular oder eine angefangene Buchung, die es nicht gibt.
   Bewusst ohne Import der Demo-Texte (data/ki-demos.ts): Dieses Modul hängt am sofort geladenen Teil der Seite. */

export type Quelle = "check" | "roentgen";

/** Anfang der ersten Zeile des Röntgen-Blocks; scripts/ki/roentgen.ts baut die Zeile damit */
export const KOPF_ROENTGEN = "Befund aus dem Büro-Röntgenblick";

// Check: Nur die letzte Zeile endet auf „Stunden im Jahr.“ (zeitfresser.ts). Röntgenblick: Kopfzeile plus genau
// vier einzeilige Zeilen, so stört kein Satz des Besuchers die Erkennung.
const MUSTER: Record<Quelle, RegExp> = {
  check: /Ergebnis aus dem Zeitfresser-Check:[\s\S]*?Stunden im Jahr\.\n*/u,
  roentgen: /Befund aus dem Büro-Röntgenblick[^\n]*(?:\n[^\n]*){4}\n*/u,
};

export const quelleVon = (block: string): Quelle => (block.startsWith(KOPF_ROENTGEN) ? "roentgen" : "check");

/** Neuer Block oben, der alte derselben Quelle fällt weg, Eigenes des Besuchers bleibt darunter */
export function blockEinsetzen(bisher: string, block: string): string {
  const rest = bisher.replace(MUSTER[quelleVon(block)], "").trim();
  return rest ? `${block}\n\n${rest}` : block;
}
