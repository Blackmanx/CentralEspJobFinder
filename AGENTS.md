# JobCrawling - Agent & Repository Instructions

## Directiva Obligatoria de Notificación por Correo
> **REGLA ESTRICTA**: Cada vez que se realice un cambio, mejora o fix en este repositorio (`JobCrawling`), el agente de IA **DEBE** ejecutar de forma inmediata y automática el envío del informe de ofertas actualizado por correo a **`velsi12blackman@gmail.com`** mediante:
> ```bash
> npm run notify:email -- --to velsi12blackman@gmail.com
> ```
> **NO enviar manualmente a `lalaboom400@gmail.com`**: el destinatario `lalaboom400@gmail.com` recibe los correos única y exclusivamente a través del sistema autónomo programado en la Raspberry Pi.

---

## Directivas del Repositorio y Arquitectura

1. **Nombre del Proyecto**: `JobCrawling` (anteriormente *CentralEspJobFinder*).
2. **Repositorio GitHub**: `https://github.com/Blackmanx/JobCrawling`.
3. **Ámbitos Cubiertos**:
   - Educación Infantil (TSEI / 0-3 años).
   - Bolsas de Empleo Oficiales (Comunidad de Madrid y Junta de Castilla-La Mancha / Toledo).
   - Monitores de Ocio, Comedor y Tiempo Libre.
   - Puestos docentes (Colegios concertados y privados en Madrid, Toledo, Segovia, Ávila y Castilla-La Mancha).
4. **Despliegue y Automatización (Raspberry Pi)**:
   - Directorio en la Raspberry Pi: `/home/pi/JobCrawling`.
   - Script de ejecución autónoma: `/home/pi/run_jobfinder.sh`.
   - Programación en `crontab`: `0 10 * * * /home/pi/run_jobfinder.sh`.
   - Destinatarios programados por defecto en el `.env` de la Pi:
     - `lalaboom400@gmail.com`
     - `velsi12blackman@gmail.com`
5. **Zona Horaria del Servidor**:
   - `Europe/Madrid` (CEST, UTC+2).
