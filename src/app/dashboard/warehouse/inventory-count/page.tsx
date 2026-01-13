/**
 * @fileoverview New page for physical inventory counting.
 * This component allows users to select a product and location, and input the physically counted quantity.
 * It now supports a dual-mode interface for manual entry and fast QR code scanning.
 */
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Save, List, QrCode } from 'lucide-react';
import { useInventoryCount } from '@/modules/warehouse/hooks/useInventoryCount';
import { SearchInput } from '@/components/ui/search-input';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';

export default function InventoryCountPage() {
    const {
        isAuthorized,
        state,
        actions,
        selectors,
    } = useInventoryCount();

    const {
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
    } = state;

    if (isAuthorized === false) {
        return null;
    }
    
    if (isLoading) {
        return (
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                 <Skeleton className="h-96 w-full max-w-2xl mx-auto" />
            </main>
        )
    }

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-2xl space-y-8">
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle>Toma de Inventario Físico</CardTitle>
                                <CardDescription>Registra la cantidad física de un producto en una ubicación.</CardDescription>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Label htmlFor="scanner-mode">Modo Escáner</Label>
                                <Switch id="scanner-mode" checked={isScannerMode} onCheckedChange={actions.handleModeChange} />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {isScannerMode ? (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-lg font-semibold" htmlFor="scanner-input">1. Escanear Etiqueta de Rack</Label>
                                    <Input
                                        ref={scannerInputRef}
                                        id="scanner-input"
                                        value={scannedData}
                                        onChange={e => actions.setScannedData(e.target.value)}
                                        onKeyDown={actions.handleScan}
                                        placeholder="Esperando escaneo de QR..."
                                        className="h-12 text-lg"
                                        autoFocus
                                    />
                                </div>
                                {(selectedLocationId || selectedProductId) && (
                                     <Alert>
                                        <QrCode className="h-4 w-4" />
                                        <AlertTitle>Datos Cargados</AlertTitle>
                                        <AlertDescription>
                                            <p><strong>Ubicación:</strong> {locationSearchTerm}</p>
                                            <p><strong>Producto:</strong> {productSearchTerm}</p>
                                        </AlertDescription>
                                    </Alert>
                                )}
                                <div className="space-y-2">
                                    <Label className="text-lg font-semibold" htmlFor="quantity-scanner">2. Cantidad Contada</Label>
                                    <Input
                                        ref={quantityInputRef}
                                        id="quantity-scanner"
                                        type="number"
                                        value={countedQuantity}
                                        onChange={e => actions.setCountedQuantity(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') actions.handleSaveCount(); }}
                                        placeholder="0"
                                        className="text-2xl h-16 text-center font-bold"
                                    />
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    <Label>1. Seleccione una Ubicación</Label>
                                    <div className="flex items-center gap-2">
                                        <SearchInput options={selectors.locationOptions} onSelect={actions.handleSelectLocation} value={locationSearchTerm} onValueChange={actions.setLocationSearchTerm} placeholder="Buscar... ('*' o vacío para ver todas)" open={isLocationSearchOpen} onOpenChange={actions.setIsLocationSearchOpen} />
                                        <Button type="button" variant="outline" size="icon" onClick={() => {actions.setLocationSearchTerm('*'); actions.setIsLocationSearchOpen(true);}}>
                                            <List className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="flex items-center space-x-2 pt-2">
                                        <Checkbox id="keep-location" checked={keepLocation} onCheckedChange={(checked) => actions.setKeepLocation(checked as boolean)} />
                                        <Label htmlFor="keep-location" className="text-sm font-normal">Mantener Ubicación Seleccionada</Label>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>2. Seleccione un Producto</Label>
                                    <SearchInput options={selectors.productOptions} onSelect={actions.handleSelectProduct} value={productSearchTerm} onValueChange={actions.setProductSearchTerm} placeholder="Buscar producto..." open={isProductSearchOpen} onOpenChange={actions.setIsProductSearchOpen} />
                                </div>
                                <div className="space-y-2">
                                    <Label>3. Ingrese la Cantidad Contada</Label>
                                    <Input type="number" value={countedQuantity} onChange={(e) => actions.setCountedQuantity(e.target.value)} placeholder="0" className="text-lg h-12" />
                                </div>
                            </>
                        )}
                    </CardContent>
                    <CardFooter>
                        <Button onClick={actions.handleSaveCount} disabled={isSubmitting || !selectedProductId || !selectedLocationId || countedQuantity === ''}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Save className="mr-2 h-4 w-4" />
                            Guardar Conteo
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </main>
    );
}
