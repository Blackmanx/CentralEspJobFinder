# JobCrawling - Pipeline de Scraping y Normalización

Este documento detalla el funcionamiento del motor de scraping, fuentes admitidas, filtros de calidad, enriquecimiento de datos y validación de enlaces.

---

## 1. Módulos de Scraping (`scripts/scrapers/`)

El motor de extracción se compone de scrapers modulares orquestados por `scripts/scrape.ts`:

| Archivo | Fuente | Descripción |
| :--- | :--- | :--- |
| `colejobs.ts` | Colejobs | Colegios privados y concertados en la Comunidad de Madrid y alrededores. |
| `colegios.ts` | Colegios.es | Ofertas docentes de centros educativos privados y concertados. |
| `sne.ts` | Sistema Nacional de Empleo | Portal público del SEPE con ofertas educativas y de monitores. |
| `madrid.ts` | Comunidad de Madrid | Ofertas oficiales y bolsas autonómicas de Madrid. |
| `administracionPublica.ts` | Admón Pública (060) | Convocatorias de empleo público educativo en España. |
| `uned.ts` | UNED | Bolsas docentes, profesorado tutor y plazas de apoyo. |
| `uamResearch.ts` | UAM Investigación | Convocatorias de investigación y apoyo formativo. |
| `ucmResearch.ts` | UCM Investigación | Plazas de investigación y proyectos de educación superior. |
| `infojobs.ts` | InfoJobs | Integración mediante búsqueda filtrada de puestos infantiles y ocio educativo. |
| `infoempleo.ts` | Infoempleo | Ofertas seleccionadas de educación y tiempo libre infantil. |

---

## 2. Clasificación y Enriquecimiento

### 2.1 Clasificador (`classifier.ts`)
Cada oferta extraída se etiqueta automáticamente con un **ámbito (scope)**:
- `infantil`: Educación Infantil (0-3 años, 3-6 años, técnicos superiores TSEI, escuelas infantiles).
- `otros_docentes`: Primaria, Secundaria, Bachillerato, FP, idiomas, música, etc.
- `apoyo_admin`: Monitores de comedor, extraescolares, cuidadores, auxiliares de aula, administración educativa.

Además, se detecta el **Convenio Colectivo** aplicable:
- *Convenio de Centros de Asistencia y Educación Infantil*
- *Convenio de Enseñanza Concertada*
- *Convenio de Enseñanza Privada*
- *Convenio de Ocio Educativo y Animación Sociocultural*

### 2.2 Enriquecimiento Geográfico (`locationEnrichment.ts`)
- Determina provincia, municipio, código postal y coordenadas geográficas aproximadas (latitud/longitud) para que la oferta pueda renderizarse automáticamente en el mapa interactivo de Leaflet en el frontend.

---

## 3. Filtros de Calidad y Anti-Bot

1. **Exclusión de Requisito de Inglés C2**:
   - Para las ofertas de Educación Infantil y apoyo, se excluyen automáticamente ofertas que exijan de forma no negociable acreditación C2 / Native English sin permitir niveles intermedios (C1 / B2).
2. **Filtrado Geográfico**:
   - Solo se conservan ofertas de la Comunidad de Madrid y provincias limítrofes relevantes (Toledo, Guadalajara, Segovia, Ávila).
3. **Validación Estricta de URLs (`validate-links.ts`)**:
   - No se permiten enlaces rotos (404), ni páginas de login o pasarelas anti-bot fallidas.
   - Las URLs deben apuntar a la ficha concreta de la vacante, nunca a listados de búsqueda genéricos o perfiles de empresa vacíos.
   - Si una plataforma devuelve 403 / Cloudflare captcha de forma continuada, esa oferta no se incorpora al dataset.
