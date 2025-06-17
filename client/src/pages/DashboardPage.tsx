import { useAuth } from "@/hooks/useAuth";
import MasterDashboard from "./MasterDashboard";
import ClientDashboard from "./ClientDashboard";

export default function DashboardPage() {
  const { user } = useAuth();

  // Render the appropriate dashboard based on user role
  if (user?.role === 'master') {
    return <MasterDashboard />;
  } else if (user?.role === 'client') {
    return <ClientDashboard />;
  }

  return null;
}