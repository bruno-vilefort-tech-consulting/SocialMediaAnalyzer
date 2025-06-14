import { useEffect } from "react";
import { useParams, useLocation } from "wouter";

export default function InterviewPage() {
  const { token } = useParams();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Redirecionar automaticamente para a nova interface limpa
    if (token) {
      setLocation(`/natural-interview/${token}`);
    }
  }, [token, setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecionando para entrevista...</p>
      </div>
    </div>
  );
}