/**
 * @fileoverview Server Actions for AI-related functionalities.
 * v4.0 - Contexto completo de la aplicación y flujos de negocio.
 */
'use server';

import { Ollama } from 'ollama';
import { getApiSettings, queryLocalDb, connectDb } from '@/modules/core/lib/db';
import { logError, logInfo } from '@/modules/core/lib/logger';
import { searchLocalFiles as searchLocalFilesDb } from './indexing-actions';
import { HELP_DATA } from './help-data';
import type { ChatResponse } from '@/modules/core/types';

function searchHelpDocumentation(keyword: string): string {
    if (!keyword || keyword.trim().length < 3) {
        return "No se encontró información de ayuda. Por favor, sé más específico en tu búsqueda.";
    }
    const searchLower = keyword.toLowerCase();
    const results = HELP_DATA.filter(section => 
        section.title.toLowerCase().includes(searchLower) || 
        section.content.toLowerCase().includes(searchLower)
    );
    if (results.length === 0) {
        return "No se encontró información de ayuda sobre ese tema.";
    }
    // Retorna solo el contenido más relevante para mantener la respuesta concisa
    return results.map(r => `## ${r.title}\n${r.content}`).join('\n\n---\n\n');
}


// --- ESQUEMA COMPLETO Y DEFINITIVO CON CONTEXTO DE NEGOCIO Y AYUDA ---
const dbSchema = `
Eres 'Clic-IA', el asistente experto del ERP Clic-Tools. Tu objetivo es entender el negocio y responder preguntas analizando los datos locales o buscando en la documentación de ayuda.

HERRAMIENTAS:
1. \`query_local_db\`: Úsala para consultas sobre datos del ERP (ventas, stock, clientes, etc.).
2. \`search_help_documentation\`: Úsala para preguntas sobre CÓMO USAR la aplicación (ej: "¿Cómo creo una orden?", "¿Para qué sirve el cotizador?").
3. \`search_local_files\`: Úsala si el usuario pide buscar explícitamente en documentos de la red.

CONTEXTO DEL NEGOCIO Y MÓDULOS DE CLIC-TOOLS:

1.  **Ventas (Facturación):** Datos en \`erp_invoice_headers\` y \`erp_invoice_lines\`. Úsalos para preguntas sobre "ventas", "facturado", "salidas".

2.  **Pedidos de Clientes:** Órdenes del cliente en el ERP. Tablas: \`erp_order_headers\` y \`erp_order_lines\`.

3.  **Compras (Recepción desde ERP):** Órdenes de compra a proveedores. Tablas: \`erp_purchase_order_headers\` y \`erp_purchase_order_lines\`. Úsalas si te preguntan por "ingresos desde el ERP", "compras a proveedores", "tránsitos".

4.  **Solicitudes de Compra (Módulo Interno):** Solicitudes INTERNAS de los usuarios. Tabla: \`purchase_requests\`.

5.  **Planificador de Producción (Módulo Interno):** Órdenes INTERNAS para producir. Tabla: \`production_orders\`.

6.  **Almacén (Módulo Interno):**
    *   **Asistente de Recepción:** Ingreso MANUAL de mercadería. Tabla: \`inventory_units\`.
    *   **Centro de Despacho:** Verificación de facturas. Tabla: \`dispatch_logs\`.
    *   **Toma de Inventario Físico:** Conteos manuales. Tabla: \`inventory\`.

ESTRUCTURA DE DATOS (HÍBRIDA):

GRUPO A: TABLAS EN INGLÉS (camelCase - Datos gestionados por Clic-Tools)
-------------------------------------------------------------------------
- \`products\`: Catálogo de artículos (id, description, classification, barcode, cabys).
- \`customers\`: Catálogo de clientes (id, name, taxId, salesperson).
- \`stock\`: Inventario del ERP (itemId, totalStock, stockByWarehouse).
- \`production_orders\`: Órdenes del Planificador (consecutive, productDescription, quantity, status, requestedBy).
- \`purchase_requests\`: Solicitudes de Compra internas (consecutive, itemDescription, quantity, status, requestedBy).
- \`inventory_units\`: Unidades de inventario (lotes/tarimas) creadas por el Asistente de Recepción (unitCode, productId, humanReadableId, documentId, createdAt, createdBy).
- \`inventory\`: Conteos físicos del módulo de Toma de Inventario (itemId, locationId, quantity, updatedBy).
- \`dispatch_logs\`: Registros de verificación del Centro de Despacho (documentId, verifiedByUserName, verifiedAt, items).
- \`production_order_history\`: Historial de cambios de estado para una orden de producción.

GRUPO B: TABLAS EN ESPAÑOL (Mayúsculas - Datos crudos del ERP)
--------------------------------------------------------------
- \`erp_invoice_headers\`: Cabeceras de FACTURAS DE VENTA.
- \`erp_invoice_lines\`: Líneas de FACTURAS DE VENTA (ARTICULO, CANTIDAD).
- \`erp_purchase_order_headers\`: Cabeceras de ÓRDENES DE COMPRA.
- \`erp_purchase_order_lines\`: Líneas de ÓRDENES DE COMPRA (ARTICULO, CANTIDAD_ORDENADA).
- \`erp_order_headers\`: Cabeceras de PEDIDOS de clientes.
- \`erp_order_lines\`: Líneas de PEDIDOS de clientes (ARTICULO, CANTIDAD_PEDIDA).
- \`empleados\`: Lista de empleados de la empresa (EMPLEADO, NOMBRE, DEPARTAMENTO, PUESTO).
- \`vendedores\`: Lista de vendedores (VENDEDOR, NOMBRE).
- \`departamentos\`: Lista de departamentos (DEPARTAMENTO, DESCRIPCION).
- \`puestos\`: Lista de puestos (PUESTO, DESCRIPCION).

REGLAS DE RAZONAMIENTO:
1.  **Diferencia Ingresos:** Si dicen "Ingresos de mercadería del ERP", busca en \`erp_purchase_order_lines\`. Si dicen "ingresos del asistente de recepción", busca en \`inventory_units\`.
2.  **Ambigüedad:** Si una consulta es ambigua (ej. "dame el stock de GAM"), no elijas al azar. En tu respuesta, indica que encontraste varias opciones (GAM32, GAM-EXTRA) y pide al usuario que sea más específico.
3.  **Usa JOIN:** Siempre que sea posible, une las tablas para dar respuestas más completas.

FORMATO DE SOLICITUD (TÚ SALIDA):
- Si necesitas datos de la BD: \`QUERY_SQL: <tu consulta SQL>\`
- Si necesitas ayuda de la aplicación: \`SEARCH_HELP_DOCUMENTATION: <palabra clave>\`
- Si necesitas buscar archivos: \`SEARCH_FILES: <palabras clave>\`
- Si es charla general: Texto libre.
`;

export async function chatWithData(userMessage: string): Promise<ChatResponse> {
    logInfo('AI chat started', { message: userMessage });

    const companySettings = await getApiSettings();
    const host = companySettings?.ollamaHost || 'http://localhost:11434';
    const model = companySettings?.defaultModel || 'deepseek-coder-v2';

    const ollama = new Ollama({ host });

    try {
        // PASO 1: Cerebro (Decisión)
        const initialResponse = await ollama.chat({
            model: model,
            messages: [
                { role: 'system', content: dbSchema },
                { role: 'user', content: userMessage }
            ],
            stream: false
        });

        const aiContent = initialResponse.message.content.trim();
        const cleanContent = aiContent.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

        let toolResult: string | null = null;
        let toolUsed = 'none';

        // PASO 2: Ejecución de Herramientas
        if (cleanContent.startsWith('QUERY_SQL:')) {
            toolUsed = 'query_local_db';
            const sqlQuery = cleanContent.substring('QUERY_SQL:'.length).trim();
            logInfo('AI executing Local SQL', { query: sqlQuery });
            
            try {
                const data = await queryLocalDb(sqlQuery);
                toolResult = JSON.stringify(data, null, 2);
            } catch (err: any) {
                toolResult = `Error SQL: ${err.message}. REVISA EL ESQUEMA: Productos/Clientes en inglés, tablas del ERP en español.`;
            }
        } else if (cleanContent.startsWith('SEARCH_HELP_DOCUMENTATION:')) {
            toolUsed = 'search_help_documentation';
            const keyword = cleanContent.substring('SEARCH_HELP_DOCUMENTATION:'.length).trim();
            logInfo('AI searching help documentation', { keyword });
            toolResult = searchHelpDocumentation(keyword);
        } else if (cleanContent.startsWith('SEARCH_FILES:')) {
            toolUsed = 'search_local_files';
            const keyword = cleanContent.substring('SEARCH_FILES:'.length).trim();
            logInfo('AI searching files', { keyword });
            const files = await searchLocalFilesDb(keyword);
            toolResult = files.length > 0 ? JSON.stringify(files, null, 2) : "No se encontraron archivos en el índice.";
        }

        // PASO 3: Humanización (Si se usó una herramienta)
        let finalContent = "";
        if (toolResult !== null) {
            // Si la herramienta devuelve una tabla, la mostramos directamente, a menos que sea la ayuda.
            if (toolUsed === 'query_local_db') {
                 try {
                    const parsedResult = JSON.parse(toolResult);
                    if (Array.isArray(parsedResult) && parsedResult.length > 1) { // Show table for multiple results
                        return { content: toolResult };
                    }
                } catch (e) { /* No es un JSON válido, proceder a humanizar */ }
            }

            const interpretation = await ollama.chat({
                model: model,
                messages: [
                    { role: 'system', content: dbSchema },
                    { role: 'user', content: userMessage },
                    { role: 'assistant', content: aiContent },
                    { 
                        role: 'system', 
                        content: `DATOS OBTENIDOS DE LA HERRAMIENTA '${toolUsed}':\n${toolResult}\n\nINSTRUCCIÓN FINAL OBLIGATORIA:\n1. NO devuelvas el JSON crudo.\n2. Lee los datos y redáctalos en una respuesta natural y amable en el mismo idioma en que el usuario hizo la pregunta.\n3. Si es un dato único (como un stock), di "El stock es X unidades". Si es una lista, usa viñetas.\n4. Si los datos son de la ayuda, explícalos como si fueras un experto en el sistema.`
                    }
                ],
                stream: false
            });
            finalContent = interpretation.message.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        } else {
            finalContent = cleanContent;
        }

        return { content: finalContent || "No pude procesar tu solicitud. Intenta reformular la pregunta." };

    } catch (error: any) {
        logError('AI chat process failed', { userMessage, model, error: error.message });
        if (error.message.includes('fetch failed')) {
            return { content: `Error de conexión: No puedo ver al asistente de IA en la dirección configurada (${host}). Asegúrate de que Ollama esté corriendo y que la URL sea correcta.` };
        }
        return { content: `Hubo un error al comunicarse con el asistente de IA: ${error.message}` };
    }
}

export async function testOllamaConnection(hostUrl: string): Promise<{ success: boolean; message: string; models?: any[] }> {
    if (!hostUrl || !hostUrl.trim()) {
        return { success: false, message: 'La URL del host no puede estar vacía.' };
    }

    const url = hostUrl.startsWith('http') ? hostUrl : `http://${hostUrl}`;

    try {
        const ollama = new Ollama({ host: url });
        const response = await ollama.list();
        
        return {
            success: true,
            message: `¡Conexión exitosa! Se encontraron ${response.models.length} modelos.`,
            models: response.models,
        };
    } catch (error: any) {
        logError('Failed to connect to Ollama server', { host: url, error: error.message });
        if (error.message.includes('fetch failed')) {
            return { success: false, message: 'Error de red. Asegúrate de que la URL sea correcta y que no haya un firewall bloqueando la conexión.' };
        }
        return { success: false, message: `No se pudo conectar: ${error.message}. Asegúrate de que Ollama esté corriendo y accesible desde la red.` };
    }
}

export async function getAvailableOllamaModels(hostUrl: string): Promise<{name: string}[]> {
  try {
    const connection = await testOllamaConnection(hostUrl);
    if (connection.success && connection.models) {
      return connection.models;
    }
    return [];
  } catch (error) {
    return [];
  }
}

// --- File Indexing Actions ---
export async function getKnowledgeBasePaths(): Promise<{ id: number, name: string, path: string }[]> {
    const db = await connectDb('ia.db');
    try {
        return db.prepare('SELECT id, name, path FROM knowledge_base_paths ORDER BY name').all() as { id: number, name: string, path: string }[];
    } catch (e) {
        console.error("Failed to get KB paths", e);
        return [];
    }
}

export async function saveKnowledgeBasePath(path: string, name: string): Promise<void> {
    const db = await connectDb('ia.db');
    db.prepare('INSERT INTO knowledge_base_paths (path, name) VALUES (?, ?)')
      .run(path, name);
}

export async function deleteKnowledgeBasePath(id: number): Promise<void> {
    const db = await connectDb('ia.db');
    db.prepare('DELETE FROM knowledge_base_paths WHERE id = ?').run(id);
}

export async function indexKnowledgeBaseFiles(): Promise<{ indexed: number; errors: number }> {
    const paths = await getKnowledgeBasePaths();
    let indexed = 0;
    let errors = 0;

    for (const source of paths) {
        try {
            // Placeholder for a real file system walk
        } catch (error: any) {
            logError(`Error indexing path: ${source.path}`, { error: error.message });
            errors++;
        }
    }
    await logInfo('File indexing process completed', { indexed, errors });
    return { indexed, errors };
}
