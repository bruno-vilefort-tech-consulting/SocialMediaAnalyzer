import { useState, useEffect } from "react";
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
import { Plus, Building, Edit, Trash2, Filter, Calendar, Users, X, Search } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { toast, useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Client, InsertClient, User } from "@shared/schema";

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

// Schema de validação para usuários dos clientes
const clientUserFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").optional(),
});

type ClientUserFormData = z.infer<typeof clientUserFormSchema>;

// Interface para usuário do cliente
interface ClientUser {
  id: number;
  name: string;
  email: string;
  createdAt?: any;
}

export default function ClientsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [showNewUserForm, setShowNewUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<ClientUser | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Form para novo cliente
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

  // Query para buscar usuários de um cliente específico
  const { data: clientUsers = [], isLoading: isLoadingUsers } = useQuery<ClientUser[]>({
    queryKey: [`/api/clients/${editingClient?.id}/users`],
    enabled: !!editingClient,
  });





  // Form para usuário do cliente
  const clientUserForm = useForm<ClientUserFormData>({
    resolver: zodResolver(clientUserFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  // Mutation para criar cliente
  const createClientMutation = useMutation({
    mutationFn: (clientData: InsertClient) => apiRequest("/api/clients", "POST", clientData),
    onSuccess: () => {
      toast({
        title: "Sucesso!",
        description: "Cliente criado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      resetForm();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao criar cliente.",
        variant: "destructive",
      });
    },
  });

  // Mutation para atualizar cliente
  const updateClientMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest(`/api/clients/${id}`, "PATCH", data),
    onSuccess: () => {
      toast({
        title: "Sucesso!",
        description: "Cliente atualizado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      // Não resetar o formulário - manter a tela de edição aberta
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar cliente.",
        variant: "destructive",
      });
    },
  });

  const deleteClientMutation = useMutation({
    mutationFn: (id: number) => {
      return apiRequest(`/api/clients/${id}`, "DELETE");
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Cliente removido",
        description: "Cliente foi removido com sucesso",
      });
    },
    onError: (error, variables) => {
      toast({
        title: "Erro",
        description: `Falha ao remover cliente: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: "destructive",
      });
    },
  });

  // Mutations para usuários dos clientes
  const createClientUserMutation = useMutation({
    mutationFn: ({ clientId, userData }: { clientId: number; userData: ClientUserFormData }) => {
      return apiRequest(`/api/clients/${clientId}/users`, "POST", userData);
    },
    onSuccess: (data) => {
      toast({
        title: "Sucesso!",
        description: "Usuário criado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${editingClient?.id}/users`] });
      resetUserForm();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar usuário.",
        variant: "destructive",
      });
    },
  });

  const updateClientUserMutation = useMutation({
    mutationFn: ({ clientId, userId, userData }: { clientId: number; userId: number; userData: Partial<ClientUserFormData> }) =>
      apiRequest(`/api/clients/${clientId}/users/${userId}`, "PATCH", userData),
    onSuccess: () => {
      toast({
        title: "Sucesso!",
        description: "Usuário atualizado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${editingClient?.id}/users`] });
      resetUserForm();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar usuário.",
        variant: "destructive",
      });
    },
  });

  const deleteClientUserMutation = useMutation({
    mutationFn: ({ clientId, userId }: { clientId: number; userId: number }) =>
      apiRequest(`/api/clients/${clientId}/users/${userId}`, "DELETE"),
    onSuccess: () => {
      toast({
        title: "Usuário removido",
        description: "Usuário foi removido com sucesso",
      });
      // Apenas atualizar a lista de usuários, sem resetar o formulário
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${editingClient?.id}/users`] });
      // Se estava editando um usuário, apenas limpar o formulário de usuário
      if (editingUser) {
        resetUserForm();
      }
    },
    onError: () => {
      toast({
        title: "Erro ao remover usuário",
        description: "Ocorreu um erro ao tentar remover o usuário",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setShowNewClientForm(false);
    setEditingClient(null);
    clientForm.reset();
  };

  const resetUserForm = () => {
    setShowNewUserForm(false);
    setEditingUser(null);
    clientUserForm.reset({
      name: "",
      email: "",
      password: "",
    });
  };

  const startNewUser = () => {
    setShowNewUserForm(true);
    setEditingUser(null);
    clientUserForm.reset({
      name: "",
      email: "",
      password: "",
    });
  };

  const startNewClient = () => {
    setShowNewClientForm(true);
    setEditingClient(null);
    clientForm.reset({
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
    });
  };

  const startEditClient = (client: Client) => {
    setEditingClient(client);
    setShowNewClientForm(true);
    clientForm.reset({
      companyName: client.companyName,
      cnpj: client.cnpj,
      email: client.email,
      phone: client.phone,
      monthlyLimit: client.monthlyLimit,
      status: client.status as "active" | "inactive",
      contractStart: client.contractStart ? new Date(client.contractStart) : new Date(),
      contractEnd: client.contractEnd ? new Date(client.contractEnd) : undefined,
      isIndefiniteContract: !client.contractEnd,
      responsibleName: client.responsibleName || "",
      responsiblePhone: client.responsiblePhone || "",
      responsibleEmail: client.responsibleEmail || "",
    });
  };

  const onSubmitClient = (data: ClientFormData) => {
    if (editingClient) {
      // Atualizar cliente existente - processar dados antes de enviar
      const processedData = {
        ...data,
        contractEnd: data.isIndefiniteContract ? null : data.contractEnd,
      };
      updateClientMutation.mutate({
        id: editingClient.id,
        data: processedData,
      });
    } else {
      // Criar novo cliente
      const clientData: any = {
        companyName: data.companyName,
        cnpj: data.cnpj,
        email: data.email,
        phone: data.phone,
        password: "temp123", // Senha temporária - deverá ser alterada
        contractStart: data.contractStart,
        contractEnd: data.isIndefiniteContract ? undefined : data.contractEnd,
        monthlyLimit: data.monthlyLimit,
        status: data.status,
        responsibleName: data.responsibleName,
        responsiblePhone: data.responsiblePhone,
        responsibleEmail: data.responsibleEmail,
      };

      createClientMutation.mutate(clientData);
    }
  };

  const handleDeleteClient = async (id: number) => {
    if (window.confirm("Tem certeza que deseja remover este cliente? Esta ação não pode ser desfeita.")) {
      try {
        deleteClientMutation.mutate(id);
      } catch (error) {
        toast({
          title: "Erro",
          description: "Erro inesperado ao tentar remover cliente",
          variant: "destructive",
        });
      }
    }
  };

  // Handlers para usuários dos clientes

  const startEditUser = (user: ClientUser) => {
    setEditingUser(user);
    setShowNewUserForm(true);
    clientUserForm.reset({
      name: user.name,
      email: user.email,
      password: "", // Não mostrar senha atual
    });
  };

  const onSubmitUser = (data: ClientUserFormData) => {
    if (!editingClient) return;

    if (editingUser) {
      // Atualizar usuário existente
      const userData = data.password ? data : { name: data.name, email: data.email };
      updateClientUserMutation.mutate({
        clientId: editingClient.id,
        userId: editingUser.id,
        userData,
      });
    } else {
      // Criar novo usuário
      createClientUserMutation.mutate({
        clientId: editingClient.id,
        userData: data,
      });
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!editingClient) return;

    if (window.confirm("Tem certeza que deseja remover este usuário? Esta ação não pode ser desfeita.")) {
      deleteClientUserMutation.mutate({
        clientId: editingClient.id,
        userId,
      });
    }
  };

  const filteredClients = clients.filter(client =>
    client.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.cnpj.includes(searchTerm)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-600">Carregando clientes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gerenciar Clientes</h1>
          <p className="text-slate-600">Cadastre e gerencie clientes do sistema</p>
        </div>

        {!showNewClientForm && (
          <Button onClick={startNewClient} className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" />
            Novo Cliente
          </Button>
        )}
      </div>

      {/* Formulário de Novo/Editar Cliente */}
      {showNewClientForm && (
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-primary">
                {editingClient ? "Editar Cliente" : "Cadastrar Novo Cliente"}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={resetForm}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...clientForm}>
              <form onSubmit={clientForm.handleSubmit(onSubmitClient)} className="space-y-6">
                {/* Dados do Cliente */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={clientForm.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome da Empresa</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Empresa XYZ Ltda" {...field} />
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
                        <FormLabel>CNPJ</FormLabel>
                        <FormControl>
                          <Input placeholder="00.000.000/0000-00" {...field} />
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
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="contato@empresa.com" {...field} />
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
                        <FormLabel>Telefone</FormLabel>
                        <FormControl>
                          <Input placeholder="(11) 99999-9999" {...field} />
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
                        <FormLabel>Status do Cliente</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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

                  <FormField
                    control={clientForm.control}
                    name="monthlyLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Limite Mensal de Entrevistas</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            placeholder="5"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* Dados do Contrato */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Dados do Contrato</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={clientForm.control}
                      name="contractStart"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data de Início do Contrato</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              {...field}
                              value={field.value && field.value instanceof Date && !isNaN(field.value.getTime()) ? field.value.toISOString().split('T')[0] : ''}
                              onChange={(e) => field.onChange(new Date(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

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
                            <FormLabel>
                              Contrato por tempo indeterminado
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  {!clientForm.watch("isIndefiniteContract") && (
                    <FormField
                      control={clientForm.control}
                      name="contractEnd"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data de Término do Contrato</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              {...field}
                              value={field.value && field.value instanceof Date && !isNaN(field.value.getTime()) ? field.value.toISOString().split('T')[0] : ''}
                              onChange={(e) => field.onChange(new Date(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <Separator />

                {/* Dados do Responsável */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Responsável</h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={clientForm.control}
                      name="responsibleName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome do Responsável</FormLabel>
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
                          <FormLabel>Celular do Responsável</FormLabel>
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
                        <FormItem>
                          <FormLabel>Email do Responsável</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="responsavel@empresa.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                {/* Gestão de Usuários - apenas para clientes existentes */}
                {editingClient && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">Usuários do Cliente</h3>
                        <p className="text-sm text-slate-600">
                          Gerencie os usuários que podem acessar o sistema para este cliente
                        </p>
                      </div>

                      {!showNewUserForm && (
                        <Button
                          type="button"
                          onClick={startNewUser}
                          variant="outline"
                          className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Novo Usuário
                        </Button>
                      )}
                    </div>

                    {/* Formulário de Novo/Editar Usuário */}
                    {showNewUserForm && (
                      <Card className="border border-slate-200 bg-slate-50">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base text-slate-900">
                              {editingUser ? "Editar Usuário" : "Adicionar Novo Usuário"}
                            </CardTitle>
                            <Button variant="ghost" size="sm" onClick={resetUserForm}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <Form {...clientUserForm}>
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                  control={clientUserForm.control}
                                  name="name"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Nome Completo</FormLabel>
                                      <FormControl>
                                        <Input placeholder="Nome do usuário" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={clientUserForm.control}
                                  name="email"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Email</FormLabel>
                                      <FormControl>
                                        <Input type="email" placeholder="usuario@empresa.com" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <FormField
                                control={clientUserForm.control}
                                name="password"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>
                                      {editingUser ? "Nova Senha (deixe em branco para manter atual)" : "Senha"}
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        type="password"
                                        placeholder={editingUser ? "Digite nova senha ou deixe em branco" : "Digite a senha"}
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <div className="flex gap-2 pt-2">
                                <Button
                                  type="button"
                                  onClick={clientUserForm.handleSubmit(onSubmitUser)}
                                  disabled={createClientUserMutation.isPending || updateClientUserMutation.isPending}
                                  size="sm"
                                >
                                  {editingUser ? "Atualizar Usuário" : "Criar Usuário"}
                                </Button>
                                <Button type="button" variant="outline" onClick={resetUserForm} size="sm">
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          </Form>
                        </CardContent>
                      </Card>
                    )}

                    {/* Lista de Usuários */}
                    {isLoadingUsers ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="text-slate-600">Carregando usuários...</div>
                      </div>
                    ) : clientUsers.length === 0 ? (
                      <Card className="border-dashed border-2 border-slate-200">
                        <CardContent className="py-8">
                          <div className="text-center">
                            <Users className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                            <h4 className="text-sm font-medium text-slate-900 mb-1">
                              Nenhum usuário cadastrado
                            </h4>
                            <p className="text-xs text-slate-600 mb-4">
                              Adicione usuários para que possam acessar o sistema.
                            </p>
                            {!showNewUserForm && (
                              <Button onClick={startNewUser} size="sm" variant="outline">
                                <Plus className="w-4 h-4 mr-2" />
                                Adicionar Primeiro Usuário
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-2">
                        {clientUsers.map((user: ClientUser) => (
                          <Card key={user.id} className="border border-slate-200">
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                    <Users className="w-4 h-4 text-blue-600" />
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-medium text-slate-900">{user.name}</h4>
                                    <p className="text-xs text-slate-600">{user.email}</p>
                                    <p className="text-xs text-slate-500">
                                      Criado em: {user.createdAt ? (() => {
                                        try {
                                          // Handle Firebase Timestamp format
                                          if (typeof user.createdAt === 'object' && user.createdAt.seconds) {
                                            return format(new Date(user.createdAt.seconds * 1000), "dd/MM/yyyy", { locale: ptBR });
                                          }
                                          // Handle ISO string format
                                          const date = new Date(user.createdAt);
                                          if (isNaN(date.getTime())) return "N/A";
                                          return format(date, "dd/MM/yyyy", { locale: ptBR });
                                        } catch {
                                          return "N/A";
                                        }
                                      })() : "N/A"}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => startEditUser(user)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteUser(user.id)}
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <Separator />

                {/* Botões de Ação */}
                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={createClientMutation.isPending || updateClientMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {createClientMutation.isPending || updateClientMutation.isPending
                      ? "Salvando..."
                      : editingClient
                        ? "Atualizar Cliente"
                        : "Cadastrar Cliente"
                    }
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

      {/* Lista de Clientes Existentes */}
      {!showNewClientForm && (
        <>
          {/* Busca */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Buscar clientes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Badge variant="outline" className="text-slate-600">
              {filteredClients.length} cliente(s)
            </Badge>
          </div>

          {/* Lista de Clientes */}
          <div className="grid gap-4">
            {filteredClients.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <Building className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 mb-2">
                      {searchTerm ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
                    </h3>
                    <p className="text-slate-600 mb-6">
                      {searchTerm
                        ? "Tente ajustar os termos de busca."
                        : "Comece criando seu primeiro cliente."
                      }
                    </p>
                    {!searchTerm && (
                      <Button onClick={startNewClient}>
                        <Plus className="w-4 h-4 mr-2" />
                        Criar Primeiro Cliente
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              filteredClients.map((client: Client) => (
                <Card key={client.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Building className="w-5 h-5 text-primary" />
                          <h3 className="text-lg font-semibold text-slate-900">
                            {user?.role === 'master' ? `#${client.id} - ${client.companyName}` : client.companyName}
                          </h3>
                          <Badge
                            variant={client.status === 'active' ? 'default' : 'secondary'}
                            className={client.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                          >
                            {client.status === 'active' ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                          <div>
                            <span className="text-sm font-medium text-slate-700">CNPJ:</span>
                            <p className="text-slate-900">{client.cnpj}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-slate-700">Email:</span>
                            <p className="text-slate-900">{client.email}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-slate-700">Telefone:</span>
                            <p className="text-slate-900">{client.phone}</p>
                          </div>
                        </div>



                        <div className="flex items-center gap-4 text-sm text-slate-500">
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>Limite mensal: {client.monthlyLimit} entrevistas</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>
                              Contrato: {client.contractStart ? (() => {
                                try {
                                  const date = (client.contractStart as any)?.toDate ? (client.contractStart as any).toDate() : new Date(client.contractStart);
                                  return format(date, "dd/MM/yyyy", { locale: ptBR });
                                } catch {
                                  return "Data inválida";
                                }
                              })() : "N/A"}
                              {client.contractEnd
                                ? (() => {
                                  try {
                                    const date = (client.contractEnd as any)?.toDate ? (client.contractEnd as any).toDate() : new Date(client.contractEnd);
                                    return ` até ${format(date, "dd/MM/yyyy", { locale: ptBR })}`;
                                  } catch {
                                    return " até Data inválida";
                                  }
                                })()
                                : " (indeterminado)"
                              }
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEditClient(client)}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClient(client.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Excluir
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