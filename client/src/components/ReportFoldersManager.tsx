import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Folder, FolderOpen, FolderPlus, Edit3, Trash2, MoreVertical, GripVertical, FileText, X } from 'lucide-react';
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
}

export default function ReportFoldersManager({ selectedClientId, reports, onReportSelect }: ReportFoldersManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<ReportFolder | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<ReportFolder | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#3b82f6');
  const [draggedReport, setDraggedReport] = useState<Report | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Fetch folders
  const { data: folders = [], isLoading: loadingFolders } = useQuery({
    queryKey: ['/api/report-folders', selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const params = user?.role === 'master' ? `?clientId=${selectedClientId}` : '';
      const response = await apiRequest(`/api/report-folders${params}`, 'GET');
      return response.json();
    },
    enabled: !!selectedClientId
  });

  // Fetch folder assignments
  const { data: assignments = [] } = useQuery({
    queryKey: ['/api/report-folder-assignments', selectedClientId],
    queryFn: async () => {
      if (!selectedClientId || !folders.length) return [];
      
      const allAssignments: FolderAssignment[] = [];
      for (const folder of folders) {
        try {
          const response = await apiRequest(`/api/report-folders/${folder.id}/reports`, 'GET');
          const folderAssignments = await response.json();
          allAssignments.push(...folderAssignments);
        } catch (error) {
          console.error(`Error fetching assignments for folder ${folder.id}:`, error);
        }
      }
      return allAssignments;
    },
    enabled: !!selectedClientId && folders.length > 0
  });

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async (data: { name: string; color: string; clientId: string }) => {
      const response = await apiRequest('/api/report-folders', 'POST', data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Pasta criada com sucesso!" });
      setIsCreateDialogOpen(false);
      setNewFolderName('');
      setNewFolderColor('#3b82f6');
      queryClient.invalidateQueries({ queryKey: ['/api/report-folders'] });
    },
    onError: () => {
      toast({ title: "Erro ao criar pasta", variant: "destructive" });
    }
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
    onSuccess: () => {
      toast({ title: "Relatório removido da pasta!" });
      queryClient.invalidateQueries({ queryKey: ['/api/report-folder-assignments'] });
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
    return reports.filter(r => !assignedReportIds.has(r.id));
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, report: Report) => {
    setDraggedReport(report);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, folderId?: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolder(folderId || 'unorganized');
  };

  const handleDragLeave = () => {
    setDragOverFolder(null);
  };

  const handleDrop = (e: React.DragEvent, folderId?: string) => {
    e.preventDefault();
    setDragOverFolder(null);
    
    if (!draggedReport) return;

    if (folderId) {
      // Move to folder
      assignReportMutation.mutate({
        reportId: draggedReport.id,
        folderId
      });
    } else {
      // Remove from folder (move to unorganized)
      removeReportMutation.mutate(draggedReport.id);
    }
    
    setDraggedReport(null);
  };

  const toggleFolderExpansion = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    
    createFolderMutation.mutate({
      name: newFolderName.trim(),
      color: newFolderColor,
      clientId: selectedClientId
    });
  };

  const handleEditFolder = () => {
    if (!selectedFolder || !newFolderName.trim()) return;
    
    updateFolderMutation.mutate({
      id: selectedFolder.id,
      name: newFolderName.trim(),
      color: newFolderColor
    });
  };

  const folderColors = [
    { name: 'Azul', value: '#3b82f6' },
    { name: 'Verde', value: '#10b981' },
    { name: 'Roxo', value: '#8b5cf6' },
    { name: 'Rosa', value: '#ec4899' },
    { name: 'Amarelo', value: '#f59e0b' },
    { name: 'Vermelho', value: '#ef4444' },
    { name: 'Laranja', value: '#f97316' },
    { name: 'Cinza', value: '#6b7280' }
  ];

  if (!selectedClientId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Selecione um cliente para visualizar as pastas de trabalho
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Pastas de Trabalho</h2>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <FolderPlus className="w-4 h-4" />
              Nova Pasta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Pasta</DialogTitle>
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
                      className={`w-12 h-12 rounded-lg border-2 transition-all ${
                        newFolderColor === color.value ? 'border-gray-900 scale-110' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim() || createFolderMutation.isPending}
                  className="flex-1"
                >
                  Criar Pasta
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsCreateDialogOpen(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loadingFolders ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Folders */}
          {folders.map((folder) => {
            const reportsInFolder = getReportsInFolder(folder.id);
            const isExpanded = expandedFolders.has(folder.id);
            const isDragOver = dragOverFolder === folder.id;
            
            return (
              <Card 
                key={folder.id}
                className={`transition-all duration-200 ${
                  isDragOver ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                }`}
                onDragOver={(e) => handleDragOver(e, folder.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, folder.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleFolderExpansion(folder.id)}
                        className="flex items-center gap-2 hover:bg-gray-100 p-2 rounded-lg transition-colors"
                      >
                        {isExpanded ? (
                          <FolderOpen className="w-6 h-6" style={{ color: folder.color }} />
                        ) : (
                          <Folder className="w-6 h-6" style={{ color: folder.color }} />
                        )}
                        <span className="font-semibold">{folder.name}</span>
                      </button>
                      <Badge variant="secondary" className="text-xs">
                        {reportsInFolder.length} relatórios
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedFolder(folder);
                          setNewFolderName(folder.name);
                          setNewFolderColor(folder.color);
                          setIsEditDialogOpen(true);
                        }}
                        className="h-8 w-8 p-0"
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFolderToDelete(folder)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                {isExpanded && (
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {reportsInFolder.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                          Arraste relatórios aqui para organizá-los
                        </div>
                      ) : (
                        reportsInFolder.map((report) => (
                          <div
                            key={report.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, report)}
                            className="group p-3 border rounded-lg hover:bg-gray-50 cursor-move transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <GripVertical className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                                <FileText className="w-4 h-4 text-blue-500" />
                                <div>
                                  <div className="font-medium">{report.selectionName}</div>
                                  <div className="text-sm text-muted-foreground">{report.jobName}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onReportSelect(report)}
                                  className="h-8"
                                >
                                  Ver Relatório
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeReportMutation.mutate(report.id)}
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}

          {/* Unorganized reports */}
          <Card 
            className={`transition-all duration-200 ${
              dragOverFolder === 'unorganized' ? 'ring-2 ring-gray-500 bg-gray-50' : ''
            }`}
            onDragOver={(e) => handleDragOver(e)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e)}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-500" />
                Relatórios Não Organizados
                <Badge variant="outline" className="text-xs">
                  {getUnorganizedReports().length} relatórios
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {getUnorganizedReports().length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    Todos os relatórios estão organizados em pastas
                  </div>
                ) : (
                  getUnorganizedReports().map((report) => (
                    <div
                      key={report.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, report)}
                      className="group p-3 border rounded-lg hover:bg-gray-50 cursor-move transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <GripVertical className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                          <FileText className="w-4 h-4 text-blue-500" />
                          <div>
                            <div className="font-medium">{report.selectionName}</div>
                            <div className="text-sm text-muted-foreground">{report.jobName}</div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onReportSelect(report)}
                          className="h-8"
                        >
                          Ver Relatório
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
                    className={`w-12 h-12 rounded-lg border-2 transition-all ${
                      newFolderColor === color.value ? 'border-gray-900 scale-110' : 'border-gray-300'
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
              Todos os relatórios nesta pasta voltarão para a seção "Não Organizados".
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