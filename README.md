# CentralEspJobFinder

CentralEspJobFinder es una plataforma web inteligente y automatizada para la agregación, filtrado y gestión de ofertas de empleo docente en la Comunidad de Madrid y provincias colindantes (Segovia, Ávila y Castilla-La Mancha). El sistema cuenta con filtros estrictos de idoneidad, soporte para bilingüismo (exclusión de requisitos de inglés nivel C2 no alternativos), optimización asistida por IA de currículums (con anonimización local de datos personales) y automatización de candidaturas.

---

## Características Principales

### 1. Agregador de Vacantes Multi-Fuente
El motor de scraping de la plataforma indexa y unifica ofertas procedentes de tres portales de empleo diferenciados:
* **Colejobs**: Portal especializado en educación privada y concertada.
* **Indeed**: Plataforma generalista enfocada a vacantes en centros infantiles (primer ciclo 0-3 años).
* **Escuelas Católicas**: Bolsa de empleo docente de centros concertados religiosos y diocesanos.

### 2. Clasificación de Ámbitos (Multi-Scope)
Permite alternar las vacantes listadas según las siguientes especialidades:
* **Educación Infantil (Por Defecto)**: Maestro/a de Educación Infantil, educadores infantiles y auxiliares de aula.
* **Otros Puestos Docentes**: Profesores de educación Primaria, Secundaria, ESO y Bachillerato.
* **Apoyo y Administración**: Personal de limpieza, conserjería, mantenimiento, administración y gabinetes psicopedagógicos.
* **Todos los Ámbitos**: Muestra la totalidad de las vacantes indexadas.

### 3. Filtro Geográfico y de Idiomas
* **Restricción Territorial**: Excluye automáticamente ofertas situadas fuera del ámbito de la Comunidad de Madrid, Segovia, Ávila y Castilla-La Mancha.
* **Filtro de Inglés C2**: Excluye ofertas que exigen un nivel de inglés C2 (Proficiency/CPE) a menos que se admita C1/B2 como alternativa equivalente en la descripción.

### 4. Visualizador y Optimizador de CV Fullscreen
* **Privacidad Local (PII)**: El backend extrae y anonimiza localmente datos personales de contacto (nombres, correos, teléfonos) antes de enviar las ofertas a la API de Gemini para evitar el almacenamiento de PII en los servidores de IA.
* **Entorno de Trabajo Dual (50/50)**: Panel a pantalla completa (100vw/100vh) que previsualiza el PDF original en el panel izquierdo y muestra las mejoras y sugerencias de la IA categorizadas en el panel derecho.
* **Citas de Texto Directas**: Las sugerencias de mejora extraen y marcan la frase exacta sobre la cual realizar modificaciones.

### 5. Generador de Cartas de Presentación AI Personalizado
* El sistema genera cartas de presentación adaptadas a cada colegio objetivo utilizando como base de estilo, redacción y tono la plantilla de referencia del candidato (destacando su trayectoria académica y proyectos).

### 6. Agenda de Entrevistas
* Permite programar fecha y hora para las entrevistas de trabajo directamente en la ficha del puesto, ordenando de forma prioritaria la agenda según las citas programadas.

### 7. Sistema de Notificaciones en Vivo y Toasts
* **Notificaciones**: Centro interactivo superior que notifica nuevas ofertas publicadas y permite abrirlas con un clic.
* **Toasts**: Alertas flotantes no bloqueantes animadas para notificar eventos del sistema.

---

## Estructura del Proyecto

* `scripts/scrape.ts`: Scraper multi-fuente unificado que descarga y detalla las ofertas de empleo.
* `server.ts`: Servidor backend local (Express) que gestiona la base de datos local `user_states.json`, el currículum persistente en disco y los endpoints de análisis de IA (Gemini).
* `src/App.tsx`: Punto de entrada y panel de control principal de la interfaz web.
* `src/components/JobTable.tsx`: Tabla y listado interactivo de vacantes con botones rápidos de candidatura.
* `src/components/JobDrawer.tsx`: Ficha detallada y panel de visualización a pantalla completa.
* `public/data/jobs.json`: Base de datos local unificada de vacantes.

---

## Requisitos de Instalación

### 1. Variables de Entorno
Crea un archivo `.env` en la raíz del proyecto (tomando como base `.env.example`) y configura tu clave de API de Google AI Studio:
```env
GEMINI_API_KEY=tu_clave_real_de_google_ai_studio
```

### 2. Inicialización
El proyecto incluye scripts que se encargan de crear los directorios, copiar la configuración inicial, instalar las dependencias e iniciar los servidores en paralelo.

* **En Linux / macOS (UNIX):**
  ```bash
  chmod +x init.sh
  ./init.sh
  ```
* **En Windows:**
  ```cmd
  init.bat
  ```

---

## Comandos Útiles

* **Ejecutar en Desarrollo (Servidor + Frontend):**
  ```bash
  npm run dev
  ```
* **Compilar para Producción:**
  ```bash
  npm run build
  ```
* **Lanzar Scraper Manualmente (Actualizar Base de Datos):**
  ```bash
  npm run scrape
  ```
