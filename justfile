# justfile — Nightscout Lucid deploy commands
# Mirrors the goodnumbers-clean deploy convention.
# Run from the nightscout-lucid project root.

# Auto-load .env so DEPLOY_SERVER_IP / DEPLOY_SERVER_USER are available
set dotenv-load

# --- CONFIG (override via .env or shell) ---
SERVER_IP   := env_var_or_default("DEPLOY_SERVER_IP",   "your-server-ip")
SERVER_USER := env_var_or_default("DEPLOY_SERVER_USER", "your-username")
IMAGE_NAME  := "nightscout-clarity"
ARTIFACT    := "./deploy-artifacts/clarity.tar"

NURSE_ACCESS_CODE      := env_var_or_default("NURSE_ACCESS_CODE", "")
NURSE_NIGHTSCOUT_URL   := env_var_or_default("NURSE_NIGHTSCOUT_URL", "")
NURSE_NIGHTSCOUT_TOKEN := env_var_or_default("NURSE_NIGHTSCOUT_TOKEN", "")

# --- LOCAL DEV ---
# Start the Vite dev server
dev:
    npm run dev

# Run the test suite
test:
    npm test

# --- BUILD & PACKAGE ---
# Build the Docker image with /clarity/ as the Vite base path
build:
    @echo "Building Docker image (base=/clarity/)..."
    docker build --build-arg VITE_BASE=/clarity/ -t {{IMAGE_NAME}}:latest .

# Save the image to a raw tar artifact (rsync-friendly)
package: build
    @echo "Packaging image to {{ARTIFACT}}..."
    @mkdir -p ./deploy-artifacts
    docker save {{IMAGE_NAME}}:latest > {{ARTIFACT}}
    @echo "Done: {{ARTIFACT}}"

# --- DEPLOY ---
# Full one-touch deploy: package → push → load & restart on server
deploy: package
    @echo "Pushing artifact to {{SERVER_IP}}..."
    ssh {{SERVER_USER}}@{{SERVER_IP}} "mkdir -p ~/app/deploy-artifacts"
    rsync -avzhP {{ARTIFACT}} {{SERVER_USER}}@{{SERVER_IP}}:~/app/deploy-artifacts/clarity.tar
    @echo "Loading image and restarting clarity service on server..."
    ssh -t {{SERVER_USER}}@{{SERVER_IP}} " \
        cd ~/app && \
        echo '--- Loading image ---' && \
        ((pv deploy-artifacts/clarity.tar 2>/dev/null || cat deploy-artifacts/clarity.tar) | docker load) && \
        echo '--- Restarting clarity container ---' && \
        NURSE_ACCESS_CODE='{{NURSE_ACCESS_CODE}}' \
        NURSE_NIGHTSCOUT_URL='{{NURSE_NIGHTSCOUT_URL}}' \
        NURSE_NIGHTSCOUT_TOKEN='{{NURSE_NIGHTSCOUT_TOKEN}}' \
        docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps clarity && \
        echo '--- Done! https://goodnumbers.net/clarity ---'"

# Tail logs for the clarity container on the server
logs:
    ssh {{SERVER_USER}}@{{SERVER_IP}} "cd ~/app && docker compose logs -f clarity"

# --- LOCAL DOCKER TEST ---
# Run the production container locally to verify before deploying
run-local: build
    @echo "Running locally at http://localhost:8080/clarity/"
    docker run --rm -p 8080:80 {{IMAGE_NAME}}:latest
