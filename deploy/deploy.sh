#!/usr/bin/env sh
# Baut die Seite und lädt sie auf den VPS.
# Beim ersten Mal vorher einmal deploy/einrichten.sh ausführen.
set -e

SERVER="root@76.13.5.157"
ZIEL="/var/www/jtkconsulting"

# Das Formular sendet standardmäßig an /api/anfrage auf derselben Domain. Ohne Weiterleitung im
# Webserver oder ohne laufende Plattform würde jede Anfrage scheitern, daher vorher prüfen.
# Wer PUBLIC_ANFRAGE_URL selbst setzt (Umgebung oder .env), hat das Ziel bewusst gewählt.
if [ -z "${PUBLIC_ANFRAGE_URL+gesetzt}" ] && ! grep -qs '^PUBLIC_ANFRAGE_URL=' .env; then
  # Gesucht wird die Weiterleitung selbst: `handle /api/*` bzw. `location /api/` stehen auch im
  # 404-Block für die übrigen /api-Pfade und bewiesen deshalb nicht mehr, dass /api/anfrage ankommt.
  if ! ssh "$SERVER" "{ grep -qsF '@plattform path /api/anfrage' /etc/caddy/Caddyfile || grep -rqsF 'location ~ ^/api/(anfrage' /etc/nginx/; } \
      && curl -fsS -o /dev/null --max-time 5 http://127.0.0.1:3100/api/gesundheit"; then
    echo "Abbruch: Das Anfrageformular hätte kein Ziel."
    echo "Auf dem Server fehlt die Weiterleitung von /api/anfrage (siehe deploy/Caddyfile) oder die Koch-Plattform"
    echo "läuft nicht (curl http://127.0.0.1:3100/api/gesundheit)."
    echo "Übergangsweise mit E-Mail-Programm statt Plattform:  PUBLIC_ANFRAGE_URL= sh deploy/deploy.sh"
    exit 1
  fi
fi

npm run build
ssh "$SERVER" "mkdir -p '$ZIEL'"
rsync -avz --delete dist/ "$SERVER:$ZIEL/"
echo "Hochgeladen nach $SERVER:$ZIEL"

# KI-Demos: nur Bescheid geben, nie abbrechen. Ohne Weiterleitung, ohne Schlüssel im Website-Dienst oder mit
# aufgebrauchtem Budget zeigen die Demos ihre Meldung statt des Startknopfs; der Rest der Seite bleibt unberührt.
# Wer PUBLIC_KI_URL selbst setzt (leer = Demos aus), hat das bewusst gewählt. Die Abfrage läuft über HTTPS von
# hier aus und prüft so DNS, TLS, Caddy und Dienst in einem Schritt.
if [ -z "${PUBLIC_KI_URL+gesetzt}" ] && ! grep -qs '^PUBLIC_KI_URL=' .env; then
  ki=$(curl -fsS --max-time 5 https://jtkconsulting.de/api/ki/status 2>/dev/null || true)
  # Das erste „bereit“ gehört zu den Demos; die Stimme des Probeanrufs trägt ein eigenes
  case "$ki" in
    *'{"ok":true,"bereit":true'*) echo "KI-Demos: bereit." ;;
    *'{"ok":true,"bereit":false'*) echo "Hinweis: KI-Demos nicht bereit (Website-Dienst meldet bereit=false, etwa ohne Schlüssel oder mit aufgebrauchtem Budget)." ;;
    *) echo "Hinweis: https://jtkconsulting.de/api/ki/status antwortet nicht (Caddy-Weiterleitung fehlt? sh deploy/einrichten.sh). Die KI-Demos zeigen ihre Meldung." ;;
  esac
fi
