import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
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
  ChevronRight
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

interface Candidate {
  id: number;
  name: string;
  email: string;
  phone: string;
  hasResponded: boolean;
  responses?: Response[];
  category?: 'melhor' | 'mediano' | 'em_duvida' | 'nao';
  score?: number;
}

interface Response {
  id: string;
  questionText: string;
  responseText: string;
  audioFile?: string;
  score?: number;
  timestamp: string;
}

export default function NewReportsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedSelection, setSelectedSelection] = useState<Selection | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [activeTab, setActiveTab] = useState('candidates');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const { 
    isPlaying, 
    currentAudioUrl, 
    isPaused,
    playAudio: handlePlayAudio, 
    pauseAudio, 
    resumeAudio, 
    stopAudio 
  } = useAudio();

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

  // Buscar candidatos da seleção
  const { data: candidates = [] } = useQuery({
    queryKey: ['/api/selections', selectedSelection?.id, 'candidates'],
    enabled: !!selectedSelection
  });

  // Mutation para salvar categoria do candidato
  const saveCategoryMutation = useMutation({
    mutationFn: ({ candidateId, category }: { candidateId: number, category: string }) =>
      apiRequest(`/api/candidates/${candidateId}/category`, {
        method: 'PATCH',
        body: JSON.stringify({ category })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/selections', selectedSelection?.id, 'candidates'] });
    }
  });

  // Efeitos para definir cliente padrão
  React.useEffect(() => {
    if (user?.role === 'client' && user.clientId) {
      setSelectedClientId(user.clientId.toString());
    }
  }, [user]);

  // Filtrar candidatos por busca
  const filteredCandidates = candidates.filter((candidate: Candidate) =>
    candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    candidate.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    candidate.phone.includes(searchTerm)
  );

  // Paginação
  const totalPages = Math.ceil(filteredCandidates.length / itemsPerPage);
  const paginatedCandidates = filteredCandidates.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Candidatos por categoria
  const candidatesByCategory = {
    melhor: candidates.filter((c: Candidate) => c.category === 'melhor'),
    mediano: candidates.filter((c: Candidate) => c.category === 'mediano'),
    em_duvida: candidates.filter((c: Candidate) => c.category === 'em_duvida'),
    nao: candidates.filter((c: Candidate) => c.category === 'nao')
  };

  const handleSaveCategory = (category: string) => {
    if (selectedCandidate) {
      saveCategoryMutation.mutate({
        candidateId: selectedCandidate.id,
        category
      });
    }
  };

  // Renderizar lista de seleções
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
                        <div className="text-sm text-muted-foreground">
                          Respostas: {selection.responsesCount || 0}/{selection.candidateCount || 0}
                        </div>
                        {selection.progressPercentage !== undefined && (
                          <div className="w-32">
                            <Progress value={selection.progressPercentage} className="h-2" />
                            <span className="text-xs text-muted-foreground">
                              {selection.progressPercentage}%
                            </span>
                          </div>
                        )}
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

  // Renderizar detalhes do candidato
  if (selectedCandidate) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button 
            variant="outline" 
            onClick={() => setSelectedCandidate(null)}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Voltar</span>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{selectedCandidate.name}</h1>
            <p className="text-muted-foreground">
              {selectedCandidate.email} • {selectedCandidate.phone}
            </p>
          </div>
        </div>

        {/* Seleção de categoria */}
        <Card>
          <CardHeader>
            <CardTitle>Classificação do Candidato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select 
              value={selectedCandidate.category || ''} 
              onValueChange={handleSaveCategory}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="melhor">Melhor</SelectItem>
                <SelectItem value="mediano">Mediano</SelectItem>
                <SelectItem value="em_duvida">Em dúvida</SelectItem>
                <SelectItem value="nao">Não</SelectItem>
              </SelectContent>
            </Select>
            {selectedCandidate.score && (
              <div className="text-sm text-muted-foreground">
                Score geral: {selectedCandidate.score}%
              </div>
            )}
          </CardContent>
        </Card>

        {/* Respostas da entrevista */}
        <Card>
          <CardHeader>
            <CardTitle>Respostas da Entrevista</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {selectedCandidate.responses && selectedCandidate.responses.length > 0 ? (
              selectedCandidate.responses.map((response: Response, index: number) => (
                <div key={response.id} className="border rounded-lg p-4 space-y-4">
                  <div>
                    <h4 className="font-semibold text-lg mb-2">
                      Pergunta {index + 1}
                    </h4>
                    <p className="text-muted-foreground mb-4">
                      {response.questionText}
                    </p>
                  </div>

                  <div className="bg-muted rounded-lg p-4">
                    <h5 className="font-medium mb-2">Resposta:</h5>
                    <p className="text-sm leading-relaxed">
                      {response.responseText || 'Sem transcrição disponível'}
                    </p>
                    {response.score && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        Score: {response.score}%
                      </div>
                    )}
                  </div>

                  {response.audioFile && (
                    <div className="flex items-center space-x-2">
                      {!isPlaying || currentAudioUrl !== response.audioFile ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePlayAudio(response.audioFile!)}
                          className="flex items-center space-x-2"
                        >
                          <Play className="h-4 w-4" />
                          <span>Reproduzir</span>
                        </Button>
                      ) : (
                        <div className="flex items-center space-x-2">
                          {isPlaying ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={pauseAudio}
                              className="flex items-center space-x-2"
                            >
                              <Pause className="h-4 w-4" />
                              <span>Pausar</span>
                            </Button>
                          ) : isPaused && currentAudioUrl ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={resumeAudio}
                              className="flex items-center space-x-2"
                            >
                              <Play className="h-4 w-4" />
                              <span>Continuar</span>
                            </Button>
                          ) : null}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={stopAudio}
                            className="flex items-center space-x-2"
                          >
                            <Square className="h-4 w-4" />
                            <span>Parar</span>
                          </Button>
                        </div>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(response.timestamp).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma resposta encontrada</h3>
                <p className="text-muted-foreground">
                  Este candidato ainda não respondeu a entrevista.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Renderizar tabs da seleção
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
          <h1 className="text-3xl font-bold tracking-tight">{selectedSelection.name}</h1>
          <p className="text-muted-foreground">
            Análise da seleção • {candidates.length} candidatos
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="candidates">Candidatos</TabsTrigger>
          <TabsTrigger value="analysis">Análise Candidatos</TabsTrigger>
          <TabsTrigger value="selected">Selecionados</TabsTrigger>
        </TabsList>

        <TabsContent value="candidates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Lista de Candidatos</span>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, email ou telefone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {paginatedCandidates.map((candidate: Candidate) => (
                  <div key={candidate.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <h4 className="font-medium">{candidate.name}</h4>
                      <div className="text-sm text-muted-foreground space-x-4">
                        <span>{candidate.email}</span>
                        <span>{candidate.phone}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Badge variant={candidate.hasResponded ? 'default' : 'secondary'}>
                        {candidate.hasResponded ? 'Respondido' : 'Não'}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCandidate(candidate)}
                        className="flex items-center space-x-2"
                      >
                        <Eye className="h-4 w-4" />
                        <span>Visualizar</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

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
                    Página {currentPage} de {totalPages}
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Candidatos por Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {candidates
                  .filter((c: Candidate) => c.hasResponded)
                  .sort((a: Candidate, b: Candidate) => (b.score || 0) - (a.score || 0))
                  .slice(0, 20)
                  .map((candidate: Candidate) => (
                    <div key={candidate.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <h4 className="font-medium">{candidate.name}</h4>
                        <div className="text-sm text-muted-foreground">
                          Score: {candidate.score || 0}%
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCandidate(candidate)}
                        className="flex items-center space-x-2"
                      >
                        <Eye className="h-4 w-4" />
                        <span>Visualizar respostas</span>
                      </Button>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="selected" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(candidatesByCategory).map(([category, candidateList]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Users className="h-5 w-5" />
                    <span>{category === 'melhor' ? 'Melhor' : 
                           category === 'mediano' ? 'Mediano' : 
                           category === 'em_duvida' ? 'Em dúvida' : 'Não'}</span>
                    <Badge variant="secondary">{candidateList.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {candidateList.map((candidate: Candidate) => (
                      <div key={candidate.id} className="flex items-center justify-between p-2 border rounded">
                        <span className="font-medium">{candidate.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedCandidate(candidate)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {candidateList.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum candidato nesta categoria
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}