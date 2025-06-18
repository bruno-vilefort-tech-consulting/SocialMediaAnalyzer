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
    const candidateMemberships = memberships.filter((m: CandidateListMembership) => 
      m.candidateId === candidateId
    );
    return candidateMemberships.map((membership: CandidateListMembership) => {
      const list = candidateLists.find((list: CandidateList) => list.id === membership.listId);
      return list;
    }).filter(Boolean);
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
          <h2 className="text-lg font-semibold">
            Candidatos ({filteredCandidates.length})
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredCandidates.map((candidate: Candidate) => {
              const candidateListsData = getCandidateLists(candidate.id);
              
              return (
                <Card key={candidate.id} className="h-32 cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4 h-full flex flex-col justify-between">
                    <div>
                      <h3 className="font-medium text-sm truncate">{candidate.name}</h3>
                      <p className="text-xs text-gray-600 truncate">{candidate.email}</p>
                      <p className="text-xs text-gray-600">{candidate.whatsapp}</p>
                    </div>
                    
                    <div className="flex flex-wrap gap-1 mt-2">
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
                    
                    <div className="flex justify-end space-x-1 mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditCandidate(candidate)}
                        className="h-6 w-6 p-0"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleManageLists(candidate)}
                        className="h-6 w-6 p-0"
                      >
                        <Users className="h-3 w-3" />
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-6 w-6 p-0"
                          >
                            <Trash2 className="h-3 w-3" />
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
                {selectedCandidate && getCandidateLists(selectedCandidate.id).map((list: CandidateList) => (
                  <div key={list.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
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
    </div>
  );
}