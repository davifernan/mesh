## Builder
FROM node:25.8.0-alpine AS builder

WORKDIR /src

COPY .npmrc package.json package-lock.json /src/
RUN npm ci
COPY . /src/
ENV NODE_OPTIONS=--max_old_space_size=4096
RUN npm run build


## App
FROM nginx:1.29.5-alpine

# envsubst (from gettext) is used by docker-entrypoint.sh to inject ENV vars into config.json
RUN apk add --no-cache gettext

COPY --from=builder /src/dist /app
COPY --from=builder /src/config.template.json /app/config.template.json
COPY --from=builder /src/docker-nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh \
  && rm -rf /usr/share/nginx/html \
  && ln -s /app /usr/share/nginx/html

# Environment variables — override these at runtime via docker-compose.yml or -e flags:
#   BETTERCORD_HOMESERVER      Matrix homeserver hostname, e.g. matrix.example.com
#   BETTERCORD_LIVEKIT_URL     LiveKit JWT service URL, e.g. https://livekit-jwt.example.com
#   BETTERCORD_PRESENCE_URL    Presence bridge URL (defaults to nginx proxy /api/presence)
#   BETTERCORD_POLLS_URL       Public URL of nordeck/matrix-poll-widget (optional)
#                              e.g. https://polls.your-domain.com
#                              Leave empty to hide Polls from the Activities catalog.
#   BETTERCORD_WHITEBOARD_URL  Public URL of nordeck/matrix-neoboard-widget (optional)
#                              e.g. https://whiteboard.your-domain.com
#                              Leave empty to hide Whiteboard from the Activities catalog.
ENV BETTERCORD_HOMESERVER="" \
    BETTERCORD_LIVEKIT_URL="" \
    BETTERCORD_PRESENCE_URL="" \
    BETTERCORD_POLLS_URL="" \
    BETTERCORD_WHITEBOARD_URL=""

ENTRYPOINT ["/docker-entrypoint.sh"]
