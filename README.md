# Nightscout Lucid

A modern, Dexcom Clarity-inspired glucose analytics dashboard that connects directly to your personal [Nightscout](https://nightscout.github.io/) instance. No accounts, no cloud — your data stays between you and your CGM.

**Live at**: [https://goodnumbers.net/clarity](https://goodnumbers.net/clarity)

---

## Features

- **Overview** — Average glucose, GMI (estimated HbA1c), Coefficient of Variation, and a 5-level Time in Range stacked bar (Very High / High / In Range / Low / Very Low)
- **AGP Profile** — Ambulatory Glucose Profile chart (10th, 25th, 50th, 75th, 90th percentiles) with clinical stats header
- **Daily Logs** — Per-day mini trend charts with carb/insulin event markers
- **Weekly Overlay** — Overlapping 24-hour day curves per week, filterable by day-of-week and event type (Highs/Lows)
- **Statistics** — Daily and Hourly tables showing avg glucose, SD/CV, and all 5 TIR percentages
- **Units toggle** — Switch between mg/dL and mmol/L at any time
- **Date range** — 7, 14, 30, or 90-day windows
- **Session-only** — Credentials are held in memory; nothing is persisted to a server

---

## Local Development

### Prerequisites

- Node.js 20+
- A running Nightscout instance with a read token

### Setup

```bash
npm install
npm run dev
```

The app opens at `http://localhost:5173`. Enter your Nightscout URL and API token on the connection screen.

### Testing

```bash
npm test
```

Runs the full Vitest suite (44 tests across components and utilities).

---

## Deployment

The app is deployed as a Docker container served by Caddy, hosted under the `/clarity` path of [goodnumbers.net](https://goodnumbers.net). It sits alongside the goodnumbers-clean stack, which owns the top-level Caddy reverse proxy.

### How it works

```
Browser → goodnumbers Caddy → /clarity* → clarity container (Caddy:alpine)
                             → *         → goodnumbers frontend (Nginx)
```

The Vite build is compiled with `--base=/clarity/` so all asset paths are rooted correctly. The `clarity` container runs its own minimal Caddy server ([Caddyfile.prod](./Caddyfile.prod)) that handles the SPA `try_files` fallback.

### Files

| File | Purpose |
|---|---|
| [`Dockerfile`](./Dockerfile) | 2-stage build: `node:20-alpine` → `caddy:alpine` |
| [`Caddyfile.prod`](./Caddyfile.prod) | Internal container Caddy — serves `/srv/clarity`, SPA fallback |
| [`justfile`](./justfile) | `build`, `package`, `deploy` commands |
| [`.env`](./.env) | Local-only server credentials (not committed) |

### Configuration

Create a `.env` file in the project root (already in `.gitignore`):

```bash
DEPLOY_SERVER_IP=<your-server-ip>
DEPLOY_SERVER_USER=<your-ssh-username>
```

These match the same values used in `goodnumbers-clean/.env`.

### First-time server setup (one-time only)

The server needs the updated `docker-compose.yml` and `Caddyfile` from goodnumbers-clean before the first clarity deploy. Run a normal goodnumbers deploy from that repo:

```bash
# From goodnumbers-clean/
just deploy
```

This pushes the compose file and Caddyfile (which now include the `clarity` service and `/clarity*` proxy route) to the server.

### Deploying clarity

```bash
# From nightscout-lucid/
just deploy
```

This will:
1. Build the Docker image with `--base=/clarity/`
2. Save it to `deploy-artifacts/clarity.tar.gz`
3. `rsync` the tarball to the server
4. SSH in, `docker load` the image, and restart just the `clarity` container
5. Clean up the artifact from the server

### Local Docker test (before deploying)

To verify the container locally before pushing:

```bash
just run-local
# Opens at http://localhost:8080/clarity/
```

### All `just` commands

| Command | Description |
|---|---|
| `just dev` | Start Vite dev server |
| `just test` | Run test suite |
| `just build` | Build Docker image |
| `just package` | Build + save image to tarball |
| `just deploy` | Full deploy to production server |
| `just run-local` | Run production container locally |
| `just logs` | Tail clarity container logs on server |

---

## Architecture

```
src/
├── components/
│   ├── ConnectionPage.tsx      # Credential entry & validation
│   ├── OverviewPage.tsx        # Main dashboard shell & tab routing
│   ├── AGPChart.tsx            # Ambulatory Glucose Profile (ECharts)
│   ├── HourlyTIRChart.tsx      # TIR by hour of day (ECharts)
│   ├── HourlyGlucoseChart.tsx  # 15-min glucose summary chart (ECharts)
│   ├── WeeklyOverlayChart.tsx  # Weekly 24-hour overlay (ECharts)
│   ├── DailyMiniChart.tsx      # Per-day mini trend chart (ECharts)
│   ├── DailyStatsTable.tsx     # Daily statistics table
│   └── HourlyStatsTable.tsx    # Hourly statistics table
└── utils/
    ├── nightscout.ts           # Nightscout API client & types
    └── metrics.ts              # Glucose metric calculations
```

### Tech stack

- **React 19** + **TypeScript**
- **Vite** (build + dev server)
- **Tailwind CSS v4**
- **Apache ECharts** (all charts)
- **Vitest** + **React Testing Library** (tests)
- **Caddy** (production serving)

---

## Related

- [goodnumbers-clean](../goodnumbers-clean) — the host stack that provides Caddy, TLS, and the `/clarity` proxy route
- [Nightscout docs](https://nightscout.github.io/)
- [Dexcom Clarity](https://clarity.dexcom.com/) — the design inspiration
