/**
 * @fileoverview This file contains the initialization and migration logic for the warehouse database.
 * It's separated from db.ts to prevent server/client module boundary issues and circular dependencies.
 */
'use server';

import type { WarehouseSettings, DispatchContainer } from '@/modules/core/types';

// This function is automatically called when the database is first created.
export async function initializeWarehouseDb(db: import('better-sqlite3').Database) {
    const schema = `
        CREATE TABLE IF NOT EXISTS locations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT UNIQUE NOT NULL,
            type TEXT NOT NULL, -- 'building', 'zone', 'rack', 'shelf', 'bin'
            parentId INTEGER,
            isLocked INTEGER DEFAULT 0,
            lockedBy TEXT,
            lockedByUserId INTEGER,
            lockedAt TEXT,
            FOREIGN KEY (parentId) REFERENCES locations(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            itemId TEXT NOT NULL, -- Corresponds to Product['id'] from main DB
            locationId INTEGER NOT NULL,
            quantity REAL NOT NULL DEFAULT 0,
            lastUpdated TEXT NOT NULL,
            updatedBy TEXT,
            FOREIGN KEY (locationId) REFERENCES locations(id) ON DELETE CASCADE,
            UNIQUE (itemId, locationId)
        );

         CREATE TABLE IF NOT EXISTS item_locations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            itemId TEXT NOT NULL,
            locationId INTEGER NOT NULL,
            clientId TEXT,
            updatedBy TEXT,
            updatedAt TEXT,
            FOREIGN KEY (locationId) REFERENCES locations(id) ON DELETE CASCADE,
            UNIQUE (itemId, locationId, clientId)
        );

        CREATE TABLE IF NOT EXISTS inventory_units (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            unitCode TEXT UNIQUE,
            productId TEXT NOT NULL,
            humanReadableId TEXT,
            documentId TEXT,
            locationId INTEGER,
            quantity REAL DEFAULT 1,
            notes TEXT,
            createdAt TEXT NOT NULL,
            createdBy TEXT NOT NULL,
            FOREIGN KEY (locationId) REFERENCES locations(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS movements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            itemId TEXT NOT NULL,
            quantity REAL NOT NULL,
            fromLocationId INTEGER,
            toLocationId INTEGER,
            timestamp TEXT NOT NULL,
            userId INTEGER NOT NULL,
            notes TEXT,
            FOREIGN KEY (fromLocationId) REFERENCES locations(id) ON DELETE CASCADE,
            FOREIGN KEY (toLocationId) REFERENCES locations(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS warehouse_config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS dispatch_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            documentId TEXT NOT NULL,
            documentType TEXT NOT NULL,
            verifiedAt TEXT NOT NULL,
            verifiedByUserId INTEGER NOT NULL,
            verifiedByUserName TEXT NOT NULL,
            items TEXT NOT NULL, -- JSON array of verified items
            notes TEXT
        );

        CREATE TABLE IF NOT EXISTS dispatch_containers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            createdBy TEXT,
            createdAt TEXT,
            isLocked INTEGER DEFAULT 0,
            lockedBy TEXT,
            lockedByUserId INTEGER,
            lockedAt TEXT
        );
        CREATE TABLE IF NOT EXISTS dispatch_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            containerId INTEGER NOT NULL,
            documentId TEXT NOT NULL UNIQUE,
            documentType TEXT NOT NULL,
            documentDate TEXT NOT NULL,
            clientId TEXT NOT NULL,
            clientName TEXT NOT NULL,
            assignedBy TEXT NOT NULL,
            assignedAt TEXT NOT NULL,
            sortOrder INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending',
            FOREIGN KEY (containerId) REFERENCES dispatch_containers(id) ON DELETE CASCADE
        );
    `;
    db.exec(schema);

    // Insert default settings
    const defaultSettings: Partial<WarehouseSettings> = {
        locationLevels: [
            { type: 'building', name: 'Edificio' },
            { type: 'zone', name: 'Zona' },
            { type: 'rack', name: 'Rack' },
            { type: 'shelf', name: 'Estante' },
            { type: 'bin', name: 'Casilla' }
        ],
        unitPrefix: 'U',
        nextUnitNumber: 1,
        dispatchNotificationEmails: '',
    };
    db.prepare(`
        INSERT OR IGNORE INTO warehouse_config (key, value) VALUES ('settings', ?)
    `).run(JSON.stringify(defaultSettings));
    
    console.log(`Database warehouse.db initialized for Warehouse Management.`);
    await runWarehouseMigrations(db);
};

export async function runWarehouseMigrations(db: import('better-sqlite3').Database) {
    try {
        const recreateTableWithCascade = (tableName: string, createSql: string, columns: string) => {
            db.transaction(() => {
                db.exec(`CREATE TABLE ${tableName}_temp_migration AS SELECT * FROM ${tableName};`);
                db.exec(`DROP TABLE ${tableName};`);
                db.exec(createSql);
                db.exec(`INSERT INTO ${tableName} (${columns}) SELECT ${columns} FROM ${tableName}_temp_migration;`);
                db.exec(`DROP TABLE ${tableName}_temp_migration;`);
                console.log(`MIGRATION (warehouse.db): Successfully recreated '${tableName}' table with ON DELETE CASCADE.`);
            })();
        };

        const checkAndRecreateForeignKey = (tableName: string, columnName: string, createSql: string, columnsCsv: string) => {
            const tableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`).get();
            if (!tableExists) return;

            const foreignKeyList = db.prepare(`PRAGMA foreign_key_list(${tableName})`).all() as any[];
            const fk = foreignKeyList.find(f => f.from === columnName);
            
            if ((fk && fk.on_delete !== 'CASCADE') || (fk && fk.table !== 'locations')) {
                recreateTableWithCascade(tableName, createSql, columnsCsv);
            }
        };

        const locationsTableInfo = db.prepare(`PRAGMA table_info(locations)`).all() as { name: string }[];
        if (!locationsTableInfo.some(c => c.name === 'lockedByUserId')) {
            // This column was misnamed before.
            db.exec('ALTER TABLE locations ADD COLUMN lockedByUserId INTEGER');
            db.exec('ALTER TABLE locations ADD COLUMN lockedAt TEXT');
        }
        if (locationsTableInfo.some(c => c.name === 'lockedBySessionId')) {
             console.log("MIGRATION (warehouse.db): Renaming column lockedBySessionId is not directly supported by SQLite. A manual data migration might be needed if data exists in this column.");
             // In a real scenario, you'd create a new table, copy data, drop old, and rename.
        }

        const dispatchContainersTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='dispatch_containers'`).get();
        if(dispatchContainersTable) {
            const dispatchContainersInfo = db.prepare(`PRAGMA table_info(dispatch_containers)`).all() as { name: string }[];
            const containerColumns = new Set(dispatchContainersInfo.map(c => c.name));
            if (!containerColumns.has('lockedByUserId')) db.exec('ALTER TABLE dispatch_containers ADD COLUMN lockedByUserId INTEGER');
            if (!containerColumns.has('lockedAt')) db.exec('ALTER TABLE dispatch_containers ADD COLUMN lockedAt TEXT');
        }

    } catch (error) {
        console.error("Error during warehouse migrations:", error);
    }
}
```