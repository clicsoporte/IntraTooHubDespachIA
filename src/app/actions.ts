/**
 * @fileoverview Server Actions for the main entry page.
 * This keeps database-dependent logic on the server, callable from client components.
 */
"use server";

import { getCompanySettings, getUserCount } from "@/modules/core/lib/db";
import { runScheduledTasks } from "@/lib/cron-runner";
import { logError } from "@/modules/core/lib/logger";

// This flag ensures that the cron jobs are only initialized once per server start.
let cronInitialized = false;

export async function getInitialPageData(): Promise<{ hasUsers: boolean, companyName: string } | { error: string }> {
  // --- START CRON JOBS ---
  // This logic ensures that the scheduled tasks are only started once when the server
  // receives its first request, preventing multiple initializations during development
  // or in a serverless environment.
  if (!cronInitialized) {
    console.log("Server action triggered. Initializing cron runner...");
    await runScheduledTasks();
    cronInitialized = true;
  }
  // --- END CRON JOBS ---
  
  try {
    const [userCount, companyData] = await Promise.all([
      getUserCount(),
      getCompanySettings(),
    ]);
    return {
      hasUsers: userCount > 0,
      companyName: companyData?.systemName || "Clic-Tools",
    };
  } catch (error: any) {
    logError("Critical error on initial page data fetch", { error: error.message, stack: error.stack });
    // Return a structured error object for the client to handle
    return { error: `No se pudo conectar a la base de datos: ${error.message}` };
  }
}
