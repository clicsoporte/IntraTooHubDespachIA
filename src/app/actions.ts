/**
 * @fileoverview Server Actions for the main entry page.
 * This keeps database-dependent logic on the server, callable from client components.
 */
"use server";

import { getCompanySettings, getUserCount } from "@/modules/core/lib/db";

export async function getInitialPageData() {
  try {
    const [userCount, companyData] = await Promise.all([
      getUserCount(),
      getCompanySettings(),
    ]);
    return {
      hasUsers: userCount > 0,
      companyName: companyData?.systemName || "Clic-Tools",
    };
  } catch (error) {
    console.error("Error checking initial user status:", error);
    // Fallback to login form if there's an error, as it's the most common state.
    return { hasUsers: true, companyName: "Clic-Tools" };
  }
}
