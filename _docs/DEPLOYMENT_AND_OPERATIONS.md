# JobCrawling - Operaciones y Despliegue (Raspberry Pi)

Este documento detalla el entorno de producción en la Raspberry Pi, la gestión de servicios systemd, sincronización de código, rotación de logs y automatización del cron.

---

## 1. Topología del Servidor de Producción

- **Dispositivo**: Raspberry Pi (`raspberrypi.local`).
- **Usuario**: `pi` (`/home/pi/JobCrawling`).
- **Zona Horaria**: `Europe/Madrid`.
- **Servicios en Ejecución**:
  - `caddy.service`: Reverse proxy y servidor web en puerto `3001`. Encamina `/api/*` hacia el puerto `3002` y sirve los archivos compilados en `/home/pi/JobCrawling/dist`.
  - `jobcrawling-api.service`: Proceso Node.js / Express (`server.ts` compilado o ejecutado con Node) escuchando en puerto `3002`.

---

## 2. Automatización Diaria y Sincronización (`run_jobfinder.sh`)

La Raspberry Pi ejecuta diariamente a las 10:00 Madrid el script `/home/pi/run_jobfinder.sh` mediante el cron de usuario `pi`:
```cron
0 10 * * * /home/pi/run_jobfinder.sh >> /home/pi/jobfinder_cron.log 2>&1
```

### 2.1 Política de Sincronización Git
> [!CAUTION]
> **No utilizar `git reset --hard` en scripts desatendidos.**
> La Raspberry Pi almacena datos locales que no deben destruirse (como el archivo `.env`, configuraciones locales o cambios dinámicos en `user_states.json`).

El script `run_jobfinder.sh`:
1. Realiza `git fetch origin main`.
2. Actualiza los cambios limpios con `git pull --ff-only` o `git merge origin/main`.
3. Instala dependencias con `npm ci` o `npm install` si ha cambiado `package.json`.
4. Ejecuta `npm run build`.
5. Reinicia el servicio `sudo systemctl restart jobcrawling-api.service`.
6. Ejecuta el pipeline diario: `npm run scrape:email`.

### 2.2 Rotación de Logs
Para evitar que los archivos de log (`jobfinder.log`, `jobfinder_cron.log`) llenen la tarjeta SD:
- El tamaño del archivo de log se evalúa antes de cada ejecución.
- Si supera los **5 MB**, se rota automáticamente renombrándose a `.log.1`, `.log.2`, etc., manteniendo un máximo de 5 copias comprimidas o rotadas.

---

## 3. Notificaciones por Correo Electrónico

### 3.1 Destinatarios y Políticas
- **Producción (Automática diaria)**: `lalaboom400@gmail.com`.
  - Este correo **SOLO** se envía a través del cron diario en la Raspberry Pi.
  - **NUNCA** ejecutar manualmente un envío de prueba hacia esta dirección.
- **Desarrollo / Testing de Correos**: `velsi12blackman@gmail.com`.
  - Se utiliza para probar el formato o lógica del mailing mediante:
    ```bash
    npm run notify:email -- --to velsi12blackman@gmail.com
    ```
  - **Condición de uso**: ÚNICAMENTE debe dispararse si la tarea o cambio realizado afecta directamente al módulo de correos (`scripts/emailNotifier.ts`) o a la estructura de la plantilla de email. No enviar para cambios de frontend, base de datos o backend general.
