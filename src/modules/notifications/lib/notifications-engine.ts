/**
 * @fileoverview The core engine for the configurable notifications system.
 * This file contains the central `triggerNotificationEvent` function.
 */
'use server';

import type { NotificationEventId, NotificationRule } from '@/modules/core/types';
import { getAllNotificationRules } from './db';
import { getEmailSettings, sendEmail } from '@/modules/core/lib/email-service';
import { sendTelegramMessage } from './telegram-service';
import { logError, logInfo, logWarn } from '@/modules/core/lib/logger';

// Import all template generators
import { getDispatchCompletedTemplate } from './templates/dispatch-completed';
import { getReceivingCompletedTemplate, getRackCreatedTemplate } from './templates/warehouse-templates';
import { getPlannerOrderCreatedTemplate, getPlannerOrderApprovedTemplate, getPlannerOrderCompletedTemplate } from './templates/planner-templates';
import { getRequestCreatedTemplate, getRequestApprovedTemplate, getRequestOrderedTemplate } from './templates/requests-templates';

/**
 * Triggers a notification event, finds matching rules, and executes the actions.
 * @param eventId The ID of the event being triggered.
 * @param payload The data associated with the event.
 */
export async function triggerNotificationEvent(eventId: NotificationEventId, payload: any) {
  try {
    const allRules = await getAllNotificationRules();
    const matchingRules = allRules.filter(rule => rule.event === eventId && rule.enabled);

    if (matchingRules.length === 0) {
      return; // No active rules for this event
    }

    logInfo(`Triggering event '${eventId}' with ${matchingRules.length} matching rules.`);

    for (const rule of matchingRules) {
      try {
        await executeRuleAction(rule, payload);
      } catch (error: any) {
        logError(`Failed to execute action for rule '${rule.name}'`, { ruleId: rule.id, error: error.message });
      }
    }
  } catch (error: any) {
    logError(`Error during triggerNotificationEvent for event '${eventId}'`, { error: error.message });
  }
}

/**
 * Executes the action defined in a notification rule.
 * @param rule The notification rule to execute.
 * @param payload The data payload from the event.
 */
async function executeRuleAction(rule: NotificationRule, payload: any) {
  const { subject, body } = await generateContent(rule, payload);

  if (rule.action === 'sendEmail') {
    const emailSettings = await getEmailSettings();
    if (!emailSettings.smtpHost) {
      logWarn('Email action skipped: SMTP not configured.', { ruleName: rule.name });
      return;
    }
    await sendEmail({
      to: rule.recipients.join(','),
      subject,
      html: body,
    });
  } else if (rule.action === 'sendTelegram') {
    await sendTelegramMessage(body);
  }
}

/**
 * Generates the subject and body content for a notification based on the event.
 * @param rule The notification rule.
 * @param payload The event data.
 * @returns An object with the subject and HTML body.
 */
async function generateContent(rule: NotificationRule, payload: any): Promise<{ subject: string; body: string }> {
  const defaultSubject = `Notificación del Sistema: ${rule.name}`;
  let subject = rule.subject || defaultSubject;
  let body = `<p>Se ha activado el evento: ${rule.event}</p><pre>${JSON.stringify(payload, null, 2)}</pre>`;

  // --- Template Dispatcher ---
  switch (rule.event) {
    // Warehouse
    case 'onDispatchCompleted':
      body = getDispatchCompletedTemplate(payload);
      subject = subject.replace('[DOCUMENT_ID]', payload.documentId);
      break;
    case 'onReceivingCompleted':
        body = await getReceivingCompletedTemplate(payload);
        subject = subject.replace('[PRODUCT_ID]', payload.productId);
        break;
    case 'onRackCreated':
        body = await getRackCreatedTemplate(payload);
        subject = subject.replace('[RACK_NAME]', payload.rack.name);
        break;
    
    // Planner
    case 'onPlannerOrderCreated':
        body = await getPlannerOrderCreatedTemplate(payload);
        subject = subject.replace('[CONSECUTIVE]', payload.consecutive).replace('[CLIENT_NAME]', payload.customerName);
        break;
    case 'onPlannerOrderApproved':
        body = await getPlannerOrderApprovedTemplate(payload);
        subject = subject.replace('[CONSECUTIVE]', payload.consecutive).replace('[CLIENT_NAME]', payload.customerName);
        break;
    case 'onPlannerOrderCompleted':
        body = await getPlannerOrderCompletedTemplate(payload);
        subject = subject.replace('[CONSECUTIVE]', payload.consecutive).replace('[CLIENT_NAME]', payload.customerName);
        break;

    // Requests
    case 'onRequestCreated':
        body = await getRequestCreatedTemplate(payload);
        subject = subject.replace('[CONSECUTIVE]', payload.consecutive).replace('[ITEM_DESCRIPTION]', payload.itemDescription);
        break;
    case 'onRequestApproved':
        body = await getRequestApprovedTemplate(payload);
        subject = subject.replace('[CONSECUTIVE]', payload.consecutive).replace('[ITEM_DESCRIPTION]', payload.itemDescription);
        break;
    case 'onRequestOrdered':
        body = await getRequestOrderedTemplate(payload);
        subject = subject.replace('[CONSECUTIVE]', payload.consecutive).replace('[ITEM_DESCRIPTION]', payload.itemDescription);
        break;
  }

  return { subject, body };
}
