@echo off
echo === Inicializando proyecto CentralEspJobFinder (Windows) ===

echo Creando estructura de directorios...
if not exist src\components mkdir src\components
if not exist src\types mkdir src\types
if not exist scripts mkdir scripts
if not exist public\data mkdir public\data

echo Creando archivo .env si no existe...
if not exist .env (
    copy .env.example .env
    echo AVISO: Por favor, configura tu GEMINI_API_KEY en el archivo .env para habilitar el optimizador de CV.
)

echo Instalando dependencias de Node.js...
call npm install

echo === Proyecto inicializado con exito ===

echo Iniciando servidores frontend y backend...
call npm run dev
