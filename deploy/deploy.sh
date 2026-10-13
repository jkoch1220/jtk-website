#!/usr/bin/env sh
# Baut die Seite und lädt sie auf den VPS.
# Beim ersten Mal vorher einmal deploy/einrichten.sh ausführen.
set -e

SERVER="root@76.13.5.157"
ZIEL="/var/www/jtkconsulting"

npm run build
ssh "$SERVER" "mkdir -p '$ZIEL'"
rsync -avz --delete dist/ "$SERVER:$ZIEL/"
echo "Hochgeladen nach $SERVER:$ZIEL"
