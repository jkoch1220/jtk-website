/* Beleg aus dem Zeitfresser-Check als PDF, ohne Bibliothek:
   1. Der Beleg wird auf ein Canvas gezeichnet (A4, doppelte Auflösung).
   2. Das Canvas wird zu JPEG.
   3. pdfBauen() packt das JPEG in eine minimale, gültige PDF-Datei mit einer Seite.
   pdfBauen() kommt ohne DOM aus und lässt sich so auch allein prüfen. */

export type BelegDaten = {
  nummer: string;
  datum: string;
  team: string;
  zeilen: { aufgabe: string; stunden: number; euro: number }[];
  stunden: number;
  euroHandarbeit: number;
  umsatz: number;
  summe: number;
  summeTitel: string;
  hinweis: string;
  hebel: { titel: string; schritt: string }[];
  hebelTitel: string;
  kontakt: { name: string; firma: string; telefonAnzeige: string; telefonLink: string; email: string; web: string };
};

/** Klickbare Fläche im PDF, in Punkt, y von oben gemessen */
export type PdfLink = { x: number; y: number; b: number; h: number; uri: string };

// A4 in Punkt (1/72 Zoll)
const SEITE_B = 595;
const SEITE_H = 842;
const MASSSTAB = 2;

const FARBE = {
  papier: "#f1f1f3",
  bogen: "#ffffff",
  tinte: "#2b2a7e",
  matt: "#5d5b99",
  linie: "rgba(43, 42, 126, 0.2)",
  linieStark: "rgba(43, 42, 126, 0.55)",
  gelb: "#f3e6a0",
  rosa: "#f2cdd5",
  stempel: "#c9283a",
};
const SCHRIFT = '"Mona Sans Variable", "Mona Sans", Arial, sans-serif';
const PIXEL = '"Jersey 10", "Courier New", monospace';

const ganzzahl = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
const euro = (wert: number) => `${ganzzahl.format(wert)} €`;

/* PDF von Hand ---------------------------------------------------------------- */

/** Baut eine PDF-Datei mit einer A4-Seite, die das JPEG vollflächig zeigt. */
export function pdfBauen(
  jpeg: Uint8Array,
  pixelBreite: number,
  pixelHoehe: number,
  links: PdfLink[] = [],
  titel = "Zeitfresser-Beleg",
): Uint8Array {
  const kodierer = new TextEncoder();
  const teile: Uint8Array[] = [];
  // Startposition jedes Objekts in Bytes, Index = Objektnummer
  const positionen: number[] = [];
  let laenge = 0;

  const schreiben = (teil: string | Uint8Array) => {
    const bytes = typeof teil === "string" ? kodierer.encode(teil) : teil;
    teile.push(bytes);
    laenge += bytes.length;
  };
  const objekt = (nummer: number, ...inhalt: (string | Uint8Array)[]) => {
    positionen[nummer] = laenge;
    schreiben(`${nummer} 0 obj\n`);
    inhalt.forEach(schreiben);
    schreiben("\nendobj\n");
  };
  // Nur ASCII, Klammern und Backslash maskiert
  const pdfText = (text: string) => `(${text.replace(/[^\x20-\x7e]/g, "").replace(/[\\()]/g, "\\$&")})`;

  const inhalt = `q\n${SEITE_B} 0 0 ${SEITE_H} 0 0 cm\n/Bild Do\nQ\n`;
  const linkNummern = links.map((_, i) => 7 + i);
  const annots = linkNummern.length > 0 ? ` /Annots [${linkNummern.map((n) => `${n} 0 R`).join(" ")}]` : "";
  const jetzt = new Date();
  const zwei = (n: number) => String(n).padStart(2, "0");
  const datum = `D:${jetzt.getFullYear()}${zwei(jetzt.getMonth() + 1)}${zwei(jetzt.getDate())}${zwei(jetzt.getHours())}${zwei(jetzt.getMinutes())}${zwei(jetzt.getSeconds())}`;

  // Kopf mit Binärkommentar, damit Programme die Datei als binär erkennen
  schreiben("%PDF-1.4\n");
  schreiben(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  objekt(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objekt(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objekt(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${SEITE_B} ${SEITE_H}]` +
      ` /Resources << /XObject << /Bild 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R${annots} >>`,
  );
  objekt(
    4,
    `<< /Type /XObject /Subtype /Image /Width ${pixelBreite} /Height ${pixelHoehe}` +
      ` /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    jpeg,
    "\nendstream",
  );
  objekt(5, `<< /Length ${kodierer.encode(inhalt).length} >>\nstream\n${inhalt}endstream`);
  objekt(
    6,
    `<< /Title ${pdfText(titel)} /Author (JTK Consulting) /Creator (jtkconsulting.de) /CreationDate (${datum}) >>`,
  );
  links.forEach((link, i) => {
    // PDF misst von unten links
    const x1 = link.x.toFixed(1);
    const y1 = (SEITE_H - link.y - link.h).toFixed(1);
    const x2 = (link.x + link.b).toFixed(1);
    const y2 = (SEITE_H - link.y).toFixed(1);
    objekt(
      linkNummern[i],
      `<< /Type /Annot /Subtype /Link /Rect [${x1} ${y1} ${x2} ${y2}] /Border [0 0 0]` +
        ` /A << /S /URI /URI ${pdfText(link.uri)} >> >>`,
    );
  });

  // Querverweistabelle: jede Zeile genau 20 Bytes
  const anzahl = positionen.length;
  const xrefStart = laenge;
  let xref = `xref\n0 ${anzahl}\n0000000000 65535 f \n`;
  for (let nummer = 1; nummer < anzahl; nummer++) {
    xref += `${String(positionen[nummer]).padStart(10, "0")} 00000 n \n`;
  }
  schreiben(xref);
  schreiben(`trailer\n<< /Size ${anzahl} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);

  const datei = new Uint8Array(laenge);
  let stelle = 0;
  for (const teil of teile) {
    datei.set(teil, stelle);
    stelle += teil.length;
  }
  return datei;
}

/* Zeichnen -------------------------------------------------------------------- */

type Ctx = CanvasRenderingContext2D;

function schrift(ctx: Ctx, groesse: number, gewicht = 400, familie = SCHRIFT): void {
  ctx.font = `${gewicht} ${groesse}px ${familie}`;
}

function umbrechen(ctx: Ctx, text: string, breite: number): string[] {
  const zeilen: string[] = [];
  let zeile = "";
  for (const wort of text.split(/\s+/)) {
    const probe = zeile ? `${zeile} ${wort}` : wort;
    if (zeile && ctx.measureText(probe).width > breite) {
      zeilen.push(zeile);
      zeile = wort;
    } else {
      zeile = probe;
    }
  }
  if (zeile) zeilen.push(zeile);
  return zeilen;
}

// Verkleinert die Schrift bis zur Mindestgröße, kürzt danach mit Auslassungspunkten
function einpassen(ctx: Ctx, text: string, breite: number, groesse: number, gewicht: number): string {
  let g = groesse;
  schrift(ctx, g, gewicht);
  while (ctx.measureText(text).width > breite && g > groesse * 0.82) {
    g -= 0.25;
    schrift(ctx, g, gewicht);
  }
  if (ctx.measureText(text).width <= breite) return text;
  let kurz = text;
  while (kurz.length > 4 && ctx.measureText(`${kurz}…`).width > breite) kurz = kurz.slice(0, -1);
  return `${kurz.trimEnd()}…`;
}

function linie(ctx: Ctx, x1: number, y: number, x2: number, farbe: string, dicke = 0.75): void {
  ctx.strokeStyle = farbe;
  ctx.lineWidth = dicke;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
}

function zufall(startwert: number): () => number {
  let s = startwert >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Stempel mit leicht ausgefranster Tinte: erst sauber zeichnen, dann Löcher stanzen
function stempel(ctx: Ctx, mitteX: number, mitteY: number, breite: number): void {
  const hoehe = breite * 0.4;
  const aufloesung = MASSSTAB * 2;
  const blatt = document.createElement("canvas");
  blatt.width = Math.ceil(breite * aufloesung);
  blatt.height = Math.ceil(hoehe * aufloesung);
  const s = blatt.getContext("2d");
  if (!s) return;
  s.scale(aufloesung, aufloesung);
  const k = breite / 260;
  s.strokeStyle = FARBE.stempel;
  s.fillStyle = FARBE.stempel;
  const rahmen = (rx: number, ry: number, rb: number, rh: number, radius: number, dicke: number) => {
    s.lineWidth = dicke;
    s.beginPath();
    if (typeof s.roundRect === "function") s.roundRect(rx, ry, rb, rh, radius);
    else s.rect(rx, ry, rb, rh);
    s.stroke();
  };
  rahmen(4 * k, 4 * k, 252 * k, 96 * k, 7 * k, 5 * k);
  rahmen(12 * k, 12 * k, 236 * k, 80 * k, 3 * k, 1.6 * k);
  s.textAlign = "center";
  schrift(s, 42 * k, 800);
  s.fillText("DRINGEND", 130 * k, 60 * k);
  schrift(s, 13 * k, 650);
  if ("letterSpacing" in s) (s as Ctx & { letterSpacing: string }).letterSpacing = `${2 * k}px`;
  s.fillText("JULIAN KOCH ANRUFEN", 130 * k, 82 * k);

  const rnd = zufall(4711);
  s.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 340; i++) {
    s.globalAlpha = 0.35 + rnd() * 0.65;
    s.beginPath();
    s.arc(rnd() * breite, rnd() * hoehe, 0.15 + rnd() * 0.75 * k * 2, 0, Math.PI * 2);
    s.fill();
  }

  ctx.save();
  ctx.translate(mitteX, mitteY);
  ctx.rotate((-8 * Math.PI) / 180);
  ctx.globalAlpha = 0.9;
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(blatt, -breite / 2, -hoehe / 2, breite, hoehe);
  ctx.restore();
}

// Der eigentliche Beleg auf weißem Bogen. Gibt die untere Kante zurück.
function bogenInhalt(ctx: Ctx, x: number, y: number, b: number, d: BelegDaten): number {
  const rand = 26;
  const links = x + rand;
  const rechts = x + b - rand;
  const innen = rechts - links;
  let cy = y + rand;

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // Absender
  ctx.fillStyle = FARBE.matt;
  schrift(ctx, 8);
  const absender = `Zeitfresser-Check · ausgestellt von ${d.kontakt.firma}`;
  ctx.fillText(absender, links, cy + 8);
  linie(ctx, links, cy + 12, links + ctx.measureText(absender).width, FARBE.linie);
  cy += 30;

  // Titel
  ctx.fillStyle = FARBE.tinte;
  schrift(ctx, 21, 600);
  ctx.fillText("Beweisstück:", links, cy + 18);
  ctx.fillText("Was Ihre Handarbeit kostet", links, cy + 43);
  cy += 60;

  // Kopfdaten
  const spalten = [
    { titel: "Beleg-Nr.", wert: d.nummer, breite: innen * 0.4 },
    { titel: "Datum", wert: d.datum, breite: innen * 0.27 },
    { titel: "Teamgröße", wert: d.team, breite: innen * 0.33 },
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

  // Tabelle
  const spPos = links;
  const spAufgabe = links + 26;
  const spStunden = links + innen * 0.78;
  const spEuro = rechts;
  ctx.fillStyle = FARBE.matt;
  schrift(ctx, 7.5);
  ctx.fillText("Pos.", spPos, cy + 8);
  ctx.fillText("Aufgabe", spAufgabe, cy + 8);
  ctx.textAlign = "right";
  ctx.fillText("Std./Jahr", spStunden, cy + 8);
  ctx.fillText("€/Jahr", spEuro, cy + 8);
  ctx.textAlign = "left";
  cy += 13;
  linie(ctx, links, cy, rechts, FARBE.linieStark);

  const zeilenHoehe = d.zeilen.length > 11 ? 15.5 : 18;
  const zeilen = d.zeilen.length > 0 ? d.zeilen : [{ aufgabe: "Keine Handarbeit eingetragen", stunden: 0, euro: 0 }];
  zeilen.forEach((z, i) => {
    const basis = cy + zeilenHoehe - 5;
    ctx.fillStyle = FARBE.tinte;
    schrift(ctx, 9, 520);
    ctx.fillText(String(i + 1), spPos, basis);
    ctx.fillText(einpassen(ctx, z.aufgabe, spStunden - spAufgabe - 48, 9, 520), spAufgabe, basis);
    schrift(ctx, 9, 520);
    ctx.textAlign = "right";
    ctx.fillText(ganzzahl.format(z.stunden), spStunden, basis);
    ctx.fillText(ganzzahl.format(z.euro), spEuro, basis);
    ctx.textAlign = "left";
    cy += zeilenHoehe;
    linie(ctx, links, cy, rechts, FARBE.linie);
  });
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
  summe("Zwischensumme Handarbeit", `${ganzzahl.format(d.stunden)} Std. · ${euro(d.euroHandarbeit)}`);
  summe("Umsatz, der durchrutscht", euro(d.umsatz));
  cy += 3;
  summe(d.summeTitel, euro(d.summe), true);
  linie(ctx, summeLinks, cy, rechts, FARBE.tinte, 0.9);
  linie(ctx, summeLinks, cy + 2.5, rechts, FARBE.tinte, 0.9);
  stempel(ctx, links + innen * 0.2, summenOben + 33, innen * 0.36);
  cy += 18;

  // Hinweis
  ctx.fillStyle = FARBE.matt;
  schrift(ctx, 7.5);
  for (const zeile of umbrechen(ctx, d.hinweis, innen)) {
    ctx.fillText(zeile, links, cy + 8);
    cy += 11;
  }
  return cy + rand - 10;
}

/** Zeichnet die ganze Seite. Liefert die klickbaren Flächen mit. */
function seiteZeichnen(ctx: Ctx, d: BelegDaten): { hoehe: number; links: PdfLink[] } {
  const rand = 48;
  const breite = SEITE_B - 2 * rand;
  const pdfLinks: PdfLink[] = [];
  let cy = 34;

  ctx.fillStyle = FARBE.papier;
  ctx.fillRect(0, 0, SEITE_B, SEITE_H * 2);

  // Kopfzeile in Pixelschrift
  ctx.fillStyle = FARBE.tinte;
  schrift(ctx, 17, 400, PIXEL);
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Zeitfresser-Check", rand, cy + 12);
  ctx.textAlign = "right";
  ctx.fillText(d.kontakt.web, SEITE_B - rand, cy + 12);
  ctx.textAlign = "left";
  cy += 30;

  // Bogen mit Durchschlägen: Höhe erst messen, dann zeichnen
  const bogenB = breite - 18;
  const messen = document.createElement("canvas").getContext("2d");
  const bogenH = messen ? bogenInhalt(messen, 0, 0, bogenB, d) : 560;
  const kopie = (farbe: string, dx: number, dy: number, grad: number) => {
    ctx.save();
    ctx.translate(rand + bogenB / 2 + dx, cy + bogenH / 2 + dy);
    ctx.rotate((grad * Math.PI) / 180);
    ctx.fillStyle = farbe;
    ctx.fillRect(-bogenB / 2, -bogenH / 2, bogenB, bogenH);
    ctx.restore();
  };
  kopie(FARBE.rosa, 14, 15, 1.2);
  kopie(FARBE.gelb, 7, 8, 0.6);
  ctx.save();
  ctx.shadowColor = "rgba(43, 42, 126, 0.22)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = FARBE.bogen;
  ctx.fillRect(rand, cy, bogenB, bogenH);
  ctx.restore();
  bogenInhalt(ctx, rand, cy, bogenB, d);
  cy += bogenH + 40;

  // Die größten Hebel
  if (d.hebel.length > 0) {
    ctx.fillStyle = FARBE.tinte;
    schrift(ctx, 18, 400, PIXEL);
    ctx.fillText(d.hebelTitel, rand, cy + 12);
    cy += 24;
    d.hebel.forEach((h, i) => {
      ctx.fillStyle = FARBE.tinte;
      ctx.fillRect(rand, cy + 1, 15, 15);
      ctx.fillStyle = FARBE.bogen;
      schrift(ctx, 14, 400, PIXEL);
      ctx.textAlign = "center";
      ctx.fillText(String(i + 1), rand + 7.5, cy + 13);
      ctx.textAlign = "left";
      const textX = rand + 24;
      const textB = breite - 24;
      ctx.fillStyle = FARBE.tinte;
      schrift(ctx, 9.5, 650);
      for (const zeile of umbrechen(ctx, h.titel, textB)) {
        ctx.fillText(zeile, textX, cy + 11);
        cy += 13;
      }
      ctx.fillStyle = FARBE.matt;
      schrift(ctx, 9);
      for (const zeile of umbrechen(ctx, h.schritt, textB)) {
        ctx.fillText(zeile, textX, cy + 11);
        cy += 12.5;
      }
      cy += 8;
    });
    cy += 8;
  }

  // Kontaktleiste wie ein Retro-Fenster
  const leisteH = 58;
  ctx.fillStyle = FARBE.tinte;
  ctx.fillRect(rand + 3, cy + 3, breite, leisteH);
  ctx.fillStyle = FARBE.bogen;
  ctx.fillRect(rand, cy, breite, leisteH);
  ctx.strokeStyle = FARBE.tinte;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(rand, cy, breite, leisteH);
  ctx.fillStyle = FARBE.tinte;
  schrift(ctx, 16, 400, PIXEL);
  ctx.fillText("Nächster Schritt", rand + 14, cy + 22);
  schrift(ctx, 9.5, 520);
  ctx.fillText("Kostenloses Erstgespräch, 15 Minuten, unverbindlich.", rand + 14, cy + 38);
  ctx.fillStyle = FARBE.matt;
  schrift(ctx, 8.5);
  ctx.fillText(`${d.kontakt.name}, ${d.kontakt.firma}`, rand + 14, cy + 50);

  const rechtsX = SEITE_B - rand - 14;
  const eintrag = (text: string, basis: number, uri: string, groesse: number, gewicht: number) => {
    schrift(ctx, groesse, gewicht);
    ctx.textAlign = "right";
    ctx.fillText(text, rechtsX, basis);
    ctx.textAlign = "left";
    const w = ctx.measureText(text).width;
    pdfLinks.push({ x: rechtsX - w - 2, y: basis - groesse, b: w + 4, h: groesse + 4, uri });
  };
  ctx.fillStyle = FARBE.tinte;
  eintrag(d.kontakt.telefonAnzeige, cy + 22, d.kontakt.telefonLink, 12, 650);
  eintrag(d.kontakt.email, cy + 37, `mailto:${d.kontakt.email}`, 9.5, 520);
  eintrag(d.kontakt.web, cy + 50, `https://${d.kontakt.web}`, 9.5, 520);
  cy += leisteH + 24;

  return { hoehe: cy, links: pdfLinks };
}

/** Wartet auf die Schriften der Seite, sonst zeichnet das Canvas mit Ersatzschrift. */
async function schriftenLaden(): Promise<void> {
  try {
    const probe = "Beweisstück äöüß 0123456789 €";
    await Promise.all([
      document.fonts.load(`400 12px ${SCHRIFT}`, probe),
      document.fonts.load(`700 12px ${SCHRIFT}`, probe),
      document.fonts.load(`12px ${PIXEL}`, probe),
    ]);
    await document.fonts.ready;
  } catch {
    // Dann eben mit Ersatzschrift
  }
}

function jpegBytes(canvas: HTMLCanvasElement): Uint8Array {
  const url = canvas.toDataURL("image/jpeg", 0.92);
  const binaer = atob(url.slice(url.indexOf(",") + 1));
  const bytes = new Uint8Array(binaer.length);
  for (let i = 0; i < binaer.length; i++) bytes[i] = binaer.charCodeAt(i);
  return bytes;
}

/** Zeichnet den Beleg und liefert ihn als PDF-Blob. */
export async function belegPdfErstellen(d: BelegDaten): Promise<Blob> {
  await schriftenLaden();

  // Erst messen: Passt nicht alles auf die Seite, wird verkleinert
  const mess = document.createElement("canvas").getContext("2d");
  const gemessen = mess ? seiteZeichnen(mess, d).hoehe : SEITE_H;
  const faktor = Math.min(1, SEITE_H / gemessen);
  const versatz = (SEITE_B - SEITE_B * faktor) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = SEITE_B * MASSSTAB;
  canvas.height = SEITE_H * MASSSTAB;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Kein Canvas");
  ctx.fillStyle = FARBE.papier;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(MASSSTAB * faktor, 0, 0, MASSSTAB * faktor, MASSSTAB * versatz, 0);
  const { links } = seiteZeichnen(ctx, d);

  const skaliert = links.map((l) => ({
    ...l,
    x: l.x * faktor + versatz,
    y: l.y * faktor,
    b: l.b * faktor,
    h: l.h * faktor,
  }));
  const datei = pdfBauen(jpegBytes(canvas), canvas.width, canvas.height, skaliert, `Zeitfresser-Beleg ${d.nummer}`);
  return new Blob([datei.buffer as ArrayBuffer], { type: "application/pdf" });
}

/** Bietet die Datei zum Herunterladen an. */
export function dateiAnbieten(blob: Blob, dateiname: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = dateiname;
  a.rel = "noopener";
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
  // Nicht sofort freigeben, manche Browser lesen die Adresse erst nach dem Klick
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
