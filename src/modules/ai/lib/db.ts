/**
 * @fileoverview Server-side functions for the AI module's database.
 * This handles storage and retrieval for knowledge base paths.
 */
'use server';

import { connectDb } from '@/modules/core/lib/db';
import { logError, logInfo } from '@/modules/core/lib/logger';
import type { ExpectedSchema } from '@/modules/core/types';

export async function initializeAiDb(db: import('better-sqlite3').Database) {
    const schema = `
        CREATE TABLE IF NOT EXISTS knowledge_base_paths (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            path TEXT NOT NULL UNIQUE
        );
        CREATE TABLE IF NOT EXISTS chat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sessionId TEXT NOT NULL,
            userId INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp TEXT NOT NULL
        );
    `;
    db.exec(schema);
    console.log(`Database ia.db initialized for AI Engine.`);
}

export async function runAiMigrations(db: import('better-sqlite3').Database) {
    try {
        const tableInfo = db.prepare(`PRAGMA table_info(knowledge_base_paths)`).all() as { name: string }[];
        const columns = new Set(tableInfo.map(c => c.name));
        
        if (!columns.has('createdAt')) {
            // This is just an example, no actual migration is needed for this table yet
        }
    } catch (error) {
        // Table might not exist, that's okay, initialization will handle it.
    }
}
