/**
 * @fileoverview The main entry point of the application, refactored as a Client Component.
 * This component now handles the logic for displaying the login form or the setup wizard
 * on the client-side, making it more resilient to server-side rendering issues.
 */
"use client";

import { AuthForm } from "@/components/auth/auth-form";
import { SetupWizard } from "@/components/auth/setup-wizard";
import { getInitialPageData } from "@/app/actions";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Network, UserPlus, Loader2, AlertTriangle } from "lucide-react";
import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";

// Client-side component to handle dynamic rendering of login or setup.
export default function InitialPage() {
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);
  const [companyName, setCompanyName] = useState<string>("Clic-Tools");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkUserStatus() {
      try {
        const { hasUsers, companyName } = await getInitialPageData();
        setHasUsers(hasUsers);
        setCompanyName(companyName);
      } catch (err: any) {
        console.error("Critical error on initial page data fetch:", err);
        setError("No se pudo conectar con la base de datos. Revisa la consola del servidor para más detalles.");
      } finally {
        setIsLoading(false);
      }
    }
    checkUserStatus();
  }, []);

  // Client info can be simplified as server-side headers are not available here.
  const clientInfo = { ip: 'N/A', host: 'N/A' };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      );
    }
    if (error) {
      return (
         <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <CardTitle>Error Crítico</CardTitle>
            <AlertDescription>
                {error}
            </AlertDescription>
        </Alert>
      );
    }
    if (hasUsers === true) {
      return <AuthForm clientInfo={clientInfo} />;
    }
    if (hasUsers === false) {
      return <SetupWizard clientInfo={clientInfo} />;
    }
    return null;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
            {isLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : error ? <AlertTriangle className="h-8 w-8"/> : hasUsers ? <Network className="h-8 w-8" /> : <UserPlus className="h-8 w-8" />}
          </div>
          <CardTitle className="text-3xl font-bold">
            {isLoading ? "Cargando..." : error ? "Error" : hasUsers ? companyName : "Bienvenido a Clic-Tools"}
          </CardTitle>
          <CardDescription>
            {isLoading
              ? "Verificando el estado del sistema..."
              : error
              ? "Ocurrió un error al inicializar."
              : hasUsers
              ? "Inicia sesión para acceder a tus herramientas"
              : "Completa la configuración para crear tu cuenta de administrador"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
}
