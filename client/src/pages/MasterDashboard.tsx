import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building, Mic, Clock, TrendingUp, Briefcase, Users, Settings } from "lucide-react";

export default function MasterDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/stats"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Dashboard Master</h2>
          <p className="text-slate-600">Visão geral do sistema e clientes corporativos</p>
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
    <div className="space-y-8">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 -mx-6 -mt-6 px-6 pt-6 pb-8 mb-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard Master</h1>
          <p className="text-primary-foreground/80">Visão geral completa do sistema e clientes corporativos</p>
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-slate-900 mb-1">{stats?.totalClients || 0}</div>
                <div className="text-sm font-medium text-slate-600">Clientes Ativos</div>
                <div className="text-xs text-slate-400 mt-1">Empresas cadastradas</div>
              </div>
              <div className="h-14 w-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <Building className="text-white h-7 w-7" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-slate-900 mb-1">{stats?.totalInterviews || 0}</div>
                <div className="text-sm font-medium text-slate-600">Entrevistas Realizadas</div>
                <div className="text-xs text-slate-400 mt-1">Total no sistema</div>
              </div>
              <div className="h-14 w-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                <Mic className="text-white h-7 w-7" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-slate-900 mb-1">{stats?.pendingInterviews || 0}</div>
                <div className="text-sm font-medium text-slate-600">Entrevistas Pendentes</div>
                <div className="text-xs text-slate-400 mt-1">Aguardando resposta</div>
              </div>
              <div className="h-14 w-14 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center">
                <Clock className="text-white h-7 w-7" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-slate-900 mb-1">{Math.round(stats?.avgScore || 0)}%</div>
                <div className="text-sm font-medium text-slate-600">Score Médio</div>
                <div className="text-xs text-slate-400 mt-1">Avaliação geral</div>
              </div>
              <div className="h-14 w-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                <TrendingUp className="text-white h-7 w-7" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              variant="outline" 
              className="h-16 flex-col space-y-2"
              onClick={() => window.location.href = "/vagas"}
            >
              <Briefcase className="h-6 w-6" />
              <span>Cadastrar Vagas</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-16 flex-col space-y-2"
              onClick={() => window.location.href = "/clientes"}
            >
              <Users className="h-6 w-6" />
              <span>Gerenciar Clientes</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-16 flex-col space-y-2"
              onClick={() => window.location.href = "/config"}
            >
              <Settings className="h-6 w-6" />
              <span>Configurações</span>
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Charts and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Entrevistas por Mês</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-slate-50 rounded-lg flex items-center justify-center">
                <div className="text-slate-400 text-center">
                  <TrendingUp className="h-12 w-12 mx-auto mb-2" />
                  <div className="text-sm">Gráfico de Entrevistas</div>
                  <div className="text-xs mt-1">Dados serão exibidos quando houver entrevistas</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Atividade Recente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(!stats || stats.totalInterviews === 0) ? (
                <div className="text-center text-slate-500 py-8">
                  <Clock className="h-8 w-8 mx-auto mb-2" />
                  <div className="text-sm">Nenhuma atividade recente</div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="h-2 w-2 bg-primary rounded-full mt-2 mr-3"></div>
                    <div className="flex-1">
                      <div className="text-sm text-slate-900">Sistema configurado</div>
                      <div className="text-xs text-slate-500">Admin - agora</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
