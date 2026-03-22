## Builder
FROM node:24.13.1-alpine AS builder

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

# Environment variables — override these at runtime via docker-compose.yml or -e flags.
# See .env.example for full documentation.
ENV MESH_HOMESERVER="" \
    MESH_LIVEKIT_URL="" \
    MESH_PRESENCE_URL="" \
    MESH_VOICE_STATE_MODE="livekit" \
    MESH_AUTHORITATIVE_BRIDGE_MODE="false" \
    MESH_POLLS_URL="" \
    MESH_WHITEBOARD_URL=""

ENTRYPOINT ["/docker-entrypoint.sh"]
