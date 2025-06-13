import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  BarChart, 
  Download, 
  Play, 
  Pause, 
  Filter, 
  TrendingUp, 
  Users, 
  Clock,
  Star,
  Search
} from "lucide-react";
import { useAudioRecorder } from "@/hooks/useAudio";

interface InterviewResult {
  interview: {
    id: number;
    status: string;
    totalScore: number;
    category: string;
    startedAt: string;
    completedAt: string;
  };
  candidate: {
    id: number;
    name: string;
    email: string;
    whatsapp: string;
  };
  responses: Array<{
    id: number;
    audioUrl: string;
    transcription: string;
    score: number;
    recordingDuration: number;
  }>;
}

export default function ResultsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [currentAudio, setCurrentAudio] = useState<string | null>(null);
  const { playAudio, isPlaying } = useAudioRecorder();
  
  // Get selection ID from URL params
  const [location] = useLocation();
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const selectionId = urlParams.get('selection') || '1';

  const { data: results = [], isLoading } = useQuery<InterviewResult[]>({
    queryKey: ["/api/selections", selectionId, "results"],
  });

  const filteredResults = results.filter(result => {
    const matchesSearch = result.candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         result.candidate.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || result.interview.category === selectedCategory;
    const matchesStatus = selectedStatus === "all" || result.interview.status === selectedStatus;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handlePlayAudio = (audioUrl: string) => {
    if (currentAudio === audioUrl && isPlaying) {
      setCurrentAudio(null);
    } else {
      setCurrentAudio(audioUrl);
      playAudio(audioUrl);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "high":
        return "bg-green-100 text-green-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-red-100 text-red-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "high":
        return "Alto";
      case "medium":
        return "Médio";
      case "low":
        return "Baixo";
      default:
        return "Não avaliado";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "started":
        return "bg-yellow-100 text-yellow-800";
      case "pending":
        return "bg-slate-100 text-slate-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return "Concluída";
      case "started":
        return "Em Progresso";
      case "pending":
        return "Pendente";
      default:
        return "Não iniciada";
    }
  };

  const completedResults = results.filter(r => r.interview.status === "completed");
  const avgScore = completedResults.length > 0 
    ? Math.round(completedResults.reduce((sum, r) => sum + (r.interview.totalScore || 0), 0) / completedResults.length)
    : 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Resultados da Seleção</h2>
            <p className="text-slate-600">Análise e avaliação dos candidatos</p>
          </div>
          <Button disabled>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Resultados da Seleção</h2>
          <p className="text-slate-600">Análise e avaliação dos candidatos</p>
        </div>
        <Button>
          <Download className="mr-2 h-4 w-4" />
          Exportar Resultados
        </Button>
      </div>
      
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="text-blue-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-slate-900">{results.length}</div>
                <div className="text-sm text-slate-500">Total de Candidatos</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <BarChart className="text-green-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-slate-900">{completedResults.length}</div>
                <div className="text-sm text-slate-500">Entrevistas Concluídas</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Star className="text-yellow-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-slate-900">{avgScore}%</div>
                <div className="text-sm text-slate-500">Score Médio</div>
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
                <div className="text-2xl font-bold text-slate-900">
                  {results.filter(r => r.interview.category === "high").length}
                </div>
                <div className="text-sm text-slate-500">Candidatos Top</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Buscar candidato..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select 
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="all">Todos os Status</option>
              <option value="completed">Concluída</option>
              <option value="started">Em Progresso</option>
              <option value="pending">Pendente</option>
            </select>
            <select 
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">Todas as Categorias</option>
              <option value="high">Alto</option>
              <option value="medium">Médio</option>
              <option value="low">Baixo</option>
            </select>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              Aplicar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Results Table */}
      {filteredResults.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <BarChart className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhum resultado encontrado</h3>
            <p className="text-slate-500">
              {searchTerm || selectedCategory !== "all" || selectedStatus !== "all"
                ? "Tente ajustar os filtros de busca"
                : "Os resultados aparecerão aqui quando as entrevistas forem concluídas"
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Resultados Detalhados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Candidato
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Categoria
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Duração
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {filteredResults.map((result) => (
                    <tr key={result.interview.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                            <Users className="text-primary h-5 w-5" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-slate-900">
                              {result.candidate.name}
                            </div>
                            <div className="text-sm text-slate-500">
                              {result.candidate.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge className={getStatusColor(result.interview.status)}>
                          {getStatusLabel(result.interview.status)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900">
                          {result.interview.totalScore || 0}%
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge className={getCategoryColor(result.interview.category)}>
                          {getCategoryLabel(result.interview.category)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {result.interview.completedAt && result.interview.startedAt ? (
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            {Math.round(
                              (new Date(result.interview.completedAt).getTime() - 
                               new Date(result.interview.startedAt).getTime()) / 60000
                            )} min
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          {result.responses.length > 0 && result.responses[0].audioUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePlayAudio(result.responses[0].audioUrl)}
                            >
                              {currentAudio === result.responses[0].audioUrl && isPlaying ? (
                                <Pause className="h-4 w-4" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          <Button variant="ghost" size="sm">
                            Ver Detalhes
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
