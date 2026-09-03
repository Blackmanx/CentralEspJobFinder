#!/bin/bash
export PATH=/usr/bin:/bin:/usr/local/bin:$PATH
cd /home/pi/JobCrawling || exit 1

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
echo "=================================================================" >> /home/pi/jobfinder_cron.log
echo "[$TIMESTAMP] Iniciando rutina diaria de JobCrawling..." >> /home/pi/jobfinder_cron.log

# 1. Sincronizar repositorio desde GitHub por si hay mejoras de scrapers o código
echo "[$TIMESTAMP] [1/3] Sincronizando repositorio Git..." >> /home/pi/jobfinder_cron.log
git fetch origin main >> /home/pi/jobfinder_cron.log 2>&1
git reset --hard origin/main >> /home/pi/jobfinder_cron.log 2>&1

# 2. Ejecutar escaneo completo (Scraping & Sync de ofertas activas)
echo "[$TIMESTAMP] [2/3] Scrapeando y sincronizando ofertas frescas..." >> /home/pi/jobfinder_cron.log
npm run scrape >> /home/pi/jobfinder_cron.log 2>&1

# Asegurar permisos correctos para Caddy
chmod -R o+rx /home/pi/JobCrawling/dist

# 3. Enviar boletín por correo a los destinatarios programados en .env
echo "[$TIMESTAMP] [3/3] Enviando boletín diario por correo..." >> /home/pi/jobfinder_cron.log
npm run notify:email >> /home/pi/jobfinder_cron.log 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Rutina diaria completada con éxito." >> /home/pi/jobfinder_cron.log
