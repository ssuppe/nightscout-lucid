# justfile — Nightscout Lucid build and task runner
# Run from the nightscout-lucid project root.

# Auto-load local .env file
set dotenv-load

# --- CONFIG (override via .env or custom justfiles) ---
IMAGE_NAME  := "nightscout-clarity"
VITE_BASE   := "/"
ARTIFACT    := "./deploy-artifacts/clarity.tar"

# Fallback environment configurations
SERVER_IP              := env_var_or_default("DEPLOY_SERVER_IP", "")
SERVER_USER            := env_var_or_default("DEPLOY_SERVER_USER", "")
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

# --- BUILD ---
# Build the production Docker container
build:
    @echo "Building Docker image (base={{VITE_BASE}})..."
    docker build --build-arg VITE_BASE={{VITE_BASE}} -t {{IMAGE_NAME}}:latest .

# Run the production container locally to verify
run-local: build
    @echo "Running locally at http://localhost:8120/"
    docker run --rm -p 8120:80 {{IMAGE_NAME}}:latest

# --- RELEASE ---
# Package deployment ZIP and publish a release via gh CLI (e.g. `just release v1.0.0`)
release version:
    @echo "Building deployment release package..."
    cd docker-deploy && bash make_release.sh
    @ZIP_FILE=$$(ls -t docker-deploy/releases/*-deployment.zip | head -n 1); \
    echo "Publishing GitHub Release {{version}} with $$ZIP_FILE..."; \
    gh release create {{version}} "$$ZIP_FILE" --title "Release {{version}}" --notes "Standalone Docker deployment package for Nightscout Lucid."

# --- PRIVATE IMPORTS ---
# Load VM-specific deployment targets if they exist (git-ignored)
import? "private.just"
