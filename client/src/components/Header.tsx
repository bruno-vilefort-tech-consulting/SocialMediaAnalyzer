import { Menu, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const currentDate = new Date().toLocaleDateString('pt-BR', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <header className="bg-white shadow-sm border-b border-slate-200 h-16 flex items-center px-4 sm:px-6 sticky top-0 z-30">
      <Button
        variant="ghost"
        size="sm"
        onClick={onMenuClick}
        className="lg:hidden mr-4"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <div className="flex-1" />
      
      <div className="flex items-center space-x-3">
        <div className="text-sm text-slate-600 hidden sm:block">
          {currentDate}
        </div>
      </div>
    </header>
  );
}
