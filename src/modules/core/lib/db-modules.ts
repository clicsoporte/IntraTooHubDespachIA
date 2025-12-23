/**
 * @fileoverview This file acts as the central registry for all database modules.
 * It defines the static configuration for each module, including its database file,
 * initialization function, and migration function. This structure allows the core
 * `connectDb` function to be completely agnostic of any specific module, promoting
 * true modularity and decoupling. This file should only contain configuration and
 * import function signatures, not implementations, to avoid circular dependencies.
 */

import type { DatabaseModule } from '@/modules/core/types';

// Import function signatures from their respective modules
import { initializePlannerDb, runPlannerMigrations } from '../../planner/lib/db';
import { initializeRequestsDb, runRequestMigrations } from '../../requests/lib/db';
import { initializeWarehouseDb, runWarehouseMigrations } from '../../warehouse/lib/db';
import { initializeCostAssistantDb, runCostAssistantMigrations } from '../../cost-assistant/lib/db';
import { initializeMainDatabase, runMainDbMigrations } from "./db";

// Import schema definitions
import { plannerSchema } from '../../planner/lib/schema';
import { requestSchema } from '../../requests/lib/schema';
import { warehouseSchema } from '../../warehouse/lib/schema';
import { costAssistantSchema } from '../../cost-assistant/lib/schema';

/**
 * Acts as a registry for all database modules in the application.
 */
export const DB_MODULES: DatabaseModule[] = [
    { 
        id: 'clic-tools-main', 
        name: 'Clic-Tools (Sistema Principal)', 
        dbFile: 'intratool.db', 
        initFn: initializeMainDatabase, 
        migrationFn: runMainDbMigrations,
        schema: {
            'users': ['id', 'name', 'email', 'password', 'phone', 'whatsapp', 'erpAlias', 'avatar', 'role', 'recentActivity', 'securityQuestion', 'securityAnswer', 'forcePasswordChange'],
            'roles': ['id', 'name', 'permissions'],
            'company_settings': ['id', 'name', 'taxId', 'address', 'phone', 'email', 'logoUrl', 'systemName', 'quotePrefix', 'nextQuoteNumber', 'decimalPlaces', 'quoterShowTaxId', 'searchDebounceTime', 'syncWarningHours', 'lastSyncTimestamp', 'importMode', 'customerFilePath', 'productFilePath', 'exemptionFilePath', 'stockFilePath', 'locationFilePath', 'cabysFilePath', 'supplierFilePath', 'erpPurchaseOrderHeaderFilePath', 'erpPurchaseOrderLineFilePath'],
            'logs': ['id', 'timestamp', 'type', 'message', 'details'],
            'api_settings': ['id', 'exchangeRateApi', 'haciendaExemptionApi', 'haciendaTributariaApi'],
            'customers': ['id', 'name', 'address', 'phone', 'taxId', 'currency', 'creditLimit', 'paymentCondition', 'salesperson', 'active', 'email', 'electronicDocEmail'],
            'products': ['id', 'description', 'classification', 'lastEntry', 'active', 'notes', 'unit', 'isBasicGood', 'cabys'],
            'exemptions': ['code', 'description', 'customer', 'authNumber', 'startDate', 'endDate', 'percentage', 'docType', 'institutionName', 'institutionCode'],
            'quote_drafts': ['id', 'createdAt', 'userId', 'customerId', 'customerDetails', 'lines', 'totals', 'notes', 'currency', 'exchangeRate', 'purchaseOrderNumber', 'deliveryAddress', 'deliveryDate', 'sellerName', 'sellerType', 'quoteDate', 'validUntilDate', 'paymentTerms', 'creditDays'],
            'exemption_laws': ['docType', 'institutionName', 'authNumber'],
            'cabys_catalog': ['code', 'description', 'taxRate'],
            'stock': ['itemId', 'stockByWarehouse', 'totalStock'],
            'sql_config': ['key', 'value'],
            'import_queries': ['type', 'query'],
            'suggestions': ['id', 'content', 'userId', 'userName', 'isRead', 'timestamp'],
            'user_preferences': ['userId', 'key', 'value'],
            'notifications': ['id', 'userId', 'message', 'href', 'isRead', 'timestamp', 'entityId', 'entityType', 'taskType'],
            'email_settings': ['key', 'value'],
            'suppliers': ['id', 'name', 'alias', 'email', 'phone'],
            'erp_order_headers': ['PEDIDO', 'ESTADO', 'CLIENTE', 'FECHA_PEDIDO', 'FECHA_PROMETIDA', 'ORDEN_COMPRA', 'TOTAL_UNIDADES', 'MONEDA_PEDIDO', 'USUARIO'],
            'erp_order_lines': ['PEDIDO', 'PEDIDO_LINEA', 'ARTICULO', 'CANTIDAD_PEDIDA', 'PRECIO_UNITARIO'],
            'erp_purchase_order_headers': ['ORDEN_COMPRA', 'PROVEEDOR', 'FECHA_HORA', 'ESTADO', 'CreatedBy'],
            'erp_purchase_order_lines': ['ORDEN_COMPRA', 'ARTICULO', 'CANTIDAD_ORDENADA'],
        }
    },
    { id: 'purchase-requests', name: 'Solicitud de Compra', dbFile: 'requests.db', initFn: initializeRequestsDb, migrationFn: runRequestMigrations, schema: requestSchema },
    { id: 'production-planner', name: 'Planificador de Producción', dbFile: 'planner.db', initFn: initializePlannerDb, migrationFn: runPlannerMigrations, schema: plannerSchema },
    { id: 'warehouse-management', name: 'Gestión de Almacenes', dbFile: 'warehouse.db', initFn: initializeWarehouseDb, migrationFn: runWarehouseMigrations, schema: warehouseSchema },
    { id: 'cost-assistant', name: 'Asistente de Costos', dbFile: 'cost_assistant.db', initFn: initializeCostAssistantDb, migrationFn: runCostAssistantMigrations, schema: costAssistantSchema },
];
