// Zusagen der Startseite: „So läuft Ihr Betrieb danach“ (04) und „In drei Schritten“ (08).
// Die Akten im Abschnitt 06 verweisen per id auf sie („Beleg zu 04 · …“).

export interface Zusage {
  id: string;
  titel: string;
  text: string;
}

export const erfolge: Zusage[] = [
  {
    id: "anfragen",
    titel: "Sie verlieren keine Anfrage mehr",
    text: "Jede Anfrage landet direkt im System statt im Postfach. Mit wenigen Klicks machen Sie daraus ein Angebot.",
  },
  {
    id: "anrufe",
    titel: "Sie verpassen keinen Anruf mehr",
    text: "Ein KI-Telefonassistent nimmt jeden Anruf an, auch nach Feierabend. Routinefragen beantwortet er selbst, neue Anfragen legt er im System an, und was Ihr Team braucht, stellt er durch.",
  },
  {
    id: "rechnungen",
    titel: "Sie schreiben keine Rechnung mehr von Hand",
    text: "Aus dem Auftrag wird die Rechnung, und sie geht als E-Rechnung raus. Die Pflicht ab 2027 bzw. 2028 erfüllen Sie nebenbei.",
  },
  {
    id: "doppelt",
    titel: "Sie tippen nichts mehr doppelt",
    text: "Shop, Warenwirtschaft und Buchhaltung tauschen Daten selbst aus. Auch alte Programme lassen sich in den meisten Fällen anbinden.",
  },
  {
    id: "ki",
    titel: "Sie entscheiden, die KI bereitet vor",
    text: "E-Mails vorsortiert, Dokumente ausgelesen, Antworten vorformuliert. Die KI nimmt Ihrem Team Routine ab, damit mehr Zeit für Kunden bleibt. Was rausgeht, entscheiden Sie.",
  },
];

export const schritte: Zusage[] = [
  {
    id: "erstgespraech",
    titel: "Kostenloses Erstgespräch",
    text: "15 Minuten per Google Meet oder am Telefon, unverbindlich. Danach wissen Sie, wo Ihr Betrieb Zeit verliert und wo Sie anfangen sollten.",
  },
  {
    id: "plan",
    titel: "Ihr Plan mit Festpreis",
    text: "Sie bekommen einen Plan in Etappen. Jede Etappe hat einen festen Preis und ist für sich nutzbar. Nach jeder Etappe entscheiden Sie, ob es weitergeht.",
  },
  {
    id: "zeit",
    titel: "Sie gewinnen Zeit zurück",
    text: "Ihr Team arbeitet von Anfang an mit und wird geschult. Wartung und Weiterentwicklung bleiben in einer Hand, solange Sie das wollen.",
  },
];
