import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, Upload, Edit, Trash2, Users, FileSpreadsheet, ArrowLeft, Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import type { CandidateList, InsertCandidateList, Candidate, InsertCandidate, Client } from "@shared/schema";

// Schemas de validação
const candidateListSchema = z.object({
  name: z.string().min(1, "Nome da lista é obrigatório"),
  description: z.string().optional(),
});

const candidateSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  whatsapp: z.string().regex(/^[1-9]{2}[0-9]{8,9}$/, "WhatsApp deve estar no formato brasileiro (ex: 11987654321)"),
});

type CandidateListFormData = z.infer<typeof candidateListSchema>;
type CandidateFormData = z.infer<typeof candidateSchema>;

export default function CandidatesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Estados para controle da visualização
  const [viewMode, setViewMode] = useState<'all' | 'single'>('all');
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCandidateForm, setShowCandidateForm] = useState(false);
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('all');

  // Queries
  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
    enabled: user?.role === 'master'
  });



  const { data: candidateLists = [], isLoading: listsLoading } = useQuery<CandidateList[]>({
    queryKey: ['/api/candidate-lists']
  });

  // Query para buscar candidatos baseado no filtro de cliente selecionado
  const candidatesQueryKey = user?.role === 'master' && selectedClientFilter !== 'all'
    ? ['/api/candidates', { clientId: selectedClientFilter }]
    : ['/api/candidates'];

  const { data: allCandidates = [], isLoading: candidatesLoading } = useQuery<Candidate[]>({
    queryKey: candidatesQueryKey,
    queryFn: async () => {
      const params = user?.role === 'master' && selectedClientFilter !== 'all'
        ? `?clientId=${selectedClientFilter}`
        : '';
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {};
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/candidates${params}`, {
        headers,
        credentials: "include"
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("auth_token");
          localStorage.removeItem("user_data");
          window.location.href = "/login";
          return [];
        }
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      // Garantir que sempre retornamos um array
      return Array.isArray(data) ? data : [];
    }
  });

  // Query específica para candidatos de uma lista quando visualizando lista única
  const { data: listCandidates = [], isLoading: listCandidatesLoading } = useQuery<Candidate[]>({
    queryKey: ['/api/lists', selectedListId, 'candidates'],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {};
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/lists/${selectedListId}/candidates`, {
        headers,
        credentials: "include"
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("auth_token");
          localStorage.removeItem("user_data");
          window.location.href = "/login";
          return [];
        }
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedListId && viewMode === 'single'
  });

  // Filtrar listas de candidatos por cliente (apenas para master)
  const filteredCandidateLists = user?.role === 'master' && selectedClientFilter !== 'all'
    ? candidateLists.filter(list => list.clientId?.toString() === selectedClientFilter)
    : candidateLists;

  // Candidatos exibidos baseado no modo de visualização
  const filteredCandidates = viewMode === 'single' && selectedListId 
    ? listCandidates
    : allCandidates;

  // Lista selecionada atual
  const selectedList = candidateLists.find(list => list.id === selectedListId);

  // Forms
  const listForm = useForm<CandidateListFormData>({
    resolver: zodResolver(candidateListSchema),
    defaultValues: { name: "", description: "" }
  });

  const candidateForm = useForm<CandidateFormData>({
    resolver: zodResolver(candidateSchema),
    defaultValues: { name: "", email: "", whatsapp: "" }
  });

  // Mutations
  const createListMutation = useMutation({
    mutationFn: async (data: CandidateListFormData): Promise<CandidateList> => {
      const listData: InsertCandidateList = {
        ...data,
        clientId: user?.role === 'master' ? 1 : user?.clientId!
      };
      const response = await apiRequest('/api/candidate-lists', 'POST', listData);
      return await response.json();
    },
    onSuccess: (newList: CandidateList) => {
      queryClient.invalidateQueries({ queryKey: ['/api/candidate-lists'] });
      setShowCreateForm(false);
      listForm.reset();
      // Automaticamente visualizar a nova lista criada
      setSelectedListId(newList.id);
      setViewMode('single');
      toast({ title: "Lista criada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao criar lista", variant: "destructive" });
    }
  });

  const deleteListMutation = useMutation({
    mutationFn: async (listId: number) => {
      return await apiRequest(`/api/candidate-lists/${listId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/candidate-lists'] });
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      if (selectedListId === selectedListId) {
        setViewMode('all');
        setSelectedListId(null);
      }
      toast({ title: "Lista deletada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao deletar lista", variant: "destructive" });
    }
  });

  const createCandidateMutation = useMutation({
    mutationFn: async (data: CandidateFormData) => {
      const candidateData = {
        ...data,
        listId: selectedListId! // Usado para criar o membership
      };
      const response = await apiRequest('/api/candidates', 'POST', candidateData);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/lists', selectedListId, 'candidates'] });
      setShowCandidateForm(false);
      candidateForm.reset();
      toast({ title: "Candidato adicionado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao adicionar candidato", variant: "destructive" });
    }
  });

  const updateCandidateMutation = useMutation({
    mutationFn: async (data: CandidateFormData) => {
      const response = await apiRequest(`/api/candidates/${editingCandidate!.id}`, 'PATCH', data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      setEditingCandidate(null);
      candidateForm.reset();
      toast({ title: "Candidato atualizado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar candidato", variant: "destructive" });
    }
  });

  const deleteCandidateMutation = useMutation({
    mutationFn: async (candidateId: number) => {
      return await apiRequest(`/api/candidates/${candidateId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      toast({ title: "Candidato removido com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao remover candidato", variant: "destructive" });
    }
  });

  // Handlers
  const handleCreateList = (data: CandidateListFormData) => {
    createListMutation.mutate(data);
  };

  const handleCreateCandidate = (data: CandidateFormData) => {
    if (editingCandidate) {
      updateCandidateMutation.mutate(data);
    } else {
      createCandidateMutation.mutate(data);
    }
  };

  const handleViewList = (listId: number) => {
    setSelectedListId(listId);
    setViewMode('single');
  };

  const handleBackToAllLists = () => {
    setViewMode('all');
    setSelectedListId(null);
  };

  const handleEditCandidate = (candidate: Candidate) => {
    setEditingCandidate(candidate);
    candidateForm.reset({
      name: candidate.name,
      email: candidate.email,
      whatsapp: candidate.whatsapp
    });
    setShowCandidateForm(true);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedListId) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('listId', selectedListId.toString());

    try {
      // Para FormData, usar fetch diretamente com token de autorização
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Token de autenticação não encontrado');
      }
      
      const response = await fetch('/api/candidates/bulk', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
        credentials: 'include'
      });

      if (response.ok) {
        const result = await response.json();
        queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
        
        // Mostrar mensagem com detalhes sobre duplicatas se existirem
        if (result.duplicates > 0) {
          const duplicateNames = result.duplicatesList?.map((dup: any) => dup.name).join(', ') || '';
          toast({ 
            title: "Importação parcial",
            description: `${result.imported} candidatos importados. ${result.duplicates} não foram importados por já existirem: ${duplicateNames}`,
            variant: "default"
          });
        } else {
          toast({ 
            title: "Sucesso!",
            description: result.message || "Candidatos importados com sucesso!"
          });
        }
      } else {
        const error = await response.json();
        toast({ 
          title: "Erro na importação", 
          description: error.message || "Falha na importação",
          variant: "destructive" 
        });
      }
    } catch (error: any) {
      console.error('Erro no upload:', error);
      
      toast({ 
        title: "Erro na importação", 
        description: "Falha no upload do arquivo",
        variant: "destructive" 
      });
    }

    // Reset input
    event.target.value = '';
  };

  if (listsLoading) {
    return <div className="p-6">Carregando listas de candidatos...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {viewMode === 'all' ? (
        // Visualização de todas as listas (horizontal)
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Gerenciar Candidatos</h1>
              <p className="text-muted-foreground">
                Organize seus candidatos em listas e gerencie suas informações
              </p>
            </div>
            <div className="flex items-center gap-3">
              {user?.role === 'master' && (
                <div className="flex items-center gap-2">
                  <Select value={selectedClientFilter} onValueChange={setSelectedClientFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filtrar por cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os clientes</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id.toString()}>
                          {client.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Badge variant="secondary">
                    {filteredCandidateLists.length} listas
                  </Badge>
                </div>
              )}
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Lista
              </Button>
            </div>
          </div>

          {/* Grid horizontal de listas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredCandidateLists.map((list) => {
              // Com a nova arquitetura muitos-para-muitos, contamos via memberships
              const candidatesCount = 0; // TODO: implementar contagem via memberships
              const client = clients.find(c => c.id === list.clientId);
              
              return (
                <Card key={list.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{list.name}</CardTitle>
                        {user?.role === 'master' && client && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Cliente: {client.companyName}
                          </p>
                        )}
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja deletar a lista "{list.name}"? 
                              Esta ação não pode ser desfeita e todos os candidatos desta lista também serão removidos.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteListMutation.mutate(list.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Deletar Lista
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                    {list.description && (
                      <p className="text-sm text-muted-foreground">{list.description}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {candidatesCount} candidatos
                        </span>
                      </div>
                    </div>
                    <Button 
                      className="w-full" 
                      onClick={() => handleViewList(list.id)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Visualizar Lista
                    </Button>
                  </CardContent>
                </Card>
              );
            })}

            {filteredCandidateLists.length === 0 && (
              <div className="col-span-full text-center py-12">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {user?.role === 'master' && selectedClientFilter !== 'all' 
                    ? "Nenhuma lista encontrada para este cliente"
                    : "Nenhuma lista encontrada"
                  }
                </h3>
                <p className="text-muted-foreground mb-4">
                  {user?.role === 'master' && selectedClientFilter !== 'all'
                    ? "Este cliente ainda não possui listas de candidatos"
                    : "Crie sua primeira lista de candidatos para começar"
                  }
                </p>
                <Button onClick={() => setShowCreateForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Lista
                </Button>
              </div>
            )}
          </div>
        </>
      ) : (
        // Visualização de lista única
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={handleBackToAllLists}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar às Listas
              </Button>
              <div>
                <h1 className="text-3xl font-bold">{selectedList?.name}</h1>
                <p className="text-muted-foreground">
                  {filteredCandidates.length} candidatos nesta lista
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Importar Excel
              </Button>
              <Button onClick={() => setShowCandidateForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Candidato
              </Button>
            </div>
          </div>

          {/* Lista de candidatos */}
          <Card>
            <CardHeader>
              <CardTitle>Candidatos</CardTitle>
            </CardHeader>
            <CardContent>
              {candidatesLoading ? (
                <div>Carregando candidatos...</div>
              ) : filteredCandidates.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum candidato encontrado</h3>
                  <p className="text-muted-foreground mb-4">
                    Adicione candidatos manualmente ou importe via Excel
                  </p>
                  <div className="flex justify-center space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => document.getElementById('file-upload')?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Importar Excel
                    </Button>
                    <Button onClick={() => setShowCandidateForm(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Candidato
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredCandidates.map((candidate) => (
                    <div
                      key={candidate.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <h4 className="font-semibold">{candidate.name}</h4>
                        <p className="text-sm text-muted-foreground">{candidate.email}</p>
                        <p className="text-sm text-muted-foreground">WhatsApp: {candidate.whatsapp}</p>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditCandidate(candidate)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja remover o candidato "{candidate.name}"? 
                                Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteCandidateMutation.mutate(candidate.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Remover Candidato
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Dialog para criar nova lista */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Lista de Candidatos</DialogTitle>
          </DialogHeader>
          <Form {...listForm}>
            <form onSubmit={listForm.handleSubmit(handleCreateList)} className="space-y-4">
              <FormField
                control={listForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Lista</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Desenvolvedores Frontend" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={listForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição (opcional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Descrição da lista..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createListMutation.isPending}>
                  {createListMutation.isPending ? "Criando..." : "Criar Lista"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog para adicionar/editar candidato */}
      <Dialog open={showCandidateForm} onOpenChange={(open) => {
        setShowCandidateForm(open);
        if (!open) {
          setEditingCandidate(null);
          candidateForm.reset();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCandidate ? "Editar Candidato" : "Novo Candidato"}
            </DialogTitle>
          </DialogHeader>
          <Form {...candidateForm}>
            <form onSubmit={candidateForm.handleSubmit(handleCreateCandidate)} className="space-y-4">
              <FormField
                control={candidateForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: João Silva" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={candidateForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="joao@email.com" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={candidateForm.control}
                name="whatsapp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp</FormLabel>
                    <FormControl>
                      <Input placeholder="11987654321" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowCandidateForm(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createCandidateMutation.isPending || updateCandidateMutation.isPending}>
                  {editingCandidate ? "Salvar" : "Adicionar"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}