import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import LoginPage from "@/pages/LoginPage";
import MasterDashboard from "@/pages/MasterDashboard";
import ClientsPage from "@/pages/ClientsPage";
import ApiConfigPage from "@/pages/ApiConfigPage";
import ClientDashboard from "@/pages/ClientDashboard";
import JobsPage from "@/pages/JobsPage";
import CadastroVagasPage from "@/pages/CadastroVagasPage";
import CandidatesPage from "@/pages/CandidatesPage";
import SelectionsPage from "@/pages/SelectionsPage";
import ResultsPage from "@/pages/ResultsPage";
import InterviewPage from "@/pages/InterviewPage";
import NotFound from "@/pages/not-found";

function PrivateRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Redirect to="/unauthorized" />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/interview/:token?" component={InterviewPage} />

      {/* Master Routes */}
      <Route path="/dashboard">
        <PrivateRoute allowedRoles={['master']}>
          <Layout>
            <MasterDashboard />
          </Layout>
        </PrivateRoute>
      </Route>

      <Route path="/clients">
        <PrivateRoute allowedRoles={['master']}>
          <Layout>
            <ClientsPage />
          </Layout>
        </PrivateRoute>
      </Route>

      <Route path="/vagas">
        <PrivateRoute allowedRoles={['master', 'client']}>
          <Layout>
            <JobsPage />
          </Layout>
        </PrivateRoute>
      </Route>

      <Route path="/cadastro-vagas">
        <PrivateRoute allowedRoles={['master', 'client']}>
          <Layout>
            <CadastroVagasPage />
          </Layout>
        </PrivateRoute>
      </Route>

      <Route path="/api-config">
        <PrivateRoute allowedRoles={['master']}>
          <Layout>
            <ApiConfigPage />
          </Layout>
        </PrivateRoute>
      </Route>

      <Route path="/reports">
        <PrivateRoute allowedRoles={['master']}>
          <Layout>
            <MasterDashboard />
          </Layout>
        </PrivateRoute>
      </Route>

      {/* Client Routes */}
      <Route path="/client-dashboard">
        <PrivateRoute allowedRoles={['client']}>
          <Layout>
            <ClientDashboard />
          </Layout>
        </PrivateRoute>
      </Route>

      <Route path="/jobs">
        <PrivateRoute allowedRoles={['client', 'master']}>
          <Layout>
            <CadastroVagasPage />
          </Layout>
        </PrivateRoute>
      </Route>

      <Route path="/candidates">
        <PrivateRoute allowedRoles={['client', 'master']}>
          <Layout>
            <CandidatesPage />
          </Layout>
        </PrivateRoute>
      </Route>

      <Route path="/selections">
        <PrivateRoute allowedRoles={['client']}>
          <Layout>
            <SelectionsPage />
          </Layout>
        </PrivateRoute>
      </Route>

      <Route path="/results">
        <PrivateRoute allowedRoles={['client']}>
          <Layout>
            <ResultsPage />
          </Layout>
        </PrivateRoute>
      </Route>

      {/* Default redirects */}
      <Route path="/">
        <PrivateRoute>
          <RedirectToDashboard />
        </PrivateRoute>
      </Route>

      {/* Fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

function RedirectToDashboard() {
  const { user } = useAuth();

  if (user?.role === 'master') {
    return <Redirect to="/dashboard" />;
  } else if (user?.role === 'client') {
    return <Redirect to="/client-dashboard" />;
  }

  return <Redirect to="/login" />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;