import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, Mic, Clock, TrendingUp } from "lucide-react";

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
    <div className="space-y-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Dashboard Master</h2>
        <p className="text-slate-600">Visão geral do sistema e clientes corporativos</p>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Building className="text-primary" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-slate-900">{stats?.totalClients || 0}</div>
                <div className="text-sm text-slate-500">Clientes Ativos</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Mic className="text-green-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-slate-900">{stats?.totalInterviews || 0}</div>
                <div className="text-sm text-slate-500">Entrevistas Realizadas</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="text-yellow-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-slate-900">{stats?.pendingInterviews || 0}</div>
                <div className="text-sm text-slate-500">Entrevistas Pendentes</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="text-purple-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-slate-900">{stats?.avgScore || 0}%</div>
                <div className="text-sm text-slate-500">Score Médio</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
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
