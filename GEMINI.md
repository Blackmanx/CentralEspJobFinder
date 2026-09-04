# JobCrawling - Gemini & AI Workspace Context

## Notificaciones por Correo Electrónico
- ÚNICAMENTE disparar un correo con `npm run notify:email -- --to velsi12blackman@gmail.com` cuando se esté implementando o corrigiendo una funcionalidad directamente relacionada con el sistema de correos (`scripts/emailNotifier.ts`) o digest de vacantes.
- NO enviar correos tras cambios de UI, backend general, refactorizaciones o documentación.
- NUNCA enviar manualmente a `lalaboom400@gmail.com`; ese destinatario solo recibe correos a través del cron diario en la Raspberry Pi.

## Ubicación y Despliegue
- Proyecto: **JobCrawling**
- Repositorio remoto: `https://github.com/Blackmanx/JobCrawling.git`
- Ruta en Raspberry Pi: `/home/pi/JobCrawling`

## Mantenimiento de Documentación Técnica (`_docs/`)
- El agente de IA DEBE mantener la carpeta `_docs/` sincronizada con cualquier cambio arquitectural, de endpoints, privacidad de CV o scraping realizado en el proyecto.

