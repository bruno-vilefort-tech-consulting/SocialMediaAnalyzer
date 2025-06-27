import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { 
  Send, 
  Users, 
  Search,
  Calendar as CalendarIcon,
  Clock,
  CheckSquare,
  List
} from "lucide-react";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import CandidateSearchModal from "./CandidateSearchModal";

interface Candidate {
  id: number;
  name: string;
  email: string;
  phone: string;
}

interface CandidateList {
  id: number;
  name: string;
  description: string;
  candidateCount: number;
}

const assessmentTypes = [
  { id: "player_mx", name: "Player MX", color: "bg-blue-500 hover:bg-blue-600" },
  { id: "vision_mx", name: "Vision MX", color: "bg-green-500 hover:bg-green-600" },
  { id: "energy_mx", name: "Energy MX", color: "bg-yellow-500 hover:bg-yellow-600" },
  { id: "personality_mx", name: "Personality MX", color: "bg-purple-500 hover:bg-purple-600" },
  { id: "power_mx", name: "Power MX", color: "bg-red-500 hover:bg-red-600" }
];

export default function AssessmentForm() {
  const [selectionName, setSelectionName] = useState("");
  const [candidateSource, setCandidateSource] = useState(""); // "list" ou "search"
  const [selectedList, setSelectedList] = useState("");
  const [selectedCandidates, setSelectedCandidates] = useState<Candidate[]>([]);
  const [selectedAssessments, setSelectedAssessments] = useState<string[]>([]);
  const [emailSubject, setEmailSubject] = useState("Olá [nome do candidato] faça seus Assessments MaxcamRH");
  const [emailMessage, setEmailMessage] = useState(`Olá [nome do candidato], 
eu sou Ana Luíza, gestora de RH da [clienteid], estou lhe enviando os Assessments para responder através do link abaixo.`);
  const [sendOption, setSendOption] = useState(""); // "now" ou "schedule"
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [scheduledTime, setScheduledTime] = useState("");
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mutation para envio de emails
  const sendEmailMutation = useMutation({
    mutationFn: async (emailData: any) => {
      return apiRequest('/api/send-assessment-email', {
        method: 'POST',
        body: JSON.stringify(emailData)
      });
    },
    onSuccess: () => {
      toast({
        title: "Assessment enviado com sucesso!",
        description: "Os emails foram enviados para os candidatos selecionados.",
      });
      // Reset form
      setSelectionName("");
      setCandidateSource("");
      setSelectedList("");
      setSelectedCandidates([]);
      setSelectedAssessments([]);
      setEmailSubject("Olá [nome do candidato] faça seus Assessments MaxcamRH");
      setEmailMessage(`Olá [nome do candidato], 
eu sou Ana Luíza, gestora de RH da [clienteid], estou lhe enviando os Assessments para responder através do link abaixo.`);
      setSendOption("");
      setScheduledDate(undefined);
      setScheduledTime("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar assessment",
        description: error.message || "Ocorreu um erro ao enviar os emails. Tente novamente.",
        variant: "destructive",
      });
    }
  });

  // Buscar listas de candidatos
  const { data: candidateLists = [] } = useQuery({
    queryKey: ["/api/candidate-lists"],
  });

  const toggleAssessment = (assessmentId: string) => {
    setSelectedAssessments(prev => 
      prev.includes(assessmentId) 
        ? prev.filter(id => id !== assessmentId)
        : [...prev, assessmentId]
    );
  };

  const handleCandidateSourceChange = (value: string) => {
    setCandidateSource(value);
    // Limpar seleções quando mudar a fonte
    setSelectedList("");
    setSelectedCandidates([]);
  };

  const openSearchModal = () => {
    setIsSearchModalOpen(true);
  };

  const handleCandidateSelection = (candidates: Candidate[]) => {
    setSelectedCandidates(candidates);
  };

  const canSubmit = () => {
    return (
      selectionName.trim() !== "" &&
      candidateSource !== "" &&
      ((candidateSource === "list" && selectedList !== "") || 
       (candidateSource === "search" && selectedCandidates.length > 0)) &&
      selectedAssessments.length > 0 &&
      emailSubject.trim() !== "" &&
      emailMessage.trim() !== "" &&
      sendOption !== "" &&
      (sendOption === "now" || (scheduledDate && scheduledTime))
    );
  };

  const handleSubmit = () => {
    if (!canSubmit()) return;

    const formData = {
      selectionName,
      candidateSource,
      selectedList: candidateSource === "list" ? selectedList : null,
      selectedCandidates: candidateSource === "search" ? selectedCandidates : [],
      selectedAssessments,
      emailMessage,
      sendOption,
      scheduledDate,
      scheduledTime
    };

    console.log("Enviando assessment:", formData);
    // Aqui você implementará a lógica de envio
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Criar Novo Assessment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Nome da Seleção */}
          <div>
            <Label htmlFor="selectionName">Nome da Seleção por Assessments</Label>
            <Input
              id="selectionName"
              value={selectionName}
              onChange={(e) => setSelectionName(e.target.value)}
              placeholder="Ex: Assessment Desenvolvedor Frontend - Janeiro 2025"
              className="mt-1"
            />
          </div>

          {/* Seleção de Candidatos */}
          <div className="space-y-4">
            <Label>Selecionar Candidatos</Label>
            <RadioGroup 
              value={candidateSource} 
              onValueChange={handleCandidateSourceChange}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="list" id="list" />
                <Label htmlFor="list" className="flex items-center gap-2 cursor-pointer">
                  <List className="h-4 w-4" />
                  Lista
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="search" id="search" />
                <Label htmlFor="search" className="flex items-center gap-2 cursor-pointer">
                  <Search className="h-4 w-4" />
                  Buscar Candidato
                </Label>
              </div>
            </RadioGroup>

            {/* Campo Lista */}
            {candidateSource === "list" && (
              <div>
                <Select value={selectedList} onValueChange={setSelectedList}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma lista de candidatos" />
                  </SelectTrigger>
                  <SelectContent>
                    {candidateLists.map((list: CandidateList) => (
                      <SelectItem key={list.id} value={list.id.toString()}>
                        {list.name} ({list.candidateCount} candidatos)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Campo Buscar Candidato */}
            {candidateSource === "search" && (
              <div className="space-y-3">
                <Button 
                  variant="outline" 
                  onClick={openSearchModal}
                  className="w-full justify-start"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Buscar e Selecionar Candidatos
                </Button>
                
                {selectedCandidates.length > 0 && (
                  <div className="border rounded-lg p-3 bg-blue-50">
                    <div className="text-sm font-medium text-blue-800 mb-2">
                      {selectedCandidates.length} candidato(s) selecionado(s):
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {selectedCandidates.map((candidate) => (
                        <Badge key={candidate.id} variant="secondary" className="text-xs">
                          {candidate.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Seleção de Assessments */}
          <div className="space-y-4">
            <Label>Selecione os Assessments:</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {assessmentTypes.map((assessment) => (
                <Button
                  key={assessment.id}
                  variant={selectedAssessments.includes(assessment.id) ? "default" : "outline"}
                  onClick={() => toggleAssessment(assessment.id)}
                  className={`
                    h-auto py-4 px-3 text-center transition-all
                    ${selectedAssessments.includes(assessment.id) 
                      ? `${assessment.color} text-white` 
                      : 'hover:bg-gray-50'
                    }
                  `}
                >
                  <div className="flex flex-col items-center">
                    <CheckSquare className="h-5 w-5 mb-1" />
                    <span className="text-sm font-medium">{assessment.name}</span>
                  </div>
                </Button>
              ))}
            </div>
            {selectedAssessments.length > 0 && (
              <div className="text-sm text-gray-600">
                {selectedAssessments.length} assessment(s) selecionado(s)
              </div>
            )}
          </div>

          {/* Assunto E-mail */}
          <div className="space-y-2">
            <Label htmlFor="emailSubject">Assunto E-mail</Label>
            <Input
              id="emailSubject"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="Assunto do e-mail"
            />
            <div className="text-xs text-gray-500">
              Use [nome do candidato] e [clienteid] como placeholders no assunto
            </div>
          </div>

          {/* Mensagem E-mail */}
          <div className="space-y-2">
            <Label htmlFor="emailMessage">Mensagem E-mail</Label>
            <Textarea
              id="emailMessage"
              value={emailMessage}
              onChange={(e) => setEmailMessage(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <div className="text-xs text-gray-500">
              Use [nome do candidato] e [clienteid] como placeholders na mensagem
            </div>
          </div>

          {/* Opções de Envio */}
          <div className="space-y-4">
            <Label>Quando enviar:</Label>
            <RadioGroup value={sendOption} onValueChange={setSendOption}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="now" id="now" />
                <Label htmlFor="now" className="flex items-center gap-2 cursor-pointer">
                  <Send className="h-4 w-4" />
                  Enviar Agora
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="schedule" id="schedule" />
                <Label htmlFor="schedule" className="flex items-center gap-2 cursor-pointer">
                  <CalendarIcon className="h-4 w-4" />
                  Agendar
                </Label>
              </div>
            </RadioGroup>

            {/* Campos de Agendamento */}
            {sendOption === "schedule" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                <div>
                  <Label>Data</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start mt-1">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {scheduledDate 
                          ? format(scheduledDate, "dd/MM/yyyy", { locale: ptBR })
                          : "Selecionar data"
                        }
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={scheduledDate}
                        onSelect={setScheduledDate}
                        disabled={(date) => date < new Date()}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label htmlFor="scheduledTime">Horário</Label>
                  <div className="relative mt-1">
                    <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      id="scheduledTime"
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Botão de Envio */}
          <div className="flex items-center justify-end pt-6 border-t">
            <Button 
              onClick={handleSubmit}
              disabled={!canSubmit()}
              className="px-8"
            >
              <Send className="h-4 w-4 mr-2" />
              {sendOption === "now" ? "Enviar Agora" : "Agendar Envio"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Busca de Candidatos */}
      <CandidateSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelectCandidates={handleCandidateSelection}
        selectedCandidates={selectedCandidates}
      />
    </div>
  );
}