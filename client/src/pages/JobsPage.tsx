import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Edit3, Trash2, Save, X } from "lucide-react";
import { insertJobSchema, insertQuestionSchema, type Job, type Question, type Client, type InsertJob, type InsertQuestion } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

// Schemas para formulários
const jobFormSchema = insertJobSchema.extend({
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().min(1, "Descrição é obrigatória"),
  requirements: z.string().optional(),
  benefits: z.string().optional(),
  location: z.string().optional(),
  workType: z.string().optional(),
  salaryRange: z.string().optional(),
  experienceLevel: z.string().optional(),
  department: z.string().optional(),
  contractType: z.string().optional(),
});

const questionFormSchema = insertQuestionSchema.omit({
  jobId: true,
  order: true,
}).extend({
  questionText: z.string().min(1, "Pergunta é obrigatória"),
  idealAnswer: z.string().min(1, "Resposta ideal é obrigatória"),
});

type JobFormData = z.infer<typeof jobFormSchema>;
type QuestionFormData = z.infer<typeof questionFormSchema>;

export default function JobsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Estados principais
  const [searchTerm, setSearchTerm] = useState("");
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  // Formulários
  const jobForm = useForm<JobFormData>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      title: "",
      description: "",
      requirements: "",
      benefits: "",
      location: "",
      workType: "",
      salaryRange: "",
      experienceLevel: "",
      department: "",
      contractType: "",
    },
  });

  const questionForm = useForm<QuestionFormData>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: {
      questionText: "",
      idealAnswer: "",
    },
  });

  // Queries - filtradas automaticamente baseado no role do usuário
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["/api/jobs"],
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
    enabled: user?.role === 'master',
  });

  // Filtrar vagas baseado no role do usuário
  const filteredJobs = user?.role === 'master' 
    ? jobs 
    : jobs.filter((job: Job) => job.clientId === user?.clientId);

  // Mutations
  const createJobMutation = useMutation({
    mutationFn: async (jobData: InsertJob) => {
      const response = await apiRequest("POST", "/api/jobs", jobData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    },
  });

  const updateJobMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Job> }) => {
      const response = await apiRequest("PATCH", `/api/jobs/${id}`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    },
  });

  const deleteJobMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/jobs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    },
  });

  const createQuestionMutation = useMutation({
    mutationFn: async (questionData: InsertQuestion) => {
      const response = await apiRequest("POST", "/api/questions", questionData);
      return response.json();
    },
    onSuccess: () => {
      if (currentJob?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/jobs", currentJob.id.toString(), "questions"] });
        loadJobQuestions(currentJob.id);
      }
    },
  });

  const updateQuestionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Question> }) => {
      const response = await apiRequest("PATCH", `/api/questions/${id}`, data);
      return response;
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/questions/${id}`);
    },
    onSuccess: () => {
      if (currentJob?.id) {
        loadJobQuestions(currentJob.id);
      }
    },
  });

  // Funções principais
  const startNewJob = () => {
    const jobData: InsertJob = {
      title: "Nova Vaga (não finalizada)",
      description: "Vaga em processo de criação",
      clientId: user?.role === 'master' ? 1 : (user?.clientId || 1),
      status: "not_finished",
    };

    createJobMutation.mutate(jobData, {
      onSuccess: (newJob) => {
        setCurrentJob(newJob); // Definir currentJob para permitir adicionar perguntas
        toast({
          title: "Vaga Iniciada",
          description: "Vaga criada automaticamente. Adicione as informações.",
        });
        
        jobForm.reset({
          title: "",
          description: "",
          clientId: newJob.clientId,
          status: "not_finished",
        });
      },
    });
  };

  const finalizeJob = () => {
    if (!currentJob?.id || questions.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos uma pergunta antes de criar a vaga.",
        variant: "destructive",
      });
      return;
    }

    // Validar se os campos obrigatórios estão preenchidos
    const jobData = jobForm.getValues();
    if (!jobData.title || !jobData.description) {
      toast({
        title: "Erro",
        description: "Preencha o título e descrição da vaga.",
        variant: "destructive",
      });
      return;
    }

    // Salvar todas as informações da vaga e ativar
    updateJobMutation.mutate({
      id: currentJob.id,
      data: { 
        ...jobData,
        status: "active" 
      },
    }, {
      onSuccess: () => {
        setCurrentJob(null);
        setQuestions([]);
        jobForm.reset();
        toast({
          title: "Sucesso",
          description: "Vaga criada e ativada com sucesso!",
        });
      },
    });
  };

  const cancelJob = async () => {
    if (!currentJob?.id) {
      // Se não há vaga atual, apenas limpar estados
      setCurrentJob(null);
      setQuestions([]);
      jobForm.reset();
      return;
    }

    // Se for uma vaga nova (status not_finished), deletar do banco
    if (currentJob.status === "not_finished") {
      if (confirm("Tem certeza que deseja cancelar? A vaga e todas as perguntas serão removidas.")) {
        try {
          // Deletar todas as perguntas da vaga primeiro
          for (const question of questions) {
            await apiRequest("DELETE", `/api/questions/${question.id}`);
          }
          
          // Deletar a vaga
          deleteJobMutation.mutate(currentJob.id, {
            onSuccess: () => {
              setCurrentJob(null);
              setQuestions([]);
              jobForm.reset();
              toast({
                title: "Cancelado",
                description: "Vaga cancelada e removida do banco de dados.",
              });
            },
          });
        } catch (error) {
          console.error("Erro ao cancelar vaga:", error);
          toast({
            title: "Erro",
            description: "Erro ao cancelar vaga. Tente novamente.",
            variant: "destructive",
          });
        }
      }
    } else {
      // Se for uma vaga ativa sendo editada, apenas voltar à tela inicial
      setCurrentJob(null);
      setQuestions([]);
      jobForm.reset();
      toast({
        title: "Edição cancelada",
        description: "Voltando à tela de gerenciamento de vagas.",
      });
    }
  };

  const addQuestion = () => {
    if (!currentJob?.id) {
      toast({
        title: "Erro",
        description: "Inicie uma vaga primeiro.",
        variant: "destructive",
      });
      return;
    }

    if (questions.length >= 10) {
      toast({
        title: "Limite atingido",
        description: "Máximo de 10 perguntas por vaga.",
        variant: "destructive",
      });
      return;
    }

    setShowQuestionForm(true);
    setEditingQuestion(null);
    questionForm.reset();
  };

  const editQuestion = (question: Question) => {
    setEditingQuestion(question);
    setShowQuestionForm(true);
    questionForm.reset({
      questionText: question.questionText,
      idealAnswer: question.idealAnswer,
    });
  };

  const saveQuestion = (data: QuestionFormData) => {
    if (!currentJob?.id) return;

    if (editingQuestion?.id) {
      updateQuestionMutation.mutate({
        id: editingQuestion.id,
        data,
      }, {
        onSuccess: () => {
          setShowQuestionForm(false);
          setEditingQuestion(null);
          questionForm.reset();
          loadJobQuestions(currentJob.id);
          toast({
            title: "Sucesso",
            description: "Pergunta atualizada com sucesso!",
          });
        }
      });
    } else {
      const questionData: InsertQuestion = {
        ...data,
        jobId: currentJob.id,
        order: questions.length + 1,
      };
      
      createQuestionMutation.mutate(questionData, {
        onSuccess: (newQuestion) => {
          setShowQuestionForm(false);
          questionForm.reset();
          // Recarregar perguntas do banco para garantir sincronização
          loadJobQuestions(currentJob.id);
          toast({
            title: "Sucesso", 
            description: "Pergunta adicionada com sucesso!",
          });
        }
      });
    }
  };

  const removeQuestion = (questionId: number) => {
    if (confirm("Tem certeza que deseja remover esta pergunta do banco de dados?")) {
      deleteQuestionMutation.mutate(questionId, {
        onSuccess: () => {
          toast({
            title: "Sucesso",
            description: "Pergunta removida do banco de dados!",
          });
        },
        onError: () => {
          toast({
            title: "Erro",
            description: "Erro ao remover pergunta. Tente novamente.",
            variant: "destructive",
          });
        }
      });
    }
  };

  const loadJobQuestions = async (jobId: string | number) => {
    try {
      const response = await apiRequest("GET", `/api/jobs/${jobId}/questions`);
      setQuestions(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error("Erro ao carregar perguntas:", error);
      setQuestions([]);
    }
  };

  const activeJobs = jobs.filter((job: Job) =>
    job.status === "active" && (
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.description.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const draftJobs = jobs.filter((job: Job) =>
    job.status === "not_finished"
  );

  // Carregar perguntas quando currentJob mudar
  useEffect(() => {
    if (currentJob?.id) {
      loadJobQuestions(currentJob.id);
    }
  }, [currentJob?.id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-600">Carregando vagas...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gerenciar Vagas</h1>
          <p className="text-slate-600 mt-1">Crie e gerencie vagas de emprego</p>
        </div>
        <Button onClick={startNewJob} disabled={!!currentJob} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Nova Vaga
        </Button>
      </div>

      {/* Formulário de criação de vaga */}
      {currentJob && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-900">Criar Nova Vaga</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Formulário da Vaga */}
            <Form {...jobForm}>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={jobForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Título da Vaga</FormLabel>
                        <FormControl>
                          <Input placeholder="Digite o título da vaga..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {user?.role === 'master' && (
                    <FormField
                      control={jobForm.control}
                      name="clientId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cliente</FormLabel>
                          <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o cliente" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {clients.map((client: Client) => (
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
                </div>

                <FormField
                  control={jobForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Descreva a vaga detalhadamente..."
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Form>

            <Separator />

            {/* Seção de Perguntas */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">
                  Perguntas da Entrevista ({questions.length}/10)
                </h3>
                <Button
                  onClick={addQuestion}
                  disabled={questions.length >= 10}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Pergunta
                </Button>
              </div>

              {/* Lista de Perguntas como Blocos Editáveis */}
              {questions.length > 0 && (
                <div className="space-y-3">
                  {questions.sort((a, b) => a.order - b.order).map((question, index) => (
                    <Card key={question.id} className="border-emerald-200 bg-emerald-50/50 shadow-sm">
                      <CardContent className="p-5">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1 space-y-3">
                            {/* Header da pergunta */}
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold">
                                {index + 1}
                              </div>
                              <span className="bg-emerald-100 text-emerald-800 text-xs font-medium px-3 py-1 rounded-full">
                                Pergunta {index + 1}
                              </span>
                            </div>
                            
                            {/* Conteúdo da pergunta */}
                            <div className="pl-11 space-y-2">
                              <div>
                                <h4 className="text-sm font-medium text-slate-700 mb-1">Pergunta:</h4>
                                <p className="text-sm text-slate-900 font-medium bg-white px-3 py-2 rounded-md border border-emerald-200">
                                  {question.questionText}
                                </p>
                              </div>
                              
                              <div>
                                <h4 className="text-sm font-medium text-slate-700 mb-1">Resposta Ideal:</h4>
                                <p className="text-sm text-slate-700 bg-white px-3 py-2 rounded-md border border-emerald-200">
                                  {question.idealAnswer}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Botões de ação */}
                          <div className="flex flex-col gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => editQuestion(question)}
                              className="text-blue-600 hover:text-blue-700 border-blue-300 hover:bg-blue-50"
                            >
                              <Edit3 className="w-4 h-4 mr-1" />
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => removeQuestion(question.id)}
                              className="text-red-600 hover:text-red-700 border-red-300 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Remover
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Formulário de Pergunta */}
              {showQuestionForm && (
                <Card className="border-green-200 bg-green-50">
                  <CardHeader>
                    <CardTitle className="text-green-900">
                      {editingQuestion ? "Editar Pergunta" : "Nova Pergunta"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Form {...questionForm}>
                      <form onSubmit={questionForm.handleSubmit(saveQuestion)} className="space-y-4">
                        <FormField
                          control={questionForm.control}
                          name="questionText"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Pergunta</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Digite a pergunta da entrevista..."
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={questionForm.control}
                          name="idealAnswer"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Resposta Ideal</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Digite a resposta ideal esperada..."
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="flex gap-3">
                          <Button 
                            type="submit" 
                            disabled={createQuestionMutation.isPending || updateQuestionMutation.isPending}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Save className="w-4 h-4 mr-2" />
                            {createQuestionMutation.isPending || updateQuestionMutation.isPending ? "Salvando..." : "Salvar Pergunta"}
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => {
                              setShowQuestionForm(false);
                              setEditingQuestion(null);
                              questionForm.reset();
                            }}
                          >
                            <X className="w-4 h-4 mr-2" />
                            Cancelar
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              )}
            </div>

            <Separator />

            {/* Botões de Ação */}
            <div className="flex gap-3">
              <Button
                onClick={finalizeJob}
                disabled={updateJobMutation.isPending || questions.length === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                {updateJobMutation.isPending 
                  ? (currentJob?.status === "active" ? "Salvando..." : "Criando...") 
                  : (currentJob?.status === "active" ? "Salvar Alterações" : "Criar Vaga")
                }
              </Button>
              <Button type="button" variant="outline" onClick={cancelJob}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
        <Input
          placeholder="Buscar vagas..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Vagas em Rascunho */}
      {draftJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-orange-900">Vagas em Rascunho</CardTitle>
            <p className="text-orange-600 text-sm">Vagas não finalizadas que precisam ser completadas</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {draftJobs.map((job: Job) => (
                <Card key={`draft-${job.id}`} className="border-orange-200 bg-orange-50">
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <h3 className="font-semibold text-orange-900">{job.title}</h3>
                      <p className="text-sm text-orange-700">{job.description}</p>
                      <div className="flex gap-2 pt-2">
                        <Button 
                          size="sm" 
                          onClick={() => {
                            setCurrentJob(job);
                            // Carregar os dados da vaga no formulário
                            jobForm.reset({
                              title: job.title,
                              description: job.description,
                              clientId: job.clientId,
                              requirements: job.requirements || "",
                              benefits: job.benefits || "",
                              location: job.location || "",
                              workType: job.workType || "",
                              salaryRange: job.salaryRange || "",
                              experienceLevel: job.experienceLevel || "",
                              department: job.department || "",
                              contractType: job.contractType || "",
                            });
                          }}
                          className="bg-orange-600 hover:bg-orange-700 text-white"
                        >
                          Continuar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            if (confirm(`Tem certeza que deseja excluir a vaga em rascunho "${job.title}"?`)) {
                              deleteJobMutation.mutate(job.id.toString(), {
                                onSuccess: () => {
                                  toast({
                                    title: "Sucesso",
                                    description: "Vaga em rascunho excluída com sucesso!",
                                  });
                                },
                                onError: () => {
                                  toast({
                                    title: "Erro",
                                    description: "Erro ao excluir vaga. Tente novamente.",
                                    variant: "destructive",
                                  });
                                }
                              });
                            }
                          }}
                          className="text-red-700 border-red-300 hover:bg-red-100"
                          disabled={deleteJobMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vagas Ativas */}
      <Card>
        <CardHeader>
          <CardTitle>Vagas Ativas</CardTitle>
          <p className="text-slate-600 text-sm">Vagas publicadas e disponíveis para candidatos</p>
        </CardHeader>
        <CardContent>
          {activeJobs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-500">Nenhuma vaga ativa encontrada</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeJobs.map((job: Job) => (
                <Card key={`active-${job.id}`} className="border-green-200 bg-green-50">
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <h3 className="font-semibold text-green-900">{job.title}</h3>
                      <p className="text-sm text-green-700">{job.description}</p>
                      <div className="flex gap-2 pt-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setCurrentJob(job);
                            // Carregar os dados da vaga no formulário
                            jobForm.reset({
                              title: job.title,
                              description: job.description,
                              clientId: job.clientId,
                              requirements: job.requirements || "",
                              benefits: job.benefits || "",
                              location: job.location || "",
                              workType: job.workType || "",
                              salaryRange: job.salaryRange || "",
                              experienceLevel: job.experienceLevel || "",
                              department: job.department || "",
                              contractType: job.contractType || "",
                            });
                          }}
                          className="text-green-700 border-green-300 hover:bg-green-100"
                        >
                          <Edit3 className="w-4 h-4 mr-1" />
                          Editar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            if (confirm(`Tem certeza que deseja excluir a vaga "${job.title}"?`)) {
                              deleteJobMutation.mutate(job.id.toString(), {
                                onSuccess: () => {
                                  toast({
                                    title: "Sucesso",
                                    description: "Vaga excluída com sucesso!",
                                  });
                                },
                                onError: () => {
                                  toast({
                                    title: "Erro",
                                    description: "Erro ao excluir vaga. Tente novamente.",
                                    variant: "destructive",
                                  });
                                }
                              });
                            }
                          }}
                          className="text-red-700 border-red-300 hover:bg-red-100"
                          disabled={deleteJobMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          {deleteJobMutation.isPending ? "Excluindo..." : "Excluir"}
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
    </div>
  );
}