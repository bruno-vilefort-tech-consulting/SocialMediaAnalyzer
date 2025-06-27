import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Candidate {
  id: number;
  name: string;
  email: string;
  phone: string;
}

interface CandidateSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCandidates: (candidates: Candidate[]) => void;
  selectedCandidates: Candidate[];
}

export default function CandidateSearchModal({
  isOpen,
  onClose,
  onSelectCandidates,
  selectedCandidates
}: CandidateSearchModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [localSelected, setLocalSelected] = useState<Candidate[]>(selectedCandidates);

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["/api/candidates"],
    enabled: isOpen,
  });

  const filteredCandidates = candidates.filter((candidate: Candidate) =>
    candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    candidate.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (candidate.phone && candidate.phone.includes(searchTerm))
  );

  const toggleCandidate = (candidate: Candidate) => {
    const isSelected = localSelected.some(c => c.id === candidate.id);
    if (isSelected) {
      setLocalSelected(localSelected.filter(c => c.id !== candidate.id));
    } else {
      setLocalSelected([...localSelected, candidate]);
    }
  };

  const handleConfirm = () => {
    onSelectCandidates(localSelected);
    onClose();
  };

  const isSelected = (candidateId: number) => {
    return localSelected.some(c => c.id === candidateId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Buscar e Selecionar Candidatos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Campo de busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar por nome, email ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Candidatos selecionados */}
          {localSelected.length > 0 && (
            <div className="border rounded-lg p-3 bg-blue-50">
              <div className="text-sm font-medium text-blue-800 mb-2">
                {localSelected.length} candidato(s) selecionado(s):
              </div>
              <div className="flex flex-wrap gap-1">
                {localSelected.map((candidate) => (
                  <Badge key={candidate.id} variant="secondary" className="text-xs">
                    {candidate.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Lista de candidatos */}
          <ScrollArea className="h-[400px] border rounded-lg">
            <div className="p-4 space-y-2">
              {isLoading ? (
                <div className="text-center py-8 text-gray-500">
                  Carregando candidatos...
                </div>
              ) : filteredCandidates.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchTerm ? "Nenhum candidato encontrado" : "Nenhum candidato disponível"}
                </div>
              ) : (
                filteredCandidates.map((candidate: Candidate) => (
                  <div
                    key={candidate.id}
                    onClick={() => toggleCandidate(candidate)}
                    className={`
                      p-3 rounded-lg border cursor-pointer transition-all
                      ${isSelected(candidate.id) 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {candidate.name}
                        </div>
                        <div className="text-sm text-gray-600">
                          {candidate.email}
                        </div>
                        <div className="text-xs text-gray-500">
                          {candidate.phone}
                        </div>
                      </div>
                      {isSelected(candidate.id) && (
                        <Check className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Botões de ação */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm}>
              Confirmar Seleção ({localSelected.length})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}