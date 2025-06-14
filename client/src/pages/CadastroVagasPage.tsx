
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Save, Edit, Trash2 } from "lucide-react";

// Schemas de validação
const vagaFormSchema = z.object({
  nomeVaga: z.string().min(1, "Nome da vaga é obrigatório"),
  descricaoVaga: z.string().min(1, "Descrição da vaga é obrigatória"),
  clientId: z.number().optional(),
});

const perguntaFormSchema = z.object({
  perguntaCandidato: z.string().min(1, "Pergunta é obrigatória").max(100, "Pergunta deve ter no máximo 100 caracteres"),
  respostaPerfeita: z.string().min(1, "Resposta perfeita é obrigatória").max(1000, "Resposta deve ter no máximo 1000 caracteres"),
});

type VagaFormData = z.infer<typeof vagaFormSchema>;
type PerguntaFormData = z.infer<typeof perguntaFormSchema>;

interface Vaga {
  id: string;
  nomeVaga: string;
  descricaoVaga: string;
  clientId: number;
  status: string;
  createdAt: Date | null;
}

interface Pergunta {
  id: number;
  vagaId: string;
  perguntaCandidato: string;
  respostaPerfeita: string;
  numeroPergunta: number;
  createdAt: Date | null;
}

export default function CadastroVagasPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Estados
  const [vagaAtual, setVagaAtual] = useState<Vaga | null>(null);
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [mostrarFormularioPergunta, setMostrarFormularioPergunta] = useState(false);
  const [perguntaEditando, setPerguntaEditando] = useState<Pergunta | null>(null);

  // Formulários
  const vagaForm = useForm<VagaFormData>({
    resolver: zodResolver(vagaFormSchema),
    defaultValues: {
      nomeVaga: "",
      descricaoVaga: "",
      clientId: user?.role === 'client' ? user.clientId : undefined,
    },
  });

  const perguntaForm = useForm<PerguntaFormData>({
    resolver: zodResolver(perguntaFormSchema),
    defaultValues: {
      perguntaCandidato: "",
      respostaPerfeita: "",
    },
  });

  // Buscar clientes para usuários master
  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
    enabled: user?.role === 'master',
  });

  // Carregar perguntas quando vaga atual mudar
  useEffect(() => {
    if (vagaAtual?.id) {
      carregarPerguntas(vagaAtual.id);
    }
  }, [vagaAtual]);

  // Função para carregar perguntas da vaga
  const carregarPerguntas = async (vagaId: string) => {
    try {
      const response = await apiRequest("GET", `/api/questions/${vagaId}`);
      const perguntasData = await response.json();
      setPerguntas(Array.isArray(perguntasData) ? perguntasData : []);
    } catch (error) {
      console.error("Erro ao carregar perguntas:", error);
      setPerguntas([]);
    }
  };

  // Mutations para vagas
  const criarVagaMutation = useMutation({
    mutationFn: async (data: VagaFormData) => {
      const clientId = user?.role === 'master' ? data.clientId : user?.clientId;
      
      const vagaData = {
        nomeVaga: data.nomeVaga,
        descricaoVaga: data.descricaoVaga,
        clientId: clientId,
        status: 'not_finished' // Status inicial para vaga não finalizada
      };

      const response = await apiRequest("POST", "/api/jobs", vagaData);
      return await response.json();
    },
    onSuccess: (novaVaga: Vaga) => {
      setVagaAtual(novaVaga);
      setPerguntas([]);
      toast({
        title: "Sucesso",
        description: "Vaga criada! Agora adicione as perguntas da entrevista.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar vaga",
        variant: "destructive",
      });
    },
  });

  // Mutations para perguntas
  const criarPerguntaMutation = useMutation({
    mutationFn: async (data: PerguntaFormData) => {
      if (!vagaAtual) throw new Error("Nenhuma vaga selecionada");

      const perguntaData = {
        vagaId: vagaAtual.id,
        perguntaCandidato: data.perguntaCandidato,
        respostaPerfeita: data.respostaPerfeita,
        numeroPergunta: perguntas.length + 1,
      };

      const response = await apiRequest("POST", "/api/questions", perguntaData);
      return await response.json();
    },
    onSuccess: (novaPergunta: Pergunta) => {
      // Recarregar perguntas para garantir sincronização com o banco
      if (vagaAtual?.id) {
        carregarPerguntas(vagaAtual.id);
      }
      setMostrarFormularioPergunta(false);
      perguntaForm.reset();
      toast({
        title: "Sucesso",
        description: "Pergunta salva no banco de dados!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar pergunta",
        variant: "destructive",
      });
    },
  });

  const atualizarPerguntaMutation = useMutation({
    mutationFn: async (data: PerguntaFormData) => {
      if (!perguntaEditando) throw new Error("Nenhuma pergunta sendo editada");

      const perguntaData = {
        perguntaCandidato: data.perguntaCandidato,
        respostaPerfeita: data.respostaPerfeita,
      };

      const response = await apiRequest("PATCH", `/api/questions/${perguntaEditando.id}`, perguntaData);
      return await response.json();
    },
    onSuccess: () => {
      // Recarregar perguntas
      if (vagaAtual?.id) {
        carregarPerguntas(vagaAtual.id);
      }
      setMostrarFormularioPergunta(false);
      setPerguntaEditando(null);
      perguntaForm.reset();
      toast({
        title: "Sucesso",
        description: "Pergunta atualizada no banco de dados!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar pergunta",
        variant: "destructive",
      });
    },
  });

  const excluirPerguntaMutation = useMutation({
    mutationFn: async (perguntaId: number) => {
      await apiRequest("DELETE", `/api/questions/${perguntaId}`);
    },
    onSuccess: () => {
      // Recarregar perguntas
      if (vagaAtual?.id) {
        carregarPerguntas(vagaAtual.id);
      }
      toast({
        title: "Sucesso",
        description: "Pergunta excluída do banco de dados!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir pergunta",
        variant: "destructive",
      });
    },
  });

  const finalizarVagaMutation = useMutation({
    mutationFn: async () => {
      if (!vagaAtual) throw new Error("Nenhuma vaga para finalizar");

      const response = await apiRequest("PATCH", `/api/jobs/${vagaAtual.id}`, {
        status: 'ativo'
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: `Vaga "${vagaAtual?.nomeVaga}" finalizada com ${perguntas.length} pergunta(s)!`,
      });
      // Reset form
      setVagaAtual(null);
      setPerguntas([]);
      vagaForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao finalizar vaga",
        variant: "destructive",
      });
    },
  });

  // Handlers
  const cadastrarVaga = (data: VagaFormData) => {
    criarVagaMutation.mutate(data);
  };

  const adicionarPergunta = () => {
    if (!vagaAtual) {
      toast({
        title: "Erro",
        description: "Primeiro crie uma vaga para adicionar perguntas.",
        variant: "destructive",
      });
      return;
    }

    if (perguntas.length >= 10) {
      toast({
        title: "Limite atingido",
        description: "Máximo de 10 perguntas por vaga.",
        variant: "destructive",
      });
      return;
    }

    setMostrarFormularioPergunta(true);
    setPerguntaEditando(null);
    perguntaForm.reset();
  };

  const editarPergunta = (pergunta: Pergunta) => {
    setPerguntaEditando(pergunta);
    setMostrarFormularioPergunta(true);
    perguntaForm.reset({
      perguntaCandidato: pergunta.perguntaCandidato,
      respostaPerfeita: pergunta.respostaPerfeita,
    });
  };

  const salvarPergunta = (data: PerguntaFormData) => {
    if (perguntaEditando) {
      atualizarPerguntaMutation.mutate(data);
    } else {
      criarPerguntaMutation.mutate(data);
    }
  };

  const cancelarPergunta = () => {
    setMostrarFormularioPergunta(false);
    setPerguntaEditando(null);
    perguntaForm.reset();
  };

  const excluirPergunta = (perguntaId: number) => {
    if (confirm("Tem certeza que deseja excluir esta pergunta?")) {
      excluirPerguntaMutation.mutate(perguntaId);
    }
  };

  const finalizarVaga = () => {
    if (perguntas.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos uma pergunta antes de finalizar a vaga.",
        variant: "destructive",
      });
      return;
    }

    finalizarVagaMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Cadastro de Vagas</h1>
      </div>

      {/* Formulário de Vaga */}
      {!vagaAtual && (
        <Card>
          <CardHeader>
            <CardTitle>Nova Vaga</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...vagaForm}>
              <form onSubmit={vagaForm.handleSubmit(cadastrarVaga)} className="space-y-4">
                <FormField
                  control={vagaForm.control}
                  name="nomeVaga"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Vaga</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Digite o nome da vaga" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={vagaForm.control}
                  name="descricaoVaga"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição da Vaga</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder="Descreva a vaga para uso interno"
                          rows={4}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {user?.role === 'master' && (
                  <FormField
                    control={vagaForm.control}
                    name="clientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cliente</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um cliente" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {clients && clients.map((client: any) => (
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

                <Button 
                  type="submit" 
                  disabled={criarVagaMutation.isPending}
                  className="w-full"
                >
                  {criarVagaMutation.isPending ? "Criando..." : "Criar Vaga"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Seção de Perguntas */}
      {vagaAtual && (
        <Card>
          <CardHeader>
            <CardTitle>
              Perguntas da Entrevista - {vagaAtual.nomeVaga}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={adicionarPergunta}
              disabled={perguntas.length >= 10}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Pergunta ({perguntas.length}/10)
            </Button>

            {perguntas.length >= 10 && (
              <p className="text-sm text-muted-foreground text-center">
                Máximo de 10 perguntas atingido. Não é possível adicionar mais perguntas.
              </p>
            )}

            {/* Formulário de Pergunta */}
            {mostrarFormularioPergunta && (
              <Card className="border-2 border-blue-200">
                <CardHeader>
                  <CardTitle className="text-lg">
                    {perguntaEditando ? `Editar Pergunta ${perguntaEditando.numeroPergunta}` : `Nova Pergunta ${perguntas.length + 1}`}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...perguntaForm}>
                    <form onSubmit={perguntaForm.handleSubmit(salvarPergunta)} className="space-y-4">
                      <FormField
                        control={perguntaForm.control}
                        name="perguntaCandidato"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Pergunta para o Candidato (máx. 100 caracteres)</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                placeholder="Digite a pergunta que será feita ao candidato"
                                maxLength={100}
                                rows={2}
                              />
                            </FormControl>
                            <div className="text-sm text-muted-foreground">
                              {field.value?.length || 0}/100 caracteres
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={perguntaForm.control}
                        name="respostaPerfeita"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Resposta Perfeita (máx. 1000 caracteres)</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                placeholder="Digite a resposta ideal para esta pergunta"
                                maxLength={1000}
                                rows={4}
                              />
                            </FormControl>
                            <div className="text-sm text-muted-foreground">
                              {field.value?.length || 0}/1000 caracteres
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex gap-2">
                        <Button 
                          type="submit" 
                          disabled={criarPerguntaMutation.isPending || atualizarPerguntaMutation.isPending}
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {criarPerguntaMutation.isPending || atualizarPerguntaMutation.isPending 
                            ? "Salvando..." 
                            : perguntaEditando ? "Atualizar Pergunta" : "Salvar Pergunta"
                          }
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={cancelarPergunta}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}

            {/* Preview das Perguntas Salvas */}
            {perguntas.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold">Perguntas Cadastradas ({perguntas.length}/10)</h3>
                {perguntas.map((pergunta) => (
                  <Card key={pergunta.id} className="p-4 bg-green-50 border-green-200">
                    <CardContent className="p-0">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium text-sm text-green-700 mb-1">
                            Pergunta {pergunta.numeroPergunta} ✓ Salva no banco
                          </div>
                          <div className="font-medium mb-2">
                            <strong>Pergunta:</strong> {pergunta.perguntaCandidato}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <strong>Resposta esperada:</strong> {pergunta.respostaPerfeita}
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => editarPergunta(pergunta)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => excluirPergunta(pergunta.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Botão para finalizar cadastro da vaga - só aparece se tem perguntas */}
            {perguntas.length > 0 && (
              <div className="mt-6">
                <Button 
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="lg"
                  onClick={finalizarVaga}
                  disabled={finalizarVagaMutation.isPending}
                >
                  {finalizarVagaMutation.isPending 
                    ? "Finalizando..." 
                    : `Finalizar Cadastro da Vaga (${perguntas.length} pergunta${perguntas.length > 1 ? 's' : ''} salva${perguntas.length > 1 ? 's' : ''})`
                  }
                </Button>
                <p className="text-sm text-muted-foreground text-center mt-2">
                  Todas as perguntas já estão salvas no banco de dados. 
                  Clique para ativar a vaga e disponibilizá-la para seleções.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
