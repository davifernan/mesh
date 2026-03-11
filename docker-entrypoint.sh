#!/bin/sh
set -e

# If BETTERCORD_HOMESERVER or BETTERCORD_LIVEKIT_URL are set,
# generate config.json from the template via envsubst.
# Otherwise the shipped config.json (with matrix.org defaults) is used as-is.
if [ -n "$BETTERCORD_HOMESERVER" ] || [ -n "$BETTERCORD_LIVEKIT_URL" ] || [ -n "$BETTERCORD_PRESENCE_URL" ]; then
  echo "[entrypoint] Generating config.json from environment variables..."
  BETTERCORD_HOMESERVER="${BETTERCORD_HOMESERVER:-matrix.org}" \
  BETTERCORD_LIVEKIT_URL="${BETTERCORD_LIVEKIT_URL:-}" \
  BETTERCORD_PRESENCE_URL="${BETTERCORD_PRESENCE_URL:-}" \
  envsubst < /app/config.template.json > /app/config.json
  echo "[entrypoint] Done. config.json:"
  cat /app/config.json
fi

exec nginx -g 'daemon off;'
