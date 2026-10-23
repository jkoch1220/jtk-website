#!/usr/bin/env sh
# Einmalig ausführen (im Projektordner): sh deploy/einrichten.sh
#
# Richtet den VPS für die Website ein und lädt sie danach hoch:
#  - prüft, ob Port 80/443 frei ist, und bricht sonst ab, ohne etwas zu ändern
#  - installiert Caddy aus der offiziellen Paketquelle, falls noch nicht vorhanden
#  - legt /var/www/jtkconsulting an und trägt die Seite in die Caddy-Konfiguration ein
#    (eine bestehende Konfiguration wird gesichert und ergänzt, nicht überschrieben)
#  - trägt zusätzlich app.koch.consulting für den Website-Dienst ein (Docker auf 127.0.0.1:3100,
#    Deployment über website-dienst/deploy/deploy.sh im Portal-Repo; dort liegt auch die Portal-API);
#    von der Website gehen nur /api/anfrage, /api/e, /api/gesundheit und /api/termine(/*) dorthin
#  - ergänzt in einer bestehenden Konfiguration ohne Terminbuchung den Matcher um /api/termine
#    (gesichert, danach caddy validate, sonst zurück zum alten Stand)
#  - stellt eine bestehende Konfiguration, in der koch.consulting dieselbe Website zeigte, auf eine
#    301-Weiterleitung nach jtkconsulting.de um und lässt die 404-Seite komprimiert ausliefern (ebenso gesichert)
#  - begrenzt die Aufbewahrung des System-Journals auf 7 Tage (dort landen Caddys Fehlermeldungen
#    mit IP-Adressen, siehe Datenschutzerklärung „Server-Protokolle“)
#  - gibt Port 80/443 in der Firewall ufw frei, falls ufw aktiv ist
# Steht jtkconsulting.de schon in der Caddy-Konfiguration, aber ohne die Weiterleitung von /api/anfrage,
# /api/e und /api/gesundheit (auch der alte Block, der alles unter /api/* weiterreichte), bricht das Skript
# ab, bevor etwas geändert oder hochgeladen wird.
set -e

SERVER="root@76.13.5.157"
ZIEL="/var/www/jtkconsulting"
DOMAIN="jtkconsulting.de"
ZWEIT_DOMAIN="koch.consulting"

# Gleicher Inhalt wie deploy/Caddyfile (Website-Teil)
KONFIG='www.jtkconsulting.de {
	redir https://jtkconsulting.de{uri} permanent
}

# koch.consulting leitet auf jtkconsulting.de um (301 samt Pfad): Google soll nur eine Adresse der Website
# kennen. Mail und app.koch.consulting betrifft das nicht.
koch.consulting, www.koch.consulting {
	redir https://jtkconsulting.de{uri} permanent
}

jtkconsulting.de {
	root * /var/www/jtkconsulting
	encode zstd gzip

	# Kontaktformular, Terminbuchung, Tracking und Gesundheitscheck gehen an den Website-Dienst (Docker,
	# nur lokal erreichbar). Nur diese Pfade: Die Portal-API (/api/portal/*) gibt es nur über app.koch.consulting.
	@plattform path /api/anfrage /api/e /api/gesundheit /api/termine /api/termine/*
	handle @plattform {
		reverse_proxy 127.0.0.1:3100
	}

	# Alle anderen /api-Pfade gibt es auf der Website nicht
	handle /api/* {
		respond 404
	}

	handle {
		file_server
	}

	# Dateien mit Hash im Namen dürfen lange im Cache bleiben
	header /_astro/* Cache-Control "public, max-age=31536000, immutable"

	handle_errors {
		# Fehlerseiten gehen nicht durch das encode oben; ohne diese Zeile käme die 404-Seite unkomprimiert
		encode zstd gzip
		@nichtGefunden expression `{err.status_code} == 404`
		handle @nichtGefunden {
			rewrite * /404.html
			file_server
		}
	}
}'

# Gleicher Inhalt wie deploy/Caddyfile (Plattform-Teil) bzw. website-dienst/deploy/Caddyfile.dienst im Portal-Repo
APP_DOMAIN="app.koch.consulting"
APP_KONFIG='# Website-Dienst (Portal-API, Formular, Tracking)
app.koch.consulting {
	encode zstd gzip
	header Strict-Transport-Security "max-age=31536000; includeSubDomains"
	reverse_proxy 127.0.0.1:3100
}'

if [ ! -f package.json ] || [ ! -f deploy/deploy.sh ]; then
  echo "Bitte im Projektordner ausführen (dort, wo package.json liegt)."
  exit 1
fi

echo "Lade Caddy-Konfiguration hoch ..."
printf '%s\n' "$KONFIG" | ssh "$SERVER" "cat > /tmp/jtk.caddy"
printf '%s\n' "$APP_KONFIG" | ssh "$SERVER" "cat > /tmp/plattform.caddy"

echo "Richte den Server ein ..."
ssh "$SERVER" "ZIEL='$ZIEL' DOMAIN='$DOMAIN' ZWEIT_DOMAIN='$ZWEIT_DOMAIN' APP_DOMAIN='$APP_DOMAIN' sh -s" <<'REMOTE'
set -e
DATEI="${CADDYFILE:-/etc/caddy/Caddyfile}"
NEU="${NEUE_KONFIG:-/tmp/jtk.caddy}"
APP_NEU="${NEUE_APP_KONFIG:-/tmp/plattform.caddy}"

# Matcher der Website für den Website-Dienst: ALT ohne Terminbuchung (bis Oktober 2026), NEU wie in
# deploy/Caddyfile. ALT ist der Anfang von NEU, die Abbruch-Prüfung erkennt so beide Fassungen.
MATCHER_ALT="@plattform path /api/anfrage /api/e /api/gesundheit"
MATCHER_NEU="@plattform path /api/anfrage /api/e /api/gesundheit /api/termine /api/termine/*"

if grep -q "^$DOMAIN" "$DATEI" 2>/dev/null && ! grep -qF "$MATCHER_ALT" "$DATEI"; then
  echo "$DOMAIN steht schon in $DATEI, aber nicht mit der Weiterleitung von /api/anfrage, /api/e und"
  echo "/api/gesundheit an den Website-Dienst (ältere Fassung oder von Hand angelegt). Ohne sie scheitert das"
  echo "Formular, mit der alten Fassung wäre die Portal-API auch über $DOMAIN erreichbar. Bitte den Block"
  echo "für $DOMAIN dort von Hand durch den aus deploy/Caddyfile ersetzen und dieses Skript erneut ausführen."
  echo "Abbruch. Auf dem Server wurde nichts verändert."
  rm -f "$NEU" "$APP_NEU"
  exit 1
fi

belegt=$(ss -tlnpH '( sport = :80 or sport = :443 )' | grep -v '"caddy"' || true)
if [ -n "$belegt" ]; then
  echo "Port 80 oder 443 ist schon von einem anderen Programm belegt:"
  echo "$belegt"
  echo "Abbruch. Auf dem Server wurde nichts verändert."
  rm -f "$NEU" "$APP_NEU"
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

# Vor der ersten Änderung einmal sichern
gesichert=""
sichern() {
  if [ -z "$gesichert" ]; then
    if [ -s "$DATEI" ]; then cp "$DATEI" "$DATEI.vorher"; fi
    gesichert=1
  fi
}

# Hängt einen Block an; die Standard-Konfiguration nach der Installation wird ersetzt
eintragen() {
  sichern
  if [ ! -s "$DATEI" ] || grep -q "/usr/share/caddy" "$DATEI"; then
    cp "$1" "$DATEI"
  else
    printf '\n' >> "$DATEI"
    cat "$1" >> "$DATEI"
  fi
}

if grep -q "^$DOMAIN, $ZWEIT_DOMAIN {\$" "$DATEI" 2>/dev/null; then
  # Fassung vom 22.10.2026, in der koch.consulting dieselbe Website zeigte: Ab jetzt leiten koch.consulting und
  # www.koch.consulting per 301 auf $DOMAIN um, damit Google nur eine Adresse der Website kennt
  sichern
  sed -i "s/^$DOMAIN, $ZWEIT_DOMAIN {\$/$DOMAIN {/" "$DATEI"
  sed -i "s|^www\.$ZWEIT_DOMAIN {\$|$ZWEIT_DOMAIN, www.$ZWEIT_DOMAIN {|" "$DATEI"
  sed -i "s|redir https://$ZWEIT_DOMAIN{uri} permanent|redir https://$DOMAIN{uri} permanent|" "$DATEI"
  sed -i "s|^# $ZWEIT_DOMAIN zeigt dieselbe Website.*|# $ZWEIT_DOMAIN leitet auf $DOMAIN um (301 samt Pfad)|" "$DATEI"
  echo "$ZWEIT_DOMAIN leitet jetzt per 301 auf $DOMAIN um."
elif grep -q "^$DOMAIN" "$DATEI" 2>/dev/null; then
  echo "$DOMAIN steht schon in $DATEI, dieser Block wird nur bei Bedarf ergänzt (Weiterleitung, komprimierte 404, Terminbuchung)."
else
  eintragen "$NEU"
fi

# Fassung ganz ohne koch.consulting: die Weiterleitung anhängen
if grep -q "^$DOMAIN" "$DATEI" 2>/dev/null && ! grep -q "^\(www\.\)\?$ZWEIT_DOMAIN[ ,]" "$DATEI"; then
  sichern
  printf '\n%s, www.%s {\n\tredir https://%s{uri} permanent\n}\n' "$ZWEIT_DOMAIN" "$ZWEIT_DOMAIN" "$DOMAIN" >> "$DATEI"
  echo "$ZWEIT_DOMAIN leitet jetzt per 301 auf $DOMAIN um."
fi

# Ältere Fassung ohne komprimierte Fehlerseiten: encode vor den 404-Matcher setzen (validiert wird unten)
if grep -q "^$DOMAIN" "$DATEI" 2>/dev/null && ! grep -B1 "@nichtGefunden expression" "$DATEI" | grep -q "encode"; then
  sichern
  sed -i "s|^\([[:space:]]*\)@nichtGefunden expression|\1encode zstd gzip\n\1@nichtGefunden expression|" "$DATEI"
  echo "Die 404-Seite von $DOMAIN geht jetzt komprimiert raus."
fi

# Ältere Fassung ohne Terminbuchung: /api/termine zusätzlich an den Website-Dienst (nur genau die alte
# Zeile wird ersetzt; validiert wird unten, bei Fehler kommt der gesicherte Stand zurück)
if grep -q "^$DOMAIN" "$DATEI" 2>/dev/null && ! grep -qF "$MATCHER_NEU" "$DATEI"; then
  if grep -q "^[[:space:]]*$MATCHER_ALT[[:space:]]*\$" "$DATEI"; then
    sichern
    sed -i "s|^\([[:space:]]*\)$MATCHER_ALT[[:space:]]*\$|\1$MATCHER_NEU|" "$DATEI"
    echo "$DOMAIN leitet jetzt auch /api/termine an den Website-Dienst weiter (Terminbuchung)."
  else
    echo "Hinweis: Die Zeile „$MATCHER_ALT“ in $DATEI wurde von Hand geändert und bleibt so."
    echo "Für die Terminbuchung muss sie lauten: $MATCHER_NEU"
  fi
fi

if grep -q "^$APP_DOMAIN" "$DATEI" 2>/dev/null; then
  echo "$APP_DOMAIN steht schon in $DATEI, dieser Block bleibt unverändert."
else
  eintragen "$APP_NEU"
fi

if [ -n "$gesichert" ]; then
  if ! caddy validate --config "$DATEI" --adapter caddyfile >/dev/null 2>&1; then
    echo "Die neue Caddy-Konfiguration ist ungültig. Der alte Stand wird wiederhergestellt."
    if [ -f "$DATEI.vorher" ]; then cp "$DATEI.vorher" "$DATEI"; fi
    rm -f "$NEU" "$APP_NEU"
    exit 1
  fi
fi
rm -f "$NEU" "$APP_NEU"

# Caddy schreibt kein Zugriffsprotokoll, Fehlermeldungen (z. B. 502, solange die Plattform neu
# startet) enthalten aber IP und User-Agent und landen im Journal: höchstens 7 Tage aufheben
mkdir -p /etc/systemd/journald.conf.d
printf '[Journal]\nMaxRetentionSec=7day\n' > /etc/systemd/journald.conf.d/aufbewahrung.conf
systemctl restart systemd-journald 2>/dev/null || true

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
fi

systemctl enable caddy >/dev/null 2>&1 || true
systemctl reload caddy 2>/dev/null || systemctl restart caddy
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
