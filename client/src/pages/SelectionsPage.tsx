import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Users, Edit, Trash2, Send, Calendar, Search, Copy, MessageCircle, Mail, QrCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

interface Selection {
  id: number;
  name: string;
  candidateListId?: number;
  jobId: string;
  whatsappTemplate: string;
  emailTemplate?: string;
  sendVia: 'whatsapp' | 'email' | 'both';
  scheduledFor?: Date;
  deadline?: Date;
  status: 'draft' | 'active' | 'enviado' | 'completed';
  clientId: number;
  createdAt: Date | null;
}

interface CandidateList {
  id: number;
  name: string;
  description?: string;
  clientId: number;
}

interface Job {
  id: string;
  nomeVaga: string;
  clientId: number;
  perguntas?: any[];
}

interface Client {
  id: number;
  companyName: string;
}

export default function SelectionsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Estados do formulário
  const [showForm, setShowForm] = useState(false);
  const [editingSelection, setEditingSelection] = useState<Selection | null>(null);
  const [nomeSelecao, setNomeSelecao] = useState("");
  const [candidateListId, setCandidateListId] = useState<number | null>(null);
  const [jobId, setJobId] = useState("");
  const [mensagemWhatsApp, setMensagemWhatsApp] = useState("");
  const [mensagemEmail, setMensagemEmail] = useState("");
  const [enviarWhatsApp, setEnviarWhatsApp] = useState(true);
  const [enviarEmail, setEnviarEmail] = useState(false);
  const [agendamento, setAgendamento] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoEnvio, setTipoEnvio] = useState<"agora" | "agendar">("agora");
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('all');
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);

  // Buscar seleções
  const { data: selections = [], isLoading } = useQuery<Selection[]>({
    queryKey: ["/api/selections"],
  });

  // Buscar listas de candidatos - filtrar automaticamente para clients
  const { data: candidateLists = [] } = useQuery<CandidateList[]>({
    queryKey: ["/api/candidate-lists"],
  });

  // Buscar vagas - filtrar automaticamente para clients
  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  // Filtrar dados baseado no role do usuário
  const filteredSelections = user?.role === 'master' 
    ? selections 
    : selections.filter(selection => selection.clientId === user?.clientId);

  const filteredCandidateLists = user?.role === 'master' 
    ? candidateLists 
    : candidateLists.filter(list => list.clientId === user?.clientId);

  const filteredJobs = user?.role === 'master' 
    ? jobs 
    : jobs.filter(job => job.clientId === user?.clientId);

  // Buscar clientes (apenas para master)
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: user?.role === 'master',
  });

  // Texto padrão para WhatsApp
  const defaultWhatsAppMessage = "Olá [nome do candidato] somos da [Nome do Cliente] e sou uma assistente virtual, você se cadastrou em nossa vaga de [Nome da Vaga], você foi selecionado(a) para próxima etapa que será uma entrevista virtual. Nessa entrevista nós enviaremos perguntas por áudio e você poderá responder também via áudio em nosso sistema, não será necessário gravar vídeo. Após responder todas as [número de perguntas] perguntas, nossa equipe vai analisar suas respostas e lhe responder o mais breve possível.";

  // Texto padrão para E-mail
  const defaultEmailMessage = "Olá [nome do candidato] Somos da [Nome do Cliente] e sou [Nome do Colaborador da Empresa], você se cadastrou em nossa vaga de [Nome da Vaga], você foi selecionado(a) para próxima etapa que será uma entrevista virtual. Nessa entrevista nós enviaremos perguntas por áudio e você poderá responder também via áudio em nosso sistema, não será necessário gravar vídeo. Após responder todas as [número de perguntas] perguntas, nossa equipe vai analisar suas respostas e lhe responder o mais breve possível.";

  // Criar seleção
  const createSelectionMutation = useMutation({
    mutationFn: async (selectionData: any) => {
      const response = await apiRequest('/api/selections', 'POST', selectionData);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/selections'] });
      resetForm();
      toast({ title: "Seleção criada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao criar seleção", variant: "destructive" });
    }
  });

  // Atualizar seleção
  const updateSelectionMutation = useMutation({
    mutationFn: async (selectionData: any) => {
      const response = await apiRequest(`/api/selections/${editingSelection!.id}`, 'PATCH', selectionData);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/selections'] });
      resetForm();
      toast({ title: "Seleção atualizada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar seleção", variant: "destructive" });
    }
  });

  // Deletar seleção
  const deleteSelectionMutation = useMutation({
    mutationFn: async (selectionId: number) => {
      await apiRequest(`/api/selections/${selectionId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/selections'] });
      toast({ title: "Seleção excluída com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir seleção", variant: "destructive" });
    }
  });

  // Enviar entrevistas via email
  const sendInterviewsMutation = useMutation({
    mutationFn: async (selectionId: number) => {
      const response = await apiRequest(`/api/selections/${selectionId}/send`, 'POST');
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/selections'] });
      toast({ title: "Entrevistas enviadas por email com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao enviar entrevistas por email", variant: "destructive" });
    }
  });



  // Enviar campanha WhatsApp QR
  const sendWhatsAppQRCampaignMutation = useMutation({
    mutationFn: async (selectionId: number) => {
      const response = await apiRequest('/api/whatsapp-qr/send-campaign', 'POST', { selectionId });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/selections'] });
      toast({ 
        title: "Campanha WhatsApp QR enviada!", 
        description: `${data.sentCount} mensagens enviadas com sucesso via QR. ${data.errorCount} erros.`
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao enviar campanha WhatsApp QR", 
        description: error?.message || "Verifique se o WhatsApp está conectado via QR Code",
        variant: "destructive" 
      });
    }
  });

  // Reset do formulário
  const resetForm = () => {
    setShowForm(false);
    setEditingSelection(null);
    setNomeSelecao("");
    // For client users, automatically set their clientId; for master users, reset to null
    setSelectedClientId(user?.role === 'client' ? user.clientId : null);
    setCandidateListId(null);
    setJobId("");
    setMensagemWhatsApp(defaultWhatsAppMessage);
    setMensagemEmail(defaultEmailMessage);
    setEnviarWhatsApp(true);
    setEnviarEmail(false);
    setAgendamento("");
    setTipoEnvio("agora");
  };

  // Inicializar textos padrão
  useEffect(() => {
    if (!mensagemWhatsApp || mensagemWhatsApp.trim() === "") {
      setMensagemWhatsApp(defaultWhatsAppMessage);
    }
    if (!mensagemEmail || mensagemEmail.trim() === "") {
      setMensagemEmail(defaultEmailMessage);
    }
  }, [defaultWhatsAppMessage, defaultEmailMessage]);

  // Iniciar edição
  const startEdit = (selection: Selection) => {
    setEditingSelection(selection);
    setNomeSelecao(selection.nomeSelecao);
    setSelectedClientId(selection.clientId);
    setCandidateListId(selection.candidateListId);
    setJobId(selection.jobId);
    setMensagemWhatsApp(selection.mensagemWhatsApp || defaultWhatsAppMessage);
    setMensagemEmail(selection.mensagemEmail || defaultEmailMessage);
    setEnviarWhatsApp(selection.enviarWhatsApp);
    setEnviarEmail(selection.enviarEmail);
    setAgendamento(selection.agendamento ? new Date(selection.agendamento).toISOString().slice(0, 16) : "");
    setTipoEnvio(selection.agendamento ? "agendar" : "agora");
    setShowForm(true);
  };

  // Duplicar seleção
  const duplicateSelection = (selection: Selection) => {
    setEditingSelection(null); // Não é edição, é criação de nova seleção
    setNomeSelecao(`${selection.name || selection.nomeSelecao} - Cópia`);
    setSelectedClientId(selection.clientId);
    setCandidateListId(selection.candidateListId);
    setJobId(selection.jobId);
    setMensagemWhatsApp(selection.whatsappTemplate || selection.mensagemWhatsApp || defaultWhatsAppMessage);
    setMensagemEmail(selection.emailTemplate || selection.mensagemEmail || defaultEmailMessage);
    setEnviarWhatsApp(selection.sendVia?.includes('whatsapp') || selection.enviarWhatsApp || false);
    setEnviarEmail(selection.sendVia?.includes('email') || selection.enviarEmail || false);
    setAgendamento(""); // Reset agendamento para nova seleção
    setTipoEnvio("agora"); // Default para enviar agora
    setShowForm(true);
  };

  // Formatar data e hora
  const formatDateTime = (dateInput: any) => {
    if (!dateInput) return { date: 'N/A', time: 'N/A' };
    
    let date: Date;
    
    // Verificar se é um timestamp do Firebase (objeto com seconds)
    if (dateInput && typeof dateInput === 'object' && 'seconds' in dateInput) {
      date = new Date(dateInput.seconds * 1000);
    } else {
      date = new Date(dateInput);
    }
    
    // Verificar se a data é válida
    if (isNaN(date.getTime())) {
      return { date: 'Data inválida', time: 'N/A' };
    }
    
    const dateFormatted = date.toLocaleDateString('pt-BR');
    const timeFormatted = date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    return { date: dateFormatted, time: timeFormatted };
  };

  // Salvar seleção
  const salvarSelecao = () => {
    if (!nomeSelecao.trim()) {
      toast({ title: "Nome da seleção é obrigatório", variant: "destructive" });
      return;
    }

    // Validação do cliente para usuários master
    if (user?.role === 'master' && !selectedClientId) {
      toast({ title: "Selecione um cliente", variant: "destructive" });
      return;
    }

    if (!candidateListId) {
      toast({ title: "Selecione uma lista de candidatos", variant: "destructive" });
      return;
    }

    if (!jobId) {
      toast({ title: "Selecione uma vaga", variant: "destructive" });
      return;
    }

    if (!enviarWhatsApp && !enviarEmail) {
      toast({ title: "Selecione pelo menos um meio de envio", variant: "destructive" });
      return;
    }

    // Validação para agendamento
    if (tipoEnvio === "agendar" && !agendamento) {
      toast({ title: "Data e horário de agendamento são obrigatórios", variant: "destructive" });
      return;
    }

    const finalClientId = user?.role === 'master' ? selectedClientId : user?.clientId;

    const selectionData = {
      name: nomeSelecao.trim(),
      jobId: jobId, // Keep as string
      candidateListId: candidateListId, // Include the selected candidate list ID
      whatsappTemplate: mensagemWhatsApp.trim(),
      emailTemplate: enviarEmail ? mensagemEmail.trim() : "Convite para entrevista",
      emailSubject: "Convite para Entrevista - {vaga}",
      sendVia: enviarWhatsApp && enviarEmail ? 'both' : enviarWhatsApp ? 'whatsapp' : 'email',
      scheduledFor: tipoEnvio === "agendar" && agendamento ? new Date(agendamento) : null,
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      status: tipoEnvio === "agora" ? 'active' : 'draft',
      clientId: finalClientId,
    };

    if (editingSelection) {
      updateSelectionMutation.mutate(selectionData);
    } else {
      createSelectionMutation.mutate(selectionData);
    }
  };

  // Aplicar filtros adicionais nas seleções já filtradas por role
  const finalFilteredSelections = filteredSelections
    .filter(selection => {
      // Filtro por cliente (apenas para master)
      if (user?.role === 'master' && selectedClientFilter !== 'all') {
        return selection.clientId?.toString() === selectedClientFilter;
      }
      return true;
    })
    .filter(selection =>
      (selection.name || selection.nomeSelecao || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Seleção de Candidatos</h1>
          <p className="text-muted-foreground">Configure e agende entrevistas por voz via WhatsApp e E-mail</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Selecionador de Cliente (apenas para master) */}
          {user?.role === 'master' && (
            <div className="flex items-center gap-2">
              <Label htmlFor="clientFilter" className="text-sm font-medium">
                Cliente:
              </Label>
              <Select value={selectedClientFilter} onValueChange={setSelectedClientFilter}>
                <SelectTrigger className="w-48">
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
          <Button 
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Seleção
          </Button>
        </div>
      </div>

      {/* Formulário de seleção */}
      {showForm && (
        <Card className="border-2 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {editingSelection ? "Editar Seleção" : "Nova Seleção"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Nome da Seleção */}
            <div className="space-y-2">
              <Label htmlFor="nomeSelecao">Nome da Seleção de Pessoas *</Label>
              <Input
                id="nomeSelecao"
                value={nomeSelecao}
                onChange={(e) => setNomeSelecao(e.target.value)}
                placeholder="Ex: Seleção Faxineiras Junho 2025"
                maxLength={100}
              />
            </div>

            {/* Seleção de Cliente (apenas para master) */}
            {user?.role === 'master' && (
              <div className="space-y-2">
                <Label htmlFor="selectedClientId">Cliente *</Label>
                <Select value={selectedClientId?.toString() || ""} onValueChange={(value) => setSelectedClientId(parseInt(value))}>
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
              </div>
            )}

            {/* Candidatos e Vaga */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="candidateListId">Lista de Candidatos *</Label>
                <Select value={candidateListId?.toString() || ""} onValueChange={(value) => setCandidateListId(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma lista" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCandidateLists.map((list) => (
                      <SelectItem key={list.id} value={list.id.toString()}>
                        {list.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="jobId">Vaga *</Label>
                <Select value={jobId} onValueChange={setJobId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma vaga" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredJobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.nomeVaga} ({job.perguntas?.length || 0} perguntas)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Mensagens */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mensagemWhatsApp">Mensagem Inicial WhatsApp (até 500 caracteres)</Label>
                <Textarea
                  id="mensagemWhatsApp"
                  value={mensagemWhatsApp}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    if (newValue.length <= 500) {
                      setMensagemWhatsApp(newValue);
                    }
                  }}
                  placeholder={defaultWhatsAppMessage}
                  maxLength={500}
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">{mensagemWhatsApp.length}/500 caracteres</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mensagemEmail">Mensagem para E-mail (até 500 caracteres) - Opcional</Label>
                <Textarea
                  id="mensagemEmail"
                  value={mensagemEmail}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    if (newValue.length <= 500) {
                      setMensagemEmail(newValue);
                    }
                  }}
                  placeholder={defaultEmailMessage}
                  maxLength={500}
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">{mensagemEmail.length}/500 caracteres</p>
              </div>
            </div>

            {/* Opções de envio */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Opções de Envio</h3>
              <div className="flex space-x-6">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="enviarWhatsApp"
                    checked={enviarWhatsApp}
                    onCheckedChange={(checked) => setEnviarWhatsApp(checked === true)}
                  />
                  <Label htmlFor="enviarWhatsApp">Enviar por WhatsApp</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="enviarEmail"
                    checked={enviarEmail}
                    onCheckedChange={(checked) => setEnviarEmail(checked === true)}
                  />
                  <Label htmlFor="enviarEmail">Enviar por E-mail</Label>
                </div>
              </div>
            </div>

            {/* Tipo de Envio */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Tipo de Envio</h3>
              <div className="flex space-x-6">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="enviarAgora"
                    name="tipoEnvio"
                    checked={tipoEnvio === "agora"}
                    onChange={() => setTipoEnvio("agora")}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="enviarAgora">Enviar agora</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="agendar"
                    name="tipoEnvio"
                    checked={tipoEnvio === "agendar"}
                    onChange={() => setTipoEnvio("agendar")}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="agendar">Agendar</Label>
                </div>
              </div>

              {/* Campo de agendamento - só aparece se "Agendar" estiver selecionado */}
              {tipoEnvio === "agendar" && (
                <div className="space-y-2">
                  <Label htmlFor="agendamento">Data e Horário do Agendamento</Label>
                  <Input
                    id="agendamento"
                    type="datetime-local"
                    value={agendamento}
                    onChange={(e) => setAgendamento(e.target.value)}
                    required
                  />
                </div>
              )}
            </div>

            {/* Botões de ação */}
            <div className="flex gap-2 pt-4 border-t">
              <Button 
                onClick={salvarSelecao}
                disabled={createSelectionMutation.isPending || updateSelectionMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {createSelectionMutation.isPending || updateSelectionMutation.isPending ? (
                  "Salvando..."
                ) : (
                  tipoEnvio === "agora" 
                    ? (editingSelection ? "Salvar e Enviar" : "Salvar e Enviar")
                    : (editingSelection ? "Salvar e Agendar" : "Salvar e Agendar")
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={resetForm}
                disabled={createSelectionMutation.isPending || updateSelectionMutation.isPending}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de seleções */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Seleções Cadastradas</CardTitle>
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar seleções..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Carregando seleções...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome da Seleção</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Lista de Candidatos</TableHead>
                  <TableHead>Vaga</TableHead>
                  {user?.role === 'master' && <TableHead>Cliente</TableHead>}
                  <TableHead>Envio</TableHead>
                  <TableHead>Data de Criação</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {finalFilteredSelections.map((selection) => (
                  <TableRow key={selection.id}>
                    <TableCell className="font-medium">{selection.name}</TableCell>
                    <TableCell>
                      <Badge 
                        className={
                          selection.status === 'active' ? 'bg-blue-500 hover:bg-blue-600 text-white' :
                          selection.status === 'enviado' ? 'bg-green-500 hover:bg-green-600 text-white' :
                          selection.status === 'completed' ? 'bg-gray-500 hover:bg-gray-600 text-white' :
                          'bg-yellow-500 hover:bg-yellow-600 text-white'
                        }
                      >
                        {selection.status === 'draft' ? 'Rascunho' :
                         selection.status === 'active' ? 'Ativo' :
                         selection.status === 'enviado' ? 'Enviado' :
                         selection.status === 'completed' ? 'Concluído' : selection.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {filteredCandidateLists.find(list => list.id === selection.candidateListId)?.name || 'Todos os candidatos'}
                    </TableCell>
                    <TableCell>
                      {filteredJobs.find(job => job.id === selection.jobId)?.nomeVaga || 'Vaga não encontrada'}
                    </TableCell>
                    {user?.role === 'master' && (
                      <TableCell>
                        {clients.find(client => client.id === selection.clientId)?.companyName || 'Cliente não encontrado'}
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="space-y-2">
                        <div className="flex gap-1 mb-1">
                          {selection.sendVia === 'whatsapp' && <Badge variant="outline">WhatsApp</Badge>}
                          {selection.sendVia === 'email' && <Badge variant="outline">E-mail</Badge>}
                          {selection.sendVia === 'both' && (
                            <>
                              <Badge variant="outline">WhatsApp</Badge>
                              <Badge variant="outline">E-mail</Badge>
                            </>
                          )}
                        </div>
                        <div className="w-full">
                          <div className="flex justify-between text-xs text-gray-600 mb-1">
                            <span>Progresso</span>
                            <span>{selection.status === 'enviado' ? '100%' : selection.status === 'active' ? '0%' : '0%'}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-500 h-2 rounded-full transition-all duration-500"
                              style={{ 
                                width: selection.status === 'enviado' ? '100%' : 
                                       selection.status === 'active' ? '0%' : '0%' 
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const dateTime = formatDateTime(selection.createdAt);
                        return (
                          <div className="text-sm">
                            <div className="font-medium">{dateTime.date}</div>
                            <div className="text-gray-500 text-xs">{dateTime.time}</div>
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(selection)}
                          title="Editar seleção"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => duplicateSelection(selection)}
                          title="Duplicar seleção"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        
                        {(selection.status === 'draft' || selection.status === 'active') && (
                          <div className="flex gap-1">{/* Botão WhatsApp removido - envio agora é automático */}
                            
                            {(selection.sendVia === 'email' || selection.sendVia === 'both') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => sendInterviewsMutation.mutate(selection.id)}
                                disabled={sendInterviewsMutation.isPending}
                                title="Enviar via E-mail"
                                className="bg-blue-50 hover:bg-blue-100 border-blue-200"
                              >
                                <Mail className="w-4 h-4 text-blue-600" />
                              </Button>
                            )}
                          </div>
                        )}

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir a seleção "{selection.name}"? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteSelectionMutation.mutate(selection.id)}>
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}