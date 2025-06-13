import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Briefcase,
  MessageSquare,
  Calendar,
  Building
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import JobModal from "@/components/JobModal";
import type { Job } from "@shared/schema";

export default function JobsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Query para buscar vagas
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["/api/jobs"],
    queryFn: async () => {
      const response = await fetch("/api/jobs", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch jobs");
      return response.json();
    },
  });

  // Query para buscar número de perguntas por vaga
  const { data: questionsCount = {} } = useQuery({
    queryKey: ["/api/questions/count"],
    queryFn: async () => {
      const response = await fetch("/api/questions/count", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch questions count");
      return response.json();
    },
  });

  // Mutation para deletar vaga
  const deleteJobMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/jobs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/questions/count"] });
      toast({
        title: "Sucesso!",
        description: "Vaga removida com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao remover vaga",
        variant: "destructive",
      });
    },
  });

  // Filtrar vagas baseado na busca
  const filteredJobs = jobs.filter((job: Job) =>
    job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeleteJob = (id: number) => {
    if (confirm("Tem certeza que deseja remover esta vaga?")) {
      deleteJobMutation.mutate(id);
    }
  };

  const handleOpenModal = (job?: Job) => {
    setSelectedJob(job || null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedJob(null);
    setIsModalOpen(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-slate-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Gerenciar Vagas</h2>
          <p className="text-slate-600">Cadastre vagas com perguntas personalizadas para entrevistas</p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="mr-2 h-4 w-4" />
          Cadastrar Vaga
        </Button>
      </div>
      
      {/* Filtros */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
            <Input
              placeholder="Buscar vagas por nome ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Lista de Vagas */}
      {filteredJobs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Briefcase className="mx-auto h-12 w-12 text-slate-400 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhuma vaga encontrada</h3>
            <p className="text-slate-500 mb-4">
              {searchTerm ? "Tente ajustar os filtros de busca" : "Comece cadastrando sua primeira vaga"}
            </p>
            <Button onClick={() => handleOpenModal()}>
              <Plus className="mr-2 h-4 w-4" />
              Cadastrar Vaga
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredJobs.map((job: Job) => (
            <Card key={job.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  {/* Lado esquerdo - Informações principais */}
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Briefcase className="text-primary h-6 w-6" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-xl font-semibold text-slate-900 truncate">
                          {job.title}
                        </h3>
                        <Badge 
                          variant={job.status === "active" ? "default" : "secondary"}
                          className={job.status === "active" ? "bg-green-100 text-green-800 border-green-200" : ""}
                        >
                          {job.status === "active" ? "Ativa" : "Inativa"}
                        </Badge>
                      </div>
                      
                      <p className="text-slate-600 mb-4 line-clamp-2">
                        {job.description}
                      </p>
                      
                      <div className="flex items-center space-x-6 text-sm text-slate-500">
                        <div className="flex items-center space-x-1">
                          <MessageSquare className="h-4 w-4" />
                          <span>
                            {questionsCount[job.id] || 0} pergunta{questionsCount[job.id] !== 1 ? 's' : ''}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>
                            Criada em {job.createdAt ? format(new Date(job.createdAt), "dd/MM/yyyy", { locale: ptBR }) : "Data não disponível"}
                          </span>
                        </div>
                        
                        {user?.role === 'master' && (
                          <div className="flex items-center space-x-1">
                            <Building className="h-4 w-4" />
                            <span>Cliente ID: {job.clientId}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Lado direito - Ações */}
                  <div className="flex space-x-2 flex-shrink-0">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleOpenModal(job)}
                      title="Editar vaga"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDeleteJob(job.id)}
                      disabled={deleteJobMutation.isPending}
                      title="Remover vaga"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Indicador de perguntas */}
                {questionsCount[job.id] > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">
                        Esta vaga possui {questionsCount[job.id]} pergunta{questionsCount[job.id] !== 1 ? 's' : ''} configurada{questionsCount[job.id] !== 1 ? 's' : ''}
                      </span>
                      <div className="flex space-x-2">
                        {[...Array(Math.min(questionsCount[job.id], 10))].map((_, i) => (
                          <div 
                            key={i} 
                            className="w-2 h-2 bg-primary/20 rounded-full"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Cadastro/Edição */}
      <JobModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        job={selectedJob}
      />
    </div>
  );
}