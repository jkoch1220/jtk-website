/* Befund des Büro-Röntgenblicks als PDF (Abschnitt 07 „Ausprobieren“) -------------------------------------
   Wie der Beleg des Zeitfresser-Checks: eine A4-Seite auf ein Canvas zeichnen und als JPEG in ein minimales PDF
   packen (beleg-pdf.ts). Rahmen, Durchschläge, Stempel und Kontaktleiste kommen von dort, hier steht nur der Inhalt.
   - Feste Beschriftungen kommen aus data/ki-demos.ts, nie aus der Antwort der KI. Was die KI geschrieben hat, wird
     auf wenige Zeilen begrenzt, sonst verkleinert seiteAlsPdf() die ganze Seite.
   - Ein KI-Erzeugnis, nichts von einem Sachverständigen: oben im Stempel „KI-BEFUND“, unten die Stufe, im Bogen die
     Fußzeile „Nicht von Julian Koch geprüft“. Die Metadaten sagen es maschinenlesbar (Autor, Betreff, Stichwörter; KI-Verordnung
     Art. 50 Abs. 2), alles in ASCII wie Titel und Dateiname.
   - roentgen.ts lädt dieses Modul erst beim Klick auf „Als PDF speichern“. */

import { BEFUND, ROENTGEN, STUFEN } from "../../data/ki-demos";
import { kontakt } from "../../data/kontakt";
import { URTEIL_ROT_AB } from "../../data/richtwerte";
import {
  FARBE,
  PIXEL,
  SEITE_B,
  SEITE_H,
  dateiAnbieten,
  durchschlagZeichnen,
  einpassen,
  kontaktleisteZeichnen,
  kopfzeileZeichnen,
  linie,
  schrift,
  seiteAlsPdf,
  stempel,
  umbrechen,
  type BelegDaten,
  type PdfLink,
} from "../beleg-pdf";

export interface BefundDaten {
  nummer: string;
  datum: string;
  diagnose: string;
  ist: readonly { schritt: string; bremse: string }[];
  soll: readonly { schritt: string; hebel: string }[];
  bleibt: string;
  davor: string;
  hebel: string;
  fazit: string;
  /** Beschreibung des Besuchers, schon gekürzt (BEFUND.beschreibungMax) */
  beschreibung: string;
  /** Stufe aus der Rechnung des Dienstes */
  stufe: 0 | 1 | 2 | 3;
  /** Werte der Rechnung, schon formatiert wie auf der Seite */
  stundenWoche: string;
  stundenJahr: string;
  euroJahr: string;
  stundensatz: string;
  wochen: string;
}

type Ctx = CanvasRenderingContext2D;

// Seitenrand wie beim Beleg des Checks
const RAND = 48;
const WEB = "jtkconsulting.de";
const KONTAKT: BelegDaten["kontakt"] = {
  name: kontakt.name,
  firma: kontakt.firma,
  telefonAnzeige: kontakt.telefonAnzeige,
  telefonLink: kontakt.telefonLink,
  email: kontakt.email,
  web: WEB,
};

/** Höchstens n Zeilen; fehlt danach noch Text, endet die letzte mit „…“ */
function zeilenBis(ctx: Ctx, text: string, breite: number, n: number): string[] {
  const zeilen = umbrechen(ctx, text.replace(/\s+/g, " ").trim(), breite);
  if (zeilen.length <= n) return zeilen;
  const kurz = zeilen.slice(0, n);
  let letzte = kurz[n - 1] ?? "";
  while (letzte.length > 1 && ctx.measureText(`${letzte}…`).width > breite) letzte = letzte.slice(0, -1);
  kurz[n - 1] = `${letzte.trimEnd()}…`;
  return kurz;
}

// Der Befund auf weißem Bogen. Gibt die untere Kante zurück (Aufbau wie bogenInhalt in beleg-pdf.ts).
function bogenInhalt(ctx: Ctx, x: number, y: number, b: number, d: BefundDaten): number {
  const rand = 26;
  const links = x + rand;
  const rechts = x + b - rand;
  const innen = rechts - links;
  let cy = y + rand;

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // Absender: der KI-Assistent, nicht Julian Koch
  ctx.fillStyle = FARBE.matt;
  schrift(ctx, 8);
  ctx.fillText(BEFUND.kopf, links, cy + 8);
  linie(ctx, links, cy + 12, links + ctx.measureText(BEFUND.kopf).width, FARBE.linie);
  cy += 30;

  ctx.fillStyle = FARBE.tinte;
  schrift(ctx, 21, 600);
  ctx.fillText(BEFUND.titel[0], links, cy + 18);
  ctx.fillText(BEFUND.titel[1], links, cy + 43);
  cy += 60;

  const spalten = [
    { titel: BEFUND.nummer.label, wert: d.nummer, breite: innen * 0.4 },
    { titel: BEFUND.datum, wert: d.datum, breite: innen * 0.27 },
    { titel: BEFUND.geprueft.label, wert: BEFUND.geprueft.wert, breite: innen * 0.33 },
  ];
  let sx = links;
  for (const s of spalten) {
    ctx.fillStyle = FARBE.matt;
    schrift(ctx, 7.5);
    ctx.fillText(s.titel, sx, cy + 8);
    ctx.fillStyle = FARBE.tinte;
    ctx.fillText(einpassen(ctx, s.wert, s.breite - 14, 10, 520), sx, cy + 23);
    linie(ctx, sx, cy + 28, sx + s.breite - 14, FARBE.linie);
    sx += s.breite;
  }
  cy += 46;

  // Der Flaschenhals
  ctx.fillStyle = FARBE.matt;
  schrift(ctx, 7.5);
  ctx.fillText(ROENTGEN.ergebnis.diagnose, links, cy + 8);
  cy += 12;
  ctx.fillStyle = FARBE.tinte;
  schrift(ctx, 11, 600);
  for (const zeile of zeilenBis(ctx, d.diagnose, innen, 3)) {
    ctx.fillText(zeile, links, cy + 12);
    cy += 15;
  }
  cy += 12;

  // Heute und künftig als Tabelle: links rot wie „von Hand“ im Check, rechts in Tinte
  const spNr = links;
  const spIst = links + 26;
  const spaltenB = (innen - 26 - 14) / 2;
  const spSoll = spIst + spaltenB + 14;
  schrift(ctx, 7.5);
  ctx.fillStyle = FARBE.matt;
  ctx.fillText(BEFUND.spalten.schritt, spNr, cy + 8);
  ctx.fillStyle = FARBE.stempel;
  ctx.fillText(BEFUND.spalten.ist, spIst, cy + 8);
  ctx.fillStyle = FARBE.tinte;
  ctx.fillText(BEFUND.spalten.soll, spSoll, cy + 8);
  cy += 13;
  linie(ctx, links, cy, rechts, FARBE.linieStark);
  const zelle = (sx: number, zy: number, haupt: string[], neben: string[], farbe: string) => {
    let sy = zy;
    ctx.fillStyle = FARBE.tinte;
    schrift(ctx, 9, 520);
    for (const z of haupt) {
      ctx.fillText(z, sx, sy + 9);
      sy += 12;
    }
    ctx.fillStyle = farbe;
    schrift(ctx, 8);
    for (const z of neben) {
      ctx.fillText(z, sx, sy + 8.5);
      sy += 10.5;
    }
    return sy - zy;
  };
  for (let i = 0; i < 3; i++) {
    const ist = d.ist[i];
    const soll = d.soll[i];
    schrift(ctx, 9, 520);
    const istText = zeilenBis(ctx, ist?.schritt ?? "", spaltenB, 2);
    const sollText = zeilenBis(ctx, soll?.schritt ?? "", spaltenB, 2);
    schrift(ctx, 8);
    const bremse = ist?.bremse ? zeilenBis(ctx, `${ROENTGEN.ergebnis.bremse}: ${ist.bremse}`, spaltenB, 2) : [];
    const hebel = soll?.hebel ? zeilenBis(ctx, `${ROENTGEN.ergebnis.hebel}: ${soll.hebel}`, spaltenB, 2) : [];
    const zy = cy + 6;
    ctx.fillStyle = FARBE.tinte;
    schrift(ctx, 9, 520);
    ctx.fillText(String(i + 1), spNr, zy + 9);
    const hoehe = Math.max(zelle(spIst, zy, istText, bremse, FARBE.stempel), zelle(spSoll, zy, sollText, hebel, FARBE.matt));
    cy = zy + hoehe + 5;
    linie(ctx, links, cy, rechts, FARBE.linie);
  }
  cy += 10;

  // Summen rechts, Stempel links daneben
  const summeLinks = links + innen * 0.44;
  const summenOben = cy;
  const summe = (titel: string, wert: string, fett = false) => {
    ctx.fillStyle = fett ? FARBE.tinte : FARBE.matt;
    schrift(ctx, fett ? 10 : 8, fett ? 650 : 400);
    ctx.fillText(titel, summeLinks, cy + 13);
    ctx.fillStyle = FARBE.tinte;
    schrift(ctx, fett ? 12 : 9, fett ? 700 : 520);
    ctx.textAlign = "right";
    ctx.fillText(wert, rechts, cy + 13);
    ctx.textAlign = "left";
    cy += 20;
  };
  summe(BEFUND.zeileStunden, `${d.stundenWoche} Std.`);
  summe(BEFUND.zeileStundenJahr, `${d.stundenJahr} Std.`);
  cy += 3;
  summe(BEFUND.summe, d.euroJahr, true);
  linie(ctx, summeLinks, cy, rechts, FARBE.tinte, 0.9);
  linie(ctx, summeLinks, cy + 2.5, rechts, FARBE.tinte, 0.9);
  stempel(ctx, links + innen * 0.2, summenOben + 33, innen * 0.36, {
    oben: BEFUND.stempelOben,
    unten: STUFEN[d.stufe].stempelUnten,
    rot: d.stufe >= URTEIL_ROT_AB,
  });
  cy += 18;

  // Hinweis und Beschreibung in matter Schrift
  ctx.fillStyle = FARBE.matt;
  schrift(ctx, 7.5);
  for (const zeile of umbrechen(ctx, BEFUND.hinweis(d.stundensatz, d.wochen), innen)) {
    ctx.fillText(zeile, links, cy + 8);
    cy += 11;
  }
  cy += 3;
  for (const zeile of zeilenBis(ctx, BEFUND.beschreibung(d.beschreibung), innen, 3)) {
    ctx.fillText(zeile, links, cy + 8);
    cy += 11;
  }
  cy += 8;

  // Fußzeile: wer das erstellt hat und dass kein Mensch es geprüft hat
  linie(ctx, links, cy, rechts, FARBE.linie);
  cy += 4;
  ctx.fillStyle = FARBE.tinte;
  schrift(ctx, 7.5, 520);
  for (const zeile of umbrechen(ctx, BEFUND.fusszeile(d.datum), innen)) {
    ctx.fillText(zeile, links, cy + 8);
    cy += 11;
  }
  return cy + rand - 10;
}

/** Ehrliches Fazit wie .urteil auf der Seite: Rahmen in Tinte, ab Stufe 2 rot; Dachzeile und Titel fest */
function fazitZeichnen(ctx: Ctx, x: number, y: number, b: number, d: BefundDaten): number {
  const stufe = STUFEN[d.stufe];
  const rot = d.stufe >= URTEIL_ROT_AB;
  let cy = y;
  ctx.fillStyle = FARBE.tinte;
  schrift(ctx, 18, 400, PIXEL);
  ctx.fillText(ROENTGEN.ergebnis.fazit, x, cy + 12);
  cy += 24;

  schrift(ctx, 9.5);
  const text = zeilenBis(ctx, d.fazit, b - 28, 5);
  const hoehe = 16 + 16 + 17 + text.length * 13 + 6;
  ctx.fillStyle = FARBE.bogen;
  ctx.fillRect(x, cy, b, hoehe);
  ctx.strokeStyle = rot ? FARBE.stempel : FARBE.tinte;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, cy, b, hoehe);
  let ty = cy + 16;
  ctx.fillStyle = rot ? FARBE.stempel : FARBE.matt;
  schrift(ctx, 14, 400, PIXEL);
  ctx.fillText(stufe.dachzeile, x + 14, ty + 8);
  ty += 16;
  ctx.fillStyle = d.stufe >= 3 ? FARBE.stempel : FARBE.tinte;
  schrift(ctx, 10.5, 700);
  ctx.fillText(stufe.titel, x + 14, ty + 10, b - 28);
  ty += 17;
  ctx.fillStyle = FARBE.tinte;
  schrift(ctx, 9.5);
  for (const zeile of text) {
    ctx.fillText(zeile, x + 14, ty + 9);
    ty += 13;
  }
  return cy + hoehe + 18;
}

/** Größter Hebel, was bleiben darf und was davor kommt: Beschriftung links, Text der KI rechts */
function bleibtZeichnen(ctx: Ctx, x: number, y: number, b: number, d: BefundDaten): number {
  const zeilen: [string, string][] = [
    [ROENTGEN.ergebnis.groessterHebel, d.hebel],
    [ROENTGEN.ergebnis.bleibt, d.bleibt],
    [ROENTGEN.ergebnis.davor, d.davor],
  ];
  const spalte = 92;
  let cy = y;
  for (const [beschriftung, text] of zeilen) {
    if (!text.trim()) continue;
    ctx.fillStyle = FARBE.matt;
    schrift(ctx, 8.5);
    ctx.fillText(beschriftung, x, cy + 10);
    ctx.fillStyle = FARBE.tinte;
    schrift(ctx, 9.5, 520);
    for (const zeile of zeilenBis(ctx, text, b - spalte, 2)) {
      ctx.fillText(zeile, x + spalte, cy + 10);
      cy += 13;
    }
    cy += 6;
  }
  return cy + 12;
}

function seiteZeichnen(ctx: Ctx, d: BefundDaten): { hoehe: number; links: PdfLink[] } {
  const breite = SEITE_B - 2 * RAND;
  const pdfLinks: PdfLink[] = [];

  ctx.fillStyle = FARBE.papier;
  ctx.fillRect(0, 0, SEITE_B, SEITE_H * 2);

  let cy = kopfzeileZeichnen(ctx, RAND, 34, breite, BEFUND.fussleiste, WEB);
  cy += durchschlagZeichnen(ctx, RAND, cy, breite - 18, (c, x, y, b) => bogenInhalt(c, x, y, b, d)) + 40;
  cy = fazitZeichnen(ctx, RAND, cy, breite - 18, d);
  cy = bleibtZeichnen(ctx, RAND, cy, breite - 18, d);
  // Kontakt als Einladung zum Gespräch, nicht als Unterschrift unter dem Befund
  cy = kontaktleisteZeichnen(ctx, RAND, cy, breite, STUFEN[d.stufe].naechsterSchritt, KONTAKT, pdfLinks, BEFUND.kontakt);

  return { hoehe: cy, links: pdfLinks };
}

/** Zeichnet den Befund und liefert ihn als PDF-Blob (Titel und Metadaten in ASCII) */
export function befundPdfErstellen(d: BefundDaten): Promise<Blob> {
  return seiteAlsPdf((ctx) => seiteZeichnen(ctx, d), BEFUND.pdf.titel(d.nummer), {
    autor: BEFUND.pdf.autor,
    betreff: BEFUND.pdf.betreff,
    stichwoerter: BEFUND.pdf.stichwoerter,
  });
}

/** Erstellt das PDF und bietet es zum Speichern an */
export async function befundPdfSpeichern(d: BefundDaten): Promise<void> {
  dateiAnbieten(await befundPdfErstellen(d), BEFUND.pdf.dateiname);
}
