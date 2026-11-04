#!/usr/bin/env sh
# Stufe 1 der Server-Härtung des VPS (Debian/Ubuntu). Läuft auf dem Server, nicht hier:
#
#   ssh root@<VPS> 'sh -s' < deploy/haerten.sh        (Adresse wie SERVER in deploy/deploy.sh)
#
# Vorher eine zweite SSH-Sitzung offen halten und erst schließen, wenn sich danach eine neue Sitzung per Schlüssel
# öffnen lässt (README „Server härten“). Mehrfach ausführen schadet nicht: Jeder Schritt setzt nur den Zielzustand.
#
#  - SSH: Anmeldung nur per Schlüssel, root weiter erlaubt (alle Deploy-Skripte laufen als root), höchstens
#    3 Versuche je Verbindung, 30 s für die Anmeldung, kein X11. Bricht ab, bevor etwas geändert wird, wenn root keinen
#    Schlüssel hinterlegt hat, die Sitzung, in der das Skript läuft, laut Journal per Passwort angemeldet ist, oder
#    sshd die Datei aus sshd_config.d nicht liest. Endet mit Fehler, wenn sshd danach trotzdem Passwörter annähme.
#  - Sicherheitsupdates automatisch (unattended-upgrades), fail2ban für SSH
#  - Firewall ufw: eingehend nur SSH (der Port der laufenden Sitzung und alle Ports aus sshd -T), 80/tcp, 443/tcp und
#    443/udp (HTTP/3), sonst alles zu; ausgehend frei
#
# Bewusst nicht hier, sondern erst mit einem eigenen Deploy-Nutzer: PermitRootLogin no, AllowUsers und die
# Docker-Einstellungen in /etc/docker/daemon.json.
#
# Alles steckt in einer Funktion, die mit </dev/null aufgerufen wird: Bei „sh -s“ ist die Standardeingabe das Skript
# selbst, und apt-get oder dpkg dürfen davon nichts verschlucken.

haerten() {
  set -e

  if [ "$(id -u)" != 0 ]; then
    echo "Bitte als root ausführen."
    exit 1
  fi
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "Kein apt-get gefunden. Das Skript ist für Debian/Ubuntu geschrieben. Abbruch, nichts verändert."
    exit 1
  fi

  # --- Vorprüfungen: ohne Schlüssel für root oder ohne Include würde „nur Schlüssel“ aussperren bzw. nicht wirken ---
  SCHLUESSEL=/root/.ssh/authorized_keys
  if ! grep -qE '^[[:space:]]*[^#[:space:]]' "$SCHLUESSEL" 2>/dev/null; then
    echo "In $SCHLUESSEL steht kein Schlüssel. Ohne Passwort-Anmeldung käme danach niemand mehr auf den Server."
    echo "Abbruch, nichts verändert."
    exit 1
  fi
  echo "Für root hinterlegte Schlüssel (zum Vergleich: ssh-add -l oder ssh-keygen -lf <Schlüssel>.pub):"
  ssh-keygen -lf "$SCHLUESSEL" || true
  # Die Sitzung, in der dieses Skript läuft, ist der beste Beleg: Kam sie per Schlüssel, klappt das auch danach.
  # sshd protokolliert „Accepted <Verfahren> for root from <IP> port <Port> ssh2“ (ab OpenSSH 9.8 als sshd-session).
  SITZUNG=$(echo "${SSH_CONNECTION:-}" | awk 'NF == 4 {print $1 " port " $2}')
  ANMELDUNG=""
  if [ -n "$SITZUNG" ] && command -v journalctl >/dev/null 2>&1; then
    ANMELDUNG=$(journalctl -q --no-pager -b -t sshd -t sshd-session 2>/dev/null \
      | grep -F " for root from $SITZUNG ssh2" | grep -F "Accepted " | tail -n 1 || true)
  fi
  case "$ANMELDUNG" in
    *"Accepted publickey "*)
      echo "Diese Sitzung kam per Schlüssel:${ANMELDUNG#*ssh2:}" ;;
    *"Accepted "*)
      echo "Diese Sitzung kam nicht per Schlüssel, sondern so: ${ANMELDUNG#*Accepted }"
      echo "Erst prüfen, dass der Schlüssel genügt (README „Server härten“), dann per Schlüssel neu verbinden."
      echo "Abbruch, nichts verändert."
      exit 1 ;;
    *)
      echo "Hinweis: Wie diese Sitzung angemeldet ist, steht nicht im Journal. Vorher selbst prüfen (README)." ;;
  esac
  if ! grep -qiE '^[[:space:]]*Include[[:space:]]+/etc/ssh/sshd_config\.d/\*\.conf' /etc/ssh/sshd_config; then
    echo "/etc/ssh/sshd_config bindet /etc/ssh/sshd_config.d/*.conf nicht ein; die Härtung würde nicht greifen."
    echo "Abbruch, nichts verändert."
    exit 1
  fi

  # --- SSH ---
  DATEI=/etc/ssh/sshd_config.d/10-haertung.conf
  NEU=$(mktemp)
  cat > "$NEU" <<'EOF'
# Aus deploy/haerten.sh (jtk-website). 10- liegt vor 50-cloud-init.conf; bei sshd gilt der erste Treffer.
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
EOF
  VORHER=""
  if [ -f "$DATEI" ]; then
    VORHER=$(mktemp)
    cp "$DATEI" "$VORHER"
  fi
  install -o root -g root -m 0644 "$NEU" "$DATEI"
  rm -f "$NEU"
  # Ungültige Konfiguration: alten Stand zurück, sshd bleibt unberührt
  if ! sshd -t; then
    if [ -n "$VORHER" ]; then cp "$VORHER" "$DATEI"; else rm -f "$DATEI"; fi
    rm -f "$VORHER"
    echo "sshd -t meldet einen Fehler. $DATEI ist wieder wie vorher. Abbruch."
    exit 1
  fi
  rm -f "$VORHER"
  # Bei Ubuntu mit Socket-Aktivierung läuft ssh.service evtl. gerade nicht; neue Verbindungen lesen die Datei dann
  # ohnehin frisch
  systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null \
    || echo "Hinweis: sshd ließ sich nicht neu laden; die Einstellungen gelten ab der nächsten Verbindung."

  # Alle SSH-Ports: der der laufenden Sitzung (SSH_CONNECTION: Client-IP, Client-Port, Server-IP, Server-Port)
  # und alle, die sshd selbst nennt. So sperrt die Firewall die laufende Verbindung sicher nicht aus.
  SSH_PORTS=$( { sshd -T | awk '$1 == "port" {print $2}'; echo "${SSH_CONNECTION:-}" | awk 'NF == 4 {print $4}'; } \
    | sort -un | tr '\n' ' ')
  [ -n "$SSH_PORTS" ] || SSH_PORTS=22

  # --- Pakete ---
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -q
  # python3-systemd: fail2ban liest die SSH-Anmeldungen aus dem Journal (Debian 12 hat kein auth.log mehr)
  # Geänderte Konfigurationsdateien bei einem Update behalten, statt dass dpkg nachfragt: Ohne Eingabe bräche das
  # Skript sonst hier ab, nach der SSH-Härtung und vor der Firewall
  apt-get install -y -q -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold \
    unattended-upgrades fail2ban python3-systemd ufw

  # Sicherheitsupdates täglich einspielen (ausdrücklich statt per debconf-Voreinstellung). Neu gestartet wird der
  # Server dabei nicht; Caddy und Docker aus fremden Paketquellen aktualisiert das nicht.
  cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

  # fail2ban: SSH-Jail über das Journal, auf allen SSH-Ports. Wer sich 5-mal in 10 Minuten nicht anmelden kann,
  # ist eine Stunde gesperrt (gilt nur für SSH, die Website bleibt erreichbar).
  F2B_PORTS=$(echo "$SSH_PORTS" | sed 's/ *$//; s/ /,/g')
  cat > /etc/fail2ban/jail.d/10-haertung.conf <<EOF
# Aus deploy/haerten.sh (jtk-website)
[sshd]
enabled = true
backend = systemd
port = $F2B_PORTS
maxretry = 5
findtime = 10m
bantime = 1h
EOF
  # Startet fail2ban nicht, soll das die Firewall unten nicht aufhalten
  systemctl enable fail2ban >/dev/null 2>&1 || true
  systemctl restart fail2ban || echo "Hinweis: fail2ban startet nicht, Grund: journalctl -u fail2ban -n 30"

  # --- Firewall ---
  for P in $SSH_PORTS; do ufw allow "$P"/tcp; done
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw allow 443/udp
  ufw default deny incoming
  ufw default allow outgoing
  ufw --force enable

  # Von Docker veröffentlichte Ports umgehen ufw. Der Website-Dienst ist deshalb nur an 127.0.0.1:3100 gebunden;
  # hier nur nachsehen, ob noch etwas anderes von außen erreichbar lauscht.
  OFFEN=$(ss -tlnH 2>/dev/null | awk '{print $4}' \
    | grep -vE '^(127\.[0-9.]+(%[[:alnum:]]+)?|\[::1\]|\[::ffff:127\.[0-9.]+\]):[0-9]+$' \
    | grep -vE ":(80|443$(for P in $SSH_PORTS; do printf '|%s' "$P"; done))\$" || true)
  if [ -n "$OFFEN" ]; then
    echo ""
    echo "Hinweis: Diese Ports lauschen nicht nur lokal. ufw sperrt sie, außer Docker hat sie veröffentlicht:"
    echo "$OFFEN"
  fi

  echo ""
  echo "Wirksame SSH-Einstellungen:"
  WIRKSAM=$(sshd -T)
  echo "$WIRKSAM" | grep -Ei '^(port|passwordauthentication|kbdinteractiveauthentication|permitrootlogin|maxauthtries|logingracetime|x11forwarding) '
  echo ""
  ufw status verbose
  echo ""
  fail2ban-client status sshd || true
  echo ""

  # Bei sshd gilt der erste Treffer: Steht dieselbe Einstellung in sshd_config vor der Include-Zeile oder in einer Datei,
  # die vor 10-haertung.conf gelesen wird, wirkt die Härtung still nicht. Deshalb hier die wirksamen Werte prüfen.
  # sshd -T schreibt prohibit-password als without-password.
  GREIFT=1
  echo "$WIRKSAM" | grep -qx 'passwordauthentication no' || GREIFT=""
  echo "$WIRKSAM" | grep -qxE 'permitrootlogin (prohibit-password|without-password)' || GREIFT=""
  if echo "$WIRKSAM" | grep -q '^kbdinteractiveauthentication '; then
    echo "$WIRKSAM" | grep -qx 'kbdinteractiveauthentication no' || GREIFT=""
  fi
  if [ -z "$GREIFT" ]; then
    echo "WARNUNG: Die SSH-Härtung greift nicht, sshd nimmt weiter Passwörter an oder behandelt root anders als"
    echo "vorgesehen (Werte oben). Ein früher gelesener Eintrag gewinnt; suchen mit:"
    echo "  grep -niE 'PasswordAuthentication|KbdInteractive|PermitRootLogin|^Include' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf"
    exit 1
  fi
  if grep -qiE '^[[:space:]]*Match[[:space:]]' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf 2>/dev/null; then
    echo "Hinweis: Es gibt Match-Blöcke; sie können für einzelne Nutzer oder Adressen anderes erlauben (sshd -T -C …)."
  fi
  echo "Fertig. Jetzt in einem NEUEN Terminal per Schlüssel anmelden, erst danach die alte Sitzung schließen."
}

haerten </dev/null
