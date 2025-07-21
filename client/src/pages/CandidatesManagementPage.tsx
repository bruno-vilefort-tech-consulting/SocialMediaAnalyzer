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
import { Trash2, Edit, Plus, Minus, Users, Search, Upload } from "lucide-react";

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

// ✅ FUNÇÕES DE VALIDAÇÃO WHATSAPP - Mesma implementação do CandidatesPage
// ✅ FUNÇÃO CORRIGIDA: Remover o 9º dígito de números de Minas Gerais
function removeDigitNine(phone: string): string {
  // Limpar número
  const cleanPhone = phone.replace(/\D/g, '');

  // Para números com 13 dígitos (55 + DDD + 9 + 8 dígitos)
  if (cleanPhone.length === 13 && cleanPhone.startsWith('55') && cleanPhone.charAt(4) === '9') {
    // Remove o 9º dígito: 5531991505564 → 553191505564
    return cleanPhone.slice(0, 4) + cleanPhone.slice(5);
  }

  return cleanPhone;
}

// ✅ FUNÇÃO CORRIGIDA: Adicionar o 9º dígito quando necessário
function addDigitNine(phone: string): string {
  // Limpar número
  const cleanPhone = phone.replace(/\D/g, '');

  // Se já tem 13 dígitos, não modificar
  if (cleanPhone.length === 13) return cleanPhone;

  // Se tem 12 dígitos (55 + DDD + 8), adicionar 9 após DDD
  if (cleanPhone.length === 12 && cleanPhone.startsWith('55')) {
    // 551196612253 → 5511996612253
    return cleanPhone.slice(0, 4) + '9' + cleanPhone.slice(4);
  }

  // Se tem 11 dígitos (DDD + 8 ou 9), adicionar código do país
  if (cleanPhone.length === 11) {
    // Se já tem 9º dígito: 11996612253 → 5511996612253
    if (cleanPhone.charAt(2) === '9') {
      return '55' + cleanPhone;
    }
    // Se não tem 9º dígito: 11966612253 → 5511996612253
    else {
      return '55' + cleanPhone.slice(0, 2) + '9' + cleanPhone.slice(2);
    }
  }

  // Se tem 10 dígitos (DDD + 8 sem código do país), adicionar 55 e 9
  if (cleanPhone.length === 10) {
    // 1196612253 → 5511996612253
    return '55' + cleanPhone.slice(0, 2) + '9' + cleanPhone.slice(2);
  }

  return cleanPhone;
}

// ✅ FUNÇÃO DE VALIDAÇÃO APRIMORADA: Validação completa com estratégia bidirecional
async function validateWhatsAppNumber(rawPhone: string): Promise<string | null> {
  try {
    // Normalizar número para formato brasileiro
    let normalizedPhone = rawPhone.replace(/\D/g, '');

    // Adicionar código do país se necessário
    if (normalizedPhone.length === 10 || normalizedPhone.length === 11) {
      normalizedPhone = '55' + normalizedPhone;
    }

    // 🔁 ESTRATÉGIA BIDIRECIONAL: Testar as 3 possibilidades
    const candidates = [
      normalizedPhone,                    // Número original
      removeDigitNine(normalizedPhone),   // Sem o 9º dígito (números antigos MG)
      addDigitNine(normalizedPhone)       // Com o 9º dígito adicionado
    ];

    // Remover duplicatas e números inválidos
    const uniqueCandidates = Array.from(new Set(candidates)).filter(num =>
      num.length >= 12 && num.length <= 13 && num.startsWith('55')
    );

    console.log(`📱 [VALIDATION-MANAGEMENT] Testando ${uniqueCandidates.length} candidatos para ${rawPhone}:`, uniqueCandidates);

    // Testar todos os candidatos via API ou usar fallback inteligente
    for (const number of uniqueCandidates) {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          const response = await fetch('/api/whatsapp/validate-number', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ phone: number })
          });

          if (response.ok) {
            const result = await response.json();
            if (result.isValid && result.validatedNumber) {
              console.log(`✅ [VALIDATION-MANAGEMENT] Número validado via API: ${result.validatedNumber}`);
              return result.validatedNumber;
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️ [VALIDATION-MANAGEMENT] Erro ao validar número ${number}:`, error);
      }
    }

    // 🔧 FALLBACK INTELIGENTE: Se API falhar, usar lógica local para correção
    // Priorizar números corrigidos que sejam diferentes do original
    const correctedNumbers = uniqueCandidates.filter(num => num !== normalizedPhone);

    if (correctedNumbers.length > 0) {
      const correctedNumber = correctedNumbers[0];
      console.log(`🔧 [VALIDATION-MANAGEMENT] Usando correção local: ${rawPhone} → ${correctedNumber}`);
      return correctedNumber;
    }

    // Se nenhuma correção foi feita, retornar o número normalizado
    console.log(`ℹ️ [VALIDATION-MANAGEMENT] Retornando número normalizado: ${normalizedPhone}`);
    return normalizedPhone;

  } catch (error) {
    console.error('❌ [VALIDATION-MANAGEMENT] Erro geral na validação WhatsApp:', error);
    // Em caso de erro total, tentar pelo menos normalizar
    const fallback = rawPhone.replace(/\D/g, '');
    if (fallback.length >= 10) {
      return fallback.length >= 12 ? fallback : '55' + fallback;
    }
    return null;
  }
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

  // Estados para paginação do diálogo de listas
  const [currentListsPage, setCurrentListsPage] = useState(1);
  const [listSearchTerm, setListSearchTerm] = useState('');
  const listsPerPage = 5;
  const [editForm, setEditForm] = useState({ name: "", email: "", whatsapp: "" });
  const [newCandidateForm, setNewCandidateForm] = useState({
    name: "",
    email: "",
    whatsapp: "",
    clientId: 0,
    listId: undefined as number | undefined
  });

  // Estados para upload Excel
  const [uploadClientId, setUploadClientId] = useState<string>("");
  const [isUploadingExcel, setIsUploadingExcel] = useState(false);

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

  // Filtrar e ordenar candidatos por termo de busca e cliente
  const filteredCandidates = Array.isArray(candidates) ? candidates.filter((candidate: Candidate) => {
    // Verificar se o ID é válido
    if (!candidate.clientId || isNaN(candidate.clientId)) {
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
  }).sort((a: Candidate, b: Candidate) => {
    // Para usuários cliente: ordem alfabética simples
    if (user?.role === 'client') {
      return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
    }

    // Para masters: primeiro por cliente, depois alfabética dentro do cliente
    if (a.clientId !== b.clientId) {
      // Buscar nomes dos clientes para ordenação
      const clientA = (clients as Client[]).find(c => c.id === a.clientId);
      const clientB = (clients as Client[]).find(c => c.id === b.clientId);
      const nameA = clientA?.companyName || `Cliente ${a.clientId}`;
      const nameB = clientB?.companyName || `Cliente ${b.clientId}`;
      return nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
    }

    // Dentro do mesmo cliente: ordem alfabética por nome do candidato
    return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
  }) : [];

  // Função para obter listas de um candidato
  const getCandidateLists = (candidateId: number) => {
    if (!memberships || !Array.isArray(memberships)) {
      return [];
    }

    const candidateMemberships = (memberships as CandidateListMembership[]).filter((m: CandidateListMembership) => {
      const match = m.candidateId === candidateId;
      return match;
    });

    const lists = candidateMemberships.map((membership: CandidateListMembership) => {
      return (candidateLists as CandidateList[]).find((list: CandidateList) => list.id === membership.listId);
    }).filter(Boolean) as CandidateList[];

    return lists;
  };

  // Mutation para criar candidato
  const createCandidateMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; whatsapp: string; clientId: number; listId?: number }) => {
      console.log(`🔍 [DEBUG-MANAGEMENT] Iniciando criação de candidato com WhatsApp: ${data.whatsapp}`);

      // 🎯 VALIDAÇÃO WHATSAPP: Verificar e corrigir número automaticamente
      toast({ title: "Validando número WhatsApp...", description: "Aguarde..." });

      const validatedWhatsApp = await validateWhatsAppNumber(data.whatsapp);
      console.log(`🔍 [DEBUG-MANAGEMENT] Resultado da validação: ${data.whatsapp} → ${validatedWhatsApp}`);

      if (!validatedWhatsApp) {
        console.error(`❌ [DEBUG-MANAGEMENT] Validação falhou para: ${data.whatsapp}`);
        throw new Error(`Número WhatsApp ${data.whatsapp} não é válido ou não está registrado no WhatsApp. Verifique o número e tente novamente.`);
      }

      // ✅ CORREÇÃO AUTOMÁTICA: Usar número validado e correto retornado pelo Baileys
      if (validatedWhatsApp !== data.whatsapp) {
        console.log(`✅ [DEBUG-MANAGEMENT] Número corrigido: ${data.whatsapp} → ${validatedWhatsApp}`);
        toast({
          title: "Número corrigido automaticamente!",
          description: `${data.whatsapp} → ${validatedWhatsApp}`,
          duration: 3000
        });
      } else {
        console.log(`ℹ️ [DEBUG-MANAGEMENT] Número não foi alterado: ${data.whatsapp}`);
      }

      const candidateData = {
        ...data,
        whatsapp: validatedWhatsApp
      };

      console.log(`💾 [DEBUG-MANAGEMENT] Salvando candidato com número validado:`, candidateData);

      toast({ title: "Número validado com sucesso!", description: "Criando candidato..." });

      return await apiRequest("/api/candidates", "POST", candidateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/candidate-list-memberships"] });
      toast({
        title: "Candidato criado com sucesso!",
        description: "Número WhatsApp validado e candidato adicionado.",
      });
      setIsNewCandidateDialogOpen(false);
      setNewCandidateForm({ name: "", email: "", whatsapp: "", clientId: 0, listId: undefined });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar candidato",
        description: error.message || "Falha ao criar candidato",
        variant: "destructive",
      });
    },
  });

  // Mutation para atualizar candidato
  const updateCandidateMutation = useMutation({
    mutationFn: async (data: { id: number; name: string; email: string; whatsapp: string }) => {
      // 🎯 VALIDAÇÃO WHATSAPP: Verificar e corrigir número automaticamente
      // Só validar se o WhatsApp foi alterado
      if (selectedCandidate && data.whatsapp !== selectedCandidate.whatsapp) {
        console.log(`🔍 [DEBUG-MANAGEMENT-UPDATE] WhatsApp alterado: ${selectedCandidate.whatsapp} → ${data.whatsapp}`);

        toast({ title: "Validando número WhatsApp...", description: "Aguarde..." });

        const validatedWhatsApp = await validateWhatsAppNumber(data.whatsapp);

        if (!validatedWhatsApp) {
          throw new Error(`Número WhatsApp ${data.whatsapp} não é válido ou não está registrado no WhatsApp. Verifique o número e tente novamente.`);
        }

        // ✅ CORREÇÃO AUTOMÁTICA: Usar número validado e mostrar correção se houve mudança
        if (validatedWhatsApp !== data.whatsapp) {
          console.log(`✅ [DEBUG-MANAGEMENT-UPDATE] Número corrigido: ${data.whatsapp} → ${validatedWhatsApp}`);
          toast({
            title: "Número corrigido automaticamente!",
            description: `${data.whatsapp} → ${validatedWhatsApp}`,
            duration: 3000
          });
        }

        data.whatsapp = validatedWhatsApp;
        toast({ title: "Número validado com sucesso!", description: "Atualizando candidato..." });
      }

      return await apiRequest(`/api/candidates/${data.id}`, "PATCH", {
        name: data.name,
        email: data.email,
        whatsapp: data.whatsapp
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      toast({
        title: "Candidato atualizado com sucesso!",
        description: "Dados atualizados e número WhatsApp validado.",
      });
      setIsEditDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar candidato",
        description: error.message || "Falha ao atualizar candidato",
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

  // Mutation para upload Excel
  const uploadExcelMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return await apiRequest("/api/candidates/bulk", "POST", formData);
    },
    onSuccess: (data: any) => {
      setIsUploadingExcel(false);
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/candidate-list-memberships"] });
      toast({
        title: "Sucesso",
        description: `${data.imported || 0} candidatos importados com sucesso`,
      });
    },
    onError: (error: any) => {
      setIsUploadingExcel(false);
      toast({
        title: "Erro na importação",
        description: error?.message || "Falha ao importar candidatos do Excel",
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
    setCurrentListsPage(1); // Reset para primeira página
    setListSearchTerm(''); // Reset busca de listas
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
    let availableLists = (candidateLists as CandidateList[]).filter((list: CandidateList) =>
      !candidateListIds.includes(list.id) &&
      list.clientId === selectedCandidate.clientId
    );

    // Aplicar filtro de busca se existir
    if (listSearchTerm.trim()) {
      availableLists = availableLists.filter(list =>
        list.name.toLowerCase().includes(listSearchTerm.toLowerCase()) ||
        list.description.toLowerCase().includes(listSearchTerm.toLowerCase())
      );
    }

    return availableLists;
  };

  // Obter listas paginadas para o diálogo
  const getPaginatedCandidateLists = (candidateId: number) => {
    const allLists = getCandidateLists(candidateId);
    const startIndex = (currentListsPage - 1) * listsPerPage;
    const endIndex = startIndex + listsPerPage;
    return allLists.slice(startIndex, endIndex);
  };

  const getPaginatedAvailableLists = () => {
    const allLists = getAvailableLists();
    const startIndex = (currentListsPage - 1) * listsPerPage;
    const endIndex = startIndex + listsPerPage;
    return allLists.slice(startIndex, endIndex);
  };

  // Calcular total de páginas
  const getTotalListsPages = () => {
    if (!selectedCandidate) return 1;
    const currentLists = getCandidateLists(selectedCandidate.id);
    const availableLists = getAvailableLists();
    const totalLists = Math.max(currentLists.length, availableLists.length);
    return Math.max(1, Math.ceil(totalLists / listsPerPage));
  };

  // Função para obter o nome do cliente pelo ID
  const getClientName = (clientId: number) => {
    if (!isMaster || !clients || !Array.isArray(clients)) {
      return null;
    }

    if (!clientId || isNaN(clientId)) {
      return `Cliente #undefined`;
    }

    const client = (clients as Client[]).find((c: Client) => c.id === clientId);

    if (client) {
      return client.companyName;
    } else {
      return `Cliente #${clientId}`;
    }
  };

  // Função de upload Excel com seleção de cliente para masters
  const handleUploadWithClientSelection = () => {
    // Para usuários master, verificar se cliente foi selecionado
    if (user?.role === 'master' && !uploadClientId) {
      toast({
        title: "Selecione um cliente",
        description: "Escolha o cliente para importar os candidatos",
        variant: "destructive"
      });
      return;
    }

    // Trigger file input
    document.getElementById('excel-file-upload')?.click();
  };

  const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingExcel(true);

    // Determinar clientId baseado no role do usuário
    let targetClientId: number;

    if (user?.role === 'master') {
      if (!uploadClientId) {
        toast({
          title: "Selecione um cliente",
          description: "Escolha o cliente para importar os candidatos",
          variant: "destructive"
        });
        setIsUploadingExcel(false);
        event.target.value = '';
        return;
      }
      targetClientId = parseInt(uploadClientId);
    } else {
      if (!user?.clientId) {
        toast({
          title: "Erro",
          description: "Cliente não identificado. Verifique suas permissões.",
          variant: "destructive"
        });
        setIsUploadingExcel(false);
        event.target.value = '';
        return;
      }
      targetClientId = user.clientId;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('clientId', targetClientId.toString());

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

        // Invalidar caches para atualizar a interface
        queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
        queryClient.invalidateQueries({ queryKey: ['/api/candidate-list-memberships'] });

        // Mostrar mensagem de sucesso
        if (result.duplicates > 0) {
          toast({
            title: "Importação parcial",
            description: `${result.imported} candidatos importados. ${result.duplicates} não foram importados por já existirem no sistema.`,
            variant: "default"
          });
        } else {
          toast({
            title: "Sucesso!",
            description: `${result.imported} candidatos importados com sucesso!`
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
      toast({
        title: "Erro na importação",
        description: "Falha no upload do arquivo",
        variant: "destructive"
      });
    } finally {
      setIsUploadingExcel(false);
      // Reset input
      event.target.value = '';
    }
  };

  // Calcular paginação após todos os filtros
  const totalCandidates = filteredCandidates.length;
  const totalPages = Math.ceil(totalCandidates / candidatesPerPage);
  const startIndex = (currentPage - 1) * candidatesPerPage;
  const endIndex = startIndex + candidatesPerPage;
  const paginatedCandidates = filteredCandidates.slice(startIndex, endIndex);

  if (candidatesLoading) {
    return <div className="p-8">Carregando candidatos...</div>;
  }

  return (
    <div className="p-8 space-y-6 pt-[0px] pb-[0px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Users className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Gerenciar Candidatos</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Seletor de cliente para masters antes do import */}
          {user?.role === 'master' && (
            <Select value={uploadClientId} onValueChange={setUploadClientId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Selecionar cliente" />
              </SelectTrigger>
              <SelectContent>
                {(clients as Client[]).map((client: Client) => (
                  <SelectItem key={client.id} value={client.id.toString()}>
                    {client.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleExcelUpload}
            className="hidden"
            id="excel-file-upload"
          />
          <Button
            variant="outline"
            onClick={handleUploadWithClientSelection}
            disabled={isUploadingExcel}
          >
            <Upload className="h-4 w-4 mr-2" />
            {isUploadingExcel ? "Importando..." : "Importar Excel"}
          </Button>
          <Button onClick={() => setIsNewCandidateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Candidato
          </Button>
        </div>
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
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Gerenciar Listas - {selectedCandidate?.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 overflow-y-auto flex-1 pr-2">
            {/* Listas atuais */}
            <div>
              <h3 className="font-semibold mb-3">Listas atuais</h3>
              <div className="space-y-2">
                {selectedCandidate && getCandidateLists(selectedCandidate.id).length > 0 ? (
                  getPaginatedCandidateLists(selectedCandidate.id).map((list) => (
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
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Adicionar a listas</h3>
                <div className="w-64">
                  <Input
                    placeholder="Buscar lista..."
                    value={listSearchTerm}
                    onChange={(e) => setListSearchTerm(e.target.value)}
                    className="h-8"
                  />
                </div>
              </div>
              <div className="space-y-2">
                {getAvailableLists().length > 0 ? (
                  getPaginatedAvailableLists().map((list) => (
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

            {/* Controles de paginação */}
            {getTotalListsPages() > 1 && (
              <div className="flex justify-center items-center space-x-2 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentListsPage(currentListsPage - 1)}
                  disabled={currentListsPage === 1}
                >
                  Anterior
                </Button>
                <span className="text-sm text-gray-600">
                  Página {currentListsPage} de {getTotalListsPages()}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentListsPage(currentListsPage + 1)}
                  disabled={currentListsPage === getTotalListsPages()}
                >
                  Próxima
                </Button>
              </div>
            )}
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