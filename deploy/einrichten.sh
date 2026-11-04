#!/usr/bin/env sh
# Ausführen im Projektordner: sh deploy/einrichten.sh (npm run einrichten). Beim ersten Mal und nach jeder Änderung
# an deploy/Caddyfile.
#
# Ersetzt /etc/caddy/Caddyfile vollständig durch deploy/Caddyfile; fremde Site-Blöcke vorher ins Repo übernehmen.
# Stehen in der Datei auf dem Server Adressen, die deploy/Caddyfile nicht kennt, bricht das Skript ab, bevor etwas
# geändert wird (bewusst trotzdem ersetzen: CADDY_ERSETZEN=1 sh deploy/einrichten.sh).
#
# Richtet den VPS für die Website ein und lädt sie danach hoch:
#  - prüft, ob Port 80/443 frei ist, und bricht sonst ab, ohne etwas zu ändern
#  - installiert Caddy aus der offiziellen Paketquelle, falls noch nicht vorhanden
#  - bricht ab, wenn Caddy älter als 2.11.7 ist (die KI-Demos brauchen es, siehe unten), und sagt Bescheid, wenn es
#    älter als 2.11.8 ist
#  - legt /var/www/jtkconsulting an und spielt deploy/Caddyfile ein: erst caddy validate, dann Sicherung der alten
#    Datei als /etc/caddy/Caddyfile.vorher, dann reload; nimmt Caddy die neue Datei nicht, kommt die alte zurück
#  - begrenzt die Aufbewahrung des System-Journals auf 7 Tage (dort landen Caddys Fehlermeldungen
#    mit IP-Adressen, siehe Datenschutzerklärung „Server-Protokolle“)
#  - gibt Port 80/tcp, 443/tcp und 443/udp (HTTP/3) in der Firewall ufw frei, falls ufw aktiv ist
# deploy/Caddyfile enthält auch app.koch.consulting für den Website-Dienst (Docker auf 127.0.0.1:3100, Deployment
# über website-dienst/deploy/deploy.sh im Portal-Repo); von der Website gehen nur /api/anfrage, /api/e,
# /api/gesundheit, /api/termine(/*) und /api/ki/* dorthin.
set -e

SERVER="root@76.13.5.157"
ZIEL="/var/www/jtkconsulting"
DOMAIN="jtkconsulting.de"
ZWEIT_DOMAIN="koch.consulting"
APP_DOMAIN="app.koch.consulting"

if [ ! -f package.json ] || [ ! -f deploy/deploy.sh ] || [ ! -f deploy/Caddyfile ]; then
  echo "Bitte im Projektordner ausführen (dort, wo package.json liegt)."
  exit 1
fi

echo "Lade Caddy-Konfiguration hoch ..."
# Nach /root statt /tmp: Dort kann kein anderer Nutzer die Datei vorher anlegen
ssh "$SERVER" "cat > /root/jtk.caddy" < deploy/Caddyfile

echo "Richte den Server ein ..."
ssh "$SERVER" "ZIEL='$ZIEL' CADDY_ERSETZEN='${CADDY_ERSETZEN:-}' sh -s" <<'REMOTE'
set -e
DATEI=/etc/caddy/Caddyfile
NEU=/root/jtk.caddy

abbrechen() {
  rm -f "$NEU"
  echo "Abbruch. Auf dem Server wurde nichts verändert."
  exit 1
}

belegt=$(ss -tlnpH '( sport = :80 or sport = :443 )' | grep -v '"caddy"' || true)
if [ -n "$belegt" ]; then
  echo "Port 80 oder 443 ist schon von einem anderen Programm belegt:"
  echo "$belegt"
  abbrechen
fi

if ! command -v caddy >/dev/null 2>&1; then
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "Kein apt-get gefunden. Bitte Caddy von Hand installieren: https://caddyserver.com/docs/install"
    abbrechen
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

# Die KI-Demos streamen per Server-Sent Events auf POST. Caddy 2.11.6 bricht solche Streams über HTTP/1.1 nach
# 60 s ab, erst 2.11.7 behebt das. 2.11.8 beendet außerdem zu langsame Uploads sauber (read_body), 2.11.7 lässt
# sie hängen. Pakete aus der Caddy-Quelle aktualisiert unattended-upgrades standardmäßig nicht.
CADDY_VERSION=$(caddy version 2>/dev/null | awk '{print $1}' | sed 's/^v//')
aelter_als() { [ "$(printf '%s\n' "$1" "$CADDY_VERSION" | sort -V | head -n 1)" != "$1" ]; }
if [ -z "$CADDY_VERSION" ]; then
  echo "Hinweis: Die Caddy-Version ließ sich nicht lesen; nötig ist mindestens 2.11.7."
elif aelter_als 2.11.7; then
  echo "Caddy $CADDY_VERSION ist älter als 2.11.7; damit brächen die KI-Demos nach 60 s ab."
  echo "Erst aktualisieren: apt-get update && apt-get install --only-upgrade caddy"
  abbrechen
elif aelter_als 2.11.8; then
  echo "Hinweis: Caddy $CADDY_VERSION läuft, 2.11.8 ist besser (apt-get install --only-upgrade caddy)."
fi

# Top-Level-Adressen einer Caddyfile, eine je Zeile (Snippets in Klammern und der Optionsblock zählen nicht)
adressen() {
  awk '/^[^[:space:]#({][^{]*\{[[:space:]]*$/ {
    sub(/[[:space:]]*\{[[:space:]]*$/, "")
    n = split($0, teile, /[[:space:]]*,[[:space:]]*|[[:space:]]+/)
    for (i = 1; i <= n; i++) if (teile[i] != "") print teile[i]
  }' "$1" | sort -u
}
# Die Standarddatei nach der Installation (Willkommensseite aus /usr/share/caddy) darf ersetzt werden
if [ -s "$DATEI" ] && ! grep -q "/usr/share/caddy" "$DATEI" && [ "$CADDY_ERSETZEN" != 1 ]; then
  fremd=$(adressen "$DATEI" | while read -r a; do adressen "$NEU" | grep -qxF "$a" || echo "$a"; done)
  if [ -n "$fremd" ]; then
    echo "$DATEI enthält Adressen, die deploy/Caddyfile nicht kennt:"
    echo "$fremd"
    echo "Diese Blöcke würden verloren gehen. Erst in deploy/Caddyfile übernehmen, oder bewusst ersetzen mit"
    echo "CADDY_ERSETZEN=1 sh deploy/einrichten.sh"
    abbrechen
  fi
fi

if ! caddy validate --config "$NEU" --adapter caddyfile >/dev/null 2>&1; then
  echo "deploy/Caddyfile ist für Caddy $CADDY_VERSION ungültig:"
  caddy validate --config "$NEU" --adapter caddyfile 2>&1 | grep -v '"level":"info"' | tail -n 5 || true
  abbrechen
fi

mkdir -p "$ZIEL"

# Einspielen: alte Datei sichern, neue an ihre Stelle, Caddy neu laden; scheitert das, alten Stand zurück
gesichert=""
if [ -s "$DATEI" ]; then
  cp "$DATEI" "$DATEI.vorher"
  gesichert=1
fi
install -o root -g root -m 0644 "$NEU" "$DATEI"
rm -f "$NEU"
systemctl enable caddy >/dev/null 2>&1 || true
if ! { systemctl reload caddy 2>/dev/null || systemctl restart caddy; }; then
  echo "Caddy hat die neue Konfiguration nicht übernommen (journalctl -u caddy -n 30)."
  if [ -n "$gesichert" ]; then
    cp "$DATEI.vorher" "$DATEI"
    systemctl reload caddy 2>/dev/null || systemctl restart caddy || true
    echo "Der alte Stand ist wiederhergestellt."
  fi
  exit 1
fi
echo "Caddy läuft mit der neuen Konfiguration (alter Stand: $DATEI.vorher)."

# Caddy schreibt kein Zugriffsprotokoll, Fehlermeldungen (z. B. 502, solange die Plattform neu
# startet) enthalten aber IP und User-Agent und landen im Journal: höchstens 7 Tage aufheben
mkdir -p /etc/systemd/journald.conf.d
printf '[Journal]\nMaxRetentionSec=7day\n' > /etc/systemd/journald.conf.d/aufbewahrung.conf
systemctl restart systemd-journald 2>/dev/null || true

# 443/udp für HTTP/3, das Caddy per Alt-Svc ankündigt
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw allow 443/udp >/dev/null
fi

echo "Server ist eingerichtet."
REMOTE

echo "Lade die Website hoch ..."
if ! sh deploy/deploy.sh; then
  echo "Der Server ist eingerichtet, die Website aber noch nicht hochgeladen."
  echo "Erst den Website-Dienst deployen (im Portal-Repo: sh website-dienst/deploy/deploy.sh), dann: sh deploy/deploy.sh"
  exit 1
fi

IP="${SERVER#*@}"
if command -v dig >/dev/null 2>&1; then
  for NAME in "$DOMAIN" "$ZWEIT_DOMAIN" "$APP_DOMAIN"; do
    AKTUELL=$(dig +short "$NAME" A | tr '\n' ' ' | sed 's/ $//')
    if [ "$AKTUELL" != "$IP" ]; then
      echo ""
      echo "Noch offen: $NAME zeigt auf ${AKTUELL:-nichts} statt auf $IP."
      if [ "$NAME" = "$DOMAIN" ] || [ "$NAME" = "$ZWEIT_DOMAIN" ]; then
        echo "Bei GoDaddy ($NAME) unter DNS den A-Record für @ auf $IP ändern. MX/TXT nicht anfassen."
      else
        echo "Bei GoDaddy (Domain koch.consulting) einen A-Record app → $IP anlegen. MX/TXT nicht anfassen."
      fi
      echo "Sobald das greift, holt Caddy das HTTPS-Zertifikat von selbst."
    else
      echo "Fertig: https://$NAME"
    fi
  done
fi
