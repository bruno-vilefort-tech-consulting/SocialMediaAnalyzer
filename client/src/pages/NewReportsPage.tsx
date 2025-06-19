import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FileText, 
  Users, 
  Play, 
  Pause, 
  Square, 
  Search, 
  Eye,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Volume2,
  Loader2
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { useAudio } from '@/hooks/useAudio';

interface Selection {
  id: number;
  name: string;
  status: string;
  createdAt: any;
  jobName?: string;
  clientId: number;
  candidateCount?: number;
  responsesCount?: number;
  progressPercentage?: number;
}

interface InterviewCandidate {
  candidate: {
    id: number;
    name: string;
    email: string;
    phone: string;
  };
  interview: {
    id: number;
    status: string;
    createdAt: any;
    completedAt?: any;
    totalScore: number;
  };
  responses: InterviewResponse[];
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

// Componente para player de áudio
const AudioPlayer: React.FC<{ audioUrl: string; className?: string }> = ({ audioUrl, className }) => {
  const { isPlaying, play, pause, stop, setAudioUrl, loading } = useAudio();
  
  React.useEffect(() => {
    if (audioUrl) {
      setAudioUrl(audioUrl);
    }
  }, [audioUrl, setAudioUrl]);

  if (!audioUrl) {
    return (
      <div className="flex items-center gap-2 text-gray-400">
        <Volume2 className="h-4 w-4" />
        <span className="text-sm">Sem áudio</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={isPlaying ? pause : play}
            className="h-8 w-8 p-0"
          >
            {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={stop}
            className="h-8 w-8 p-0"
          >
            <Square className="h-3 w-3" />
          </Button>
          <Volume2 className="h-4 w-4 text-gray-500" />
        </>
      )}
    </div>
  );
};

export default function NewReportsPage() {
  const { user } = useAuth();
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSelection, setSelectedSelection] = useState<Selection | null>(null);
  const itemsPerPage = 12;

  // Buscar clientes (apenas para masters)
  const { data: clients = [] } = useQuery({
    queryKey: ['/api/clients'],
    enabled: user?.role === 'master'
  });

  // Buscar seleções
  const { data: selections = [], isLoading: loadingSelections } = useQuery({
    queryKey: ['/api/selections', selectedClientId],
    enabled: !!selectedClientId || user?.role === 'client'
  });

  // Query para buscar candidatos de uma seleção específica com entrevistas
  const { data: interviewCandidates = [], isLoading: loadingCandidates } = useQuery({
    queryKey: ['selection-interview-candidates', selectedSelection?.id],
    queryFn: async () => {
      if (!selectedSelection) return [];
      
      try {
        const res = await apiRequest(`/api/selections/${selectedSelection.id}/interview-candidates`, 'GET');
        const response = await res.json();
        
        console.log('🔍 Interview candidates response:', response);
        console.log('🔍 Response type:', typeof response);
        console.log('🔍 Is array:', Array.isArray(response));
        
        // Garantir que sempre retornamos um array
        if (Array.isArray(response)) {
          console.log('✅ Returning array with', response.length, 'candidates');
          return response as InterviewCandidate[];
        } else {
          console.warn('⚠️ Response is not an array:', typeof response, response);
          console.log('🔄 Attempting to extract data from response...');
          
          // Tentar extrair dados se response for um objeto com propriedades
          if (response && typeof response === 'object') {
            // Se response tem uma propriedade que é um array
            const keys = Object.keys(response);
            for (const key of keys) {
              if (Array.isArray(response[key])) {
                console.log(`✅ Found array in response.${key} with`, response[key].length, 'items');
                return response[key] as InterviewCandidate[];
              }
            }
          }
          
          return [];
        }
      } catch (error) {
        console.error('❌ Error fetching interview candidates:', error);
        return [];
      }
    },
    enabled: !!selectedSelection
  });

  // Efeitos para definir cliente padrão
  React.useEffect(() => {
    if (user?.role === 'client' && user.clientId) {
      setSelectedClientId(user.clientId.toString());
    }
  }, [user]);

  // Filtrar e paginar candidatos
  const filteredCandidates = (interviewCandidates || []).filter(item => {
    const candidate = item.candidate;
    const matchesSearch = candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         candidate.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         candidate.phone.includes(searchTerm);
    
    return matchesSearch;
  });

  const totalPages = Math.ceil(filteredCandidates.length / itemsPerPage);
  const paginatedCandidates = filteredCandidates.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Se ainda não selecionou uma seleção, mostrar lista de seleções
  if (!selectedSelection) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Relatórios de Entrevistas</h1>
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
          <div className="space-y-4">
            {loadingSelections ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p>Carregando seleções...</p>
                  </div>
                </CardContent>
              </Card>
            ) : selections.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhuma seleção encontrada</h3>
                  <p className="text-muted-foreground text-center">
                    Não há seleções de entrevistas disponíveis para análise.
                  </p>
                </CardContent>
              </Card>
            ) : (
              selections.map((selection: Selection) => (
                <Card 
                  key={selection.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => setSelectedSelection(selection)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <h3 className="text-xl font-semibold">{selection.name}</h3>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <span>Vaga: {selection.jobName || 'Não identificada'}</span>
                          <Badge variant={selection.status === 'enviado' ? 'default' : 'secondary'}>
                            {selection.status}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="text-right space-y-2">
                        <Button variant="outline">
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Candidatos
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  // Mostrar candidatos da seleção
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button 
          variant="outline" 
          onClick={() => setSelectedSelection(null)}
          className="flex items-center space-x-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar</span>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Candidatos - {selectedSelection.name}</h1>
          <p className="text-muted-foreground">
            Vaga: {selectedSelection.jobName || 'Não identificada'}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Candidatos da Entrevista</span>
            <div className="flex items-center space-x-4">
              <Input
                placeholder="Buscar por nome, email ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
              <div className="text-sm text-gray-600">
                Total: {filteredCandidates.length} candidatos
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingCandidates ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p>Carregando candidatos...</p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {paginatedCandidates.map((item) => {
                  const isExpanded = expandedCandidate === item.candidate.id.toString();
                  
                  return (
                    <div key={item.candidate.id} className="space-y-2">
                      {/* Card principal horizontal */}
                      <Card className="hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => setExpandedCandidate(isExpanded ? null : item.candidate.id.toString())}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            {/* Informações principais em linha horizontal */}
                            <div className="flex items-center space-x-6 flex-1">
                              <div className="min-w-0 flex-1">
                                <h3 className="font-medium text-sm truncate">{item.candidate.name}</h3>
                                <p className="text-xs text-gray-500 truncate">{item.candidate.email}</p>
                              </div>
                              
                              <div className="flex items-center space-x-1">
                                <span className="text-xs text-gray-500">Tel:</span>
                                <span className="text-xs">{item.candidate.phone}</span>
                              </div>
                              
                              <div className="flex items-center space-x-1">
                                <span className="text-xs text-gray-500">Score:</span>
                                <Badge variant="outline" className="text-xs">
                                  {item.interview.totalScore || 0}pts
                                </Badge>
                              </div>
                              
                              <div className="flex items-center space-x-1">
                                <span className="text-xs text-gray-500">Respostas:</span>
                                <Badge variant="outline" className="text-xs">
                                  {item.responses.length}
                                </Badge>
                              </div>
                              
                              <Badge variant={item.interview.status === 'completed' ? "default" : "secondary"} className="text-xs">
                                {item.interview.status === 'completed' ? "Concluída" : "Em andamento"}
                              </Badge>
                            </div>
                            
                            {/* Botão de expandir */}
                            <Button variant="ghost" size="sm" className="ml-4">
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                      
                      {/* Detalhes expandidos inline */}
                      {isExpanded && (
                        <Card className="ml-4 border-l-4 border-blue-200">
                          <CardContent className="p-4">
                            <div className="space-y-4">
                              {/* Informações resumidas */}
                              <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg">
                                <div>
                                  <h4 className="font-medium text-sm mb-2 text-gray-700">Informações do Candidato</h4>
                                  <div className="space-y-1 text-sm text-gray-600">
                                    <p><span className="font-medium">Nome:</span> {item.candidate.name}</p>
                                    <p><span className="font-medium">Email:</span> {item.candidate.email}</p>
                                    <p><span className="font-medium">Telefone:</span> {item.candidate.phone}</p>
                                  </div>
                                </div>
                                <div>
                                  <h4 className="font-medium text-sm mb-2 text-gray-700">Status da Entrevista</h4>
                                  <div className="space-y-1 text-sm text-gray-600">
                                    <p><span className="font-medium">Status:</span> {item.interview.status === 'completed' ? 'Concluída' : 'Em andamento'}</p>
                                    <p><span className="font-medium">Score Total:</span> {item.interview.totalScore || 0} pontos</p>
                                    <p><span className="font-medium">Respostas:</span> {item.responses.length}</p>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Respostas da entrevista */}
                              <div>
                                <h4 className="font-medium mb-3 text-gray-700">Respostas da Entrevista</h4>
                                <div className="space-y-3">
                                  {item.responses.map((response) => (
                                    <Card key={response.id} className="p-3 bg-white border">
                                      <div className="space-y-3">
                                        <div className="flex justify-between items-start">
                                          <h5 className="font-medium text-sm text-gray-800">
                                            Pergunta {response.questionId}
                                          </h5>
                                          {response.score > 0 && (
                                            <Badge variant="outline" className="text-xs">
                                              {response.score} pts
                                            </Badge>
                                          )}
                                        </div>
                                        
                                        <div className="p-2 bg-blue-50 rounded border-l-2 border-blue-300">
                                          <p className="text-sm text-blue-800">
                                            <span className="font-medium">Pergunta:</span> {response.questionText}
                                          </p>
                                        </div>
                                        
                                        <div className="p-2 bg-green-50 rounded border-l-2 border-green-300">
                                          <p className="text-sm text-green-800">
                                            <span className="font-medium">Resposta:</span> {response.transcription || 'Aguardando resposta via WhatsApp'}
                                          </p>
                                        </div>
                                        
                                        <div className="flex items-center justify-between pt-2">
                                          <AudioPlayer 
                                            audioUrl={response.audioUrl || ''} 
                                            className="flex items-center gap-2"
                                          />
                                          {response.recordingDuration > 0 && (
                                            <span className="text-xs text-gray-500">
                                              Duração: {Math.round(response.recordingDuration)}s
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </Card>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  );
                })}
              </div>

              {filteredCandidates.length === 0 && (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum candidato encontrado</h3>
                  <p className="text-muted-foreground">
                    {searchTerm ? 'Tente ajustar sua busca.' : 'Esta seleção não possui candidatos.'}
                  </p>
                </div>
              )}

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center space-x-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages} ({filteredCandidates.length} candidatos)
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}