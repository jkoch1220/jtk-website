import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "astro/config";

const site = "https://jtkconsulting.de";

// Schreibt nach dem Bauen dist/sitemap.xml mit allen Seiten außer der 404. Neue Seiten kommen von selbst
// dazu; robots.txt verweist darauf. Bewusst ohne lastmod, priority und changefreq: Google ignoriert die
// beiden letzten, und ein lastmod, das bei jedem Bauen springt, wäre falsch.
function sitemap() {
  return {
    name: "sitemap",
    hooks: {
      "astro:build:done": async ({ dir, pages }) => {
        const urls = pages
          .map((p) => p.pathname)
          .filter((p) => !/^(404|danke)\/?$/.test(p))
          .map((p) => new URL(p.replace(/\/?$/, "/").replace(/^\/$/, ""), site + "/").href)
          .sort();
        const eintraege = urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${eintraege}\n</urlset>\n`;
        await writeFile(new URL("sitemap.xml", dir), xml);
      },
    },
  };
}

// Wörter, die in den Akten von Abschnitt 06 nie stehen dürfen, aber auch nicht im öffentlichen Repo:
// Sie liegen außerhalb des Repos (JTK_SPERRLISTE, sonst ~/.config/jtk-website/sperrliste.json, ein
// JSON-Feld „woerter“) und kommen als Konstante in die Prüfung (src/data/praxis/index.ts). Fehlt die
// Datei, bricht der Bau dort ab; JTK_OHNE_SPERRLISTE=1 baut mit leerer Liste.
function sperrlisteLesen() {
  const pfad = process.env.JTK_SPERRLISTE || join(homedir(), ".config", "jtk-website", "sperrliste.json");
  try {
    const daten = JSON.parse(readFileSync(pfad, "utf8"));
    const woerter = Array.isArray(daten) ? daten : daten?.woerter;
    if (Array.isArray(woerter)) return woerter.map(String);
  } catch {}
  return process.env.JTK_OHNE_SPERRLISTE ? [] : null;
}

export default defineConfig({
  site,
  trailingSlash: "ignore",
  integrations: [sitemap()],
  build: {
    // CSS direkt in die Seite schreiben: eine Anfrage weniger beim ersten Laden
    inlineStylesheets: "always",
  },
  vite: {
    define: {
      __PRAXIS_SPERRLISTE__: JSON.stringify(sperrlisteLesen()),
    },
    server: {
      // Im Dev laufen Anfrageformular, Statistik und KI-Demos gegen die lokale Koch-Plattform.
      // Host bleibt localhost, damit die Plattform die Herkunft erkennt. JTK_DIENST_URL zeigt auf
      // einen Dienst an einem anderen Port, etwa wenn mehrere Testinstanzen nebeneinander laufen.
      proxy: {
        "/api": { target: process.env.JTK_DIENST_URL || "http://localhost:3100", changeOrigin: false },
      },
    },
  },
});
