import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { 
  Building, 
  Settings, 
  BarChart3, 
  Users, 
  Briefcase, 
  ClipboardList, 
  PieChart,
  Crown,
  X,
  Mic,
  LogOut,
  MessageCircle,
  FileText,
  Smartphone,
  Wifi,
  WifiOff,
  TrendingUp,
  CheckSquare
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();

  // WhatsApp status (Evolution API com fallback para Baileys)
  const { data: evolutionStatus } = useQuery({
    queryKey: ['/api/evolution/status'],
    queryFn: () => apiRequest('/api/evolution/status'),
    refetchInterval: 5000,
    staleTime: 4000,
    enabled: user?.role === 'client',
    retry: 1
  });

  const { data: whatsappStatus } = useQuery({
    queryKey: ['/api/whatsapp-client/status'],
    queryFn: () => apiRequest('/api/whatsapp-client/status'),
    refetchInterval: 5000,
    staleTime: 4000,
    enabled: user?.role === 'client' && !evolutionStatus
  });

  // Priorizar Evolution API
  const activeWhatsappStatus = evolutionStatus || whatsappStatus;

  const masterMenuItems = [
    { path: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { path: "/candidatos", label: "Candidatos", icon: Smartphone },
    { path: "/candidates", label: "Lista de Candidatos", icon: Users },
    { path: "/vagas", label: "Cadastrar Vagas", icon: Briefcase },
    { path: "/selecoes", label: "Seleções", icon: ClipboardList },
    { path: "/relatorios", label: "Relatórios", icon: FileText },
    { path: "/assessments", label: "Assessments", icon: CheckSquare },
    { path: "/clients", label: "Clientes", icon: Building },
    { path: "/configuracoes", label: "Configurações API", icon: Settings },
  ];

  const clientMenuItems = [
    { path: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { path: "/candidatos", label: "Candidatos", icon: Smartphone },
    { path: "/candidates", label: "Lista de Candidatos", icon: Users },
    { path: "/vagas", label: "Cadastrar Vagas", icon: Briefcase },
    { path: "/selecoes", label: "Seleções", icon: ClipboardList },
    { path: "/relatorios", label: "Relatórios", icon: FileText },
    { path: "/assessments", label: "Assessments", icon: CheckSquare },
    { path: "/estatisticas", label: "Estatísticas", icon: TrendingUp },
    { path: "/configuracoes", label: "Configurações", icon: Settings },
  ];

  const menuItems = user?.role === "master" ? masterMenuItems : clientMenuItems;

  const handleNavigation = (path: string) => {
    setLocation(path);
    onClose();
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-52 lg:fixed lg:inset-y-0 lg:z-50 lg:bg-white lg:shadow-xl">
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-200">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
              <Mic className="text-white text-sm" />
            </div>
            <span className="ml-3 font-semibold text-slate-900">Maximus IA</span>
          </div>
        </div>
        
        {/* Navigation Menu */}
        <nav className="flex-1 mt-6 px-3 pb-20 overflow-y-auto">
          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigation(item.path)}
                  className={cn(
                    "w-full group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    isActive 
                      ? "bg-primary/10 text-primary border-r-2 border-primary" 
                      : "text-slate-700 hover:bg-slate-100 hover:text-primary"
                  )}
                >
                  <Icon className={cn(
                    "mr-3 h-5 w-5",
                    isActive ? "text-primary" : "text-slate-400 group-hover:text-primary"
                  )} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* User Profile */}
        <div className="absolute bottom-0 w-52 p-4 border-t border-slate-200 bg-white">
          <div className="flex items-center">
            <div className="h-10 w-10 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center">
              {user?.role === "master" ? (
                <Crown className="h-5 w-5 text-white" />
              ) : (
                <Building className="h-5 w-5 text-white" />
              )}
            </div>
            <div className="ml-3 flex-1">
              <div className="text-sm font-medium text-slate-900 truncate">{user?.name}</div>
              <div className="text-xs text-slate-500 capitalize">{user?.role}</div>
            </div>
            <button 
              onClick={logout}
              className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-52 bg-white shadow-xl transform transition-transform duration-300 ease-in-out lg:hidden",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-200">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
              <Mic className="text-white text-sm" />
            </div>
            <span className="ml-3 font-semibold text-slate-900">Maximus IA</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        
        {/* Mobile Navigation Menu */}
        <nav className="flex-1 mt-6 px-3 pb-20 overflow-y-auto">
          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigation(item.path)}
                  className={cn(
                    "w-full group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-slate-700 hover:bg-slate-100 hover:text-primary"
                  )}
                >
                  <Icon className={cn(
                    "mr-3 h-5 w-5",
                    isActive ? "text-primary" : "text-slate-400 group-hover:text-primary"
                  )} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>
        
        {/* Mobile WhatsApp Status Indicator - Only for clients */}
        {user?.role === 'client' && (
          <div className="absolute bottom-20 w-52 p-3">
            <div className={cn(
              "flex items-center justify-between p-3 rounded-lg border transition-all duration-300",
              whatsappStatus?.isConnected 
                ? "bg-green-50 border-green-200 hover:bg-green-100" 
                : "bg-red-50 border-red-200 hover:bg-red-100"
            )}>
              <div className="flex items-center space-x-3">
                <div className={cn(
                  "p-2 rounded-full",
                  activeWhatsappStatus?.isConnected 
                    ? "bg-green-100" 
                    : "bg-red-100"
                )}>
                  {activeWhatsappStatus?.isConnected ? (
                    <Wifi className="h-4 w-4 text-green-600" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-red-600" />
                  )}
                </div>
                <div>
                  <div className={cn(
                    "text-sm font-medium",
                    activeWhatsappStatus?.isConnected 
                      ? "text-green-700" 
                      : "text-red-700"
                  )}>
                    WhatsApp {evolutionStatus ? '(Evolution)' : '(Baileys)'}
                  </div>
                  <div className={cn(
                    "text-xs",
                    activeWhatsappStatus?.isConnected 
                      ? "text-green-600" 
                      : "text-red-600"
                  )}>
                    {activeWhatsappStatus?.isConnected ? 'Conectado' : 'Desconectado'}
                  </div>
                </div>
              </div>
              <div className={cn(
                "w-2 h-2 rounded-full animate-pulse",
                activeWhatsappStatus?.isConnected 
                  ? "bg-green-500" 
                  : "bg-red-500"
              )} />
            </div>
          </div>
        )}
        
        {/* Mobile User Profile */}
        <div className="absolute bottom-0 w-52 p-4 border-t border-slate-200 bg-white">
          <div className="flex items-center">
            <div className="h-10 w-10 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center">
              {user?.role === "master" ? (
                <Crown className="h-5 w-5 text-white" />
              ) : (
                <Building className="h-5 w-5 text-white" />
              )}
            </div>
            <div className="ml-3 flex-1">
              <div className="text-sm font-medium text-slate-900 truncate">{user?.name}</div>
              <div className="text-xs text-slate-500 capitalize">{user?.role}</div>
            </div>
            <button 
              onClick={logout}
              className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
