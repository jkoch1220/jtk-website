// Richtwerte des Zeitfresser-Checks für die KI-Demos (Abschnitt 07): Tafel „Was Sie das Abtippen kostet“ im
// Auftrags-Scanner und Stufen im Büro-Röntgenblick. Quelle: scripts/zeitfresser.ts (ARBEITSTAGE, ARBEITSWOCHEN,
// URTEIL_GRENZEN, URTEIL_ROT_AB, runden) und components/Zeitfresser.astro (STUNDENSATZ). Der Website-Dienst rechnet
// mit denselben Werten (website-dienst/src/lib/server/ki/richtwerte.ts). Bei Änderungen alle Stellen ziehen, sonst
// zeigen Tafel, Befund und Check verschiedene Beträge oder Stufen. zeitfresser.ts bleibt bewusst unverändert.

export const STUNDENSATZ = 45;
export const ARBEITSTAGE = 220;
export const ARBEITSWOCHEN = ARBEITSTAGE / 5;
// Ab diesen Kosten im Jahr wird das Urteil eine Stufe dringender (ohne den Spielraum des Checks, der kennt Karten)
export const URTEIL_GRENZEN = [5000, 15000, 40000] as const;
// Ab Stufe 2 wird es rot
export const URTEIL_ROT_AB = 2;
// Startwert des Reglers „Wie oft kommt so etwas bei Ihnen rein?“: „Anfragen bearbeiten“ beim Schnellstart „11 bis 30“
export const VORGAENGE_PRO_WOCHE = 30;

/** Auf 100 € gerundet, ab 10.000 € auf 1.000 €, alles andere wäre Scheingenauigkeit (wie zeitfresser.ts) */
export function runden(betrag: number): number {
  const schritt = betrag >= 10000 ? 1000 : 100;
  return Math.round(betrag / schritt) * schritt;
}

/** Stufe 0 bis 3 aus den gerundeten Kosten im Jahr */
export function urteilStufe(euroProJahr: number): number {
  return URTEIL_GRENZEN.filter((grenze) => euroProJahr >= grenze).length;
}

/** Scanner: Abtippen von Hand im Jahr, wie der Dienst rechnet (30 × 10 Min. × 44 Wochen = 220 Std., rund 9.900 €) */
export function abtippKosten(minutenVonHand: number, vorgaengeProWoche: number = VORGAENGE_PRO_WOCHE): { stundenProJahr: number; euroProJahr: number } {
  const stundenProJahr = Math.round(((vorgaengeProWoche * minutenVonHand) / 60) * ARBEITSWOCHEN);
  return { stundenProJahr, euroProJahr: runden(stundenProJahr * STUNDENSATZ) };
}
