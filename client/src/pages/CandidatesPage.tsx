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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import type { CandidateList, InsertCandidateList, Candidate, InsertCandidate } from "@shared/schema";

// Schemas de validação
const candidateListSchema = z.object({
  name: z.string().min(1, "Nome da lista é obrigatório"),
  description: z.string().optional(),
});

const candidateSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  phone: z.string().regex(/^[1-9]{2}[0-9]{8,9}$/, "Celular deve estar no formato brasileiro (ex: 11987654321)"),
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

  // Queries
  const { data: candidateLists = [], isLoading: listsLoading } = useQuery({
    queryKey: ['/api/candidate-lists']
  });

  const { data: allCandidates = [], isLoading: candidatesLoading } = useQuery({
    queryKey: ['/api/candidates']
  });

  // Filtrar candidatos pela lista selecionada
  const filteredCandidates = selectedListId 
    ? allCandidates.filter(candidate => candidate.listId === selectedListId)
    : [];

  // Lista selecionada atual
  const selectedList = candidateLists.find(list => list.id === selectedListId);

  // Forms
  const listForm = useForm<CandidateListFormData>({
    resolver: zodResolver(candidateListSchema),
    defaultValues: { name: "", description: "" }
  });

  const candidateForm = useForm<CandidateFormData>({
    resolver: zodResolver(candidateSchema),
    defaultValues: { name: "", email: "", phone: "" }
  });

  // Mutations
  const createListMutation = useMutation({
    mutationFn: async (data: CandidateListFormData) => {
      const listData: InsertCandidateList = {
        ...data,
        clientId: user?.role === 'master' ? 1 : user?.clientId!
      };
      return await apiRequest('/api/candidate-lists', {
        method: 'POST',
        body: JSON.stringify(listData)
      });
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
      return await apiRequest(`/api/candidate-lists/${listId}`, {
        method: 'DELETE'
      });
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
      const candidateData: InsertCandidate = {
        ...data,
        clientId: user?.role === 'master' ? 1 : user?.clientId!,
        listId: selectedListId!
      };
      return await apiRequest('/api/candidates', {
        method: 'POST',
        body: JSON.stringify(candidateData)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
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
      return await apiRequest(`/api/candidates/${editingCandidate!.id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
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
      return await apiRequest(`/api/candidates/${candidateId}`, {
        method: 'DELETE'
      });
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
      phone: candidate.phone
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
      const response = await fetch('/api/candidates/bulk', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
        toast({ title: "Candidatos importados com sucesso!" });
      } else {
        const error = await response.json();
        toast({ 
          title: "Erro na importação", 
          description: error.message,
          variant: "destructive" 
        });
      }
    } catch (error) {
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
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Lista
            </Button>
          </div>

          {/* Grid horizontal de listas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {candidateLists.map((list) => {
              const candidatesCount = allCandidates.filter(c => c.listId === list.id).length;
              
              return (
                <Card key={list.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{list.name}</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteListMutation.mutate(list.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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

            {candidateLists.length === 0 && (
              <div className="col-span-full text-center py-12">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma lista encontrada</h3>
                <p className="text-muted-foreground mb-4">
                  Crie sua primeira lista de candidatos para começar
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
                        <p className="text-sm text-muted-foreground">{candidate.phone}</p>
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
                          onClick={() => deleteCandidateMutation.mutate(candidate.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Celular</FormLabel>
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