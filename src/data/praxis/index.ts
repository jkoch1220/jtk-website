// Die drei Akten in der Reihenfolge ihrer Wirkung, dazu die Prüfung beim Bauen und Helfer für
// Datum und Arbeitsprotokoll. Bricht aktenPruefen() ab, steht der Grund in der Fehlermeldung.
import type { Akte, AkteId, Bild, Kapitel, Protokoll, Zeitpunkt } from "./typen";
import { tennismehl } from "./tennismehl";
import { koch } from "./koch";
import { saalzentrum } from "./saalzentrum";
import { erfolge, schritte } from "../zusagen";
import protokollRoh from "./protokoll.json";

export const protokoll = protokollRoh as Protokoll;

const SPERRLISTE_GLOBAL = ["Koch Consulting", "Commit"];
// Weitere Sperrwörter stehen bewusst nicht im öffentlichen Repo: astro.config.mjs liest sie beim Bauen
// aus einer Datei außerhalb des Repos und setzt sie hier ein (null: Datei nicht gefunden)
declare const __PRAXIS_SPERRLISTE__: string[] | null;
const SPERRLISTE_LOKAL = typeof __PRAXIS_SPERRLISTE__ === "undefined" ? null : __PRAXIS_SPERRLISTE__;

const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const MONATE_KURZ = ["JAN.", "FEB.", "MÄRZ", "APR.", "MAI", "JUNI", "JULI", "AUG.", "SEP.", "OKT.", "NOV.", "DEZ."];

/* Satz: Zahl und Einheit, „Akte 02“, „18. Mai“, „Februar 2024“ und Jahreszahlen trennen sich nicht
   am Zeilenende, „QR-Code“ und „40-kg-Säcke“ brechen nicht am Bindestrich ------------------ */

const GESCHUETZT: [RegExp, string][] = [
  [/(\d) (Min\.|Std\.|Minuten|Stunden|Tag(?:e|en)?|MB|kg|Tonnen?|%|Prozent|Klicks?|Knopf|Fotos)(?!\p{L})/gu, "$1 $2"],
  [/(^|[^\p{L}])(seit|Jahr|Akte|KW|Saison|Blatt) (\d{1,4})(?!\d)/gu, "$1$2 $3"],
  [new RegExp(`(\\d{1,2}\\.) (${MONATE.join("|")})(?!\\p{L})`, "gu"), "$1 $2"],
  [new RegExp(`(${MONATE.join("|")}) (\\d{4})(?!\\d)`, "gu"), "$1 $2"],
  [/\bQR-Code/g, "QR‑Code"],
  [/(\d+)-kg-/g, "$1‑kg‑"],
];

const satzfest = (s: string) => GESCHUETZT.reduce((t, [muster, ersatz]) => t.replace(muster, ersatz), s);

// Ändert die Texte an Ort und Stelle, damit die Bilder dieselben Objekte bleiben (Sichtfenster,
// Bündel); die Bilddateien selbst (src) bleiben unberührt
function satzfestMachen(o: unknown): void {
  if (Array.isArray(o)) {
    o.forEach((v, i) => (typeof v === "string" ? (o[i] = satzfest(v)) : satzfestMachen(v)));
  } else if (o && typeof o === "object") {
    const objekt = o as Record<string, unknown>;
    for (const [k, v] of Object.entries(objekt)) {
      if (k === "src") continue;
      if (typeof v === "string") objekt[k] = satzfest(v);
      else satzfestMachen(v);
    }
  }
}

export const akten: Akte[] = [tennismehl, koch, saalzentrum];
akten.forEach(satzfestMachen);

/** „24. November 2025“, „Juni 2026“, „2026“, „Wiedervorlage“ */
export function datumText(d: Kapitel["datum"]): string {
  if (d === "wiedervorlage") return "Wiedervorlage";
  const [j, m, t] = d.iso.split("-").map(Number);
  if (d.genau === "jahr") return String(j);
  if (d.genau === "monat") return `${MONATE[m - 1]} ${j}`;
  return `${t}. ${MONATE[m - 1]} ${j}`;
}

/** Für den Eingangsstempel: „24. NOV. 2025“, „JUNI 2026“, „2026“ */
export function stempelDatum(d: Kapitel["datum"]): string {
  if (d === "wiedervorlage") return "VORGEMERKT";
  const [j, m, t] = d.iso.split("-").map(Number);
  if (d.genau === "jahr") return String(j);
  if (d.genau === "monat") return `${MONATE_KURZ[m - 1]} ${j}`;
  return `${t}. ${MONATE_KURZ[m - 1]} ${j}`;
}

/** „10/2026“ aus JJJJ-MM oder JJJJ-MM-TT */
export const monatKurz = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** „27.07.2026“ aus JJJJ-MM-TT */
export const tagKurz = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

export const STAND_TEXT: Record<Kapitel["stand"], string> = { erledigt: "erledigt", laeuft: "läuft", ruht: "ruht", offen: "offen" };

export const DATEN_TEXT = {
  geschwaerzt: "Namen und Beträge geschwärzt",
  zahlen: "einzelne Zahlen geschwärzt",
  ausgeblendet: "Namen und Zahlen geschwärzt, eine Reihe ausgeblendet",
  angaben: "einzelne Angaben geschwärzt",
  beispiel: "Beispieldaten",
  beispielZaehler: "Beispieldaten, Zähler geschwärzt",
  oeffentlich: "öffentliche Seite",
  teilgeschwaerzt: "öffentliche Seite, einzelne Titel geschwärzt",
  anmeldeseite: "nur die Anmeldeseite",
  foto: "Foto aus dem Betrieb",
} as const;

export const BELEGART_TEXT = {
  verlauf: "Verlauf",
  zaehlung: "Zählung",
  bild: "Bild",
  dokument: "Dokument",
  aussage: "Aussage",
} as const;

export const zusageTitel = (id: string) => [...erfolge, ...schritte].find((z) => z.id === id)?.titel;

/** So nummeriert die Startseite: „Zusage 4.1“ bis „4.5“ (Ihr Betrieb danach), „Schritt 1“ bis „3“ (Ablauf) */
export function zusageNr(id: string): string | undefined {
  const e = erfolge.findIndex((z) => z.id === id);
  if (e >= 0) return `Zusage 4.${e + 1}`;
  const s = schritte.findIndex((z) => z.id === id);
  return s >= 0 ? `Schritt ${s + 1}` : undefined;
}

/* Arbeitsprotokoll: ein Balken je Woche ------------------------------------- */

const tag = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +(iso.slice(8, 10) || 1));
const WOCHE = 7 * 24 * 3600 * 1000;

export interface Spur {
  wochen: { beginn: string; anzahl: number }[];
  max: number;
  /** rang 2: wird in schmalen Spuren ausgeblendet (jeder zweite Monat, Jahresanfänge bleiben) */
  monate: { text: string; pos: number; rang: 1 | 2 }[];
  /** Lage eines Datums auf der Spur, 0 bis 1 */
  lage: (iso: string) => number;
}

export function spur(id: AkteId): Spur {
  const roh = protokoll.akten[id] ?? {};
  const schluessel = Object.keys(roh).sort();
  if (!schluessel.length) return { wochen: [], max: 1, monate: [], lage: () => 0 };
  const start = tag(schluessel[0]);
  const ende = tag(schluessel[schluessel.length - 1]);
  const wochen: Spur["wochen"] = [];
  for (let t = start; t <= ende; t += WOCHE) {
    const beginn = new Date(t).toISOString().slice(0, 10);
    wochen.push({ beginn, anzahl: roh[beginn] ?? 0 });
  }
  const spanne = Math.max(ende + WOCHE - start, 1);
  const lage = (iso: string) => Math.min(1, Math.max(0, (tag(iso) - start) / spanne));
  // Monatsnamen nur, wenn genug Platz ist: bei langen Spuren jedes Vierteljahr
  const monate: Spur["monate"] = [];
  const jahre = spanne / (365 * 24 * 3600 * 1000);
  const schritt = jahre > 2 ? 6 : jahre > 1.2 ? 3 : 1;
  const d = new Date(start);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  while (d.getTime() <= ende) {
    const m = d.getUTCMonth();
    if (m % schritt === 0) {
      const kurz = MONATE_KURZ[m].replace(".", "");
      monate.push({
        text: m === 0 || schritt > 1 ? `${kurz} ${String(d.getUTCFullYear()).slice(2)}` : kurz,
        pos: lage(d.toISOString().slice(0, 10)),
        // Vom Januar aus gezählt bleibt jede zweite Marke stehen, der Januar immer
        rang: (m / schritt) % 2 === 1 ? 2 : 1,
      });
    }
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return { wochen, max: Math.max(...wochen.map((w) => w.anzahl), 1), monate, lage };
}

/** Lage eines Kapitels auf der Spur; Wiedervorlagen stehen am Ende. Ist nur das Jahr bekannt,
 *  gibt es keine Lage: Eine Marke mitten im Jahr täuschte einen Monat vor. */
export function kapitelLage(s: Spur, k: Kapitel): number | null {
  if (k.datum === "wiedervorlage") return 1;
  if (k.datum.genau === "jahr") return null;
  return s.lage(k.datum.genau === "monat" ? `${k.datum.iso}-15` : k.datum.iso);
}

/** Lesezeit in Minuten: Wörter durch 180, dazu 8 Sekunden je Bild */
export function lesezeit(a: Akte): number {
  const texte = [a.ausgangslage.text, ...a.kapitel.flatMap((k) => [k.text, k.vorher ?? ""]), ...a.bilanz.nachher];
  const woerter = texte.join(" ").split(/\s+/).filter(Boolean).length;
  const bilder = a.kapitel.reduce((n, k) => n + (k.bilder?.length ?? 0), 0);
  return Math.max(1, Math.round(((woerter / 180) * 60 + bilder * 8) / 60));
}

/* Prüfung beim Bauen -------------------------------------------------------- */

// Kapitel mit reiner Jahresangabe stehen hinter den genau datierten Kapiteln desselben Jahres
function sortierschluessel(d: Zeitpunkt | "wiedervorlage"): string {
  if (d === "wiedervorlage") return "9999";
  return d.genau === "jahr" ? `${d.iso}-99` : d.iso;
}

// Vergleichbare Grenzen eines Kapiteldatums für Tage (JJJJ-MM-TT): „2026-06“ reicht bis „2026-06-99“
const vonTag = (d: Kapitel["datum"]) => (d === "wiedervorlage" ? "9999" : d.iso);
const bisTag = (d: Kapitel["datum"]) => (d === "wiedervorlage" ? "9999" : d.genau === "tag" ? d.iso : `${d.iso}-99`);
const TAG = /^\d{4}-\d{2}-\d{2}$/;

/* Sperrwörter: verglichen wird in NFC und klein, ohne weiche Trennzeichen und Nullbreitenzeichen, jeder
   Leerraum als ein Leerzeichen. Ein Eintrag zählt am Wortanfang; davor steht kein Buchstabe und keine
   Ziffer, „15 %“ trifft also nicht „115 %“. */
const UNSICHTBAR = /[\u00ad\u200b-\u200d\u2060\ufeff]/g;
const vergleichbar = (s: string) => s.normalize("NFC").replace(UNSICHTBAR, "").replace(/\s+/g, " ").toLowerCase();
const umschrift = (s: string) => s.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
const alsMuster = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Formen eines Eintrags: wie geschrieben, in Umschrift, bei mehreren Wörtern auch mit Bindestrich
 *  und zusammengeschrieben */
function formen(eintrag: string): string[] {
  const f = new Set([vergleichbar(eintrag), umschrift(vergleichbar(eintrag))]);
  for (const w of [...f]) if (w.includes(" ")) f.add(w.replace(/ /g, "-")).add(w.replace(/ /g, ""));
  return [...f];
}
const amWortanfang = (form: string) => new RegExp(`(^|[^\\p{L}\\p{N}])${alsMuster(form)}`, "u");

/** Dateiname eines Bildes ohne Hash und Endung: Er steht in der Adresse des Bildes */
function dateiname(src: unknown): string {
  const pfad = typeof src === "string" ? src : String((src as { src?: string } | undefined)?.src ?? "");
  return (pfad.split(/[/?#]/).filter(Boolean).pop() ?? "").split(".")[0].replace(/-[A-Z0-9]{8}$/, "");
}

/** Alle Zeichenketten eines Objekts, Zahlen bleiben außen vor */
function texteVon(o: unknown, aus: string[] = []): string[] {
  if (typeof o === "string") aus.push(o);
  else if (Array.isArray(o)) o.forEach((v) => texteVon(v, aus));
  else if (o && typeof o === "object") Object.values(o).forEach((v) => texteVon(v, aus));
  return aus;
}

// Meldungen der Prüfung nennen lokale Wörter nie, auch nicht in Kapitel-IDs oder Unterschriften:
// Bauprotokolle landen auch anderswo. Längere Formen zuerst, sonst bliebe von „A B“ ein „A“ stehen.
function verdeckt(meldung: string): string {
  const ersatz = (SPERRLISTE_LOKAL ?? []).flatMap((w, i) => formen(w).map((f): [string, number] => [f, i + 1]));
  ersatz.sort(([a], [b]) => b.length - a.length);
  return ersatz.reduce((t, [f, nr]) => t.replace(new RegExp(alsMuster(f), "giu"), `[Wort Nr. ${nr}]`), meldung.normalize("NFC"));
}

export function aktenPruefen(liste: Akte[] = akten): void {
  const fehler: string[] = [];
  if (SPERRLISTE_LOKAL === null) {
    fehler.push("Die lokale Sperrliste fehlt: ~/.config/jtk-website/sperrliste.json (oder Pfad in JTK_SPERRLISTE); ohne sie bauen nur mit JTK_OHNE_SPERRLISTE=1");
  }
  const ids = new Map(liste.map((a) => [a.id, new Set(a.kapitel.map((k) => k.id))]));
  for (const a of liste) {
    const wo = (k?: Kapitel) => `Akte ${a.nr}${k ? `, Kapitel „${k.id}“` : ""}`;
    if (a.kapitel.length < 5 || a.kapitel.length > 8) fehler.push(`${wo()}: ${a.kapitel.length} Kapitel, erlaubt sind 5 bis 8`);
    const sortiert = [...a.kapitel].sort((x, y) => sortierschluessel(x.datum).localeCompare(sortierschluessel(y.datum)));
    if (sortiert.some((k, i) => k !== a.kapitel[i])) fehler.push(`${wo()}: Kapitel nicht nach Datum sortiert`);
    const rote = a.kapitel.filter((k) => k.stempel?.farbe === "rot").length;
    if (rote > 1) fehler.push(`${wo()}: ${rote} rote Stempel, erlaubt ist einer`);
    // Ein Vermerk steht dort, wo sein Datum hingehört
    const erstes = a.kapitel[0];
    const av = a.ausgangslage.vermerk;
    if (av && !TAG.test(av.am)) fehler.push(`${wo()}: Vermerk der Ausgangslage ohne Datum (JJJJ-MM-TT)`);
    else if (av && erstes && av.am > bisTag(erstes.datum)) fehler.push(`${wo()}: Vermerk vom ${av.am} ist jünger als das erste Kapitel`);
    a.kapitel.forEach((k, i) => {
      if (!k.vermerk) return;
      const vor = a.kapitel[i - 1];
      const nach = a.kapitel[i + 1];
      if (!TAG.test(k.vermerk.am)) fehler.push(`${wo(k)}: Vermerk ohne Datum (JJJJ-MM-TT)`);
      else if ((vor && k.vermerk.am < vonTag(vor.datum)) || (nach && k.vermerk.am > bisTag(nach.datum))) {
        fehler.push(`${wo(k)}: Vermerk vom ${k.vermerk.am} gehört nicht zwischen die Nachbarkapitel`);
      }
    });
    // Geprüft wird jeder Text der Akte; von Bildern Alt-Text, Unterschrift und Dateiname
    const bildText = (b: Bild) => `${b.alt} ${b.unterschrift} ${dateiname(b.src)}`;
    const roh = vergleichbar(
      texteVon({
        ...a,
        sperrliste: undefined,
        vorschau: a.vorschau.map(bildText),
        fenster: a.fenster && bildText(a.fenster),
        ausgangslage: { ...a.ausgangslage, bild: a.ausgangslage.bild && bildText(a.ausgangslage.bild) },
        kapitel: a.kapitel.map((k) => ({ ...k, bilder: k.bilder?.map(bildText) })),
      }).join(" "),
    );
    // Ganze Wörter: „erste-rechnung“ ist keine „E-Rechnung“
    const steht = (eintrag: string) => formen(eintrag).some((f) => amWortanfang(f).test(roh) || amWortanfang(f).test(umschrift(roh)));
    for (const w of [...SPERRLISTE_GLOBAL, ...(a.sperrliste ?? [])]) if (steht(w)) fehler.push(`${wo()}: Wort aus der Sperrliste: „${w}“`);
    // Die lokalen Wörter nennt die Meldung nur mit ihrer Nummer
    (SPERRLISTE_LOKAL ?? []).forEach((w, i) => {
      if (steht(w)) fehler.push(`${wo()}: Wort Nr. ${i + 1} der lokalen Sperrliste`);
    });
    for (const k of a.kapitel) {
      if (k.titel.length > 44) fehler.push(`${wo(k)}: Titel länger als 44 Zeichen`);
      if (k.kurz.length > 26) fehler.push(`${wo(k)}: Kurztitel länger als 26 Zeichen`);
      if (k.text.length > 360) fehler.push(`${wo(k)}: Text länger als 360 Zeichen (${k.text.length})`);
      if (!k.belege.length) fehler.push(`${wo(k)}: ohne Beleg`);
      if (k.stempel && (k.stempel.oben.length > 12 || (k.stempel.unten?.length ?? 0) > 22)) fehler.push(`${wo(k)}: Stempeltext zu lang`);
      if (k.zusage && !zusageTitel(k.zusage)) fehler.push(`${wo(k)}: unbekannte Zusage „${k.zusage}“`);
      if (k.verweis && !ids.get(k.verweis.akte)?.has(k.verweis.kapitel)) fehler.push(`${wo(k)}: Verweisziel fehlt`);
      for (const b of k.bilder ?? []) {
        if (!b.alt || !b.unterschrift || !b.daten || (b.art !== "foto" && !b.aufgenommen)) fehler.push(`${wo(k)}: Bild ohne Alt-Text, Unterschrift, Datum oder Datenangabe`);
      }
    }
    if (a.fenster && !a.kapitel.some((k) => k.bilder?.includes(a.fenster!))) fehler.push(`${wo()}: Das Bild im Sichtfenster steht in keinem Kapitel`);
    for (const b of a.vorschau) {
      if (b !== a.ausgangslage.bild && !a.kapitel.some((k) => k.bilder?.includes(b))) fehler.push(`${wo()}: Abzug „${b.unterschrift}“ im Bündel steht nicht in der Akte`);
    }
    const faden = a.bilanz.faden;
    if (faden && !ids.get(faden.akte)?.has(faden.kapitel)) fehler.push(`${wo()}: Faden in der Bilanz zeigt ins Leere`);
  }
  if (fehler.length) throw new Error(verdeckt(`Akten im Abschnitt 06 sind nicht in Ordnung:\n- ${fehler.join("\n- ")}`));
}
