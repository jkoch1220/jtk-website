import { writeFile } from "node:fs/promises";
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
          .filter((p) => !/^404\/?$/.test(p))
          .map((p) => new URL(p.replace(/\/?$/, "/").replace(/^\/$/, ""), site + "/").href)
          .sort();
        const eintraege = urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${eintraege}\n</urlset>\n`;
        await writeFile(new URL("sitemap.xml", dir), xml);
      },
    },
  };
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
    server: {
      // Im Dev laufen Anfrageformular und Statistik gegen die lokale Koch-Plattform.
      // Host bleibt localhost, damit die Plattform die Herkunft erkennt.
      proxy: {
        "/api": { target: "http://localhost:3100", changeOrigin: false },
      },
    },
  },
});
