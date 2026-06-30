#!/bin/bash
# Previene fallos silenciosos
set -e

echo "=== Inicializando proyecto JobFinder (UNIX) ==="

# Crear directorios del proyecto
echo "Creando estructura de directorios..."
mkdir -p src/components src/types scripts public/data

# Instalar dependencias
echo "Instalando dependencias de Node.js..."
npm install

echo "=== Proyecto inicializado con exito ==="
