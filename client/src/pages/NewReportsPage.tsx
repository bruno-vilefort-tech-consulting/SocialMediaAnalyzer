import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, ArrowLeft, Users, BarChart3, Star } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface Selection {
  id: number;
  name: string;
  status: string;
  createdAt: any;
  jobName?: string;
  clientId: number;
}

interface Candidate {
  id: number;
  name: string;
  email: string;
  phone: string;
}

export default function NewReportsPage() {
  const { user } = useAuth();
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedSelection, setSelectedSelection] = useState<Selection | null>(null);
  const [activeTab, setActiveTab] = useState('candidatos');

  // Buscar clientes (apenas para masters)
  const { data: clients = [] } = useQuery({
    queryKey: ['/api/clients'],
    enabled: user?.role === 'master'
  });

  // Buscar seleções
  const { data: selectionsData = [], isLoading: loadingSelections } = useQuery({
    queryKey: ['/api/selections', selectedClientId],
    enabled: !!selectedClientId || user?.role === 'client'
  });

  // Ordenar seleções da mais nova para a mais velha
  const selections = [...selectionsData].sort((a, b) => {
    const dateA = a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(a.createdAt);
    const dateB = b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(b.createdAt);
    return dateB.getTime() - dateA.getTime(); // Mais nova primeiro
  });

  // Buscar candidatos da seleção (para aba Candidatos)
  const { data: candidates = [], isLoading: loadingCandidates } = useQuery({
    queryKey: ['/api/lists', selectedSelection?.candidateListId, 'candidates'],
    enabled: !!selectedSelection?.candidateListId
  });

  // Definir cliente padrão para usuários cliente
  React.useEffect(() => {
    if (user?.role === 'client' && user.clientId) {
      setSelectedClientId(user.clientId.toString());
    }
  }, [user]);

  // Ordenar candidatos alfabeticamente
  const sortedCandidates = [...(candidates || [])].sort((a, b) => 
    a.name.localeCompare(b.name)
  );

  // Se nenhuma seleção foi escolhida, mostrar lista de seleções
  if (!selectedSelection) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
        </div>

        {user?.role === 'master' && (
          <Card>
            <CardHeader>
              <CardTitle>Selecionar Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente para visualizar relatórios" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client: any) => (
                    <SelectItem key={client.id} value={client.id.toString()}>
                      {client.nomeEmpresa}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {selectedClientId && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Seleções Disponíveis</h2>
            
            {loadingSelections ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            ) : selections.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhuma seleção encontrada</h3>
                  <p className="text-muted-foreground text-center">
                    Não há seleções disponíveis para análise.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {selections.map((selection: Selection) => (
                  <Card 
                    key={selection.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-300"
                    onClick={() => setSelectedSelection(selection)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-lg">{selection.name}</h3>
                            <Badge variant={selection.status === 'enviado' ? 'default' : 'secondary'}>
                              {selection.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Vaga: {selection.jobName || 'Não identificada'}
                          </p>
                        </div>
                        
                        <Button variant="outline">
                          Ver Relatório
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Mostrar relatório da seleção com abas
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button 
          variant="outline" 
          onClick={() => setSelectedSelection(null)}
          className="flex items-center space-x-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar</span>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{selectedSelection.name}</h1>
          <p className="text-muted-foreground">
            ID: {selectedSelection.id} • Vaga: {selectedSelection.jobName || 'Não identificada'}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="candidatos" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Candidatos
          </TabsTrigger>
          <TabsTrigger value="analise" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Análise
          </TabsTrigger>
          <TabsTrigger value="selecionados" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            Selecionados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="candidatos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Candidatos da Seleção</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingCandidates ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                </div>
              ) : sortedCandidates.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum candidato encontrado</h3>
                  <p className="text-muted-foreground">Esta seleção não possui candidatos.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {sortedCandidates.map((candidate: Candidate) => (
                    <Card key={candidate.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <h4 className="font-medium">{candidate.name}</h4>
                          <p className="text-sm text-muted-foreground truncate">{candidate.email}</p>
                          <p className="text-sm text-muted-foreground">{candidate.phone}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analise" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Análise dos Resultados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Análise será implementada conforme suas especificações.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="selecionados" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Candidatos Selecionados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Sistema de selecionados será implementado conforme suas especificações.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}