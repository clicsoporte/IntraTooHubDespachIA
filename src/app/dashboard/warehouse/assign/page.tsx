/**
 * @fileoverview This page is deprecated and now redirects to the new inventory count page.
 * The functionality of assigning items is now integrated into the inventory count process.
 */
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function DeprecatedAssignPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/dashboard/warehouse/inventory-count');
    }, [router]);
    
    return (
         <div className="flex h-screen w-full items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4 text-muted-foreground">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p>Redirigiendo a la nueva página de Toma de Inventario...</p>
            </div>
        </div>
    );
}
