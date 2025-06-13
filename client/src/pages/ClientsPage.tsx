import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Building, Edit, Trash2, Filter, Calendar, Users } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ClientModal from "@/components/ClientModal";
import type { Client } from "@shared/schema";

export default function ClientsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const deleteClientMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/clients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Cliente removido",
        description: "Cliente foi removido com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao remover cliente",
        variant: "destructive",
      });
    },
  });

  const filteredClients = clients.filter(client =>
    client.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.cnpj.includes(searchTerm)
  );

  const handleDeleteClient = (id: number) => {
    if (confirm("Tem certeza que deseja remover este cliente?")) {
      deleteClientMutation.mutate(id);
    }
  };

  const handleOpenModal = (client?: Client) => {
    setSelectedClient(client || null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedClient(null);
    setIsModalOpen(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Gerenciar Clientes</h2>
            <p className="text-slate-600">Administrar clientes corporativos e seus limites</p>
          </div>
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Novo Cliente
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-slate-200 rounded mb-4"></div>
                <div className="h-4 bg-slate-200 rounded mb-2"></div>
                <div className="h-4 bg-slate-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Gerenciar Clientes</h2>
          <p className="text-slate-600">Administrar clientes corporativos e seus limites</p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Cliente
        </Button>
      </div>
      
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary">
              <option>Todos os Status</option>
              <option>Ativo</option>
              <option>Inativo</option>
              <option>Suspenso</option>
            </select>
            <select className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary">
              <option>Plano</option>
              <option>Básico</option>
              <option>Profissional</option>
              <option>Enterprise</option>
            </select>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              Filtrar
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Clients Grid */}
      {filteredClients.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Building className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhum cliente encontrado</h3>
            <p className="text-slate-500 mb-4">
              {searchTerm ? "Tente ajustar os filtros de busca" : "Comece adicionando seu primeiro cliente"}
            </p>
            <Button onClick={() => handleOpenModal()}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Cliente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredClients.map((client) => (
            <Card key={client.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  {/* Lado esquerdo - Ícone e informações principais */}
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Building className="text-primary h-5 w-5" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-slate-900 truncate">{client.companyName}</h3>
                      <p className="text-sm text-slate-600">{client.email}</p>
                    </div>
                  </div>

                  {/* Centro - Informações dos limites e contrato */}
                  <div className="hidden md:flex items-center space-x-8 text-sm">
                    <div className="text-center">
                      <p className="text-slate-500 text-xs">CNPJ</p>
                      <p className="font-mono text-slate-900">{client.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}</p>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-slate-500 text-xs">Limite Mensal</p>
                      <div className="flex items-center justify-center space-x-1">
                        <Users className="h-3 w-3 text-slate-400" />
                        <span className="font-medium text-slate-900">{client.monthlyLimit}</span>
                      </div>
                    </div>

                    {client.additionalLimit && client.additionalLimit > 0 && (
                      <div className="text-center">
                        <p className="text-slate-500 text-xs">Limite Extra</p>
                        <div className="flex items-center justify-center space-x-1">
                          <Plus className="h-3 w-3 text-blue-500" />
                          <span className="font-medium text-blue-600">{client.additionalLimit}</span>
                        </div>
                      </div>
                    )}

                    <div className="text-center">
                      <p className="text-slate-500 text-xs">Contrato</p>
                      <div className="flex items-center justify-center space-x-1">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        <span className="text-slate-900 text-xs">
                          {client.contractStart 
                            ? format(new Date(client.contractStart), "dd/MM/yyyy", { locale: ptBR })
                            : "Não definido"
                          }
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Lado direito - Status e ações */}
                  <div className="flex items-center space-x-3">
                    <Badge 
                      variant={client.status === "active" ? "default" : "secondary"}
                      className={client.status === "active" ? "bg-green-100 text-green-800 border-green-200" : ""}
                    >
                      {client.status === "active" ? "Ativo" : "Inativo"}
                    </Badge>

                    <div className="flex space-x-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleOpenModal(client)}
                        title="Editar cliente"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDeleteClient(client.id)}
                        disabled={deleteClientMutation.isPending}
                        title="Remover cliente"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Informações extras para mobile */}
                <div className="md:hidden mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-500">CNPJ: </span>
                    <span className="font-mono text-slate-900">{client.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Limite: </span>
                    <span className="font-medium text-slate-900">{client.monthlyLimit}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Cadastro/Edição */}
      <ClientModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        client={selectedClient}
      />
    </div>
  );
}
