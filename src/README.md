# Clic-Tools: Documentación Técnica y Manual de Usuario

**Clic-Tools v1.8.0** es una aplicación web interna diseñada para centralizar herramientas y procesos empresariales clave en un único panel de control. El objetivo es proporcionar una plataforma sencilla, rápida, segura y altamente configurable, optimizada para su uso en una red local (LAN).

---

## 1. Arquitectura y Filosofía

-   **Stack Tecnológico**: Next.js 14, TypeScript, React, Tailwind CSS, ShadCN UI, `better-sqlite3`, `mssql`.
-   **Filosofía de Diseño**:
    -   **Server-Centric**: La lógica crítica se ejecuta en el servidor para mejorar la seguridad y el rendimiento.
    -   **Modularidad**: Cada herramienta tiene su propia base de datos, asegurando un desacoplamiento total.
    -   **Resiliencia**: El sistema puede funcionar incluso si el servidor del ERP no está disponible temporalmente.
    -   **Doble Modo de Importación**: Desde archivos (`.txt`, `.csv`) o directamente desde SQL Server.
    -   **Gestor de Consultas Dinámico**: Las consultas `SELECT` se configuran desde la interfaz, permitiendo adaptabilidad sin modificar el código.

---

## 2. Guía de Módulos (Funcionalidades)

### 3.1. Centro de Notificaciones
- **Alertas Proactivas:** Un icono de campana en la cabecera muestra notificaciones no leídas.
- **Bandeja Interactiva:** Al hacer clic, se despliega un panel con las últimas notificaciones, cada una siendo un enlace directo a la entidad correspondiente.
- **Acciones Rápidas:** Permite aprobar o rechazar tareas directamente desde el panel de notificaciones.

### 3.2. Cotizador
- Creación rápida de cotizaciones, búsqueda de clientes y productos, y validación de exoneraciones en tiempo real.

### 3.3. Asistente de Costos
- Carga facturas XML, prorratea costos adicionales y calcula precios de venta sugeridos.

### 3.4. Planificador
- Gestión de órdenes de producción con un flujo de estados completo, trazabilidad y alertas visuales.

### 3.5. Solicitud de Compra
- Flujo de aprobación flexible, creación inteligente desde pedidos del ERP y alertas de duplicados.

### 3.6. Analíticas y Reportes
- Herramientas de inteligencia de negocio, como las **Sugerencias de Compra Proactivas**.

### 3.7. Almacenes
- Consulta de inventario, asignación de ubicaciones y configuración de conteo físico.

### 3.8. Consultas Hacienda
- Búsqueda unificada de situación tributaria y exoneraciones.

### 3.9. Buzón de Sugerencias
- Canal directo para que los usuarios envíen feedback a los administradores.

### 3.10. Centro de Ayuda
- Guía de usuario completa e integrada en la aplicación, con búsqueda inteligente.

---

## 4. Gestión de Usuarios y Seguridad

### 4.1. Recuperación de Contraseña
- Los usuarios pueden solicitar una contraseña temporal por correo electrónico. Requiere configuración SMTP por un administrador.

### 4.2. Cambio de Contraseña Forzado
- Se activa para usuarios nuevos o para quienes usan una contraseña temporal, obligándolos a establecer una clave personal.

---

## 5. Instalación y Despliegue

1.  **Instalar dependencias**: `npm install`
2.  **(Opcional) Configurar Conexiones**: Crear `.env.local` para credenciales de SQL Server y SMTP.
3.  **Ejecutar en desarrollo**: `npm run dev` (se inicia en `http://localhost:9003`).
4.  **Primer Inicio**: Un asistente de configuración te guiará para crear el primer usuario administrador.
5.  **Ejecutar en Producción**: `npm run build` y luego `npm run start`. Se recomienda usar un gestor de procesos como PM2 o IIS.

---

## 6. Proceso de Actualización de Versiones

Las migraciones de la base de datos son automáticas al iniciar la aplicación.

**Proceso Seguro:**
1.  **Copia de Seguridad CRÍTICA:** Antes de todo, ve a **Administración > Mantenimiento** y crea un **Punto de Restauración**.
2.  **Reemplazar Archivos:** Detén la aplicación, elimina todos los archivos y carpetas de la versión anterior **EXCEPTO** la carpeta `dbs/` y el archivo `.env.local`. Copia los nuevos archivos.
3.  **Actualizar y Reconstruir:** Ejecuta `npm install --omit=dev` y luego `npm run build`.
4.  **Reiniciar la Aplicación:** Inicia la aplicación de nuevo para que se apliquen las migraciones.
5.  **Verificar:** Accede y confirma que todo funcione correctamente.

---

## 7. Créditos y Licencia

Desarrollado y mantenido por CLIC SOPORTE Y CLIC TIENDA S.R.L. Licencia MIT.
