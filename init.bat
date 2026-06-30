@echo off
echo === Inicializando proyecto JobFinder (Windows) ===

echo Creando estructura de directorios...
if not exist src\components mkdir src\components
if not exist src\types mkdir src\types
if not exist scripts mkdir scripts
if not exist public\data mkdir public\data

echo Instalando dependencias de Node.js...
call npm install

echo === Proyecto inicializado con exito ===
