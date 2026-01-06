/**
 * @fileoverview HTML templates for Planner module notification events.
 */
'use server';

import type { ProductionOrder } from '@/modules/core/types';
import { format, parseISO } from 'date-fns';
import { getPublicUrl } from '@/modules/core/lib/db';

const getBaseUrl = async () => {
    const companySettings = await getPublicUrl();
    return companySettings?.publicUrl || '';
};

const getPlannerOrderUrl = async (order: ProductionOrder) => {
    const baseUrl = await getBaseUrl();
    return `${baseUrl}/dashboard/planner?search=${order.consecutive}`;
};

const generateBasePlannerTemplate = (title: string, order: ProductionOrder, content: string, url: string) => `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px;">
        <div style="background-color: #f3e8ff; padding: 16px;">
            <h1 style="margin: 0; font-size: 24px; color: #6b21a8;">${title}</h1>
        </div>
        <div style="padding: 16px;">
            <p><strong>Orden de Producción:</strong> ${order.consecutive}</p>
            <p><strong>Cliente:</strong> ${order.customerName} (${order.customerId})</p>
            <p><strong>Producto:</strong> ${order.productDescription} (${order.productId})</p>
            <p><strong>Cantidad Solicitada:</strong> ${order.quantity.toLocaleString('es-CR')}</p>
            <p><strong>Realizado por:</strong> ${order.lastStatusUpdateBy || order.requestedBy}</p>
            <p><strong>Fecha del Evento:</strong> ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;">
            ${content}
            <div style="text-align: center; margin-top: 24px;">
                <a href="${url}" style="background-color: #7e22ce; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Ver Orden</a>
            </div>
        </div>
        <div style="background-color: #f8fafc; padding: 12px; text-align: center; font-size: 12px; color: #64748b;">
            Notificación generada automáticamente por Clic-Tools.
        </div>
    </div>
`;

export const getPlannerOrderCreatedTemplate = async (order: ProductionOrder): Promise<string> => {
    const content = `<p>Se ha creado una nueva orden de producción y está pendiente de revisión.</p>`;
    const url = await getPlannerOrderUrl(order);
    return generateBasePlannerTemplate('Nueva Orden de Producción Creada', order, content, url);
};

export const getPlannerOrderApprovedTemplate = async (order: ProductionOrder): Promise<string> => {
    const content = `<p>La orden de producción ha sido <strong>APROBADA</strong> y está lista para ser puesta en cola de producción.</p>`;
    const url = await getPlannerOrderUrl(order);
    return generateBasePlannerTemplate('Orden de Producción Aprobada', order, content, url);
};

export const getPlannerOrderCompletedTemplate = async (order: ProductionOrder): Promise<string> => {
    const content = `
        <p>La orden de producción ha sido marcada como <strong>COMPLETADA</strong>.</p>
        <ul>
            <li><strong>Cantidad Producida:</strong> ${order.deliveredQuantity?.toLocaleString('es-CR') || 'N/A'}</li>
            <li><strong>Cantidad Defectuosa:</strong> ${order.defectiveQuantity?.toLocaleString('es-CR') || '0'}</li>
        </ul>
    `;
    const url = await getPlannerOrderUrl(order);
    return generateBasePlannerTemplate('Orden de Producción Completada', order, content, url);
};
