# CentralEspJobFinder - Technical & Architecture Analysis

## 1. Executive Summary

**CentralEspJobFinder** is an intelligent web platform designed to aggregate, filter, manage, and optimize applications for educational job vacancies in the Community of Madrid and neighbouring provinces (Segovia, Ávila, and Castilla-La Mancha).

The platform integrates automated web scraping, local data persistence, interactive geospatial maps, a rich application tracking workflow, and local-first AI-assisted CV optimization & tailored cover letter generation powered by Google Gemini (with pre-submission client/server PII anonymization).

---

## 2. Architecture Overview

The system consists of three main cooperating layers:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Client (React / Vite)                         │
│  - App.tsx (State, Filters, Scrape triggers, Global CV sync)            │
│  - JobTable.tsx (Interactive vacancies list, direct actions, badge tags)│
│  - JobDrawer.tsx (50/50 Split view, Leaflet maps, CV viewer/optimizer)  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTP (REST API / Static Data)
┌────────────────────────────────────▼────────────────────────────────────┐
│                        Backend Server (Express / tsx)                   │
│  - server.ts: API gateway & AI prompt orchestration                     │
│  - PII anonymization pipeline (regex/heuristic redaction)               │
│  - File parsing (pdf-parse, mammoth) & storage management               │
│  - Gemini API integration (model: gemini-3.1-flash-lite)                │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Spawns / Manages
┌────────────────────────────────────▼────────────────────────────────────┐
│                       Scraping Engine (Cheerio / Axios)                 │
│  - scripts/scrape.ts: Multi-source web aggregator                       │
│  - Sources: Colejobs, Indeed, Escuelas Católicas                        │
│  - Extraction, link health validation, scope tagging, C2 English filter │
│  - Outputs unified public/data/jobs.json                                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Features & Capabilities

### 3.1 Multi-Source Scraping Engine (`scripts/scrape.ts`)
* **Sources**:
  * **Colejobs**: Private and subsidized educational institutions in Madrid.
  * **Indeed**: Specialized early childhood education positions (0-3 years).
  * **Escuelas Católicas**: Catholic and diocesan subsidized teaching job board.
* **Filtering & Quality Rules**:
  * **Geographic restrictions**: Filters out non-matching provinces outside Central Spain.
  * **English C2 Filter**: Automatically discards postings requiring non-negotiable C2/Proficiency English unless alternative equivalents (C1/B2) are allowed.
  * **Link Validation**: Pre-checks vacancy links via HTTP to verify they are active and not 404 or expired.

### 3.2 AI CV Optimizer & Cover Letter Generator (`server.ts`)
* **PII Anonymization (`anonymizeText`)**:
  * Strips emails, phone numbers (+34/international), DNI/NIE IDs, Social Security numbers, Spanish postal codes, and candidate header names before sending text to Gemini.
* **Annotated CV Analysis**:
  * Sends candidate profile and target job description to Gemini (`gemini-3.1-flash-lite`).
  * Returns structured JSON with overall matching summary and inline annotations (`<annotation type="strength|improvement|correction" comment="...">`).
* **Cover Letter Drafting**:
  * Uses a reference template highlighting the candidate's degree, master's research, and project experience to generate personalized letters targeting each school.

### 3.3 Interactive Frontend (`src/`)
* **Split View & Fullscreen Drawer (`src/components/JobDrawer.tsx`)**:
  * Split-pane 50/50 layout: preview original document / job info on the left, annotated feedback on the right.
  * Embedded **Leaflet** map with automatic coordinate resolution and recentering.
* **Pipeline Management (`src/components/JobTable.tsx`)**:
  * Job status tracker: `not_applied`, `applied`, `interviewing`, `offered`, `rejected`.
  * Notes and interview scheduling integration.
* **Multi-Scope Switcher**:
  * Quick filtering by scope: *Educación Infantil*, *Otros Puestos Docentes*, *Apoyo y Administración*, or *Todos los Ámbitos*.
* **Dark / Light & Compact Modes**:
  * CSS design token system (`DESIGN.md`, `src/index.css`) supporting adaptive midnight dark mode and responsive layouts.

---

## 4. Directory & File Structure

| Path | Purpose |
| :--- | :--- |
| `src/App.tsx` | Main application shell, state management, background scanning orchestrator, toast & notifications manager. |
| `src/components/JobTable.tsx` | Responsive data table with scope tabs, status selectors, and action buttons. |
| `src/components/JobDrawer.tsx` | Slide-out panel / fullscreen inspection view with Leaflet map, CV upload, and AI suggestions. |
| `src/types/job.ts` | TypeScript interfaces for `Job`, `UserJobState`, and `ApplicationStatus`. |
| `src/index.css` | Global styling tokens, theme variables, animation keyframes, and component rules. |
| `server.ts` | Express server handling file uploads, text extraction, local storage API, and Gemini API calls. |
| `scripts/scrape.ts` | Standalone multi-portal scraping engine writing to `public/data/jobs.json`. |
| `public/data/` | Data storage directory (`jobs.json`, `user_states.json`, `global_cv.bin`). |
| `init.sh` / `init.bat` | One-step bootstrapping scripts for Linux/macOS and Windows. |
| `_docs/` | Comprehensive technical, functional, and developer documentation. |

---

## 5. Development & Execution

```bash
# Install dependencies
npm install

# Run frontend (Vite) and backend (Express) concurrently
npm run dev

# Run scraping job manually
npm run scrape

# Send formatted email digest of jobs via SMTP (or automate via cron)
npm run notify:email
# Or specify recipient directly via CLI:
npx tsx scripts/emailNotifier.ts --to destinatario@gmail.com

# Scrape and immediately email summary
npm run scrape:email

# Production build
npm run build
```

---

## 6. Automated Email Notification & Raspberry Pi Deployment

CentralEspJobFinder includes an integrated SMTP mailing module ([`scripts/emailNotifier.ts`](file:///home/blackman/Projects/CentralEspJobFinder/scripts/emailNotifier.ts)) for headless automation on a **Raspberry Pi** or home server:

* **HTML Email Template**: Formatted digest with KPI metrics (TSEI 0-3, Monitores, Colegios), applicable Spanish collective agreements (*Convenios Colectivos*), salary bands, direct portal links, and tags.
* **SMTP Credentials**: Configured via `.env` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_TO`).
* **Cron Automation**: Can be scheduled daily (e.g., at 08:00 AM) in crontab:
  ```bash
  0 8 * * * cd /home/pi/CentralEspJobFinder && npm run scrape:email >> /var/log/jobfinder.log 2>&1
  ```
