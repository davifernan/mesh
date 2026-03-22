#!/bin/sh
# mesh — Interactive Self-Hosting Setup
# Usage: curl -fsSL https://raw.githubusercontent.com/davifernan/mesh/main/setup.sh | sh
set -e

# ── Helpers ──────────────────────────────────────────────────────────────────

BOLD="\033[1m"
DIM="\033[2m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
CYAN="\033[36m"
RESET="\033[0m"

REPO_URL="https://raw.githubusercontent.com/davifernan/mesh/main"
INSTALL_DIR="$PWD/mesh"

info()  { printf "${CYAN}[mesh]${RESET} %s\n" "$1"; }
ok()    { printf "${GREEN}[mesh]${RESET} %s\n" "$1"; }
warn()  { printf "${YELLOW}[mesh]${RESET} %s\n" "$1"; }
err()   { printf "${RED}[mesh]${RESET} %s\n" "$1"; }

ask() {
  printf "${BOLD}$1${RESET} "
  if [ -n "$2" ]; then
    printf "${DIM}($2)${RESET} "
  fi
  read -r REPLY
  if [ -z "$REPLY" ] && [ -n "$2" ]; then
    REPLY="$2"
  fi
}

ask_yn() {
  printf "${BOLD}$1${RESET} ${DIM}[$2]${RESET} "
  read -r REPLY
  if [ -z "$REPLY" ]; then
    REPLY="$2"
  fi
  case "$REPLY" in
    [Yy]*) return 0 ;;
    *) return 1 ;;
  esac
}

# ── Banner ───────────────────────────────────────────────────────────────────

printf "\n"
printf "${BOLD}${CYAN}"
printf "  ┌─────────────────────────────────────────┐\n"
printf "  │             mesh setup                   │\n"
printf "  │     Private. Decentral. Yours.           │\n"
printf "  └─────────────────────────────────────────┘\n"
printf "${RESET}\n"
info "This script will set up mesh for self-hosting."
info "It will ask a few questions, generate a .env file,"
info "download docker-compose.yml, and start all services."
printf "\n"

# ── Check Docker ─────────────────────────────────────────────────────────────

if ! command -v docker >/dev/null 2>&1; then
  err "Docker is not installed."
  info "Install Docker first: https://docs.docker.com/engine/install/"
  info "Or run: curl -fsSL https://get.docker.com | sh"
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  err "Docker Compose (v2) is not available."
  info "It should come with Docker Desktop or docker-ce."
  info "See: https://docs.docker.com/compose/install/"
  exit 1
fi

ok "Docker and Docker Compose detected."
printf "\n"

# ── Create install directory ─────────────────────────────────────────────────

if [ -f "$INSTALL_DIR/docker-compose.yml" ]; then
  warn "Found existing mesh installation in $INSTALL_DIR"
  if ! ask_yn "Overwrite configuration? Existing data (Redis) will be kept." "n"; then
    info "Aborted. Your existing installation is untouched."
    exit 0
  fi
else
  mkdir -p "$INSTALL_DIR"
fi

# ── Matrix Homeserver ────────────────────────────────────────────────────────

printf "\n${BOLD}── Step 1: Matrix Homeserver ──${RESET}\n\n"
info "mesh needs a Matrix homeserver for user accounts and messaging."
info "If you have your own (e.g. Synapse), enter its hostname."
info "Otherwise, press Enter to use matrix.org (public, free)."
printf "\n"
ask "Matrix homeserver hostname:" "matrix.org"
MESH_HOMESERVER="$REPLY"
ok "Homeserver: $MESH_HOMESERVER"

printf "\n"
if ask_yn "Allow users to log in with any Matrix homeserver (not just $MESH_HOMESERVER)?" "y"; then
  MESH_ALLOW_CUSTOM_HOMESERVERS="true"
else
  MESH_ALLOW_CUSTOM_HOMESERVERS="false"
fi

# ── LiveKit ──────────────────────────────────────────────────────────────────

printf "\n${BOLD}── Step 2: LiveKit (Voice & Video) ──${RESET}\n\n"
info "mesh uses LiveKit for voice/video calls."
info "You can either:"
info "  1) Use the built-in LiveKit server (easiest, good for small deployments)"
info "  2) Use LiveKit Cloud or your own external LiveKit server"
printf "\n"
ask "Choose [1] built-in or [2] external:" "1"
LIVEKIT_CHOICE="$REPLY"

USE_BUILTIN_LIVEKIT="false"
MESH_LIVEKIT_URL=""
LIVEKIT_API_KEY="devkey"
LIVEKIT_API_SECRET="devsecret-changeme-32chars-min"
LIVEKIT_URL=""

if [ "$LIVEKIT_CHOICE" = "1" ]; then
  USE_BUILTIN_LIVEKIT="true"
  ok "Using built-in LiveKit server with dev keys."
  info "For production, generate real keys later:"
  info "  docker run --rm livekit/livekit-server generate-keys"
else
  printf "\n"
  info "Enter your LiveKit Cloud or external LiveKit details."
  printf "\n"
  ask "LiveKit JWT service URL (e.g. https://your-app.livekit.cloud):" ""
  MESH_LIVEKIT_URL="$REPLY"
  ask "LiveKit API Key:" ""
  LIVEKIT_API_KEY="$REPLY"
  ask "LiveKit API Secret:" ""
  LIVEKIT_API_SECRET="$REPLY"
  ask "LiveKit Server URL for bridge reconciliation (e.g. wss://your-app.livekit.cloud):" ""
  LIVEKIT_URL="$REPLY"
  ok "External LiveKit configured."
  printf "\n"
  warn "IMPORTANT: Configure your LiveKit webhook URL to point to your mesh domain:"
  warn "  https://YOUR_DOMAIN/api/presence/webhook"
  warn "Set this in your LiveKit Cloud dashboard or livekit.yaml."
fi

# ── Cloudflare Tunnel ────────────────────────────────────────────────────────

printf "\n${BOLD}── Step 3: HTTPS & Domain ──${RESET}\n\n"
info "For production, mesh needs HTTPS (a domain + TLS certificate)."
info "The easiest way is Cloudflare Tunnel — no port forwarding, auto-HTTPS."
info "Alternative: set up nginx/Caddy yourself (see DEPLOY.md)."
printf "\n"

USE_CLOUDFLARE="false"
CLOUDFLARE_TUNNEL_TOKEN=""

if ask_yn "Use Cloudflare Tunnel for HTTPS?" "n"; then
  USE_CLOUDFLARE="true"
  printf "\n"
  info "To get a tunnel token:"
  info "  1. Go to dash.cloudflare.com"
  info "  2. Zero Trust -> Networks -> Tunnels -> Create a tunnel"
  info "  3. Choose 'Cloudflared' connector"
  info "  4. Copy the tunnel token"
  info "  5. In tunnel config, add a public hostname:"
  info "     - Subdomain/Domain: your-mesh-domain.com"
  info "     - Service: http://mesh:80"
  printf "\n"
  warn "The tunnel token is tied to YOUR domain only. Never share it publicly."
  printf "\n"
  ask "Cloudflare Tunnel Token:" ""
  CLOUDFLARE_TUNNEL_TOKEN="$REPLY"
  ok "Cloudflare Tunnel configured."
else
  info "Skipping Cloudflare Tunnel."
  info "You will need to set up a reverse proxy yourself."
  info "See: contrib/nginx/ or contrib/caddy/ for examples."
fi

# ── Bridge Auth Secret ────────────────────────────────────────────────────────

printf "\n${BOLD}── Step 4: Bridge Security ──${RESET}\n\n"
info "The presence bridge can be protected with a shared secret."
info "This prevents unauthorized access to presence data."

BRIDGE_AUTH_SECRET=""
BRIDGE_ALLOWED_ORIGINS=""

if ask_yn "Generate a bridge auth secret? (recommended for production)" "y"; then
  # Try openssl first, fall back to /dev/urandom
  if command -v openssl >/dev/null 2>&1; then
    BRIDGE_AUTH_SECRET=$(openssl rand -hex 32)
  else
    BRIDGE_AUTH_SECRET=$(head -c 32 /dev/urandom | od -A n -t x1 | tr -d ' \n')
  fi
  ok "Bridge auth secret generated."

  if [ "$USE_CLOUDFLARE" = "true" ] || ask_yn "Restrict bridge CORS to a specific domain?" "n"; then
    ask "Your mesh domain (e.g. https://mesh.example.com):" ""
    if [ -n "$REPLY" ]; then
      BRIDGE_ALLOWED_ORIGINS="$REPLY"
      ok "CORS restricted to: $BRIDGE_ALLOWED_ORIGINS"
    fi
  fi
else
  info "Skipping bridge auth (dev mode — all requests allowed)."
fi

# ── Voice State Mode ─────────────────────────────────────────────────────────

printf "\n${BOLD}── Step 5: Presence Mode ──${RESET}\n\n"
info "The presence bridge shows who is muted/on camera in the sidebar."
info "  'livekit' mode = client-side state (simpler, good for dev)"
info "  'bridge'  mode = server-side authoritative state (recommended for production)"
printf "\n"
ask "Voice state mode:" "livekit"
MESH_VOICE_STATE_MODE="$REPLY"

MESH_AUTHORITATIVE_BRIDGE_MODE="false"
if [ "$MESH_VOICE_STATE_MODE" = "bridge" ]; then
  MESH_AUTHORITATIVE_BRIDGE_MODE="true"
fi

# ── Download files ───────────────────────────────────────────────────────────

printf "\n${BOLD}── Downloading mesh files ──${RESET}\n\n"

cd "$INSTALL_DIR"

info "Downloading docker-compose.yml..."
curl -fsSL "$REPO_URL/docker-compose.yml" -o docker-compose.yml
ok "docker-compose.yml downloaded."

# Download LiveKit config if using built-in
if [ "$USE_BUILTIN_LIVEKIT" = "true" ]; then
  mkdir -p contrib/livekit
  info "Downloading LiveKit dev config..."
  curl -fsSL "$REPO_URL/contrib/livekit/livekit.yaml" -o contrib/livekit/livekit.yaml
  ok "contrib/livekit/livekit.yaml downloaded."
fi

# ── Generate .env ────────────────────────────────────────────────────────────

printf "\n${BOLD}── Generating .env ──${RESET}\n\n"

cat > .env << EOF
# mesh — Generated by setup.sh on $(date -u +"%Y-%m-%d %H:%M UTC")
# Full documentation: https://github.com/davifernan/mesh/blob/main/DEPLOY.md

# ── Matrix ───────────────────────────────────────────────────────────────────
MESH_HOMESERVER=$MESH_HOMESERVER
MESH_ALLOW_CUSTOM_HOMESERVERS=$MESH_ALLOW_CUSTOM_HOMESERVERS

# ── LiveKit ──────────────────────────────────────────────────────────────────
MESH_LIVEKIT_URL=$MESH_LIVEKIT_URL
LIVEKIT_API_KEY=$LIVEKIT_API_KEY
LIVEKIT_API_SECRET=$LIVEKIT_API_SECRET
LIVEKIT_URL=$LIVEKIT_URL

# ── Presence Bridge ─────────────────────────────────────────────────────────
MESH_VOICE_STATE_MODE=$MESH_VOICE_STATE_MODE
MESH_AUTHORITATIVE_BRIDGE_MODE=$MESH_AUTHORITATIVE_BRIDGE_MODE
MESH_PRESENCE_URL=
REDIS_URL=redis://redis:6379
BRIDGE_VOICE_STATE_AUTHORITATIVE=$MESH_AUTHORITATIVE_BRIDGE_MODE

# ── Security ─────────────────────────────────────────────────────────────────
BRIDGE_AUTH_SECRET=$BRIDGE_AUTH_SECRET
BRIDGE_ALLOWED_ORIGINS=$BRIDGE_ALLOWED_ORIGINS
MESH_TOKEN_STORAGE_MODE=encrypted-local

# ── Cloudflare Tunnel ────────────────────────────────────────────────────────
CLOUDFLARE_TUNNEL_TOKEN=$CLOUDFLARE_TUNNEL_TOKEN

# ── Activities (optional) ────────────────────────────────────────────────────
MESH_POLLS_URL=
MESH_WHITEBOARD_URL=
POLLS_HOST_PORT=3003
WHITEBOARD_HOST_PORT=3004

# ── Advanced ─────────────────────────────────────────────────────────────────
MESH_PORT=80
LIVEKIT_PORT=7880
EOF

ok ".env generated."

# ── Start services ───────────────────────────────────────────────────────────

printf "\n${BOLD}── Starting mesh ──${RESET}\n\n"

PROFILES=""
if [ "$USE_BUILTIN_LIVEKIT" = "true" ]; then
  PROFILES="$PROFILES --profile livekit"
fi
if [ "$USE_CLOUDFLARE" = "true" ]; then
  PROFILES="$PROFILES --profile cloudflare"
fi

info "Pulling images..."
docker compose $PROFILES pull

info "Starting services..."
docker compose $PROFILES up -d

# ── Wait for health ──────────────────────────────────────────────────────────

printf "\n${BOLD}── Checking health ──${RESET}\n\n"

info "Waiting for services to become healthy..."
RETRIES=0
MAX_RETRIES=30
while [ $RETRIES -lt $MAX_RETRIES ]; do
  if docker compose ps --format json 2>/dev/null | grep -q '"Health":"healthy"' 2>/dev/null || \
     docker compose ps 2>/dev/null | grep -q "(healthy)" 2>/dev/null; then
    break
  fi
  RETRIES=$((RETRIES + 1))
  sleep 2
done

printf "\n"
docker compose $PROFILES ps
printf "\n"

# ── Summary ──────────────────────────────────────────────────────────────────

printf "\n"
printf "${BOLD}${GREEN}"
printf "  ┌─────────────────────────────────────────┐\n"
printf "  │          mesh is running!                │\n"
printf "  └─────────────────────────────────────────┘\n"
printf "${RESET}\n"

ok "Installation directory: $INSTALL_DIR"
ok "Homeserver: $MESH_HOMESERVER"

if [ "$USE_BUILTIN_LIVEKIT" = "true" ]; then
  ok "LiveKit: built-in (dev mode)"
else
  ok "LiveKit: external ($MESH_LIVEKIT_URL)"
fi

if [ "$USE_CLOUDFLARE" = "true" ]; then
  ok "HTTPS: Cloudflare Tunnel"
  info "Make sure your tunnel public hostname points to http://mesh:80"
else
  warn "HTTPS: not configured — set up a reverse proxy for production."
  info "See: $INSTALL_DIR/contrib/nginx/ or DEPLOY.md"
  ok "Local access: http://localhost:${MESH_PORT:-80}"
fi

printf "\n"
info "Manage your deployment:"
info "  cd $INSTALL_DIR"
info "  docker compose ps          # check status"
info "  docker compose logs -f     # view logs"
info "  docker compose down        # stop all"
info "  docker compose pull && docker compose up -d  # update"
printf "\n"
info "Full documentation: https://github.com/davifernan/mesh/blob/main/DEPLOY.md"
printf "\n"
