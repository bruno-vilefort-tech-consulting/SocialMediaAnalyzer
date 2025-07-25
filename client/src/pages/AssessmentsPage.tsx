import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  CheckSquare, 
  Send, 
  FileText, 
  Users, 
  Clock,
  Calendar,
  Search,
  Filter,
  MoreVertical
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AssessmentForm from "@/components/Assessments/AssessmentForm";

export default function AssessmentsPage() {
  const [activeTab, setActiveTab] = useState("enviar");
  const [searchTerm, setSearchTerm] = useState("");

  // Mock data para demonstração
  const mockAssessments = [
    {
      id: 1,
      title: "Assessment Desenvolvedor Frontend",
      description: "Avaliação técnica para desenvolvedores React e TypeScript",
      totalQuestions: 15,
      duration: 60,
      status: "ativo",
      createdAt: "2025-06-20",
      completedBy: 23,
      averageScore: 78
    },
    {
      id: 2,
      title: "Assessment Vendas Consultivas",
      description: "Teste de habilidades de vendas e relacionamento com clientes",
      totalQuestions: 12,
      duration: 45,
      status: "rascunho",
      createdAt: "2025-06-18",
      completedBy: 0,
      averageScore: 0
    },
    {
      id: 3,
      title: "Assessment Liderança",
      description: "Avaliação de competências de liderança e gestão de equipes",
      totalQuestions: 20,
      duration: 90,
      status: "pausado",
      createdAt: "2025-06-15",
      completedBy: 45,
      averageScore: 82
    }
  ];

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      ativo: { label: "Ativo", variant: "default" as const, color: "bg-green-100 text-green-800" },
      rascunho: { label: "Rascunho", variant: "secondary" as const, color: "bg-gray-100 text-gray-800" },
      pausado: { label: "Pausado", variant: "destructive" as const, color: "bg-red-100 text-red-800" }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.rascunho;
    
    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const filteredAssessments = mockAssessments.filter(assessment =>
    assessment.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    assessment.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <CheckSquare className="h-8 w-8 text-primary" />
            Assessments
          </h1>
          <p className="text-gray-600 mt-2">
            Crie e gerencie assessments personalizados para avaliar candidatos
          </p>
        </div>
      </div>
      {/* Tabs principais dividindo a tela */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="enviar" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Enviar Assessment
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Relatórios
          </TabsTrigger>
        </TabsList>

        {/* Aba 1: Enviar Assessment */}
        <TabsContent value="enviar" className="space-y-6">
          <AssessmentForm />
        </TabsContent>

        {/* Aba 2: Relatórios */}
        <TabsContent value="relatorios" className="space-y-6">
          {/* Filtros e busca */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Buscar assessments..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <Select defaultValue="todos">
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos Status</SelectItem>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="rascunho">Rascunho</SelectItem>
                      <SelectItem value="pausado">Pausado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filtros
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Assessments */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredAssessments.map((assessment) => (
              <Card key={assessment.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2">{assessment.title}</CardTitle>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {assessment.description}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>Ver Relatório</DropdownMenuItem>
                        <DropdownMenuItem>Editar</DropdownMenuItem>
                        <DropdownMenuItem>Duplicar</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600">
                          Arquivar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Status */}
                    <div className="flex items-center justify-between">
                      {getStatusBadge(assessment.status)}
                      <span className="text-xs text-gray-500">
                        {assessment.createdAt}
                      </span>
                    </div>

                    {/* Métricas */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span>{assessment.totalQuestions} questões</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span>{assessment.duration} min</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span>{assessment.completedBy} respostas</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckSquare className="h-4 w-4 text-gray-400" />
                        <span>{assessment.averageScore}% média</span>
                      </div>
                    </div>

                    {/* Botão de ação */}
                    <Button variant="outline" size="sm" className="w-full">
                      Ver Relatório Completo
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredAssessments.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckSquare className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum assessment encontrado</h3>
                <p className="text-gray-600 text-center">
                  {searchTerm 
                    ? "Nenhum assessment corresponde aos critérios de busca."
                    : "Você ainda não criou nenhum assessment."
                  }
                </p>
                {!searchTerm && (
                  <Button 
                    className="mt-4" 
                    onClick={() => setActiveTab("enviar")}
                  >
                    Criar Primeiro Assessment
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}