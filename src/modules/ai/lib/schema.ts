/**
 * @fileoverview Defines the expected database schema for the AI module.
 * This is used by the central database audit system to verify integrity.
 */

import type { ExpectedSchema } from '@/modules/core/types';

export const aiDbSchema: ExpectedSchema = {
    'knowledge_base_paths': ['id', 'name', 'path'],
    'chat_history': ['id', 'sessionId', 'userId', 'role', 'content', 'timestamp'],
};
