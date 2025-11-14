/**
 * @fileoverview This hook has been refactored. Its logic now resides in 
 * `src/modules/analytics/hooks/usePurchaseSuggestionsLogic.ts`. This file
 * now simply consumes the centralized logic to maintain compatibility with
 * the `purchase-suggestions` page.
 */
'use client';

import { usePurchaseSuggestionsLogic } from '@/modules/analytics/hooks/usePurchaseSuggestionsLogic';

export { type SortKey } from '@/modules/analytics/hooks/usePurchaseSuggestionsLogic';

export const useRequestSuggestions = () => {
    // This hook now delegates all its functionality to the centralized logic hook.
    // This ensures a single source of truth and eliminates code duplication.
    return usePurchaseSuggestionsLogic();
};

    