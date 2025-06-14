import { useState } from "react";
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
  const [vagasCriadas, setVagasCriadas] = useState<Vaga[]>([]);
  const [mostrarNovaVaga, setMostrarNovaVaga] = useState(false);

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

  // Buscar vagas existentes
  const { data: vagasExistentes = [], refetch: refetchVagas } = useQuery<Vaga[]>({
    queryKey: ["/api/jobs"],
    select: (data: unknown) => {
      if (Array.isArray(data)) {
        return data;
      }
      return [];
    }
  });

  // Mutations para vagas
  const criarVagaMutation = useMutation({
    mutationFn: async (data: VagaFormData) => {
      const clientId = user?.role === 'master' ? data.clientId : user?.clientId;
      
      const vagaData = {
        nomeVaga: data.nomeVaga,
        descricaoVaga: data.descricaoVaga,
        clientId: clientId,
        status: 'ativo'
      };

      const response = await apiRequest("POST", "/api/jobs", vagaData);
      return await response.json();
    },
    onSuccess: (novaVaga: Vaga) => {
      setVagaAtual(novaVaga);
      toast({
        title: "Sucesso",
        description: "Vaga criada com sucesso! Agora adicione as perguntas da entrevista.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
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
      setPerguntas([...perguntas, novaPergunta]);
      setMostrarFormularioPergunta(false);
      perguntaForm.reset();
      toast({
        title: "Sucesso",
        description: "Pergunta adicionada com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar pergunta",
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
    onSuccess: (perguntaAtualizada: Pergunta) => {
      setPerguntas(perguntas.map(p => p.id === perguntaAtualizada.id ? perguntaAtualizada : p));
      setMostrarFormularioPergunta(false);
      setPerguntaEditando(null);
      perguntaForm.reset();
      toast({
        title: "Sucesso",
        description: "Pergunta atualizada com sucesso!",
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
      const response = await apiRequest("DELETE", `/api/questions/${perguntaId}`);
      return await response.json();
    },
    onSuccess: (_, perguntaId) => {
      setPerguntas(perguntas.filter(p => p.id !== perguntaId));
      toast({
        title: "Sucesso",
        description: "Pergunta excluída com sucesso!",
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

  // Handlers
  const cadastrarVaga = (data: VagaFormData) => {
    criarVagaMutation.mutate(data);
  };

  const adicionarPergunta = () => {
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
    excluirPerguntaMutation.mutate(perguntaId);
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
              Acrescentar Perguntas da Entrevista
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
                    {perguntaEditando ? `Editar Pergunta ${perguntaEditando.numeroPergunta}` : `Pergunta ${perguntas.length + 1}`}
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
                          {perguntaEditando ? "Atualizar" : "Salvar"} Pergunta
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

            {/* Lista de Perguntas */}
            {perguntas.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold">Perguntas Cadastradas ({perguntas.length}/10)</h3>
                {perguntas.map((pergunta) => (
                  <Card key={pergunta.id} className="p-4">
                    <CardContent className="p-0">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium text-sm text-muted-foreground mb-1">
                            Pergunta {pergunta.numeroPergunta}
                          </div>
                          <div className="font-medium mb-2">
                            {pergunta.perguntaCandidato}
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

            {/* Botão final para finalizar cadastro da vaga */}
            {perguntas.length > 0 && (
              <div className="mt-6">
                <Button 
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="lg"
                  onClick={() => {
                    toast({
                      title: "Sucesso",
                      description: `Vaga "${vagaAtual?.nomeVaga}" cadastrada com ${perguntas.length} pergunta(s)!`,
                    });
                    // Reset form
                    setVagaAtual(null);
                    setPerguntas([]);
                    vagaForm.reset();
                  }}
                >
                  Finalizar Cadastro da Vaga
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}