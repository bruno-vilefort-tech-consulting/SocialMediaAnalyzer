import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mic, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Get token from URL
  const token = new URLSearchParams(window.location.search).get('token');

  useEffect(() => {
    if (!token) {
      setError("Token de recuperação não encontrado");
      setTokenValid(false);
      return;
    }

    // Verify token validity
    const verifyToken = async () => {
      try {
        const response = await apiRequest("/api/password-reset/verify", "POST", { token });
        setTokenValid(true);
        setUserEmail(response.email);
      } catch (error: any) {
        setError(error.message || "Token inválido ou expirado");
        setTokenValid(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }

    setIsLoading(true);

    try {
      await apiRequest("/api/password-reset/confirm", "POST", {
        token,
        newPassword: password,
      });
      
      setIsSuccess(true);
      toast({
        title: "Senha atualizada",
        description: "Sua senha foi atualizada com sucesso.",
      });
    } catch (error: any) {
      setError(error.message || "Erro ao atualizar senha");
      toast({
        title: "Erro",
        description: "Erro ao atualizar senha",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (tokenValid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-slate-100 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-primary rounded-xl flex items-center justify-center mb-6">
              <Mic className="text-white text-2xl animate-spin" />
            </div>
            <h2 className="text-3xl font-bold text-slate-900">Verificando Token</h2>
            <p className="mt-2 text-sm text-slate-600">Aguarde um momento...</p>
          </div>
        </div>
      </div>
    );
  }

  if (tokenValid === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-slate-100 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-red-100 rounded-xl flex items-center justify-center mb-6">
              <AlertCircle className="text-red-600 text-2xl" />
            </div>
            <h2 className="text-3xl font-bold text-slate-900">Token Inválido</h2>
            <p className="mt-2 text-sm text-slate-600">
              O link de recuperação é inválido ou já expirou
            </p>
          </div>
          
          <Card className="shadow-xl border border-slate-200">
            <CardContent className="pt-6">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              
              <div className="mt-6 space-y-4">
                <Button 
                  onClick={() => setLocation("/forgot-password")}
                  className="w-full"
                >
                  Solicitar Nova Recuperação
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => setLocation("/login")}
                  className="w-full"
                >
                  Voltar ao Login
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-slate-100 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-green-100 rounded-xl flex items-center justify-center mb-6">
              <CheckCircle className="text-green-600 text-2xl" />
            </div>
            <h2 className="text-3xl font-bold text-slate-900">Senha Atualizada</h2>
            <p className="mt-2 text-sm text-slate-600">
              Sua senha foi atualizada com sucesso
            </p>
          </div>
          
          <Card className="shadow-xl border border-slate-200">
            <CardContent className="pt-6">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Agora você pode fazer login com sua nova senha.
                </AlertDescription>
              </Alert>
              
              <div className="mt-6">
                <Button 
                  onClick={() => setLocation("/login")}
                  className="w-full"
                >
                  Fazer Login
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-slate-100 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary rounded-xl flex items-center justify-center mb-6">
            <Mic className="text-white text-2xl" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900">Nova Senha</h2>
          <p className="mt-2 text-sm text-slate-600">
            Defina uma nova senha para {userEmail}
          </p>
        </div>
        
        <Card className="shadow-xl border border-slate-200">
          <CardHeader>
            <CardTitle>Redefinir Senha</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="password">Nova Senha</Label>
                <div className="relative mt-2">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              <div>
                <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                <div className="relative mt-2">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Digite a senha novamente"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading ? "Atualizando..." : "Atualizar Senha"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}