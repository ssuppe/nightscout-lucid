# Stage 1: Build the Vite app
# VITE_BASE is injected at build time so all asset paths are rooted at /clarity/
FROM node:20-alpine AS build

ARG VITE_BASE=/clarity/
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build -- --base=$VITE_BASE

# Stage 2: Serve with Caddy (consistent with goodnumbers-clean stack)
FROM caddy:alpine

# Copy built assets into Caddy's default serve root under /clarity
COPY --from=build /app/dist /srv/clarity

# Use the production Caddyfile for this container
COPY Caddyfile.prod /etc/caddy/Caddyfile
