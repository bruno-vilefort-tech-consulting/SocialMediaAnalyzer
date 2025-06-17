import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Building, Edit, Trash2, Filter, Calendar, Search, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Client, InsertClient } from "@shared/schema";

// Schema de validação para clientes
const clientFormSchema = z.object({
  companyName: z.string().min(1, "Nome da empresa é obrigatório"),
  cnpj: z.string().min(14, "CNPJ deve ter pelo menos 14 caracteres"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(10, "Telefone deve ter pelo menos 10 caracteres"),
  monthlyLimit: z.number().min(1, "Limite mensal deve ser pelo menos 1"),
  status: z.enum(["active", "inactive"], {
    required_error: "Status é obrigatório",
  }),
  contractStart: z.date({
    required_error: "Data de início do contrato é obrigatória",
  }),
  contractEnd: z.date().optional(),
  isIndefiniteContract: z.boolean().default(false),
  responsibleName: z.string().min(1, "Nome do responsável é obrigatório"),
  responsiblePhone: z.string().min(10, "Telefone do responsável deve ter pelo menos 10 caracteres"),
  responsibleEmail: z.string().email("Email do responsável inválido"),
});

type ClientFormData = z.infer<typeof clientFormSchema>;

export default function ClientsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Form para cliente
  const clientForm = useForm<ClientFormData>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      companyName: "",
      cnpj: "",
      email: "",
      phone: "",
      monthlyLimit: 5,
      status: "active",
      contractStart: new Date(),
      contractEnd: undefined,
      isIndefiniteContract: false,
      responsibleName: "",
      responsiblePhone: "",
      responsibleEmail: "",
    },
  });

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Mutation para criar cliente
  const createClientMutation = useMutation({
    mutationFn: (clientData: InsertClient) => apiRequest("/api/clients", "POST", clientData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setShowNewClientForm(false);
      clientForm.reset();
      toast({
        title: "Cliente criado",
        description: "Cliente cadastrado com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar cliente",
        variant: "destructive",
      });
    },
  });

  // Mutation para atualizar cliente
  const updateClientMutation = useMutation({
    mutationFn: ({ clientId, clientData }: { clientId: number; clientData: Partial<InsertClient> }) =>
      apiRequest(`/api/clients/${clientId}`, "PATCH", clientData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setEditingClient(null);
      clientForm.reset();
      toast({
        title: "Cliente atualizado",
        description: "Cliente atualizado com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar cliente",
        variant: "destructive",
      });
    },
  });

  // Mutation para deletar cliente
  const deleteClientMutation = useMutation({
    mutationFn: (clientId: number) => apiRequest(`/api/clients/${clientId}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Cliente deletado",
        description: "Cliente removido com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao deletar cliente",
        variant: "destructive",
      });
    },
  });

  const startEditClient = (client: Client) => {
    setEditingClient(client);
    setShowNewClientForm(true);
    
    const contractStart = client.contractStart ? new Date(client.contractStart) : new Date();
    const contractEnd = client.contractEnd ? new Date(client.contractEnd) : undefined;
    
    clientForm.reset({
      companyName: client.companyName,
      cnpj: client.cnpj,
      email: client.email,
      phone: client.phone,
      monthlyLimit: client.monthlyLimit,
      status: client.status as "active" | "inactive",
      contractStart: contractStart,
      contractEnd: contractEnd,
      isIndefiniteContract: !client.contractEnd,
      responsibleName: client.responsibleName,
      responsiblePhone: client.responsiblePhone,
      responsibleEmail: client.responsibleEmail,
    });
  };

  const onSubmitClient = (data: ClientFormData) => {
    const clientData: InsertClient = {
      ...data,
      contractEnd: data.isIndefiniteContract ? null : data.contractEnd || null,
      additionalLimit: null,
      additionalLimitExpiry: null,
    };

    if (editingClient) {
      updateClientMutation.mutate({ clientId: editingClient.id, clientData });
    } else {
      createClientMutation.mutate(clientData);
    }
  };

  const cancelEdit = () => {
    setEditingClient(null);
    setShowNewClientForm(false);
    clientForm.reset();
  };

  const deleteClient = (clientId: number) => {
    if (confirm("Tem certeza que deseja deletar este cliente?")) {
      deleteClientMutation.mutate(clientId);
    }
  };

  // Filtrar clientes baseado no termo de busca
  const filteredClients = clients.filter(client =>
    client.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.cnpj.includes(searchTerm) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (date: any): string => {
    if (!date) return "Não definido";
    
    try {
      // Handle Firebase Timestamp format
      if (typeof date === 'object' && date.seconds) {
        return format(new Date(date.seconds * 1000), "dd/MM/yyyy", { locale: ptBR });
      }
      // Handle regular Date objects
      if (date instanceof Date && !isNaN(date.getTime())) {
        return format(date, "dd/MM/yyyy", { locale: ptBR });
      }
      // Handle date strings
      if (typeof date === 'string') {
        const parsedDate = new Date(date);
        if (!isNaN(parsedDate.getTime())) {
          return format(parsedDate, "dd/MM/yyyy", { locale: ptBR });
        }
      }
      return "Data inválida";
    } catch (error) {
      console.error("Erro ao formatar data:", error, date);
      return "Data inválida";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
          <p className="text-slate-600">Gerencie os clientes corporativos</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Buscar clientes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          <Button onClick={() => setShowNewClientForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Cliente
          </Button>
        </div>
      </div>

      {/* Formulário de Cliente */}
      {showNewClientForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingClient ? "Editar Cliente" : "Novo Cliente"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...clientForm}>
              <form onSubmit={clientForm.handleSubmit(onSubmitClient)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={clientForm.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome da Empresa *</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome da empresa" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={clientForm.control}
                    name="cnpj"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CNPJ *</FormLabel>
                        <FormControl>
                          <Input placeholder="XX.XXX.XXX/XXXX-XX" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={clientForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="email@empresa.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={clientForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone *</FormLabel>
                        <FormControl>
                          <Input placeholder="(11) 99999-9999" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={clientForm.control}
                    name="monthlyLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Limite Mensal *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={clientForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Ativo</SelectItem>
                            <SelectItem value="inactive">Inativo</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-slate-900">Contrato</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={clientForm.control}
                      name="contractStart"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data de Início *</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              value={field.value instanceof Date && !isNaN(field.value.getTime()) 
                                ? field.value.toISOString().split('T')[0] 
                                : ''}
                              onChange={(e) => field.onChange(new Date(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={clientForm.control}
                      name="contractEnd"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data de Fim</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              disabled={clientForm.watch("isIndefiniteContract")}
                              value={field.value instanceof Date && !isNaN(field.value.getTime()) 
                                ? field.value.toISOString().split('T')[0] 
                                : ''}
                              onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={clientForm.control}
                    name="isIndefiniteContract"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Contrato por prazo indeterminado</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-slate-900">Responsável</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={clientForm.control}
                      name="responsibleName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome do Responsável *</FormLabel>
                          <FormControl>
                            <Input placeholder="Nome completo" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={clientForm.control}
                      name="responsiblePhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone do Responsável *</FormLabel>
                          <FormControl>
                            <Input placeholder="(11) 99999-9999" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={clientForm.control}
                      name="responsibleEmail"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Email do Responsável *</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="responsavel@empresa.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={cancelEdit}>
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createClientMutation.isPending || updateClientMutation.isPending}
                  >
                    {createClientMutation.isPending || updateClientMutation.isPending ? "Salvando..." : 
                     editingClient ? "Atualizar" : "Salvar"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Lista de Clientes */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="text-slate-600">Carregando clientes...</div>
          </div>
        ) : filteredClients.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-200">
            <CardContent className="py-12">
              <div className="text-center">
                <Building className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">
                  {searchTerm ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
                </h3>
                <p className="text-slate-600 mb-6">
                  {searchTerm 
                    ? "Tente ajustar os termos da busca"
                    : "Comece adicionando o primeiro cliente corporativo"}
                </p>
                {!searchTerm && (
                  <Button onClick={() => setShowNewClientForm(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Primeiro Cliente
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredClients.map((client: Client) => (
              <Card key={client.id} className="border border-slate-200">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Building className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-medium text-slate-900">{client.companyName}</h3>
                          <p className="text-sm text-slate-600">CNPJ: {client.cnpj}</p>
                        </div>
                        <Badge variant={client.status === "active" ? "default" : "secondary"}>
                          {client.status === "active" ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-slate-500">Email:</span>
                          <p className="font-medium">{client.email}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Telefone:</span>
                          <p className="font-medium">{client.phone}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Limite Mensal:</span>
                          <p className="font-medium">{client.monthlyLimit} entrevistas</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-slate-500">Responsável:</span>
                          <p className="font-medium">{client.responsibleName}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Contrato:</span>
                          <p className="font-medium">
                            {formatDate(client.contractStart)} - {client.contractEnd ? formatDate(client.contractEnd) : "Indeterminado"}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-500">Criado em:</span>
                          <p className="font-medium">{formatDate(client.createdAt)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEditClient(client)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteClient(client.id)}
                        className="text-red-600 hover:text-red-700 hover:border-red-300"
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
      </div>
    </div>
  );
}