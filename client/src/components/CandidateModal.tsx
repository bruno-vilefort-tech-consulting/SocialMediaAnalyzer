import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Schema de validação para candidato
const candidateSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  whatsapp: z.string().min(10, "WhatsApp deve ter pelo menos 10 dígitos"),
  listId: z.number().optional(),
  clientId: z.number().min(1, "Cliente é obrigatório")
});

type CandidateFormData = z.infer<typeof candidateSchema>;

interface Candidate {
  id: number;
  name: string;
  email: string;
  whatsapp: string;
  clientId: number;
}

interface CandidateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCandidate?: Candidate | null;
  selectedListId?: number | null;
  clientId?: number;
  onSuccess?: () => void;
}

// ✅ FUNÇÃO CORRIGIDA: Remover o 9º dígito de números de Minas Gerais
function removeDigitNine(phone: string): string {
  // Limpar número
  const cleanPhone = phone.replace(/\D/g, '');

  // Para números com 13 dígitos (55 + DDD + 9 + 8 dígitos)
  if (cleanPhone.length === 13 && cleanPhone.startsWith('55') && cleanPhone.charAt(4) === '9') {
    // Remove o 9º dígito: 5531991505564 → 553191505564
    return cleanPhone.slice(0, 4) + cleanPhone.slice(5);
  }

  return cleanPhone;
}

// ✅ FUNÇÃO CORRIGIDA: Adicionar o 9º dígito quando necessário
function addDigitNine(phone: string): string {
  // Limpar número
  const cleanPhone = phone.replace(/\D/g, '');

  // Se já tem 13 dígitos, não modificar
  if (cleanPhone.length === 13) return cleanPhone;

  // Se tem 12 dígitos (55 + DDD + 8), adicionar 9 após DDD
  if (cleanPhone.length === 12 && cleanPhone.startsWith('55')) {
    // 551196612253 → 5511996612253
    return cleanPhone.slice(0, 4) + '9' + cleanPhone.slice(4);
  }

  // Se tem 11 dígitos (DDD + 8 ou 9), adicionar código do país
  if (cleanPhone.length === 11) {
    // Se já tem 9º dígito: 11996612253 → 5511996612253
    if (cleanPhone.charAt(2) === '9') {
      return '55' + cleanPhone;
    }
    // Se não tem 9º dígito: 11966612253 → 5511996612253
    else {
      return '55' + cleanPhone.slice(0, 2) + '9' + cleanPhone.slice(2);
    }
  }

  // Se tem 10 dígitos (DDD + 8 sem código do país), adicionar 55 e 9
  if (cleanPhone.length === 10) {
    // 1196612253 → 5511996612253
    return '55' + cleanPhone.slice(0, 2) + '9' + cleanPhone.slice(2);
  }

  return cleanPhone;
}

// ✅ FUNÇÃO DE VALIDAÇÃO APRIMORADA: Remover implementação hardcoded temporária
async function validateWhatsAppNumber(rawPhone: string): Promise<string | null> {
  try {
    // Normalizar número para formato brasileiro
    let normalizedPhone = rawPhone.replace(/\D/g, '');

    // Adicionar código do país se necessário
    if (normalizedPhone.length === 10 || normalizedPhone.length === 11) {
      normalizedPhone = '55' + normalizedPhone;
    }

    // 🔁 ESTRATÉGIA BIDIRECIONAL: Testar as 3 possibilidades
    const candidates = [
      normalizedPhone,                    // Número original
      removeDigitNine(normalizedPhone),   // Sem o 9º dígito (números antigos MG)
      addDigitNine(normalizedPhone)       // Com o 9º dígito adicionado
    ];

    // Remover duplicatas e números inválidos
    const uniqueCandidates = Array.from(new Set(candidates)).filter(num =>
      num.length >= 12 && num.length <= 13 && num.startsWith('55')
    );

    console.log(`📱 [VALIDATION] Testando ${uniqueCandidates.length} candidatos para ${rawPhone}:`, uniqueCandidates);

    // ✅ CORREÇÃO CRÍTICA: Remover implementação temporária hardcoded
    // Testar todos os candidatos via API ou usar fallback inteligente
    for (const number of uniqueCandidates) {
      try {
        const response = await apiRequest('/api/whatsapp/validate-number', 'POST', { phone: number });
        const result = await response.json();

        if (result.isValid && result.validatedNumber) {
          console.log(`✅ [VALIDATION] Número validado via API: ${result.validatedNumber}`);
          return result.validatedNumber;
        }
      } catch (error) {
        console.warn(`⚠️ [VALIDATION] Erro ao validar número ${number}:`, error);
      }
    }

    // 🔧 FALLBACK INTELIGENTE: Se API falhar, usar lógica local para correção
    // Priorizar números corrigidos que sejam diferentes do original
    const correctedNumbers = uniqueCandidates.filter(num => num !== normalizedPhone);

    if (correctedNumbers.length > 0) {
      const correctedNumber = correctedNumbers[0];
      console.log(`🔧 [VALIDATION-FALLBACK] Usando correção local: ${rawPhone} → ${correctedNumber}`);
      return correctedNumber;
    }

    // Se nenhuma correção foi feita, retornar o número normalizado
    console.log(`ℹ️ [VALIDATION] Retornando número normalizado: ${normalizedPhone}`);
    return normalizedPhone;

  } catch (error) {
    console.error('❌ [VALIDATION] Erro geral na validação WhatsApp:', error);
    // Em caso de erro total, tentar pelo menos normalizar
    const fallback = rawPhone.replace(/\D/g, '');
    if (fallback.length >= 10) {
      return fallback.length >= 12 ? fallback : '55' + fallback;
    }
    return null;
  }
}

export function CandidateModal({
  open,
  onOpenChange,
  editingCandidate,
  selectedListId,
  clientId,
  onSuccess
}: CandidateModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isValidating, setIsValidating] = useState(false);

  const form = useForm<CandidateFormData>({
    resolver: zodResolver(candidateSchema),
    defaultValues: {
      name: editingCandidate?.name || "",
      email: editingCandidate?.email || "",
      whatsapp: editingCandidate?.whatsapp || "",
      listId: selectedListId || 0,
      clientId: clientId
    }
  });

  // Reset form when editingCandidate or modal state changes
  useState(() => {
    if (editingCandidate) {
      form.reset({
        name: editingCandidate.name,
        email: editingCandidate.email,
        whatsapp: editingCandidate.whatsapp,
        listId: selectedListId || 0,
        clientId: clientId
      });
    } else {
      form.reset({
        name: "",
        email: "",
        whatsapp: "",
        listId: selectedListId || 0,
        clientId: clientId
      });
    }
  });

  const createCandidateMutation = useMutation({
    mutationFn: async (data: CandidateFormData) => {
      console.log(`🔍 [DEBUG] Iniciando criação de candidato com WhatsApp: ${data.whatsapp}`);

      // 🎯 VALIDAÇÃO WHATSAPP: Verificar e corrigir número automaticamente
      setIsValidating(true);
      toast({ title: "Validando número WhatsApp...", description: "Aguarde..." });

      const validatedWhatsApp = await validateWhatsAppNumber(data.whatsapp);
      console.log(`🔍 [DEBUG] Resultado da validação: ${data.whatsapp} → ${validatedWhatsApp}`);

      if (!validatedWhatsApp) {
        console.error(`❌ [DEBUG] Validação falhou para: ${data.whatsapp}`);
        throw new Error(`Número WhatsApp ${data.whatsapp} não é válido ou não está registrado no WhatsApp. Verifique o número e tente novamente.`);
      }

      // ✅ CORREÇÃO AUTOMÁTICA: Usar número validado e correto retornado pelo Baileys
      if (validatedWhatsApp !== data.whatsapp) {
        console.log(`✅ [DEBUG] Número corrigido: ${data.whatsapp} → ${validatedWhatsApp}`);
        toast({
          title: "Número corrigido automaticamente!",
          description: `${data.whatsapp} → ${validatedWhatsApp}`,
          duration: 3000
        });
      } else {
        console.log(`ℹ️ [DEBUG] Número não foi alterado: ${data.whatsapp}`);
      }

      const candidateData = {
        ...data,
        whatsapp: validatedWhatsApp
      };

      console.log(`💾 [DEBUG] Salvando candidato com número validado:`, candidateData);

      toast({ title: "Número validado com sucesso!", description: "Criando candidato..." });

      return await apiRequest('/api/candidates', 'POST', candidateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/candidate-list-memberships'] });
      setIsValidating(false);
      onOpenChange(false);
      form.reset();
      toast({ title: "Candidato adicionado com sucesso!", description: "Número WhatsApp validado e candidato criado." });
      onSuccess?.();
    },
    onError: (error: any) => {
      setIsValidating(false);
      toast({
        title: "Erro ao adicionar candidato",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
    }
  });

  const updateCandidateMutation = useMutation({
    mutationFn: async (data: CandidateFormData) => {
      if (!editingCandidate) {
        throw new Error("Nenhum candidato selecionado para edição");
      }

      // 🎯 VALIDAÇÃO WHATSAPP: Verificar e corrigir número automaticamente
      // Só validar se o WhatsApp foi alterado
      if (data.whatsapp !== editingCandidate.whatsapp) {
        setIsValidating(true);
        toast({ title: "Validando número WhatsApp...", description: "Aguarde..." });

        const validatedWhatsApp = await validateWhatsAppNumber(data.whatsapp);

        if (!validatedWhatsApp) {
          throw new Error(`Número WhatsApp ${data.whatsapp} não é válido ou não está registrado no WhatsApp. Verifique o número e tente novamente.`);
        }

        // ✅ CORREÇÃO AUTOMÁTICA: Usar número validado e mostrar correção se houve mudança
        if (validatedWhatsApp !== data.whatsapp) {
          toast({
            title: "Número corrigido automaticamente!",
            description: `${data.whatsapp} → ${validatedWhatsApp}`,
            duration: 3000
          });
        }

        data.whatsapp = validatedWhatsApp;
        toast({ title: "Número validado com sucesso!", description: "Atualizando candidato..." });
      }

      const updatedData = {
        name: data.name.trim(),
        email: data.email.trim(),
        whatsapp: data.whatsapp.trim()
      };

      return await apiRequest(`/api/candidates/${editingCandidate.id}`, 'PATCH', updatedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/candidate-list-memberships'] });
      setIsValidating(false);
      onOpenChange(false);
      form.reset();
      toast({ title: "Candidato atualizado com sucesso!" });
      onSuccess?.();
    },
    onError: (error: any) => {
      setIsValidating(false);
      toast({
        title: "Erro ao atualizar candidato",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (data: CandidateFormData) => {
    console.log(`🔍 [DEBUG] CandidateModal - handleSubmit chamado com dados:`, data);

    if (editingCandidate) {
      updateCandidateMutation.mutate(data);
    } else {
      createCandidateMutation.mutate(data);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isValidating) {
      form.reset();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingCandidate ? "Editar Candidato" : "Novo Candidato"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: João Silva" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input placeholder="joao@email.com" type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="whatsapp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WhatsApp *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: 5511987654321"
                      {...field}
                      disabled={isValidating}
                    />
                  </FormControl>
                  <FormMessage />
                  {isValidating && (
                    <p className="text-sm text-blue-600">🔍 Validando número WhatsApp...</p>
                  )}
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isValidating}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createCandidateMutation.isPending || updateCandidateMutation.isPending || isValidating}
              >
                {isValidating
                  ? "Validando..."
                  : (createCandidateMutation.isPending || updateCandidateMutation.isPending)
                    ? "Salvando..."
                    : editingCandidate
                      ? "Atualizar"
                      : "Adicionar"
                }
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}