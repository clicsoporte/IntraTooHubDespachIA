/**
 * @fileoverview Server-side functions for the AI module's database.
 * This handles storage and retrieval for knowledge base paths.
 */
'use server';

import { connectDb } from '@/modules/core/lib/db';
import { logError, logInfo } from '@/modules/core/lib/logger';
import type { ExpectedSchema } from '@/modules/core/types';

export const aiDbSchema: ExpectedSchema = {
    'knowledge_base_paths': ['id', 'name', 'path'],
    // Add other AI-specific tables here if needed in the future
};

export async function initializeAiDb(db: import('better-sqlite3').Database) {
    const schema = `
        CREATE TABLE IF NOT EXISTS knowledge_base_paths (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            path TEXT NOT NULL UNIQUE
        );
    `;
    db.exec(schema);
    console.log(`Database ia.db initialized for AI Engine.`);
}

export async function runAiMigrations(db: import('better-sqlite3').Database) {
    // Placeholder for future migrations
}

/**
 * Retrieves all configured paths for the knowledge base.
 * @returns A promise that resolves to an array of path objects.
 */
export async function getKnowledgeBasePaths(): Promise<{ id: number, name: string, path: string }[]> {
    const db = await connectDb('ia.db');
    try {
        return db.prepare('SELECT id, name, path FROM knowledge_base_paths ORDER BY name').all() as { id: number, name: string, path: string }[];
    } catch (e) {
        console.error("Failed to get KB paths", e);
        return [];
    }
}

/**
 * Saves a new knowledge base path to the database.
 * @param path - The UNC path to the document folder.
 * @param name - A descriptive name for the path.
 */
export async function saveKnowledgeBasePath(path: string, name: string): Promise<void> {
    const db = await connectDb('ia.db');
    db.prepare('INSERT INTO knowledge_base_paths (path, name) VALUES (?, ?)')
      .run(path, name);
}

/**
 * Deletes a knowledge base path from the database.
 * @param id - The ID of the path to delete.
 */
export async function deleteKnowledgeBasePath(id: number): Promise<void> {
    const db = await connectDb('ia.db');
    db.prepare('DELETE FROM knowledge_base_paths WHERE id = ?').run(id);
}

/**
 * Placeholder function for indexing files.
 * In a real implementation, this would walk the file system paths and update a vector index.
 * @returns A promise with the results of the indexing operation.
 */
export async function indexKnowledgeBaseFiles(): Promise<{ indexed: number; errors: number }> {
    const paths = await getKnowledgeBasePaths();
    logInfo('File indexing process started...', { pathCount: paths.length });
    // This is where you would implement the logic to read files, chunk them,
    // generate embeddings, and store them in a vector database.
    // For now, it's just a placeholder.
    return { indexed: 0, errors: 0 };
}