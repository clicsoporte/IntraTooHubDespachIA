/**
 * @fileoverview This file acts as a placeholder or entry point for db initialization logic,
 * but the actual implementation resides in db.ts to avoid circular dependencies
 * and server/client module boundary issues.
 */
'use server';

// The actual database initialization functions are co-located in `db.ts`.
// This file is kept to maintain the project structure but delegates the work.
export { initializeMainDatabase, runMainDbMigrations } from './db';
