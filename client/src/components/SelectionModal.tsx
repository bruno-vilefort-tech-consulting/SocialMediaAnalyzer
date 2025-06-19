import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar, MapPin, Send, MessageCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Selection, InsertSelection, Job, Candidate } from "@shared/schema";

interface SelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selection?: Selection | null;
}

export default function SelectionModal({ isOpen, onClose, selection }: SelectionModalProps) {
  const [name, setName] = useState("");
  const [jobId, setJobId] = useState<number | null>(null);
  const [selectedCandidates, setSelectedCandidates] = useState<number[]>([]);
  const [sendVia, setSendVia] = useState<"whatsapp">("whatsapp");
  const [whatsappTemplate, setWhatsappTemplate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
    enabled: isOpen,
  });

  const { data: candidates = [] } = useQuery<Candidate[]>({
    queryKey: ["/api/candidates"],
    enabled: isOpen,
  });

  useEffect(() => {
    if (selection) {
      setName(selection.name);
      setJobId(selection.jobId);
      setSendVia("whatsapp");
      setWhatsappTemplate(selection.whatsappTemplate);
      setDeadline(new Date(selection.deadline).toISOString().slice(0, 16));
      setScheduledFor(selection.scheduledFor ? new Date(selection.scheduledFor).toISOString().slice(0, 16) : "");
    } else {
      // Reset form
      setName("");
      setJobId(null);
      setSelectedCandidates([]);
      setSendVia("whatsapp");
      setDeadline("");
      setScheduledFor("");
      
      // Set default WhatsApp template
      setWhatsappTemplate(
        "Olá {{nome}}, você foi convidado pela {{empresa}} para participar de uma entrevista para a vaga {{vaga}}. " +
        "Clique no link para iniciar: {{link_entrevista}} " +
        "Data limite: {{data_limite}}."
      );
    }
  }, [selection, isOpen]);

  const createSelectionMutation = useMutation({
    mutationFn: (selectionData: InsertSelection) => 
      apiRequest("POST", "/api/selections", selectionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/selections"] });
      toast({
        title: "Seleção criada",
        description: "Seleção foi criada com sucesso",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao criar seleção",
        variant: "destructive",
      });
    },
  });

  const updateSelectionMutation = useMutation({
    mutationFn: ({ id, selectionData }: { id: number; selectionData: Partial<Selection> }) =>
      apiRequest("PUT", `/api/selections/${id}`, selectionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/selections"] });
      toast({
        title: "Seleção atualizada",
        description: "Seleção foi atualizada com sucesso",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar seleção",
        variant: "destructive",
      });
    },
  });

  const handleCandidateToggle = (candidateId: number) => {
    setSelectedCandidates(prev => 
      prev.includes(candidateId)
        ? prev.filter(id => id !== candidateId)
        : [...prev, candidateId]
    );
  };

  const handleSelectAllCandidates = () => {
    if (selectedCandidates.length === candidates.length) {
      setSelectedCandidates([]);
    } else {
      setSelectedCandidates(candidates.map(c => c.id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !jobId || !deadline) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome, vaga e prazo da seleção",
        variant: "destructive",
      });
      return;
    }

    if (selectedCandidates.length === 0) {
      toast({
        title: "Candidatos necessários",
        description: "Selecione pelo menos um candidato",
        variant: "destructive",
      });
      return;
    }

    if (!whatsappTemplate.trim()) {
      toast({
        title: "Template WhatsApp",
        description: "Preencha o template do WhatsApp",
        variant: "destructive",
      });
      return;
    }

    const selectionData = {
      name: name.trim(),
      jobId: jobId,
      whatsappTemplate: whatsappTemplate.trim(),
      emailTemplate: "",
      emailSubject: "",
      sendVia,
      deadline: new Date(deadline).toISOString(),
      scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : null,
    };

    if (selection) {
      updateSelectionMutation.mutate({ id: selection.id, selectionData });
    } else {
      createSelectionMutation.mutate(selectionData);
    }
  };

  const selectedJob = jobs.find(job => job.id === jobId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {selection ? "Editar Seleção" : "Nova Seleção"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="name">Nome da Seleção</Label>
              <Input
                id="name"
                placeholder="Ex: Seleção Desenvolvedores Q1 2024"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="job">Vaga</Label>
              <select 
                id="job"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                value={jobId || ""}
                onChange={(e) => setJobId(parseInt(e.target.value) || null)}
                required
              >
                <option value="">Selecione uma vaga</option>
                {jobs.map(job => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Timing */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="deadline">Prazo Limite</Label>
              <Input
                id="deadline"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="scheduled">Agendar Envio (Opcional)</Label>
              <Input
                id="scheduled"
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
              />
            </div>
          </div>

          {/* Send Via Options - Fixed to WhatsApp only */}
          <div>
            <Label>Canal de Envio</Label>
            <div className="flex space-x-4 mt-2">
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="sendVia"
                  value="whatsapp"
                  checked={true}
                  readOnly
                />
                <MessageCircle className="h-4 w-4" />
                <span>WhatsApp</span>
              </label>
            </div>
          </div>

          {/* WhatsApp Template */}
          <div>
            <Label htmlFor="whatsapp-template">Template WhatsApp</Label>
            <Textarea
              id="whatsapp-template"
              rows={4}
              placeholder="Olá {{nome}}, você foi convidado..."
              value={whatsappTemplate}
              onChange={(e) => setWhatsappTemplate(e.target.value)}
              required
            />
            <div className="text-xs text-slate-500 mt-1">
              Variáveis disponíveis: {{nome}}, {{empresa}}, {{vaga}}, {{link_entrevista}}, {{data_limite}}
            </div>
          </div>

          {/* Candidate Selection */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <Label>Candidatos ({selectedCandidates.length} selecionados)</Label>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={handleSelectAllCandidates}
              >
                {selectedCandidates.length === candidates.length ? "Desmarcar Todos" : "Selecionar Todos"}
              </Button>
            </div>
            
            <div className="max-h-48 overflow-y-auto border rounded-lg p-4 space-y-2">
              {candidates.length === 0 ? (
                <div className="text-center py-4 text-slate-500">
                  Nenhum candidato cadastrado
                </div>
              ) : (
                candidates.map(candidate => (
                  <div key={candidate.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`candidate-${candidate.id}`}
                      checked={selectedCandidates.includes(candidate.id)}
                      onCheckedChange={() => handleCandidateToggle(candidate.id)}
                    />
                    <label 
                      htmlFor={`candidate-${candidate.id}`}
                      className="flex-1 text-sm cursor-pointer"
                    >
                      <span className="font-medium">{candidate.name}</span>
                      <span className="text-slate-500 ml-2">{candidate.email}</span>
                    </label>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Summary */}
          {selectedJob && selectedCandidates.length > 0 && (
            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="font-medium text-slate-900 mb-2">Resumo da Seleção</h4>
              <div className="text-sm text-slate-600 space-y-1">
                <div>Vaga: {selectedJob.title}</div>
                <div>Candidatos: {selectedCandidates.length}</div>
                <div>Canal: WhatsApp</div>
                <div>Prazo: {deadline ? new Date(deadline).toLocaleString('pt-BR') : "Não definido"}</div>
                {scheduledFor && (
                  <div>Envio agendado: {new Date(scheduledFor).toLocaleString('pt-BR')}</div>
                )}
              </div>
            </div>
          )}
          
          <div className="flex justify-end space-x-3 pt-6 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={createSelectionMutation.isPending || updateSelectionMutation.isPending}
            >
              {selection ? "Atualizar" : "Criar"} Seleção
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
