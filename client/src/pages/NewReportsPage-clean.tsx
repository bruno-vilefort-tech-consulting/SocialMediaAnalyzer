import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Play, Pause, Square, FileText, Calendar, Users, TrendingUp, Download, ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface Selection {
  id: number;
  name: string;
  status: string;
  createdAt: any;
  jobName?: string;
  clientId: number;
  completedInterviews?: number;
  totalCandidates?: number;
}

interface InterviewCandidate {
  candidate: {
    id: number;
    name: string;
    email: string;
    phone: string;
  };
  interview: {
    id: string;
    status: string;
    createdAt: any;
    completedAt?: any;
    totalScore: number;
  };
  responses: InterviewResponse[];
  calculatedScore: number;
}

interface InterviewResponse {
  id: string;
  questionId: number;
  questionText: string;
  transcription: string;
  audioUrl?: string;
  score?: number;
  recordingDuration?: number;
  aiAnalysis?: any;
}

export default function NewReportsPage() {
  const [activeTab, setActiveTab] = useState('relatorios');
  const [selectedSelection, setSelectedSelection] = useState<Selection | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);
  const [candidateCategories, setCandidateCategories] = useState<{[key: string]: string}>({});
  const [selectedCandidate, setSelectedCandidate] = useState<InterviewCandidate | null>(null);
  const [showInterviewDetails, setShowInterviewDetails] = useState(false);
  const [audioStates, setAudioStates] = useState<{ [key: string]: { 
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    progress: number;
  } }>({});
  const [reportData, setReportData] = useState<any>(null);
  const [isSpecificReport, setIsSpecificReport] = useState(false);
  const [expandedPerfectAnswers, setExpandedPerfectAnswers] = useState<{ [key: string]: boolean }>({});
  const [visibleReports, setVisibleReports] = useState<Set<string>>(new Set());
  const [lastHiddenUpdate, setLastHiddenUpdate] = useState<number>(0);
  const [selectionCandidatesCache, setSelectionCandidatesCache] = useState<{[key: string]: any[]}>({});
  
  const { user } = useAuth();
  const [location] = useLocation();
  
  // Parse URL parameters
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const reportId = urlParams.get('reportId');
  const selectedSelectionId = urlParams.get('selectedSelection');

  // Buscar clientes (apenas para masters)
  const { data: clients = [] } = useQuery({
    queryKey: ['/api/clients'],
    enabled: user?.role === 'master'
  });

  // Buscar seleções com cache otimizado
  const { data: selectionsData = [], isLoading: loadingSelections } = useQuery({
    queryKey: ['/api/selections', selectedClientId],
    enabled: !!selectedClientId || user?.role === 'client',
    staleTime: 10 * 60 * 1000, // Cache por 10 minutos
    gcTime: 30 * 60 * 1000, // Manter em cache por 30 minutos (v5)
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  // Efeito para verificar se é um relatório específico
  useEffect(() => {
    if (reportId && reportId.startsWith('report_')) {
      setIsSpecificReport(true);
      setActiveTab('candidatos');
      
      // Carregar dados do relatório específico
      const loadReportData = async () => {
        try {
          const res = await apiRequest(`/api/reports/${reportId}`, 'GET');
          const data = await res.json();
          setReportData(data);
        } catch (error) {
          console.error('Error loading report data:', error);
        }
      };
      
      loadReportData();
    } else if (selectedSelectionId) {
      // Modo normal - encontrar seleção pelo ID
      setIsSpecificReport(false);
      setActiveTab('candidatos');
    } else {
      setIsSpecificReport(false);
    }
  }, [reportId, selectedSelectionId]);

  // Determinar clientId baseado no contexto
  useEffect(() => {
    if (user?.role === 'client' && user.clientId) {
      setSelectedClientId(user.clientId.toString());
    }
  }, [user]);

  // Efeito para selecionar seleção automaticamente se especificada na URL
  useEffect(() => {
    if (selectedSelectionId && Array.isArray(selectionsData) && selectionsData.length > 0) {
      const selection = selectionsData.find((s: any) => s.id.toString() === selectedSelectionId);
      if (selection) {
        setSelectedSelection(selection);
      }
    }
  }, [selectedSelectionId, selectionsData, user]);

  // Query para buscar estatísticas - DESABILITADA (dados serão carregados sob demanda)
  const { data: interviewStats = {}, isLoading: loadingStats } = useQuery({
    queryKey: ['/api/interview-stats', selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return {};
      
      try {
        const res = await apiRequest(`/api/interview-stats?clientId=${selectedClientId}`, 'GET');
        const data = await res.json();
        return data || {};
      } catch (error) {
        console.error('Error fetching interview stats:', error);
        return {};
      }
    },
    enabled: false, // DESABILITADA - carregar apenas quando necessário
    staleTime: 15 * 60 * 1000, // Cache por 15 minutos
    gcTime: 60 * 60 * 1000, // Manter em cache por 1 hora
    refetchOnWindowFocus: false
  });

  // Função para carregar candidatos de uma seleção específica
  const loadSelectionCandidates = async (selectionId: number) => {
    const cacheKey = `selection_${selectionId}`;
    
    // Se já está no cache, não carregar novamente
    if (selectionCandidatesCache[cacheKey]) {
      console.log(`🔍 DEBUG ${selectedSelection?.name || selectionId} - cachedCandidates:`, selectionCandidatesCache[cacheKey]);
      console.log(`🔍 DEBUG ${selectedSelection?.name || selectionId} - cachedCandidates length:`, selectionCandidatesCache[cacheKey]?.length);
      return;
    }
    
    try {
      const res = await apiRequest(`/api/selections/${selectionId}/interview-candidates`, 'GET');
      const response = await res.json();
      
      // Garantir que sempre retornamos um array
      const candidatesArray = Array.isArray(response) ? response : [];
      
      // Salvar no cache
      setSelectionCandidatesCache(prev => ({
        ...prev,
        [cacheKey]: candidatesArray
      }));
      
    } catch (error) {
      console.error('Error fetching interview candidates:', error);
      // Salvar array vazio no cache para evitar tentativas repetidas
      setSelectionCandidatesCache(prev => ({
        ...prev,
        [cacheKey]: []
      }));
    }
  };

  // Efeito para carregar candidatos quando seleção é selecionada
  useEffect(() => {
    if (selectedSelection && activeTab === 'candidatos') {
      loadSelectionCandidates(selectedSelection.id);
    }
  }, [selectedSelection, selectionCandidatesCache]);

  // Buscar candidatos da seleção - APENAS quando aba candidatos for ativa
  const { data: interviewCandidates = [], isLoading: loadingCandidates } = useQuery({
    queryKey: ['selection-interview-candidates', selectedSelection?.id],
    queryFn: async () => {
      if (!selectedSelection) return [];
      
      try {
        const res = await apiRequest(`/api/selections/${selectedSelection.id}/interview-candidates`, 'GET');
        const response = await res.json();
        
        // Garantir que sempre retornamos um array
        if (Array.isArray(response)) {
          return response;
        } else {
          return [];
        }
      } catch (error) {
        console.error('Error fetching interview candidates:', error);
        return [];
      }
    },
    enabled: !!selectedSelection && activeTab === 'candidatos', // APENAS quando necessário
    staleTime: 10 * 60 * 1000, // Cache por 10 minutos
    gcTime: 30 * 60 * 1000, // Manter em cache por 30 minutos
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  // Processamento dos dados para as abas
  const processedSelectionsData = useMemo(() => {
    if (!Array.isArray(selectionsData)) return [];
    
    return selectionsData.map((selection: any) => {
      const cacheKey = `selection_${selection.id}`;
      const cachedCandidates = selectionCandidatesCache[cacheKey];
      
      console.log(`🔍 DEBUG ${selection.name} - cachedCandidates:`, cachedCandidates);
      console.log(`🔍 DEBUG ${selection.name} - cachedCandidates length:`, cachedCandidates?.length);
      
      let completedInterviews = 0;
      
      if (cachedCandidates && Array.isArray(cachedCandidates)) {
        completedInterviews = cachedCandidates.filter((c: any) => 
          c.responses && c.responses.length > 0 && 
          c.responses.every((r: any) => r.transcription && r.transcription !== "Aguardando resposta via WhatsApp")
        ).length;
      } else {
        // Fallback para dados de estatísticas se disponíveis
        const stats = (interviewStats as any)[selection.id];
        if (stats) {
          completedInterviews = stats.completedInterviews || 0;
        }
      }
      
      console.log(`🔍 DEBUG ${selection.name} - Usando completedInterviews como fallback:`, completedInterviews);
      
      return {
        ...selection,
        totalCandidates: cachedCandidates?.length || 0,
        completedInterviews
      };
    });
  }, [selectionsData, selectionCandidatesCache, interviewStats]);

  // Criar dados para mock
  const createMockData = () => {
    if (!selectedSelection) return [];
    
    const mockSelection = {
      ...selectedSelection,
      totalCandidates: Array.isArray(interviewCandidates) ? interviewCandidates.length : 0,
      completedInterviews: Array.isArray(interviewCandidates) ? interviewCandidates.filter((c: any) => 
        c.responses && c.responses.length > 0 && 
        c.responses.every((r: any) => r.transcription && r.transcription !== "Aguardando resposta via WhatsApp")
      ).length : 0
    };

    return [mockSelection];
  };

  // Use mock data se não tiver dados reais
  const selectionsToShow = processedSelectionsData.length > 0 ? processedSelectionsData : createMockData();

  // Organização de relatórios
  const organizedReports = useMemo(() => {
    const allReports = selectionsToShow.filter(Boolean);
    const assigned = Array.from(visibleReports);
    const unorganized = allReports.filter((r: any) => !visibleReports.has(`selection_${r.id}`));
    
    console.log('📊 Relatórios não organizados:', {
      totalReports: allReports.length,
      assignedCount: assigned.length,
      unorganizedCount: unorganized.length,
      unorganizedIds: unorganized.map((r: any) => `selection_${r.id}`)
    });
    
    return { assigned, unorganized };
  }, [selectionsToShow, visibleReports, lastHiddenUpdate]);

  const handleSelectionClick = (selection: any) => {
    setSelectedSelection(selection);
    setActiveTab('candidatos');
    setCurrentPage(1);
    setSearchTerm('');
  };

  if (!user) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isSpecificReport ? 'Relatório Específico' : 'Relatórios de Entrevistas'}
          </h1>
          <p className="text-gray-500">
            {isSpecificReport 
              ? 'Visualize os detalhes deste relatório específico'
              : 'Gerencie e visualize os relatórios de entrevistas dos candidatos'
            }
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Seletor de cliente para masters */}
          {user?.role === 'master' && !isSpecificReport && (
            <Select value={selectedClientId || ''} onValueChange={setSelectedClientId}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
              <SelectContent>
                {Array.isArray(clients) && clients.map((client: any) => (
                  <SelectItem key={client.id} value={client.id.toString()}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {!isSpecificReport ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
            <TabsTrigger value="candidatos" disabled={!selectedSelection}>Candidatos</TabsTrigger>
            <TabsTrigger value="analise" disabled={!selectedSelection}>Análise por Score</TabsTrigger>
            <TabsTrigger value="categorias" disabled={!selectedSelection}>Selecionados por Categoria</TabsTrigger>
          </TabsList>

          <TabsContent value="relatorios" className="space-y-6">
            {loadingSelections ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-500">Carregando relatórios...</p>
                </div>
              </div>
            ) : selectionsToShow.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum relatório encontrado</h3>
                  <p className="text-gray-500">
                    {user?.role === 'master' 
                      ? 'Selecione um cliente para ver os relatórios ou não há seleções criadas ainda.'
                      : 'Não há seleções de entrevistas criadas ainda.'
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {selectionsToShow
                  .sort((a: any, b: any) => {
                    const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                    const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                    return bDate.getTime() - aDate.getTime();
                  })
                  .map((selection: any) => {
                    if (!selection) return null;
                    
                    return (
                      <Card key={selection.id} className="cursor-pointer hover:shadow-md transition-shadow">
                        <CardContent className="p-6" onClick={() => handleSelectionClick(selection)}>
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-semibold text-gray-900">{selection.name}</h3>
                                <Badge variant={selection.status === 'completed' ? 'default' : 'secondary'}>
                                  {selection.status === 'completed' ? 'Concluído' : 'Em andamento'}
                                </Badge>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <Calendar className="h-4 w-4" />
                                  {(() => {
                                    const date = selection.createdAt?.toDate ? selection.createdAt.toDate() : new Date(selection.createdAt);
                                    return date.toLocaleDateString('pt-BR');
                                  })()}
                                </div>
                                
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <Users className="h-4 w-4" />
                                  {selection.totalCandidates || 0} candidatos
                                </div>
                                
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <TrendingUp className="h-4 w-4" />
                                  {selection.completedInterviews || 0}/{selection.totalCandidates || 0} finalizados
                                  {(() => {
                                    const completed = selection.completedInterviews || 0;
                                    const total = selection.totalCandidates || 1;
                                    const percentage = Math.round((completed / total) * 100);
                                    return ` (${percentage}%)`;
                                  })()}
                                </div>
                              </div>
                              
                              {/* Barra de progresso */}
                              <div className="space-y-2">
                                <div className="bg-gray-200 rounded-full h-1.5 mt-1">
                                  <div 
                                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                                    style={{ 
                                      width: `${Math.round(((selection.completedInterviews || 0) / Math.max(selection.totalCandidates || 1, 1)) * 100)}%` 
                                    }}
                                  ></div>
                                </div>
                                
                                <div className="text-xs text-gray-400 mt-1">
                                  {Math.round(((selection.completedInterviews || 0) / Math.max(selection.totalCandidates || 1, 1)) * 100)}% concluído
                                </div>
                              </div>
                            </div>
                            
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectionClick(selection);
                              }}
                            >
                              Ver Relatório
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="candidatos" className="space-y-6">
            <div className="text-center py-12">
              <p className="text-gray-500">Funcionalidade de candidatos será implementada aqui.</p>
            </div>
          </TabsContent>

          <TabsContent value="analise" className="space-y-6">
            <div className="text-center py-12">
              <p className="text-gray-500">Funcionalidade de análise por score será implementada aqui.</p>
            </div>
          </TabsContent>

          <TabsContent value="categorias" className="space-y-6">
            <div className="text-center py-12">
              <p className="text-gray-500">Funcionalidade de categorização será implementada aqui.</p>
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500">Visualização de relatório específico será implementada aqui.</p>
        </div>
      )}
    </div>
  );
}