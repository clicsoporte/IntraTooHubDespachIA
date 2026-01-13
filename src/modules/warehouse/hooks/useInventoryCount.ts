/**
 * @fileoverview New page for physical inventory counting.
 * This component allows users to select a product and location, and input the physically counted quantity.
 * It now supports a dual-mode interface for manual entry and fast QR code scanning.
 */
'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError, logInfo } from '@/modules/core/lib/logger';
import { getLocations, updateInventory } from '@/modules/warehouse/lib/actions';
import { getUserPreferences, saveUserPreferences } from '@/modules/core/lib/db';
import type { Product, WarehouseLocation, User } from '@/modules/core/types';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { SearchInput } from '@/components/ui/search-input';
import { Loader2, Save, List, QrCode } from 'lucide-react';
import { useDebounce } from 'use-debounce';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const renderLocationPathAsString = (locationId: number, locations: WarehouseLocation[]): string => {
    if (!locationId) return '';
    const path: WarehouseLocation[] = [];
    let current: WarehouseLocation | undefined = locations.find(l => l.id === locationId);
    
    while (current) {
        path.unshift(current);
        const parentId = current.parentId;
        if (!parentId) break;
        current = locations.find(l => l.id === parentId);
    }
    return path.map(l => l.name).join(' > ');
};

const getSelectableLocations = (allLocations: WarehouseLocation[]): WarehouseLocation[] => {
    const parentIds = new Set(allLocations.map(l => l.parentId).filter(Boolean));
    return allLocations.filter(l => !parentIds.has(l.id));
};

export function useInventoryCount() {
    const { isAuthorized } = useAuthorization(['warehouse:inventory-count:create']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const { user, companyData, products: authProducts } = useAuth();

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [allLocations, setAllLocations] = useState<WarehouseLocation[]>([]);
    const [selectableLocations, setSelectableLocations] = useState<WarehouseLocation[]>([]);
    
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
    const [countedQuantity, setCountedQuantity] = useState<string>('');

    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
    const [locationSearchTerm, setLocationSearchTerm] = useState('');
    const [isLocationSearchOpen, setIsLocationSearchOpen] = useState(false);

    const [keepLocation, setKeepLocation] = useState(false);
    const [isScannerMode, setIsScannerMode] = useState(false);
    const [scannedData, setScannedData] = useState('');
    
    const quantityInputRef = useRef<HTMLInputElement>(null);
    const scannerInputRef = useRef<HTMLInputElement>(null);


    const [debouncedProductSearch] = useDebounce(productSearchTerm, companyData?.searchDebounceTime ?? 500);
    const [debouncedLocationSearch] = useDebounce(locationSearchTerm, 300);

    const loadInitialData = useCallback(async () => {
        setIsLoading(true);
        try {
            const locs = await getLocations();
            setAllLocations(locs);
            setSelectableLocations(getSelectableLocations(locs));

            if (user) {
                const prefs = await getUserPreferences(user.id, 'inventoryCountPrefs');
                if (prefs && typeof prefs.isScannerMode === 'boolean') {
                    setIsScannerMode(prefs.isScannerMode);
                }
            }
        } catch (error) {
            logError("Failed to load data for inventory count page", { error });
            toast({ title: "Error de Carga", description: "No se pudieron cargar las ubicaciones.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast, user]);
    
    useEffect(() => {
        setTitle("Toma de Inventario Físico");
        if (isAuthorized) {
            loadInitialData();
            if (user) {
                 logInfo(`User ${user.name} accessed Inventory Count page.`);
            }
        }
    }, [setTitle, loadInitialData, isAuthorized, user]);
    
    useEffect(() => {
        if(isScannerMode && scannerInputRef.current) {
            scannerInputRef.current.focus();
        }
    }, [isScannerMode]);

    const productOptions = useMemo(() =>
        debouncedProductSearch.length < 2 ? [] : authProducts
            .filter(p => p.id.toLowerCase().includes(debouncedProductSearch.toLowerCase()) || p.description.toLowerCase().includes(debouncedProductSearch.toLowerCase()))
            .map(p => ({ value: p.id, label: `[${p.id}] ${p.description}` })),
        [authProducts, debouncedProductSearch]
    );

    const locationOptions = useMemo(() => {
        const searchTerm = debouncedLocationSearch.trim().toLowerCase();
        if (searchTerm === '*' || searchTerm === '') {
            return selectableLocations.map(l => ({ value: String(l.id), label: renderLocationPathAsString(l.id, allLocations) }));
        }
        return selectableLocations
            .filter(l => renderLocationPathAsString(l.id, allLocations).toLowerCase().includes(searchTerm))
            .map(l => ({ value: String(l.id), label: renderLocationPathAsString(l.id, allLocations) }));
    }, [allLocations, selectableLocations, debouncedLocationSearch]);

    const handleSelectProduct = (value: string) => {
        setIsProductSearchOpen(false);
        const product = authProducts.find(p => p.id === value);
        if (product) {
            setSelectedProductId(value);
            setProductSearchTerm(`[${product.id}] ${product.description}`);
        }
    };
    
    const handleSelectLocation = (value: string) => {
        setIsLocationSearchOpen(false);
        const location = allLocations.find(l => String(l.id) === value);
        if (location) {
            setSelectedLocationId(value);
            setLocationSearchTerm(renderLocationPathAsString(location.id, allLocations));
        }
    };

    const resetForm = (keepScannerMode = false) => {
        setSelectedProductId(null);
        setProductSearchTerm('');
        setCountedQuantity('');
        setScannedData('');

        if (!keepLocation) {
            setSelectedLocationId(null);
            setLocationSearchTerm('');
        }
        
        if (keepScannerMode && scannerInputRef.current) {
            scannerInputRef.current.focus();
        }
    };

    const handleSaveCount = async () => {
        if (!selectedProductId || !selectedLocationId || countedQuantity === '') {
            toast({ title: "Datos Incompletos", description: "Debe seleccionar un producto, una ubicación e ingresar una cantidad.", variant: "destructive" });
            return;
        }
        if (!user) return;

        const quantity = parseFloat(countedQuantity);
        if (isNaN(quantity)) {
             toast({ title: "Cantidad Inválida", description: "La cantidad debe ser un número.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            await updateInventory(selectedProductId, parseInt(selectedLocationId, 10), quantity, user.id);
            
            toast({ title: "Conteo Guardado", description: `Se registró un inventario de ${quantity} para el producto.` });
            
            resetForm(isScannerMode);

        } catch(e: any) {
            logError('Failed to save inventory count', { error: e.message });
            toast({ title: "Error", description: `No se pudo guardar el conteo. ${e.message}`, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();

        const data = scannedData.trim();
        if (!data.includes('>')) {
            toast({ title: 'Código QR Inválido', description: 'El formato del QR no es el esperado (UbicacionID>ProductoID).', variant: 'destructive'});
            setScannedData('');
            return;
        }

        const [locationIdStr, productId] = data.split('>');
        const locationId = parseInt(locationIdStr, 10);

        const foundLocation = allLocations.find(l => l.id === locationId);
        const foundProduct = authProducts.find(p => p.id === productId);
        
        if (foundLocation && foundProduct) {
            setSelectedLocationId(String(locationId));
            setLocationSearchTerm(renderLocationPathAsString(locationId, allLocations));
            setSelectedProductId(productId);
            setProductSearchTerm(`[${foundProduct.id}] ${foundProduct.description}`);
            
            toast({ title: 'Datos Cargados desde QR', description: 'Por favor, ingresa la cantidad contada.' });
            
            setScannedData('');
            setTimeout(() => quantityInputRef.current?.focus(), 100);

        } else {
            toast({ title: 'Datos no encontrados', description: 'No se encontró la ubicación o el producto en el sistema.', variant: 'destructive'});
            setScannedData('');
        }
    };

    const handleModeChange = async (checked: boolean) => {
        setIsScannerMode(checked);
        if (user) {
            try {
                await saveUserPreferences(user.id, 'inventoryCountPrefs', { isScannerMode: checked });
            } catch (error) {
                logError('Failed to save scanner mode preference', { error });
            }
        }
    };
    
    return {
        isAuthorized,
        state: {
            isLoading,
            isSubmitting,
            selectedProductId,
            selectedLocationId,
            countedQuantity,
            productSearchTerm,
            isProductSearchOpen,
            locationSearchTerm,
            isLocationSearchOpen,
            keepLocation,
            isScannerMode,
            scannedData,
            quantityInputRef,
            scannerInputRef
        },
        actions: {
            handleSelectProduct,
            handleSelectLocation,
            handleSaveCount,
            handleScan,
            setProductSearchTerm,
            setIsProductSearchOpen,
            setLocationSearchTerm,
            setIsLocationSearchOpen,
            setCountedQuantity,
            setScannedData,
            setKeepLocation,
            handleModeChange
        },
        selectors: {
            productOptions,
            locationOptions
        }
    };
}
