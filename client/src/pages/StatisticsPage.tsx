import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Users, Send, CheckCircle, FileText, Target, Award } from "lucide-react";

interface StatisticsData {
  candidatesRegistered: number;
  interviewsSent: number;
  interviewsCompleted: number;
  completionRate: number;
}

export default function StatisticsPage() {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<{
    from: Date;
    to: Date;
  }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  const [selectedPeriod, setSelectedPeriod] = useState<string>("current");
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false);

  // Buscar estatísticas baseadas no período selecionado
  const { data: statistics, isLoading } = useQuery({
    queryKey: ['/api/statistics', user?.clientId, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: () => apiRequest(`/api/statistics?from=${dateRange.from.toISOString()}&to=${dateRange.to.toISOString()}`),
    enabled: !!user?.clientId
  });

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
    const today = new Date();
    
    switch (period) {
      case "current":
        setDateRange({
          from: startOfMonth(today),
          to: endOfMonth(today)
        });
        break;
      case "last":
        const lastMonth = subMonths(today, 1);
        setDateRange({
          from: startOfMonth(lastMonth),
          to: endOfMonth(lastMonth)
        });
        break;
      case "last3":
        setDateRange({
          from: startOfMonth(subMonths(today, 2)),
          to: endOfMonth(today)
        });
        break;
      case "custom":
        setIsCustomDateOpen(true);
        break;
    }
  };

  const statsData: StatisticsData = {
    candidatesRegistered: statistics?.candidatesRegistered || 0,
    interviewsSent: statistics?.interviewsSent || 0,
    interviewsCompleted: statistics?.interviewsCompleted || 0,
    completionRate: statistics?.completionRate || 0
  };

  return (
    <div className="space-y-6">
      {/* Header com Filtros de Período no topo direito */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Estatísticas</h2>
          <p className="text-slate-600">Acompanhe o desempenho das suas entrevistas e candidatos</p>
        </div>
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 lg:gap-3">
          <div className="flex items-center gap-3">
            <CalendarIcon className="h-4 w-4 text-slate-500" />
            <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Mês Atual</SelectItem>
                <SelectItem value="last">Mês Passado</SelectItem>
                <SelectItem value="last3">Últimos 3 Meses</SelectItem>
                <SelectItem value="custom">Período Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedPeriod === "custom" && (
            <div className="flex gap-2 items-center">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[120px] justify-start text-left font-normal text-sm">
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {format(dateRange.from, "dd/MM")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.from}
                    onSelect={(date) => date && setDateRange(prev => ({ ...prev, from: date }))}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <span className="text-slate-400">-</span>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[120px] justify-start text-left font-normal text-sm">
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {format(dateRange.to, "dd/MM")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.to}
                    onSelect={(date) => date && setDateRange(prev => ({ ...prev, to: date }))}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          <div className="text-xs text-slate-500 lg:ml-3">
            {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} - {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
          </div>
        </div>
      </div>

      {/* Estatísticas de Entrevistas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="text-blue-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-slate-900">
                  {isLoading ? "..." : (statsData.candidatesRegistered || 0).toLocaleString()}
                </div>
                <div className="text-sm text-slate-500">Candidatos Cadastrados</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Send className="text-orange-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-slate-900">
                  {isLoading ? "..." : (statsData.interviewsSent || 0).toLocaleString()}
                </div>
                <div className="text-sm text-slate-500">Entrevistas Enviadas</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="text-green-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-slate-900">
                  {isLoading ? "..." : (statsData.interviewsCompleted || 0).toLocaleString()}
                </div>
                <div className="text-sm text-slate-500">Entrevistas Finalizadas</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <FileText className="text-purple-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-slate-900">
                  {isLoading ? "..." : `${(statsData.completionRate || 0).toFixed(1)}%`}
                </div>
                <div className="text-sm text-slate-500">Taxa de Conclusão</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Painel do Plano Contratado */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Plano Contratado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Entrevistas */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Send className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Entrevistas</div>
                  <div className="text-sm text-slate-500">Limite mensal de entrevistas</div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Contratadas</span>
                  <span className="font-semibold text-slate-900">1.000</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Utilizadas</span>
                  <span className="font-semibold text-slate-900">{(statsData.interviewsSent || 0).toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(((statsData.interviewsSent || 0) / 1000) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">
                    Restantes: {(1000 - (statsData.interviewsSent || 0)).toLocaleString()}
                  </span>
                  <span className="text-slate-500">
                    {(((statsData.interviewsSent || 0) / 1000) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Assessments */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Award className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Assessments</div>
                  <div className="text-sm text-slate-500">Limite mensal de assessments</div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Contratados</span>
                  <span className="font-semibold text-slate-900">500</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Utilizados</span>
                  <span className="font-semibold text-slate-900">{(statsData.interviewsCompleted || 0).toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div 
                    className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(((statsData.interviewsCompleted || 0) / 500) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">
                    Restantes: {(500 - (statsData.interviewsCompleted || 0)).toLocaleString()}
                  </span>
                  <span className="text-slate-500">
                    {(((statsData.interviewsCompleted || 0) / 500) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}