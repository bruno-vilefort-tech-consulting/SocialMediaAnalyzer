import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, 
  Filter, 
  Download, 
  Play, 
  Star, 
  User, 
  Clock,
  TrendingUp,
  BarChart3,
  FileText
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface InterviewResult {
  interview: {
    id: number;
    status: string;
    completedAt: Date | null;
    totalScore: number;
    category: 'high' | 'medium' | 'low';
  };
  candidate: {
    id: number;
    name: string;
    email: string;
    phone: string;
  };
  responses: Array<{
    id: number;
    questionId: number;
    transcription: string;
    score: number;
    audioUrl: string;
    recordingDuration: number;
    aiAnalysis: any;
  }>;
}

interface Selection {
  id: number;
  nomeSelecao: string;
  status: string;
  createdAt: Date | null;
}

export default function ResultsPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSelection, setSelectedSelection] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [selectedInterview, setSelectedInterview] = useState<InterviewResult | null>(null);

  // Fetch selections
  const { data: selections = [] } = useQuery<Selection[]>({
    queryKey: ["/api/selections"],
  });

  // Get all interview results with proper data structure
  const { data: results = [], isLoading, error } = useQuery<InterviewResult[]>({
    queryKey: ["/api/interview-responses"],
    enabled: true,
  });

  // Filter results based on search and category
  const filteredResults = results.filter(result => {
    const matchesSearch = result.candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         result.candidate.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !categoryFilter || result.interview.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Calculate statistics
  const completedInterviews = results.filter(r => r.interview.status === 'completed');
  const averageScore = completedInterviews.length > 0 
    ? Math.round(completedInterviews.reduce((sum, r) => sum + r.interview.totalScore, 0) / completedInterviews.length)
    : 0;

  const categoryStats = {
    high: completedInterviews.filter(r => r.interview.category === 'high').length,
    medium: completedInterviews.filter(r => r.interview.category === 'medium').length,
    low: completedInterviews.filter(r => r.interview.category === 'low').length,
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 bg-green-50";
    if (score >= 60) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  const getCategoryBadge = (category: string) => {
    const variants = {
      high: "bg-green-100 text-green-800",
      medium: "bg-yellow-100 text-yellow-800",
      low: "bg-red-100 text-red-800"
    };
    return variants[category as keyof typeof variants] || "bg-gray-100 text-gray-800";
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios de Entrevistas</h1>
          <p className="text-gray-600">Análise detalhada de todas as entrevistas realizadas</p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Exportar Relatório
        </Button>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar por nome ou email do candidato..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas as categorias</SelectItem>
                <SelectItem value="high">Alto desempenho</SelectItem>
                <SelectItem value="medium">Médio desempenho</SelectItem>
                <SelectItem value="low">Baixo desempenho</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <>
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-sm text-gray-600">Total de Candidatos</p>
                    <p className="text-2xl font-bold">{filteredResults.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="text-sm text-gray-600">Média Geral</p>
                    <p className="text-2xl font-bold">{averageScore}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                  <div>
                    <p className="text-sm text-gray-600">Alto Desempenho</p>
                    <p className="text-2xl font-bold">{categoryStats.high}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-purple-500" />
                  <div>
                    <p className="text-sm text-gray-600">Concluídas</p>
                    <p className="text-2xl font-bold">{completedInterviews.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-4 items-center">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Buscar por nome ou email do candidato..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filtrar por categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas as categorias</SelectItem>
                    <SelectItem value="high">Alto Desempenho</SelectItem>
                    <SelectItem value="medium">Médio Desempenho</SelectItem>
                    <SelectItem value="low">Baixo Desempenho</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Results Table */}
          <Card>
            <CardHeader>
              <CardTitle>Resultados dos Candidatos</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : filteredResults.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>{results.length === 0 ? 'Nenhuma entrevista encontrada' : 'Nenhum resultado encontrado com os filtros aplicados'}</p>
                  <p className="text-sm mt-2">Total de entrevistas carregadas: {results.length}</p>
                  {error && <p className="text-red-500 text-sm mt-2">Erro: {error.message}</p>}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Candidato</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pontuação</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Data Conclusão</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResults.map((result) => (
                      <TableRow key={result.interview.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{result.candidate.name}</p>
                            <p className="text-sm text-gray-500">{result.candidate.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={result.interview.status === 'completed' ? 'default' : 'secondary'}>
                            {result.interview.status === 'completed' ? 'Concluída' : 'Pendente'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {result.interview.status === 'completed' ? (
                            <div className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium ${getScoreColor(result.interview.totalScore)}`}>
                              <Star className="w-3 h-3 mr-1" />
                              {result.interview.totalScore}%
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {result.interview.status === 'completed' ? (
                            <Badge className={getCategoryBadge(result.interview.category)}>
                              {result.interview.category === 'high' ? 'Alto' : 
                               result.interview.category === 'medium' ? 'Médio' : 'Baixo'}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {result.interview.completedAt ? 
                            new Date(result.interview.completedAt).toLocaleDateString('pt-BR') : 
                            '-'
                          }
                        </TableCell>
                        <TableCell>
                          {result.interview.status === 'completed' && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedInterview(result)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Ver Detalhes
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Interview Details Dialog - Moved outside the table */}
          {selectedInterview && (
            <Dialog open={!!selectedInterview} onOpenChange={() => setSelectedInterview(null)}>
              <DialogContent className="max-w-4xl max-h-[80vh]">
                <DialogHeader>
                  <DialogTitle>
                    Entrevista Detalhada - {selectedInterview.candidate.name}
                  </DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-[60vh] pr-4">
                  <div className="space-y-6">
                    {/* Interview Summary Section */}
                    <div className="border rounded-lg p-4 bg-gray-50">
                      <h3 className="font-semibold text-lg mb-3">Resumo da Entrevista</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div>
                            <span className="text-sm text-gray-600">Nome do Candidato:</span>
                            <p className="font-medium">{selectedInterview.candidate.name}</p>
                          </div>
                          <div>
                            <span className="text-sm text-gray-600">Email:</span>
                            <p className="font-medium">{selectedInterview.candidate.email}</p>
                          </div>
                          <div>
                            <span className="text-sm text-gray-600">Telefone:</span>
                            <p className="font-medium">{selectedInterview.candidate.phone || 'Não informado'}</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <span className="text-sm text-gray-600">Pontuação Final:</span>
                            <p className="font-medium text-xl text-blue-600">{selectedInterview.interview.totalScore}%</p>
                          </div>
                          <div>
                            <span className="text-sm text-gray-600">Categoria de Desempenho:</span>
                            <Badge className={getCategoryBadge(selectedInterview.interview.category)}>
                              {selectedInterview.interview.category === 'high' ? 'Alto Desempenho' : 
                               selectedInterview.interview.category === 'medium' ? 'Médio Desempenho' : 'Baixo Desempenho'}
                            </Badge>
                          </div>
                          {selectedInterview.job && (
                            <div>
                              <span className="text-sm text-gray-600">Vaga:</span>
                              <p className="font-medium">{selectedInterview.job.title}</p>
                            </div>
                          )}
                          <div>
                            <span className="text-sm text-gray-600">Total de Respostas:</span>
                            <p className="font-medium">{selectedInterview.responses.length} pergunta(s)</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Responses Section */}
                    <div>
                      <h3 className="font-semibold text-lg mb-4">Respostas Detalhadas</h3>
                      {selectedInterview.responses.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <p>Nenhuma resposta registrada para esta entrevista</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {selectedInterview.responses.map((response, index) => (
                            <Card key={response.id} className="border">
                              <CardContent className="p-4">
                                <div className="space-y-3">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <h4 className="font-medium text-blue-600 text-lg">
                                        Pergunta {index + 1}
                                      </h4>
                                      <p className="text-sm text-gray-600 mt-1">
                                        {response.questionText || 'Texto da pergunta não disponível'}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="bg-blue-50">
                                        <Star className="w-3 h-3 mr-1" />
                                        {response.score}%
                                      </Badge>
                                      {response.recordingDuration > 0 && (
                                        <Badge variant="outline" className="bg-gray-50">
                                          <Clock className="w-3 h-3 mr-1" />
                                          {formatDuration(response.recordingDuration)}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="bg-gray-50 rounded-lg p-3">
                                    <h5 className="text-sm font-medium text-gray-700 mb-2">Transcrição da Resposta:</h5>
                                    <p className="text-sm text-gray-900 leading-relaxed">
                                      {response.transcription || 'Transcrição não disponível'}
                                    </p>
                                  </div>

                                  {response.audioUrl && (
                                    <div className="flex items-center gap-2 pt-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          const audio = new Audio(response.audioUrl);
                                          audio.play();
                                        }}
                                      >
                                        <Play className="w-4 h-4 mr-2" />
                                        Reproduzir Áudio
                                      </Button>
                                      <span className="text-sm text-gray-500">
                                        Áudio da resposta disponível
                                      </span>
                                    </div>
                                  )}

                                  {response.aiAnalysis && (
                                    <div className="bg-blue-50 rounded-lg p-3">
                                      <h5 className="text-sm font-medium text-blue-700 mb-2">Análise IA:</h5>
                                      <p className="text-sm text-blue-900">
                                        {typeof response.aiAnalysis === 'string' ? response.aiAnalysis : JSON.stringify(response.aiAnalysis)}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          )}
        </>
      )}
    </div>
  );
}