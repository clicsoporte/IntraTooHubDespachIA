# Historial de Cambios (Changelog) - Clic-Tools

Este documento registra todas las mejoras, correcciones y cambios significativos en cada versión de la aplicación.

---

## Proceso de Actualización y Rollback

**Para actualizar a una nueva versión, siga estos pasos:**

1.  **¡Crítico! Crear Punto de Restauración:** Antes de cualquier cambio, vaya a **Administración > Mantenimiento** y haga clic en **"Crear Punto de Restauración"**. Esto crea una copia de seguridad completa de todas las bases de datos (`.db`).
2.  **Reemplazar Archivos:** Reemplace todos los archivos y carpetas de la aplicación en el servidor con los de la nueva versión, **excepto** la carpeta `dbs/` y el archivo `.env.local`.
3.  **Actualizar Dependencias:** Ejecute `npm install --omit=dev` en el servidor.
4.  **Reconstruir y Reiniciar:** Ejecute `npm run build` y reinicie la aplicación (ej: `pm2 restart clic-tools`).
5.  **Verificar:** Ejecute la auditoría desde **Administración > Mantenimiento** para confirmar que la estructura de la base de datos es correcta. Este paso es especialmente importante en la v2.2.0 para asegurar la creación de las nuevas tablas de despacho.

**Para realizar un rollback (regresar a la versión anterior):**

1.  **Restaurar Punto de Restauración:** Vaya a **Administración > Mantenimiento**, seleccione el punto de restauración que creó antes de la actualización y haga clic en "Restaurar". **Esto requiere un reinicio manual del servidor de la aplicación después de la restauración.**
2.  **Revertir Archivos:** Reemplace los archivos del servidor con los de la versión anterior.
3.  **Reinstalar y Reconstruir:** Ejecute `npm install --omit=dev` y `npm run build`.
4.  **Reiniciar:** Inicie la aplicación nuevamente.

---

## [2.3.0] - Publicado

### Nueva Funcionalidad Mayor: Asistente de Chat con IA (Inteligencia Artificial)

Se ha integrado un asistente de inteligencia artificial local, potenciado por Ollama y el modelo `deepseek-coder-v2`, que permite a los usuarios realizar consultas complejas sobre los datos del sistema usando lenguaje natural.

-   **[Nuevo] Interfaz de Chat:**
    -   Se ha añadido una nueva herramienta en **Analíticas > Chat con IA**.
    -   Los usuarios pueden escribir preguntas como "¿Cuáles fueron los 5 productos más vendidos la semana pasada?" o "¿Qué solicitudes de compra están pendientes de aprobación?".

-   **[Nuevo] Motor de Inferencia Local (Text-to-SQL):**
    -   La IA no tiene acceso directo a la base de datos. En su lugar, analiza la pregunta del usuario y el esquema de las tablas del sistema.
    -   Genera una consulta `SQL SELECT` segura y se la pide al backend de Clic-Tools para su ejecución.
    -   El backend ejecuta la consulta, obtiene los datos y se los devuelve a la IA.
    -   Finalmente, la IA formatea los datos en una respuesta amigable y, si son tabulares, los presenta en una tabla dentro del chat.

-   **[Seguridad] Consultas de Solo Lectura:** El sistema está diseñado para que la IA solo pueda generar y solicitar la ejecución de consultas `SELECT`, previniendo cualquier posibilidad de modificación, inserción o eliminación de datos.

-   **[Configuración] Flexibilidad de Modelo:**
    -   Desde **Administración > Configuración de IA**, los administradores pueden probar la conexión con el servidor de Ollama.
    -   Se puede cambiar el nombre del modelo a utilizar, permitiendo experimentar con otros modelos de código abierto como `llama3` si se desea.

-   **[Mejora] Esquema de Datos para IA:** Se ha ampliado el "conocimiento" de la IA para que tenga visibilidad sobre todas las tablas del ERP que se sincronizan, incluyendo `empleados`, `vendedores`, `proveedores` y `órdenes de compra`, mejorando drásticamente la precisión y el alcance de sus respuestas.

---

## [2.2.0] - Publicado

### Nueva Funcionalidad Mayor: Centro de Despacho

Se ha implementado un nuevo módulo completo para digitalizar y optimizar el proceso de alistamiento y verificación de despachos, reemplazando el flujo de trabajo manual basado en papel.

-   **[Nuevo] Contenedores de Ruta:**
    -   Desde **Almacén > Configuración**, los administradores de logística ahora pueden crear "contenedores" que representan las rutas de entrega (ej: "Ruta San José", "Ruta Alajuela").

-   **[Nuevo] Clasificador de Despachos:**
    -   Una nueva herramienta en **Almacén > Clasificador de Despachos** permite al personal de logística ver todas las facturas y pedidos del ERP que no han sido asignados.
    -   Los usuarios pueden seleccionar múltiples documentos y asignarlos de forma masiva a un contenedor de ruta específico.
    -   Dentro de cada contenedor, es posible reordenar las facturas (arrastrando y soltando) para definir el orden de carga y entrega del camión.

-   **[Nuevo] Flujo de Chequeo para Bodegueros:**
    -   En la nueva herramienta **Almacén > Centro de Despacho**, el personal de bodega ve los contenedores de ruta.
    -   Al seleccionar un contenedor, este se **bloquea** para ese usuario, evitando que dos personas trabajen en la misma ruta simultáneamente (similar al bloqueo del Asistente de Poblado).
    -   Dentro del contenedor, se muestra la lista de facturas en el orden de entrega. Al seleccionar una, se abre la interfaz de verificación de artículos.

-   **[Mejora] Verificación de Artículos Inteligente:**
    -   La herramienta de chequeo ahora es consciente del contexto de la ruta y avanza automáticamente a la siguiente factura de la lista una vez que se completa la actual.
    -   **Manejo de Múltiples Bodegas:** Si una factura contiene artículos de diferentes bodegas, el sistema permitirá verificar solo los artículos de una bodega a la vez (próximamente se implementará la selección de bodega).
    -   El bodeguero ahora tiene un botón para **"Enviar a otra ruta"**, permitiendo mover una factura a un contenedor diferente si fue asignada por error.

-   **[Seguridad y Auditoría] Detección de Facturas Anuladas:**
    -   El sistema ahora compara continuamente los datos del ERP. Si una factura que ya fue asignada a una ruta es posteriormente **anulada en el ERP**, aparecerá con una alerta visual de "ANULADA" en la lista de chequeo, impidiendo su despacho por error.

-   **[Nuevo] Reporte de Despachos:**
    -   Ubicado en **Analíticas**, este reporte permite auditar todas las verificaciones realizadas, ver quién verificó qué documento, cuándo, y si hubo discrepancias.

### Mejoras y Correcciones Generales

-   **[Estabilidad] Notificaciones Automáticas:** Se corrigió un error crítico que impedía que el motor de notificaciones configurables enviara correos correctamente, asegurando que las alertas de eventos (como despachos finalizados, órdenes aprobadas, etc.) funcionen como se espera.
-   **[Calidad de Código] Mantenimiento de Dependencias:** Se actualizaron varias dependencias internas para mejorar la estabilidad y el rendimiento general de la aplicación.
-   **[UI] Mejoras de Accesibilidad:** Se añadieron descripciones a varios diálogos modales en toda la aplicación para mejorar la compatibilidad con lectores de pantalla y eliminar advertencias en la consola de desarrollo.
-   **[Estabilidad] Filtros de Fecha:** Se solucionó un bug persistente en los reportes donde el filtro de fecha no se aplicaba correctamente al seleccionar un solo día. Ahora los rangos de fechas funcionan de manera precisa e intuitiva.

---

## [2.1.0] - Publicado

### Mejoras de Calidad y Estabilidad

-   **[Estabilidad] Corrección de Errores de Compilación:** Se solucionaron múltiples errores de `Cannot find module` que impedían que la aplicación se compilara correctamente. La causa raíz, relacionada con la carga inicial de la página y la detección de usuarios, ha sido resuelta para garantizar builds estables.
-   **[Calidad de Código] Centralización de Lógica Duplicada:**
    -   Se unificó la lógica para determinar si un usuario es "Administrador", utilizando el sistema de permisos (`hasPermission('admin:access')`) en lugar de comprobaciones directas, lo que hace el código más mantenible.
    -   Se eliminaron funciones duplicadas para obtener las iniciales de los usuarios, centralizando la lógica en un solo lugar.
-   **[UX] Optimización del Flujo de Escáner:** En la pantalla de **Búsqueda Rápida de Almacén**, después de que un escáner introduce un código y presiona "Enter", el campo de búsqueda ahora se limpia y se re-enfoca automáticamente, permitiendo un flujo de escaneo continuo y sin interrupciones.
-   **[UI] Corrección de Etiquetas de Almacén:** Se solucionó un problema en la generación de etiquetas PDF donde las rutas de ubicación largas se cortaban. Ahora, el texto se ajusta automáticamente en varias líneas para asegurar que la información siempre sea legible.

### Mejoras de Seguridad Críticas

-   **[Seguridad] Fortalecimiento del Sistema de Autenticación:**
    -   Se reemplazará el almacenamiento del ID de usuario en `sessionStorage` (inseguro y manipulable desde el navegador) por un sistema de **cookies seguras `httpOnly`**.
    -   Esto previene que un usuario pueda suplantar la identidad de otro (ej. un administrador) modificando variables en el navegador. La sesión ahora será gestionada de forma segura por el servidor.
-   **[Seguridad] Protección de Rutas de Descarga:**
    -   Se añadió una capa de autenticación y autorización a las rutas de descarga de archivos (`/api/temp-backups` y `/api/temp-exports`).
    -   A partir de ahora, solo los usuarios autenticados con los permisos adecuados (ej. `admin:maintenance:backup`) podrán descargar respaldos de bases de datos o reportes de Excel, previniendo fugas de información.

### Mejoras y Correcciones en Módulo de Almacén

-   **Asistente de Poblado de Racks (Funcionalidad Clave):**
    -   **[Nuevo] Capacidad de Retomar Sesiones:** Se ha implementado un sistema de "sesiones" robusto. Si un usuario inicia el asistente de poblado y luego navega a otro módulo, cierra la pestaña o su sesión expira, al volver a la herramienta podrá **continuar exactamente donde se quedó**.
    -   **[Solucionado] Error de Bloqueo por Sí Mismo:** Se solucionó el bug crítico que impedía a un usuario volver a usar el asistente si lo había abandonado sin finalizar, mostrándole que él mismo tenía el tramo bloqueado.
    -   **[Mejora] Detección Visual de Bloqueos:** La interfaz ahora detecta y deshabilita visualmente los niveles de un rack que ya están siendo poblados por otro usuario, previniendo errores y mejorando la claridad.
    -   **[Mejora] Indicador de Nivel Finalizado:** En el asistente, los niveles que ya han sido completamente poblados ahora muestran una etiqueta `(Finalizado)` para dar una retroalimentación visual clara al operario.
    -   **[Solucionado] Corrección del "Unknown" en Gestión de Bloqueos:** Se solucionó el error que causaba que el nombre del tramo bloqueado apareciera como "unknown".
    -   **[Estabilidad]** Se corrigieron múltiples errores de `NOT NULL constraint failed` y `Cannot read properties of undefined` que ocurrían debido a inconsistencias en la gestión del estado de la sesión, haciendo el asistente mucho más estable.

-   **Optimización para Dispositivos Móviles (Responsivo):**
    -   **[Mejora] Consulta de Almacén:** La página principal de búsqueda (`/warehouse/search`) fue rediseñada para una mejor experiencia en celulares y tablets. La barra de búsqueda ahora es fija en la parte superior, y los filtros adicionales se han movido a un panel lateral desplegable para una interfaz más limpia.
    -   **[Mejora] Gestión de Ubicaciones:** Se ajustó la disposición de los botones en pantallas pequeñas para un acceso más fácil y rápido.
    -   **[Mejora] Consistencia General:** Se aplicaron ajustes menores de diseño en todas las herramientas del módulo de Almacén para una experiencia más unificada.

### Correcciones Generales del Sistema

-   **[Estabilidad] Corrección de Errores de Renderizado en Servidor:** Se solucionó un error general (`Cannot read properties of undefined (reading 'call')`) que ocurría en varios módulos al no especificar correctamente que eran "componentes de cliente". Se añadió la directiva `"use client";` en todas las páginas afectadas, estabilizando la aplicación.

---

## [2.0.0] - Lanzamiento Inicial

-   Lanzamiento de la versión 2.0.0 de Clic-Tools.
-   Incluye los módulos de Cotizador, Planificador OP, Solicitudes de Compra, Asistente de Costos, Almacenes, Consultas Hacienda y el panel de Administración completo.
-   Arquitectura basada en Next.js App Router, componentes de servidor y bases de datos modulares SQLite.
