import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Edit, Plus, Minus, Users, Search } from "lucide-react";

interface Candidate {
  id: number;
  name: string;
  email: string;
  whatsapp: string;
  clientId: number;
}

interface CandidateList {
  id: number;
  name: string;
  description: string;
  clientId: number;
}

interface CandidateListMembership {
  id: number;
  candidateId: number;
  listId: number;
  clientId: number;
}

interface Client {
  id: number;
  companyName: string;
}

export default function CandidatesManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedClient, setSelectedClient] = useState<number | null>(null);
  const [previousSelectedClient, setPreviousSelectedClient] = useState<number | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  // Estados para paginação
  const [currentPage, setCurrentPage] = useState(1);
  const candidatesPerPage = 10;
  
  // Reset página quando filtros mudam
  const resetPagination = () => setCurrentPage(1);
  
  const [isListsDialogOpen, setIsListsDialogOpen] = useState(false);
  const [isNewCandidateDialogOpen, setIsNewCandidateDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editForm, setEditForm] = useState({ name: "", email: "", whatsapp: "" });
  const [newCandidateForm, setNewCandidateForm] = useState({ 
    name: "", 
    email: "", 
    whatsapp: "", 
    clientId: 0, 
    listId: undefined as number | undefined
  });

  const isMaster = user?.role === 'master';
  const clientId = isMaster ? selectedClient : user?.clientId;

  // Query para buscar clientes (apenas para master)
  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
    enabled: isMaster,
  });

  // Query para buscar candidatos - usa queryFn padrão que já faz json parse
  const { data: candidates = [], isLoading: candidatesLoading } = useQuery({
    queryKey: selectedClient ? [`/api/candidates?clientId=${selectedClient}`] : ["/api/candidates"],
    enabled: isMaster ? true : !!user?.clientId,
  });

  // Query para buscar listas de candidatos - usa queryFn padrão que já faz json parse
  const { data: candidateLists = [] } = useQuery({
    queryKey: selectedClient ? [`/api/candidate-lists?clientId=${selectedClient}`] : ["/api/candidate-lists"],
    enabled: isMaster ? true : !!user?.clientId,
  });

  // Query para buscar memberships (relacionamentos candidato-lista) - usa queryFn padrão
  const { data: memberships = [] } = useQuery({
    queryKey: ["/api/candidate-list-memberships"],
    enabled: isMaster ? true : !!user?.clientId,
  });

  // Filtrar candidatos por termo de busca e cliente
  const filteredCandidates = Array.isArray(candidates) ? candidates.filter((candidate: Candidate) => {
    // Verificar se o ID é válido
    if (!candidate.clientId || isNaN(candidate.clientId)) {
      console.log(`⚠️ Candidato ${candidate.name} tem clientId inválido:`, candidate.clientId);
      return false;
    }

    const searchMatch = !searchTerm || 
      candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      candidate.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      candidate.whatsapp.includes(searchTerm);
    
    // Para master: filtrar por cliente selecionado se houver, senão mostrar todos
    if (isMaster) {
      const clientMatch = !selectedClient || candidate.clientId === selectedClient;
      return searchMatch && clientMatch;
    }
    
    // Para cliente: filtrar por seu próprio clientId
    return searchMatch && candidate.clientId === user?.clientId;
  }) : [];





  // Função para obter listas de um candidato
  const getCandidateLists = (candidateId: number) => {
    console.log(`🔍 Buscando listas para candidato ${candidateId}`);
    console.log(`📋 Memberships disponíveis:`, memberships);
    
    if (!memberships || !Array.isArray(memberships)) {
      console.log(`❌ Memberships não disponíveis`);
      return [];
    }
    
    const candidateMemberships = (memberships as CandidateListMembership[]).filter((m: CandidateListMembership) => {
      const match = m.candidateId === candidateId;
      console.log(`🔍 Comparando ${m.candidateId} === ${candidateId}: ${match}`);
      return match;
    });
    
    console.log(`📋 Memberships do candidato ${candidateId}:`, candidateMemberships);
    
    const lists = candidateMemberships.map((membership: CandidateListMembership) => {
      return (candidateLists as CandidateList[]).find((list: CandidateList) => list.id === membership.listId);
    }).filter(Boolean) as CandidateList[];
    
    console.log(`📋 Listas encontradas:`, lists);
    return lists;
  };

  // Mutation para criar candidato
  const createCandidateMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; whatsapp: string; clientId: number; listId?: number }) => {
      return await apiRequest("/api/candidates", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/candidate-list-memberships"] });
      toast({
        title: "Sucesso",
        description: "Candidato criado com sucesso",
      });
      setIsNewCandidateDialogOpen(false);
      setNewCandidateForm({ name: "", email: "", whatsapp: "", clientId: 0, listId: undefined });
    },
    onError: () => {
      toast({
        title: "Erro", 
        description: "Falha ao criar candidato",
        variant: "destructive",
      });
    },
  });

  // Mutation para atualizar candidato
  const updateCandidateMutation = useMutation({
    mutationFn: async (data: { id: number; name: string; email: string; whatsapp: string }) => {
      return await apiRequest(`/api/candidates/${data.id}`, "PATCH", {
        name: data.name,
        email: data.email,
        whatsapp: data.whatsapp
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      toast({
        title: "Sucesso",
        description: "Candidato atualizado com sucesso",
      });
      setIsEditDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar candidato",
        variant: "destructive",
      });
    },
  });

  // Mutation para deletar candidato
  const deleteCandidateMutation = useMutation({
    mutationFn: async (candidateId: number) => {
      return await apiRequest(`/api/candidates/${candidateId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/candidate-list-memberships"] });
      toast({
        title: "Sucesso",
        description: "Candidato removido com sucesso",
      });
      setSelectedCandidate(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao remover candidato",
        variant: "destructive",
      });
    },
  });

  // Mutation para remover candidato de lista
  const removeFromListMutation = useMutation({
    mutationFn: async ({ candidateId, listId }: { candidateId: number; listId: number }) => {
      return await apiRequest(`/api/candidates/${candidateId}/lists/${listId}`, "DELETE");
    },
    onSuccess: () => {
      // Invalidar todas as queries relacionadas a memberships
      queryClient.invalidateQueries({ queryKey: ["/api/candidate-list-memberships"] });
      // Invalidar queries de candidatos para atualizar contadores
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      // Invalidar queries de listas para atualizar contadores
      queryClient.invalidateQueries({ queryKey: ["/api/candidate-lists"] });
      toast({
        title: "Sucesso",
        description: "Candidato removido da lista com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao remover candidato da lista",
        variant: "destructive",
      });
    },
  });

  // Mutation para adicionar candidato à lista
  const addToListMutation = useMutation({
    mutationFn: async ({ candidateId, listId }: { candidateId: number; listId: number }) => {
      return await apiRequest(`/api/candidates/${candidateId}/lists/${listId}`, "POST");
    },
    onSuccess: () => {
      // Invalidar todas as queries relacionadas a memberships
      queryClient.invalidateQueries({ queryKey: ["/api/candidate-list-memberships"] });
      // Invalidar queries de candidatos para atualizar contadores
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      // Invalidar queries de listas para atualizar contadores
      queryClient.invalidateQueries({ queryKey: ["/api/candidate-lists"] });
      toast({
        title: "Sucesso",
        description: "Candidato adicionado à lista com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao adicionar candidato à lista",
        variant: "destructive",
      });
    },
  });

  // Handlers
  const handleEditCandidate = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setEditForm({
      name: candidate.name,
      email: candidate.email,
      whatsapp: candidate.whatsapp
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedCandidate) return;
    
    updateCandidateMutation.mutate({
      id: selectedCandidate.id,
      ...editForm
    });
  };

  const handleManageLists = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    // Se for master, salvar filtro atual e definir filtro para o clientId do candidato
    if (isMaster) {
      setPreviousSelectedClient(selectedClient);
      setSelectedClient(candidate.clientId);
    }
    setIsListsDialogOpen(true);
  };

  const handleRemoveFromList = (listId: number) => {
    if (!selectedCandidate) return;
    removeFromListMutation.mutate({
      candidateId: selectedCandidate.id,
      listId
    });
  };

  const handleAddToList = (listId: number) => {
    if (!selectedCandidate) return;
    addToListMutation.mutate({
      candidateId: selectedCandidate.id,
      listId
    });
  };

  const handleCreateCandidate = () => {
    const candidateData = {
      ...newCandidateForm,
      clientId: isMaster ? newCandidateForm.clientId : clientId!
    };
    
    // Validar apenas campos obrigatórios (nome, email, whatsapp, clientId)
    if (!candidateData.name || !candidateData.email || !candidateData.whatsapp || !candidateData.clientId) {
      toast({
        title: "Erro",
        description: "Preencha os campos obrigatórios: nome, email, WhatsApp e cliente",
        variant: "destructive",
      });
      return;
    }
    
    createCandidateMutation.mutate(candidateData);
  };

  // Obter listas disponíveis para adicionar (não está no candidato)
  const getAvailableLists = () => {
    if (!selectedCandidate) return [];
    const candidateListIds = getCandidateLists(selectedCandidate.id).map((list: CandidateList) => list.id);
    // Usar o clientId do candidato selecionado, não o filtro atual
    return (candidateLists as CandidateList[]).filter((list: CandidateList) => 
      !candidateListIds.includes(list.id) && 
      list.clientId === selectedCandidate.clientId
    );
  };

  // Função para obter o nome do cliente pelo ID
  const getClientName = (clientId: number) => {
    console.log('🏢 getClientName chamado com clientId:', clientId, 'tipo:', typeof clientId);
    
    if (!isMaster || !clients || !Array.isArray(clients)) {
      console.log('❌ Condições não atendidas - isMaster:', isMaster, 'clients:', clients);
      return null;
    }
    
    if (!clientId || isNaN(clientId)) {
      console.log('❌ ClientId inválido:', clientId);
      return `Cliente #undefined`;
    }
    
    const client = (clients as Client[]).find((c: Client) => c.id === clientId);
    console.log('🔍 Cliente encontrado:', client);
    
    if (client) {
      return client.companyName;
    } else {
      console.log('❌ Cliente não encontrado para ID:', clientId);
      console.log('📋 Clientes disponíveis:', clients);
      return `Cliente #${clientId}`;
    }
  };

  // Calcular paginação após todos os filtros
  const totalCandidates = filteredCandidates.length;
  const totalPages = Math.ceil(totalCandidates / candidatesPerPage);
  const startIndex = (currentPage - 1) * candidatesPerPage;
  const endIndex = startIndex + candidatesPerPage;
  const paginatedCandidates = filteredCandidates.slice(startIndex, endIndex);

  if (candidatesLoading) {
    return <div className="p-6">Carregando candidatos...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Users className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Gerenciar Candidatos</h1>
        </div>
        <Button onClick={() => setIsNewCandidateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Candidato
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-4 items-center">
        {/* Campo de busca */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar candidatos..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-10"
          />
        </div>

        {/* Filtro por cliente (apenas para master) */}
        {isMaster && (
          <Select onValueChange={(value) => {
            setSelectedClient(value === "all" ? null : Number(value));
            setCurrentPage(1);
          }}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Filtrar por cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {(clients as Client[]).map((client: Client) => (
                <SelectItem key={client.id} value={client.id.toString()}>
                  {client.companyName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Lista de candidatos */}
      <div className="grid gap-4">
        {paginatedCandidates.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-gray-500">
              {candidatesLoading ? "Carregando..." : "Nenhum candidato encontrado"}
            </CardContent>
          </Card>
        ) : (
          paginatedCandidates.map((candidate) => {
            const candidateLists = getCandidateLists(candidate.id);
            
            return (
              <Card key={candidate.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <h3 className="font-semibold text-base">{candidate.name}</h3>
                        <span className="text-sm text-gray-600">{candidate.email}</span>
                        <span className="text-sm text-gray-600">WhatsApp: {candidate.whatsapp}</span>
                        {isMaster && (
                          <Badge variant="outline" className="text-xs">
                            {getClientName(candidate.clientId)}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Listas:</span>
                        {candidateLists.length > 0 ? (
                          candidateLists.map((list) => (
                            <Badge key={list.id} variant="secondary" className="text-xs">
                              {list.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">Nenhuma lista</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline" 
                        size="sm"
                        onClick={() => handleManageLists(candidate)}
                      >
                        <Users className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditCandidate(candidate)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir o candidato {candidate.name}? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => deleteCandidateMutation.mutate(candidate.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-gray-600">
            Mostrando {startIndex + 1} a {Math.min(endIndex, totalCandidates)} de {totalCandidates} candidatos
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </Button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className="w-8 h-8"
                >
                  {page}
                </Button>
              ))}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Próximo
            </Button>
          </div>
        </div>
      )}

      {/* Dialog para editar candidato */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Candidato</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Nome completo"
              />
            </div>
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <Label htmlFor="edit-whatsapp">WhatsApp</Label>
              <Input
                id="edit-whatsapp"
                value={editForm.whatsapp}
                onChange={(e) => setEditForm({ ...editForm, whatsapp: e.target.value })}
                placeholder="11987654321 ou 5511987654321"
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-2 mt-6">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateCandidateMutation.isPending}>
              {updateCandidateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para gerenciar listas do candidato */}
      <Dialog open={isListsDialogOpen} onOpenChange={(open) => {
        setIsListsDialogOpen(open);
        // Se está fechando o diálogo e for master, restaurar filtro anterior
        if (!open && isMaster) {
          setSelectedClient(previousSelectedClient);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerenciar Listas - {selectedCandidate?.name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Listas atuais */}
            <div>
              <h3 className="font-semibold mb-3">Listas atuais</h3>
              <div className="space-y-2">
                {selectedCandidate && getCandidateLists(selectedCandidate.id).length > 0 ? (
                  getCandidateLists(selectedCandidate.id).map((list) => (
                    <div key={list.id} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <span className="font-medium">{list.name}</span>
                        <p className="text-sm text-gray-600">{list.description}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveFromList(list.id)}
                        disabled={removeFromListMutation.isPending}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 italic">Candidato não está em nenhuma lista</p>
                )}
              </div>
            </div>

            {/* Listas disponíveis */}
            <div>
              <h3 className="font-semibold mb-3">Adicionar a listas</h3>
              <div className="space-y-2">
                {getAvailableLists().length > 0 ? (
                  getAvailableLists().map((list) => (
                    <div key={list.id} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <span className="font-medium">{list.name}</span>
                        <p className="text-sm text-gray-600">{list.description}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddToList(list.id)}
                        disabled={addToListMutation.isPending}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 italic">Todas as listas disponíveis já foram atribuídas</p>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex justify-end mt-6">
            <Button onClick={() => setIsListsDialogOpen(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para novo candidato */}
      <Dialog open={isNewCandidateDialogOpen} onOpenChange={setIsNewCandidateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Candidato</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-name">Nome *</Label>
              <Input
                id="new-name"
                value={newCandidateForm.name}
                onChange={(e) => setNewCandidateForm({ ...newCandidateForm, name: e.target.value })}
                placeholder="Nome completo"
              />
            </div>
            <div>
              <Label htmlFor="new-email">Email *</Label>
              <Input
                id="new-email"
                type="email"
                value={newCandidateForm.email}
                onChange={(e) => setNewCandidateForm({ ...newCandidateForm, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <Label htmlFor="new-whatsapp">WhatsApp *</Label>
              <Input
                id="new-whatsapp"
                value={newCandidateForm.whatsapp}
                onChange={(e) => setNewCandidateForm({ ...newCandidateForm, whatsapp: e.target.value })}
                placeholder="11987654321 ou 5511987654321"
              />
            </div>

            {/* Seletor de cliente (apenas para master) */}
            {isMaster && (
              <div>
                <Label htmlFor="new-client">Cliente *</Label>
                <Select onValueChange={(value) => setNewCandidateForm({ ...newCandidateForm, clientId: Number(value) })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {(clients as Client[]).map((client: Client) => (
                      <SelectItem key={client.id} value={client.id.toString()}>
                        {client.companyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Seletor de lista - OPCIONAL */}
            <div>
              <Label htmlFor="new-list">Lista (opcional)</Label>
              <Select onValueChange={(value) => setNewCandidateForm({ ...newCandidateForm, listId: value === "0" ? undefined : Number(value) })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma lista (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sem lista</SelectItem>
                  {(candidateLists as CandidateList[])
                    .filter((list: CandidateList) => 
                      isMaster ? 
                        (newCandidateForm.clientId ? list.clientId === newCandidateForm.clientId : true) :
                        list.clientId === clientId
                    )
                    .map((list: CandidateList) => (
                      <SelectItem key={list.id} value={list.id.toString()}>
                        {list.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex justify-end space-x-2 mt-6">
            <Button variant="outline" onClick={() => setIsNewCandidateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateCandidate} disabled={createCandidateMutation.isPending}>
              {createCandidateMutation.isPending ? "Criando..." : "Criar Candidato"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}