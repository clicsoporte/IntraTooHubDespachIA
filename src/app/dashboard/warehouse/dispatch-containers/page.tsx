'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { getContainers, saveContainer, deleteContainer } from '@/modules/warehouse/lib/actions';
import type { DispatchContainer } from '@/modules/core/types';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { PlusCircle, Trash2, Edit } from 'lucide-react';
import { useToast } from '@/modules/core/hooks/use-toast';

export default function ManageContainersPage() {
    useAuthorization(['warehouse:dispatch-containers:manage']);
    const { setTitle } = usePageTitle();
    const { user } = useAuth();
    const { toast } = useToast();
    
    const [containers, setContainers] = useState<DispatchContainer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [currentContainer, setCurrentContainer] = useState<Partial<DispatchContainer>>({ name: '' });
    const [containerToDelete, setContainerToDelete] = useState<DispatchContainer | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    const fetchContainers = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getContainers();
            setContainers(data);
        } catch (error: any) {
            toast({ title: "Error", description: `No se pudieron cargar los contenedores: ${error.message}`, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);
    
    useEffect(() => {
        setTitle("Configurar Contenedores de Despacho");
        fetchContainers();
    }, [setTitle, fetchContainers]);

    const handleSave = async () => {
        if (!currentContainer.name || !user) return;
        try {
            const saved = await saveContainer(currentContainer as Omit<DispatchContainer, 'id' | 'createdAt'>, user.name);
            if (isEditing && currentContainer.id) {
                setContainers(containers.map(c => c.id === saved.id ? saved : c));
            } else {
                setContainers([...containers, saved]);
            }
            setIsFormOpen(false);
        } catch (error: any) {
            toast({ title: "Error", description: `No se pudo guardar el contenedor: ${error.message}`, variant: "destructive" });
        }
    };
    
    const handleDelete = async () => {
        if (!containerToDelete) return;
        try {
            await deleteContainer(containerToDelete.id!);
            setContainers(containers.filter(c => c.id !== containerToDelete.id));
            setContainerToDelete(null);
            toast({ title: "Contenedor Eliminado", variant: "destructive" });
        } catch (error: any) {
            toast({ title: "Error", description: `No se pudo eliminar el contenedor: ${error.message}`, variant: "destructive" });
        }
    };
    
    const openForm = (container?: DispatchContainer) => {
        if (container) {
            setCurrentContainer(container);
            setIsEditing(true);
        } else {
            setCurrentContainer({ name: '' });
            setIsEditing(false);
        }
        setIsFormOpen(true);
    };

    return (
        <main className="p-4 md:p-8">
            <Card className="max-w-3xl mx-auto">
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>Contenedores de Despacho</CardTitle>
                            <CardDescription>Crea y gestiona los "contenedores" que representan tus rutas de entrega.</CardDescription>
                        </div>
                        <Button onClick={() => openForm()}><PlusCircle className="mr-2 h-4 w-4"/>Nuevo Contenedor</Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {containers.map(container => (
                        <div key={container.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <span className="font-medium">{container.name}</span>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="icon" onClick={() => openForm(container)}><Edit className="h-4 w-4"/></Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" onClick={() => setContainerToDelete(container)}>
                                            <Trash2 className="h-4 w-4 text-destructive"/>
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>¿Eliminar Contenedor?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Esto eliminará el contenedor "{container.name}". Las facturas asignadas quedarán sin contenedor. Esta acción no se puede deshacer.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleDelete}>Sí, eliminar</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'Editar' : 'Nuevo'} Contenedor</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-2">
                        <Label htmlFor="container-name">Nombre del Contenedor (Ruta)</Label>
                        <Input id="container-name" value={currentContainer.name} onChange={e => setCurrentContainer({ ...currentContainer, name: e.target.value })}/>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                        <Button onClick={handleSave}>Guardar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}
