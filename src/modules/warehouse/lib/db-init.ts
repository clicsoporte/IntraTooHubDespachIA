/**
 * @fileoverview This file acts as the placeholder and exporter for the warehouse database
 * initialization and migration logic. The actual implementation resides in `db.ts`
 * to avoid server/client module boundary issues and circular dependencies.
 */
'use server';

// The actual database initialization and migration functions are co-located in `./db.ts`.
// This file simply re-exports them to be used by the central database connection manager.
export { initializeWarehouseDb, runWarehouseMigrations } from './db';
