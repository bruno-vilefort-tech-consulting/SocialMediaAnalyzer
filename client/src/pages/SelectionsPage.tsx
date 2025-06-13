import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, ClipboardList, Edit, Trash2, Send, Calendar, Users, Eye } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import SelectionModal from "@/components/SelectionModal";
import type { Selection } from "@shared/schema";

export default function SelectionsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const [selectedSelection, setSelectedSelection] = useState<Selection | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: selections = [], isLoading } = useQuery<Selection[]>({
    queryKey: ["/api/selections"],
  });

  const deleteSelectionMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/selections/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/selections"] });
      toast({
        title: "Seleção removida",
        description: "Seleção foi removida com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao remover seleção",
        variant: "destructive",
      });
    },
  });

  const activateSelectionMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PUT", `/api/selections/${id}`, { status: "active" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/selections"] });
      toast({
        title: "Seleção ativada",
        description: "Convites serão enviados em breve",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao ativar seleção",
        variant: "destructive",
      });
    },
  });

  const filteredSelections = selections.filter(selection =>
    selection.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditSelection = (selection: Selection) => {
    setSelectedSelection(selection);
    setIsSelectionModalOpen(true);
  };

  const handleDeleteSelection = (id: number) => {
    if (confirm("Tem certeza que deseja remover esta seleção?")) {
      deleteSelectionMutation.mutate(id);
    }
  };

  const handleActivateSelection = (id: number) => {
    if (confirm("Tem certeza que deseja ativar esta seleção? Os convites serão enviados automaticamente.")) {
      activateSelectionMutation.mutate(id);
    }
  };

  const handleViewResults = (selectionId: number) => {
    setLocation(`/results?selection=${selectionId}`);
  };

  const handleModalClose = () => {
    setIsSelectionModalOpen(false);
    setSelectedSelection(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "completed":
        return "bg-blue-100 text-blue-800";
      case "draft":
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Ativa";
      case "completed":
        return "Concluída";
      case "draft":
      default:
        return "Rascunho";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Seleções</h2>
            <p className="text-slate-600">Gerenciar processos seletivos e envio de convites</p>
          </div>
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Nova Seleção
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
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Seleções</h2>
          <p className="text-slate-600">Gerenciar processos seletivos e envio de convites</p>
        </div>
        <Button onClick={() => setIsSelectionModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Seleção
        </Button>
      </div>
      
      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="Buscar seleção..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary">
              <option>Todos os Status</option>
              <option>Rascunho</option>
              <option>Ativa</option>
              <option>Concluída</option>
            </select>
            <select className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary">
              <option>Todas as Vagas</option>
            </select>
          </div>
        </CardContent>
      </Card>
      
      {/* Selections Grid */}
      {filteredSelections.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ClipboardList className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhuma seleção encontrada</h3>
            <p className="text-slate-500 mb-4">
              {searchTerm ? "Tente ajustar os filtros de busca" : "Comece criando sua primeira seleção"}
            </p>
            <Button onClick={() => setIsSelectionModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Seleção
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSelections.map((selection) => (
            <Card key={selection.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <ClipboardList className="text-primary" />
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleEditSelection(selection)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDeleteSelection(selection.id)}
                      disabled={deleteSelectionMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{selection.name}</h3>
                
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Canal:</span>
                    <span className="text-slate-900 capitalize">{selection.sendVia}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Prazo:</span>
                    <span className="text-slate-900">
                      {new Date(selection.deadline).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  {selection.scheduledFor && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Agendado:</span>
                      <span className="text-slate-900">
                        {new Date(selection.scheduledFor).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between mb-4">
                  <Badge className={getStatusColor(selection.status)}>
                    {getStatusLabel(selection.status)}
                  </Badge>
                  <div className="flex items-center text-sm text-slate-500">
                    <Users className="mr-1 h-4 w-4" />
                    0 candidatos
                  </div>
                </div>
                
                <div className="space-y-2">
                  {selection.status === "draft" && (
                    <Button 
                      size="sm" 
                      className="w-full"
                      onClick={() => handleActivateSelection(selection.id)}
                      disabled={activateSelectionMutation.isPending}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {activateSelectionMutation.isPending ? "Ativando..." : "Ativar Seleção"}
                    </Button>
                  )}
                  
                  {selection.status === "active" && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="w-full"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      Envios Automáticos
                    </Button>
                  )}
                  
                  {(selection.status === "active" || selection.status === "completed") && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="w-full"
                      onClick={() => handleViewResults(selection.id)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Ver Resultados
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SelectionModal 
        isOpen={isSelectionModalOpen}
        onClose={handleModalClose}
        selection={selectedSelection}
      />
    </div>
  );
}
