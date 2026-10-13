#!/usr/bin/env sh
# Einmalig ausführen (im Projektordner): sh deploy/einrichten.sh
#
# Richtet den VPS für die Website ein und lädt sie danach hoch:
#  - prüft, ob Port 80/443 frei ist, und bricht sonst ab, ohne etwas zu ändern
#  - installiert Caddy aus der offiziellen Paketquelle, falls noch nicht vorhanden
#  - legt /var/www/jtkconsulting an und trägt die Seite in die Caddy-Konfiguration ein
#    (eine bestehende Konfiguration wird gesichert und ergänzt, nicht überschrieben)
#  - gibt Port 80/443 in der Firewall ufw frei, falls ufw aktiv ist
set -e

SERVER="root@76.13.5.157"
ZIEL="/var/www/jtkconsulting"
DOMAIN="jtkconsulting.de"

# Gleicher Inhalt wie deploy/Caddyfile
KONFIG='www.jtkconsulting.de {
	redir https://jtkconsulting.de{uri} permanent
}

jtkconsulting.de {
	root * /var/www/jtkconsulting
	encode zstd gzip
	file_server

	# Dateien mit Hash im Namen dürfen lange im Cache bleiben
	header /_astro/* Cache-Control "public, max-age=31536000, immutable"

	handle_errors {
		@nichtGefunden expression `{err.status_code} == 404`
		handle @nichtGefunden {
			rewrite * /404.html
			file_server
		}
	}
}'

if [ ! -f package.json ] || [ ! -f deploy/deploy.sh ]; then
  echo "Bitte im Projektordner ausführen (dort, wo package.json liegt)."
  exit 1
fi

echo "Lade Caddy-Konfiguration hoch ..."
printf '%s\n' "$KONFIG" | ssh "$SERVER" "cat > /tmp/jtk.caddy"

echo "Richte den Server ein ..."
ssh "$SERVER" "ZIEL='$ZIEL' DOMAIN='$DOMAIN' sh -s" <<'REMOTE'
set -e
DATEI="${CADDYFILE:-/etc/caddy/Caddyfile}"
NEU="${NEUE_KONFIG:-/tmp/jtk.caddy}"

belegt=$(ss -tlnpH '( sport = :80 or sport = :443 )' | grep -v '"caddy"' || true)
if [ -n "$belegt" ]; then
  echo "Port 80 oder 443 ist schon von einem anderen Programm belegt:"
  echo "$belegt"
  echo "Abbruch. Auf dem Server wurde nichts verändert."
  rm -f "$NEU"
  exit 1
fi

if ! command -v caddy >/dev/null 2>&1; then
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "Kein apt-get gefunden. Bitte Caddy von Hand installieren: https://caddyserver.com/docs/install"
    exit 1
  fi
  echo "Installiere Caddy ..."
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl gnupg >/dev/null
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy >/dev/null
fi

mkdir -p "$ZIEL"

if grep -q "$DOMAIN" "$DATEI" 2>/dev/null; then
  echo "$DOMAIN steht schon in $DATEI, die Konfiguration bleibt unverändert."
else
  if [ -s "$DATEI" ]; then
    cp "$DATEI" "$DATEI.vorher"
  fi
  if [ ! -s "$DATEI" ] || grep -q "/usr/share/caddy" "$DATEI"; then
    # Standard-Konfiguration nach der Installation: ersetzen
    cp "$NEU" "$DATEI"
  else
    # Es gibt schon eigene Seiten: anhängen
    printf '\n' >> "$DATEI"
    cat "$NEU" >> "$DATEI"
  fi
  if ! caddy validate --config "$DATEI" --adapter caddyfile >/dev/null 2>&1; then
    echo "Die neue Caddy-Konfiguration ist ungültig. Der alte Stand wird wiederhergestellt."
    if [ -f "$DATEI.vorher" ]; then cp "$DATEI.vorher" "$DATEI"; fi
    rm -f "$NEU"
    exit 1
  fi
fi
rm -f "$NEU"

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
fi

systemctl enable caddy >/dev/null 2>&1 || true
systemctl reload caddy 2>/dev/null || systemctl restart caddy
echo "Server ist eingerichtet."
REMOTE

echo "Lade die Website hoch ..."
sh deploy/deploy.sh

IP="${SERVER#*@}"
if command -v dig >/dev/null 2>&1; then
  AKTUELL=$(dig +short "$DOMAIN" A | tr '\n' ' ' | sed 's/ $//')
  if [ "$AKTUELL" != "$IP" ]; then
    echo ""
    echo "Noch offen: $DOMAIN zeigt auf $AKTUELL statt auf $IP."
    echo "Bei GoDaddy unter DNS die A-Records für @ durch einen einzigen A-Record mit $IP ersetzen."
    echo "Sobald das greift, holt Caddy das HTTPS-Zertifikat von selbst."
  else
    echo "Fertig: https://$DOMAIN"
  fi
fi
