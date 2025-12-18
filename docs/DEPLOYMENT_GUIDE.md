# Guía de Despliegue: Archivos para Producción

Esta guía resume qué archivos y carpetas son necesarios para realizar una instalación limpia de la aplicación en un servidor de producción.

## Archivos y Carpetas Esenciales para Copiar al Servidor

Para una nueva instalación o una actualización, debes copiar los siguientes elementos desde tu repositorio de código a la carpeta de destino en tu servidor:

-   **`src/`**: Todo el código fuente de la aplicación.
-   **`public/`**: Archivos estáticos (imágenes, etc.).
-   **`docs/`**: Documentación y scripts de ayuda para el despliegue.
-   **`package.json`**: Define las dependencias del proyecto.
-   **`package-lock.json`**: Asegura que se instalen las mismas versiones de las dependencias.
-   **`next.config.js`**: Configuración de Next.js.
-   **`tsconfig.json`**: Configuración de TypeScript.
-   **`tailwind.config.ts`**: Configuración de Tailwind CSS.
-   **`postcss.config.mjs`**: Configuración de PostCSS.
-   **Otros archivos de configuración raíz**: Como `.eslintrc.json`, `components.json`, `apphosting.yaml`.

## Archivos y Carpetas que NO Debes Copiar

Estos archivos se generan automáticamente durante el proceso de instalación en el servidor o contienen datos sensibles.

-   **`node_modules/`**: Se genera al ejecutar `npm install` en el servidor.
-   **`.next/`**: Se genera al ejecutar `npm run build` en el servidor. Contiene la aplicación optimizada.
-   **`dbs/`**: **¡Crítico!** Esta carpeta almacena tus bases de datos.
    -   **Para una instalación nueva:** No existe, se creará automáticamente.
    -   **Para una actualización:** **NO la reemplaces**. Debes conservarla en el servidor para no perder ningún dato.
-   **`.env.local`**: Este archivo contiene credenciales y debe ser creado y configurado **directamente en el servidor** por seguridad.

## Proceso Básico en el Servidor

1.  **Copia** los archivos y carpetas esenciales a tu servidor.
2.  **Crea y configura** tu archivo `.env.local` si es necesario (para la conexión a SQL Server).
3.  **Ejecuta `npm install --omit=dev`** para instalar las dependencias de producción.
4.  **Ejecuta `npm run build`** para compilar la aplicación.
5.  **Ejecuta `npm run start`** (o usa un gestor de procesos como PM2 o IIS) para iniciar el servidor de producción.
