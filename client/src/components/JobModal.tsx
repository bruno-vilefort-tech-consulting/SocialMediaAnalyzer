import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Plus, Save, Edit, Trash2, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { Job, InsertJob, Question, InsertQuestion } from "@shared/schema";

// Schema de validação para vaga
const jobFormSchema = z.object({
  title: z.string().min(1, "Nome da vaga é obrigatório").max(100, "Nome da vaga deve ter no máximo 100 caracteres"),
  description: z.string().min(1, "Descrição da vaga é obrigatória").max(1000, "Descrição deve ter no máximo 1000 caracteres"),
});

// Schema de validação para pergunta
const questionFormSchema = z.object({
  questionText: z.string().min(1, "Pergunta é obrigatória").max(100, "Pergunta deve ter no máximo 100 caracteres"),
  idealAnswer: z.string().min(1, "Resposta perfeita é obrigatória").max(1000, "Resposta deve ter no máximo 1000 caracteres"),
});

type JobFormData = z.infer<typeof jobFormSchema>;
type QuestionFormData = z.infer<typeof questionFormSchema>;

interface JobModalProps {
  isOpen: boolean;
  onClose: () => void;
  job?: Job | null;
}

interface QuestionForm {
  id?: number;
  questionText: string;
  idealAnswer: string;
  order: number;
  isEditing?: boolean;
  isNew?: boolean;
}

export default function JobModal({ isOpen, onClose, job }: JobModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [questions, setQuestions] = useState<QuestionForm[]>([]);
  const [showNewQuestion, setShowNewQuestion] = useState(false);
  const [newQuestion, setNewQuestion] = useState<QuestionFormData>({
    questionText: "",
    idealAnswer: ""
  });
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);

  const form = useForm<JobFormData>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      title: "",
      description: "",
    },
  });

  const questionForm = useForm<QuestionFormData>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: {
      questionText: "",
      idealAnswer: ""
    },
  });

  // Reset form quando modal abre/fecha ou quando job muda
  useEffect(() => {
    if (isOpen) {
      if (job) {
        form.reset({
          title: job.title,
          description: job.description,
        });
        // Carregar perguntas existentes se estiver editando
        loadExistingQuestions(job.id);
      } else {
        form.reset({
          title: "",
          description: "",
        });
        setQuestions([]);
      }
      setShowNewQuestion(false);
      setEditingQuestionIndex(null);
    }
  }, [isOpen, job, form]);

  const loadExistingQuestions = async (jobId: number) => {
    try {
      const response = await fetch(`/api/questions?jobId=${jobId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
      });
      if (response.ok) {
        const existingQuestions = await response.json();
        setQuestions(existingQuestions.map((q: Question, index: number) => ({
          id: q.id,
          questionText: q.questionText,
          idealAnswer: q.idealAnswer,
          order: q.order || index + 1,
          isEditing: false,
          isNew: false,
        })));
      }
    } catch (error) {
      console.error("Erro ao carregar perguntas:", error);
    }
  };

  // Mutation para criar vaga
  const createJobMutation = useMutation({
    mutationFn: (jobData: InsertJob) => apiRequest("POST", "/api/jobs", jobData),
    onSuccess: async (response) => {
      const createdJob = await response.json();
      
      // Salvar perguntas se existirem
      if (questions.length > 0) {
        await saveQuestionsForJob(createdJob.id);
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Sucesso!",
        description: "Vaga cadastrada com sucesso",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao cadastrar vaga",
        variant: "destructive",
      });
    },
  });

  // Mutation para atualizar vaga
  const updateJobMutation = useMutation({
    mutationFn: (jobData: Partial<Job>) => 
      apiRequest("PUT", `/api/jobs/${job!.id}`, jobData),
    onSuccess: async () => {
      // Salvar perguntas atualizadas
      if (questions.length > 0) {
        await saveQuestionsForJob(job!.id);
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Sucesso!",
        description: "Vaga atualizada com sucesso",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar vaga",
        variant: "destructive",
      });
    },
  });

  const saveQuestionsForJob = async (jobId: number) => {
    for (const question of questions) {
      const questionData: InsertQuestion = {
        jobId,
        questionText: question.questionText,
        idealAnswer: question.idealAnswer,
        maxTime: 180, // 3 minutos padrão
        order: question.order,
      };

      if (question.id && !question.isNew) {
        // Atualizar pergunta existente
        await apiRequest("PUT", `/api/questions/${question.id}`, questionData);
      } else {
        // Criar nova pergunta
        await apiRequest("POST", "/api/questions", questionData);
      }
    }
  };

  const onSubmit = (data: JobFormData) => {
    const jobData: InsertJob = {
      ...data,
      clientId: user?.clientId || user?.id || 0,
    };

    if (job) {
      updateJobMutation.mutate(jobData);
    } else {
      createJobMutation.mutate(jobData);
    }
  };

  const handleAddQuestion = () => {
    if (questions.length >= 10) {
      toast({
        title: "Limite atingido",
        description: "Não é possível adicionar mais de 10 perguntas",
        variant: "destructive",
      });
      return;
    }
    setShowNewQuestion(true);
    questionForm.reset();
  };

  const handleSaveNewQuestion = (data: QuestionFormData) => {
    const newQuestionForm: QuestionForm = {
      questionText: data.questionText,
      idealAnswer: data.idealAnswer,
      order: questions.length + 1,
      isNew: true,
    };

    setQuestions([...questions, newQuestionForm]);
    setShowNewQuestion(false);
    questionForm.reset();
    
    toast({
      title: "Pergunta adicionada",
      description: "Pergunta salva com sucesso",
    });
  };

  const handleEditQuestion = (index: number) => {
    setEditingQuestionIndex(index);
    const question = questions[index];
    questionForm.reset({
      questionText: question.questionText,
      idealAnswer: question.idealAnswer,
    });
  };

  const handleSaveEditQuestion = (data: QuestionFormData) => {
    if (editingQuestionIndex !== null) {
      const updatedQuestions = [...questions];
      updatedQuestions[editingQuestionIndex] = {
        ...updatedQuestions[editingQuestionIndex],
        questionText: data.questionText,
        idealAnswer: data.idealAnswer,
      };
      setQuestions(updatedQuestions);
      setEditingQuestionIndex(null);
      questionForm.reset();

      toast({
        title: "Pergunta atualizada",
        description: "Pergunta editada com sucesso",
      });
    }
  };

  const handleRemoveQuestion = (index: number) => {
    const updatedQuestions = questions.filter((_, i) => i !== index);
    // Reordenar perguntas
    const reorderedQuestions = updatedQuestions.map((q, i) => ({
      ...q,
      order: i + 1,
    }));
    setQuestions(reorderedQuestions);

    toast({
      title: "Pergunta removida",
      description: "Pergunta removida com sucesso",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {job ? "Editar Vaga" : "Cadastrar Nova Vaga"}
          </DialogTitle>
          <DialogDescription>
            {job ? "Atualize as informações da vaga" : "Preencha as informações para criar uma nova vaga"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Informações da Vaga */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informações da Vaga</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Vaga *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ex: Desenvolvedor Frontend"
                          maxLength={100}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição da Vaga *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Descreva a vaga para uso interno..."
                          maxLength={1000}
                          rows={4}
                          className="resize-none"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Perguntas da Entrevista */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  Perguntas da Entrevista
                  <Badge variant="outline">
                    {questions.length}/10 perguntas
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Lista de perguntas existentes */}
                {questions.map((question, index) => (
                  <Card key={index} className="border-l-4 border-l-primary">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="font-medium text-slate-900">
                          Pergunta {question.order}
                        </h4>
                        <div className="flex space-x-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditQuestion(index)}
                            disabled={editingQuestionIndex === index}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveQuestion(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {editingQuestionIndex === index ? (
                        <Form {...questionForm}>
                          <form onSubmit={questionForm.handleSubmit(handleSaveEditQuestion)} className="space-y-3">
                            <FormField
                              control={questionForm.control}
                              name="questionText"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Pergunta ao candidato</FormLabel>
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
                                  <FormLabel>Resposta Perfeita</FormLabel>
                                  <FormControl>
                                    <Textarea 
                                      placeholder="Escreva uma resposta perfeita para a pergunta acima..."
                                      maxLength={1000}
                                      rows={3}
                                      className="resize-none max-h-20 overflow-y-auto"
                                      {...field} 
                                    />
                                  </FormControl>
                                  <p className="text-xs text-slate-600">
                                    Esta resposta será utilizada para classificar os melhores candidatos
                                  </p>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <div className="flex space-x-2">
                              <Button type="submit" size="sm">
                                <Save className="h-4 w-4 mr-1" />
                                Salvar
                              </Button>
                              <Button 
                                type="button" 
                                variant="outline" 
                                size="sm"
                                onClick={() => setEditingQuestionIndex(null)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </form>
                        </Form>
                      ) : (
                        <div className="space-y-2">
                          <div>
                            <p className="text-sm font-medium text-slate-700">Pergunta:</p>
                            <p className="text-sm text-slate-900">{question.questionText}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-700">Resposta Perfeita:</p>
                            <div className="max-h-20 overflow-y-auto bg-slate-50 p-2 rounded text-sm text-slate-900">
                              {question.idealAnswer}
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {/* Formulário para nova pergunta */}
                {showNewQuestion && (
                  <Card className="border-dashed">
                    <CardContent className="p-4">
                      <h4 className="font-medium text-slate-900 mb-3">
                        Nova Pergunta {questions.length + 1}
                      </h4>

                      <Form {...questionForm}>
                        <form onSubmit={questionForm.handleSubmit(handleSaveNewQuestion)} className="space-y-3">
                          <FormField
                            control={questionForm.control}
                            name="questionText"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Pergunta ao candidato</FormLabel>
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
                                <FormLabel>Resposta Perfeita</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    placeholder="Escreva uma resposta perfeita para a pergunta acima..."
                                    maxLength={1000}
                                    rows={3}
                                    className="resize-none max-h-20 overflow-y-auto"
                                    {...field} 
                                  />
                                </FormControl>
                                <p className="text-xs text-slate-600">
                                  Esta resposta será utilizada para classificar os melhores candidatos
                                </p>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="flex space-x-2">
                            <Button type="submit" size="sm">
                              <Save className="h-4 w-4 mr-1" />
                              Salvar Pergunta {questions.length + 1}
                            </Button>
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="sm"
                              onClick={() => setShowNewQuestion(false)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </CardContent>
                  </Card>
                )}

                {/* Botão para adicionar pergunta */}
                {!showNewQuestion && questions.length < 10 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddQuestion}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Acrescentar Perguntas da Entrevista
                  </Button>
                )}

                {questions.length >= 10 && (
                  <div className="flex items-center space-x-2 text-amber-600 bg-amber-50 p-3 rounded-lg">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">
                      Limite máximo de 10 perguntas atingido
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Botões */}
            <div className="flex justify-end space-x-4 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={createJobMutation.isPending || updateJobMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createJobMutation.isPending || updateJobMutation.isPending}
              >
                {createJobMutation.isPending || updateJobMutation.isPending ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Salvando...</span>
                  </div>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {job ? "Atualizar Vaga" : "Cadastrar Vaga"}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}