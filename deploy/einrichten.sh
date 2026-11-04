#!/usr/bin/env sh
# Ausführen im Projektordner: sh deploy/einrichten.sh (npm run einrichten). Beim ersten Mal und nach jeder Änderung
# an deploy/Caddyfile.
#
# Ersetzt /etc/caddy/Caddyfile vollständig durch deploy/Caddyfile; fremde Site-Blöcke vorher ins Repo übernehmen.
# Bedient die Datei auf dem Server Namen, Ports oder Blöcke ohne Namen, die deploy/Caddyfile nicht kennt, bricht das
# Skript ab, bevor etwas geändert wird (bewusst trotzdem ersetzen: CADDY_ERSETZEN=1 sh deploy/einrichten.sh). Nur die
# unveränderte Standarddatei aus dem Caddy-Paket ersetzt es ohne diese Prüfung.
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

if ! caddy validate --config "$NEU" --adapter caddyfile >/dev/null 2>&1; then
  echo "deploy/Caddyfile ist für Caddy $CADDY_VERSION ungültig:"
  caddy validate --config "$NEU" --adapter caddyfile 2>&1 | grep -v '"level":"info"' | tail -n 5 || true
  abbrechen
fi

# Was eine Caddyfile bedient, eine Zeile je Eintrag: alle Namen (auch aus import-Dateien und Matchern), alle Ports
# und jeder Block ohne Namen (etwa „:80 { … }“) samt Inhalt. Grundlage ist Caddys eigene Übersetzung nach JSON,
# nicht der Dateitext; Kommentare, Klammern in der nächsten Zeile oder import-Zeilen führen so nicht in die Irre.
# Der Pfad der Datei selbst (file_server versteckt sie) wird herausgenommen, damit gleiche Blöcke gleich aussehen.
bedient() {
  json=$(mktemp)
  if ! caddy adapt --pretty --config "$1" --adapter caddyfile > "$json" 2>/dev/null; then
    rm -f "$json"
    return 1
  fi
  awk -v datei="$1" '
    function ohne_datei(s,   i) {
      while ((i = index(s, "\"" datei "\"")) > 0) s = substr(s, 1, i - 1) "\"\"" substr(s, i + length(datei) + 2)
      return s
    }
    function wert(s) { gsub(/^[[:space:]]*"|",?$/, "", s); return s }
    /^\t\t\t"servers": \{$/ { in_servern = 1; next }
    in_servern && /^\t\t\t\}/ { in_servern = 0 }
    /"host": \[$/ { in_namen = 1; next }
    in_namen && /^\t*\]/ { in_namen = 0 }
    in_namen { print "Name " wert($0); next }
    !in_servern { next }
    /^\t\t\t\t"[^"]*": \{$/ { ports = "" }
    /^\t\t\t\t\t"listen": \[$/ { in_ports = 1; next }
    in_ports && /^\t\t\t\t\t\]/ { in_ports = 0; next }
    in_ports { ports = ports (ports == "" ? "" : ",") wert($0); print "Port " wert($0); next }
    /^\t\t\t\t\t"routes": \[$/ { in_routen = 1; next }
    in_routen && /^\t\t\t\t\t\]/ { in_routen = 0; next }
    in_routen && /^\t\t\t\t\t\t\{$/ { route = ""; mit_namen = 0; next }
    in_routen && /^\t\t\t\t\t\t\},?$/ { if (!mit_namen) print "Block ohne Namen auf " ports ": " ohne_datei(route); next }
    in_routen && /^\t\t\t\t\t\t\t"match": / { mit_namen = 1 }
    in_routen { s = $0; sub(/^[[:space:]]+/, "", s); route = route s }
  ' "$json" | sort -u
  rm -f "$json"
}
# Unverändert aus dem Paket (Willkommensseite aus /usr/share/caddy): darf ohne Rückfrage ersetzt werden
standarddatei() {
  soll=$(dpkg-query -W -f='${Conffiles}\n' caddy 2>/dev/null | awk -v f="$DATEI" '$1 == f {print $2}')
  [ -n "$soll" ] && [ "$(md5sum < "$DATEI" | awk '{print $1}')" = "$soll" ]
}
if [ -s "$DATEI" ] && [ "$CADDY_ERSETZEN" != 1 ] && ! standarddatei; then
  if ! vorher=$(bedient "$DATEI"); then
    echo "Caddy kann $DATEI nicht lesen; ob dort fremde Blöcke stehen, ist so nicht zu prüfen."
    echo "Datei von Hand ansehen, dann bewusst ersetzen mit CADDY_ERSETZEN=1 sh deploy/einrichten.sh"
    abbrechen
  fi
  nachher=$(bedient "$NEU")
  fremd=$(printf '%s\n' "$vorher" | while IFS= read -r a; do
    [ -z "$a" ] || printf '%s\n' "$nachher" | grep -qxF -- "$a" || printf '%s\n' "$a" | cut -c1-110
  done)
  if [ -n "$fremd" ]; then
    echo "$DATEI bedient etwas, das deploy/Caddyfile nicht kennt:"
    echo "$fremd"
    echo "Das ginge verloren. Erst in deploy/Caddyfile übernehmen, oder bewusst ersetzen mit"
    echo "CADDY_ERSETZEN=1 sh deploy/einrichten.sh (ein „Block ohne Namen“ kann auch eine ältere Fassung eines"
    echo "Blocks aus deploy/Caddyfile sein)"
    abbrechen
  fi
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
