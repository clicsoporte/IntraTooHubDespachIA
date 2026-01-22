
'use server';

import { z } from 'zod';
import { generate, genkit, type GenerationConfig } from 'genkit';
import { ollama } from 'genkitx-ollama';
import { getApiSettings, queryLocalDb, connectDb } from '@/modules/core/lib/db';
import { logInfo, logError } from '@/modules/core/lib/logger';
import { searchLocalFiles as searchLocalFilesDb, getKnowledgeBasePaths, saveKnowledgeBasePath, deleteKnowledgeBasePath, indexKnowledgeBaseFiles } from './db';

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

export const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema),
  knowledge: z.boolean().optional(),
});

export type ChatResponse = {
    content: string;
};

// This function now uses the default model from settings
async function getChatModel() {
    const apiSettings = await getApiSettings();
    const modelName = apiSettings?.defaultModel || 'deepseek-coder-v2';
    const host = apiSettings?.ollamaHost;

    if (!host) {
        throw new Error('Ollama host is not configured.');
    }
    
    return ollama(modelName, {
        serverAddress: host,
        requestOptions: {
            timeout: 120000 // 2 minutes
        }
    });
}

/**
 * Returns a description of the database tables and their columns.
 * @param db - The database instance.
 * @returns A string describing the database schema.
 */
async function getTableSchema(db: import('better-sqlite3').Database): Promise<string> {
    const tables = db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all() as { name: string }[];

    let schemaDescription = '';
    for (const table of tables) {
        const tableName = table.name;
        schemaDescription += `Table "${tableName}":\n`;
        const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string, type: string }[];
        schemaDescription += columns.map(col => `  - ${col.name} (${col.type})`).join('\n');
        schemaDescription += '\n\n';
    }
    return schemaDescription;
}


export async function chatWithData(userInput: string): Promise<ChatResponse> {
    try {
        const model = await getChatModel();
        const mainDb = await connectDb(); // Connect to the main database
        const dbSchema = await getTableSchema(mainDb);
        const knowledgeBaseContent = await searchLocalFilesDb(userInput);

        const systemPrompt = `
            You are an expert database assistant for an ERP system named Clic-Tools. Your goal is to answer user questions by generating a single, valid SQLite query based on the database schema provided, and then interpreting the results.

            DATABASE SCHEMA:
            ---
            ${dbSchema}
            ---
            
            ADDITIONAL KNOWLEDGE:
            ---
            ${knowledgeBaseContent.map(item => `File: ${item.name}\nSummary: ${item.summary}`).join('\n\n')}
            ---

            USER'S QUESTION: "${userInput}"

            PROCESS:
            1.  Analyze the user's question and the provided database schema.
            2.  Formulate a SINGLE, syntactically correct SQLite query to answer the question.
            3.  **IMPORTANT:** Your response MUST be a JSON object with a single key: "sql_query". The value must be the SQL query string.
            4.  DO NOT add any explanations, introductory text, or markdown formatting. Only the JSON object.
            5.  The query should be as simple as possible. Avoid complex joins if a simpler query on a single table suffices.
            6.  If the question cannot be answered with a query, respond with a JSON object: {"sql_query": "null"}.

            EXAMPLE RESPONSE:
            {"sql_query": "SELECT ARTICULO, DESCRIPCION FROM products WHERE CLASIFICACION_2 = '01-MATERIA PRIMA' ORDER BY DESCRIPCION LIMIT 10;"}
        `;
        
        const genkitResponse = await generate({
            model: model,
            prompt: systemPrompt,
            config: { temperature: 0 },
        });

        const llmResponse = genkitResponse.text();
        logInfo("LLM Initial Response (SQL Generation)", { llmResponse });
        
        let sqlQuery: string | null = null;
        try {
            const jsonResponse = JSON.parse(llmResponse);
            if (jsonResponse && typeof jsonResponse.sql_query === 'string') {
                sqlQuery = jsonResponse.sql_query;
            }
        } catch (e) {
            logError("Failed to parse LLM JSON response for SQL query.", { response: llmResponse, error: (e as Error).message });
            return { content: "No pude generar una consulta válida a partir de tu pregunta. Intenta reformularla." };
        }
        
        if (!sqlQuery || sqlQuery.toLowerCase() === 'null') {
            return { content: "No puedo responder a esa pregunta con los datos disponibles." };
        }
        
        // --- Execute the query ---
        let queryResult: any[] = [];
        try {
            queryResult = await queryLocalDb(sqlQuery);
        } catch (dbError: any) {
            logError("Error executing LLM-generated SQL query.", { sql: sqlQuery, error: dbError.message });
            return { content: `Ocurrió un error al consultar la base de datos: ${dbError.message}` };
        }

        // --- Final Interpretation ---
        const finalPrompt = `
            You are a helpful assistant. Based on the user's original question and the data returned from the database, provide a friendly and clear answer.
            If the data is tabular, present it as a JSON array of objects. Otherwise, summarize the findings.

            ORIGINAL QUESTION: "${userInput}"
            DATABASE RESULT (JSON):
            ---
            ${JSON.stringify(queryResult, null, 2)}
            ---

            YOUR FINAL ANSWER:
        `;

        const finalGenkitResponse = await generate({
            model: model,
            prompt: finalPrompt,
        });

        return { content: finalGenkitResponse.text() };

    } catch (error: any) {
        logError("An unexpected error occurred in chatWithData", { error: error.message });
        return { content: `Lo siento, ocurrió un error inesperado: ${error.message}` };
    }
}

// AI Settings Actions
export async function testOllamaConnection(host: string): Promise<{ success: boolean; message: string; models?: {name: string}[] }> {
    try {
        const response = await fetch(`${host}/api/tags`);
        if (!response.ok) {
            throw new Error(`Connection failed with status: ${response.status}`);
        }
        const data = await response.json();
        return { success: true, message: 'Conexión exitosa.', models: data.models };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function getAvailableOllamaModels(host: string): Promise<{name: string}[]> {
    try {
        const response = await fetch(`${host}/api/tags`);
        if (!response.ok) return [];
        const data = await response.json();
        return data.models || [];
    } catch (error) {
        return [];
    }
}

export { getKnowledgeBasePaths, saveKnowledgeBasePath, deleteKnowledgeBasePath, indexKnowledgeBaseFiles };
