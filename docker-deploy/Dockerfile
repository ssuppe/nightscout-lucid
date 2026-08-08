
## Stage 1: Build the Vite app
FROM node:20-alpine AS build
ARG VITE_BASE=/
ENV NODE_ENV=development
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build -- --base=$VITE_BASE

## Stage 2: Serve with Caddy

FROM caddy:alpine
ARG VITE_BASE=/

#LABEL maintainer="theo@vanelsberg.com<e-mail address>"
LABEL name="nightscout-lucid"
LABEL version="1.0.0"
LABEL description="Dexcom Clarity-inspired glucose analytics dashboard"

# Copy built assets into Caddy's default serve root
COPY --from=build /app/dist /srv

# If VITE_BASE is not root (/), nest the assets in the subpath folder so Caddy resolves them correctly
RUN if [ "$VITE_BASE" != "/" ]; then \
      SUBPATH=$(echo "$VITE_BASE" | sed 's/\/$//' | sed 's/^\///') && \
      mkdir -p /srv/$SUBPATH && \
      find /srv -mindepth 1 -maxdepth 1 ! -name "$SUBPATH" -exec mv {} /srv/$SUBPATH/ \; ; \
    fi

# Get the production version of Caddyfile for this container
COPY ./Caddyfile.prod /etc/caddy/Caddyfile
