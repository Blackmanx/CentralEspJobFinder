# Sistema de Diseno y Guia de Estilos: JobFinder

Este documento define el sistema de diseno visual, los tokens de color y la estructura de componentes para la plataforma JobFinder, garantizando una experiencia de usuario limpia, profesional y consistente tanto en modo claro como en modo oscuro.

---

## 1. Tipografia y Jerarquia

Utilizamos la fuente **Inter** para toda la interfaz, garantizando legibilidad y un aspecto moderno.

- **Fuentes**: `Inter`, sans-serif.
- **Pesos**:
  - `400` (Regular): Texto de parrafo, descripciones secundarias.
  - `500` (Medium): Encabezados de tabla, etiquetas de filtros, botones.
  - `600` (Semi-Bold): Titulos de tarjetas, nombres de colegios, estados de postulacion.
  - `700` (Bold): Titulos principales, estadisticas clave.

---

## 2. Paleta de Colores por Modos

### Modo Claro (Light Mode)
Disenado para entornos luminosos con un contraste excelente y una estetica limpia, evitando fondos blancos puros estridentes.

| Token CSS | Color (HEX/HSL) | Proposito |
| :--- | :--- | :--- |
| `--bg-app` | `#f8fafc` (Slate 50) | Fondo general de la aplicacion (lienzo principal). |
| `--bg-surface` | `#ffffff` (Blanco) | Fondo de paneles, tarjetas, tablas y sidebar. |
| `--bg-element` | `#f1f5f9` (Slate 100) | Fondo de inputs, botones en reposo y celdas hover. |
| `--border-color` | `#e2e8f0` (Slate 200) | Bordes de separacion finos entre componentes. |
| `--text-primary` | `#0f172a` (Slate 900) | Titulos principales y texto de alta relevancia. |
| `--text-secondary` | `#475569` (Slate 600) | Descripciones, detalles de ofertas y subtitulos. |
| `--text-muted` | `#94a3b8` (Slate 400) | Fechas, marcas de agua e iconos inactivos. |

---

### Modo Oscuro (Dark Mode)
Disenado con una tonalidad azul-grisacea profunda (midnight slate) para reducir la fatiga ocular, manteniendo un contraste excelente en el texto sin colores planos.

| Token CSS | Color (HEX/HSL) | Proposito |
| :--- | :--- | :--- |
| `--bg-app` | `#0b0f19` | Fondo general de la aplicacion. |
| `--bg-surface` | `#161f30` | Fondo de paneles, tarjetas, tablas y sidebar. |
| `--bg-element` | `#222f47` | Fondo de inputs, botones en reposo y celdas hover. |
| `--border-color` | `#2e3d56` | Bordes de separacion finos entre componentes. |
| `--text-primary` | `#f8fafc` (Slate 50) | Titulos principales y texto de alta relevancia. |
| `--text-secondary` | `#94a3b8` (Slate 400) | Descripciones, detalles de ofertas y subtitulos. |
| `--text-muted` | `#64748b` (Slate 500) | Fechas, marcas de agua e iconos inactivos. |

---

### Colores de Estado (Comunes)
Los estados utilizan combinaciones de colores semanticos suaves con bordes translucidos.

- **Postulado (Applied)**:
  - Color: `#3b82f6` (Azul)
  - Fondo: `rgba(59, 130, 246, 0.08)`
- **En Entrevista (Interviewing)**:
  - Color: `#f59e0b` (Oro/Ambar)
  - Fondo: `rgba(245, 158, 11, 0.08)`
- **Ofrecido / Contratado (Offered)**:
  - Color: `#10b981` (Verde Esmeralda)
  - Fondo: `rgba(16, 185, 129, 0.08)`
- **Rechazado (Rejected)**:
  - Color: `#ef4444` (Rojo)
  - Fondo: `rgba(239, 68, 68, 0.08)`

---

## 3. Componentes Visuales y Sombras

### Bordes y Esquinas
- **Border Radius**: `6px` para todos los elementos interactivos (botones, inputs, tarjetas, paneles). Evita esquinas demasiado redondeadas para mantener una estetica profesional y tecnica.
- **Bordes**: `1px solid var(--border-color)` en todas las divisiones relevantes.

### Sombras
- **Normal**: `var(--shadow-sm)` (`0 1px 2px rgba(0, 0, 0, 0.05)`)
- **Paneles y Sidebar**: `var(--shadow-lg)` (`0 10px 15px -3px rgba(0, 0, 0, 0.1)`) para dar profundidad de superposicion en pantallas moviles.

---

## 4. Comportamiento Responsivo

1. **Escritorio (>1024px)**:
   - Sidebar fijo a la izquierda (`310px`).
   - Area central flexible.
   - Vista dividida (Split-Pane) de dos columnas al seleccionar una oferta: 55% Listado, 45% Ficha de detalles.
2. **Movil (<1023px)**:
   - Colapsa en una sola columna vertical.
   - El panel de detalles se despliega en pantalla completa (drawer) con control de salida visible.
