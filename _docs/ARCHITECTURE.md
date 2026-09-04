# JobCrawling - Arquitectura del Sistema

Este documento describe la arquitectura global, flujo de datos y especificaciones técnicas de los componentes de **JobCrawling**.

---

## 1. Visión General de la Arquitectura

El sistema está dividido en tres capas principales que colaboran entre sí:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Cliente Web (React + Vite)                      │
│ - SPA en React 18 con TypeScript y diseño adaptativo CSS               │
│ - Almacenamiento local seguro del CV (IndexedDB / localStorage)        │
│ - Tablas interactivas, filtros por ámbito, badges de convenio y mapas │
│ - Split-view / Drawer con vista previa y asistente IA                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST
┌───────────────────────────────────▼────────────────────────────────────┐
│                    Servidor API (Node.js + Express)                    │
│ - server.ts (Puerto 3002 en producción, proxy por Caddy en 3001)       │
│ - Procesamiento de archivos multipart/form-data en memoria (Multer)    │
│ - Extracción de texto al vuelo (pdf-parse, mammoth)                    │
│ - Sanitización y anonimización de PII antes de consultar Gemini        │
│ - Integración Google Generative AI (Gemini 2.5 Flash / Flash Lite)     │
│ - Persistencia de estados de usuario en public/data/user_states.json   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Acceso a disco
┌───────────────────────────────────▼────────────────────────────────────┐
│                    Motor de Scraping & Normalización                   │
│ - scripts/scrape.ts + scripts/scrapers/*                               │
│ - Extracción multicanal (Colejobs, Colegios, SNE, Madrid, etc.)        │
│ - Clasificación de ámbito, convenio y enriquecimiento geográfico      │
│ - Validación de URLs (validate-links.ts)                               │
│ - Salida normalizada en public/data/jobs.json                          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Capa Cliente (Frontend)

- **Tecnologías**: React 18, TypeScript, Vite, Leaflet, CSS nativo con variables de diseño (`src/index.css`).
- **Componentes Clave**:
  - `src/App.tsx`: Shell de la aplicación, carga inicial de datos, filtrado global, gestión de modales y escáner automático en segundo plano.
  - `src/components/JobTable.tsx`: Tabla reactiva con ordenación, paginación, filtros por estado (`not_applied`, `applied`, `interviewing`, etc.) y badges contextuales.
  - `src/components/JobDrawer.tsx`: Panel lateral deslizante (o pantalla completa) con detalles de la oferta, mapa interactivo Leaflet de la ubicación del centro, visualizador del CV cargado localmente, y ejecutor de análisis de adecuación y generación de cartas de presentación.
  - `src/types/job.ts`: Modelos de datos TypeScript (`Job`, `UserJobState`, `ApplicationStatus`).

### 2.1 Gestión de CV en el Cliente
- **Principio**: Privacidad absoluta del usuario. El currículum se guarda **únicamente en el navegador del cliente** (mediante Base64 o Blob en IndexedDB/localStorage).
- **Flujo**:
  1. El usuario sube su CV en formato PDF o Word (`.docx`).
  2. El cliente lo almacena localmente en el navegador (`localStorage` o `IndexedDB`).
  3. Al solicitar un análisis con IA o una carta de presentación, el cliente envía el archivo en la petición HTTP como un campo de `FormData` (`cv`).
  4. La previsualización de PDFs se realiza mediante `URL.createObjectURL(blob)`, sin depender de endpoints de descarga del servidor.

---

## 3. Capa Servidor (Backend Express)

- **Fichero**: `server.ts`
- **Puerto por defecto**: `3002` (configurable vía variable de entorno `PORT`). En producción, Caddy actúa de reverse proxy (`http://localhost:3002`).
- **Middleware Clave**:
  - `cors()`, `express.json({ limit: '10mb' })`, `express.urlencoded()`.
  - `multer({ storage: multer.memoryStorage() })`: **Almacenamiento exclusivo en RAM** para archivos subidos. Nunca se escriben archivos temporales de CV a disco.
- **Servicio de archivos estáticos**:
  - Sirve el directorio `public/` y `dist/` en peticiones estáticas.

### 3.1 Endpoints REST Disponibles

| Método | Ruta | Descripción | Payload / Headers |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/jobs` | Devuelve la lista de ofertas (`jobs.json`) | Ninguno |
| `GET` | `/api/user-states` | Devuelve el estado de las postulaciones (`user_states.json`) | Ninguno |
| `POST` | `/api/user-states` | Actualiza el estado de una vacante para el usuario | `{ jobId, status, notes, interviewDate, cvAnalysis }` |
| `POST` | `/api/analyze-cv` | Analiza adecuación entre el CV y la oferta mediante Gemini | Multipart con archivo `cv` y campos `jobTitle`, `jobCompany`, `jobDescription`, `jobRequirements` |
| `POST` | `/api/generate-cover-letter` | Redacta carta de presentación personalizada adaptada al centro | Multipart con archivo `cv` y campos de la oferta |

---

## 4. Pipeline de Datos y Scraping

- **Script Principal**: `scripts/scrape.ts`
- **Frecuencia**: Ejecutado diariamente por cron en la Raspberry Pi (`/home/pi/run_jobfinder.sh` a las 10:00 Madrid).
- **Resultado**: Archivo JSON unificado en `public/data/jobs.json`.
- **Validación de URLs**: Cada URL de oferta obtenida pasa por `scripts/validate-links.ts` para asegurar que el enlace no arroja un 404, no redirige a la página principal de búsqueda y corresponde a una vacante concreta.
