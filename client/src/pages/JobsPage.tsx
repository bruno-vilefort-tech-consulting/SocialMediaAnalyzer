import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Briefcase, Edit, Trash2, HelpCircle, Users } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import JobModal from "@/components/JobModal";
import type { Job } from "@shared/schema";

export default function JobsPage() {
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const deleteJobMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/jobs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Vaga removida",
        description: "Vaga foi removida com sucesso",
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

  const handleEditJob = (job: Job) => {
    setSelectedJob(job);
    setIsJobModalOpen(true);
  };

  const handleDeleteJob = (id: number) => {
    if (confirm("Tem certeza que deseja remover esta vaga?")) {
      deleteJobMutation.mutate(id);
    }
  };

  const handleModalClose = () => {
    setIsJobModalOpen(false);
    setSelectedJob(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Gerenciar Vagas</h2>
            <p className="text-slate-600">Criar e editar vagas com suas respectivas perguntas</p>
          </div>
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Nova Vaga
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-slate-200 rounded mb-4"></div>
                <div className="h-4 bg-slate-200 rounded mb-2"></div>
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
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Gerenciar Vagas</h2>
          <p className="text-slate-600">Criar e editar vagas com suas respectivas perguntas</p>
        </div>
        <Button onClick={() => setIsJobModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Vaga
        </Button>
      </div>
      
      {/* Jobs Grid */}
      {jobs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Briefcase className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhuma vaga cadastrada</h3>
            <p className="text-slate-500 mb-4">
              Comece criando sua primeira vaga para o processo seletivo
            </p>
            <Button onClick={() => setIsJobModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Vaga
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {jobs.map((job) => (
            <Card key={job.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Briefcase className="text-primary" />
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleEditJob(job)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDeleteJob(job.id)}
                      disabled={deleteJobMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{job.title}</h3>
                <p className="text-sm text-slate-600 mb-4 line-clamp-2">{job.description}</p>
                
                <div className="flex items-center justify-between text-sm mb-4">
                  <div className="flex items-center text-slate-500">
                    <HelpCircle className="mr-1 h-4 w-4" />
                    0 perguntas
                  </div>
                  <div className="flex items-center text-slate-500">
                    <Users className="mr-1 h-4 w-4" />
                    0 candidatos
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <Badge 
                    variant={job.status === "active" ? "default" : "secondary"}
                    className={job.status === "active" ? "bg-green-100 text-green-800" : ""}
                  >
                    {job.status === "active" ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <div className="flex space-x-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => handleEditJob(job)}
                    >
                      Ver Perguntas
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                    >
                      Candidatos
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <JobModal 
        isOpen={isJobModalOpen}
        onClose={handleModalClose}
        job={selectedJob}
      />
    </div>
  );
}
