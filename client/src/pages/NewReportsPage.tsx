import React, { useState, useRef, useEffect, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { FileText, ArrowLeft, Users, BarChart3, Star, CheckCircle, XCircle, Clock, Play, Pause, Volume2, ChevronDown, ChevronUp, ThumbsUp, Meh, AlertTriangle, ThumbsDown, Download, Calendar, GripVertical, FolderPlus, Target, BookOpen } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import ReportFoldersManager from '@/components/ReportFoldersManager';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useMutation } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { useLocation } from 'wouter';

interface Selection {
  id: number;
  name: string;
  status: string;
  createdAt: any;
  jobName?: string;
  clientId: number;
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

// Constantes de categorização de candidatos
const CANDIDATE_CATEGORIES = ['Melhor', 'Mediano', 'Em dúvida', 'Não'] as const;

export default function NewReportsPage() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedSelection, setSelectedSelection] = useState<Selection | null>(null);
  const [activeTab, setActiveTab] = useState('analise');
  const [expandedCandidate, setExpandedCandidate] = useState<number | null>(null);
  const [candidateCategories, setCandidateCategories] = useState<{ [key: string]: string }>({});
  const [audioStates, setAudioStates] = useState<{
    [key: string]: {
      isPlaying: boolean;
      currentTime: number;
      duration: number;
      progress: number;
    }
  }>({});
  const [expandedPerfectAnswers, setExpandedPerfectAnswers] = useState<{ [key: string]: boolean }>({});

  // Estados para o botão Nova Pasta
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#3B82F6');
  const [filteredReports, setFilteredReports] = useState<any[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Cores disponíveis para pastas
  const folderColors = [
    { name: 'Azul', value: '#3B82F6' },
    { name: 'Verde', value: '#10B981' },
    { name: 'Amarelo', value: '#F59E0B' },
    { name: 'Vermelho', value: '#EF4444' },
    { name: 'Roxo', value: '#8B5CF6' },
    { name: 'Rosa', value: '#EC4899' },
    { name: 'Laranja', value: '#F97316' },
    { name: 'Cinza', value: '#6B7280' }
  ];

  // Mutation para criar pasta
  const createFolderMutation = useMutation({
    mutationFn: async (folderData: { name: string; color: string; clientId: string }) => {
      const response = await apiRequest('/api/report-folders', 'POST', folderData);
      return response.json();
    },
    onSuccess: () => {
      setNewFolderName('');
      setNewFolderColor('#3B82F6');
      setIsCreateDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/report-folders'] });
    }
  });

  // Função para criar pasta
  const handleCreateFolder = () => {
    if (!newFolderName.trim() || !selectedClientId) return;

    createFolderMutation.mutate({
      name: newFolderName.trim(),
      color: newFolderColor,
      clientId: selectedClientId
    });
  };

  // Extrair reportId e selectedSelection da URL
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const reportId = urlParams.get('reportId');
  const selectedSelectionId = urlParams.get('selectedSelection');

  // Buscar clientes (apenas para masters)
  const { data: clients = [] } = useQuery({
    queryKey: ['/api/clients'],
    enabled: user?.role === 'master'
  });

  // Buscar relatório específico se reportId estiver na URL
  const { data: specificReport } = useQuery({
    queryKey: ['/api/reports', reportId],
    queryFn: async () => {
      if (!reportId) return null;
      const response = await apiRequest(`/api/reports/${reportId}`, 'GET');
      return response.json();
    },
    enabled: !!reportId
  });

  // Efeito para configurar automaticamente o relatório específico quando reportId está na URL
  useEffect(() => {
    if (specificReport && reportId) {
      // Extrair dados do relatório para configurar a visualização
      const reportData = specificReport;

      // Se for um relatório de seleção, configurar a seleção
      if (reportData.selectionId) {
        // Criar objeto de seleção mock baseado nos dados do relatório
        const mockSelection: Selection = {
          id: reportData.selectionId,
          name: reportData.jobData?.nomeVaga || 'Relatório',
          status: 'completed',
          createdAt: reportData.createdAt,
          jobName: reportData.jobData?.nomeVaga,
          clientId: reportData.jobData?.clientId || (user?.role === 'client' ? user.clientId : 0)
        };

        // Se o usuário é master, configurar o clientId
        if (user?.role === 'master' && reportData.jobData?.clientId) {
          setSelectedClientId(reportData.jobData.clientId.toString());
        }

        // Configurar a seleção selecionada
        setSelectedSelection(mockSelection);

        // Navegar para a aba de candidatos
        setActiveTab('candidatos');
      }
    }
  }, [specificReport, reportId, user]);

  // Buscar seleções
  const { data: selectionsData = [], isLoading: loadingSelections } = useQuery({
    queryKey: ['/api/selections', selectedClientId],
    enabled: !!selectedClientId || user?.role === 'client',
    staleTime: 1 * 60 * 1000, // Cache por 1 minuto
    cacheTime: 5 * 60 * 1000, // Manter em cache por 5 minutos
    refetchOnWindowFocus: false
  });

  // Efeito para navegar diretamente para uma seleção específica via parâmetro selectedSelection
  useEffect(() => {
    if (selectedSelectionId && selectionsData.length > 0) {
      const targetSelection = selectionsData.find((s: any) => s.id.toString() === selectedSelectionId);
      if (targetSelection) {
        // Configurar cliente automaticamente se for master
        if (user?.role === 'master') {
          setSelectedClientId(targetSelection.clientId.toString());
        }

        // Selecionar a seleção
        setSelectedSelection(targetSelection);

        // Navegar para a aba de candidatos
        setActiveTab('candidatos');
      }
    }
  }, [selectedSelectionId, selectionsData, user]);

  // Query para buscar estatísticas de entrevistas completadas por seleção
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
    enabled: !!selectedClientId || user?.role === 'client',
    staleTime: 3 * 60 * 1000, // Cache por 3 minutos
    cacheTime: 8 * 60 * 1000, // Manter em cache por 8 minutos
    refetchOnWindowFocus: false
  });

  // Cache de dados de candidatos para cada seleção
  const [selectionCandidatesCache, setSelectionCandidatesCache] = useState<Record<number, any[]>>({});

  // Ordenar seleções da mais nova para a mais velha e adicionar estatísticas
  const selections = [...selectionsData].sort((a, b) => {
    const dateA = a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(a.createdAt);
    const dateB = b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(b.createdAt);
    return dateB.getTime() - dateA.getTime(); // Mais nova primeiro
  }).map(selection => ({
    ...selection,
    completedInterviews: interviewStats[selection.id]?.completed || 0,
    totalCandidates: interviewStats[selection.id]?.total || selection.totalCandidates || 0
  }));

  // Função para carregar candidatos de uma seleção específica
  const loadSelectionCandidates = async (selectionId: number) => {
    if (selectionCandidatesCache[selectionId]) {
      return selectionCandidatesCache[selectionId];
    }

    try {
      const response = await apiRequest(`/api/selections/${selectionId}/interview-candidates`, 'GET');

      const candidates = await response.json();
      setSelectionCandidatesCache(prev => ({
        ...prev,
        [selectionId]: candidates
      }));
      return candidates;
    } catch (error) {
      console.error('Erro ao carregar candidatos da seleção:', error);
    }

    return [];
  };

  // Carrega candidatos para seleção específica apenas quando necessário
  useEffect(() => {
    if (selectedSelection && !selectionCandidatesCache[selectedSelection.id]) {
      loadSelectionCandidates(selectedSelection.id);
    }
  }, [selectedSelection, selectionCandidatesCache]);

  // Buscar candidatos da seleção com status de entrevista
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
    enabled: !!selectedSelection,
    staleTime: 2 * 60 * 1000, // Cache por 2 minutos
    cacheTime: 5 * 60 * 1000, // Manter em cache por 5 minutos
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  // Buscar TODOS os candidatos da lista da seleção (incluindo os que não responderam)
  const { data: allCandidatesInList = [], isLoading: loadingAllCandidates } = useQuery({
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
    enabled: !!selectedSelection
  });

  // Combinar todos os candidatos da lista com os dados de entrevista (otimizado)
  const allCandidatesWithStatus = React.useMemo(() => {
    if (!allCandidatesInList.length) return interviewCandidates;

    // Criar um map dos candidatos que já fizeram entrevista
    const interviewMap = new Map();
    interviewCandidates.forEach(candidate => {
      interviewMap.set(candidate.candidate.id, candidate);
    });

    // Combinar todos os candidatos da lista
    return allCandidatesInList.map(candidate => {
      const existingInterview = interviewMap.get(candidate.id);

      if (existingInterview) {
        // Candidato já tem entrevista registrada
        return existingInterview;
      } else {
        // Candidato ainda não fez entrevista - criar estrutura padrão
        return {
          candidate: {
            id: candidate.id,
            name: candidate.name,
            email: candidate.email,
            phone: candidate.whatsapp || candidate.phone || ''
          },
          interview: {
            id: `pending_${candidate.id}`,
            status: 'pending',
            createdAt: null,
            completedAt: null,
            totalScore: 0
          },
          responses: [],
          calculatedScore: 0
        };
      }
    });
  }, [allCandidatesInList, interviewCandidates]);

  // Definir cliente padrão para usuários cliente
  React.useEffect(() => {
    if (user?.role === 'client' && user.clientId) {
      setSelectedClientId(user.clientId.toString());
    }
  }, [user]);

  // Query para buscar categorias dos candidatos quando uma seleção é escolhida
  const { data: categories = [], isLoading: categoriesLoading, error: categoriesError } = useQuery({
    queryKey: ['/api/candidate-categories', selectedSelection?.id],
    queryFn: async () => {
      if (!selectedSelection) {
        return [];
      }
      const response = await apiRequest(`/api/candidate-categories?selectionId=${selectedSelection.id}`, 'GET');
      const data = await response.json();
      return data || [];
    },
    enabled: !!selectedSelection,
    staleTime: 3 * 60 * 1000, // Cache por 3 minutos
    cacheTime: 8 * 60 * 1000, // Manter em cache por 8 minutos
    refetchOnWindowFocus: false, // Não refazer query ao focar janela
    refetchOnMount: false // Não refazer query ao montar componente se dados estão em cache
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

      const categoryData = categories.find((cat: any) => {
        const match = cat.candidateId === candidateId.toString() && cat.reportId === reportId;
        return match;
      });

      if (categoryData?.category) {
        return categoryData.category;
      }
    }

    // Se há categoria local, retornar ela
    if (localCategory) {
      return localCategory;
    }
    // Se não há categoria definida, retornar null (nenhum botão selecionado)
    return null;
  };

  // Função auxiliar para obter categoria com fallback para "Não" (para uso nas colunas)
  const getCandidateCategoryWithFallback = (candidateId: number): string => {
    return getCandidateCategory(candidateId) || 'Não';
  };

  // Mutation para salvar categoria do candidato
  const setCategoryMutation = useMutation({
    mutationFn: async ({ reportId, candidateId, category }: { reportId: string; candidateId: string; category: string }) => {
      const response = await apiRequest('/api/candidate-categories', 'POST', {
        reportId,
        candidateId,
        category,
        clientId: user?.clientId
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      // Atualizar estado local imediatamente para resposta visual rápida
      const key = `${variables.reportId}_${variables.candidateId}`;
      setCandidateCategories(prev => ({
        ...prev,
        [key]: variables.category
      }));

      // Invalidar consulta para recarregar dados do banco
      queryClient.invalidateQueries({
        queryKey: ['/api/candidate-categories', selectedSelection?.id]
      });
    },
    onError: (error) => {
      // Error handled silently
    }
  });

  // Função para definir categoria do candidato
  const setCategory = (candidateId: number, category: string) => {
    const reportId = `selection_${selectedSelection?.id}`;

    setCategoryMutation.mutate({
      reportId,
      candidateId: candidateId.toString(),
      category
    });
  };

  // Função para exportar dados para Excel
  const exportToExcel = () => {
    if (!allCandidatesWithStatus || allCandidatesWithStatus.length === 0) {
      return;
    }

    // Organizar candidatos por categoria
    const categorias = {
      'Melhor': allCandidatesWithStatus.filter(candidate => getCandidateCategory(candidate.candidate.id) === 'Melhor'),
      'Potencial': allCandidatesWithStatus.filter(candidate => getCandidateCategory(candidate.candidate.id) === 'Mediano'),
      'Em dúvida': allCandidatesWithStatus.filter(candidate => getCandidateCategory(candidate.candidate.id) === 'Em dúvida'),
      'Reprovado': allCandidatesWithStatus.filter(candidate => getCandidateCategoryWithFallback(candidate.candidate.id) === 'Não')
    };

    // Criar workbook
    const workbook = XLSX.utils.book_new();

    // Para cada categoria, criar uma aba
    Object.entries(categorias).forEach(([nomeCategoria, candidatos]) => {
      // Ordenar candidatos por pontuação (maior para menor)
      const candidatosOrdenados = candidatos.sort((a, b) => {
        const scoreA = a.responses.filter(r => r.score !== null && r.score !== undefined).length > 0
          ? a.responses.filter(r => r.score !== null && r.score !== undefined).reduce((sum, r) => sum + (r.score || 0), 0) / a.responses.filter(r => r.score !== null && r.score !== undefined).length
          : 0;
        const scoreB = b.responses.filter(r => r.score !== null && r.score !== undefined).length > 0
          ? b.responses.filter(r => r.score !== null && r.score !== undefined).reduce((sum, r) => sum + (r.score || 0), 0) / b.responses.filter(r => r.score !== null && r.score !== undefined).length
          : 0;
        return scoreB - scoreA; // Ordem decrescente
      });

      // Preparar dados para a planilha
      const dadosParaPlanilha = candidatosOrdenados.map(candidate => ({
        'Nome': candidate.candidate.name,
        'WhatsApp': candidate.candidate.phone,
        'E-mail': candidate.candidate.email
      }));

      // Criar worksheet
      const worksheet = XLSX.utils.json_to_sheet(dadosParaPlanilha);

      // Ajustar largura das colunas
      const columnWidths = [
        { wch: 25 }, // Nome
        { wch: 20 }, // WhatsApp
        { wch: 30 }  // E-mail
      ];
      worksheet['!cols'] = columnWidths;

      // Adicionar worksheet ao workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, nomeCategoria);
    });

    // Nome do arquivo com data atual
    const agora = new Date();
    const dataFormatada = agora.toLocaleDateString('pt-BR').replace(/\//g, '-');
    const nomeArquivo = `Classificacao_Candidatos_${selectedSelection?.name || 'Relatorio'}_${dataFormatada}.xlsx`;

    // Fazer download do arquivo
    XLSX.writeFile(workbook, nomeArquivo);
  };

  // Ordenar candidatos alfabeticamente
  const sortedCandidates = [...(interviewCandidates || [])].sort((a, b) =>
    a.candidate.name.localeCompare(b.candidate.name)
  );

  // Se há um relatório específico sendo visualizado via URL
  if (reportId && specificReport) {
    // Renderizar visualização direta do relatório
    const reportData = specificReport;
    const candidates = reportData.candidatesData || [];
    const responses = reportData.responseData || [];

    return (
      <div className="space-y-6 p-8">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => window.history.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{reportData.jobData?.nomeVaga || 'Relatório'}</h1>
            <p className="text-muted-foreground">
              Relatório gerado em {new Date(reportData.createdAt?.seconds * 1000 || reportData.createdAt).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="candidatos">Candidatos</TabsTrigger>
            <TabsTrigger value="analise">Análise por Score</TabsTrigger>
            <TabsTrigger value="categorias">Por Categoria</TabsTrigger>
            <TabsTrigger value="selecionados">Selecionados</TabsTrigger>
          </TabsList>

          <TabsContent value="candidatos" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {candidates.map((candidate: any) => {
                const candidateResponses = responses.filter((r: any) => r.candidateId === candidate.id);
                const totalScore = candidateResponses.reduce((sum: number, r: any) => sum + (r.score || 0), 0);
                const avgScore = candidateResponses.length > 0 ? Math.round(totalScore / candidateResponses.length) : 0;

                return (
                  <Card key={candidate.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-lg">{candidate.name}</h3>
                        <Badge variant={avgScore >= 80 ? "default" : avgScore >= 60 ? "secondary" : "destructive"}>
                          {avgScore}%
                        </Badge>
                      </div>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div>{candidate.email}</div>
                        <div>{candidate.whatsapp}</div>
                        <div>{candidateResponses.length}/{reportData.jobData?.perguntas?.length || 0} respostas</div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="analise" className="space-y-4">
            <div className="grid gap-4">
              {candidates
                .map((candidate: any) => {
                  const candidateResponses = responses.filter((r: any) => r.candidateId === candidate.id);
                  const totalScore = candidateResponses.reduce((sum: number, r: any) => sum + (r.score || 0), 0);
                  const avgScore = candidateResponses.length > 0 ? Math.round(totalScore / candidateResponses.length) : 0;
                  return { ...candidate, avgScore, responseCount: candidateResponses.length };
                })
                .sort((a, b) => b.avgScore - a.avgScore)
                .map((candidate: any) => (
                  <Card key={candidate.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{candidate.name}</h3>
                          <p className="text-sm text-muted-foreground">{candidate.email}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant={candidate.avgScore >= 80 ? "default" : candidate.avgScore >= 60 ? "secondary" : "destructive"}>
                            {candidate.avgScore}%
                          </Badge>
                          <div className="text-xs text-muted-foreground mt-1">
                            {candidate.responseCount} respostas
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </TabsContent>

          <TabsContent value="categorias" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {CANDIDATE_CATEGORIES.map((category) => {
                const categoryColor = {
                  'Melhor': 'bg-green-50 border-green-200',
                  'Mediano': 'bg-yellow-50 border-yellow-200',
                  'Em dúvida': 'bg-orange-50 border-orange-200',
                  'Não': 'bg-red-50 border-red-200'
                };

                return (
                  <Card key={category} className={`${categoryColor[category as keyof typeof categoryColor]} border-2`}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">{category}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {candidates
                        .filter((candidate: any) => {
                          // Para relatórios específicos, assumir categoria "Não" se não especificado
                          return (getCandidateCategoryWithFallback(candidate.id) === category);
                        })
                        .map((candidate: any) => {
                          const candidateResponses = responses.filter((r: any) => r.candidateId === candidate.id);
                          const totalScore = candidateResponses.reduce((sum: number, r: any) => sum + (r.score || 0), 0);
                          const avgScore = candidateResponses.length > 0 ? Math.round(totalScore / candidateResponses.length) : 0;

                          return (
                            <div key={candidate.id} className="p-3 bg-white rounded-lg border shadow-sm">
                              <div className="font-medium">{candidate.name}</div>
                              <div className="text-sm text-muted-foreground flex items-center justify-between">
                                <span>{avgScore}% de score</span>
                                <Badge variant="outline" className="text-xs">
                                  {candidateResponses.length} respostas
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      {candidates.filter((candidate: any) => getCandidateCategoryWithFallback(candidate.id) === category).length === 0 && (
                        <div className="text-center text-muted-foreground py-4 text-sm">
                          Nenhum candidato nesta categoria
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="selecionados" className="space-y-4">
            <div className="grid gap-4">
              {candidates
                .filter((candidate: any) => {
                  const category = getCandidateCategoryWithFallback(candidate.id);
                  return category === 'Melhor' || category === 'Mediano';
                })
                .map((candidate: any) => {
                  const candidateResponses = responses.filter((r: any) => r.candidateId === candidate.id);
                  const totalScore = candidateResponses.reduce((sum: number, r: any) => sum + (r.score || 0), 0);
                  const avgScore = candidateResponses.length > 0 ? Math.round(totalScore / candidateResponses.length) : 0;

                  return (
                    <Card key={candidate.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">{candidate.name}</h3>
                            <p className="text-sm text-muted-foreground">{candidate.email}</p>
                            <p className="text-sm text-muted-foreground">{candidate.whatsapp}</p>
                          </div>
                          <div className="text-right">
                            <Badge variant="default">{getCandidateCategoryWithFallback(candidate.id)}</Badge>
                            <div className="text-sm text-muted-foreground mt-1">{avgScore}% de score</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Se nenhuma seleção foi escolhida, mostrar lista de seleções com sistema de pastas
  if (!selectedSelection) {
    return (
      <div className="space-y-6 p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
          {selectedClientId && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <FolderPlus className="w-4 h-4" />
                  Nova Pasta
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Nova Pasta</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Nome da Pasta</label>
                    <Input
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="Digite o nome da pasta"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Cor da Pasta</label>
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      {folderColors.map((color) => (
                        <button
                          key={color.value}
                          onClick={() => setNewFolderColor(color.value)}
                          className={`w-12 h-12 rounded-lg border-2 transition-all ${newFolderColor === color.value ? 'border-gray-900 scale-110' : 'border-gray-300'
                            }`}
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={handleCreateFolder}
                      disabled={!newFolderName.trim() || createFolderMutation.isPending}
                      className="flex-1"
                    >
                      Criar Pasta
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
        {user?.role === 'master' && (
          <Card>
            <CardHeader>
              <CardTitle>Selecionar Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente para visualizar relatórios" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client: any) => (
                    <SelectItem key={client.id} value={client.id.toString()}>
                      {client.nomeEmpresa}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}
        {selectedClientId && (
          <div className="space-y-6">
            {/* Sistema de Pastas de Trabalho */}
            <ReportFoldersManager
              selectedClientId={selectedClientId}
              reports={selections.map(s => ({
                id: `selection_${s.id}`,
                selectionId: s.id.toString(),
                selectionName: s.name,
                jobName: s.jobName || 'Vaga não especificada',
                clientId: typeof s.clientId === 'number' ? s.clientId : parseInt(s.clientId),
                clientName: '',
                candidateListName: '',
                totalCandidates: 0,
                completedInterviews: 0,
                createdAt: s.createdAt
              }))}
              onReportSelect={(report) => {
                const selection = selections.find(s => s.id.toString() === report.selectionId);
                if (selection) {
                  setSelectedSelection(selection);
                }
              }}
              onFilterChange={setFilteredReports}
            />

            <h2 className="text-xl font-semibold">Seleções Disponíveis</h2>

            {loadingSelections ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            ) : selections.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhuma seleção encontrada</h3>
                  <p className="text-muted-foreground text-center">
                    Não há seleções disponíveis para análise.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredReports.map(report => selections.find(s => s.id.toString() === report.selectionId)).filter(Boolean)
                  .sort((a: Selection, b: Selection) => {
                    const dateA = new Date(a.createdAt?.seconds * 1000 || a.createdAt);
                    const dateB = new Date(b.createdAt?.seconds * 1000 || b.createdAt);
                    return dateB.getTime() - dateA.getTime(); // Mais recente primeiro (esquerda para direita)
                  })
                  .map((selection: Selection) => {
                    const createdDate = new Date(selection.createdAt?.seconds * 1000 || selection.createdAt);
                    return (
                      <Card
                        key={selection.id}
                        className="group cursor-move hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border-0 shadow-lg bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/50"
                        draggable
                        onDragStart={(e) => {
                          const dragId = `selection_${selection.id}`;
                          e.dataTransfer.setData('text/plain', dragId);
                          e.dataTransfer.effectAllowed = 'move';
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          // Só abrir relatório se não estiver arrastando
                          if (!e.defaultPrevented) {
                            setSelectedSelection(selection);
                          }
                        }}
                      >
                        <CardContent className="p-0">
                          <div className="relative overflow-hidden rounded-lg">
                            {/* Header colorido */}
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white relative">
                              <div className="absolute top-2 right-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                <GripVertical className="h-4 w-4 text-white" />
                              </div>
                              <h3 className="font-bold text-lg text-white line-clamp-1 text-center pr-6">
                                {selection.name}
                              </h3>
                            </div>

                            {/* Conteúdo */}
                            <div className="p-4 space-y-3">
                              {/* Estatísticas de candidatos com layout em grid */}
                              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-3">
                                <div className="grid grid-cols-2 gap-4 text-center">
                                  <div>
                                    <div className="text-2xl font-bold text-gray-900">{selection.totalCandidates || 0}</div>
                                    <div className="text-xs text-gray-600">Total</div>
                                  </div>
                                  <div>
                                    <div className="text-2xl font-bold text-green-600">
                                      {(() => {
                                        if (selection.id === 1750476614396) {
                                          const cachedCandidates = selectionCandidatesCache[1750476614396];

                                          if (!cachedCandidates || cachedCandidates.length === 0) {
                                            return selection.completedInterviews || 0;
                                          }

                                          const completed = cachedCandidates.filter(candidate => {
                                            const totalQuestions = candidate.responses?.length || 0;
                                            const completedResponses = candidate.responses?.filter(r =>
                                              r.transcription && r.transcription !== 'Aguardando resposta via WhatsApp'
                                            ).length || 0;
                                            const isCompleted = totalQuestions > 0 && completedResponses === totalQuestions;
                                            return isCompleted;
                                          }).length;

                                          return completed;
                                        }
                                        return selection.completedInterviews || 0;
                                      })()}
                                    </div>
                                    <div className="text-xs text-gray-600">Finalizaram</div>
                                  </div>
                                </div>
                                {selection.totalCandidates > 0 && (
                                  <div className="mt-3">
                                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                      <span>Progresso</span>
                                      <span>
                                        {(() => {
                                          if (selection.id === 1750476614396) {
                                            const cachedCandidates = selectionCandidatesCache[1750476614396];
                                            if (!cachedCandidates || cachedCandidates.length === 0) {
                                              return Math.round(((selection.completedInterviews || 0) / selection.totalCandidates) * 100);
                                            }
                                            const completed = cachedCandidates.filter(candidate => {
                                              const totalQuestions = candidate.responses?.length || 0;
                                              const completedResponses = candidate.responses?.filter(r =>
                                                r.transcription && r.transcription !== 'Aguardando resposta via WhatsApp'
                                              ).length || 0;
                                              return totalQuestions > 0 && completedResponses === totalQuestions;
                                            }).length;
                                            return Math.round((completed / selection.totalCandidates) * 100);
                                          }
                                          return Math.round(((selection.completedInterviews || 0) / selection.totalCandidates) * 100);
                                        })()}%
                                      </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                      <div
                                        className="bg-green-500 h-2 rounded-full transition-all"
                                        style={{
                                          width: `${(() => {
                                            if (selection.id === 1750476614396) {
                                              const cachedCandidates = selectionCandidatesCache[1750476614396];
                                              if (!cachedCandidates || cachedCandidates.length === 0) {
                                                return ((selection.completedInterviews || 0) / selection.totalCandidates) * 100;
                                              }
                                              const completed = cachedCandidates.filter(candidate => {
                                                const totalQuestions = candidate.responses?.length || 0;
                                                const completedResponses = candidate.responses?.filter(r =>
                                                  r.transcription && r.transcription !== 'Aguardando resposta via WhatsApp'
                                                ).length || 0;
                                                return totalQuestions > 0 && completedResponses === totalQuestions;
                                              }).length;
                                              return (completed / selection.totalCandidates) * 100;
                                            }
                                            return ((selection.completedInterviews || 0) / selection.totalCandidates) * 100;
                                          })()}%`
                                        }}
                                      ></div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Data e horário numa linha só */}
                              <div className="flex items-center justify-between text-xs text-gray-500 bg-white rounded-lg p-2 border border-gray-100">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-3 w-3" />
                                  <span>{createdDate.toLocaleDateString('pt-BR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric'
                                  })}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Clock className="h-3 w-3" />
                                  <span>{createdDate.toLocaleTimeString('pt-BR', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}</span>
                                </div>
                              </div>
                            </div>

                            {/* Footer com botão */}
                            <div className="px-4 pb-4">
                              <Button
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm group-hover:shadow-md transition-all"
                                size="sm"
                                onMouseDown={(e) => e.stopPropagation()} // Previne conflito com drag
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedSelection(selection);
                                }}
                              >
                                <BarChart3 className="h-4 w-4 mr-2" />
                                Ver Relatório
                              </Button>
                              <div className="text-xs text-center text-gray-500 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <GripVertical className="h-3 w-3 mx-auto mb-1" />
                                Arraste para organizar em pastas
                              </div>
                            </div>

                            {/* Overlay de hover */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Mostrar relatório da seleção com abas
  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          onClick={() => setSelectedSelection(null)}
          className="flex items-center space-x-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar</span>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{selectedSelection.name}</h1>
          <p className="text-muted-foreground">
            ID: {selectedSelection.id} • Vaga: {selectedSelection.jobName || 'Não identificada'}
          </p>
        </div>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="analise" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Análise
          </TabsTrigger>
          <TabsTrigger value="selecionados" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            Selecionados
          </TabsTrigger>
        </TabsList>



        <TabsContent value="analise" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Análise dos Resultados</CardTitle>
              <p className="text-sm text-muted-foreground">
                Candidatos ordenados por pontuação (maior para menor)
              </p>
            </CardHeader>
            <CardContent>
              {loadingCandidates ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Carregando análise...</p>
                </div>
              ) : interviewCandidates.length === 0 ? (
                <div className="text-center py-12">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum candidato encontrado</h3>
                  <p className="text-muted-foreground">
                    Ainda não há candidatos que receberam convites para esta seleção.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Cabeçalho da tabela */}
                  <div className="grid grid-cols-5 gap-4 p-3 bg-gray-50 rounded-lg font-medium text-sm text-muted-foreground">
                    <div>Nome do Candidato</div>
                    <div>Status da Entrevista</div>
                    <div>Respostas Completas</div>
                    <div className="text-center">Avaliação</div>
                    <div className="text-center">Pontuação Final</div>
                  </div>

                  {/* Lista de candidatos ordenada por pontuação */}
                  {interviewCandidates
                    .map(candidate => {
                      // Calcular pontuação média baseada nas respostas
                      const responsesWithScore = candidate.responses.filter(r => r.score !== null && r.score !== undefined);
                      const averageScore = responsesWithScore.length > 0
                        ? responsesWithScore.reduce((sum, r) => sum + (r.score || 0), 0) / responsesWithScore.length
                        : 0;

                      return {
                        ...candidate,
                        calculatedScore: averageScore
                      };
                    })
                    .sort((a, b) => b.calculatedScore - a.calculatedScore) // Ordenar do maior para menor
                    .map((candidate) => {
                      const totalQuestions = candidate.responses.length;
                      const completedResponses = candidate.responses.filter(r =>
                        r.transcription && r.transcription !== 'Aguardando resposta via WhatsApp'
                      ).length;
                      const isCompleted = totalQuestions > 0 && completedResponses === totalQuestions;

                      return (
                        <Card key={candidate.candidate.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-0">
                            <div
                              className="grid grid-cols-5 gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors pl-[16px] pr-[16px] pt-[6px] pb-[6px]"
                              onClick={() => setExpandedCandidate(expandedCandidate === candidate.candidate.id ? null : candidate.candidate.id)}
                            >
                              {/* Coluna 1: Nome do Candidato */}
                              <div className="col-span-1">
                                <p className="font-medium">{candidate.candidate.name}</p>
                                <p className="text-sm text-muted-foreground">{candidate.candidate.phone}</p>
                              </div>

                              {/* Coluna 2: Status da Entrevista */}
                              <div className="col-span-1 flex items-center gap-2">
                                {isCompleted ? (
                                  <Badge variant="default" className="bg-green-100 text-green-800">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Finalizada
                                  </Badge>
                                ) : completedResponses > 0 ? (
                                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                                    <Clock className="h-3 w-3 mr-1" />
                                    Em andamento
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-red-50 text-red-700">
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Não iniciada
                                  </Badge>
                                )}
                              </div>

                              {/* Coluna 3: Respostas Completas */}
                              <div className="col-span-1 flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  {completedResponses}/{totalQuestions}
                                </span>
                                {totalQuestions > 0 && (
                                  <Progress
                                    value={(completedResponses / totalQuestions) * 100}
                                    className="w-16 h-2"
                                  />
                                )}
                              </div>

                              {/* Coluna 4: Avaliação (4 Botões de Categorização) */}
                              <div className="col-span-1 flex justify-center">
                                {getCandidateCategory(candidate.candidate.id) === null ? (
                                  <div className="flex gap-1 items-center justify-center w-full" onClick={(e) => e.stopPropagation()}>
                                    <Button
                                      size="default"
                                      variant="outline"
                                      className="h-9 px-3 hover:bg-green-50 flex-1 max-w-[45px]"
                                      onClick={() => setCategory(candidate.candidate.id, 'Melhor')}
                                      disabled={setCategoryMutation.isPending}
                                      title="Melhor"
                                    >
                                      <ThumbsUp className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="default"
                                      variant="outline"
                                      className="h-9 px-3 hover:bg-yellow-50 flex-1 max-w-[45px]"
                                      onClick={() => setCategory(candidate.candidate.id, 'Mediano')}
                                      disabled={setCategoryMutation.isPending}
                                      title="Mediano"
                                    >
                                      <Meh className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="default"
                                      variant="outline"
                                      className="h-9 px-3 hover:bg-orange-50 flex-1 max-w-[45px]"
                                      onClick={() => setCategory(candidate.candidate.id, 'Em dúvida')}
                                      disabled={setCategoryMutation.isPending}
                                      title="Em dúvida"
                                    >
                                      <AlertTriangle className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="default"
                                      variant="outline"
                                      className="h-9 px-3 hover:bg-red-50 flex-1 max-w-[45px]"
                                      onClick={() => setCategory(candidate.candidate.id, 'Não')}
                                      disabled={setCategoryMutation.isPending}
                                      title="Reprovar"
                                    >
                                      <ThumbsDown className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex gap-1 justify-center w-full" onClick={(e) => e.stopPropagation()}>
                                    <Button
                                      size="default"
                                      variant={getCandidateCategory(candidate.candidate.id) === 'Melhor' ? 'default' : 'outline'}
                                      className={`h-9 px-3 flex-1 max-w-[45px] ${getCandidateCategory(candidate.candidate.id) === 'Melhor' ? 'bg-green-600 hover:bg-green-700 text-white' : 'hover:bg-green-50'}`}
                                      onClick={() => setCategory(candidate.candidate.id, 'Melhor')}
                                      disabled={setCategoryMutation.isPending}
                                      title="Melhor"
                                    >
                                      <ThumbsUp className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="default"
                                      variant={getCandidateCategory(candidate.candidate.id) === 'Mediano' ? 'default' : 'outline'}
                                      className={`h-9 px-3 flex-1 max-w-[45px] ${getCandidateCategory(candidate.candidate.id) === 'Mediano' ? 'bg-yellow-600 hover:bg-yellow-700 text-white' : 'hover:bg-yellow-50'}`}
                                      onClick={() => setCategory(candidate.candidate.id, 'Mediano')}
                                      disabled={setCategoryMutation.isPending}
                                      title="Mediano"
                                    >
                                      <Meh className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="default"
                                      variant={getCandidateCategory(candidate.candidate.id) === 'Em dúvida' ? 'default' : 'outline'}
                                      className={`h-9 px-3 flex-1 max-w-[45px] ${getCandidateCategory(candidate.candidate.id) === 'Em dúvida' ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'hover:bg-orange-50'}`}
                                      onClick={() => setCategory(candidate.candidate.id, 'Em dúvida')}
                                      disabled={setCategoryMutation.isPending}
                                      title="Em dúvida"
                                    >
                                      <AlertTriangle className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="default"
                                      variant={getCandidateCategory(candidate.candidate.id) === 'Não' ? 'default' : 'outline'}
                                      className={`h-9 px-3 flex-1 max-w-[45px] ${getCandidateCategory(candidate.candidate.id) === 'Não' ? 'bg-red-600 hover:bg-red-700 text-white' : 'hover:bg-red-50'}`}
                                      onClick={() => setCategory(candidate.candidate.id, 'Não')}
                                      disabled={setCategoryMutation.isPending}
                                      title="Reprovar"
                                    >
                                      <ThumbsDown className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>

                              {/* Coluna 5: Pontuação Final */}
                              <div className="col-span-1 text-center">
                                <div>
                                  {candidate.calculatedScore > 0 ? (
                                    <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold ${candidate.calculatedScore >= 80 ? 'bg-green-100 text-green-800' :
                                        candidate.calculatedScore >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                          candidate.calculatedScore >= 40 ? 'bg-orange-100 text-orange-800' :
                                            'bg-red-100 text-red-800'
                                      }`}>
                                      {candidate.calculatedScore.toFixed(1)}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">
                                      Sem pontuação
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Detalhes expandidos inline */}
                            {expandedCandidate === candidate.candidate.id && (
                              <div className="border-t bg-gray-50 p-6">
                                <CandidateDetailsInline
                                  candidate={candidate}
                                  audioStates={audioStates}
                                  setAudioStates={setAudioStates}
                                  reportData={specificReport}
                                  isSpecificReport={!!reportId}
                                  expandedPerfectAnswers={expandedPerfectAnswers}
                                  setExpandedPerfectAnswers={setExpandedPerfectAnswers}
                                  selectedSelection={selectedSelection}
                                />
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="selecionados" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Candidatos por Categoria</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Candidatos organizados por avaliação em colunas
                  </p>
                </div>
                <Button
                  onClick={exportToExcel}
                  disabled={allCandidatesWithStatus.length === 0}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {(loadingCandidates || loadingAllCandidates) ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Carregando candidatos...</p>
                </div>
              ) : allCandidatesWithStatus.length === 0 ? (
                <div className="text-center py-12">
                  <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum candidato encontrado</h3>
                  <p className="text-muted-foreground">
                    Ainda não há candidatos cadastrados nesta seleção.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-4">
                  {/* Coluna Melhor - Verde */}
                  <div className="space-y-3">
                    <div className="bg-green-100 border border-green-200 rounded-lg p-3 text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <ThumbsUp className="h-5 w-5 text-green-700" />
                        <h3 className="font-semibold text-green-700">Selecionado</h3>
                      </div>
                      <div className="text-sm text-green-600">
                        {allCandidatesWithStatus.filter(c => getCandidateCategory(c.candidate.id) === 'Melhor').length} candidatos
                      </div>
                    </div>
                    <div className="space-y-2">
                      {allCandidatesWithStatus
                        .filter(candidate => getCandidateCategory(candidate.candidate.id) === 'Melhor')
                        .map(candidate => {
                          const responsesWithScore = candidate.responses.filter(r => r.score !== null && r.score !== undefined);
                          const averageScore = responsesWithScore.length > 0
                            ? responsesWithScore.reduce((sum, r) => sum + (r.score || 0), 0) / responsesWithScore.length
                            : 0;

                          return (
                            <Card key={candidate.candidate.id} className="bg-green-50 border-green-200">
                              <CardContent className="p-3 pt-[4px] pb-[4px]">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-medium text-sm">{candidate.candidate.name}</h4>
                                  {candidate.interview.status === 'pending' ? (
                                    <div className="bg-gray-400 text-white px-2 py-1 rounded text-xs font-bold">
                                      Sem resposta
                                    </div>
                                  ) : averageScore > 0 ? (
                                    <div className="bg-green-600 text-white px-2 py-1 rounded text-xs font-bold">
                                      {averageScore.toFixed(0)}
                                    </div>
                                  ) : (
                                    <div className="bg-gray-400 text-white px-2 py-1 rounded text-xs font-bold">
                                      Processando...
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      {allCandidatesWithStatus.filter(c => getCandidateCategory(c.candidate.id) === 'Melhor').length === 0 && (
                        <div className="text-center py-6 text-muted-foreground text-sm">
                          Nenhum candidato nesta categoria
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Coluna Mediano - Amarelo */}
                  <div className="space-y-3">
                    <div className="bg-yellow-100 border border-yellow-200 rounded-lg p-3 text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Meh className="h-5 w-5 text-yellow-700" />
                        <h3 className="font-semibold text-yellow-700">Potencial</h3>
                      </div>
                      <div className="text-sm text-yellow-600">
                        {allCandidatesWithStatus.filter(c => getCandidateCategory(c.candidate.id) === 'Mediano').length} candidatos
                      </div>
                    </div>
                    <div className="space-y-2">
                      {allCandidatesWithStatus
                        .filter(candidate => getCandidateCategory(candidate.candidate.id) === 'Mediano')
                        .map(candidate => {
                          const responsesWithScore = candidate.responses.filter(r => r.score !== null && r.score !== undefined);
                          const averageScore = responsesWithScore.length > 0
                            ? responsesWithScore.reduce((sum, r) => sum + (r.score || 0), 0) / responsesWithScore.length
                            : 0;

                          return (
                            <Card key={candidate.candidate.id} className="bg-yellow-50 border-yellow-200">
                              <CardContent className="p-3 pt-[4px] pb-[4px]">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-medium text-sm">{candidate.candidate.name}</h4>
                                  {candidate.interview.status === 'pending' ? (
                                    <div className="bg-gray-400 text-white px-2 py-1 rounded text-xs font-bold">
                                      Sem resposta
                                    </div>
                                  ) : averageScore > 0 ? (
                                    <div className="bg-yellow-600 text-white px-2 py-1 rounded text-xs font-bold">
                                      {averageScore.toFixed(0)}
                                    </div>
                                  ) : (
                                    <div className="bg-gray-400 text-white px-2 py-1 rounded text-xs font-bold">
                                      Processando...
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      {allCandidatesWithStatus.filter(c => getCandidateCategory(c.candidate.id) === 'Mediano').length === 0 && (
                        <div className="text-center py-6 text-muted-foreground text-sm">
                          Nenhum candidato nesta categoria
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Coluna Em dúvida - Laranja */}
                  <div className="space-y-3">
                    <div className="bg-orange-100 border border-orange-200 rounded-lg p-3 text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <AlertTriangle className="h-5 w-5 text-orange-700" />
                        <h3 className="font-semibold text-orange-700">Em dúvida</h3>
                      </div>
                      <div className="text-sm text-orange-600">
                        {allCandidatesWithStatus.filter(c => getCandidateCategory(c.candidate.id) === 'Em dúvida').length} candidatos
                      </div>
                    </div>
                    <div className="space-y-2">
                      {allCandidatesWithStatus
                        .filter(candidate => getCandidateCategory(candidate.candidate.id) === 'Em dúvida')
                        .map(candidate => {
                          const responsesWithScore = candidate.responses.filter(r => r.score !== null && r.score !== undefined);
                          const averageScore = responsesWithScore.length > 0
                            ? responsesWithScore.reduce((sum, r) => sum + (r.score || 0), 0) / responsesWithScore.length
                            : 0;

                          return (
                            <Card key={candidate.candidate.id} className="bg-orange-50 border-orange-200">
                              <CardContent className="p-3 pt-[4px] pb-[4px]">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-medium text-sm">{candidate.candidate.name}</h4>
                                  {candidate.interview.status === 'pending' ? (
                                    <div className="bg-gray-400 text-white px-2 py-1 rounded text-xs font-bold">
                                      Sem resposta
                                    </div>
                                  ) : averageScore > 0 ? (
                                    <div className="bg-orange-600 text-white px-2 py-1 rounded text-xs font-bold">
                                      {averageScore.toFixed(0)}
                                    </div>
                                  ) : (
                                    <div className="bg-gray-400 text-white px-2 py-1 rounded text-xs font-bold">
                                      Processando...
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      {allCandidatesWithStatus.filter(c => getCandidateCategory(c.candidate.id) === 'Em dúvida').length === 0 && (
                        <div className="text-center py-6 text-muted-foreground text-sm">
                          Nenhum candidato nesta categoria
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Coluna Não - Vermelho */}
                  <div className="space-y-3">
                    <div className="bg-red-100 border border-red-200 rounded-lg p-3 text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <ThumbsDown className="h-5 w-5 text-red-700" />
                        <h3 className="font-semibold text-red-700">Reprovado</h3>
                      </div>
                      <div className="text-sm text-red-600">
                        {allCandidatesWithStatus.filter(c => getCandidateCategoryWithFallback(c.candidate.id) === 'Não').length} candidatos
                      </div>
                    </div>
                    <div className="space-y-2">
                      {allCandidatesWithStatus
                        .filter(candidate => getCandidateCategoryWithFallback(candidate.candidate.id) === 'Não')
                        .map(candidate => {
                          const responsesWithScore = candidate.responses.filter(r => r.score !== null && r.score !== undefined);
                          const averageScore = responsesWithScore.length > 0
                            ? responsesWithScore.reduce((sum, r) => sum + (r.score || 0), 0) / responsesWithScore.length
                            : 0;

                          return (
                            <Card key={candidate.candidate.id} className="bg-red-50 border-red-200">
                              <CardContent className="p-3 pt-[4px] pb-[4px]">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-medium text-sm">{candidate.candidate.name}</h4>
                                  {candidate.interview.status === 'pending' ? (
                                    <div className="bg-gray-400 text-white px-2 py-1 rounded text-xs font-bold">
                                      Sem resposta
                                    </div>
                                  ) : averageScore > 0 ? (
                                    <div className="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold">
                                      {averageScore.toFixed(0)}
                                    </div>
                                  ) : (
                                    <div className="bg-gray-400 text-white px-2 py-1 rounded text-xs font-bold">
                                      Processando...
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      {allCandidatesWithStatus.filter(c => getCandidateCategoryWithFallback(c.candidate.id) === 'Não').length === 0 && (
                        <div className="text-center py-6 text-muted-foreground text-sm">
                          Nenhum candidato nesta categoria
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Componente de Detalhes Inline do Candidato
interface CandidateDetailsInlineProps {
  candidate: InterviewCandidate;
  audioStates: {
    [key: string]: {
      isPlaying: boolean;
      currentTime: number;
      duration: number;
      progress: number;
    }
  };
  setAudioStates: React.Dispatch<React.SetStateAction<{
    [key: string]: {
      isPlaying: boolean;
      currentTime: number;
      duration: number;
      progress: number;
    }
  }>>;
  reportData?: any;
  isSpecificReport?: boolean;
  expandedPerfectAnswers: { [key: string]: boolean };
  setExpandedPerfectAnswers: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  selectedSelection?: any; // Dados da seleção para buscar informações da vaga
}

function CandidateDetailsInline({ candidate, audioStates, setAudioStates, reportData, isSpecificReport, expandedPerfectAnswers, setExpandedPerfectAnswers, selectedSelection }: CandidateDetailsInlineProps) {
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

  // Atualizar estado do áudio
  const updateAudioState = (responseId: string, updates: Partial<typeof audioStates[string]>) => {
    setAudioStates(prev => ({
      ...prev,
      [responseId]: { ...prev[responseId], ...updates }
    }));
  };

  // Controlar reprodução do áudio
  const toggleAudio = (audioUrl: string, responseId: string) => {
    try {
      const currentState = audioStates[responseId];

      // Parar todos os outros áudios
      Object.keys(audioRefs.current).forEach(id => {
        if (id !== responseId && audioRefs.current[id]) {
          audioRefs.current[id].pause();
          updateAudioState(id, { isPlaying: false });
        }
      });

      // Criar novo player se não existir
      if (!audioRefs.current[responseId]) {
        const audio = new Audio();

        // Configurações importantes para compatibilidade
        audio.crossOrigin = 'anonymous';
        audio.preload = 'auto';

        // Tentar múltiplos formatos se necessário
        audio.volume = 1.0;

        audioRefs.current[responseId] = audio;

        audio.addEventListener('loadstart', () => {
          // Loading started
        });

        audio.addEventListener('loadedmetadata', () => {
          updateAudioState(responseId, {
            duration: audio.duration,
            currentTime: 0,
            progress: 0,
            isPlaying: false
          });
        });

        audio.addEventListener('canplay', () => {
          // Audio ready to play
        });

        audio.addEventListener('timeupdate', () => {
          const progress = (audio.currentTime / audio.duration) * 100;
          updateAudioState(responseId, {
            currentTime: audio.currentTime,
            progress: progress
          });
        });

        audio.addEventListener('ended', () => {
          updateAudioState(responseId, {
            isPlaying: false,
            currentTime: 0,
            progress: 0
          });
        });

        audio.addEventListener('error', (e) => {
          // Tentar URL alternativa ou conversão
          if (audioUrl.includes('.ogg')) {
            const directUrl = audioUrl.replace('/uploads/', '/uploads/');
            audio.src = directUrl;
          }

          updateAudioState(responseId, { isPlaying: false });
        });

        // Definir URL após configurar eventos
        audio.src = audioUrl;
      }

      const audio = audioRefs.current[responseId];

      if (currentState?.isPlaying) {
        audio.pause();
        updateAudioState(responseId, { isPlaying: false });
      } else {
        const playPromise = audio.play();

        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              updateAudioState(responseId, { isPlaying: true });
            })
            .catch(error => {
              updateAudioState(responseId, { isPlaying: false });
            });
        } else {
          updateAudioState(responseId, { isPlaying: true });
        }
      }
    } catch (error) {
      updateAudioState(responseId, { isPlaying: false });
    }
  };

  // Controlar posição da timeline
  const seekAudio = (responseId: string, percentage: number) => {
    const audio = audioRefs.current[responseId];
    if (audio && audio.duration) {
      const newTime = (percentage / 100) * audio.duration;
      audio.currentTime = newTime;
      updateAudioState(responseId, {
        currentTime: newTime,
        progress: percentage
      });
    }
  };

  // Formatar tempo
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Função para toggle do dropdown da resposta perfeita
  const togglePerfectAnswer = (responseId: string) => {
    setExpandedPerfectAnswers(prev => ({
      ...prev,
      [responseId]: !prev[responseId]
    }));
  };

  // Buscar dados da vaga para obter respostas perfeitas
  const { data: jobData, isLoading: jobDataLoading } = useQuery({
    queryKey: ['/api/jobs', selectedSelection?.jobId],
    queryFn: async () => {
      if (!selectedSelection?.jobId) return null;
      const response = await apiRequest(`/api/jobs/${selectedSelection.jobId}`, 'GET');
      return response.json();
    },
    enabled: !!selectedSelection?.jobId && !isSpecificReport
  });

  // Função para buscar resposta perfeita baseada no questionId
  const getPerfectAnswer = (questionId: number) => {
    // Se estamos visualizando um relatório específico (independente)
    if (isSpecificReport && reportData?.jobData?.perguntas) {
      const question = reportData.jobData.perguntas.find((q: any) => q.numeroPergunta === questionId);
      return question?.respostaPerfeita || null;
    }

    // Para seleções regulares, buscar da vaga real
    if (jobData?.perguntas) {
      // Testar diferentes estruturas de campo possíveis
      const question = jobData.perguntas.find((q: any) =>
        q.numero === questionId ||
        q.numeroPergunta === questionId ||
        q.id === questionId ||
        q.questionId === questionId
      );
      return question?.respostaPerfeita || null;
    }

    return null;
  };

  const handleExportHTML = async () => {
    try {

      // Preparar dados do candidato para o PDF
      const candidateData = {
        name: candidate.candidate.name,
        email: candidate.candidate.email,
        phone: candidate.candidate.phone,
        jobName: selectedSelection?.jobName || reportData?.jobData?.nomeVaga || 'Entrevista',
        completedAt: candidate.interview.completedAt,
        responses: candidate.responses.map(response => ({
          questionText: response.questionText,
          transcription: response.transcription || 'Aguardando resposta',
          audioUrl: response.audioUrl,
          score: response.score,
          perfectAnswer: getPerfectAnswer(response.questionId)
        }))
      };


      // Obter token de autenticação
      const token = localStorage.getItem('auth_token') || '';

      // Fazer requisição para gerar HTML com fetch direto para receber arquivo
      const response = await fetch('/api/export-candidate-html', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(candidateData)
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      // Download do arquivo
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${candidateData.name}_${candidateData.jobName}_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);


    } catch (error) {
      console.error('❌ Erro ao exportar ZIP:', error);
      // Erro na exportação - mostrar no console por enquanto
      console.error('❌ Falha ao gerar pacote ZIP. Tente novamente.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Informações do Candidato */}
      <div className="grid grid-cols-4 gap-4 p-4 bg-white rounded-lg border relative">
        <div>
          <h4 className="font-semibold text-sm text-muted-foreground">Nome</h4>
          <p className="font-medium">{candidate.candidate.name}</p>
        </div>
        <div>
          <h4 className="font-semibold text-sm text-muted-foreground">Email</h4>
          <p className="text-sm">{candidate.candidate.email}</p>
        </div>
        <div>
          <h4 className="font-semibold text-sm text-muted-foreground">Telefone</h4>
          <p className="text-sm">{candidate.candidate.phone}</p>
        </div>
        <div>
          <h4 className="font-semibold text-sm text-muted-foreground">Status</h4>
          <Badge variant={candidate.interview.status === 'completed' ? 'default' : 'secondary'}>
            {candidate.interview.status}
          </Badge>
        </div>

        {/* Botão Exportar */}
        <div className="absolute top-4 right-4">
          <Button
            onClick={handleExportHTML}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
            size="sm"
          >
            <FileText className="h-4 w-4" />
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Respostas da Entrevista */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Respostas da Entrevista</h3>

        {candidate.responses.map((response, index) => {
          const responseId = response.id.toString();
          const audioState = audioStates[responseId] || {
            isPlaying: false,
            currentTime: 0,
            duration: 0,
            progress: 0
          };

          return (
            <Card key={response.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="space-y-4">
                  {/* Pergunta com Pontuação no topo direito */}
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm text-muted-foreground mb-1">
                        Pergunta {index + 1}
                      </h4>
                      <p className="font-medium">{response.questionText}</p>
                    </div>
                    {/* Pontuação 0-100 no topo direito */}
                    {response.score !== null && response.score !== undefined && response.score >= 0 ? (
                      <div className="ml-4 flex-shrink-0">
                        <div className={`px-3 py-1 rounded-full text-sm font-bold ${response.score >= 80 ? 'bg-green-100 text-green-800' :
                            response.score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                              response.score >= 40 ? 'bg-orange-100 text-orange-800' :
                                'bg-red-100 text-red-800'
                          }`}>
                          {response.score}/100
                        </div>
                      </div>
                    ) : (
                      <div className="ml-4 flex-shrink-0">
                        <div className="px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-600">
                          Processando...
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Transcrição */}
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-1">
                      Transcrição
                    </h4>
                    <div className="bg-muted/50 p-3 rounded-md">
                      <p className="text-sm leading-relaxed">
                        {response.transcription && response.transcription !== 'Aguardando resposta via WhatsApp'
                          ? response.transcription
                          : 'Aguardando resposta via WhatsApp'}
                      </p>
                    </div>
                  </div>

                  {/* Dropdown da Resposta Perfeita */}
                  {!jobDataLoading && getPerfectAnswer(response.questionId) && (
                    <Collapsible
                      open={expandedPerfectAnswers[responseId]}
                      onOpenChange={() => togglePerfectAnswer(responseId)}
                    >
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-between p-3 h-auto border border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-700 hover:text-emerald-800"
                        >
                          <div className="flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            <span className="font-medium text-sm">Ver Resposta Perfeita</span>
                          </div>
                          {expandedPerfectAnswers[responseId] ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-2">
                        <div className="mt-3 p-4 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-lg">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                              <BookOpen className="h-4 w-4 text-emerald-600" />
                            </div>
                            <div className="flex-1 space-y-2">
                              <h5 className="font-semibold text-sm text-emerald-800">
                                Resposta Perfeita Cadastrada
                              </h5>
                              <p className="text-sm leading-relaxed text-emerald-700">
                                {getPerfectAnswer(response.questionId)}
                              </p>
                              <div className="flex items-center gap-2 pt-2">
                                <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50">
                                  <Target className="h-3 w-3 mr-1" />
                                  Referência para Avaliação
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {/* Player de Áudio com Timeline */}
                  {response.audioUrl && response.audioUrl !== "" ? (
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm text-muted-foreground">
                        Áudio da Resposta
                      </h4>

                      {/* Controles do Player */}
                      <div className="bg-blue-50 p-4 rounded-lg space-y-3">
                        <div className="flex items-center gap-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleAudio(response.audioUrl!, responseId)}
                            className="flex items-center gap-2"
                          >
                            {audioState.isPlaying ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                            {audioState.isPlaying ? 'Pausar' : 'Reproduzir'}
                          </Button>

                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Volume2 className="h-4 w-4" />
                            <span>{formatTime(audioState.currentTime)} / {formatTime(audioState.duration)}</span>
                          </div>


                        </div>

                        {/* Timeline */}
                        <div className="space-y-2">
                          <div
                            className="w-full h-2 bg-gray-200 rounded-full cursor-pointer relative"
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const percentage = ((e.clientX - rect.left) / rect.width) * 100;
                              seekAudio(responseId, percentage);
                            }}
                          >
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all duration-100"
                              style={{ width: `${audioState.progress || 0}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-md">
                      <Clock className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm text-muted-foreground">
                        Aguardando resposta de áudio via WhatsApp
                      </span>
                    </div>
                  )}


                </div>
              </CardContent>
            </Card>
          );
        })}

        {candidate.responses.length === 0 && (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma resposta encontrada</h3>
            <p className="text-muted-foreground">
              Este candidato ainda não respondeu às perguntas da entrevista.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}