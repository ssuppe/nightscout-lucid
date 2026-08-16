# Nightscout Lucid

A modern, Dexcom Clarity-inspired glucose analytics dashboard that connects directly to your personal [Nightscout](https://nightscout.github.io/) instance.

Runs in a Docker container serving a browser-only client report UI. All calculations run client-side in your browser; no data is stored in the cloud.

---

## Features

- **Overview** — Average glucose, GMI (estimated HbA1c), Coefficient of Variation, and a 5-level Time in Range stacked bar (Very High / High / In Range / Low / Very Low)
- **AGP Profile** — Ambulatory Glucose Profile chart (10th, 25th, 50th, 75th, 90th percentiles) with clinical stats header
- **Daily Logs** — Per-day mini trend charts with carb/insulin event markers
- **Weekly Overlay** — Overlapping 24-hour day curves per week, filterable by day-of-week and event type (Highs/Lows)
- **Statistics** — Daily and Hourly tables showing avg glucose, SD/CV, and all 5 TIR percentages
- **Units Toggle** — Switch between mg/dL and mmol/L at any time
- **Date Range** — 7, 14, 30, or 90-day windows
- **Session-Only** — Credentials held in memory; nothing persisted to external servers
- **PDF Download** — Compile and download multi-page, layout-aware PDF reports with custom headers
- **CSV Export** — Export raw glucose entry levels and insulin/carb treatment logs to CSV

---

## Screenshots

<details open>
<summary><b>Click to expand/collapse screenshots</b></summary>
<br/>

### Connection & Login
<p align="center">
  <img src="./docs/screenshots/1_login.png" alt="Nightscout Connection Screen" width="380" />
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="./docs/screenshots/2_nurse_code.png" alt="Nurse Access Code Screen" width="380" />
</p>

### Product Reports & Views
<p align="center">
  <img src="./docs/screenshots/3_overview.png" alt="Dashboard Overview" width="450" /><br/>
  <em>Dashboard Overview: glucose averages, GMI, TIR statistics, and trend charts.</em>
</p>

<p align="center">
  <img src="./docs/screenshots/4_patterns.png" alt="Glucose Patterns" width="450" /><br/>
  <em>Glucose Patterns: trend scanner and outlier detection view.</em>
</p>

<p align="center">
  <img src="./docs/screenshots/5_overlay.png" alt="Weekly Overlay" width="450" /><br/>
  <em>Weekly Overlay: stacked 24-hour glucose curves across days.</em>
</p>

<p align="center">
  <img src="./docs/screenshots/6_daily.png" alt="Daily Logs" width="450" /><br/>
  <em>Daily Logs: consecutive 24-hour curves with insulin/carb event markers.</em>
</p>

<p align="center">
  <img src="./docs/screenshots/7_compare.png" alt="Period Comparison" width="450" /><br/>
  <em>Period Comparison: side-by-side metrics and charts between time windows.</em>
</p>

<p align="center">
  <img src="./docs/screenshots/8_statistics.png" alt="Data Statistics" width="450" /><br/>
  <em>Data Statistics: detailed daily and hourly tabular reports.</em>
</p>

<p align="center">
  <img src="./docs/screenshots/9_agp.png" alt="Ambulatory Glucose Profile" width="450" /><br/>
  <em>Ambulatory Glucose Profile (AGP) report with standard percentile curves.</em>
</p>
</details>

---

## 🚀 User Guide (How to Run & Self-Host)

### 1. Instant Web Browser Version
You can use the live dashboard instantly without installing anything:
👉 **[https://goodnumbers.net/clarity](https://goodnumbers.net/clarity)**

### 2. Self-Hosting via Docker (As-Is)
To run your own container instance on a Synology NAS, Raspberry Pi, Unraid, Portainer, or VPS:

#### Option A: Download Standalone Release (No Git required)
1. Download the latest `deployment.zip` from [GitHub Releases](https://github.com/ssuppe/nightscout-lucid/releases).
2. Unzip it on your server or NAS.
3. Edit `nightscout-lucid.env` with your Nightscout URL and read token.
4. Run:
   ```bash
   docker compose up -d
   ```
   *(Or run `./up.sh`)*

#### Option B: From a Cloned Git Repository
```bash
cd docker-deploy
cp nightscout-lucid.env.example nightscout-lucid.env # Edit your credentials
docker compose up -d
```

For full standalone hosting setup instructions, see the [Docker Deployment Guide](docker-deploy/README.md).

---

## 🛠️ Developer & Contributor Guide

### Prerequisites
- Node.js 20+
- npm

### Local Development Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/ssuppe/nightscout-lucid.git
   cd nightscout-lucid
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

### Testing
```bash
npm test
```
Runs the full Vitest suite across components and metrics logic.

### Building & Testing Local Docker Image
To test a local container build compiled from your working tree:
```bash
docker compose up --build -d
# Accessible at http://localhost:8120/
```

### Maintainer Publishing & Releases
- For SSH server deployment commands (`just deploy`) and task runner info, see the [Maintainer & Deployment Guide](docs/MAINTAINERS.md).
- To publish a release manually via `gh` CLI: `just release v1.0.0`.
- To trigger automatic GitHub Release publishing, push a tag: `git tag v1.0.0 && git push origin v1.0.0`.

---

## Tech Stack

- **React 19** + **TypeScript**
- **Vite** (Build + dev server)
- **Tailwind CSS v4**
- **Apache ECharts** (Visualizations)
- **Vitest** + **React Testing Library** (Testing)
- **Caddy** (Production HTTP server)

---

## AI-driven Development

*Please note: This software was written primarily with AI, driven by a former software engineer. It has been reviewed and includes extensive math tests, but please verify numbers against your Nightscout instance.*

---

## Related & Credits

- [Nightscout Docs](https://nightscout.github.io/)
- [Dexcom Clarity](https://clarity.dexcom.com/) — Design inspiration
- Special thanks to [@vanelsberg](https://github.com/vanelsberg) for designing and building the standalone Docker deployment environment (`docker-deploy/`).
