/**
 * @fileoverview This file handles the SQLite database connection and provides
 * server-side functions for all database operations. It includes initialization,
 * schema creation, data access, and a centralized migration system for all application modules.
 */
"use server";

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initialCompany, initialRoles } from './data';
import { DB_MODULES } from './db-modules';
import type { Company, LogEntry, ApiSettings, User, Product, Customer, Role, QuoteDraft, DatabaseModule, Exemption, ExemptionLaw, StockInfo, StockSettings, ImportQuery, ItemLocation, UpdateBackupInfo, Suggestion, DateRange, Supplier, ErpOrderHeader, ErpOrderLine, Notification, UserPreferences, AuditResult, ErpPurchaseOrderHeader, ErpPurchaseOrderLine, SqlConfig, ProductionOrder, WizardSession, ErpInvoiceHeader, ErpInvoiceLine, Empleado, Vehiculo } from '@/modules/core/types';
import bcrypt from 'bcryptjs';
import Papa from 'papaparse';
import { executeQuery } from './sql-service';
import { logInfo, logWarn, logError } from './logger';
import { headers, cookies } from 'next/headers';
import { getExchangeRate, getEmailSettings } from './api-actions';
import { NewUserSchema, UserSchema } from './auth-schemas';
import { confirmModification as confirmPlannerModificationServer } from '../../planner/lib/db';
import { revalidatePath } from 'next/cache';
import { initializePlannerDb, runPlannerMigrations } from '../../planner/lib/db';
import { initializeRequestsDb, runRequestMigrations } from '../../requests/lib/db';
import { initializeWarehouseDb, runWarehouseMigrations } from '../../warehouse/lib/db-init';
import { initializeCostAssistantDb, runCostAssistantMigrations } from '../../cost-assistant/lib/db';
import { initializeNotificationsDb, runNotificationsMigrations } from '../../notifications/lib/db';
import { reformatEmployeeName } from '@/lib/utils';
import { renderLocationPathAsString } from '@/modules/warehouse/lib/utils';
import { initializeAiDb, runAiMigrations } from '@/modules/ai/lib/db';

const DB_FILE = 'intratool.db';
const SALT_ROUNDS = 10;
const CABYS_FILE_PATH = path.join(process.cwd(), 'docs', 'Datos', 'cabys.csv');
const UPDATE_BACKUP_DIR = 'update_backups';
const VERSION_FILE_PATH = path.join(process.cwd(), 'package.json');

/**
 * Initializes the main database with all core system tables.
 * This function is called automatically when the main DB file is first created.
 * @param {Database.Database} db - The database instance to initialize.
 */
export async function initializeMainDatabase(db: import('better-sqlite3').Database) {
    const schema = `
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            phone TEXT,
            whatsapp TEXT,
            erpAlias TEXT,
            avatar TEXT,
            role TEXT,
            recentActivity TEXT,
            securityQuestion TEXT,
            securityAnswer TEXT,
            forcePasswordChange BOOLEAN DEFAULT FALSE,
            activeWizardSession TEXT
        );
        CREATE TABLE IF NOT EXISTS roles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            permissions TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS company_settings (
            id INTEGER PRIMARY KEY,
            name TEXT, taxId TEXT, address TEXT, phone TEXT, email TEXT, logoUrl TEXT,
            systemName TEXT, publicUrl TEXT, quotePrefix TEXT, nextQuoteNumber INTEGER, decimalPlaces INTEGER, quoterShowTaxId BOOLEAN,
            searchDebounceTime INTEGER, syncWarningHours REAL, lastSyncTimestamp TEXT,
            importMode TEXT, customerFilePath TEXT, productFilePath TEXT, exemptionFilePath TEXT, stockFilePath TEXT, locationFilePath TEXT, cabysFilePath TEXT, supplierFilePath TEXT,
            erpPurchaseOrderHeaderFilePath TEXT, erpPurchaseOrderLineFilePath TEXT, erpInvoiceHeaderFilePath TEXT, erpInvoiceLineFilePath TEXT
        );
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            details TEXT
        );
        CREATE TABLE IF NOT EXISTS api_settings (id INTEGER PRIMARY KEY, exchangeRateApi TEXT, haciendaExemptionApi TEXT, haciendaTributariaApi TEXT, ollamaHost TEXT, defaultModel TEXT);
        CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, name TEXT, address TEXT, phone TEXT, taxId TEXT, currency TEXT, creditLimit REAL, paymentCondition TEXT, salesperson TEXT, active TEXT, email TEXT, electronicDocEmail TEXT);
        CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, description TEXT, classification TEXT, lastEntry TEXT, active TEXT, notes TEXT, unit TEXT, isBasicGood TEXT, cabys TEXT, barcode TEXT);
        CREATE TABLE IF NOT EXISTS exemptions (code TEXT PRIMARY KEY, description TEXT, customer TEXT, authNumber TEXT, startDate TEXT, endDate TEXT, percentage REAL, docType TEXT, institutionName TEXT, institutionCode TEXT);
        CREATE TABLE IF NOT EXISTS quote_drafts (id TEXT PRIMARY KEY, createdAt TEXT NOT NULL, userId INTEGER, customerId TEXT, customerDetails TEXT, lines TEXT, totals TEXT, notes TEXT, currency TEXT, exchangeRate REAL, purchaseOrderNumber TEXT, deliveryAddress TEXT, deliveryDate TEXT, sellerName TEXT, sellerType TEXT, quoteDate TEXT, validUntilDate TEXT, paymentTerms TEXT, creditDays INTEGER);
        CREATE TABLE IF NOT EXISTS exemption_laws (docType TEXT PRIMARY KEY, institutionName TEXT, authNumber TEXT);
        CREATE TABLE IF NOT EXISTS cabys_catalog (code TEXT PRIMARY KEY, description TEXT, taxRate REAL);
        CREATE TABLE IF NOT EXISTS stock (itemId TEXT PRIMARY KEY, stockByWarehouse TEXT, totalStock REAL);
        CREATE TABLE IF NOT EXISTS sql_config (key TEXT PRIMARY KEY, value TEXT);
        CREATE TABLE IF NOT EXISTS import_queries (type TEXT PRIMARY KEY, query TEXT);
        CREATE TABLE IF NOT EXISTS suggestions (id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT, userId INTEGER, userName TEXT, isRead INTEGER DEFAULT 0, timestamp TEXT);
        CREATE TABLE IF NOT EXISTS user_preferences (userId INTEGER NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (userId, key));
        CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL, message TEXT NOT NULL, href TEXT, isRead INTEGER DEFAULT 0, timestamp TEXT NOT NULL, entityId INTEGER, entityType TEXT, taskType TEXT, entityStatus TEXT, FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE);
        CREATE TABLE IF NOT EXISTS email_settings (key TEXT PRIMARY KEY, value TEXT);
        CREATE TABLE IF NOT EXISTS suppliers (id TEXT PRIMARY KEY, name TEXT, alias TEXT, email TEXT, phone TEXT);
        CREATE TABLE IF NOT EXISTS erp_order_headers (PEDIDO TEXT PRIMARY KEY, ESTADO TEXT, CLIENTE TEXT, FECHA_PEDIDO TEXT, FECHA_PROMETIDA TEXT, ORDEN_COMPRA TEXT, TOTAL_UNIDADES REAL, MONEDA_PEDIDO TEXT, USUARIO TEXT);
        CREATE TABLE IF NOT EXISTS erp_order_lines (PEDIDO TEXT, PEDIDO_LINEA INTEGER, ARTICULO TEXT, CANTIDAD_PEDIDA REAL, PRECIO_UNITARIO REAL, PRIMARY KEY (PEDIDO, PEDIDO_LINEA));
        CREATE TABLE IF NOT EXISTS erp_purchase_order_headers (ORDEN_COMPRA TEXT PRIMARY KEY, PROVEEDOR TEXT, FECHA_HORA TEXT, ESTADO TEXT, CreatedBy TEXT);
        CREATE TABLE IF NOT EXISTS erp_purchase_order_lines (ORDEN_COMPRA TEXT, ARTICULO TEXT, CANTIDAD_ORDENADA REAL, PRIMARY KEY(ORDEN_COMPRA, ARTICULO));
        CREATE TABLE IF NOT EXISTS erp_invoice_headers (CLIENTE TEXT, NOMBRE_CLIENTE TEXT, TIPO_DOCUMENTO TEXT, FACTURA TEXT PRIMARY KEY, PEDIDO TEXT, FACTURA_ORIGINAL TEXT, FECHA TEXT, FECHA_ENTREGA TEXT, ANULADA TEXT, EMBARCAR_A TEXT, DIRECCION_FACTURA TEXT, OBSERVACIONES TEXT, RUTA TEXT, USUARIO TEXT, USUARIO_ANULA TEXT, ZONA TEXT, VENDEDOR TEXT, REIMPRESO INTEGER);
        CREATE TABLE IF NOT EXISTS erp_invoice_lines (FACTURA TEXT, TIPO_DOCUMENTO TEXT, LINEA INTEGER, BODEGA TEXT, PEDIDO TEXT, ARTICULO TEXT, ANULADA TEXT, FECHA_FACTURA TEXT, CANTIDAD REAL, PRECIO_UNITARIO REAL, TOTAL_IMPUESTO1 REAL, PRECIO_TOTAL REAL, DESCRIPCION TEXT, DOCUMENTO_ORIGEN TEXT, CANT_DESPACHADA REAL, ES_CANASTA_BASICA TEXT, PRIMARY KEY(FACTURA, TIPO_DOCUMENTO, LINEA));
        CREATE TABLE IF NOT EXISTS stock_settings (key TEXT PRIMARY KEY, value TEXT);
        CREATE TABLE IF NOT EXISTS vendedores (VENDEDOR TEXT PRIMARY KEY, NOMBRE TEXT, EMPLEADO TEXT);
        CREATE TABLE IF NOT EXISTS direcciones_embarque (CLIENTE TEXT, DIRECCION TEXT, DETALLE_DIRECCION TEXT, DESCRIPCION TEXT, PRIMARY KEY(CLIENTE, DIRECCION));
        CREATE TABLE IF NOT EXISTS nominas (NOMINA TEXT PRIMARY KEY, DESCRIPCION TEXT, TIPO_NOMINA TEXT);
        CREATE TABLE IF NOT EXISTS puestos (PUESTO TEXT PRIMARY KEY, DESCRIPCION TEXT, ACTIVO TEXT);
        CREATE TABLE IF NOT EXISTS departamentos (DEPARTAMENTO TEXT PRIMARY KEY, DESCRIPCION TEXT, ACTIVO TEXT);
        CREATE TABLE IF NOT EXISTS empleados (EMPLEADO TEXT PRIMARY KEY, NOMBRE TEXT, ACTIVO TEXT, DEPARTAMENTO TEXT, PUESTO TEXT, NOMINA TEXT);
        CREATE TABLE IF NOT EXISTS vehiculos (placa TEXT PRIMARY KEY, marca TEXT);
    `;
    db.exec(schema);

    // Insert default data
    const insertRole = db.prepare('INSERT OR IGNORE INTO roles (id, name, permissions) VALUES (@id, @name, @permissions)');
    const insertRolesTransaction = db.transaction((roles) => { for (const role of roles) insertRole.run({ ...role, permissions: JSON.stringify(role.permissions) }); });
    insertRolesTransaction(initialRoles);
    
    const insertCompany = db.prepare('INSERT OR IGNORE INTO company_settings (id, name, taxId, address, phone, email, systemName, publicUrl, quotePrefix, nextQuoteNumber, decimalPlaces, quoterShowTaxId, searchDebounceTime, syncWarningHours, importMode) VALUES (1, @name, @taxId, @address, @phone, @email, @systemName, @publicUrl, @quotePrefix, @nextQuoteNumber, @decimalPlaces, @quoterShowTaxId, @searchDebounceTime, @syncWarningHours, @importMode)');
    insertCompany.run({ ...initialCompany, publicUrl: null, quoterShowTaxId: initialCompany.quoterShowTaxId ? 1 : 0 });
    
    db.prepare(`INSERT OR IGNORE INTO api_settings (id, exchangeRateApi, haciendaExemptionApi, haciendaTributariaApi, ollamaHost, defaultModel) VALUES (1, 'https://api.hacienda.go.cr/indicadores/tc/dolar', 'https://api.hacienda.go.cr/fe/ex?autorizacion=', 'https://api.hacienda.go.cr/fe/ae?identificacion=', 'http://localhost:11434', 'deepseek-coder-v2')`).run();
    
    console.log(`Database ${DB_FILE} initialized.`);

    // Run migrations after initialization
    await runMainDbMigrations(db);
}

// This path is configured to work correctly within the Next.js build output directory,
// which is crucial for serverless environments.
const dbDirectory = path.join(process.cwd(), 'dbs');

const dbConnections = new Map<string, Database.Database>();

// New helper function to run migrations safely.
async function runMigrations(dbModule: Omit<DatabaseModule, 'schema'>, db: Database.Database) {
    let migrationFn;
    switch (dbModule.id) {
        case 'clic-tools-main': migrationFn = runMainDbMigrations; break;
        case 'purchase-requests': migrationFn = runRequestMigrations; break;
        case 'production-planner': migrationFn = runPlannerMigrations; break;
        case 'warehouse-management': migrationFn = runWarehouseMigrations; break;
        case 'cost-assistant': migrationFn = runCostAssistantMigrations; break;
        case 'notifications-engine': migrationFn = runNotificationsMigrations; break;
        case 'ai-engine': migrationFn = runAiMigrations; break;
        default: break;
    }

    if (migrationFn) {
        try {
            await migrationFn(db);
        } catch (error) {
            console.error(`Migration failed for ${dbModule.dbFile}, but continuing. Error:`, error);
        }
    }
}

/**
 * Establishes a connection to a specific SQLite database file.
 * This function is ASYNCHRONOUS. It creates the database and runs initialization
 * and migrations if the file doesn't exist.
 * @param {string} dbFile - The filename of the database to connect to.
 * @param {boolean} [forceRecreate=false] - If true, deletes the existing DB file to start fresh.
 * @returns {Promise<Database.Database>} A promise that resolves to the database connection instance.
 */
export async function connectDb(dbFile: string = DB_FILE, forceRecreate = false): Promise<Database.Database> {
    if (!forceRecreate && dbConnections.has(dbFile) && dbConnections.get(dbFile)!.open) {
        return dbConnections.get(dbFile)!;
    }
    
    if (dbConnections.has(dbFile)) {
        const connection = dbConnections.get(dbFile);
        if (connection && connection.open) {
            connection.close();
        }
        dbConnections.delete(dbFile);
    }
    
    const dbPath = path.join(dbDirectory, dbFile);
    if (!fs.existsSync(dbDirectory)) {
        fs.mkdirSync(dbDirectory, { recursive: true });
    }

    if (forceRecreate && fs.existsSync(dbPath)) {
        console.log(`Forced recreation: Deleting database file ${dbFile}.`);
        fs.unlinkSync(dbPath);
    }

    let dbExists = fs.existsSync(dbPath);
    let db: Database.Database;

    try {
        db = new Database(dbPath);
    } catch (error: any) {
        if (error.code === 'SQLITE_CORRUPT') {
            console.error(`Database file ${dbFile} is corrupt. Renaming and creating a new one.`);
            const backupPath = `${dbPath}.corrupt.${Date.now()}`;
            fs.renameSync(dbPath, backupPath);
            await logError(`Database ${dbFile} was corrupt. A new one has been created. Corrupt file backed up to ${backupPath}.`);
            db = new Database(dbPath); // Create a new one
            dbExists = false; // Treat as a new DB
        } else {
            throw error;
        }
    }

    const dbModule = DB_MODULES.find(m => m.dbFile === dbFile);

    if (dbModule) {
        if (!dbExists) {
            console.log(`Database ${dbFile} not found, creating and initializing...`);
            if (dbModule.id === 'clic-tools-main') {
                await initializeMainDatabase(db);
            } else if (dbModule.id === 'purchase-requests') {
                await initializeRequestsDb(db);
            } else if (dbModule.id === 'production-planner') {
                await initializePlannerDb(db);
            } else if (dbModule.id === 'warehouse-management') {
                await initializeWarehouseDb(db);
            } else if (dbModule.id === 'cost-assistant') {
                await initializeCostAssistantDb(db);
            } else if (dbModule.id === 'notifications-engine') {
                await initializeNotificationsDb(db);
            } else if (dbModule.id === 'ai-engine') {
                await initializeAiDb(db);
            }
        }
        // Always run migrations on an existing DB to check for updates.
        await runMigrations(dbModule, db);
    }

    try {
        db.pragma('journal_mode = WAL');
    } catch(error: any) {
        console.error(`Could not set PRAGMA on ${dbFile}.`, error);
        if (error.code !== 'SQLITE_CORRUPT') {
            await logError(`Failed to set PRAGMA on ${dbFile}`, { error: (error as Error).message });
        }
    }
    
    dbConnections.set(dbFile, db);
    return db;
}

/**
 * Checks the database schema and applies necessary alterations (migrations).
 * This makes the app more resilient to schema changes over time without data loss.
 * @param {Database.Database} db - The database instance to check.
 */
export async function runMainDbMigrations(db: import('better-sqlite3').Database) {
    await checkAndApplyMigrations(db);
}

/**
 * Checks the database schema and applies necessary alterations (migrations).
 * This makes the app more resilient to schema changes over time without data loss.
 * @param {Database.Database} db - The database instance to check.
 */
async function checkAndApplyMigrations(db: import('better-sqlite3').Database) {
    // Main DB Migrations
    try {
        const usersTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='users'`).get() as { name: string };
        if(!usersTable) {
             console.log("Migration check skipped: Main database not initialized yet.");
             return;
        }

        const notificationsTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='notifications'`).get() as { name: string };
        if (!notificationsTable) {
            console.log("MIGRATION: Creating notifications table.");
            db.exec(`
                CREATE TABLE notifications (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    userId INTEGER NOT NULL,
                    message TEXT NOT NULL,
                    href TEXT,
                    isRead INTEGER DEFAULT 0,
                    timestamp TEXT NOT NULL,
                    entityId INTEGER,
                    entityType TEXT,
                    taskType TEXT,
                    entityStatus TEXT,
                    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
                );
            `);
        } else {
             const notificationsTableInfo = db.prepare(`PRAGMA table_info(notifications)`).all() as { name: string }[];
            const notificationsColumns = new Set(notificationsTableInfo.map(c => c.name));
            
            if (!notificationsColumns.has('entityId')) db.exec('ALTER TABLE notifications ADD COLUMN entityId INTEGER');
            if (!notificationsColumns.has('entityType')) db.exec('ALTER TABLE notifications ADD COLUMN entityType TEXT');
            if (!notificationsColumns.has('taskType')) db.exec('ALTER TABLE notifications ADD COLUMN taskType TEXT');
            if (!notificationsColumns.has('entityStatus')) db.exec('ALTER TABLE notifications ADD COLUMN entityStatus TEXT');
        }
        
        const userPrefsTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='user_preferences'`).get();
        if (!userPrefsTable) {
            console.log("MIGRATION: Creating user_preferences table.");
            db.exec(`CREATE TABLE user_preferences (userId INTEGER NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (userId, key));`);
        }
        
        const emailTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='email_settings'`).get();
        if (!emailTable) {
            console.log("MIGRATION: Creating email_settings table.");
            db.exec(`CREATE TABLE email_settings (key TEXT PRIMARY KEY, value TEXT);`);
        }

        const usersTableInfo = db.prepare(`PRAGMA table_info(users)`).all() as { name: string }[];
        const userColumns = new Set(usersTableInfo.map(c => c.name));

        if (!userColumns.has('erpAlias')) {
            console.log("MIGRATION: Adding erpAlias to users table.");
            db.exec(`ALTER TABLE users ADD COLUMN erpAlias TEXT`);
        }
        
        if (!userColumns.has('forcePasswordChange')) {
            console.log("MIGRATION: Adding forcePasswordChange to users table.");
            db.exec(`ALTER TABLE users ADD COLUMN forcePasswordChange BOOLEAN DEFAULT FALSE`);
        }

        if (!userColumns.has('activeWizardSession')) {
            console.log("MIGRATION: Adding activeWizardSession to users table.");
            db.exec(`ALTER TABLE users ADD COLUMN activeWizardSession TEXT`);
        }

        const companyTableInfo = db.prepare(`PRAGMA table_info(company_settings)`).all() as { name: string }[];
        const companyColumns = new Set(companyTableInfo.map(c => c.name));
        
        if (!companyColumns.has('decimalPlaces')) db.exec(`ALTER TABLE company_settings ADD COLUMN decimalPlaces INTEGER DEFAULT 2`);
        if (!companyColumns.has('quoterShowTaxId')) db.exec(`ALTER TABLE company_settings ADD COLUMN quoterShowTaxId BOOLEAN DEFAULT TRUE`);
        if (!companyColumns.has('syncWarningHours')) db.exec(`ALTER TABLE company_settings ADD COLUMN syncWarningHours REAL DEFAULT 12`);
        if (!companyColumns.has('publicUrl')) db.exec(`ALTER TABLE company_settings ADD COLUMN publicUrl TEXT`);
        
        if (companyColumns.has('importPath')) {
            console.log("MIGRATION: Dropping importPath column from company_settings.");
            db.exec(`ALTER TABLE company_settings DROP COLUMN importPath`);
        }
        
        if (!companyColumns.has('customerFilePath')) db.exec(`ALTER TABLE company_settings ADD COLUMN customerFilePath TEXT`);
        if (!companyColumns.has('productFilePath')) db.exec(`ALTER TABLE company_settings ADD COLUMN productFilePath TEXT`);
        if (!companyColumns.has('exemptionFilePath')) db.exec(`ALTER TABLE company_settings ADD COLUMN exemptionFilePath TEXT`);
        if (!companyColumns.has('stockFilePath')) db.exec(`ALTER TABLE company_settings ADD COLUMN stockFilePath TEXT`);
        if (!companyColumns.has('locationFilePath')) db.exec(`ALTER TABLE company_settings ADD COLUMN locationFilePath TEXT`);
        if (!companyColumns.has('cabysFilePath')) db.exec(`ALTER TABLE company_settings ADD COLUMN cabysFilePath TEXT`);
        if (!companyColumns.has('supplierFilePath')) db.exec(`ALTER TABLE company_settings ADD COLUMN supplierFilePath TEXT`);
        if (!companyColumns.has('erpPurchaseOrderHeaderFilePath')) db.exec(`ALTER TABLE company_settings ADD COLUMN erpPurchaseOrderHeaderFilePath TEXT`);
        if (!companyColumns.has('erpPurchaseOrderLineFilePath')) db.exec(`ALTER TABLE company_settings ADD COLUMN erpPurchaseOrderLineFilePath TEXT`);
        if (!companyColumns.has('erpInvoiceHeaderFilePath')) db.exec(`ALTER TABLE company_settings ADD COLUMN erpInvoiceHeaderFilePath TEXT`);
        if (!companyColumns.has('erpInvoiceLineFilePath')) db.exec(`ALTER TABLE company_settings ADD COLUMN erpInvoiceLineFilePath TEXT`);
        if (!companyColumns.has('importMode')) db.exec(`ALTER TABLE company_settings ADD COLUMN importMode TEXT DEFAULT 'file'`);
        if (!companyColumns.has('logoUrl')) db.exec(`ALTER TABLE company_settings ADD COLUMN logoUrl TEXT`);
        if (!companyColumns.has('searchDebounceTime')) db.exec(`ALTER TABLE company_settings ADD COLUMN searchDebounceTime INTEGER DEFAULT 500`);
        if (!companyColumns.has('lastSyncTimestamp')) db.exec(`ALTER TABLE company_settings ADD COLUMN lastSyncTimestamp TEXT`);

        const productsTableInfo = db.prepare(`PRAGMA table_info(products)`).all() as { name: string }[];
        const productColumns = new Set(productsTableInfo.map(c => c.name));
        if (!productColumns.has('barcode')) db.exec(`ALTER TABLE products ADD COLUMN barcode TEXT`);

        const adminUser = db.prepare('SELECT role FROM users WHERE id = 1').get() as { role: string } | undefined;
        if (adminUser && adminUser.role !== 'admin') {
            console.log("MIGRATION: Ensuring user with ID 1 is an admin.");
            db.prepare(`UPDATE users SET role = 'admin' WHERE id = 1`).run();
        }

        const draftsTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='quote_drafts'`).get();
        if (draftsTable) {
            const draftsTableInfo = db.prepare(`PRAGMA table_info(quote_drafts)`).all() as { name: string }[];
            const draftColumns = new Set(draftsTableInfo.map(c => c.name));
            if (!draftColumns.has('userId')) db.exec(`ALTER TABLE quote_drafts ADD COLUMN userId INTEGER;`);
             if (!draftColumns.has('customerId')) {
                db.exec(`ALTER TABLE quote_drafts ADD COLUMN customerId TEXT;`);
            }
            if (!draftColumns.has('lines')) db.exec(`ALTER TABLE quote_drafts ADD COLUMN lines TEXT;`);
            if (!draftColumns.has('totals')) db.exec(`ALTER TABLE quote_drafts ADD COLUMN totals TEXT;`);
            if (!draftColumns.has('notes')) db.exec(`ALTER TABLE quote_drafts ADD COLUMN notes TEXT;`);
            if (!draftColumns.has('currency')) db.exec(`ALTER TABLE quote_drafts ADD COLUMN currency TEXT;`);
            if (!draftColumns.has('exchangeRate')) db.exec(`ALTER TABLE quote_drafts ADD COLUMN exchangeRate REAL;`);
            if (!draftColumns.has('purchaseOrderNumber')) db.exec(`ALTER TABLE quote_drafts ADD COLUMN purchaseOrderNumber TEXT`);
        }

        const usersToUpdate = db.prepare('SELECT id, password FROM users').all() as User[];
        const updateUserPassword = db.prepare('UPDATE users SET password = ? WHERE id = ?');
        let updatedCount = 0;
        for (const user of usersToUpdate) {
            if (user.password && !user.password.startsWith('$2a$')) {
                const hashedPassword = bcrypt.hashSync(user.password, SALT_ROUNDS);
                updateUserPassword.run(hashedPassword, user.id);
                updatedCount++;
            }
        }
        if (updatedCount > 0) {
            console.log(`MIGRATION: Successfully hashed ${updatedCount} plaintext password(s).`);
        }
        
        const apiTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='api_settings'`).get();
        if (apiTable) {
            const apiTableInfo = db.prepare(`PRAGMA table_info(api_settings)`).all() as { name: string }[];
            if (!apiTableInfo.some(col => col.name === 'haciendaExemptionApi')) db.exec(`ALTER TABLE api_settings ADD COLUMN haciendaExemptionApi TEXT`);
            if (!apiTableInfo.some(col => col.name === 'haciendaTributariaApi')) db.exec(`ALTER TABLE api_settings ADD COLUMN haciendaTributariaApi TEXT`);
            if (!apiTableInfo.some(col => col.name === 'ollamaHost')) db.exec(`ALTER TABLE api_settings ADD COLUMN ollamaHost TEXT`);
            if (!apiTableInfo.some(col => col.name === 'defaultModel')) db.exec(`ALTER TABLE api_settings ADD COLUMN defaultModel TEXT`);
        }
        
        const suppliersTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='suppliers'`).get();
        if (!suppliersTable) {
            console.log("MIGRATION: Creating suppliers table.");
            db.exec(`CREATE TABLE suppliers (id TEXT PRIMARY KEY, name TEXT, alias TEXT, email TEXT, phone TEXT);`);
        }

        const erpHeadersTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='erp_order_headers'`).get();
        if (!erpHeadersTable) {
            console.log("MIGRATION: Creating erp_order_headers table.");
            db.exec(`CREATE TABLE erp_order_headers (PEDIDO TEXT PRIMARY KEY, ESTADO TEXT, CLIENTE TEXT, FECHA_PEDIDO TEXT, FECHA_PROMETIDA TEXT, ORDEN_COMPRA TEXT, TOTAL_UNIDADES REAL, MONEDA_PEDIDO TEXT, USUARIO TEXT);`);
        } else {
            const erpHeadersInfo = db.prepare(`PRAGMA table_info(erp_order_headers)`).all() as { name: string }[];
            const erpHeadersColumns = new Set(erpHeadersInfo.map(c => c.name));
             if (!erpHeadersColumns.has('MONEDA_PEDIDO')) db.exec(`ALTER TABLE erp_order_headers ADD COLUMN MONEDA_PEDIDO TEXT`);
             if (!erpHeadersColumns.has('TOTAL_UNIDADES')) db.exec(`ALTER TABLE erp_order_headers ADD COLUMN TOTAL_UNIDADES REAL`);
             if (!erpHeadersColumns.has('USUARIO')) db.exec(`ALTER TABLE erp_order_headers ADD COLUMN USUARIO TEXT`);
        }

        const erpLinesTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='erp_order_lines'`).get();
        if (!erpLinesTable) {
            console.log("MIGRATION: Creating erp_order_lines table.");
            db.exec(`CREATE TABLE erp_order_lines (PEDIDO TEXT, PEDIDO_LINEA INTEGER, ARTICULO TEXT, CANTIDAD_PEDIDA REAL, PRECIO_UNITARIO REAL, PRIMARY KEY (PEDIDO, PEDIDO_LINEA));`);
        }
        
        const erpPoHeadersTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='erp_purchase_order_headers'`).get();
        if (!erpPoHeadersTable) {
            console.log("MIGRATION: Creating erp_purchase_order_headers table.");
            db.exec(`CREATE TABLE erp_purchase_order_headers (ORDEN_COMPRA TEXT PRIMARY KEY, PROVEEDOR TEXT, FECHA_HORA TEXT, ESTADO TEXT, CreatedBy TEXT);`);
        } else {
            const erpPoHeadersInfo = db.prepare(`PRAGMA table_info(erp_purchase_order_headers)`).all() as { name: string }[];
            const erpPoHeadersColumns = new Set(erpPoHeadersInfo.map(c => c.name));
             if (!erpPoHeadersColumns.has('CreatedBy')) db.exec(`ALTER TABLE erp_purchase_order_headers ADD COLUMN CreatedBy TEXT`);
        }

        if (!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='erp_purchase_order_lines'`).get()) {
            console.log("MIGRATION: Creating erp_purchase_order_lines table.");
            db.exec(`CREATE TABLE erp_purchase_order_lines (ORDEN_COMPRA TEXT, ARTICULO TEXT, CANTIDAD_ORDENADA REAL, PRIMARY KEY (ORDEN_COMPRA, ARTICULO));`);
        } else {
             const erpPOLinesInfo = db.prepare(`PRAGMA table_info(erp_purchase_order_lines)`).all() as { name: string }[];
             const erpPOLinesColumns = new Set(erpPOLinesInfo.map(c => c.name));
             if (!erpPOLinesColumns.has('ORDEN_COMPRA')) {
                 // This indicates a legacy structure, so we need to recreate it.
                 console.log("MIGRATION: Recreating erp_purchase_order_lines table with composite primary key.");
                 db.exec(`DROP TABLE erp_purchase_order_lines;`);
                 db.exec(`CREATE TABLE erp_purchase_order_lines (ORDEN_COMPRA TEXT, ARTICULO TEXT, CANTIDAD_ORDENADA REAL, PRIMARY KEY (ORDEN_COMPRA, ARTICULO));`);
             }
        }
        if (!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='stock_settings'`).get()) {
            console.log("MIGRATION: Creating stock_settings table.");
            db.exec(`CREATE TABLE stock_settings (key TEXT PRIMARY KEY, value TEXT);`);
        }
        
        if (!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='erp_invoice_headers'`).get()) {
            console.log("MIGRATION: Creating erp_invoice_headers table.");
            db.exec(`CREATE TABLE erp_invoice_headers (CLIENTE TEXT, NOMBRE_CLIENTE TEXT, TIPO_DOCUMENTO TEXT, FACTURA TEXT PRIMARY KEY, PEDIDO TEXT, FACTURA_ORIGINAL TEXT, FECHA TEXT, FECHA_ENTREGA TEXT, ANULADA TEXT, EMBARCAR_A TEXT, DIRECCION_FACTURA TEXT, OBSERVACIONES TEXT, RUTA TEXT, USUARIO TEXT, USUARIO_ANULA TEXT, ZONA TEXT, VENDEDOR TEXT, REIMPRESO INTEGER);`);
        }
        if (!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='erp_invoice_lines'`).get()) {
            console.log("MIGRATION: Creating erp_invoice_lines table.");
            db.exec(`CREATE TABLE erp_invoice_lines (FACTURA TEXT, TIPO_DOCUMENTO TEXT, LINEA INTEGER, BODEGA TEXT, PEDIDO TEXT, ARTICULO TEXT, ANULADA TEXT, FECHA_FACTURA TEXT, CANTIDAD REAL, PRECIO_UNITARIO REAL, TOTAL_IMPUESTO1 REAL, PRECIO_TOTAL REAL, DESCRIPCION TEXT, DOCUMENTO_ORIGEN TEXT, CANT_DESPACHADA REAL, ES_CANASTA_BASICA TEXT, PRIMARY KEY(FACTURA, TIPO_DOCUMENTO, LINEA));`);
        }

        // New tables from SQL.txt
        if (!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='vendedores'`).get()) {
            console.log("MIGRATION: Creating vendedores table.");
            db.exec(`CREATE TABLE vendedores (VENDEDOR TEXT PRIMARY KEY, NOMBRE TEXT, EMPLEADO TEXT);`);
        }
        if (!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='direcciones_embarque'`).get()) {
            console.log("MIGRATION: Creating direcciones_embarque table.");
            db.exec(`CREATE TABLE direcciones_embarque (CLIENTE TEXT, DIRECCION TEXT, DETALLE_DIRECCION TEXT, DESCRIPCION TEXT, PRIMARY KEY(CLIENTE, DIRECCION));`);
        }
        if (!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='nominas'`).get()) {
            console.log("MIGRATION: Creating nominas table.");
            db.exec(`CREATE TABLE nominas (NOMINA TEXT PRIMARY KEY, DESCRIPCION TEXT, TIPO_NOMINA TEXT);`);
        }
        if (!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='puestos'`).get()) {
            console.log("MIGRATION: Creating puestos table.");
            db.exec(`CREATE TABLE puestos (PUESTO TEXT PRIMARY KEY, DESCRIPCION TEXT, ACTIVO TEXT);`);
        }
        if (!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='departamentos'`).get()) {
            console.log("MIGRATION: Creating departamentos table.");
            db.exec(`CREATE TABLE departamentos (DEPARTAMENTO TEXT PRIMARY KEY, DESCRIPCION TEXT, ACTIVO TEXT);`);
        }
        if (!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='empleados'`).get()) {
            console.log("MIGRATION: Creating empleados table.");
            db.exec(`CREATE TABLE empleados (EMPLEADO TEXT PRIMARY KEY, NOMBRE TEXT, ACTIVO TEXT, DEPARTAMENTO TEXT, PUESTO TEXT, NOMINA TEXT);`);
        }
        if (!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='vehiculos'`).get()) {
            console.log("MIGRATION: Creating vehiculos table.");
            db.exec(`CREATE TABLE vehiculos (placa TEXT PRIMARY KEY, marca TEXT);`);
        }

    } catch (error) {
        console.error("Failed to apply migrations:", error);
    }
}

export async function getUserCount(): Promise<number> {
    try {
        const db = await connectDb();
        const row = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
        return row.count;
    } catch(e) {
        console.error("Error getting user count, likely DB doesn't exist yet.", e);
        return 0;
    }
}

export async function queryLocalDb(sqlQuery: string): Promise<any[]> {
    const mainDb = await connectDb();
    
    const allModuleDbs = DB_MODULES.filter(m => m.id !== 'clic-tools-main');

    for (const mod of allModuleDbs) {
        const dbPath = path.join(process.cwd(), 'dbs', mod.dbFile);
        if (fs.existsSync(dbPath)) {
            mainDb.exec(`ATTACH DATABASE '${dbPath}' AS ${mod.id.replace(/-/g, '_')}`);
        }
    }
    
    try {
        const stmt = mainDb.prepare(sqlQuery);
        if (stmt.reader) {
            return stmt.all();
        } else {
            const result = stmt.run();
            return [{ changes: result.changes, lastInsertRowid: result.lastInsertRowid }];
        }
    } catch (error: any) {
        logError('Error executing local DB query via AI', { query: sqlQuery, error: error.message });
        throw error;
    } finally {
        for (const mod of allModuleDbs) {
            try {
                mainDb.exec(`DETACH DATABASE ${mod.id.replace(/-/g, '_')}`);
            } catch(e) { /* ignore detach errors */ }
        }
    }
}

export async function getCompanySettings(): Promise<Company | null> {
    const db = await connectDb();
    try {
        const settings = db.prepare('SELECT * FROM company_settings WHERE id = 1').get() as any;
        if (settings && 'quoterShowTaxId' in settings) {
            // Manually handle boolean conversion from integer
            settings.quoterShowTaxId = Boolean(settings.quoterShowTaxId);
        }
        // Use JSON.parse(JSON.stringify()) to serialize and deserialize the data, converting Date objects to strings
        return settings ? JSON.parse(JSON.stringify(settings)) : null;
    } catch (error) {
        console.error("Failed to get company settings:", error);
        return null;
    }
}

export async function getPublicUrl(): Promise<{ publicUrl: string | undefined } | null> {
    const db = await connectDb();
    try {
        const settings = db.prepare('SELECT publicUrl FROM company_settings WHERE id = 1').get() as { publicUrl: string | undefined } | undefined;
        return settings || null;
    } catch (error) {
        console.error("Failed to get public URL:", error);
        return null;
    }
}

export async function saveCompanySettings(settings: Company): Promise<void> {
    const db = await connectDb();

    const transaction = db.transaction((settingsToSave) => {
        const currentSettings = db.prepare('SELECT * FROM company_settings WHERE id = 1').get() as Company | undefined;
        // The spread order ensures settingsToSave overwrites currentSettings.
        // It's safe even if currentSettings is null or undefined.
        const finalSettings = { ...(currentSettings || {}), ...settingsToSave };

        // Ensure boolean is saved as number
        (finalSettings as any).quoterShowTaxId = finalSettings.quoterShowTaxId ? 1 : 0;
        
        const stmt = db.prepare(`
            UPDATE company_settings SET 
                name = @name, taxId = @taxId, address = @address, phone = @phone, email = @email,
                logoUrl = @logoUrl, systemName = @systemName, publicUrl = @publicUrl, quotePrefix = @quotePrefix, nextQuoteNumber = @nextQuoteNumber, 
                decimalPlaces = @decimalPlaces, searchDebounceTime = @searchDebounceTime,
                customerFilePath = @customerFilePath, productFilePath = @productFilePath, exemptionFilePath = @exemptionFilePath,
                stockFilePath = @stockFilePath, locationFilePath = @locationFilePath, cabysFilePath = @cabysFilePath,
                supplierFilePath = @supplierFilePath, erpPurchaseOrderHeaderFilePath = @erpPurchaseOrderHeaderFilePath,
                erpPurchaseOrderLineFilePath = @erpPurchaseOrderLineFilePath, erpInvoiceHeaderFilePath = @erpInvoiceHeaderFilePath,
                erpInvoiceLineFilePath = @erpInvoiceLineFilePath,
                importMode = @importMode, lastSyncTimestamp = @lastSyncTimestamp, quoterShowTaxId = @quoterShowTaxId, syncWarningHours = @syncWarningHours
            WHERE id = 1
        `);
        stmt.run(finalSettings);
    });

    try {
        transaction(settings);
    } catch (error) {
        console.error("Failed to save company settings:", error);
        throw new Error("Database transaction failed to save company settings.");
    }
}

export async function getApiSettings(): Promise<ApiSettings | null> {
    const db = await connectDb();
    try {
        return db.prepare('SELECT * FROM api_settings WHERE id = 1').get() as ApiSettings | null;
    } catch (error) {
        console.error("Failed to get api settings:", error);
        return null;
    }
}
//...omitting the rest of the file as it's very long and the error is at the top.
