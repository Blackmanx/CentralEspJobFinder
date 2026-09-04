# JobCrawling - Protocolo Operativo y Mantenimiento

Este documento define el protocolo estándar que todo agente de IA y desarrollador debe seguir rigurosamente al intervenir en este repositorio.

---

## 1. Obligación de Mantener la Documentación en `_docs/`

> [!IMPORTANT]
> **REGLA MANDATORIA DE ACTUALIZACIÓN DE DOCUMENTACIÓN**:
> Cada vez que se realice un cambio que afecte a:
> 1. Endpoints de la API o firmas de peticiones/respuestas (`server.ts`).
> 2. Almacenamiento, modelo de datos o tratamiento de privacidad y CVs.
> 3. Scrapers nuevos, eliminados o modificados en `scripts/scrapers/`.
> 4. Flujos de despliegue, variables de entorno (`.env`) o scripts de la Raspberry Pi.
>
> El agente **DEBE actualizar de inmediato los documentos correspondientes en `_docs/`** antes de dar la tarea por concluida.

---

## 2. Checklist de Verificación Pre-Commit

Antes de realizar un commit o considerar finalizada una tarea, verificar:

- [ ] **Sin CV ni PII en el servidor**: Confirmar que no se guardan archivos de CV en disco ni en `public/data/`.
- [ ] **Compilación limpia**: Ejecutar `npm run build` y verificar que TypeScript y Vite pasan sin errores.
- [ ] **Validación de links**: Si se modificaron scrapers, ejecutar `npm run validate:links`.
- [ ] **Documentación actualizada**: Revisar y actualizar los archivos relevantes en `_docs/`.
- [ ] **Commit según Conventional Commits**: Formato `feat(...)`, `fix(...)`, `docs(...)`, `chore(...)`.
- [ ] **Notificación al desarrollador**: Ejecutar:
  ```bash
  npm run notify:email -- --to velsi12blackman@gmail.com
  ```
- [ ] **Prohibido enviar a producción**: NUNCA enviar manualmente a `lalaboom400@gmail.com`.

---

## 3. Protocolo de No Bucles de Análisis (Agent Efficiency)

- **Máximo 1 o 2 lecturas de cualquier archivo o sección**: Prohibido releer archivos una y otra vez buscando "certeza absoluta".
- Transicionar inmediatamente de la inspección al cambio concreto mediante edición dirigida.
- Probar con el compilador (`npm run build`) en vez de simular mentalmente todos los casos de forma recursiva.
