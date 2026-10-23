import { bergeSzene, type Sperre, type Wahl } from "./berge-szene";

/* Hilfsarbeiter der Bühne: rechnet die nächste Szene im Hintergrund voraus, damit „Neu zeichnen“ den
   Hauptfaden nicht anhält. Die Szene besteht nur aus Daten (Typed Arrays, Zahlen, Texte) und kommt als
   Kopie zurück; übertragen (transfer) wird nichts, weil die Szene Puffer mit dem Modul teilen könnte. */

interface Auftrag {
  nr: number;
  B: number;
  H: number;
  startwert: number;
  sperre: Sperre | null;
  wahl?: Wahl;
}

const werk = self as unknown as { onmessage: ((e: MessageEvent<Auftrag>) => void) | null; postMessage(nachricht: unknown): void };

werk.onmessage = (e) => {
  const { nr, B, H, startwert, sperre, wahl } = e.data;
  try {
    werk.postMessage({ nr, szene: bergeSzene(B, H, startwert, sperre, wahl) });
  } catch (fehler) {
    // Auch ein Fehler beim Kopieren landet hier: Die Bühne rechnet dann selbst
    werk.postMessage({ nr, fehler: String(fehler) });
  }
};
