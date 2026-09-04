# JobCrawling - Resumen y Análisis del Proyecto

## 1. Resumen Ejecutivo
**JobCrawling** es una plataforma orientada a la agregación, filtrado inteligente y gestión de postulaciones para puestos educativos (Educación Infantil 0-3 y 3-6 años, otros puestos docentes, y monitores/apoyo escolar) en la Comunidad de Madrid y provincias limítrofes.

El sistema combina:
- Scraping automatizado y robusto con validación de enlaces.
- Filtrado inteligente (exclusión de C2 no negociable, ámbito territorial).
- Interfaz web interactiva con Leaflet, filtros por estado y badges de convenio colectivo.
- Asistencia de IA local-first para análisis de adecuación curricular y cartas de presentación mediante Google Gemini, con anonimización estricta de PII.
- **Privacidad estricta**: El CV del candidato se gestiona y almacena **únicamente en el navegador del usuario**.
- Automatización diaria desatendida en Raspberry Pi con rotación de logs y envío diario de correo.

---

## 2. Documentación Modular de Referencia

Para detalles específicos de implementación y operativa técnica, consultar:

- [README.md](./README.md): Índice principal y mapa de documentación.
- [ARCHITECTURE.md](./ARCHITECTURE.md): Arquitectura detallada, endpoints y frontend.
- [PRIVACY_AND_CV_HANDLING.md](./PRIVACY_AND_CV_HANDLING.md): Directrices de privacidad y flujo del CV.
- [SCRAPING_AND_DATA_PIPELINE.md](./SCRAPING_AND_DATA_PIPELINE.md): Fuentes de scraping y pipeline de normalización.
- [DEPLOYMENT_AND_OPERATIONS.md](./DEPLOYMENT_AND_OPERATIONS.md): Despliegue en Raspberry Pi, Caddy, systemd y cron.
- [MAINTENANCE_GUIDELINES.md](./MAINTENANCE_GUIDELINES.md): Checklist de mantenimiento y protocolos para agentes de IA.
