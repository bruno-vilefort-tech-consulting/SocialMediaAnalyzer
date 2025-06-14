import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Search, Briefcase } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Job {
  id: string;
  nomeVaga: string;
  descricaoVaga: string;
  status: string;
  clientId: number;
  createdAt: string;
}

export default function CadastroVagasPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [nomeVaga, setNomeVaga] = useState("");
  const [descricaoVaga, setDescricaoVaga] = useState("");
  const [status, setStatus] = useState("ativo");
  const [clientId, setClientId] = useState<number | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Buscar vagas
  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  // Buscar clientes (apenas para master)
  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
    enabled: user?.role === 'master',
  });

  // Mutation para criar vaga
  const createJobMutation = useMutation({
    mutationFn: async (jobData: any) => {
      return apiRequest("/api/jobs", {
        method: "POST",
        body: JSON.stringify(jobData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Sucesso",
        description: "Vaga criada com sucesso!",
      });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar vaga",
        variant: "destructive",
      });
    },
  });

  // Mutation para atualizar vaga
  const updateJobMutation = useMutation({
    mutationFn: async ({ id, ...jobData }: any) => {
      return apiRequest(`/api/jobs/${id}`, {
        method: "PATCH",
        body: JSON.stringify(jobData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Sucesso",
        description: "Vaga atualizada com sucesso!",
      });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar vaga",
        variant: "destructive",
      });
    },
  });

  // Mutation para deletar vaga
  const deleteJobMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/jobs/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Sucesso",
        description: "Vaga deletada com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao deletar vaga",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setNomeVaga("");
    setDescricaoVaga("");
    setStatus("ativo");
    setClientId(null);
    setEditingJob(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = () => {
    if (!nomeVaga.trim()) {
      toast({
        title: "Erro",
        description: "Nome da vaga é obrigatório",
        variant: "destructive",
      });
      return;
    }

    const jobData = {
      nomeVaga: nomeVaga.trim(),
      descricaoVaga: descricaoVaga.trim(),
      status,
      ...(user?.role === 'master' && clientId && { clientId }),
    };

    if (editingJob) {
      updateJobMutation.mutate({ id: editingJob.id, ...jobData });
    } else {
      createJobMutation.mutate(jobData);
    }
  };

  const handleEdit = (job: Job) => {
    setEditingJob(job);
    setNomeVaga(job.nomeVaga);
    setDescricaoVaga(job.descricaoVaga);
    setStatus(job.status);
    setClientId(job.clientId);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteJobMutation.mutate(id);
  };

  const filteredJobs = jobs.filter(job =>
    job.nomeVaga.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.descricaoVaga.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'ativo':
        return 'default';
      case 'inativo':
        return 'secondary';
      case 'pausado':
        return 'outline';
      default:
        return 'default';
    }
  };

  const getClientName = (clientId: number) => {
    const client = clients.find((c: any) => c.id === clientId);
    return client ? client.companyName : 'Cliente não encontrado';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Briefcase className="h-8 w-8 text-primary" />
            Cadastrar Vagas
          </h1>
          <p className="text-muted-foreground">Gerencie as vagas disponíveis</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              resetForm();
              setIsDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Vaga
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {editingJob ? "Editar Vaga" : "Nova Vaga"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="nomeVaga">Nome da Vaga *</Label>
                <Input
                  id="nomeVaga"
                  value={nomeVaga}
                  onChange={(e) => setNomeVaga(e.target.value)}
                  placeholder="Ex: Desenvolvedor Full Stack"
                />
              </div>

              <div>
                <Label htmlFor="descricaoVaga">Descrição da Vaga</Label>
                <Textarea
                  id="descricaoVaga"
                  value={descricaoVaga}
                  onChange={(e) => setDescricaoVaga(e.target.value)}
                  placeholder="Descreva os requisitos e responsabilidades da vaga..."
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                    <SelectItem value="pausado">Pausado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {user?.role === 'master' && (
                <div>
                  <Label htmlFor="clientId">Cliente</Label>
                  <Select value={clientId?.toString() || ""} onValueChange={(value) => setClientId(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client: any) => (
                        <SelectItem key={client.id} value={client.id.toString()}>
                          {client.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={createJobMutation.isPending || updateJobMutation.isPending}
              >
                {editingJob ? "Atualizar" : "Criar"} Vaga
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Vagas</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jobs.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vagas Ativas</CardTitle>
            <Briefcase className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {jobs.filter(job => job.status === 'ativo').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vagas Inativas</CardTitle>
            <Briefcase className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {jobs.filter(job => job.status === 'inativo').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Busca */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4" />
            <Input
              placeholder="Buscar vagas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
      </Card>

      {/* Tabela de Vagas */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Vagas</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredJobs.length === 0 ? (
            <div className="text-center py-8">
              <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm ? "Nenhuma vaga encontrada com esse termo de busca" : "Nenhuma vaga cadastrada"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome da Vaga</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Status</TableHead>
                    {user?.role === 'master' && <TableHead>Cliente</TableHead>}
                    <TableHead>Data de Criação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">{job.nomeVaga}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {job.descricaoVaga || "Sem descrição"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(job.status)}>
                          {job.status}
                        </Badge>
                      </TableCell>
                      {user?.role === 'master' && (
                        <TableCell>{getClientName(job.clientId)}</TableCell>
                      )}
                      <TableCell>
                        {new Date(job.createdAt).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(job)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja deletar a vaga "{job.nomeVaga}"? 
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(job.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Deletar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}