import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
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
  Smartphone
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();

  const masterMenuItems = [
    { path: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { path: "/vagas", label: "Cadastrar Vagas", icon: Briefcase },
    { path: "/candidates", label: "Lista de Candidatos", icon: Users },
    { path: "/candidatos", label: "Candidatos", icon: Smartphone },
    { path: "/selecoes", label: "Seleções", icon: ClipboardList },
    { path: "/relatorios", label: "Relatórios", icon: FileText },
    { path: "/clients", label: "Clientes", icon: Building },
    { path: "/configuracoes", label: "Configurações API", icon: Settings },
  ];

  const clientMenuItems = [
    { path: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { path: "/vagas", label: "Cadastrar Vagas", icon: Briefcase },
    { path: "/candidates", label: "Lista de Candidatos", icon: Users },
    { path: "/candidatos", label: "Candidatos", icon: Smartphone },
    { path: "/selecoes", label: "Seleções", icon: ClipboardList },
    { path: "/relatorios", label: "Relatórios", icon: FileText },
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
      <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:z-50 lg:bg-white lg:shadow-xl">
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
        <div className="absolute bottom-0 w-64 p-4 border-t border-slate-200 bg-white">
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
        "fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out lg:hidden",
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
        
        {/* Mobile User Profile */}
        <div className="absolute bottom-0 w-64 p-4 border-t border-slate-200 bg-white">
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
