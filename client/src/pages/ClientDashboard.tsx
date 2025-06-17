import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Users, Mic, PieChart, Plus, Upload, ClipboardList, BarChart } from "lucide-react";

export default function ClientDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/client/stats"],
  });

  const handleQuickAction = (path: string) => {
    setLocation(path);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Dashboard Cliente</h2>
          <p className="text-slate-600">Visão geral das suas vagas e entrevistas</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-12 bg-slate-200 rounded mb-4"></div>
                <div className="h-6 bg-slate-200 rounded mb-2"></div>
                <div className="h-4 bg-slate-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Dashboard Cliente</h2>
        <p className="text-slate-600">Visão geral das suas vagas e entrevistas</p>
      </div>
      
      {/* Client Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Briefcase className="text-blue-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-slate-900">{stats?.activeJobs || 0}</div>
                <div className="text-sm text-slate-500">Vagas Ativas</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Users className="text-green-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-slate-900">{stats?.totalCandidates || 0}</div>
                <div className="text-sm text-slate-500">Candidatos Cadastrados</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Mic className="text-yellow-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-slate-900">{stats?.monthlyInterviews || 0}</div>
                <div className="text-sm text-slate-500">Entrevistas este Mês</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <PieChart className="text-purple-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-slate-900">
                  {stats?.currentUsage || 0}/{stats?.monthlyLimit || 0}
                </div>
                <div className="text-sm text-slate-500">Limite Mensal</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Recent Activity and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Entrevistas Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(!stats || stats.monthlyInterviews === 0) ? (
                  <div className="text-center text-slate-500 py-8">
                    <Mic className="h-8 w-8 mx-auto mb-2" />
                    <div className="text-sm">Nenhuma entrevista realizada ainda</div>
                    <div className="text-xs mt-1">As entrevistas aparecerão aqui quando iniciadas</div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center">
                        <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <Users className="text-primary" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-slate-900">Sistema Configurado</div>
                          <div className="text-xs text-slate-500">Pronto para receber candidatos</div>
                        </div>
                      </div>
                      <Badge variant="outline">Ativo</Badge>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button 
                onClick={() => handleQuickAction("/vagas")}
                className="w-full justify-start bg-primary/10 text-primary hover:bg-primary/20"
                variant="outline"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nova Vaga
              </Button>
              <Button 
                onClick={() => handleQuickAction("/candidates")}
                className="w-full justify-start bg-green-50 text-green-700 hover:bg-green-100"
                variant="outline"
              >
                <Upload className="mr-2 h-4 w-4" />
                Importar Candidatos
              </Button>
              <Button 
                onClick={() => handleQuickAction("/selecoes")}
                className="w-full justify-start bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
                variant="outline"
              >
                <ClipboardList className="mr-2 h-4 w-4" />
                Nova Seleção
              </Button>
              <Button 
                onClick={() => handleQuickAction("/relatorios")}
                className="w-full justify-start bg-purple-50 text-purple-700 hover:bg-purple-100"
                variant="outline"
              >
                <BarChart className="mr-2 h-4 w-4" />
                Ver Relatórios
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
