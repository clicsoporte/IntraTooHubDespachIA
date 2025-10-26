========================================
Guía de Despliegue para Clic-Tools en IIS
========================================
v1.9.0

Este documento explica cómo desplegar la aplicación Clic-Tools (Next.js) en un servidor Windows utilizando Internet Information Services (IIS).

--------------------
Requisitos Previos
--------------------
Antes de comenzar, asegúrate de que tu servidor Windows tenga lo siguiente instalado:

1.  **IIS (Internet Information Services)**: El rol de servidor web de Windows.
2.  **Node.js**: Instala la versión LTS (Soporte a Largo Plazo, v20.x o superior) desde el sitio web oficial de Node.js. Asegúrate de instalarlo en la ruta por defecto (`C:\Program Files\nodejs`).
3.  **Módulo URL Rewrite**: Un módulo oficial de Microsoft que permite a IIS reescribir URLs. Descárgalo desde la web de IIS.
4.  **`iisnode`**: Un módulo de IIS que actúa como puente para ejecutar aplicaciones Node.js dentro de IIS. Descarga la última versión desde su repositorio en GitHub.

*Nota Importante: Después de instalar estos componentes, es muy recomendable reiniciar el servicio de IIS (`iisreset` en CMD) o el servidor completo para asegurar que todos los módulos se carguen correctamente.*

--------------------
Pasos de Despliegue
--------------------

**Paso 1: Mover los archivos del proyecto al servidor**

1.  Crea una carpeta en tu servidor donde vivirá la aplicación (ej: `C:\inetpub\wwwroot\clic-tools`).
2.  Copia **todo el contenido del proyecto** (excepto la carpeta `node_modules`) a esta nueva carpeta.

**Paso 2: Configurar las Variables de Entorno (¡Importante!)**

Si vas a utilizar la conexión directa a SQL Server, este paso es obligatorio.

1.  En la raíz de la carpeta del proyecto (ej: `C:\inetpub\wwwroot\clic-tools`), crea un nuevo archivo de texto y nómbralo `.env.local`.
2.  Abre el archivo y añade las credenciales de tu base de datos. **Utiliza un usuario de SQL Server que tenga permisos de SOLO LECTURA**.
    ```
    SQL_SERVER_USER=tu_usuario_sql
    SQL_SERVER_PASSWORD=tu_contraseña_segura
    SQL_SERVER_HOST=ip_o_nombre_del_servidor_erp
    SQL_SERVER_DATABASE=nombre_de_la_base_de_datos
    SQL_SERVER_PORT=1433
    ```
3.  Guarda el archivo. El sistema leerá estas variables automáticamente.

**Paso 3: Instalar dependencias en el servidor**

1.  Abre una terminal (CMD o PowerShell) **como Administrador**.
2.  Navega a la carpeta donde copiaste los archivos del proyecto (ej: `cd C:\inetpub\wwwroot\clic-tools`).
3.  Ejecuta el siguiente comando para instalar solo las dependencias necesarias para producción:
    ```bash
    npm install --omit=dev
    ```

**Paso 4: Construir la aplicación para producción**

1.  En la misma terminal, ejecuta el comando para construir la versión optimizada de Next.js:
    ```bash
    npm run build
    ```
    Esto creará una carpeta `.next` con el archivo `server.js` y todo lo necesario para producción.

**Paso 5: Configurar el Sitio en IIS**

1.  Abre el "Administrador de Internet Information Services (IIS)".
2.  En el panel de "Conexiones", haz clic derecho en "Sitios" y selecciona "Agregar sitio web".
3.  **Nombre del sitio**: Asigna un nombre descriptivo (ej: `Clic-Tools`).
4.  **Ruta de acceso física**: Selecciona la carpeta donde están los archivos del proyecto (ej: `C:\inetpub\wwwroot\clic-tools`).
5.  **Enlace**: Configura el puerto en el que se ejecutará la aplicación en tu red LAN (ej: puerto 80) y el nombre de host (ej: garend.com).
6.  Haz clic en "Aceptar".

**Paso 6: Copiar y Asegurar los archivos de configuración de IIS**

1.  Desde la carpeta `docs/deployment/IIS_Setup/` de tu proyecto, copia los archivos `web.config` y `iisnode-interceptor.js` a la raíz de tu sitio en el servidor (ej: a `C:\inetpub\wwwroot\clic-tools`).
2.  Estos archivos son cruciales, ya que le dicen a IIS cómo manejar las solicitudes y pasárselas a Node.js a través de `iisnode`. La nueva versión está optimizada para Next.js 14+ y mejora el rendimiento al permitir que IIS sirva archivos estáticos directamente.

--------------------
Solución de Problemas
--------------------

-   **Permisos de Carpeta**: Asegúrate de que la cuenta de usuario del grupo de aplicaciones de IIS (generalmente `IIS_IUSRS`) tenga permisos de lectura y ejecución sobre la carpeta del proyecto.
-   **Error 500.19 o similar**: Generalmente indica que `iisnode` o `URL Rewrite` no están instalados o no se cargaron correctamente. Reinstálalos y reinicia el servidor.
-   **Logs de `iisnode`**: Si encuentras errores (ej. `HTTP 500`), el `web.config` ya está configurado para crear una carpeta `iisnode` en el directorio de tu aplicación con archivos de log. Revisa `iisnode-stdout.log` y `iisnode-stderr.log` para obtener pistas sobre el problema.
-   **Error `EBUSY: resource busy or locked`**: Este error suele ocurrir durante la configuración inicial si múltiples procesos intentan modificar la base de datos al mismo tiempo. Para evitarlo, asegúrate de que solo un usuario esté completando el asistente de configuración a la vez.

Una vez completados estos pasos, la aplicación Clic-Tools debería estar funcionando en la dirección y puerto que configuraste en IIS.
