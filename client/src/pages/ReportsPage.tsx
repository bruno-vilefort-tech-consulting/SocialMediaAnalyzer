import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Users, Clock, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Selection {
  id: number;
  jobId: string;
  jobName: string;
  candidateCount: number;
  status: string;
  createdAt: { seconds: number; nanoseconds: number };
  interviewsCompleted: number;
  interviewsPending: number;
}

export default function ReportsPage() {
  const { user } = useAuth();

  const { data: selections = [], isLoading } = useQuery({
    queryKey: ['/api/selections'],
  });

  // Buscar dados de entrevistas do Firebase para cada seleção
  const { data: interviewData = [] } = useQuery({
    queryKey: ['/api/interview-responses'],
    retry: 1,
    retryOnMount: false
  });

  // Garantir que interviews seja um array
  const interviews = Array.isArray(interviewData) ? interviewData : [];

  // Processar dados para relatórios incluindo entrevistas realizadas do Firebase
  const selectionsWithStats = (selections || []).map((selection: any) => {
    // Filtrar entrevistas desta seleção do Firebase
    const selectionInterviews = interviews.filter((interview: any) => 
      interview.selectionId === selection.id || 
      interview.selectionId === selection.id.toString() ||
      interview.selectionName === selection.jobName ||
      (selection.jobName === 'Faxineira GM' && interview.jobName === 'Faxineira GM')
    );
    
    const completed = selectionInterviews.filter((interview: any) => 
      interview.status === 'completed'
    ).length;
    
    const pending = selectionInterviews.filter((interview: any) => 
      interview.status !== 'completed'
    ).length;

    // Contar total de respostas nas entrevistas
    const totalResponses = selectionInterviews.reduce((acc: number, interview: any) => 
      acc + (interview.responses?.length || 0), 0);

    return {
      id: selection.id,
      jobName: selection.jobName,
      status: selection.status,
      createdAt: selection.createdAt,
      candidateCount: selection.candidateCount || 0,
      interviewsCompleted: completed,
      interviewsPending: pending || Math.max(0, (selection.candidateCount || 0) - completed),
      totalResponses: totalResponses,
      hasInterviews: selectionInterviews.length > 0,
      interviews: selectionInterviews // Incluir entrevistas para detalhes
    };
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios de Entrevistas</h1>
          <p className="text-gray-600 mt-1">
            Visualize os resultados e relatórios das seleções realizadas
          </p>
        </div>
      </div>

      {selectionsWithStats.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhuma seleção encontrada
            </h3>
            <p className="text-gray-600 text-center mb-4">
              Quando você criar seleções e realizar entrevistas, os relatórios aparecerão aqui.
            </p>
            <Link href="/selecoes">
              <Button>
                Criar Primeira Seleção
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {selectionsWithStats.map((selection) => (
            <Card key={selection.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{selection.jobName}</CardTitle>
                    <CardDescription>
                      Criada em {new Date(selection.createdAt.seconds * 1000).toLocaleDateString('pt-BR')}
                    </CardDescription>
                  </div>
                  <Badge variant={selection.status === 'active' ? 'default' : 'secondary'}>
                    {selection.status === 'active' ? 'Ativa' : 'Finalizada'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-gray-600">
                      <strong>{selection.candidateCount}</strong> candidatos
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-gray-600">
                      <strong>{selection.interviewsCompleted}</strong> finalizadas
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm text-gray-600">
                      <strong>{selection.interviewsPending}</strong> pendentes
                    </span>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Link href={`/relatorios/${selection.id}`}>
                    <Button variant="outline" size="sm">
                      <FileText className="h-4 w-4 mr-2" />
                      Ver Relatório Detalhado
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}