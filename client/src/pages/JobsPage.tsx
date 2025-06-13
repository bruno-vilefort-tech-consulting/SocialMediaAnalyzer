import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Briefcase,
  MessageSquare,
  Calendar,
  Building,
  Save,
  X,
  Check
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { Job, Question as DBQuestion, InsertJob, InsertQuestion, Client } from "@shared/schema";

// Schemas de validação
const jobFormSchema = z.object({
  title: z.string().min(1, "Nome da vaga é obrigatório"),
  description: z.string().min(1, "Descrição é obrigatória"),
  clientId: z.number().optional(),
});

const questionFormSchema = z.object({
  questionText: z.string().min(1, "Pergunta é obrigatória").max(100, "Máximo 100 caracteres"),
  idealAnswer: z.string().min(1, "Resposta perfeita é obrigatória").max(1000, "Máximo 1000 caracteres"),
});

type JobFormData = z.infer<typeof jobFormSchema>;
type QuestionFormData = z.infer<typeof questionFormSchema>;

interface QuestionForm {
  id?: number;
  jobId?: number;
  questionText: string;
  idealAnswer: string;
  order: number;
}

export default function JobsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showNewJobForm, setShowNewJobForm] = useState(false);
  const [currentJob, setCurrentJob] = useState<Partial<Job> | null>(null);
  const [questions, setQuestions] = useState<QuestionForm[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Form para nova vaga
  const jobForm = useForm<JobFormData>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      title: "",
      description: "",
      clientId: user?.role === 'master' ? 0 : user?.clientId || 1,
    },
  });

  // Form para nova pergunta
  const questionForm = useForm<QuestionFormData>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: {
      questionText: "",
      idealAnswer: "",
    },
  });

  // Query para buscar vagas
  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  // Query para buscar clientes (apenas para usuários master)
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: user?.role === 'master',
  });

  // Mutation para criar vaga
  const createJobMutation = useMutation({
    mutationFn: (jobData: InsertJob) => apiRequest("POST", "/api/jobs", jobData),
    onSuccess: () => {
      toast({
        title: "Sucesso!",
        description: "Vaga criada com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      resetForm();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao criar vaga.",
        variant: "destructive",
      });
    },
  });

  // Mutation para criar pergunta
  const createQuestionMutation = useMutation({
    mutationFn: (questionData: InsertQuestion) => apiRequest("POST", "/api/questions", questionData),
    onSuccess: () => {
      toast({
        title: "Sucesso!",
        description: "Pergunta salva com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao salvar pergunta.",
        variant: "destructive",
      });
    },
  });

  // Mutation para atualizar pergunta
  const updateQuestionMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<QuestionForm> }) => 
      apiRequest("PATCH", `/api/questions/${id}`, data),
    onSuccess: () => {
      toast({
        title: "Sucesso!",
        description: "Pergunta atualizada com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar pergunta.",
        variant: "destructive",
      });
    },
  });

  // Mutation para deletar pergunta
  const deleteQuestionMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/questions/${id}`),
    onSuccess: () => {
      toast({
        title: "Sucesso!",
        description: "Pergunta removida com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao remover pergunta.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setShowNewJobForm(false);
    setCurrentJob(null);
    setQuestions([]);
    setEditingQuestion(null);
    jobForm.reset();
    questionForm.reset();
  };

  const startNewJob = () => {
    setShowNewJobForm(true);
    setCurrentJob({ title: "", description: "" });
    setQuestions([]);
  };

  const onSubmitJob = (data: JobFormData) => {
    if (questions.length === 0) {
      toast({
        title: "Atenção",
        description: "Adicione pelo menos uma pergunta antes de cadastrar a vaga.",
        variant: "destructive",
      });
      return;
    }

    // Para usuários master, usar o clientId selecionado; para clientes, usar o próprio clientId
    const finalClientId = user?.role === 'master' ? data.clientId : user?.clientId || 1;

    const jobData: InsertJob = {
      title: data.title,
      description: data.description,
      clientId: finalClientId,
    };

    createJobMutation.mutate(jobData);
  };

  const addQuestion = () => {
    if (questions.length >= 10) {
      toast({
        title: "Limite atingido",
        description: "Máximo de 10 perguntas por vaga.",
        variant: "destructive",
      });
      return;
    }

    const newOrder = questions.length + 1;
    setQuestions([...questions, {
      questionText: "",
      idealAnswer: "",
      order: newOrder
    }]);
  };

  const saveQuestion = async (index: number, data: QuestionFormData) => {
    const question = questions[index];
    
    if (question.id) {
      // Atualizar pergunta existente
      await updateQuestionMutation.mutateAsync({
        id: question.id,
        data: {
          questionText: data.questionText,
          idealAnswer: data.idealAnswer,
        }
      });
    } else {
      // Criar nova pergunta (precisa de jobId primeiro)
      if (!currentJob?.id) {
        toast({
          title: "Erro",
          description: "Crie a vaga primeiro antes de salvar perguntas.",
          variant: "destructive",
        });
        return;
      }

      const questionData: InsertQuestion = {
        jobId: currentJob.id,
        questionText: data.questionText,
        idealAnswer: data.idealAnswer,
        order: question.order,
      };

      const savedQuestion = await createQuestionMutation.mutateAsync(questionData);
      
      // Atualizar a pergunta local com o ID retornado
      const updatedQuestions = [...questions];
      updatedQuestions[index] = { ...question, id: (savedQuestion as any)?.id || Date.now() };
      setQuestions(updatedQuestions);
    }

    setEditingQuestion(null);
  };

  const deleteQuestion = (index: number) => {
    const question = questions[index];
    
    if (question.id) {
      deleteQuestionMutation.mutate(question.id);
    }
    
    const updatedQuestions = questions.filter((_, i) => i !== index);
    // Reordenar as perguntas
    const reorderedQuestions = updatedQuestions.map((q, i) => ({
      ...q,
      order: i + 1
    }));
    setQuestions(reorderedQuestions);
  };

  const filteredJobs = jobs.filter((job: Job) =>
    job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <p className="text-slate-600">Cadastre e gerencie vagas de emprego</p>
        </div>
        
        {!showNewJobForm && (
          <Button onClick={startNewJob} className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" />
            Nova Vaga
          </Button>
        )}
      </div>

      {/* Formulário de Nova Vaga */}
      {showNewJobForm && (
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-primary">Cadastrar Nova Vaga</CardTitle>
              <Button variant="ghost" size="sm" onClick={resetForm}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...jobForm}>
              <form onSubmit={jobForm.handleSubmit(onSubmitJob)} className="space-y-6">
                {/* Dados da Vaga */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Seleção de Cliente - apenas para usuários master */}
                  {user?.role === 'master' && (
                    <FormField
                      control={jobForm.control}
                      name="clientId"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Cliente</FormLabel>
                          <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString() || ""}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione um cliente para esta vaga" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {clients.map((client) => (
                                <SelectItem key={client.id} value={client.id.toString()}>
                                  {client.companyName} - {client.email}
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
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome da Vaga</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Desenvolvedor Full Stack" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div></div>
                  
                  <FormField
                    control={jobForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Descrição da Vaga</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Descreva as responsabilidades e requisitos da vaga..."
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* Perguntas da Entrevista */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Perguntas da Entrevista</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {questions.length}/10 perguntas
                      </Badge>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addQuestion}
                        disabled={questions.length >= 10}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Adicionar Pergunta
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {questions.map((question, index) => (
                      <Card key={index} className="border-slate-200">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">Pergunta {index + 1}</Badge>
                              {question.id && <Badge variant="outline" className="text-green-600">Salva</Badge>}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingQuestion(editingQuestion === index ? null : index)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteQuestion(index)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {editingQuestion === index ? (
                            <Form {...questionForm}>
                              <form
                                onSubmit={questionForm.handleSubmit((data) => saveQuestion(index, data))}
                                className="space-y-4"
                              >
                                <FormField
                                  control={questionForm.control}
                                  name="questionText"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Pergunta ao Candidato (máx. 100 caracteres)</FormLabel>
                                      <FormControl>
                                        <Input
                                          placeholder="Digite a pergunta..."
                                          maxLength={100}
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
                                      <FormLabel>Resposta Perfeita (máx. 1000 caracteres)</FormLabel>
                                      <FormControl>
                                        <Textarea
                                          placeholder="Descreva a resposta ideal para esta pergunta..."
                                          maxLength={1000}
                                          className="min-h-[80px]"
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                
                                <div className="flex gap-2">
                                  <Button type="submit" size="sm">
                                    <Save className="w-4 h-4 mr-1" />
                                    Salvar Pergunta
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditingQuestion(null)}
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              </form>
                            </Form>
                          ) : (
                            <div className="space-y-2">
                              <div>
                                <span className="text-sm font-medium text-slate-700">Pergunta:</span>
                                <p className="text-slate-900">{question.questionText || "Clique em editar para adicionar a pergunta"}</p>
                              </div>
                              <div>
                                <span className="text-sm font-medium text-slate-700">Resposta Perfeita:</span>
                                <p className="text-slate-600 text-sm">{question.idealAnswer || "Clique em editar para adicionar a resposta perfeita"}</p>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Botões de Ação */}
                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={createJobMutation.isPending || questions.length === 0}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {createJobMutation.isPending ? "Cadastrando..." : "Cadastrar Vaga"}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Lista de Vagas Existentes */}
      {!showNewJobForm && (
        <>
          {/* Busca */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Buscar vagas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Lista de Vagas */}
          <div className="grid gap-4">
            {filteredJobs.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <Briefcase className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 mb-2">
                      {searchTerm ? "Nenhuma vaga encontrada" : "Nenhuma vaga cadastrada"}
                    </h3>
                    <p className="text-slate-600 mb-6">
                      {searchTerm 
                        ? "Tente ajustar os termos de busca." 
                        : "Comece criando sua primeira vaga."
                      }
                    </p>
                    {!searchTerm && (
                      <Button onClick={startNewJob}>
                        <Plus className="w-4 h-4 mr-2" />
                        Criar Primeira Vaga
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              filteredJobs.map((job: Job) => (
                <Card key={job.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Briefcase className="w-5 h-5 text-primary" />
                          <h3 className="text-lg font-semibold text-slate-900">{job.title}</h3>
                        </div>
                        
                        <p className="text-slate-600 mb-4 line-clamp-2">{job.description}</p>
                        
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>Criada em {job.createdAt ? format(new Date(job.createdAt), "dd/MM/yyyy", { locale: ptBR }) : "Data não disponível"}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MessageSquare className="w-4 h-4" />
                            <span>Perguntas cadastradas</span>
                          </div>
                          {user?.role === 'master' && (
                            <div className="flex items-center gap-1">
                              <Building className="w-4 h-4" />
                              <span>Cliente #{job.clientId}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}