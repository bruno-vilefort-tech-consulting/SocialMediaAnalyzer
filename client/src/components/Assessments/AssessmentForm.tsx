import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Send, Clock, Users, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import CandidateSearchModal from "./CandidateSearchModal";

interface AssessmentFormData {
  assessmentType: string;
  candidateSelection: "list" | "search";
  selectedList?: number;
  selectedCandidates?: any[];
  emailSubject: string;
  emailMessage: string;
  sendTiming: "now" | "schedule";
  scheduleDate?: Date;
  scheduleTime?: string;
}

const ASSESSMENT_TYPES = [
  {
    id: "Player MX",
    name: "Player MX",
    color: "bg-blue-500 hover:bg-blue-600",
    description: "Avaliação de performance e jogabilidade"
  },
  {
    id: "Vision MX",
    name: "Vision MX", 
    color: "bg-green-500 hover:bg-green-600",
    description: "Análise de visão estratégica"
  },
  {
    id: "Energy MX",
    name: "Energy MX",
    color: "bg-yellow-500 hover:bg-yellow-600",
    description: "Medição de energia e motivação"
  },
  {
    id: "Personality MX",
    name: "Personality MX",
    color: "bg-purple-500 hover:bg-purple-600", 
    description: "Perfil de personalidade profissional"
  },
  {
    id: "Power MX",
    name: "Power MX",
    color: "bg-red-500 hover:bg-red-600",
    description: "Avaliação de poder e liderança"
  }
];

const DEFAULT_EMAIL_TEMPLATE = `Olá [nome do candidato],

Esperamos que esteja bem!

Gostaríamos de convidá-lo(a) para participar de uma avaliação profissional que faz parte do nosso processo seletivo.

Esta avaliação nos ajudará a conhecer melhor seu perfil e competências.

Por favor, clique no link abaixo para iniciar:

Atenciosamente,
Ana Luíza
Gestora de RH - MaxcamRH`;

export default function AssessmentForm() {
  const [formData, setFormData] = useState<AssessmentFormData>({
    assessmentType: "",
    candidateSelection: "list",
    emailSubject: "Olá [nome do candidato] faça seus Assessments MaxcamRH",
    emailMessage: DEFAULT_EMAIL_TEMPLATE,
    sendTiming: "now"
  });

  const [showCandidateSearch, setShowCandidateSearch] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sendAssessmentMutation = useMutation({
    mutationFn: async (data: AssessmentFormData) => {
      const payload = {
        assessmentType: data.assessmentType,
        candidates: data.candidateSelection === "list" 
          ? { type: "list", listId: data.selectedList }
          : { type: "search", selectedCandidates: data.selectedCandidates },
        emailSubject: data.emailSubject,
        emailMessage: data.emailMessage,
        sendNow: data.sendTiming === "now",
        scheduleDate: data.scheduleDate,
        scheduleTime: data.scheduleTime
      };

      return apiRequest("/api/send-assessment-email", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    },
    onSuccess: (response) => {
      toast({
        title: "✅ Emails enviados com sucesso!",
        description: response.message || "Assessments enviados para os candidatos selecionados"
      });
      
      // Reset form
      setFormData({
        assessmentType: "",
        candidateSelection: "list",
        emailSubject: "Olá [nome do candidato] faça seus Assessments MaxcamRH",
        emailMessage: DEFAULT_EMAIL_TEMPLATE,
        sendTiming: "now"
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Erro ao enviar emails",
        description: error.message || "Erro interno do servidor",
        variant: "destructive"
      });
    }
  });

  const isFormValid = () => {
    if (!formData.assessmentType) return false;
    if (!formData.emailSubject.trim()) return false;
    if (!formData.emailMessage.trim()) return false;
    
    if (formData.candidateSelection === "list" && !formData.selectedList) return false;
    if (formData.candidateSelection === "search" && (!formData.selectedCandidates || formData.selectedCandidates.length === 0)) return false;
    
    if (formData.sendTiming === "schedule") {
      if (!formData.scheduleDate || !formData.scheduleTime) return false;
    }
    
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) {
      toast({
        title: "❌ Formulário incompleto",
        description: "Por favor, preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    sendAssessmentMutation.mutate(formData);
  };

  const handleCandidatesSelected = (candidates: any[]) => {
    setFormData(prev => ({
      ...prev,
      selectedCandidates: candidates
    }));
    setShowCandidateSearch(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-blue-600" />
            Envio de Assessments
          </CardTitle>
          <CardDescription>
            Configure e envie assessments profissionais para candidatos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Assessment Type Selection */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Tipo de Assessment *</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {ASSESSMENT_TYPES.map((assessment) => (
                  <Card 
                    key={assessment.id}
                    className={cn(
                      "cursor-pointer transition-all duration-200 border-2",
                      formData.assessmentType === assessment.id
                        ? "border-blue-500 bg-blue-50 shadow-md"
                        : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                    )}
                    onClick={() => setFormData(prev => ({ ...prev, assessmentType: assessment.id }))}
                  >
                    <CardContent className="p-4 text-center">
                      <div className={cn("w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center text-white", assessment.color)}>
                        <Send className="h-6 w-6" />
                      </div>
                      <h3 className="font-medium text-sm">{assessment.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{assessment.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Candidate Selection */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Seleção de Candidatos *</Label>
              <RadioGroup
                value={formData.candidateSelection}
                onValueChange={(value: "list" | "search") => 
                  setFormData(prev => ({ ...prev, candidateSelection: value }))
                }
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="list" id="list" />
                  <Label htmlFor="list" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Lista
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="search" id="search" />
                  <Label htmlFor="search" className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Buscar Candidato
                  </Label>
                </div>
              </RadioGroup>

              {formData.candidateSelection === "search" && (
                <div className="mt-3">
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={() => setShowCandidateSearch(true)}
                    className="w-full"
                  >
                    <Search className="h-4 w-4 mr-2" />
                    {formData.selectedCandidates && formData.selectedCandidates.length > 0
                      ? `${formData.selectedCandidates.length} candidato(s) selecionado(s)`
                      : "Selecionar Candidatos"
                    }
                  </Button>
                </div>
              )}
            </div>

            {/* Email Configuration */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Configuração do Email</Label>
              
              <div className="space-y-2">
                <Label htmlFor="emailSubject">Assunto E-mail *</Label>
                <Input
                  id="emailSubject"
                  value={formData.emailSubject}
                  onChange={(e) => setFormData(prev => ({ ...prev, emailSubject: e.target.value }))}
                  placeholder="Assunto do email..."
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emailMessage">Mensagem *</Label>
                <Textarea
                  id="emailMessage"
                  value={formData.emailMessage}
                  onChange={(e) => setFormData(prev => ({ ...prev, emailMessage: e.target.value }))}
                  placeholder="Mensagem do email..."
                  className="min-h-[150px]"
                />
                <p className="text-xs text-muted-foreground">
                  Use [nome do candidato] e [clienteid] como placeholders que serão substituídos automaticamente
                </p>
              </div>
            </div>

            {/* Send Timing */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Quando Enviar</Label>
              <RadioGroup
                value={formData.sendTiming}
                onValueChange={(value: "now" | "schedule") => 
                  setFormData(prev => ({ ...prev, sendTiming: value }))
                }
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="now" id="now" />
                  <Label htmlFor="now" className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Enviar Agora
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="schedule" id="schedule" />
                  <Label htmlFor="schedule" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Agendar
                  </Label>
                </div>
              </RadioGroup>

              {formData.sendTiming === "schedule" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.scheduleDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.scheduleDate ? (
                            format(formData.scheduleDate, "dd/MM/yyyy", { locale: ptBR })
                          ) : (
                            "Selecionar data"
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.scheduleDate}
                          onSelect={(date) => setFormData(prev => ({ ...prev, scheduleDate: date }))}
                          initialFocus
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scheduleTime">Horário</Label>
                    <Input
                      id="scheduleTime"
                      type="time"
                      value={formData.scheduleTime || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, scheduleTime: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <Button
                type="submit"
                disabled={!isFormValid() || sendAssessmentMutation.isPending}
                className="w-full"
                size="lg"
              >
                {sendAssessmentMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    {formData.sendTiming === "now" ? "Enviar Agora" : "Agendar Envio"}
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Candidate Search Modal */}
      {showCandidateSearch && (
        <CandidateSearchModal
          onClose={() => setShowCandidateSearch(false)}
          onCandidatesSelected={handleCandidatesSelected}
          selectedCandidates={formData.selectedCandidates || []}
        />
      )}
    </div>
  );
}