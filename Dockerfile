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
COPY --from=builder /src/docker-nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh \
  && rm -rf /usr/share/nginx/html \
  && ln -s /app /usr/share/nginx/html

# Environment variables — override these at runtime:
#   BETTERCORD_HOMESERVER   Matrix homeserver hostname, e.g. matrix.example.com
#   BETTERCORD_LIVEKIT_URL  LiveKit JWT service URL, e.g. https://livekit-jwt.example.com
ENV BETTERCORD_HOMESERVER="" \
    BETTERCORD_LIVEKIT_URL=""

ENTRYPOINT ["/docker-entrypoint.sh"]
