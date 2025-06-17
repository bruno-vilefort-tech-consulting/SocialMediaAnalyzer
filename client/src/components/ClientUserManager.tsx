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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, User, Edit2, Trash2, Mail, Phone, UserCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Schema para usuários do cliente
const clientUserSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  role: z.literal("client"),
  status: z.enum(["active", "inactive"]).default("active"),
});

type ClientUserFormData = z.infer<typeof clientUserSchema>;

interface ClientUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: Date;
  clientId: number;
}

interface ClientUserManagerProps {
  clientId: number | null;
  isVisible: boolean;
}

export default function ClientUserManager({ clientId, isVisible }: ClientUserManagerProps) {
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<ClientUser | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form para criar/editar usuário
  const form = useForm<ClientUserFormData>({
    resolver: zodResolver(clientUserSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "client",
      status: "active",
    }
  });

  // Query para buscar usuários do cliente
  const { data: users = [], isLoading } = useQuery<ClientUser[]>({
    queryKey: [`/api/clients/${clientId}/users`],
    enabled: !!clientId && isVisible,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  // Mutation para criar usuário
  const createUserMutation = useMutation({
    mutationFn: async (userData: ClientUserFormData) => {
      if (!clientId) throw new Error("Cliente não selecionado");
      return apiRequest(`/api/clients/${clientId}/users`, "POST", userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/users`] });
      form.reset();
      setShowAddUserForm(false);
      toast({
        title: "Usuário criado",
        description: "Usuário criado com sucesso para o cliente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar usuário",
        description: error.message || "Erro interno do servidor",
        variant: "destructive",
      });
    },
  });

  // Mutation para atualizar usuário
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, userData }: { userId: string; userData: Partial<ClientUserFormData> }) => {
      if (!clientId) throw new Error("Cliente não selecionado");
      return apiRequest(`/api/clients/${clientId}/users/${userId}`, "PATCH", userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/users`] });
      form.reset();
      setEditingUser(null);
      toast({
        title: "Usuário atualizado",
        description: "Dados do usuário atualizados com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar usuário",
        description: error.message || "Erro interno do servidor",
        variant: "destructive",
      });
    },
  });

  // Mutation para deletar usuário
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!clientId) throw new Error("Cliente não selecionado");
      return apiRequest(`/api/clients/${clientId}/users/${userId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/users`] });
      toast({
        title: "Usuário deletado",
        description: "Usuário removido com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao deletar usuário",
        description: error.message || "Erro interno do servidor",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ClientUserFormData) => {
    if (editingUser) {
      updateUserMutation.mutate({
        userId: editingUser.id,
        userData: data,
      });
    } else {
      createUserMutation.mutate(data);
    }
  };

  const handleEdit = (user: ClientUser) => {
    setEditingUser(user);
    form.reset({
      name: user.name,
      email: user.email,
      password: "", // Não preencher senha por segurança
      role: "client",
      status: user.status as "active" | "inactive",
    });
    setShowAddUserForm(true);
  };

  const handleDelete = (userId: string) => {
    if (window.confirm("Tem certeza que deseja deletar este usuário?")) {
      deleteUserMutation.mutate(userId);
    }
  };

  const cancelForm = () => {
    form.reset();
    setEditingUser(null);
    setShowAddUserForm(false);
  };

  if (!isVisible || !clientId) {
    return null;
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Usuários do Cliente
          </CardTitle>
          <Button
            onClick={() => setShowAddUserForm(true)}
            size="sm"
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Adicionar Usuário
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Formulário de Adicionar/Editar Usuário */}
        {showAddUserForm && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-lg">
                {editingUser ? "Editar Usuário" : "Novo Usuário"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome Completo *</FormLabel>
                          <FormControl>
                            <Input placeholder="Digite o nome completo" {...field} />
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
                            <Input type="email" placeholder="usuario@email.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {editingUser ? "Nova Senha (deixe vazio para manter)" : "Senha *"}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder={editingUser ? "Nova senha..." : "Senha do usuário"}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
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

                  <div className="flex gap-2 pt-4">
                    <Button
                      type="submit"
                      disabled={createUserMutation.isPending || updateUserMutation.isPending}
                      className="flex items-center gap-2"
                    >
                      <UserCheck className="w-4 h-4" />
                      {editingUser ? "Atualizar Usuário" : "Criar Usuário"}
                    </Button>
                    <Button type="button" variant="outline" onClick={cancelForm}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Lista de Usuários */}
        <div>
          <h3 className="text-sm font-medium mb-3 text-slate-600">
            Usuários Cadastrados ({users.length})
          </h3>
          
          {isLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-slate-500 mt-2">Carregando usuários...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 border border-dashed rounded-lg">
              <User className="h-8 w-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Nenhum usuário cadastrado</p>
              <p className="text-xs text-slate-400">Clique em "Adicionar Usuário" para começar</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-slate-400" />
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.status === "active" ? "default" : "secondary"}>
                          {user.status === "active" ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {format(new Date(user.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(user)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(user.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}