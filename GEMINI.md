# JobCrawling - Gemini & AI Workspace Context

## Notificaciones Automáticas tras Cambios
- Al finalizar cualquier conjunto de cambios o refactorizaciones en este repositorio, el modelo DEBE disparar un correo con el estado actual de las ofertas a:
  `velsi12blackman@gmail.com`
  utilizando el comando: `npm run notify:email -- --to velsi12blackman@gmail.com`
- NUNCA enviar manualmente a `lalaboom400@gmail.com`; ese destinatario solo recibe correos a través del cron diario en la Raspberry Pi.

## Ubicación y Despliegue
- Proyecto: **JobCrawling**
- Repositorio remoto: `https://github.com/Blackmanx/JobCrawling.git`
- Ruta en Raspberry Pi: `/home/pi/JobCrawling`

## Mantenimiento de Documentación Técnica (`_docs/`)
- El agente de IA DEBE mantener la carpeta `_docs/` sincronizada con cualquier cambio arquitectural, de endpoints, privacidad de CV o scraping realizado en el proyecto.

