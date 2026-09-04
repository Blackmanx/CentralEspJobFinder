# JobCrawling - Política y Arquitectura de Privacidad del CV

Este documento establece las directrices obligatorias de seguridad y privacidad que rigen el tratamiento de datos personales y currículums en **JobCrawling**. Todos los desarrolladores y agentes de IA deben cumplir estas normas de forma estricta.

---

## 1. Principio Fundamental: Almacenamiento Exclusivo en el Cliente

> [!IMPORTANT]
> **El currículum del usuario NO DEBE ser persistido en el servidor.**
> Bajo ninguna circunstancia se guardarán archivos de CV (como `.pdf`, `.docx`, `.bin` o `.json`) en el disco duro del servidor, en bases de datos o en el repositorio Git.

### 1.1 ¿Dónde se guarda el CV?
- El archivo del CV reside exclusivamente en el **navegador web del usuario** (almacenamiento local mediante `localStorage` codificado o `IndexedDB`).
- El usuario tiene la capacidad de:
  - Subir o reemplazar su CV localmente en cualquier momento.
  - Eliminar por completo su CV del navegador pulsando el botón de descarte.
  - Ninguna de estas acciones envía el CV a un almacenamiento permanente en el servidor.

---

## 2. Flujo de Procesamiento del CV para Asistencia IA

Cuando el usuario solicita un análisis de adecuación (`/api/analyze-cv`) o la generación de una carta de presentación (`/api/generate-cover-letter`), el flujo es el siguiente:

```
[Navegador del Usuario]
       │
       │ Envía archivo CV en memoria (multipart/form-data)
       ▼
[Servidor Express (server.ts)]
       │
       ├─► Multer recibe el buffer en RAM (memoryStorage)
       ├─► Extracción de texto al vuelo (pdf-parse / mammoth)
       ├─► Sanitización y anonimización estricta de PII (anonymizeText)
       ├─► Envío del texto anonimizado a Google Gemini API
       └─► El buffer en RAM se descarta inmediatamente tras responder al cliente
```

1. **Recepción en RAM**: Multer está configurado con `multer.memoryStorage()`. No se crea ningún fichero temporal en `/tmp` ni en `public/data/`.
2. **Extracción y Descarte**: Se extraen las líneas de texto del búfer en memoria.
3. **Anonimización**: Se pasa el texto por la función `anonymizeText`.
4. **Respuesta y Limpieza**: Se devuelve el análisis estructurado (JSON) al cliente. El búfer queda libre para el recolector de basura de V8.

---

## 3. Anonimización de Información de Identificación Personal (PII)

Antes de enviar cualquier fragmento de texto a la API de Gemini, se ejecuta `anonymizeText(text)` en `server.ts`. Esta función aplica expresiones regulares y heurísticas para sustituir:

* **Correos electrónicos**: Reemplazados por `[CORREO ANONIMIZADO]`.
* **Teléfonos (España e Internacional)**: Reemplazados por `[TELÉFONO ANONIMIZADO]`.
* **Documentos de identidad (DNI, NIE, Pasaportes)**: Reemplazados por `[DNI/NIE ANONIMIZADO]`.
* **Números de la Seguridad Social (NUSS/NAF)**: Reemplazados por `[SEGURIDAD SOCIAL ANONIMIZADA]`.
* **Códigos postales y direcciones residenciales**: Reemplazados por `[DIRECCIÓN ANONIMIZADA]`.
* **Nombres personales en cabeceras**: Reemplazados por `[CANDIDATO ANONIMIZADO]`.

---

## 4. Prohibición de Datos Reales en el Código y Control de Versiones

- Está terminantemente prohibido incluir nombres reales de usuarios, historiales laborales específicos de personas reales o plantillas con datos personales en el código fuente, archivos de prueba o prompts fijos del backend.
- Los prompts de generación de cartas de presentación deben ser completamente dinámicos: se construyen a partir del texto anonimizado del CV proporcionado y los requisitos de la vacante.
- El archivo `public/data/user_states.json` no debe incluir volcados de CV ni información privada del usuario en el repositorio Git (está en `.gitignore`).
