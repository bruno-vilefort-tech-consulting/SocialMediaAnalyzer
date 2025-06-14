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
import { Plus, Users, Edit, Trash2, Send, Calendar, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

interface Selection {
  id: number;
  nomeSelecao: string;
  candidateListId: number;
  jobId: string;
  mensagemWhatsApp: string;
  mensagemEmail?: string;
  enviarWhatsApp: boolean;
  enviarEmail: boolean;
  agendamento?: Date;
  status: 'rascunho' | 'agendado' | 'enviado' | 'concluido';
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

  // Buscar seleções
  const { data: selections = [], isLoading } = useQuery<Selection[]>({
    queryKey: ["/api/selections"],
  });

  // Buscar listas de candidatos
  const { data: candidateLists = [] } = useQuery<CandidateList[]>({
    queryKey: ["/api/candidate-lists"],
  });

  // Buscar vagas
  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

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

  // Enviar entrevistas
  const sendInterviewsMutation = useMutation({
    mutationFn: async (selectionId: number) => {
      const response = await apiRequest(`/api/selections/${selectionId}/send`, 'POST');
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/selections'] });
      toast({ title: "Entrevistas enviadas com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao enviar entrevistas", variant: "destructive" });
    }
  });

  // Reset do formulário
  const resetForm = () => {
    setShowForm(false);
    setEditingSelection(null);
    setNomeSelecao("");
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

  // Salvar seleção
  const salvarSelecao = () => {
    if (!nomeSelecao.trim()) {
      toast({ title: "Nome da seleção é obrigatório", variant: "destructive" });
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

    const finalClientId = user?.role === 'master' ? jobs.find(j => j.id === jobId)?.clientId : user?.clientId;

    const selectionData = {
      name: nomeSelecao.trim(),
      jobId: parseInt(jobId),
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

  // Filtrar seleções
  const filteredSelections = selections.filter(selection =>
    selection.nomeSelecao.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Seleção de Candidatos</h1>
          <p className="text-muted-foreground">Configure e agende entrevistas por voz via WhatsApp e E-mail</p>
        </div>
        <Button 
          onClick={() => setShowForm(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Seleção
        </Button>
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

            {/* Candidatos e Vaga */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="candidateListId">Lista de Candidatos *</Label>
                <Select value={candidateListId?.toString() || ""} onValueChange={(value) => setCandidateListId(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma lista" />
                  </SelectTrigger>
                  <SelectContent>
                    {candidateLists.map((list) => (
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
                    {jobs.map((job) => (
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
                  <TableHead>Envio</TableHead>
                  <TableHead>Data de Criação</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSelections.map((selection) => (
                  <TableRow key={selection.id}>
                    <TableCell className="font-medium">{selection.nomeSelecao}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          selection.status === 'concluido' ? 'default' :
                          selection.status === 'enviado' ? 'secondary' :
                          selection.status === 'agendado' ? 'outline' : 'destructive'
                        }
                      >
                        {selection.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {candidateLists.find(list => list.id === selection.candidateListId)?.name || 'Lista não encontrada'}
                    </TableCell>
                    <TableCell>
                      {jobs.find(job => job.id === selection.jobId)?.nomeVaga || 'Vaga não encontrada'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {selection.enviarWhatsApp && <Badge variant="outline">WhatsApp</Badge>}
                        {selection.enviarEmail && <Badge variant="outline">E-mail</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {selection.createdAt 
                        ? new Date(selection.createdAt).toLocaleDateString('pt-BR') 
                        : new Date().toLocaleDateString('pt-BR')
                      }
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(selection)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        
                        {selection.status === 'rascunho' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => sendInterviewsMutation.mutate(selection.id)}
                            disabled={sendInterviewsMutation.isPending}
                          >
                            <Send className="w-4 h-4" />
                          </Button>
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
                                Tem certeza que deseja excluir a seleção "{selection.nomeSelecao}"? Esta ação não pode ser desfeita.
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