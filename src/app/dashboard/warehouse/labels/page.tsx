/**
 * @fileoverview New page for the central Label Printing Center.
 * This component allows users to print labels in bulk for warehouse locations with advanced filtering.
 */
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Printer, Search, List, FilterX } from 'lucide-react';
import { useLabelCenter } from '@/modules/warehouse/hooks/useLabelCenter';
import { SearchInput } from '@/components/ui/search-input';
import { MultiSelectFilter } from '@/components/ui/multi-select-filter';
import { Label } from '@/components/ui/label';

export default function LabelCenterPage() {
    const {
        isAuthorized,
        state,
        actions,
        selectors,
    } = useLabelCenter();

    if (state.isLoading) {
        return (
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                 <Skeleton className="h-96 w-full max-w-4xl mx-auto" />
            </main>
        )
    }

    if (isAuthorized === false) {
        return (
             <main className="flex-1 p-4 md:p-6 lg:p-8">
                <Card className="mx-auto max-w-xl">
                    <CardHeader>
                        <CardTitle>Acceso Denegado</CardTitle>
                        <CardDescription>No tienes permiso para acceder al centro de impresión de etiquetas.</CardDescription>
                    </CardHeader>
                </Card>
            </main>
        );
    }

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-4xl space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Centro de Impresión de Etiquetas de Ubicación</CardTitle>
                        <CardDescription>
                            Selecciona una ubicación raíz (como un Rack) y luego filtra por niveles, posiciones o fondos para generar etiquetas en bloque.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="root-location-search" className="font-semibold text-lg">1. Selecciona una Ubicación Raíz</Label>
                            <div className="flex items-center gap-2">
                                <SearchInput
                                    options={selectors.rootLocationOptions}
                                    onSelect={actions.handleSelectRootLocation}
                                    value={state.rootLocationSearch}
                                    onValueChange={actions.setRootLocationSearch}
                                    open={state.isRootLocationSearchOpen}
                                    onOpenChange={actions.setIsRootLocationSearchOpen}
                                    placeholder="Buscar por nombre o código del Rack/Pasillo..."
                                />
                                <Button type="button" variant="outline" size="icon" onClick={() => { actions.setRootLocationSearch('*'); actions.setIsRootLocationSearchOpen(true); }}>
                                    <List className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {state.selectedRootLocationId && (
                            <div className="space-y-4 pt-4 border-t">
                                <h3 className="font-semibold text-lg">2. Filtra las Ubicaciones a Imprimir</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                     <MultiSelectFilter
                                        title="Niveles"
                                        options={selectors.levelOptions}
                                        selectedValues={state.levelFilter}
                                        onSelectedChange={actions.setLevelFilter}
                                    />
                                    <MultiSelectFilter
                                        title="Posiciones"
                                        options={selectors.positionOptions}
                                        selectedValues={state.positionFilter}
                                        onSelectedChange={actions.setPositionFilter}
                                    />
                                     <MultiSelectFilter
                                        title="Fondos"
                                        options={selectors.depthOptions}
                                        selectedValues={state.depthFilter}
                                        onSelectedChange={actions.setDepthFilter}
                                    />
                                </div>
                                 <div className="flex items-center justify-end">
                                    <Button variant="ghost" onClick={actions.handleClearFilters}>
                                        <FilterX className="mr-2 h-4 w-4"/> Limpiar Filtros
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                    {state.selectedRootLocationId && (
                        <CardFooter className="flex-col items-start gap-4">
                            <div className="p-4 rounded-md bg-muted w-full">
                                <h4 className="font-semibold">Resumen de Impresión</h4>
                                <p className="text-sm text-muted-foreground">
                                    Se generará <span className="font-bold text-primary">{selectors.filteredLocations.length}</span> etiqueta(s) para la ubicación <span className="font-medium">{selectors.selectedRootLocationName}</span> con los filtros aplicados.
                                </p>
                            </div>
                            <Button onClick={actions.handleGenerateLabels} disabled={state.isSubmitting || selectors.filteredLocations.length === 0}>
                                {state.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                <Printer className="mr-2 h-4 w-4"/>
                                Generar {selectors.filteredLocations.length > 0 ? `${selectors.filteredLocations.length} Etiqueta(s)` : 'Etiquetas'}
                            </Button>
                        </CardFooter>
                    )}
                </Card>
            </div>
        </main>
    );
}
