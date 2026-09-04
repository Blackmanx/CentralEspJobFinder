# JobCrawling Technical Documentation Index

Bienvenido a la documentación técnica interna de **JobCrawling**. Esta documentación está diseñada específicamente para que agentes de inteligencia artificial y desarrolladores humanos puedan entender la arquitectura, operar con total seguridad técnica y privacidad, y mantener el sistema sin regresiones.

---

## 🗺️ Mapa de Documentación

| Documento | Descripción |
| :--- | :--- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Arquitectura del sistema, capas (Frontend, Backend, Scrapers), ciclo de vida y APIs REST. |
| [PRIVACY_AND_CV_HANDLING.md](./PRIVACY_AND_CV_HANDLING.md) | **Crítico**: Normas estrictas de privacidad, almacenamiento de CV exclusivo en el navegador del usuario y sanitización PII. |
| [SCRAPING_AND_DATA_PIPELINE.md](./SCRAPING_AND_DATA_PIPELINE.md) | Arquitectura de scrapers, fuentes soportadas, filtros (C2 Inglés, ámbito geográfico), deduplicación y validación de links. |
| [DEPLOYMENT_AND_OPERATIONS.md](./DEPLOYMENT_AND_OPERATIONS.md) | Entorno Raspberry Pi, servicios Caddy y systemd, sincronización Git, rotación de logs, cron diario y notificaciones por correo. |
| [MAINTENANCE_GUIDELINES.md](./MAINTENANCE_GUIDELINES.md) | Protocolo operativo obligatorio para agentes de IA: verificación de build, actualización de docs y regla de notificación. |

---

## 🛡️ Reglas de Oro del Proyecto

1. **Privacidad Absoluta del CV**:
   - El CV de los usuarios **NUNCA** se almacena en el disco del servidor ni en la base de datos ni en el repositorio Git.
   - Se almacena **únicamente en el navegador del usuario** (IndexedDB / localStorage).
   - Cuando se requiere análisis con IA, se envía en memoria (multipart/form-data), se procesa al vuelo, se anonimiza y no se guarda en disco.
2. **Sin vacantes inventadas ni páginas intermedias**:
   - Los scrapers solo deben emitir URLs concretas de ofertas de empleo reales verificadas. No URLs de búsqueda, ni perfiles de empresa genéricos.
3. **No Reset Destructivo en el Servidor**:
   - Los scripts de sincronización (`run_jobfinder.sh`) no deben ejecutar `git reset --hard` para evitar perder configuraciones locales o datos de ejecución (`user_states.json`).
4. **Rotación de Logs Obligatoria**:
   - Todo log generado por ejecuciones desatendidas debe estar acotado con rotación (máx 5MB) para no saturar el almacenamiento de la Raspberry Pi.
5. **Notificación por Correo**:
   - Ejecutar `npm run notify:email -- --to velsi12blackman@gmail.com` **ÚNICAMENTE** si el cambio o feature está directamente relacionado con el sistema de correos o formato del digest de vacantes.
   - **NUNCA** enviar manualmente a `lalaboom400@gmail.com` (reservado exclusivamente para el cron diario de producción).
6. **Mantenimiento Continuo de `_docs/`**:
   - Cualquier cambio en arquitectura, endpoints, scraping, despliegue o variables de entorno debe reflejarse inmediatamente en esta carpeta `_docs/`.
