import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Folder, FolderOpen, Settings, Trash2, MoreVertical, GripVertical, FileText, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface ReportFolder {
  id: string;
  name: string;
  clientId: string;
  color: string;
  position: number;
  createdAt: any;
  updatedAt: any;
}

interface Report {
  id: string;
  selectionId: string;
  selectionName: string;
  jobName: string;
  clientId: number;
  clientName: string;
  candidateListName: string;
  totalCandidates: number;
  completedInterviews: number;
  createdAt: any;
}

interface FolderAssignment {
  id: string;
  reportId: string;
  folderId: string;
  assignedAt: any;
}

interface ReportFoldersManagerProps {
  selectedClientId: string;
  reports: Report[];
  onReportSelect: (report: Report) => void;
  onFilterChange: (filteredReports: Report[]) => void;
}

export default function ReportFoldersManager({ selectedClientId, reports, onReportSelect, onFilterChange }: ReportFoldersManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<ReportFolder | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<ReportFolder | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#3b82f6');
  const [draggedReport, setDraggedReport] = useState<Report | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('general');

  // Cores disponíveis para pastas
  const folderColors = [
    { name: 'Azul', value: '#3B82F6' },
    { name: 'Verde', value: '#10B981' },
    { name: 'Amarelo', value: '#F59E0B' },
    { name: 'Vermelho', value: '#EF4444' },
    { name: 'Roxo', value: '#8B5CF6' },
    { name: 'Rosa', value: '#EC4899' },
    { name: 'Laranja', value: '#F97316' },
    { name: 'Cinza', value: '#6B7280' }
  ];

  // Fetch folders
  const { data: folders = [], isLoading: loadingFolders } = useQuery({
    queryKey: ['/api/report-folders', selectedClientId],
    queryFn: async () => {
      const response = await apiRequest('/api/report-folders', 'GET');
      return response.json();
    },
    enabled: !!selectedClientId
  });

  // Fetch folder assignments
  const { data: assignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ['/api/report-folder-assignments', selectedClientId],
    queryFn: async () => {
      const response = await apiRequest('/api/report-folder-assignments', 'GET');
      return response.json();
    },
    enabled: !!selectedClientId
  });

  // Update folder mutation
  const updateFolderMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; color: string }) => {
      const response = await apiRequest(`/api/report-folders/${data.id}`, 'PUT', {
        name: data.name,
        color: data.color
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Pasta atualizada com sucesso!" });
      setIsEditDialogOpen(false);
      setSelectedFolder(null);
      queryClient.invalidateQueries({ queryKey: ['/api/report-folders'] });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar pasta", variant: "destructive" });
    }
  });

  // Delete folder mutation
  const deleteFolderMutation = useMutation({
    mutationFn: async (folderId: string) => {
      const response = await apiRequest(`/api/report-folders/${folderId}`, 'DELETE');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Pasta deletada com sucesso!" });
      setFolderToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['/api/report-folders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/report-folder-assignments'] });
      // Reset to general filter if deleted folder was active
      if (folderToDelete && activeFilter === folderToDelete.id) {
        setActiveFilter('general');
      }
    },
    onError: () => {
      toast({ title: "Erro ao deletar pasta", variant: "destructive" });
    }
  });

  // Assign report to folder mutation
  const assignReportMutation = useMutation({
    mutationFn: async (data: { reportId: string; folderId: string }) => {
      const response = await apiRequest('/api/report-folders/assign', 'POST', data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Relatório movido para a pasta!" });
      queryClient.invalidateQueries({ queryKey: ['/api/report-folder-assignments'] });
    },
    onError: () => {
      toast({ title: "Erro ao mover relatório", variant: "destructive" });
    }
  });

  // Remove report from folder mutation
  const removeReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const response = await apiRequest(`/api/report-folders/assign/${reportId}`, 'DELETE');
      return response.json();
    },
    onSuccess: (data, reportId) => {
      toast({ title: "Relatório removido da pasta!" });
      queryClient.invalidateQueries({ queryKey: ['/api/report-folder-assignments'] });

      // Força atualização do filtro atual
      setTimeout(() => {
        applyFilter(activeFilter);
      }, 100);
    },
    onError: () => {
      toast({ title: "Erro ao remover relatório", variant: "destructive" });
    }
  });

  // Get reports in folder
  const getReportsInFolder = (folderId: string): Report[] => {
    const folderAssignments = assignments.filter(a => a.folderId === folderId);
    return folderAssignments
      .map(assignment => reports.find(r => r.id === assignment.reportId))
      .filter(Boolean) as Report[];
  };

  // Get unorganized reports (not in any folder)
  const getUnorganizedReports = (): Report[] => {
    const assignedReportIds = new Set(assignments.map(a => a.reportId));
    const unorganized = reports.filter(r => !assignedReportIds.has(r.id));
    return unorganized;
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, report: Report) => {
    setDraggedReport(report);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', report.id);
  };

  const handleDragOver = (e: React.DragEvent, folderId?: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolder(folderId || 'general');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Check if we're actually leaving the drop zone
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverFolder(null);
    }
  };

  const handleDrop = (e: React.DragEvent, folderId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolder(null);

    const reportId = e.dataTransfer.getData('text/plain');

    if (!reportId) {
      return;
    }

    // Handle drop in "Geral" (remove from all folders)
    if (folderId === 'general') {
      const currentAssignment = assignments.find(a => a.reportId === reportId);
      removeReportMutation.mutate(reportId);
      return;
    }

    if (!folderId) {
      return;
    }

    // Check if report is already in this folder
    const isAlreadyInFolder = assignments.some(a => a.reportId === reportId && a.folderId === folderId);
    const currentAssignment = assignments.find(a => a.reportId === reportId);

    if (isAlreadyInFolder) {
      toast({ title: "Relatório já está nesta pasta", variant: "destructive" });
      return;
    }

    // Assign to folder (API will handle moving from other folders)
    assignReportMutation.mutate({ reportId, folderId });
  };

  const handleEditFolder = () => {
    if (!selectedFolder || !newFolderName.trim()) return;

    updateFolderMutation.mutate({
      id: selectedFolder.id,
      name: newFolderName.trim(),
      color: newFolderColor
    });
  };

  // Filter logic
  const applyFilter = (filter: string) => {
    setActiveFilter(filter);

    if (filter === 'general') {
      // Show only reports that are NOT in any folder (truly unorganized)
      const assignedReportIds = assignments.map(a => a.reportId);
      const unassignedReports = reports.filter(r => !assignedReportIds.includes(r.id));
      onFilterChange(unassignedReports);
    } else {
      // Show reports in specific folder
      const folderAssignments = assignments.filter(a => a.folderId === filter);
      const folderReportIds = folderAssignments.map(a => a.reportId);
      const folderReports = reports.filter(r => folderReportIds.includes(r.id));
      onFilterChange(folderReports);
    }
  };

  // Apply filter when data changes
  useEffect(() => {
    if (!reports || !assignments) {
      return;
    }

    applyFilter(activeFilter);
  }, [reports?.length, assignments?.length, activeFilter]);

  if (!selectedClientId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Selecione um cliente para visualizar as pastas de trabalho
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Buttons */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Geral button - left aligned */}
        <div
          className={`relative p-2 rounded-lg border-2 transition-all duration-200 min-h-[50px] ${dragOverFolder === 'general' ? 'border-blue-500 bg-blue-100 scale-105 shadow-lg' : 'border-transparent'
            }`}
          onDragOver={(e) => handleDragOver(e, 'general')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'general')}
        >
          <Button
            variant={activeFilter === 'general' ? 'default' : 'outline'}
            onClick={() => applyFilter('general')}
            className={`flex items-center gap-2 w-full transition-all duration-200 hover:shadow-md ${activeFilter === 'general'
              ? 'bg-gray-700 text-white shadow-lg border-gray-700'
              : 'bg-gray-50 hover:bg-gray-100 border-gray-300'
              }`}
          >
            <FileText
              className="w-4 h-4"
              fill={activeFilter === 'general' ? 'white' : 'none'}
            />
            <span className="font-medium">Geral</span>
            <Badge
              variant="secondary"
              className={`text-xs ml-1 transition-colors ${activeFilter === 'general'
                ? 'bg-gray-600 text-gray-100'
                : 'bg-gray-200 text-gray-700'
                }`}
            >
              {getUnorganizedReports().length}
            </Badge>
          </Button>
        </div>

        {/* Folder filter buttons */}
        {folders.map((folder) => {
          const reportsInFolder = getReportsInFolder(folder.id);
          const isDragOver = dragOverFolder === folder.id;

          return (
            <div
              key={folder.id}
              className={`relative rounded-lg border-2 transition-all duration-200 ${isDragOver ? 'border-blue-500 bg-blue-50 scale-[1.02] shadow-lg' : 'border-transparent'
                }`}
              onDragOver={(e) => handleDragOver(e, folder.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, folder.id)}
            >
              <div className="relative group">
                <Button
                  variant={activeFilter === folder.id ? 'default' : 'outline'}
                  onClick={() => applyFilter(folder.id)}
                  className={`flex items-center gap-2 w-full pr-12 transition-all duration-200 hover:shadow-md ${activeFilter === folder.id ? 'shadow-lg' : ''
                    }`}
                  style={{
                    borderColor: folder.color,
                    backgroundColor: activeFilter === folder.id ? `${folder.color}20` : 'transparent',
                    color: activeFilter === folder.id ? folder.color : undefined
                  }}
                >
                  <Folder
                    className="w-4 h-4"
                    style={{ color: folder.color }}
                    fill={activeFilter === folder.id ? folder.color : 'none'}
                  />
                  <span className="font-medium">{folder.name}</span>
                  <Badge
                    variant="secondary"
                    className="text-xs ml-1 bg-gray-100 text-gray-700"
                  >
                    {reportsInFolder.length}
                  </Badge>
                </Button>

                {/* Botões de ação integrados no canto direito */}
                <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200">
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFolder(folder);
                        setNewFolderName(folder.name);
                        setNewFolderColor(folder.color);
                        setIsEditDialogOpen(true);
                      }}
                      className="h-6 w-6 p-0 hover:bg-blue-100 hover:text-blue-600 transition-all duration-200 rounded"
                      title="Configurar pasta"
                    >
                      <Settings className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFolderToDelete(folder);
                      }}
                      className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600 transition-all duration-200 rounded"
                      title="Excluir pasta"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit folder dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Pasta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome da Pasta</label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Digite o nome da pasta"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Cor da Pasta</label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {folderColors.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setNewFolderColor(color.value)}
                    className={`w-12 h-12 rounded-lg border-2 transition-all ${newFolderColor === color.value ? 'border-gray-900 scale-110' : 'border-gray-300'
                      }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleEditFolder}
                disabled={!newFolderName.trim() || updateFolderMutation.isPending}
                className="flex-1"
              >
                Salvar Alterações
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!folderToDelete} onOpenChange={() => setFolderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar a pasta "{folderToDelete?.name}"?
              Todos os relatórios nesta pasta voltarão para a seção "Geral".
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => folderToDelete && deleteFolderMutation.mutate(folderToDelete.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Deletar Pasta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}