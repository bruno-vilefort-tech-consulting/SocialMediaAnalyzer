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
  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ['/api/clients'],
    enabled: user?.role === 'master'
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

  // Buscar seleções com cache otimizado
  const { data: selectionsData = [], isLoading: loadingSelections } = useQuery<any[]>({
    queryKey: ['/api/selections', selectedClientId],
    enabled: !!selectedClientId || user?.role === 'client',
    staleTime: 10 * 60 * 1000, // Cache por 10 minutos
    gcTime: 30 * 60 * 1000, // Manter em cache por 30 minutos (v5)
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  // Efeito para selecionar seleção automaticamente se especificada na URL
  useEffect(() => {
    if (selectedSelectionId && selectionsData.length > 0) {
      const selection = selectionsData.find((s: any) => s.id.toString() === selectedSelectionId);
      if (selection) {
        setSelectedSelection(selection);
      }
    }
  }, [selectedSelectionId, selectionsData, user]);

  // Query para buscar estatísticas - DESABILITADA (dados serão carregados sob demanda)
  const { data: interviewStats = {}, isLoading: loadingStats } = useQuery<Record<number, any>>({
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
  const { data: interviewCandidates = [], isLoading: loadingCandidates } = useQuery<InterviewCandidate[]>({
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

  // Buscar TODOS os candidatos da lista - APENAS quando aba analise for ativa
  const { data: allCandidatesInList = [], isLoading: loadingAllCandidates } = useQuery<any[]>({
    queryKey: ['selection-all-candidates', selectedSelection?.id],
    queryFn: async () => {
      if (!selectedSelection) return [];
      
      try {
        // Buscar dados da seleção para obter o listId
        const selectionRes = await apiRequest(`/api/selections/${selectedSelection.id}`, 'GET');
        const selectionData = await selectionRes.json();
        
        if (!selectionData.listId) return [];
        
        // Buscar todos os candidatos da lista
        const candidatesRes = await apiRequest(`/api/candidate-lists/${selectionData.listId}/candidates`, 'GET');
        const candidatesData = await candidatesRes.json();
        
        return Array.isArray(candidatesData) ? candidatesData : [];
      } catch (error) {
        console.error('Error fetching all candidates in list:', error);
        return [];
      }
    },
    enabled: !!selectedSelection && activeTab === 'analise', // APENAS quando necessário
    staleTime: 15 * 60 * 1000, // Cache por 15 minutos
    gcTime: 60 * 60 * 1000, // Manter em cache por 1 hora
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  // Detectar clientId para usuários cliente
  useEffect(() => {
    if (user?.role === 'client' && user.clientId) {
      setSelectedClientId(user.clientId.toString());
    }
  }, [user]);

  // Query para buscar categorias - APENAS quando aba analise for ativa
  const { data: categories = [], isLoading: categoriesLoading, error: categoriesError } = useQuery<any[]>({
    queryKey: ['/api/candidate-categories', selectedSelection?.id],
    queryFn: async () => {
      if (!selectedSelection) {
        return [];
      }
      const response = await apiRequest(`/api/candidate-categories?selectionId=${selectedSelection.id}`, 'GET');
      const data = await response.json();
      return data || [];
    },
    enabled: !!selectedSelection && activeTab === 'analise', // APENAS quando necessário
    staleTime: 15 * 60 * 1000, // Cache por 15 minutos
    gcTime: 60 * 60 * 1000, // Manter em cache por 1 hora
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  // Função para obter categoria do candidato diretamente dos dados carregados
  const getCandidateCategory = (candidateId: number): string | null => {
    if (!selectedSelection) return null;
    
    // Verificar primeiro no estado local (para resposta imediata após clique)
    const localKey = `selection_${selectedSelection.id}_${candidateId}`;
    const localCategory = candidateCategories[localKey];
    
    // Verificar nos dados carregados do Firebase (se disponível e é array)
    if (Array.isArray(categories) && categories.length > 0) {
      const reportId = `selection_${selectedSelection.id}`;
      
      const categoryEntry = categories.find(cat => cat.reportId === reportId && cat.candidateId === candidateId);
      if (categoryEntry) {
        return categoryEntry.category;
      }
    }
    
    // Retornar categoria local se encontrada
    if (localCategory) {
      return localCategory;
    }
    
    return null;
  };

  // Mutation para salvar categoria
  const saveCategoryMutation = useMutation({
    mutationFn: async ({ candidateId, category }: { candidateId: number; category: string }) => {
      if (!selectedSelection) throw new Error('Nenhuma seleção selecionada');
      
      const response = await apiRequest('/api/candidate-categories', 'POST', {
        reportId: `selection_${selectedSelection.id}`,
        candidateId: candidateId,
        category: category
      });
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidar cache das categorias
      queryClient.invalidateQueries({ queryKey: ['/api/candidate-categories'] });
    }
  });

  // Função para atualizar categoria do candidato
  const updateCandidateCategory = (candidateId: number, category: string) => {
    if (!selectedSelection) return;
    
    // Atualizar estado local imediatamente para resposta rápida
    const localKey = `selection_${selectedSelection.id}_${candidateId}`;
    setCandidateCategories(prev => ({
      ...prev,
      [localKey]: category
    }));
    
    // Salvar no Firebase
    saveCategoryMutation.mutate({ candidateId, category });
  };

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
        const stats = interviewStats[selection.id];
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

  // Processamento de dados para análise por score
  const processDataForAnalysis = () => {
    if (!interviewCandidates || !Array.isArray(interviewCandidates)) return [];
    
    return interviewCandidates.map((candidate: any) => {
      const candidateWithResponses = candidate;
      
      if (!candidateWithResponses.responses || candidateWithResponses.responses.length === 0) {
        return {
          ...candidateWithResponses,
          calculatedScore: 0
        };
      }
      
      // Calcular score total das respostas
      const totalScore = candidateWithResponses.responses.reduce((sum: number, r: any) => {
        return sum + (r.score || 0);
      }, 0) / candidateWithResponses.responses.length;
      
      return {
        ...candidateWithResponses,
        calculatedScore: totalScore
      };
    });
  };

  // Processamento de dados para análise por score (todos os candidatos da lista)
  const processAllCandidatesForAnalysis = () => {
    if (!allCandidatesInList || !Array.isArray(allCandidatesInList)) return [];
    
    return allCandidatesInList.map((candidate: any) => {
      // Buscar dados de entrevista se existir
      const interviewCandidate = interviewCandidates.find((ic: any) => ic.candidate.id === candidate.id);
      
      if (interviewCandidate && interviewCandidate.responses && interviewCandidate.responses.length > 0) {
        // Candidato com entrevista - calcular score
        const totalScore = interviewCandidate.responses.reduce((sum: number, r: any) => {
          return sum + (r.score || 0);
        }, 0) / interviewCandidate.responses.length;
        
        return {
          ...candidate,
          hasInterview: true,
          calculatedScore: totalScore,
          responses: interviewCandidate.responses,
          interview: interviewCandidate.interview
        };
      } else {
        // Candidato sem entrevista
        return {
          ...candidate,
          hasInterview: false,
          calculatedScore: 0,
          responses: [],
          interview: null
        };
      }
    });
  };

  // Filtrar candidatos por busca
  const filteredCandidates = useMemo(() => {
    const processed = processDataForAnalysis();
    
    if (!searchTerm) return processed;
    
    return processed.filter((candidate: any) => 
      candidate.candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      candidate.candidate.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      candidate.candidate.phone.includes(searchTerm)
    );
  }, [interviewCandidates, searchTerm]);

  // Ordenar candidatos por score
  const sortedCandidates = useMemo(() => {
    return filteredCandidates.sort((a: any, b: any) => b.calculatedScore - a.calculatedScore);
  }, [filteredCandidates]);

  // Paginação
  const totalPages = Math.ceil(sortedCandidates.length / itemsPerPage);
  const paginatedCandidates = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedCandidates.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedCandidates, currentPage, itemsPerPage]);

  // Dados para categorização (todos os candidatos da lista)
  const candidatesForCategorization = useMemo(() => {
    return processAllCandidatesForAnalysis();
  }, [allCandidatesInList, interviewCandidates]);

  // Separar candidatos por categoria
  const candidatesByCategory = useMemo(() => {
    const categorized = {
      'Melhor': [] as any[],
      'Mediano': [] as any[],
      'Em dúvida': [] as any[],
      'Reprovado': [] as any[]
    };

    candidatesForCategorization.forEach((candidate: any) => {
      const category = getCandidateCategory(candidate.id);
      
      if (category && category in categorized) {
        categorized[category as keyof typeof categorized].push(candidate);
      } else {
        // Candidatos sem categoria ou sem resposta vão para "Reprovado" por padrão
        if (!candidate.hasInterview) {
          categorized['Reprovado'].push(candidate);
        } else {
          // Categorizar automaticamente baseado no score se não tiver categoria manual
          const score = candidate.calculatedScore || 0;
          if (score >= 80) {
            categorized['Melhor'].push(candidate);
          } else if (score >= 60) {
            categorized['Mediano'].push(candidate);
          } else if (score >= 40) {
            categorized['Em dúvida'].push(candidate);
          } else {
            categorized['Reprovado'].push(candidate);
          }
        }
      }
    });

    return categorized;
  }, [candidatesForCategorization, categories, candidateCategories, selectedSelection]);

  // Criar dados para mock
  const createMockData = () => {
    if (!selectedSelection) return [];
    
    const mockSelection = {
      ...selectedSelection,
      totalCandidates: interviewCandidates.length,
      completedInterviews: interviewCandidates.filter((c: any) => 
        c.responses && c.responses.length > 0 && 
        c.responses.every((r: any) => r.transcription && r.transcription !== "Aguardando resposta via WhatsApp")
      ).length
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

  // Buscar relatório específico se necessário
  const specificReport = useMemo(() => {
    if (!reportData) return null;
    
    return {
      id: reportData.id,
      name: reportData.name || 'Relatório Específico',
      status: reportData.status || 'completed',
      createdAt: reportData.createdAt,
      jobName: reportData.jobName,
      clientId: reportData.clientId,
      completedInterviews: reportData.candidatesData?.filter((c: any) => 
        c.responseData && c.responseData.length > 0 && 
        c.responseData.every((r: any) => r.transcription && r.transcription !== "Aguardando resposta via WhatsApp")
      ).length || 0,
      totalCandidates: reportData.candidatesData?.length || 0
    };
  }, [reportData]);

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
                {(clients as any[]).map((client: any) => (
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
                                  {(selection as any).totalCandidates || 0} candidatos
                                </div>
                                
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <TrendingUp className="h-4 w-4" />
                                  {(selection as any).completedInterviews || 0}/
                                  {(selection as any).completedInterviews || 0} finalizados
                                  {/* Calcular porcentagem de finalização */}
                                  {(() => {
                                    const completed = (selection as any).completedInterviews || 0;
                                    const total = interviewCandidates.filter((r: any) => 
                                      r.candidate && r.interview && r.responses && r.responses.length > 0
                                    ).length || 1;
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
                                      width: `${Math.round((((selection as any).completedInterviews || 0) / Math.max((selection as any).totalCandidates || 1, 1)) * 100)}%` 
                                    }}
                                  ></div>
                                </div>
                                
                                <div className="text-xs text-gray-400 mt-1">
                                  {Math.round((((selection as any).completedInterviews || 0) / Math.max((selection as any).totalCandidates || 1, 1)) * 100)}% concluído
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

          {/* Rest of the tabs content... */}
          <TabsContent value="candidatos" className="space-y-6">
            {/* Candidatos tab content would go here */}
          </TabsContent>

          <TabsContent value="analise" className="space-y-6">
            {/* Analise tab content would go here */}
          </TabsContent>

          <TabsContent value="categorias" className="space-y-6">
            {/* Categorias tab content would go here */}
          </TabsContent>
        </Tabs>
      ) : (
        // Specific report view would go here
        <div>Specific report view placeholder</div>
      )}
    </div>
  );
}

