# Repository Guidelines

## Project Structure

JobCrawling aggregates education, childcare, leisure-monitor, and official vacancies across Spain.

- `src/` contains the React/TypeScript frontend, reusable UI in `src/components/`, and types in `src/types/`.
- `server.ts` is the Express backend for user state, CV uploads, and Gemini analysis.
- `scripts/` contains scraping, validation, email, and source modules in `scripts/scrapers/` (InfoJobs, Colejobs, Colegios.es, Sistema Nacional de Empleo, Madrid, Administración Pública, and UNED).
- `public/data/` holds generated job data and local runtime state.

## Build, Test, and Development Commands

Run `npm install`, then `npm run dev` to start Express and Vite together. Useful commands:

- `npm run build` — run the strict TypeScript check and create the production Vite build.
- `npm run server` — run only the backend.
- `npm run scrape` — refresh and normalize vacancy data.
- `npm run validate:links` — verify every stored URL is an accessible, concrete offer detail page.
- `npm run notify:email -- --to velsi12blackman@gmail.com` — send the current report to the development recipient.
- `npm run scrape:email` — scrape and send the configured report.

No automated test suite or coverage threshold is configured. Require `npm run build`, `npm run validate:links`, and a smoke test of affected flows before a PR.

Scrapers must never emit search pages, company profiles, category pages, expired calls, or invented/hard-coded vacancies. New records must pass the source-specific URL allow-list and `validate:links`; keep platform anti-bot failures out of the dataset.

## Coding Style and Naming

Use strict TypeScript, two-space indentation, semicolons, and single quotes. Use PascalCase for React components, camelCase for functions/variables, and lowercase descriptive scraper filenames. Keep job shapes in `src/types/job.ts`; avoid `any`.

## Configuration and Operations

Copy `.env.example` to `.env`; keep API keys, SMTP credentials, and personal data out of Git. CV data is anonymized locally. The Pi deployment is `/home/pi/JobCrawling`, runs `/home/pi/run_jobfinder.sh` daily at `0 10 * * *`, and uses `Europe/Madrid`. Validate locally before copying files; preserve its `.env` and runtime data.

After every repository change, immediately run `npm run notify:email -- --to velsi12blackman@gmail.com`. Never manually send to `lalaboom400@gmail.com`; that address is handled only by the Raspberry Pi automation.

## Commits and Pull Requests

Follow the established Conventional Commit style, such as `feat(scrape): ...`, `fix(mobile): ...`, `refactor(email): ...`, or `chore(cron): ...`. PRs should explain the behavior change, list validation performed, link relevant issues, and include screenshots for UI changes. Note any scraper-source, `.env`, deployment, or recipient impact explicitly.
