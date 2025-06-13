import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Edit, Trash2, Upload, Filter, Download } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import CandidateModal from "@/components/CandidateModal";
import type { Candidate } from "@shared/schema";

export default function CandidatesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: candidates = [], isLoading } = useQuery<Candidate[]>({
    queryKey: ["/api/candidates"],
  });

  const deleteCandidateMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/candidates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      toast({
        title: "Candidato removido",
        description: "Candidato foi removido com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao remover candidato",
        variant: "destructive",
      });
    },
  });

  const bulkImportMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return fetch('/api/candidates/bulk', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      toast({
        title: "Candidatos importados",
        description: "Candidatos foram importados com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao importar candidatos",
        variant: "destructive",
      });
    },
  });

  const filteredCandidates = candidates.filter(candidate =>
    candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    candidate.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    candidate.whatsapp.includes(searchTerm)
  );

  const handleEditCandidate = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setIsCandidateModalOpen(true);
  };

  const handleDeleteCandidate = (id: number) => {
    if (confirm("Tem certeza que deseja remover este candidato?")) {
      deleteCandidateMutation.mutate(id);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      bulkImportMutation.mutate(file);
    }
  };

  const handleModalClose = () => {
    setIsCandidateModalOpen(false);
    setSelectedCandidate(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Candidatos</h2>
            <p className="text-slate-600">Gerenciar candidatos e importar em lote</p>
          </div>
          <div className="flex space-x-2">
            <Button disabled>
              <Upload className="mr-2 h-4 w-4" />
              Importar
            </Button>
            <Button disabled>
              <Plus className="mr-2 h-4 w-4" />
              Novo Candidato
            </Button>
          </div>
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
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Candidatos</h2>
          <p className="text-slate-600">Gerenciar candidatos e importar em lote</p>
        </div>
        <div className="flex space-x-2">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
            id="file-upload"
          />
          <Button 
            variant="outline"
            onClick={() => document.getElementById('file-upload')?.click()}
            disabled={bulkImportMutation.isPending}
          >
            <Upload className="mr-2 h-4 w-4" />
            {bulkImportMutation.isPending ? "Importando..." : "Importar"}
          </Button>
          <Button onClick={() => setIsCandidateModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Candidato
          </Button>
        </div>
      </div>
      
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Buscar candidato..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary">
              <option>Todos os Status</option>
              <option>Ativo</option>
              <option>Inativo</option>
            </select>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              Filtrar
            </Button>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Candidates Grid */}
      {filteredCandidates.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhum candidato encontrado</h3>
            <p className="text-slate-500 mb-4">
              {searchTerm ? "Tente ajustar os filtros de busca" : "Comece adicionando candidatos ou importando uma lista"}
            </p>
            <div className="flex justify-center space-x-2">
              <Button 
                variant="outline"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Importar Lista
              </Button>
              <Button onClick={() => setIsCandidateModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Candidato
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCandidates.map((candidate) => (
            <Card key={candidate.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Users className="text-primary" />
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleEditCandidate(candidate)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDeleteCandidate(candidate.id)}
                      disabled={deleteCandidateMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{candidate.name}</h3>
                <p className="text-sm text-slate-600 mb-4">{candidate.email}</p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">WhatsApp:</span>
                    <span className="text-slate-900">{candidate.whatsapp}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cadastrado:</span>
                    <span className="text-slate-900">
                      {new Date(candidate.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <Badge variant="outline" className="w-full justify-center">
                    Disponível
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CandidateModal 
        isOpen={isCandidateModalOpen}
        onClose={handleModalClose}
        candidate={selectedCandidate}
      />
    </div>
  );
}
