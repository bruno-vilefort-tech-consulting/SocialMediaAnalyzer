import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Search, Briefcase, Save, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Pergunta {
  numero: number;
  pergunta: string;
  respostaPerfeita: string;
  isEditing?: boolean;
}

interface Job {
  id: string;
  nomeVaga: string;
  descricaoVaga: string;
  status: string;
  clientId: number;
  createdAt: string;
  perguntas?: Pergunta[];
}

interface Client {
  id: number;
  companyName: string;
  email: string;
}

export default function CadastroVagasPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  
  // Dados da vaga
  const [nomeVaga, setNomeVaga] = useState("");
  const [descricaoVaga, setDescricaoVaga] = useState("");
  const [clientId, setClientId] = useState<number | null>(null);
  
  // Perguntas
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [novaPergunta, setNovaPergunta] = useState("");
  const [novaResposta, setNovaResposta] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Buscar vagas
  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });





  // Buscar clientes (apenas para master)
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: user?.role === 'master',
  });

  // Criar vaga
  const createJobMutation = useMutation({
    mutationFn: async (jobData: any) => {
      const response = await apiRequest('/api/jobs', 'POST', jobData);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      resetForm();
      toast({ title: "Vaga criada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao criar vaga", variant: "destructive" });
    }
  });

  // Atualizar vaga
  const updateJobMutation = useMutation({
    mutationFn: async (jobData: any) => {
      const response = await apiRequest(`/api/jobs/${editingJob!.id}`, 'PATCH', jobData);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      resetForm();
      toast({ title: "Vaga atualizada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar vaga", variant: "destructive" });
    }
  });

  // Deletar vaga
  const deleteJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      await apiRequest(`/api/jobs/${jobId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({ title: "Vaga excluída com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir vaga", variant: "destructive" });
    }
  });

  // Reset do formulário
  const resetForm = () => {
    setShowForm(false);
    setEditingJob(null);
    setNomeVaga("");
    setDescricaoVaga("");
    setClientId(null);
    setPerguntas([]);
    setNovaPergunta("");
    setNovaResposta("");
  };

  // Iniciar edição
  const startEdit = (job: Job) => {

    
    setEditingJob(job);
    setNomeVaga(job.nomeVaga);
    setDescricaoVaga(job.descricaoVaga);
    
    // Encontrar o cliente correto baseado no clientId do job
    // O clientId pode vir como number (1) ou como ID completo do Firebase
    const clienteEncontrado = clients.find(client => 
      client.id === job.clientId || 
      client.id === Number(job.clientId) ||
      Number(client.id) === job.clientId
    );
    
    if (clienteEncontrado) {
      setClientId(clienteEncontrado.id);
    } else {
      // Se não encontrar, usar o primeiro cliente disponível para master
      if (user?.role === 'master' && clients.length > 0) {
        setClientId(clients[0].id);
      } else {
        setClientId(null);
      }
    }
    
    setPerguntas(job.perguntas || []);
    setShowForm(true);
  };

  // Adicionar pergunta
  const adicionarPergunta = () => {
    if (!novaPergunta.trim() || !novaResposta.trim()) {
      toast({ title: "Preencha a pergunta e resposta perfeita", variant: "destructive" });
      return;
    }

    if (perguntas.length >= 10) {
      toast({ title: "Máximo de 10 perguntas por vaga", variant: "destructive" });
      return;
    }

    const novaPerguntaObj: Pergunta = {
      numero: perguntas.length + 1,
      pergunta: novaPergunta.trim(),
      respostaPerfeita: novaResposta.trim(),
      isEditing: false
    };

    setPerguntas([...perguntas, novaPerguntaObj]);
    setNovaPergunta("");
    setNovaResposta("");
  };

  // Remover pergunta
  const removerPergunta = (index: number) => {
    const novasPerguntas = perguntas.filter((_, i) => i !== index);
    // Reordenar numeração
    const perguntasReordenadas = novasPerguntas.map((p, i) => ({
      ...p,
      numero: i + 1
    }));
    setPerguntas(perguntasReordenadas);
  };

  // Editar pergunta
  const iniciarEdicaoPergunta = (index: number) => {
    const novasPerguntas = [...perguntas];
    novasPerguntas[index].isEditing = true;
    setPerguntas(novasPerguntas);
  };

  // Salvar edição pergunta
  const salvarEdicaoPergunta = (index: number, novaPergunta: string, novaResposta: string) => {
    if (!novaPergunta.trim() || !novaResposta.trim()) {
      toast({ title: "Preencha a pergunta e resposta perfeita", variant: "destructive" });
      return;
    }

    const novasPerguntas = [...perguntas];
    novasPerguntas[index] = {
      ...novasPerguntas[index],
      pergunta: novaPergunta.trim(),
      respostaPerfeita: novaResposta.trim(),
      isEditing: false
    };
    setPerguntas(novasPerguntas);
  };

  // Cancelar edição pergunta
  const cancelarEdicaoPergunta = (index: number) => {
    const novasPerguntas = [...perguntas];
    novasPerguntas[index].isEditing = false;
    setPerguntas(novasPerguntas);
  };

  // Salvar vaga
  const salvarVaga = () => {
    if (!nomeVaga.trim()) {
      toast({ title: "Nome da vaga é obrigatório", variant: "destructive" });
      return;
    }

    if (perguntas.length === 0) {
      toast({ title: "Adicione pelo menos 1 pergunta", variant: "destructive" });
      return;
    }

    const finalClientId = user?.role === 'master' ? clientId : user?.clientId;
    
    if (!finalClientId) {
      toast({ title: "Selecione um cliente", variant: "destructive" });
      return;
    }

    const jobData = {
      nomeVaga: nomeVaga.trim(),
      descricaoVaga: descricaoVaga.trim(),
      clientId: finalClientId,
      status: "ativo",
      perguntas: perguntas.map(p => ({
        numero: p.numero,
        pergunta: p.pergunta,
        respostaPerfeita: p.respostaPerfeita
      }))
    };

    if (editingJob) {
      updateJobMutation.mutate(jobData);
    } else {
      createJobMutation.mutate(jobData);
    }
  };

  // Definir clientId padrão para usuários cliente
  useEffect(() => {
    if (user?.role === 'client' && user?.clientId && !clientId) {
      setClientId(user.clientId);
    }
  }, [user, clientId]);

  // Filtrar vagas
  const filteredJobs = jobs.filter(job =>
    job.nomeVaga.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Cadastro de Vagas</h1>
          <p className="text-muted-foreground">Gerencie vagas de emprego e suas perguntas de entrevista</p>
        </div>
        
        <Button 
          onClick={() => setShowForm(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Cadastrar Vaga
        </Button>
      </div>

      {/* Formulário de cadastro/edição */}
      {showForm && (
        <Card className="border-2 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              {editingJob ? "Editar Vaga" : "Nova Vaga"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Dados básicos da vaga */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nomeVaga">Nome da Vaga *</Label>
                <Input
                  id="nomeVaga"
                  value={nomeVaga}
                  onChange={(e) => setNomeVaga(e.target.value.slice(0, 100))}
                  placeholder="Ex: Analista de Dados Pleno"
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground">{nomeVaga.length}/100 caracteres</p>
              </div>

              {user?.role === 'master' && (
                <div className="space-y-2">
                  <Label htmlFor="clientId">Cliente *</Label>
                  <Select value={clientId?.toString() || ""} onValueChange={(value) => setClientId(parseInt(value))}>
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricaoVaga">Descrição da Vaga</Label>
              <Textarea
                id="descricaoVaga"
                value={descricaoVaga}
                onChange={(e) => setDescricaoVaga(e.target.value.slice(0, 500))}
                placeholder="Descrição interna da vaga..."
                maxLength={500}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">{descricaoVaga.length}/500 caracteres</p>
            </div>

            {/* Seção de Perguntas */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Perguntas da Entrevista</h3>
                <Badge variant="outline">{perguntas.length}/10 perguntas</Badge>
              </div>

              {/* Formulário para nova pergunta */}
              <Card className="bg-gray-50">
                <CardContent className="pt-4 space-y-4">
                  <div className="space-y-2">
                    <Label>Pergunta ao Candidato</Label>
                    <Input
                      value={novaPergunta}
                      onChange={(e) => setNovaPergunta(e.target.value.slice(0, 100))}
                      placeholder="Ex: Por que você quer trabalhar nesta empresa?"
                      maxLength={100}
                    />
                    <p className="text-xs text-muted-foreground">{novaPergunta.length}/100 caracteres</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Resposta Perfeita</Label>
                    <Textarea
                      value={novaResposta}
                      onChange={(e) => setNovaResposta(e.target.value.slice(0, 1000))}
                      placeholder="Descreva a resposta ideal que será usada para análise via ChatGPT..."
                      maxLength={1000}
                      rows={4}
                      className="resize-y"
                    />
                    <p className="text-xs text-muted-foreground">{novaResposta.length}/1000 caracteres</p>
                  </div>

                  <Button 
                    onClick={adicionarPergunta}
                    disabled={perguntas.length >= 10}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Acrescentar Pergunta da Entrevista
                  </Button>
                </CardContent>
              </Card>

              {/* Lista de perguntas cadastradas */}
              {perguntas.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium">Perguntas Cadastradas:</h4>
                  {perguntas.map((pergunta, index) => (
                    <PerguntaCard
                      key={index}
                      pergunta={pergunta}
                      index={index}
                      onEdit={iniciarEdicaoPergunta}
                      onSave={salvarEdicaoPergunta}
                      onCancel={cancelarEdicaoPergunta}
                      onRemove={removerPergunta}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Botões de ação */}
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={salvarVaga}
                disabled={createJobMutation.isPending || updateJobMutation.isPending || perguntas.length === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                <Save className="w-4 h-4 mr-2" />
                Salvar Vaga
              </Button>
              <Button 
                variant="outline" 
                onClick={resetForm}
              >
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de vagas */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Vagas Cadastradas</CardTitle>
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar vagas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Carregando vagas...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome da Vaga</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Perguntas</TableHead>
                  <TableHead>Data de Criação</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">{job.nomeVaga}</TableCell>
                    <TableCell>
                      <Badge variant={job.status === 'ativo' ? 'default' : 'secondary'}>
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{job.perguntas?.length || 0} perguntas</TableCell>
                    <TableCell>
                      {job.createdAt 
                        ? (() => {
                            try {
                              // Se for timestamp do Firebase
                              if (typeof job.createdAt === 'object' && job.createdAt.seconds) {
                                return new Date(job.createdAt.seconds * 1000).toLocaleDateString('pt-BR');
                              }
                              // Se for string de data normal
                              return new Date(job.createdAt).toLocaleDateString('pt-BR');
                            } catch {
                              return new Date().toLocaleDateString('pt-BR');
                            }
                          })()
                        : new Date().toLocaleDateString('pt-BR')
                      }
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(job)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
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
                                Tem certeza que deseja excluir a vaga "{job.nomeVaga}"? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteJobMutation.mutate(job.id)}>
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

// Componente para cada pergunta
function PerguntaCard({ 
  pergunta, 
  index, 
  onEdit, 
  onSave, 
  onCancel, 
  onRemove 
}: {
  pergunta: Pergunta;
  index: number;
  onEdit: (index: number) => void;
  onSave: (index: number, pergunta: string, resposta: string) => void;
  onCancel: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  const [editPergunta, setEditPergunta] = useState(pergunta.pergunta);
  const [editResposta, setEditResposta] = useState(pergunta.respostaPerfeita);

  useEffect(() => {
    setEditPergunta(pergunta.pergunta);
    setEditResposta(pergunta.respostaPerfeita);
  }, [pergunta.pergunta, pergunta.respostaPerfeita]);

  return (
    <Card className="border border-gray-200">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="font-medium">Pergunta {pergunta.numero}</h5>
          <div className="flex gap-2">
            {pergunta.isEditing ? (
              <>
                <Button
                  size="sm"
                  onClick={() => onSave(index, editPergunta, editResposta)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Save className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onCancel(index)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit(index)}
                >
                  <Edit className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRemove(index)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </>
            )}
          </div>
        </div>

        {pergunta.isEditing ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Pergunta ao Candidato</Label>
              <Input
                value={editPergunta}
                onChange={(e) => setEditPergunta(e.target.value.slice(0, 100))}
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">{editPergunta.length}/100 caracteres</p>
            </div>
            <div className="space-y-1">
              <Label>Resposta Perfeita</Label>
              <Textarea
                value={editResposta}
                onChange={(e) => setEditResposta(e.target.value.slice(0, 1000))}
                maxLength={1000}
                rows={3}
                className="resize-y"
              />
              <p className="text-xs text-muted-foreground">{editResposta.length}/1000 caracteres</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium text-gray-700">Pergunta:</p>
              <p className="text-sm">{pergunta.pergunta}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Resposta Perfeita:</p>
              <p className="text-sm text-gray-600 max-h-20 overflow-y-auto">{pergunta.respostaPerfeita}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}