# Roadmap & Action Plan: Expanded Job Sources for "Técnico de Educación Infantil"

## 1. Objective & Target Roles
The system will be enhanced to aggressively index, parse, and monitor vacancies for **Técnico/a de Educación Infantil (TSEI)**, **Educador/a Infantil (0-3 y 3-6 años)**, and **Auxiliar de Aula Infantil** across Madrid and Spain.

---

## 2. Source Investigation Matrix

| Source | Category / Scope | Technical Ingestion Method | Value for Educación Infantil |
| :--- | :--- | :--- | :--- |
| **InfoJobs** | Top Generalist / Education Portal in Spain | Search endpoint / RSS / Cheerio crawler for query `Técnico Educación Infantil` in Madrid | 🔥 Highest volume of private kindergarten (*escuelas infantiles*) vacancies. |
| **Escuelas Católicas (FERE-CECA)** | Religious / Concertada teaching network | Scraper for `escuelascatolicas.es/empleo` job board | 🔥 High consistency for private/concertado nursery & infant classrooms. |
| **Jooble / Jobrapido / Neuvoo (Talent.com)** | Meta-search aggregators with open RSS/XML feeds | RSS/API feed parsing | ⚡ Broad coverage of independent daycares and childcare centers. |
| **Comunidad de Madrid (Bolsa de Empleo / Oposiciones / CAM)** | Public Education & Regional Childcare Network | Portal crawling for CAM `Empleo Público / Bolsas Extraordinarias` & Red de Escuelas Infantiles Públicas | 🏛️ Crucial for official interim teacher pools (*bolsas de interinos*). |
| **Colejobs (Active)** | Education-focused portal | HTML pagination & detail scraping (`scripts/scrape.ts`) | ✅ Already partially implemented; needs specialized keyword tuning. |
| **Indeed España (Active)** | Aggregator | HTML parsing with Cloudflare bypass / fallback query syndication | ✅ Active; expand query strings to `Técnico Superior Educación Infantil Madrid`. |

---

## 3. Implementation Tasks Breakdown

### Phase 1: Scraping Engine Modularization & Expansion (`scripts/scrape.ts`)
- [x] **Task 1.1**: Modularize scrapers by source:
  - Created separate scraper modules in `scripts/scrapers/` (`colejobs.ts`, `infojobs.ts`, `indeed.ts`, `infoempleo.ts`, `types.ts`, `utils.ts`).
- [x] **Task 1.2**: Resilient educational crawling & network probe:
  - Extracted verified vacancies tagged for *Educación Infantil*, *Técnicos de Aula*, and *Primer Ciclo (0-3)* across regional centers.
- [x] **Task 1.3**: Implement **InfoJobs** & multi-source integration:
  - Live query extraction targeting: `"Técnico de Educación Infantil"`, `"Educador Infantil"`, `"TSEI"`, `"Auxiliar Infantil"` in Madrid.
- [x] **Task 1.4**: Add automated rate-limiting, randomized headers, and link health validation strategies for resilient multi-source scraping.

### Phase 2: Domain-Specific Filtering & Classification
- [x] **Task 2.1**: Refine the scope classification algorithm in `src/App.tsx` and `scripts/scrape.ts`:
  - Tag jobs with exact certification tags:
    - `TSEI` (Técnico Superior en Educación Infantil / FP Grado Superior)
    - `Grado Magisterio Infantil` (Grado universitario)
    - `Monitor_Ocio` (Monitor de Ocio y Tiempo Libre / Extraescolares / Comedores)
    - `Auxiliar de Jardín de Infancia / Aula`
- [x] **Task 2.2**: Add specific salary & schedule parsing for the Spanish *Convenio Colectivo de Centros de Educación Infantil* (0-3 years), *Enseñanza Concertada*, and *Ocio Educativo*.

### Phase 3: UI & Search Experience Enhancements
- [x] **Task 3.1**: Add a dedicated filter chip for **"Técnico Educación Infantil (0-3)"** in the top navigation of [`src/App.tsx`](file:///home/blackman/Projects/CentralEspJobFinder/src/App.tsx).
- [x] **Task 3.2**: Add source badge icons with direct links to the original application portal.
- [x] **Task 3.3**: Include automated daily/periodic scraping scheduler support in backend (`server.ts`).

### Phase 4: Verification & Testing
- [ ] **Task 4.1**: Execute comprehensive scrape test (`npm run scrape`) with all new sources enabled.
- [ ] **Task 4.2**: Validate link health checker and ensure no false positives or broken job links reach [`public/data/jobs.json`](file:///home/blackman/Projects/CentralEspJobFinder/public/data/jobs.json).
- [ ] **Task 4.3**: Test AI CV analysis on newly collected Técnico de Educación Infantil vacancies.
