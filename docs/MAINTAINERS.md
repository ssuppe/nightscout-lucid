# Maintainer & Deployment Guide

This guide covers production deployment, SSH remote publishing, and maintenance commands for Nightscout Lucid maintainers.

---

## Deployment Architecture

Nightscout Lucid is deployed as a standalone Docker container served by Caddy. It can be hosted directly at the root of a domain or configured behind a reverse proxy.

```
Browser → Reverse Proxy (optional) → clarity container (Caddy:alpine)
```

The Vite build is compiled with `--base=/` by default, but supports custom subpaths (e.g., `/clarity/`) via the `VITE_BASE` build argument. The container runs a minimal Caddy server ([`Caddyfile.prod`](../Caddyfile.prod)) that handles static asset serving and SPA `try_files` fallbacks.

### Deployment Files

| File | Purpose |
|---|---|
| [`Dockerfile`](../Dockerfile) | 2-stage build: `node:20-alpine` → `caddy:alpine` |
| [`Caddyfile.prod`](../Caddyfile.prod) | Internal container Caddy config for static asset serving & SPA routing |
| [`justfile`](../justfile) | Task runner for `build`, `package`, and `deploy` commands |
| [`.env`](../.env) | Local server credentials and configuration (git-ignored) |

---

## Deploying to Production

### 1. Configuration

Create or update the `.env` file in the project root with your deployment target details:

```bash
DEPLOY_SERVER_IP=<your-server-ip>
DEPLOY_SERVER_USER=<your-ssh-username>
```

### 2. Deploying via `just`

To build, package, transfer, and deploy directly to your remote server:

```bash
just deploy
```

This automated command will:
1. Build the production Docker image locally.
2. Package the image into a tarball inside `deploy-artifacts/`.
3. Transfer the image to your remote server via `rsync`.
4. Load the image and restart the container on the remote server.

### 3. Verifying Container Locally

To test the production container build locally before deploying:

```bash
just run-local
# Accessible at http://localhost:8120/
```

### 4. Creating Releases & Standalone Deployment ZIPs

#### Automatic (GitHub Actions)
Push a git tag matching `v*`:
```bash
git tag v1.0.0
git push origin v1.0.0
```
The [Release Workflow](../.github/workflows/release.yml) will automatically run `docker-deploy/make_release.sh`, create a GitHub Release, and attach `deployment.zip`.

#### Manual (via `just` and `gh` CLI)
```bash
just release v1.0.0
```

---

## Task Runner Reference (`just`)

| Command | Description |
|---|---|
| `just dev` | Start Vite development server |
| `just test` | Run full test suite |
| `just build` | Build Docker image locally |
| `just package` | Build and save image to a tarball |
| `just deploy` | Full build, transfer, and deploy to production server |
| `just run-local` | Run production container locally on port 8120 |
| `just release <version>` | Build release ZIP and publish GitHub Release via `gh` CLI |
| `just logs` | Tail container logs on the remote production server |
