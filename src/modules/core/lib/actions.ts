/**
 * @fileoverview This file contains general-purpose Server Actions that can be called from client components.
 */
'use server';

import fs from 'fs';
import path from 'path';
import { importAllDataFromFiles as importAllData } from './db';
import { logWarn } from './logger';

/**
 * A server action that triggers a full data synchronization from the configured source (file or SQL).
 * This function is safe to call from client components.
 * @returns {Promise<{ type: string; count: number; }[]>} A promise that resolves to an array of import results.
 */
export async function syncAllData(): Promise<{ type: string; count: number; }[]> {
    return await importAllData();
}

/**
 * Shuts down the Node.js process.
 * This is a drastic action used to force a server restart after critical operations like a database restore.
 * It relies on a process manager (like PM2 or IIS) to automatically restart the application.
 */
export async function shutdownServer(): Promise<void> {
    await logWarn("SERVER SHUTDOWN INITIATED VIA ACTION. This will terminate the process.");
    // A small delay to ensure any final logs can be written
    setTimeout(() => {
        process.exit(1);
    }, 500);
}

/**
 * Cleans up all temporary export files from the server's disk.
 * @returns {Promise<number>} The number of files deleted.
 */
export async function cleanupAllExportFiles(): Promise<number> {
    const exportDir = path.join(process.cwd(), 'temp_files', 'exports');
    if (!fs.existsSync(exportDir)) {
        return 0;
    }
    
    const files = fs.readdirSync(exportDir);
    let deletedCount = 0;
    for (const file of files) {
        if (file.endsWith('.xlsx')) {
            fs.unlinkSync(path.join(exportDir, file));
            deletedCount++;
        }
    }
    return deletedCount;
}
