#!/bin/bash
export PATH=/usr/bin:/bin:/usr/local/bin:$PATH
cd /home/pi/JobCrawling || exit 1

LOG_FILE="/home/pi/jobfinder_cron.log"
MAX_LOG_BYTES=5242880 # 5 MB

# Rotación de logs: si supera 5 MB, rotar y conservar hasta 3 copias comprimidas
if [ -f "$LOG_FILE" ]; then
    LOG_SIZE=$(stat -c%s "$LOG_FILE" 2>/dev/null || stat -f%z "$LOG_FILE" 2>/dev/null || echo 0)
    if [ "$LOG_SIZE" -ge "$MAX_LOG_BYTES" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Log superior a 5MB. Rotando..." >> "$LOG_FILE"
        [ -f "${LOG_FILE}.2.gz" ] && mv -f "${LOG_FILE}.2.gz" "${LOG_FILE}.3.gz"
        [ -f "${LOG_FILE}.1.gz" ] && mv -f "${LOG_FILE}.1.gz" "${LOG_FILE}.2.gz"
        if [ -f "${LOG_FILE}.1" ]; then
            gzip -f "${LOG_FILE}.1"
            mv -f "${LOG_FILE}.1.gz" "${LOG_FILE}.2.gz"
        fi
        cp -f "$LOG_FILE" "${LOG_FILE}.1"
        gzip -f "${LOG_FILE}.1"
        : > "$LOG_FILE"
    fi
fi

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
echo "=================================================================" >> "$LOG_FILE"
echo "[$TIMESTAMP] Iniciando rutina diaria de JobCrawling..." >> "$LOG_FILE"

# 1. Sincronizar repositorio desde GitHub por si hay mejoras de scrapers o código
echo "[$TIMESTAMP] [1/3] Sincronizando repositorio Git..." >> "$LOG_FILE"
git pull --ff-only origin main >> "$LOG_FILE" 2>&1

# 2. Ejecutar escaneo completo (Scraping & Sync de ofertas activas)
echo "[$TIMESTAMP] [2/3] Scrapeando y sincronizando ofertas frescas..." >> "$LOG_FILE"
npm run scrape >> "$LOG_FILE" 2>&1

# Asegurar permisos correctos para Caddy
chmod -R o+rx /home/pi/JobCrawling/dist

# 3. Enviar boletín por correo a los destinatarios programados en .env
echo "[$TIMESTAMP] [3/3] Enviando boletín diario por correo..." >> "$LOG_FILE"
npm run notify:email >> "$LOG_FILE" 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Rutina diaria completada con éxito." >> "$LOG_FILE"
