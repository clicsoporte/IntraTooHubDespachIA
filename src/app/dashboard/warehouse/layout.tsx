
/**
 * @fileoverview Layout for the Warehouse section.
 * This layout ensures that any child pages within the /warehouse route
 * (like /search and /assign) have access to the main dashboard context.
 */
'use client';

import type { ReactNode } from "react";

export default function WarehouseLayout({
  children,
}: {
  children: ReactNode;
}) {
    return <>{children}</>;
}
