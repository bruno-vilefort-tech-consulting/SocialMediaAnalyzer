import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  clientId?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('🔐 useAuth: Verificando token no localStorage...');
    // Verifica se há um token salvo no localStorage
    const token = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('user');

    console.log('🔐 useAuth:', { hasToken: !!token, hasUser: !!savedUser });

    if (token && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        console.log('🔐 useAuth: Usuário carregado do localStorage:', parsedUser);
        setUser(parsedUser);
      } catch (error) {
        console.error('🔐 useAuth: Erro ao carregar usuário salvo:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
      }
    }
    
    setIsLoading(false);
    console.log('🔐 useAuth: Inicialização concluída');
  }, []);

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/login';
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout,
  };

  return React.createElement(
    AuthContext.Provider,
    { value },
    children
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook alternativo que usa react-query para validar o token
export function useAuthQuery() {
  const token = localStorage.getItem('authToken');
  
  const { data: user, isLoading } = useQuery({
    queryKey: ['/api/auth/user'],
    enabled: !!token,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  return {
    user,
    isLoading: isLoading && !!token,
    isAuthenticated: !!user && !!token,
  };
}