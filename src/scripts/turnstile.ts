/* Sicherheitsprüfung mit Cloudflare Turnstile für Buchung (termin.ts) und Anfrageformular (seite.ts).
   Der Dienst prüft das Token (Feld `turnstile`), sobald auf dem Server TURNSTILE_SECRET gesetzt ist.
   Das Skript von challenges.cloudflare.com lädt erst, wenn jemand eines der Formulare benutzt, nicht
   schon beim Seitenaufruf (siehe Datenschutz). Ohne Site-Key im Formular (data-sitekey leer) passiert
   nichts, dann geht ein leeres Token mit. Lädt das Skript nicht, ebenso: Der Dienst entscheidet. */

type TurnstileApi = {
  render(ort: HTMLElement, optionen: Record<string, unknown>): string;
  reset(widget: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type Widget = {
  ort: HTMLElement;
  id: string | null;
  token: string;
  wartende: ((token: string) => void)[];
};

const SKRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
// So lange wartet das Absenden höchstens auf ein Token, danach geht es ohne
const WARTEN_MS = 8000;

const widgets = new WeakMap<HTMLFormElement, Widget>();
let skript: Promise<TurnstileApi | null> | null = null;

function skriptLaden(): Promise<TurnstileApi | null> {
  skript ??= new Promise((fertig) => {
    if (window.turnstile) return fertig(window.turnstile);
    const tag = document.createElement("script");
    tag.src = SKRIPT;
    tag.async = true;
    tag.addEventListener("load", () => fertig(window.turnstile ?? null));
    tag.addEventListener("error", () => fertig(null));
    document.head.append(tag);
  });
  return skript;
}

const tokenSetzen = (w: Widget, token: string) => {
  w.token = token;
  if (!token) return;
  w.wartende.splice(0).forEach((weiter) => weiter(token));
};

async function anzeigen(formular: HTMLFormElement, w: Widget): Promise<void> {
  if (w.id !== null) return;
  const api = await skriptLaden();
  if (!api || w.id !== null) {
    if (!api) w.wartende.splice(0).forEach((weiter) => weiter(""));
    return;
  }
  try {
    w.id = api.render(w.ort, {
      sitekey: w.ort.dataset.sitekey,
      action: formular.dataset.turnstileAktion,
      language: "de",
      // Folgt der Darstellung dieser Seite (auch einer Wahl im Kopf), nicht nur dem System
      theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
      // Nur sichtbar, wenn Cloudflare wirklich nachfragen muss
      appearance: "interaction-only",
      callback: (token: string) => tokenSetzen(w, token),
      "expired-callback": () => tokenSetzen(w, ""),
      "error-callback": () => {
        tokenSetzen(w, "");
        w.wartende.splice(0).forEach((weiter) => weiter(""));
      },
    });
  } catch {
    w.wartende.splice(0).forEach((weiter) => weiter(""));
  }
}

/** Richtet die Prüfung für ein Formular ein; sie startet beim ersten Fokus darin. */
export function turnstileVorbereiten(formular: HTMLFormElement): void {
  const ort = formular.querySelector<HTMLElement>("[data-turnstile]");
  if (!ort?.dataset.sitekey || widgets.has(formular)) return;
  const w: Widget = { ort, id: null, token: "", wartende: [] };
  widgets.set(formular, w);
  formular.addEventListener("focusin", () => void anzeigen(formular, w), { once: true });
}

/** Token für das nächste Absenden. Wartet kurz, falls die Prüfung noch läuft; sonst "". */
export async function turnstileToken(formular: HTMLFormElement): Promise<string> {
  const w = widgets.get(formular);
  if (!w) return "";
  if (w.token) return w.token;
  const warten = new Promise<string>((weiter) => {
    w.wartende.push(weiter);
    window.setTimeout(() => weiter(w.token), WARTEN_MS);
  });
  void anzeigen(formular, w);
  return warten;
}

/** Ein Token gilt nur einmal: nach jedem Absenden ein neues holen. */
export function turnstileZuruecksetzen(formular: HTMLFormElement): void {
  const w = widgets.get(formular);
  if (!w || w.id === null) return;
  w.token = "";
  try {
    window.turnstile?.reset(w.id);
  } catch {
    // Dann gibt es beim nächsten Mal eben kein Token, der Dienst meldet sich
  }
}
