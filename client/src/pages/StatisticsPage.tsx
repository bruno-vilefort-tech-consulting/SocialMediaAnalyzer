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
import { CalendarIcon, Users, Send, CheckCircle, FileText, Target, Award, HardDrive } from "lucide-react";

interface StatisticsData {
  candidatesRegistered: number;
  interviewsSent: number;
  interviewsStarted: number;
  interviewsCompleted: number;
  completionRate: number;
}

interface AudioStorageData {
  totalSizeBytes: number;
  totalSizeMB: number;
  formattedSize: string;
  fileCount: number;
}

interface SelectionsSentData {
  selectionsSent: number;
  clientId: number;
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
  const { data: statistics, isLoading, error } = useQuery({
    queryKey: ['/api/statistics', user?.clientId, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      const response = await apiRequest(`/api/statistics?from=${dateRange.from.toISOString()}&to=${dateRange.to.toISOString()}`);
      return response.json();
    },
    enabled: !!user?.clientId
  });

  // Buscar dados de uso de memória de áudio
  const { data: audioStorage, isLoading: isLoadingAudio } = useQuery({
    queryKey: ['/api/audio-storage-usage', user?.clientId],
    queryFn: async () => {
      const response = await apiRequest('/api/audio-storage-usage');
      return response.json();
    },
    enabled: !!user?.clientId
    // Removido refetchInterval - só atualiza quando entrar na página, dar refresh ou navegar
  });

  // Buscar contagem de seleções enviadas
  const { data: selectionsSent, isLoading: isLoadingSelections } = useQuery({
    queryKey: ['/api/selections-sent-count', user?.clientId],
    queryFn: async () => {
      const response = await apiRequest('/api/selections-sent-count');
      return response.json();
    },
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
    interviewsStarted: statistics?.interviewsStarted || 0,
    interviewsCompleted: statistics?.interviewsCompleted || 0,
    completionRate: statistics?.completionRate || 0
  };



  return (
    <div className="space-y-6 p-8">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 lg:gap-6">
        <Card>
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center">
              <div className="h-10 w-10 lg:h-12 lg:w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 lg:h-6 lg:w-6 text-blue-600" />
              </div>
              <div className="ml-3 lg:ml-4">
                <div className="text-xl lg:text-2xl font-bold text-slate-900">
                  {isLoading ? "..." : (statsData.candidatesRegistered || 0).toLocaleString()}
                </div>
                <div className="text-xs lg:text-sm text-slate-500">Candidatos Cadastrados</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center">
              <div className="h-10 w-10 lg:h-12 lg:w-12 bg-cyan-100 rounded-lg flex items-center justify-center">
                <FileText className="h-5 w-5 lg:h-6 lg:w-6 text-cyan-600" />
              </div>
              <div className="ml-3 lg:ml-4">
                <div className="text-xl lg:text-2xl font-bold text-slate-900">
                  {isLoadingSelections ? "..." : (selectionsSent?.selectionsSent || 0).toLocaleString()}
                </div>
                <div className="text-xs lg:text-sm text-slate-500">Seleções Enviadas</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center">
              <div className="h-10 w-10 lg:h-12 lg:w-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Send className="h-5 w-5 lg:h-6 lg:w-6 text-orange-600" />
              </div>
              <div className="ml-3 lg:ml-4">
                <div className="text-xl lg:text-2xl font-bold text-slate-900">
                  {isLoading ? "..." : `${(statsData.interviewsStarted || 0).toLocaleString()} / ${(statsData.interviewsSent || 0).toLocaleString()}`}
                </div>
                <div className="text-xs lg:text-sm text-slate-500">Entrevistas Iniciadas</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center">
              <div className="h-10 w-10 lg:h-12 lg:w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-5 w-5 lg:h-6 lg:w-6 text-green-600" />
              </div>
              <div className="ml-3 lg:ml-4">
                <div className="text-xl lg:text-2xl font-bold text-slate-900">
                  {isLoading ? "..." : `${(statsData.interviewsCompleted || 0).toLocaleString()} / ${(statsData.interviewsSent || 0).toLocaleString()}`}
                </div>
                <div className="text-xs lg:text-sm text-slate-500">Entrevistas Finalizadas</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center">
              <div className="h-10 w-10 lg:h-12 lg:w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Award className="h-5 w-5 lg:h-6 lg:w-6 text-purple-600" />
              </div>
              <div className="ml-3 lg:ml-4">
                <div className="text-xl lg:text-2xl font-bold text-slate-900">
                  {isLoading ? "..." : `${(statsData.completionRate || 0).toFixed(1)}%`}
                </div>
                <div className="text-xs lg:text-sm text-slate-500">Taxa de Conclusão</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center">
              <div className="h-10 w-10 lg:h-12 lg:w-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                <HardDrive className="h-5 w-5 lg:h-6 lg:w-6 text-indigo-600" />
              </div>
              <div className="ml-3 lg:ml-4">
                <div className="text-base font-bold text-slate-900">
                  {isLoadingAudio ? "..." : audioStorage?.formattedSize || "0.000 MB"}
                </div>
                <div className="text-xs lg:text-sm text-slate-500">Memória Utilizada</div>
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
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8 xl:gap-12">
            {/* Entrevistas */}
            <div className="space-y-4 lg:space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 lg:h-12 lg:w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Send className="h-5 w-5 lg:h-6 lg:w-6 text-blue-600" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900 lg:text-lg">Entrevistas</div>
                  <div className="text-sm lg:text-base text-slate-500">Limite mensal de entrevistas</div>
                </div>
              </div>
              
              <div className="space-y-4 lg:space-y-5">
                <div className="flex justify-between items-center">
                  <span className="text-sm lg:text-base text-slate-600">Entrevistas Contratadas</span>
                  <span className="font-semibold text-slate-900 lg:text-lg">1.000</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm lg:text-base text-slate-600">Entrevistas Iniciadas</span>
                  <span className="font-semibold text-slate-900 lg:text-lg">{(statsData.interviewsStarted || 0).toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div 
                    className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(((statsData.interviewsStarted || 0) / 1000) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-sm lg:text-base">
                  <span className="text-slate-500">
                    Restantes: {(1000 - (statsData.interviewsStarted || 0)).toLocaleString()}
                  </span>
                  <span className="text-slate-500">
                    {(((statsData.interviewsStarted || 0) / 1000) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Assessments */}
            <div className="space-y-4 lg:space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 lg:h-12 lg:w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Award className="h-5 w-5 lg:h-6 lg:w-6 text-purple-600" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900 lg:text-lg">Assessments</div>
                  <div className="text-sm lg:text-base text-slate-500">Limite mensal de assessments</div>
                </div>
              </div>
              
              <div className="space-y-4 lg:space-y-5">
                <div className="flex justify-between items-center">
                  <span className="text-sm lg:text-base text-slate-600">Contratados</span>
                  <span className="font-semibold text-slate-900 lg:text-lg">500</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm lg:text-base text-slate-600">Utilizados</span>
                  <span className="font-semibold text-slate-900 lg:text-lg">{(statsData.interviewsCompleted || 0).toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div 
                    className="bg-purple-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(((statsData.interviewsCompleted || 0) / 500) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-sm lg:text-base">
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