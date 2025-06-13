import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Building, Edit, Trash2, Filter } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Client } from "@shared/schema";

export default function ClientsPage() {
  const [searchTerm, setSearchTerm] = useState("");
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
        <Button>
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
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Cliente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map((client) => (
            <Card key={client.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Building className="text-primary" />
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="ghost" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDeleteClient(client.id)}
                      disabled={deleteClientMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{client.companyName}</h3>
                <p className="text-sm text-slate-600 mb-4">{client.email}</p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">CNPJ:</span>
                    <span className="text-slate-900">{client.cnpj}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Limite Mensal:</span>
                    <span className="text-slate-900">{client.monthlyLimit}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Status:</span>
                    <Badge 
                      variant={client.status === "active" ? "default" : "secondary"}
                      className={client.status === "active" ? "bg-green-100 text-green-800" : ""}
                    >
                      {client.status === "active" ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
