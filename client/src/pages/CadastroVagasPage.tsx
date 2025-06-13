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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Save, Edit, Trash2 } from "lucide-react";

// Schemas de validação
const vagaFormSchema = z.object({
  nomeVaga: z.string().min(1, "Nome da vaga é obrigatório"),
  descricaoVaga: z.string().min(1, "Descrição da vaga é obrigatória"),
});

const perguntaFormSchema = z.object({
  perguntaCandidato: z.string().min(1, "Pergunta é obrigatória").max(100, "Máximo 100 caracteres"),
  respostaPerfeita: z.string().min(1, "Resposta perfeita é obrigatória").max(1000, "Máximo 1000 caracteres"),
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
  
  const [vagaAtual, setVagaAtual] = useState<Vaga | null>(null);
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [mostrarFormularioPergunta, setMostrarFormularioPergunta] = useState(false);
  const [perguntaEditando, setPerguntaEditando] = useState<Pergunta | null>(null);

  // Forms
  const vagaForm = useForm<VagaFormData>({
    resolver: zodResolver(vagaFormSchema),
    defaultValues: {
      nomeVaga: "",
      descricaoVaga: "",
    },
  });

  const perguntaForm = useForm<PerguntaFormData>({
    resolver: zodResolver(perguntaFormSchema),
    defaultValues: {
      perguntaCandidato: "",
      respostaPerfeita: "",
    },
  });

  // Mutations para vagas
  const criarVagaMutation = useMutation({
    mutationFn: async (data: VagaFormData) => {
      const vagaData = {
        ...data,
        clientId: user?.role === 'master' ? 1 : user?.clientId || 1,
        status: "ativo",
      };
      const response = await apiRequest("POST", "/api/jobs", vagaData);
      return response.json();
    },
    onSuccess: (novaVaga: Vaga) => {
      setVagaAtual(novaVaga);
      setPerguntas([]);
      toast({
        title: "Sucesso",
        description: "Vaga cadastrada com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    },
  });

  // Mutations para perguntas
  const criarPerguntaMutation = useMutation({
    mutationFn: async (data: PerguntaFormData & { vagaId: string; numeroPergunta: number }) => {
      const response = await apiRequest("POST", "/api/questions", data);
      return response.json();
    },
    onSuccess: (novaPergunta: Pergunta) => {
      setPerguntas(prev => [...prev, novaPergunta].sort((a, b) => a.numeroPergunta - b.numeroPergunta));
      setMostrarFormularioPergunta(false);
      perguntaForm.reset();
      toast({
        title: "Sucesso",
        description: "Pergunta adicionada com sucesso!",
      });
    },
  });

  const editarPerguntaMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Pergunta> }) => {
      const response = await apiRequest("PATCH", `/api/questions/${id}`, data);
      return response.json();
    },
    onSuccess: (perguntaAtualizada: Pergunta) => {
      setPerguntas(prev => 
        prev.map(p => p.id === perguntaAtualizada.id ? perguntaAtualizada : p)
          .sort((a, b) => a.numeroPergunta - b.numeroPergunta)
      );
      setMostrarFormularioPergunta(false);
      setPerguntaEditando(null);
      perguntaForm.reset();
      toast({
        title: "Sucesso",
        description: "Pergunta atualizada com sucesso!",
      });
    },
  });

  const removerPerguntaMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/questions/${id}`);
    },
    onSuccess: (_, idRemovida) => {
      setPerguntas(prev => {
        const perguntasRestantes = prev.filter(p => p.id !== idRemovida);
        // Reordenar números das perguntas
        return perguntasRestantes.map((p, index) => ({
          ...p,
          numeroPergunta: index + 1
        }));
      });
      toast({
        title: "Sucesso",
        description: "Pergunta removida com sucesso!",
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
        description: "Cadastre uma vaga primeiro!",
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
    if (!vagaAtual) return;

    if (perguntaEditando) {
      editarPerguntaMutation.mutate({
        id: perguntaEditando.id,
        data: {
          perguntaCandidato: data.perguntaCandidato,
          respostaPerfeita: data.respostaPerfeita,
        },
      });
    } else {
      criarPerguntaMutation.mutate({
        ...data,
        vagaId: vagaAtual.id,
        numeroPergunta: perguntas.length + 1,
      });
    }
  };

  const removerPergunta = (id: number) => {
    if (confirm("Tem certeza que deseja remover esta pergunta?")) {
      removerPerguntaMutation.mutate(id);
    }
  };

  const cancelarFormularioPergunta = () => {
    setMostrarFormularioPergunta(false);
    setPerguntaEditando(null);
    perguntaForm.reset();
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Cadastro de Vagas</h1>
      </div>

      {/* Formulário de Cadastro de Vaga */}
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

              <Button 
                type="submit" 
                disabled={criarVagaMutation.isPending}
                className="w-full"
              >
                {criarVagaMutation.isPending ? "Cadastrando..." : "Cadastrar Vaga"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

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
                            <FormLabel>Pergunta ao candidato (máximo 100 caracteres)</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="Digite a pergunta"
                                maxLength={100}
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
                            <FormLabel>Resposta Perfeita (máximo 1000 caracteres)</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                placeholder="Escreva uma resposta perfeita para a pergunta feita acima"
                                rows={6}
                                maxLength={1000}
                                className="resize-none overflow-y-auto"
                              />
                            </FormControl>
                            <div className="text-sm text-muted-foreground">
                              Escreva uma resposta perfeita para a pergunta feita acima, esta será utilizada para gerar o relatório de classificar os melhores candidatos.
                            </div>
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
                          disabled={criarPerguntaMutation.isPending || editarPerguntaMutation.isPending}
                          className="flex-1"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {perguntaEditando ? "Salvar Alterações" : "Salvar Pergunta"}
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={cancelarFormularioPergunta}
                          className="flex-1"
                        >
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}

            {/* Lista de Perguntas Salvas */}
            {perguntas.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Perguntas Cadastradas:</h3>
                {perguntas.map((pergunta) => (
                  <Card key={pergunta.id} className="border-emerald-200 bg-emerald-50/50">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="bg-emerald-600 text-white px-2 py-1 rounded text-sm font-medium">
                              Pergunta {pergunta.numeroPergunta}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-sm text-gray-700">Pergunta:</p>
                            <p className="text-gray-900">{pergunta.perguntaCandidato}</p>
                          </div>
                          <div>
                            <p className="font-medium text-sm text-gray-700">Resposta Perfeita:</p>
                            <p className="text-gray-900 text-sm">{pergunta.respostaPerfeita}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => editarPergunta(pergunta)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => removerPergunta(pergunta.id)}
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}