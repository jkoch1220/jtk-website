#!/usr/bin/env sh
# Baut die Seite und lädt sie auf den VPS.
set -e

SERVER="root@76.13.5.157"
ZIEL="/var/www/jtkconsulting"

npm run build
rsync -avz --delete dist/ "$SERVER:$ZIEL/"
echo "Hochgeladen nach $SERVER:$ZIEL"
