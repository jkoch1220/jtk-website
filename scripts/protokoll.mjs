// Schreibt src/data/praxis/protokoll.json: je Akte die Zahl der Änderungen pro Kalenderwoche,
// gezählt im Hauptzweig der zugehörigen Repos (ohne Merges, ohne Bots). Gespeichert werden nur
// Wochenbeginn (Montag) und Anzahl, keine Pfade, Namen oder Nachrichten.
//
// Der Hauptzweig zählt lokal und auf origin zusammen: Ein veraltetes lokales main verliert sonst
// die neuesten Wochen, ein nicht gepushter Stand fehlte auf origin. Ausgerollte Nebenzweige hängt
// man mit # an den Pfad, jede Änderung zählt einmal.
//
// Aufruf von Hand, wenn die Akten aktualisiert werden (vorher git fetch in den Repos):
//   node scripts/protokoll.mjs tennismehl=<repo>,<repo> koch=<repo> saalzentrum=<repo>,<repo>#<zweig>
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";

const git = (repo, ...args) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim();

const gibt = (repo, ref) => {
  try {
    git(repo, "rev-parse", "--verify", "--quiet", ref);
    return true;
  } catch {
    return false;
  }
};

function zweige(repo, extra) {
  // Der lokale Name gewinnt: origin/main kann ein verwaister Anfang sein, wenn lokal master gilt
  const haupt = ["main", "master"].find((name) => gibt(repo, name)) ?? ["main", "master"].find((name) => gibt(repo, `origin/${name}`));
  const refs = haupt ? [haupt, `origin/${haupt}`].filter((ref) => gibt(repo, ref)) : ["HEAD"];
  return [...refs, ...extra.filter((ref) => gibt(repo, ref))];
}

// Montag der Woche als JJJJ-MM-TT, gerechnet in UTC, damit das Ergebnis nicht von der Zeitzone abhängt
function wochenbeginn(tag) {
  const d = new Date(`${tag}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

const akten = {};
for (const arg of process.argv.slice(2)) {
  const [id, repos] = arg.split("=");
  const wochen = {};
  for (const angabe of repos.split(",")) {
    const [repo, ...extra] = angabe.split("#");
    const zeilen = git(repo, "log", ...zweige(repo, extra), "--no-merges", "--date=short", "--format=%ad|%an").split("\n");
    for (const zeile of zeilen.filter(Boolean)) {
      const [tag, autor] = zeile.split("|");
      if (/\[bot\]$/.test(autor)) continue;
      const woche = wochenbeginn(tag);
      wochen[woche] = (wochen[woche] ?? 0) + 1;
    }
  }
  akten[id] = Object.fromEntries(Object.entries(wochen).sort(([a], [b]) => a.localeCompare(b)));
}

const protokoll = {
  stand: new Date().toISOString().slice(0, 10),
  zaehlweise: "Änderungen im Hauptzweig (lokal und origin) und in ausgerollten Zweigen je Kalenderwoche, ohne Merges und ohne Bots",
  akten,
};
const ziel = new URL("../src/data/praxis/protokoll.json", import.meta.url);
await writeFile(ziel, JSON.stringify(protokoll, null, 2) + "\n");
for (const [id, w] of Object.entries(akten)) {
  const summe = Object.values(w).reduce((a, b) => a + b, 0);
  console.log(`${id}: ${Object.keys(w).length} Wochen, ${summe} Änderungen`);
}
