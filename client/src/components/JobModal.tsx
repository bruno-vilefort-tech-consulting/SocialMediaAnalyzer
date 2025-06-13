import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Job, Question, InsertJob, InsertQuestion } from "@shared/schema";

interface JobModalProps {
  isOpen: boolean;
  onClose: () => void;
  job?: Job | null;
}

interface QuestionForm {
  id?: number;
  questionText: string;
  idealAnswer: string;
  maxTime: number;
  order: number;
}

export default function JobModal({ isOpen, onClose, job }: JobModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<QuestionForm[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load existing questions if editing
  const { data: existingQuestions } = useQuery({
    queryKey: ["/api/jobs", job?.id, "questions"],
    enabled: !!job?.id,
  });

  useEffect(() => {
    if (job) {
      setTitle(job.title);
      setDescription(job.description);
    } else {
      setTitle("");
      setDescription("");
      setQuestions([]);
    }
  }, [job]);

  useEffect(() => {
    if (existingQuestions) {
      setQuestions(existingQuestions.map((q: Question) => ({
        id: q.id,
        questionText: q.questionText,
        idealAnswer: q.idealAnswer,
        maxTime: q.maxTime,
        order: q.order,
      })));
    }
  }, [existingQuestions]);

  const createJobMutation = useMutation({
    mutationFn: (jobData: InsertJob) => apiRequest("POST", "/api/jobs", jobData),
    onSuccess: async (response) => {
      const newJob = await response.json();
      await saveQuestions(newJob.id);
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Vaga criada",
        description: "Vaga foi criada com sucesso",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao criar vaga",
        variant: "destructive",
      });
    },
  });

  const updateJobMutation = useMutation({
    mutationFn: ({ id, jobData }: { id: number; jobData: Partial<Job> }) =>
      apiRequest("PUT", `/api/jobs/${id}`, jobData),
    onSuccess: async () => {
      if (job?.id) {
        await saveQuestions(job.id);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Vaga atualizada",
        description: "Vaga foi atualizada com sucesso",
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

  const saveQuestions = async (jobId: number) => {
    // Delete existing questions and create new ones
    // In a real implementation, you'd want to be more sophisticated about this
    for (const question of questions) {
      if (question.id) {
        await apiRequest("DELETE", `/api/questions/${question.id}`);
      }
    }

    for (const question of questions) {
      const questionData: InsertQuestion = {
        jobId,
        questionText: question.questionText,
        idealAnswer: question.idealAnswer,
        maxTime: question.maxTime,
        order: question.order,
      };
      await apiRequest("POST", `/api/jobs/${jobId}/questions`, questionData);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !description.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o título e descrição da vaga",
        variant: "destructive",
      });
      return;
    }

    if (questions.length === 0) {
      toast({
        title: "Perguntas necessárias",
        description: "Adicione pelo menos uma pergunta para a entrevista",
        variant: "destructive",
      });
      return;
    }

    const jobData = {
      title: title.trim(),
      description: description.trim(),
      status: "active" as const,
    };

    if (job) {
      updateJobMutation.mutate({ id: job.id, jobData });
    } else {
      createJobMutation.mutate(jobData);
    }
  };

  const addQuestion = () => {
    if (questions.length >= 10) {
      toast({
        title: "Limite atingido",
        description: "Máximo de 10 perguntas por vaga",
        variant: "destructive",
      });
      return;
    }

    setQuestions(prev => [
      ...prev,
      {
        questionText: "",
        idealAnswer: "",
        maxTime: 180, // 3 minutes default
        order: prev.length + 1,
      }
    ]);
  };

  const removeQuestion = (index: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, field: keyof QuestionForm, value: string | number) => {
    setQuestions(prev => prev.map((q, i) => 
      i === index ? { ...q, [field]: value } : q
    ));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {job ? "Editar Vaga" : "Nova Vaga"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="title">Nome da Vaga</Label>
              <Input
                id="title"
                placeholder="Ex: Desenvolvedor Frontend"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                required
              />
              <div className="text-xs text-slate-500 mt-1">
                {title.length}/100 caracteres
              </div>
            </div>
            
            <div>
              <Label htmlFor="status">Status</Label>
              <select 
                id="status"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                defaultValue="active"
              >
                <option value="active">Ativa</option>
                <option value="inactive">Inativa</option>
              </select>
            </div>
          </div>
          
          <div>
            <Label htmlFor="description">Descrição Interna</Label>
            <Textarea
              id="description"
              rows={4}
              placeholder="Descrição detalhada da vaga para uso interno..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              required
            />
            <div className="text-xs text-slate-500 mt-1">
              {description.length}/500 caracteres
            </div>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-4">
              <Label>Perguntas da Entrevista</Label>
              <Button 
                type="button" 
                variant="outline"
                onClick={addQuestion}
                disabled={questions.length >= 10}
              >
                <Plus className="mr-1 h-4 w-4" />
                Adicionar Pergunta
              </Button>
            </div>
            
            <div className="space-y-4">
              {questions.map((question, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center">
                        <GripVertical className="h-4 w-4 text-slate-400 mr-2" />
                        <span className="text-sm font-medium text-slate-700">
                          Pergunta {index + 1}
                        </span>
                      </div>
                      <Button 
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeQuestion(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-slate-500">
                          Texto da Pergunta (até 200 caracteres)
                        </Label>
                        <Textarea
                          rows={2}
                          placeholder="Ex: Conte sobre sua experiência com React.js..."
                          value={question.questionText}
                          onChange={(e) => updateQuestion(index, "questionText", e.target.value)}
                          maxLength={200}
                          required
                        />
                        <div className="text-xs text-slate-500">
                          {question.questionText.length}/200 caracteres
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-xs text-slate-500">
                          Resposta Ideal (até 1000 caracteres)
                        </Label>
                        <Textarea
                          rows={3}
                          placeholder="Critérios para análise da resposta..."
                          value={question.idealAnswer}
                          onChange={(e) => updateQuestion(index, "idealAnswer", e.target.value)}
                          maxLength={1000}
                          required
                        />
                        <div className="text-xs text-slate-500">
                          {question.idealAnswer.length}/1000 caracteres
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-slate-500">
                            Tempo Máximo (segundos)
                          </Label>
                          <Input
                            type="number"
                            min="30"
                            max="600"
                            value={question.maxTime}
                            onChange={(e) => updateQuestion(index, "maxTime", parseInt(e.target.value) || 180)}
                            required
                          />
                        </div>
                        <div className="flex items-end">
                          <div className="text-xs text-slate-500">
                            = {Math.floor(question.maxTime / 60)}:{(question.maxTime % 60).toString().padStart(2, '0')} min
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {questions.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
                  <p className="text-slate-500 mb-4">Nenhuma pergunta adicionada ainda</p>
                  <Button type="button" variant="outline" onClick={addQuestion}>
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Primeira Pergunta
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 pt-6 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={createJobMutation.isPending || updateJobMutation.isPending}
            >
              {job ? "Atualizar Vaga" : "Criar Vaga"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
