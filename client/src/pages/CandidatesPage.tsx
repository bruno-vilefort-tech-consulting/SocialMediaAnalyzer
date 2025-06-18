import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, Upload, Edit, Trash2, Users, FileSpreadsheet, ArrowLeft, Eye, Search } from "lucide-react";

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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import type { CandidateList, InsertCandidateList, Candidate, InsertCandidate, Client } from "@shared/schema";

// Schemas de validação
const candidateListSchema = z.object({
  name: z.string().min(1, "Nome da lista é obrigatório"),
  description: z.string().optional(),
  clientId: z.number().positive("Cliente é obrigatório")
});

const candidateSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  whatsapp: z.string().regex(/^(55)?[1-9]{2}[0-9]{8,9}$/, "WhatsApp deve ter formato brasileiro com ou sem código do país (ex: 5511987654321 ou 11987654321)"),
  listId: z.number().positive("Lista é obrigatória"),
  clientId: z.number().positive("Cliente é obrigatório")
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
  const [searchTerm, setSearchTerm] = useState("");

  // Queries
  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
    enabled: user?.role === 'master'
  });



  const { data: candidateLists = [], isLoading: listsLoading } = useQuery<CandidateList[]>({
    queryKey: user?.role === 'master' && selectedClientFilter !== 'all' 
      ? ['/api/candidate-lists', { clientId: selectedClientFilter }]
      : ['/api/candidate-lists'],
    queryFn: async () => {
      let params = '';
      
      // Para masters: usar filtro selecionado; Para clients: filtrar automaticamente pelo clientId
      if (user?.role === 'master' && selectedClientFilter !== 'all') {
        params = `?clientId=${selectedClientFilter}`;
      } else if (user?.role === 'client' && user?.clientId) {
        params = `?clientId=${user.clientId}`;
      }
      
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {};
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/candidate-lists${params}`, {
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
    }
  });

  // Query para buscar os relacionamentos candidato-lista para contagem
  const { data: candidateListMemberships = [] } = useQuery<any[]>({
    queryKey: ['/api/candidate-list-memberships'],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {};
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/candidate-list-memberships', {
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
      console.log('🔍 Memberships recebidos do backend:', data);
      console.log('🔍 Total de memberships no frontend:', data?.length || 0);
      return Array.isArray(data) ? data : [];
    }
  });

  // Query para buscar candidatos com isolamento total por cliente
  const candidatesQueryKey = user?.role === 'master' && selectedClientFilter !== 'all'
    ? ['/api/candidates', { clientId: selectedClientFilter }]
    : user?.role === 'client' 
      ? ['/api/candidates', { clientId: user.clientId }]
      : ['/api/candidates', { clientId: 'none' }]; // Master sem filtro = vazio

  const { data: allCandidates = [], isLoading: candidatesLoading } = useQuery<Candidate[]>({
    queryKey: candidatesQueryKey,
    queryFn: async () => {
      let params = '';
      
      if (user?.role === 'master') {
        // Master deve especificar um cliente para ver candidatos
        if (selectedClientFilter !== 'all') {
          params = `?clientId=${selectedClientFilter}`;
        } else {
          // Se master não selecionou cliente, retornar vazio
          return [];
        }
      } else if (user?.role === 'client') {
        // Cliente automaticamente filtra por seu próprio ID
        params = `?clientId=${user.clientId}`;
      }
      
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

  // Filtrar listas de candidatos por cliente e termo de busca
  const filteredCandidateLists = candidateLists
    .filter(list => {
      // Filtro por cliente (apenas para master)
      if (user?.role === 'master' && selectedClientFilter !== 'all') {
        return list.clientId?.toString() === selectedClientFilter;
      }
      return true;
    })
    .filter(list => {
      // Filtro por termo de busca
      if (searchTerm.trim() === '') return true;
      return list.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
             (list.description && list.description.toLowerCase().includes(searchTerm.toLowerCase()));
    });

  // Candidatos exibidos baseado no modo de visualização
  const filteredCandidates = viewMode === 'single' && selectedListId 
    ? listCandidates
    : allCandidates;

  // Lista selecionada atual
  const selectedList = candidateLists.find(list => list.id === selectedListId);

  // Função para contar candidatos REAIS por lista (não memberships órfãos)
  const getCandidateCountForList = (listId: number): number => {
    if (!candidateListMemberships || candidateListMemberships.length === 0) {
      return 0;
    }
    
    // Buscar memberships da lista específica
    const listMemberships = candidateListMemberships.filter(membership => membership.listId === listId);
    
    // Se master está vendo "Todos os clientes", contar apenas memberships válidos
    // (não temos candidatos carregados neste modo)
    if (user?.role === 'master' && selectedClientFilter === 'all') {
      console.log(`📊 Lista ${listId}: ${listMemberships.length} memberships (modo todos os clientes)`);
      return listMemberships.length;
    }
    
    // Para filtro específico ou usuário cliente, validar contra candidatos reais
    const candidateIdsInList = listMemberships.map(membership => membership.candidateId);
    const realCandidatesCount = allCandidates.filter(candidate => 
      candidateIdsInList.includes(candidate.id)
    ).length;
    
    console.log(`📊 Lista ${listId}: ${candidateIdsInList.length} memberships, ${realCandidatesCount} candidatos reais`);
    return realCandidatesCount;
  };

  // Forms
  const listForm = useForm<CandidateListFormData>({
    resolver: zodResolver(candidateListSchema),
    defaultValues: { 
      name: "", 
      description: "",
      clientId: user?.role === 'client' ? user?.clientId || 0 : 0
    }
  });

  const candidateForm = useForm<CandidateFormData>({
    resolver: zodResolver(candidateSchema),
    defaultValues: { 
      name: "", 
      email: "", 
      whatsapp: "",
      listId: 0,
      clientId: 0
    }
  });

  // Mutations
  const createListMutation = useMutation({
    mutationFn: async (data: CandidateListFormData): Promise<CandidateList> => {
      const listData: InsertCandidateList = {
        ...data,
        clientId: data.clientId
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
      console.log('🚀 Enviando dados para API:', data);
      return await apiRequest('/api/candidates', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/lists', selectedListId, 'candidates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/candidate-list-memberships'] });
      setShowCandidateForm(false);
      candidateForm.reset();
      toast({ title: "Candidato adicionado com sucesso!" });
    },
    onError: (error) => {
      console.error('❌ Erro na mutation:', error);
      toast({ title: "Erro ao adicionar candidato", variant: "destructive" });
    }
  });

  const updateCandidateMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; whatsapp: string }) => {
      if (!editingCandidate) {
        throw new Error("Nenhum candidato selecionado para edição");
      }
      
      console.log(`🔧 Atualizando candidato ${editingCandidate.id} com dados:`, data);
      
      const response = await apiRequest(`/api/candidates/${editingCandidate.id}`, 'PATCH', data);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
        throw new Error(errorData.message || `Erro ${response.status}: ${response.statusText}`);
      }
      
      return response;
    },
    onSuccess: () => {
      console.log('✅ Candidato atualizado com sucesso!');
      
      // Invalidar todos os caches relevantes
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      if (selectedListId) {
        queryClient.invalidateQueries({ queryKey: ['/api/lists', selectedListId, 'candidates'] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/candidate-list-memberships'] });
      
      // Limpar estado do formulário
      setEditingCandidate(null);
      setShowCandidateForm(false);
      candidateForm.reset({
        name: "",
        email: "",
        whatsapp: "",
        listId: 0,
        clientId: 0
      });
      
      toast({ title: "Candidato atualizado com sucesso!" });
    },
    onError: (error: any) => {
      console.error('❌ Erro na atualização:', error);
      
      // Se candidato não existe mais, limpar estado
      if (error.message && (error.message.includes('não encontrado') || error.message.includes('404'))) {
        setEditingCandidate(null);
        setShowCandidateForm(false);
        candidateForm.reset();
        queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
        if (selectedListId) {
          queryClient.invalidateQueries({ queryKey: ['/api/lists', selectedListId, 'candidates'] });
        }
      }
      
      toast({ 
        title: "Erro ao atualizar candidato", 
        description: error.message && (error.message.includes('não encontrado') || error.message.includes('404')) ? 
          "Candidato não existe mais no sistema" : 
          error.message || "Falha na atualização",
        variant: "destructive" 
      });
    }
  });

  const deleteCandidateMutation = useMutation({
    mutationFn: async (candidateId: number) => {
      return await apiRequest(`/api/candidates/${candidateId}`, 'DELETE');
    },
    onSuccess: () => {
      // Invalidar cache geral de candidatos
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      
      // Invalidar cache específico da lista se estivermos visualizando uma lista
      if (selectedListId) {
        queryClient.invalidateQueries({ queryKey: ['/api/lists', selectedListId, 'candidates'] });
      }
      
      // Invalidar memberships para atualizar contadores
      queryClient.invalidateQueries({ queryKey: ['/api/candidate-list-memberships'] });
      
      toast({ title: "Candidato removido com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao remover candidato", variant: "destructive" });
    }
  });

  // Handlers
  const handleCreateList = (data: CandidateListFormData) => {
    // Para usuários client, usar automaticamente o clientId do usuário
    if (user?.role === 'client' && user?.clientId) {
      data.clientId = user.clientId;
    }
    createListMutation.mutate(data);
  };

  const handleSubmitCandidate = (data: CandidateFormData) => {
    console.log('🚀 handleSubmitCandidate chamado com:', data);
    console.log('🔍 Editando candidato?', !!editingCandidate);
    
    // Validação básica primeiro
    if (!data.name || !data.email || !data.whatsapp) {
      toast({ 
        title: "Erro", 
        description: "Preencha todos os campos obrigatórios (nome, email e WhatsApp)",
        variant: "destructive" 
      });
      return;
    }

    if (editingCandidate) {
      // Para edição, usar apenas os campos editáveis
      const updatedData = {
        name: data.name.trim(),
        email: data.email.trim(),
        whatsapp: data.whatsapp.trim()
      };
      
      console.log('✅ Atualizando candidato ID:', editingCandidate.id);
      console.log('✅ Dados de atualização:', updatedData);
      
      updateCandidateMutation.mutate(updatedData);
    } else {
      // Para criação, precisamos de listId e clientId
      // Se estamos dentro de uma lista específica, usar seus dados
      if (selectedListId) {
        const selectedList = candidateLists?.find(list => list.id === selectedListId);
        if (selectedList) {
          data.listId = selectedList.id;
          data.clientId = selectedList.clientId;
        }
      }
      
      // Para usuários client, usar automaticamente o clientId do usuário
      if (user?.role === 'client' && user?.clientId && !data.clientId) {
        data.clientId = user.clientId;
      }

      // Garantir que listId e clientId estão corretos
      if (!data.listId || !data.clientId) {
        console.error('❌ IDs ausentes - listId:', data.listId, 'clientId:', data.clientId);
        toast({ 
          title: "Erro", 
          description: "Erro interno: IDs da lista ou cliente não definidos",
          variant: "destructive" 
        });
        return;
      }

      console.log('✅ Criando candidato com dados finais:', data);
      createCandidateMutation.mutate(data);
    }
  };

  const handleGeneralFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Para importação geral, precisamos de uma lista de destino
    // Vamos mostrar um diálogo para o usuário selecionar ou criar uma lista
    if (!selectedClientFilter || selectedClientFilter === 'all') {
      toast({ 
        title: "Erro", 
        description: "Selecione um cliente específico antes de importar candidatos.",
        variant: "destructive" 
      });
      return;
    }

    // Buscar primeira lista disponível do cliente ou sugerir criação
    const clientLists = candidateLists?.filter(list => 
      list.clientId === parseInt(selectedClientFilter)
    );

    if (!clientLists || clientLists.length === 0) {
      toast({ 
        title: "Sem listas disponíveis", 
        description: "Crie uma lista de candidatos primeiro para importar dados.",
        variant: "destructive" 
      });
      return;
    }

    // Usar a primeira lista disponível
    const targetList = clientLists[0];
    
    // Determine clientId based on user role and context
    let clientId: number;
    
    if (user?.role === 'master') {
      // Para master: usar clientId da lista ou do filtro selecionado
      if (selectedClientFilter === 'all') {
        clientId = targetList.clientId;
      } else {
        clientId = parseInt(selectedClientFilter);
      }
    } else {
      // Para client: usar próprio clientId
      clientId = user?.clientId || targetList.clientId;
    }

    console.log('🎯 Upload Excel no topo:', {
      targetListId: targetList.id,
      targetListClientId: targetList.clientId,
      selectedClientFilter,
      userRole: user?.role,
      userClientId: user?.clientId,
      finalClientId: clientId
    });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('listId', targetList.id.toString());
    formData.append('clientId', clientId.toString());

    try {
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
        
        // Invalidar caches para atualizar dados
        queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
        queryClient.invalidateQueries({ queryKey: ['/api/candidate-list-memberships'] });
        if (targetList?.id) {
          queryClient.invalidateQueries({ queryKey: ['/api/lists', targetList.id, 'candidates'] });
        }
        
        toast({ 
          title: "Importação concluída!", 
          description: `${result.imported} candidatos importados para a lista "${targetList.name}". ${result.duplicates > 0 ? `${result.duplicates} duplicatas ignoradas.` : ''}` 
        });
      } else {
        const error = await response.json();
        toast({ 
          title: "Erro na importação", 
          description: error.message || "Falha ao processar arquivo",
          variant: "destructive" 
        });
      }
    } catch (error) {
      console.error('Erro na importação:', error);
      toast({ 
        title: "Erro na importação", 
        description: "Falha ao enviar arquivo. Verifique a conexão.",
        variant: "destructive" 
      });
    }

    // Limpar input
    event.target.value = '';
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
    
    // Preencher todos os campos necessários para edição
    const formData = {
      name: candidate.name,
      email: candidate.email,
      whatsapp: candidate.whatsapp,
      listId: selectedListId || 0, // Usar lista atual se disponível
      clientId: candidate.clientId || (user?.role === 'client' ? user.clientId : 0)
    };
    
    candidateForm.reset(formData);
    setShowCandidateForm(true);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Verificar se temos uma lista selecionada ou precisamos selecionar uma
    if (!selectedListId) {
      toast({ 
        title: "Erro", 
        description: "Selecione uma lista antes de importar candidatos.",
        variant: "destructive" 
      });
      return;
    }

    // Buscar dados da lista selecionada para obter clientId correto
    const selectedList = candidateLists?.find(list => list.id === selectedListId);
    if (!selectedList) {
      toast({ 
        title: "Erro", 
        description: "Lista selecionada não encontrada.",
        variant: "destructive" 
      });
      return;
    }

    // Determine clientId based on user role and context
    let clientId: number;
    
    if (user?.role === 'master') {
      // Para master: usar clientId da lista selecionada
      clientId = selectedList.clientId;
    } else {
      // Para client: usar próprio clientId
      clientId = user?.clientId || selectedList.clientId;
    }

    console.log('🎯 Upload Excel dentro da lista:', {
      selectedListId,
      selectedListClientId: selectedList.clientId,
      userRole: user?.role,
      userClientId: user?.clientId,
      finalClientId: clientId
    });
    
    if (!clientId) {
      toast({ 
        title: "Erro", 
        description: "Cliente não identificado. Verifique suas permissões.",
        variant: "destructive" 
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('listId', selectedListId.toString());
    formData.append('clientId', clientId.toString());

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
        queryClient.invalidateQueries({ queryKey: ['/api/candidate-list-memberships'] });
        queryClient.invalidateQueries({ queryKey: ['/api/lists', selectedListId, 'candidates'] });
        
        // Mostrar mensagem com detalhes sobre duplicatas se existirem
        if (result.duplicates > 0) {
          const duplicateNames = result.duplicatesList?.map((dup: any) => dup.name).join(', ') || '';
          toast({ 
            title: "Importação parcial",
            description: `${result.imported} candidatos importados para a lista "${selectedList.name}". ${result.duplicates} não foram importados por já existirem: ${duplicateNames}`,
            variant: "default"
          });
        } else {
          toast({ 
            title: "Sucesso!",
            description: `${result.imported} candidatos importados para a lista "${selectedList.name}" com sucesso!`
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
              <h1 className="text-3xl font-bold">Gerenciar Lista dos Candidatos</h1>
              <p className="text-muted-foreground">
                Organize seus candidatos em listas e gerencie suas informações
              </p>
            </div>
            <div className="flex items-center gap-3">
              {user?.role === 'master' && (
                <div className="flex items-center gap-2">
                  <Select value={selectedClientFilter} onValueChange={setSelectedClientFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Clientes</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id.toString()}>
                          {client.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleTopUpload}
                className="hidden"
                id="top-file-upload"
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById('top-file-upload')?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Importar Excel
              </Button>
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Lista
              </Button>
            </div>
          </div>

          {/* Tabela horizontal de listas */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Listas de Candidatos</CardTitle>
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar listas..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {listsLoading ? (
                <p>Carregando listas...</p>
              ) : filteredCandidateLists.length === 0 ? (
                <div className="text-center py-12">
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
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome da Lista</TableHead>
                      <TableHead>Descrição</TableHead>
                      {user?.role === 'master' && <TableHead>Cliente</TableHead>}
                      <TableHead>Data de Criação</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCandidateLists.map((list) => {
                      // Contar apenas candidatos que realmente existem no banco
                      const candidatesCount = getCandidateCountForList(list.id);
                      console.log(`📊 Lista ${list.name} (ID: ${list.id}) - Candidatos reais:`, candidatesCount);
                      const client = clients.find(c => c.id === list.clientId);
                      
                      return (
                        <TableRow key={list.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {list.name}
                              {candidatesCount === 0 ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                  Vazia
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                  {candidatesCount} {candidatesCount === 1 ? 'candidato' : 'candidatos'}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {list.description || "Sem descrição"}
                          </TableCell>
                          {user?.role === 'master' && (
                            <TableCell>
                              {client ? client.companyName : "Cliente não encontrado"}
                            </TableCell>
                          )}
                          <TableCell>
                            {(() => {
                              if (!list.createdAt) return 'N/A';
                              const date = list.createdAt instanceof Date 
                                ? list.createdAt 
                                : new Date((list.createdAt as any)?.seconds * 1000 || list.createdAt);
                              const dateFormatted = date.toLocaleDateString('pt-BR');
                              const timeFormatted = date.toLocaleTimeString('pt-BR', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              });
                              return (
                                <div className="text-sm">
                                  <div className="font-medium">{dateFormatted}</div>
                                  <div className="text-gray-500 text-xs">{timeFormatted}</div>
                                </div>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewList(list.id)}
                                title="Visualizar lista"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    title="Deletar lista"
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
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
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
                  {(() => {
                    const count = viewMode === 'single' && selectedListId 
                      ? listCandidates.length 
                      : filteredCandidates.length;
                    return `${count} ${count === 1 ? 'candidato' : 'candidatos'} nesta lista`;
                  })()}
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
              <Button onClick={() => {
                // Resetar e preencher formulário com dados corretos
                candidateForm.reset({
                  name: "",
                  email: "",
                  whatsapp: "",
                  listId: selectedListId || 0,
                  clientId: selectedList?.clientId || (user?.role === 'client' ? user?.clientId || 0 : 0)
                });
                setShowCandidateForm(true);
              }}>
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
                    <Button onClick={() => {
                      // Resetar e preencher formulário com dados corretos
                      candidateForm.reset({
                        name: "",
                        email: "",
                        whatsapp: "",
                        listId: selectedListId || 0,
                        clientId: selectedList?.clientId || (user?.role === 'client' ? user?.clientId || 0 : 0)
                      });
                      setShowCandidateForm(true);
                    }}>
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
              {user?.role === 'master' && (
                <FormField
                  control={listForm.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cliente *</FormLabel>
                      <FormControl>
                        <Select 
                          value={field.value?.toString()} 
                          onValueChange={(value) => field.onChange(parseInt(value))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um cliente" />
                          </SelectTrigger>
                          <SelectContent>
                            {clients.map((client) => (
                              <SelectItem key={client.id} value={client.id.toString()}>
                                {client.companyName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
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
          candidateForm.reset({
            name: "",
            email: "",
            whatsapp: "",
            listId: 0,
            clientId: 0
          });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCandidate ? "Editar Candidato" : "Novo Candidato"}
            </DialogTitle>
          </DialogHeader>
          
          <Form {...candidateForm}>
            <form onSubmit={candidateForm.handleSubmit(handleSubmitCandidate)} className="space-y-4">
              {/* Campos básicos do candidato */}
              <FormField
                control={candidateForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo *</FormLabel>
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
                    <FormLabel>Email *</FormLabel>
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
                    <FormLabel>WhatsApp *</FormLabel>
                    <FormControl>
                      <Input placeholder="11987654321 ou 5511987654321" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Seleção de cliente (master only) - apenas quando não estiver dentro de lista específica */}
              {user?.role === 'master' && !selectedListId && (
                <FormField
                  control={candidateForm.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cliente *</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o cliente" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clients?.map((client) => (
                            <SelectItem key={client.id} value={client.id.toString()}>
                              {client.companyName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Seleção de lista - apenas quando não estiver dentro de lista específica */}
              {!selectedListId && (
                <FormField
                  control={candidateForm.control}
                  name="listId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lista de Candidatos *</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a lista" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {candidateLists
                            ?.filter(list => user?.role === 'master' ? 
                              (candidateForm.watch('clientId') ? list.clientId === candidateForm.watch('clientId') : true) : 
                              list.clientId === user?.clientId
                            )
                            .map((list) => (
                              <SelectItem key={list.id} value={list.id.toString()}>
                                {list.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Contexto visual quando dentro de lista específica */}
              {selectedListId && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <div className="font-medium">Adicionando à lista atual:</div>
                    <div className="mt-1 font-semibold">
                      {candidateLists?.find(list => list.id === selectedListId)?.name}
                    </div>
                  </div>
                </div>
              )}
              
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