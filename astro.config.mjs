import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://jtkconsulting.de",
  trailingSlash: "ignore",
  build: {
    // CSS direkt in die Seite schreiben: eine Anfrage weniger beim ersten Laden
    inlineStylesheets: "always",
  },
});
