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
import { Trash2, Edit, Plus, Minus, Users } from "lucide-react";

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
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isListsDialogOpen, setIsListsDialogOpen] = useState(false);
  const [isNewCandidateDialogOpen, setIsNewCandidateDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editForm, setEditForm] = useState({ name: "", email: "", whatsapp: "" });

  const isMaster = user?.role === 'master';
  const clientId = isMaster ? selectedClient : user?.clientId;

  // Query para buscar clientes (apenas para master)
  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
    enabled: isMaster,
  });

  // Query para buscar candidatos
  const { data: candidates = [], isLoading: candidatesLoading } = useQuery({
    queryKey: ["/api/candidates", clientId],
    enabled: !!clientId,
  });

  // Query para buscar listas de candidatos
  const { data: candidateLists = [] } = useQuery({
    queryKey: ["/api/candidate-lists", clientId],
    enabled: !!clientId,
  });

  // Query para buscar memberships (relacionamentos candidato-lista)
  const { data: memberships = [] } = useQuery({
    queryKey: ["/api/candidate-list-memberships", clientId],
    enabled: !!clientId,
  });

  // Filtrar candidatos por cliente
  const filteredCandidates = candidates.filter((candidate: Candidate) => 
    !clientId || candidate.clientId === clientId
  );

  // Função para obter listas de um candidato
  const getCandidateLists = (candidateId: number) => {
    console.log(`🔍 Buscando listas para candidato ${candidateId}`);
    console.log(`📋 Memberships disponíveis:`, memberships);
    
    if (!memberships || !Array.isArray(memberships)) {
      console.log(`❌ Memberships não disponíveis`);
      return [];
    }
    
    const candidateMemberships = memberships.filter((m: CandidateListMembership) => {
      const match = m.candidateId === candidateId;
      console.log(`🔍 Comparando ${m.candidateId} === ${candidateId}: ${match}`);
      return match;
    });
    
    console.log(`📋 Memberships do candidato ${candidateId}:`, candidateMemberships);
    
    const lists = candidateMemberships.map((membership: CandidateListMembership) => {
      const list = candidateLists.find((list: CandidateList) => list.id === membership.listId);
      return list;
    }).filter(Boolean);
    
    console.log(`📋 Listas encontradas:`, lists);
    return lists;
  };

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
      queryClient.invalidateQueries({ queryKey: ["/api/candidate-list-memberships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/candidate-list-memberships", clientId] });
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
      console.log(`🔗 Frontend: Adicionando candidato ${candidateId} à lista ${listId}`);
      return await apiRequest(`/api/candidates/${candidateId}/lists/${listId}`, "POST", {});
    },
    onSuccess: () => {
      console.log("✅ Frontend: Candidato adicionado à lista com sucesso");
      queryClient.invalidateQueries({ queryKey: ["/api/candidate-list-memberships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/candidate-list-memberships", clientId] });
      setIsListsDialogOpen(false);
      toast({
        title: "Sucesso",
        description: "Candidato adicionado à lista com sucesso",
      });
    },
    onError: (error) => {
      console.error("❌ Frontend: Erro ao adicionar candidato à lista:", error);
      toast({
        title: "Erro",
        description: "Falha ao adicionar candidato à lista",
        variant: "destructive",
      });
    },
  });

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
    
    if (!candidateData.name || !candidateData.email || !candidateData.whatsapp || 
        !candidateData.clientId || !candidateData.listId) {
      toast({
        title: "Erro",
        description: "Todos os campos são obrigatórios",
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
    return candidateLists.filter((list: CandidateList) => 
      !candidateListIds.includes(list.id) && 
      (!clientId || list.clientId === clientId)
    );
  };

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
      </div>

      {/* Seletor de cliente para masters */}
      {isMaster && (
        <Card>
          <CardHeader>
            <CardTitle>Filtrar por Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <Select onValueChange={(value) => setSelectedClient(Number(value))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client: Client) => (
                  <SelectItem key={client.id} value={client.id.toString()}>
                    {client.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Lista de candidatos em cards horizontais pequenos */}
      {clientId && (
        <div className="space-y-4">
          {/* Barra de ações no topo */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Candidatos ({filteredCandidates.length})
            </h2>
            
            <div className="flex items-center space-x-4">
              {/* Campo de busca */}
              <div className="relative">
                <Input
                  placeholder="Buscar candidatos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64"
                />
              </div>
              
              {/* Botão Novo Candidato */}
              <Dialog open={isNewCandidateDialogOpen} onOpenChange={setIsNewCandidateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Candidato
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>
          </div>
          
          <div className="space-y-3">
            {filteredCandidates.map((candidate: Candidate) => {
              const candidateListsData = getCandidateLists(candidate.id);
              
              return (
                <Card key={candidate.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center justify-between">
                    {/* Informações do candidato - lado esquerdo */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm truncate">{candidate.name}</h3>
                          <p className="text-xs text-gray-600 truncate">{candidate.email}</p>
                          <p className="text-xs text-gray-600">{candidate.whatsapp}</p>
                        </div>
                        
                        {/* Listas - centro */}
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {candidateListsData.slice(0, 2).map((list: CandidateList) => (
                            <Badge key={list.id} variant="secondary" className="text-xs">
                              {list.name}
                            </Badge>
                          ))}
                          {candidateListsData.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{candidateListsData.length - 2}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Ações - lado direito */}
                    <div className="flex items-center space-x-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditCandidate(candidate)}
                        className="h-8 w-8 p-0"
                        title="Editar candidato"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleManageLists(candidate)}
                        className="h-8 w-8 p-0"
                        title="Gerenciar listas"
                      >
                        <Users className="h-4 w-4" />
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-8 w-8 p-0"
                            title="Excluir candidato"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir o candidato "{candidate.name}"? 
                              Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteCandidateMutation.mutate(candidate.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            
            <div>
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                value={editForm.whatsapp}
                onChange={(e) => setEditForm({ ...editForm, whatsapp: e.target.value })}
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

      {/* Dialog para gerenciar listas */}
      <Dialog open={isListsDialogOpen} onOpenChange={setIsListsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerenciar Listas - {selectedCandidate?.name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Listas atuais */}
            <div>
              <h4 className="font-medium mb-2">Listas atuais:</h4>
              <div className="space-y-2">
                {selectedCandidate && getCandidateLists(selectedCandidate.id).map((list: CandidateList, index: number) => (
                  <div key={`${list.id}-${index}`} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm">{list.name}</span>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleRemoveFromList(list.id)}
                      disabled={removeFromListMutation.isPending}
                      className="h-6 w-6 p-0"
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Adicionar a nova lista */}
            <div>
              <h4 className="font-medium mb-2">Adicionar à lista:</h4>
              <div className="space-y-2">
                {getAvailableLists().map((list: CandidateList) => (
                  <div key={list.id} className="flex items-center justify-between p-2 bg-green-50 rounded">
                    <span className="text-sm">{list.name}</span>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleAddToList(list.id)}
                      disabled={addToListMutation.isPending}
                      className="h-6 w-6 p-0"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
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
                placeholder="11999999999"
              />
            </div>

            {/* Seletor de cliente (apenas para masters) */}
            {isMaster && (
              <div>
                <Label htmlFor="new-client">Cliente *</Label>
                <Select onValueChange={(value) => setNewCandidateForm({ ...newCandidateForm, clientId: Number(value) })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client: Client) => (
                      <SelectItem key={client.id} value={client.id.toString()}>
                        {client.companyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Seletor de lista */}
            <div>
              <Label htmlFor="new-list">Lista *</Label>
              <Select onValueChange={(value) => setNewCandidateForm({ ...newCandidateForm, listId: Number(value) })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma lista" />
                </SelectTrigger>
                <SelectContent>
                  {candidateLists
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