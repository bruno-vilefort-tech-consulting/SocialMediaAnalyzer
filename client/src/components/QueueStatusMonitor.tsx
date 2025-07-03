import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Activity, AlertCircle, CheckCircle } from "lucide-react";
import { apiRequest } from '@/lib/queryClient';

interface QueueStats {
  dispatchQueue: number;
  messageQueue: number;
  processing: number;
  completed: number;
  failed: number;
  totalJobs: number;
}

interface QueueStatusData {
  success: boolean;
  stats: QueueStats;
  timestamp: string;
}

export function QueueStatusMonitor() {
  const [queueData, setQueueData] = useState<QueueStatusData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchQueueStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiRequest('/api/debug/queues', 'GET');
      const data = await response.json();

      if (data.success) {
        setQueueData(data);
      } else {
        setError('Erro ao obter status das filas');
      }
    } catch (err) {
      console.error('Erro fetching queue status:', err);
      setError('Sistema de filas não disponível');
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh a cada 5 segundos
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchQueueStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // Fetch inicial
  useEffect(() => {
    fetchQueueStatus();
  }, []);

  const getStatusBadge = (count: number, type: string) => {
    if (count === 0) {
      return <Badge variant="outline" className="text-gray-500">0</Badge>;
    }

    switch (type) {
      case 'processing':
        return <Badge variant="default" className="bg-blue-500">{count}</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-500">{count}</Badge>;
      case 'failed':
        return <Badge variant="destructive">{count}</Badge>;
      default:
        return <Badge variant="secondary">{count}</Badge>;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Monitor de Filas Redis
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={autoRefresh ? 'bg-green-50 border-green-200' : ''}
            >
              {autoRefresh ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-1 text-green-600" />
                  Auto
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 mr-1 text-gray-500" />
                  Manual
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchQueueStatus}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">Erro:</span>
              {error}
            </div>
          </div>
        )}

        {queueData ? (
          <div className="space-y-4">
            {/* Status das Filas */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-800">Fila de Dispatch</span>
                  {getStatusBadge(queueData.stats.dispatchQueue, 'dispatch')}
                </div>
                <p className="text-xs text-blue-600 mt-1">Jobs aguardando processamento</p>
              </div>

              <div className="bg-purple-50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-purple-800">Fila de Mensagens</span>
                  {getStatusBadge(queueData.stats.messageQueue, 'messages')}
                </div>
                <p className="text-xs text-purple-600 mt-1">Mensagens aguardando envio</p>
              </div>
            </div>

            {/* Status dos Jobs */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {queueData.stats.processing || 0}
                </div>
                <div className="text-xs text-gray-600">Processando</div>
                {getStatusBadge(queueData.stats.processing || 0, 'processing')}
              </div>

              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {queueData.stats.completed || 0}
                </div>
                <div className="text-xs text-gray-600">Completados</div>
                {getStatusBadge(queueData.stats.completed || 0, 'completed')}
              </div>

              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {queueData.stats.failed || 0}
                </div>
                <div className="text-xs text-gray-600">Falharam</div>
                {getStatusBadge(queueData.stats.failed || 0, 'failed')}
              </div>
            </div>

            {/* Informações Adicionais */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Total de Jobs:</span>
                <span className="font-medium">{queueData.stats.totalJobs || 0}</span>
              </div>
              <div className="flex justify-between items-center text-sm mt-1">
                <span className="text-gray-600">Última Atualização:</span>
                <span className="font-medium">
                  {new Date(queueData.timestamp).toLocaleTimeString('pt-BR')}
                </span>
              </div>
            </div>

            {/* Status Geral */}
            <div className="text-center">
              {(queueData.stats.dispatchQueue + queueData.stats.messageQueue) > 0 ? (
                <Badge variant="default" className="bg-blue-500">
                  Sistema Ativo - {(queueData.stats.dispatchQueue + queueData.stats.messageQueue)} jobs na fila
                </Badge>
              ) : (
                <Badge variant="outline" className="text-green-600 border-green-200">
                  Sistema Inativo - Sem jobs na fila
                </Badge>
              )}
            </div>
          </div>
        ) : loading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-2" />
            <p className="text-gray-500">Carregando status das filas...</p>
          </div>
        ) : (
          <div className="text-center py-8">
            <AlertCircle className="h-8 w-8 mx-auto text-gray-400 mb-2" />
            <p className="text-gray-500">Clique em "Atualizar" para verificar o status</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 