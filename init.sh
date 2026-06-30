#!/bin/bash
# Previene fallos silenciosos
set -e

echo "=== Inicializando proyecto CentralEspJobFinder (UNIX) ==="

# Crear directorios del proyecto
echo "Creando estructura de directorios..."
mkdir -p src/components src/types scripts public/data

# Crear .env si no existe a partir de .env.example
if [ ! -f .env ]; then
  echo "Creando archivo .env a partir de .env.example..."
  cp .env.example .env
  echo "AVISO: Por favor, configura tu GEMINI_API_KEY en el archivo .env para habilitar el optimizador de CV."
fi

# Instalar dependencias
echo "Instalando dependencias de Node.js..."
npm install

echo "=== Proyecto inicializado con exito ==="

# Iniciar la plataforma
echo "Iniciando servidores frontend y backend..."
npm run dev
