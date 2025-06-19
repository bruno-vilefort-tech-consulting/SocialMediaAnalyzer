import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateTime(date: any): string {
  if (!date) return '';
  
  try {
    let dateObj: Date;
    
    // Handle Firebase Timestamp
    if (date && typeof date === 'object' && date.seconds) {
      dateObj = new Date(date.seconds * 1000);
    } 
    // Handle regular Date object or string
    else {
      dateObj = new Date(date);
    }
    
    // Validate date
    if (isNaN(dateObj.getTime())) {
      return 'Data inválida';
    }
    
    return dateObj.toLocaleString('pt-BR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Erro ao formatar data:', error);
    return 'Data inválida';
  }
}
