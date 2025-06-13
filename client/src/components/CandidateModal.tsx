import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Candidate, InsertCandidate } from "@shared/schema";

interface CandidateModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate?: Candidate | null;
}

export default function CandidateModal({ isOpen, onClose, candidate }: CandidateModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (candidate) {
      setName(candidate.name);
      setEmail(candidate.email);
      setWhatsapp(candidate.whatsapp);
    } else {
      setName("");
      setEmail("");
      setWhatsapp("");
    }
  }, [candidate]);

  const createCandidateMutation = useMutation({
    mutationFn: (candidateData: InsertCandidate) => 
      apiRequest("POST", "/api/candidates", candidateData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      toast({
        title: "Candidato criado",
        description: "Candidato foi criado com sucesso",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao criar candidato",
        variant: "destructive",
      });
    },
  });

  const updateCandidateMutation = useMutation({
    mutationFn: ({ id, candidateData }: { id: number; candidateData: Partial<Candidate> }) =>
      apiRequest("PUT", `/api/candidates/${id}`, candidateData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      toast({
        title: "Candidato atualizado",
        description: "Candidato foi atualizado com sucesso",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar candidato",
        variant: "destructive",
      });
    },
  });

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateWhatsApp = (whatsapp: string) => {
    // Brazilian WhatsApp format: +55 DD 9XXXX-XXXX or similar
    const whatsappRegex = /^\+55\s?\d{2}\s?\d{4,5}-?\d{4}$/;
    return whatsappRegex.test(whatsapp.replace(/\s/g, ''));
  };

  const formatWhatsApp = (value: string) => {
    // Remove all non-numeric characters except +
    let cleaned = value.replace(/[^\d+]/g, '');
    
    // Ensure it starts with +55
    if (!cleaned.startsWith('+55')) {
      if (cleaned.startsWith('55')) {
        cleaned = '+' + cleaned;
      } else if (cleaned.startsWith('0')) {
        cleaned = '+55' + cleaned.substring(1);
      } else {
        cleaned = '+55' + cleaned;
      }
    }
    
    // Format the number
    if (cleaned.length >= 8) {
      const countryCode = cleaned.substring(0, 3); // +55
      const areaCode = cleaned.substring(3, 5);
      const number = cleaned.substring(5);
      
      if (number.length <= 4) {
        return `${countryCode} ${areaCode} ${number}`;
      } else if (number.length <= 8) {
        return `${countryCode} ${areaCode} ${number.substring(0, 4)}-${number.substring(4)}`;
      } else {
        return `${countryCode} ${areaCode} ${number.substring(0, 5)}-${number.substring(5, 9)}`;
      }
    }
    
    return cleaned;
  };

  const handleWhatsAppChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatWhatsApp(e.target.value);
    setWhatsapp(formatted);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !email.trim() || !whatsapp.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    if (!validateEmail(email)) {
      toast({
        title: "Email inválido",
        description: "Digite um email válido",
        variant: "destructive",
      });
      return;
    }

    if (!validateWhatsApp(whatsapp)) {
      toast({
        title: "WhatsApp inválido",
        description: "Digite um número de WhatsApp válido (+55 DD 9XXXX-XXXX)",
        variant: "destructive",
      });
      return;
    }

    const candidateData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      whatsapp: whatsapp.trim(),
    };

    if (candidate) {
      updateCandidateMutation.mutate({ id: candidate.id, candidateData });
    } else {
      createCandidateMutation.mutate(candidateData);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {candidate ? "Editar Candidato" : "Novo Candidato"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome Completo</Label>
            <Input
              id="name"
              placeholder="Ex: João Silva"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="joao@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input
              id="whatsapp"
              placeholder="+55 11 99999-9999"
              value={whatsapp}
              onChange={handleWhatsAppChange}
              required
            />
            <div className="text-xs text-slate-500 mt-1">
              Formato: +55 DD 9XXXX-XXXX
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={createCandidateMutation.isPending || updateCandidateMutation.isPending}
            >
              {candidate ? "Atualizar" : "Criar"} Candidato
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
