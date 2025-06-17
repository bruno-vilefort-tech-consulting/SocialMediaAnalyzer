import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export default function UnauthorizedPage() {
  const { logout, user } = useAuth();

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
            <h1 className="text-2xl font-bold text-gray-900">Acesso Negado</h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            Você não tem permissão para acessar esta página.
          </p>
          
          {user && (
            <div className="mt-4 p-3 bg-gray-100 rounded-md">
              <p className="text-xs text-gray-500">Usuário atual:</p>
              <p className="text-sm font-medium">{user.email}</p>
              <p className="text-xs text-gray-500">Tipo: {user.role}</p>
            </div>
          )}

          <div className="mt-6 space-y-2">
            <Button 
              onClick={() => window.history.back()} 
              variant="outline" 
              className="w-full"
            >
              Voltar
            </Button>
            <Button 
              onClick={handleLogout} 
              className="w-full"
            >
              Fazer Login Novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}