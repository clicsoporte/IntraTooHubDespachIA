/**
 * @fileoverview Server Actions for the Analytics module.
 */
'use server';

import { getCompletedOrdersByDateRange, getPlannerSettings } from '@/modules/planner/lib/db';
import { getAllProducts, getAllRoles, getAllUsers } from '@/modules/core/lib/db';
import type { DateRange, ProductionOrder, PlannerSettings, ProductionOrderHistoryEntry, Product } from '@/modules/core/types';
import { differenceInDays, parseISO } from 'date-fns';
import type { ProductionReportDetail, ProductionReportData } from '../hooks/useProductionReport';
import { logError } from '@/modules/core/lib/logger';

interface ReportFilters {
    productId?: string | null;
    classifications?: string[];
    machineIds?: string[];
}

interface FullProductionReportData {
    reportData: ProductionReportData;
    plannerSettings: PlannerSettings;
}

/**
 * Fetches and processes data for the production report.
 * @param dateRange - The date range to filter production orders.
 * @param filters - Additional filters for product, classification, or machine.
 * @returns A promise that resolves to the structured production report data, including planner settings.
 */
export async function getProductionReportData({ dateRange, filters = {} }: { dateRange: DateRange, filters?: ReportFilters }): Promise<FullProductionReportData> {
    if (!dateRange.from) {
        throw new Error("Date 'from' is required for the production report.");
    }

    const [allOrders, plannerSettings, allProducts] = await Promise.all([
        getCompletedOrdersByDateRange(dateRange),
        getPlannerSettings(),
        getAllProducts(),
    ]);

    const filteredOrders = allOrders.filter((order: ProductionOrder) => {
        if (filters.productId && order.productId !== filters.productId) {
            return false;
        }
        if (filters.machineIds && filters.machineIds.length > 0 && (!order.machineId || !filters.machineIds.includes(order.machineId))) {
            return false;
        }
        if (filters.classifications && filters.classifications.length > 0) {
            const product = allProducts.find((p: Product) => p.id === order.productId);
            if (!product || !product.classification || !filters.classifications.includes(product.classification)) {
                return false;
            }
        }
        return true;
    });

    const details: ProductionReportDetail[] = filteredOrders.map((order: (ProductionOrder & { history: ProductionOrderHistoryEntry[] })) => {
        const history = order.history || [];
        
        const completionEntry = history.find((h: ProductionOrderHistoryEntry) => h.status === 'completed' || h.status === 'received-in-warehouse');
        const startEntry = history.find((h: ProductionOrderHistoryEntry) => h.status === 'in-progress');
        
        const completionDate = completionEntry?.timestamp || null;
        
        let productionDurationDays: number | null = null;
        if (startEntry?.timestamp && completionDate) {
            productionDurationDays = differenceInDays(parseISO(completionDate), parseISO(startEntry.timestamp));
        }

        let totalCycleDays: number | null = null;
        if (order.requestDate && completionDate) {
            totalCycleDays = differenceInDays(parseISO(completionDate), parseISO(order.requestDate));
        }
        
        return {
            ...order,
            completionDate,
            productionDurationDays,
            totalCycleDays,
        };
    });

    return {
        reportData: {
            details: JSON.parse(JSON.stringify(details)), // Ensure plain objects for serialization
        },
        plannerSettings: JSON.parse(JSON.stringify(plannerSettings)),
    };
}

export async function getUserPermissionsReportData() {
    try {
        const [users, roles] = await Promise.all([
            getAllUsers(),
            getAllRoles()
        ]);
        return { users, roles };
    } catch (error: any) {
        logError("Failed to fetch user permissions report data", { error: error.message });
        throw new Error("No se pudieron obtener los datos para el reporte de permisos.");
    }
}
