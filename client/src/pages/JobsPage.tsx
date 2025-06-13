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
      clientId: user?.role === 'master' ? 1 : (user?.clientId || 1),
      status: "not_finished",
    },
  });

  const questionForm = useForm<QuestionFormData>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: {
      questionText: "",
      idealAnswer: "",
    },
  });

  // Queries
  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: user?.role === 'master',
  });

  // Mutations
  const createJobMutation = useMutation({
    mutationFn: async (jobData: InsertJob) => {
      const response = await apiRequest("POST", "/api/jobs", jobData);
      return response.json();
    },
    onSuccess: (newJob: Job) => {
      setCurrentJob(newJob);
      setQuestions([]);
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    },
  });

  const updateJobMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Job> }) => {
      const response = await apiRequest("PATCH", `/api/jobs/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    },
  });

  const deleteJobMutation = useMutation({
    mutationFn: async (id: number) => {
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
        loadJobQuestions(currentJob.id);
      }
      setShowQuestionForm(false);
      questionForm.reset();
    },
  });

  const updateQuestionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Question> }) => {
      const response = await apiRequest("PATCH", `/api/questions/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      if (currentJob?.id) {
        loadJobQuestions(currentJob.id);
      }
      setShowQuestionForm(false);
      setEditingQuestion(null);
      questionForm.reset();
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
      clientId: user?.role === 'master' ? 1 : user?.clientId || 1,
      status: "not_finished",
    };

    createJobMutation.mutate(jobData, {
      onSuccess: (newJob) => {
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

  const saveJobInfo = (data: JobFormData) => {
    if (!currentJob?.id) return;

    updateJobMutation.mutate({
      id: currentJob.id,
      data: {
        title: data.title,
        description: data.description,
        clientId: data.clientId,
      },
    }, {
      onSuccess: (updatedJob) => {
        setCurrentJob(updatedJob);
        toast({
          title: "Sucesso",
          description: "Informações da vaga salvas!",
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

    // Primeiro salvar as informações da vaga
    const jobData = jobForm.getValues();
    
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
    if (!currentJob?.id) return;

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
              description: "Vaga e perguntas canceladas e removidas do banco de dados.",
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
          // Recarregar perguntas após edição
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
          // Adicionar a nova pergunta à lista local imediatamente
          setQuestions(prev => [...prev, newQuestion]);
          toast({
            title: "Sucesso", 
            description: "Pergunta adicionada com sucesso!",
          });
        }
      });
    }
  };

  const removeQuestion = (questionId: number) => {
    if (confirm("Tem certeza que deseja remover esta pergunta?")) {
      deleteQuestionMutation.mutate(questionId, {
        onSuccess: () => {
          // Remover da lista local imediatamente
          setQuestions(prev => prev.filter(q => q.id !== questionId));
          toast({
            title: "Sucesso",
            description: "Pergunta removida com sucesso!",
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

  const activeJobs = jobs.filter((job) =>
    job.status === "active" && (
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.description.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const draftJobs = jobs.filter((job) =>
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

      {/* Formulário de Nova Vaga */}
      {currentJob && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-900">
              {currentJob.status === "not_finished" ? "Nova Vaga (Em Criação)" : "Editando Vaga"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...jobForm}>
              <form onSubmit={jobForm.handleSubmit(saveJobInfo)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={jobForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Título da Vaga *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Desenvolvedor Frontend" {...field} />
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
                          <FormLabel>Empresa/Cliente *</FormLabel>
                          <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a empresa" />
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

                  <FormField
                    control={jobForm.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Departamento/Área</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Tecnologia, Marketing, Vendas..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={jobForm.control}
                    name="experienceLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nível de Experiência</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o nível" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="estagio">Estágio</SelectItem>
                            <SelectItem value="junior">Júnior</SelectItem>
                            <SelectItem value="pleno">Pleno</SelectItem>
                            <SelectItem value="senior">Sênior</SelectItem>
                            <SelectItem value="especialista">Especialista</SelectItem>
                            <SelectItem value="coordenador">Coordenador</SelectItem>
                            <SelectItem value="gerente">Gerente</SelectItem>
                            <SelectItem value="diretor">Diretor</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={jobForm.control}
                    name="workType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Modalidade de Trabalho</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a modalidade" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="presencial">Presencial</SelectItem>
                            <SelectItem value="remoto">Remoto</SelectItem>
                            <SelectItem value="hibrido">Híbrido</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={jobForm.control}
                    name="contractType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Contrato</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="clt">CLT</SelectItem>
                            <SelectItem value="pj">PJ</SelectItem>
                            <SelectItem value="estagio">Estágio</SelectItem>
                            <SelectItem value="temporario">Temporário</SelectItem>
                            <SelectItem value="terceirizado">Terceirizado</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={jobForm.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Localização</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: São Paulo - SP" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={jobForm.control}
                    name="salaryRange"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Faixa Salarial</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: R$ 5.000 - R$ 8.000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={jobForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição da Vaga *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Descreva as principais responsabilidades e atividades da vaga..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={jobForm.control}
                  name="requirements"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Requisitos e Qualificações</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Liste os requisitos técnicos, formação acadêmica, experiências necessárias..."
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={jobForm.control}
                  name="benefits"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Benefícios Oferecidos</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Liste os benefícios: plano de saúde, vale refeição, home office..."
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              </form>
            </Form>

            <Separator className="my-6" />

            {/* Seção de Perguntas */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Perguntas da Entrevista 
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      questions.length === 0 
                        ? 'bg-gray-100 text-gray-800' 
                        : questions.length >= 10 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {questions.length}/10 perguntas
                    </span>
                    {questions.length > 0 && (
                      <span className="text-xs text-green-600 font-medium">
                        ✓ Pronto para criar vaga
                      </span>
                    )}
                  </div>
                </div>
                <Button 
                  onClick={addQuestion} 
                  variant="outline" 
                  size="sm"
                  disabled={questions.length >= 10}
                  className={questions.length >= 10 ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {questions.length >= 10 ? 'Limite atingido' : 'Adicionar Pergunta'}
                </Button>
              </div>

              {/* Lista de Perguntas Salvas */}
              {questions.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium text-slate-900 mb-3">Perguntas Cadastradas:</h4>
                  {questions.map((question, index) => (
                    <Card key={question.id} className="border-green-200 bg-green-50">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Pergunta {index + 1} - Salva
                              </span>
                            </div>
                            <p className="font-medium text-slate-900 mb-2">
                              {question.questionText}
                            </p>
                            <p className="text-sm text-slate-600">
                              <strong>Resposta ideal:</strong> {question.idealAnswer}
                            </p>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => editQuestion(question)}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <Edit3 className="w-4 h-4" />
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => removeQuestion(question.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
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

              <Separator />

              {/* Botões de Ação */}
              <div className="flex gap-3">
                <Button
                  onClick={finalizeJob}
                  disabled={updateJobMutation.isPending || questions.length === 0}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {updateJobMutation.isPending ? "Criando..." : "Criar Vaga"}
                </Button>
                <Button type="button" variant="outline" onClick={cancelJob}>
                  Cancelar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vagas em Rascunho */}
      {draftJobs.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-900">Vagas em Rascunho</CardTitle>
            <p className="text-orange-700 text-sm">Vagas não finalizadas que podem ser continuadas</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {draftJobs.map((job) => (
                <Card key={job.id} className="border-orange-200 bg-white">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            Em Rascunho
                          </span>
                        </div>
                        <h3 className="font-semibold text-slate-900 mb-2">
                          {job.title || "Nova Vaga (não finalizada)"}
                        </h3>
                        <p className="text-slate-600 text-sm mb-2">
                          {job.description || "Vaga em processo de criação"}
                        </p>
                        <div className="text-xs text-slate-500">
                          Criada em: {job.createdAt ? new Date(job.createdAt).toLocaleDateString('pt-BR') : 'N/A'}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setCurrentJob(job);
                            jobForm.reset({
                              title: job.title || "",
                              description: job.description || "",
                              requirements: job.requirements || "",
                              benefits: job.benefits || "",
                              location: job.location || "",
                              workType: job.workType || "",
                              salaryRange: job.salaryRange || "",
                              experienceLevel: job.experienceLevel || "",
                              department: job.department || "",
                              contractType: job.contractType || "",
                              clientId: job.clientId,
                              status: "not_finished",
                            });
                            loadJobQuestions(job.id);
                          }}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Edit3 className="w-4 h-4 mr-1" />
                          Continuar Editando
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteJobMutation.mutate(job.id)}
                          className="text-red-600 hover:text-red-700"
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

      {/* Busca de Vagas Ativas */}
      <Card>
        <CardHeader>
          <CardTitle>Vagas Ativas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <Search className="w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar vagas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>

          {activeJobs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-500">Nenhuma vaga ativa encontrada.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeJobs.map((job) => (
                <Card key={job.id} className="border-slate-200">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Ativa
                          </span>
                        </div>
                        <h3 className="font-semibold text-slate-900 mb-2">{job.title}</h3>
                        <p className="text-slate-600 text-sm mb-2">{job.description}</p>
                        {job.location && (
                          <p className="text-slate-500 text-xs mb-1">📍 {job.location}</p>
                        )}
                        {job.salaryRange && (
                          <p className="text-slate-500 text-xs mb-1">💰 {job.salaryRange}</p>
                        )}
                        <div className="text-xs text-slate-500">
                          Criada em: {job.createdAt ? new Date(job.createdAt).toLocaleDateString('pt-BR') : 'N/A'}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button size="sm" variant="outline">
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteJobMutation.mutate(job.id)}
                          className="text-red-600 hover:text-red-700"
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
    </div>
  );
}