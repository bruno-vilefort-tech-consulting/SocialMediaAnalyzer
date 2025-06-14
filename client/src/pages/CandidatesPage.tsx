import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, Upload, Edit, Trash2, Users, FileSpreadsheet } from "lucide-react";

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

  // Estados
  const [selectedList, setSelectedList] = useState<CandidateList | null>(null);
  const [showListDialog, setShowListDialog] = useState(false);
  const [showCandidateDialog, setShowCandidateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importListName, setImportListName] = useState("");

  // Formulários
  const listForm = useForm<CandidateListFormData>({
    resolver: zodResolver(candidateListSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const candidateForm = useForm<CandidateFormData>({
    resolver: zodResolver(candidateSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
    },
  });

  // Queries
  const { data: candidateLists = [], refetch: refetchLists } = useQuery<CandidateList[]>({
    queryKey: ["/api/candidate-lists"],
    select: (data: unknown) => {
      if (Array.isArray(data)) {
        return data;
      }
      return [];
    }
  });

  const { data: candidates = [], refetch: refetchCandidates } = useQuery<Candidate[]>({
    queryKey: ["/api/candidates", selectedList?.id],
    enabled: !!selectedList,
    select: (data: unknown) => {
      if (Array.isArray(data)) {
        return data;
      }
      return [];
    }
  });

  // Mutations para listas
  const createListMutation = useMutation({
    mutationFn: async (data: CandidateListFormData) => {
      const listData: InsertCandidateList = {
        name: data.name,
        description: data.description,
        clientId: user?.role === 'master' ? 1 : user?.clientId || 1,
      };
      const response = await apiRequest("POST", "/api/candidate-lists", listData);
      return await response.json();
    },
    onSuccess: (newList: CandidateList) => {
      toast({
        title: "Lista criada com sucesso!",
        description: "Agora você pode adicionar candidatos à lista.",
      });
      setShowListDialog(false);
      listForm.reset();
      refetchLists();
      setSelectedList(newList);
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar lista",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutations para candidatos
  const createCandidateMutation = useMutation({
    mutationFn: async (data: CandidateFormData) => {
      if (!selectedList) throw new Error("Nenhuma lista selecionada");
      
      const candidateData: InsertCandidate = {
        name: data.name,
        email: data.email,
        phone: data.phone,
        clientId: user?.role === 'master' ? 1 : user?.clientId || 1,
        listId: selectedList.id,
      };
      const response = await apiRequest("POST", "/api/candidates", candidateData);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Candidato adicionado com sucesso!",
      });
      setShowCandidateDialog(false);
      candidateForm.reset();
      refetchCandidates();
    },
    onError: (error) => {
      toast({
        title: "Erro ao adicionar candidato",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateCandidateMutation = useMutation({
    mutationFn: async (data: CandidateFormData) => {
      if (!editingCandidate) throw new Error("Nenhum candidato selecionado");
      
      const response = await apiRequest("PATCH", `/api/candidates/${editingCandidate.id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Candidato atualizado com sucesso!",
      });
      setShowCandidateDialog(false);
      setEditingCandidate(null);
      candidateForm.reset();
      refetchCandidates();
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar candidato",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteCandidateMutation = useMutation({
    mutationFn: async (candidateId: number) => {
      const response = await apiRequest("DELETE", `/api/candidates/${candidateId}`);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Candidato removido com sucesso!",
      });
      refetchCandidates();
    },
    onError: (error) => {
      toast({
        title: "Erro ao remover candidato",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para importação
  const importCandidatesMutation = useMutation({
    mutationFn: async () => {
      if (!importFile || !importListName) throw new Error("Arquivo e nome da lista são obrigatórios");
      
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('listName', importListName);
      
      const response = await fetch('/api/candidates/import', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Erro ao importar candidatos');
      }
      
      return await response.json();
    },
    onSuccess: (newList: CandidateList) => {
      toast({
        title: "Candidatos importados com sucesso!",
        description: `Lista "${newList.name}" criada com os candidatos importados.`,
      });
      setShowImportDialog(false);
      setImportFile(null);
      setImportListName("");
      refetchLists();
      setSelectedList(newList);
    },
    onError: (error) => {
      toast({
        title: "Erro ao importar candidatos",
        description: error.message,
        variant: "destructive",
      });
    },
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

  const handleEditCandidate = (candidate: Candidate) => {
    setEditingCandidate(candidate);
    candidateForm.reset({
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone,
    });
    setShowCandidateDialog(true);
  };

  const handleDeleteCandidate = (candidateId: number) => {
    if (confirm("Tem certeza que deseja remover este candidato?")) {
      deleteCandidateMutation.mutate(candidateId);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.type === 'application/vnd.ms-excel')) {
      setImportFile(file);
    } else {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo Excel (.xlsx ou .xls)",
        variant: "destructive",
      });
    }
  };

  const handleImport = () => {
    importCandidatesMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Candidatos</h1>
        <div className="flex gap-2">
          <Dialog open={showListDialog} onOpenChange={setShowListDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Lista de Candidatos
              </Button>
            </DialogTrigger>
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
                          <Input {...field} placeholder="Digite o nome da lista" />
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
                          <Textarea {...field} placeholder="Descrição da lista" rows={3} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setShowListDialog(false)}>
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

          <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Importar Contatos
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Importar Contatos do Excel</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="import-file">Arquivo Excel</Label>
                  <Input
                    id="import-file"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="mt-1"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    O arquivo deve conter as colunas: Nome, Email, Celular
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="list-name">Nome da Lista</Label>
                  <Input
                    id="list-name"
                    value={importListName}
                    onChange={(e) => setImportListName(e.target.value)}
                    placeholder="Digite o nome da lista"
                    className="mt-1"
                  />
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowImportDialog(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleImport}
                    disabled={!importFile || !importListName || importCandidatesMutation.isPending}
                  >
                    {importCandidatesMutation.isPending ? "Importando..." : "Importar"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Lista de Listas de Candidatos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {candidateLists.map((list) => (
          <Card 
            key={list.id} 
            className={`cursor-pointer transition-colors hover:bg-accent ${
              selectedList?.id === list.id ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setSelectedList(list)}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {list.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {list.description || "Sem descrição"}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Criada em: {list.createdAt ? new Date(list.createdAt).toLocaleDateString('pt-BR') : 'Data não disponível'}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Candidatos da Lista Selecionada */}
      {selectedList && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Candidatos - {selectedList.name}</CardTitle>
              <Dialog open={showCandidateDialog} onOpenChange={setShowCandidateDialog}>
                <DialogTrigger asChild>
                  <Button onClick={() => setEditingCandidate(null)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Candidato
                  </Button>
                </DialogTrigger>
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
                            <FormLabel>Nome do Candidato</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Digite o nome completo" />
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
                              <Input {...field} type="email" placeholder="email@exemplo.com" />
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
                            <FormLabel>Celular WhatsApp (com DDD)</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="11987654321" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => {
                          setShowCandidateDialog(false);
                          setEditingCandidate(null);
                          candidateForm.reset();
                        }}>
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={createCandidateMutation.isPending || updateCandidateMutation.isPending}>
                          {createCandidateMutation.isPending || updateCandidateMutation.isPending 
                            ? "Salvando..." 
                            : editingCandidate ? "Atualizar" : "Adicionar"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {candidates.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum candidato encontrado. Adicione candidatos à lista.
                </p>
              ) : (
                candidates.map((candidate) => (
                  <div key={candidate.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <h4 className="font-medium">{candidate.name}</h4>
                      <p className="text-sm text-muted-foreground">{candidate.email}</p>
                      <p className="text-sm text-muted-foreground">{candidate.phone}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleEditCandidate(candidate)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleDeleteCandidate(candidate.id)}
                        disabled={deleteCandidateMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}