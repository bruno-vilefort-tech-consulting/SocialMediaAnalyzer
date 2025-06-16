import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mic, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await apiRequest("/api/password-reset/request", "POST", { email });
      setIsSubmitted(true);
      toast({
        title: "Email enviado",
        description: "Verifique sua caixa de entrada para instruções de recuperação.",
      });
    } catch (error: any) {
      setError(error.message || "Erro ao enviar email de recuperação");
      toast({
        title: "Erro",
        description: "Erro ao enviar email de recuperação",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-slate-100 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-green-100 rounded-xl flex items-center justify-center mb-6">
              <CheckCircle className="text-green-600 text-2xl" />
            </div>
            <h2 className="text-3xl font-bold text-slate-900">Email Enviado</h2>
            <p className="mt-2 text-sm text-slate-600">
              Se o email estiver cadastrado, você receberá instruções de recuperação
            </p>
          </div>
          
          <Card className="shadow-xl border border-slate-200">
            <CardContent className="pt-6">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Verifique sua caixa de entrada e pasta de spam. O link de recuperação expira em 1 hora.
                </AlertDescription>
              </Alert>
              
              <div className="mt-6 space-y-4">
                <Button 
                  onClick={() => setLocation("/login")}
                  className="w-full"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar ao Login
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => {
                    setIsSubmitted(false);
                    setEmail("");
                  }}
                  className="w-full"
                >
                  Enviar Novamente
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
          <h2 className="text-3xl font-bold text-slate-900">Recuperar Senha</h2>
          <p className="mt-2 text-sm text-slate-600">
            Digite seu email para receber instruções de recuperação
          </p>
        </div>
        
        <Card className="shadow-xl border border-slate-200">
          <CardHeader>
            <CardTitle>Esqueceu sua senha?</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="mt-2"
                />
              </div>
              
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-4">
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading}
                >
                  {isLoading ? "Enviando..." : "Enviar Instruções"}
                </Button>
                
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => setLocation("/login")}
                  className="w-full"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar ao Login
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}