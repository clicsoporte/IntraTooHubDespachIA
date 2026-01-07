/**
 * @fileoverview Page for the Dispatch Classifier.
 * This component allows logistics managers to view unassigned ERP documents (invoices, etc.)
 * and assign them to specific dispatch containers (routes) using an efficient table-based interface.
 * It also provides a separate view for re-ordering documents within a container.
 */
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { getContainers, getUnassignedDocuments, getAssignmentsForContainer, assignDocumentsToContainer, updateAssignmentOrder, unassignDocumentFromContainer } from '@/modules/warehouse/lib/actions';
import { getInvoicesByIds } from '@/modules/core/lib/db';
import type { DispatchContainer, ErpInvoiceHeader, DispatchAssignment } from '@/modules/core/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Search, CalendarIcon, Truck, AlertTriangle, List, Check, ChevronsUpDown, Send, Trash2, GripVertical } from 'lucide-react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, parseISO, startOfDay, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';

const DraggableItem = ({ item, erpHeaders, index, onUnassign }: { item: DispatchAssignment, erpHeaders: Map<string, ErpInvoiceHeader>, index: number, onUnassign: (assignment: DispatchAssignment) => void }) => {
    const erpHeader = erpHeaders.get(item.documentId);
    const isCancelled = erpHeader?.ANULADA === 'S';

    return (
        <Draggable draggableId={item.documentId} index={index}>
            {(provided) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={cn(
                        "p-3 mb-2 rounded-md shadow-sm border flex items-center justify-between",
                        isCancelled ? 'bg-destructive/10 border-destructive' : 'bg-card'
                    )}
                >
                    <div className="flex items-center gap-2">
                        <div {...provided.dragHandleProps} className="cursor-grab p-1">
                            <GripVertical className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="font-semibold">{item.documentId}</p>
                            <p className="text-sm text-muted-foreground">{item.clientName}</p>
                            {isCancelled && <Badge variant="destructive" className="mt-1"><AlertTriangle className="mr-1 h-3 w-3" /> ANULADA</Badge>}
                        </div>
                    </div>
                     <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onUnassign(item)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </div>
            )}
        </Draggable>
    );
};

type EnrichedErpHeader = ErpInvoiceHeader & { suggestedContainerId?: string };

export default function DispatchClassifierPage() {
    useAuthorization(['warehouse:dispatch-classifier:use']);
    const { setTitle } = usePageTitle();
    const { user } = useAuth();
    const { toast } = useToast();

    const [containers, setContainers] = useState<DispatchContainer[]>([]);
    const [assignments, setAssignments] = useState<Record<string, DispatchAssignment[]>>({});
    const [unassignedDocs, setUnassignedDocs] = useState<EnrichedErpHeader[]>([]);
    const [erpHeaders, setErpHeaders] = useState<Map<string, ErpInvoiceHeader>>(new Map());
    
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingDocs, setIsLoadingDocs] = useState(false);
    
    const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfDay(subDays(new Date(), 7)), to: new Date() });
    const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(new Set());
    const [bulkAssignContainerId, setBulkAssignContainerId] = useState<string>('');
    
    useEffect(() => {
        setTitle("Clasificador de Despachos");
        const loadInitialData = async () => {
            setIsLoading(true);
            try {
                const fetchedContainers = await getContainers();
                setContainers(fetchedContainers);

                const assignmentsByContainer: Record<string, DispatchAssignment[]> = {};
                const allDocumentIds: string[] = [];

                for (const container of fetchedContainers) {
                    const containerAssignments = await getAssignmentsForContainer(container.id!);
                    assignmentsByContainer[container.id!] = containerAssignments;
                    allDocumentIds.push(...containerAssignments.map(a => a.documentId));
                }
                
                if (allDocumentIds.length > 0) {
                    const invoiceDetails = await getInvoicesByIds(allDocumentIds);
                    const headersMap = new Map<string, ErpInvoiceHeader>(invoiceDetails.map((h: ErpInvoiceHeader) => [h.FACTURA, h]));
                    setErpHeaders(headersMap);
                }

                setAssignments(assignmentsByContainer);
            } catch (error: any) {
                toast({ title: 'Error', description: `No se pudieron cargar los datos iniciales: ${error.message}`, variant: 'destructive' });
            } finally {
                setIsLoading(false);
            }
        };
        loadInitialData();
    }, [setTitle, toast]);

    const handleFetchDocuments = useCallback(async () => {
        if (!dateRange?.from) {
            toast({ title: "Fecha requerida", description: "Por favor, selecciona un rango de fechas.", variant: "destructive" });
            return;
        }
        setIsLoadingDocs(true);
        try {
            const docs = await getUnassignedDocuments(dateRange);
            const enrichedDocs = docs.map(doc => {
                const matchingContainer = containers.find(c => c.name.toLowerCase() === doc.RUTA?.toLowerCase());
                return { ...doc, suggestedContainerId: matchingContainer ? String(matchingContainer.id) : undefined };
            });
            setUnassignedDocs(enrichedDocs);
        } catch (error: any) {
             toast({ title: 'Error', description: `No se pudieron cargar los documentos del ERP: ${error.message}`, variant: 'destructive' });
        } finally {
            setIsLoadingDocs(false);
        }
    }, [dateRange, toast, containers]);

    const handleOnDragEnd = async (result: DropResult) => {
        const { source, destination } = result;
        if (!destination) return;
    
        const sourceId = source.droppableId;
        const destinationId = destination.droppableId;
    
        if (sourceId === destinationId) {
            // Re-ordering within the same container
            const containerId = sourceId;
            const items = Array.from(assignments[containerId] || []);
            const [reorderedItem] = items.splice(source.index, 1);
            
            if (!reorderedItem) return; // Safeguard

            items.splice(destination.index, 0, reorderedItem);
            
            setAssignments(prev => ({ ...prev, [containerId]: items }));
            
            await updateAssignmentOrder(Number(containerId), items.map(item => item.documentId));

        } else {
            // Moving between containers
            const sourceItems = Array.from(assignments[sourceId] || []);
            const [movedItem] = sourceItems.splice(source.index, 1);
            if (!movedItem) return;

            const destinationItems = Array.from(assignments[destinationId] || []);
            destinationItems.splice(destination.index, 0, movedItem);

            setAssignments(prev => ({
                ...prev,
                [sourceId]: sourceItems,
                [destinationId]: destinationItems
            }));

            await updateAssignmentOrder(Number(destinationId), destinationItems.map(item => item.documentId));
            await unassignDocumentFromContainer(movedItem.id).then(() => assignDocumentsToContainer([movedItem.documentId], Number(destinationId), user?.name || ''));
        }
    };

    const handleSingleAssign = useCallback(async (documentId: string, containerId: string | null) => {
        if (!user) return;
        if (containerId === null) { // Unassigning
            const currentAssignment = Object.values(assignments).flat().find(a => a.documentId === documentId);
            if (currentAssignment) {
                await unassignDocumentFromContainer(currentAssignment.id);
                setAssignments(prev => {
                    const newAssignments = {...prev};
                    newAssignments[currentAssignment.containerId] = newAssignments[currentAssignment.containerId].filter(a => a.id !== currentAssignment.id);
                    return newAssignments;
                });
                handleFetchDocuments(); // Refresh unassigned list
            }
        } else { // Assigning
            await assignDocumentsToContainer([documentId], Number(containerId), user.name);
            const docToMove = unassignedDocs.find(d => d.FACTURA === documentId);
            if (docToMove) {
                setUnassignedDocs(prev => prev.filter(d => d.FACTURA !== documentId));
                const newAssignment: DispatchAssignment = {
                    id: -1, // Temporary
                    containerId: Number(containerId),
                    documentId: docToMove.FACTURA, documentType: docToMove.TIPO_DOCUMENTO,
                    documentDate: typeof docToMove.FECHA === 'string' ? docToMove.FECHA : (docToMove.FECHA as Date).toISOString(),
                    clientId: docToMove.CLIENTE, clientName: docToMove.NOMBRE_CLIENTE,
                    assignedBy: user.name, assignedAt: new Date().toISOString(),
                    sortOrder: (assignments[containerId]?.length || 0) + 1, status: 'pending',
                };
                setAssignments(prev => ({ ...prev, [containerId]: [...(prev[containerId] || []), newAssignment] }));
            }
        }
    }, [user, assignments, unassignedDocs, handleFetchDocuments]);
    
    const handleBulkAssign = useCallback(async () => {
        if (!user || selectedDocumentIds.size === 0 || !bulkAssignContainerId) {
            toast({ title: 'Selección requerida', description: 'Selecciona al menos un documento y un contenedor de destino.', variant: 'destructive'});
            return;
        }
        await assignDocumentsToContainer(Array.from(selectedDocumentIds), Number(bulkAssignContainerId), user.name);
        
        const docsToMove = unassignedDocs.filter(d => selectedDocumentIds.has(d.FACTURA));
        const newAssignments: DispatchAssignment[] = docsToMove.map(doc => ({
            id: -1, containerId: Number(bulkAssignContainerId),
            documentId: doc.FACTURA, documentType: doc.TIPO_DOCUMENTO,
            documentDate: typeof doc.FECHA === 'string' ? doc.FECHA : (doc.FECHA as Date).toISOString(),
            clientId: doc.CLIENTE, clientName: doc.NOMBRE_CLIENTE,
            assignedBy: user.name, assignedAt: new Date().toISOString(),
            sortOrder: 0, status: 'pending',
        }));

        setUnassignedDocs(prev => prev.filter(d => !selectedDocumentIds.has(d.FACTURA)));
        setAssignments(prev => ({...prev, [bulkAssignContainerId]: [...(prev[bulkAssignContainerId] || []), ...newAssignments] }));
        setSelectedDocumentIds(new Set());
        setBulkAssignContainerId('');
        toast({ title: 'Asignación Masiva Completa', description: `${selectedDocumentIds.size} documentos asignados.`});
    }, [user, selectedDocumentIds, bulkAssignContainerId, unassignedDocs, toast]);

    const handleUnassign = async (assignment: DispatchAssignment) => {
        await unassignDocumentFromContainer(assignment.id);
        setAssignments(prev => {
            const newAssignments = {...prev};
            newAssignments[assignment.containerId] = newAssignments[assignment.containerId].filter(a => a.id !== assignment.id);
            return newAssignments;
        });
        handleFetchDocuments();
        toast({ title: 'Documento Desasignado', variant: 'destructive'});
    };
    
    if (isLoading) {
        return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    const allAssignedDocs = Object.values(assignments).flat();

    const getDocRow = (docId: string) => {
        const unassignedVersion = unassignedDocs.find(d => d.FACTURA === docId);
        if (unassignedVersion) return unassignedVersion;
        
        const assignedVersion = allAssignedDocs.find(a => a.documentId === docId);
        if (assignedVersion) {
            return { FACTURA: assignedVersion.documentId, NOMBRE_CLIENTE: assignedVersion.clientName, RUTA: 'Asignado' };
        }
        return { FACTURA: docId, NOMBRE_CLIENTE: 'N/A', RUTA: 'N/A' };
    };
    
    const combinedDocs = Array.from(new Set([...unassignedDocs.map(d => d.FACTURA), ...allAssignedDocs.map(a => a.documentId)]))
        .map(getDocRow)
        .sort((a,b) => a.FACTURA.localeCompare(b.FACTURA));


    return (
        <div className="flex flex-col h-screen bg-muted/30">
            <header className="p-4 border-b bg-background">
                <h1 className="text-2xl font-bold">Clasificador de Despachos</h1>
                <p className="text-muted-foreground">Asigna facturas a contenedores y luego ordénalas según la ruta de entrega.</p>
            </header>
            <Tabs defaultValue="assign" className="flex-1 flex flex-col p-4 gap-4">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="assign">Asignar Documentos</TabsTrigger>
                    <TabsTrigger value="order">Ordenar Contenedores</TabsTrigger>
                </TabsList>
                <TabsContent value="assign" className="flex-1 overflow-auto">
                     <Card>
                        <CardHeader>
                            <CardTitle>Paso 1: Cargar Documentos del ERP</CardTitle>
                            <div className="flex flex-col sm:flex-row gap-4 items-center pt-2">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button id="date" variant={'outline'} className={cn('w-full sm:w-[280px] justify-start text-left font-normal', !dateRange && 'text-muted-foreground')}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {dateRange?.from ? (dateRange.to ? (`${format(dateRange.from, 'LLL dd, y', { locale: es })} - ${format(dateRange.to, 'LLL dd, y', { locale: es })}`) : format(dateRange.from, 'LLL dd, y', { locale: es })) : (<span>Rango de Fechas</span>)}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={(range) => setDateRange(range)} numberOfMonths={2} locale={es} /></PopoverContent>
                                </Popover>
                                <Button onClick={handleFetchDocuments} disabled={isLoadingDocs} className="w-full sm:w-auto">
                                    {isLoadingDocs ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                                    Buscar Documentos Pendientes
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                             <div className="flex items-center gap-4 mb-4 p-2 border rounded-lg">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="select-all-docs"
                                        checked={selectedDocumentIds.size > 0 && selectedDocumentIds.size === unassignedDocs.length}
                                        onCheckedChange={(checked) => setSelectedDocumentIds(checked ? new Set(unassignedDocs.map(d => d.FACTURA)) : new Set())}
                                    />
                                    <Label htmlFor="select-all-docs" className="font-semibold">{selectedDocumentIds.size} seleccionados</Label>
                                </div>
                                <Select value={bulkAssignContainerId} onValueChange={setBulkAssignContainerId}>
                                    <SelectTrigger className="w-[250px]">
                                        <SelectValue placeholder="Asignar en bloque a..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {containers.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Button onClick={handleBulkAssign} disabled={selectedDocumentIds.size === 0 || !bulkAssignContainerId}>
                                    <Send className="mr-2 h-4 w-4"/>
                                    Asignar
                                </Button>
                            </div>
                            <ScrollArea className="h-[55vh]">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-12"></TableHead>
                                            <TableHead>Documento</TableHead>
                                            <TableHead>Cliente</TableHead>
                                            <TableHead>Ruta (ERP)</TableHead>
                                            <TableHead className="w-[250px]">Asignar a Contenedor</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {combinedDocs.map(doc => {
                                            const isAssigned = 'containerId' in doc;
                                            const docId = isAssigned ? doc.documentId : doc.FACTURA;
                                            const clientName = isAssigned ? doc.clientName : doc.NOMBRE_CLIENTE;
                                            const erpRoute = isAssigned ? 'Asignado' : doc.RUTA;
                                            
                                            return (
                                                <TableRow key={docId} className={isAssigned ? 'bg-green-50' : ''}>
                                                    <TableCell>
                                                        {!isAssigned && <Checkbox checked={selectedDocumentIds.has(docId)} onCheckedChange={(checked) => {
                                                            const newSet = new Set(selectedDocumentIds);
                                                            if (checked) newSet.add(docId); else newSet.delete(docId);
                                                            setSelectedDocumentIds(newSet);
                                                        }} />}
                                                    </TableCell>
                                                    <TableCell className="font-mono">{docId}</TableCell>
                                                    <TableCell>{clientName}</TableCell>
                                                    <TableCell><Badge variant="outline">{erpRoute || 'Sin Ruta'}</Badge></TableCell>
                                                    <TableCell>
                                                        <Select
                                                            value={isAssigned ? String(doc.containerId) : (doc as EnrichedErpHeader).suggestedContainerId || ''}
                                                            onValueChange={(value) => handleSingleAssign(docId, value === 'unassign' ? null : value)}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Seleccionar..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {isAssigned && <SelectItem value="unassign" className="text-destructive">Quitar Asignación</SelectItem>}
                                                                {containers.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                             </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="order" className="flex-1 overflow-auto">
                    <DragDropContext onDragEnd={handleOnDragEnd}>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 h-full">
                            {containers.map(container => (
                                <Droppable key={container.id} droppableId={String(container.id)}>
                                    {(provided) => (
                                        <Card ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col">
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5"/>{container.name}</CardTitle>
                                            </CardHeader>
                                            <CardContent className="flex-1 p-4 bg-muted/40 rounded-b-lg overflow-y-auto">
                                                {(assignments[container.id!] || []).map((item, index) => (
                                                    <DraggableItem key={item.documentId} item={item} erpHeaders={erpHeaders} index={index} onUnassign={handleUnassign} />
                                                ))}
                                                {provided.placeholder}
                                            </CardContent>
                                        </Card>
                                    )}
                                </Droppable>
                            ))}
                        </div>
                    </DragDropContext>
                </TabsContent>
            </Tabs>
        </div>
    );
}
