/**
 * @fileoverview Defines the expected database schema for the AI module.
 * This is used by the central database audit system to verify integrity.
 */

import type { ExpectedSchema } from '@/modules/core/types';

export const aiDbSchema: ExpectedSchema = {
    'ai_knowledge_base': ['id', 'topic', 'content', 'scope', 'created_by', 'author_role', 'created_at', 'valid_from', 'valid_until', 'priority'],
    'chat_history': ['id', 'sessionId', 'userId', 'role', 'content', 'timestamp'],
    'knowledge_base_paths': ['id', 'name', 'path'],
};
