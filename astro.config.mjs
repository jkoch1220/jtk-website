import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://jtkconsulting.de",
  trailingSlash: "ignore",
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
