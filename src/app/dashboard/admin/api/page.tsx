
"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/modules/core/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";
import type { ApiSettings, ExemptionLaw } from "@/modules/core/types";
import { logInfo, logError, logWarn } from "@/modules/core/lib/logger";
import { getApiSettings, saveApiSettings, getExemptionLaws, saveExemptionLaws } from "@/modules/core/lib/db";
import { usePageTitle } from "@/modules/core/hooks/usePageTitle";
import { useAuthorization } from "@/modules/core/hooks/useAuthorization";
import { PlusCircle, Trash2, Wand2, Bot, FolderSearch, BookCopy, Loader2, Save } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { testOllamaConnection, getAvailableOllamaModels, getKnowledgeBasePaths, saveKnowledgeBasePath, deleteKnowledgeBasePath, indexKnowledgeBaseFiles } from "@/modules/ai/lib/ai-actions";

const initialApiSettings: ApiSettings = {
    exchangeRateApi: "https://api.hacienda.go.cr/indicadores/tc/dolar",
    haciendaExemptionApi: "https://api.hacienda.go.cr/fe/ex?autorizacion=",
    haciendaTributariaApi: "https://api.hacienda.go.cr/fe/ae?identificacion=",
    ollamaHost: "http://localhost:11434",
    defaultModel: "deepseek-coder-v2",
}

const emptyLaw: ExemptionLaw = {
    docType: "",
    institutionName: "",
    authNumber: null
};

export default function ApiSettingsPage() {
  const { isAuthorized } = useAuthorization(['admin:settings:api']);
  const { toast } = useToast();
  const [apiSettings, setApiSettings] = useState<ApiSettings>(initialApiSettings);
  const [savedModel, setSavedModel] = useState<string | undefined>('');
  const [exemptionLaws, setExemptionLaws] = useState<ExemptionLaw[]>([]);
  const [isLawsLoading, setIsLawsLoading] = useState(true);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const { setTitle } = usePageTitle();
  
  // State for dialogs
  const [isLawDialogOpen, setLawDialogOpen] = useState(false);
  const [currentLaw, setCurrentLaw] = useState<ExemptionLaw | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [lawToDelete, setLawToDelete] = useState<ExemptionLaw | null>(null);
  
  // State for AI settings
  const [availableModels, setAvailableModels] = useState<{name: string}[]>([]);
  const [knowledgeBasePaths, setKnowledgeBasePaths] = useState<{ id: number; name: string; path: string }[]>([]);
  const [newPathName, setNewPathName] = useState('');
  const [newPathValue, setNewPathValue] = useState('');
  const [isIndexing, setIsIndexing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);


  useEffect(() => {
    setTitle("Configuración de API y Servicios Externos");
    const fetchSettings = async () => {
        const savedApiData = await getApiSettings();
        
        const [savedLawsData, kbPaths, models] = await Promise.all([
            getExemptionLaws(),
            getKnowledgeBasePaths(),
            getAvailableOllamaModels(savedApiData?.ollamaHost || 'http://localhost:11434')
        ]);
        
        if (savedApiData) {
            setApiSettings({ ...initialApiSettings, ...savedApiData });
            setSavedModel(savedApiData.defaultModel);
        }
        setExemptionLaws(savedLawsData);
        setKnowledgeBasePaths(kbPaths);
        setAvailableModels(models);
        setIsLawsLoading(false);
    }
    if (isAuthorized) {
        fetchSettings();
    }
  }, [setTitle, isAuthorized]);

  const handleApiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setApiSettings(prev => ({...prev, [id]: value}));
  }
  
  const handleModelChange = (value: string) => {
    setApiSettings(prev => ({...prev, defaultModel: value}));
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        await saveApiSettings(apiSettings);
        await saveExemptionLaws(exemptionLaws);
        setSavedModel(apiSettings.defaultModel); // Update the visual indicator
        toast({
        title: "Configuración Guardada",
        description: "Los cambios en las APIs y leyes han sido guardados.",
        });
        await logInfo("Configuración de API y Leyes guardada", { settings: apiSettings, laws: exemptionLaws });
    } catch(error: any) {
        logError("Failed to save API settings", { error: error.message });
        toast({ title: "Error", description: "No se pudieron guardar los ajustes.", variant: "destructive"});
    }
  };
  
  const handleOpenLawDialog = (law?: ExemptionLaw) => {
      if (law) {
          setCurrentLaw(law);
          setIsEditing(true);
      } else {
          setCurrentLaw(emptyLaw);
          setIsEditing(false);
      }
      setLawDialogOpen(true);
  };
  
  const handleSaveLaw = () => {
      if (!currentLaw || !currentLaw.docType || !currentLaw.institutionName) {
          toast({ title: "Datos incompletos", description: "El Tipo de Documento y el Nombre de la Institución son requeridos.", variant: "destructive" });
          return;
      }
      
      let updatedLaws;
      if (isEditing) {
          updatedLaws = exemptionLaws.map(law => law.docType === currentLaw.docType ? currentLaw : law);
      } else {
          if (exemptionLaws.some(law => law.docType === currentLaw.docType)) {
              toast({ title: "Error", description: "El Tipo de Documento ya existe.", variant: "destructive" });
              return;
          }
          updatedLaws = [...exemptionLaws, currentLaw];
      }
      setExemptionLaws(updatedLaws);
      setLawDialogOpen(false);
      setCurrentLaw(null);
  };
  
  const handleDeleteLaw = useCallback(() => {
      if (!lawToDelete) return;
      setExemptionLaws(prevLaws => prevLaws.filter(law => law.docType !== lawToDelete.docType));
      logWarn("Exemption law deleted", { docType: lawToDelete.docType });
      toast({ title: "Ley Eliminada", description: "La ley de exoneración ha sido eliminada. Guarda los cambios para confirmar.", variant: "destructive"});
      setLawToDelete(null);
  }, [lawToDelete, toast]);

  const handleTestConnection = async () => {
    if (!apiSettings.ollamaHost) return;
    setIsTestingConnection(true);
    try {
        const result = await testOllamaConnection(apiSettings.ollamaHost);
        if (result.success) {
            toast({
                title: 'Conexión Exitosa',
                description: result.message,
            });
            if (result.models) {
                setAvailableModels(result.models);
            }
        } else {
            toast({
                title: 'Falló la Conexión',
                description: result.message,
                variant: 'destructive',
            });
        }
    } catch(error: any) {
        toast({ title: 'Error Inesperado', description: error.message, variant: 'destructive'});
    } finally {
        setIsTestingConnection(false);
    }
  };
  
    const handleAddPath = async () => {
        if (!newPathName.trim() || !newPathValue.trim()) {
            toast({ title: "Datos incompletos", description: "El nombre y la ruta son requeridos.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            await saveKnowledgeBasePath(newPathValue, newPathName);
            toast({ title: 'Ruta Guardada' });
            setNewPathName('');
            setNewPathValue('');
            const paths = await getKnowledgeBasePaths(); // Refresh
            setKnowledgeBasePaths(paths);
        } catch (error: any) {
            logError('Failed to add knowledge base path', { error: error.message });
            toast({ title: 'Error al Guardar', description: error.message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDeletePath = async (id: number) => {
        setIsSubmitting(true);
        try {
            await deleteKnowledgeBasePath(id);
            toast({ title: 'Ruta Eliminada' });
            const paths = await getKnowledgeBasePaths(); // Refresh
            setKnowledgeBasePaths(paths);
        } catch (error: any) {
            logError('Failed to delete knowledge base path', { error: error.message });
            toast({ title: 'Error al Eliminar', description: error.message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleIndexFiles = async () => {
        setIsIndexing(true);
        toast({ title: 'Iniciando indexación...', description: 'Este proceso puede tardar varios minutos dependiendo de la cantidad de archivos.' });
        try {
            const result = await indexKnowledgeBaseFiles();
            toast({ title: 'Indexación Completa', description: `Se procesaron ${result.indexed} archivos. Se encontraron ${result.errors} errores.` });
        } catch (error: any) {
            logError('File indexing failed', { error: error.message });
            toast({ title: 'Error de Indexación', description: error.message, variant: 'destructive' });
        } finally {
            setIsIndexing(false);
        }
    };


  if (isAuthorized === null) {
      return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-2xl space-y-6">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        </main>
      );
  }

  if (isAuthorized === false) {
      return null;
  }

  return (
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-2xl">
          <form onSubmit={handleSaveAll}>
            <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>APIs de Hacienda (Costa Rica)</CardTitle>
                    <CardDescription>
                      Gestionar las URLs para las integraciones con el Ministerio de Hacienda.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="exchangeRateApi">API de Tipo de Cambio</Label>
                      <Input 
                        id="exchangeRateApi" 
                        value={apiSettings.exchangeRateApi || ''}
                        onChange={handleApiChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="haciendaExemptionApi">API de Exoneraciones</Label>
                      <Input 
                        id="haciendaExemptionApi" 
                        value={apiSettings.haciendaExemptionApi || ''}
                        onChange={handleApiChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="haciendaTributariaApi">API de Situación Tributaria</Label>
                      <Input 
                        id="haciendaTributariaApi" 
                        value={apiSettings.haciendaTributariaApi || ''}
                        onChange={handleApiChange}
                      />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Bot/> Conexión con IA (Ollama)</CardTitle>
                        <CardDescription>Configura la conexión con tu servidor de IA local y selecciona el modelo a utilizar.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="space-y-2">
                            <Label htmlFor="ollamaHost">URL del Host de Ollama</Label>
                            <Input
                                id="ollamaHost"
                                value={apiSettings.ollamaHost || ''}
                                onChange={handleApiChange}
                                placeholder="Ej: http://192.168.1.100:11434"
                            />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="defaultModel">Modelo de Lenguaje a Utilizar</Label>
                            <Select value={apiSettings.defaultModel || ''} onValueChange={handleModelChange}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione un modelo..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableModels.length > 0 ? (
                                        availableModels.map(model => (
                                            <SelectItem key={model.name} value={model.name}>
                                                {model.name}
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <SelectItem value="none" disabled>
                                            No hay modelos disponibles.
                                        </SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground pt-1">
                                Modelo guardado actualmente: <span className="font-bold text-primary">{savedModel || 'Ninguno'}</span>
                            </p>
                             <p className="text-xs text-muted-foreground">Los modelos se detectan al probar la conexión.</p>
                        </div>
                    </CardContent>
                    <CardFooter>
                         <Button type="button" variant="secondary" onClick={handleTestConnection} disabled={isTestingConnection}>
                            {isTestingConnection && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Probar Conexión y Refrescar Modelos
                         </Button>
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><BookCopy/> Base de Conocimiento de Archivos (IA)</CardTitle>
                        <CardDescription>Añade las rutas de red UNC (ej: `\\Servidor\Carpeta`) para que la IA pueda buscar en tus documentos (PDF, DOCX, TXT).</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="space-y-2">
                             {knowledgeBasePaths.map(p => (
                                <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                                    <div>
                                        <p className="font-medium">{p.name}</p>
                                        <p className="text-sm text-muted-foreground font-mono">{p.path}</p>
                                    </div>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={isSubmitting}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>¿Eliminar esta ruta?</AlertDialogTitle>
                                                <AlertDialogDescription>Se eliminarán la ruta y todos sus archivos del índice de la IA. Esta acción no se puede deshacer.</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeletePath(p.id)}>Sí, eliminar</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            ))}
                        </div>
                        <Separator className="my-4"/>
                        <div className="flex flex-col sm:flex-row items-end gap-2">
                            <div className="grid flex-1 gap-1.5">
                                <Label htmlFor="new-path-name">Nombre Descriptivo</Label>
                                <Input id="new-path-name" value={newPathName} onChange={e => setNewPathName(e.target.value)} placeholder="Ej: Fichas Técnicas"/>
                            </div>
                             <div className="grid flex-1 gap-1.5">
                                <Label htmlFor="new-path-value">Ruta de Red (UNC)</Label>
                                <Input id="new-path-value" value={newPathValue} onChange={e => setNewPathValue(e.target.value)} placeholder="\\Servidor\Documentos"/>
                            </div>
                            <Button type="button" onClick={handleAddPath} disabled={isSubmitting}>
                                <PlusCircle className="mr-2"/> Añadir Ruta
                            </Button>
                        </div>
                    </CardContent>
                     <CardFooter>
                        <Button type="button" variant="secondary" onClick={handleIndexFiles} disabled={isIndexing}>
                            {isIndexing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FolderSearch className="mr-2 h-4 w-4"/>}
                            Reindexar Todos los Archivos
                        </Button>
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Leyes de Exoneración</CardTitle>
                                <CardDescription>
                                Gestiona las leyes que se asocian a un tipo de documento.
                                </CardDescription>
                            </div>
                            <Button type="button" size="sm" onClick={() => handleOpenLawDialog()}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Añadir Ley
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLawsLoading ? (
                            <Skeleton className="h-40 w-full" />
                        ) : (
                            <div className="space-y-4">
                                {exemptionLaws.map(law => (
                                    <div key={law.docType} className="flex items-center justify-between rounded-lg border p-3">
                                        <div className="space-y-1">
                                            <p className="font-medium">{law.institutionName}</p>
                                            <p className="text-sm text-muted-foreground">
                                                Tipo Doc: <span className="font-mono">{law.docType}</span>
                                                {law.authNumber && ` | Nº Autorización: ${law.authNumber}`}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button type="button" variant="outline" size="sm" onClick={() => handleOpenLawDialog(law)}>
                                                Editar
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLawToDelete(law)}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>¿Eliminar esta ley?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Esta acción no se puede deshacer. Se eliminará la ley &apos;{law.institutionName}&apos;.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel onClick={() => setLawToDelete(null)}>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={handleDeleteLaw}>Sí, eliminar</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
                
                <Card>
                    <CardFooter className="border-t px-6 py-4">
                        <Button type="submit">
                            <Save className="mr-2 h-4 w-4"/>
                            Guardar Todos los Cambios
                        </Button>
                    </CardFooter>
                </Card>
            </div>
          </form>
        </div>

        {/* Dialog for adding/editing laws */}
        <Dialog open={isLawDialogOpen} onOpenChange={setLawDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{isEditing ? "Editar Ley de Exoneración" : "Añadir Nueva Ley"}</DialogTitle>
                    <DialogDescription>
                        Define la asociación entre un Tipo de Documento y su nombre o ley.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="docType">Tipo de Documento (Código)</Label>
                        <Input 
                            id="docType" 
                            value={currentLaw?.docType || ''}
                            onChange={(e) => setCurrentLaw(prev => prev ? {...prev, docType: e.target.value} : null)}
                            placeholder="Ej: 03, 99"
                            disabled={isEditing}
                        />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="institutionName">Nombre de la Institución/Ley</Label>
                        <Input 
                            id="institutionName" 
                            value={currentLaw?.institutionName || ''}
                            onChange={(e) => setCurrentLaw(prev => prev ? {...prev, institutionName: e.target.value} : null)}
                            placeholder="Ej: Régimen de Zona Franca"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="authNumber">Nº de Autorización</Label>
                        <Input 
                            id="authNumber" 
                            value={currentLaw?.authNumber || ''}
                            onChange={(e) => setCurrentLaw(prev => prev ? {...prev, authNumber: e.target.value} : null)}
                            placeholder="Ej: 9635 (usado para casos especiales)"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="ghost">Cancelar</Button></DialogClose>
                    <Button type="button" onClick={handleSaveLaw}>Guardar Ley</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </main>
  );
}
